#!/usr/bin/env python3
"""
Test script for remote WebSocket connection
"""

import json
import time
import websocket
import ssl

def test_remote_connection():
    url = "wss://durable-object-websocket.stuart-benji.workers.dev/websocket"
    print(f"Testing connection to: {url}")
    print("-" * 50)
    
    messages_received = []
    
    def on_message(ws, message):
        print(f"Received: {message}")
        messages_received.append(message)
        
    def on_error(ws, error):
        print(f"Error: {error}")
        
    def on_close(ws, close_status_code, close_msg):
        print(f"Connection closed - Status: {close_status_code}, Message: {close_msg}")
        
    def on_open(ws):
        print("Connection opened")
        
        # Wait a moment for welcome message
        time.sleep(1)
        
        # Send test messages
        test_messages = [
            "Hello from Python client",
            "Test message 1",
            "Test message 2",
            json.dumps({"type": "test", "data": "JSON message"})
        ]
        
        for msg in test_messages:
            print(f"Sending: {msg}")
            ws.send(msg)
            time.sleep(1)  # Longer delay between messages
            
        # Wait longer for responses
        print("Waiting for responses...")
        time.sleep(5)
        
        # Close connection
        print("Closing connection...")
        ws.close()
    
    # Create WebSocket connection
    ws = websocket.WebSocketApp(
        url,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    
    # Run with SSL cert verification disabled for testing
    ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
    
    print("\nSummary:")
    print(f"Total messages received: {len(messages_received)}")
    for i, msg in enumerate(messages_received, 1):
        print(f"{i}. {msg}")

if __name__ == "__main__":
    test_remote_connection()