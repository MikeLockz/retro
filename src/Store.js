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
const goodCards = doc.getArray('good')
const improveCards = doc.getArray('improve')
const actionCards = doc.getArray('action')

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

    for (const serverUrl of SIGNALING_SERVERS) {
        console.log(`[signaling] Checking ${serverUrl}...`)
        const result = await checkSignalingServer(serverUrl)

        if (result.connected) {
            console.log(`[signaling] ✓ Connected to ${serverUrl}`)
            connectionStatus.update({ signaling: 'connected', signalingServer: serverUrl })
            return true
        } else {
            console.warn(`[signaling] ✗ Failed to connect to ${serverUrl}: ${result.error}`)
        }
    }

    console.error('[signaling] All signaling servers are unreachable')
    connectionStatus.update({ signaling: 'failed', signalingServer: null })
    return false
}

// Run initial connectivity check
checkSignalingConnectivity()

// Create WebRTC provider with retry logic
function createWebrtcProvider() {
    const provider = new WebrtcProvider(roomName, doc, {
        signaling: SIGNALING_SERVERS,
    })

    // Monitor connection status
    provider.on('status', ({ connected }) => {
        if (connected) {
            console.log('[y-webrtc] Connected to signaling server')
            retryCount = 0
            connectionStatus.update({ signaling: 'connected', retrying: false, retryAttempt: 0 })
        } else {
            console.warn('[y-webrtc] Disconnected from signaling server')
            connectionStatus.update({ signaling: 'disconnected' })
        }
    })

    // Track sync status
    provider.on('synced', ({ synced }) => {
        if (synced) {
            console.log('[y-webrtc] Synced with peers')
        }
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
const userId = crypto.randomUUID()
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
        id: crypto.randomUUID(),
        text,
        votes: 0,
        votedBy: [],
        createdBy: userId,
        createdAt: Date.now(),
    }
    columnArray.push([card])
    return card
}

// Helper to update a card in an array
function updateCard(columnArray, cardId, updates) {
    const cards = columnArray.toArray()
    const index = cards.findIndex(c => c.id === cardId)
    if (index !== -1) {
        const updatedCard = { ...cards[index], ...updates }
        doc.transact(() => {
            columnArray.delete(index, 1)
            columnArray.insert(index, [updatedCard])
        })
    }
}

// Helper to delete a card
function deleteCard(columnArray, cardId) {
    const cards = columnArray.toArray()
    const index = cards.findIndex(c => c.id === cardId)
    if (index !== -1) {
        columnArray.delete(index, 1)
    }
}

// Helper to vote on a card
function toggleVote(columnArray, cardId) {
    const cards = columnArray.toArray()
    const index = cards.findIndex(c => c.id === cardId)
    if (index !== -1) {
        const card = cards[index]
        const votedBy = card.votedBy || []
        const hasVoted = votedBy.includes(userId)

        const updatedCard = {
            ...card,
            votes: hasVoted ? card.votes - 1 : card.votes + 1,
            votedBy: hasVoted
                ? votedBy.filter(id => id !== userId)
                : [...votedBy, userId],
        }

        doc.transact(() => {
            columnArray.delete(index, 1)
            columnArray.insert(index, [updatedCard])
        })
    }
}

// Set typing state in awareness
function setTypingState(isTyping, cardId = null) {
    awareness.setLocalStateField('user', {
        ...awareness.getLocalState()?.user,
        isTyping,
        typingCardId: cardId,
    })
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
    goodCards,
    improveCards,
    actionCards,

    // Actions
    createCard,
    updateCard,
    deleteCard,
    toggleVote,
    setTypingState,

    // Providers (for cleanup)
    webrtcProvider,
    indexeddbProvider,

    // Connection status
    connectionStatus,
}

export default store
