import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'
import { getRandomAnimal } from './utils/animals'
import { getRandomColor } from './utils/colors'

// Generate or retrieve room name from URL hash
function getRoomName() {
    let room = window.location.hash.slice(1)
    if (!room) {
        // Generate a random room name
        room = `retro-${Math.random().toString(36).substring(2, 8)}`
        window.location.hash = room
    }
    return room
}

// Create the Yjs document
const doc = new Y.Doc()
const roomName = getRoomName()

// Create shared arrays for each column
const kudosCards = doc.getArray('kudos')
const goodCards = doc.getArray('good')
const improveCards = doc.getArray('improve')
const actionCards = doc.getArray('action')

// Local storage for settings defaults
const SETTINGS_STORAGE_KEY = 'retro-settings-defaults'
const DEFAULT_SETTINGS = {
    maxVotes: 5,
}

function getLocalSettings() {
    try {
        const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS
    } catch (e) {
        return DEFAULT_SETTINGS
    }
}

function saveLocalSettings(updates) {
    const current = getLocalSettings()
    const updated = { ...current, ...updates }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
}

// Shared settings
const settings = doc.getMap('settings')
const localDefaults = getLocalSettings()

if (!settings.has('maxVotes')) {
    settings.set('maxVotes', localDefaults.maxVotes)
}
if (!settings.has('timerEnabled')) {
    settings.set('timerEnabled', true)
}
if (!settings.has('timerDuration')) {
    settings.set('timerDuration', 5)
}

// Timer state
const timer = doc.getMap('timer')

function startTimer() {
    const durationMins = settings.get('timerDuration') || 5
    doc.transact(() => {
        timer.set('startedAt', Date.now())
        timer.set('duration', durationMins * 60 * 1000)
    })
}

function stopTimer() {
    doc.transact(() => {
        timer.set('startedAt', null)
        timer.set('duration', null)
    })
}

function dismissTimer() {
    doc.transact(() => {
        timer.set('startedAt', null)
        timer.set('duration', null)
    })
}

const DEFAULT_SIGNALING_SERVERS = [
    'wss://signaling.yjs.dev',
    'wss://y-webrtc-signaling-eu.herokuapp.com',
    'wss://y-webrtc-signaling-us.herokuapp.com'
]

const SIGNALING_SERVERS = import.meta.env.VITE_SIGNALING_URL
    ? [import.meta.env.VITE_SIGNALING_URL]
    : DEFAULT_SIGNALING_SERVERS

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 5,
    baseDelay: 1000,  // 1 second
    maxDelay: 30000,  // 30 seconds
}

let retryCount = 0
let retryTimeout = null

// Connection status tracking
const connectionStatus = {
    signaling: 'connecting', // 'connected', 'connecting', 'disconnected', 'failed'
    signalingServer: null,   // which server is connected
    synced: false,
    retrying: false,
    retryAttempt: 0,
    listeners: new Set(),

    update(changes) {
        Object.assign(this, changes)
        this.listeners.forEach(fn => fn(this.getStatus()))
    },

    getStatus() {
        return {
            signaling: this.signaling,
            signalingServer: this.signalingServer,
            synced: this.synced,
            retrying: this.retrying,
            retryAttempt: this.retryAttempt,
        }
    },

    subscribe(fn) {
        this.listeners.add(fn)
        fn(this.getStatus()) // Immediate callback with current status
        return () => this.listeners.delete(fn)
    },
}

// Check if a signaling server is reachable via WebSocket
function checkSignalingServer(url, timeout = 5000) {
    return new Promise((resolve) => {
        const ws = new WebSocket(url)
        const timer = setTimeout(() => {
            ws.close()
            resolve({ url, connected: false, error: 'timeout' })
        }, timeout)

        ws.onopen = () => {
            clearTimeout(timer)
            ws.close()
            resolve({ url, connected: true })
        }

        ws.onerror = () => {
            clearTimeout(timer)
            ws.close()
            resolve({ url, connected: false, error: 'connection failed' })
        }
    })
}

// Check all signaling servers and update status
async function checkSignalingConnectivity() {
    connectionStatus.update({ signaling: 'connecting', signalingServer: null })

    let anyConnected = false
    for (const serverUrl of SIGNALING_SERVERS) {
        if (!serverUrl) continue
        try {
            const result = await checkSignalingServer(serverUrl)
            if (result.connected) {
                anyConnected = true
                // If we're already connected via WebRTC, don't overwrite with just 'connected'
                if (connectionStatus.signaling !== 'connected') {
                    connectionStatus.update({ signaling: 'connected', signalingServer: serverUrl })
                }
                break
            } else {
                console.warn(`[signaling] ✗ ${serverUrl} unreachable: ${result.error}`)
            }
        } catch (e) {
            console.error(`[signaling] Error probing ${serverUrl}:`, e)
        }
    }

    if (!anyConnected) {
        console.error('[signaling] All signaling servers are unreachable')
        connectionStatus.update({ signaling: 'failed', signalingServer: null })
    }
    return anyConnected
}

// Set up WebRTC provider with retry logic
function createWebrtcProvider() {
    const provider = new WebrtcProvider(roomName, doc, {
        signaling: SIGNALING_SERVERS.filter(s => !!s),
    })

    // Monitor connection status
    provider.on('status', ({ connected }) => {
        console.log(`[y-webrtc] Status changed: ${connected ? 'connected' : 'disconnected'}`)
        if (connected) {
            retryCount = 0
            connectionStatus.update({ signaling: 'connected', retrying: false, retryAttempt: 0 })
        } else {
            connectionStatus.update({ signaling: 'disconnected' })
        }
    })
    
    provider.on('peers', ({ webrtcPeers, bcPeers }) => {
        // Peer count tracking handled via connectionStatus if needed
    })

    // Track sync status
    provider.on('synced', ({ synced }) => {
        connectionStatus.update({ synced })
    })

    return provider
}

// Retry connection with exponential backoff
function scheduleRetry() {
    if (retryCount >= RETRY_CONFIG.maxRetries) {
        console.error('[y-webrtc] Max retries reached. Using local-only mode.')
        connectionStatus.update({ signaling: 'failed', retrying: false })
        return
    }

    const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, retryCount),
        RETRY_CONFIG.maxDelay
    )

    console.log(`[y-webrtc] Retrying connection in ${delay / 1000}s (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries})`)
    connectionStatus.update({ retrying: true, retryAttempt: retryCount + 1 })

    retryTimeout = setTimeout(() => {
        retryCount++
        try {
            webrtcProvider.connect()
        } catch (e) {
            console.error('[y-webrtc] Retry failed:', e)
            scheduleRetry()
        }
    }, delay)
}

// Set up WebRTC provider for P2P sync
let webrtcProvider = createWebrtcProvider()

// Run initial connectivity check
checkSignalingConnectivity()

// Watch for disconnection and schedule retry
webrtcProvider.on('status', ({ connected }) => {
    if (!connected && retryCount < RETRY_CONFIG.maxRetries) {
        scheduleRetry()
    }
})

// Cleanup retry timeout on page unload
window.addEventListener('beforeunload', () => {
    if (retryTimeout) clearTimeout(retryTimeout)
})

// Set up IndexedDB for local persistence
const indexeddbProvider = new IndexeddbPersistence(roomName, doc)

// Generate user identity
const userId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
const userName = getRandomAnimal()
const userColor = getRandomColor()

// Set initial awareness state
const awareness = webrtcProvider.awareness
awareness.setLocalStateField('user', {
    id: userId,
    name: userName,
    color: userColor.hex,
    colorClasses: userColor,
    isTyping: false,
    typingCardId: null,
})

// Helper to create a new card
function createCard(columnArray, text = '') {
    const card = {
        id: (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
        text,
        votes: 0,
        votedBy: [],
        createdBy: userId,
        createdAt: Date.now(),
    }
    doc.transact(() => {
        columnArray.push([card])
    })
    return card
}

// Helper to update a card in an array
function updateCard(columnArray, cardId, updates) {
    doc.transact(() => {
        const cards = columnArray.toArray()
        const index = cards.findIndex(c => c.id === cardId)
        if (index !== -1) {
            const updatedCard = { ...cards[index], ...updates }
            columnArray.delete(index, 1)
            columnArray.insert(index, [updatedCard])
        }
    })
}

// Helper to delete a card
function deleteCard(columnArray, cardId) {
    doc.transact(() => {
        const cards = columnArray.toArray()
        const index = cards.findIndex(c => c.id === cardId)
        if (index !== -1) {
            columnArray.delete(index, 1)
        }
    })
}

// Helper to count total votes by a user
function getTotalVotesByUser(userId) {
    const allCards = [
        ...kudosCards.toArray(),
        ...goodCards.toArray(),
        ...improveCards.toArray(),
        ...actionCards.toArray(),
    ]
    return allCards.reduce((count, card) => {
        return count + (card.votedBy?.filter(id => id === userId).length || 0)
    }, 0)
}

// Helper to vote on a card
function toggleVote(columnArray, cardId) {
    doc.transact(() => {
        const cards = columnArray.toArray()
        const index = cards.findIndex(c => c.id === cardId)
        if (index !== -1) {
            const card = cards[index]
            const votedBy = card.votedBy || []
            const hasVoted = votedBy.includes(userId)

            if (!hasVoted) {
                const maxVotes = settings.get('maxVotes') || 5
                const currentVotes = getTotalVotesByUser(userId)
                if (currentVotes >= maxVotes) {
                    alert(`You have reached the maximum of ${maxVotes} votes.`)
                    return
                }
            }

            const updatedCard = {
                ...card,
                votes: hasVoted ? card.votes - 1 : card.votes + 1,
                votedBy: hasVoted
                    ? votedBy.filter(id => id !== userId)
                    : [...votedBy, userId],
            }

            columnArray.delete(index, 1)
            columnArray.insert(index, [updatedCard])
        }
    })
}

// Helper to set typing state in awareness
function setTypingState(isTyping, cardId = null) {
    awareness.setLocalStateField('user', {
        ...awareness.getLocalState()?.user,
        isTyping,
        typingCardId: cardId,
    })
}

// Helper to clear the entire board
function clearBoard() {
    if (confirm('Are you sure you want to clear the entire board? This cannot be undone.')) {
        doc.transact(() => {
            kudosCards.delete(0, kudosCards.length)
            goodCards.delete(0, goodCards.length)
            improveCards.delete(0, improveCards.length)
            actionCards.delete(0, actionCards.length)
        })
    }
}

// Manual reconnect
function reconnect() {
    retryCount = 0
    if (retryTimeout) clearTimeout(retryTimeout)
    
    // Disconnect existing
    try {
        webrtcProvider.disconnect()
    } catch (e) {
        console.warn('Error disconnecting:', e)
    }

    // Attempt connect
    setTimeout(() => {
        try {
            webrtcProvider.connect()
            checkSignalingConnectivity()
        } catch (e) {
            console.error('Error connecting:', e)
        }
    }, 100)
}

// Export store
export const store = {
    doc,
    roomName,
    awareness,
    userId,
    userName,
    userColor,

    // Column arrays
    kudosCards,
    goodCards,
    improveCards,
    actionCards,
    
    // Settings
    settings,
    timer,

    // Actions
    createCard,
    updateCard,
    deleteCard,
    toggleVote,
    setTypingState,
    clearBoard,
    startTimer,
    stopTimer,
    dismissTimer,
    reconnect,
    saveLocalSettings,

    // Providers (for cleanup)
    webrtcProvider,
    indexeddbProvider,

    // Connection status
    connectionStatus,
}

// HMR Cleanup
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        webrtcProvider.destroy()
        indexeddbProvider.destroy()
        connectionStatus.listeners.clear()
        if (retryTimeout) clearTimeout(retryTimeout)
    })
}

export default store
