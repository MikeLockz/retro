/**
 * Cloudflare Worker with Durable Objects for WebRTC Signaling
 * 
 * This worker acts as a "lobby" for P2P connections:
 * 1. Client connects with ?room=<roomId>
 * 2. Worker routes to a Durable Object instance for that room
 * 3. Durable Object broadcasts signaling messages to all peers
 */

// The Durable Object class that handles a single "room"
export class SignalingRoom {
    constructor(state, env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request) {
        // Handle WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
            return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        const [client, server] = Object.values(new WebSocketPair());

        // Accept the WebSocket connection
        this.state.acceptWebSocket(server);

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    // Called when a WebSocket receives a message
    async webSocketMessage(ws, message) {
        // Get all connected WebSockets in this room
        const sockets = this.state.getWebSockets();

        // Broadcast to everyone except the sender
        for (const socket of sockets) {
            if (socket !== ws) {
                try {
                    socket.send(message);
                } catch (err) {
                    // Socket might be closed, ignore
                }
            }
        }
    }

    // Called when a WebSocket is closed
    async webSocketClose(ws, code, reason, wasClean) {
        // Durable Objects automatically clean up closed sockets
        console.log(`WebSocket closed: code=${code}, reason=${reason}`);
    }

    // Called when a WebSocket errors
    async webSocketError(ws, error) {
        console.error('WebSocket error:', error);
    }
}

// Main worker entry point
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Health check endpoint
        if (url.pathname === '/health') {
            return new Response('ok', { status: 200 });
        }

        // Get room ID from query param (default to "global")
        const roomId = url.searchParams.get('room') || 'global';

        // Get or create a Durable Object instance for this room
        const id = env.SIGNALING_ROOM.idFromName(roomId);
        const room = env.SIGNALING_ROOM.get(id);

        // Forward the request to the Durable Object
        return room.fetch(request);
    },
};
