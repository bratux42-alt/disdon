"""Authentication API endpoint for Supabase auth."""
from http.server import BaseHTTPRequestHandler
import json
import os
from supabase import create_client

def get_client():
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_ANON_KEY')
    if not url or not key:
        return None
    return create_client(url, key)

class handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def do_OPTIONS(self):
        self.send_json(200, {})
    
    def do_POST(self):
        client = get_client()
        if not client:
            self.send_json(500, {'error': 'Supabase not configured'})
            return
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length).decode())
            action = body.get('action')
            email = body.get('email', '')
            password = body.get('password', '')
            
            if action == 'signup':
                result = client.auth.sign_up({
                    'email': email,
                    'password': password
                })
                if result.user:
                    self.send_json(200, {
                        'user': {
                            'id': result.user.id,
                            'email': result.user.email
                        },
                        'session': {
                            'access_token': result.session.access_token if result.session else None,
                            'refresh_token': result.session.refresh_token if result.session else None
                        } if result.session else None,
                        'message': 'Check email for confirmation' if not result.session else 'Signed up successfully'
                    })
                else:
                    self.send_json(400, {'error': 'Signup failed'})
            
            elif action == 'signin':
                result = client.auth.sign_in_with_password({
                    'email': email,
                    'password': password
                })
                if result.user and result.session:
                    self.send_json(200, {
                        'user': {
                            'id': result.user.id,
                            'email': result.user.email
                        },
                        'session': {
                            'access_token': result.session.access_token,
                            'refresh_token': result.session.refresh_token
                        }
                    })
                else:
                    self.send_json(401, {'error': 'Invalid credentials'})
            
            elif action == 'refresh':
                refresh_token = body.get('refresh_token')
                if not refresh_token:
                    self.send_json(400, {'error': 'Refresh token required'})
                    return
                result = client.auth.refresh_session(refresh_token)
                if result.session:
                    self.send_json(200, {
                        'session': {
                            'access_token': result.session.access_token,
                            'refresh_token': result.session.refresh_token
                        }
                    })
                else:
                    self.send_json(401, {'error': 'Invalid refresh token'})
            
            elif action == 'signout':
                # Client-side handles token removal
                self.send_json(200, {'message': 'Signed out'})
            
            else:
                self.send_json(400, {'error': f'Unknown action: {action}'})
        
        except Exception as e:
            self.send_json(500, {'error': str(e)})
