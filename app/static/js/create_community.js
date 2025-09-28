// Create Community JavaScript - Community Creation Management
// Compiled from TypeScript for the SIH project

// Prevent multiple initializations
if (window.createCommunityInitialized) {
    console.log('Create Community already initialized, skipping...');
} else {
    window.createCommunityInitialized = true;

    document.addEventListener('DOMContentLoaded', function() {
        console.log('🏛️ Create Community JavaScript initializing - DOM ready');

        // Initialize components
        initializeForm();
        initializeValidation();
        initializeMobileNavigation();

        // Form initialization
        function initializeForm() {
            const form = document.getElementById('createCommunityForm');
            const submitBtn = document.getElementById('submitBtn');
            const collegeCodeInput = document.getElementById('college_code');

            if (!form || !submitBtn || !collegeCodeInput) {
                console.error('Required form elements not found');
                return;
            }

            // Auto-uppercase college code
            collegeCodeInput.addEventListener('input', function() {
                this.value = this.value.toUpperCase();
            });

            // Form submission
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                if (!validateForm()) {
                    return;
                }

                await handleFormSubmission();
            });
        }

        // Form validation
        function initializeValidation() {
            const requiredFields = document.querySelectorAll('input[required], textarea[required]');
            
            requiredFields.forEach(field => {
                field.addEventListener('blur', function() {
                    validateField(this);
                });

                field.addEventListener('input', function() {
                    clearFieldError(this);
                });
            });
        }

        // Validate individual field
        function validateField(field) {
            const value = field.value.trim();
            const fieldName = field.getAttribute('name') || '';
            let isValid = true;
            let errorMessage = '';

            // Clear previous errors
            clearFieldError(field);

            // Required field validation
            if (field.hasAttribute('required') && !value) {
                isValid = false;
                errorMessage = 'This field is required';
            }

            // Specific field validations
            switch (fieldName) {
                case 'community_name':
                    if (value && value.length < 3) {
                        isValid = false;
                        errorMessage = 'Institution name must be at least 3 characters long';
                    }
                    break;

                case 'college_code':
                    if (value && !/^[A-Z0-9]{2,20}$/.test(value)) {
                        isValid = false;
                        errorMessage = 'College code must be 2-20 characters, letters and numbers only';
                    }
                    break;

                case 'location':
                    if (value && value.length < 3) {
                        isValid = false;
                        errorMessage = 'Location must be at least 3 characters long';
                    }
                    break;

                case 'description':
                    if (value && value.length > 1000) {
                        isValid = false;
                        errorMessage = 'Description must not exceed 1000 characters';
                    }
                    break;
            }

            if (!isValid) {
                showFieldError(field, errorMessage);
            }

            return isValid;
        }

        // Show field error
        function showFieldError(field, message) {
            const formGroup = field.closest('.form-group');
            if (!formGroup) return;

            // Remove existing error
            const existingError = formGroup.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }

            // Add error class
            field.classList.add('error');

            // Create error element
            const errorElement = document.createElement('div');
            errorElement.className = 'field-error';
            errorElement.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;

            // Insert after the field
            if (field.parentNode) {
                field.parentNode.insertBefore(errorElement, field.nextSibling);
            }
        }

        // Clear field error
        function clearFieldError(field) {
            const formGroup = field.closest('.form-group');
            if (!formGroup) return;

            field.classList.remove('error');
            const errorElement = formGroup.querySelector('.field-error');
            if (errorElement) {
                errorElement.remove();
            }
        }

        // Validate entire form
        function validateForm() {
            const requiredFields = document.querySelectorAll('input[required], textarea[required]');
            let isValid = true;

            requiredFields.forEach(field => {
                if (!validateField(field)) {
                    isValid = false;
                }
            });

            return isValid;
        }

        // Handle form submission
        async function handleFormSubmission() {
            const form = document.getElementById('createCommunityForm');
            const submitBtn = document.getElementById('submitBtn');

            if (!form || !submitBtn) return;

            try {
                showLoading(true);
                submitBtn.disabled = true;

                // Get form data
                const formData = new FormData(form);
                
                // Submit form
                const response = await fetch('/create_community', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    // Check if response is a redirect (successful creation)
                    if (response.redirected || response.url.includes('admin_dashboard')) {
                        showNotification('Community created successfully!', 'success');
                        setTimeout(() => {
                            window.location.href = '/admin_dashboard';
                        }, 1500);
                    } else {
                        // Parse response for any errors
                        const responseText = await response.text();
                        if (responseText.includes('already exists')) {
                            showNotification('A community with this college code already exists.', 'error');
                        } else {
                            showNotification('Community created successfully!', 'success');
                            setTimeout(() => {
                                window.location.href = '/admin_dashboard';
                            }, 1500);
                        }
                    }
                } else {
                    showNotification('Error creating community. Please try again.', 'error');
                }

            } catch (error) {
                console.error('Error submitting form:', error);
                showNotification('Network error. Please check your connection and try again.', 'error');
            } finally {
                showLoading(false);
                submitBtn.disabled = false;
            }
        }

        // Show/hide loading overlay
        function showLoading(show) {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = show ? 'flex' : 'none';
            }
        }

        // Mobile navigation
        function initializeMobileNavigation() {
            const hamburger = document.querySelector('.hamburger');
            const navLinks = document.querySelector('.nav-links');

            if (hamburger && navLinks) {
                hamburger.addEventListener('click', () => {
                    hamburger.classList.toggle('toggle');
                    navLinks.classList.toggle('open');
                });
            }
        }

        // Notification system
        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;

            const icons = {
                success: 'fas fa-check-circle',
                error: 'fas fa-exclamation-circle',
                info: 'fas fa-info-circle',
                warning: 'fas fa-exclamation-triangle'
            };

            const colors = {
                success: '#10b981',
                error: '#ef4444',
                info: '#6D28D9',
                warning: '#f59e0b'
            };

            notification.innerHTML = `
                <i class="${icons[type]}"></i>
                <span>${escapeHtml(message)}</span>
            `;

            notification.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 10000;
                background: ${colors[type]}; color: white; padding: 1rem 1.5rem;
                border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex; align-items: center; gap: 0.5rem;
                font-weight: 500; max-width: 400px;
                transform: translateX(100%); transition: transform 0.3s ease;
            `;

            document.body.appendChild(notification);

            // Animate in
            requestAnimationFrame(() => {
                notification.style.transform = 'translateX(0)';
            });

            // Auto remove
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }, 4000);
        }

        // Utility function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Character counter for description
        const descriptionField = document.getElementById('description');
        if (descriptionField) {
            const maxLength = 1000;
            
            // Create character counter
            const counter = document.createElement('div');
            counter.className = 'character-counter';
            counter.textContent = `0/${maxLength}`;
            
            const formGroup = descriptionField.closest('.form-group');
            if (formGroup) {
                formGroup.appendChild(counter);
            }

            descriptionField.addEventListener('input', function() {
                const currentLength = this.value.length;
                counter.textContent = `${currentLength}/${maxLength}`;
                
                if (currentLength > maxLength * 0.9) {
                    counter.style.color = '#ef4444';
                } else if (currentLength > maxLength * 0.7) {
                    counter.style.color = '#f59e0b';
                } else {
                    counter.style.color = '#6b7280';
                }
            });
        }

        console.log('✅ Create Community JavaScript initialization complete');
    });
}

// Export statement removed for browser compatibility
