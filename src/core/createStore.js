import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

export const VOTE_TYPES = ['👍', '❓', '❤️']

const RETRY_CONFIG = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
}

export function createRetroStore({
    roomName,
    user, // { id, name, color }
    platform = {}, // { RTCPeerConnection, ... }
    persistenceProvider = null, // e.g. IndexeddbPersistence instance
    ProviderClass = WebrtcProvider, // Allow dependency injection
    signalingUrl = null,
    onAlert = (msg) => console.log('Alert:', msg),
    onConfirm = (msg) => { console.log('Confirm:', msg); return true; },
    existingDoc = null,
    existingProvider = null
}) {
    const doc = existingDoc || new Y.Doc({ guid: roomName })
    
    // Shared types
    const kudosCards = doc.getArray('kudos')
    const goodCards = doc.getArray('good')
    const improveCards = doc.getArray('improve')
    const actionCards = doc.getArray('action')
    const cardTexts = doc.getMap('cardTexts')
    const settings = doc.getMap('settings')
    const timer = doc.getMap('timer')

    // Connection Status State
    const connectionStatus = {
        signaling: 'connecting',
        signalingServer: null,
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
            fn(this.getStatus())
            return () => this.listeners.delete(fn)
        }
    }

    let retryCount = 0
    let retryTimeout = null
    let webrtcProvider = existingProvider

    // Signaling
    const SIGNALING_SERVERS = signalingUrl ? [signalingUrl] : []

    function createWebrtcProvider() {
        const providerOpts = {
            signaling: SIGNALING_SERVERS.filter(s => !!s),
            peerOpts: {}
        }
        
        // Inject platform-specific WebRTC implementation if provided
        if (platform.RTCPeerConnection) {
            providerOpts.peerOpts.wrtc = platform
        }

        const provider = new ProviderClass(roomName, doc, providerOpts)

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
            // console.log('Peers update:', webrtcPeers.size)
        })

        provider.on('synced', ({ synced }) => {
            connectionStatus.update({ synced })
        })

        return provider
    }

    function scheduleRetry() {
        if (retryCount >= RETRY_CONFIG.maxRetries) {
            console.error('[y-webrtc] Max retries reached.')
            connectionStatus.update({ signaling: 'failed', retrying: false })
            return
        }

        const delay = Math.min(
            RETRY_CONFIG.baseDelay * Math.pow(2, retryCount),
            RETRY_CONFIG.maxDelay
        )

        console.log(`[y-webrtc] Retrying connection in ${delay / 1000}s`)
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

    if (!webrtcProvider) {
        webrtcProvider = createWebrtcProvider()
        webrtcProvider.on('status', ({ connected }) => {
            if (!connected && retryCount < RETRY_CONFIG.maxRetries) {
                scheduleRetry()
            }
        })
    }

    // Set Awareness
    const awareness = webrtcProvider.awareness
    awareness.setLocalStateField('user', {
        id: user.id,
        name: user.name,
        color: user.color.hex,
        colorClasses: user.color,
        isTyping: false,
        typingCardId: null,
    })

    // Persistence Hook
    if (persistenceProvider) {
        persistenceProvider.on('synced', () => {
            migrateAllCards()
        })
    }

    // Actions
    function getOrCreateCardText(textId) {
        if (!cardTexts.has(textId)) {
            cardTexts.set(textId, new Y.Text())
        }
        return cardTexts.get(textId)
    }

    function cleanupCardText(textId) {
        if (cardTexts.has(textId)) {
            cardTexts.delete(textId)
        }
    }

    function createCard(columnArray, text = '') {
        const cardId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
        const textId = `text-${cardId}`

        doc.transact(() => {
            const yText = new Y.Text()
            if (text) yText.insert(0, text)
            cardTexts.set(textId, yText)

            const card = {
                id: cardId,
                textId: textId,
                text: text,
                isCommitted: false,
                votes: 0,
                votedBy: [],
                reactions: {},
                createdBy: user.id,
                createdAt: Date.now(),
            }
            columnArray.push([card])
        })
        return { id: cardId, textId }
    }

    function updateCard(columnArray, cardId, updates) {
        doc.transact(() => {
            const cards = columnArray.toArray()
            const index = cards.findIndex(c => c.id === cardId)
            if (index !== -1) {
                const updatedCard = { ...cards[index], ...updates }
                const yText = cardTexts.get(updatedCard.textId)
                const textContent = yText?.toString() || ''

                if (!textContent.trim() && !updatedCard.image) {
                    if (updatedCard.textId) cleanupCardText(updatedCard.textId)
                    columnArray.delete(index, 1)
                    return
                }
                columnArray.delete(index, 1)
                columnArray.insert(index, [updatedCard])
            }
        })
    }

    function commitCard(columnArray, cardId) {
        doc.transact(() => {
            const cards = columnArray.toArray()
            const index = cards.findIndex(c => c.id === cardId)
            if (index !== -1) {
                const card = cards[index]
                const yText = cardTexts.get(card.textId)
                const textContent = yText?.toString() || ''

                if (!textContent.trim() && !card.image) {
                    if (card.textId) cleanupCardText(card.textId)
                    columnArray.delete(index, 1)
                    return
                }

                const updatedCard = {
                    ...card,
                    isCommitted: true,
                    text: textContent,
                    editedAt: Date.now()
                }
                columnArray.delete(index, 1)
                columnArray.insert(index, [updatedCard])
            }
        })
    }

    function deleteCard(columnArray, cardId) {
        doc.transact(() => {
            const cards = columnArray.toArray()
            const index = cards.findIndex(c => c.id === cardId)
            if (index !== -1) {
                const card = cards[index]
                if (card.textId) cleanupCardText(card.textId)
                columnArray.delete(index, 1)
            }
        })
    }

    function getTotalVotesByUser(userId) {
        const allCards = [
            ...kudosCards.toArray(),
            ...goodCards.toArray(),
            ...improveCards.toArray(),
            ...actionCards.toArray(),
        ]
        return allCards.reduce((count, card) => {
            const votedOnThisCard = new Set()
            if (card.votedBy?.includes(userId)) {
                votedOnThisCard.add(card.id)
            }
            if (card.reactions) {
                for (const userIds of Object.values(card.reactions)) {
                    if (userIds.includes(userId)) {
                        votedOnThisCard.add(card.id)
                        break 
                    }
                }
            }
            return count + votedOnThisCard.size
        }, 0)
    }

    function toggleVote(columnArray, cardId, emoji = '👍') {
        doc.transact(() => {
            const cards = columnArray.toArray()
            const index = cards.findIndex(c => c.id === cardId)
            if (index !== -1) {
                let card = cards[index]
                let reactions = card.reactions ? { ...card.reactions } : {}
                
                if (card.votedBy && card.votedBy.length > 0) {
                    const legacyVotes = card.votedBy
                    reactions['👍'] = [...new Set([...(reactions['👍'] || []), ...legacyVotes])]
                    card = { ...card, votedBy: [] }
                }

                const userIdsForEmoji = reactions[emoji] || []
                const hasVoted = userIdsForEmoji.includes(user.id)

                if (!hasVoted) {
                    const maxVotes = settings.get('maxVotes') || 5
                    const currentVotes = getTotalVotesByUser(user.id)
                    if (currentVotes >= maxVotes) {
                        onAlert(`You have reached the maximum of ${maxVotes} votes.`)
                        return
                    }
                }

                const newUserIds = hasVoted
                    ? userIdsForEmoji.filter(id => id !== user.id)
                    : [...userIdsForEmoji, user.id]
                
                reactions[emoji] = newUserIds
                const totalVotes = Object.values(reactions).reduce((sum, arr) => sum + arr.length, 0)

                const updatedCard = { ...card, votes: totalVotes, reactions }
                columnArray.delete(index, 1)
                columnArray.insert(index, [updatedCard])
            }
        })
    }

    function setTypingState(isTyping, cardId = null) {
        awareness.setLocalStateField('user', {
            ...awareness.getLocalState()?.user,
            isTyping,
            typingCardId: cardId,
        })
    }

    function clearBoard() {
        if (onConfirm('Are you sure you want to clear the entire board? This cannot be undone.')) {
            doc.transact(() => {
                kudosCards.delete(0, kudosCards.length)
                goodCards.delete(0, goodCards.length)
                improveCards.delete(0, improveCards.length)
                actionCards.delete(0, actionCards.length)
            })
        }
    }

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

    function reconnect() {
        retryCount = 0
        if (retryTimeout) clearTimeout(retryTimeout)
        try {
            webrtcProvider.disconnect()
        } catch (e) {
            console.warn('Error disconnecting:', e)
        }
        setTimeout(() => {
            try {
                webrtcProvider.connect()
            } catch (e) {
                console.error('Error connecting:', e)
            }
        }, 100)
    }

    function migrateAllCards() {
        const allColumns = [kudosCards, goodCards, improveCards, actionCards]
        allColumns.forEach(columnArray => {
            doc.transact(() => {
                const cards = columnArray.toArray()
                cards.forEach((card, index) => {
                    if (!card.textId) {
                        const textId = `text-${card.id}`
                        const yText = new Y.Text()
                        if (card.text) yText.insert(0, card.text)
                        cardTexts.set(textId, yText)
                        const migratedCard = { ...card, textId, isCommitted: true }
                        columnArray.delete(index, 1)
                        columnArray.insert(index, [migratedCard])
                    }
                })
            })
        })
    }

    return {
        doc,
        roomName,
        awareness,
        webrtcProvider,
        persistenceProvider,
        connectionStatus,
        
        kudosCards,
        goodCards,
        improveCards,
        actionCards,
        cardTexts,
        settings,
        timer,

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
        getOrCreateCardText,
        cleanupCardText,
        
        destroy: () => {
            if (retryTimeout) clearTimeout(retryTimeout)
            connectionStatus.listeners.clear()
            // webrtcProvider.destroy() // Don't destroy if HMR needs it? 
            // In TUI we might want to destroy.
        }
    }
}
