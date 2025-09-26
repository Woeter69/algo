// Settings Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeSettings();
});

function initializeSettings() {
    // Initialize navigation
    initializeNavigation();
    
    // Initialize user dropdown
    initializeUserDropdown();
    
    // Initialize form handlers
    initializeForms();
    
    // Initialize toggle switches
    initializeToggles();
}

// Navigation between settings sections
function initializeNavigation() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    const sections = document.querySelectorAll('.settings-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetSection = this.getAttribute('data-section');
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Update active section
            sections.forEach(section => section.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
            
            // Update URL hash
            window.location.hash = targetSection;
        });
    });
    
    // Handle initial hash
    const hash = window.location.hash.substring(1);
    if (hash) {
        const targetNav = document.querySelector(`[data-section="${hash}"]`);
        if (targetNav) {
            targetNav.click();
        }
    }
}

// User dropdown functionality
function initializeUserDropdown() {
    const userProfile = document.getElementById('userprofile');
    const dropdown = document.getElementById('userdropdown');
    
    if (userProfile) {
        userProfile.addEventListener('click', function(e) {
            e.stopPropagation();
            this.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function() {
            userProfile.classList.remove('active');
        });
    }
}

// Form handlers
function initializeForms() {
    // Account form
    const accountForm = document.getElementById('accountForm');
    if (accountForm) {
        accountForm.addEventListener('submit', handleAccountSubmit);
    }
    
    // Privacy form
    const privacyForm = document.getElementById('privacyForm');
    if (privacyForm) {
        privacyForm.addEventListener('submit', handlePrivacySubmit);
    }
    
    // Notifications form
    const notificationsForm = document.getElementById('notificationsForm');
    if (notificationsForm) {
        notificationsForm.addEventListener('submit', handleNotificationsSubmit);
    }
    
    // Security form
    const securityForm = document.getElementById('securityForm');
    if (securityForm) {
        securityForm.addEventListener('submit', handleSecuritySubmit);
    }
    
    // Preferences form
    const preferencesForm = document.getElementById('preferencesForm');
    if (preferencesForm) {
        preferencesForm.addEventListener('submit', handlePreferencesSubmit);
    }
}

// Toggle switch functionality
function initializeToggles() {
    const toggles = document.querySelectorAll('.toggle-option input[type="checkbox"]');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            // Add visual feedback or immediate save functionality here
            console.log(`Toggle ${this.name} changed to: ${this.checked}`);
        });
    });
}

// Form submission handlers
async function handleAccountSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        username: formData.get('username'),
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        university: formData.get('university'),
        department: formData.get('department'),
        college: formData.get('college'),
        graduationYear: formData.get('graduationYear'),
        currentCity: formData.get('currentCity')
    };
    
    try {
        showLoading(e.target);
        
        const response = await fetch('/api/update_account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Account updated successfully!', 'success');
        } else {
            showMessage(result.message || 'Failed to update account', 'error');
        }
    } catch (error) {
        console.error('Error updating account:', error);
        showMessage('An error occurred while updating account', 'error');
    } finally {
        hideLoading(e.target);
    }
}

async function handlePrivacySubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Handle checkboxes that might not be in FormData if unchecked
    const checkboxes = e.target.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        data[checkbox.name] = checkbox.checked;
    });
    
    try {
        showLoading(e.target);
        
        const response = await fetch('/api/update_privacy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Privacy settings updated successfully!', 'success');
        } else {
            showMessage(result.message || 'Failed to update privacy settings', 'error');
        }
    } catch (error) {
        console.error('Error updating privacy:', error);
        showMessage('An error occurred while updating privacy settings', 'error');
    } finally {
        hideLoading(e.target);
    }
}

async function handleNotificationsSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Handle checkboxes
    const checkboxes = e.target.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        data[checkbox.name] = checkbox.checked;
    });
    
    try {
        showLoading(e.target);
        
        const response = await fetch('/api/update_notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Notification settings updated successfully!', 'success');
        } else {
            showMessage(result.message || 'Failed to update notification settings', 'error');
        }
    } catch (error) {
        console.error('Error updating notifications:', error);
        showMessage('An error occurred while updating notification settings', 'error');
    } finally {
        hideLoading(e.target);
    }
}

async function handleSecuritySubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Validate passwords
    if (data.newPassword !== data.confirmPassword) {
        showMessage('New passwords do not match', 'error');
        return;
    }
    
    if (data.newPassword.length < 8) {
        showMessage('Password must be at least 8 characters long', 'error');
        return;
    }
    
    try {
        showLoading(e.target);
        
        const response = await fetch('/api/change_password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                currentPassword: data.currentPassword,
                newPassword: data.newPassword
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Password changed successfully!', 'success');
            e.target.reset();
        } else {
            showMessage(result.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Error changing password:', error);
        showMessage('An error occurred while changing password', 'error');
    } finally {
        hideLoading(e.target);
    }
}

async function handlePreferencesSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Handle checkboxes
    const checkboxes = e.target.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        data[checkbox.name] = checkbox.checked;
    });
    
    try {
        showLoading(e.target);
        
        const response = await fetch('/api/update_preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Preferences updated successfully!', 'success');
            
            // Apply theme change immediately if changed
            if (data.theme) {
                applyTheme(data.theme);
            }
        } else {
            showMessage(result.message || 'Failed to update preferences', 'error');
        }
    } catch (error) {
        console.error('Error updating preferences:', error);
        showMessage('An error occurred while updating preferences', 'error');
    } finally {
        hideLoading(e.target);
    }
}

// Utility functions
function showMessage(message, type = 'success') {
    const container = document.getElementById('messageContainer');
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    container.appendChild(messageElement);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageElement.remove();
    }, 5000);
}

function showLoading(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
}

function hideLoading(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = false;
        // Restore original text based on form
        const formId = form.id;
        let originalText = 'Save Changes';
        
        switch (formId) {
            case 'securityForm':
                originalText = 'Change Password';
                break;
            case 'privacyForm':
                originalText = 'Save Privacy Settings';
                break;
            case 'notificationsForm':
                originalText = 'Save Notification Settings';
                break;
            case 'preferencesForm':
                originalText = 'Save Preferences';
                break;
        }
        
        submitButton.innerHTML = originalText;
    }
}

function resetForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        showMessage('Form reset to original values', 'success');
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
}

// Action functions for buttons
async function exportData() {
    try {
        showMessage('Preparing your data export...', 'success');
        
        const response = await fetch('/api/export_data', {
            method: 'POST'
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'algo_data_export.json';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showMessage('Data exported successfully!', 'success');
        } else {
            throw new Error('Export failed');
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        showMessage('Failed to export data', 'error');
    }
}

function deactivateAccount() {
    if (confirm('Are you sure you want to deactivate your account? You can reactivate it anytime by logging in.')) {
        fetch('/api/deactivate_account', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showMessage('Account deactivated successfully', 'success');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                showMessage(result.message || 'Failed to deactivate account', 'error');
            }
        })
        .catch(error => {
            console.error('Error deactivating account:', error);
            showMessage('An error occurred while deactivating account', 'error');
        });
    }
}

function deleteAccount() {
    const confirmation = prompt('This action cannot be undone. Type "DELETE" to confirm account deletion:');
    
    if (confirmation === 'DELETE') {
        fetch('/api/delete_account', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showMessage('Account deleted successfully', 'success');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                showMessage(result.message || 'Failed to delete account', 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting account:', error);
            showMessage('An error occurred while deleting account', 'error');
        });
    } else if (confirmation !== null) {
        showMessage('Account deletion cancelled - confirmation text did not match', 'error');
    }
}

function logoutAllSessions() {
    if (confirm('This will log you out of all devices. Continue?')) {
        fetch('/api/logout_all_sessions', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showMessage('Logged out of all sessions', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                showMessage(result.message || 'Failed to logout all sessions', 'error');
            }
        })
        .catch(error => {
            console.error('Error logging out sessions:', error);
            showMessage('An error occurred while logging out sessions', 'error');
        });
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/logout';
    }
}

// Handle browser back/forward navigation
window.addEventListener('hashchange', function() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const targetNav = document.querySelector(`[data-section="${hash}"]`);
        if (targetNav && !targetNav.classList.contains('active')) {
            targetNav.click();
        }
    }
});
