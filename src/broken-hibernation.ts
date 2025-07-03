import { DurableObject } from "cloudflare:workers";

// This is the BROKEN hibernation version
export class BrokenHibernationServer extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		// HIBERNATION API - THIS IS BROKEN
		this.ctx.acceptWebSocket(server);

		// Send welcome message (this works)
		server.send(JSON.stringify({ 
			type: "welcome", 
			message: "Connected to HIBERNATING server",
			connectionId: crypto.randomUUID()
		}));

		return new Response(null, { status: 101, webSocket: client });
	}

	// Hibernation handlers - RESPONSES DON'T REACH CLIENT
	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
		const messageStr = typeof message === "string" ? message : new TextDecoder().decode(message);
		console.log("Received message:", messageStr);
		
		try {
			const data = JSON.parse(messageStr);
			
			switch (data.type) {
				case "ping":
					// This pong WILL NOT reach the client!
					ws.send(JSON.stringify({
						type: "pong",
						timestamp: new Date().toISOString()
					}));
					break;
					
				default:
					// This echo WILL NOT reach the client!
					ws.send(JSON.stringify({
						type: "echo",
						message: data.message || messageStr,
						timestamp: new Date().toISOString()
					}));
					break;
			}
		} catch (error) {
			// Fallback echo - WILL NOT reach the client!
			ws.send(JSON.stringify({
				type: "echo",
				message: messageStr,
				timestamp: new Date().toISOString()
			}));
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
		console.log("WebSocket closed");
	}
}