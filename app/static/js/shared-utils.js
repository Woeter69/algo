"use strict";
// Shared utilities for all pages - Default avatars and user dropdown functionality
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDefaultAvatar = generateDefaultAvatar;
exports.initializeUserDropdown = initializeUserDropdown;
exports.initializeDefaultAvatars = initializeDefaultAvatars;
exports.addUserDropdownHTML = addUserDropdownHTML;
exports.initializeSharedComponents = initializeSharedComponents;
// Generate default avatar function
function generateDefaultAvatar(name) {
    if (!name)
        return 'https://i.ibb.co/QDy827D/default-avatar.png';
    // Clean the name and get initials
    var cleanName = name.trim();
    var initials = cleanName.split(' ')
        .map(function (word) { return word.charAt(0).toUpperCase(); })
        .join('')
        .substring(0, 2);
    // Generate a consistent color based on name
    var colors = [
        '6D28D9', // Purple
        '3B82F6', // Blue  
        '10B981', // Green
        'F59E0B', // Yellow
        'EF4444', // Red
        '8B5CF6', // Violet
        '06B6D4', // Cyan
        'F97316', // Orange
        'EC4899', // Pink
        '84CC16' // Lime
    ];
    // Simple hash function to get consistent color for same name
    var hash = 0;
    for (var i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    var colorIndex = Math.abs(hash) % colors.length;
    var backgroundColor = colors[colorIndex];
    // Return UI Avatars URL with custom styling
    return "https://ui-avatars.com/api/?name=".concat(encodeURIComponent(initials), "&background=").concat(backgroundColor, "&color=fff&size=80&font-size=0.6&bold=true");
}
// Initialize user dropdown functionality
function initializeUserDropdown() {
    var userProfile = document.getElementById('userprofile');
    var dropdownArrow = document.getElementById('dropdownarrow');
    var userDropdown = document.getElementById('userdropdown');
    var logoutBtn = document.getElementById('logoutBtn');
    if (userProfile && dropdownArrow && userDropdown) {
        // Toggle dropdown on click
        userProfile.addEventListener('click', function (e) {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
            dropdownArrow.classList.toggle('rotated');
        });
        // Close dropdown when clicking outside
        document.addEventListener('click', function (e) {
            if (!userProfile.contains(e.target)) {
                userDropdown.classList.remove('active');
                dropdownArrow.classList.remove('rotated');
            }
        });
        // Handle dropdown item clicks
        var dropdownItems = userDropdown.querySelectorAll('.dropdown-item');
        dropdownItems.forEach(function (item) {
            item.addEventListener('click', function (e) {
                var _a;
                e.stopPropagation();
                var text = (_a = this.textContent) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
                switch (text) {
                    case 'view profile':
                        window.location.href = '/profile';
                        break;
                    case 'edit profile':
                        window.location.href = '/profile/edit';
                        break;
                    case 'settings':
                        window.location.href = '/settings';
                        break;
                    case 'notifications':
                        window.location.href = '/requests';
                        break;
                    case 'logout':
                        handleLogout();
                        break;
                }
                // Close dropdown after click
                userDropdown.classList.remove('active');
                dropdownArrow.classList.remove('rotated');
            });
        });
    }
    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}
// Handle logout functionality
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear any local storage
        localStorage.clear();
        sessionStorage.clear();
        // Redirect to logout endpoint
        window.location.href = '/logout';
    }
}
// Initialize default avatars for all profile images
function initializeDefaultAvatars() {
    var profileImages = document.querySelectorAll('img[data-user-name]');
    profileImages.forEach(function (img) {
        var userName = img.getAttribute('data-user-name') || '';
        var currentSrc = img.src;
        // If no src or placeholder, set default avatar
        if (!currentSrc || currentSrc.includes('placeholder') || currentSrc === '') {
            img.src = generateDefaultAvatar(userName);
        }
        // Handle image load errors
        img.addEventListener('error', function () {
            this.src = generateDefaultAvatar(userName);
        });
    });
}
// Utility to add user dropdown HTML to any page
function addUserDropdownHTML(username, role, pfpPath) {
    var avatarSrc = pfpPath || generateDefaultAvatar(username);
    return "\n        <div class=\"user-profile\" id=\"userprofile\">\n            <img src=\"".concat(avatarSrc, "\" alt=\"profile\" data-user-name=\"").concat(username, "\" onerror=\"this.src='").concat(generateDefaultAvatar(username), "'\">\n            <div class=\"user-info\">\n                <div class=\"user-name\">").concat(username, "</div>\n                <div class=\"user-role\">").concat(role, "</div>\n            </div>\n            <i class=\"fas fa-chevron-down dropdown-arrow\" id=\"dropdownarrow\"></i>\n            <div class=\"user-dropdown\" id=\"userdropdown\">\n                <div class=\"dropdown-item\">\n                    <i class=\"fas fa-user\"></i>\n                    <span>view profile</span>\n                </div>\n                <div class=\"dropdown-item\">\n                    <i class=\"fas fa-edit\"></i>\n                    <span>edit profile</span>\n                </div>\n                <div class=\"dropdown-item\">\n                    <i class=\"fas fa-cog\"></i>\n                    <span>settings</span>\n                </div>\n                <div class=\"dropdown-item\">\n                    <i class=\"fas fa-bell\"></i>\n                    <span>notifications</span>\n                </div>\n                <div class=\"dropdown-item\" id=\"logoutBtn\">\n                    <i class=\"fas fa-sign-out-alt\"></i>\n                    <span>logout</span>\n                </div>\n            </div>\n        </div>\n    ");
}
// Initialize everything when DOM is ready
function initializeSharedComponents() {
    initializeUserDropdown();
    initializeDefaultAvatars();
}
// Auto-initialize if this script is loaded directly
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initializeSharedComponents);
}
