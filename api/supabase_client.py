"""Supabase client initialization for Vercel serverless functions."""
import os
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Get Supabase client with service key for backend operations."""
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    
    return create_client(url, key)

def get_supabase_anon_client() -> Client:
    """Get Supabase client with anon key for user-scoped operations."""
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_ANON_KEY')
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
    
    return create_client(url, key)

def verify_token(token: str) -> dict | None:
    """Verify JWT token and return user data."""
    try:
        client = get_supabase_anon_client()
        user = client.auth.get_user(token)
        return user.user if user else None
    except Exception:
        return None
