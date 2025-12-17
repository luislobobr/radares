/**
 * Camera Module
 * Handles photo capture and file selection
 */

const camera = {
    currentPhotos: [],
    currentChecklistPhotos: [],

    /**
     * Initialize camera functionality
     */
    init() {
        // Photo input for radar form
        const photoInput = document.getElementById('photo-input');
        const btnTakePhoto = document.getElementById('btn-take-photo');
        const btnUploadPhoto = document.getElementById('btn-upload-photo');
        const photosPreview = document.getElementById('photos-preview');

        // Photo input for checklist form
        const checklistPhotoInput = document.getElementById('checklist-photo-input');
        const btnChecklistCamera = document.getElementById('btn-checklist-camera');
        const btnChecklistGallery = document.getElementById('btn-checklist-gallery');
        const checklistPhotosPreview = document.getElementById('checklist-photos-preview');

        // Radar form photo handlers
        if (btnTakePhoto) {
            btnTakePhoto.addEventListener('click', () => {
                photoInput.setAttribute('capture', 'environment');
                photoInput.click();
            });
        }

        if (btnUploadPhoto) {
            btnUploadPhoto.addEventListener('click', () => {
                photoInput.removeAttribute('capture');
                photoInput.click();
            });
        }

        if (photoInput) {
            photoInput.addEventListener('change', (e) => {
                this.handleFileSelect(e, 'radar');
            });
        }

        // Checklist form photo handlers - Camera button
        if (btnChecklistCamera) {
            btnChecklistCamera.addEventListener('click', () => {
                checklistPhotoInput.setAttribute('capture', 'environment');
                checklistPhotoInput.click();
            });
        }

        // Checklist form photo handlers - Gallery button
        if (btnChecklistGallery) {
            btnChecklistGallery.addEventListener('click', () => {
                checklistPhotoInput.removeAttribute('capture');
                checklistPhotoInput.click();
            });
        }

        if (checklistPhotoInput) {
            checklistPhotoInput.addEventListener('change', (e) => {
                this.handleFileSelect(e, 'checklist');
            });
        }
    },

    /**
     * Handle file selection
     */
    async handleFileSelect(event, type) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;

            try {
                const base64 = await this.fileToBase64(file);
                const photo = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    data: base64,
                    timestamp: new Date().toISOString()
                };

                if (type === 'radar') {
                    this.currentPhotos.push(photo);
                    this.renderPhotosPreview('photos-preview', this.currentPhotos, 'radar');
                } else {
                    this.currentChecklistPhotos.push(photo);
                    this.renderPhotosPreview('checklist-photos-preview', this.currentChecklistPhotos, 'checklist');
                }
            } catch (error) {
                console.error('Error processing photo:', error);
                app.showToast('Erro ao processar foto', 'error');
            }
        }

        // Clear input to allow selecting the same file again
        event.target.value = '';
    },

    /**
     * Convert file to base64 with heavy compression for Firestore
     * Firestore has a 1MB document limit, so we need small images
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
                // Compress image significantly for Firestore storage
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Reduced max dimensions to allow multiple photos
                    // ~50-80KB per photo allows 10+ photos per document
                    const maxWidth = 800;
                    const maxHeight = 800;

                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width *= ratio;
                        height *= ratio;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Get compressed base64 with lower quality (0.5 instead of 0.7)
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
                    resolve(compressedBase64);
                };
                img.onerror = reject;
                img.src = reader.result;
            };

            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Render photos preview
     */
    renderPhotosPreview(containerId, photos, type) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = photos.map((photo, index) => `
            <div class="photo-preview-item">
                <img src="${photo.data}" alt="Foto ${index + 1}">
                <button class="remove-photo" data-type="${type}" data-id="${photo.id}">×</button>
            </div>
        `).join('');

        // Add remove handlers
        container.querySelectorAll('.remove-photo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const photoId = parseFloat(btn.dataset.id);
                const photoType = btn.dataset.type;
                this.removePhoto(photoId, photoType);
            });
        });
    },

    /**
     * Remove a photo
     */
    removePhoto(photoId, type) {
        if (type === 'radar') {
            this.currentPhotos = this.currentPhotos.filter(p => p.id !== photoId);
            this.renderPhotosPreview('photos-preview', this.currentPhotos, 'radar');
        } else {
            this.currentChecklistPhotos = this.currentChecklistPhotos.filter(p => p.id !== photoId);
            this.renderPhotosPreview('checklist-photos-preview', this.currentChecklistPhotos, 'checklist');
        }
    },

    /**
     * Get current photos for saving
     */
    getPhotos(type) {
        return type === 'radar' ? [...this.currentPhotos] : [...this.currentChecklistPhotos];
    },

    /**
     * Set photos (for editing)
     */
    setPhotos(photos, type) {
        if (type === 'radar') {
            this.currentPhotos = photos || [];
            this.renderPhotosPreview('photos-preview', this.currentPhotos, 'radar');
        } else {
            this.currentChecklistPhotos = photos || [];
            this.renderPhotosPreview('checklist-photos-preview', this.currentChecklistPhotos, 'checklist');
        }
    },

    /**
     * Clear photos
     */
    clearPhotos(type) {
        if (type === 'radar' || !type) {
            this.currentPhotos = [];
            const container = document.getElementById('photos-preview');
            if (container) container.innerHTML = '';
        }
        if (type === 'checklist' || !type) {
            this.currentChecklistPhotos = [];
            const container = document.getElementById('checklist-photos-preview');
            if (container) container.innerHTML = '';
        }
    }
};

// Export for use in other modules
window.camera = camera;
