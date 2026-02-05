"""Chat API endpoint with context memory via history parameter."""
from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai

# Models to try (fallback list)
MODELS_TO_TRY = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
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
        # Read API Key inside handler for reliability in Vercel
        api_key = os.environ.get('GEMINI_API_KEY')
        
        if not api_key:
            self.send_json(500, {'error': 'GEMINI_API_KEY environment variable is not set in Vercel'})
            return
        
        # Configure for this specific request
        genai.configure(api_key=api_key)
        
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
            # The SDK handles these names well, but we can be explicit
            # Many 404s come from '-latest' suffix or improper paths
            
            # Convert history to Gemini format
            gemini_history = []
            for msg in history:
                role = 'user' if msg.get('role') == 'user' else 'model'
                gemini_history.append({
                    'role': role,
                    'parts': [msg.get('content', '')]
                })
            
            model = genai.GenerativeModel(
                model_name=target_model_name,
                system_instruction=system_instruction if system_instruction else None
            )
            chat = model.start_chat(history=gemini_history)
            return chat.send_message(user_message)

        # Fallback sequence
        fallbacks = [model_name, "gemini-1.5-flash", "gemini-2.0-flash"]
        # Remove duplicates
        try:
            # We use a set to keep order but remove duplicates
            seen = set()
            unique_fallbacks = [x for x in fallbacks if not (x in seen or seen.add(x))]
            
            last_error = None
            for attempt_model in unique_fallbacks:
                try:
                    response = call_gemini(attempt_model)
                    self.send_json(200, {'response': response.text})
                    return
                except Exception as e:
                    last_error = e
                    error_msg = str(e)
                    # If it's a 404 or 429, continue to next model
                    if "404" in error_msg or "429" in error_msg or "quota" in error_msg.lower():
                        continue
                    else:
                        # For other errors (like invalid prompt), stop and report
                        break
            
            # If we're here, all attempts failed
            raise last_error
            
        except Exception as e:
            final_error = str(e)
            if "API_KEY_INVALID" in final_error:
                final_error = "Invalid API Key. Check your settings."
            self.send_json(500, {'error': f"Gemini Error: {final_error}"})
