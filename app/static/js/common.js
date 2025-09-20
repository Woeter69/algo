// @ts-nocheck
// Common utilities and functions used across the application
// Profile Picture Handler - Fixes stretching and handles placeholders
function initializeProfilePictures() {
    // Find all profile picture containers
    const profileContainers = document.querySelectorAll('.profile-picture, .profile-pic, .user-avatar, .chat-avatar, .message-avatar, .conversation-avatar, .profile-picture-preview');
    profileContainers.forEach(container => {
        const img = container.querySelector('img');
        const username = container.getAttribute('data-username') || container.textContent.trim();
        if (img) {
            // Handle image load success
            img.addEventListener('load', function () {
                if (this.src && this.src !== '' && !this.src.includes('placeholder')) {
                    container.style.color = 'transparent';
                    container.style.background = 'transparent';
                    this.style.display = 'block';
                }
            });
            // Handle image load error
            img.addEventListener('error', function () {
                this.style.display = 'none';
                showInitials(container, username);
            });
            // Check if image is already loaded or has no src
            if (!img.src || img.src === '' || img.src.includes('placeholder')) {
                img.style.display = 'none';
                showInitials(container, username);
            }
        }
        else {
            // No img tag, show initials
            showInitials(container, username);
        }
    });
}
function showInitials(container, username) {
    if (!username)
        return;
    // Get initials from username
    const initials = username
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
    // Set the container to show initials
    container.textContent = initials;
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.background = 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 100%)';
    container.style.color = 'white';
    container.style.fontWeight = '600';
    container.style.fontSize = '0.9rem';
    container.style.textTransform = 'uppercase';
    container.style.letterSpacing = '0.5px';
}
// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeProfilePictures);
// Also initialize when new content is dynamically added
const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        if (mutation.addedNodes.length > 0) {
            initializeProfilePictures();
        }
    });
});
observer.observe(document.body, {
    childList: true,
    subtree: true
});
// Common DOM utility functions
export class DOMUtils {
    static querySelector(selector) {
        return document.querySelector(selector);
    }
    static querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    }
    static getElementById(id) {
        return document.getElementById(id);
    }
    static addClass(element, className) {
        element?.classList.add(className);
    }
    static removeClass(element, className) {
        element?.classList.remove(className);
    }
    static toggleClass(element, className) {
        element?.classList.toggle(className);
    }
}
// Common navigation functionality
export class Navigation {
    constructor() {
        this.hamburger = DOMUtils.querySelector('.hamburger');
        this.navLinks = DOMUtils.querySelector('.nav-links');
        this.links = DOMUtils.querySelectorAll('.nav-links li');
        this.init();
    }
    init() {
        this.setupMobileNavigation();
        this.setupScrollEffect();
    }
    setupMobileNavigation() {
        if (!this.hamburger || !this.navLinks)
            return;
        this.hamburger.addEventListener('click', () => {
            this.toggleMobileMenu();
        });
        // Close mobile menu when clicking on nav links
        this.links.forEach(link => {
            link.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        });
    }
    toggleMobileMenu() {
        if (!this.hamburger || !this.navLinks)
            return;
        this.navLinks.classList.toggle('open');
        this.hamburger.classList.toggle('toggle');
        // Animate links
        this.links.forEach((link, index) => {
            if (link.style.animation) {
                link.style.animation = '';
            }
            else {
                link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
            }
        });
    }
    closeMobileMenu() {
        if (!this.hamburger || !this.navLinks)
            return;
        this.navLinks.classList.remove('open');
        this.hamburger.classList.remove('toggle');
        this.links.forEach(link => {
            link.style.animation = '';
        });
    }
    setupScrollEffect() {
        window.addEventListener('scroll', () => {
            const header = DOMUtils.querySelector('header');
            if (header) {
                header.classList.toggle('scrolled', window.scrollY > 50);
            }
        });
    }
}
export class FormValidator {
    static validate(form, rules) {
        const formData = new FormData(form);
        const errors = [];
        rules.forEach(rule => {
            const value = formData.get(rule.field) || '';
            if (rule.required && !value.trim()) {
                errors.push(rule.message || `${rule.field} is required`);
                return;
            }
            if (rule.minLength && value.length < rule.minLength) {
                errors.push(rule.message || `${rule.field} must be at least ${rule.minLength} characters`);
            }
            if (rule.maxLength && value.length > rule.maxLength) {
                errors.push(rule.message || `${rule.field} must be no more than ${rule.maxLength} characters`);
            }
            if (rule.pattern && !rule.pattern.test(value)) {
                errors.push(rule.message || `${rule.field} format is invalid`);
            }
            if (rule.custom && !rule.custom(value)) {
                errors.push(rule.message || `${rule.field} is invalid`);
            }
        });
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    static showErrors(errors, container) {
        if (container) {
            container.innerHTML = errors.map(error => `<div class="error">${error}</div>`).join('');
        }
        else {
            errors.forEach(error => console.error(error));
        }
    }
}
// Notification system
export class NotificationSystem {
    static show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-triangle'
        };
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#6D28D9',
            warning: '#f59e0b'
        };
        notification.innerHTML = `
            <i class="${icons[type]}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: ${colors[type]}; color: white; padding: 1rem 1.5rem;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex; align-items: center; gap: 0.5rem;
            font-weight: 500; max-width: 400px;
            transform: translateX(100%); transition: transform 0.3s ease;
        `;
        document.body.appendChild(notification);
        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
// Initialize common functionality
document.addEventListener('DOMContentLoaded', () => {
    new Navigation();
});
//# sourceMappingURL=common.js.map
