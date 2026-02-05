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
        
        def call_gemini(target_model_name):
            # Ensure model name starts with 'models/' if not already
            full_model_name = target_model_name if target_model_name.startswith('models/') else f"models/{target_model_name}"
            
            # Convert history to Gemini format
            gemini_history = []
            for msg in history:
                role = 'user' if msg.get('role') == 'user' else 'model'
                gemini_history.append({
                    'role': role,
                    'parts': [msg.get('content', '')]
                })
            
            model = genai.GenerativeModel(
                model_name=full_model_name,
                system_instruction=system_instruction if system_instruction else None
            )
            chat = model.start_chat(history=gemini_history)
            return chat.send_message(user_message)

        try:
            try:
                # Try the selected model
                response = call_gemini(model_name)
            except Exception as e:
                error_msg = str(e)
                # If 404 (Not Found) or 429 (Quota), try 1.5-flash-latest
                if ("404" in error_msg or "429" in error_msg or "quota" in error_msg.lower()) and "1.5-flash" not in model_name:
                    print(f"Error {error_msg} with {model_name}, trying fallback gemini-1.5-flash-latest")
                    response = call_gemini("gemini-1.5-flash-latest")
                else:
                    # Final attempt with standard 1.5-flash if everything else fails
                    if "1.5-flash" in model_name:
                         # If even 1.5-flash is failing, we might have a serious issue
                         raise e
                    print(f"Last resort fallback to gemini-1.5-flash")
                    response = call_gemini("gemini-1.5-flash")
            
            self.send_json(200, {'response': response.text})
            
        except Exception as e:
            self.send_json(500, {'error': f"Gemini Error: {str(e)}"})
