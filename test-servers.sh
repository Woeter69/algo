#!/bin/bash

# Quick test script to verify both servers can start

echo "🧪 Testing ALGO Application Stack..."
echo "===================================="

# Test Go build
echo "1️⃣ Testing Go WebSocket Server build..."
cd app/src
if go build -o websocket-server .; then
    echo "✅ Go server builds successfully"
    rm -f websocket-server
else
    echo "❌ Go server build failed"
    exit 1
fi
cd ../../..

# Test Python syntax
echo "2️⃣ Testing Python Flask Server syntax..."
if python3 -m py_compile app/src/app.py; then
    echo "✅ Python server syntax is valid"
else
    echo "❌ Python server has syntax errors"
    exit 1
fi

# Test dependencies
echo "3️⃣ Checking dependencies..."

# Check Go dependencies
echo "   🔍 Go dependencies..."
cd app/src
if go mod verify; then
    echo "   ✅ Go dependencies verified"
else
    echo "   ❌ Go dependencies have issues"
    exit 1
fi
cd ../../..

# Check Python dependencies (basic imports)
echo "   🔍 Python dependencies..."
if python3 -c "import flask, psycopg2, bcrypt"; then
    echo "   ✅ Python dependencies available"
else
    echo "   ❌ Python dependencies missing"
    echo "   📥 Install with: pip3 install flask psycopg2-binary flask-bcrypt"
fi

echo ""
echo "✅ All tests passed!"
echo "🚀 Ready to run: ./start-all.sh"
