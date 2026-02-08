import { useState, useEffect, useCallback, useRef } from 'react'
import { Copy, Check, Users, Sparkles, Wifi, WifiOff, RefreshCw, MoreVertical, Trash2, Download, Settings, X, Play, Square } from 'lucide-react'
import store from './Store'
import TimerToast from './components/TimerToast'
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
    const [timerEnabled, setTimerEnabled] = useState(store.settings.get('timerEnabled') ?? true)
    const [timerDuration, setTimerDuration] = useState(store.settings.get('timerDuration') || 5)
    const [isTimerRunning, setIsTimerRunning] = useState(!!store.timer.get('startedAt'))
    const [theme, setTheme] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('retro-settings-defaults'))?.theme || 'modern'
        } catch {
            return 'modern'
        }
    })
    
    const menuRef = useRef(null)

    // Sync settings from Yjs
    useEffect(() => {
        const handleSettingsChange = () => {
            const val = store.settings.get('maxVotes')
            if (val !== undefined) setMaxVotes(val)

            const tEnabled = store.settings.get('timerEnabled')
            if (tEnabled !== undefined) setTimerEnabled(tEnabled)
            
            const tDuration = store.settings.get('timerDuration')
            if (tDuration !== undefined) setTimerDuration(tDuration)
        }
        store.settings.observe(handleSettingsChange)
        handleSettingsChange() // Initial check
        
        return () => store.settings.unobserve(handleSettingsChange)
    }, [store.settings])

    // Track timer state
    useEffect(() => {
        const updateTimerState = () => {
            setIsTimerRunning(!!store.timer.get('startedAt'))
        }
        store.timer.observe(updateTimerState)
        return () => store.timer.unobserve(updateTimerState)
    }, [store.timer])

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
                    // Include image if present
                    if (card.image) {
                        markdown += `  ![image](${card.image})\n`
                    }
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
        const duration = parseInt(timerDuration)

        store.saveLocalSettings({ theme })

        if (!isNaN(votes) && votes > 0) {
            store.settings.set('maxVotes', votes)
            store.saveLocalSettings({ maxVotes: votes })
        }

        if (!isNaN(duration) && duration > 0) {
            store.settings.set('timerDuration', duration)
        }

        store.settings.set('timerEnabled', timerEnabled)
        setIsSettingsOpen(false)
    }

    const toggleTimer = () => {
        if (isTimerRunning) {
            store.stopTimer()
        } else {
            store.startTimer()
        }
        setIsMenuOpen(false)
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
    const isRetro = theme === 'retro'
    const isSynth = theme === 'synthwave'

    const getAppClass = () => {
        if (isRetro) return "min-h-screen flex flex-col retro-bg p-4 md:p-8"
        if (isSynth) return "min-h-screen flex flex-col relative overflow-hidden font-mono"
        return "min-h-screen flex flex-col modern-bg"
    }

    return (
        <div className={getAppClass()}>
            {isSynth && (
                <>
                    <div className="crt-overlay" />
                    <div className="synthwave-scene">
                        <div className="synth-stars" />
                        <div className="synth-sun" />
                        <div className="synth-mountains" />
                        <div className="synth-palms">
                            <div className="palm" />
                            <div className="palm opacity-40 scale-75 translate-y-4" />
                            <div className="palm opacity-20 scale-50 translate-y-8" />
                            <div className="palm opacity-20 scale-50 translate-y-8" />
                            <div className="palm opacity-40 scale-75 translate-y-4" />
                            <div className="palm" />
                        </div>
                        <div className="synth-grid-container">
                            <div className="synth-grid" />
                        </div>
                        {/* Vignette */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] opacity-60 pointer-events-none z-10" />
                    </div>
                </>
            )}
            
            <div className={isRetro ? "max-w-7xl mx-auto w-full retro-board flex flex-col flex-1 overflow-hidden" : "flex flex-col flex-1 relative z-20"}>
                {/* Header */}
                {isRetro ? (
                    <header className="border-b-4 border-[#2D1B0E] p-4 flex items-center justify-between bg-[#FDF5E6]">
                        <div className="flex items-center">
                            <div className="px-3 py-1 bg-[#2D1B0E] text-[#FF8C00] font-black text-2xl uppercase tracking-tighter border-2 border-[#2D1B0E] shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
                                retro
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={copyLink}
                                className="flex items-center gap-2 px-4 py-2 rounded-none bg-[#4056F4] text-white border-2 border-[#2D1B0E] shadow-[4px_4px_0px_#2D1B0E] hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[6px_6px_0px_#2D1B0E] transition-all font-bold text-sm"
                            >
                                {copied ? <><Check className="w-4 h-4" /><span>COPIED!</span></> : <><Copy className="w-4 h-4" /><span>SHARE</span></>}
                            </button>
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="p-2 bg-white border-2 border-[#2D1B0E] shadow-[4px_4px_0px_#2D1B0E] text-[#2D1B0E] hover:bg-slate-100 transition-all"
                                >
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-56 rounded-none bg-white border-4 border-[#2D1B0E] shadow-[8px_8px_0px_rgba(0,0,0,0.2)] z-[60] py-1 overflow-hidden font-bold">
                                        <button onClick={handleExport} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#2D1B0E] hover:bg-[#FDF5E6] transition-colors">
                                            <Download className="w-5 h-5" /> EXPORT MARKDOWN
                                        </button>
                                        {timerEnabled && (
                                            <button onClick={toggleTimer} className={`w-full flex items-center gap-2 px-4 py-3 text-sm transition-colors ${isTimerRunning ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                                                {isTimerRunning ? <><Square className="w-5 h-5 fill-current" /> STOP TIMER</> : <><Play className="w-5 h-5 fill-current" /> START TIMER</>}
                                            </button>
                                        )}
                                        <button onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false) }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#2D1B0E] hover:bg-[#FDF5E6] transition-colors">
                                            <Settings className="w-5 h-5" /> SETTINGS
                                        </button>
                                        <div className="h-1 bg-[#2D1B0E] my-1" />
                                        <button onClick={() => { store.clearBoard(); setIsMenuOpen(false) }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 className="w-5 h-5" /> CLEAR BOARD
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>
                ) : isSynth ? (
                    <header className="p-4 flex items-center justify-between border-b border-white/20 bg-black/40 backdrop-blur-sm z-50">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-tr from-cyan-400 to-purple-600 clip-path-polygon-[20%_0,100%_0,80%_100%,0_100%] flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)] transform -skew-x-12">
                                <Sparkles className="w-6 h-6 text-white transform skew-x-12" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-3xl font-orbitron font-black uppercase italic tracking-widest text-chrome filter drop-shadow-[0_1px_2px_rgba(255,255,255,0.2)]" data-text="RETROBOARD">
                                    RETROBOARD
                                </h1>
                                <div className="flex items-center gap-2">
                                    <div className="h-[2px] w-8 bg-cyan-400 shadow-[0_0_5px_cyan]" />
                                    <p className="text-[10px] text-cyan-300 font-mono tracking-[0.2em] shadow-cyan-500/50 bg-black/50 px-1 font-bold">SYSTEM: {store.roomName.toUpperCase()}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <button
                                onClick={copyLink}
                                className="group relative px-6 py-2 bg-[#050510] border border-cyan-500 overflow-hidden shadow-[0_0_10px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] transition-all"
                                aria-label="Copy share link"
                            >
                                <div className="absolute inset-0 w-full h-full bg-cyan-900/20 transform skew-x-[-20deg] group-hover:bg-cyan-500/30 transition-all" />
                                <div className="relative flex items-center gap-2 text-cyan-400 font-orbitron text-xs font-bold tracking-widest group-hover:text-white transition-colors">
                                    {copied ? <><Check className="w-4 h-4" /><span>LINK_COPIED</span></> : <><Copy className="w-4 h-4" /><span>SHARE_UPLINK</span></>}
                                </div>
                            </button>
                            
                            <div className="relative" ref={menuRef}>
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className="p-3 border border-pink-500 bg-black hover:bg-pink-900/40 text-pink-500 hover:text-white transition-all shadow-[0_0_10px_rgba(236,72,153,0.3)] clip-path-polygon-[10%_0,100%_0,90%_100%,0_100%]"
                                    aria-label="Open settings menu"
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                                {isMenuOpen && (
                                    <div className="absolute right-0 mt-4 w-64 bg-black/90 border-2 border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.3)] z-[100] p-1 font-orbitron">
                                        <div className="absolute -top-2 right-4 w-4 h-4 bg-pink-500 rotate-45 border-l border-t border-white" />
                                        <button onClick={handleExport} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-cyan-400 hover:bg-cyan-900/30 hover:text-white transition-colors uppercase tracking-wider border-b border-white/10">
                                            <Download className="w-4 h-4" /> EXPORT_DATA
                                        </button>
                                        {timerEnabled && (
                                            <button onClick={toggleTimer} className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold transition-colors uppercase tracking-wider border-b border-white/10 ${isTimerRunning ? 'text-red-500 hover:bg-red-900/30 hover:text-white' : 'text-green-400 hover:bg-green-900/30 hover:text-white'}`}>
                                                {isTimerRunning ? <><Square className="w-4 h-4 fill-current" /> ABORT_TIMER</> : <><Play className="w-4 h-4 fill-current" /> INIT_TIMER</>}
                                            </button>
                                        )}
                                        <button onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false) }} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-purple-400 hover:bg-purple-900/30 hover:text-white transition-colors uppercase tracking-wider border-b border-white/10">
                                            <Settings className="w-4 h-4" /> CONFIG
                                        </button>
                                        <button onClick={() => { store.clearBoard(); setIsMenuOpen(false) }} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-900/30 hover:text-white transition-colors uppercase tracking-wider">
                                            <Trash2 className="w-4 h-4" /> PURGE_SYSTEM
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>
                ) : (
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
                            <div className="flex items-center gap-3">
                                <button onClick={copyLink} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all hover:scale-105">
                                    {copied ? <><Check className="w-4 h-4" /><span>Copied!</span></> : <><Copy className="w-4 h-4" /><span>Share Link</span></>}
                                </button>
                                <div className="relative" ref={menuRef}>
                                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-2 rounded-lg transition-all ${isMenuOpen ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'}`}>
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                    {isMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl z-[60] py-1 overflow-hidden animate-in fade-in zoom-in duration-100">
                                            <button onClick={handleExport} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                                                <Download className="w-4 h-4" /> Export Markdown
                                            </button>
                                            {timerEnabled && (
                                                <button onClick={toggleTimer} className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${isTimerRunning ? 'text-red-400 hover:bg-red-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}>
                                                    {isTimerRunning ? <><Square className="w-4 h-4 fill-current" /> Stop Timer</> : <><Play className="w-4 h-4 fill-current" /> Start Timer</>}
                                                </button>
                                            )}
                                            <button onClick={() => { setIsSettingsOpen(true); setIsMenuOpen(false) }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:bg-white/5 transition-colors">
                                                <Settings className="w-4 h-4" /> Settings
                                            </button>
                                            <div className="h-px bg-white/5 my-1" />
                                            <button onClick={() => { store.clearBoard(); setIsMenuOpen(false) }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                                                <Trash2 className="w-4 h-4" /> Clear Board
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>
                )}

                {/* Presence bar */}
                <Presence connStatus={connStatus} theme={theme} />

                {/* Main content */}
                <main className={isRetro ? "flex-1 p-6 overflow-y-auto" : "flex-1 p-4 md:p-6"}>
                    <div className={isRetro ? "grid grid-cols-1 md:grid-cols-4 gap-6" : "max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6"}>
                        <Column title={isRetro ? "Yeah, Baby! 💖" : "Kudos 💖"} columnKey="kudos" cards={store.kudosCards} colors={columnColors.kudos} theme={theme} />
                        <Column title={isRetro ? "Groovy Things 🎉" : "What went well 🎉"} columnKey="good" cards={store.goodCards} colors={columnColors.good} theme={theme} />
                        <Column title={isRetro ? "Work it Out! 🔧" : "What needs work 🔧"} columnKey="improve" cards={store.improveCards} colors={columnColors.improve} theme={theme} />
                        <Column title={isRetro ? "Solid Tasks 🚀" : "Action items 🚀"} columnKey="action" cards={store.actionCards} colors={columnColors.action} theme={theme} />
                    </div>
                </main>

                {isRetro && (
                    <footer className="border-t-4 border-[#2D1B0E] p-4 text-center font-black text-[#2D1B0E] tracking-widest uppercase bg-[#FDF5E6]">
                        Retro Board — Spread The Love!
                    </footer>
                )}
            </div>

            <TimerToast theme={theme} />

            {/* Settings Modal */}
            {isSettingsOpen && (
                isRetro ? (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2D1B0E]/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-md bg-[#FDF5E6] border-8 border-[#2D1B0E] shadow-[20px_20px_0px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-6 py-6 border-b-4 border-[#2D1B0E] flex items-center justify-between bg-[#4056F4]">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Board Settings</h2>
                                <button onClick={() => setIsSettingsOpen(false)} className="text-white hover:rotate-90 transition-transform"><X className="w-8 h-8" /></button>
                            </div>
                            <form onSubmit={handleSaveSettings}>
                                <div className="p-8 space-y-6">
                                    <div>
                                        <label className="block text-sm font-black text-[#2D1B0E] uppercase tracking-widest mb-2">Theme</label>
                                        <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full bg-white border-4 border-[#2D1B0E] px-4 py-3 text-lg font-bold text-[#2D1B0E] focus:bg-[#FDF5E6] transition-all appearance-none">
                                            <option value="modern">Modern Dark</option>
                                            <option value="retro">Groovy Retro</option>
                                            <option value="synthwave">Synthwave Night</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-[#2D1B0E] uppercase tracking-widest mb-2">Max votes per person</label>
                                        <input type="number" min="1" max="99" value={maxVotes} onChange={(e) => setMaxVotes(e.target.value)} className="w-full bg-white border-4 border-[#2D1B0E] px-4 py-3 text-lg font-bold text-[#2D1B0E] focus:bg-[#FDF5E6] transition-all" />
                                        <p className="mt-2 text-xs font-bold text-[#2D1B0E]/60 italic">"Let's not get too crazy with the voting, baby!"</p>
                                    </div>
                                    <div className="pt-6 border-t-4 border-[#2D1B0E]/10">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="text-sm font-black text-[#2D1B0E] uppercase tracking-widest">Enable Timer</label>
                                            <button type="button" onClick={() => setTimerEnabled(!timerEnabled)} className={`w-16 h-8 border-4 border-[#2D1B0E] transition-colors relative ${timerEnabled ? 'bg-[#EC4899]' : 'bg-white'}`}>
                                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 border-2 border-[#2D1B0E] bg-white transition-transform ${timerEnabled ? 'translate-x-8' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        {timerEnabled && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                <label className="block text-sm font-black text-[#2D1B0E] uppercase tracking-widest mb-2">Timer Duration (minutes)</label>
                                                <input type="number" min="1" max="60" value={timerDuration} onChange={(e) => setTimerDuration(e.target.value)} className="w-full bg-white border-4 border-[#2D1B0E] px-4 py-3 text-lg font-bold text-[#2D1B0E] focus:bg-[#FDF5E6] transition-all" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-8 py-6 bg-[#2D1B0E]/5 border-t-4 border-[#2D1B0E] flex justify-end gap-4">
                                    <button type="button" onClick={() => setIsSettingsOpen(false)} className="px-6 py-2 text-sm font-black text-[#2D1B0E] uppercase hover:underline decoration-4">Cancel</button>
                                    <button type="submit" className="px-8 py-3 bg-[#FF8C00] border-4 border-[#2D1B0E] shadow-[4px_4px_0px_#2D1B0E] text-[#2D1B0E] font-black uppercase tracking-tighter hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[6px_6px_0px_#2D1B0E] transition-all">Save Changes, Baby!</button>
                                </div>
                            </form>
                        </div>
                    </div>
                ) : isSynth ? (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 font-orbitron">
                        <div className="w-full max-w-md bg-black border-2 border-cyan-500 shadow-[0_0_50px_rgba(6,182,212,0.4)] overflow-hidden animate-in zoom-in-95 duration-200 relative">
                            {/* Decorative Corners */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white pointer-events-none" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white pointer-events-none" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white pointer-events-none" />

                            <div className="px-6 py-4 border-b border-cyan-500/50 flex items-center justify-between bg-cyan-950/30">
                                <h2 className="text-xl font-black text-cyan-400 uppercase tracking-widest text-shadow-cyan">SYSTEM_CONFIG</h2>
                                <button onClick={() => setIsSettingsOpen(false)} className="text-cyan-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                            </div>
                            <form onSubmit={handleSaveSettings}>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-pink-500 uppercase tracking-widest mb-2">INTERFACE_THEME</label>
                                        <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full bg-black border border-pink-500 text-pink-400 font-mono text-sm px-4 py-3 focus:outline-none focus:shadow-[0_0_15px_rgba(236,72,153,0.5)] transition-all uppercase">
                                            <option value="modern">Modern Dark</option>
                                            <option value="retro">Groovy Retro</option>
                                            <option value="synthwave">Synthwave Night</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-cyan-500 uppercase tracking-widest mb-2">VOTE_LIMIT_PROTOCOL</label>
                                        <input type="number" min="1" max="99" value={maxVotes} onChange={(e) => setMaxVotes(e.target.value)} className="w-full bg-black border border-cyan-500 text-cyan-400 font-mono text-sm px-4 py-3 focus:outline-none focus:shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all" placeholder="Enter value..." />
                                        <p className="mt-2 text-[10px] text-cyan-600 font-mono uppercase tracking-widest">>> RESTRICTS_INPUT_PER_USER_NODE</p>
                                    </div>
                                    <div className="pt-6 border-t border-white/10">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="text-xs font-bold text-purple-500 uppercase tracking-widest">TEMPORAL_LIMITER</label>
                                            <button type="button" onClick={() => setTimerEnabled(!timerEnabled)} className={`w-12 h-6 border transition-all relative ${timerEnabled ? 'bg-purple-900/50 border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-black border-white/20'}`}>
                                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white transition-transform ${timerEnabled ? 'translate-x-6 bg-purple-400' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        {timerEnabled && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                <label className="block text-xs font-bold text-purple-500 uppercase tracking-widest mb-2">DURATION_MINUTES</label>
                                                <input type="number" min="1" max="60" value={timerDuration} onChange={(e) => setTimerDuration(e.target.value)} className="w-full bg-black border border-purple-500 text-purple-400 font-mono text-sm px-4 py-3 focus:outline-none focus:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-cyan-950/20 border-t border-cyan-500/50 flex justify-end gap-4">
                                    <button type="button" onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 text-xs font-bold text-cyan-600 hover:text-white transition-colors uppercase tracking-widest">ABORT</button>
                                    <button type="submit" className="px-6 py-2 bg-cyan-600/20 border border-cyan-400 text-cyan-300 font-bold uppercase tracking-widest hover:bg-cyan-400 hover:text-black hover:shadow-[0_0_20px_cyan] transition-all">EXECUTE</button>
                                </div>
                            </form>
                        </div>
                    </div>
                ) : (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-xl font-semibold text-white">Board Settings</h2>
                                <button onClick={() => setIsSettingsOpen(false)} className="text-white/50 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleSaveSettings}>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">Theme</label>
                                        <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all">
                                            <option value="modern">Modern Dark</option>
                                            <option value="retro">Groovy Retro</option>
                                            <option value="synthwave">Synthwave Night</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">Max votes per person</label>
                                        <input type="number" min="1" max="99" value={maxVotes} onChange={(e) => setMaxVotes(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" placeholder="Enter number..." />
                                        <p className="mt-2 text-xs text-white/40">Limits how many times each participant can vote across the entire board.</p>
                                    </div>
                                    <div className="pt-4 border-t border-white/5">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="text-sm font-medium text-white/70">Enable Timer</label>
                                            <button type="button" onClick={() => setTimerEnabled(!timerEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${timerEnabled ? 'bg-indigo-500' : 'bg-white/10'}`}>
                                                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${timerEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        {timerEnabled && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                <label className="block text-sm font-medium text-white/70 mb-2">Timer Duration (minutes)</label>
                                                <input type="number" min="1" max="60" value={timerDuration} onChange={(e) => setTimerDuration(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-white/5 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5 transition-colors">Cancel</button>
                                    <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors shadow-lg shadow-indigo-500/20">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            )}
        </div>
    )
}

export default App