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

// Set up WebRTC provider for P2P sync
const webrtcProvider = new WebrtcProvider(roomName, doc, {
    signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com', 'wss://y-webrtc-signaling-us.herokuapp.com'],
})

// Set up IndexedDB for local persistence
const indexeddbProvider = new IndexeddbPersistence(roomName, doc)

// Generate user identity
const userId = crypto.randomUUID()
const userName = `Anonymous ${getRandomAnimal()}`
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
}

export default store
