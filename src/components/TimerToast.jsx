import { useEffect, useState } from 'react'
import { Clock, X } from 'lucide-react'
import store from '../Store'

export default function TimerToast() {
    const [timerState, setTimerState] = useState({ startedAt: null, duration: null })
    const [timeLeft, setTimeLeft] = useState(null)

    useEffect(() => {
        const updateState = () => {
            setTimerState({
                startedAt: store.timer.get('startedAt'),
                duration: store.timer.get('duration')
            })
        }
        
        store.timer.observe(updateState)
        updateState()
        
        return () => store.timer.unobserve(updateState)
    }, [])

    useEffect(() => {
        if (!timerState.startedAt || !timerState.duration) {
            setTimeLeft(null)
            return
        }

        let autoDismissTimer = null

        const tick = () => {
            const now = Date.now()
            const elapsed = now - timerState.startedAt
            const remaining = Math.max(0, timerState.duration - elapsed)
            setTimeLeft(remaining)

            // Auto-dismiss after 30 seconds of being at 0
            if (remaining === 0 && !autoDismissTimer) {
                autoDismissTimer = setTimeout(() => {
                    store.dismissTimer()
                }, 30000)
            }
        }

        tick() // Update immediately
        const interval = setInterval(tick, 100) // Update frequently for smoothness
        
        return () => {
            clearInterval(interval)
            if (autoDismissTimer) clearTimeout(autoDismissTimer)
        }
    }, [timerState])

    if (timeLeft === null) return null

    const minutes = Math.floor(timeLeft / 60000)
    const seconds = Math.floor((timeLeft % 60000) / 1000)
    const isOver = timeLeft === 0

    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-bottom-10 fade-in duration-300 ${
            isOver 
                ? 'bg-red-500/90 border-red-400/50 text-white' 
                : 'bg-slate-900/90 border-white/10 text-white'
        }`}>
            <Clock className={`w-6 h-6 ${!isOver && timeLeft < 60000 ? 'text-red-400 animate-pulse' : 'text-indigo-400'}`} />
            <span className="font-mono text-2xl font-bold tabular-nums">
                {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </span>
            
            {isOver && (
                <button 
                    onClick={() => store.dismissTimer()}
                    className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors"
                    title="Dismiss for everyone"
                >
                    <X className="w-5 h-5" />
                </button>
            )}
        </div>
    )
}
