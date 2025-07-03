# Cloudflare WebSocket Hibernation Bug Reproduction

## Issue Summary
WebSocket connections using the hibernation API (`ctx.acceptWebSocket()`) are **not sending responses back to clients**. The Durable Object receives messages but responses never reach the client.

## Reproduction

### 1. Minimal Durable Object Code
```typescript
import { DurableObject } from "cloudflare:workers";

export class WebSocketServer extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Using hibernation API - THIS IS WHERE THE BUG OCCURS
    this.ctx.acceptWebSocket(server);

    // Send welcome message (this works)
    server.send(JSON.stringify({ 
      type: "welcome", 
      message: "Connected",
      connectionId: crypto.randomUUID()
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  // Hibernation API handlers
  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    console.log("Received message:", message); // This logs correctly
    
    // Send response - THIS NEVER REACHES THE CLIENT
    ws.send(JSON.stringify({
      type: "echo",
      message: message,
      timestamp: new Date().toISOString()
    }));
  }
}
```

### 2. Client Test Results
```bash
# What the client sees:
1. Welcome: {"type":"welcome","message":"Connected","connectionId":"..."}  ✅ WORKS
2. Sending ping: {"type": "ping", "timestamp": 1751582048.929441}         ✅ SENT
3. ERROR receiving ping response: Connection timed out                     ❌ NO RESPONSE
4. Sending message: {"type": "message", "message": "test"}                ✅ SENT  
5. ERROR receiving message response: Connection timed out                  ❌ NO RESPONSE
```

### 3. Worker Logs Show
- ✅ Messages are received by the Durable Object
- ✅ `webSocketMessage()` handler is called
- ✅ `ws.send()` is called without errors
- ❌ But responses never reach the client

## Key Observations

1. **Welcome message works**: The initial `server.send()` in `fetch()` reaches the client
2. **Subsequent messages fail**: All `ws.send()` calls in `webSocketMessage()` don't reach the client
3. **No errors thrown**: `ws.send()` executes without throwing exceptions
4. **Worker logs show receipt**: The DO receives and processes messages correctly

## Expected vs Actual Behavior

### Expected (Working)
```
Client: ping → Durable Object: receives ping → webSocketMessage() → ws.send(pong) → Client: receives pong
```

### Actual (Broken)
```
Client: ping → Durable Object: receives ping → webSocketMessage() → ws.send(pong) → ❌ Client: timeout
```

## Non-Hibernation Comparison
When using the legacy `server.accept()` API instead of `ctx.acceptWebSocket()`, everything works perfectly:

```typescript
// This works fine:
server.accept();
server.addEventListener("message", (event) => {
  server.send("response"); // This reaches the client
});
```

## Deployment Info
- **Worker URL**: https://durable-object-websocket.stuart-benji.workers.dev
- **Wrangler Version**: 4.23.0
- **Runtime**: Latest (deployed today)

## Test Commands
```bash
# Clone and test:
git clone <repo>
npm install && npm run deploy
cd client && pip install -r requirements.txt
python debug_test.py
```

The issue is specifically with the hibernation API where `ws.send()` calls in `webSocketMessage()` handlers don't deliver messages to clients, despite no errors being thrown.