// Profile TypeScript functionality
console.log('🚀 Profile.ts loaded!');
document.addEventListener('DOMContentLoaded', function () {
    console.log('📄 DOM Content Loaded - Profile page initialized');
    // Mobile navigation
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            hamburger.classList.toggle('toggle');
            navLinks.classList.toggle('open');
        });
    }
    // Modal functionality
    const editBtn = document.getElementById('editProfileBtn');
    const modal = document.getElementById('editModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const profileForm = document.getElementById('profileForm');
    // Open modal
    if (editBtn && modal) {
        editBtn.addEventListener('click', function () {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    // Close modal function
    function closeModal() {
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }
    // Close modal events
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
    // Profile picture upload
    const profilePictureUpload = document.getElementById('profilePictureUpload');
    const profilePicture = document.getElementById('profilePicture');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    if (profilePictureUpload && profilePicture) {
        profilePictureUpload.addEventListener('change', function (e) {
            const target = e.target;
            const file = target.files?.[0];
            if (file) {
                // Validate file size (5MB max)
                if (file.size > 5 * 1024 * 1024) {
                    showNotification('File size must be less than 5MB', 'error');
                    return;
                }
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showNotification('Please select a valid image file', 'error');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (e) {
                    const profileAvatarContainer = document.getElementById('profileAvatarContainer');
                    if (e.target?.result) {
                        profilePicture.src = e.target.result;
                        profilePicture.style.display = 'block';
                        if (avatarPlaceholder) {
                            avatarPlaceholder.style.display = 'none';
                        }
                        if (profileAvatarContainer) {
                            profileAvatarContainer.classList.remove('has-placeholder');
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
    // Tab functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach((btn) => {
        btn.addEventListener('click', function () {
            const targetTab = this.getAttribute('data-tab');
            // Remove active class from all tabs and contents
            tabBtns.forEach((b) => b.classList.remove('active'));
            tabContents.forEach((c) => c.classList.remove('active'));
            // Add active class to clicked tab and corresponding content
            this.classList.add('active');
            if (targetTab) {
                const targetContent = document.getElementById(targetTab + '-tab');
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            }
        });
    });
    // User Profile Dropdown functionality
    console.log('🔍 Initializing dropdown functionality...');
    const userProfile = document.getElementById('userprofile');
    const userDropdown = document.getElementById('userdropdown');
    const dropdownArrow = document.getElementById('dropdownarrow');
    console.log('🔍 Elements found:', {
        userProfile: !!userProfile,
        userDropdown: !!userDropdown,
        dropdownArrow: !!dropdownArrow
    });
    if (userProfile && userDropdown && dropdownArrow) {
        console.log('✅ Dropdown elements found, adding event listeners...');
        userProfile.addEventListener('click', (e) => {
            console.log('🖱️ Dropdown clicked!');
            e.stopPropagation();
            userDropdown.classList.toggle('show');
            dropdownArrow.classList.toggle('rotated');
            console.log('🔄 Dropdown classes toggled, show class:', userDropdown.classList.contains('show'));
        });
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userProfile.contains(e.target)) {
                userDropdown.classList.remove('show');
                dropdownArrow.classList.remove('rotated');
            }
        });
        // Handle dropdown item clicks
        const dropdownItems = document.querySelectorAll('.dropdown-item');
        dropdownItems.forEach((item) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const spanElement = item.querySelector('span');
                const text = spanElement?.textContent?.toLowerCase() || '';
                switch (text) {
                    case 'view profile':
                        window.location.href = '/profile';
                        break;
                    case 'edit profile':
                        // Open the edit modal if we're on our own profile
                        if (editBtn && modal) {
                            modal.classList.add('active');
                            document.body.style.overflow = 'hidden';
                        }
                        break;
                    case 'settings':
                        window.location.href = '/settings';
                        break;
                    case 'change password':
                        console.log('Change Password clicked from profile');
                        window.location.href = '/forgot-password';
                        break;
                    case 'notifications':
                        console.log('Notifications clicked');
                        // Add notifications logic here
                        break;
                    case 'logout':
                        if (confirm('Are you sure you want to logout?')) {
                            window.location.href = '/logout';
                        }
                        break;
                    default:
                        console.log('Unknown dropdown item:', text);
                }
                // Close dropdown after click
                userDropdown.classList.remove('show');
                dropdownArrow.classList.remove('rotated');
            });
        });
    }
    // Direct logout button handler (backup)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Are you sure you want to logout?')) {
                window.location.href = '/logout';
            }
        });
    }
    // Notification function
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        let icon = 'fas fa-info-circle';
        let bgColor = '#6D28D9';
        if (type === 'success') {
            icon = 'fas fa-check-circle';
            bgColor = '#10b981';
        }
        else if (type === 'error') {
            icon = 'fas fa-exclamation-circle';
            bgColor = '#ef4444';
        }
        notification.innerHTML = `
            <div class="notification-content">
                <i class="${icon}"></i>
                <span>${message}</span>
            </div>
        `;
        // Add styles
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
        // Add to body
        document.body.appendChild(notification);
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        // Remove after duration
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
    // Profile avatar click to open file upload
    const profileAvatarContainer = document.getElementById('profileAvatarContainer');
    if (profileAvatarContainer && profilePictureUpload) {
        profileAvatarContainer.addEventListener('click', function () {
            profilePictureUpload.click();
        });
    }
    // Header scroll effect
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 100) {
                header.classList.add('scrolled');
            }
            else {
                header.classList.remove('scrolled');
            }
        });
    }
    // Form validation
    const inputs = document.querySelectorAll('#profileForm input[required]');
    inputs.forEach((input) => {
        input.addEventListener('blur', function () {
            validateField(this);
        });
        input.addEventListener('input', function () {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });
    function validateField(field) {
        const value = field.value.trim();
        const fieldName = field.getAttribute('name');
        let isValid = true;
        let errorMessage = '';
        // Remove existing error
        field.classList.remove('error');
        const existingError = field.parentNode?.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        // Skip validation for optional fields that are empty
        if (!value && !field.hasAttribute('required')) {
            return true;
        }
        // Validation rules
        if (!value && field.hasAttribute('required')) {
            isValid = false;
            errorMessage = 'This field is required';
        }
        else if (fieldName === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        }
        else if (fieldName === 'username') {
            const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
            if (!usernameRegex.test(value)) {
                isValid = false;
                errorMessage = 'Username must be 3-20 characters, letters, numbers, and underscores only';
            }
        }
        else if (fieldName === 'phone' && value) {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
                isValid = false;
                errorMessage = 'Please enter a valid phone number';
            }
        }
        else if ((fieldName === 'linkedIn' || fieldName === 'github' || fieldName === 'website') && value) {
            const urlRegex = /^https?:\/\/.+/;
            if (!urlRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid URL starting with http:// or https://';
            }
        }
        else if (fieldName === 'gpa' && value) {
            const gpa = parseFloat(value);
            if (isNaN(gpa) || gpa < 0 || gpa > 4) {
                isValid = false;
                errorMessage = 'GPA must be between 0.0 and 4.0';
            }
        }
        if (!isValid) {
            field.classList.add('error');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = errorMessage;
            errorDiv.style.cssText = 'color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem;';
            field.parentNode?.appendChild(errorDiv);
        }
        return isValid;
    }
    // Add error styles
    const style = document.createElement('style');
    style.textContent = `
        .form-group input.error,
        .form-group textarea.error {
            border-color: #ef4444;
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
    `;
    document.head.appendChild(style);
});
// Handle image error function (global scope for template usage)
window.handleImageError = function (img) {
    img.onerror = null; // Prevent infinite loop
    // This will be replaced by the template with the actual generated avatar
    console.log('Image failed to load, using fallback');
};
export {};
