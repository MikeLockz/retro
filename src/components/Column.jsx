import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import store from '../Store'
import Card from './Card'

function Column({ title, columnKey, cards, colors }) {
    const [cardList, setCardList] = useState(() => cards.toArray())

    // Subscribe to Yjs array changes with proper caching
    useEffect(() => {
        const update = () => {
            setCardList(cards.toArray())
        }

        cards.observe(update)
        update() // Ensure we have the latest data after subscribing
        
        return () => cards.unobserve(update)
    }, [cards])

    const handleAddCard = () => {
        store.createCard(cards)
    }

    return (
        <div className={`glass rounded-2xl p-4 border ${colors.border}`}>
            {/* Column header */}
            <div className={`flex items-center justify-between mb-4 pb-3 border-b border-white/10`}>
                <h2 className={`text-lg font-semibold ${colors.header}`}>
                    {title}
                </h2>
                <span className="text-sm text-white/40 bg-white/5 px-2 py-1 rounded-lg">
                    {cardList.length}
                </span>
            </div>

            {/* Cards list */}
            <div className="space-y-3 min-h-[200px]">
                {cardList.map((card) => (
                    <Card
                        key={card.id}
                        card={card}
                        columnArray={cards}
                        columnKey={columnKey}
                    />
                ))}

                {cardList.length === 0 && (
                    <div className="text-center py-8 text-white/30">
                        <p className="text-sm">No cards yet</p>
                        <p className="text-xs mt-1">Click the button below to add one</p>
                    </div>
                )}
            </div>

            {/* Add card button */}
            <button
                onClick={handleAddCard}
                className={`w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl ${colors.button} border border-white/10 hover:border-white/20 transition-all hover:scale-[1.02] active:scale-[0.98]`}
            >
                <Plus className="w-4 h-4" />
                <span className="font-medium">Add Card</span>
            </button>
        </div>
    )
}

export default Column
