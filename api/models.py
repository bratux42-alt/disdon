"""API endpoint to list available Gemini models."""
from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai

class handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def do_GET(self):
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            self.send_json(500, {'error': 'GEMINI_API_KEY not configured'})
            return
        
        try:
            genai.configure(api_key=api_key)
            models = []
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    models.append({
                        'name': m.name.replace('models/', ''),
                        'full_name': m.name,
                        'display_name': m.display_name,
                        'description': m.description
                    })
            self.send_json(200, {'models': models})
        except Exception as e:
            self.send_json(500, {'error': str(e)})
