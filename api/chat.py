"""Chat API endpoint with context memory via Supabase."""
from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
from supabase import create_client

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

def get_supabase():
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')
    if not url or not key:
        return None
    return create_client(url, key)

def get_user_from_token(token: str):
    """Verify token and get user ID."""
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_ANON_KEY')
    if not url or not key:
        return None
    client = create_client(url, key)
    try:
        user = client.auth.get_user(token)
        return user.user.id if user and user.user else None
    except:
        return None

class handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def get_auth_token(self):
        auth = self.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            return auth[7:]
        return None
    
    def do_OPTIONS(self):
        self.send_json(200, {})
    
    def do_POST(self):
        if not API_KEY:
            self.send_json(500, {'error': 'GEMINI_API_KEY not configured'})
            return
        
        # Get auth token (optional for backward compatibility)
        token = self.get_auth_token()
        user_id = get_user_from_token(token) if token else None
        
        # Read request
        content_length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(content_length).decode())
        user_message = body.get('message', '')
        chat_id = body.get('chat_id')
        
        if not user_message:
            self.send_json(400, {'error': 'No message provided'})
            return
        
        supabase = get_supabase()
        history = []
        
        # Load chat history if authenticated and chat_id provided
        if supabase and user_id and chat_id:
            try:
                # Verify chat ownership
                chat = supabase.table('chats').select('id').eq('id', chat_id).eq('user_id', user_id).execute()
                if chat.data:
                    # Load message history
                    messages = supabase.table('messages').select('role, content').eq('chat_id', chat_id).order('created_at').execute()
                    history = [{'role': m['role'], 'parts': [m['content']]} for m in messages.data]
            except Exception as e:
                print(f"Error loading history: {e}")
        
        try:
            model = get_working_model()
            if model is None:
                self.send_json(500, {'error': 'No available Gemini models'})
                return
            
            # Create chat with history for context
            if history:
                chat = model.start_chat(history=history)
                response = chat.send_message(user_message)
            else:
                response = model.generate_content(user_message)
            
            ai_response = response.text
            
            # Save messages if authenticated
            if supabase and user_id and chat_id:
                try:
                    # Save user message
                    supabase.table('messages').insert({
                        'chat_id': chat_id,
                        'role': 'user',
                        'content': user_message
                    }).execute()
                    
                    # Save AI response
                    supabase.table('messages').insert({
                        'chat_id': chat_id,
                        'role': 'model',
                        'content': ai_response
                    }).execute()
                    
                    # Update chat title if first message
                    if len(history) == 0:
                        # Generate short title from first message
                        title = user_message[:50] + ('...' if len(user_message) > 50 else '')
                        supabase.table('chats').update({
                            'title': title,
                            'updated_at': 'now()'
                        }).eq('id', chat_id).execute()
                    else:
                        # Just update timestamp
                        supabase.table('chats').update({
                            'updated_at': 'now()'
                        }).eq('id', chat_id).execute()
                except Exception as e:
                    print(f"Error saving messages: {e}")
            
            self.send_json(200, {'response': ai_response})
            
        except Exception as e:
            self.send_json(500, {'error': str(e)})
