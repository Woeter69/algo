// @ts-nocheck
// Channel switching
const channels = document.querySelectorAll('.channel');
const currentChannelName = document.querySelector('.current-channel-name');
const currentChannelIcon = document.querySelector('.current-channel-icon');
const messageInput = document.getElementById('messageInput');

channels.forEach(channel => {
    channel.addEventListener('click', () => {
        channels.forEach(c => c.classList.remove('active'));
        channel.classList.add('active');

        const channelName = channel.querySelector('.channel-name').textContent;
        const channelIcon = channel.querySelector('.channel-icon i').className;

        currentChannelName.textContent = channelName;
        currentChannelIcon.innerHTML = `<i class="${channelIcon}"></i>`;
        messageInput.placeholder = `Message #${channelName}`;
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
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.innerHTML = `
            <div class="message-avatar">JD</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">John Doe</span>
                    <span class="message-time">Now</span>
                </div>
                <div class="message-text">${message}</div>
            </div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        input.value = '';
    }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Initialize chat messages scroll position
chatMessages.scrollTop = chatMessages.scrollHeight;
