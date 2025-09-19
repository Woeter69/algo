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
    } else if (currentSlideIndex < 0) {
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

// Close mobile menu when clicking on a nav link
links.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('toggle');
        links.forEach(link => {
            link.style.animation = '';
        });
    });
});

// Scroll Header Effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    header.classList.toggle('scrolled', window.scrollY > 50);
});

// User Profile Dropdown
const userProfile = document.getElementById('userProfile');
const userDropdown = document.getElementById('userDropdown');
const dropdownArrow = document.getElementById('dropdownArrow');

userProfile.addEventListener('click', (e) => {
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

// Handle dropdown item clicks
const dropdownItems = document.querySelectorAll('.dropdown-item');
dropdownItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = item.querySelector('span').textContent;

        switch (text) {
            case 'View Profile':
                // Add your view profile logic here
                console.log('View Profile clicked');
                break;
            case 'Edit Profile':
                // Add your edit profile logic here
                console.log('Edit Profile clicked');
                break;
            case 'Settings':
                // Add your settings logic here
                console.log('Settings clicked');
                break;
            case 'Notifications':
                // Add your notifications logic here
                console.log('Notifications clicked');
                break;
            case 'Logout':
                // Add your logout logic here
                if (confirm('Are you sure you want to logout?')) {
                    console.log('Logout clicked');
                    // window.location.href = '/logout';
                }
                break;
        }

        // Close dropdown after click
        userDropdown.classList.remove('show');
        dropdownArrow.classList.remove('rotated');
    });
});

// Action card animations
const actionCards = document.querySelectorAll('.action-card');
actionCards.forEach(card => {
    card.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });

    card.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(-10px)';
    });
});
