"""Chat API endpoint with context memory via history parameter."""
from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai

# Configure Gemini API
API_KEY = os.environ.get('GEMINI_API_KEY')
if API_KEY:
    genai.configure(api_key=API_KEY)

MODELS_TO_TRY = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-flash-latest',
]

def get_working_model():
    """Find the first available model."""
    for model_name in MODELS_TO_TRY:
        try:
            model = genai.GenerativeModel(model_name)
            model.generate_content("test")
            return model
        except Exception:
            continue
    return None

class handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
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
            model = get_working_model()
            if model is None:
                self.send_json(500, {'error': 'No available Gemini models'})
                return
            
            # Convert history to Gemini format
            gemini_history = []
            for msg in history:
                role = msg.get('role', 'user')
                # Gemini uses 'user' and 'model' roles
                if role == 'assistant':
                    role = 'model'
                gemini_history.append({
                    'role': role,
                    'parts': [msg.get('content', '')]
                })
            
            # Create chat with history for context
            if gemini_history:
                chat = model.start_chat(history=gemini_history)
                response = chat.send_message(user_message)
            else:
                response = model.generate_content(user_message)
            
            self.send_json(200, {'response': response.text})
            
        except Exception as e:
            self.send_json(500, {'error': str(e)})
