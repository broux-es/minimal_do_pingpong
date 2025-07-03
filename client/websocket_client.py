#!/usr/bin/env python3
"""
Simple WebSocket client to test the Cloudflare Durable Object WebSocket server.
"""

import json
import time
import threading
from datetime import datetime
import websocket
import ssl


class WebSocketClient:
    def __init__(self, url):
        self.url = url
        self.ws = None
        self.running = False
        self.heartbeat_interval = 20  # Default 20 seconds
        self.heartbeat_thread = None
        self.connection_id = None
        self.last_pong = time.time()
        
    def on_message(self, ws, message):
        """Handle incoming messages"""
        try:
            data = json.loads(message)
            message_type = data.get('type', 'unknown')
            
            if message_type == 'welcome':
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Connected:")
                print(f"  Message: {data['message']}")
                print(f"  Connection ID: {data['connectionId']}")
                print(f"  Heartbeat Interval: {data.get('heartbeatInterval', 20000)}ms")
                
                # Store connection details
                self.connection_id = data['connectionId']
                self.heartbeat_interval = data.get('heartbeatInterval', 20000) / 1000  # Convert to seconds
                
                # Start heartbeat
                self.start_heartbeat()
                
            elif message_type == 'pong':
                self.last_pong = time.time()
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Pong received:")
                print(f"  Connection ID: {data.get('connectionId')}")
                print(f"  Timestamp: {data.get('timestamp')}")
                
            elif message_type == 'heartbeat_ack':
                self.last_pong = time.time()
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Heartbeat acknowledged")
                
            elif message_type == 'echo':
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Echo received:")
                print(f"  Message: {data['message']}")
                print(f"  Timestamp: {data['timestamp']}")
                print(f"  Active connections: {data['connections']}")
                print(f"  Connection ID: {data.get('connectionId')}")
                
            else:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Received:")
                print(f"  Type: {message_type}")
                print(f"  Data: {data}")
                
        except json.JSONDecodeError:
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Received (raw): {message}")
    
    def on_error(self, ws, error):
        """Handle errors"""
        print(f"\n[ERROR] {error}")
    
    def on_close(self, ws, close_status_code, close_msg):
        """Handle connection close"""
        print(f"\n[CLOSED] Status: {close_status_code}, Message: {close_msg}")
        self.running = False
        self.stop_heartbeat()
    
    def on_open(self, ws):
        """Handle connection open"""
        print("[CONNECTED] WebSocket connection established")
        print("Type 'quit' to exit, 'ping' to send ping, or enter any message to send")
        self.running = True
        
        # Start input thread
        input_thread = threading.Thread(target=self.handle_input)
        input_thread.daemon = True
        input_thread.start()
    
    def handle_input(self):
        """Handle user input in a separate thread"""
        while self.running:
            try:
                message = input("\n> ")
                if message.lower() == 'quit':
                    self.close()
                    break
                elif message.lower() == 'ping':
                    self.send_ping()
                elif message:
                    self.send_message(message)
            except EOFError:
                self.close()
                break
    
    def send_message(self, message):
        """Send a message to the server"""
        if self.ws and self.ws.sock and self.ws.sock.connected:
            # Send as JSON with message field
            msg_data = {
                "type": "message",
                "message": message,
                "timestamp": datetime.now().isoformat()
            }
            self.ws.send(json.dumps(msg_data))
            print(f"[SENT] {message}")
        else:
            print("[ERROR] WebSocket is not connected")
    
    def send_ping(self):
        """Send a ping to the server"""
        if self.ws and self.ws.sock and self.ws.sock.connected:
            ping_data = {
                "type": "ping",
                "timestamp": datetime.now().isoformat()
            }
            self.ws.send(json.dumps(ping_data))
            print(f"[PING] Sent ping")
        else:
            print("[ERROR] WebSocket is not connected")
    
    def send_heartbeat(self):
        """Send a heartbeat to the server"""
        if self.ws and self.ws.sock and self.ws.sock.connected:
            heartbeat_data = {
                "type": "heartbeat",
                "timestamp": datetime.now().isoformat()
            }
            self.ws.send(json.dumps(heartbeat_data))
            print(f"[HEARTBEAT] Sent at {datetime.now().strftime('%H:%M:%S')}")
        else:
            print("[ERROR] Cannot send heartbeat - WebSocket not connected")
            
    def start_heartbeat(self):
        """Start the heartbeat thread"""
        if self.heartbeat_thread and self.heartbeat_thread.is_alive():
            return
            
        def heartbeat_worker():
            while self.running:
                time.sleep(self.heartbeat_interval)
                if self.running:
                    self.send_heartbeat()
                    
                    # Check if we haven't received a response in too long
                    if time.time() - self.last_pong > self.heartbeat_interval * 3:
                        print(f"[WARNING] No response from server for {self.heartbeat_interval * 3} seconds")
        
        self.heartbeat_thread = threading.Thread(target=heartbeat_worker)
        self.heartbeat_thread.daemon = True
        self.heartbeat_thread.start()
        print(f"[HEARTBEAT] Started with {self.heartbeat_interval}s interval")
    
    def stop_heartbeat(self):
        """Stop the heartbeat thread"""
        if self.heartbeat_thread:
            print("[HEARTBEAT] Stopped")
            # Thread will stop when self.running becomes False
    
    def connect(self):
        """Connect to the WebSocket server"""
        print(f"Connecting to {self.url}...")
        
        # Enable debug output
        # websocket.enableTrace(True)
        
        self.ws = websocket.WebSocketApp(
            self.url,
            on_open=self.on_open,
            on_message=self.on_message,
            on_error=self.on_error,
            on_close=self.on_close
        )
        
        # Run forever with automatic reconnection
        # For production with SSL
        if self.url.startswith("wss://"):
            # Use unverified SSL for testing (not recommended for production)
            self.ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
        else:
            self.ws.run_forever()
    
    def close(self):
        """Close the WebSocket connection"""
        self.running = False
        self.stop_heartbeat()
        if self.ws:
            self.ws.close()


def main():
    """Main function"""
    # Production URL - change to localhost:8788 for local development
    url = "wss://durable-object-websocket.stuart-benji.workers.dev/websocket"
    
    # For local development, uncomment:
    # url = "ws://localhost:8788/websocket"
    
    print("=== Cloudflare Durable Object WebSocket Client ===")
    print(f"Connecting to: {url}")
    print("-" * 50)
    
    client = WebSocketClient(url)
    
    try:
        client.connect()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        client.close()
    except Exception as e:
        print(f"\n[ERROR] {e}")
    
    print("\nGoodbye!")


if __name__ == "__main__":
    main()