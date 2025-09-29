// Global variables
let socket = null;
let currentUserId = null;
let currentUsername = 'User';
let currentUserPfp = '';
let currentChannelId = null;
let processedMessages = new Set();
let lastSentMessageTime = 0;

// DOM elements
let channels;
let currentChannelName;
let currentChannelIcon;
let messageInput;
let chatMessages;
let sendBtn;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Channels initializing - DOM ready');
    
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
    
    console.log('🔍 DOM elements found:', {
        channels: channels.length,
        messageInput: !!messageInput,
        chatMessages: !!chatMessages,
        sendBtn: !!sendBtn
    });
    
    // Initialize Go WebSocket connection (same as chat.js)
    console.log('Initializing Go WebSocket connection...');
    socket = window.goSocket;
    socket.connect(currentUserId.toString(), currentUsername, currentUserPfp);
    
    // WebSocket event handlers
    socket.on('connect', () => {
        console.log('✅ Connected to Go WebSocket server!');
        
        // Set up all functionality after connection
        setupEventListeners();
        setupChannelSwitching();
        setupTabSwitching();
        
        // Auto-select first channel
        setTimeout(() => {
            const firstChannel = document.querySelector('.channel');
            if (firstChannel && !currentChannelId) {
                console.log('🎯 Auto-selecting first channel');
                firstChannel.click();
            }
        }, 1000);
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Disconnected from WebSocket server');
    });
    
    // Handle incoming messages
    socket.on('new_message', (data) => {
        console.log('📨 Received channel message:', data);
        
        // Only show messages for current channel
        if (data.channel_id == currentChannelId) {
            const messageElement = createMessageElement(data.content || data.Content, {
                username: data.username || data.Username,
                pfp_path: data.pfp_path || data.PfpPath,
                timestamp: data.created_at || data.CreatedAt || data.timestamp,
                optimistic: false
            });
            
            if (chatMessages) {
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    });
    
    // Handle message history
    socket.on('messages_history', (data) => {
        console.log('📋 Received message history:', data);
        displayMessageHistory(data);
    });
});

// Set up event listeners
function setupEventListeners() {
    console.log('🔍 Setting up event listeners');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            console.log('🖱️ Send button clicked!');
            sendMessage();
        });
        console.log('✅ Send button event listener attached');
    } else {
        console.error('❌ Send button not found!');
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('⌨️ Enter key pressed!');
                sendMessage();
            }
        });
        console.log('✅ Message input event listener attached');
    } else {
        console.error('❌ Message input not found!');
    }
}

// Set up channel switching
function setupChannelSwitching() {
    console.log('🔍 Setting up channel switching, channels:', channels.length);
    
    if (channels && channels.length > 0) {
        channels.forEach(channel => {
            channel.addEventListener('click', () => {
                console.log('📍 Channel clicked');
                
                // Remove active class from all channels
                channels.forEach(c => c.classList.remove('active'));
                channel.classList.add('active');
                
                // Get channel info
                const channelName = channel.querySelector('.channel-name')?.textContent || '';
                const channelIcon = channel.querySelector('.channel-icon i')?.className || '';
                const channelId = channel.getAttribute('data-channel-id') || channelName;
                
                console.log('🔄 Switching to channel:', { channelId, channelName });
                
                // Update UI
                if (currentChannelName) currentChannelName.textContent = channelName;
                if (currentChannelIcon) currentChannelIcon.className = channelIcon;
                
                // Leave current channel and join new one
                if (currentChannelId && socket) {
                    socket.leaveChannel(currentChannelId);
                }
                
                currentChannelId = channelId;
                
                if (socket) {
                    console.log(`🚪 Joining channel: ${channelId}`);
                    socket.joinChannel(channelId);
                    
                    // Load message history via Python API (working approach)
                    console.log(`📋 Loading messages for channel: ${channelId}`);
                    loadChannelMessages(channelId);
                }
            });
        });
        console.log('✅ Channel switching set up for', channels.length, 'channels');
    } else {
        console.warn('⚠️ No channels found in DOM');
    }
}

// Load channel messages via Python API (reliable approach)
async function loadChannelMessages(channelId) {
    try {
        console.log(`📡 Fetching messages from Python API: /api/channels/${channelId}/messages`);
        const response = await fetch(`/api/channels/${channelId}/messages`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📋 Received messages from Python:', data);
            
            // Display the messages
            displayMessageHistory({ messages: data.messages || [] });
        } else {
            console.error('❌ Failed to load messages:', response.status);
            displayMessageHistory({ messages: [] });
        }
    } catch (error) {
        console.error('❌ Error loading messages:', error);
        displayMessageHistory({ messages: [] });
    }
}

// Send message function
function sendMessage() {
    console.log('📤 sendMessage() called!');
    console.log('🔍 Send conditions:', {
        messageInput: !!messageInput,
        socket: !!socket,
        socketConnected: socket?.connected,
        currentChannelId: currentChannelId
    });
    
    if (!messageInput || !socket) {
        console.error('❌ Missing messageInput or socket');
        return;
    }
    
    const message = messageInput.value.trim();
    console.log('📝 Message content:', message);
    
    if (!message || !currentChannelId) {
        console.error('❌ Empty message or no channel selected');
        return;
    }
    
    // Clear input immediately
    messageInput.value = '';
    
    // Create optimistic message element (show immediately)
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
    
    // Send via Python API (which will trigger Go WebSocket broadcast)
    console.log(`📤 Sending message to channel ${currentChannelId}:`, message);
    sendMessageToPython(currentChannelId, message);
    
    lastSentMessageTime = Date.now();
}

// Send message via Python API (which triggers Go WebSocket broadcast)
async function sendMessageToPython(channelId, content) {
    try {
        console.log(`📡 Sending to Python API: /api/channels/${channelId}/messages`);
        const response = await fetch(`/api/channels/${channelId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: content,
                message_type: 'text'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Message sent via Python API:', data);
            // Real-time broadcast will be handled by Go WebSocket via Python trigger
        } else {
            console.error('❌ Failed to send message via Python API:', response.status);
        }
    } catch (error) {
        console.error('❌ Error sending message to Python API:', error);
    }
}

// Create message element
function createMessageElement(content, options) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message received'; // All messages on left side
    
    const time = options.timestamp ? 
        new Date(options.timestamp).toLocaleTimeString() : 
        'Now';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${options.pfp_path ? 
                `<img src="${options.pfp_path}" alt="${options.username}" class="avatar">` : 
                `<div class="avatar-placeholder">${options.username?.charAt(0) || 'U'}</div>`
            }
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${options.username || 'User'}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${content}</div>
        </div>
    `;
    
    return messageDiv;
}

// Display message history
function displayMessageHistory(data) {
    if (!chatMessages) return;
    
    console.log('📋 Displaying message history:', data);
    
    // Clear existing messages
    chatMessages.innerHTML = '';
    
    const messages = data.messages || [];
    
    if (messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <div class="welcome-text">
                    <h3>Welcome to the channel!</h3>
                    <p>Start the conversation by sending a message.</p>
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

// Set up tab switching (Messages/Members)
function setupTabSwitching() {
    console.log('🔍 Setting up tab switching');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    console.log('📋 Found tabs:', {
        tabBtns: tabBtns.length,
        tabPanels: tabPanels.length
    });
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            console.log('📍 Tab clicked:', tabName);
            
            // Remove active class from all tabs and panels
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked tab
            btn.classList.add('active');
            
            // Show corresponding panel
            if (tabName) {
                const panel = document.getElementById(`${tabName}-panel`);
                if (panel) {
                    panel.classList.add('active');
                    console.log('✅ Switched to tab:', tabName);
                } else {
                    console.warn('⚠️ Panel not found for tab:', tabName);
                }
            }
        });
    });
    
    console.log('✅ Tab switching set up for', tabBtns.length, 'tabs');
}

console.log('✅ Channels script loaded successfully!');
