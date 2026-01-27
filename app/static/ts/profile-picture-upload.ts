// Profile Picture Upload Functionality
function initProfilePictureUpload() {
    const uploadBtn = document.getElementById('upload-pfp-btn');
    const fileInput = document.getElementById('pfp-file-input');
    const profileImg = document.getElementById('profile-image');
    const uploadStatus = document.getElementById('upload-status');

    // Create file input if it doesn't exist
    if (!fileInput) {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'pfp-file-input';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
    }

    // Handle upload button click
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            document.getElementById('pfp-file-input').click();
        });
    }

    // Handle file selection
    document.getElementById('pfp-file-input').addEventListener('change', function(e) {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            uploadProfilePicture(file);
        }
    });
}

function uploadProfilePicture(file: File) {
    const uploadStatus = document.getElementById('upload-status');
    const profileImg = document.getElementById('profile-image');
    
    // Show loading state
    if (uploadStatus) {
        uploadStatus.innerHTML = '<div class="alert alert-info">Uploading image...</div>';
    }

    // Create FormData
    const formData = new FormData();
    formData.append('profile_picture', file);

    // Upload to server
    fetch('/api/update_profile_picture', {
        method: 'POST',
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update profile image
            if (profileImg && data.pfp_url) {
                (profileImg as HTMLImageElement).src = data.pfp_url;
            }
            
            // Show success message
            if (uploadStatus) {
                uploadStatus.innerHTML = '<div class="alert alert-success">' + data.message + '</div>';
                setTimeout(() => {
                    uploadStatus.innerHTML = '';
                }, 3000);
            }
            
            // Refresh page to update all profile images
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            // Show error message
            if (uploadStatus) {
                uploadStatus.innerHTML = '<div class="alert alert-danger">' + data.message + '</div>';
            }
        }
    })
    .catch(error => {
        console.error('Error uploading profile picture:', error);
        if (uploadStatus) {
            uploadStatus.innerHTML = '<div class="alert alert-danger">Error uploading image. Please try again.</div>';
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initProfilePictureUpload();
});
