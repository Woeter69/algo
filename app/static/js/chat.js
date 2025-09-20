// Integrated Chat JavaScript - Combines Pranjul's UI with Backend Socket.IO functionality
document.addEventListener('DOMContentLoaded', function() {
  // Socket.IO client initialization with connection diagnostics
  const socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'], // allow fallback to polling if WS fails
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    timeout: 20000,
  });

  // Track online users
  let onlineUsers = new Set();

  // Connection diagnostics
  socket.on('connect_error', (err) => {
    console.warn('Socket connect_error:', err?.message || err);
  });
  socket.on('reconnect_error', (err) => {
    console.warn('Socket reconnect_error:', err?.message || err);
  });
  socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);
  });

  // Handle connection established
  socket.on('connect', () => {
    // Tell server this user is online
    if (currentUserId) {
      socket.emit('user_online', { user_id: currentUserId });
    }
    // Load initial online status
    loadOnlineStatus();
  });

  // Handle user status changes
  socket.on('user_status_changed', (data) => {
    const { user_id, is_online } = data;
    if (is_online) {
      onlineUsers.add(user_id);
    } else {
      onlineUsers.delete(user_id);
    }
    updateUserOnlineStatus(user_id, is_online);
  });

  // Get user data from backend
  const currentUserId = Number(window.chatData && window.chatData.currentUserId);
  const otherUserId = Number(window.chatData && window.chatData.otherUserId);
  const otherUserName = window.chatData && window.chatData.otherUserName;
  const otherUserPfp = window.chatData && window.chatData.otherUserPfp;

  // Join room if we have both users
  if (currentUserId && otherUserId) {
    socket.emit('join', { user1: currentUserId, user2: otherUserId });
  }

  // ===== DOM ELEMENTS =====
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

  // ===== CURRENT CONVERSATION STATE =====
  let currentConversationUserId = Number(otherUserId || (document.querySelector('.conversation-item.active')?.getAttribute('data-user-id')) || NaN);

  // Track last sent message to avoid duplicate echo rendering on sender
  let lastSentMessage = null;
  // Track client message IDs to suppress echoed duplicates
  const seenClientMessageIds = new Set();
  // Track delivered client ids (confirmed via echo) to avoid false timeouts
  const deliveredClientIds = new Set();

  // Wait for an echo with a matching client_message_id
  function waitForEcho(clientMessageId, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const handler = (data) => {
        if (data && data.client_message_id === clientMessageId) {
          if (done) return;
          done = true;
          socket.off('receive_message', handler);
          resolve({ status: 'echo' });
        }
      };
      socket.on('receive_message', handler);
      const to = setTimeout(() => {
        if (done) return;
        done = true;
        socket.off('receive_message', handler);
        reject(new Error('echo-timeout'));
      }, timeoutMs);
    });
  }

  // ===== SOCKET.IO EVENT HANDLERS =====
  // Receive messages in real-time
  socket.on('receive_message', data => {
    const senderId = Number(data.sender_id);
    const receiverId = Number(data.receiver_id);
    if (data.client_message_id) {
      deliveredClientIds.add(data.client_message_id);
    }
    // Only show message if it's for the current conversation
    if (senderId === currentConversationUserId || receiverId === currentConversationUserId) {
      const isSent = senderId === currentUserId;

      // If echo of our own message identified by client_message_id, skip
      if (data.client_message_id && seenClientMessageIds.has(data.client_message_id)) {
        return;
      }

      // Dedupe: if this is our own message echoing back and identical to last sent, skip
      if (isSent && lastSentMessage && lastSentMessage === data.message) {
        lastSentMessage = null; // reset after skip
        return;
      }

      const messageElement = createMessageElement(data.message, isSent, {
        senderUsername: data.sender_username,
        senderPfp: data.sender_pfp
      });
      messagesArea.appendChild(messageElement);
      scrollToBottom();

      // Update conversation list with new message
      const otherId = isSent ? receiverId : senderId;
      // Ensure conversation item exists (use available data)
      if (!getConversationItem(otherId)) {
        const name = isSent ? (chatUserName?.textContent || `User ${otherId}`) : (data.sender_username || `User ${otherId}`);
        const avatar = isSent ? (chatUserAvatar?.getAttribute('src') || otherUserPfp) : (data.sender_pfp || 'https://via.placeholder.com/50');
        ensureConversationItem(otherId, name, avatar);
      }
      updateConversationLastMessage(otherId, data.message);
    }
  });

  // Optional: typing indicators if backend supports
  socket.on('user_typing', data => {
    if (String(data.user_id) === String(currentConversationUserId)) {
      showTypingIndicator();
    }
  });

  socket.on('user_stopped_typing', data => {
    if (String(data.user_id) === String(currentConversationUserId)) {
      hideTypingIndicator();
    }
  });

  // ===== MESSAGE SENDING FUNCTIONALITY =====
  let isSending = false; // Prevent multiple sends
  
  async function sendMessage() {
    const message = messageInput.value.trim();
    
    if ((!message && !selectedImage) || !currentConversationUserId || isSending) {
      return;
    }

    // Set sending flag to prevent duplicates
    isSending = true;

    // Clear input immediately to prevent re-sending
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Generate client-side id for dedupe on echo
    const clientMessageId = `${currentUserId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    seenClientMessageIds.add(clientMessageId);

    // Send via Socket.IO to backend
    if (!socket.connected) {
      showNotification('Not connected to server. Please refresh the page.', 'error');
      isSending = false;
      return;
    }

    // Handle image upload if present
    if (selectedImage) {
      try {
        const imageUrl = await uploadImage(selectedImage);
        const imageMessage = `<img src="${imageUrl}" alt="Image" class="chat-image">`;
        
        // Update UI with image
        const messageElement = createImageMessageElement(imageUrl, true);
        messagesArea.appendChild(messageElement);
        scrollToBottom();
        
        // Send image message via Socket.IO
        socket.emit('send_message', {
          sender_id: currentUserId,
          receiver_id: currentConversationUserId,
          message: imageMessage,
          message_type: 'image',
          client_message_id: clientMessageId
        });
        
        // Clear image preview
        window.removeImagePreview();
        
      } catch (error) {
        console.error('Image upload failed:', error);
        showNotification('Image upload failed. Please try again.', 'error');
      }
    } else {
      // Update UI immediately with text message
      const messageElement = createMessageElement(message, true);
      messagesArea.appendChild(messageElement);
      scrollToBottom();
    
      // Send via Socket.IO (fast, no waiting for ack)
      socket.emit('send_message', {
        sender_id: currentUserId,
        receiver_id: currentConversationUserId,
        message: message,
        client_message_id: clientMessageId
      });
    }
    
    // Reset sending flag immediately for faster UX
    isSending = false;

    // Remember last sent to avoid duplicate on echo
    lastSentMessage = message;

    // Update conversation list
    // Ensure there is a conversation item for this user on send
    if (!getConversationItem(currentConversationUserId)) {
      const name = chatUserName?.textContent || `User ${currentConversationUserId}`;
      const avatar = chatUserAvatar?.getAttribute('src') || otherUserPfp || 'https://via.placeholder.com/50';
      ensureConversationItem(currentConversationUserId, name, avatar);
    }
    updateConversationLastMessage(currentConversationUserId, message);
    updateRightSidebarLastMessage(currentConversationUserId, message);
  }

  // Conversation switching
  conversationItems.forEach(item => {
    item.addEventListener('click', function() {
      // Remove active class from all items
      conversationItems.forEach(i => i.classList.remove('active'));

      // Add active class to clicked item
      this.classList.add('active');

      // Get user data
      const userId = Number(this.getAttribute('data-user-id'));
      currentConversationUserId = userId;

      // Update chat header
      const userName = this.querySelector('h4')?.textContent || 'Conversation';
      if (chatUserName) chatUserName.textContent = userName;

      // Join new room if switching conversations
      if (currentUserId && userId) {
        socket.emit('join', { user1: currentUserId, user2: userId });
      }

      // Remove unread badge
      const unreadBadge = this.querySelector('.unread-badge');
      if (unreadBadge) unreadBadge.remove();

      // Scroll to bottom of messages
      scrollToBottom();
    });
  });

  // Message input auto-resize and typing indicators
  if (messageInput) {
    let typingTimer;

    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';

      // Emit typing events if backend supports (faster response)
      if (this.value.trim() && currentConversationUserId) {
        socket.emit('typing', {
          user_id: currentUserId,
          receiver_id: currentConversationUserId
        });

        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          socket.emit('stop_typing', {
            user_id: currentUserId,
            receiver_id: currentConversationUserId
          });
        }, 800); // Reduced from 2000ms to 800ms for faster response
      }
    });

    // Send message on Enter (allow Shift+Enter for newline)
    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();

        if (currentConversationUserId) {
          socket.emit('stop_typing', {
            user_id: currentUserId,
            receiver_id: currentConversationUserId
          });
        }
      }
    });
  }

  // Send button click
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  // ===== UTILITY FUNCTIONS =====
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Detect user's timezone and locale
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userLocale = navigator.language || 'en-US';

  function formatLocalTime(date = new Date()) {
    // Format time in user's local timezone
    return date.toLocaleTimeString(userLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: userTimeZone
    });
  }

  function formatLocalDateTime(date = new Date()) {
    // Format full date-time in user's local timezone
    return date.toLocaleString(userLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: userTimeZone
    });
  }

  function formatRelativeTime(date) {
    // Format relative time (e.g., "2 minutes ago", "Yesterday", etc.)
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older messages, show actual date
    return formatLocalDateTime(date);
  }

  function getTimeZoneAbbreviation() {
    // Get timezone abbreviation (e.g., IST, PST, GMT)
    const formatter = new Intl.DateTimeFormat('en', {
      timeZoneName: 'short',
      timeZone: userTimeZone
    });
    const parts = formatter.formatToParts(new Date());
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart ? timeZonePart.value : '';
  }

  function convertUTCToLocal(utcTimestamp) {
    // Convert UTC timestamp (in milliseconds) to local Date object
    if (!utcTimestamp) return new Date();
    return new Date(utcTimestamp);
  }

  // Initialize timezone display on page load
  function initializeTimezoneDisplay() {
    const tzAbbr = getTimeZoneAbbreviation();
    
    // Update timezone indicator in header
    const timezoneIndicator = document.getElementById('timezoneIndicator');
    if (timezoneIndicator) {
      timezoneIndicator.textContent = `Times shown in ${tzAbbr}`;
    }
    
    // Update all existing timestamps to local time
    updateExistingTimestamps();
  }

  function updateExistingTimestamps() {
    // Update message timestamps
    document.querySelectorAll('.message-time').forEach(timeElement => {
      const utcTimestamp = timeElement.getAttribute('data-utc-timestamp');
      if (utcTimestamp) {
        const localDate = convertUTCToLocal(parseInt(utcTimestamp));
        timeElement.textContent = formatLocalTime(localDate);
      }
    });

    // Update conversation timestamps
    document.querySelectorAll('.conversation-time, .history-time').forEach(timeElement => {
      const utcTimestamp = timeElement.getAttribute('data-utc-timestamp');
      if (utcTimestamp) {
        const localDate = convertUTCToLocal(parseInt(utcTimestamp));
        timeElement.textContent = formatRelativeTime(localDate);
      }
    });
  }

  // ===== MESSAGE CREATION FUNCTION =====
  function createMessageElement(text, isSent = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

    const currentTime = formatLocalTime();

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
      const avatarSrc = otherUserPfp || 'https://via.placeholder.com/32';
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

  function createImageMessageElement(imageUrl, isSent = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message image ${isSent ? 'sent' : 'received'}`;

    const currentTime = formatLocalTime();

    if (isSent) {
      messageDiv.innerHTML = `
        <div class="message-content">
          <div class="message-bubble">
            <img src="${imageUrl}" alt="Image" onclick="openImageModal('${imageUrl}')">
          </div>
          <div class="message-time">${currentTime}</div>
        </div>
      `;
    } else {
      const avatarSrc = otherUserPfp || 'https://via.placeholder.com/32';
      messageDiv.innerHTML = `
        <div class="message-avatar">
          <img src="${escapeHtml(avatarSrc)}" alt="">
        </div>
        <div class="message-content">
          <div class="message-bubble">
            <img src="${imageUrl}" alt="Image" onclick="openImageModal('${imageUrl}')">
          </div>
          <div class="message-time">${currentTime}</div>
        </div>
      `;
    }

    return messageDiv;
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upload_image', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.image_url;
  }

  // Image modal for full-screen view
  window.openImageModal = function(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-content">
        <span class="image-modal-close">&times;</span>
        <img src="${imageUrl}" alt="Full size image">
      </div>
    `;
    
    modal.addEventListener('click', function(e) {
      if (e.target === modal || e.target.className === 'image-modal-close') {
        modal.remove();
      }
    });
    
    document.body.appendChild(modal);
  };

  // ===== TYPING INDICATOR FUNCTIONS =====
  function showTypingIndicator() {
    if (typingIndicator) {
      typingIndicator.style.display = 'flex';
      // Position typing indicator after the last message
      const lastMessage = messagesArea.querySelector('.message:last-child');
      if (lastMessage) {
        lastMessage.insertAdjacentElement('afterend', typingIndicator);
      }
      scrollToBottom();
    }
  }

  function hideTypingIndicator() {
    if (typingIndicator) {
      typingIndicator.style.display = 'none';
    }
  }

  // ===== UTILITY FUNCTIONS =====
  let rAFPending = false;
  function scrollToBottom() {
    if (!messagesArea) return;
    if (rAFPending) return;
    rAFPending = true;
    requestAnimationFrame(() => {
      messagesArea.scrollTop = messagesArea.scrollHeight;
      rAFPending = false;
    });
  }

  function updateConversationLastMessage(userId, message) {
    const conversationItem = document.querySelector(`[data-user-id="${userId}"]`);
    if (conversationItem) {
      const lastMessageElement = conversationItem.querySelector('.last-message');
      if (lastMessageElement) {
        lastMessageElement.textContent = message.length > 50 ? message.substring(0, 50) + '...' : message;
      }
      const timeElement = conversationItem.querySelector('.conversation-time');
      if (timeElement) timeElement.textContent = 'now';
    }
  }

  function updateRightSidebarLastMessage(userId, message) {
    // Update right sidebar chat history
    const historyItems = document.querySelectorAll('.history-item');
    historyItems.forEach(item => {
      const itemUserId = item.getAttribute('onclick')?.match(/\/chat\/(\w+)/)?.[1];
      if (itemUserId) {
        // Find user by username - we need to check if this matches current conversation
        const historyLastMessage = item.querySelector('.history-last-message');
        const historyTime = item.querySelector('.history-time');
        if (historyLastMessage && historyTime) {
          // Update if this is the current conversation
          const currentTime = formatLocalTime();
          historyLastMessage.textContent = message.length > 30 ? message.substring(0, 30) + '...' : message;
          historyTime.textContent = currentTime;
        }
      }
    });
  }

  function getConversationItem(userId) {
    return document.querySelector(`[data-user-id="${userId}"]`);
  }

  function ensureConversationItem(userId, name, avatarUrl) {
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
    // Attach click behavior as with others
    wrapper.addEventListener('click', function() {
      conversationItems.forEach(i => i.classList.remove('active'));
      wrapper.classList.add('active');
      const newId = Number(wrapper.getAttribute('data-user-id'));
      currentConversationUserId = newId;
      if (chatUserName) chatUserName.textContent = name || `User ${newId}`;
      if (currentUserId && newId) {
        socket.emit('join', { user1: currentUserId, user2: newId });
      }
      const unreadBadge = wrapper.querySelector('.unread-badge');
      if (unreadBadge) unreadBadge.remove();
      scrollToBottom();
    });
    return wrapper;
  }

  // ===== MESSAGE USER BUTTONS =====
  const messageUserBtns = document.querySelectorAll('.message-user-btn');
  messageUserBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const userItem = this.closest('.user-item');
      const userName = userItem.querySelector('h4')?.textContent || 'New chat';
      const userId = userItem.getAttribute('data-user-id');

      // Close modal
      closeModal();

      // Start conversation with this user
      currentConversationUserId = userId;
      if (chatUserName) chatUserName.textContent = userName;

      // Join room
      if (currentUserId && userId) {
        socket.emit('join', { user1: currentUserId, user2: userId });
      }

      // Simple toast
      showNotification(`Started conversation with ${userName}`, 'success');
    });
  });

  // ===== CHAT ACTION BUTTONS =====
  const chatActionBtns = document.querySelectorAll('.chat-action-btn');
  chatActionBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const icon = this.querySelector('i');
      let action = '';
      if (icon.classList.contains('fa-phone')) action = 'Voice call';
      else if (icon.classList.contains('fa-video')) action = 'Video call';
      else if (icon.classList.contains('fa-ellipsis-v')) action = 'More options';
      showNotification(`${action} feature coming soon!`, 'info');
    });
  });

  // ===== ATTACHMENT AND EMOJI BUTTONS =====
  const attachmentBtn = document.querySelector('.attachment-btn');
  const emojiBtn = document.querySelector('.emoji-btn');
  if (attachmentBtn) attachmentBtn.addEventListener('click', () => showNotification('File attachment feature coming soon!', 'info'));
  if (emojiBtn) emojiBtn.addEventListener('click', () => showNotification('Emoji picker coming soon!', 'info'));

  // ===== NOTIFICATION FUNCTION =====
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    let icon = 'fas fa-info-circle';
    let bgColor = '#6D28D9';
    if (type === 'success') { icon = 'fas fa-check-circle'; bgColor = '#10b981'; }
    else if (type === 'error') { icon = 'fas fa-exclamation-circle'; bgColor = '#ef4444'; }
    notification.innerHTML = `
      <div class="notification-content">
        <i class="${icon}"></i>
        <span>${message}</span>
      </div>
    `;
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: ${bgColor}; color: white;
      padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,.2);
      z-index: 3000; transform: translateX(100%); transition: all .3s ease; max-width: 400px; word-wrap: break-word;`;
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 100);
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => { notification.style.transform = 'translateX(100%)'; setTimeout(() => notification.remove(), 300); }, duration);
  }

  // ===== IMAGE ERROR HANDLING =====
  function handleImageError(img) {
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent) parent.classList.add('default-avatar');
  }

  function initializeImageErrorHandlers() {
    const allImages = document.querySelectorAll('.conversation-avatar img, .chat-avatar img, .message-avatar img, .user-avatar img');
    allImages.forEach(img => {
      if (!img.complete || img.naturalHeight === 0) handleImageError(img);
      img.addEventListener('error', function() { handleImageError(this); });
      if (!img.src || img.src.includes('placeholder') || img.src === '') handleImageError(img);
    });
  }

  // ===== EMIT WITH ACK FUNCTION =====
  function emitWithAck(eventName, payload, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      let done = false;
      const to = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('ack-timeout'));
      }, timeoutMs);
      try {
        socket.emit(eventName, payload, (response) => {
          if (done) return;
          done = true;
          clearTimeout(to);
          resolve(response);
        });
      } catch (e) {
        clearTimeout(to);
        reject(e);
      }
    });
  }

  // ===== INITIALIZATION =====
  
  // Initialize right sidebar history items (if they exist)
  const historyItems = document.querySelectorAll('.history-item');
  historyItems.forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('onclick')?.match(/window\.location\.href='([^']+)'/)?.[1];
      if (href) {
        window.location.href = href;
      }
    });
  });

  // Initialize emoji picker and file attachment
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const emojiGrid = document.getElementById('emojiGrid');
  const attachmentBtn = document.getElementById('attachmentBtn');
  const fileInput = document.getElementById('fileInput');
  let selectedImage = null;

  // Emoji data
  const emojiData = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥'],
    people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻'],
    nature: ['🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌶️', '🍄', '🌾', '💐', '🌿', '🍀', '🍃', '🍂', '🍁', '🌊', '🌀', '🌈', '🌂', '☂️', '☔', '⛱️', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧', '🌟', '⭐'],
    food: ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🥗', '🍿', '🧈', '🧂', '🥨', '🥖', '🍞', '🥐', '🥯', '🧇', '🥞', '🍰', '🎂', '🧁', '🥧', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺'],
    travel: ['✈️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍', '🚎', '🚐', '🚑', '🚒', '🚓', '🚔', '🚕', '🚖', '🚗', '🚘', '🚙', '🛻', '🚚', '🚛'],
    objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏']
  };

  // Initialize new chat modal functionality
  const newChatBtn = document.getElementById('newChatBtn');
  const newChatModal = document.getElementById('newChatModal');
  const closeModal = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const startChatBtn = document.getElementById('startChatBtn');
  const usernameInput = document.getElementById('usernameInput');
  const modalError = document.getElementById('modalError');

  if (newChatBtn && newChatModal) {
    // Open modal
    newChatBtn.addEventListener('click', function() {
      newChatModal.style.display = 'flex';
      usernameInput.focus();
      modalError.style.display = 'none';
      usernameInput.value = '';
    });

    // Close modal functions
    function closeNewChatModal() {
      newChatModal.style.display = 'none';
      usernameInput.value = '';
      modalError.style.display = 'none';
    }

    closeModal?.addEventListener('click', closeNewChatModal);
    cancelBtn?.addEventListener('click', closeNewChatModal);

    // Close modal on overlay click
    newChatModal.addEventListener('click', function(e) {
      if (e.target === newChatModal) {
        closeNewChatModal();
      }
    });

    // Start chat functionality
    startChatBtn?.addEventListener('click', async function() {
      const username = usernameInput.value.trim();
      if (!username) {
        showModalError('Please enter a username');
        return;
      }

      // Disable button and show loading
      startChatBtn.disabled = true;
      startChatBtn.textContent = 'Checking...';

      try {
        // Check if user exists by trying to navigate to their chat
        const response = await fetch(`/chat/${username}`, { method: 'HEAD' });
        if (response.ok) {
          // User exists, navigate to chat
          window.location.href = `/chat/${username}`;
        } else if (response.status === 404) {
          showModalError('User not found. Please check the username and try again.');
        } else {
          showModalError('Unable to start chat. Please try again later.');
        }
      } catch (error) {
        console.error('Error checking user:', error);
        showModalError('Network error. Please check your connection and try again.');
      } finally {
        // Re-enable button
        startChatBtn.disabled = false;
        startChatBtn.textContent = 'Start Chat';
      }
    });

    // Enter key to start chat
    usernameInput?.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        startChatBtn.click();
      }
    });

    function showModalError(message) {
      modalError.textContent = message;
      modalError.style.display = 'block';
    }
  }

  // ===== EMOJI PICKER FUNCTIONALITY =====
  if (emojiBtn && emojiPicker) {
    // Initialize emoji picker
    function initializeEmojiPicker() {
      loadEmojiCategory('smileys');
      
      // Category switching
      const emojiCategories = document.querySelectorAll('.emoji-category');
      emojiCategories.forEach(category => {
        category.addEventListener('click', function() {
          emojiCategories.forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          loadEmojiCategory(this.getAttribute('data-category'));
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
        emojiButton.addEventListener('click', function() {
          insertEmoji(emoji);
        });
        emojiGrid.appendChild(emojiButton);
      });
    }

    function insertEmoji(emoji) {
      const cursorPos = messageInput.selectionStart;
      const textBefore = messageInput.value.substring(0, cursorPos);
      const textAfter = messageInput.value.substring(cursorPos);
      messageInput.value = textBefore + emoji + textAfter;
      messageInput.focus();
      messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
      emojiPicker.style.display = 'none';
    }

    // Toggle emoji picker
    emojiBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (emojiPicker.style.display === 'none' || !emojiPicker.style.display) {
        emojiPicker.style.display = 'flex';
        if (!emojiGrid.children.length) {
          initializeEmojiPicker();
        }
      } else {
        emojiPicker.style.display = 'none';
      }
    });

    // Close emoji picker when clicking outside
    document.addEventListener('click', function(e) {
      if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.style.display = 'none';
      }
    });
  }

  // ===== FILE ATTACHMENT FUNCTIONALITY =====
  if (attachmentBtn && fileInput) {
    attachmentBtn.addEventListener('click', function() {
      fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        selectedImage = file;
        showImagePreview(file);
      }
    });

    function showImagePreview(file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        // Remove existing preview
        const existingPreview = document.querySelector('.image-preview');
        if (existingPreview) {
          existingPreview.remove();
        }

        // Create preview
        const preview = document.createElement('div');
        preview.className = 'image-preview';
        preview.innerHTML = `
          <img src="${e.target.result}" alt="Image preview">
          <button class="remove-image" onclick="removeImagePreview()">×</button>
        `;

        // Insert before message input
        const inputContainer = document.querySelector('.message-input-area');
        inputContainer.parentNode.insertBefore(preview, inputContainer);
      };
      reader.readAsDataURL(file);
    }

    // Make removeImagePreview globally accessible
    window.removeImagePreview = function() {
      const preview = document.querySelector('.image-preview');
      if (preview) {
        preview.remove();
      }
      selectedImage = null;
      fileInput.value = '';
    };
  }

  // ===== ONLINE STATUS FUNCTIONS =====
  async function loadOnlineStatus() {
    try {
      const response = await fetch('/api/online_status');
      if (response.ok) {
        const data = await response.json();
        onlineUsers = new Set(data.online_users.map(id => Number(id)));
        updateAllOnlineStatuses();
      }
    } catch (error) {
      console.error('Error loading online status:', error);
    }
  }

  function updateUserOnlineStatus(userId, isOnline) {
    const userIdNum = Number(userId);
    
    // Update conversation list items
    const conversationItems = document.querySelectorAll('.conversation-item');
    conversationItems.forEach(item => {
      const itemUserId = Number(item.getAttribute('data-user-id'));
      if (itemUserId === userIdNum) {
        const onlineStatus = item.querySelector('.online-status');
        if (onlineStatus) {
          if (isOnline) {
            onlineStatus.classList.add('online');
          } else {
            onlineStatus.classList.remove('online');
          }
        }
      }
    });

    // Update chat header if this is the current conversation user
    if (userIdNum === otherUserId) {
      const chatUserStatus = document.getElementById('chatUserStatus');
      const chatUserOnlineStatus = document.getElementById('chatUserOnlineStatus');
      
      if (chatUserStatus) {
        if (isOnline) {
          chatUserStatus.classList.add('online');
        } else {
          chatUserStatus.classList.remove('online');
        }
      }
      
      if (chatUserOnlineStatus) {
        chatUserOnlineStatus.textContent = isOnline ? 'Active now' : 'Last seen recently';
      }
    }
  }

  function updateAllOnlineStatuses() {
    // Update all conversation items based on current online users
    const conversationItems = document.querySelectorAll('.conversation-item');
    conversationItems.forEach(item => {
      const itemUserId = Number(item.getAttribute('data-user-id'));
      const isOnline = onlineUsers.has(itemUserId);
      const onlineStatus = item.querySelector('.online-status');
      if (onlineStatus) {
        if (isOnline) {
          onlineStatus.classList.add('online');
        } else {
          onlineStatus.classList.remove('online');
        }
      }
    });

    // Update current chat user status
    if (otherUserId) {
      const isOnline = onlineUsers.has(otherUserId);
      updateUserOnlineStatus(otherUserId, isOnline);
    }
  }

  initializeImageErrorHandlers();
  initializeTimezoneDisplay();
  scrollToBottom();
  if (otherUserName && chatUserName && currentConversationUserId) chatUserName.textContent = otherUserName;
});
