#!/usr/bin/env python3
"""
Server management script for Ryokushen Financial Tracker
Provides easy commands to start, stop, restart, and check server status
"""

import os
import sys
import subprocess
import signal
import time
import socket

PORT = 8080
SERVER_SCRIPT = "server.py"

def get_server_pid(port):
    """Get PID of process using the specified port"""
    try:
        result = subprocess.run(['lsof', '-ti', f':{port}'], 
                              capture_output=True, text=True)
        if result.stdout.strip():
            return int(result.stdout.strip())
    except Exception:
        pass
    return None

def is_server_running(port):
    """Check if server is running on the specified port"""
    return get_server_pid(port) is not None

def start_server():
    """Start the development server"""
    if is_server_running(PORT):
        print(f"❌ Server is already running on port {PORT}")
        print("Use './manage_server.py restart' to restart it")
        return False
    
    print(f"Starting server on port {PORT}...")
    subprocess.Popen([sys.executable, SERVER_SCRIPT])
    time.sleep(2)  # Give server time to start
    
    if is_server_running(PORT):
        print(f"✅ Server started successfully at http://localhost:{PORT}/")
        return True
    else:
        print("❌ Failed to start server")
        return False

def stop_server():
    """Stop the development server"""
    pid = get_server_pid(PORT)
    if not pid:
        print("❌ No server is running")
        return False
    
    try:
        os.kill(pid, signal.SIGTERM)
        print(f"✅ Server stopped (PID: {pid})")
        time.sleep(1)  # Give it time to shutdown
        return True
    except Exception as e:
        print(f"❌ Failed to stop server: {e}")
        return False

def restart_server():
    """Restart the development server"""
    print("Restarting server...")
    if is_server_running(PORT):
        stop_server()
    start_server()

def status_server():
    """Check server status"""
    pid = get_server_pid(PORT)
    if pid:
        print(f"✅ Server is running (PID: {pid})")
        print(f"   URL: http://localhost:{PORT}/")
    else:
        print("❌ Server is not running")

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: ./manage_server.py [start|stop|restart|status]")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    if command == "start":
        start_server()
    elif command == "stop":
        stop_server()
    elif command == "restart":
        restart_server()
    elif command == "status":
        status_server()
    else:
        print(f"Unknown command: {command}")
        print("Available commands: start, stop, restart, status")
        sys.exit(1)

if __name__ == "__main__":
    main()