#!/bin/bash

# Start Both Python Flask + Go WebSocket Servers
# Run this from the root algo directory

echo "🚀 Starting ALGO Application Stack..."
echo "======================================="
echo ""

# Check for port conflicts
echo "🔍 Checking for port conflicts..."
if lsof -ti:8080 >/dev/null 2>&1; then
    echo "❌ Port 8080 is already in use!"
    echo "🧹 Run './cleanup.sh' first to free the port"
    exit 1
fi

if lsof -ti:5000 >/dev/null 2>&1; then
    echo "❌ Port 5000 is already in use!"
    echo "🧹 Run './cleanup.sh' first to free the port"
    exit 1
fi

echo "✅ Ports 8080 and 5000 are available"
echo ""

# Function to kill all processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    if [ ! -z "$GO_PID" ]; then
        kill $GO_PID 2>/dev/null
        echo "✅ Go WebSocket server stopped"
    fi
    if [ ! -z "$PYTHON_PID" ]; then
        kill $PYTHON_PID 2>/dev/null
        echo "✅ Python Flask server stopped"
    fi
    echo "👋 All servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo "1️⃣ Starting Go WebSocket Server..."
echo "   📡 Port: 8080"
echo "   🚀 Real-time messaging, typing, presence"
echo ""

# Start Go server in background
cd app/src/go-deps
./start-sockets.sh &
GO_PID=$!
cd ../../..

# Wait a moment for Go server to start
sleep 3

echo ""
echo "2️⃣ Starting Python Flask Server..."
echo "   📡 Port: 5000"  
echo "   🐍 Web pages, API endpoints, authentication"
echo ""

# Start Python server in background
# Try python3 first, then python
cd app/src
if command -v python3 &> /dev/null; then
    python3 app.py &
    PYTHON_PID=$!
elif command -v python &> /dev/null; then
    python app.py &
    PYTHON_PID=$!
else
    echo "❌ Python not found! Please install Python 3"
    echo "📥 Ubuntu/Debian: sudo apt install python3"
    echo "📥 macOS: brew install python3"
    exit 1
fi
cd ../..

echo ""
echo "✅ Both servers are running!"
echo "======================================="
echo "🌐 Flask App:     http://localhost:5000"
echo "🔌 WebSocket:     ws://localhost:8080/ws"
echo "📊 Health Check:  http://localhost:8080/health"
echo ""
echo "💡 Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait
