import os
from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        result = {
            "status": "ok",
            "has_mongo": bool(os.environ.get("MONGO_URL")),
            "has_db": bool(os.environ.get("DB_NAME")),
            "python": "works"
        }
        self.wfile.write(json.dumps(result).encode())
