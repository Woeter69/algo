// @ts-nocheck
// Chat List Page TypeScript - extracted from chat_list.html

// New Chat Modal functionality
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
            // Use GET so frameworks/redirects behave consistently
            const response = await fetch(`/chat/${username}`, { method: 'GET', redirect: 'follow' });
            if (response.ok) {
                window.location.href = `/chat/${username}`;
            } else if (response.status === 404) {
                showModalError('User not found. Please check the username and try again.');
            } else if (response.status === 401 || response.status === 302) {
                window.location.href = `/chat/${username}`;
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

    function showModalError(message: string): void {
        if (modalError) {
            modalError.textContent = message;
            modalError.style.display = 'block';
        }
    }
}

// Online Status Management
interface OnlineStatusResponse {
    online_users: number[];
}

class OnlineStatusManager {
    private onlineIndicators: NodeListOf<HTMLElement>;
    private updateInterval: number | null = null;

    constructor() {
        this.onlineIndicators = document.querySelectorAll('.online-indicator');
        this.init();
    }

    private init(): void {
        // Initial status check
        this.updateOnlineStatus();
        
        // Update every 30 seconds
        this.updateInterval = window.setInterval(() => {
            this.updateOnlineStatus();
        }, 30000);
    }

    private async updateOnlineStatus(): Promise<void> {
        try {
            const response = await fetch('/api/online_status');
            if (response.ok) {
                const data: OnlineStatusResponse = await response.json();
                this.updateIndicators(data.online_users);
            }
        } catch (error) {
            console.error('Error fetching online status:', error);
        }
    }

    private updateIndicators(onlineUsers: number[]): void {
        this.onlineIndicators.forEach((indicator) => {
            const userId = parseInt(indicator.dataset.userId || '0');
            const isOnline = onlineUsers.includes(userId);
            
            if (isOnline) {
                indicator.classList.add('online');
            } else {
                indicator.classList.remove('online');
            }
        });
    }

    public destroy(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// Initialize online status manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const onlineStatusManager = new OnlineStatusManager();
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        onlineStatusManager.destroy();
    });
});

// Export for potential external use
export { OnlineStatusManager };
