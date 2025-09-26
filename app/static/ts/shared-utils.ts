// Shared utilities for all pages - Default avatars and user dropdown functionality

// Generate default avatar function
export function generateDefaultAvatar(name: string): string {
    if (!name) return 'https://i.ibb.co/QDy827D/default-avatar.png';
    
    // Clean the name and get initials
    const cleanName = name.trim();
    const initials = cleanName.split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
    
    // Generate a consistent color based on name
    const colors = [
        '6D28D9', // Purple
        '3B82F6', // Blue  
        '10B981', // Green
        'F59E0B', // Yellow
        'EF4444', // Red
        '8B5CF6', // Violet
        '06B6D4', // Cyan
        'F97316', // Orange
        'EC4899', // Pink
        '84CC16'  // Lime
    ];
    
    // Simple hash function to get consistent color for same name
    let hash = 0;
    for (let i = 0; i < cleanName.length; i++) {
        hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    const backgroundColor = colors[colorIndex];
    
    // Return UI Avatars URL with custom styling
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${backgroundColor}&color=fff&size=80&font-size=0.6&bold=true`;
}

// Initialize user dropdown functionality
export function initializeUserDropdown(): void {
    const userProfile = document.getElementById('userprofile');
    const dropdownArrow = document.getElementById('dropdownarrow');
    const userDropdown = document.getElementById('userdropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userProfile && dropdownArrow && userDropdown) {
        // Toggle dropdown on click
        userProfile.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
            dropdownArrow.classList.toggle('rotated');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userProfile.contains(e.target as Node)) {
                userDropdown.classList.remove('active');
                dropdownArrow.classList.remove('rotated');
            }
        });

        // Handle dropdown item clicks
        const dropdownItems = userDropdown.querySelectorAll('.dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                const text = this.textContent?.trim().toLowerCase();
                
                switch(text) {
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
function handleLogout(): void {
    if (confirm('Are you sure you want to logout?')) {
        // Clear any local storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Redirect to logout endpoint
        window.location.href = '/logout';
    }
}

// Initialize default avatars for all profile images
export function initializeDefaultAvatars(): void {
    const profileImages = document.querySelectorAll<HTMLImageElement>('img[data-user-name]');
    
    profileImages.forEach(img => {
        const userName = img.getAttribute('data-user-name') || '';
        const currentSrc = img.src;
        
        // If no src or placeholder, set default avatar
        if (!currentSrc || currentSrc.includes('placeholder') || currentSrc === '') {
            img.src = generateDefaultAvatar(userName);
        }
        
        // Handle image load errors
        img.addEventListener('error', function() {
            this.src = generateDefaultAvatar(userName);
        });
    });
}

// Utility to add user dropdown HTML to any page
export function addUserDropdownHTML(username: string, role: string, pfpPath: string): string {
    const avatarSrc = pfpPath || generateDefaultAvatar(username);
    
    return `
        <div class="user-profile" id="userprofile">
            <img src="${avatarSrc}" alt="profile" data-user-name="${username}" onerror="this.src='${generateDefaultAvatar(username)}'">
            <div class="user-info">
                <div class="user-name">${username}</div>
                <div class="user-role">${role}</div>
            </div>
            <i class="fas fa-chevron-down dropdown-arrow" id="dropdownarrow"></i>
            <div class="user-dropdown" id="userdropdown">
                <div class="dropdown-item">
                    <i class="fas fa-user"></i>
                    <span>view profile</span>
                </div>
                <div class="dropdown-item">
                    <i class="fas fa-edit"></i>
                    <span>edit profile</span>
                </div>
                <div class="dropdown-item">
                    <i class="fas fa-cog"></i>
                    <span>settings</span>
                </div>
                <div class="dropdown-item">
                    <i class="fas fa-bell"></i>
                    <span>notifications</span>
                </div>
                <div class="dropdown-item" id="logoutBtn">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>logout</span>
                </div>
            </div>
        </div>
    `;
}

// Initialize everything when DOM is ready
export function initializeSharedComponents(): void {
    initializeUserDropdown();
    initializeDefaultAvatars();
}

// Auto-initialize if this script is loaded directly
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initializeSharedComponents);
}
