"""Chats CRUD API endpoint."""
from http.server import BaseHTTPRequestHandler
import json
import os
from supabase import create_client

def get_client():
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
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
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
    
    def do_GET(self):
        """Get all chats for authenticated user."""
        token = self.get_auth_token()
        if not token:
            self.send_json(401, {'error': 'Unauthorized'})
            return
        
        user_id = get_user_from_token(token)
        if not user_id:
            self.send_json(401, {'error': 'Invalid token'})
            return
        
        client = get_client()
        if not client:
            self.send_json(500, {'error': 'Database not configured'})
            return
        
        try:
            result = client.table('chats').select('*').eq('user_id', user_id).order('updated_at', desc=True).execute()
            self.send_json(200, {'chats': result.data})
        except Exception as e:
            self.send_json(500, {'error': str(e)})
    
    def do_POST(self):
        """Create a new chat."""
        token = self.get_auth_token()
        if not token:
            self.send_json(401, {'error': 'Unauthorized'})
            return
        
        user_id = get_user_from_token(token)
        if not user_id:
            self.send_json(401, {'error': 'Invalid token'})
            return
        
        client = get_client()
        if not client:
            self.send_json(500, {'error': 'Database not configured'})
            return
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length).decode()) if content_length > 0 else {}
            title = body.get('title', 'Новый чат')
            
            result = client.table('chats').insert({
                'user_id': user_id,
                'title': title
            }).execute()
            
            if result.data:
                self.send_json(201, {'chat': result.data[0]})
            else:
                self.send_json(500, {'error': 'Failed to create chat'})
        except Exception as e:
            self.send_json(500, {'error': str(e)})
    
    def do_DELETE(self):
        """Delete a chat."""
        token = self.get_auth_token()
        if not token:
            self.send_json(401, {'error': 'Unauthorized'})
            return
        
        user_id = get_user_from_token(token)
        if not user_id:
            self.send_json(401, {'error': 'Invalid token'})
            return
        
        client = get_client()
        if not client:
            self.send_json(500, {'error': 'Database not configured'})
            return
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length).decode())
            chat_id = body.get('chat_id')
            
            if not chat_id:
                self.send_json(400, {'error': 'chat_id required'})
                return
            
            # Verify ownership
            check = client.table('chats').select('id').eq('id', chat_id).eq('user_id', user_id).execute()
            if not check.data:
                self.send_json(404, {'error': 'Chat not found'})
                return
            
            client.table('chats').delete().eq('id', chat_id).execute()
            self.send_json(200, {'message': 'Chat deleted'})
        except Exception as e:
            self.send_json(500, {'error': str(e)})
