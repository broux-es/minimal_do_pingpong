# 🐛 Cloudflare WebSocket Hibernation Bug Report

## Summary
**WebSocket responses sent via `ws.send()` in hibernation API handlers never reach clients in DEPLOYED workers.** 

## Issue Details
- **API**: Durable Objects WebSocket Hibernation (`ctx.acceptWebSocket()`)
- **Problem**: Messages sent in `webSocketMessage()` handlers don't reach clients in deployed workers
- **Status**: Confirmed broken in production deployments (responses timeout on client side)
- **Scope**: Affects deployed hibernation WebSocket implementations only
- **Local Development**: Works perfectly with `wrangler dev`

## Reproduction Steps

1. Use `ctx.acceptWebSocket(server)` instead of `server.accept()`
2. Implement `webSocketMessage()` handler
3. Call `ws.send()` from within the handler
4. **Deploy worker** (not local dev)
5. Client never receives the response (times out)

**Important**: This bug does NOT occur with `wrangler dev` - only deployed workers are affected.

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

### Local Development (`wrangler dev`):
```
1. Connect: ✅ Success
2. Welcome message: ✅ Received  
3. Send ping: ✅ Sent
4. Receive pong: ✅ SUCCESS (works perfectly)
5. Send message: ✅ Sent  
6. Receive echo: ✅ SUCCESS (works perfectly)
```

### Deployed Worker (Production):
```
1. Connect: ✅ Success
2. Welcome message: ✅ Received  
3. Send ping: ✅ Sent
4. Receive pong: ❌ TIMEOUT (never arrives)
5. Send message: ✅ Sent  
6. Receive echo: ❌ TIMEOUT (never arrives)
```

### Server Logs (Both Environments):
```
✅ webSocketMessage() called correctly
✅ ws.send() executes without errors  
❌ But messages never reach client (deployed only)
```

## Environment
- **Wrangler**: 4.23.0
- **Runtime**: Latest (Dec 2024)
- **Deployment**: Fresh deployment (reproducible with any Durable Object deployment)

## Impact
This bug makes WebSocket hibernation **completely unusable** for any bidirectional communication, as servers cannot respond to client messages.

## Workaround
Temporarily revert to legacy `server.accept()` API, but this loses hibernation benefits.

## Test Repository
Complete reproduction case available with both working and broken versions for comparison.

---
**Priority**: High - Breaks core hibernation functionality