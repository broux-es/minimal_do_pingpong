#!/usr/bin/env python3
"""
Debug test to check exact message flow
"""

import websocket
import ssl
import json
import time

url = "wss://durable-object-websocket.stuart-benji.workers.dev/websocket"
print(f"Connecting to: {url}")

# Create synchronous connection
ws = websocket.create_connection(url, sslopt={"cert_reqs": ssl.CERT_NONE})

try:
    print("\n=== Testing Message Flow ===")
    
    # Receive welcome message
    welcome = ws.recv()
    print(f"1. Welcome: {welcome}")
    
    # Send ping
    ping_msg = json.dumps({"type": "ping", "timestamp": time.time()})
    print(f"2. Sending ping: {ping_msg}")
    ws.send(ping_msg)
    
    # Try to receive pong
    ws.settimeout(5)
    try:
        response = ws.recv()
        print(f"3. Ping response: {response}")
    except Exception as e:
        print(f"3. ERROR receiving ping response: {e}")
    
    # Send regular message
    msg = json.dumps({"type": "message", "message": "test", "timestamp": time.time()})
    print(f"4. Sending message: {msg}")
    ws.send(msg)
    
    # Try to receive echo
    try:
        response = ws.recv()
        print(f"5. Message response: {response}")
    except Exception as e:
        print(f"5. ERROR receiving message response: {e}")
    
    # Send heartbeat
    heartbeat_msg = json.dumps({"type": "heartbeat", "timestamp": time.time()})
    print(f"6. Sending heartbeat: {heartbeat_msg}")
    ws.send(heartbeat_msg)
    
    # Try to receive heartbeat ack
    try:
        response = ws.recv()
        print(f"7. Heartbeat response: {response}")
    except Exception as e:
        print(f"7. ERROR receiving heartbeat response: {e}")
        
finally:
    print("\nClosing connection...")
    ws.close()
    print("Done!")