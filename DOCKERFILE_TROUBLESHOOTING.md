# Dockerfile WebSocket Troubleshooting Guide

## Your Setup ✅

You have an excellent **integrated deployment** using Docker with:

- **🐍 Python Flask** (port 5000) - Main web application
- **🚀 Go WebSocket Server** (port 8080) - Real-time chat  
- **🔀 Nginx Proxy** (port 10000) - Routes traffic between services
- **👥 Supervisor** - Manages all processes in one container

## WebSocket URL Fix Applied ✅

Updated the client to connect to: `wss://alumnigo.onrender.com/ws`
- Nginx will proxy `/ws` requests to your Go server on port 8080
- No need for separate subdomain deployments

## Troubleshooting Steps

### 1. Check if Go Server is Running

```bash
# Check Render logs for supervisor output
# Look for these log entries:
# ✅ "Starting Go WebSocket server..."
# ✅ "WebSocket server starting on port 8080"
```

### 2. Test Individual Components

```bash
# Test Flask app (should work)
curl https://alumnigo.onrender.com/

# Test Go server health (through nginx proxy)
curl https://alumnigo.onrender.com/health

# Test WebSocket endpoint
wscat -c wss://alumnigo.onrender.com/ws?user_id=1&username=test
```

### 3. Common Issues & Solutions

#### Issue: Go server not starting
**Symptoms:** WebSocket connections fail, `/health` returns 502
**Solution:** Check environment variables in Render dashboard:
```
DATABASE_URL=postgresql://user:pass@host:port/db
PORT=10000
```

#### Issue: Build failures
**Symptoms:** Deployment fails during Docker build
**Solution:** Verify Go dependencies:
```bash
# Locally test Go build
cd app/src/go-deps
go mod tidy
go build -o websocket-server ../sockets.go
```

#### Issue: Nginx proxy errors
**Symptoms:** 502 Bad Gateway on `/ws` requests
**Solution:** Check if Go server is listening on port 8080:
```bash
# In container logs, look for:
# "WebSocket server starting on port 8080"
```

### 4. Environment Variables Check

Ensure these are set in Render dashboard:
```
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
PORT=10000
```

### 5. Debug Commands

Add these to your Go server for debugging:
```go
log.Printf("🌐 Server starting on port %s", port)
log.Printf("🗄️ Database URL: %s", dbURL[:20]+"...")
```

## Expected Behavior

When working correctly:
1. **Container starts** → Supervisor launches all 3 services
2. **Go server** → Listens on localhost:8080
3. **Flask app** → Listens on localhost:5000  
4. **Nginx** → Listens on 0.0.0.0:10000, proxies requests
5. **WebSocket client** → Connects to `wss://alumnigo.onrender.com/ws`

## Quick Test

Use the test file I created:
```bash
# Open in browser:
open test-websocket.html
# Should show: ✅ SUCCESS for wss://alumnigo.onrender.com/ws
```

Your Dockerfile setup is actually ideal - everything runs in one container with proper service management!
