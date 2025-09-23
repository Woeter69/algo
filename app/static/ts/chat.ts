// Using global io from CDN instead of imports
declare const io: any;

// Prevent multiple initializations
if ((window as any).chatInitialized) {
    console.log('Chat already initialized, skipping...');
} else {
    (window as any).chatInitialized = true;
    
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 Chat.ts initializing - DOM ready');
    
    // Get user data from the template with type safety
    const chatData: any = (window as any).chatData || {};
    console.log('Chat data:', chatData);
    
    const currentUserId: number | null = chatData.currentUserId ? Number(chatData.currentUserId) : null;
    const otherUserId: number | null = chatData.otherUserId ? Number(chatData.otherUserId) : null;
    const otherUserName: string = chatData.otherUserName || '';
    const otherUserPfp: string = chatData.otherUserPfp || '';

    console.log('User IDs:', { currentUserId, otherUserId });

    if (!currentUserId) {
        console.error('No current user ID - user might not be logged in');
        return;
    }

    // Initialize Socket.IO with proper typing
    console.log('Initializing Socket.IO connection...');
    const socket: any = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'], 
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 500,
        timeout: 20000,
    });

    let onlineUsers = new Set<number>();
    let isTyping = false;
    let typingTimeout: NodeJS.Timeout | null = null;

    // Online Status Management
    const chatUserStatus = document.getElementById('chatUserStatus') as HTMLElement;
    const chatUserOnlineStatus = document.getElementById('chatUserOnlineStatus') as HTMLElement;

    function updateUserOnlineStatus(userId: number, isOnline: boolean): void {
        // Update chat header status for the current conversation
        if (userId === otherUserId) {
            if (chatUserStatus) {
                if (isOnline) {
                    chatUserStatus.classList.add('online');
                } else {
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
            } else {
                element.classList.remove('online');
            }
        });
    }

    // Fetch initial online status
    async function fetchOnlineStatus(): Promise<void> {
        try {
            const response = await fetch('/api/online_status');
            if (response.ok) {
                const data: { online_users: number[] } = await response.json();
                onlineUsers.clear();
                data.online_users.forEach(userId => onlineUsers.add(userId));
                
                // Update the current chat user's status
                if (otherUserId) {
                    updateUserOnlineStatus(otherUserId, onlineUsers.has(otherUserId));
                }
            }
        } catch (error) {
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
    socket.on('connect_error', (err: any) => {
        console.error('Socket connect_error:', err?.message || err);
    });
    
    // Note: reconnect_error is not in the standard Socket.IO events, using connect_error instead
    socket.on('connect_error', (err: any) => {
        console.error('Socket reconnect_error:', err?.message || err);
    });
    
    socket.on('disconnect', (reason: string) => {
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

    socket.on('user_status_changed', (data: any) => {
        console.log('User status changed:', data);
        const { user_id, is_online } = data;
        if (is_online) {
            onlineUsers.add(user_id);
        } else {
            onlineUsers.delete(user_id);
        }
        updateUserOnlineStatus(user_id, is_online);
    });

    // DOM Elements with proper type assertions
    const conversationItems = document.querySelectorAll<HTMLElement>('.conversation-item');
    const messagesArea = document.getElementById('messagesArea') as HTMLElement | null;
    const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement | null;
    const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement | null;
    const newMessageBtn = document.getElementById('newMessageBtn') as HTMLButtonElement | null;
    const newMessageModal = document.getElementById('newMessageModal') as HTMLElement | null;
    const closeNewMessageModal = document.getElementById('closeNewMessageModal') as HTMLButtonElement | null;
    const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
    const userSearchInput = document.getElementById('userSearchInput') as HTMLInputElement | null;
    const typingIndicator = document.getElementById('typingIndicator') as HTMLElement | null;
    const chatUserName = document.getElementById('chatUserName') as HTMLElement | null;
    const chatUserAvatar = document.getElementById('chatUserAvatar') as HTMLImageElement | null;

    // Emoji elements with type safety
    const emojiBtn = document.getElementById('emojiBtn') as HTMLButtonElement | null;
    const emojiPicker = document.getElementById('emojiPicker') as HTMLElement | null;
    const emojiGrid = document.getElementById('emojiGrid') as HTMLElement | null;
    
    // File attachment elements
    const attachmentBtn = document.getElementById('attachmentBtn') as HTMLButtonElement | null;
    const fileInput = document.getElementById('fileInput') as HTMLInputElement | null;
    
    // Call buttons
    const voiceCallBtn = document.querySelector('.chat-action-btn[title="Voice call"]') as HTMLButtonElement | null;
    const videoCallBtn = document.querySelector('.chat-action-btn[title="Video call"]') as HTMLButtonElement | null;
    const moreOptionsBtn = document.querySelector('.chat-action-btn[title="More options"]') as HTMLButtonElement | null;
    
    console.log('UI elements:', { emojiBtn, emojiPicker, emojiGrid, attachmentBtn, fileInput, voiceCallBtn, videoCallBtn });
    
    // Debug emoji elements specifically
    if (!emojiBtn) console.error('❌ Emoji button not found!');
    if (!emojiPicker) console.error('❌ Emoji picker not found!');
    if (!emojiGrid) console.error('❌ Emoji grid not found!');

    // Current conversation tracking
    let currentConversationUserId: number = otherUserId || 0;

    // Message tracking for deduplication
    const processedMessages = new Set<string>();
    let lastSentMessageTime = 0;

    // Socket message handlers with deduplication
    socket.on('receive_message', (data: any) => {
        console.log('📨 Message received:', data);
        
        const senderId = Number(data.sender_id);
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
    socket.on('user_typing', (data: { user_id: number }) => {
        if (String(data.user_id) === String(currentConversationUserId)) {
            showTypingIndicator();
        }
    });

    socket.on('user_stopped_typing', (data: { user_id: number }) => {
        if (String(data.user_id) === String(currentConversationUserId)) {
            hideTypingIndicator();
        }
    });

    // Send message function with proper typing and deduplication
    let isSending = false;
    
    async function sendMessage(): Promise<void> {
        if (!messageInput) return;
        
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

            socket.emit('send_message', {
                sender_id: currentUserId!,
                receiver_id: otherUserId,
                message: message,
                client_message_id: `${currentUserId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
            });

            // Update conversation list
            updateConversationLastMessage(otherUserId, message);

        } catch (error) {
            console.error('Error sending message:', error);
            showNotification('Failed to send message. Please try again.', 'error');
            
            // Restore message to input on error
            messageInput.value = message;
        } finally {
            isSending = false;
        }
    }

    // Event listeners with null checks
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (messageInput) {
        let typingTimer: NodeJS.Timeout | null = null;

        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';

            if (!isTyping && currentConversationUserId) {
                isTyping = true;
                socket.emit('typing', { user_id: currentUserId!, receiver_id: currentConversationUserId });
            }

            if (typingTimer) clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                if (isTyping && currentConversationUserId) {
                    isTyping = false;
                    socket.emit('stop_typing', { user_id: currentUserId!, receiver_id: currentConversationUserId });
                }
            }, 1000);
        });

        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Utility functions with proper typing
    function escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function createMessageElement(text: string, isSent: boolean = false, options?: {
        senderUsername?: string;
        senderPfp?: string;
    }): HTMLElement {
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
        } else {
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

    function showTypingIndicator(): void {
        if (typingIndicator) {
            typingIndicator.style.display = 'flex';
            // No need to scroll when showing typing indicator since it's at bottom
        }
    }

    function hideTypingIndicator(): void {
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
    }

    function scrollToBottom(): void {
        if (!messagesArea) return;
        requestAnimationFrame(() => {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        });
    }

    function updateConversationLastMessage(userId: number, message: string): void {
        const conversationItem = document.querySelector(`[data-user-id="${userId}"]`) as HTMLElement;
        if (conversationItem) {
            const lastMessageElement = conversationItem.querySelector('.last-message') as HTMLElement;
            if (lastMessageElement) {
                lastMessageElement.textContent = message.length > 50 ? message.substring(0, 50) + '...' : message;
            }
        }
    }

    function getConversationItem(userId: number): HTMLElement | null {
        return document.querySelector(`[data-user-id="${userId}"]`) as HTMLElement | null;
    }

    function ensureConversationItem(userId: number, name: string, avatarUrl: string): HTMLElement | null {
        let item = getConversationItem(userId);
        if (item) return item;
        
        const list = document.getElementById('conversationsList');
        if (!list) return null;

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
        
        wrapper.addEventListener('click', function() {
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

    function showNotification(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        let icon = 'fas fa-info-circle';
        let bgColor = '#6D28D9';
        
        if (type === 'success') { 
            icon = 'fas fa-check-circle'; 
            bgColor = '#10b981'; 
        } else if (type === 'error') { 
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

    function loadOnlineStatus(): void {
        // Implementation for loading online status
        console.log('Loading online status...');
    }


    // Emoji data and functions
    const emojiData: Record<string, string[]> = {
        smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥'],
        people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'],
        nature: ['🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌶️', '🍄', '🌾', '💐', '🌿', '🍀', '🍃', '🍂', '🍁', '🌊', '🌀', '🌈', '🌂', '☂️', '☔', '⛱️', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧', '🌟', '⭐'],
        food: ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🥗', '🍿', '🧈', '🧂', '🥨', '🥖', '🍞', '🥐', '🥯', '🧇', '🥞', '🍰', '🎂', '🧁', '🥧', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪'],
        activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂'],
        travel: ['✈️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍', '🚎', '🚐', '🚑', '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚘', '🚙', '🛻', '🚚', '🚛'],
        objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️'],
        symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐']
    };

    function initializeEmojiPicker(): void {
        console.log('🚀 Initializing emoji picker...');
        loadEmojiCategory('smileys');
        
        const emojiCategories = document.querySelectorAll<HTMLButtonElement>('.emoji-category');
        console.log('📋 Found emoji categories:', emojiCategories.length);
        emojiCategories.forEach(category => {
            category.addEventListener('click', function() {
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

    function loadEmojiCategory(category: string): void {
        if (!emojiGrid) return;
        console.log('📂 Loading emoji category:', category);
        const emojis = emojiData[category] || [];
        console.log('😀 Found emojis:', emojis.length);
        emojiGrid.innerHTML = '';
        
        emojis.forEach(emoji => {
            const emojiButton = document.createElement('button');
            emojiButton.className = 'emoji-item';
            emojiButton.textContent = emoji;
            emojiButton.addEventListener('click', function() {
                console.log('😀 Emoji clicked:', emoji);
                insertEmoji(emoji);
            });
            emojiGrid.appendChild(emojiButton);
        });
        console.log('✅ Added', emojis.length, 'emojis to grid');
    }

    function insertEmoji(emoji: string): void {
        if (!messageInput) return;
        
        const cursorPos = messageInput.selectionStart;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(cursorPos);
        messageInput.value = textBefore + emoji + textAfter;
        messageInput.focus();
        messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
        if (emojiPicker) emojiPicker.style.display = 'none';
    }

    // Emoji functionality with proper typing
    if (emojiBtn && emojiPicker && emojiGrid) {

        emojiBtn.addEventListener('click', function(e) {
            console.log('🎯 Emoji button clicked!');
            console.log('🔍 Current picker display:', emojiPicker!.style.display);
            console.log('🔍 Picker element:', emojiPicker);
            console.log('🔍 Grid element:', emojiGrid);
            console.log('🔍 Grid children count:', emojiGrid!.children.length);
            
            e.stopPropagation();
            if (emojiPicker!.style.display === 'none' || !emojiPicker!.style.display) {
                console.log('📂 Opening emoji picker');
                emojiPicker!.style.display = 'flex';
                console.log('✅ Set display to flex');
                if (!emojiGrid!.children.length) {
                    console.log('🔄 Initializing emoji picker');
                    initializeEmojiPicker();
                    console.log('✅ Emoji picker initialized, grid children:', emojiGrid!.children.length);
                }
            } else {
                console.log('📁 Closing emoji picker');
                emojiPicker!.style.display = 'none';
            }
        });

        document.addEventListener('click', function(e) {
            if (!emojiPicker!.contains(e.target as Node) && e.target !== emojiBtn) {
                emojiPicker!.style.display = 'none';
            }
        });
    } else {
        console.warn('Emoji elements not found:', { emojiBtn, emojiPicker, emojiGrid });
    }

    // File attachment functionality
    if (attachmentBtn && fileInput) {
        attachmentBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('📎 Attachment button clicked');
            fileInput.click();
        });
        
        fileInput.addEventListener('change', function(e) {
            const files = (e.target as HTMLInputElement).files;
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
    } else {
        console.warn('Attachment elements not found:', { attachmentBtn, fileInput });
    }
    
    // Voice call functionality
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('📞 Voice call button clicked');
            if (otherUserId && otherUserName) {
                initiateVoiceCall(otherUserId, otherUserName);
            } else {
                showNotification('Cannot start call - no user selected', 'error');
            }
        });
    } else {
        console.warn('Voice call button not found');
    }
    
    // Video call functionality
    if (videoCallBtn) {
        videoCallBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('📹 Video call button clicked');
            if (otherUserId && otherUserName) {
                initiateVideoCall(otherUserId, otherUserName);
            } else {
                showNotification('Cannot start video call - no user selected', 'error');
            }
        });
    } else {
        console.warn('Video call button not found');
    }
    
    // More options functionality
    if (moreOptionsBtn) {
        moreOptionsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('⚙️ More options button clicked');
            showMoreOptionsMenu();
        });
    }
    
    // File upload function
    async function uploadFile(file: File): Promise<void> {
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
                    sender_id: currentUserId!,
                    receiver_id: otherUserId,
                    message: `📎 ${file.name}`,
                    file_url: result.file_url,
                    file_type: file.type,
                    file_name: file.name,
                    message_type: 'file'
                });
                
                showNotification('File uploaded successfully!', 'success');
            } else {
                throw new Error('Upload failed');
            }
        } catch (error) {
            console.error('File upload error:', error);
            showNotification('Failed to upload file. Please try again.', 'error');
        } finally {
            // Reset file input
            if (fileInput) {
                fileInput.value = '';
            }
        }
    }
    
    // Voice call function
    function initiateVoiceCall(userId: number, userName: string): void {
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
    function initiateVideoCall(userId: number, userName: string): void {
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
    function showCallModal(callType: 'voice' | 'video', userName: string): void {
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
        
        const callModalElement = modal.querySelector('.call-modal') as HTMLElement;
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
    function showMoreOptionsMenu(): void {
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
            (item as HTMLElement).style.cssText = `
                padding: 0.75rem 1rem; cursor: pointer;
                display: flex; align-items: center; gap: 0.5rem;
                transition: background-color 0.2s;
            `;
            
            item.addEventListener('mouseenter', function() {
                (this as HTMLElement).style.backgroundColor = '#f3f4f6';
            });
            
            item.addEventListener('mouseleave', function() {
                (this as HTMLElement).style.backgroundColor = 'transparent';
            });
            
            item.addEventListener('click', function() {
                const action = this.getAttribute('data-action');
                handleMoreOptionsAction(action);
                menu.remove();
            });
        });
        
        document.body.appendChild(menu);
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target as Node)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }
    
    // Handle more options actions
    function handleMoreOptionsAction(action: string | null): void {
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
    function clearChat(): void {
        if (messagesArea) {
            const messages = messagesArea.querySelectorAll('.message');
            messages.forEach(msg => msg.remove());
            showNotification('Chat cleared', 'success');
        }
    }
    
    // Block user function
    function blockUser(): void {
        // Implement block user API call
        showNotification(`${otherUserName} has been blocked`, 'success');
    }
    
    // Report user function
    function reportUser(): void {
        const reason = prompt('Please provide a reason for reporting this user:');
        if (reason && reason.trim()) {
            // Implement report user API call
            showNotification('User reported successfully', 'success');
        }
    }
    
    // Socket event handlers for calls
    socket.on('incoming_call', (data: any) => {
        console.log('📞 Incoming call:', data);
        showIncomingCallModal(data);
    });
    
    socket.on('call_ended', (data: any) => {
        console.log('📞 Call ended:', data);
        const callModal = document.querySelector('.call-modal-overlay');
        if (callModal) {
            callModal.remove();
        }
        showNotification('Call ended', 'info');
    });
    
    // Show incoming call modal
    function showIncomingCallModal(callData: any): void {
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
    (window as any).acceptCall = function(callId: string) {
        socket.emit('accept_call', { call_id: callId });
        const modal = document.querySelector('.incoming-call');
        if (modal) modal.remove();
        showNotification('Call accepted', 'success');
    };
    
    (window as any).declineCall = function(callId: string) {
        socket.emit('decline_call', { call_id: callId });
        const modal = document.querySelector('.incoming-call');
        if (modal) modal.remove();
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
    (window as any).testEmojiPicker = function() {
        console.log('🧪 Testing emoji picker...');
        console.log('Elements found:', { emojiBtn, emojiPicker, emojiGrid });
        if (emojiPicker) {
            emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'flex' : 'none';
            console.log('Toggled emoji picker display to:', emojiPicker.style.display);
        }
    };
    
    // Initialize everything
    console.log('✅ Chat TypeScript initialization complete');
    });
}
