import { useState, useEffect, useRef, useCallback } from 'react'
import { Trash2, Image as ImageIcon } from 'lucide-react'
import store, { VOTE_TYPES } from '../Store'
import { useYText } from '../hooks/useYText'

function Card({ card, columnArray, columnKey }) {
    // Use Y.Text hook for collaborative editing
    const { yText, text, updateText, isReady } = useYText(card.textId)

    const [isEditing, setIsEditing] = useState(!card.isCommitted)
    const [typingUser, setTypingUser] = useState(null)
    const [isProcessingImage, setIsProcessingImage] = useState(false)
    const textareaRef = useRef(null)
    const cursorPositionRef = useRef(0)

    // Fallback to card.text if Y.Text not ready (backward compatibility)
    const displayText = isReady ? text : (card.text || '')

    // Check if current user has voted (legacy) - used for logic below
    // const hasVoted = card.votedBy?.includes(store.userId)

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

    // Track cursor position to restore after Y.Text updates
    const updateCursor = useCallback(() => {
        if (textareaRef.current) {
            cursorPositionRef.current = textareaRef.current.selectionStart
        }
    }, [])

    // Restore cursor position after Y.Text updates
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            const pos = cursorPositionRef.current
            if (pos !== null && pos !== undefined) {
                textareaRef.current.setSelectionRange(pos, pos)
            }
        }
    }, [text, isEditing])

    // Focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus()
            if (!card.isCommitted) {
                // New uncommitted card - select all
                textareaRef.current.select()
            }
        }
    }, [isEditing, card.isCommitted])

    const handleTextChange = (e) => {
        const newText = e.target.value
        updateCursor()

        // Update Y.Text (triggers real-time sync to all peers)
        updateText(newText)

        // Update typing awareness
        store.setTypingState(true, card.id)
    }

    const handleBlur = () => {
        store.setTypingState(false)

        // Commit card if it has content (text or image)
        if (displayText.trim() || card.image) {
            if (!card.isCommitted) {
                store.commitCard(columnArray, card.id)
            }
            setIsEditing(false)
        } else {
            // Delete empty card
            store.deleteCard(columnArray, card.id)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleBlur()
        }
        if (e.key === 'Escape') {
            store.setTypingState(false)
            if (!displayText.trim() && !card.image) {
                // Empty card - delete it
                store.deleteCard(columnArray, card.id)
            } else {
                // Has content - just exit edit mode
                setIsEditing(false)
            }
        }
    }

    const handlePaste = async (e) => {
        // CRITICAL: Extract clipboard data SYNCHRONOUSLY before any async operations
        // Clipboard data is only accessible during the synchronous event handler execution
        const items = e.clipboardData?.items
        if (!items) {
            return
        }

        // Check for image synchronously
        let imageFile = null
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith('image/')) {
                imageFile = item.getAsFile()
                break
            }
        }

        if (!imageFile) {
            return // No image in paste, continue normal paste
        }

        e.preventDefault() // Prevent default paste behavior for images

        try {
            setIsProcessingImage(true)

            // NOW we can do async operations with the file we already extracted
            const { compressImage } = await import('../utils/imageCompression')
            const base64Image = await compressImage(imageFile)

            // Update card with image
            store.updateCard(columnArray, card.id, {
                image: base64Image,
                imageType: imageFile.type
            })

            // Auto-commit card when image is added
            if (!card.isCommitted) {
                store.commitCard(columnArray, card.id)
            }

            setIsProcessingImage(false)
        } catch (error) {
            setIsProcessingImage(false)
            console.error('[Card] Error processing image:', error)
            alert(error.message || 'Failed to process image')
        }
    }

    const handleRemoveImage = () => {
        if (confirm('Remove this image?')) {
            store.updateCard(columnArray, card.id, {
                image: null,
                imageType: null
            })
        }
    }

    const handleVote = (emoji) => {
        store.toggleVote(columnArray, card.id, emoji)
    }

    return (
        <div className="group relative bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all" data-card-id={card.id}>
            {/* Draft indicator for uncommitted cards */}
            {!card.isCommitted && (
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-500 rounded-full text-xs text-white shadow-lg">
                    Draft
                </div>
            )}

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
                    value={displayText}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onKeyUp={updateCursor}
                    onClick={updateCursor}
                    onPaste={handlePaste}
                    placeholder="Type your thoughts... (paste images directly)"
                    className="w-full bg-transparent text-white placeholder-white/30 resize-none focus:outline-none min-h-[60px]"
                    rows={3}
                />
            ) : (
                <p
                    onClick={() => setIsEditing(true)}
                    className="text-white/90 cursor-text min-h-[60px] whitespace-pre-wrap"
                >
                    {displayText || <span className="text-white/30 italic">Click to edit...</span>}
                </p>
            )}

            {/* Image display */}
            {card.image && (
                <div className="mt-3 relative group/image">
                    <img
                        src={card.image}
                        alt="Card attachment"
                        className="w-full rounded-lg border border-white/10"
                        loading="lazy"
                    />
                    {isEditing && (
                        <button
                            onClick={handleRemoveImage}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-white opacity-0 group-hover/image:opacity-100 transition-opacity"
                            title="Remove image"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            {/* Image processing indicator */}
            {isProcessingImage && (
                <div className="mt-3 flex items-center gap-2 text-indigo-400 text-sm">
                    <ImageIcon className="w-4 h-4 animate-pulse" />
                    <span>Processing image...</span>
                </div>
            )}

            {/* Card actions */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                {/* Vote buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {VOTE_TYPES.map(emoji => {
                        const reactionCount = (card.reactions?.[emoji]?.length || 0) + 
                            (emoji === '👍' && card.votedBy?.length ? card.votedBy.length : 0)
                        
                        const hasReacted = card.reactions?.[emoji]?.includes(store.userId) || 
                            (emoji === '👍' && card.votedBy?.includes(store.userId))

                        return (
                            <button
                                key={emoji}
                                onClick={() => handleVote(emoji)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-xs ${
                                    hasReacted
                                        ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50'
                                        : 'bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 border border-transparent'
                                }`}
                                title={`Vote ${emoji}`}
                            >
                                <span>{emoji}</span>
                                <span className={`font-medium ${reactionCount === 0 ? 'opacity-0 w-0' : 'opacity-100'}`}>
                                    {reactionCount > 0 ? reactionCount : ''}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default Card
