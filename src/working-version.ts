import { DurableObject } from "cloudflare:workers";

// This is the WORKING non-hibernation version for comparison
export class WorkingWebSocketServer extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		// NON-HIBERNATION API - THIS WORKS
		server.accept();

		// Send welcome message
		server.send(JSON.stringify({ 
			type: "welcome", 
			message: "Connected to NON-hibernating server",
			connectionId: crypto.randomUUID()
		}));

		// Event listeners - THIS WORKS
		server.addEventListener("message", (event: MessageEvent) => {
			console.log("Received message:", event.data);
			
			try {
				const data = JSON.parse(event.data);
				
				switch (data.type) {
					case "ping":
						// This pong WILL reach the client
						server.send(JSON.stringify({
							type: "pong",
							timestamp: new Date().toISOString()
						}));
						break;
						
					default:
						// This echo WILL reach the client  
						server.send(JSON.stringify({
							type: "echo",
							message: data.message || event.data,
							timestamp: new Date().toISOString()
						}));
						break;
				}
			} catch (error) {
				// Fallback echo
				server.send(JSON.stringify({
					type: "echo",
					message: event.data,
					timestamp: new Date().toISOString()
				}));
			}
		});

		return new Response(null, { status: 101, webSocket: client });
	}
}