/**
 * Firebase Database Module
 * Replaces IndexedDB with Firebase Firestore for cloud sync
 * Includes offline persistence
 */

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBrEfbmlcr_a4H9owwOaKjcrjcKBt0Pboo",
    authDomain: "radar-check-br040.firebaseapp.com",
    projectId: "radar-check-br040",
    storageBucket: "radar-check-br040.firebasestorage.app",
    messagingSenderId: "733218983742",
    appId: "1:733218983742:web:1e02de9b4f07608e0da66f"
};

// Database module
const db = {
    firestore: null,
    isOnline: navigator.onLine,

    /**
     * Initialize Firebase and Firestore
     */
    async init() {
        try {
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            // Get Firestore instance
            this.firestore = firebase.firestore();

            // Enable offline persistence
            try {
                await this.firestore.enablePersistence({ synchronizeTabs: true });
                console.log('Firestore offline persistence enabled');
            } catch (err) {
                if (err.code === 'failed-precondition') {
                    console.warn('Persistence failed: Multiple tabs open');
                } else if (err.code === 'unimplemented') {
                    console.warn('Persistence not available in this browser');
                }
            }

            // Listen to online/offline status
            window.addEventListener('online', () => {
                this.isOnline = true;
                console.log('App is online');
            });
            window.addEventListener('offline', () => {
                this.isOnline = false;
                console.log('App is offline');
            });

            console.log('Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            throw error;
        }
    },

    /**
     * Get all radares
     */
    async getRadares() {
        try {
            const snapshot = await this.firestore.collection('radares').get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting radares:', error);
            return [];
        }
    },

    /**
     * Get a specific radar
     */
    async getRadar(id) {
        try {
            const doc = await this.firestore.collection('radares').doc(id.toString()).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting radar:', error);
            return null;
        }
    },

    /**
     * Save a radar
     */
    async saveRadar(radar) {
        try {
            // Add timestamps
            if (!radar.id) {
                radar.createdAt = new Date().toISOString();
            }
            radar.updatedAt = new Date().toISOString();
            radar.status = radar.status || 'pendente';

            if (radar.id) {
                // Update existing
                await this.firestore.collection('radares').doc(radar.id.toString()).set(radar, { merge: true });
            } else {
                // Create new
                const docRef = await this.firestore.collection('radares').add(radar);
                radar.id = docRef.id;
            }

            return radar;
        } catch (error) {
            console.error('Error saving radar:', error);
            throw error;
        }
    },

    /**
     * Delete a radar
     */
    async deleteRadar(id) {
        try {
            await this.firestore.collection('radares').doc(id.toString()).delete();

            // Also delete related checklists
            const checklists = await this.firestore.collection('checklists')
                .where('radarId', '==', id.toString())
                .get();

            const batch = this.firestore.batch();
            checklists.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            return true;
        } catch (error) {
            console.error('Error deleting radar:', error);
            throw error;
        }
    },

    /**
     * Get all checklists
     */
    async getChecklists() {
        try {
            // Note: Removed orderBy to avoid requiring Firestore index
            // Sorting is done client-side instead
            const snapshot = await this.firestore.collection('checklists').get();
            const checklists = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort by date client-side
            return checklists.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        } catch (error) {
            console.error('Error getting checklists:', error);
            return [];
        }
    },

    /**
     * Get checklists for a specific radar
     */
    async getChecklistsByRadar(radarId) {
        try {
            // Note: Removed orderBy to avoid requiring composite index
            const snapshot = await this.firestore.collection('checklists')
                .where('radarId', '==', radarId.toString())
                .get();
            const checklists = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort by date client-side
            return checklists.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        } catch (error) {
            console.error('Error getting checklists by radar:', error);
            return [];
        }
    },

    /**
     * Get a specific checklist by ID
     */
    async getChecklist(id) {
        try {
            const doc = await this.firestore.collection('checklists').doc(id.toString()).get();
            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting checklist:', error);
            return null;
        }
    },

    /**
     * Delete a checklist
     */
    async deleteChecklist(id) {
        try {
            await this.firestore.collection('checklists').doc(id.toString()).delete();
            return true;
        } catch (error) {
            console.error('Error deleting checklist:', error);
            throw error;
        }
    },

    /**
     * Save a checklist and update radar status
     */
    async saveChecklist(checklist) {
        try {
            // Add timestamps
            if (!checklist.id) {
                checklist.createdAt = new Date().toISOString();
            }
            checklist.updatedAt = new Date().toISOString();
            checklist.date = checklist.date || new Date().toISOString();

            // Ensure radarId is string
            checklist.radarId = checklist.radarId.toString();

            if (checklist.id) {
                await this.firestore.collection('checklists').doc(checklist.id.toString()).set(checklist, { merge: true });
            } else {
                const docRef = await this.firestore.collection('checklists').add(checklist);
                checklist.id = docRef.id;
            }

            // Update radar status
            if (checklist.radarId && checklist.status) {
                await this.firestore.collection('radares').doc(checklist.radarId).update({
                    status: checklist.status,
                    lastChecklistDate: checklist.date,
                    updatedAt: new Date().toISOString()
                });
            }

            return checklist;
        } catch (error) {
            console.error('Error saving checklist:', error);
            throw error;
        }
    },

    /**
     * Get statistics
     */
    async getStats() {
        try {
            const radares = await this.getRadares();
            const recentChecklists = await this.getRecentActivity(5);

            return {
                total: radares.length,
                conformes: radares.filter(r => r.status === 'conforme').length,
                naoConformes: radares.filter(r => r.status === 'nao-conforme').length,
                pendentes: radares.filter(r => r.status === 'pendente' || !r.status).length,
                recentChecklists: recentChecklists
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            return { total: 0, conformes: 0, naoConformes: 0, pendentes: 0, recentChecklists: [] };
        }
    },

    /**
     * Get recent activity
     */
    async getRecentActivity(limit = 5) {
        try {
            // Note: Get all checklists and sort/limit client-side to avoid index requirement
            const snapshot = await this.firestore.collection('checklists').get();

            let checklists = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort by date and limit client-side
            checklists = checklists
                .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                .slice(0, limit);

            const radares = await this.getRadares();

            return checklists.map(c => {
                const radar = radares.find(r => r.id === c.radarId);
                return {
                    ...c,
                    radarKm: radar?.km || 'N/A'
                };
            });
        } catch (error) {
            console.error('Error getting recent activity:', error);
            return [];
        }
    },

    /**
     * Import radares from array (bulk insert)
     */
    async importRadares(radaresArray) {
        try {
            const batch = this.firestore.batch();
            let count = 0;

            for (const radar of radaresArray) {
                radar.createdAt = new Date().toISOString();
                radar.updatedAt = new Date().toISOString();
                radar.status = radar.status || 'pendente';

                const docRef = this.firestore.collection('radares').doc();
                batch.set(docRef, radar);
                count++;

                // Firestore batch limit is 500
                if (count >= 450) {
                    await batch.commit();
                    count = 0;
                }
            }

            if (count > 0) {
                await batch.commit();
            }

            return radaresArray.length;
        } catch (error) {
            console.error('Error importing radares:', error);
            throw error;
        }
    },

    /**
     * Clear all data (for testing)
     */
    async clearAll() {
        try {
            // Delete all radares
            const radares = await this.firestore.collection('radares').get();
            const batch1 = this.firestore.batch();
            radares.forEach(doc => batch1.delete(doc.ref));
            await batch1.commit();

            // Delete all checklists
            const checklists = await this.firestore.collection('checklists').get();
            const batch2 = this.firestore.batch();
            checklists.forEach(doc => batch2.delete(doc.ref));
            await batch2.commit();

            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            throw error;
        }
    }
};

// Export for use
window.db = db;
