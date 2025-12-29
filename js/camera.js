/**
 * Camera Module
 * Handles photo capture and file selection
 */

const camera = {
    currentPhotos: [],
    currentChecklistPhotos: [],
    currentEditChecklistPhotos: [], // For editing existing checklist

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

        // Photo input for checklist EDIT (new)
        const checklistEditPhotoInput = document.getElementById('checklist-edit-photo-input');
        const btnEditChecklistCamera = document.getElementById('btn-edit-checklist-camera');

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

        // Checklist EDIT photo handlers (new)
        if (btnEditChecklistCamera) {
            btnEditChecklistCamera.addEventListener('click', () => {
                checklistEditPhotoInput.setAttribute('capture', 'environment');
                checklistEditPhotoInput.click();
            });
        }

        if (checklistEditPhotoInput) {
            checklistEditPhotoInput.addEventListener('change', (e) => {
                this.handleFileSelect(e, 'checklist-edit');
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
            <div class="photo-preview-item" draggable="true" data-index="${index}" data-type="${type}">
                <img src="${photo.data}" alt="Foto ${index + 1}" style="cursor: pointer;" data-photo-index="${index}">
                <button class="remove-photo" data-type="${type}" data-id="${photo.id}">×</button>
            </div>
        `).join('');

        // Add click handlers to images for lightbox preview
        container.querySelectorAll('img[data-photo-index]').forEach((img, idx) => {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof app !== 'undefined' && app.openLightbox) {
                    app.openLightbox(photos, idx);
                }
            });
        });

        // Setup drag & drop
        const items = container.querySelectorAll('.photo-preview-item[draggable="true"]');
        items.forEach((item) => {
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', item.innerHTML);
                e.dataTransfer.setData('index', item.dataset.index);
                e.dataTransfer.setData('type', item.dataset.type);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');

                const fromIndex = parseInt(e.dataTransfer.getData('index'));
                const toIndex = parseInt(item.dataset.index);
                const dragType = e.dataTransfer.getData('type');

                if (fromIndex !== toIndex && dragType === type) {
                    this.reorderPhotos(fromIndex, toIndex, type);
                }
            });
        });

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
     * Reorder photos array after drag & drop
     */
    reorderPhotos(fromIndex, toIndex, type) {
        let photos;
        let containerId;

        if (type === 'radar') {
            photos = this.currentPhotos;
            containerId = 'photos-preview';
        } else if (type === 'checklist') {
            photos = this.currentChecklistPhotos;
            containerId = 'checklist-photos-preview';
        } else if (type === 'checklist-edit') {
            photos = this.currentEditChecklistPhotos;
            containerId = 'checklist-details-photos-preview';
        }

        if (!photos) return;

        // Move item in array
        const [movedItem] = photos.splice(fromIndex, 1);
        photos.splice(toIndex, 0, movedItem);

        // Re-render
        this.renderPhotosPreview(containerId, photos, type);
    },

    /**
     * Remove a photo
     */
    removePhoto(photoId, type) {
        if (type === 'radar') {
            this.currentPhotos = this.currentPhotos.filter(p => p.id !== photoId);
            this.renderPhotosPreview('photos-preview', this.currentPhotos, 'radar');
        } else if (type === 'checklist') {
            this.currentChecklistPhotos = this.currentChecklistPhotos.filter(p => p.id !== photoId);
            this.renderPhotosPreview('checklist-photos-preview', this.currentChecklistPhotos, 'checklist');
        } else if (type === 'checklist-edit') {
            this.currentEditChecklistPhotos = this.currentEditChecklistPhotos.filter(p => p.id !== photoId);
            this.renderPhotosPreview('checklist-details-photos-preview', this.currentEditChecklistPhotos, 'checklist-edit');
        }
    },

    /**
     * Get current photos for saving
     */
    getPhotos(type) {
        if (type === 'radar') return [...this.currentPhotos];
        if (type === 'checklist') return [...this.currentChecklistPhotos];
        if (type === 'checklist-edit') return [...this.currentEditChecklistPhotos];
        return [];
    },

    /**
     * Set photos (for editing)
     */
    setPhotos(photos, type) {
        if (type === 'radar') {
            this.currentPhotos = photos || [];
            this.renderPhotosPreview('photos-preview', this.currentPhotos, 'radar');
        } else if (type === 'checklist') {
            this.currentChecklistPhotos = photos || [];
            this.renderPhotosPreview('checklist-photos-preview', this.currentChecklistPhotos, 'checklist');
        } else if (type === 'checklist-edit') {
            this.currentEditChecklistPhotos = photos || [];
            this.renderPhotosPreview('checklist-details-photos-preview', this.currentEditChecklistPhotos, 'checklist-edit');
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
        if (type === 'checklist-edit' || !type) {
            this.currentEditChecklistPhotos = [];
            const container = document.getElementById('checklist-details-photos-preview');
            if (container) container.innerHTML = '';
        }
    }
};

// Export for use in other modules
window.camera = camera;
