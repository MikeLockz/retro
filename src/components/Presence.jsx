import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import store from '../Store'

function Presence({ connStatus, theme }) {
    const [users, setUsers] = useState([])

    // Subscribe to awareness changes
    useEffect(() => {
        const update = () => {
            const userList = []
            store.awareness.getStates().forEach((state, clientId) => {
                if (state.user) {
                    userList.push({
                        ...state.user,
                        clientId,
                        isLocal: clientId === store.awareness.clientID,
                    })
                }
            })
            setUsers(userList)
        }

        store.awareness.on('change', update)
        update()

        return () => store.awareness.off('change', update)
    }, [store.awareness])

    // Determine status indicator color and icon
    const getStatusIndicator = () => {
        if (connStatus?.signaling === 'connected') {
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
        if (connStatus?.signaling === 'failed') {
            return {
                color: 'bg-red-400',
                icon: <WifiOff className="w-4 h-4 text-red-400" />,
                text: 'No servers',
                tooltip: 'All signaling servers are unreachable',
                textColor: 'text-red-400',
            }
        }
        if (connStatus?.retrying) {
            return {
                color: 'bg-amber-400',
                icon: <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />,
                text: `Retry ${connStatus.retryAttempt}/5`,
                tooltip: 'Reconnecting to signaling server...',
                textColor: 'text-amber-400',
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

    if (users.length === 0 && !connStatus) return null

    if (isSynth) {
        return (
            <div className="bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-2 relative z-20">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto">
                    {users.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto">
                            <span className="text-[9px] font-mono text-white/40 uppercase tracking-[0.2em] shrink-0">
                                NET_NODES:
                            </span>
                            <div className="flex items-center gap-2">
                                {users.map((user) => (
                                    <div
                                        key={user.clientId}
                                        className={`flex items-center gap-2 px-2 py-1 bg-black border text-[10px] font-mono transition-all ${user.isLocal
                                            ? 'border-synth-cyan shadow-[0_0_8px_rgba(0,243,255,0.4)]'
                                            : 'border-white/20'
                                            }`}
                                        title={user.isLocal ? 'Self' : user.name}
                                    >
                                        <span
                                            className={`w-2 h-2 shrink-0 ${user.isTyping ? 'animate-pulse' : ''}`}
                                            style={{ backgroundColor: user.color, boxShadow: `0 0 8px ${user.color}` }}
                                        />
                                        <span className={`truncate max-w-[120px] uppercase font-bold text-white ${user.isLocal ? 'text-synth-cyan' : ''}`}>
                                            {user.isLocal ? `${user.name} [OS]` : user.name}
                                        </span>
                                        {user.isTyping && (
                                            <span className="flex gap-0.5 ml-1">
                                                <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                                                <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-4 shrink-0">
                        {connStatus && (
                            <div className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest ${status.textColor} filter drop-shadow-[0_0_2px_currentColor]`} title={status.tooltip}>
                                <span className="hidden sm:inline">{status.text}</span>
                                <div className={`w-2 h-2 ${status.color.replace('bg-', 'bg-')} shadow-[0_0_5px_currentColor] animate-pulse`} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    if (isRetro) {
        return (
            <div className="bg-[#FDF5E6] border-b-4 border-[#2D1B0E] px-4 py-2">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto">
                    {/* Left side: Collaborators list */}
                    {users.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto">
                            <span className="text-[10px] font-black text-[#2D1B0E] uppercase tracking-widest shrink-0">
                                {users.length} AGENTS:
                            </span>
                            <div className="flex items-center gap-2">
                                {users.map((user) => (
                                    <div
                                        key={user.clientId}
                                        className={`flex items-center gap-2 px-3 py-1 border-2 border-[#2D1B0E] shadow-[2px_2px_0px_#2D1B0E] text-xs font-bold transition-all ${user.isLocal
                                            ? 'bg-[#4056F4] text-white'
                                            : 'bg-white text-[#2D1B0E]'
                                            }`}
                                        title={user.isLocal ? 'You' : user.name}
                                    >
                                        <span
                                            className={`w-2 h-2 border border-[#2D1B0E] shrink-0 ${user.isTyping ? 'animate-pulse' : ''}`}
                                            style={{ backgroundColor: user.color }}
                                        />
                                        <span className="truncate max-w-[120px] uppercase">
                                            {user.isLocal ? `${user.name} (me)` : user.name}
                                        </span>
                                        {user.isTyping && !user.isLocal && (
                                            <span className="flex gap-0.5 ml-1">
                                                <span className="typing-dot w-1 h-1 bg-current rounded-full" />
                                                <span className="typing-dot w-1 h-1 bg-current rounded-full" />
                                                <span className="typing-dot w-1 h-1 bg-current rounded-full" />
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-4 shrink-0">
                        {connStatus && (
                            <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${status.textColor}`} title={status.tooltip}>
                                <span className="hidden sm:inline">{status.text}</span>
                                <div className={`w-3 h-3 border-2 border-[#2D1B0E] ${status.color.replace('bg-', 'bg-')}`} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="glass border-b border-white/10 px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto">
                {users.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto">
                        <span className="text-xs text-white/40 shrink-0">
                            {users.length} {users.length === 1 ? 'collaborator' : 'collaborators'}:
                        </span>
                        <div className="flex items-center gap-2">
                            {users.map((user) => (
                                <div
                                    key={user.clientId}
                                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm transition-all ${user.isLocal
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                        : 'bg-white/5 text-white/70 border border-white/10'
                                        }`}
                                    title={user.isLocal ? 'You' : user.name}
                                >
                                    <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${user.isTyping ? 'animate-pulse' : ''}`}
                                        style={{ backgroundColor: user.color }}
                                    />
                                    <span className="truncate max-w-[120px]">
                                        {user.isLocal ? `${user.name} (you)` : user.name}
                                    </span>
                                    {user.isTyping && !user.isLocal && (
                                        <span className="flex gap-0.5 ml-1">
                                            <span className="typing-dot w-1 h-1 bg-current rounded-full opacity-60" />
                                            <span className="typing-dot w-1 h-1 bg-current rounded-full opacity-60" />
                                            <span className="typing-dot w-1 h-1 bg-current rounded-full opacity-60" />
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-4 shrink-0">
                    {connStatus && (
                        <div className={`flex items-center gap-2 text-sm ${status.textColor}`} title={status.tooltip}>
                            {status.icon}
                            <span className="hidden sm:inline">{status.text}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Presence