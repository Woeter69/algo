// Dashboard TypeScript - User Dashboard functionality
console.log('🚀 User Dashboard TypeScript loaded!');
// Dashboard Carousel/Slider Functionality
let currentSlideIndex = 0;
const slides = document.querySelectorAll('.slide');
function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.style.display = i === index ? 'block' : 'none';
    });
}
function changeSlide(direction) {
    currentSlideIndex += direction;
    if (currentSlideIndex >= slides.length) {
        currentSlideIndex = 0;
    }
    else if (currentSlideIndex < 0) {
        currentSlideIndex = slides.length - 1;
    }
    showSlide(currentSlideIndex);
}
function currentSlide(index) {
    showSlide(index - 1);
}
// Auto-slide every 5 seconds
setInterval(() => {
    changeSlide(1);
}, 5000);
// Mobile Navigation
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const links = document.querySelectorAll('.nav-links li');
if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        hamburger.classList.toggle('toggle');
        links.forEach((link, index) => {
            if (link.style.animation) {
                link.style.animation = '';
            }
            else {
                link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
            }
        });
    });
}
// Close mobile menu when clicking on a nav link
links.forEach((link) => {
    link.addEventListener('click', () => {
        if (navLinks && hamburger) {
            navLinks.classList.remove('open');
            hamburger.classList.remove('toggle');
            links.forEach((link) => {
                link.style.animation = '';
            });
        }
    });
});
// Scroll Header Effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (header) {
        header.classList.toggle('scrolled', window.scrollY > 50);
    }
});
// User Profile Dropdown with proper typing
const userProfile = document.getElementById('userprofile');
const userDropdown = document.getElementById('userdropdown');
const dropdownArrow = document.getElementById('dropdownarrow');
if (userProfile && userDropdown && dropdownArrow) {
    console.log('✅ Dashboard dropdown elements found, adding event listeners...');
    userProfile.addEventListener('click', (e) => {
        console.log('🖱️ Dashboard dropdown clicked!');
        e.stopPropagation();
        userDropdown.classList.toggle('show');
        dropdownArrow.classList.toggle('rotated');
    });
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userProfile.contains(e.target)) {
            userDropdown.classList.remove('show');
            dropdownArrow.classList.remove('rotated');
        }
    });
    // Handle dropdown item clicks with proper typing
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const spanElement = item.querySelector('span');
            const text = spanElement?.textContent?.toLowerCase() || '';
            switch (text) {
                case 'view profile':
                    console.log('View Profile clicked');
                    window.location.href = '/profile';
                    break;
                case 'edit profile':
                    console.log('Edit Profile clicked');
                    // Add your edit profile logic here
                    break;
                case 'settings':
                    console.log('Settings clicked');
                    window.location.href = '/settings';
                    break;
                case 'change password':
                    console.log('Change Password clicked');
                    window.location.href = '/forgot-password';
                    break;
                case 'notifications':
                    console.log('Dashboard TypeScript initialization complete');
                    console.log('🎉 TypeScript dropdown functionality working!');
                    // Add your notifications logic here
                    break;
                case 'logout':
                    // Logout functionality with confirmation
                    if (confirm('Are you sure you want to logout?')) {
                        console.log('Logging out...');
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
            console.log('Logging out...');
            window.location.href = '/logout';
        }
    });
}
// Action card animations with proper typing
const actionCards = document.querySelectorAll('.action-card');
actionCards.forEach((card) => {
    card.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });
    card.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(-10px)';
    });
});
// Export functions for potential external use
export { showSlide, changeSlide, currentSlide };
