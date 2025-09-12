// Sample chat data
const chatData = {
    general: [
        {
            author: "Alice Smith",
            avatarColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            timestamp: "Today at 2:30 PM",
            message: "Hey everyone! Just wanted to share that I got promoted to Senior Software Engineer at TechCorp! 🎉"
        },
        {
            author: "Bob Johnson",
            avatarColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            timestamp: "Today at 2:32 PM",
            message: "Congratulations Alice! That's amazing news. How long have you been there now?"
        },
        {
            author: "Alice Smith",
            avatarColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            timestamp: "Today at 2:33 PM",
            message: "Thanks Bob! It's been about 2 years now. The experience from our university projects really helped!"
        },
        {
            author: "Carol Davis",
            avatarColor: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            timestamp: "Today at 2:35 PM",
            message: "That's so inspiring! I'm currently looking for opportunities in data science. Any advice?"
        },
        {
            author: "David Wilson",
            avatarColor: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
            timestamp: "Today at 2:40 PM",
            message: "Carol, I'd be happy to help! I know some great companies hiring data scientists. Let's connect!"
        }
    ],
    "job-opportunities": [
        {
            author: "Career Services",
            avatarColor: "linear-gradient(135deg, #5865f2 0%, #4338ca 100%)",
            timestamp: "Today at 10:00 AM",
            message: "🚀 New Job Alert: Google is hiring Software Engineers (L3-L5). Remote positions available!"
        },
        {
            author: "Alumni Relations",
            avatarColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            timestamp: "Today at 11:30 AM",
            message: "Microsoft is looking for Product Managers. Great opportunity for recent grads!"
        },
        {
            author: "Bob Johnson",
            avatarColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            timestamp: "Today at 1:15 PM",
            message: "My company is hiring! We need a UX Designer. DM me if interested."
        }
    ],
    internships: [
        {
            author: "Career Services",
            avatarColor: "linear-gradient(135deg, #5865f2 0%, #4338ca 100%)",
            timestamp: "Yesterday at 3:00 PM",
            message: "Summer 2024 internships are now open at Amazon, Apple, and Meta. Applications due by January 15th!"
        },
        {
            author: "Alice Smith",
            avatarColor: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            timestamp: "Yesterday at 4:20 PM",
            message: "I can refer students to my company for internships. We have positions in engineering and product."
        }
    ],
    "batch-2020": [
        {
            author: "John Doe",
            avatarColor: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
            timestamp: "Today at 9:00 AM",
            message: "Hey Class of 2020! Who's planning to attend the reunion next month?"
        },
        {
            author: "Sarah Wilson",
            avatarColor: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
            timestamp: "Today at 9:15 AM",
            message: "I'll be there! Can't wait to see everyone again."
        },
        {
            author: "Mike Chen",
            avatarColor: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
            timestamp: "Today at 9:30 AM",
            message: "Count me in! Should we organize a group dinner?"
        }
    ]
};

// DOM elements
const channels = document.querySelectorAll('.channel');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const currentChannelName = document.querySelector('.current-channel-name');
const currentChannelIcon = document.querySelector('.current-channel-icon');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// Mobile menu elements
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileRightMenuBtn = document.getElementById('mobileRightMenuBtn');
const mobileSearchBtn = document.getElementById('mobileSearchBtn');
const sidebar = document.getElementById('sidebar');
const rightSidebar = document.getElementById('rightSidebar');
const mobileOverlay = document.getElementById('mobileOverlay');

// Institution dropdown
const institutionDropdown = document.getElementById('institutionDropdown');

let currentChannel = 'general';

// Initialize the app
function init() {
    loadMessages(currentChannel);
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Channel switching
    channels.forEach(channel => {
        channel.addEventListener('click', () => {
            const channelName = channel.dataset.channel;
            switchChannel(channelName);
            // Close mobile menu after selecting channel
            closeMobileMenus();
        });
    });

    // Message sending
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    // Mobile menu listeners
    mobileMenuBtn.addEventListener('click', toggleLeftSidebar);
    mobileRightMenuBtn.addEventListener('click', toggleRightSidebar);
    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', showMobileSearch);
    }
    mobileOverlay.addEventListener('click', closeMobileMenus);

    // Institution dropdown listener
    if (institutionDropdown) {
        institutionDropdown.addEventListener('change', handleInstitutionChange);
    }

    // Close menus on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileMenus();
        }
    });
}

// Switch channel
function switchChannel(channelName) {
    // Update active channel
    channels.forEach(ch => ch.classList.remove('active'));
    document.querySelector(`[data-channel="${channelName}"]`).classList.add('active');

    currentChannel = channelName;

    // Update header
    const channelElement = document.querySelector(`[data-channel="${channelName}"]`);
    const iconElement = channelElement.querySelector('.channel-icon i');
    const name = channelElement.querySelector('.channel-name').textContent;

    // Update current channel icon
    const currentIconElement = currentChannelIcon.querySelector('i');
    if (iconElement && currentIconElement) {
        // Copy the icon class
        const iconName = iconElement.getAttribute('data-lucide');
        currentIconElement.setAttribute('data-lucide', iconName);
        // Reinitialize the icon
        lucide.createIcons();
    }

    currentChannelName.textContent = name;

    // Update placeholder
    messageInput.placeholder = `Message #${name}`;

    // Load messages
    loadMessages(channelName);
}

// Load messages for a channel
function loadMessages(channelName) {
    const messages = chatData[channelName] || [];

    chatMessages.innerHTML = '';

    if (messages.length === 0) {
        chatMessages.innerHTML = `
            <div style="text-align: center; color: #8e9297; margin-top: 50px;">
                <p>Welcome to #${channelName}!</p>
                <p>This is the start of your conversation.</p>
            </div>
        `;
        return;
    }

    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        chatMessages.appendChild(messageElement);
    });

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Create message element
function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <div class="message-avatar-circle" style="background: ${message.avatarColor};">
                <i data-lucide="user"></i>
            </div>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${message.author}</span>
                <span class="message-timestamp">${message.timestamp}</span>
            </div>
            <div class="message-text">${message.message}</div>
        </div>
    `;

    // Reinitialize Lucide icons for the new element
    lucide.createIcons();

    return messageDiv;
}

// Send message
function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    // Create new message
    const newMessage = {
        author: "John Doe",
        avatarColor: "linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)",
        timestamp: new Date().toLocaleString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }),
        message: messageText
    };

    // Add to chat data
    if (!chatData[currentChannel]) {
        chatData[currentChannel] = [];
    }
    chatData[currentChannel].push(newMessage);

    // Add to DOM
    const messageElement = createMessageElement(newMessage);
    chatMessages.appendChild(messageElement);

    // Clear input
    messageInput.value = '';

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Switch tabs in right sidebar
function switchTab(tabName) {
    // Update active tab button
    tabBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update active tab panel
    tabPanels.forEach(panel => panel.classList.remove('active'));
    document.getElementById(`${tabName}-panel`).classList.add('active');
}

// Add some dynamic behavior
function addDynamicFeatures() {
    // Simulate online status changes
    setInterval(() => {
        const connections = document.querySelectorAll('.connection-status');
        connections.forEach(status => {
            if (Math.random() > 0.9) {
                status.classList.toggle('online');
                status.classList.toggle('offline');
            }
        });
    }, 10000);

    // Add typing indicator (simulation)
    let typingTimeout;
    messageInput.addEventListener('input', () => {
        clearTimeout(typingTimeout);
        // You could add a typing indicator here
        typingTimeout = setTimeout(() => {
            // Remove typing indicator
        }, 1000);
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    init();
    addDynamicFeatures();
});

// Add some sample notifications
function showNotification(message) {
    // Simple notification system (you could enhance this)
    console.log('Notification:', message);
}

// Simulate receiving new messages
function simulateIncomingMessages() {
    const sampleMessages = [
        {
            channel: 'general',
            author: 'Emma Thompson',
            avatarColor: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            message: 'Just saw the latest alumni newsletter. Great achievements everyone!'
        },
        {
            channel: 'job-opportunities',
            author: 'Career Services',
            avatarColor: 'linear-gradient(135deg, #5865f2 0%, #4338ca 100%)',
            message: '🔥 Hot opportunity: Startup looking for full-stack developers. Equity included!'
        }
    ];

    // Randomly add messages every 30 seconds
    setInterval(() => {
        if (Math.random() > 0.7) {
            const randomMessage = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
            const message = {
                ...randomMessage,
                timestamp: new Date().toLocaleString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                })
            };

            if (!chatData[message.channel]) {
                chatData[message.channel] = [];
            }
            chatData[message.channel].push(message);

            // If we're on the same channel, show the message
            if (currentChannel === message.channel) {
                const messageElement = createMessageElement(message);
                chatMessages.appendChild(messageElement);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            showNotification(`New message in #${message.channel}`);
        }
    }, 30000);
}

// Start message simulation
setTimeout(simulateIncomingMessages, 5000);

// Mobile menu functions
function toggleLeftSidebar() {
    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
        closeMobileMenus();
    } else {
        // Close right sidebar if open
        rightSidebar.classList.remove('open');
        // Open left sidebar
        sidebar.classList.add('open');
        mobileOverlay.classList.add('show');
    }
}

function toggleRightSidebar() {
    const isOpen = rightSidebar.classList.contains('open');

    if (isOpen) {
        closeMobileMenus();
    } else {
        // Close left sidebar if open
        sidebar.classList.remove('open');
        // Open right sidebar
        rightSidebar.classList.add('open');
        mobileOverlay.classList.add('show');
    }
}

function closeMobileMenus() {
    sidebar.classList.remove('open');
    rightSidebar.classList.remove('open');
    mobileOverlay.classList.remove('show');
}

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        closeMobileMenus();
    }
});

// Mobile search function
function showMobileSearch() {
    // Simple alert for now - you can enhance this with a modal or overlay
    const searchTerm = prompt('Search alumni, channels, or messages:');
    if (searchTerm) {
        console.log('Searching for:', searchTerm);
        // Add your search logic here
        showNotification(`Searching for: ${searchTerm}`);
    }
}

// Handle institution dropdown change
function handleInstitutionChange(event) {
    const selectedValue = event.target.value;

    if (selectedValue === 'add-institution') {
        // Show modal or prompt to add new institution
        const newInstitution = prompt('Enter the name of the institution you want to add:');
        if (newInstitution && newInstitution.trim()) {
            // Add new option to dropdown
            const option = document.createElement('option');
            option.value = newInstitution.toLowerCase().replace(/\s+/g, '-');
            option.textContent = newInstitution;

            // Insert before the "Add Institution" option
            const addOption = institutionDropdown.querySelector('option[value="add-institution"]');
            institutionDropdown.insertBefore(option, addOption);

            // Select the new institution
            option.selected = true;

            showNotification(`Added ${newInstitution} to institutions`);
        } else {
            // Reset to previous selection if cancelled
            institutionDropdown.value = 'cluster-innovation-center';
        }
    } else {
        // Handle institution switch
        const institutionName = institutionDropdown.options[institutionDropdown.selectedIndex].text;
        showNotification(`Switched to ${institutionName}`);

        // You can add logic here to load different channels/data for different institutions
        console.log('Switched to institution:', selectedValue);
    }
}