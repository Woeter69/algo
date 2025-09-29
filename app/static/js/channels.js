// Channels WebSocket Integration (TypeScript version based on working chat.js pattern)
// Global variables
let currentUserId = null;
let currentUsername = 'User';
let currentUserPfp = '';
let currentChannelId = null;
let processedMessages = new Set();
let lastSentMessageTime = 0;

// Initialize Go WebSocket connection (same as chat.js)
let socket = window.goSocket;
// DOM elements
let channels;
let currentChannelName;
let currentChannelIcon;
let messageInput;
let chatMessages;
let sendBtn;
// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Channels TypeScript initializing - DOM ready');
    // Get user data from template
    const channelsData = window.channelsData || {};
    currentUserId = window.currentUserId;
    currentUsername = window.currentUsername || 'User';
    currentUserPfp = window.currentUserPfp || '';
    console.log('User data:', { currentUserId, currentUsername });
    if (!currentUserId) {
        console.error('No current user ID - user might not be logged in');
        return;
    }
    // Get DOM elements
    channels = document.querySelectorAll('.channel');
    currentChannelName = document.querySelector('.current-channel-name');
    currentChannelIcon = document.querySelector('.current-channel-icon');
    messageInput = document.getElementById('messageInput');
    chatMessages = document.getElementById('chatMessages');
    sendBtn = document.getElementById('sendBtn');
    // Initialize Go WebSocket connection (same pattern as chat.js)
    socket = window.goSocket;
    if (socket && currentUserId) {
        console.log('🔌 Connecting to Go WebSocket server...');
        console.log('🔍 Connection details:', {
            userId: currentUserId,
            username: currentUsername,
            pfp: currentUserPfp,
            socketExists: !!socket
        });
        
        // Connect to Go WebSocket server (same as chat.js)
        socket.connect(currentUserId.toString(), currentUsername, currentUserPfp);
        
        // WebSocket event handlers (using chat.js pattern)
        socket.on('connect', () => {
            console.log('✅ Connected to Go WebSocket server!');
            // Auto-select first channel after connection with longer delay to ensure connection is stable
            setTimeout(() => {
                const firstChannel = document.querySelector('.channel');
                if (firstChannel && !currentChannelId) {
                    console.log('🎯 Auto-selecting first channel after connection confirmed');
                    firstChannel.click();
                }
            }, 1000); // Increased delay to ensure connection is fully established
        });
        socket.on('disconnect', () => {
            console.log('❌ Disconnected from WebSocket server');
        });
        socket.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });
        // Handle incoming channel messages (using chat.js deduplication pattern)
        socket.on('new_message', (data) => {
            console.log('📨 Received channel message:', data);
            const messageKey = `${data.user_id}-${data.channel_id}-${data.content}-${data.message_id || Date.now()}`;
            if (processedMessages.has(messageKey)) {
                console.log('🔄 Duplicate message detected, ignoring');
                return;
            }
            processedMessages.add(messageKey);
            // Only show messages for current channel
            if (data.channel_id == currentChannelId) {
                const isSent = data.user_id === currentUserId;
                // Prevent showing our own sent messages twice (optimistic UI already showed it)
                if (isSent && (Date.now() - lastSentMessageTime < 3000)) {
                    console.log('🚫 Skipping own recent message to prevent duplicate');
                    return;
                }
                displayChannelMessage(data);
            }
        });
        // Handle user join/leave events
        socket.on('user_joined', (data) => {
            if (data.channel_id == currentChannelId) {
                console.log('👋 User joined channel:', data);
                showUserJoinedMessage(data);
            }
        });
        socket.on('user_left', (data) => {
            if (data.channel_id == currentChannelId) {
                console.log('👋 User left channel:', data);
                showUserLeftMessage(data);
            }
        });
        // Handle typing indicators
        socket.on('user_typing', (data) => {
            if (data.channel_id == currentChannelId && data.user_id !== currentUserId) {
                showTypingIndicator(data.username);
            }
        });
        // Handle message history response
        socket.on('messages_history', (data) => {
            console.log('📋 Received message history:', data);
            displayMessageHistory(data);
        });
    } else {
        console.error('❌ Cannot connect to WebSocket:', {
            socketExists: !!socket,
            currentUserId: currentUserId,
            reason: !socket ? 'No socket object' : 'No user ID'
        });
    }
    
    // Channel switching
    channels.forEach(channel => {
        channel.addEventListener('click', () => {
            var _a, _b;
            channels.forEach(c => c.classList.remove('active'));
            channel.classList.add('active');
            const channelName = ((_a = channel.querySelector('.channel-name')) === null || _a === void 0 ? void 0 : _a.textContent) || '';
            const channelIcon = ((_b = channel.querySelector('.channel-icon i')) === null || _b === void 0 ? void 0 : _b.className) || '';
            const channelId = channel.getAttribute('data-channel-id') || channelName;
            // Update UI
            if (currentChannelName)
                currentChannelName.textContent = channelName;
            if (currentChannelIcon)
                currentChannelIcon.innerHTML = `<i class="${channelIcon}"></i>`;
            if (messageInput)
                messageInput.placeholder = `Message #${channelName}`;
            // Leave previous channel and join new one
            if (currentChannelId && socket) {
                socket.leaveChannel(currentChannelId);
            }
            currentChannelId = channelId;
            if (socket) {
                console.log(`🚪 Joining channel: ${channelId}`);
                socket.joinChannel(channelId);
            }
            // Clear messages and load channel history
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="loading-messages">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Loading messages...</span>
                    </div>
                `;
                // Request message history from Go server with retry logic
                const requestMessages = () => {
                    if (socket && socket.isConnected()) {
                        console.log(`📋 Requesting message history for channel ${channelId}`);
                        console.log(`🔍 Socket connection status:`, {
                            connected: socket.isConnected(),
                            socketExists: !!socket
                        });
                        const success = socket.send('get_channel_messages', { channel_id: channelId });
                        console.log(`📤 Message send result:`, success);
                    }
                    else {
                        console.log('⏳ WebSocket not ready, retrying in 500ms...');
                        setTimeout(requestMessages, 500);
                    }
                };
                requestMessages();
                // Set a timeout to show welcome message if no response
                setTimeout(() => {
                    if (chatMessages && chatMessages.innerHTML.includes('Loading messages...')) {
                        console.log('⏰ No response from WebSocket, showing welcome message');
                        chatMessages.innerHTML = `
                                <div class="welcome-message">
                                    <div class="welcome-icon">
                                        <i class="fas fa-comments"></i>
                                    </div>
                                    <div class="welcome-text">
                                        <h3>Welcome to the channel!</h3>
                                        <p>WebSocket timeout - messages should load here. Try refreshing.</p>
                                    </div>
                                </div>
                            `;
                    }
                }, 5000);
            }
            else {
                console.error('❌ Socket not connected or not available:', {
                    socketExists: !!socket,
                    connected: socket ? socket.isConnected() : false
                });
                // Show error message
                if (chatMessages) {
                    chatMessages.innerHTML = `
                            <div class="welcome-message">
                                <div class="welcome-icon">
                                    <i class="fas fa-exclamation-triangle"></i>
                                </div>
                                <div class="welcome-text">
                                    <h3>Connection Issue</h3>
                                    <p>WebSocket not connected. Please refresh the page.</p>
                                </div>
                            </div>
                        `;
                }
            }
        });
    });
});
// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        if (tabName) {
            const panel = document.getElementById(`${tabName}-panel`);
            if (panel)
                panel.classList.add('active');
        }
    });
});
// Message sending (using chat.js pattern)
function sendMessage() {
    if (!messageInput || !socket)
        return;
    const message = messageInput.value.trim();
    if (!message || !currentChannelId)
        return;
    lastSentMessageTime = Date.now();
    // Clear input immediately for better UX
    messageInput.value = '';
    // Create optimistic message element (show immediately on left side)
    const messageElement = createMessageElement(message, {
        username: currentUsername,
        pfp_path: currentUserPfp,
        timestamp: new Date().toISOString(),
        optimistic: true
    });
    if (chatMessages) {
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    // Send message via WebSocket (using send_message type for channels)
    console.log(`📤 Sending message to channel ${currentChannelId}:`, message);
    socket.send('send_message', {
        channel_id: currentChannelId,
        content: message
    });
}
// Event listeners for sending messages
if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
}
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    // Typing indicators
    let typingTimer = null;
    messageInput.addEventListener('input', () => {
        if (socket && currentChannelId) {
            socket.startTyping(currentChannelId);
            if (typingTimer)
                clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                if (socket && currentChannelId) {
                    socket.stopTyping(currentChannelId);
                }
            }, 1000);
        }
    });
}
;
// Helper functions
function createMessageElement(content, options) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message received'; // All messages on left side
    const time = options.timestamp ?
        new Date(options.timestamp).toLocaleTimeString() :
        'Now';
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${options.pfp_path ?
        `<img src="${options.pfp_path}" alt="${options.username}">` :
        (options.username ? options.username[0] : 'U')}
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${options.username || 'Unknown User'}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${content}</div>
        </div>
    `;
    return messageDiv;
}
function displayChannelMessage(data) {
    if (!chatMessages)
        return;
    const messageElement = createMessageElement(data.content, {
        username: data.username,
        pfp_path: data.pfp_path,
        timestamp: data.created_at || data.timestamp
    });
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function showUserJoinedMessage(data) {
    if (!chatMessages)
        return;
    const systemMsg = document.createElement('div');
    systemMsg.className = 'system-message';
    systemMsg.innerHTML = `<span>👋 ${data.username} joined the channel</span>`;
    chatMessages.appendChild(systemMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function showUserLeftMessage(data) {
    if (!chatMessages)
        return;
    const systemMsg = document.createElement('div');
    systemMsg.className = 'system-message';
    systemMsg.innerHTML = `<span>👋 ${data.username} left the channel</span>`;
    chatMessages.appendChild(systemMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
function showTypingIndicator(username) {
    if (!chatMessages)
        return;
    // Remove existing typing indicators
    const existingIndicator = chatMessages.querySelector('.typing-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `<span>${username} is typing...</span>`;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    // Remove after 3 seconds
    setTimeout(() => {
        if (typingDiv.parentNode) {
            typingDiv.remove();
        }
    }, 3000);
}
function displayMessageHistory(data) {
    var _a, _b;
    if (!chatMessages)
        return;
    console.log('📋 Displaying message history:', data);
    // Clear loading indicator
    chatMessages.innerHTML = '';
    // Get messages from the data (Go server sends it in data field)
    const messages = ((_a = data.data) === null || _a === void 0 ? void 0 : _a.messages) || ((_b = data.Data) === null || _b === void 0 ? void 0 : _b.messages) || data.messages || [];
    console.log('📋 Messages extracted:', messages);
    if (messages.length === 0) {
        // Show welcome message for empty channels
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <div class="welcome-text">
                    <h3>Welcome to the channel!</h3>
                    <p>This is the beginning of your conversation. Say hello!</p>
                </div>
            </div>
        `;
        return;
    }
    // Display messages
    messages.forEach((message) => {
        const messageElement = createMessageElement(message.content || message.Content, {
            username: message.username || message.Username,
            pfp_path: message.pfp_path || message.PfpPath,
            timestamp: message.created_at || message.CreatedAt
        });
        chatMessages.appendChild(messageElement);
    });
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    console.log(`✅ Displayed ${messages.length} messages`);
}
console.log('✅ Channels TypeScript loaded successfully!');
