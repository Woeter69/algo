import os
import sys

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from algo import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True").lower() in ['true', '1', 't']
    
    # Note: The Go server for WebSockets runs on port 8080
    print("🐍 Starting Python Flask Server...")
    print(f"   - Running in {'DEBUG' if debug else 'PRODUCTION'} mode.")
    print(f"   - Listening on http://0.0.0.0:{port}")
    print("   - Real-time features (chat, presence) handled by the Go WebSocket server on port 8080.")
    
    app.run(host="0.0.0.0", port=port, debug=debug)
