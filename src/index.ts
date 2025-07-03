import { DurableObject } from "cloudflare:workers";

export interface Env {
	WEBSOCKET_SERVER: DurableObjectNamespace<WebSocketServer>;
}

// Worker
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		
		if (url.pathname === "/websocket") {
			// Expect to receive a WebSocket Upgrade request
			const upgradeHeader = request.headers.get("Upgrade");
			if (!upgradeHeader || upgradeHeader !== "websocket") {
				return new Response("Expected Upgrade: websocket", { status: 426 });
			}

			// Get or create a Durable Object instance
			// Using a hardcoded name "test-room" for simplicity
			const id = env.WEBSOCKET_SERVER.idFromName("test-room");
			const stub = env.WEBSOCKET_SERVER.get(id);

			// Forward the request to the Durable Object
			return stub.fetch(request);
		}


		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

// Durable Object with WebSocket hibernation and heartbeat system
export class WebSocketServer extends DurableObject {
	private connectionTimeouts: Map<string, number> = new Map();
	private readonly HEARTBEAT_INTERVAL = 20000; // 20 seconds
	private readonly CONNECTION_TIMEOUT = 60000; // 60 seconds

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		
		// Restore hibernated WebSocket connections
		this.ctx.getWebSockets().forEach((ws) => {
			const meta = ws.deserializeAttachment();
			if (meta?.connectionId) {
				// Set up connection timeout for restored connections
				this.setConnectionTimeout(meta.connectionId);
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		// Create WebSocket pair
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		// Use hibernatable WebSocket API
		this.ctx.acceptWebSocket(server);
		
		// Generate unique connection ID
		const connectionId = crypto.randomUUID();
		
		// Store connection metadata
		const metadata = {
			connectionId,
			connectedAt: Date.now(),
			lastPing: Date.now()
		};
		
		server.serializeAttachment(metadata);

		// Set up connection timeout alarm
		this.setConnectionTimeout(connectionId);

		// Send welcome message
		server.send(JSON.stringify({ 
			type: "welcome", 
			message: "Connected to Hibernatable WebSocket Server",
			connectionId,
			heartbeatInterval: this.HEARTBEAT_INTERVAL
		}));

		// Return the client WebSocket
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	// Handle incoming WebSocket messages (hibernation API)
	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
		const messageStr = typeof message === "string" ? message : new TextDecoder().decode(message);
		console.log("Received message:", messageStr);
		
		try {
			const data = JSON.parse(messageStr);
			const metadata = ws.deserializeAttachment();
			
			// Update last ping time
			if (metadata) {
				metadata.lastPing = Date.now();
				ws.serializeAttachment(metadata);
				
				// Reset connection timeout
				this.setConnectionTimeout(metadata.connectionId);
			}

			// Handle different message types
			switch (data.type) {
				case "ping":
					// Respond with pong
					ws.send(JSON.stringify({
						type: "pong",
						timestamp: new Date().toISOString(),
						connectionId: metadata?.connectionId
					}));
					break;
					
				case "heartbeat":
					// Client heartbeat - just acknowledge
					ws.send(JSON.stringify({
						type: "heartbeat_ack",
						timestamp: new Date().toISOString(),
						connectionId: metadata?.connectionId
					}));
					break;
					
				default:
					// Echo other messages with metadata
					const response = {
						type: "echo",
						message: data.message || messageStr,
						timestamp: new Date().toISOString(),
						connections: this.ctx.getWebSockets().length,
						connectionId: metadata?.connectionId
					};
					
					ws.send(JSON.stringify(response));
					break;
			}
		} catch (error) {
			// Handle non-JSON messages
			const metadata = ws.deserializeAttachment();
			const response = {
				type: "echo",
				message: messageStr,
				timestamp: new Date().toISOString(),
				connections: this.ctx.getWebSockets().length,
				connectionId: metadata?.connectionId
			};
			
			ws.send(JSON.stringify(response));
		}
	}

	// Handle WebSocket close (hibernation API)
	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
		const metadata = ws.deserializeAttachment();
		console.log(`WebSocket closed: ${code} ${reason}, wasClean: ${wasClean}, connectionId: ${metadata?.connectionId}`);
		
		// Clean up connection timeout
		if (metadata?.connectionId) {
			this.connectionTimeouts.delete(metadata.connectionId);
		}
	}

	// Handle WebSocket errors (hibernation API)
	async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
		const metadata = ws.deserializeAttachment();
		console.error("WebSocket error:", error, "connectionId:", metadata?.connectionId);
	}

	// Set up connection timeout using alarms
	private async setConnectionTimeout(connectionId: string): Promise<void> {
		// Clear existing timeout for this connection
		const existingTimeout = this.connectionTimeouts.get(connectionId);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}
		
		// Set new timeout
		const timeoutId = setTimeout(async () => {
			await this.checkConnectionTimeout(connectionId);
		}, this.CONNECTION_TIMEOUT) as unknown as number;
		
		this.connectionTimeouts.set(connectionId, timeoutId);
	}

	// Check for connection timeout and close stale connections
	private async checkConnectionTimeout(connectionId: string): Promise<void> {
		const websockets = this.ctx.getWebSockets();
		
		for (const ws of websockets) {
			const metadata = ws.deserializeAttachment();
			if (metadata?.connectionId === connectionId) {
				const timeSinceLastPing = Date.now() - metadata.lastPing;
				
				if (timeSinceLastPing > this.CONNECTION_TIMEOUT) {
					console.log(`Closing stale connection: ${connectionId}`);
					ws.close(1000, "Connection timeout");
				}
				break;
			}
		}
		
		// Clean up timeout reference
		this.connectionTimeouts.delete(connectionId);
	}

	// Alarm handler for periodic cleanup
	async alarm(): Promise<void> {
		console.log("Alarm triggered - checking for stale connections");
		
		const websockets = this.ctx.getWebSockets();
		const now = Date.now();
		
		for (const ws of websockets) {
			const metadata = ws.deserializeAttachment();
			if (metadata?.lastPing) {
				const timeSinceLastPing = now - metadata.lastPing;
				
				if (timeSinceLastPing > this.CONNECTION_TIMEOUT) {
					console.log(`Closing stale connection via alarm: ${metadata.connectionId}`);
					ws.close(1000, "Connection timeout");
				}
			}
		}
		
		// Set next alarm for 60 seconds
		const currentAlarm = await this.ctx.storage.getAlarm();
		if (currentAlarm === null && websockets.length > 0) {
			await this.ctx.storage.setAlarm(Date.now() + 60000);
		}
	}
}