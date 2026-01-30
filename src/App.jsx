import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, Users, Sparkles, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import store from './Store'
import Column from './components/Column'
import Presence from './components/Presence'
import { columnColors } from './utils/colors'

function App() {
    const [copied, setCopied] = useState(false)
    const [isConnected, setIsConnected] = useState(false)
    const [peerCount, setPeerCount] = useState(0)
    const [connStatus, setConnStatus] = useState({ signaling: 'connecting', synced: false, retrying: false })

    // Track connection status
    useEffect(() => {
        return store.connectionStatus.subscribe(setConnStatus)
    }, [])

    // Track peer count
    useEffect(() => {
        const updatePeerCount = () => {
            const states = store.awareness.getStates()
            setPeerCount(states.size)
            setIsConnected(states.size > 0)
        }

        store.awareness.on('change', updatePeerCount)
        updatePeerCount()

        return () => {
            store.awareness.off('change', updatePeerCount)
        }
    }, [])

    const copyLink = useCallback(() => {
        navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [])

    const shareUrl = window.location.href

    // Determine status indicator color and icon
    const getStatusIndicator = () => {
        if (connStatus.signaling === 'connected') {
            return {
                color: 'bg-emerald-400',
                icon: <Wifi className="w-4 h-4 text-emerald-400" />,
                text: 'Connected',
                textColor: 'text-emerald-400',
            }
        }
        if (connStatus.signaling === 'failed') {
            return {
                color: 'bg-red-400',
                icon: <WifiOff className="w-4 h-4 text-red-400" />,
                text: 'Offline',
                textColor: 'text-red-400',
            }
        }
        if (connStatus.retrying) {
            return {
                color: 'bg-amber-400',
                icon: <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />,
                text: `Retry ${connStatus.retryAttempt}/5`,
                textColor: 'text-amber-400',
            }
        }
        return {
            color: 'bg-amber-400 animate-pulse',
            icon: <Wifi className="w-4 h-4 text-amber-400" />,
            text: 'Connecting...',
            textColor: 'text-amber-400',
        }
    }

    const status = getStatusIndicator()

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="glass border-b border-white/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">RetroBoard</h1>
                            <p className="text-xs text-white/50">Room: {store.roomName}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Signaling status */}
                        <div className={`flex items-center gap-2 text-sm ${status.textColor}`} title={`Signaling: ${connStatus.signaling}`}>
                            {status.icon}
                            <span className="hidden sm:inline">{status.text}</span>
                        </div>

                        {/* Peer count */}
                        <div className="flex items-center gap-2 text-sm text-white/60">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                            <Users className="w-4 h-4" />
                            <span>{peerCount} online</span>
                        </div>

                        {/* Share button */}
                        <button
                            onClick={copyLink}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all hover:scale-105"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Copied!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    <span>Share Link</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Presence bar */}
            <Presence />

            {/* Main content - Three columns */}
            <main className="flex-1 p-4 md:p-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <Column
                        title="What went well 🎉"
                        columnKey="good"
                        cards={store.goodCards}
                        colors={columnColors.good}
                    />
                    <Column
                        title="What needs work 🔧"
                        columnKey="improve"
                        cards={store.improveCards}
                        colors={columnColors.improve}
                    />
                    <Column
                        title="Action items 🚀"
                        columnKey="action"
                        cards={store.actionCards}
                        colors={columnColors.action}
                    />
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center py-4 text-white/30 text-sm">
                <p>Your data syncs peer-to-peer. No servers, no tracking. ✨</p>
            </footer>
        </div>
    )
}

export default App
