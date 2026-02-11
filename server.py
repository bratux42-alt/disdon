from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context
import google.generativeai as genai
import os

app = Flask(__name__, static_folder='.')

# Configure Gemini API from environment variable (set in Vercel dashboard)
API_KEY = os.environ.get('GEMINI_API_KEY')
if not API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is not set")
genai.configure(api_key=API_KEY)

# Try different models in order of preference
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
            # Quick test
            response = model.generate_content("test")
            print(f"✓ Using model: {model_name}")
            return model
        except Exception as e:
            print(f"✗ Model {model_name} not available: {e}")
            continue
    return None

# Initialize model on startup
model = None

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('.', filename)

@app.route('/api/chat', methods=['POST'])
def chat():
    global model
    
    data = request.json
    user_message = data.get('message', '')
    history = data.get('history', [])
    
    if not user_message:
        return jsonify({'error': 'No message provided'}), 400
    
    # Initialize model if not done yet
    if model is None:
        model = get_working_model()
        if model is None:
            return jsonify({'error': 'No available Gemini models found for this API key'}), 500
    
    try:
        # Convert history to Gemini format
        gemini_history = []
        for msg in history:
            role = 'user' if msg['role'] == 'user' else 'model'
            gemini_history.append({'role': role, 'parts': [msg['content']]})

        # Start chat session with history
        chat_session = model.start_chat(history=gemini_history)
        
        def generate():
            response = chat_session.send_message(user_message, stream=True)
            for chunk in response:
                if chunk.text:
                    yield chunk.text

        return Response(stream_with_context(generate()), mimetype='text/plain')

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/models', methods=['GET'])
def list_models():
    """List all available models for debugging."""
    try:
        models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                models.append(m.name)
        return jsonify({'models': models})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Gemini AI Server...")
    print("📍 Open http://localhost:5000 in your browser")
    app = Flask(__name__)
