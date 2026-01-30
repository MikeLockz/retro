import { useState, useEffect, useRef } from 'react'
import { ThumbsUp, Trash2 } from 'lucide-react'
import store from '../Store'

function Card({ card, columnArray, columnKey }) {
    const [isEditing, setIsEditing] = useState(!card.text)
    const [text, setText] = useState(card.text || '')
    const [typingUser, setTypingUser] = useState(null)
    const textareaRef = useRef(null)

    // Check if current user has voted
    const hasVoted = card.votedBy?.includes(store.userId)

    // Subscribe to awareness changes for typing indicator
    useEffect(() => {
        const updateTyping = () => {
            const states = []
            store.awareness.getStates().forEach((state, clientId) => {
                if (state.user && clientId !== store.awareness.clientID) {
                    states.push(state.user)
                }
            })
            const typing = states.find(
                (user) => user.isTyping && user.typingCardId === card.id
            )
            setTypingUser(typing || null)
        }

        store.awareness.on('change', updateTyping)
        updateTyping()

        return () => store.awareness.off('change', updateTyping)
    }, [card.id])

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus()
            textareaRef.current.select()
        }
    }, [isEditing])

    // Sync local text with card text
    useEffect(() => {
        setText(card.text || '')
    }, [card.text])

    const handleTextChange = (e) => {
        const newText = e.target.value
        setText(newText)
        store.setTypingState(true, card.id)
    }

    const handleBlur = () => {
        store.updateCard(columnArray, card.id, { text })
        store.setTypingState(false)
        if (text.trim()) {
            setIsEditing(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleBlur()
        }
        if (e.key === 'Escape') {
            setText(card.text || '')
            store.setTypingState(false)
            if (card.text) {
                setIsEditing(false)
            }
        }
    }

    const handleVote = () => {
        store.toggleVote(columnArray, card.id)
    }

    const handleDelete = () => {
        store.deleteCard(columnArray, card.id)
    }

    return (
        <div className="group relative bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
            {/* Typing indicator */}
            {typingUser && (
                <div className="absolute -top-3 left-3 px-2 py-0.5 bg-indigo-500 rounded-full text-xs text-white flex items-center gap-1 shadow-lg">
                    <span>{typingUser.name}</span>
                    <span className="flex gap-0.5">
                        <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                        <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                        <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                    </span>
                </div>
            )}

            {/* Card content */}
            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your thoughts..."
                    className="w-full bg-transparent text-white placeholder-white/30 resize-none focus:outline-none min-h-[60px]"
                    rows={3}
                />
            ) : (
                <p
                    onClick={() => setIsEditing(true)}
                    className="text-white/90 cursor-text min-h-[60px] whitespace-pre-wrap"
                >
                    {card.text || <span className="text-white/30 italic">Click to edit...</span>}
                </p>
            )}

            {/* Card actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                {/* Vote button */}
                <button
                    onClick={handleVote}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${hasVoted
                            ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50'
                            : 'bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 border border-transparent'
                        }`}
                >
                    <ThumbsUp className={`w-4 h-4 ${hasVoted ? 'fill-current' : ''}`} />
                    <span className="text-sm font-medium">{card.votes || 0}</span>
                </button>

                {/* Delete button */}
                <button
                    onClick={handleDelete}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    title="Delete card"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

export default Card
