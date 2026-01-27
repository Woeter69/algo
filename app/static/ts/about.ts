// About Us Page JavaScript
document.addEventListener('DOMContentLoaded', function () {
    initializeAboutPage();
});

function initializeAboutPage() {
    // Initialize navigation
    initializeAboutNavigation();
    
    // Initialize animations
    initializeAnimations();
    
    // Initialize team card interactions
    initializeTeamCards();
}

// Navigation functionality
function initializeAboutNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking on a link
    const navItems = document.querySelectorAll('.nav-links a');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navLinks.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });
}

// Scroll animations
function initializeAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                (entry.target as HTMLElement).style.opacity = '1';
                (entry.target as HTMLElement).style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe team cards and value cards
    const animatedElements = document.querySelectorAll('.team-card, .value-card');
    animatedElements.forEach(el => {
        (el as HTMLElement).style.opacity = '0';
        (el as HTMLElement).style.transform = 'translateY(30px)';
        (el as HTMLElement).style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Team card interactions
function initializeTeamCards() {
    const teamCards = document.querySelectorAll('.team-card');
    
    teamCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Smooth scrolling for anchor links
function smoothScroll(target) {
    const element = document.querySelector(target);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Add some interactive effects
document.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.98)';
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        header.style.background = 'rgba(255, 255, 255, 0.95)';
        header.style.boxShadow = 'none';
    }
});

// Team member data for easy editing (you can modify this object to update team details)
const teamMembers = [
    {
        name: "Pranjul",
        role: "Full Stack Developer",
        email: "pranjul@algo.com",
        github: "#",
        linkedin: "#",
        avatar: "https://ui-avatars.com/api/?name=Pranjul&background=6D28D9&color=fff&size=200"
    },
    {
        name: "Aditya",
        role: "Backend Developer", 
        email: "aditya@algo.com",
        github: "#",
        linkedin: "#",
        avatar: "https://ui-avatars.com/api/?name=Aditya&background=8B5CF6&color=fff&size=200"
    },
    {
        name: "Nandini",
        role: "Frontend Developer",
        email: "nandini@algo.com", 
        github: "#",
        linkedin: "#",
        avatar: "https://ui-avatars.com/api/?name=Nandini&background=9F1239&color=fff&size=200"
    },
    {
        name: "Chandragupt",
        role: "UI/UX Designer",
        email: "chandragupt@algo.com",
        github: "#", 
        linkedin: "#",
        avatar: "https://ui-avatars.com/api/?name=Chandragupt&background=34D399&color=fff&size=200"
    },
    {
        name: "Himanshu", 
        role: "DevOps Engineer",
        email: "himanshu@algo.com",
        github: "#",
        linkedin: "#", 
        avatar: "https://ui-avatars.com/api/?name=Himanshu&background=F59E0B&color=fff&size=200"
    },
    {
        name: "Ovesh",
        role: "Product Manager", 
        email: "ovesh@algo.com",
        github: "#",
        linkedin: "#",
        avatar: "https://ui-avatars.com/api/?name=Ovesh&background=EF4444&color=fff&size=200"
    }
];

// Function to update team member details (for future editing)
function updateTeamMember(index, newData) {
    if (index >= 0 && index < teamMembers.length) {
        teamMembers[index] = { ...teamMembers[index], ...newData };
        renderTeamMembers();
    }
}

// Function to render team members (for dynamic updates)
function renderTeamMembers() {
    const teamGrid = document.querySelector('.team-grid');
    if (!teamGrid) return;
    
    teamGrid.innerHTML = teamMembers.map(member => `
        <div class="team-card">
            <div class="member-image">
                <img src="${member.avatar}" alt="${member.name}">
            </div>
            <div class="member-info">
                <h3>${member.name}</h3>
                <p class="member-role">${member.role}</p>
                <p class="member-email">${member.email}</p>
                <div class="social-links">
                    <a href="${member.github}" target="_blank" title="GitHub">
                        <i class="fab fa-github"></i>
                    </a>
                    <a href="${member.linkedin}" target="_blank" title="LinkedIn">
                        <i class="fab fa-linkedin-in"></i>
                    </a>
                </div>
            </div>
        </div>
    `).join('');
    
    // Re-initialize animations for new elements
    initializeTeamCards();
}

// Export team data for external editing
(window as any).ALGO_TEAM_DATA = teamMembers;
(window as any).updateTeamMember = updateTeamMember;
