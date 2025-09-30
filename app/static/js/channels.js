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
            // Extract message data from nested structure
            const messageData = data.data || data;
            const content = messageData.content || messageData.Content || data.content || data.Content;
            const username = messageData.username || messageData.Username || data.username || data.Username;
            const pfpPath = messageData.pfp_path || messageData.PfpPath || data.pfp_path || data.PfpPath;
            const timestamp = messageData.created_at || messageData.CreatedAt || data.created_at || data.CreatedAt || data.timestamp;
            
            console.log('🔍 Extracted message data:', { content, username, pfpPath, timestamp });
            
            const messageElement = createMessageElement(content, {
                username: username,
                pfp_path: pfpPath,
                timestamp: timestamp,
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
    
    // Handle typing indicators
    socket.on('user_typing', (data) => {
        console.log('⌨️ Received typing indicator:', data);
        console.log('🔍 Current channel:', currentChannelId, 'Message channel:', data.channel_id);
        console.log('🔍 Current user:', currentUserId, 'Message user:', data.user_id);
        
        if (data.channel_id == currentChannelId && data.user_id != currentUserId) {
            const username = data.username || data.Username || `User${data.user_id}`;
            const isTyping = data.typing || (data.data && data.data.typing);
            
            console.log('🔍 Username:', username, 'Is typing:', isTyping);
            
            if (isTyping) {
                console.log('✅ Adding typing user:', username);
                addTypingUser(username);
            } else {
                console.log('❌ Removing typing user:', username);
                removeTypingUser(username);
            }
        } else {
            console.log('⏭️ Ignoring typing - wrong channel or same user');
        }
    });
    
    // Fallback: Poll for new messages every 2 seconds as backup
    setInterval(() => {
        if (currentChannelId && !socket?.connected) {
            console.log('🔄 WebSocket disconnected, polling for new messages...');
            loadChannelMessages(currentChannelId);
        }
    }, 2000);
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
        let typingTimer;
        let isTyping = false;
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('⌨️ Enter key pressed!');
                sendMessage();
                // Stop typing when message is sent
                if (isTyping) {
                    socket.send('user_typing', {
                        channel_id: currentChannelId,
                        data: { typing: false }
                    });
                    isTyping = false;
                }
            }
        });
        
        messageInput.addEventListener('input', () => {
            if (currentChannelId && socket) {
                // Start typing indicator
                if (!isTyping) {
                    socket.send('user_typing', {
                        channel_id: currentChannelId,
                        data: { typing: true }
                    });
                    isTyping = true;
                }
                
                // Reset typing timer
                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => {
                    if (isTyping) {
                        socket.send('user_typing', {
                            channel_id: currentChannelId,
                            data: { typing: false }
                        });
                        isTyping = false;
                    }
                }, 2000); // Stop typing after 2 seconds of no input
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
    
    // Send via Go WebSocket for instant delivery (like /chat)
    console.log(`📤 Sending message to channel ${currentChannelId}:`, message);
    socket.send('send_channel_message', {
        channel_id: currentChannelId,
        content: message
    });
    
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
                    
                    // Load members when Members tab is clicked (backend still calls it 'connections')
                    if (tabName === 'members' || tabName === 'connections') {
                        console.log('🔍 Members tab clicked, loading from database...');
                        if (currentChannelId) {
                            loadChannelMembers(currentChannelId);
                        } else {
                            console.error('❌ No currentChannelId set');
                            const targetPanel = document.getElementById('connections-panel') || document.getElementById('members-panel');
                            if (targetPanel) {
                                targetPanel.innerHTML = '<div style="padding: 20px; text-align: center;">❌ No channel selected</div>';
                            }
                        }
                    }
                } else {
                    console.warn('⚠️ Panel not found for tab:', tabName);
                }
            }
        });
    });
    
    console.log('✅ Tab switching set up for', tabBtns.length, 'tabs');
}

// Load channel members from API
async function loadChannelMembers(channelId) {
    console.log(`📋 Loading members for channel ${channelId}`);
    
    // Show loading state immediately
    const membersPanel = document.getElementById('connections-panel') || document.getElementById('members-panel');
    if (membersPanel) {
        membersPanel.innerHTML = `
            <div class="loading-state" style="text-align: center; padding: 40px;">
                <div>Loading members...</div>
            </div>
        `;
    }
    
    try {
        console.log(`🌐 Fetching: /api/channels/${channelId}/members`);
        const response = await fetch(`/api/channels/${channelId}/members`);
        console.log(`📡 Response status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Members API response:', data);
            
            if (data.success && data.members && data.members.length > 0) {
                console.log(`📋 Found ${data.members.length} members in database`);
                displayMembers(data.members);
            } else {
                console.log('📋 No members found in database, API returned:', data);
                // Show empty state instead of mock data
                const membersPanel = document.getElementById('connections-panel') || document.getElementById('members-panel');
                if (membersPanel) {
                    membersPanel.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #666;">
                            <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                            <h3>No members found</h3>
                            <p>Run the SQL to add members to channel_members table:</p>
                            <code style="background: #f5f5f5; padding: 8px; border-radius: 4px; display: block; margin-top: 10px; font-size: 12px;">
                                INSERT INTO channel_members (channel_id, user_id, role) VALUES (1, 9, 'admin'), (1, 10, 'member');
                            </code>
                        </div>
                    `;
                }
            }
        } else {
            console.error('❌ Failed to load members:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            displayMembersError(`API Error: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error('❌ Error loading members:', error);
        displayMembersError(`Network Error: ${error.message}`);
    }
}

// Display mock members as fallback
function displayMockMembers() {
    const mockMembers = [
        { user_id: 9, username: 'Woeter', pfp_path: 'https://i.ibb.co/jtyZsc1/ea279cd51508.png', is_online: true },
        { user_id: 10, username: 'AJAX', pfp_path: 'https://i.ibb.co/jtyZsc1/ea279cd51508.png', is_online: true }
    ];
    console.log('📋 Showing mock members as fallback');
    displayMembers(mockMembers);
}

// Display members in the Members tab
function displayMembers(members) {
    const membersPanel = document.getElementById('connections-panel') || document.getElementById('members-panel');
    if (!membersPanel) {
        console.error('❌ Members panel not found');
        return;
    }
    
    if (!members || members.length === 0) {
        membersPanel.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <div class="empty-text">
                    <h3>No members found</h3>
                    <p>This channel doesn't have any members yet.</p>
                </div>
            </div>
        `;
        return;
    }
    
    let membersHTML = `
        <div class="members-list" style="padding: 16px;">
            <h4 style="margin-bottom: 16px; color: #333; font-size: 16px;">Members — ${members.length}</h4>
            <div class="members-grid">
    `;
    
    // Add all members without online/offline separation
    members.forEach(member => {
        // Generate auto avatar if no pfp_path or if it's empty
        let avatarUrl = member.pfp_path;
        if (!avatarUrl || avatarUrl.trim() === '') {
            const name = encodeURIComponent(`${member.firstname || ''} ${member.lastname || ''}`.trim() || member.username);
            const colors = ['6D28D9', '8B5CF6', '3B82F6', '10B981', 'F59E0B', 'EF4444', 'EC4899', '6366F1'];
            const color = colors[member.user_id % colors.length];
            avatarUrl = `https://ui-avatars.com/api/?name=${name}&background=${color}&color=fff&size=150`;
        }
        
        // Role badge
        const roleBadge = member.role === 'admin' ? 
            '<span style="background: #dc2626; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 6px;">ADMIN</span>' :
            member.role === 'moderator' ? 
            '<span style="background: #7c3aed; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 6px;">MOD</span>' : '';
        
        membersHTML += `
            <div class="member-item" style="display: flex; align-items: center; padding: 10px; margin-bottom: 8px; border-radius: 8px; background: #f9f9f9; border: 1px solid #e5e7eb;">
                <img src="${avatarUrl}" 
                     alt="${member.username}" 
                     style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px; object-fit: cover; flex-shrink: 0;"
                     onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(member.username)}&background=6B7280&color=fff&size=150'">
                <div class="member-info" style="flex: 1; min-width: 0;">
                    <div class="member-name" style="font-weight: 500; font-size: 15px; color: #333; display: flex; align-items: center;">
                        ${member.username}${roleBadge}
                    </div>
                </div>
            </div>
        `;
    });
    
    membersHTML += `
            </div>
        </div>
    `;
    
    membersPanel.innerHTML = membersHTML;
    console.log(`✅ Displayed ${members.length} members`);
}

// Display error in members tab
function displayMembersError(message) {
    const membersPanel = document.getElementById('connections-panel') || document.getElementById('members-panel');
    if (membersPanel) {
        membersPanel.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <div class="error-text">
                    <h3>Error</h3>
                    <p>${message}</p>
                </div>
            </div>
        `;
    }
}

// Typing indicator system
let typingUsers = new Set();
let typingTimeout = {};

function addTypingUser(username) {
    typingUsers.add(username);
    updateTypingIndicator();
    
    // Clear existing timeout for this user
    if (typingTimeout[username]) {
        clearTimeout(typingTimeout[username]);
    }
    
    // Auto-remove after 3 seconds
    typingTimeout[username] = setTimeout(() => {
        removeTypingUser(username);
    }, 3000);
}

function removeTypingUser(username) {
    typingUsers.delete(username);
    if (typingTimeout[username]) {
        clearTimeout(typingTimeout[username]);
        delete typingTimeout[username];
    }
    updateTypingIndicator();
}

function updateTypingIndicator() {
    const typingId = 'typing-indicator';
    let typingElement = document.getElementById(typingId);
    
    if (typingUsers.size === 0) {
        // No one typing, hide indicator
        if (typingElement) {
            typingElement.remove();
        }
        return;
    }
    
    // Create or update typing indicator
    if (!typingElement) {
        typingElement = document.createElement('div');
        typingElement.id = typingId;
        typingElement.className = 'typing-indicator';
        
        // Insert above the input box
        const inputContainer = document.querySelector('.input-container');
        if (inputContainer && inputContainer.parentNode) {
            inputContainer.parentNode.insertBefore(typingElement, inputContainer);
        }
    }
    
    // Generate typing text
    let typingText = '';
    const userArray = Array.from(typingUsers);
    
    if (userArray.length === 1) {
        typingText = `${userArray[0]} is typing`;
    } else if (userArray.length === 2) {
        typingText = `${userArray[0]} and ${userArray[1]} are typing`;
    } else if (userArray.length === 3) {
        typingText = `${userArray[0]}, ${userArray[1]}, and ${userArray[2]} are typing`;
    } else {
        typingText = `Several people are typing`;
    }
    
    typingElement.innerHTML = `
        <div class="typing-content" style="display: flex; align-items: center; padding: 8px 16px; background: #f5f5f5; border-radius: 8px; margin: 8px 0; font-size: 14px; color: #666;">
            <span class="typing-text">${typingText}</span>
            <div class="typing-dots" style="margin-left: 8px; display: flex; gap: 2px;">
                <span style="width: 4px; height: 4px; background: #666; border-radius: 50%; animation: typing-bounce 1.4s infinite ease-in-out; animation-delay: 0s;"></span>
                <span style="width: 4px; height: 4px; background: #666; border-radius: 50%; animation: typing-bounce 1.4s infinite ease-in-out; animation-delay: 0.2s;"></span>
                <span style="width: 4px; height: 4px; background: #666; border-radius: 50%; animation: typing-bounce 1.4s infinite ease-in-out; animation-delay: 0.4s;"></span>
            </div>
        </div>
        <style>
            @keyframes typing-bounce {
                0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
                40% { transform: scale(1); opacity: 1; }
            }
        </style>
    `;
}

// Online status management for channels
let onlineUsers = new Set();

async function fetchOnlineStatus() {
    try {
        const response = await fetch('/api/online_status');
        if (response.ok) {
            const data = await response.json();
            onlineUsers.clear();
            data.online_users.forEach(userId => onlineUsers.add(userId));
            console.log('📊 Online users updated:', Array.from(onlineUsers));
            
            // Update any displayed members if Members tab is active
            const membersPanel = document.getElementById('connections-panel') || document.getElementById('members-panel');
            if (membersPanel && membersPanel.innerHTML.includes('member-item')) {
                // Refresh members display with updated online status
                const currentTab = document.querySelector('.tab-btn.active');
                if (currentTab && (currentTab.getAttribute('data-tab') === 'members' || currentTab.getAttribute('data-tab') === 'connections')) {
                    if (currentChannelId) {
                        loadChannelMembers(currentChannelId);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error fetching online status:', error);
    }
}

function initializeOnlineStatus() {
    // Fetch online status immediately
    fetchOnlineStatus();
    
    // Update every 30 seconds
    setInterval(fetchOnlineStatus, 30000);
}

// Initialize online status tracking when page loads
initializeOnlineStatus();

console.log('✅ Channels script loaded successfully!');
