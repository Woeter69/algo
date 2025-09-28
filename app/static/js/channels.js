// Global variables
let currentChannelId = null;
let socket = null;
let currentCommunityId = null;
let channelsData = window.channelsData || {};

// Initialize Socket.IO connection
function initializeSocket() {
    if (typeof io !== 'undefined') {
        socket = io();
        
        socket.on('connect', function() {
            console.log('Connected to server');
        });
        
        socket.on('new_message', function(data) {
            if (data.channel_id == currentChannelId) {
                addMessageToChat(data);
            }
        });
        
        socket.on('user_joined', function(data) {
            console.log('User joined:', data);
        });
        
        socket.on('user_left', function(data) {
            console.log('User left:', data);
        });
        
        socket.on('user_joined_channel', function(data) {
            console.log('User joined channel:', data);
            // You can show a notification that someone joined
        });
        
        socket.on('user_left_channel', function(data) {
            console.log('User left channel:', data);
        });
        
        socket.on('user_typing', function(data) {
            if (data.channel_id == currentChannelId) {
                showTypingIndicator(data);
            }
        });
        
        socket.on('error', function(data) {
            console.error('Socket error:', data.message);
            alert('Chat error: ' + data.message);
        });
    }
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

    // Send message functionality
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && currentChannelId) {
            // Send message via API
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
                    // Clear input
                    messageInput.value = '';
                    
                    // Add message to chat immediately
                    addMessageToChat(data.data);
                    
                    // Emit to socket for real-time updates to other users
                    if (socket) {
                        socket.emit('send_message', {
                            channel_id: currentChannelId,
                            message: data.data
                        });
                    }
                } else {
                    console.error('Error sending message:', data.error);
                    alert('Failed to send message: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Failed to send message. Please try again.');
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
        <div class="message-avatar">${avatar}</div>
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
            <div class="connection-avatar-circle" style="background: linear-gradient(135deg, ${roleColor} 0%, ${roleColor}dd 100%);">
                ${avatar}
            </div>
            <div class="connection-info">
                <div class="connection-name">${member.username || member.firstname + ' ' + member.lastname}</div>
                <div class="connection-details">${member.role} • ${member.department || 'Student'}</div>
            </div>
            <div class="connection-status ${member.is_online ? 'online' : 'offline'}"></div>
        `;
        
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
