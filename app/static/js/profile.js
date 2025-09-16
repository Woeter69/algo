// Profile JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('toggle');
            navLinks.classList.toggle('open');
        });
    }

    // Modal functionality
    const editBtn = document.getElementById('editProfileBtn');
    const modal = document.getElementById('editModal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const profileForm = document.getElementById('profileForm');

    // Open modal
    if (editBtn && modal) {
        editBtn.addEventListener('click', function() {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    // Close modal function
    function closeModal() {
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    // Close modal events
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Profile picture upload
    const profilePictureUpload = document.getElementById('profilePictureUpload');
    const profilePicture = document.getElementById('profilePicture');

    if (profilePictureUpload && profilePicture) {
        profilePictureUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    profilePicture.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Form submission
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(profileForm);
            const data = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                username: formData.get('username'),
                email: formData.get('email'),
                currentCity: formData.get('currentCity'),
                universityName: formData.get('universityName'),
                interests: formData.get('interests')
            };

            // Update display elements
            updateProfileDisplay(data);
            
            // Close modal
            closeModal();
            
            // Show success message (you can customize this)
            showNotification('Profile updated successfully!', 'success');
        });
    }

    // Update profile display function
    function updateProfileDisplay(data) {
        // Update name
        const displayFirstName = document.getElementById('displayFirstName');
        const displayLastName = document.getElementById('displayLastName');
        if (displayFirstName) displayFirstName.textContent = data.firstName;
        if (displayLastName) displayLastName.textContent = data.lastName;

        // Update username
        const displayUsername = document.getElementById('displayUsername');
        const displayUsernameCard = document.getElementById('displayUsernameCard');
        if (displayUsername) displayUsername.textContent = data.username;
        if (displayUsernameCard) displayUsernameCard.textContent = '@' + data.username;

        // Update email
        const displayEmail = document.getElementById('displayEmail');
        if (displayEmail) displayEmail.textContent = data.email;

        // Update current city
        const displayCurrentCity = document.getElementById('displayCurrentCity');
        const displayCurrentCityCard = document.getElementById('displayCurrentCityCard');
        if (displayCurrentCity) displayCurrentCity.textContent = data.currentCity;
        if (displayCurrentCityCard) displayCurrentCityCard.textContent = data.currentCity;

        // Update university
        const displayUniversityName = document.getElementById('displayUniversityName');
        const displayUniversityNameCard = document.getElementById('displayUniversityNameCard');
        if (displayUniversityName) displayUniversityName.textContent = data.universityName;
        if (displayUniversityNameCard) displayUniversityNameCard.textContent = data.universityName;

        // Update interests
        const interestsContainer = document.getElementById('interestsContainer');
        if (interestsContainer && data.interests) {
            const interestsArray = data.interests.split(',').map(interest => interest.trim()).filter(interest => interest);
            interestsContainer.innerHTML = '';
            
            interestsArray.forEach(interest => {
                const tag = document.createElement('span');
                tag.className = 'interest-tag';
                tag.textContent = interest;
                interestsContainer.appendChild(tag);
            });
        }
    }

    // Notification function
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles
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

        // Add to body
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Profile avatar click to open file upload
    const profileAvatar = document.querySelector('.profile-avatar');
    if (profileAvatar && profilePictureUpload) {
        profileAvatar.addEventListener('click', function() {
            profilePictureUpload.click();
        });
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

    // Smooth scrolling for navigation links
    const navLinksElements = document.querySelectorAll('.nav-links a[data-section]');
    navLinksElements.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            
            // You can add navigation logic here
            console.log('Navigate to:', section);
            
            // Close mobile menu if open
            if (navLinks && navLinks.classList.contains('open')) {
                hamburger.classList.remove('toggle');
                navLinks.classList.remove('open');
            }
        });
    });

    // Form validation
    const inputs = document.querySelectorAll('#profileForm input[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });

        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });

    function validateField(field) {
        const value = field.value.trim();
        const fieldName = field.getAttribute('name');
        let isValid = true;
        let errorMessage = '';

        // Remove existing error
        field.classList.remove('error');
        const existingError = field.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // Validation rules
        if (!value) {
            isValid = false;
            errorMessage = 'This field is required';
        } else if (fieldName === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        } else if (fieldName === 'username') {
            const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
            if (!usernameRegex.test(value)) {
                isValid = false;
                errorMessage = 'Username must be 3-20 characters, letters, numbers, and underscores only';
            }
        }

        if (!isValid) {
            field.classList.add('error');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = errorMessage;
            errorDiv.style.cssText = 'color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem;';
            field.parentNode.appendChild(errorDiv);
        }

        return isValid;
    }

    // Add error styles
    const style = document.createElement('style');
    style.textContent = `
        .form-group input.error,
        .form-group textarea.error {
            border-color: #ef4444;
            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
    `;
    document.head.appendChild(style);
});