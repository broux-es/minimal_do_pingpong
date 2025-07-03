#!/usr/bin/env python3
"""
Quick test of the hibernation client
"""

import time
import subprocess
import signal
import sys

def test_client():
    print("Testing hibernation client with automatic input...")
    
    # Create a test script that sends commands to the client
    test_input = "Hello hibernation!\nping\nAnother message\nquit\n"
    
    try:
        # Run the client with input
        process = subprocess.Popen(
            ["python", "websocket_client.py"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        
        # Send input and get output
        output, _ = process.communicate(input=test_input, timeout=30)
        
        print("Client output:")
        print("-" * 40)
        print(output)
        print("-" * 40)
        
        return_code = process.returncode
        print(f"Process finished with return code: {return_code}")
        
    except subprocess.TimeoutExpired:
        print("Test timed out")
        process.kill()
    except Exception as e:
        print(f"Error running test: {e}")

if __name__ == "__main__":
    test_client()