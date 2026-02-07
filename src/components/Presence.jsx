import { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import store from '../Store'

function Presence({ connStatus }) {
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

    if (users.length === 0 && !connStatus) return null

    return (
        <div className="glass border-b border-white/10 px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto">
                {/* Left side: Collaborators list */}
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
                            {/* Color dot */}
                            <span
                                className={`w-2 h-2 rounded-full shrink-0 ${user.isTyping ? 'animate-pulse' : ''}`}
                                style={{ backgroundColor: user.color }}
                            />

                            {/* Name */}
                            <span className="truncate max-w-[120px]">
                                {user.isLocal ? `${user.name} (you)` : user.name}
                            </span>

                            {/* Typing indicator */}
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

                {/* Right side: Status indicators */}
                <div className="flex items-center gap-4 shrink-0">
                    {/* Signaling status */}
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
