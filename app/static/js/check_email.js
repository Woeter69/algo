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
        }
        else {
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
// Open email client
document.querySelector('.btn:nth-child(1)').addEventListener('click', function (e) {
    e.preventDefault();
    window.location.href = 'mailto:';
});
// Chatbase script
(function () { if (!window.chatbase || window.chatbase("getState") !== "initialized") {
    window.chatbase = (...arguments) => { if (!window.chatbase.q) {
        window.chatbase.q = [];
    } window.chatbase.q.push(arguments); };
    window.chatbase = new Proxy(window.chatbase, { get(target, prop) { if (prop === "q") {
            return target.q;
        } return (...args) => target(prop, ...args); } });
} const onLoad = function () { const script = document.createElement("script"); script.src = "https://www.chatbase.co/embed.min.js"; script.id = "rUFhD5wxmCkjLaxaWfwKk"; script.setAttribute("domain", "www.chatbase.co"); document.body.appendChild(script); }; if (document.readyState === "complete") {
    onLoad();
}
else {
    window.addEventListener("load", onLoad);
} })();
