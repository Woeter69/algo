
document.addEventListener('DOMContentLoaded', function() {
  
  const socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'], 
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    timeout: 20000,
  });

  
  let onlineUsers = new Set();

  
  socket.on('connect_error', (err) => {
    console.warn('Socket connect_error:', err?.message || err);
  });
  socket.on('reconnect_error', (err) => {
    console.warn('Socket reconnect_error:', err?.message || err);
  });
  socket.on('disconnect', (reason) => {
    console.warn('Socket disconnected:', reason);
  });

  
  socket.on('connect', () => {
    
    if (currentUserId) {
      socket.emit('user_online', { user_id: currentUserId });
    }
    
    loadOnlineStatus();
  });

  
  socket.on('user_status_changed', (data) => {
    const { user_id, is_online } = data;
    if (is_online) {
      onlineUsers.add(user_id);
    } else {
      onlineUsers.delete(user_id);
    }
    updateUserOnlineStatus(user_id, is_online);
  });

  
  const currentUserId = Number(window.chatData && window.chatData.currentUserId);
  const otherUserId = Number(window.chatData && window.chatData.otherUserId);
  const otherUserName = window.chatData && window.chatData.otherUserName;
  const otherUserPfp = window.chatData && window.chatData.otherUserPfp;

  
  if (currentUserId && otherUserId) {
    socket.emit('join', { user1: currentUserId, user2: otherUserId });
  }

  
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

  
  let currentConversationUserId = Number(otherUserId || (document.querySelector('.conversation-item.active')?.getAttribute('data-user-id')) || NaN);

  
  let lastSentMessage = null;
  
  const seenClientMessageIds = new Set();
  
  const deliveredClientIds = new Set();

  
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

  
  
  socket.on('receive_message', data => {
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

      
      if (isSent && lastSentMessage && lastSentMessage === data.message) {
        lastSentMessage = null; 
        return;
      }

      const messageElement = createMessageElement(data.message, isSent, {
        senderUsername: data.sender_username,
        senderPfp: data.sender_pfp
      });
      messagesArea.appendChild(messageElement);
      scrollToBottom();

      
      const otherId = isSent ? receiverId : senderId;
      
      if (!getConversationItem(otherId)) {
        const name = isSent ? (chatUserName?.textContent || `User ${otherId}`) : (data.sender_username || `User ${otherId}`);
        const avatar = isSent ? (chatUserAvatar?.getAttribute('src') || otherUserPfp) : (data.sender_pfp || 'https:
        ensureConversationItem(otherId, name, avatar);
      }
      updateConversationLastMessage(otherId, data.message);
    }
  });

  
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

  
  let isSending = false; 
  
  async function sendMessage() {
    const message = messageInput.value.trim();
    
    if ((!message && !selectedImage) || !currentConversationUserId || isSending) {
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

    
    if (selectedImage) {
      try {
        const imageUrl = await uploadImage(selectedImage);
        const imageMessage = `<img src="${imageUrl}" alt="Image" class="chat-image">`;
        
        
        const messageElement = createImageMessageElement(imageUrl, true);
        messagesArea.appendChild(messageElement);
        scrollToBottom();
        
        
        socket.emit('send_message', {
          sender_id: currentUserId,
          receiver_id: currentConversationUserId,
          message: imageMessage,
          message_type: 'image',
          client_message_id: clientMessageId
        });
        
        
        window.removeImagePreview();
        
      } catch (error) {
        console.error('Image upload failed:', error);
        showNotification('Image upload failed. Please try again.', 'error');
      }
    } else {
      
      const messageElement = createMessageElement(message, true);
      messagesArea.appendChild(messageElement);
      scrollToBottom();
    
      
      socket.emit('send_message', {
        sender_id: currentUserId,
        receiver_id: currentConversationUserId,
        message: message,
        client_message_id: clientMessageId
      });
    }
    
    
    isSending = false;

    
    lastSentMessage = message;

    
    
    if (!getConversationItem(currentConversationUserId)) {
      const name = chatUserName?.textContent || `User ${currentConversationUserId}`;
      const avatar = chatUserAvatar?.getAttribute('src') || otherUserPfp || 'https:
      ensureConversationItem(currentConversationUserId, name, avatar);
    }
    updateConversationLastMessage(currentConversationUserId, message);
    updateRightSidebarLastMessage(currentConversationUserId, message);
  }

  
  conversationItems.forEach(item => {
    item.addEventListener('click', function() {
      
      conversationItems.forEach(i => i.classList.remove('active'));

      
      this.classList.add('active');

      
      const userId = Number(this.getAttribute('data-user-id'));
      currentConversationUserId = userId;

      
      const userName = this.querySelector('h4')?.textContent || 'Conversation';
      if (chatUserName) chatUserName.textContent = userName;

      
      if (currentUserId && userId) {
        socket.emit('join', { user1: currentUserId, user2: userId });
      }

      
      const unreadBadge = this.querySelector('.unread-badge');
      if (unreadBadge) unreadBadge.remove();

      
      scrollToBottom();
    });
  });

  
  if (messageInput) {
    let typingTimer;

    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';

      
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
        }, 800); 
      }
    });

    
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

  
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userLocale = navigator.language || 'en-US';

  function formatLocalTime(date = new Date()) {
    
    return date.toLocaleTimeString(userLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: userTimeZone
    });
  }

  function formatLocalDateTime(date = new Date()) {
    
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
    
    
    return formatLocalDateTime(date);
  }

  function getTimeZoneAbbreviation() {
    
    const formatter = new Intl.DateTimeFormat('en', {
      timeZoneName: 'short',
      timeZone: userTimeZone
    });
    const parts = formatter.formatToParts(new Date());
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart ? timeZonePart.value : '';
  }

  function convertUTCToLocal(utcTimestamp) {
    
    if (!utcTimestamp) return new Date();
    return new Date(utcTimestamp);
  }

  
  function initializeTimezoneDisplay() {
    const tzAbbr = getTimeZoneAbbreviation();
    
    
    const timezoneIndicator = document.getElementById('timezoneIndicator');
    if (timezoneIndicator) {
      timezoneIndicator.textContent = `Times shown in ${tzAbbr}`;
    }
    
    
    updateExistingTimestamps();
  }

  function updateExistingTimestamps() {
    
    document.querySelectorAll('.message-time').forEach(timeElement => {
      const utcTimestamp = timeElement.getAttribute('data-utc-timestamp');
      if (utcTimestamp) {
        const localDate = convertUTCToLocal(parseInt(utcTimestamp));
        timeElement.textContent = formatLocalTime(localDate);
      }
    });

    
    document.querySelectorAll('.conversation-time, .history-time').forEach(timeElement => {
      const utcTimestamp = timeElement.getAttribute('data-utc-timestamp');
      if (utcTimestamp) {
        const localDate = convertUTCToLocal(parseInt(utcTimestamp));
        timeElement.textContent = formatRelativeTime(localDate);
      }
    });
  }

  
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
      const avatarSrc = otherUserPfp || 'https:
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
      const avatarSrc = otherUserPfp || 'https:
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

  
  function showTypingIndicator() {
    if (typingIndicator) {
      typingIndicator.style.display = 'flex';
      
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
    
    const historyItems = document.querySelectorAll('.history-item');
    historyItems.forEach(item => {
      const itemUserId = item.getAttribute('onclick')?.match(/\/chat\/(\w+)/)?.[1];
      if (itemUserId) {
        
        const historyLastMessage = item.querySelector('.history-last-message');
        const historyTime = item.querySelector('.history-time');
        if (historyLastMessage && historyTime) {
          
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
        <img src="${escapeHtml(avatarUrl || 'https:
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

  
  const messageUserBtns = document.querySelectorAll('.message-user-btn');
  messageUserBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const userItem = this.closest('.user-item');
      const userName = userItem.querySelector('h4')?.textContent || 'New chat';
      const userId = userItem.getAttribute('data-user-id');

      
      closeModal();

      
      currentConversationUserId = userId;
      if (chatUserName) chatUserName.textContent = userName;

      
      if (currentUserId && userId) {
        socket.emit('join', { user1: currentUserId, user2: userId });
      }

      
      showNotification(`Started conversation with ${userName}`, 'success');
    });
  });

  
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

  
  const attachmentBtn = document.querySelector('.attachment-btn');
  const emojiBtn = document.querySelector('.emoji-btn');
  if (attachmentBtn) attachmentBtn.addEventListener('click', () => showNotification('File attachment feature coming soon!', 'info'));
  if (emojiBtn) emojiBtn.addEventListener('click', () => showNotification('Emoji picker coming soon!', 'info'));

  
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

  
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  const emojiGrid = document.getElementById('emojiGrid');
  const attachmentBtn = document.getElementById('attachmentBtn');
  const fileInput = document.getElementById('fileInput');
  let selectedImage = null;

  
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

  
  const newChatBtn = document.getElementById('newChatBtn');
  const newChatModal = document.getElementById('newChatModal');
  const closeModal = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const startChatBtn = document.getElementById('startChatBtn');
  const usernameInput = document.getElementById('usernameInput');
  const modalError = document.getElementById('modalError');

  if (newChatBtn && newChatModal) {
    
    newChatBtn.addEventListener('click', function() {
      newChatModal.style.display = 'flex';
      usernameInput.focus();
      modalError.style.display = 'none';
      usernameInput.value = '';
    });

    
    function closeNewChatModal() {
      newChatModal.style.display = 'none';
      usernameInput.value = '';
      modalError.style.display = 'none';
    }

    closeModal?.addEventListener('click', closeNewChatModal);
    cancelBtn?.addEventListener('click', closeNewChatModal);

    
    newChatModal.addEventListener('click', function(e) {
      if (e.target === newChatModal) {
        closeNewChatModal();
      }
    });

    
    startChatBtn?.addEventListener('click', async function() {
      const username = usernameInput.value.trim();
      if (!username) {
        showModalError('Please enter a username');
        return;
      }

      
      startChatBtn.disabled = true;
      startChatBtn.textContent = 'Checking...';

      try {
        
        const response = await fetch(`/chat/${username}`, { method: 'HEAD' });
        if (response.ok) {
          
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
        
        startChatBtn.disabled = false;
        startChatBtn.textContent = 'Start Chat';
      }
    });

    
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

  
  if (emojiBtn && emojiPicker) {
    
    function initializeEmojiPicker() {
      loadEmojiCategory('smileys');
      
      
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

    
    document.addEventListener('click', function(e) {
      if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
        emojiPicker.style.display = 'none';
      }
    });
  }

  
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
        
        const existingPreview = document.querySelector('.image-preview');
        if (existingPreview) {
          existingPreview.remove();
        }

        
        const preview = document.createElement('div');
        preview.className = 'image-preview';
        preview.innerHTML = `
          <img src="${e.target.result}" alt="Image preview">
          <button class="remove-image" onclick="removeImagePreview()">×</button>
        `;

        
        const inputContainer = document.querySelector('.message-input-area');
        inputContainer.parentNode.insertBefore(preview, inputContainer);
      };
      reader.readAsDataURL(file);
    }

    
    window.removeImagePreview = function() {
      const preview = document.querySelector('.image-preview');
      if (preview) {
        preview.remove();
      }
      selectedImage = null;
      fileInput.value = '';
    };
  }

  
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
