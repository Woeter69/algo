// @ts-nocheck
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

// Form Validation
const registerForm = document.querySelector('.auth-form');
if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
        const firstname = (document.getElementById('firstname') as HTMLInputElement)?.value;
        const lastname = (document.getElementById('lastname') as HTMLInputElement)?.value;
        const email = (document.getElementById('email') as HTMLInputElement)?.value;
        const username = (document.getElementById('username') as HTMLInputElement)?.value;
        const password = (document.getElementById('password') as HTMLInputElement)?.value;

        if (!firstname || !lastname || !email || !username || !password) {
            const error = 'Registration Error: All fields are required';
            console.error(error);
            alert(error);
            e.preventDefault();
            return;
        }

        if (password.length < 8) {
            const error = 'Registration Error: Password must be at least 8 characters long';
            console.error(error);
            alert(error);
            e.preventDefault();
            return;
        }

        if (username.length < 3) {
            const error = 'Registration Error: Username must be at least 3 characters long';
            console.error(error);
            alert(error);
            e.preventDefault();
            return;
        }
    });
}

// Chatbase Integration
(function(){if(!window.chatbase||window.chatbase("getState")!=="initialized"){window.chatbase=(...arguments)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(arguments)};window.chatbase=new Proxy(window.chatbase,{get(target,prop){if(prop==="q"){return target.q}return(...args)=>target(prop,...args)}})}const onLoad=function(){const script=document.createElement("script");script.src="https://www.chatbase.co/embed.min.js";script.id="rUFhD5wxmCkjLaxaWfwKk";script.setAttribute("domain", "www.chatbase.co");document.body.appendChild(script)};if(document.readyState==="complete"){onLoad()}else{window.addEventListener("load",onLoad)}})();
