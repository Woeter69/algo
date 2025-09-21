// Dashboard TypeScript - User Dashboard functionality
// 🎉 TEST: This line was added to show TS → JS compilation!

// Dashboard Carousel/Slider Functionality
let currentSlideIndex: number = 0;
const slides = document.querySelectorAll<HTMLElement>('.slide');

function showSlide(index: number): void {
    slides.forEach((slide, i) => {
        slide.style.display = i === index ? 'block' : 'none';
    });
}

function changeSlide(direction: number): void {
    currentSlideIndex += direction;
    if (currentSlideIndex >= slides.length) {
        currentSlideIndex = 0;
    } else if (currentSlideIndex < 0) {
        currentSlideIndex = slides.length - 1;
    }
    showSlide(currentSlideIndex);
}

function currentSlide(index: number): void {
    showSlide(index - 1);
}

// Auto-slide every 5 seconds
setInterval(() => {
    changeSlide(1);
}, 5000);

// Mobile Navigation
const hamburger = document.querySelector<HTMLElement>('.hamburger');
const navLinks = document.querySelector<HTMLElement>('.nav-links');
const links = document.querySelectorAll<HTMLLIElement>('.nav-links li');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        hamburger.classList.toggle('toggle');

        links.forEach((link, index) => {
            if (link.style.animation) {
                link.style.animation = '';
            } else {
                link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
            }
        });
    });
}

// Close mobile menu when clicking on a nav link
links.forEach(link => {
    link.addEventListener('click', () => {
        if (navLinks && hamburger) {
            navLinks.classList.remove('open');
            hamburger.classList.remove('toggle');
            links.forEach(link => {
                link.style.animation = '';
            });
        }
    });
});

// Scroll Header Effect
window.addEventListener('scroll', () => {
    const header = document.querySelector<HTMLElement>('header');
    if (header) {
        header.classList.toggle('scrolled', window.scrollY > 50);
    }
});

// User Profile Dropdown with proper typing
const userProfile = document.getElementById('userprofile') as HTMLElement | null;
const userDropdown = document.getElementById('userdropdown') as HTMLElement | null;
const dropdownArrow = document.getElementById('dropdownarrow') as HTMLElement | null;

if (userProfile && userDropdown && dropdownArrow) {
    userProfile.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        userDropdown.classList.toggle('show');
        dropdownArrow.classList.toggle('rotated');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e: Event) => {
        if (!userProfile.contains(e.target as Node)) {
            userDropdown.classList.remove('show');
            dropdownArrow.classList.remove('rotated');
        }
    });

    // Handle dropdown item clicks with proper typing
    const dropdownItems = document.querySelectorAll<HTMLElement>('.dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            const spanElement = item.querySelector('span');
            const text = spanElement?.textContent?.toLowerCase() || '';

            switch (text) {
                case 'view profile':
                    console.log('View Profile clicked');
                    // Add your view profile logic here
                    break;
                case 'edit profile':
                    console.log('Edit Profile clicked');
                    // Add your edit profile logic here
                    break;
                case 'settings':
                    console.log('Settings clicked');
                    // Add your settings logic here
                    break;
                case 'notifications':
                    console.log('Chat TypeScript initialization complete');
                    console.log('🎉 TEST: This was added to TypeScript file!');
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
const logoutBtn = document.getElementById('logoutBtn') as HTMLElement | null;
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Are you sure you want to logout?')) {
            console.log('Logging out...');
            window.location.href = '/logout';
        }
    });
}

// Action card animations with proper typing
const actionCards = document.querySelectorAll<HTMLElement>('.action-card');
actionCards.forEach(card => {
    card.addEventListener('mouseenter', function(this: HTMLElement) {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });

    card.addEventListener('mouseleave', function(this: HTMLElement) {
        this.style.transform = 'translateY(-10px)';
    });
});

// Export functions for potential external use
export { showSlide, changeSlide, currentSlide };
