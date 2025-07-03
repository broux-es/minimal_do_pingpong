#!/usr/bin/env python3
"""
Simple synchronous test for WebSocket
"""

import websocket
import ssl
import json
import threading
import time

url = "wss://durable-object-websocket.stuart-benji.workers.dev/websocket"
print(f"Connecting to: {url}")

# Create a WebSocket connection
ws = websocket.create_connection(url, sslopt={"cert_reqs": ssl.CERT_NONE})

try:
    # Receive welcome message
    welcome = ws.recv()
    print(f"Welcome message: {welcome}")
    
    # Send test messages and receive responses
    test_messages = [
        "Hello from Python",
        "Test message",
        json.dumps({"test": "data"})
    ]
    
    for msg in test_messages:
        print(f"\nSending: {msg}")
        ws.send(msg)
        
        # Receive echo response
        response = ws.recv()
        print(f"Received: {response}")
        
        # Parse and display
        try:
            data = json.loads(response)
            print(f"  Type: {data.get('type')}")
            print(f"  Message: {data.get('message')}")
            print(f"  Connections: {data.get('connections')}")
        except:
            pass
            
finally:
    print("\nClosing connection...")
    ws.close()
    print("Done!")