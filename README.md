# RetroBoard 🎯

A **local-first, real-time collaborative retrospective board** that works entirely in the browser. No servers, no signups - just share a link and start collaborating.

🚀 **[Try it live](https://mikelockz.github.io/retro/)**

![Screenshot](https://img.shields.io/badge/React-18-blue) ![Yjs](https://img.shields.io/badge/Yjs-CRDT-green) ![WebRTC](https://img.shields.io/badge/WebRTC-P2P-orange)

## Features

- **🔄 Real-time P2P Sync** - Changes sync instantly between browsers via WebRTC
- **💾 Offline Persistence** - Cards saved to IndexedDB, survive page refresh
- **👤 Anonymous Presence** - See collaborators as "Anonymous Fox", "Anonymous Panda", etc.
- **👍 Voting** - Upvote cards with per-user tracking
- **🎨 Modern UI** - Glassmorphism design with dark gradient theme
- **🚫 No Backend** - Everything runs in the browser

## How It Works

```
┌─────────────┐     WebRTC      ┌─────────────┐
│  Browser A  │◄───────────────►│  Browser B  │
│   (Yjs)     │                 │   (Yjs)     │
│ IndexedDB   │                 │ IndexedDB   │
└─────────────┘                 └─────────────┘
```

1. Open the app - a unique room URL is generated
2. Share the URL with your team
3. Everyone's changes sync automatically via peer-to-peer WebRTC
4. Data persists locally even when all users disconnect

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Yjs](https://yjs.dev/) | CRDT engine for conflict-free merging |
| [y-webrtc](https://github.com/yjs/y-webrtc) | P2P sync via WebRTC |
| [y-indexeddb](https://github.com/yjs/y-indexeddb) | Browser persistence |
| React + Vite | UI framework |
| Tailwind CSS | Styling |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## License

MIT
