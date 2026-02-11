"""Chat API endpoint with context memory via history parameter."""
from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai

# Configure Gemini API
API_KEY = os.environ.get('GEMINI_API_KEY')
if API_KEY:
    genai.configure(api_key=API_KEY)

class handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def send_text(self, status: int, text: str):
        self.send_response(status)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(text.encode('utf-8'))
    
    def do_OPTIONS(self):
        self.send_json(200, {})
    
    def do_POST(self):
        if not API_KEY:
            self.send_json(500, {'error': 'GEMINI_API_KEY not configured'})
            return
        
        # Read request
        content_length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(content_length).decode())
        user_message = body.get('message', '')
        history = body.get('history', [])
        
        if not user_message:
            self.send_json(400, {'error': 'No message provided'})
            return
        
        try:
            # Try gemini-2.0-flash first, fallback to flash-lite if quota exceeded
            models_to_try = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']
            
            # Convert history to Gemini format
            gemini_history = []
            for msg in history:
                role = 'user' if msg.get('role') == 'user' else 'model'
                gemini_history.append({
                    'role': role,
                    'parts': [msg.get('content', '')]
                })
            
            last_error = None
            for model_name in models_to_try:
                try:
                    model = genai.GenerativeModel(model_name)
                    chat = model.start_chat(history=gemini_history)
                    response = chat.send_message(user_message)
                    self.send_text(200, response.text)
                    return
                except Exception as e:
                    last_error = e
                    if "429" in str(e) or "quota" in str(e).lower():
                        continue  # Try next model
                    else:
                        break  # Other error, stop trying
            
            raise last_error
            
        except Exception as e:
            self.send_json(500, {'error': str(e)})
