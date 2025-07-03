# 🐛 Cloudflare WebSocket Hibernation Bug Report

## Summary
**WebSocket responses sent via `ws.send()` in hibernation API handlers never reach clients.** 

## Issue Details
- **API**: Durable Objects WebSocket Hibernation (`ctx.acceptWebSocket()`)
- **Problem**: Messages sent in `webSocketMessage()` handlers don't reach clients
- **Status**: Confirmed broken (responses timeout on client side)
- **Scope**: Affects all hibernation WebSocket implementations

## Reproduction Steps

1. Use `ctx.acceptWebSocket(server)` instead of `server.accept()`
2. Implement `webSocketMessage()` handler
3. Call `ws.send()` from within the handler
4. Client never receives the response (times out)

## Code Evidence

### ✅ Working (Non-Hibernation)
```typescript
server.accept(); // Legacy API
server.addEventListener("message", (event) => {
  server.send("response"); // ✅ Client receives this
});
```

### ❌ Broken (Hibernation) 
```typescript
this.ctx.acceptWebSocket(server); // Hibernation API

async webSocketMessage(ws: WebSocket, message: string) {
  ws.send("response"); // ❌ Client NEVER receives this
}
```

## Test Results

### Client Perspective:
```
1. Connect: ✅ Success
2. Welcome message: ✅ Received  
3. Send ping: ✅ Sent
4. Receive pong: ❌ TIMEOUT (never arrives)
5. Send message: ✅ Sent  
6. Receive echo: ❌ TIMEOUT (never arrives)
```

### Server Logs:
```
✅ webSocketMessage() called correctly
✅ ws.send() executes without errors  
❌ But messages never reach client
```

## Environment
- **Wrangler**: 4.23.0
- **Runtime**: Latest (Dec 2024)
- **Test URL**: https://durable-object-websocket.stuart-benji.workers.dev
- **Deployment**: Fresh deployment today

## Impact
This bug makes WebSocket hibernation **completely unusable** for any bidirectional communication, as servers cannot respond to client messages.

## Workaround
Temporarily revert to legacy `server.accept()` API, but this loses hibernation benefits.

## Test Repository
Complete reproduction case available with both working and broken versions for comparison.

---
**Priority**: High - Breaks core hibernation functionality