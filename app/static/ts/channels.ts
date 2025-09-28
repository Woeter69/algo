// @ts-nocheck
// Get user data from template
const channelsData: any = (window as any).channelsData || {};
const currentUserId: number = (window as any).currentUserId;
const currentUsername: string = (window as any).currentUsername || 'User';
const currentUserPfp: string = (window as any).currentUserPfp || '';

console.log('🚀 Channels initializing with user:', { currentUserId, currentUsername });

// Initialize Go WebSocket connection
const socket: any = (window as any).goSocket;
if (socket && currentUserId) {
    console.log('🔌 Connecting to Go WebSocket server...');
    socket.connect(currentUserId.toString(), currentUsername, currentUserPfp);
}

// Channel switching
const channels = document.querySelectorAll('.channel');
const currentChannelName = document.querySelector('.current-channel-name');
const currentChannelIcon = document.querySelector('.current-channel-icon');
const messageInput = document.getElementById('messageInput');

// Current active channel
let currentChannelId: string | null = null;

channels.forEach(channel => {
    channel.addEventListener('click', () => {
        channels.forEach(c => c.classList.remove('active'));
        channel.classList.add('active');

        const channelName = channel.querySelector('.channel-name').textContent;
        const channelIcon = channel.querySelector('.channel-icon i').className;
        const channelId = channel.getAttribute('data-channel-id') || channelName;

        // Update UI
        currentChannelName.textContent = channelName;
        currentChannelIcon.innerHTML = `<i class="${channelIcon}"></i>`;
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
        
        // Load channel messages (you can implement this)
        loadChannelMessages(channelId);
    });
});

// Mobile Navigation
const hamburger = document.querySelector<HTMLElement>('.hamburger');
const navLinks = document.querySelector<HTMLElement>('.nav-links');

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');

        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`${tabName}-panel`).classList.add('active');
    });
});

// Message sending
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');

function sendMessage() {
    const input = document.getElementById('messageInput') as HTMLInputElement;
    const message = input.value.trim();

    if (message && currentChannelId) {
        // Create optimistic message element (show immediately)
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message sent';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${currentUserPfp ? `<img src="${currentUserPfp}" alt="${currentUsername}">` : currentUsername[0]}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${currentUsername}</span>
                    <span class="message-time">Now</span>
                </div>
                <div class="message-text">${message}</div>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        input.value = '';
        
        // Send message through WebSocket
        if (socket) {
            console.log(`📤 Sending message to channel ${currentChannelId}:`, message);
            socket.sendMessage(message, currentChannelId);
        }
    } else if (!currentChannelId) {
        console.warn('⚠️ No channel selected');
    }
}

sendBtn?.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// WebSocket event handlers
if (socket) {
    socket.on('connect', () => {
        console.log('✅ Connected to Go WebSocket server!');
        // Join the first channel by default
        const firstChannel = document.querySelector('.channel');
        if (firstChannel) {
            firstChannel.click();
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Disconnected from WebSocket server');
    });
    
    socket.on('error', (error: any) => {
        console.error('❌ WebSocket error:', error);
    });
    
    // Handle incoming channel messages
    socket.on('new_message', (data: any) => {
        console.log('📨 Received channel message:', data);
        displayChannelMessage(data);
    });
    
    // Handle user join/leave events
    socket.on('user_joined', (data: any) => {
        console.log('👋 User joined channel:', data);
        showUserJoinedMessage(data);
    });
    
    socket.on('user_left', (data: any) => {
        console.log('👋 User left channel:', data);
        showUserLeftMessage(data);
    });
    
    // Handle typing indicators
    socket.on('user_typing', (data: any) => {
        if (data.channel_id === currentChannelId) {
            showTypingIndicator(data.username);
        }
    });
}

// Display incoming channel message
function displayChannelMessage(data: any) {
    if (data.channel_id !== currentChannelId) return; // Only show messages for current channel
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message received';
    messageDiv.innerHTML = `
        <div class="message-avatar">
            ${data.pfp_path ? `<img src="${data.pfp_path}" alt="${data.username}">` : data.username[0]}
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${data.username}</span>
                <span class="message-time">${new Date(data.created_at || Date.now()).toLocaleTimeString()}</span>
            </div>
            <div class="message-text">${data.content}</div>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show user joined message
function showUserJoinedMessage(data: any) {
    if (data.channel_id !== currentChannelId) return;
    
    const systemMsg = document.createElement('div');
    systemMsg.className = 'system-message';
    systemMsg.innerHTML = `<span>👋 ${data.username} joined the channel</span>`;
    chatMessages.appendChild(systemMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show user left message
function showUserLeftMessage(data: any) {
    if (data.channel_id !== currentChannelId) return;
    
    const systemMsg = document.createElement('div');
    systemMsg.className = 'system-message';
    systemMsg.innerHTML = `<span>👋 ${data.username} left the channel</span>`;
    chatMessages.appendChild(systemMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator(username: string) {
    // Remove existing typing indicators
    const existingIndicator = document.querySelector('.typing-indicator');
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

// Load channel messages (placeholder - implement based on your backend)
function loadChannelMessages(channelId: string) {
    console.log(`📋 Loading messages for channel: ${channelId}`);
    // Clear current messages
    chatMessages.innerHTML = '';
    // You can implement API call to load channel history here
}

// Typing indicator for current user
let typingTimer: NodeJS.Timeout | null = null;
messageInput?.addEventListener('input', () => {
    if (socket && currentChannelId) {
        socket.startTyping(currentChannelId);
        
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            socket.stopTyping(currentChannelId);
        }, 1000);
    }
});

// Initialize chat messages scroll position
chatMessages.scrollTop = chatMessages.scrollHeight;

console.log('✅ Channels WebSocket integration complete!');
