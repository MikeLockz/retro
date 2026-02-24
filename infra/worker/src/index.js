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
        // Track topic subscriptions per socket for y-webrtc pub/sub protocol
        this.subscriptions = new Map(); // Map<WebSocket, Set<string>>

        // Max connections per IP per room
        this.MAX_CONNS_PER_IP = 20;
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
        this.subscriptions.set(server, new Set());

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    // Called when a WebSocket receives a message
    // Implements the y-webrtc signaling protocol: subscribe, unsubscribe, publish, ping
    async webSocketMessage(ws, message) {
        let msg;
        try {
            msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
        } catch {
            return; // Ignore non-JSON messages
        }

        switch (msg.type) {
            case 'subscribe': {
                const topics = this.subscriptions.get(ws);
                if (topics && Array.isArray(msg.topics)) {
                    msg.topics.forEach(topic => topics.add(topic));
                }
                break;
            }
            case 'unsubscribe': {
                const topics = this.subscriptions.get(ws);
                if (topics && Array.isArray(msg.topics)) {
                    msg.topics.forEach(topic => topics.delete(topic));
                }
                break;
            }
            case 'publish': {
                // Forward to all sockets subscribed to this topic (except sender)
                const topic = msg.topic;
                if (typeof topic !== 'string') break;

                const sockets = this.state.getWebSockets();
                const payload = JSON.stringify(msg);

                for (const socket of sockets) {
                    if (socket === ws) continue;
                    const subTopics = this.subscriptions.get(socket);
                    if (subTopics && subTopics.has(topic)) {
                        try {
                            socket.send(payload);
                        } catch (err) {
                            // Socket might be closed, ignore
                        }
                    }
                }
                break;
            }
            case 'ping': {
                try {
                    ws.send(JSON.stringify({ type: 'pong' }));
                } catch (err) {
                    // Ignore send errors
                }
                break;
            }
        }
    }

    // Called when a WebSocket is closed
    async webSocketClose(ws, code, reason, wasClean) {
        // Clean up subscriptions
        this.subscriptions.delete(ws);

        // Decrease count for this IP
        const ip = this.socketToIp.get(ws);
        if (ip) {
            const currentCount = this.ipCounts.get(ip) || 0;
            if (currentCount > 0) {
                this.ipCounts.set(ip, currentCount - 1);
            }
            if (this.ipCounts.get(ip) === 0) {
                this.ipCounts.delete(ip);
            }
            this.socketToIp.delete(ws);
        }

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
