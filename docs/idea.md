# To build this, you are essentially creating a **Local-First Web App**. This means the application logic and data management live entirely in the browser, and "networking" is just a plugin that synchronizes that local data with others.

### 1. Technology Stack

You don't need a heavy framework, but using **Vite** with **React** or **Vue** is recommended for managing the UI state of the cards.

* **[Yjs](https://yjs.dev/):** The "magic" engine. It handles the **CRDT** (Conflict-free Replicated Data Type) logic. If two people edit the same card at the exact same time, Yjs merges them perfectly without a central server deciding who won.
* **[y-webrtc](https://github.com/yjs/y-webrtc):** The networking plugin. It handles the P2P connections and talks to the public signaling server.
* **[y-indexeddb](https://github.com/yjs/y-indexeddb):** This is your "Database." It saves the board to the user's browser storage. This way, if they refresh or come back the next day, the board is still there.
* **[Lucide React](https://lucide.dev/) / [Tailwind CSS](https://tailwindcss.com/):** For a clean, modern UI without writing 500 lines of CSS.

---

### 2. Recommended File Structure

Since this is a static site, your project structure is very flat. If you use a standard build tool like Vite, it looks like this:

```text
retro-app/
├── index.html          # The entry point
├── src/
│   ├── main.jsx        # Initializes Yjs and React
│   ├── App.jsx         # Main Layout (Columns & Header)
│   ├── Store.js        # Logic for Yjs Doc, WebRTC, and IndexedDB
│   ├── components/
│   │   ├── Column.jsx  # "What went well", "Needs work", etc.
│   │   ├── Card.jsx    # Individual note component
│   │   └── Presence.jsx # Shows "Anonymous Hippo is typing..."
├── package.json        # Dependencies
└── vite.config.js      # Configuration for static hosting

```

---

### 3. Core Functionality & Logic

The "Soul" of the app lives in `Store.js`. Here is how the functionality breaks down:

#### The Data Model

Instead of a database table, you use a **Shared Array**.

* **Action:** When a user clicks "Add Card," you simply push a JSON object: `{ id: 'uuid', text: '', votes: 0, color: 'blue' }` to the Yjs Array.
* **Sync:** Every other connected peer receives an "update" event automatically. Their UI re-renders to show the new card.

#### The "Anonymous" Presence

To make it feel collaborative without logins, you use the **Awareness** feature in Yjs:

1. On page load, the app generates a random ID and an animal name (e.g., "Anonymous Fox").
2. As the user moves their mouse or types, Yjs broadcasts this "awareness" state to all peers.
3. Other users see a small colored cursor or a label saying "Anonymous Fox is typing..."

#### Data Persistence (The "No Server" Database)

Since there is no backend, where does the data go when the last person leaves?

* **The First Joiner:** When you start a retro, the data is in your RAM and your `IndexedDB` (local disk).
* **Syncing:** When Peer B joins via your Slack link, your browser sends the entire history of the board to them.
* **The Hand-off:** Now Peer B also has the data on their disk. Even if you (the creator) close your laptop, Peer B is now the "host" of that data for anyone else who joins.

---

### 4. Implementation Steps

1. **Initialize Yjs:** Create a `new Y.Doc()`.
2. **Connect WebRTC:** Pass a room name (from the URL hash) to `WebrtcProvider`.
3. **Bind to UI:** Use a "hook" (like `useSyncExternalStore` in React) to tell the UI to refresh whenever the `Y.Array` of cards changes.
4. **Deploy:** Run `npm run build` and drag the `dist` folder onto **Netlify Drop** or **GitHub Pages**.