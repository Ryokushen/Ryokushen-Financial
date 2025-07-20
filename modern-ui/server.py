#!/usr/bin/env python3
"""
Simple HTTP server for testing the Modern UI
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # Add proper MIME types
        if self.path.endswith('.js'):
            self.send_header('Content-Type', 'application/javascript')
        elif self.path.endswith('.mjs'):
            self.send_header('Content-Type', 'application/javascript')
        elif self.path.endswith('.css'):
            self.send_header('Content-Type', 'text/css')
        elif self.path.endswith('.html'):
            self.send_header('Content-Type', 'text/html')
            
        super().end_headers()
    
    def do_GET(self):
        # Parse URL
        parsed_path = urlparse(self.path)
        
        # Serve index.html for root path
        if parsed_path.path == '/':
            self.path = '/index.html'
        
        # Call parent method
        return super().do_GET()
    
    def log_message(self, format, *args):
        # Custom log format
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

def run_server():
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Create server
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"\n🚀 Modern UI Server running at: http://localhost:{PORT}\n")
        print("Press Ctrl+C to stop the server\n")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n✋ Server stopped")
            sys.exit(0)

if __name__ == "__main__":
    run_server()