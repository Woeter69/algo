// Admin Dashboard TypeScript
document.addEventListener('DOMContentLoaded', function () {
    initializeAdminDashboard();
});
function initializeAdminDashboard() {
    // Initialize filter buttons
    initializeFilters();
    // Initialize modal functionality
    initializeModal();
    // Initialize responsive navigation
    initializeNavigation();
}
// Filter functionality
function initializeFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const requestCards = document.querySelectorAll('.request-card');
    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Get filter value
            const filter = this.getAttribute('data-filter');
            // Show/hide cards based on filter
            requestCards.forEach(card => {
                if (filter === 'all') {
                    card.style.display = 'block';
                }
                else {
                    const cardRole = card.dataset.role;
                    if (cardRole === filter) {
                        card.style.display = 'block';
                    }
                    else {
                        card.style.display = 'none';
                    }
                }
            });
        });
    });
}
// Modal functionality
function initializeModal() {
    const modal = document.getElementById('reviewModal');
    const modalOverlay = modal;
    const closeBtn = document.querySelector('.modal-close');
    const cancelBtn = document.querySelector('.btn-secondary');
    if (!modal) {
        console.error('Review modal not found');
        return;
    }
    // Close modal when clicking close button or cancel
    if (closeBtn) {
        closeBtn.addEventListener('click', closeReviewModal);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeReviewModal);
    }
    // Close modal when clicking overlay
    modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) {
            closeReviewModal();
        }
    });
    // Close modal with Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeReviewModal();
        }
    });
}
// Show review modal
function showReviewModal(requestId, action, userName) {
    const modal = document.getElementById('reviewModal');
    const modalTitle = document.getElementById('modalTitle');
    const requestIdInput = document.getElementById('requestId');
    const actionInput = document.getElementById('action');
    const submitBtn = document.getElementById('submitBtn');
    const reviewForm = document.getElementById('reviewForm');
    if (!modal || !modalTitle || !requestIdInput || !actionInput || !submitBtn || !reviewForm) {
        console.error('Required modal elements not found');
        return;
    }
    // Set form action to current page
    reviewForm.action = window.location.pathname;
    // Set form values
    requestIdInput.value = requestId.toString();
    actionInput.value = action;
    // Update modal title and button
    if (action === 'approve') {
        modalTitle.textContent = `Approve ${userName}`;
        submitBtn.textContent = 'Approve';
        submitBtn.className = 'btn approve-btn';
        submitBtn.style.background = '#4caf50';
    }
    else {
        modalTitle.textContent = `Reject ${userName}`;
        submitBtn.textContent = 'Reject';
        submitBtn.className = 'btn reject-btn';
        submitBtn.style.background = '#f44336';
    }
    // Show modal
    modal.classList.add('active');
    // Focus on textarea
    const textarea = document.getElementById('reviewNotes');
    if (textarea) {
        setTimeout(() => textarea.focus(), 100);
    }
}
// Close review modal
function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    const form = document.getElementById('reviewForm');
    if (modal) {
        modal.classList.remove('active');
    }
    // Reset form
    if (form) {
        form.reset();
    }
}
// Navigation functionality
function initializeNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function () {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }
}
// Handle request approval/rejection
function handleRequest(requestId, action) {
    const requestCard = document.querySelector(`[onclick*="'${requestId}'"]`).closest('.request-card');
    const userName = requestCard.querySelector('h3').textContent;
    
    // Show modal for confirmation
    showReviewModal(requestId, action, userName);
}

// Handle form submission for verification requests
function handleVerificationSubmission() {
    const form = document.getElementById('reviewForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const requestId = formData.get('request_id');
        const action = formData.get('action');
        const reviewNotes = formData.get('review_notes');
        
        // Show loading state
        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;
        
        // Submit to backend
        fetch(window.location.pathname, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (response.ok) {
                return response.text();
            }
            throw new Error('Network response was not ok');
        })
        .then(() => {
            // Success - reload page to show updated data
            const message = action === 'approve' ? 
                `${userName} has been approved successfully!` : 
                `${userName}'s request has been rejected.`;
            showNotification(message, action === 'approve' ? 'success' : 'error');
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('An error occurred. Please try again.', 'error');
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    });
}

// Initialize form submission handler
document.addEventListener('DOMContentLoaded', function() {
    handleVerificationSubmission();
});

// Update filter button counts
function updateFilterCounts() {
    const allCards = document.querySelectorAll('.request-card');
    const studentCards = document.querySelectorAll('.request-card[data-role="student"]');
    const alumniCards = document.querySelectorAll('.request-card[data-role="alumni"]');
    const staffCards = document.querySelectorAll('.request-card[data-role="staff"]');
    
    // You could update button text to show counts if desired
    // Example: "Students (3)", "Alumni (2)", "Staff (1)", etc.
}

// Show coming soon alert
function showComingSoon() {
    alert('This feature is coming soon!');
}
// Auto-refresh functionality (optional)
function enableAutoRefresh(intervalMinutes = 5) {
    setInterval(function () {
        // Only refresh if there are no open modals
        const modal = document.getElementById('reviewModal');
        if (modal && !modal.classList.contains('active')) {
            window.location.reload();
        }
    }, intervalMinutes * 60 * 1000);
}
// Initialize auto-refresh (uncomment if needed)
// enableAutoRefresh(5); // Refresh every 5 minutes
// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    // Add to page
    document.body.appendChild(notification);
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}
// Add CSS animations
const adminStyle = document.createElement('style');
adminStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .nav-links.active {
        display: flex !important;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(0,0,0,0.9);
        flex-direction: column;
        padding: 1rem;
        border-radius: 0 0 10px 10px;
    }
    
    .hamburger.active .line1 {
        transform: rotate(-45deg) translate(-5px, 6px);
    }
    
    .hamburger.active .line2 {
        opacity: 0;
    }
    
    .hamburger.active .line3 {
        transform: rotate(45deg) translate(-5px, -6px);
    }
`;
document.head.appendChild(adminStyle);
