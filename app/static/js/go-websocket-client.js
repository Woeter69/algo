// Go WebSocket Client - Replaces Socket.IO
// This connects to our high-performance Go WebSocket server

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

        // Determine WebSocket URL based on environment
        let wsUrl;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Local development
            wsUrl = `ws://localhost:8080/ws?user_id=${userId}&username=${encodeURIComponent(username)}&pfp_path=${encodeURIComponent(pfpPath)}`;
        } else {
            // Production on Render - replace with your actual Render WebSocket service URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//algo-websocket.onrender.com/ws?user_id=${userId}&username=${encodeURIComponent(username)}&pfp_path=${encodeURIComponent(pfpPath)}`;
        }
        
        console.log('🚀 Connecting to Go WebSocket server...');
        console.log('📡 URL:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = (event) => {
            console.log('✅ Connected to Go WebSocket server!');
            console.log('⚡ Go server is much faster than Socket.IO');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.emit('connect', event);
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('📨 Received message:', message);
                this.handleMessage(message);
            } catch (error) {
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
            console.error('❌ WebSocket error:', error);
            this.emit('error', error);
        };
    }

    // Handle incoming messages from Go server
    handleMessage(message) {
        const { type, ...data } = message;
        
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

        const message = {
            type: type,
            user_id: this.userId,
            username: this.username,
            timestamp: new Date().toISOString(),
            ...data
        };

        try {
            this.ws.send(JSON.stringify(message));
            console.log('📤 Sent message:', message);
            return true;
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            return false;
        }
    }

    // Join a channel (like Socket.IO rooms)
    joinChannel(channelId) {
        this.currentChannelId = channelId;
        return this.send('join_channel', { channel_id: channelId });
    }

    // Leave a channel
    leaveChannel(channelId) {
        return this.send('leave_channel', { channel_id: channelId });
    }

    // Send a chat message
    sendMessage(channelId, content, messageId = null) {
        return this.send('send_message', {
            channel_id: channelId,
            content: content,
            message_id: messageId,
            created_at: new Date().toISOString(),
            pfp_path: this.pfpPath,
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
                } catch (error) {
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
}

// Create global instance (replaces Socket.IO)
window.goSocket = new GoWebSocketClient();

// Compatibility layer for existing Socket.IO code
window.io = function() {
    return {
        on: (event, handler) => window.goSocket.on(event, handler),
        emit: (event, data) => {
            switch (event) {
                case 'join_channel':
                    return window.goSocket.joinChannel(data.channel_id);
                case 'leave_channel':
                    return window.goSocket.leaveChannel(data.channel_id);
                case 'send_message':
                    return window.goSocket.sendMessage(data.channel_id, data.message.content, data.message.message_id);
                case 'typing_start':
                    return window.goSocket.startTyping(data.channel_id);
                case 'typing_stop':
                    return window.goSocket.stopTyping(data.channel_id);
                default:
                    return window.goSocket.send(event, data);
            }
        },
        connected: window.goSocket.isConnected()
    };
};

console.log('🔥 Go WebSocket Client loaded!');
console.log('⚡ This is much faster than Socket.IO');
console.log('🚀 Ready to connect to Go server');
