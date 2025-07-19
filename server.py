#!/usr/bin/env python3
"""
Simple HTTP server for testing Ryokushen Financial Tracker
Serves static files with proper MIME types for ES6 modules
"""

import http.server
import socketserver
import os
import sys
import socket
import signal

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for ES6 modules
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # Set proper MIME type for JavaScript modules
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def check_port_available(port):
    """Check if a port is available for binding"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(('', port))
        sock.close()
        return True
    except OSError:
        return False

def find_available_port(start_port, max_attempts=10):
    """Find an available port starting from start_port"""
    for i in range(max_attempts):
        port = start_port + i
        if check_port_available(port):
            return port
    return None

def kill_existing_server(port):
    """Attempt to kill existing server on the specified port"""
    try:
        # Find process using the port
        import subprocess
        result = subprocess.run(['lsof', '-ti', f':{port}'], 
                              capture_output=True, text=True)
        if result.stdout.strip():
            pid = int(result.stdout.strip())
            os.kill(pid, signal.SIGTERM)
            print(f"Killed existing server process (PID: {pid})")
            # Give it a moment to release the port
            import time
            time.sleep(1)
            return True
    except Exception as e:
        print(f"Could not kill existing process: {e}")
    return False

class ReuseAddressTCPServer(socketserver.TCPServer):
    """TCP Server with SO_REUSEADDR enabled"""
    allow_reuse_address = True

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Check if port is available
    if not check_port_available(PORT):
        print(f"Port {PORT} is already in use.")
        print("\nOptions:")
        print("1. Kill existing server and start new one")
        print("2. Find and use an alternative port")
        print("3. Exit")
        
        choice = input("\nEnter your choice (1-3): ").strip()
        
        if choice == "1":
            if kill_existing_server(PORT):
                print("Existing server killed successfully.")
            else:
                print("Failed to kill existing server. Trying alternative port...")
                choice = "2"
        
        if choice == "2":
            new_port = find_available_port(PORT + 1)
            if new_port:
                PORT = new_port
                print(f"Using alternative port: {PORT}")
            else:
                print("No available ports found. Exiting.")
                sys.exit(1)
        elif choice == "3":
            print("Exiting.")
            sys.exit(0)
    
    try:
        # Use ReuseAddressTCPServer for better handling
        with ReuseAddressTCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            print(f"\n✅ Server running at http://localhost:{PORT}/")
            print("Press Ctrl-C to stop the server")
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\n\n🛑 Server stopped.")
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        print("\nTroubleshooting tips:")
        print(f"1. Check if port {PORT} is in use: lsof -i :{PORT}")
        print(f"2. Kill the process manually: kill -9 <PID>")
        print(f"3. Try a different port by editing PORT variable in server.py")
        sys.exit(1)