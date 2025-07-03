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

		// Return a simple HTML page for testing
		if (url.pathname === "/") {
			return new Response(
				`<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Test</title>
</head>
<body>
    <h1>Cloudflare Durable Object WebSocket Test</h1>
    <p>Status: <span id="status">Disconnected</span></p>
    <div style="margin: 10px 0;">
        <input type="text" id="messageInput" placeholder="Enter message" style="width: 300px; padding: 5px;">
        <button onclick="sendMessage()" style="padding: 5px 10px;">Send</button>
        <button onclick="sendPing()" style="padding: 5px 10px;">Ping</button>
    </div>
    <div id="messages" style="border: 1px solid #ccc; height: 400px; overflow-y: auto; padding: 10px; margin: 10px 0;"></div>
    
    <script>
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(\`\${protocol}//\${window.location.host}/websocket\`);
        const status = document.getElementById('status');
        const messages = document.getElementById('messages');
        
        let heartbeatInterval = null;
        let connectionId = null;
        let heartbeatIntervalMs = 20000; // Default 20 seconds
        
        function addMessage(text, type = 'info') {
            const msg = document.createElement('div');
            msg.style.margin = '2px 0';
            msg.style.padding = '2px 4px';
            msg.style.borderRadius = '3px';
            
            switch(type) {
                case 'sent':
                    msg.style.backgroundColor = '#e3f2fd';
                    msg.style.color = '#1565c0';
                    break;
                case 'received':
                    msg.style.backgroundColor = '#f3e5f5';
                    msg.style.color = '#7b1fa2';
                    break;
                case 'heartbeat':
                    msg.style.backgroundColor = '#fff3e0';
                    msg.style.color = '#ef6c00';
                    break;
                case 'error':
                    msg.style.backgroundColor = '#ffebee';
                    msg.style.color = '#c62828';
                    break;
            }
            
            msg.textContent = text;
            messages.appendChild(msg);
            messages.scrollTop = messages.scrollHeight;
        }
        
        function startHeartbeat() {
            if (heartbeatInterval) return;
            
            heartbeatInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    const heartbeat = {
                        type: 'heartbeat',
                        timestamp: new Date().toISOString()
                    };
                    ws.send(JSON.stringify(heartbeat));
                    addMessage('❤️ Heartbeat sent', 'heartbeat');
                }
            }, heartbeatIntervalMs);
            
            addMessage(\`🔄 Heartbeat started (\${heartbeatIntervalMs/1000}s interval)\`, 'heartbeat');
        }
        
        function stopHeartbeat() {
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
                heartbeatInterval = null;
                addMessage('⏹️ Heartbeat stopped', 'heartbeat');
            }
        }
        
        ws.onopen = () => {
            status.textContent = 'Connected';
            status.style.color = 'green';
            addMessage('🔗 WebSocket connected', 'info');
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                switch(data.type) {
                    case 'welcome':
                        connectionId = data.connectionId;
                        heartbeatIntervalMs = data.heartbeatInterval || 20000;
                        addMessage(\`🎉 Welcome! ID: \${connectionId}\`, 'received');
                        addMessage(\`⏱️ Heartbeat interval: \${heartbeatIntervalMs}ms\`, 'info');
                        startHeartbeat();
                        break;
                        
                    case 'pong':
                        addMessage('🏓 Pong received', 'received');
                        break;
                        
                    case 'heartbeat_ack':
                        addMessage('✅ Heartbeat acknowledged', 'received');
                        break;
                        
                    case 'echo':
                        addMessage(\`📢 Echo: \${data.message} (connections: \${data.connections})\`, 'received');
                        break;
                        
                    default:
                        addMessage(\`📨 \${data.type}: \${JSON.stringify(data)}\`, 'received');
                }
            } catch (e) {
                addMessage(\`📨 Raw: \${event.data}\`, 'received');
            }
        };
        
        ws.onclose = () => {
            status.textContent = 'Disconnected';
            status.style.color = 'red';
            addMessage('❌ WebSocket disconnected', 'error');
            stopHeartbeat();
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            addMessage('⚠️ WebSocket error occurred', 'error');
        };
        
        function sendMessage() {
            const input = document.getElementById('messageInput');
            if (input.value && ws.readyState === WebSocket.OPEN) {
                const messageData = {
                    type: 'message',
                    message: input.value,
                    timestamp: new Date().toISOString()
                };
                ws.send(JSON.stringify(messageData));
                addMessage(\`📤 Sent: \${input.value}\`, 'sent');
                input.value = '';
            }
        }
        
        function sendPing() {
            if (ws.readyState === WebSocket.OPEN) {
                const pingData = {
                    type: 'ping',
                    timestamp: new Date().toISOString()
                };
                ws.send(JSON.stringify(pingData));
                addMessage('🏓 Ping sent', 'sent');
            }
        }
        
        // Allow Enter key to send message
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>`,
				{
					headers: { "Content-Type": "text/html" },
				}
			);
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