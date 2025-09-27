// Profile TypeScript functionality
console.log('🚀 Profile.ts loaded!');

interface UserProfileElements {
    userProfile: HTMLElement | null;
    userDropdown: HTMLElement | null;
    dropdownArrow: HTMLElement | null;
}

interface FormData {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    currentCity: string;
    universityName: string;
    graduationYear: string;
    degree: string;
    major: string;
    gpa: string;
    bio: string;
    interests: string;
    skills: string;
    linkedIn: string;
    github: string;
    twitter: string;
    website: string;
    emailNotifications: boolean;
    profileVisibility: boolean;
    jobAlerts: boolean;
}

document.addEventListener('DOMContentLoaded', function (): void {
    console.log('📄 DOM Content Loaded - Profile page initialized');
    
    // Mobile navigation
    const hamburger: HTMLElement | null = document.querySelector('.hamburger');
    const navLinks: HTMLElement | null = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function (): void {
            hamburger.classList.toggle('toggle');
            navLinks.classList.toggle('open');
        });
    }

    // Modal functionality
    const editBtn: HTMLElement | null = document.getElementById('editProfileBtn');
    const modal: HTMLElement | null = document.getElementById('editModal');
    const closeBtn: HTMLElement | null = document.getElementById('closeModal');
    const cancelBtn: HTMLElement | null = document.getElementById('cancelBtn');
    const profileForm: HTMLFormElement | null = document.getElementById('profileForm') as HTMLFormElement;

    // Open modal
    if (editBtn && modal) {
        editBtn.addEventListener('click', function (): void {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    // Close modal function
    function closeModal(): void {
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
        modal.addEventListener('click', function (e: MouseEvent): void {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Profile picture upload
    const profilePictureUpload: HTMLInputElement | null = document.getElementById('profilePictureUpload') as HTMLInputElement;
    const profilePicture: HTMLImageElement | null = document.getElementById('profilePicture') as HTMLImageElement;
    const avatarPlaceholder: HTMLElement | null = document.getElementById('avatarPlaceholder');

    if (profilePictureUpload && profilePicture) {
        profilePictureUpload.addEventListener('change', function (e: Event): void {
            const target = e.target as HTMLInputElement;
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
                reader.onload = function (e: ProgressEvent<FileReader>): void {
                    const profileAvatarContainer: HTMLElement | null = document.getElementById('profileAvatarContainer');
                    if (e.target?.result) {
                        profilePicture.src = e.target.result as string;
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
    const tabBtns: NodeListOf<HTMLElement> = document.querySelectorAll('.tab-btn');
    const tabContents: NodeListOf<HTMLElement> = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach((btn: HTMLElement) => {
        btn.addEventListener('click', function (): void {
            const targetTab: string | null = this.getAttribute('data-tab');
            // Remove active class from all tabs and contents
            tabBtns.forEach((b: HTMLElement) => b.classList.remove('active'));
            tabContents.forEach((c: HTMLElement) => c.classList.remove('active'));
            // Add active class to clicked tab and corresponding content
            this.classList.add('active');
            if (targetTab) {
                const targetContent: HTMLElement | null = document.getElementById(targetTab + '-tab');
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            }
        });
    });

    // User Profile Dropdown functionality
    console.log('🔍 Initializing dropdown functionality...');
    const userProfile: HTMLElement | null = document.getElementById('userprofile');
    const userDropdown: HTMLElement | null = document.getElementById('userdropdown');
    const dropdownArrow: HTMLElement | null = document.getElementById('dropdownarrow');
    
    console.log('🔍 Elements found:', {
        userProfile: !!userProfile,
        userDropdown: !!userDropdown,
        dropdownArrow: !!dropdownArrow
    });
    
    if (userProfile && userDropdown && dropdownArrow) {
        console.log('✅ Dropdown elements found, adding event listeners...');
        userProfile.addEventListener('click', (e: MouseEvent): void => {
            console.log('🖱️ Dropdown clicked!');
            e.stopPropagation();
            userDropdown.classList.toggle('show');
            dropdownArrow.classList.toggle('rotated');
            console.log('🔄 Dropdown classes toggled, show class:', userDropdown.classList.contains('show'));
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e: MouseEvent): void => {
            if (!userProfile.contains(e.target as Node)) {
                userDropdown.classList.remove('show');
                dropdownArrow.classList.remove('rotated');
            }
        });
        
        // Handle dropdown item clicks
        const dropdownItems: NodeListOf<HTMLElement> = document.querySelectorAll('.dropdown-item');
        dropdownItems.forEach((item: HTMLElement) => {
            item.addEventListener('click', (e: MouseEvent): void => {
                e.stopPropagation();
                const spanElement: HTMLElement | null = item.querySelector('span');
                const text: string = spanElement?.textContent?.toLowerCase() || '';
                
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
    const logoutBtn: HTMLElement | null = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e: MouseEvent): void => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Are you sure you want to logout?')) {
                window.location.href = '/logout';
            }
        });
    }

    // Notification function
    function showNotification(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
        // Create notification element
        const notification: HTMLDivElement = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        let icon: string = 'fas fa-info-circle';
        let bgColor: string = '#6D28D9';
        
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
        setTimeout((): void => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after duration
        const duration: number = type === 'error' ? 5000 : 3000;
        setTimeout((): void => {
            notification.style.transform = 'translateX(100%)';
            setTimeout((): void => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // Profile avatar click to open file upload
    const profileAvatarContainer: HTMLElement | null = document.getElementById('profileAvatarContainer');
    if (profileAvatarContainer && profilePictureUpload) {
        profileAvatarContainer.addEventListener('click', function (): void {
            profilePictureUpload.click();
        });
    }

    // Header scroll effect
    const header: HTMLElement | null = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', function (): void {
            if (window.scrollY > 100) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Form validation
    const inputs: NodeListOf<HTMLInputElement> = document.querySelectorAll('#profileForm input[required]');
    inputs.forEach((input: HTMLInputElement) => {
        input.addEventListener('blur', function (): void {
            validateField(this);
        });
        input.addEventListener('input', function (): void {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });

    function validateField(field: HTMLInputElement): boolean {
        const value: string = field.value.trim();
        const fieldName: string | null = field.getAttribute('name');
        let isValid: boolean = true;
        let errorMessage: string = '';

        // Remove existing error
        field.classList.remove('error');
        const existingError: HTMLElement | null = field.parentNode?.querySelector('.error-message') as HTMLElement;
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
        } else if (fieldName === 'email') {
            const emailRegex: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        } else if (fieldName === 'username') {
            const usernameRegex: RegExp = /^[a-zA-Z0-9_]{3,20}$/;
            if (!usernameRegex.test(value)) {
                isValid = false;
                errorMessage = 'Username must be 3-20 characters, letters, numbers, and underscores only';
            }
        } else if (fieldName === 'phone' && value) {
            const phoneRegex: RegExp = /^[\+]?[1-9][\d]{0,15}$/;
            if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
                isValid = false;
                errorMessage = 'Please enter a valid phone number';
            }
        } else if ((fieldName === 'linkedIn' || fieldName === 'github' || fieldName === 'website') && value) {
            const urlRegex: RegExp = /^https?:\/\/.+/;
            if (!urlRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid URL starting with http:// or https://';
            }
        } else if (fieldName === 'gpa' && value) {
            const gpa: number = parseFloat(value);
            if (isNaN(gpa) || gpa < 0 || gpa > 4) {
                isValid = false;
                errorMessage = 'GPA must be between 0.0 and 4.0';
            }
        }

        if (!isValid) {
            field.classList.add('error');
            const errorDiv: HTMLDivElement = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = errorMessage;
            errorDiv.style.cssText = 'color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem;';
            field.parentNode?.appendChild(errorDiv);
        }

        return isValid;
    }

    // Add error styles
    const style: HTMLStyleElement = document.createElement('style');
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
(window as any).handleImageError = function(img: HTMLImageElement): void {
    img.onerror = null; // Prevent infinite loop
    // This will be replaced by the template with the actual generated avatar
    console.log('Image failed to load, using fallback');
};

// Export to make this a module
export {};
