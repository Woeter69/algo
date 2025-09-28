document.addEventListener('DOMContentLoaded', function () {
    // Get real data from Flask template
    const windowWithData = window;
    const connectData = windowWithData.connectData || {
        people: [],
        universities: [],
        graduationYears: [],
        locations: []
    };
    const allPeople = connectData.people || [];
    // Process people data to match expected format
    const processedPeople = allPeople.map((person) => ({
        id: person.id,
        name: person.name,
        title: person.title,
        company: person.company,
        university: person.university,
        graduationYear: person.graduation_year || person.graduationYear,
        location: person.location,
        role: person.role,
        avatar: person.avatar ? person.avatar : generateDefaultAvatar(person.name),
        skills: person.interests || person.skills || [],
        connectionStatus: person.connection_status || person.connectionStatus || "none",
        connection_id: person.connection_id || null,
        isRecommended: Math.random() > 0.7 // Random recommendation for demo
    }));
    let currentPeople = [...processedPeople];
    let displayedCount = 0;
    const itemsPerLoad = 6;
    let searchTimeout;
    // Generate default avatar function
    function generateDefaultAvatar(name) {
        if (!name)
            return 'https://i.ibb.co/QDy827D/default-avatar.png';
        // Clean the name and get initials
        const cleanName = name.trim();
        const initials = cleanName.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .join('')
            .substring(0, 2);
        // Generate a consistent color based on name
        const colors = [
            '6D28D9', // Purple
            '3B82F6', // Blue  
            '10B981', // Green
            'F59E0B', // Yellow
            'EF4444', // Red
            '8B5CF6', // Violet
            '06B6D4', // Cyan
            'F97316', // Orange
            'EC4899', // Pink
            '84CC16' // Lime
        ];
        // Simple hash function to get consistent color for same name
        let hash = 0;
        for (let i = 0; i < cleanName.length; i++) {
            hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colorIndex = Math.abs(hash) % colors.length;
        const backgroundColor = colors[colorIndex];
        // Return UI Avatars URL with custom styling
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${backgroundColor}&color=fff&size=80&font-size=0.6&bold=true`;
    }
    // Mobile navigation
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            hamburger.classList.toggle('toggle');
            navLinks.classList.toggle('open');
        });
    }
    // Initialize user dropdown
    initializeUserDropdown();
    function initializeUserDropdown() {
        const userProfile = document.getElementById('userprofile');
        const dropdownArrow = document.getElementById('dropdownarrow');
        const userDropdown = document.getElementById('userdropdown');
        const logoutBtn = document.getElementById('logoutBtn');
        if (userProfile && dropdownArrow && userDropdown) {
            // Toggle dropdown on click
            userProfile.addEventListener('click', function (e) {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
                dropdownArrow.classList.toggle('rotated');
            });
            // Close dropdown when clicking outside
            document.addEventListener('click', function (e) {
                if (!userProfile.contains(e.target)) {
                    userDropdown.classList.remove('active');
                    dropdownArrow.classList.remove('rotated');
                }
            });
            // Handle dropdown item clicks
            const dropdownItems = userDropdown.querySelectorAll('.dropdown-item');
            dropdownItems.forEach(item => {
                item.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const text = this.textContent?.trim().toLowerCase();
                    switch (text) {
                        case 'view profile':
                            window.location.href = '/profile';
                            break;
                        case 'edit profile':
                            window.location.href = '/profile/edit';
                            break;
                        case 'settings':
                            window.location.href = '/settings';
                            break;
                        case 'notifications':
                            window.location.href = '/requests';
                            break;
                        case 'logout':
                            handleLogout();
                            break;
                    }
                    // Close dropdown after click
                    userDropdown.classList.remove('active');
                    dropdownArrow.classList.remove('rotated');
                });
            });
        }
        // Handle logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    }
    function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear any local storage
            localStorage.clear();
            sessionStorage.clear();
            // Redirect to logout endpoint
            window.location.href = '/logout';
        }
    }
    // Filter functionality
    const filterBtn = document.getElementById('filterBtn');
    const filtersSection = document.getElementById('filtersSection');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (filterBtn && filtersSection) {
        filterBtn.addEventListener('click', function () {
            filtersSection.classList.toggle('active');
        });
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function () {
            // Reset all filter dropdowns
            document.querySelectorAll('.filters-section select').forEach(select => {
                select.value = '';
            });
            // Reset search input
            if (searchInput)
                searchInput.value = '';
            // Apply filters (which will show all people)
            applyFilters();
        });
    }
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }
    // Enhanced Search functionality with debouncing and real-time search
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    if (searchInput) {
        // Real-time search with debouncing
        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch();
                showSearchResults();
            }, 300); // 300ms debounce
        });
        // Search on Enter key
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                performSearch();
                showSearchResults();
            }
        });
        // Clear search on Escape
        searchInput.addEventListener('keyup', function (e) {
            if (e.key === 'Escape') {
                searchInput.value = '';
                performSearch();
                hideSearchResults();
            }
        });
    }
    function performSearch() {
        const query = searchInput?.value.toLowerCase().trim() || '';
        if (query) {
            currentPeople = processedPeople.filter(person => {
                // Enhanced multi-field search
                const searchableFields = [
                    person.name.toLowerCase(),
                    person.company.toLowerCase(),
                    person.title.toLowerCase(),
                    person.university.toLowerCase(),
                    person.location.toLowerCase(),
                    person.role.toLowerCase(),
                    ...person.skills.map(skill => skill.toLowerCase())
                ];
                // Support for multi-word search
                const searchWords = query.split(' ').filter(word => word.length > 0);
                return searchWords.every(word => searchableFields.some(field => field.includes(word)));
            });
        }
        else {
            currentPeople = [...processedPeople];
        }
        displayedCount = 0;
        renderPeople();
    }
    // Show search results info
    function showSearchResults() {
        const query = searchInput?.value.trim() || '';
        if (!query)
            return;
        let resultsDiv = document.getElementById('searchResults');
        if (!resultsDiv) {
            resultsDiv = document.createElement('div');
            resultsDiv.id = 'searchResults';
            resultsDiv.className = 'search-results-info';
            // Insert directly after the search container
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer && searchContainer.parentNode) {
                searchContainer.parentNode.insertBefore(resultsDiv, searchContainer.nextSibling);
            }
        }
        const count = currentPeople.length;
        resultsDiv.innerHTML = `
            <div class="search-results-content">
                <i class="fas fa-search"></i>
                <span>Found <strong>${count}</strong> result${count !== 1 ? 's' : ''} for "<em>${escapeHtml(query)}</em>"</span>
                <button class="clear-search-btn" onclick="clearSearch()">
                    <i class="fas fa-times"></i> Clear
                </button>
            </div>
        `;
        resultsDiv.style.display = 'block';
        // Auto-scroll to show search results
        setTimeout(() => {
            resultsDiv.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        }, 100);
    }
    // Hide search results info
    function hideSearchResults() {
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    }
    // Global clear search function
    window.clearSearch = function () {
        if (searchInput) {
            searchInput.value = '';
            performSearch();
            hideSearchResults();
        }
    };
    // Utility function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    function applyFilters() {
        const university = document.getElementById('universityFilter')?.value || '';
        const year = document.getElementById('yearFilter')?.value || '';
        const role = document.getElementById('roleFilter')?.value || '';
        const location = document.getElementById('locationFilter')?.value || '';
        const searchQuery = searchInput?.value.toLowerCase().trim() || '';
        currentPeople = processedPeople.filter(person => {
            const matchesUniversity = !university || person.university.toLowerCase().includes(university.toLowerCase());
            const matchesYear = !year || person.graduationYear.toString() === year;
            const matchesRole = !role || person.role.toLowerCase() === role.toLowerCase();
            const matchesLocation = !location || person.location.toLowerCase().includes(location.toLowerCase());
            const matchesSearch = !searchQuery ||
                person.name.toLowerCase().includes(searchQuery) ||
                person.company.toLowerCase().includes(searchQuery) ||
                person.title.toLowerCase().includes(searchQuery) ||
                person.skills.some(skill => skill.toLowerCase().includes(searchQuery));
            return matchesUniversity && matchesYear && matchesRole && matchesLocation && matchesSearch;
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
    if (closeConnectionModal)
        closeConnectionModal.addEventListener('click', closeModal);
    if (closeProfileModal)
        closeProfileModal.addEventListener('click', closeModal);
    if (cancelConnection)
        cancelConnection.addEventListener('click', closeModal);
    if (closePreview)
        closePreview.addEventListener('click', closeModal);
    // Close modal when clicking outside
    [connectionModal, profileModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) {
                    closeModal();
                }
            });
        }
    });
    // Connection form submission
    if (connectionForm) {
        connectionForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (selectedPerson) {
                const message = document.getElementById('connectionMessage')?.value || '';
                try {
                    const response = await fetch('/api/send_connection_request', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            user_id: selectedPerson.id,
                            message: message
                        })
                    });
                    const result = await response.json();
                    if (result.success) {
                        // Update person's connection status
                        selectedPerson.connectionStatus = 'pending';
                        // Show success message
                        showNotification(result.message, 'success');
                        // Re-render people to update button states
                        renderPeople();
                        // Close modal
                        closeModal();
                    }
                    else {
                        showNotification(result.message || 'Failed to send connection request', 'error');
                    }
                }
                catch (error) {
                    console.error('Error sending connection request:', error);
                    showNotification('Network error. Please try again.', 'error');
                }
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
        if (person.connectionStatus === 'accepted' || person.connectionStatus === 'connected') {
            actionButtons = `
                <button class="btn-small btn-connected">Connected</button>
                <button class="btn-small btn-view" onclick="viewProfile(${person.id})">View Profile</button>
            `;
        }
        else if (person.connectionStatus === 'pending') {
            actionButtons = `
                <button class="btn-small btn-pending">Request Sent</button>
                <button class="btn-small btn-view" onclick="viewProfile(${person.id})">View Profile</button>
            `;
        }
        else if (person.connectionStatus === 'received_request') {
            actionButtons = `
                <button class="btn-small btn-accept" onclick="acceptConnection(${person.connection_id || person.id})">Accept</button>
                <button class="btn-small btn-decline" onclick="declineConnection(${person.connection_id || person.id})">Decline</button>
                <button class="btn-small btn-view" onclick="viewProfile(${person.id})">View Profile</button>
            `;
        }
        else {
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
    window.connectWithPerson = function (personId) {
        const person = currentPeople.find(p => p.id === personId);
        if (person) {
            openConnectionModal(person);
        }
    };
    window.viewProfile = function (personId) {
        const person = currentPeople.find(p => p.id === personId);
        if (person) {
            openProfileModal(person);
        }
    };
    window.acceptConnection = async function (personId) {
        try {
            const response = await fetch('/api/respond_connection_request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    connection_id: personId, // This should be connection_id, not user_id
                    action: 'accept'
                })
            });
            const result = await response.json();
            if (result.success) {
                // Update person's connection status
                const person = currentPeople.find(p => p.id === personId);
                if (person) {
                    person.connectionStatus = 'connected';
                }
                showNotification('Connection request accepted!', 'success');
                renderPeople();
            }
            else {
                showNotification(result.message || 'Failed to accept connection', 'error');
            }
        }
        catch (error) {
            console.error('Error accepting connection:', error);
            showNotification('Network error. Please try again.', 'error');
        }
    };
    window.declineConnection = async function (personId) {
        try {
            const response = await fetch('/api/respond_connection_request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    connection_id: personId, // This should be connection_id, not user_id
                    action: 'reject'
                })
            });
            const result = await response.json();
            if (result.success) {
                // Update person's connection status
                const person = currentPeople.find(p => p.id === personId);
                if (person) {
                    person.connectionStatus = 'none';
                }
                showNotification('Connection request declined', 'info');
                renderPeople();
            }
            else {
                showNotification(result.message || 'Failed to decline connection', 'error');
            }
        }
        catch (error) {
            console.error('Error declining connection:', error);
            showNotification('Network error. Please try again.', 'error');
        }
    };
    // Load more functionality
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function () {
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
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#6D28D9',
            warning: '#f59e0b'
        };
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
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
        window.addEventListener('scroll', function () {
            if (window.scrollY > 100) {
                header.classList.add('scrolled');
            }
            else {
                header.classList.remove('scrolled');
            }
        });
    }
    // Navigation links
    const navLinksElements = document.querySelectorAll('.nav-links a[data-section]');
    navLinksElements.forEach(link => {
        link.addEventListener('click', function (e) {
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
