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
        // Track connections per IP
        this.ipCounts = new Map(); // Map<IP, Count>
        // Track which socket belongs to which IP for cleanup
        this.socketToIp = new Map(); // Map<WebSocket, IP>

        // Max connections per IP per room
        this.MAX_CONNS_PER_IP = 20;

        // Restore state if needed (though for simple rate limiting, in-memory is usually fine 
        // as DOs stay alive while connected)
    }

    async fetch(request) {
        // Handle WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
            return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        // Get client IP
        const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

        // Check rate limit
        const currentCount = this.ipCounts.get(clientIp) || 0;
        if (currentCount >= this.MAX_CONNS_PER_IP) {
            return new Response('Too Many Requests', { status: 429 });
        }

        const [client, server] = Object.values(new WebSocketPair());

        // Accept the WebSocket connection
        this.state.acceptWebSocket(server);

        // Update tracking
        this.ipCounts.set(clientIp, currentCount + 1);
        this.socketToIp.set(server, clientIp);

        // Clean up closed sockets automatically handled by webSocketClose

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
        // Decrease count for this IP
        const ip = this.socketToIp.get(ws);
        if (ip) {
            const currentCount = this.ipCounts.get(ip) || 0;
            if (currentCount > 0) {
                this.ipCounts.set(ip, currentCount - 1);
            }
            // If count is 0, we can delete the key to save memory, 
            // but keeping it is also fine for recent history tracking if we wanted.
            if (this.ipCounts.get(ip) === 0) {
                this.ipCounts.delete(ip);
            }

            // Clean up socket mapping
            this.socketToIp.delete(ws);
        }

        // Durable Objects automatically clean up closed sockets
        console.log(`WebSocket closed: code=${code}, reason=${reason}`);
    }

    // Called when a WebSocket errors
    async webSocketError(ws, error) {
        console.error('WebSocket error:', error);
        // Error usually leads to close, so logic is handled there
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
