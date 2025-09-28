// Prevent multiple initializations
if (window.chatInitialized) {
    console.log('Chat already initialized, skipping...');
}
else {
    window.chatInitialized = true;
    document.addEventListener('DOMContentLoaded', function () {
        console.log('🚀 Chat.ts initializing - DOM ready');
        // Get user data from the template with type safety
        const chatData = window.chatData || {};
        console.log('Chat data:', chatData);
        const currentUserId = chatData.currentUserId ? Number(chatData.currentUserId) : null;
        const currentUserName = chatData.currentUserName || 'User';
        const currentUserPfp = chatData.currentUserPfp || '';
        const otherUserId = chatData.otherUserId ? Number(chatData.otherUserId) : null;
        const otherUserName = chatData.otherUserName || '';
        const otherUserPfp = chatData.otherUserPfp || '';
        console.log('User IDs:', { currentUserId, otherUserId });
        if (!currentUserId) {
            console.error('No current user ID - user might not be logged in');
            return;
        }
        // Initialize Go WebSocket connection
        console.log('Initializing Go WebSocket connection...');
        const socket = window.goSocket;
        // Connect to Go WebSocket server with user info
        socket.connect(currentUserId.toString(), currentUserName, currentUserPfp);
        let onlineUsers = new Set();
        let isTyping = false;
        let typingTimeout = null;
        // Online Status Management
        const chatUserStatus = document.getElementById('chatUserStatus');
        const chatUserOnlineStatus = document.getElementById('chatUserOnlineStatus');
        function updateUserOnlineStatus(userId, isOnline) {
            // Update chat header status for the current conversation
            if (userId === otherUserId) {
                if (chatUserStatus) {
                    if (isOnline) {
                        chatUserStatus.classList.add('online');
                    }
                    else {
                        chatUserStatus.classList.remove('online');
                    }
                }
                if (chatUserOnlineStatus) {
                    chatUserOnlineStatus.textContent = isOnline ? 'Active now' : 'Offline';
                }
            }
            // Update sidebar status indicators
            const statusElements = document.querySelectorAll(`[data-user-id="${userId}"] .online-status`);
            statusElements.forEach(element => {
                if (isOnline) {
                    element.classList.add('online');
                }
                else {
                    element.classList.remove('online');
                }
            });
        }
        // Fetch initial online status
        async function fetchOnlineStatus() {
            try {
                const response = await fetch('/api/online_status');
                if (response.ok) {
                    const data = await response.json();
                    onlineUsers.clear();
                    data.online_users.forEach(userId => onlineUsers.add(userId));
                    // Update the current chat user's status
                    if (otherUserId) {
                        updateUserOnlineStatus(otherUserId, onlineUsers.has(otherUserId));
                    }
                }
            }
            catch (error) {
                console.error('Error fetching online status:', error);
                if (chatUserOnlineStatus) {
                    chatUserOnlineStatus.textContent = 'Status unknown';
                }
            }
        }
        // Update online status every 30 seconds
        fetchOnlineStatus();
        setInterval(fetchOnlineStatus, 30000);
        // Go WebSocket event handlers
        socket.on('error', (err) => {
            console.error('WebSocket error:', err?.message || err);
        });
        socket.on('disconnect', (reason) => {
            console.warn('WebSocket disconnected:', reason);
        });
        socket.on('connect', () => {
            console.log('Go WebSocket connected successfully');
            if (currentUserId && otherUserId) {
                console.log('Joining chat room for users:', currentUserId, otherUserId);
                // Join direct chat room
                socket.send('join_chat_room', {
                    sender_id: currentUserId,
                    receiver_id: otherUserId
                });
            }
            loadOnlineStatus();
        });
        socket.on('user_online', (data) => {
            console.log('User came online:', data);
            const userId = data.user_id || data.userID;
            onlineUsers.add(userId);
            updateUserOnlineStatus(userId, true);
        });
        socket.on('user_offline', (data) => {
            console.log('User went offline:', data);
            const userId = data.user_id || data.userID;
            onlineUsers.delete(userId);
            updateUserOnlineStatus(userId, false);
        });
        // DOM Elements with proper type assertions
        const conversationItems = document.querySelectorAll('.conversation-item');
        const messagesArea = document.getElementById('messagesArea');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const newMessageBtn = document.getElementById('newMessageBtn');
        const newMessageModal = document.getElementById('newMessageModal');
        const closeNewMessageModal = document.getElementById('closeNewMessageModal');
        const searchInput = document.getElementById('searchInput');
        const userSearchInput = document.getElementById('userSearchInput');
        const typingIndicator = document.getElementById('typingIndicator');
        const chatUserName = document.getElementById('chatUserName');
        const chatUserAvatar = document.getElementById('chatUserAvatar');
        // Emoji elements with type safety
        const emojiBtn = document.getElementById('emojiBtn');
        const emojiPicker = document.getElementById('emojiPicker');
        const emojiGrid = document.getElementById('emojiGrid');
        // File attachment elements
        const attachmentBtn = document.getElementById('attachmentBtn');
        const fileInput = document.getElementById('fileInput');
        // Call buttons
        const voiceCallBtn = document.querySelector('.chat-action-btn[title="Voice call"]');
        const videoCallBtn = document.querySelector('.chat-action-btn[title="Video call"]');
        const moreOptionsBtn = document.querySelector('.chat-action-btn[title="More options"]');
        console.log('UI elements:', { emojiBtn, emojiPicker, emojiGrid, attachmentBtn, fileInput, voiceCallBtn, videoCallBtn });
        // Debug emoji elements specifically
        if (!emojiBtn)
            console.error('❌ Emoji button not found!');
        if (!emojiPicker)
            console.error('❌ Emoji picker not found!');
        if (!emojiGrid)
            console.error('❌ Emoji grid not found!');
        // Current conversation tracking
        let currentConversationUserId = otherUserId || 0;
        // Message tracking for deduplication
        const processedMessages = new Set();
        let lastSentMessageTime = 0;
        // Go WebSocket message handlers with deduplication
        socket.on('new_chat_message', (data) => {
            console.log('📨 Message received:', data);
            const senderId = Number(data.userID || data.user_id);
            const receiverId = Number(data.receiver_id);
            const content = data.content || data.message || '';
            if (!content.trim()) {
                console.warn('⚠️ Received empty message, ignoring');
                return;
            }
            // Create unique message identifier for deduplication
            const messageKey = `${senderId}-${receiverId}-${content}-${data.message_id || Date.now()}`;
            if (processedMessages.has(messageKey)) {
                console.log('🔄 Duplicate message detected, ignoring:', messageKey);
                return;
            }
            processedMessages.add(messageKey);
            // Only show messages for current conversation
            if (otherUserId && (senderId === otherUserId || receiverId === otherUserId)) {
                const isSent = senderId === currentUserId;
                console.log('💬 Displaying message:', { content, isSent, senderId, receiverId });
                // Prevent showing our own sent messages twice (optimistic UI already showed it)
                if (isSent && (Date.now() - lastSentMessageTime < 2000)) {
                    console.log('🚫 Skipping own recent message to prevent duplicate');
                    return;
                }
                const messageElement = createMessageElement(content, isSent, {
                    senderUsername: data.sender_username,
                    senderPfp: data.sender_pfp
                });
                if (messagesArea) {
                    messagesArea.appendChild(messageElement);
                    scrollToBottom();
                }
                // Update conversation list
                const otherId = isSent ? receiverId : senderId;
                if (!getConversationItem(otherId)) {
                    const name = isSent ? (chatUserName?.textContent || `User ${otherId}`) : (data.sender_username || `User ${otherId}`);
                    const avatar = isSent ? (chatUserAvatar?.getAttribute('src') || otherUserPfp) : (data.sender_pfp || 'https://via.placeholder.com/50');
                    ensureConversationItem(otherId, name, avatar);
                }
                updateConversationLastMessage(otherId, content);
            }
        });
        // Typing indicators
        socket.on('typing_start', (data) => {
            if (String(data.user_id) === String(currentConversationUserId)) {
                showTypingIndicator();
            }
        });
        socket.on('typing_stop', (data) => {
            if (String(data.user_id) === String(currentConversationUserId)) {
                hideTypingIndicator();
            }
        });
        // Send message function with proper typing and deduplication
        let isSending = false;
        async function sendMessage() {
            if (!messageInput)
                return;
            const message = messageInput.value.trim();
            if (!message || !otherUserId || isSending) {
                return;
            }
            isSending = true;
            lastSentMessageTime = Date.now();
            // Clear input immediately for better UX
            messageInput.value = '';
            messageInput.style.height = 'auto';
            if (!socket.connected) {
                showNotification('Not connected to server. Please refresh the page.', 'error');
                isSending = false;
                return;
            }
            try {
                // Create optimistic message element (show immediately)
                const messageElement = createMessageElement(message, true);
                if (messagesArea) {
                    messagesArea.appendChild(messageElement);
                    scrollToBottom();
                }
                socket.sendDirectMessage(message, otherUserId);
                client_message_id: `${currentUserId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            }
            finally // Update conversation list
             { }
        }
    });
    // Update conversation list
    if (typeof otherUserId !== 'undefined') {
        updateConversationLastMessage(otherUserId, message);
    }
}
try { }
catch (error) {
    console.error('Error sending message:', error);
    showNotification('Failed to send message. Please try again.', 'error');
    // Restore message to input on error
    messageInput.value = message;
}
finally {
    isSending = false;
}
// Event listeners with null checks
if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
}
if (messageInput) {
    let typingTimer = null;
    messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        if (!isTyping && currentConversationUserId) {
            isTyping = true;
            socket.send('typing_start', {
                sender_id: currentUserId,
                receiver_id: currentConversationUserId
            });
        }
        if (typingTimer)
            clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            if (isTyping && currentConversationUserId) {
                isTyping = false;
                socket.send('typing_stop', {
                    sender_id: currentUserId,
                    receiver_id: currentConversationUserId
                });
            }
        }, 1000);
    });
    messageInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}
// Utility functions with proper typing
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function createMessageElement(text, isSent = false, options) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    if (isSent) {
        messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-bubble">
                        <p>${escapeHtml(text)}</p>
                    </div>
                    <div class="message-time">${currentTime}</div>
                </div>
            `;
    }
    else {
        const avatarSrc = otherUserPfp || 'https://via.placeholder.com/50';
        messageDiv.innerHTML = `
                <div class="message-avatar">
                    <img src="${escapeHtml(avatarSrc)}" alt="">
                </div>
                <div class="message-content">
                    <div class="message-bubble">
                        <p>${escapeHtml(text)}</p>
                    </div>
                    <div class="message-time">${currentTime}</div>
                </div>
            `;
    }
    return messageDiv;
}
function showTypingIndicator() {
    if (typingIndicator) {
        typingIndicator.style.display = 'flex';
        // No need to scroll when showing typing indicator since it's at bottom
    }
}
function hideTypingIndicator() {
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
}
function scrollToBottom() {
    if (!messagesArea)
        return;
    requestAnimationFrame(() => {
        messagesArea.scrollTop = messagesArea.scrollHeight;
    });
}
function updateConversationLastMessage(userId, message) {
    const conversationItem = document.querySelector(`[data-user-id="${userId}"]`);
    if (conversationItem) {
        const lastMessageElement = conversationItem.querySelector('.last-message');
        if (lastMessageElement) {
            lastMessageElement.textContent = message.length > 50 ? message.substring(0, 50) + '...' : message;
        }
    }
}
function getConversationItem(userId) {
    return document.querySelector(`[data-user-id="${userId}"]`);
}
function ensureConversationItem(userId, name, avatarUrl) {
    let item = getConversationItem(userId);
    if (item)
        return item;
    const list = document.getElementById('conversationsList');
    if (!list)
        return null;
    const wrapper = document.createElement('div');
    wrapper.className = 'conversation-item';
    wrapper.setAttribute('data-user-id', String(userId));
    wrapper.innerHTML = `
            <div class="conversation-avatar">
                <img src="${escapeHtml(avatarUrl || 'https://via.placeholder.com/50')}" alt="">
                <div class="online-status"></div>
            </div>
            <div class="conversation-info">
                <div class="conversation-header">
                    <h4>${escapeHtml(name || `User ${userId}`)}</h4>
                    <span class="conversation-time">now</span>
                </div>
                <p class="last-message"></p>
            </div>
        `;
    list.prepend(wrapper);
    wrapper.addEventListener('click', function () {
        conversationItems.forEach(i => i.classList.remove('active'));
        wrapper.classList.add('active');
        const newId = Number(wrapper.getAttribute('data-user-id'));
        if (newId !== currentConversationUserId) {
            currentConversationUserId = newId;
            // Handle conversation switch logic here
        }
    });
    return wrapper;
}
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    let icon = 'fas fa-info-circle';
    let bgColor = '#6D28D9';
    if (type === 'success') {
        icon = 'fas fa-check-circle';
        bgColor = '#10b981';
    }
    else if (type === 'error') {
        icon = 'fas fa-exclamation-circle';
        bgColor = '#ef4444';
    }
    notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${escapeHtml(message)}</span>
        `;
    notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: ${bgColor}; color: white; padding: 1rem 1.5rem;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex; align-items: center; gap: 0.5rem;
            font-weight: 500; max-width: 400px;
        `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 5000);
}
function loadOnlineStatus() {
    // Implementation for loading online status
    console.log('Loading online status...');
}
// Emoji data and functions
const emojiData = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥'],
    people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'],
    nature: ['🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌶️', '🍄', '🌾', '💐', '🌿', '🍀', '🍃', '🍂', '🍁', '🌊', '🌀', '🌈', '🌂', '☂️', '☔', '⛱️', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧', '🌟', '⭐'],
    food: ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🥗', '🍿', '🧈', '🧂', '🥨', '🥖', '🍞', '🥐', '🥯', '🧇', '🥞', '🍰', '🎂', '🧁', '🥧', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂'],
    travel: ['✈️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍', '🚎', '🚐', '🚑', '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚘', '🚙', '🛻', '🚚', '🚛'],
    objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐']
};
function initializeEmojiPicker() {
    console.log('🚀 Initializing emoji picker...');
    loadEmojiCategory('smileys');
    const emojiCategories = document.querySelectorAll('.emoji-category');
    console.log('📋 Found emoji categories:', emojiCategories.length);
    emojiCategories.forEach(category => {
        category.addEventListener('click', function () {
            console.log('🏷️ Category clicked:', this.getAttribute('data-category'));
            emojiCategories.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            const categoryName = this.getAttribute('data-category');
            if (categoryName) {
                loadEmojiCategory(categoryName);
            }
        });
    });
}
function loadEmojiCategory(category) {
    if (!emojiGrid)
        return;
    console.log('📂 Loading emoji category:', category);
    const emojis = emojiData[category] || [];
    console.log('😀 Found emojis:', emojis.length);
    emojiGrid.innerHTML = '';
    emojis.forEach(emoji => {
        const emojiButton = document.createElement('button');
        emojiButton.className = 'emoji-item';
        emojiButton.textContent = emoji;
        emojiButton.addEventListener('click', function () {
            console.log('😀 Emoji clicked:', emoji);
            insertEmoji(emoji);
        });
        emojiGrid.appendChild(emojiButton);
    });
    console.log('✅ Added', emojis.length, 'emojis to grid');
}
function insertEmoji(emoji) {
    if (!messageInput)
        return;
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(cursorPos);
    messageInput.value = textBefore + emoji + textAfter;
    messageInput.focus();
    messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    if (emojiPicker)
        emojiPicker.style.display = 'none';
}
// Emoji functionality with proper typing
if (emojiBtn && emojiPicker && emojiGrid) {
    emojiBtn.addEventListener('click', function (e) {
        console.log('🎯 Emoji button clicked!');
        console.log('🔍 Current picker display:', emojiPicker.style.display);
        console.log('🔍 Picker element:', emojiPicker);
        console.log('🔍 Grid element:', emojiGrid);
        console.log('🔍 Grid children count:', emojiGrid.children.length);
        e.stopPropagation();
        if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
            console.log('📂 Opening emoji picker');
            emojiPicker.style.display = 'flex';
            console.log('✅ Set display to flex');
            if (!emojiGrid.children.length) {
                console.log('🔄 Initializing emoji picker');
                initializeEmojiPicker();
                console.log('✅ Emoji picker initialized, grid children:', emojiGrid.children.length);
            }
        }
        else {
            console.log('📁 Closing emoji picker');
            emojiPicker.style.display = 'none';
        }
    });
    document.addEventListener('click', function (e) {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.style.display = 'none';
        }
    });
}
else {
    console.warn('Emoji elements not found:', { emojiBtn, emojiPicker, emojiGrid });
}
// File attachment functionality
if (attachmentBtn && fileInput) {
    attachmentBtn.addEventListener('click', function (e) {
        e.preventDefault();
        console.log('📎 Attachment button clicked');
        fileInput.click();
    });
    fileInput.addEventListener('change', function (e) {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            console.log('📁 File selected:', file.name, file.type, file.size);
            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                showNotification('File size must be less than 10MB', 'error');
                return;
            }
            // Validate file type (images only for now)
            if (!file.type.startsWith('image/')) {
                showNotification('Only image files are supported', 'error');
                return;
            }
            uploadFile(file);
        }
    });
}
else {
    console.warn('Attachment elements not found:', { attachmentBtn, fileInput });
}
// Voice call functionality
if (voiceCallBtn) {
    voiceCallBtn.addEventListener('click', function (e) {
        e.preventDefault();
        console.log('📞 Voice call button clicked');
        if (otherUserId && otherUserName) {
            initiateVoiceCall(otherUserId, otherUserName);
        }
        else {
            showNotification('Cannot start call - no user selected', 'error');
        }
    });
}
else {
    console.warn('Voice call button not found');
}
// Video call functionality
if (videoCallBtn) {
    videoCallBtn.addEventListener('click', function (e) {
        e.preventDefault();
        console.log('📹 Video call button clicked');
        if (otherUserId && otherUserName) {
            initiateVideoCall(otherUserId, otherUserName);
        }
        else {
            showNotification('Cannot start video call - no user selected', 'error');
        }
    });
}
else {
    console.warn('Video call button not found');
}
// More options functionality
if (moreOptionsBtn) {
    moreOptionsBtn.addEventListener('click', function (e) {
        e.preventDefault();
        console.log('⚙️ More options button clicked');
        showMoreOptionsMenu();
    });
}
// File upload function
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sender_id', String(currentUserId));
    formData.append('receiver_id', String(otherUserId));
    try {
        showNotification('Uploading file...', 'info');
        const response = await fetch('/api/upload_file', {
            method: 'POST',
            body: formData
        });
        if (response.ok) {
            const result = await response.json();
            console.log('File uploaded successfully:', result);
            // Send file message via socket
            socket.emit('send_message', {
                sender_id: currentUserId,
                receiver_id: otherUserId,
                message: `📎 ${file.name}`,
                file_url: result.file_url,
                file_type: file.type,
                file_name: file.name,
                message_type: 'file'
            });
            showNotification('File uploaded successfully!', 'success');
        }
        else {
            throw new Error('Upload failed');
        }
    }
    catch (error) {
        console.error('File upload error:', error);
        showNotification('Failed to upload file. Please try again.', 'error');
    }
    finally {
        // Reset file input
        if (fileInput) {
            fileInput.value = '';
        }
    }
}
// Voice call function
function initiateVoiceCall(userId, userName) {
    showNotification(`Starting voice call with ${userName}...`, 'info');
    // Emit call initiation to server
    socket.emit('initiate_call', {
        caller_id: currentUserId,
        receiver_id: userId,
        call_type: 'voice'
    });
    // For now, show a placeholder modal
    showCallModal('voice', userName);
}
// Video call function
function initiateVideoCall(userId, userName) {
    showNotification(`Starting video call with ${userName}...`, 'info');
    // Emit call initiation to server
    socket.emit('initiate_call', {
        caller_id: currentUserId,
        receiver_id: userId,
        call_type: 'video'
    });
    // For now, show a placeholder modal
    showCallModal('video', userName);
}
// Show call modal (placeholder for now)
function showCallModal(callType, userName) {
    const modal = document.createElement('div');
    modal.className = 'call-modal-overlay';
    modal.innerHTML = `
            <div class="call-modal">
                <div class="call-header">
                    <h3>${callType === 'voice' ? '📞' : '📹'} ${callType.charAt(0).toUpperCase() + callType.slice(1)} Call</h3>
                </div>
                <div class="call-content">
                    <div class="call-avatar">
                        <img src="${otherUserPfp || 'https://via.placeholder.com/100'}" alt="${userName}">
                    </div>
                    <h4>${userName}</h4>
                    <p>Calling...</p>
                </div>
                <div class="call-actions">
                    <button class="call-btn end-call" onclick="this.closest('.call-modal-overlay').remove()">
                        <i class="fas fa-phone-slash"></i>
                    </button>
                </div>
            </div>
        `;
    modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); z-index: 10001;
            display: flex; align-items: center; justify-content: center;
        `;
    const callModalElement = modal.querySelector('.call-modal');
    if (callModalElement) {
        callModalElement.style.cssText = `
                background: white; border-radius: 12px; padding: 2rem;
                text-align: center; max-width: 400px; width: 90%;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            `;
    }
    document.body.appendChild(modal);
    // Auto-close after 30 seconds
    setTimeout(() => {
        if (document.body.contains(modal)) {
            modal.remove();
            showNotification('Call ended', 'info');
        }
    }, 30000);
}
// More options menu
function showMoreOptionsMenu() {
    const existingMenu = document.querySelector('.more-options-menu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    const menu = document.createElement('div');
    menu.className = 'more-options-menu';
    menu.innerHTML = `
            <div class="menu-item" data-action="clear-chat">
                <i class="fas fa-trash"></i>
                <span>Clear Chat</span>
            </div>
            <div class="menu-item" data-action="block-user">
                <i class="fas fa-ban"></i>
                <span>Block User</span>
            </div>
            <div class="menu-item" data-action="report-user">
                <i class="fas fa-flag"></i>
                <span>Report User</span>
            </div>
        `;
    menu.style.cssText = `
            position: absolute; top: 100%; right: 0;
            background: white; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border: 1px solid #e5e7eb; z-index: 1000;
            min-width: 150px;
        `;
    // Position relative to more options button
    if (moreOptionsBtn) {
        const rect = moreOptionsBtn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';
    }
    // Add menu item styles and click handlers
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.style.cssText = `
                padding: 0.75rem 1rem; cursor: pointer;
                display: flex; align-items: center; gap: 0.5rem;
                transition: background-color 0.2s;
            `;
        item.addEventListener('mouseenter', function () {
            this.style.backgroundColor = '#f3f4f6';
        });
        item.addEventListener('mouseleave', function () {
            this.style.backgroundColor = 'transparent';
        });
        item.addEventListener('click', function () {
            const action = this.getAttribute('data-action');
            handleMoreOptionsAction(action);
            menu.remove();
        });
    });
    document.body.appendChild(menu);
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}
// Handle more options actions
function handleMoreOptionsAction(action) {
    switch (action) {
        case 'clear-chat':
            if (confirm('Are you sure you want to clear this chat? This action cannot be undone.')) {
                clearChat();
            }
            break;
        case 'block-user':
            if (confirm(`Are you sure you want to block ${otherUserName}?`)) {
                blockUser();
            }
            break;
        case 'report-user':
            reportUser();
            break;
        default:
            console.log('Unknown action:', action);
    }
}
// Clear chat function
function clearChat() {
    if (messagesArea) {
        const messages = messagesArea.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        showNotification('Chat cleared', 'success');
    }
}
// Block user function
function blockUser() {
    // Implement block user API call
    showNotification(`${otherUserName} has been blocked`, 'success');
}
// Report user function
function reportUser() {
    const reason = prompt('Please provide a reason for reporting this user:');
    if (reason && reason.trim()) {
        // Implement report user API call
        showNotification('User reported successfully', 'success');
    }
}
// Socket event handlers for calls
socket.on('incoming_call', (data) => {
    console.log('📞 Incoming call:', data);
    showIncomingCallModal(data);
});
socket.on('call_ended', (data) => {
    console.log('📞 Call ended:', data);
    const callModal = document.querySelector('.call-modal-overlay');
    if (callModal) {
        callModal.remove();
    }
    showNotification('Call ended', 'info');
});
// Show incoming call modal
function showIncomingCallModal(callData) {
    const modal = document.createElement('div');
    modal.className = 'call-modal-overlay incoming-call';
    modal.innerHTML = `
            <div class="call-modal">
                <div class="call-header">
                    <h3>${callData.call_type === 'voice' ? '📞' : '📹'} Incoming ${callData.call_type} call</h3>
                </div>
                <div class="call-content">
                    <div class="call-avatar">
                        <img src="${callData.caller_avatar || 'https://via.placeholder.com/100'}" alt="${callData.caller_name}">
                    </div>
                    <h4>${callData.caller_name}</h4>
                    <p>Incoming call...</p>
                </div>
                <div class="call-actions">
                    <button class="call-btn accept-call" onclick="acceptCall('${callData.call_id}')">
                        <i class="fas fa-phone"></i>
                    </button>
                    <button class="call-btn decline-call" onclick="declineCall('${callData.call_id}')">
                        <i class="fas fa-phone-slash"></i>
                    </button>
                </div>
            </div>
        `;
    modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.8); z-index: 10001;
            display: flex; align-items: center; justify-content: center;
        `;
    document.body.appendChild(modal);
}
// Global functions for call handling (needed for onclick handlers)
window.acceptCall = function (callId) {
    socket.emit('accept_call', { call_id: callId });
    const modal = document.querySelector('.incoming-call');
    if (modal)
        modal.remove();
    showNotification('Call accepted', 'success');
};
window.declineCall = function (callId) {
    socket.emit('decline_call', { call_id: callId });
    const modal = document.querySelector('.incoming-call');
    if (modal)
        modal.remove();
    showNotification('Call declined', 'info');
};
// Initialize emoji picker immediately if elements exist
if (emojiBtn && emojiPicker && emojiGrid) {
    console.log('🔧 Pre-initializing emoji picker...');
    // Ensure the emoji picker has the right structure
    if (!emojiGrid.children.length) {
        initializeEmojiPicker();
    }
}
// Add global debug function for testing
window.testEmojiPicker = function () {
    console.log('🧪 Testing emoji picker...');
    console.log('Elements found:', { emojiBtn, emojiPicker, emojiGrid });
    if (emojiPicker) {
        emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'flex' : 'none';
        console.log('Toggled emoji picker display to:', emojiPicker.style.display);
    }
};
// Initialize everything
console.log('✅ Chat TypeScript initialization complete');
;
