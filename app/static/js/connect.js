var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
document.addEventListener('DOMContentLoaded', function () {
    // Get real data from Flask template
    var windowWithData = window;
    var connectData = windowWithData.connectData || {
        people: [],
        universities: [],
        graduationYears: [],
        locations: []
    };
    var allPeople = connectData.people || [];
    // Process people data to match expected format
    var processedPeople = allPeople.map(function (person) { return ({
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
    }); });
    var currentPeople = __spreadArray([], processedPeople, true);
    var displayedCount = 0;
    var itemsPerLoad = 6;
    var searchTimeout;
    // Generate default avatar function
    function generateDefaultAvatar(name) {
        if (!name)
            return 'https://i.ibb.co/QDy827D/default-avatar.png';
        // Clean the name and get initials
        var cleanName = name.trim();
        var initials = cleanName.split(' ')
            .map(function (word) { return word.charAt(0).toUpperCase(); })
            .join('')
            .substring(0, 2);
        // Generate a consistent color based on name
        var colors = [
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
        var hash = 0;
        for (var i = 0; i < cleanName.length; i++) {
            hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
        }
        var colorIndex = Math.abs(hash) % colors.length;
        var backgroundColor = colors[colorIndex];
        // Return UI Avatars URL with custom styling
        return "https://ui-avatars.com/api/?name=".concat(encodeURIComponent(initials), "&background=").concat(backgroundColor, "&color=fff&size=80&font-size=0.6&bold=true");
    }
    // Mobile navigation
    var hamburger = document.querySelector('.hamburger');
    var navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            hamburger.classList.toggle('toggle');
            navLinks.classList.toggle('open');
        });
    }
    // Initialize user dropdown
    initializeUserDropdown();
    function initializeUserDropdown() {
        var userProfile = document.getElementById('userprofile');
        var dropdownArrow = document.getElementById('dropdownarrow');
        var userDropdown = document.getElementById('userdropdown');
        var logoutBtn = document.getElementById('logoutBtn');
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
            var dropdownItems = userDropdown.querySelectorAll('.dropdown-item');
            dropdownItems.forEach(function (item) {
                item.addEventListener('click', function (e) {
                    var _a;
                    e.stopPropagation();
                    var text = (_a = this.textContent) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
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
    var filterBtn = document.getElementById('filterBtn');
    var filtersSection = document.getElementById('filtersSection');
    var clearFiltersBtn = document.getElementById('clearFilters');
    var applyFiltersBtn = document.getElementById('applyFilters');
    if (filterBtn && filtersSection) {
        filterBtn.addEventListener('click', function () {
            filtersSection.classList.toggle('active');
        });
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', function () {
            // Reset all filter dropdowns
            document.querySelectorAll('.filters-section select').forEach(function (select) {
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
    var searchInput = document.getElementById('searchInput');
    var searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }
    if (searchInput) {
        // Real-time search with debouncing
        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function () {
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
        var query = (searchInput === null || searchInput === void 0 ? void 0 : searchInput.value.toLowerCase().trim()) || '';
        if (query) {
            currentPeople = processedPeople.filter(function (person) {
                // Enhanced multi-field search
                var searchableFields = __spreadArray([
                    person.name.toLowerCase(),
                    person.company.toLowerCase(),
                    person.title.toLowerCase(),
                    person.university.toLowerCase(),
                    person.location.toLowerCase(),
                    person.role.toLowerCase()
                ], person.skills.map(function (skill) { return skill.toLowerCase(); }), true);
                // Support for multi-word search
                var searchWords = query.split(' ').filter(function (word) { return word.length > 0; });
                return searchWords.every(function (word) {
                    return searchableFields.some(function (field) { return field.includes(word); });
                });
            });
        }
        else {
            currentPeople = __spreadArray([], processedPeople, true);
        }
        displayedCount = 0;
        renderPeople();
    }
    // Show search results info
    function showSearchResults() {
        var query = (searchInput === null || searchInput === void 0 ? void 0 : searchInput.value.trim()) || '';
        if (!query)
            return;
        var resultsDiv = document.getElementById('searchResults');
        if (!resultsDiv) {
            resultsDiv = document.createElement('div');
            resultsDiv.id = 'searchResults';
            resultsDiv.className = 'search-results-info';
            // Insert directly after the search container
            var searchContainer = document.querySelector('.search-container');
            if (searchContainer && searchContainer.parentNode) {
                searchContainer.parentNode.insertBefore(resultsDiv, searchContainer.nextSibling);
            }
        }
        var count = currentPeople.length;
        resultsDiv.innerHTML = "\n            <div class=\"search-results-content\">\n                <i class=\"fas fa-search\"></i>\n                <span>Found <strong>".concat(count, "</strong> result").concat(count !== 1 ? 's' : '', " for \"<em>").concat(escapeHtml(query), "</em>\"</span>\n                <button class=\"clear-search-btn\" onclick=\"clearSearch()\">\n                    <i class=\"fas fa-times\"></i> Clear\n                </button>\n            </div>\n        ");
        resultsDiv.style.display = 'block';
        // Auto-scroll to show search results
        setTimeout(function () {
            resultsDiv.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        }, 100);
    }
    // Hide search results info
    function hideSearchResults() {
        var resultsDiv = document.getElementById('searchResults');
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
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    function applyFilters() {
        var _a, _b, _c, _d;
        var university = ((_a = document.getElementById('universityFilter')) === null || _a === void 0 ? void 0 : _a.value) || '';
        var year = ((_b = document.getElementById('yearFilter')) === null || _b === void 0 ? void 0 : _b.value) || '';
        var role = ((_c = document.getElementById('roleFilter')) === null || _c === void 0 ? void 0 : _c.value) || '';
        var location = ((_d = document.getElementById('locationFilter')) === null || _d === void 0 ? void 0 : _d.value) || '';
        var searchQuery = (searchInput === null || searchInput === void 0 ? void 0 : searchInput.value.toLowerCase().trim()) || '';
        currentPeople = processedPeople.filter(function (person) {
            var matchesUniversity = !university || person.university.toLowerCase().includes(university.toLowerCase());
            var matchesYear = !year || person.graduationYear.toString() === year;
            var matchesRole = !role || person.role.toLowerCase() === role.toLowerCase();
            var matchesLocation = !location || person.location.toLowerCase().includes(location.toLowerCase());
            var matchesSearch = !searchQuery ||
                person.name.toLowerCase().includes(searchQuery) ||
                person.company.toLowerCase().includes(searchQuery) ||
                person.title.toLowerCase().includes(searchQuery) ||
                person.skills.some(function (skill) { return skill.toLowerCase().includes(searchQuery); });
            return matchesUniversity && matchesYear && matchesRole && matchesLocation && matchesSearch;
        });
        displayedCount = 0;
        renderPeople();
        filtersSection.classList.remove('active');
    }
    // Modal functionality
    var connectionModal = document.getElementById('connectionModal');
    var profileModal = document.getElementById('profileModal');
    var closeConnectionModal = document.getElementById('closeConnectionModal');
    var closeProfileModal = document.getElementById('closeProfileModal');
    var cancelConnection = document.getElementById('cancelConnection');
    var closePreview = document.getElementById('closePreview');
    var connectionForm = document.getElementById('connectionForm');
    var selectedPerson = null;
    function openConnectionModal(person) {
        selectedPerson = person;
        var personPreview = document.getElementById('personPreview');
        personPreview.innerHTML = "\n            <div class=\"person-avatar\">\n                <img src=\"".concat(person.avatar, "\" alt=\"").concat(person.name, "\">\n            </div>\n            <div class=\"person-info\">\n                <h3>").concat(person.name, "</h3>\n                <div class=\"title\">").concat(person.title, "</div>\n                <div class=\"company\">").concat(person.company, "</div>\n            </div>\n        ");
        connectionModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function openProfileModal(person) {
        selectedPerson = person;
        var profilePreview = document.getElementById('profilePreview');
        profilePreview.innerHTML = "\n            <div class=\"person-avatar\">\n                <img src=\"".concat(person.avatar, "\" alt=\"").concat(person.name, "\">\n            </div>\n            <h3>").concat(person.name, "</h3>\n            <div class=\"title\">").concat(person.title, " at ").concat(person.company, "</div>\n            <div class=\"detail-item\">\n                <i class=\"fas fa-graduation-cap\"></i>\n                <span>").concat(person.university, ", Class of ").concat(person.graduationYear, "</span>\n            </div>\n            <div class=\"detail-item\">\n                <i class=\"fas fa-map-marker-alt\"></i>\n                <span>").concat(person.location, "</span>\n            </div>\n            <div class=\"detail-item\">\n                <i class=\"fas fa-briefcase\"></i>\n                <span>").concat(person.industry, "</span>\n            </div>\n            <div class=\"person-skills\">\n                <h4>Skills</h4>\n                <div class=\"skills-container\">\n                    ").concat(person.skills.map(function (skill) { return "<span class=\"skill-tag\">".concat(skill, "</span>"); }).join(''), "\n                </div>\n            </div>\n        ");
        var connectBtn = document.getElementById('connectFromPreview');
        connectBtn.onclick = function () {
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
    [connectionModal, profileModal].forEach(function (modal) {
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
        connectionForm.addEventListener('submit', function (e) {
            return __awaiter(this, void 0, void 0, function () {
                var message, response, result, error_1;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            e.preventDefault();
                            if (!selectedPerson) return [3 /*break*/, 5];
                            message = ((_a = document.getElementById('connectionMessage')) === null || _a === void 0 ? void 0 : _a.value) || '';
                            _b.label = 1;
                        case 1:
                            _b.trys.push([1, 4, , 5]);
                            return [4 /*yield*/, fetch('/api/send_connection_request', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        user_id: selectedPerson.id,
                                        message: message
                                    })
                                })];
                        case 2:
                            response = _b.sent();
                            return [4 /*yield*/, response.json()];
                        case 3:
                            result = _b.sent();
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
                            return [3 /*break*/, 5];
                        case 4:
                            error_1 = _b.sent();
                            console.error('Error sending connection request:', error_1);
                            showNotification('Network error. Please try again.', 'error');
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        });
    }
    // Render people function
    function renderPeople() {
        var recommendedContainer = document.getElementById('recommendedPeople');
        var allPeopleContainer = document.getElementById('allPeople');
        // Clear containers
        recommendedContainer.innerHTML = '';
        allPeopleContainer.innerHTML = '';
        // Separate recommended and all people
        var recommendedPeople = currentPeople.filter(function (person) { return person.isRecommended; });
        var allPeople = currentPeople.filter(function (person) { return !person.isRecommended; });
        // Render recommended people
        recommendedPeople.forEach(function (person) {
            recommendedContainer.appendChild(createPersonCard(person));
        });
        // Render all people (with pagination)
        var peopleToShow = allPeople.slice(0, displayedCount + itemsPerLoad);
        peopleToShow.forEach(function (person) {
            allPeopleContainer.appendChild(createPersonCard(person));
        });
        displayedCount = peopleToShow.length;
        // Show/hide load more button
        var loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = displayedCount < allPeople.length ? 'inline-block' : 'none';
        }
    }
    function createPersonCard(person) {
        var card = document.createElement('div');
        card.className = 'person-card';
        var actionButtons = '';
        if (person.connectionStatus === 'accepted' || person.connectionStatus === 'connected') {
            actionButtons = "\n                <button class=\"btn-small btn-connected\">Connected</button>\n                <button class=\"btn-small btn-view\" onclick=\"viewProfile(".concat(person.id, ")\">View Profile</button>\n            ");
        }
        else if (person.connectionStatus === 'pending') {
            actionButtons = "\n                <button class=\"btn-small btn-pending\">Request Sent</button>\n                <button class=\"btn-small btn-view\" onclick=\"viewProfile(".concat(person.id, ")\">View Profile</button>\n            ");
        }
        else if (person.connectionStatus === 'received_request') {
            actionButtons = "\n                <button class=\"btn-small btn-accept\" onclick=\"acceptConnection(".concat(person.connection_id || person.id, ")\">Accept</button>\n                <button class=\"btn-small btn-decline\" onclick=\"declineConnection(").concat(person.connection_id || person.id, ")\">Decline</button>\n                <button class=\"btn-small btn-view\" onclick=\"viewProfile(").concat(person.id, ")\">View Profile</button>\n            ");
        }
        else {
            actionButtons = "\n                <button class=\"btn-small btn-connect\" onclick=\"connectWithPerson(".concat(person.id, ")\">Connect</button>\n                <button class=\"btn-small btn-view\" onclick=\"viewProfile(").concat(person.id, ")\">View Profile</button>\n            ");
        }
        card.innerHTML = "\n            <div class=\"person-header\">\n                <div class=\"person-avatar\">\n                    <img src=\"".concat(person.avatar, "\" alt=\"").concat(person.name, "\">\n                </div>\n                <div class=\"person-info\">\n                    <h3>").concat(person.name, "</h3>\n                    <div class=\"title\">").concat(person.title, "</div>\n                    <div class=\"company\">").concat(person.company, "</div>\n                </div>\n            </div>\n            <div class=\"person-details\">\n                <div class=\"detail-item\">\n                    <i class=\"fas fa-graduation-cap\"></i>\n                    <span>").concat(person.university, ", ").concat(person.graduationYear, "</span>\n                </div>\n                <div class=\"detail-item\">\n                    <i class=\"fas fa-map-marker-alt\"></i>\n                    <span>").concat(person.location, "</span>\n                </div>\n                <div class=\"detail-item\">\n                    <i class=\"fas fa-briefcase\"></i>\n                    <span>").concat(person.industry, "</span>\n                </div>\n            </div>\n            <div class=\"person-skills\">\n                <div class=\"skills-container\">\n                    ").concat(person.skills.map(function (skill) { return "<span class=\"skill-tag\">".concat(skill, "</span>"); }).join(''), "\n                </div>\n            </div>\n            <div class=\"person-actions\">\n                ").concat(actionButtons, "\n            </div>\n        ");
        return card;
    }
    // Global functions for button clicks
    window.connectWithPerson = function (personId) {
        var person = currentPeople.find(function (p) { return p.id === personId; });
        if (person) {
            openConnectionModal(person);
        }
    };
    window.viewProfile = function (personId) {
        var person = currentPeople.find(function (p) { return p.id === personId; });
        if (person) {
            openProfileModal(person);
        }
    };
    window.acceptConnection = function (personId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, result, person, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch('/api/respond_connection_request', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    connection_id: personId, // This should be connection_id, not user_id
                                    action: 'accept'
                                })
                            })];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        result = _a.sent();
                        if (result.success) {
                            person = currentPeople.find(function (p) { return p.id === personId; });
                            if (person) {
                                person.connectionStatus = 'connected';
                            }
                            showNotification('Connection request accepted!', 'success');
                            renderPeople();
                        }
                        else {
                            showNotification(result.message || 'Failed to accept connection', 'error');
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        console.error('Error accepting connection:', error_2);
                        showNotification('Network error. Please try again.', 'error');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    window.declineConnection = function (personId) {
        return __awaiter(this, void 0, void 0, function () {
            var response, result, person, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch('/api/respond_connection_request', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    connection_id: personId, // This should be connection_id, not user_id
                                    action: 'reject'
                                })
                            })];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        result = _a.sent();
                        if (result.success) {
                            person = currentPeople.find(function (p) { return p.id === personId; });
                            if (person) {
                                person.connectionStatus = 'none';
                            }
                            showNotification('Connection request declined', 'info');
                            renderPeople();
                        }
                        else {
                            showNotification(result.message || 'Failed to decline connection', 'error');
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _a.sent();
                        console.error('Error declining connection:', error_3);
                        showNotification('Network error. Please try again.', 'error');
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Load more functionality
    var loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', function () {
            renderPeople();
        });
    }
    // Notification function
    function showNotification(message, type) {
        if (type === void 0) { type = 'info'; }
        var notification = document.createElement('div');
        notification.className = "notification notification-".concat(type);
        notification.innerHTML = "\n            <div class=\"notification-content\">\n                <i class=\"fas fa-check-circle\"></i>\n                <span>".concat(message, "</span>\n            </div>\n        ");
        var colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#6D28D9',
            warning: '#f59e0b'
        };
        notification.style.cssText = "\n            position: fixed;\n            top: 20px;\n            right: 20px;\n            background: ".concat(colors[type] || colors.info, ";\n            color: white;\n            padding: 1rem 1.5rem;\n            border-radius: 8px;\n            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);\n            z-index: 3000;\n            transform: translateX(100%);\n            transition: all 0.3s ease;\n        ");
        document.body.appendChild(notification);
        setTimeout(function () {
            notification.style.transform = 'translateX(0)';
        }, 100);
        setTimeout(function () {
            notification.style.transform = 'translateX(100%)';
            setTimeout(function () {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    // Header scroll effect
    var header = document.querySelector('header');
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
    var navLinksElements = document.querySelectorAll('.nav-links a[data-section]');
    navLinksElements.forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            var section = this.getAttribute('data-section');
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
