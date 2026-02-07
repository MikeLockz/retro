import { useState, useEffect, useCallback, useRef } from 'react'
import { Copy, Check, Users, Sparkles, Wifi, WifiOff, RefreshCw, MoreVertical, Trash2, Download, Settings, X } from 'lucide-react'
import store from './Store'
import Column from './components/Column'
import Presence from './components/Presence'
import { columnColors } from './utils/colors'

function App() {
    const [copied, setCopied] = useState(false)
    const [isConnected, setIsConnected] = useState(false)
    const [peerCount, setPeerCount] = useState(0)
    const [connStatus, setConnStatus] = useState({ signaling: 'connecting', synced: false, retrying: false })
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [maxVotes, setMaxVotes] = useState(store.settings.get('maxVotes') || 5)
    const menuRef = useRef(null)

    // Sync settings from Yjs
    useEffect(() => {
        const handleSettingsChange = () => {
            const val = store.settings.get('maxVotes')
            if (val !== undefined) setMaxVotes(val)
        }
        store.settings.observe(handleSettingsChange)
        handleSettingsChange() // Initial check
        
        return () => store.settings.unobserve(handleSettingsChange)
    }, [store.settings])

    // Handle click outside menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Track connection status
    useEffect(() => {
        return store.connectionStatus.subscribe(setConnStatus)
    }, [store.connectionStatus])

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
    }, [store.awareness])

    const copyLink = useCallback(() => {
        navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }, [])

    const handleExport = () => {
        const columns = [
            { title: 'Kudos 💖', data: store.kudosCards.toArray() },
            { title: 'What went well 🎉', data: store.goodCards.toArray() },
            { title: 'What needs work 🔧', data: store.improveCards.toArray() },
            { title: 'Action items 🚀', data: store.actionCards.toArray() },
        ]

        let markdown = `# RetroBoard: ${store.roomName}\n`
        markdown += `Date: ${new Date().toLocaleDateString()}\n\n`

        columns.forEach(col => {
            markdown += `## ${col.title}\n`
            if (col.data.length === 0) {
                markdown += `*No items*\n`
            } else {
                col.data.forEach(card => {
                    markdown += `- ${card.text} (${card.votes} votes)\n`
                })
            }
            markdown += `\n`
        })

        const blob = new Blob([markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `retro-${store.roomName}-${new Date().toISOString().split('T')[0]}.md`
        a.click()
        URL.revokeObjectURL(url)
        setIsMenuOpen(false)
    }

    const shareUrl = window.location.href

    const handleSaveSettings = (e) => {
        e.preventDefault()
        const votes = parseInt(maxVotes)
        if (!isNaN(votes) && votes > 0) {
            store.settings.set('maxVotes', votes)
            setIsSettingsOpen(false)
        }
    }

    // Determine status indicator color and icon
    const getStatusIndicator = () => {
        if (connStatus.signaling === 'connected') {
            const serverName = connStatus.signalingServer
                ? new URL(connStatus.signalingServer).hostname.split('.')[0]
                : 'server'
            return {
                color: 'bg-emerald-400',
                icon: <Wifi className="w-4 h-4 text-emerald-400" />,
                text: serverName,
                tooltip: connStatus.signalingServer || 'Connected',
                textColor: 'text-emerald-400',
            }
        }
        if (connStatus.signaling === 'failed') {
            return {
                color: 'bg-red-400',
                icon: <WifiOff className="w-4 h-4 text-red-400" />,
                text: 'No servers',
                tooltip: 'All signaling servers are unreachable',
                textColor: 'text-red-400',
            }
        }
        if (connStatus.retrying) {
            return {
                color: 'bg-amber-400',
                icon: <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />,
                text: `Retry ${connStatus.retryAttempt}/5`,
                tooltip: 'Reconnecting to signaling server...',
                textColor: 'text-amber-400',
            }
        }
        if (connStatus.signaling === 'disconnected') {
            return {
                color: 'bg-slate-400',
                icon: <WifiOff className="w-4 h-4 text-slate-400" />,
                text: 'Disconnected',
                tooltip: 'Click to reconnect',
                textColor: 'text-slate-400',
                action: () => store.reconnect(),
            }
        }
        return {
            color: 'bg-amber-400 animate-pulse',
            icon: <Wifi className="w-4 h-4 text-amber-400" />,
            text: 'Checking servers...',
            tooltip: 'Testing signaling server connectivity',
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

                        {/* Menu Dropdown */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className={`p-2 rounded-lg transition-all ${
                                    isMenuOpen 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                                }`}
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            
                            {isMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl z-[60] py-1 overflow-hidden animate-in fade-in zoom-in duration-100">
                                    <button
                                        onClick={handleExport}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export Markdown
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsSettingsOpen(true)
                                            setIsMenuOpen(false)
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Settings
                                    </button>
                                    <div className="h-px bg-white/5 my-1" />
                                    <button
                                        onClick={() => {
                                            store.clearBoard()
                                            setIsMenuOpen(false)
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Clear Board
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-white">Board Settings</h2>
                            <button 
                                onClick={() => setIsSettingsOpen(false)}
                                className="text-white/50 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSettings}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">
                                        Max thumbs up per person
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={maxVotes}
                                        onChange={(e) => setMaxVotes(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                        placeholder="Enter number..."
                                    />
                                    <p className="mt-2 text-xs text-white/40">
                                        Limits how many times each participant can vote across the entire board.
                                    </p>
                                </div>
                            </div>
                            <div className="px-6 py-4 bg-white/5 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-lg shadow-indigo-500/20"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Presence bar */}
            <Presence connStatus={connStatus} />

            {/* Main content - Four columns */}
            <main className="flex-1 p-4 md:p-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                    <Column
                        title="Kudos 💖"
                        columnKey="kudos"
                        cards={store.kudosCards}
                        colors={columnColors.kudos}
                    />
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

        </div>
    )
}

export default App
