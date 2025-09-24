// Recommendations page JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Sample data for recommendations
    const recommendedPeople = [
        {
            id: 1,
            name: "Sarah Johnson",
            title: "Senior Software Engineer",
            company: "Google",
            university: "Stanford University",
            graduationYear: "2020",
            location: "San Francisco, CA",
            avatar: "https://via.placeholder.com/80",
            skills: ["JavaScript", "React", "Node.js", "Python"],
            connectionReason: {
                title: "Mutual Connections",
                text: "You have 5 mutual connections including Alex Chen and Maria Rodriguez"
            },
            connectionStatus: "none"
        },
        {
            id: 2,
            name: "Michael Chen",
            title: "Product Manager",
            company: "Microsoft",
            university: "MIT",
            graduationYear: "2019",
            location: "Seattle, WA",
            avatar: "https://via.placeholder.com/80",
            skills: ["Product Strategy", "Data Analysis", "Agile", "Leadership"],
            connectionReason: {
                title: "Similar Interests",
                text: "Both interested in Technology and Product Management"
            },
            connectionStatus: "none"
        },
        {
            id: 3,
            name: "Emily Rodriguez",
            title: "Investment Analyst",
            company: "Goldman Sachs",
            university: "Harvard University",
            graduationYear: "2021",
            location: "New York, NY",
            avatar: "https://via.placeholder.com/80",
            skills: ["Financial Modeling", "Excel", "Bloomberg", "Risk Analysis"],
            connectionReason: {
                title: "Career Path",
                text: "Similar career progression in finance sector"
            },
            connectionStatus: "none"
        }
    ];

    const universityAlumni = [
        {
            id: 4,
            name: "David Kim",
            title: "Data Scientist",
            company: "Netflix",
            university: "Cluster Innovation Center",
            graduationYear: "2022",
            location: "Los Angeles, CA",
            avatar: "https://via.placeholder.com/80",
            skills: ["Machine Learning", "Python", "SQL", "Statistics"],
            connectionReason: {
                title: "Same University",
                text: "Fellow graduate from Cluster Innovation Center"
            },
            connectionStatus: "none"
        },
        {
            id: 5,
            name: "Jessica Wang",
            title: "UX Designer",
            company: "Airbnb",
            university: "Cluster Innovation Center",
            graduationYear: "2020",
            location: "San Francisco, CA",
            avatar: "https://via.placeholder.com/80",
            skills: ["Figma", "User Research", "Prototyping", "Design Systems"],
            connectionReason: {
                title: "Same University",
                text: "Alumni from Cluster Innovation Center, Class of 2020"
            },
            connectionStatus: "none"
        },
        {
            id: 6,
            name: "Robert Taylor",
            title: "Software Developer",
            company: "Startup Inc",
            university: "Cluster Innovation Center",
            graduationYear: "2021",
            location: "Delhi, India",
            avatar: "https://via.placeholder.com/80",
            skills: ["Java", "Spring Boot", "AWS", "Docker"],
            connectionReason: {
                title: "Same University",
                text: "Recent graduate from your alma mater"
            },
            connectionStatus: "none"
        }
    ];

    const industryProfessionals = [
        {
            id: 7,
            name: "Lisa Anderson",
            title: "Senior Developer",
            company: "Tech Solutions",
            university: "UC Berkeley",
            graduationYear: "2018",
            location: "Austin, TX",
            avatar: "https://via.placeholder.com/80",
            skills: ["React", "Node.js", "MongoDB", "GraphQL"],
            connectionReason: {
                title: "Same Industry",
                text: "Both working in software development"
            },
            connectionStatus: "none"
        },
        {
            id: 8,
            name: "James Wilson",
            title: "Full Stack Engineer",
            company: "Digital Agency",
            university: "NYU",
            graduationYear: "2019",
            location: "New York, NY",
            avatar: "https://via.placeholder.com/80",
            skills: ["Vue.js", "Laravel", "MySQL", "Docker"],
            connectionReason: {
                title: "Similar Role",
                text: "Both working as software engineers"
            },
            connectionStatus: "none"
        },
        {
            id: 9,
            name: "Amanda Foster",
            title: "Frontend Developer",
            company: "Creative Studio",
            university: "Georgia Tech",
            graduationYear: "2020",
            location: "Atlanta, GA",
            avatar: "https://via.placeholder.com/80",
            skills: ["Angular", "TypeScript", "SASS", "Webpack"],
            connectionReason: {
                title: "Technology Stack",
                text: "Similar technology interests and skills"
            },
            connectionStatus: "none"
        }
    ];

    // Mobile navigation
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('toggle');
            navLinks.classList.toggle('open');
        });
    }

    // Render people function
    function renderPeople(people, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        people.forEach(person => {
            const card = createPersonCard(person);
            container.appendChild(card);
        });
    }

    function createPersonCard(person) {
        const card = document.createElement('div');
        card.className = 'person-card';
        
        let actionButtons = '';
        if (person.connectionStatus === 'connected') {
            actionButtons = '<button class="btn-small btn-connected">Connected</button>';
        } else if (person.connectionStatus === 'pending') {
            actionButtons = '<button class="btn-small btn-pending">Request Sent</button>';
        } else {
            actionButtons = `
                <button class="btn-small btn-connect" onclick="connectWithPerson(${person.id})">Connect</button>
                <button class="btn-small btn-view" onclick="viewProfile(${person.id})">View Profile</button>
            `;
        }
        
        card.innerHTML = `
            <div class="person-header">
                <div class="person-avatar">
                    <img src="${person.avatar}" alt="${person.name}">
                </div>
                <div class="person-info">
                    <h3>${person.name}</h3>
                    <div class="title">${person.title}</div>
                    <div class="company">${person.company}</div>
                </div>
            </div>
            <div class="connection-reason">
                <div class="reason-title">${person.connectionReason.title}</div>
                <div class="reason-text">${person.connectionReason.text}</div>
            </div>
            <div class="person-details">
                <div class="detail-item">
                    <i class="fas fa-graduation-cap"></i>
                    <span>${person.university}, ${person.graduationYear}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${person.location}</span>
                </div>
            </div>
            <div class="person-skills">
                <div class="skills-container">
                    ${person.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                </div>
            </div>
            <div class="person-actions">
                ${actionButtons}
            </div>
        `;
        
        return card;
    }

    // Global functions for button clicks
    window.connectWithPerson = function(personId) {
        // Find the person in all arrays
        let person = [...recommendedPeople, ...universityAlumni, ...industryProfessionals]
            .find(p => p.id === personId);
        
        if (person) {
            // Update connection status
            person.connectionStatus = 'pending';
            
            // Show success message
            showNotification(`Connection request sent to ${person.name}!`, 'success');
            
            // Re-render all sections
            renderAllSections();
        }
    };

    window.viewProfile = function(personId) {
        // Find the person in all arrays
        let person = [...recommendedPeople, ...universityAlumni, ...industryProfessionals]
            .find(p => p.id === personId);
        
        if (person) {
            showNotification(`Viewing ${person.name}'s profile...`, 'info');
            // In a real app, this would navigate to the person's profile page
        }
    };

    // Render all sections
    function renderAllSections() {
        renderPeople(recommendedPeople, 'recommendedPeople');
        renderPeople(universityAlumni, 'universityAlumni');
        renderPeople(industryProfessionals, 'industryProfessionals');
    }

    // Notification function
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#6D28D9'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            z-index: 3000;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Header scroll effect
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 100) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Navigation links
    const navLinksElements = document.querySelectorAll('.nav-links a[data-section]');
    navLinksElements.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            
            console.log('Navigate to:', section);
            
            if (navLinks && navLinks.classList.contains('open')) {
                hamburger.classList.remove('toggle');
                navLinks.classList.remove('open');
            }
        });
    });

    // Initial render
    renderAllSections();
});