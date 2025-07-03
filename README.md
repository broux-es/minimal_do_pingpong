# WebSocket Hibernation Bug Reproduction

🐛 **WebSocket hibernation is broken in deployed Cloudflare Workers** - responses never reach clients.

## The Bug

- ✅ **Local (`wrangler dev`)**: WebSocket hibernation works perfectly
- ❌ **Deployed**: Server responses never reach clients (timeout)
- ❌ **Production Impact**: Bidirectional WebSocket communication impossible

## Quick Reproduction

### 1. Test Locally (Works)
```bash
npm install
npm run dev
```

```bash
cd client
pip install -r requirements.txt
python websocket_client.py
# Type "ping" - you'll get a pong response ✅
```

### 2. Test Deployed (Broken)
```bash
npm run deploy
```

Edit `client/websocket_client.py` and change:
```python
WEBSOCKET_URL = "wss://your-worker-name.your-subdomain.workers.dev/websocket"
```

```bash
cd client
python websocket_client.py
# Type "ping" - no response ever arrives ❌
```

## Technical Details

The bug occurs when using `ctx.acceptWebSocket()` (hibernation API):

```typescript
// This works locally but fails in deployed workers
this.ctx.acceptWebSocket(server);

async webSocketMessage(ws: WebSocket, message: string) {
  ws.send("response"); // ❌ Never reaches client in deployed workers
}
```

## Bug Reports for Cloudflare

- `CLOUDFLARE-BUG-REPORT.md` - Executive summary
- `hibernation-bug-repro.md` - Technical details
- `src/` - Working vs broken code examples