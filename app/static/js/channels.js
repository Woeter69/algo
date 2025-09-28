// Global variables
let currentChannelId = null;
let socket = null;
let currentCommunityId = null;
let channelsData = window.channelsData || {};

// Simple notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10001;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white; padding: 1rem 1.5rem; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex;
        align-items: center; gap: 0.5rem; font-weight: 500;
        max-width: 400px; transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize Go WebSocket connection (replaces Socket.IO)
function initializeSocket() {
    // Get user data
    const userId = window.currentUserId;
    const username = window.currentUsername || 'User';
    const pfpPath = window.currentUserPfp || '';
    
    if (!userId) {
        console.error('❌ No user ID found - user not logged in');
        return;
    }
    
    console.log('🚀 Initializing Go WebSocket connection...');
    console.log('👤 User:', username, 'ID:', userId);
    
    // Connect to Go WebSocket server
    window.goSocket.connect(userId, username, pfpPath);
    
    // Set up event handlers (same as Socket.IO)
    window.goSocket.on('connect', function() {
        console.log('✅ Connected to Go WebSocket server!');
        console.log('⚡ Go server is much faster than Socket.IO');
        
        // Update socket reference for compatibility with Socket.IO API
        socket = window.io();
    });
    
    window.goSocket.on('new_message', function(data) {
        console.log('📨 New message received:', data);
        if (data.channel_id == currentChannelId) {
            addMessageToChat(data);
        }
    });
    
    window.goSocket.on('user_joined', function(data) {
        console.log('👋 User joined:', data);
    });
    
    window.goSocket.on('user_left', function(data) {
        console.log('👋 User left:', data);
    });
    
    window.goSocket.on('user_joined_channel', function(data) {
        console.log('👥 User joined channel:', data);
        // You can show a notification that someone joined
    });
    
    window.goSocket.on('user_left_channel', function(data) {
        console.log('👥 User left channel:', data);
    });
    
    window.goSocket.on('user_typing', function(data) {
        console.log('⌨️ User typing:', data);
        if (data.channel_id == currentChannelId) {
            showTypingIndicator(data);
        }
    });
    
    window.goSocket.on('user_online', function(data) {
        console.log('🟢 User online:', data);
        // Update user status in UI
    });
    
    window.goSocket.on('user_offline', function(data) {
        console.log('🔴 User offline:', data);
        // Update user status in UI
    });
    
    window.goSocket.on('error', function(error) {
        console.error('❌ WebSocket error:', error);
        alert('Chat connection error. Please refresh the page.');
    });
    
    window.goSocket.on('disconnect', function() {
        console.log('❌ Disconnected from Go WebSocket server');
        // The client will automatically try to reconnect
    });
    
    // Set socket reference for compatibility with existing code
    socket = window.io();
}

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeSocket();
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // Remove active class from all buttons and panels
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            // Add active class to clicked button and corresponding panel
            this.classList.add('active');
            const targetPanel = document.getElementById(targetTab + '-panel');
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

    // Channel switching functionality
    const channels = document.querySelectorAll('.channel');
    channels.forEach(channel => {
        channel.addEventListener('click', function() {
            // Remove active class from all channels
            channels.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked channel
            this.classList.add('active');
            
            // Get channel info
            const channelId = this.getAttribute('data-channel-id');
            const channelName = this.querySelector('.channel-name').textContent;
            const channelIcon = this.querySelector('.channel-icon i').className;
            
            // Update current channel
            currentChannelId = channelId;
            
            // Update UI
            const currentChannelNameEl = document.getElementById('currentChannelName');
            const currentChannelIconEl = document.querySelector('.current-channel-icon i');
            const messageInputEl = document.getElementById('messageInput');
            
            if (currentChannelNameEl) {
                currentChannelNameEl.textContent = '# ' + channelName;
            }
            if (currentChannelIconEl) {
                currentChannelIconEl.className = channelIcon;
            }
            if (messageInputEl) {
                messageInputEl.placeholder = 'Message # ' + channelName;
            }
            
            // Load messages for this channel
            if (channelId) {
                loadChannelMessages(channelId);
                
                // Join channel room for real-time updates
                if (socket) {
                    socket.emit('join_channel', {channel_id: channelId});
                }
            }
        });
    });

    // Initialize with data from backend
    if (channelsData.selectedCommunityId) {
        currentCommunityId = channelsData.selectedCommunityId;
    }
    
    // Initialize with first channel if available
    const firstChannel = document.querySelector('.channel.active');
    if (firstChannel) {
        currentChannelId = firstChannel.getAttribute('data-channel-id');
        if (currentChannelId) {
            loadChannelMessages(currentChannelId);
            if (socket) {
                socket.emit('join_channel', {channel_id: currentChannelId});
            }
        }
    } else if (channelsData.channels && channelsData.channels.length > 0) {
        // If no active channel but we have channels, activate the first one
        const firstChannelData = channelsData.channels[0];
        currentChannelId = firstChannelData[0]; // channel_id is first element
        
        // Update UI
        const firstChannelElement = document.querySelector(`[data-channel-id="${currentChannelId}"]`);
        if (firstChannelElement) {
            firstChannelElement.classList.add('active');
            
            const channelName = firstChannelData[1]; // name is second element
            const currentChannelNameEl = document.getElementById('currentChannelName');
            const messageInputEl = document.getElementById('messageInput');
            
            if (currentChannelNameEl) {
                currentChannelNameEl.textContent = '# ' + channelName;
            }
            if (messageInputEl) {
                messageInputEl.placeholder = 'Message # ' + channelName;
            }
            
            loadChannelMessages(currentChannelId);
            if (socket) {
                socket.emit('join_channel', {channel_id: currentChannelId});
            }
        }
    }
    
    // Load community members if we have a community
    if (currentCommunityId) {
        loadCommunityMembers(currentCommunityId);
    }
    
    // Initialize profile modal functionality
    initializeProfileModal();

    // Send message functionality
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && currentChannelId) {
            // Clear input immediately for better UX
            messageInput.value = '';
            
            // Create optimistic message object for instant display
            const optimisticMessage = {
                message_id: 'temp_' + Date.now(),
                content: message,
                username: window.currentUsername || 'You',
                pfp_path: window.currentUserPfp || '',
                created_at: new Date().toISOString(),
                message_type: 'text',
                reactions: [],
                isOptimistic: true // Flag to identify optimistic messages
            };
            
            // Add message to chat immediately (optimistic UI)
            addMessageToChat(optimisticMessage);
            
            // Send via Socket.IO for real-time delivery (faster)
            if (socket) {
                socket.emit('send_message', {
                    channel_id: currentChannelId,
                    message: {
                        content: message,
                        message_type: 'text'
                    }
                });
            }
            
            // Also send via API for persistence (async, non-blocking)
            fetch(`/api/channels/${currentChannelId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: message,
                    message_type: 'text'
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.message === 'Message sent successfully') {
                    // Replace optimistic message with real message
                    replaceOptimisticMessage(optimisticMessage.message_id, data.data);
                } else {
                    // Remove optimistic message and show error
                    removeOptimisticMessage(optimisticMessage.message_id);
                    console.error('Error sending message:', data.error);
                    showMessageError('Failed to send message: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                // Remove optimistic message and show error
                removeOptimisticMessage(optimisticMessage.message_id);
                console.error('Error:', error);
                showMessageError('Failed to send message. Please try again.');
            });
        }
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    if (messageInput) {
        let typingTimer;
        let isTyping = false;
        
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
                return;
            }
            
            // Handle typing indicators
            if (!isTyping && currentChannelId && socket) {
                isTyping = true;
                socket.emit('typing_start', {channel_id: currentChannelId});
            }
            
            // Clear existing timer
            clearTimeout(typingTimer);
            
            // Set new timer to stop typing after 1 second of inactivity
            typingTimer = setTimeout(() => {
                if (isTyping && socket) {
                    isTyping = false;
                    socket.emit('typing_stop', {channel_id: currentChannelId});
                }
            }, 1000);
        });
        
        messageInput.addEventListener('blur', function() {
            // Stop typing when input loses focus
            if (isTyping && socket) {
                isTyping = false;
                socket.emit('typing_stop', {channel_id: currentChannelId});
                clearTimeout(typingTimer);
            }
        });
    }
});

// Load messages for a channel
function loadChannelMessages(channelId) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Show loading
    chatMessages.innerHTML = `
        <div class="loading-messages">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading messages...</span>
        </div>
    `;
    
    fetch(`/api/channels/${channelId}/messages?limit=50`)
        .then(response => response.json())
        .then(data => {
            if (data.messages && data.messages.length > 0) {
                displayMessages(data.messages);
            } else {
                chatMessages.innerHTML = `
                    <div class="no-messages">
                        <i class="fas fa-comments"></i>
                        <p>No messages yet. Be the first to say something!</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading messages:', error);
            chatMessages.innerHTML = `
                <div class="error-messages">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load messages. Please try again.</p>
                </div>
            `;
        });
}

// Display messages in chat
function displayMessages(messages) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    chatMessages.innerHTML = '';
    
    messages.forEach(message => {
        addMessageToChat(message);
    });
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add a single message to chat
function addMessageToChat(message) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.setAttribute('data-message-id', message.message_id);
    
    // Add optimistic styling for pending messages
    if (message.isOptimistic) {
        messageElement.classList.add('optimistic-message');
    }
    
    // Create avatar
    const avatar = message.pfp_path ? 
        `<img src="${message.pfp_path}" alt="${message.username}">` :
        `<div class="avatar-text">${message.username ? message.username.charAt(0).toUpperCase() : 'U'}</div>`;
    
    // Format time
    const messageTime = new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit', 
        minute: '2-digit'
    });
    
    // Handle reply
    let replyHtml = '';
    if (message.reply_content && message.reply_username) {
        replyHtml = `
            <div class="message-reply">
                <i class="fas fa-reply"></i>
                <span class="reply-author">${message.reply_username}</span>
                <span class="reply-content">${message.reply_content.substring(0, 100)}${message.reply_content.length > 100 ? '...' : ''}</span>
            </div>
        `;
    }
    
    // Handle reactions
    let reactionsHtml = '';
    if (message.reactions && message.reactions.length > 0) {
        reactionsHtml = '<div class="message-reactions">';
        message.reactions.forEach(reaction => {
            reactionsHtml += `
                <span class="reaction" data-emoji="${reaction.emoji}">
                    ${reaction.emoji} ${reaction.count}
                </span>
            `;
        });
        reactionsHtml += '</div>';
    }
    
    messageElement.innerHTML = `
        <div class="message-avatar" data-user-id="${message.user_id || ''}" data-username="${message.username || ''}">${avatar}</div>
        <div class="message-content">
            ${replyHtml}
            <div class="message-header">
                <span class="message-author">${message.username || 'Unknown User'}</span>
                <span class="message-time">${messageTime}</span>
                ${message.is_edited ? '<span class="message-edited">(edited)</span>' : ''}
            </div>
            <div class="message-text">${escapeHtml(message.content)}</div>
            ${reactionsHtml}
        </div>
    `;
    
    // Add click event to avatar
    const avatarElement = messageElement.querySelector('.message-avatar');
    if (avatarElement && message.user_id) {
        avatarElement.addEventListener('click', function() {
            // Create user data object from message
            const userData = {
                user_id: message.user_id,
                username: message.username,
                firstname: message.firstname || message.username,
                lastname: message.lastname || '',
                pfp_path: message.pfp_path,
                role: message.role || 'Member',
                is_online: message.is_online
            };
            showProfileModal(userData);
        });
    }
    
    // Add message to chat
    chatMessages.appendChild(messageElement);
    
    // Auto-scroll to bottom if user is near bottom
    if (chatMessages.scrollTop + chatMessages.clientHeight >= chatMessages.scrollHeight - 100) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Handle message reactions
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('reaction')) {
        const messageId = e.target.closest('.message').getAttribute('data-message-id');
        const emoji = e.target.getAttribute('data-emoji');
        
        if (messageId && emoji) {
            toggleReaction(messageId, emoji);
        }
    }
});

// Toggle message reaction
function toggleReaction(messageId, emoji) {
    fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            emoji: emoji
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            // Reload messages to update reaction counts
            if (currentChannelId) {
                loadChannelMessages(currentChannelId);
            }
        }
    })
    .catch(error => {
        console.error('Error toggling reaction:', error);
    });
}

// Load community members
function loadCommunityMembers(communityId) {
    const membersList = document.getElementById('membersList');
    if (!membersList) return;
    
    // Show loading
    membersList.innerHTML = `
        <div class="loading-members">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Loading members...</span>
        </div>
    `;
    
    fetch(`/api/communities/${communityId}/members`)
        .then(response => response.json())
        .then(data => {
            if (data.members && data.members.length > 0) {
                displayMembers(data.members);
            } else {
                membersList.innerHTML = `
                    <div class="no-members">
                        <i class="fas fa-users"></i>
                        <p>No members found</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading members:', error);
            membersList.innerHTML = `
                <div class="error-members">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load members</p>
                </div>
            `;
        });
}

// Display members list
function displayMembers(members) {
    const membersList = document.getElementById('membersList');
    if (!membersList) return;
    
    membersList.innerHTML = '';
    
    members.forEach(member => {
        const memberElement = document.createElement('div');
        memberElement.className = 'connection';
        
        // Create avatar
        const avatar = member.pfp_path ? 
            `<img src="${member.pfp_path}" alt="${member.username}">` :
            `<i class="fas fa-user"></i>`;
        
        // Determine role badge color
        let roleColor = '#6b7280'; // default gray
        if (member.role === 'admin') roleColor = '#ef4444'; // red
        else if (member.role === 'moderator') roleColor = '#f59e0b'; // orange
        
        memberElement.innerHTML = `
            <div class="connection-avatar-circle" data-user-id="${member.user_id}" style="background: linear-gradient(135deg, ${roleColor} 0%, ${roleColor}dd 100%);">
                ${avatar}
            </div>
            <div class="connection-info">
                <div class="connection-name">${member.username || member.firstname + ' ' + member.lastname}</div>
                <div class="connection-details">${member.role} • ${member.department || 'Student'}</div>
            </div>
            <div class="connection-status ${member.is_online ? 'online' : 'offline'}"></div>
        `;
        
        // Add click event to avatar
        const avatarElement = memberElement.querySelector('.connection-avatar-circle');
        if (avatarElement && member.user_id) {
            avatarElement.addEventListener('click', function() {
                showProfileModal(member);
            });
        }
        
        membersList.appendChild(memberElement);
    });
}

// Typing indicator functions
let typingUsers = new Set();
let typingIndicatorElement = null;

function showTypingIndicator(data) {
    if (data.typing) {
        typingUsers.add(data.username);
    } else {
        typingUsers.delete(data.username);
    }
    
    updateTypingIndicator();
}

function updateTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Remove existing typing indicator
    if (typingIndicatorElement) {
        typingIndicatorElement.remove();
        typingIndicatorElement = null;
    }
    
    if (typingUsers.size > 0) {
        // Create typing indicator
        typingIndicatorElement = document.createElement('div');
        typingIndicatorElement.className = 'typing-indicator';
        typingIndicatorElement.id = 'typingIndicator';
        
        let typingText = '';
        const usersArray = Array.from(typingUsers);
        
        if (usersArray.length === 1) {
            typingText = `${usersArray[0]} is typing...`;
        } else if (usersArray.length === 2) {
            typingText = `${usersArray[0]} and ${usersArray[1]} are typing...`;
        } else {
            typingText = `${usersArray.length} people are typing...`;
        }
        
        typingIndicatorElement.innerHTML = `
            <div class="typing-indicator-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span class="typing-text">${typingText}</span>
            </div>
        `;
        
        chatMessages.appendChild(typingIndicatorElement);
        
        // Auto-scroll to show typing indicator
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Optimistic UI helper functions
function replaceOptimisticMessage(tempId, realMessage) {
    const messageElement = document.querySelector(`[data-message-id="${tempId}"]`);
    if (messageElement) {
        messageElement.setAttribute('data-message-id', realMessage.message_id);
        messageElement.classList.remove('optimistic-message');
        // Update any other necessary data
    }
}

function removeOptimisticMessage(tempId) {
    const messageElement = document.querySelector(`[data-message-id="${tempId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
}

function showMessageError(errorMessage) {
    // Create a temporary error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message-error-notification';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${errorMessage}</span>
    `;
    errorDiv.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: #ef4444; color: white; padding: 1rem 1.5rem;
        border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex; align-items: center; gap: 0.5rem;
        font-weight: 500; max-width: 400px;
        transform: translateX(100%); transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(errorDiv);
    
    // Animate in
    requestAnimationFrame(() => {
        errorDiv.style.transform = 'translateX(0)';
    });
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        errorDiv.style.transform = 'translateX(100%)';
        setTimeout(() => errorDiv.remove(), 300);
    }, 4000);
}

// Enhanced channel switching with proper cleanup
function switchToChannel(channelId, channelName) {
    // Leave current channel if any
    if (currentChannelId && socket) {
        socket.emit('leave_channel', {channel_id: currentChannelId});
    }
    
    // Clear typing users for new channel
    typingUsers.clear();
    updateTypingIndicator();
    
    // Update current channel
    currentChannelId = channelId;
    
    // Join new channel
    if (socket) {
        socket.emit('join_channel', {channel_id: channelId});
    }
    
    // Load messages
    loadChannelMessages(channelId);
}

// Profile Modal Functions
function initializeProfileModal() {
    const profileModal = document.getElementById('profileModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const closePreview = document.getElementById('closePreview');
    
    // Close modal event listeners
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', closeModal);
    }
    
    if (closePreview) {
        closePreview.addEventListener('click', closeModal);
    }
    
    // Close modal when clicking overlay
    if (profileModal) {
        profileModal.addEventListener('click', function(e) {
            if (e.target === profileModal) {
                closeModal();
            }
        });
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && profileModal && profileModal.classList.contains('active')) {
            closeModal();
        }
    });
    
    function closeModal() {
        if (profileModal) {
            profileModal.classList.remove('active');
        }
    }
}

function showProfileModal(userData) {
    const profileModal = document.getElementById('profileModal');
    const profilePreview = document.getElementById('profilePreview');
    
    if (!profileModal || !profilePreview) return;
    
    // Create avatar
    const avatarHtml = userData.pfp_path ? 
        `<img src="${userData.pfp_path}" alt="${userData.firstname} ${userData.lastname}">` :
        `${(userData.firstname || userData.username || 'U').charAt(0).toUpperCase()}`;
    
    // Format join date
    const joinDate = userData.joined_at ? new Date(userData.joined_at).toLocaleDateString() : 'Unknown';
    
    profilePreview.innerHTML = `
        <div class="profile-avatar">
            ${avatarHtml}
        </div>
        <div class="profile-name">${userData.firstname || ''} ${userData.lastname || ''}</div>
        <div class="profile-role">${userData.user_role || userData.role || 'Member'}</div>
        
        <div class="profile-details">
            ${userData.username ? `
                <div class="profile-detail-item">
                    <i class="fas fa-user"></i>
                    <span class="detail-label">Username:</span>
                    <span class="detail-value">@${userData.username}</span>
                </div>
            ` : ''}
            
            ${userData.department ? `
                <div class="profile-detail-item">
                    <i class="fas fa-building"></i>
                    <span class="detail-label">Department:</span>
                    <span class="detail-value">${userData.department}</span>
                </div>
            ` : ''}
            
            ${userData.role ? `
                <div class="profile-detail-item">
                    <i class="fas fa-shield-alt"></i>
                    <span class="detail-label">Community Role:</span>
                    <span class="detail-value">${userData.role}</span>
                </div>
            ` : ''}
            
            <div class="profile-detail-item">
                <i class="fas fa-calendar-alt"></i>
                <span class="detail-label">Joined:</span>
                <span class="detail-value">${joinDate}</span>
            </div>
            
            ${userData.is_online !== undefined ? `
                <div class="profile-detail-item">
                    <i class="fas fa-circle" style="color: ${userData.is_online ? '#10b981' : '#6b7280'}"></i>
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">${userData.is_online ? 'Online' : 'Offline'}</span>
                </div>
            ` : ''}
        </div>
    `;
    
    // Show modal
    profileModal.classList.add('active');
    
    // Show/hide action buttons based on whether it's current user
    const currentUserId = window.currentUserId || window.channelsData?.userId;
    const isCurrentUser = userData.user_id && currentUserId && (userData.user_id === currentUserId || userData.user_id == currentUserId);
    
    console.log('Profile Modal Debug:', {
        userData: userData,
        currentUserId: currentUserId,
        isCurrentUser: isCurrentUser
    });
    
    const profileBtn = document.getElementById('profileFromPreview');
    const connectBtn = document.getElementById('connectFromPreview');
    const messageBtn = document.getElementById('messageFromPreview');
    
    // Profile button - always show
    if (profileBtn) {
        profileBtn.style.display = 'inline-flex';
        profileBtn.innerHTML = '<i class="fas fa-user"></i> View Profile';
        profileBtn.onclick = () => viewProfile(userData.username);
    }
    
    // Connect button - hide for current user
    if (connectBtn) {
        connectBtn.style.display = isCurrentUser ? 'none' : 'inline-flex';
        connectBtn.innerHTML = '<i class="fas fa-user-plus"></i> Connect';
        connectBtn.onclick = () => sendConnectionRequest(userData.user_id);
    }
    
    // Chat button - hide for current user, always show for others
    if (messageBtn) {
        messageBtn.style.display = isCurrentUser ? 'none' : 'inline-flex';
        messageBtn.innerHTML = '<i class="fas fa-comment"></i> Chat';
        messageBtn.onclick = () => startChat(userData.username);
    }
}

// Helper functions for profile modal actions
function sendConnectionRequest(userId) {
    // Show loading state
    const connectBtn = document.getElementById('connectFromPreview');
    if (connectBtn) {
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        connectBtn.disabled = true;
    }
    
    fetch('/api/send_connection_request', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            target_user_id: userId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Connection request sent!', 'success');
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-check"></i> Request Sent';
                connectBtn.style.background = '#10b981';
            }
        } else {
            showNotification(data.message || 'Failed to send connection request', 'error');
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-user-plus"></i> Connect';
                connectBtn.disabled = false;
            }
        }
    })
    .catch(error => {
        console.error('Error sending connection request:', error);
        showNotification('Error sending connection request', 'error');
        if (connectBtn) {
            connectBtn.innerHTML = '<i class="fas fa-user-plus"></i> Connect';
            connectBtn.disabled = false;
        }
    });
}

function startChat(username) {
    // Close the modal first
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.classList.remove('active');
    }
    
    // Show loading notification
    showNotification('Opening chat...', 'info');
    
    // Redirect to chat with user
    window.location.href = `/chat/${username}`;
}

function viewProfile(username) {
    // Close the modal first
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.classList.remove('active');
    }
    
    // Show loading notification
    showNotification('Opening profile...', 'info');
    
    // Redirect to user profile
    window.location.href = `/profile/${username}`;
}
