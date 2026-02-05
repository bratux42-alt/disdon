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
        model_name = body.get('model', 'gemini-1.5-flash')
        system_instruction = body.get('system_instruction', '')
        
        if not user_message:
            self.send_json(400, {'error': 'No message provided'})
            return
        
        try:
            # Initialize model with name and system instruction
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system_instruction if system_instruction else None
                )
            except Exception as e:
                # Fallback to default if selected model fails
                print(f"Error initializing model {model_name}: {e}")
                model = genai.GenerativeModel('gemini-1.5-flash')
            
            # Convert history to Gemini format
            gemini_history = []
            for msg in history:
                role = 'user' if msg.get('role') == 'user' else 'model'
                gemini_history.append({
                    'role': role,
                    'parts': [msg.get('content', '')]
                })
            
            # Create chat and send message
            chat = model.start_chat(history=gemini_history)
            response = chat.send_message(user_message)
            
            self.send_json(200, {'response': response.text})
            
        except Exception as e:
            self.send_json(500, {'error': str(e)})
