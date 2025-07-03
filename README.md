# Cloudflare Durable Object WebSocket Hibernation Bug Reproduction

⚠️ **PRIMARY PURPOSE: This project isolates a critical bug in Cloudflare's WebSocket hibernation API** ⚠️

## 🐛 Bug Summary
This repository demonstrates that **WebSocket hibernation is currently broken** in **deployed** Cloudflare Durable Objects. While clients can send messages to hibernating Durable Objects, **the server cannot send responses back to clients**.

**⚠️ Important**: This bug only occurs with **deployed workers**. Local development with `wrangler dev` works correctly.

### What Works:
- ✅ Initial connection and welcome messages
- ✅ Client sending messages to server
- ✅ Server receiving messages (logs confirm)
- ✅ Local development (`wrangler dev`) works perfectly

### What's Broken (Deployed Workers Only):
- ❌ Server responses never reach clients (all timeout)
- ❌ Ping/pong functionality broken
- ❌ Heartbeat acknowledgments never arrive
- ❌ Echo messages never arrive

This makes **bidirectional WebSocket communication impossible** with hibernation in production deployments.

---

## Technical Implementation

*Despite the hibernation bug, this project implements a complete WebSocket hibernation system with heartbeat and alarm functionality for testing and future use when the bug is fixed.*

## Features

### 🔄 WebSocket Hibernation
- Uses `ctx.acceptWebSocket()` for hibernatable connections
- Durable Object can be evicted from memory during inactivity
- WebSocket connections survive hibernation and are restored when messages arrive

### ❤️ Heartbeat System
- Client sends heartbeats every 20 seconds
- Server responds with acknowledgments
- Automatic ping/pong functionality
- Connection timeout detection (60 seconds)

### ⏰ Worker Alarms
- Periodic cleanup of stale connections
- Connection timeout management using alarms
- Automatic connection closure for inactive clients

### 🔧 Client Support
- **Python Client**: Interactive terminal with automatic heartbeats (`client/websocket_client.py`)
- **Web Client**: Browser-based interface with visual heartbeat indicators

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Python client dependencies:
```bash
cd client
pip install -r requirements.txt
# or if using venv:
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

## Usage

### Deploy Worker
```bash
npm run deploy
```

### Test Locally (Works Correctly)
```bash
npm run dev  # In one terminal
```

```bash
cd client
source .venv/bin/activate
python websocket_client.py  # In another terminal
```

**Note**: Local testing with `wrangler dev` works perfectly and you'll see all responses.

### Python Client
```bash
cd client
source .venv/bin/activate
python websocket_client.py
```

**Commands:**
- Type any message to send
- `ping` - Send manual ping
- `quit` - Disconnect

**Configuration:** Edit `WEBSOCKET_URL` at the top of the file to test different deployments.

### Web Client
Deploy with `npm run deploy` and open your worker URL in browser.

**Features:**
- Automatic heartbeats every 20 seconds
- Visual message indicators
- Manual ping button
- Real-time connection status

## How Hibernation Works

1. **Connection Establishment**:
   - Client connects via WebSocket upgrade request
   - Durable Object accepts connection with `ctx.acceptWebSocket()`
   - Connection metadata stored with `serializeAttachment()`

2. **Active Period**:
   - Client sends heartbeats every 20 seconds
   - Server responds with acknowledgments
   - Connection timeout alarm is reset on each heartbeat

3. **Hibernation**:
   - After 30+ seconds of inactivity, Durable Object hibernates
   - WebSocket connection remains open at Cloudflare edge
   - No memory footprint for inactive connections

4. **Wake Up**:
   - New message arrives from client
   - Durable Object is reconstructed from hibernated state
   - Connection metadata is restored via `deserializeAttachment()`
   - Normal message processing resumes

5. **Timeout Management**:
   - Worker alarm triggers cleanup every 60 seconds
   - Connections without heartbeats for 60+ seconds are closed
   - Automatic resource cleanup

## Architecture

```
┌─────────────┐    WebSocket     ┌─────────────────┐    hibernates    ┌─────────────────┐
│   Client    │ ←──────────────→ │ Cloudflare Edge │ ←──────────────→ │ Durable Object  │
│             │                  │                 │                  │                 │
│ - Heartbeat │                  │ - Proxy         │                  │ - Hibernation   │
│ - Ping/Pong │                  │ - Connection    │                  │ - Alarms        │
│ - Messages  │                  │   Management    │                  │ - State Persist │
└─────────────┘                  └─────────────────┘                  └─────────────────┘
```

## Message Types

### Client to Server
- `heartbeat` - Keep connection alive
- `ping` - Request pong response
- `message` - Regular message with content

### Server to Client  
- `welcome` - Connection established with metadata
- `heartbeat_ack` - Heartbeat acknowledgment
- `pong` - Ping response
- `echo` - Message echo with connection info

## 🧪 Bug Reproduction Tests

### Step 1: Test Locally (Should Work)
```bash
# Terminal 1: Start local dev server
npm run dev

# Terminal 2: Test with local server
cd client
source .venv/bin/activate
python websocket_client.py
```

**Expected Result**: Everything works perfectly - you'll see ping responses, message echoes, and heartbeat acknowledgments.

### Step 2: Test Deployed Worker (Shows Bug)
```bash
# Deploy to Cloudflare
npm run deploy
```

1. Edit `client/websocket_client.py` and change `WEBSOCKET_URL` to your deployed worker URL:
   ```python
   WEBSOCKET_URL = "wss://your-worker-name.your-subdomain.workers.dev/websocket"
   ```

2. Run the client:
   ```bash
   cd client
   source .venv/bin/activate
   python websocket_client.py
   ```

**Bug Reproduction:**
1. Type `ping` and press Enter
2. Type any message and press Enter
3. **Notice: No responses arrive** (connection shows successful, but server never responds)

**What you'll see:**
- ✅ Welcome message received 
- ✅ Heartbeat system starts automatically
- ✅ Messages sent successfully
- ❌ **Zero responses from server** (despite server logs showing receipt)

### Web Browser Test
1. Open your deployed worker URL in browser
2. Type any message and click "Send"
3. Click "Ping" button
4. **Notice: No responses appear** (despite messages being sent)

### Comparison: Local vs Deployed
- **Local (`wrangler dev`)**: ✅ All responses work perfectly
- **Deployed**: ❌ No responses reach client (hibernation bug)

## 📋 Bug Documentation for Cloudflare

This repository includes detailed bug reports for Cloudflare's technical team:

- **`CLOUDFLARE-BUG-REPORT.md`** - Executive summary of the hibernation bug
- **`hibernation-bug-repro.md`** - Detailed technical reproduction steps  
- **`src/working-version.ts`** - Working non-hibernation implementation
- **`src/broken-hibernation.ts`** - Broken hibernation implementation showing the bug
- **`client/websocket_client.py`** - Simple test client demonstrating the bug

These files provide side-by-side comparisons and minimal reproduction cases to help Cloudflare engineers identify and fix the issue.

## Configuration

- **Heartbeat Interval**: 20 seconds (configurable)
- **Connection Timeout**: 60 seconds
- **Alarm Cleanup**: 60 seconds
- **Hibernation Trigger**: ~30 seconds of inactivity

## Production Deployment

Deploy your own worker with: `npm run deploy`

Key benefits when hibernation works in production:
- **Cost Efficiency**: Hibernated objects use no compute resources
- **Scalability**: Thousands of idle connections with minimal overhead
- **Reliability**: Connection state survives Durable Object restarts
- **Global**: Connections managed at Cloudflare's edge locations

## Monitoring

Check worker logs for hibernation events:
```bash
npx wrangler tail --format pretty
```

Look for:
- `Alarm triggered - checking for stale connections`
- `Closing stale connection via alarm`
- Connection establishment and cleanup logs