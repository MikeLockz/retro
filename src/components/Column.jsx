import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import store from '../Store'
import Card from './Card'

function Column({ title, columnKey, cards, colors, theme }) {
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

    const isRetro = theme === 'retro'
    const isSynth = theme === 'synthwave'

    if (isSynth) {
        const getColumnColorClasses = () => {
            switch (columnKey) {
                case 'kudos': return { border: 'border-synth-cyan', text: 'text-synth-cyan', shadow: 'shadow-synth-cyan/20' }
                case 'good': return { border: 'border-synth-cyan', text: 'text-synth-cyan', shadow: 'shadow-synth-cyan/20' }
                case 'improve': return { border: 'border-synth-magenta', text: 'text-synth-magenta', shadow: 'shadow-synth-magenta/20' }
                case 'action': return { border: 'border-synth-green', text: 'text-synth-green', shadow: 'shadow-synth-green/20' }
                default: return { border: 'border-synth-purple', text: 'text-synth-purple', shadow: 'shadow-synth-purple/20' }
            }
        }

        const themeClasses = getColumnColorClasses()

        return (
            <div className={`p-4 bg-black/80 backdrop-blur-2xl border border-white/10 border-b-[3px] ${themeClasses.border} flex flex-col h-full relative shadow-2xl`}>
                {/* Column header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/20">
                    <h2 className={`text-lg font-orbitron font-black uppercase tracking-wider text-white filter drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]`}>
                        {title}
                    </h2>
                    <span className={`text-[10px] font-mono px-2 py-0.5 bg-black border ${themeClasses.border} text-white font-bold`}>
                        {cardList.length} NODES
                    </span>
                </div>

                {/* Cards list */}
                <div className="space-y-4 flex-1">
                    {cardList
                        .filter((card, index, self) => 
                            index === self.findIndex((t) => t.id === card.id)
                        )
                        .map((card) => (
                            <Card
                                key={card.id}
                                card={card}
                                columnArray={cards}
                                columnKey={columnKey}
                                theme={theme}
                            />
                        ))}

                    {cardList.length === 0 && (
                        <div className="text-center py-12 border border-dashed border-white/10 bg-white/5">
                            <p className="text-[10px] font-mono text-white/50 uppercase tracking-[0.2em] font-bold">System idle... No data</p>
                        </div>
                    )}
                </div>

                {/* Add card button */}
                <button
                    onClick={handleAddCard}
                    className={`group mt-6 flex items-center justify-center gap-2 py-3 border border-white/20 bg-[#1a1a2e] hover:bg-[#2a2a4e] hover:border-white transition-all duration-300 shadow-lg`}
                    aria-label={`Add new card to ${title}`}
                >
                    <Plus className={`w-5 h-5 text-white group-hover:scale-110 transition-transform`} />
                    <span className={`text-xs font-orbitron font-bold text-white tracking-widest`}>INSERT DATA PACKET</span>
                </button>
            </div>
        )
    }

    if (isRetro) {
        return (
            <div className={`p-4 border-r-2 last:border-r-0 border-[#ddd]`}>
                {/* Column header */}
                <div className="flex flex-col items-center mb-6 pb-4 border-b-2 border-[#2D1B0E]/10">
                    <h2 className="text-xl font-black text-[#2D1B0E] uppercase text-center flex flex-col">
                        {title.split(' ')[0]} 
                        <span className="text-sm font-normal normal-case opacity-70">
                            {title.split(' ').slice(1).join(' ')}
                        </span>
                    </h2>
                </div>

                {/* Cards list */}
                <div className="space-y-6 min-h-[200px]">
                    {cardList
                        .filter((card, index, self) => 
                            index === self.findIndex((t) => t.id === card.id)
                        )
                        .map((card) => (
                            <Card
                                key={card.id}
                                card={card}
                                columnArray={cards}
                                columnKey={columnKey}
                                theme={theme}
                            />
                        ))}

                    {cardList.length === 0 && (
                        <div className="text-center py-8 text-[#2D1B0E]/30">
                            <p className="text-sm italic">Nothing here yet, baby!</p>
                        </div>
                    )}
                </div>

                {/* Add card button */}
                <button
                    onClick={handleAddCard}
                    className="w-full mt-8 flex items-center justify-center gap-2 py-4 rounded-none bg-white border-2 border-[#2D1B0E] shadow-[4px_4px_0px_#2D1B0E] hover:translate-y-[-2px] hover:translate-x-[-2px] hover:shadow-[6px_6px_0px_#2D1B0E] transition-all font-bold text-[#2D1B0E]"
                >
                    <Plus className="w-5 h-5" />
                    <span>ADD NOTE, BABY!</span>
                </button>
            </div>
        )
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
                {cardList
                    .filter((card, index, self) => 
                        index === self.findIndex((t) => t.id === card.id)
                    )
                    .map((card) => (
                        <Card
                            key={card.id}
                            card={card}
                            columnArray={cards}
                            columnKey={columnKey}
                            theme={theme}
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