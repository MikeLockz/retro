import { useState, useEffect, useRef, useCallback } from 'react'
import { Trash2, Image as ImageIcon } from 'lucide-react'
import store, { VOTE_TYPES } from '../Store'
import { useYText } from '../hooks/useYText'

function Card({ card, columnArray, columnKey, theme }) {
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

    const isRetro = theme === 'retro'
    const isSynth = theme === 'synthwave'

    if (isSynth) {
        const getCardColorClasses = () => {
            switch (columnKey) {
                case 'kudos': return { border: 'border-synth-cyan', text: 'text-synth-cyan', glow: 'shadow-synth-cyan/20' }
                case 'good': return { border: 'border-synth-cyan', text: 'text-synth-cyan', glow: 'shadow-synth-cyan/20' }
                case 'improve': return { border: 'border-synth-magenta', text: 'text-synth-magenta', glow: 'shadow-synth-magenta/20' }
                case 'action': return { border: 'border-synth-green', text: 'text-synth-green', glow: 'shadow-synth-green/20' }
                default: return { border: 'border-synth-purple', text: 'text-synth-purple', glow: 'shadow-synth-purple/20' }
            }
        }

        const themeClasses = getCardColorClasses()

        return (
            <div
                className={`group relative p-4 bg-black border ${themeClasses.border} rounded-[2px] transition-all duration-300 ${isEditing
                        ? 'scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.2)] z-50 ring-1 ring-white/50'
                        : `hover:-translate-y-1 ${themeClasses.glow} z-0`
                    }`}
                data-card-id={card.id}
            >
                {/* Draft indicator */}
                {!card.isCommitted && (
                    <div className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-black border border-white text-[9px] font-mono text-white font-bold uppercase tracking-tighter z-10">
                        DRAFT
                    </div>
                )}

                {/* Typing indicator */}
                {typingUser && (
                    <div className={`absolute -top-3 left-2 px-2 py-1 bg-black text-white text-[10px] font-mono flex items-center gap-2 z-10 border ${themeClasses.border} shadow-[0_0_10px_black]`}>
                        <span className="font-black text-white uppercase tracking-wider">{typingUser.name}</span>
                        <span className="flex gap-0.5">
                            <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                            <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                        </span>
                    </div>
                )}

                {/* Card content */}
                <div className="flex-1">
                    {isEditing ? (
                        <div className="relative">
                            <span className="absolute left-0 top-0 text-white/50 font-mono text-xs font-bold">{'>'}</span>
                            <textarea
                                ref={textareaRef}
                                value={displayText}
                                onChange={handleTextChange}
                                onBlur={handleBlur}
                                onKeyDown={handleKeyDown}
                                onKeyUp={updateCursor}
                                onClick={updateCursor}
                                onPaste={handlePaste}
                                placeholder="> INGESTING_DATA..."
                                className="w-full bg-transparent text-white placeholder-white/50 resize-none focus:outline-none min-h-[60px] font-mono text-sm font-medium pl-4 leading-relaxed caret-white"
                                rows={3}
                            />
                        </div>
                    ) : (
                        <p
                            onClick={() => { if (!typingUser) setIsEditing(true) }}
                            className={`text-white min-h-[60px] whitespace-pre-wrap font-mono text-sm font-medium leading-relaxed ${typingUser ? 'cursor-not-allowed opacity-60' : 'cursor-text'}`}
                        >
                            {displayText || <span className="text-white/40 italic font-sans font-bold">{'>'} [NODE_EMPTY]</span>}
                        </p>
                    )}
                </div>

                {/* Image display */}
                {card.image && (
                    <div className={`mt-3 relative group/image border border-white/20 overflow-hidden bg-black/50`}>
                        <img
                            src={card.image}
                            alt="Data attachment"
                            className="w-full opacity-90 group-hover:opacity-100 transition-opacity"
                            loading="lazy"
                        />
                        {isEditing && (
                            <button
                                onClick={handleRemoveImage}
                                className="absolute top-1 right-1 p-1 bg-black text-white border border-white hover:bg-red-600 transition-colors"
                                title="Purge image"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/20">
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
                                    className={`flex items-center gap-1 px-1.5 py-0.5 transition-all text-[11px] font-mono border active:scale-150 duration-200 font-bold ${hasReacted
                                            ? `${themeClasses.border} bg-black text-white shadow-[0_0_5px_currentColor]`
                                            : 'border-white/20 bg-transparent text-white/60 hover:text-white hover:border-white/50'
                                        }`}
                                    aria-label={`Vote ${emoji}`}
                                >
                                    <span>{emoji}</span>
                                    {reactionCount > 0 && <span>{reactionCount}</span>}
                                </button>
                            )
                        })}
                    </div>
                    <div className={`text-[9px] font-mono text-white/40 uppercase tracking-[0.2em] font-bold`}>
                        Active
                    </div>
                </div>
            </div>
        )
    }

    if (isRetro) {
        const getRotation = () => {
            const seed = card.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            return (seed % 5) - 2
        }

        const getNoteColor = () => {
            switch (columnKey) {
                case 'kudos': return 'bg-[#EC4899] text-white'
                case 'good': return 'bg-[#4056F4] text-white'
                case 'improve': return 'bg-[#FF8C00] text-[#2D1B0E]'
                case 'action': return 'bg-[#4056F4] text-white'
                default: return 'bg-white text-[#2D1B0E]'
            }
        }

        const rotation = getRotation()
        const noteColor = getNoteColor()

        return (
            <div
                className={`group relative p-6 retro-sticky ${noteColor} transition-all duration-200 flex flex-col justify-between ${isEditing
                        ? 'scale-105 shadow-2xl z-50 ring-4 ring-[#2D1B0E]/40 brightness-110'
                        : 'z-0'
                    }`}
                style={{ transform: isEditing ? 'none' : `rotate(${rotation}deg)` }}
                data-card-id={card.id}
            >
                {/* Draft indicator for uncommitted cards */}
                {!card.isCommitted && (
                    <div className="absolute -top-3 -right-3 px-2 py-1 bg-[#2D1B0E] text-white text-[10px] font-black uppercase tracking-tighter border-2 border-white shadow-md z-10">
                        Draft
                    </div>
                )}

                {/* Typing indicator */}
                {typingUser && (
                    <div className="absolute -top-4 left-2 px-2 py-0.5 bg-[#2D1B0E] text-white text-[10px] font-bold flex items-center gap-1 shadow-lg z-10 border border-white">
                        <span>{typingUser.name}</span>
                        <span className="flex gap-0.5">
                            <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                            <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                            <span className="typing-dot w-1 h-1 bg-white rounded-full" />
                        </span>
                    </div>
                )}

                {/* Card content */}
                <div className="flex-1">
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
                            placeholder="Type your thoughts, baby!"
                            className="w-full bg-transparent text-inherit placeholder-current placeholder-opacity-50 resize-none focus:outline-none min-h-[100px] font-bold text-lg leading-tight"
                            rows={4}
                        />
                    ) : (
                        <p
                            onClick={() => { if (!typingUser) setIsEditing(true) }}
                            className={`text-inherit min-h-[100px] whitespace-pre-wrap font-bold text-lg leading-tight break-words ${typingUser ? 'cursor-not-allowed opacity-60' : 'cursor-text'}`}
                        >
                            {displayText || <span className="opacity-30 italic">Click to edit...</span>}
                        </p>
                    )}
                </div>

                {/* Image display */}
                {card.image && (
                    <div className="mt-4 relative group/image">
                        <img
                            src={card.image}
                            alt="Card attachment"
                            className="w-full border-2 border-[#2D1B0E] shadow-[4px_4px_0px_rgba(0,0,0,0.1)]"
                            loading="lazy"
                        />
                        {isEditing && (
                            <button
                                onClick={handleRemoveImage}
                                className="absolute top-2 right-2 p-1.5 bg-red-600 text-white border border-white shadow-md opacity-0 group-hover/image:opacity-100 transition-opacity"
                                title="Remove image"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                {/* Image processing indicator */}
                {isProcessingImage && (
                    <div className="mt-2 flex items-center gap-2 text-inherit text-xs font-bold animate-pulse">
                        <ImageIcon className="w-4 h-4" />
                        <span>GETTING GROOVY...</span>
                    </div>
                )}

                {/* Card actions */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-[#2D1B0E]/10">
                    {/* Vote buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {VOTE_TYPES.map(emoji => {
                            const reactionCount = (card.reactions?.[emoji]?.length || 0) +
                                (emoji === '👍' && card.votedBy?.length ? card.votedBy.length : 0)

                            const hasReacted = card.reactions?.[emoji]?.includes(store.userId) ||
                                (emoji === '👍' && card.votedBy?.includes(store.userId))

                            return (
                                <button
                                    key={emoji}
                                    onClick={() => handleVote(emoji)}
                                    className={`flex items-center gap-1.5 px-2 py-1 transition-all text-xs font-black border-2 ${hasReacted
                                            ? 'bg-[#2D1B0E] text-white border-white'
                                            : 'bg-white/20 text-current hover:bg-white/40 border-transparent'
                                        }`}
                                    title={`Vote ${emoji}`}
                                >
                                    <span>{emoji}</span>
                                    {reactionCount > 0 && <span>{reactionCount}</span>}
                                </button>
                            )
                        })}
                    </div>

                    <div className="text-[10px] font-black opacity-50 uppercase tracking-widest">
                        Groovy
                    </div>
                </div>
            </div>
        )
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
                    onClick={() => { if (!typingUser) setIsEditing(true) }}
                    className={`text-white/90 min-h-[60px] whitespace-pre-wrap ${typingUser ? 'cursor-not-allowed opacity-60' : 'cursor-text'}`}
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
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-xs ${hasReacted
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