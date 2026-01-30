// Vibrant color palette for user avatars and cards
export const userColors = [
    { bg: 'bg-rose-500', text: 'text-rose-500', hex: '#f43f5e' },
    { bg: 'bg-orange-500', text: 'text-orange-500', hex: '#f97316' },
    { bg: 'bg-amber-500', text: 'text-amber-500', hex: '#f59e0b' },
    { bg: 'bg-emerald-500', text: 'text-emerald-500', hex: '#10b981' },
    { bg: 'bg-teal-500', text: 'text-teal-500', hex: '#14b8a6' },
    { bg: 'bg-cyan-500', text: 'text-cyan-500', hex: '#06b6d4' },
    { bg: 'bg-sky-500', text: 'text-sky-500', hex: '#0ea5e9' },
    { bg: 'bg-indigo-500', text: 'text-indigo-500', hex: '#6366f1' },
    { bg: 'bg-violet-500', text: 'text-violet-500', hex: '#8b5cf6' },
    { bg: 'bg-purple-500', text: 'text-purple-500', hex: '#a855f7' },
    { bg: 'bg-fuchsia-500', text: 'text-fuchsia-500', hex: '#d946ef' },
    { bg: 'bg-pink-500', text: 'text-pink-500', hex: '#ec4899' },
]

export function getColorByIndex(index) {
    return userColors[index % userColors.length]
}

export function getRandomColor() {
    return userColors[Math.floor(Math.random() * userColors.length)]
}

// Column-specific colors with gradients
export const columnColors = {
    good: {
        gradient: 'from-emerald-500/20 to-teal-500/20',
        border: 'border-emerald-500/30',
        header: 'text-emerald-400',
        button: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300',
    },
    improve: {
        gradient: 'from-amber-500/20 to-orange-500/20',
        border: 'border-amber-500/30',
        header: 'text-amber-400',
        button: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300',
    },
    action: {
        gradient: 'from-violet-500/20 to-purple-500/20',
        border: 'border-violet-500/30',
        header: 'text-violet-400',
        button: 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-300',
    },
}
