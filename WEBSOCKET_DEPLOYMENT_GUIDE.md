# WebSocket Server Deployment Guide

## Problem Diagnosis

The WebSocket connection is failing because the **Go WebSocket server is not deployed** or not accessible. You have two separate services that need to be deployed:

1. **Python Flask App** (Main web application) - ✅ Currently deployed at `alumnigo.onrender.com`
2. **Go WebSocket Server** (Real-time chat) - ❌ **NOT DEPLOYED** 

## Solution Options

### Option 1: Deploy Go Server Separately (Recommended)

Deploy the Go WebSocket server as a separate Render service:

1. **Create new Render service** for Go WebSocket server:
   - Use the config in `app/src/go-deps/render.yaml`
   - Service name: `algo-websocket-server`
   - Expected URL: `algo-websocket-server.onrender.com`

2. **Deploy steps**:
   ```bash
   # In Render dashboard:
   # 1. Create new Web Service
   # 2. Connect to your GitHub repo
   # 3. Set root directory to: app/src/go-deps
   # 4. Set build command: go build -o ../websocket-server ../sockets.go
   # 5. Set start command: cd .. && ./websocket-server
   # 6. Set environment variables:
   #    - PORT: 8080
   #    - DATABASE_URL: (link to your existing database)
   ```

### Option 2: Integrate Go Server with Flask App

Modify the main deployment to include both Python and Go servers:

1. **Update Dockerfile** to build and run both services
2. **Use nginx** to proxy WebSocket requests to Go server
3. **Update render.yaml** to handle both services

### Option 3: Fallback to Socket.IO (Quick Fix)

If you need immediate functionality:

1. **Install Socket.IO** in your Flask app:
   ```bash
   pip install flask-socketio
   ```

2. **Add Socket.IO server** to your Flask app
3. **Update client** to use Socket.IO instead of Go WebSocket

## Current Client Improvements

The WebSocket client has been updated with:

- ✅ **Multiple connection attempts** with fallback URLs
- ✅ **Better error handling** with user-friendly messages  
- ✅ **Connection timeout** (5 seconds per attempt)
- ✅ **Visual error notifications** when connection fails
- ✅ **Automatic retry logic** with exponential backoff

## Testing Connection

Test if Go server is accessible:

```bash
# Test health endpoint
curl https://algo-websocket-server.onrender.com/health

# Test WebSocket connection (if server is running)
wscat -c wss://algo-websocket-server.onrender.com/ws?user_id=1&username=test
```

## Recommended Action

**Deploy the Go WebSocket server separately** using the existing `app/src/go-deps/render.yaml` configuration. This will provide the best performance for real-time chat features.

The client will automatically detect and connect to the Go server once it's deployed.
