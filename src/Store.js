import * as Y from 'yjs'
import { createRetroStore, VOTE_TYPES } from './core/createStore'
import * as BrowserPlatform from './core/platform/browser'
import { getRandomAnimal } from './utils/animals'
import { getRandomColor } from './utils/colors'
import { IndexeddbPersistence } from 'y-indexeddb'

export { VOTE_TYPES }

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
const roomName = import.meta.hot?.data.roomName || getRoomName()
const doc = import.meta.hot?.data.doc || new Y.Doc()
const existingProvider = import.meta.hot?.data.webrtcProvider

if (import.meta.hot) {
    import.meta.hot.data.roomName = roomName
    import.meta.hot.data.doc = doc
}

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

const localDefaults = getLocalSettings()

// Generate user identity
const userId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
const userName = getRandomAnimal()
const userColor = getRandomColor()

const store = createRetroStore({
    roomName,
    user: {
        id: userId,
        name: userName,
        color: userColor,
    },
    platform: BrowserPlatform,
    persistenceProvider: new IndexeddbPersistence(roomName, doc),
    existingDoc: doc,
    existingProvider,
    onAlert: (msg) => alert(msg),
    onConfirm: (msg) => confirm(msg),
    signalingUrl: import.meta.env.VITE_SIGNALING_URL
})

// Initialize local settings if missing
if (!store.settings.has('maxVotes')) {
    store.settings.set('maxVotes', localDefaults.maxVotes)
}
if (!store.settings.has('timerEnabled')) {
    store.settings.set('timerEnabled', true)
}
if (!store.settings.has('timerDuration')) {
    store.settings.set('timerDuration', 5)
}

// Attach extra helper to match previous API
store.saveLocalSettings = saveLocalSettings
store.userColor = userColor // Expose for UI if needed
store.userName = userName

// HMR Logic
if (import.meta.hot) {
    import.meta.hot.data.doc = store.doc
    import.meta.hot.data.webrtcProvider = store.webrtcProvider
    
    import.meta.hot.dispose(() => {
        store.destroy()
    })
}

// Export default for compatibility
export default store
