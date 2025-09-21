// Connect page JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Sample data for demonstration
    const samplePeople = [
        {
            id: 1,
            name: "Sarah Johnson",
            title: "Senior Software Engineer",
            company: "Google",
            university: "Stanford University",
            graduationYear: "2020",
            location: "San Francisco, CA",
            industry: "Technology",
            avatar: "https://via.placeholder.com/80",
            skills: ["JavaScript", "React", "Node.js", "Python"],
            connectionStatus: "none", // none, pending, connected
            isRecommended: true
        },
        {
            id: 2,
            name: "Michael Chen",
            title: "Product Manager",
            company: "Microsoft",
            university: "MIT",
            graduationYear: "2019",
            location: "Seattle, WA",
            industry: "Technology",
            avatar: "https://via.placeholder.com/80",
            skills: ["Product Strategy", "Data Analysis", "Agile", "Leadership"],
            connectionStatus: "none",
            isRecommended: true
        },
        {
            id: 3,
            name: "Emily Rodriguez",
            title: "Investment Analyst",
            company: "Goldman Sachs",
            university: "Harvard University",
            graduationYear: "2021",
            location: "New York, NY",
            industry: "Finance",
            avatar: "https://via.placeholder.com/80",
            skills: ["Financial Modeling", "Excel", "Bloomberg", "Risk Analysis"],
            connectionStatus: "connected",
            isRecommended: false
        },
        {
            id: 4,
            name: "David Kim",
            title: "Data Scientist",
            company: "Netflix",
            university: "UC Berkeley",
            graduationYear: "2022",
            location: "Los Angeles, CA",
            industry: "Technology",
            avatar: "https://via.placeholder.com/80",
            skills: ["Machine Learning", "Python", "SQL", "Statistics"],
            connectionStatus: "pending",
            isRecommended: true
        },
        {
            id: 5,
            name: "Jessica Wang",
            title: "UX Designer",
            company: "Airbnb",
            university: "Stanford University",
            graduationYear: "2020",
            location: "San Francisco, CA",
            industry: "Technology",
            avatar: "https://via.placeholder.com/80",
            skills: ["Figma", "User Research", "Prototyping", "Design Systems"],
            connectionStatus: "none",
            isRecommended: false
        },
        {
            id: 6,
            name: "Robert Taylor",
            title: "Management Consultant",
            company: "McKinsey & Company",
            university: "Harvard University",
            graduationYear: "2018",
            location: "Boston, MA",
            industry: "Consulting",
            avatar: "https://via.placeholder.com/80",
            skills: ["Strategy", "Analytics", "Presentation", "Problem Solving"],
            connectionStatus: "none",
            isRecommended: false
        }
    ];

    let currentPeople = [...samplePeople];
    let displayedCount = 0;
    const itemsPerLoad = 6;

    // Mobile navigation
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('toggle');
            navLinks.classList.toggle('open');
        });
    }

    // Filter functionality
    const filterBtn = document.getElementById('filterBtn');
    const filtersSection = document.getElementById('filtersSection');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const applyFiltersBtn = document.getElementById('applyFilters');

    if (filterBtn && filtersSection) {
        filterBtn.addEventListener('click', function() {
            filtersSection.classList.toggle('active');
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function() {
            // Reset all filter dropdowns
            document.querySelectorAll('.filters-section select').forEach(select => {
                select.value = '';
            });
            // Reset search input
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';
            // Apply filters (which will show all people)
            applyFilters();
        });
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }

    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        if (query) {
            currentPeople = samplePeople.filter(person => 
                person.name.toLowerCase().includes(query) ||
                person.company.toLowerCase().includes(query) ||
                person.title.toLowerCase().includes(query) ||
                person.skills.some(skill => skill.toLowerCase().includes(query))
            );
        } else {
            currentPeople = [...samplePeople];
        }
        displayedCount = 0;
        renderPeople();
    }

    function applyFilters() {
        const university = document.getElementById('universityFilter').value;
        const year = document.getElementById('yearFilter').value;
        const industry = document.getElementById('industryFilter').value;
        const location = document.getElementById('locationFilter').value;
        const searchQuery = searchInput.value.toLowerCase().trim();

        currentPeople = samplePeople.filter(person => {
            const matchesUniversity = !university || person.university.toLowerCase().includes(university);
            const matchesYear = !year || person.graduationYear === year;
            const matchesIndustry = !industry || person.industry.toLowerCase() === industry;
            const matchesLocation = !location || person.location.toLowerCase().includes(location.replace('-', ' '));
            const matchesSearch = !searchQuery || 
                person.name.toLowerCase().includes(searchQuery) ||
                person.company.toLowerCase().includes(searchQuery) ||
                person.title.toLowerCase().includes(searchQuery) ||
                person.skills.some(skill => skill.toLowerCase().includes(searchQuery));

            return matchesUniversity && matchesYear && matchesIndustry && matchesLocation && matchesSearch;
        });

        displayedCount = 0;
        renderPeople();
        filtersSection.classList.remove('active');
    }

    // Modal functionality
    const connectionModal = document.getElementById('connectionModal');
    const profileModal = document.getElementById('profileModal');
    const closeConnectionModal = document.getElementById('closeConnectionModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const cancelConnection = document.getElementById('cancelConnection');
    const closePreview = document.getElementById('closePreview');
    const connectionForm = document.getElementById('connectionForm');

    let selectedPerson = null;

    function openConnectionModal(person) {
        selectedPerson = person;
        const personPreview = document.getElementById('personPreview');
        personPreview.innerHTML = `
            <div class="person-avatar">
                <img src="${person.avatar}" alt="${person.name}">
            </div>
            <div class="person-info">
                <h3>${person.name}</h3>
                <div class="title">${person.title}</div>
                <div class="company">${person.company}</div>
            </div>
        `;
        connectionModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function openProfileModal(person) {
        selectedPerson = person;
        const profilePreview = document.getElementById('profilePreview');
        profilePreview.innerHTML = `
            <div class="person-avatar">
                <img src="${person.avatar}" alt="${person.name}">
            </div>
            <h3>${person.name}</h3>
            <div class="title">${person.title} at ${person.company}</div>
            <div class="detail-item">
                <i class="fas fa-graduation-cap"></i>
                <span>${person.university}, Class of ${person.graduationYear}</span>
            </div>
            <div class="detail-item">
                <i class="fas fa-map-marker-alt"></i>
                <span>${person.location}</span>
            </div>
            <div class="detail-item">
                <i class="fas fa-briefcase"></i>
                <span>${person.industry}</span>
            </div>
            <div class="person-skills">
                <h4>Skills</h4>
                <div class="skills-container">
                    ${person.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                </div>
            </div>
        `;
        
        const connectBtn = document.getElementById('connectFromPreview');
        connectBtn.onclick = () => {
            profileModal.classList.remove('active');
            openConnectionModal(person);
        };
        
        profileModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        connectionModal.classList.remove('active');
        profileModal.classList.remove('active');
        document.body.style.overflow = 'auto';
        selectedPerson = null;
    }

    // Modal close events
    if (closeConnectionModal) closeConnectionModal.addEventListener('click', closeModal);
    if (closeProfileModal) closeProfileModal.addEventListener('click', closeModal);
    if (cancelConnection) cancelConnection.addEventListener('click', closeModal);
    if (closePreview) closePreview.addEventListener('click', closeModal);

    // Close modal when clicking outside
    [connectionModal, profileModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeModal();
                }
            });
        }
    });

    // Connection form submission
    if (connectionForm) {
        connectionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (selectedPerson) {
                // Update person's connection status
                selectedPerson.connectionStatus = 'pending';
                
                // Show success message
                showNotification('Connection request sent successfully!', 'success');
                
                // Re-render people to update button states
                renderPeople();
                
                // Close modal
                closeModal();
            }
        });
    }

    // Render people function
    function renderPeople() {
        const recommendedContainer = document.getElementById('recommendedPeople');
        const allPeopleContainer = document.getElementById('allPeople');
        
        // Clear containers
        recommendedContainer.innerHTML = '';
        allPeopleContainer.innerHTML = '';
        
        // Separate recommended and all people
        const recommendedPeople = currentPeople.filter(person => person.isRecommended);
        const allPeople = currentPeople.filter(person => !person.isRecommended);
        
        // Render recommended people
        recommendedPeople.forEach(person => {
            recommendedContainer.appendChild(createPersonCard(person));
        });
        
        // Render all people (with pagination)
        const peopleToShow = allPeople.slice(0, displayedCount + itemsPerLoad);
        peopleToShow.forEach(person => {
            allPeopleContainer.appendChild(createPersonCard(person));
        });
        
        displayedCount = peopleToShow.length;
        
        // Show/hide load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = displayedCount < allPeople.length ? 'inline-block' : 'none';
        }
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
            <div class="person-details">
                <div class="detail-item">
                    <i class="fas fa-graduation-cap"></i>
                    <span>${person.university}, ${person.graduationYear}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${person.location}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-briefcase"></i>
                    <span>${person.industry}</span>
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
        const person = currentPeople.find(p => p.id === personId);
        if (person) {
            openConnectionModal(person);
        }
    };

    window.viewProfile = function(personId) {
        const person = currentPeople.find(p => p.id === personId);
        if (person) {
            openProfileModal(person);
        }
    };

    // Load more functionality
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function() {
            renderPeople();
        });
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
    renderPeople();
});