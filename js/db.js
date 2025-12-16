/**
 * IndexedDB Database Manager
 * Handles offline storage for radars and checklists
 */

const DB_NAME = 'RadarCheckDB';
const DB_VERSION = 1;

const db = {
    instance: null,

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.instance = request.result;
                console.log('Database initialized successfully');
                resolve(this.instance);
            };

            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                // Create radares store
                if (!database.objectStoreNames.contains('radares')) {
                    const radaresStore = database.createObjectStore('radares', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    radaresStore.createIndex('km', 'km', { unique: false });
                    radaresStore.createIndex('status', 'status', { unique: false });
                    radaresStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Create checklists store
                if (!database.objectStoreNames.contains('checklists')) {
                    const checklistsStore = database.createObjectStore('checklists', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    checklistsStore.createIndex('radarId', 'radarId', { unique: false });
                    checklistsStore.createIndex('date', 'date', { unique: false });
                    checklistsStore.createIndex('status', 'status', { unique: false });
                }

                console.log('Database schema created');
            };
        });
    },

    /**
     * Get all radars
     */
    async getRadares() {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction(['radares'], 'readonly');
            const store = transaction.objectStore('radares');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get a single radar by ID
     */
    async getRadar(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction(['radares'], 'readonly');
            const store = transaction.objectStore('radares');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Add or update a radar
     */
    async saveRadar(radar) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction(['radares'], 'readwrite');
            const store = transaction.objectStore('radares');

            // Add timestamps
            if (!radar.id) {
                radar.createdAt = new Date().toISOString();
            }
            radar.updatedAt = new Date().toISOString();

            // If no status, set as pending
            if (!radar.status) {
                radar.status = 'pendente';
            }

            const request = radar.id ? store.put(radar) : store.add(radar);

            request.onsuccess = () => {
                radar.id = request.result;
                resolve(radar);
            };
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Delete a radar
     */
    async deleteRadar(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction(['radares'], 'readwrite');
            const store = transaction.objectStore('radares');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all checklists
     */
    async getChecklists() {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction(['checklists'], 'readonly');
            const store = transaction.objectStore('checklists');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get checklists for a specific radar
     */
    async getChecklistsByRadar(radarId) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction(['checklists'], 'readonly');
            const store = transaction.objectStore('checklists');
            const index = store.index('radarId');
            const request = index.getAll(radarId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get a single checklist by ID
     */
    async getChecklist(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction(['checklists'], 'readonly');
            const store = transaction.objectStore('checklists');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Save a checklist and update radar status
     */
    async saveChecklist(checklist) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.instance.transaction(['checklists', 'radares'], 'readwrite');
                const checklistStore = transaction.objectStore('checklists');
                const radaresStore = transaction.objectStore('radares');

                // Add timestamps
                if (!checklist.id) {
                    checklist.createdAt = new Date().toISOString();
                }
                checklist.updatedAt = new Date().toISOString();
                checklist.date = checklist.date || new Date().toISOString();

                // Save checklist
                const request = checklist.id ? checklistStore.put(checklist) : checklistStore.add(checklist);

                request.onsuccess = async () => {
                    checklist.id = request.result;

                    // Update radar status
                    if (checklist.radarId && checklist.status) {
                        const radarRequest = radaresStore.get(checklist.radarId);
                        radarRequest.onsuccess = () => {
                            const radar = radarRequest.result;
                            if (radar) {
                                radar.status = checklist.status;
                                radar.lastChecklistDate = checklist.date;
                                radar.updatedAt = new Date().toISOString();
                                radaresStore.put(radar);
                            }
                        };
                    }

                    resolve(checklist);
                };

                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Delete a checklist
     */
    async deleteChecklist(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction(['checklists'], 'readwrite');
            const store = transaction.objectStore('checklists');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Import radars from Excel data
     */
    async importRadares(radares) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = this.instance.transaction(['radares'], 'readwrite');
                const store = transaction.objectStore('radares');
                let importedCount = 0;

                for (const radar of radares) {
                    radar.createdAt = new Date().toISOString();
                    radar.updatedAt = new Date().toISOString();
                    radar.status = radar.status || 'pendente';
                    radar.rodovia = radar.rodovia || 'BR-040';

                    await new Promise((res, rej) => {
                        const request = store.add(radar);
                        request.onsuccess = () => {
                            importedCount++;
                            res();
                        };
                        request.onerror = () => rej(request.error);
                    });
                }

                resolve(importedCount);
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Clear all radares
     */
    async clearRadares() {
        return new Promise((resolve, reject) => {
            const transaction = this.instance.transaction(['radares'], 'readwrite');
            const store = transaction.objectStore('radares');
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get statistics
     */
    async getStats() {
        const radares = await this.getRadares();
        const checklists = await this.getChecklists();

        return {
            total: radares.length,
            conformes: radares.filter(r => r.status === 'conforme').length,
            naoConformes: radares.filter(r => r.status === 'nao-conforme').length,
            pendentes: radares.filter(r => r.status === 'pendente').length,
            totalChecklists: checklists.length,
            recentChecklists: checklists
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5)
        };
    },

    /**
     * Export all data for backup/export
     */
    async exportAllData() {
        const radares = await this.getRadares();
        const checklists = await this.getChecklists();

        return {
            exportDate: new Date().toISOString(),
            radares,
            checklists
        };
    }
};

// Export for use in other modules
window.db = db;
