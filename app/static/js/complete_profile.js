// Mobile Navigation
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
const links = document.querySelectorAll('.nav-links li');

hamburger.addEventListener('click', () => {
    // Toggle Nav
    navLinks.classList.toggle('open');
    
    // Animate Links
    links.forEach((link, index) => {
        if (link.style.animation) {
            link.style.animation = '';
        } else {
            link.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
        }
    });
    
    // Hamburger Animation
    hamburger.classList.toggle('toggle');
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

// Profile Picture Upload Functionality
const profilePictureInput = document.getElementById('profile-picture');
const profilePreview = document.getElementById('profile-preview');

if (profilePictureInput && profilePreview) {
    // Click on preview to trigger file input
    profilePreview.addEventListener('click', () => {
        profilePictureInput.click();
    });

    // Handle file selection and preview
    profilePictureInput.addEventListener('change', function (e) {
        const file = e.target.files[0];

        if (file) {
            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
            if (!validTypes.includes(file.type)) {
                alert('Please select a valid image file (JPG, PNG, or GIF)');
                return;
            }

            // Validate file size (5MB max)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            if (file.size > maxSize) {
                alert('File size must be less than 5MB');
                return;
            }

            // Create preview
            const reader = new FileReader();
            reader.onload = function (e) {
                profilePreview.innerHTML = `<img src="${e.target.result}" alt="Profile Preview">`;
                profilePreview.classList.add('has-image');
            };
            reader.readAsDataURL(file);
        }
    });

    // Allow drag and drop
    profilePreview.addEventListener('dragover', (e) => {
        e.preventDefault();
        profilePreview.style.borderColor = 'var(--primary)';
        profilePreview.style.backgroundColor = 'rgba(109, 40, 217, 0.1)';
    });

    profilePreview.addEventListener('dragleave', (e) => {
        e.preventDefault();
        profilePreview.style.borderColor = '#e2e8f0';
        profilePreview.style.backgroundColor = '#f8fafc';
    });

    profilePreview.addEventListener('drop', (e) => {
        e.preventDefault();
        profilePreview.style.borderColor = '#e2e8f0';
        profilePreview.style.backgroundColor = '#f8fafc';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            profilePictureInput.files = files;
            profilePictureInput.dispatchEvent(new Event('change'));
        }
    });
}

// Chatbase Integration
(function(){if(!window.chatbase||window.chatbase("getState")!=="initialized"){window.chatbase=(...arguments)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(arguments)};window.chatbase=new Proxy(window.chatbase,{get(target,prop){if(prop==="q"){return target.q}return(...args)=>target(prop,...args)}})}const onLoad=function(){const script=document.createElement("script");script.src="https://www.chatbase.co/embed.min.js";script.id="rUFhD5wxmCkjLaxaWfwKk";script.domain="www.chatbase.co";document.body.appendChild(script)};if(document.readyState==="complete"){onLoad()}else{window.addEventListener("load",onLoad)}})();
