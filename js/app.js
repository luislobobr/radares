/**
 * Radar Check App - Main Application
 * BR-040 Radar Signage Inspection System
 */

const app = {
    currentView: 'dashboard',
    editingRadarId: null,
    editingChecklistId: null,
    currentChecklistRadarId: null,

    // Distance intervals based on velocity and road type
    // Source: CONTRAN Resolution
    distanceIntervals: {
        'urbana': {
            high: { min: 400, max: 500 },     // V >= 80 km/h
            low: { min: 100, max: 300 }        // V < 80 km/h
        },
        'rural-urbana': {
            high: { min: 400, max: 500 },     // V >= 80 km/h
            low: { min: 100, max: 300 }        // V < 80 km/h
        },
        'rural': {
            high: { min: 1000, max: 2000 },   // V >= 80 km/h
            low: { min: 300, max: 1000 }       // V < 80 km/h
        }
    },

    /**
     * Initialize the application
     */
    async init() {
        // Always hide splash screen after timeout, even if there's an error
        const hideSplash = () => {
            const splash = document.getElementById('splash-screen');
            const appContainer = document.getElementById('app');
            if (splash) splash.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');
        };

        // Set a maximum timeout to hide splash screen (prevents infinite loading)
        const splashTimeout = setTimeout(() => {
            console.warn('Splash screen timeout - forcing hide');
            hideSplash();
        }, 8000);

        try {
            // Initialize database
            console.log('Initializing database...');
            await db.init();
            console.log('Database initialized');

            // Load initial radar data from Pasta1.xlsx if database is empty
            if (typeof loadInitialData === 'function') {
                try {
                    const loadedCount = await loadInitialData();
                    if (loadedCount > 0) {
                        console.log(`Loaded ${loadedCount} radars from Pasta1.xlsx`);
                        this.showToast(`${loadedCount} radares carregados da planilha!`, 'success');
                    }
                } catch (dataError) {
                    console.error('Error loading initial data:', dataError);
                }
            }

            // Initialize camera module
            if (typeof camera !== 'undefined' && camera.init) {
                camera.init();
                console.log('Camera module initialized');
            }

            // Setup event listeners
            this.setupEventListeners();

            // Load initial data (with timeout to prevent blocking)
            try {
                await Promise.race([
                    this.loadDashboard(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Dashboard load timeout')), 5000))
                ]);
            } catch (dashError) {
                console.error('Error loading dashboard:', dashError);
            }

            // Clear the timeout since initialization completed
            clearTimeout(splashTimeout);

            // Hide splash screen with animation
            setTimeout(() => {
                hideSplash();
            }, 1000);

            // Register service worker for PWA
            this.registerServiceWorker();

            // Setup online/offline detection
            this.setupConnectionStatus();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);

            // Clear timeout and show app even on error
            clearTimeout(splashTimeout);
            hideSplash();

            this.showToast('Erro ao inicializar. Verifique sua conexão.', 'error');
        }
    },

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Menu toggle
        document.getElementById('menu-btn').addEventListener('click', () => this.toggleMenu());
        document.getElementById('close-menu').addEventListener('click', () => this.toggleMenu());
        document.getElementById('menu-overlay').addEventListener('click', () => this.toggleMenu());

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                this.showView(view);
            });
        });

        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.showView(view);
                this.toggleMenu();
            });
        });

        // Quick action buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Add radar button
        document.getElementById('add-radar-btn').addEventListener('click', () => {
            this.openAddRadarModal();
        });

        // Radar form submit
        document.getElementById('form-radar').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveRadar();
        });

        // Checklist form submit
        document.getElementById('form-checklist').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveChecklist();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        // Search functionality
        document.getElementById('search-radar').addEventListener('input', (e) => {
            this.filterRadares(e.target.value);
        });

        // Filter chips
        document.querySelectorAll('.filter-chips .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.filterByStatus(chip.dataset.filter);
            });
        });

        // Import Excel button
        document.getElementById('import-excel-btn').addEventListener('click', () => {
            document.getElementById('excel-file-input').click();
        });

        document.getElementById('excel-file-input').addEventListener('change', (e) => {
            this.importFromExcel(e.target.files[0]);
        });

        // Export buttons
        document.getElementById('export-pdf').addEventListener('click', () => {
            this.exportToPDF();
        });

        document.getElementById('export-excel').addEventListener('click', () => {
            this.exportToExcel();
        });

        // Distance validation on checklist
        document.getElementById('distancia-placa').addEventListener('input', () => {
            this.validateDistance();
        });
    },

    /**
     * Toggle side menu
     */
    toggleMenu() {
        const menu = document.getElementById('side-menu');
        const overlay = document.getElementById('menu-overlay');
        menu.classList.toggle('open');
        overlay.classList.toggle('visible');
    },

    /**
     * Show a specific view
     */
    showView(viewName) {
        // Update views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewName}`).classList.add('active');

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

        document.querySelector(`.nav-item[data-view="${viewName}"]`)?.classList.add('active');
        document.querySelector(`.menu-item[data-view="${viewName}"]`)?.classList.add('active');

        this.currentView = viewName;

        // Load view-specific data
        switch (viewName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'radares':
                this.loadRadares();
                break;
            case 'checklist':
                this.loadChecklists();
                break;
            case 'export':
                this.loadExportPreview();
                break;
        }
    },

    /**
     * Handle quick action buttons
     */
    handleQuickAction(action) {
        switch (action) {
            case 'new-checklist':
                this.showView('radares');
                this.showToast('Selecione um radar para fazer o checklist', 'info');
                break;
            case 'add-radar':
                this.openAddRadarModal();
                break;
            case 'export-pdf':
                this.exportToPDF();
                break;
        }
    },

    /**
     * Load dashboard data
     */
    async loadDashboard() {
        try {
            const stats = await db.getStats();

            document.getElementById('stat-total').textContent = stats.total;
            document.getElementById('stat-conformes').textContent = stats.conformes;
            document.getElementById('stat-nao-conformes').textContent = stats.naoConformes;
            document.getElementById('stat-pendentes').textContent = stats.pendentes;

            // Render recent activity
            const recentList = document.getElementById('recent-list');
            if (stats.recentChecklists.length === 0) {
                recentList.innerHTML = '<p class="empty-message">Nenhuma verificação realizada ainda.</p>';
            } else {
                const radares = await db.getRadares();
                recentList.innerHTML = stats.recentChecklists.map(checklist => {
                    const radar = radares.find(r => r.id === checklist.radarId);
                    return `
                        <div class="activity-item">
                            <div class="activity-status ${checklist.status}"></div>
                            <div class="activity-info">
                                <div class="activity-title">Km ${radar?.km || 'N/A'} - BR-040</div>
                                <div class="activity-date">${this.formatDate(checklist.date)}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    },

    /**
     * Load radares list
     */
    async loadRadares() {
        try {
            const radares = await db.getRadares();
            this.renderRadares(radares);
        } catch (error) {
            console.error('Error loading radares:', error);
        }
    },

    /**
     * Render radares list
     */
    renderRadares(radares) {
        const container = document.getElementById('radares-list');

        if (radares.length === 0) {
            container.innerHTML = `
                <div class="empty-message">
                    <p>Nenhum radar cadastrado.</p>
                    <button class="btn btn-primary" onclick="app.openAddRadarModal()">
                        ➕ Cadastrar Radar
                    </button>
                </div>
            `;
            return;
        }

        // Sort by km
        radares.sort((a, b) => parseFloat(a.km) - parseFloat(b.km));

        container.innerHTML = radares.map(radar => `
            <div class="radar-card" data-id="${radar.id}">
                <div class="radar-card-header">
                    <span class="radar-km">Km ${radar.km}</span>
                    <span class="radar-status-badge ${radar.status}">${this.getStatusLabel(radar.status)}</span>
                </div>
                <div class="radar-card-body">
                    <div class="radar-thumb">
                        ${radar.photos && radar.photos.length > 0
                ? `<img src="${radar.photos[0].data}" alt="Foto radar">`
                : '📡'}
                    </div>
                    <div class="radar-info">
                        <div class="radar-detail">
                            <span>🛣️</span>
                            <span>${radar.rodovia || 'BR-040'}</span>
                        </div>
                        <div class="radar-detail">
                            <span>⚡</span>
                            <span>${radar.velocidade} km/h</span>
                        </div>
                        <div class="radar-detail">
                            <span>📍</span>
                            <span>${radar.municipio || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.radar-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                this.openRadarDetails(id);
            });
        });
    },

    /**
     * Filter radares by search term
     */
    async filterRadares(searchTerm) {
        const radares = await db.getRadares();
        const term = searchTerm.toLowerCase();

        const filtered = radares.filter(r =>
            r.km.toString().includes(term) ||
            (r.municipio && r.municipio.toLowerCase().includes(term)) ||
            (r.descricao && r.descricao.toLowerCase().includes(term))
        );

        this.renderRadares(filtered);
    },

    /**
     * Filter radares by status
     */
    async filterByStatus(status) {
        const radares = await db.getRadares();

        if (status === 'all') {
            this.renderRadares(radares);
        } else {
            const filtered = radares.filter(r => r.status === status);
            this.renderRadares(filtered);
        }
    },

    /**
     * Open add radar modal
     */
    openAddRadarModal() {
        this.editingRadarId = null;
        document.getElementById('form-radar').reset();
        camera.clearPhotos('radar');
        document.getElementById('modal-add-radar').classList.add('open');
    },

    /**
     * Open radar details modal
     */
    async openRadarDetails(radarId) {
        try {
            console.log('Opening radar details for ID:', radarId, 'type:', typeof radarId);

            const radar = await db.getRadar(radarId);
            if (!radar) {
                console.error('Radar not found with ID:', radarId);
                this.showToast('Radar não encontrado. Tente recarregar a página.', 'error');
                return;
            }

            const checklists = await db.getChecklistsByRadar(radarId);
            const lastChecklist = checklists.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

            const modal = document.getElementById('modal-radar');
            const body = document.getElementById('modal-radar-body');
            document.getElementById('modal-radar-title').textContent = `Km ${radar.km} - BR-040`;

            body.innerHTML = `
                <div class="radar-details">
                    ${radar.photos && radar.photos.length > 0 ? `
                        <div class="radar-photos-carousel">
                            ${radar.photos.map((photo, i) => `
                                <img src="${photo.data}" alt="Foto ${i + 1}" class="radar-detail-photo">
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Rodovia</label>
                            <span>${radar.rodovia || 'BR-040'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Km</label>
                            <span>${radar.km}</span>
                        </div>
                        <div class="detail-item">
                            <label>Sentido</label>
                            <span>${radar.sentido || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <label>Velocidade</label>
                            <span>${radar.velocidade} km/h</span>
                        </div>
                        <div class="detail-item">
                            <label>Tipo de Via</label>
                            <span>${this.getTipoViaLabel(radar.tipoVia)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Município</label>
                            <span>${radar.municipio || 'N/A'}</span>
                        </div>
                    </div>

                    ${radar.descricao ? `
                        <div class="detail-description">
                            <label>Descrição/Referência</label>
                            <p>${radar.descricao}</p>
                        </div>
                    ` : ''}

                    <div class="distance-info">
                        <strong>Intervalo de distância permitido:</strong><br>
                        ${this.getDistanceRange(radar.velocidade, radar.tipoVia)}
                    </div>

                    <div class="detail-status">
                        <label>Status Atual</label>
                        <span class="radar-status-badge ${radar.status}">${this.getStatusLabel(radar.status)}</span>
                        ${lastChecklist ? `<small>Última verificação: ${this.formatDate(lastChecklist.date)}</small>` : ''}
                    </div>

                    <div class="detail-actions">
                        <button class="btn btn-primary" onclick="app.openChecklistModal('${radar.id}')">
                            ✅ Fazer Checklist
                        </button>
                        <button class="btn btn-outline" onclick="app.editRadar('${radar.id}')">
                            ✏️ Editar
                        </button>
                        <button class="btn btn-danger" onclick="app.deleteRadar('${radar.id}')">
                            🗑️ Excluir
                        </button>
                    </div>
                </div>
            `;

            // Add custom styles for detail view
            const style = document.createElement('style');
            style.textContent = `
                .radar-details { padding: 0; }
                .radar-photos-carousel { 
                    display: flex; 
                    gap: var(--space-sm); 
                    overflow-x: auto; 
                    margin-bottom: var(--space-lg);
                    padding-bottom: var(--space-sm);
                }
                .radar-detail-photo { 
                    width: 150px; 
                    height: 150px; 
                    object-fit: cover; 
                    border-radius: var(--radius-md); 
                    flex-shrink: 0;
                }
                .detail-grid { 
                    display: grid; 
                    grid-template-columns: repeat(2, 1fr); 
                    gap: var(--space-md); 
                    margin-bottom: var(--space-lg);
                }
                .detail-item label { 
                    display: block; 
                    font-size: var(--font-size-xs); 
                    color: var(--text-muted); 
                    margin-bottom: 2px;
                }
                .detail-item span { 
                    font-weight: 500; 
                }
                .detail-description { 
                    margin-bottom: var(--space-lg); 
                }
                .detail-description label { 
                    display: block; 
                    font-size: var(--font-size-xs); 
                    color: var(--text-muted); 
                    margin-bottom: var(--space-xs);
                }
                .detail-status { 
                    display: flex; 
                    flex-direction: column; 
                    gap: var(--space-xs); 
                    margin-bottom: var(--space-lg);
                }
                .detail-status label { 
                    font-size: var(--font-size-xs); 
                    color: var(--text-muted);
                }
                .detail-status small { 
                    font-size: var(--font-size-xs); 
                    color: var(--text-muted);
                }
                .detail-actions { 
                    display: flex; 
                    flex-direction: column; 
                    gap: var(--space-sm);
                }
            `;
            body.appendChild(style);

            modal.classList.add('open');
        } catch (error) {
            console.error('Error opening radar details:', error);
            this.showToast('Erro ao carregar detalhes', 'error');
        }
    },

    /**
     * Edit radar
     */
    async editRadar(radarId) {
        try {
            const radar = await db.getRadar(radarId);
            if (!radar) return;

            this.closeAllModals();

            // Fill form with radar data
            document.getElementById('radar-id').value = radar.id;
            document.getElementById('radar-km').value = radar.km;
            document.getElementById('radar-sentido').value = radar.sentido || '';
            document.getElementById('radar-velocidade').value = radar.velocidade;
            document.getElementById('radar-tipo-via').value = radar.tipoVia || '';
            document.getElementById('radar-municipio').value = radar.municipio || '';
            document.getElementById('radar-descricao').value = radar.descricao || '';

            // Set photos
            camera.setPhotos(radar.photos || [], 'radar');

            this.editingRadarId = radar.id;
            document.getElementById('modal-add-radar').classList.add('open');
        } catch (error) {
            console.error('Error editing radar:', error);
            this.showToast('Erro ao editar radar', 'error');
        }
    },

    /**
     * Save radar
     */
    async saveRadar() {
        try {
            const radarData = {
                km: document.getElementById('radar-km').value.trim(),
                sentido: document.getElementById('radar-sentido').value,
                velocidade: parseInt(document.getElementById('radar-velocidade').value),
                tipoVia: document.getElementById('radar-tipo-via').value,
                municipio: document.getElementById('radar-municipio').value.trim(),
                descricao: document.getElementById('radar-descricao').value.trim(),
                rodovia: 'BR-040',
                photos: camera.getPhotos('radar')
            };

            // If editing, add ID
            if (this.editingRadarId) {
                radarData.id = this.editingRadarId;
            }

            await db.saveRadar(radarData);

            this.closeAllModals();
            this.showToast(this.editingRadarId ? 'Radar atualizado!' : 'Radar cadastrado!', 'success');

            if (this.currentView === 'radares') {
                this.loadRadares();
            }
            this.loadDashboard();

            this.editingRadarId = null;
        } catch (error) {
            console.error('Error saving radar:', error);
            this.showToast('Erro ao salvar radar', 'error');
        }
    },

    /**
     * Delete radar
     */
    async deleteRadar(radarId) {
        if (!confirm('Tem certeza que deseja excluir este radar?')) return;

        try {
            await db.deleteRadar(radarId);
            this.closeAllModals();
            this.showToast('Radar excluído!', 'success');
            this.loadRadares();
            this.loadDashboard();
        } catch (error) {
            console.error('Error deleting radar:', error);
            this.showToast('Erro ao excluir radar', 'error');
        }
    },

    /**
     * Open checklist modal
     */
    async openChecklistModal(radarId) {
        try {
            const radar = await db.getRadar(radarId);
            if (!radar) return;

            this.closeAllModals();
            this.currentChecklistRadarId = radarId;

            // Set radar info
            const radarInfo = document.getElementById('checklist-radar-info');
            radarInfo.innerHTML = `
                <strong>Km ${radar.km} - BR-040</strong><br>
                <small>Velocidade: ${radar.velocidade} km/h | Tipo: ${this.getTipoViaLabel(radar.tipoVia)}</small>
            `;

            // Set distance info
            const distanceInfo = document.getElementById('distance-info');
            distanceInfo.innerHTML = `
                <strong>Intervalo de distância permitido:</strong><br>
                ${this.getDistanceRange(radar.velocidade, radar.tipoVia)}
            `;

            // Store velocity and road type for validation
            distanceInfo.dataset.velocidade = radar.velocidade;
            distanceInfo.dataset.tipoVia = radar.tipoVia;

            // Reset form
            document.getElementById('form-checklist').reset();
            camera.clearPhotos('checklist');
            document.getElementById('checklist-radar-id').value = radarId;
            document.getElementById('distancia-status').textContent = '';

            // Reset editing state (we're creating a new checklist)
            this.editingChecklistId = null;

            document.getElementById('modal-checklist').classList.add('open');
        } catch (error) {
            console.error('Error opening checklist:', error);
            this.showToast('Erro ao abrir checklist', 'error');
        }
    },

    /**
     * Validate distance input
     */
    validateDistance() {
        const distanceInfo = document.getElementById('distance-info');
        const distanceInput = document.getElementById('distancia-placa');
        const statusSpan = document.getElementById('distancia-status');

        const velocidade = parseInt(distanceInfo.dataset.velocidade);
        const tipoVia = distanceInfo.dataset.tipoVia;
        const distance = parseInt(distanceInput.value);

        if (!distance || !tipoVia) {
            statusSpan.textContent = '';
            distanceInfo.className = 'distance-info';
            return;
        }

        const range = this.getDistanceIntervals(velocidade, tipoVia);

        if (distance >= range.min && distance <= range.max) {
            statusSpan.textContent = '✅ Dentro do intervalo permitido';
            statusSpan.className = 'field-status success';
            distanceInfo.className = 'distance-info success';
        } else {
            statusSpan.textContent = '❌ Fora do intervalo permitido';
            statusSpan.className = 'field-status error';
            distanceInfo.className = 'distance-info error';
        }
    },

    /**
     * Save checklist
     */
    async saveChecklist() {
        try {
            // Note: radarId must be string to match Firebase document IDs
            const radarIdValue = document.getElementById('checklist-radar-id').value;

            const checklistData = {
                radarId: radarIdValue.toString(), // Keep as string, not parseInt
                placaPresente: document.getElementById('check-placa-presente').checked,
                distanciaPlaca: parseInt(document.getElementById('distancia-placa').value) || null,
                placaLegivel: document.getElementById('check-placa-legivel').checked,
                pinturaSolo: document.getElementById('check-pintura-solo').checked,
                semObstrucao: document.getElementById('check-sem-obstrucao').checked,
                placaVelocidade: document.getElementById('check-placa-velocidade').checked,
                observacoes: document.getElementById('checklist-obs').value.trim(),
                status: document.getElementById('checklist-status').value,
                photos: camera.getPhotos('checklist')
            };

            // If editing, include the checklist ID
            if (this.editingChecklistId) {
                checklistData.id = this.editingChecklistId;
            }

            await db.saveChecklist(checklistData);

            // Store the edit state before resetting for the toast message
            const wasEditing = !!this.editingChecklistId;

            // Reset editing state
            this.editingChecklistId = null;

            this.closeAllModals();
            this.showToast(wasEditing ? 'Checklist atualizado!' : 'Checklist salvo!', 'success');

            this.loadDashboard();
            if (this.currentView === 'radares') {
                this.loadRadares();
            } else if (this.currentView === 'checklist') {
                this.loadChecklists();
            }
        } catch (error) {
            console.error('Error saving checklist:', error);
            this.showToast('Erro ao salvar checklist', 'error');
        }
    },

    /**
     * Load checklists list
     */
    async loadChecklists() {
        try {
            const checklists = await db.getChecklists();
            const radares = await db.getRadares();

            const container = document.getElementById('checklist-list');

            if (checklists.length === 0) {
                container.innerHTML = '<p class="empty-message">Nenhum checklist realizado ainda.</p>';
                return;
            }

            // Sort by date (newest first)
            checklists.sort((a, b) => new Date(b.date) - new Date(a.date));

            container.innerHTML = checklists.map(checklist => {
                const radar = radares.find(r => r.id === checklist.radarId);
                return `
                    <div class="checklist-card" data-id="${checklist.id}">
                        <div class="radar-card-header">
                            <span class="radar-km">Km ${radar?.km || 'N/A'}</span>
                            <span class="radar-status-badge ${checklist.status}">${this.getStatusLabel(checklist.status)}</span>
                        </div>
                        <div class="radar-info" style="margin-top: var(--space-sm);">
                            <div class="radar-detail">
                                <span>📅</span>
                                <span>${this.formatDate(checklist.date)}</span>
                            </div>
                            <div class="radar-detail">
                                <span>📏</span>
                                <span>Distância: ${checklist.distanciaPlaca || 'N/A'} m</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Add click handlers for checklist cards
            container.querySelectorAll('.checklist-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id;
                    this.openChecklistDetails(id);
                });
            });
        } catch (error) {
            console.error('Error loading checklists:', error);
        }
    },

    /**
     * Open checklist details modal
     */
    async openChecklistDetails(checklistId) {
        try {
            const checklist = await db.getChecklist(checklistId);
            if (!checklist) {
                this.showToast('Checklist não encontrado', 'error');
                return;
            }

            const radar = await db.getRadar(checklist.radarId);

            const modal = document.getElementById('modal-radar');
            const body = document.getElementById('modal-radar-body');
            document.getElementById('modal-radar-title').textContent = `Checklist - Km ${radar?.km || 'N/A'}`;

            body.innerHTML = `
                <div class="checklist-details">
                    <div class="detail-status" style="margin-bottom: var(--space-lg);">
                        <label>Status</label>
                        <span class="radar-status-badge ${checklist.status}">${this.getStatusLabel(checklist.status)}</span>
                        <small>Realizado em: ${this.formatDate(checklist.date)}</small>
                    </div>

                    ${checklist.photos && checklist.photos.length > 0 ? `
                        <div class="radar-photos-carousel" style="margin-bottom: var(--space-lg);">
                            ${checklist.photos.map((photo, i) => `
                                <img src="${photo.data}" alt="Foto ${i + 1}" class="radar-detail-photo">
                            `).join('')}
                        </div>
                    ` : ''}

                    <div class="checklist-section">
                        <h3>Verificações Realizadas</h3>
                        <div class="check-list" style="display: flex; flex-direction: column; gap: var(--space-sm);">
                            <div class="check-item" style="display: flex; align-items: center; gap: var(--space-sm);">
                                <span>${checklist.placaPresente ? '✅' : '❌'}</span>
                                <span>Placa R-19 presente e visível</span>
                            </div>
                            <div class="check-item" style="display: flex; align-items: center; gap: var(--space-sm);">
                                <span>${checklist.placaLegivel ? '✅' : '❌'}</span>
                                <span>Placa legível e em bom estado</span>
                            </div>
                            <div class="check-item" style="display: flex; align-items: center; gap: var(--space-sm);">
                                <span>${checklist.pinturaSolo ? '✅' : '❌'}</span>
                                <span>Pintura de solo adequada</span>
                            </div>
                            <div class="check-item" style="display: flex; align-items: center; gap: var(--space-sm);">
                                <span>${checklist.semObstrucao ? '✅' : '❌'}</span>
                                <span>Sem obstruções visuais</span>
                            </div>
                            <div class="check-item" style="display: flex; align-items: center; gap: var(--space-sm);">
                                <span>${checklist.placaVelocidade ? '✅' : '❌'}</span>
                                <span>Placa de velocidade visível</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-grid" style="margin-top: var(--space-lg);">
                        <div class="detail-item">
                            <label>Distância da Placa</label>
                            <span>${checklist.distanciaPlaca || 'N/A'} m</span>
                        </div>
                    </div>

                    ${checklist.observacoes ? `
                        <div class="detail-description" style="margin-top: var(--space-lg);">
                            <label>Observações</label>
                            <p style="white-space: pre-wrap;">${checklist.observacoes}</p>
                        </div>
                    ` : ''}

                    <div class="detail-actions" style="margin-top: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-sm);">
                        <button class="btn btn-primary" onclick="app.editChecklist('${checklist.id}')">
                            ✏️ Editar Checklist
                        </button>
                        <button class="btn btn-danger" onclick="app.deleteChecklist('${checklist.id}')">
                            🗑️ Excluir Checklist
                        </button>
                    </div>
                </div>
            `;

            modal.classList.add('open');
        } catch (error) {
            console.error('Error opening checklist details:', error);
            this.showToast('Erro ao abrir detalhes do checklist', 'error');
        }
    },

    /**
     * Edit an existing checklist
     */
    async editChecklist(checklistId) {
        try {
            const checklist = await db.getChecklist(checklistId);
            if (!checklist) {
                this.showToast('Checklist não encontrado', 'error');
                return;
            }

            const radar = await db.getRadar(checklist.radarId);
            if (!radar) {
                this.showToast('Radar associado não encontrado', 'error');
                return;
            }

            this.closeAllModals();

            // Set radar info
            const radarInfo = document.getElementById('checklist-radar-info');
            radarInfo.innerHTML = `
                <strong>Km ${radar.km} - BR-040</strong><br>
                <small>Velocidade: ${radar.velocidade} km/h | Tipo: ${this.getTipoViaLabel(radar.tipoVia)}</small>
            `;

            // Set distance info
            const distanceInfo = document.getElementById('distance-info');
            distanceInfo.innerHTML = `
                <strong>Intervalo de distância permitido:</strong><br>
                ${this.getDistanceRange(radar.velocidade, radar.tipoVia)}
            `;

            // Store velocity and road type for validation
            distanceInfo.dataset.velocidade = radar.velocidade;
            distanceInfo.dataset.tipoVia = radar.tipoVia;

            // Fill form with existing data
            document.getElementById('checklist-radar-id').value = checklist.radarId;
            document.getElementById('check-placa-presente').checked = checklist.placaPresente || false;
            document.getElementById('distancia-placa').value = checklist.distanciaPlaca || '';
            document.getElementById('check-placa-legivel').checked = checklist.placaLegivel || false;
            document.getElementById('check-pintura-solo').checked = checklist.pinturaSolo || false;
            document.getElementById('check-sem-obstrucao').checked = checklist.semObstrucao || false;
            document.getElementById('check-placa-velocidade').checked = checklist.placaVelocidade || false;
            document.getElementById('checklist-obs').value = checklist.observacoes || '';
            document.getElementById('checklist-status').value = checklist.status || '';

            // Set photos
            camera.setPhotos(checklist.photos || [], 'checklist');

            // Track that we're editing
            this.editingChecklistId = checklist.id;

            // Validate distance
            this.validateDistance();

            document.getElementById('modal-checklist').classList.add('open');
        } catch (error) {
            console.error('Error editing checklist:', error);
            this.showToast('Erro ao editar checklist', 'error');
        }
    },

    /**
     * Delete a checklist
     */
    async deleteChecklist(checklistId) {
        if (!confirm('Tem certeza que deseja excluir este checklist?')) return;

        try {
            await db.deleteChecklist(checklistId);
            this.closeAllModals();
            this.showToast('Checklist excluído!', 'success');
            this.loadDashboard();
            if (this.currentView === 'checklist') {
                this.loadChecklists();
            }
        } catch (error) {
            console.error('Error deleting checklist:', error);
            this.showToast('Erro ao excluir checklist', 'error');
        }
    },

    /**
     * Load export preview
     */
    async loadExportPreview() {
        try {
            const radares = await db.getRadares();
            const container = document.getElementById('export-table-container');

            if (radares.length === 0) {
                container.innerHTML = '<p class="empty-message">Nenhum dado para exportar.</p>';
                return;
            }

            container.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Km</th>
                            <th>Velocidade</th>
                            <th>Tipo Via</th>
                            <th>Município</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${radares.map(radar => `
                            <tr>
                                <td>${radar.km}</td>
                                <td>${radar.velocidade} km/h</td>
                                <td>${this.getTipoViaLabel(radar.tipoVia)}</td>
                                <td>${radar.municipio || '-'}</td>
                                <td><span class="radar-status-badge ${radar.status}">${this.getStatusLabel(radar.status)}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } catch (error) {
            console.error('Error loading export preview:', error);
        }
    },

    /**
     * Import radars from Excel file
     */
    async importFromExcel(file) {
        if (!file) return;

        try {
            this.showToast('Importando dados...', 'info');

            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });

            // Get first sheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                this.showToast('Planilha vazia ou sem dados', 'warning');
                return;
            }

            // Get headers (first row)
            const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
            console.log('Headers found:', headers);

            // Find column indexes
            const findColumn = (names) => {
                for (const name of names) {
                    const index = headers.findIndex(h => h.includes(name));
                    if (index !== -1) return index;
                }
                return -1;
            };

            const kmIndex = findColumn(['km', 'quilometro', 'quilômetro']);
            const velIndex = findColumn(['velocidade', 'vel', 'km/h']);
            const tipoIndex = findColumn(['tipo', 'via', 'tipo de via']);
            const municipioIndex = findColumn(['municipio', 'município', 'cidade']);
            const sentidoIndex = findColumn(['sentido', 'direção', 'direcao']);

            console.log('Column indexes:', { kmIndex, velIndex, tipoIndex, municipioIndex, sentidoIndex });

            // Parse data rows
            const radares = [];
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;

                const km = kmIndex !== -1 ? String(row[kmIndex] || '').replace(',', '.') : '';
                if (!km || km === 'undefined') continue;

                const radar = {
                    km: km,
                    velocidade: velIndex !== -1 ? parseInt(row[velIndex]) || 80 : 80,
                    tipoVia: tipoIndex !== -1 ? this.parseTipoVia(String(row[tipoIndex] || '')) : 'rural',
                    municipio: municipioIndex !== -1 ? String(row[municipioIndex] || '') : '',
                    sentido: sentidoIndex !== -1 ? String(row[sentidoIndex] || '') : '',
                    rodovia: 'BR-040',
                    status: 'pendente',
                    photos: []
                };

                radares.push(radar);
            }

            if (radares.length === 0) {
                this.showToast('Nenhum radar válido encontrado na planilha', 'warning');
                return;
            }

            // Confirm import
            if (!confirm(`Importar ${radares.length} radares? Dados existentes serão mantidos.`)) {
                return;
            }

            // Import to database
            const count = await db.importRadares(radares);

            this.showToast(`${count} radares importados com sucesso!`, 'success');
            this.loadDashboard();
            this.loadRadares();
            this.toggleMenu();

        } catch (error) {
            console.error('Error importing Excel:', error);
            this.showToast('Erro ao importar planilha', 'error');
        }
    },

    /**
     * Parse tipo de via from string
     */
    parseTipoVia(value) {
        const lower = value.toLowerCase();
        if (lower.includes('urbana') && lower.includes('rural')) return 'rural-urbana';
        if (lower.includes('urbana')) return 'urbana';
        return 'rural';
    },

    /**
     * Export to PDF with photos
     */
    async exportToPDF() {
        try {
            this.showToast('Gerando PDF com fotos...', 'info');

            const radares = await db.getRadares();
            const checklists = await db.getChecklists();

            if (radares.length === 0) {
                this.showToast('Nenhum dado para exportar', 'warning');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            // Title page
            doc.setFontSize(24);
            doc.setTextColor(99, 102, 241);
            doc.text('Relatório de Fiscalização de Radares', 148, 60, { align: 'center' });

            doc.setFontSize(18);
            doc.setTextColor(100);
            doc.text('BR-040', 148, 75, { align: 'center' });

            doc.setFontSize(12);
            doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 148, 90, { align: 'center' });
            doc.text('Responsável: Luis Pigrucci', 148, 100, { align: 'center' });

            // Summary
            const stats = await db.getStats();
            doc.setFontSize(14);
            doc.setTextColor(60);
            doc.text(`Total: ${stats.total} | Conformes: ${stats.conformes} | Não Conformes: ${stats.naoConformes} | Pendentes: ${stats.pendentes}`, 148, 120, { align: 'center' });

            // Sort radares by km
            const sortedRadares = [...radares].sort((a, b) => {
                const kmA = parseFloat(String(a.km).replace('+', '.').replace(/[^\d.]/g, ''));
                const kmB = parseFloat(String(b.km).replace('+', '.').replace(/[^\d.]/g, ''));
                return kmA - kmB;
            });

            // New page for table
            doc.addPage();

            // Table header
            doc.setFontSize(16);
            doc.setTextColor(99, 102, 241);
            doc.text('Resumo dos Radares', 14, 15);

            // Table data
            const tableData = sortedRadares.map(radar => {
                const lastChecklist = checklists
                    .filter(c => c.radarId === radar.id)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                let classificacao = 'RURAL';
                if (radar.tipoVia === 'rural-urbana') classificacao = 'RCU';
                else if (radar.tipoVia === 'urbana') classificacao = 'URBANA';

                const hasPhotos = (radar.photos && radar.photos.length > 0) ||
                    (lastChecklist?.photos && lastChecklist.photos.length > 0);

                return [
                    `Km ${radar.km}`,
                    radar.tipoRadar || 'PER',
                    `${radar.velocidade || 60}`,
                    classificacao,
                    radar.sentido || '-',
                    lastChecklist?.distanciaPlaca ? `${lastChecklist.distanciaPlaca}m` : '-',
                    this.getStatusLabel(radar.status),
                    hasPhotos ? 'SIM' : '-'
                ];
            });

            doc.autoTable({
                startY: 22,
                head: [['Local', 'Tipo', 'Vel.', 'Classif.', 'Sentido', 'Dist.', 'Status', 'Fotos']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [99, 102, 241],
                    textColor: 255,
                    fontSize: 9,
                    fontStyle: 'bold'
                },
                bodyStyles: { fontSize: 8 },
                alternateRowStyles: { fillColor: [245, 245, 250] },
                columnStyles: {
                    0: { cellWidth: 28 },
                    1: { cellWidth: 22 },
                    2: { cellWidth: 15 },
                    3: { cellWidth: 20 },
                    4: { cellWidth: 18 },
                    5: { cellWidth: 18 },
                    6: { cellWidth: 25 },
                    7: { cellWidth: 18 }
                }
            });

            // Add detailed pages with photos for each radar that has photos
            for (const radar of sortedRadares) {
                const lastChecklist = checklists
                    .filter(c => c.radarId === radar.id)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                const radarPhotos = radar.photos || [];
                const checklistPhotos = lastChecklist?.photos || [];
                const allPhotos = [...radarPhotos, ...checklistPhotos];

                if (allPhotos.length === 0) continue;

                // New page for this radar
                doc.addPage();

                // Radar header
                doc.setFontSize(16);
                doc.setTextColor(99, 102, 241);
                doc.text(`Km ${radar.km} - BR-040`, 14, 15);

                doc.setFontSize(10);
                doc.setTextColor(60);

                let classificacao = 'RURAL';
                if (radar.tipoVia === 'rural-urbana') classificacao = 'RCU';
                else if (radar.tipoVia === 'urbana') classificacao = 'URBANA';

                doc.text(`Tipo: ${radar.tipoRadar || 'PER'} | Velocidade: ${radar.velocidade || 60} km/h | Classificação: ${classificacao}`, 14, 22);
                doc.text(`Sentido: ${radar.sentido || '-'} | Status: ${this.getStatusLabel(radar.status)}`, 14, 28);

                if (lastChecklist) {
                    doc.text(`Distância Placa: ${lastChecklist.distanciaPlaca || '-'}m | Verificado: ${this.formatDate(lastChecklist.date)}`, 14, 34);
                }

                // Add photos
                let xPos = 14;
                let yPos = 45;
                const photoWidth = 85;
                const photoHeight = 65;
                const spacing = 5;

                for (let i = 0; i < allPhotos.length; i++) {
                    const photo = allPhotos[i];

                    try {
                        // Add image
                        doc.addImage(photo.data, 'JPEG', xPos, yPos, photoWidth, photoHeight);

                        // Add caption
                        doc.setFontSize(8);
                        doc.setTextColor(100);
                        const caption = i < radarPhotos.length ? `Foto Radar ${i + 1}` : `Foto Checklist ${i - radarPhotos.length + 1}`;
                        doc.text(caption, xPos + photoWidth / 2, yPos + photoHeight + 4, { align: 'center' });

                        // Move position
                        xPos += photoWidth + spacing;

                        // New row after 3 photos
                        if ((i + 1) % 3 === 0) {
                            xPos = 14;
                            yPos += photoHeight + 15;
                        }

                        // New page if needed
                        if (yPos > 150 && i < allPhotos.length - 1) {
                            doc.addPage();
                            xPos = 14;
                            yPos = 20;
                        }
                    } catch (photoError) {
                        console.warn('Error adding photo to PDF:', photoError);
                    }
                }

                // Add observations if any
                if (radar.descricao || lastChecklist?.observacoes) {
                    const obsY = Math.max(yPos + photoHeight + 20, 180);
                    doc.setFontSize(10);
                    doc.setTextColor(60);
                    doc.text('Observações:', 14, obsY);
                    doc.setFontSize(9);
                    doc.text(radar.descricao || lastChecklist?.observacoes || '', 14, obsY + 6);
                }
            }

            // Save PDF
            doc.save(`Radares_BR040_${new Date().toISOString().split('T')[0]}.pdf`);
            this.showToast('PDF exportado com sucesso!', 'success');

        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showToast('Erro ao exportar PDF: ' + error.message, 'error');
        }
    },

    /**
     * Export to Excel with photos report
     */
    async exportToExcel() {
        try {
            this.showToast('Gerando Excel e relatório de fotos...', 'info');

            const radares = await db.getRadares();
            const checklists = await db.getChecklists();

            if (radares.length === 0) {
                this.showToast('Nenhum dado para exportar', 'warning');
                return;
            }

            // Sort radares by km
            const sortedRadares = [...radares].sort((a, b) => {
                const kmA = parseFloat(String(a.km).replace('+', '.').replace(/[^\d.]/g, ''));
                const kmB = parseFloat(String(b.km).replace('+', '.').replace(/[^\d.]/g, ''));
                return kmA - kmB;
            });

            // Prepare data - matching original spreadsheet format
            const radaresData = sortedRadares.map(radar => {
                const lastChecklist = checklists
                    .filter(c => c.radarId === radar.id)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                // Get classification text
                let classificacao = 'RURAL';
                if (radar.tipoVia === 'rural-urbana') classificacao = 'RCU';
                else if (radar.tipoVia === 'urbana') classificacao = 'URBANA';

                // Count photos
                const radarPhotos = radar.photos?.length || 0;
                const checklistPhotos = lastChecklist?.photos?.length || 0;
                const totalPhotos = radarPhotos + checklistPhotos;

                return {
                    'Local': `KM ${radar.km}`,
                    'Tipo': radar.tipoRadar || 'PER',
                    'Velocidade': radar.velocidade || 60,
                    'Classificação': classificacao,
                    'Sentido': radar.sentido || '',
                    'Placa 01 - Se Rural': lastChecklist?.placaPresente ? 'SIM' : '',
                    'Distância Placa (m)': lastChecklist?.distanciaPlaca || '',
                    'Placa Legível': lastChecklist?.placaLegivel ? 'SIM' : '',
                    'Pintura Solo': lastChecklist?.pinturaSolo ? 'SIM' : '',
                    'Sem Obstrução': lastChecklist?.semObstrucao ? 'SIM' : '',
                    'Status': this.getStatusLabel(radar.status),
                    'Qtd Fotos': totalPhotos > 0 ? totalPhotos : '',
                    'Última Verificação': lastChecklist ? this.formatDate(lastChecklist.date) : '',
                    'Observações': radar.descricao || lastChecklist?.observacoes || ''
                };
            });

            // Create workbook
            const wb = XLSX.utils.book_new();

            // Add header info
            const headerData = [
                ['', 'RADARES BR-040', '', '', '', '', '', '', '', '', '', '', 'Data:', new Date().toLocaleDateString('pt-BR')],
                ['', '', '', '', '', '', '', '', '', '', '', '', 'Responsável:', 'Luis Pigrucci'],
                []
            ];

            // Create worksheet with headers
            const ws = XLSX.utils.aoa_to_sheet(headerData);

            // Add data starting from row 4
            XLSX.utils.sheet_add_json(ws, radaresData, { origin: 'A4' });

            // Set column widths
            ws['!cols'] = [
                { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
                { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
                { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 25 }
            ];

            XLSX.utils.book_append_sheet(wb, ws, 'Radares');

            // Add checklists sheet if there are any
            if (checklists.length > 0) {
                const checklistsData = checklists.map(c => {
                    const radar = radares.find(r => r.id === c.radarId);
                    return {
                        'Local': `KM ${radar?.km || ''}`,
                        'Data': this.formatDate(c.date),
                        'Status': this.getStatusLabel(c.status),
                        'Placa R-19 Presente': c.placaPresente ? 'Sim' : 'Não',
                        'Distância (m)': c.distanciaPlaca || '',
                        'Placa Legível': c.placaLegivel ? 'Sim' : 'Não',
                        'Pintura Solo': c.pinturaSolo ? 'Sim' : 'Não',
                        'Sem Obstrução': c.semObstrucao ? 'Sim' : 'Não',
                        'Placa Velocidade': c.placaVelocidade ? 'Sim' : 'Não',
                        'Qtd Fotos': c.photos?.length || 0,
                        'Observações': c.observacoes || ''
                    };
                });
                const wsChecklists = XLSX.utils.json_to_sheet(checklistsData);
                wsChecklists['!cols'] = [
                    { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
                    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 30 }
                ];
                XLSX.utils.book_append_sheet(wb, wsChecklists, 'Checklists');
            }

            // Save Excel file
            XLSX.writeFile(wb, `Radares_BR040_${new Date().toISOString().split('T')[0]}.xlsx`);

            // Generate HTML with photos
            const radaresWithPhotos = sortedRadares.filter(radar => {
                const lastChecklist = checklists
                    .filter(c => c.radarId === radar.id)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                return (radar.photos?.length > 0) || (lastChecklist?.photos?.length > 0);
            });

            if (radaresWithPhotos.length > 0) {
                let htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fotos dos Radares BR-040</title>
    <style>
        body { font-family: Arial, sans-serif; background: #1a1a2e; color: #fff; padding: 20px; }
        h1 { color: #6366f1; text-align: center; }
        h2 { color: #a5b4fc; border-bottom: 2px solid #6366f1; padding-bottom: 10px; margin-top: 40px; }
        .radar-section { background: #16213e; border-radius: 10px; padding: 20px; margin: 20px 0; }
        .radar-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 20px; }
        .radar-info span { background: #0f3460; padding: 8px 12px; border-radius: 5px; }
        .photos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .photo-container { text-align: center; }
        .photo-container img { max-width: 100%; border-radius: 8px; border: 2px solid #6366f1; }
        .photo-caption { margin-top: 5px; font-size: 12px; color: #a5b4fc; }
        .status { padding: 4px 10px; border-radius: 20px; font-size: 12px; }
        .status.conforme { background: #10b981; }
        .status.nao-conforme { background: #ef4444; }
        .status.pendente { background: #f59e0b; }
        @media print { body { background: #fff; color: #000; } .radar-section { background: #f0f0f0; } }
    </style>
</head>
<body>
    <h1>📷 Fotos dos Radares BR-040</h1>
    <p style="text-align:center;">Data: ${new Date().toLocaleDateString('pt-BR')} | Responsável: Luis Pigrucci</p>
`;

                for (const radar of radaresWithPhotos) {
                    const lastChecklist = checklists
                        .filter(c => c.radarId === radar.id)
                        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                    let classificacao = 'RURAL';
                    if (radar.tipoVia === 'rural-urbana') classificacao = 'RCU';
                    else if (radar.tipoVia === 'urbana') classificacao = 'URBANA';

                    htmlContent += `
    <div class="radar-section">
        <h2>📍 Km ${radar.km}</h2>
        <div class="radar-info">
            <span>Tipo: ${radar.tipoRadar || 'PER'}</span>
            <span>Velocidade: ${radar.velocidade || 60} km/h</span>
            <span>Classificação: ${classificacao}</span>
            <span>Sentido: ${radar.sentido || '-'}</span>
            <span class="status ${radar.status}">Status: ${this.getStatusLabel(radar.status)}</span>
            ${lastChecklist ? `<span>Distância: ${lastChecklist.distanciaPlaca || '-'}m</span>` : ''}
        </div>
        <div class="photos-grid">
`;

                    const radarPhotos = radar.photos || [];
                    const checklistPhotos = lastChecklist?.photos || [];

                    for (let i = 0; i < radarPhotos.length; i++) {
                        htmlContent += `
            <div class="photo-container">
                <img src="${radarPhotos[i].data}" alt="Foto Radar ${i + 1}">
                <div class="photo-caption">Foto Radar ${i + 1}</div>
            </div>
`;
                    }

                    for (let i = 0; i < checklistPhotos.length; i++) {
                        htmlContent += `
            <div class="photo-container">
                <img src="${checklistPhotos[i].data}" alt="Foto Checklist ${i + 1}">
                <div class="photo-caption">Foto Checklist ${i + 1} - ${lastChecklist ? this.formatDate(lastChecklist.date) : ''}</div>
            </div>
`;
                    }

                    htmlContent += `
        </div>
        ${radar.descricao || lastChecklist?.observacoes ? `<p style="margin-top:15px;"><strong>Obs:</strong> ${radar.descricao || lastChecklist?.observacoes}</p>` : ''}
    </div>
`;
                }

                htmlContent += `
</body>
</html>`;

                // Download HTML file with photos
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Fotos_Radares_BR040_${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                this.showToast('Excel e relatório de fotos exportados!', 'success');
            } else {
                this.showToast('Excel exportado (sem fotos)!', 'success');
            }

        } catch (error) {
            console.error('Error exporting Excel:', error);
            this.showToast('Erro ao exportar Excel: ' + error.message, 'error');
        }
    },

    /**
     * Close all modals
     */
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('open');
        });
        camera.clearPhotos();
        this.editingRadarId = null;
        this.editingChecklistId = null;
    },

    /**
     * Get distance intervals for velocity and road type
     */
    getDistanceIntervals(velocidade, tipoVia) {
        const intervals = this.distanceIntervals[tipoVia] || this.distanceIntervals['rural'];
        return velocidade >= 80 ? intervals.high : intervals.low;
    },

    /**
     * Get distance range text
     */
    getDistanceRange(velocidade, tipoVia) {
        const range = this.getDistanceIntervals(velocidade, tipoVia);
        return `${range.min} a ${range.max} metros`;
    },

    /**
     * Get status label
     */
    getStatusLabel(status) {
        const labels = {
            'conforme': 'Conforme',
            'nao-conforme': 'Não Conforme',
            'pendente': 'Pendente'
        };
        return labels[status] || 'Pendente';
    },

    /**
     * Get tipo via label
     */
    getTipoViaLabel(tipoVia) {
        const labels = {
            'urbana': 'Via Urbana',
            'rural-urbana': 'Rural c/ caract. urbana',
            'rural': 'Via Rural'
        };
        return labels[tipoVia] || 'N/A';
    },

    /**
     * Format date
     */
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">×</button>
        `;

        container.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);

        // Remove on click
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    },

    /**
     * Setup connection status indicator
     */
    setupConnectionStatus() {
        const updateStatus = () => {
            const statusEl = document.getElementById('connection-status');
            const dot = statusEl.querySelector('.status-dot');

            if (navigator.onLine) {
                dot.className = 'status-dot online';
                statusEl.innerHTML = '<span class="status-dot online"></span>Online';
            } else {
                dot.className = 'status-dot offline';
                statusEl.innerHTML = '<span class="status-dot offline"></span>Offline';
            }
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus();
    },

    /**
     * Register service worker
     */
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Export for global access
window.app = app;
