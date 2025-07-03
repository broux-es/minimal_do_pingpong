# Cloudflare Durable Object WebSocket with Hibernation

A complete implementation of Cloudflare Durable Objects with WebSocket hibernation, heartbeat system, and worker alarms for connection management.

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

### 🔧 Multiple Client Support
- **Python Client**: Interactive terminal with automatic heartbeats
- **Web Client**: Browser-based interface with visual heartbeat indicators
- **Test Scripts**: Automated hibernation and functionality testing

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

### Test Hibernation Locally
```bash
npm run dev  # In one terminal
```

```bash
cd client
source .venv/bin/activate
python test_hibernation.py  # In another terminal
```

### Interactive Python Client
```bash
cd client
source .venv/bin/activate
python websocket_client.py
```

Commands:
- Type any message to send
- `ping` - Send manual ping
- `quit` - Disconnect

### Web Client
Open `https://durable-object-websocket.stuart-benji.workers.dev` in your browser.

Features:
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

## Testing

Run the hibernation test to verify functionality:

```bash
cd client
source .venv/bin/activate
python test_hibernation.py
```

This test:
1. Establishes connection
2. Sends initial messages
3. Waits 30 seconds (hibernation period)
4. Sends heartbeat to wake up
5. Verifies post-hibernation functionality

## Configuration

- **Heartbeat Interval**: 20 seconds (configurable)
- **Connection Timeout**: 60 seconds
- **Alarm Cleanup**: 60 seconds
- **Hibernation Trigger**: ~30 seconds of inactivity

## Production Deployment

The worker is deployed to: `https://durable-object-websocket.stuart-benji.workers.dev`

Key benefits in production:
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