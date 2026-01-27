// Limited Dashboard JavaScript
// Mobile Navigation
const hamburgerLimited = document.querySelector('.hamburger');
const navLinksLimited = document.querySelector('.nav-links');
const linksLimited = document.querySelectorAll('.nav-links li');
if (hamburgerLimited) {
    hamburgerLimited.addEventListener('click', () => {
        // Toggle Nav
        navLinksLimited?.classList.toggle('open');
        // Animate Links
        linksLimited.forEach((link, index) => {
            const element = link;
            if (element.style.animation) {
                element.style.animation = '';
            }
            else {
                element.style.animation = `navLinkFade 0.5s ease forwards ${index / 7 + 0.3}s`;
            }
        });
        // Hamburger Animation
        hamburgerLimited.classList.toggle('toggle');
    });
}
// Close mobile menu when clicking on a nav link
linksLimited.forEach(link => {
    link.addEventListener('click', () => {
        navLinksLimited?.classList.remove('open');
        hamburgerLimited?.classList.remove('toggle');
        linksLimited.forEach(link => {
            link.style.animation = '';
        });
    });
});
// Scroll Header Effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (header) {
        header.classList.toggle('scrolled', window.scrollY > 50);
    }
});
// Feature Card Interactions
const featureCards = document.querySelectorAll('.feature-card.locked');
featureCards.forEach(card => {
    card.addEventListener('click', () => {
        // Show tooltip or modal about verification requirement
        showVerificationTooltip(card);
    });
});
function showVerificationTooltip(card) {
    // Remove any existing tooltips
    const existingTooltip = document.querySelector('.verification-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'verification-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-content">
            <i class="fas fa-lock"></i>
            <p>This feature requires verification. <a href="/verification_request">Request verification</a> to unlock.</p>
        </div>
    `;
    // Position tooltip
    const rect = card.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.top = rect.top + 'px';
    tooltip.style.left = rect.left + 'px';
    tooltip.style.width = rect.width + 'px';
    tooltip.style.height = rect.height + 'px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '1000';
    document.body.appendChild(tooltip);
    // Remove tooltip after 3 seconds
    setTimeout(() => {
        if (tooltip.parentNode) {
            tooltip.remove();
        }
    }, 3000);
}
// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
// Add CSS for tooltip
const tooltipStyle = document.createElement('style');
tooltipStyle.textContent = `
    .verification-tooltip {
        background: rgba(0, 0, 0, 0.9);
        color: white;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    }
    
    .tooltip-content {
        text-align: center;
        padding: 1rem;
    }
    
    .tooltip-content i {
        font-size: 2rem;
        margin-bottom: 0.5rem;
        display: block;
    }
    
    .tooltip-content p {
        margin: 0;
        font-size: 0.9rem;
    }
    
    .tooltip-content a {
        color: #F59E0B;
        text-decoration: underline;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes navLinkFade {
        from {
            opacity: 0;
            transform: translateX(50px);
        }
        to {
            opacity: 1;
            transform: translateX(0px);
        }
    }
    
    .nav-links.open {
        transform: translateX(0%);
    }
    
    .hamburger.toggle .line1 {
        transform: rotate(-45deg) translate(-5px, 6px);
    }
    
    .hamburger.toggle .line2 {
        opacity: 0;
    }
    
    .hamburger.toggle .line3 {
        transform: rotate(45deg) translate(-5px, -6px);
    }
    
    header.scrolled {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
    }
`;
document.head.appendChild(tooltipStyle);
// Add mobile navigation styles
const mobileStyle = document.createElement('style');
mobileStyle.textContent = `
    @media (max-width: 768px) {
        .nav-links {
            position: fixed;
            background: white;
            height: 100vh;
            width: 100%;
            flex-direction: column;
            clip-path: circle(100px at 90% -10%);
            -webkit-clip-path: circle(100px at 90% -10%);
            transition: all 1s ease-out;
            pointer-events: none;
            top: 0;
            left: 0;
            justify-content: center;
            align-items: center;
            z-index: 999;
        }
        
        .nav-links.open {
            clip-path: circle(1000px at 90% -10%);
            -webkit-clip-path: circle(1000px at 90% -10%);
            pointer-events: all;
        }
        
        .nav-links li {
            opacity: 0;
        }
        
        .nav-links li a {
            font-size: 1.5rem;
            color: var(--text-primary);
        }
    }
`;
document.head.appendChild(mobileStyle);
