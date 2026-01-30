import { useState, useEffect } from 'react'
import store from '../Store'

function Presence() {
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
    }, [])

    if (users.length === 0) return null

    return (
        <div className="glass border-b border-white/10 px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto">
                <span className="text-xs text-white/40 shrink-0">Collaborators:</span>
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
        </div>
    )
}

export default Presence
