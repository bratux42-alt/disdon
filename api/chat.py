from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai

# Configure Gemini API from environment variable
API_KEY = os.environ.get('GEMINI_API_KEY')
if API_KEY:
    genai.configure(api_key=API_KEY)

# Models to try
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
            response = model.generate_content("test")
            return model
        except Exception:
            continue
    return None

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if not API_KEY:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'GEMINI_API_KEY not configured'}).encode())
            return
        
        # Read request body
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        user_message = data.get('message', '')
        
        if not user_message:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'No message provided'}).encode())
            return
        
        try:
            model = get_working_model()
            if model is None:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No available Gemini models'}).encode())
                return
            
            response = model.generate_content(user_message)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'response': response.text}).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
