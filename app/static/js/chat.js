document.addEventListener('DOMContentLoaded', function () {
    console.log('Chat.ts loaded - DOM ready');
    // Get user data from the template with type safety
    const chatData = window.chatData || {};
    console.log('Chat data:', chatData);
    const currentUserId = chatData.currentUserId ? Number(chatData.currentUserId) : null;
    const otherUserId = chatData.otherUserId ? Number(chatData.otherUserId) : null;
    const otherUserName = chatData.otherUserName || '';
    const otherUserPfp = chatData.otherUserPfp || '';
    console.log('User IDs:', { currentUserId, otherUserId });
    if (!currentUserId) {
        console.error('No current user ID - user might not be logged in');
        return;
    }
    // Initialize Socket.IO with proper typing
    console.log('Initializing Socket.IO connection...');
    const socket = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 500,
        timeout: 20000,
    });
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
    // Socket event handlers with proper typing
    socket.on('connect_error', (err) => {
        console.error('Socket connect_error:', err?.message || err);
    });
    // Note: reconnect_error is not in the standard Socket.IO events, using connect_error instead
    socket.on('connect_error', (err) => {
        console.error('Socket reconnect_error:', err?.message || err);
    });
    socket.on('disconnect', (reason) => {
        console.warn('Socket disconnected:', reason);
    });
    socket.on('connect', () => {
        console.log('Socket.IO connected successfully');
        if (currentUserId) {
            console.log('Emitting user_online for user:', currentUserId);
            socket.emit('user_online', { user_id: currentUserId });
        }
        if (currentUserId && otherUserId) {
            console.log('Joining room for users:', currentUserId, otherUserId);
            socket.emit('join', { user1: currentUserId, user2: otherUserId });
        }
        loadOnlineStatus();
    });
    socket.on('user_status_changed', (data) => {
        console.log('User status changed:', data);
        const { user_id, is_online } = data;
        if (is_online) {
            onlineUsers.add(user_id);
        }
        else {
            onlineUsers.delete(user_id);
        }
        updateUserOnlineStatus(user_id, is_online);
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
    console.log('Emoji elements:', { emojiBtn, emojiPicker, emojiGrid });
    // Current conversation tracking
    let currentConversationUserId = otherUserId || 0;
    // Message tracking
    let lastSentMessage = null;
    const seenClientMessageIds = new Set();
    const deliveredClientIds = new Set();
    // Socket message handlers
    socket.on('receive_message', (data) => {
        const senderId = Number(data.sender_id);
        const receiverId = Number(data.receiver_id);
        if (data.client_message_id) {
            deliveredClientIds.add(data.client_message_id);
        }
        if (senderId === currentConversationUserId || receiverId === currentConversationUserId) {
            const isSent = senderId === currentUserId;
            if (data.client_message_id && seenClientMessageIds.has(data.client_message_id)) {
                return;
            }
            if (isSent && lastSentMessage && lastSentMessage === data.content) {
                lastSentMessage = null;
                return;
            }
            const messageElement = createMessageElement(data.content, isSent, {
                senderUsername: data.sender_username,
                senderPfp: data.sender_pfp
            });
            if (messagesArea) {
                messagesArea.appendChild(messageElement);
                scrollToBottom();
            }
            const otherId = isSent ? receiverId : senderId;
            if (!getConversationItem(otherId)) {
                const name = isSent ? (chatUserName?.textContent || `User ${otherId}`) : (data.sender_username || `User ${otherId}`);
                const avatar = isSent ? (chatUserAvatar?.getAttribute('src') || otherUserPfp) : (data.sender_pfp || 'https://via.placeholder.com/50');
                ensureConversationItem(otherId, name, avatar);
            }
            updateConversationLastMessage(otherId, data.content);
        }
    });
    // Typing indicators
    socket.on('user_typing', (data) => {
        if (String(data.user_id) === String(currentConversationUserId)) {
            showTypingIndicator();
        }
    });
    socket.on('user_stopped_typing', (data) => {
        if (String(data.user_id) === String(currentConversationUserId)) {
            hideTypingIndicator();
        }
    });
    // Send message function with proper typing
    let isSending = false;
    async function sendMessage() {
        if (!messageInput)
            return;
        const message = messageInput.value.trim();
        if (!message || !currentConversationUserId || isSending) {
            return;
        }
        isSending = true;
        messageInput.value = '';
        messageInput.style.height = 'auto';
        const clientMessageId = `${currentUserId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        seenClientMessageIds.add(clientMessageId);
        if (!socket.connected) {
            showNotification('Not connected to server. Please refresh the page.', 'error');
            isSending = false;
            return;
        }
        try {
            const messageElement = createMessageElement(message, true);
            if (messagesArea) {
                messagesArea.appendChild(messageElement);
                scrollToBottom();
            }
            socket.emit('send_message', {
                sender_id: currentUserId, // We already checked it's not null above
                receiver_id: currentConversationUserId,
                message: message,
                client_message_id: clientMessageId
            });
            lastSentMessage = message;
            if (!getConversationItem(currentConversationUserId)) {
                const name = chatUserName?.textContent || `User ${currentConversationUserId}`;
                const avatar = chatUserAvatar?.getAttribute('src') || otherUserPfp || 'https://via.placeholder.com/50';
                ensureConversationItem(currentConversationUserId, name, avatar);
            }
            updateConversationLastMessage(currentConversationUserId, message);
        }
        catch (error) {
            console.error('Error sending message:', error);
            showNotification('Failed to send message. Please try again.', 'error');
        }
        finally {
            isSending = false;
        }
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
                socket.emit('typing', { user_id: currentUserId, receiver_id: currentConversationUserId });
            }
            if (typingTimer)
                clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                if (isTyping && currentConversationUserId) {
                    isTyping = false;
                    socket.emit('stop_typing', { user_id: currentUserId, receiver_id: currentConversationUserId });
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
            scrollToBottom();
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
    // Emoji functionality with proper typing
    if (emojiBtn && emojiPicker && emojiGrid) {
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
            loadEmojiCategory('smileys');
            const emojiCategories = document.querySelectorAll('.emoji-category');
            emojiCategories.forEach(category => {
                category.addEventListener('click', function () {
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
            const emojis = emojiData[category] || [];
            emojiGrid.innerHTML = '';
            emojis.forEach(emoji => {
                const emojiButton = document.createElement('button');
                emojiButton.className = 'emoji-item';
                emojiButton.textContent = emoji;
                emojiButton.addEventListener('click', function () {
                    insertEmoji(emoji);
                });
                emojiGrid.appendChild(emojiButton);
            });
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
            emojiPicker.style.display = 'none';
        }
        emojiBtn.addEventListener('click', function (e) {
            console.log('Emoji button clicked!');
            e.stopPropagation();
            if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
                console.log('Opening emoji picker');
                emojiPicker.style.display = 'flex';
                if (!emojiGrid.children.length) {
                    console.log('Initializing emoji picker');
                    initializeEmojiPicker();
                }
            }
            else {
                console.log('Closing emoji picker');
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
    // Initialize everything
    console.log('Chat TypeScript initialization complete');
});
// === EXTRACTED INLINE SCRIPTS ===
// Test basic functionality
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded - testing elements...');
    console.log('Send button:', document.getElementById('sendBtn'));
    console.log('Message input:', document.getElementById('messageInput'));
    console.log('Messages area:', document.getElementById('messagesArea'));
    // Test if Socket.IO is available
    if (typeof io !== 'undefined') {
        console.log('Socket.IO is available');
    }
    else {
        console.error('Socket.IO is NOT available');
    }
});
// Initialize chat after DOM is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    console.log('Chat initialized');
    // Any additional initialization can go here
});
