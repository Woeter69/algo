// Chat JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Elements
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
    const chatUserStatus = document.getElementById('chatUserStatus');
    const chatUserOnlineStatus = document.getElementById('chatUserOnlineStatus');

    // Sample user data
    const users = {
        1: {
            name: 'Sarah Johnson',
            avatar: 'https://via.placeholder.com/50',
            online: true,
            lastSeen: 'Active now'
        },
        2: {
            name: 'Mike Chen',
            avatar: 'https://via.placeholder.com/50',
            online: false,
            lastSeen: 'Last seen 1 hour ago'
        },
        3: {
            name: 'Emily Davis',
            avatar: 'https://via.placeholder.com/50',
            online: true,
            lastSeen: 'Active now'
        },
        4: {
            name: 'Alex Rodriguez',
            avatar: 'https://via.placeholder.com/50',
            online: false,
            lastSeen: 'Last seen yesterday'
        },
        5: {
            name: 'Jessica Kim',
            avatar: 'https://via.placeholder.com/50',
            online: true,
            lastSeen: 'Active now'
        }
    };

    // Conversation switching
    conversationItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            conversationItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Get user data
            const userId = this.getAttribute('data-user-id');
            const user = users[userId];
            
            if (user) {
                // Update chat header
                chatUserName.textContent = user.name;
                chatUserAvatar.src = user.avatar;
                chatUserOnlineStatus.textContent = user.lastSeen;
                
                // Update online status
                if (user.online) {
                    chatUserStatus.classList.add('online');
                } else {
                    chatUserStatus.classList.remove('online');
                }
            }
            
            // Remove unread badge
            const unreadBadge = this.querySelector('.unread-badge');
            if (unreadBadge) {
                unreadBadge.remove();
            }
            
            // Scroll to bottom of messages
            scrollToBottom();
        });
    });

    // Message input auto-resize
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            
            // Show typing indicator (simulate)
            if (this.value.trim()) {
                simulateTyping();
            }
        });

        // Send message on Enter (but allow Shift+Enter for new line)
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Send button click
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    // Send message function
    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        // Create message element
        const messageElement = createMessageElement(message, true);
        
        // Add to messages area
        messagesArea.appendChild(messageElement);
        
        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // Scroll to bottom
        scrollToBottom();
        
        // Simulate response after delay
        setTimeout(() => {
            simulateResponse();
        }, 1000 + Math.random() * 2000);
    }

    // Create message element
    function createMessageElement(text, isSent = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
        
        const currentTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (isSent) {
            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-bubble">
                        <p>${text}</p>
                    </div>
                    <div class="message-time">${currentTime}</div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <img src="https://via.placeholder.com/32" alt="">
                </div>
                <div class="message-content">
                    <div class="message-bubble">
                        <p>${text}</p>
                    </div>
                    <div class="message-time">${currentTime}</div>
                </div>
            `;
        }
        
        return messageDiv;
    }

    // Simulate typing indicator
    function simulateTyping() {
        if (typingIndicator) {
            typingIndicator.style.display = 'flex';
            scrollToBottom();
            
            // Hide after 2 seconds
            setTimeout(() => {
                typingIndicator.style.display = 'none';
            }, 2000);
        }
    }

    // Simulate response
    function simulateResponse() {
        const responses = [
            "That sounds great!",
            "I'll look into that, thanks!",
            "Absolutely, let me know if you need anything else.",
            "Thanks for sharing that information.",
            "I appreciate your help with this.",
            "That's really helpful, thank you!",
            "I'll get back to you on that soon.",
            "Perfect, that works for me."
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const responseElement = createMessageElement(randomResponse, false);
        
        // Hide typing indicator
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
        
        // Add response
        messagesArea.appendChild(responseElement);
        scrollToBottom();
    }

    // Scroll to bottom of messages
    function scrollToBottom() {
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }

    // New message modal
    if (newMessageBtn && newMessageModal) {
        newMessageBtn.addEventListener('click', function() {
            newMessageModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    if (closeNewMessageModal) {
        closeNewMessageModal.addEventListener('click', closeModal);
    }

    // Close modal when clicking outside
    if (newMessageModal) {
        newMessageModal.addEventListener('click', function(e) {
            if (e.target === newMessageModal) {
                closeModal();
            }
        });
    }

    function closeModal() {
        if (newMessageModal) {
            newMessageModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            
            conversationItems.forEach(item => {
                const userName = item.querySelector('h4').textContent.toLowerCase();
                const lastMessage = item.querySelector('.last-message').textContent.toLowerCase();
                
                if (userName.includes(searchTerm) || lastMessage.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    // User search in modal
    if (userSearchInput) {
        userSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const userItems = document.querySelectorAll('.user-item');
            
            userItems.forEach(item => {
                const userName = item.querySelector('h4').textContent.toLowerCase();
                const userTitle = item.querySelector('p').textContent.toLowerCase();
                
                if (userName.includes(searchTerm) || userTitle.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    // Message user buttons in modal
    const messageUserBtns = document.querySelectorAll('.message-user-btn');
    messageUserBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const userItem = this.closest('.user-item');
            const userName = userItem.querySelector('h4').textContent;
            
            // Close modal
            closeModal();
            
            // Show success message
            showNotification(`Started conversation with ${userName}`, 'success');
        });
    });

    // Chat action buttons
    const chatActionBtns = document.querySelectorAll('.chat-action-btn');
    chatActionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const icon = this.querySelector('i');
            let action = '';
            
            if (icon.classList.contains('fa-phone')) {
                action = 'Voice call';
            } else if (icon.classList.contains('fa-video')) {
                action = 'Video call';
            } else if (icon.classList.contains('fa-ellipsis-v')) {
                action = 'More options';
            }
            
            showNotification(`${action} feature coming soon!`, 'info');
        });
    });

    // Attachment and emoji buttons
    const attachmentBtn = document.querySelector('.attachment-btn');
    const emojiBtn = document.querySelector('.emoji-btn');
    
    if (attachmentBtn) {
        attachmentBtn.addEventListener('click', function() {
            showNotification('File attachment feature coming soon!', 'info');
        });
    }
    
    if (emojiBtn) {
        emojiBtn.addEventListener('click', function() {
            showNotification('Emoji picker coming soon!', 'info');
        });
    }

    // Notification function
    function showNotification(message, type = 'info') {
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
            <div class="notification-content">
                <i class="${icon}"></i>
                <span>${message}</span>
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            z-index: 3000;
            transform: translateX(100%);
            transition: all 0.3s ease;
            max-width: 400px;
            word-wrap: break-word;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        const duration = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // Handle image loading errors
    function handleImageError(img) {
        img.style.display = 'none';
        const parent = img.parentElement;
        
        // Add default avatar class
        parent.classList.add('default-avatar');
    }

    // Add error handlers to all existing images
    function initializeImageErrorHandlers() {
        const allImages = document.querySelectorAll('.conversation-avatar img, .chat-avatar img, .message-avatar img, .user-avatar img');
        
        allImages.forEach(img => {
            // Handle already broken images
            if (!img.complete || img.naturalHeight === 0) {
                handleImageError(img);
            }
            
            // Handle future errors
            img.addEventListener('error', function() {
                handleImageError(this);
            });
            
            // Handle empty or placeholder sources
            if (!img.src || img.src.includes('placeholder') || img.src === '') {
                handleImageError(img);
            }
        });
    }

    // Update createMessageElement to handle image errors
    const originalCreateMessageElement = createMessageElement;
    createMessageElement = function(text, isSent = false) {
        const messageElement = originalCreateMessageElement(text, isSent);
        
        // Add error handler to the new image
        const img = messageElement.querySelector('img');
        if (img) {
            img.addEventListener('error', function() {
                handleImageError(this);
            });
            
            if (!img.src || img.src.includes('placeholder') || img.src === '') {
                handleImageError(img);
            }
        }
        
        return messageElement;
    };

    // Initialize image error handlers
    initializeImageErrorHandlers();

    // Initialize - scroll to bottom on load
    scrollToBottom();

    // Simulate some activity
    setTimeout(() => {
        simulateTyping();
    }, 3000);
});