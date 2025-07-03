#!/usr/bin/env python3
"""
Test hibernation and heartbeat functionality
"""

import json
import time
import websocket
import ssl
import threading

class HibernationTest:
    def __init__(self, url):
        self.url = url
        self.ws = None
        self.running = False
        self.messages_received = []
        
    def on_message(self, ws, message):
        timestamp = time.strftime('%H:%M:%S')
        try:
            data = json.loads(message)
            msg_type = data.get('type', 'unknown')
            
            print(f"[{timestamp}] Received {msg_type}: {message}")
            self.messages_received.append((timestamp, msg_type, data))
            
            if msg_type == 'welcome':
                self.connection_id = data.get('connectionId')
                self.heartbeat_interval = data.get('heartbeatInterval', 20000) / 1000
                print(f"[INFO] Connection ID: {self.connection_id}")
                print(f"[INFO] Heartbeat interval: {self.heartbeat_interval}s")
                
        except json.JSONDecodeError:
            print(f"[{timestamp}] Raw message: {message}")
            self.messages_received.append((timestamp, 'raw', message))
            
    def on_error(self, ws, error):
        print(f"[ERROR] {error}")
        
    def on_close(self, ws, close_status_code, close_msg):
        print(f"[CLOSED] Status: {close_status_code}, Message: {close_msg}")
        self.running = False
        
    def on_open(self, ws):
        print("[CONNECTED] WebSocket hibernation test started")
        self.running = True
        
    def connect(self):
        self.ws = websocket.WebSocketApp(
            self.url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        
        if self.url.startswith("wss://"):
            self.ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
        else:
            self.ws.run_forever()
    
    def send_message(self, message_type, **kwargs):
        if self.ws and self.running:
            data = {
                "type": message_type,
                "timestamp": time.time(),
                **kwargs
            }
            self.ws.send(json.dumps(data))
            print(f"[SENT] {message_type}: {json.dumps(data)}")
    
    def close(self):
        self.running = False
        if self.ws:
            self.ws.close()

def run_hibernation_test():
    url = "wss://durable-object-websocket.stuart-benji.workers.dev/websocket"
    test = HibernationTest(url)
    
    print("=== WebSocket Hibernation Test ===")
    print(f"Testing: {url}")
    print("This test will:")
    print("1. Connect and receive welcome message")
    print("2. Send some messages")
    print("3. Wait for hibernation (no activity)")
    print("4. Send heartbeat to wake up")
    print("5. Verify connection is still alive")
    print("-" * 50)
    
    # Start connection in background thread
    connection_thread = threading.Thread(target=test.connect)
    connection_thread.daemon = True
    connection_thread.start()
    
    try:
        # Wait for connection
        time.sleep(2)
        
        if not test.running:
            print("[ERROR] Failed to connect")
            return
            
        # Send initial messages
        print("\n[TEST] Sending initial messages...")
        test.send_message("message", message="Hello, hibernation test!")
        time.sleep(1)
        test.send_message("ping")
        time.sleep(2)
        
        # Test period of inactivity (should trigger hibernation)
        print(f"\n[TEST] Waiting 30 seconds for potential hibernation...")
        print("During this time, the Durable Object should hibernate due to inactivity.")
        time.sleep(30)
        
        # Send heartbeat to wake up
        print("\n[TEST] Sending heartbeat to wake up hibernated connection...")
        test.send_message("heartbeat")
        time.sleep(2)
        
        # Send more messages to verify connection is alive
        print("\n[TEST] Sending messages after hibernation...")
        test.send_message("message", message="Post-hibernation message")
        time.sleep(1)
        test.send_message("ping")
        time.sleep(2)
        
        # Summary
        print(f"\n[SUMMARY] Test completed!")
        print(f"Total messages received: {len(test.messages_received)}")
        print("Message types received:")
        msg_types = {}
        for _, msg_type, _ in test.messages_received:
            msg_types[msg_type] = msg_types.get(msg_type, 0) + 1
        for msg_type, count in msg_types.items():
            print(f"  {msg_type}: {count}")
            
    except KeyboardInterrupt:
        print("\n[INFO] Test interrupted by user")
    finally:
        test.close()
        print("[INFO] Test completed")

if __name__ == "__main__":
    run_hibernation_test()