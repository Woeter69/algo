/**
 * Go OAuth Client for Google Authentication
 * Handles Google Sign-In via Go backend
 */

class GoOAuthClient {
    constructor() {
        this.baseURL = this.getBaseURL();
        this.user = null;
        this.isAuthenticated = false;
    }

    getBaseURL() {
        // Use same host as current page but port 8080 for Go server
        const host = window.location.hostname;
        const protocol = window.location.protocol;
        return `${protocol}//${host}:8080`;
    }

    /**
     * Initiate Google OAuth login
     */
    async login() {
        try {
            console.log('🚀 Starting Google OAuth login...');
            
            const response = await fetch(`${this.baseURL}/auth/google`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📡 Got auth URL from Go server');

            // Redirect to Google OAuth
            window.location.href = data.auth_url;

        } catch (error) {
            console.error('❌ OAuth login failed:', error);
            this.showError('Failed to start Google login. Please try again.');
        }
    }

    /**
     * Get current user info
     */
    async getCurrentUser() {
        try {
            const response = await fetch(`${this.baseURL}/auth/user`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (response.ok) {
                this.user = await response.json();
                this.isAuthenticated = true;
                console.log('✅ User authenticated:', this.user.username);
                return this.user;
            } else if (response.status === 401) {
                this.isAuthenticated = false;
                this.user = null;
                return null;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (error) {
            console.error('❌ Failed to get user info:', error);
            this.isAuthenticated = false;
            this.user = null;
            return null;
        }
    }

    /**
     * Logout user
     */
    async logout() {
        try {
            console.log('👋 Logging out...');
            
            const response = await fetch(`${this.baseURL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (response.ok) {
                this.user = null;
                this.isAuthenticated = false;
                console.log('✅ Logged out successfully');
                
                // Redirect to login page
                window.location.href = '/login';
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (error) {
            console.error('❌ Logout failed:', error);
            this.showError('Failed to logout. Please try again.');
        }
    }

    /**
     * Check if user is authenticated on page load
     */
    async checkAuth() {
        const user = await this.getCurrentUser();
        
        if (user) {
            console.log('🔐 User is authenticated');
            this.updateUI(true, user);
            return true;
        } else {
            console.log('🔓 User not authenticated');
            this.updateUI(false, null);
            return false;
        }
    }

    /**
     * Update UI based on authentication status
     */
    updateUI(isAuthenticated, user) {
        // Update login/logout buttons
        const loginBtn = document.getElementById('google-login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const userInfo = document.getElementById('user-info');

        if (isAuthenticated && user) {
            // Hide login button
            if (loginBtn) loginBtn.style.display = 'none';
            
            // Show user info
            if (userInfo) {
                userInfo.innerHTML = `
                    <div class="user-profile">
                        <img src="${user.pfp_path || '/static/images/default-avatar.png'}" 
                             alt="Profile" class="profile-pic">
                        <span class="username">${user.username}</span>
                        <button id="logout-btn" class="logout-btn">Logout</button>
                    </div>
                `;
                userInfo.style.display = 'block';
                
                // Add logout event listener
                const newLogoutBtn = document.getElementById('logout-btn');
                if (newLogoutBtn) {
                    newLogoutBtn.addEventListener('click', () => this.logout());
                }
            }

            // Redirect to main app if on login page
            if (window.location.pathname === '/login') {
                window.location.href = '/';
            }

        } else {
            // Show login button
            if (loginBtn) {
                loginBtn.style.display = 'block';
                loginBtn.addEventListener('click', () => this.login());
            }
            
            // Hide user info
            if (userInfo) userInfo.style.display = 'none';

            // Redirect to login if on protected page
            const protectedPages = ['/chat', '/channels', '/profile'];
            if (protectedPages.some(page => window.location.pathname.startsWith(page))) {
                window.location.href = '/login';
            }
        }
    }

    /**
     * Show error message to user
     */
    showError(message) {
        // Create or update error element
        let errorEl = document.getElementById('oauth-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'oauth-error';
            errorEl.className = 'error-message';
            document.body.appendChild(errorEl);
        }

        errorEl.textContent = message;
        errorEl.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    }

    /**
     * Show success message to user
     */
    showSuccess(message) {
        // Create or update success element
        let successEl = document.getElementById('oauth-success');
        if (!successEl) {
            successEl = document.createElement('div');
            successEl.id = 'oauth-success';
            successEl.className = 'success-message';
            document.body.appendChild(successEl);
        }

        successEl.textContent = message;
        successEl.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            successEl.style.display = 'none';
        }, 3000);
    }
}

// Global instance
const goOAuth = new GoOAuthClient();

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔐 Initializing Go OAuth client...');
    
    // Check authentication status
    await goOAuth.checkAuth();

    // Handle OAuth callback if on callback page
    if (window.location.pathname === '/auth/google/callback') {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        
        if (error) {
            console.error('❌ OAuth error:', error);
            goOAuth.showError('Google login failed. Please try again.');
            // Redirect to login page after error
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            console.log('✅ OAuth callback successful');
            goOAuth.showSuccess('Login successful! Redirecting...');
            // The Go server should handle the redirect, but fallback just in case
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
    }
});

// Make available globally
window.goOAuth = goOAuth;
