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

// Persist state across HMR
const doc = import.meta.hot?.data.doc || new Y.Doc()
const roomName = import.meta.hot?.data.roomName || getRoomName()

if (import.meta.hot) {
    import.meta.hot.data.doc = doc
    import.meta.hot.data.roomName = roomName
}

// Create shared arrays for each column
const kudosCards = doc.getArray('kudos')
const goodCards = doc.getArray('good')
const improveCards = doc.getArray('improve')
const actionCards = doc.getArray('action')

// Shared map for collaborative text editing (Y.Text instances)
const cardTexts = doc.getMap('cardTexts')

// Local storage for settings defaults
const SETTINGS_STORAGE_KEY = 'retro-settings-defaults'
const DEFAULT_SETTINGS = {
    maxVotes: 5,
    theme: 'modern',
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

export const VOTE_TYPES = ['👍', '❓', '❤️']

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
const connectionStatus = import.meta.hot?.data.connectionStatus || {
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

if (import.meta.hot) {
    import.meta.hot.data.connectionStatus = connectionStatus
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

// Migrate existing cards to use Y.Text
function migrateAllCards() {
    const allColumns = [kudosCards, goodCards, improveCards, actionCards]

    allColumns.forEach(columnArray => {
        doc.transact(() => {
            const cards = columnArray.toArray()
            cards.forEach((card, index) => {
                if (!card.textId) {
                    const textId = `text-${card.id}`
                    const yText = new Y.Text()
                    if (card.text) {
                        yText.insert(0, card.text)
                    }
                    cardTexts.set(textId, yText)

                    const migratedCard = {
                        ...card,
                        textId,
                        isCommitted: true  // Existing cards are committed
                    }
                    columnArray.delete(index, 1)
                    columnArray.insert(index, [migratedCard])
                }
            })
        })
    })
}

// Set up providers (persist across HMR)
let webrtcProvider = import.meta.hot?.data.webrtcProvider
let indexeddbProvider = import.meta.hot?.data.indexeddbProvider

if (!webrtcProvider) {
    webrtcProvider = createWebrtcProvider()
    
    // Run initial connectivity check only once
    checkSignalingConnectivity()

    // Watch for disconnection and schedule retry
    webrtcProvider.on('status', ({ connected }) => {
        if (!connected && retryCount < RETRY_CONFIG.maxRetries) {
            scheduleRetry()
        }
    })

    if (import.meta.hot) {
        import.meta.hot.data.webrtcProvider = webrtcProvider
    }
}

if (!indexeddbProvider) {
    indexeddbProvider = new IndexeddbPersistence(roomName, doc)
    
    // Run migration after IndexedDB syncs
    indexeddbProvider.on('synced', () => {
        migrateAllCards()
    })

    if (import.meta.hot) {
        import.meta.hot.data.indexeddbProvider = indexeddbProvider
    }
}

// Cleanup abandoned uncommitted cards after 5 minutes
function startCleanupTimer() {
    return setInterval(() => {
        const allColumns = [kudosCards, goodCards, improveCards, actionCards]
        const now = Date.now()
        const THRESHOLD = 5 * 60 * 1000 // 5 minutes

        allColumns.forEach(columnArray => {
            const cards = columnArray.toArray()
            cards.forEach((card) => {
                if (!card.isCommitted && (now - card.createdAt) > THRESHOLD) {
                    // Check if anyone is currently editing
                    const states = Array.from(awareness.getStates().values())
                    const isBeingEdited = states.some(s =>
                        s.user?.isTyping && s.user?.typingCardId === card.id
                    )

                    if (!isBeingEdited) {
                        console.log(`[cleanup] Removing abandoned card: ${card.id}`)
                        deleteCard(columnArray, card.id)
                    }
                }
            })
        })
    }, 60000) // Check every minute
}

// Start cleanup timer only once
let cleanupInterval = import.meta.hot?.data.cleanupInterval
if (!cleanupInterval) {
    cleanupInterval = startCleanupTimer()
    if (import.meta.hot) {
        import.meta.hot.data.cleanupInterval = cleanupInterval
    }
}

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

// Helper to get or create Y.Text for a card
function getOrCreateCardText(textId) {
    if (!cardTexts.has(textId)) {
        cardTexts.set(textId, new Y.Text())
    }
    return cardTexts.get(textId)
}

// Helper to cleanup Y.Text when card is deleted
function cleanupCardText(textId) {
    if (cardTexts.has(textId)) {
        cardTexts.delete(textId)
    }
}

// Helper to create a new card
function createCard(columnArray, text = '') {
    const cardId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
    const textId = `text-${cardId}`

    doc.transact(() => {
        // Create Y.Text instance for collaborative editing
        const yText = new Y.Text()
        if (text) {
            yText.insert(0, text)
        }
        cardTexts.set(textId, yText)

        // Create card with reference to Y.Text
        const card = {
            id: cardId,
            textId: textId,
            text: text,  // Legacy field for backward compatibility
            isCommitted: false,  // Starts in uncommitted state
            votes: 0,
            votedBy: [],
            reactions: {},
            createdBy: userId,
            createdAt: Date.now(),
        }

        columnArray.push([card])
    })

    return { id: cardId, textId: textId }
}

// Helper to update a card in an array
function updateCard(columnArray, cardId, updates) {
    doc.transact(() => {
        const cards = columnArray.toArray()
        const index = cards.findIndex(c => c.id === cardId)
        if (index !== -1) {
            const updatedCard = { ...cards[index], ...updates }
            const yText = cardTexts.get(updatedCard.textId)
            const textContent = yText?.toString() || ''

            // Delete empty cards (no text and no image)
            if (!textContent.trim() && !updatedCard.image) {
                if (updatedCard.textId) {
                    cleanupCardText(updatedCard.textId)
                }
                columnArray.delete(index, 1)
                return
            }

            columnArray.delete(index, 1)
            columnArray.insert(index, [updatedCard])
        }
    })
}

// Helper to commit a card (mark as finished editing)
function commitCard(columnArray, cardId) {
    doc.transact(() => {
        const cards = columnArray.toArray()
        const index = cards.findIndex(c => c.id === cardId)
        if (index !== -1) {
            const card = cards[index]
            const yText = cardTexts.get(card.textId)
            const textContent = yText?.toString() || ''

            // Delete empty cards instead of committing
            if (!textContent.trim() && !card.image) {
                // Clean up Y.Text
                if (card.textId) {
                    cleanupCardText(card.textId)
                }
                columnArray.delete(index, 1)
                return
            }

            const updatedCard = {
                ...card,
                isCommitted: true,
                text: textContent,  // Sync text for legacy compatibility
                editedAt: Date.now()
            }
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
            const card = cards[index]
            // Cleanup Y.Text instance
            if (card.textId) {
                cleanupCardText(card.textId)
            }
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
        let userVotes = 0
        
        // Count legacy votes
        if (card.votedBy?.includes(userId)) {
            userVotes++
        }
        
        // Count reaction votes
        if (card.reactions) {
            Object.values(card.reactions).forEach(userIds => {
                if (userIds.includes(userId)) {
                    userVotes++
                }
            })
        }
        
        return count + userVotes
    }, 0)
}

// Helper to vote on a card
function toggleVote(columnArray, cardId, emoji = '👍') {
    doc.transact(() => {
        const cards = columnArray.toArray()
        const index = cards.findIndex(c => c.id === cardId)
        if (index !== -1) {
            let card = cards[index]
            
            // Initialize or copy reactions
            let reactions = card.reactions ? { ...card.reactions } : {}
            
            // Migration: Move legacy votedBy to '👍' reaction
            if (card.votedBy && card.votedBy.length > 0) {
                const legacyVotes = card.votedBy
                reactions['👍'] = [...new Set([...(reactions['👍'] || []), ...legacyVotes])]
                card = { ...card, votedBy: [] } // Clear legacy
            }

            const userIdsForEmoji = reactions[emoji] || []
            const hasVoted = userIdsForEmoji.includes(userId)

            if (!hasVoted) {
                const maxVotes = settings.get('maxVotes') || 5
                const currentVotes = getTotalVotesByUser(userId)
                if (currentVotes >= maxVotes) {
                    alert(`You have reached the maximum of ${maxVotes} votes.`)
                    return
                }
            }

            const newUserIds = hasVoted
                ? userIdsForEmoji.filter(id => id !== userId)
                : [...userIdsForEmoji, userId]
            
            reactions[emoji] = newUserIds
            
            // Calculate total votes for display/legacy compatibility
            const totalVotes = Object.values(reactions).reduce((sum, arr) => sum + arr.length, 0)

            const updatedCard = {
                ...card,
                votes: totalVotes,
                reactions,
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

    // Card texts (Y.Text instances)
    cardTexts,

    // Settings
    settings,
    timer,

    // Actions
    createCard,
    updateCard,
    deleteCard,
    commitCard,
    toggleVote,
    setTypingState,
    clearBoard,
    startTimer,
    stopTimer,
    dismissTimer,
    reconnect,
    saveLocalSettings,

    // Text helpers
    getOrCreateCardText,
    cleanupCardText,

    // Providers (for cleanup)
    webrtcProvider,
    indexeddbProvider,

    // Connection status
    connectionStatus,
}

// HMR Cleanup
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        // We only clean up non-persisted things.
        // If we want to truly destroy on full reload, we can use a different mechanism.
        // But for HMR we keep doc and providers alive.
        connectionStatus.listeners.clear()
        if (retryTimeout) clearTimeout(retryTimeout)
    })
}

// Cleanup retry timeout on page unload
window.addEventListener('beforeunload', () => {
    if (retryTimeout) clearTimeout(retryTimeout)
})

export default store