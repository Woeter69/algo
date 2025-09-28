// Go WebSocket Client - Replaces Socket.IO
// This connects to our high-performance Go WebSocket server
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
class GoWebSocketClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.eventHandlers = {};
        this.currentChannelId = null;
        this.userId = null;
        this.username = null;
        this.pfpPath = null;
    }
    // Initialize connection with user data
    connect(userId, username, pfpPath = '') {
        this.userId = userId;
        this.username = username;
        this.pfpPath = pfpPath;
        // Connect directly to WebSocket - faster startup
        this.startWebSocketConnection(userId, username, pfpPath);
    }
    startWebSocketConnection(userId, username, pfpPath) {
        // Try multiple WebSocket URLs in order of preference
        const wsUrls = this.getWebSocketUrls(userId, username, pfpPath);
        this.tryConnectWithFallback(wsUrls, 0);
    }
    getWebSocketUrls(userId, username, pfpPath) {
        const params = `user_id=${userId}&username=${encodeURIComponent(username)}&pfp_path=${encodeURIComponent(pfpPath)}`;
        const urls = [];
        if (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.startsWith('192.168.') ||
            window.location.hostname.startsWith('172.')) {
            // Local development - Go server on port 8080
            const host = window.location.hostname;
            urls.push(`ws://${host}:8080/ws?${params}`);
        } else {
            // Production - Using Dockerfile with nginx proxy
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // 1. Primary: Same domain with /ws endpoint (nginx proxies to Go server)
            urls.push(`${protocol}//${window.location.host}/ws?${params}`);
        }
        return urls;
    }
    tryConnectWithFallback(urls, index) {
        if (index >= urls.length) {
            console.error('❌ All WebSocket connection attempts failed');
            this.showConnectionError();
            return;
        }
        const wsUrl = urls[index];
        console.log(`🚀 Attempting connection ${index + 1}/${urls.length}`);
        console.log('📡 URL:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
            if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                console.log('⏰ Connection timeout, trying next URL...');
                this.ws.close();
                this.tryConnectWithFallback(urls, index + 1);
            }
        }, 5000); // 5 second timeout
        this.ws.onopen = (event) => {
            clearTimeout(connectionTimeout);
            console.log(`✅ Connected to Go WebSocket server! (URL: ${wsUrl})`);
            console.log('⚡ Go server is much faster than Socket.IO');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.hideConnectionError();
            this.emit('connect', event);
        };
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('📨 Received message:', message);
                this.handleMessage(message);
            }
            catch (error) {
                console.error('❌ Failed to parse message:', error);
            }
        };
        this.ws.onclose = (event) => {
            console.log('❌ WebSocket connection closed');
            this.connected = false;
            this.emit('disconnect', event);
            this.attemptReconnect();
        };
        this.ws.onerror = (error) => {
            clearTimeout(connectionTimeout);
            console.error(`❌ WebSocket error for ${wsUrl}:`, error);
            this.emit('error', error);
            // Try next URL after a short delay
            setTimeout(() => {
                this.tryConnectWithFallback(urls, index + 1);
            }, 1000);
        };
    }
    // Handle incoming messages from Go server
    handleMessage(message) {
        const { type } = message, data = __rest(message, ["type"]);
        switch (type) {
            case 'new_message':
                this.emit('new_message', data);
                break;
            case 'user_typing':
                this.emit('user_typing', data);
                break;
            case 'user_joined':
                this.emit('user_joined', data);
                break;
            case 'user_left':
                this.emit('user_left', data);
                break;
            case 'user_online':
                this.emit('user_online', data);
                break;
            case 'user_offline':
                this.emit('user_offline', data);
                break;
            default:
                console.log('📨 Unknown message type:', type, data);
        }
    }
    // Send message to Go server
    send(type, data = {}) {
        if (!this.connected || !this.ws) {
            console.error('❌ WebSocket not connected');
            return false;
        }
        const message = Object.assign({ type: type, user_id: this.userId, username: this.username, timestamp: new Date().toISOString() }, data);
        try {
            this.ws.send(JSON.stringify(message));
            console.log('📤 Sent message:', message);
            return true;
        }
        catch (error) {
            console.error('❌ Failed to send message:', error);
            return false;
        }
    }
    // Join a channel (like Socket.IO rooms)
    joinChannel(channelId) {
        this.currentChannelId = channelId;
        return this.send('join_channel', { channel_id: channelId });
    }
    leaveChannel(channelId) {
        return this.send('leave_channel', { channel_id: channelId });
    }
    // Send a chat message
    sendMessage(content, channelId, messageId = null) {
        return this.send('send_message', {
            channel_id: channelId,
            content: content,
            message_id: messageId,
            created_at: new Date().toISOString(),
            message_type: 'text'
        });
    }
    // Send typing start
    startTyping(channelId) {
        return this.send('user_typing', {
            channel_id: channelId,
            data: { typing: true }
        });
    }
    // Send typing stop
    stopTyping(channelId) {
        return this.send('user_typing', {
            channel_id: channelId,
            data: { typing: false }
        });
    }
    // Event listener system (like Socket.IO)
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }
    // Emit event to handlers
    emit(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(data);
                }
                catch (error) {
                    console.error(`❌ Error in ${event} handler:`, error);
                }
            });
        }
    }
    // Attempt to reconnect
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            return;
        }
        this.reconnectAttempts++;
        console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        setTimeout(() => {
            if (!this.connected) {
                this.connect(this.userId, this.username, this.pfpPath);
            }
        }, this.reconnectDelay * this.reconnectAttempts);
    }
    // Disconnect
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }
    // Check if connected
    isConnected() {
        return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    // Show connection error to user
    showConnectionError() {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'websocket-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 400px;
        `;
        errorDiv.innerHTML = `
            <strong>⚠️ Connection Failed</strong><br>
            Unable to connect to chat server. Some features may not work properly.<br>
            <small>Trying to reconnect...</small>
        `;
        // Remove existing error if present
        this.hideConnectionError();
        document.body.appendChild(errorDiv);
    }
    // Hide connection error
    hideConnectionError() {
        const existingError = document.getElementById('websocket-error');
        if (existingError) {
            existingError.remove();
        }
    }
}
// Create global instance (replaces Socket.IO)
window.goSocket = new GoWebSocketClient();
// Compatibility layer for existing Socket.IO code
window.io = function () {
    return window.goSocket;
};
console.log('🔥 Go WebSocket Client loaded!');
console.log('⚡ This is much faster than Socket.IO');
console.log('🚀 Ready to connect to Go server');
