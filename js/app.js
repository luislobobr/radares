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

            // Setup lightbox for image preview
            this.setupLightbox();

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

        // Export filter listeners
        document.getElementById('export-filter-tipo').addEventListener('change', () => {
            this.loadExportPreview();
        });

        document.getElementById('export-filter-radar').addEventListener('change', () => {
            this.loadExportPreview();
        });

        // Distance validation on checklist
        document.getElementById('distancia-placa').addEventListener('input', () => {
            this.validateDistance();
        });

        // Checklist details modal buttons
        const btnSaveChecklistEdit = document.getElementById('btn-save-checklist-edit');
        if (btnSaveChecklistEdit) {
            btnSaveChecklistEdit.addEventListener('click', () => {
                this.saveChecklistEdit();
            });
        }

        const btnDeleteChecklist = document.getElementById('btn-delete-checklist');
        if (btnDeleteChecklist) {
            btnDeleteChecklist.addEventListener('click', () => {
                if (this.currentEditingChecklistId) {
                    this.deleteChecklist(this.currentEditingChecklistId);
                }
            });
        }

        // Checklist search and filters
        const searchChecklistInput = document.getElementById('search-checklist');
        if (searchChecklistInput) {
            searchChecklistInput.addEventListener('input', (e) => {
                this.filterChecklists(e.target.value);
            });
        }

        document.querySelectorAll('#view-checklist .filter-chips .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#view-checklist .filter-chips .chip')
                    .forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.filterChecklistsByStatus(chip.dataset.filter);
            });
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
            document.getElementById('stat-per').textContent = stats.totalPer;
            document.getElementById('stat-educativo').textContent = stats.totalEducativo;

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
                    <div class="radar-title-row">
                        <span class="radar-km">Km ${radar.km}${radar.sentido ? ' - ' + radar.sentido : ''}</span>
                        ${radar.tipo ? `<span class="radar-type-badge ${radar.tipo}">${radar.tipo === 'per' ? '🚨 PER' : '📚 EDU'}</span>` : ''}
                    </div>
                    <span class="radar-status-badge ${radar.status}">${this.getStatusLabel(radar.status)}</span>
                </div>
                ${radar.lastChecklistDate ? `
                    <div class="radar-checklist-badge">
                        <span class="checklist-icon">✅</span>
                        <span class="checklist-label">Verificado em ${this.formatDate(radar.lastChecklistDate)}</span>
                    </div>
                ` : ''}
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
     * Filter radares by status or tipo
     */
    async filterByStatus(filter) {
        const radares = await db.getRadares();

        if (filter === 'all') {
            this.renderRadares(radares);
        } else if (filter === 'per' || filter === 'educativo') {
            // Filter by tipo
            const filtered = radares.filter(r => r.tipo === filter);
            this.renderRadares(filtered);
        } else {
            // Filter by status
            const filtered = radares.filter(r => r.status === filter);
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
                            <label>Tipo do Radar</label>
                            <span class="radar-type-badge ${radar.tipo || ''}">${radar.tipo === 'per' ? '🚨 PER' : radar.tipo === 'educativo' ? '📚 Educativo' : 'N/A'}</span>
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
            document.getElementById('radar-tipo').value = radar.tipo || '';
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
                tipo: document.getElementById('radar-tipo').value,
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
                const photoCount = (checklist.photos || []).length;

                return `
                    <div class="checklist-card" data-id="${checklist.id}">
                        ${photoCount > 0 ? `
                            <div class="photo-count">
                                <span class="photo-count-icon">📸</span>
                                <span>${photoCount} ${photoCount === 1 ? 'foto' : 'fotos'}</span>
                            </div>
                        ` : ''}
                        
                        <div class="radar-card-header">
                            <span class="radar-km">Km ${radar?.km || 'N/A'}${radar?.sentido ? ' - ' + radar.sentido : ''}</span>
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
     * Filter checklists by search term
     */
    async filterChecklists(searchTerm) {
        const checklists = await db.getChecklists();
        const radares = await db.getRadares();
        const term = searchTerm.toLowerCase();

        const filtered = checklists.filter(checklist => {
            const radar = radares.find(r => r.id === checklist.radarId);
            const km = radar?.km || '';
            const date = this.formatDate(checklist.date);
            const status = this.getStatusLabel(checklist.status);

            return km.toString().toLowerCase().includes(term) ||
                date.toLowerCase().includes(term) ||
                status.toLowerCase().includes(term);
        });

        this.renderFilteredChecklists(filtered, radares);
    },

    /**
     * Filter checklists by status
     */
    async filterChecklistsByStatus(status) {
        const checklists = await db.getChecklists();
        const radares = await db.getRadares();

        if (status === 'all') {
            this.renderFilteredChecklists(checklists, radares);
        } else {
            const filtered = checklists.filter(c => c.status === status);
            this.renderFilteredChecklists(filtered, radares);
        }
    },

    /**
     * Render filtered checklists
     */
    renderFilteredChecklists(checklists, radares) {
        const container = document.getElementById('checklist-list');

        if (checklists.length === 0) {
            container.innerHTML = '<p class="empty-message">Nenhum checklist encontrado.</p>';
            return;
        }

        // Sort by date (newest first)
        checklists.sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = checklists.map(checklist => {
            const radar = radares.find(r => r.id === checklist.radarId);
            const photoCount = (checklist.photos || []).length;

            return `
                <div class="checklist-card" data-id="${checklist.id}">
                    ${photoCount > 0 ? `
                        <div class="photo-count">
                            <span class="photo-count-icon">📸</span>
                            <span>${photoCount} ${photoCount === 1 ? 'foto' : 'fotos'}</span>
                        </div>
                    ` : ''}
                    
                    <div class="radar-card-header">
                        <span class="radar-km">Km ${radar?.km || 'N/A'}${radar?.sentido ? ' - ' + radar.sentido : ''}</span>
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

        // Add click handlers
        container.querySelectorAll('.checklist-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                this.openChecklistDetails(id);
            });
        });
    },

    /**
     * Open checklist details modal for viewing/editing
     */
    async openChecklistDetails(checklistId) {
        try {
            const checklist = await db.getChecklist(checklistId);
            if (!checklist) {
                this.showToast('Checklist não encontrado', 'error');
                return;
            }

            const radar = await db.getRadar(checklist.radarId);

            this.currentEditingChecklistId = checklistId;

            // Set title
            document.getElementById('checklist-details-title').textContent =
                `Checklist - Km ${radar?.km || 'N/A'} - BR-040`;

            // Render radar info (readonly)
            document.getElementById('checklist-details-radar-info').innerHTML = `
                <div class="info-grid">
                    <div class="info-item">
                        <label>Velocidade:</label>
                        <span>${radar.velocidade} km/h</span>
                    </div>
                    <div class="info-item">
                        <label>Tipo Via:</label>
                        <span>${this.getTipoViaLabel(radar.tipoVia)}</span>
                    </div>
                    <div class="info-item">
                        <label>Município:</label>
                        <span>${radar.municipio || 'N/A'}</span>
                    </div>
                </div>
            `;

            // Render checklist data
            document.getElementById('checklist-details-data').innerHTML = `
                <div class="checklist-info-grid">
                    <div class="info-row">
                        <label>📅 Data:</label>
                        <span>${this.formatDate(checklist.date)}</span>
                    </div>
                    <div class="info-row">
                        <label>📏 Distância da Placa:</label>
                        <span>${checklist.distanciaPlaca || 'N/A'} metros</span>
                    </div>
                    <div class="info-row">
                        <label>✅ Status:</label>
                        <span class="status-badge ${checklist.status}">${this.getStatusLabel(checklist.status)}</span>
                    </div>
                    <div class="info-row">
                        <label>📋 Placa Presente:</label>
                        <span>${checklist.placaPresente ? '✅ Sim' : '❌ Não'}</span>
                    </div>
                    <div class="info-row">
                        <label>👁️ Placa Legível:</label>
                        <span>${checklist.placaLegivel ? '✅ Sim' : '❌ Não'}</span>
                    </div>
                    <div class="info-row">
                        <label>🎨 Pintura Solo:</label>
                        <span>${checklist.pinturaSolo ? '✅ Sim' : '❌ Não'}</span>
                    </div>
                    <div class="info-row">
                        <label>🚧 Sem Obstrução:</label>
                        <span>${checklist.semObstrucao ? '✅ Sim' : '❌ Não'}</span>
                    </div>
                    ${checklist.observacoes ? `
                    <div class="info-row full-width">
                        <label>📝 Observações:</label>
                        <p>${checklist.observacoes}</p>
                    </div>
                    ` : ''}
                </div>
            `;

            // Render checklist photos (EDITABLE with × button)
            camera.setPhotos(checklist.photos || [], 'checklist-edit');

            // Render radar photos (READONLY - no × button)
            this.renderRadarPhotosReadonly(radar.photos || []);

            // Open modal
            document.getElementById('modal-checklist-details').classList.add('open');

        } catch (error) {
            console.error('Error opening checklist details:', error);
            this.showToast('Erro ao abrir detalhes do checklist', 'error');
        }
    },

    /**
     * Render radar photos in readonly mode (no remove button)
     */
    renderRadarPhotosReadonly(photos) {
        const container = document.getElementById('checklist-radar-photos-readonly');
        if (!container) return;

        if (!photos || photos.length === 0) {
            container.innerHTML = '<p class="empty-message">Nenhuma foto cadastrada no radar</p>';
            return;
        }

        container.innerHTML = photos.map((photo, index) => `
            <div class="photo-preview-item readonly">
                <img src="${photo.data}" alt="Foto radar ${index + 1}">
                <div class="photo-label">Foto ${index + 1}</div>
            </div>
        `).join('');
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
     * Save checklist edits (photos only)
     */
    async saveChecklistEdit() {
        try {
            if (!this.currentEditingChecklistId) {
                this.showToast('Nenhum checklist em edição', 'error');
                return;
            }

            const currentChecklist = await db.getChecklist(this.currentEditingChecklistId);

            // Update only photos, keep other data
            const updatedChecklist = {
                ...currentChecklist,
                id: this.currentEditingChecklistId,
                photos: camera.getPhotos('checklist-edit'),
                updatedAt: new Date().toISOString()
            };

            await db.saveChecklist(updatedChecklist);

            this.closeAllModals();
            camera.clearPhotos('checklist-edit');
            this.showToast('Fotos do checklist atualizadas!', 'success');
            this.loadChecklists();
            if (this.currentView === 'dashboard') {
                this.loadDashboard();
            }

            this.currentEditingChecklistId = null;

        } catch (error) {
            console.error('Error saving checklist edit:', error);
            this.showToast('Erro ao salvar alterações', 'error');
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
     * Load export preview with filters
     */
    async loadExportPreview() {
        try {
            const allRadares = await db.getRadares();
            const container = document.getElementById('export-table-container');
            const countSpan = document.getElementById('export-count');
            const radarSelect = document.getElementById('export-filter-radar');
            const tipoFilter = document.getElementById('export-filter-tipo').value;
            const radarFilter = document.getElementById('export-filter-radar').value;

            // Populate radar dropdown (only on first load or when empty)
            if (radarSelect.options.length <= 1) {
                const sortedRadares = [...allRadares].sort((a, b) => parseFloat(a.km) - parseFloat(b.km));
                sortedRadares.forEach(radar => {
                    const option = document.createElement('option');
                    option.value = radar.id;
                    option.textContent = `Km ${radar.km} - ${radar.sentido || 'N/A'}${radar.tipo ? ` (${radar.tipo.toUpperCase()})` : ''}`;
                    radarSelect.appendChild(option);
                });
            }

            // Apply filters
            let filteredRadares = allRadares;

            // Filter by tipo
            if (tipoFilter !== 'all') {
                filteredRadares = filteredRadares.filter(r => r.tipo === tipoFilter);
            }

            // Filter by specific radar
            if (radarFilter !== 'all') {
                filteredRadares = filteredRadares.filter(r => r.id === radarFilter);
            }

            // Sort by km
            filteredRadares.sort((a, b) => parseFloat(a.km) - parseFloat(b.km));

            // Update count
            countSpan.textContent = `(${filteredRadares.length} radares)`;

            if (filteredRadares.length === 0) {
                container.innerHTML = '<p class="empty-message">Nenhum dado para exportar com os filtros selecionados.</p>';
                return;
            }

            container.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Km</th>
                            <th>Tipo</th>
                            <th>Velocidade</th>
                            <th>Município</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredRadares.map(radar => `
                            <tr>
                                <td>${radar.km}</td>
                                <td><span class="radar-type-badge ${radar.tipo || ''}">${radar.tipo === 'per' ? '🚨 PER' : radar.tipo === 'educativo' ? '📚 EDU' : '-'}</span></td>
                                <td>${radar.velocidade} km/h</td>
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
     * Get filtered radares based on export filters
     */
    async getFilteredRadaresForExport() {
        const allRadares = await db.getRadares();
        const tipoFilter = document.getElementById('export-filter-tipo').value;
        const radarFilter = document.getElementById('export-filter-radar').value;

        let filteredRadares = allRadares;

        if (tipoFilter !== 'all') {
            filteredRadares = filteredRadares.filter(r => r.tipo === tipoFilter);
        }

        if (radarFilter !== 'all') {
            filteredRadares = filteredRadares.filter(r => r.id === radarFilter);
        }

        return filteredRadares.sort((a, b) => parseFloat(a.km) - parseFloat(b.km));
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
     * Export to PDF with enhancements - Professional Report
     */
    async exportToPDF() {
        try {
            this.showToast('Gerando relatório profissional...', 'info');

            const radares = await this.getFilteredRadaresForExport();
            const checklists = await db.getChecklists();

            if (radares.length === 0) {
                this.showToast('Nenhum dado para exportar com os filtros selecionados', 'warning');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');
            const stats = await db.getStats();

            // ========================================
            // CAPA PROFISSIONAL
            // ========================================
            doc.setFontSize(28);
            doc.setTextColor(99, 102, 241);
            doc.text('Relatório de Fiscalização', 148, 50, { align: 'center' });
            doc.text('de Radares Eletrônicos', 148, 62, { align: 'center' });

            doc.setFontSize(20);
            doc.setTextColor(100);
            doc.text('BR-040', 148, 80, { align: 'center' });

            doc.setFontSize(12);
            doc.setTextColor(60);
            doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, 148, 95, { align: 'center' });
            doc.text(`Período Analisado: ${new Date().getFullYear()}`, 148, 103, { align: 'center' });
            doc.text('Responsável Técnico: Luis Pigrucci', 148, 118, { align: 'center' });

            // ========================================
            // RESUMO EXECUTIVO COM GRÁFICOS
            // ========================================
            doc.addPage();
            this.addPageFooter(doc, 2); // Page 2

            doc.setFontSize(18);
            doc.setTextColor(99, 102, 241);
            doc.text('Resumo Executivo', 14, 15);

            // Statistics boxes
            doc.setFontSize(11);
            doc.setTextColor(60);

            const boxWidth = 65;
            const boxHeight = 22;
            const startY = 25;

            // Total box
            doc.setFillColor(99, 102, 241);
            doc.roundedRect(14, startY, boxWidth, boxHeight, 3, 3, 'F');
            doc.setTextColor(255);
            doc.setFontSize(24);
            doc.text(stats.total.toString(), 14 + boxWidth / 2, startY + 12, { align: 'center' });
            doc.setFontSize(10);
            doc.text('Total de Radares', 14 + boxWidth / 2, startY + 18, { align: 'center' });

            // Conformes box
            doc.setFillColor(16, 185, 129);
            doc.roundedRect(84, startY, boxWidth, boxHeight, 3, 3, 'F');
            doc.setFontSize(24);
            doc.text(stats.conformes.toString(), 84 + boxWidth / 2, startY + 12, { align: 'center' });
            doc.setFontSize(10);
            doc.text('Conformes', 84 + boxWidth / 2, startY + 18, { align: 'center' });

            // Não Conformes box
            doc.setFillColor(239, 68, 68);
            doc.roundedRect(154, startY, boxWidth, boxHeight, 3, 3, 'F');
            doc.setFontSize(24);
            doc.text(stats.naoConformes.toString(), 154 + boxWidth / 2, startY + 12, { align: 'center' });
            doc.setFontSize(10);
            doc.text('Não Conformes', 154 + boxWidth / 2, startY + 18, { align: 'center' });

            // Pendentes box
            doc.setFillColor(245, 158, 11);
            doc.roundedRect(224, startY, boxWidth, boxHeight, 3, 3, 'F');
            doc.setFontSize(24);
            doc.text(stats.pendentes.toString(), 224 + boxWidth / 2, startY + 12, { align: 'center' });
            doc.setFontSize(10);
            doc.text('Pendentes', 224 + boxWidth / 2, startY + 18, { align: 'center' });

            // Visual graph - % distribution
            const graphY = 55;
            const totalChecked = stats.conformes + stats.naoConformes;
            if (totalChecked > 0) {
                const conformePercent = (stats.conformes / totalChecked) * 100;
                const naoConformePercent = (stats.naoConformes / totalChecked) * 100;

                doc.setFontSize(14);
                doc.setTextColor(60);
                doc.text('Distribuição de Conformidade', 14, graphY);

                // Bar graph
                const barWidth = 275;
                const barHeight = 25;
                const barY = graphY + 5;

                // Conforme bar
                const conformeWidth = (conformePercent / 100) * barWidth;
                doc.setFillColor(16, 185, 129);
                doc.rect(14, barY, conformeWidth, barHeight, 'F');

                // Não Conforme bar
                doc.setFillColor(239, 68, 68);
                doc.rect(14 + conformeWidth, barY, barWidth - conformeWidth, barHeight, 'F');

                // Labels
                doc.setTextColor(255);
                doc.setFontSize(12);
                if (conformePercent > 15) {
                    doc.text(`${conformePercent.toFixed(1)}%`, 14 + conformeWidth / 2, barY + 16, { align: 'center' });
                }
                if (naoConformePercent > 15) {
                    doc.text(`${naoConformePercent.toFixed(1)}%`, 14 + conformeWidth + (barWidth - conformeWidth) / 2, barY + 16, { align: 'center' });
                }
            }

            // Key findings
            doc.setFontSize(14);
            doc.setTextColor(60);
            doc.text('Principais Achados', 14, 95);

            doc.setFontSize(10);
            doc.text(`• Total de ${checklists.length} verificações realizadas`, 14, 105);
            doc.text(`• Taxa de conformidade: ${totalChecked > 0 ? ((stats.conformes / totalChecked) * 100).toFixed(1) : 0}%`, 14, 112);
            doc.text(`• ${stats.pendentes} radares aguardando verificação`, 14, 119);

            const radaresComFotos = radares.filter(r => r.photos && r.photos.length > 0).length;
            doc.text(`• ${radaresComFotos} radares com registro fotográfico`, 14, 126);

            // ========================================
            // TABELA MELHORADA COM MAIS COLUNAS
            // ========================================
            doc.addPage();
            this.addPageFooter(doc, 3);

            doc.setFontSize(16);
            doc.setTextColor(99, 102, 241);
            doc.text('Inventário Completo de Radares', 14, 15);

            // Sort radares by km
            const sortedRadares = [...radares].sort((a, b) => {
                const kmA = parseFloat(String(a.km).replace('+', '.').replace(/[^\d.]/g, ''));
                const kmB = parseFloat(String(b.km).replace('+', '.').replace(/[^\d.]/g, ''));
                return kmA - kmB;
            });

            // Enhanced table data with more columns
            const tableData = sortedRadares.map(radar => {
                const radarChecklists = checklists.filter(c => c.radarId === radar.id);
                const lastChecklist = radarChecklists.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

                let classificacao = 'RURAL';
                if (radar.tipoVia === 'rural-urbana') classificacao = 'RCU';
                else if (radar.tipoVia === 'urbana') classificacao = 'URBANA';

                const photoCount = (radar.photos?.length || 0) + (lastChecklist?.photos?.length || 0);

                return [
                    `Km ${radar.km}`,
                    radar.municipio || 'N/A',
                    radar.tipoRadar || 'PER',
                    `${radar.velocidade || 60}`,
                    classificacao,
                    radar.sentido || '-',
                    lastChecklist?.distanciaPlaca ? `${lastChecklist.distanciaPlaca}m` : '-',
                    lastChecklist ? this.formatDate(lastChecklist.date) : '-',
                    radarChecklists.length.toString(),
                    this.getStatusLabel(radar.status),
                    photoCount > 0 ? photoCount.toString() : '-'
                ];
            });

            doc.autoTable({
                startY: 22,
                head: [['Local', 'Município', 'Tipo', 'Vel.', 'Class.', 'Sent.', 'Dist.', 'Últ. Verif.', 'Checks', 'Status', 'Fotos']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [99, 102, 241],
                    textColor: 255,
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                bodyStyles: {
                    fontSize: 7,
                    cellPadding: 2
                },
                alternateRowStyles: { fillColor: [245, 245, 250] },
                columnStyles: {
                    0: { cellWidth: 22 },  // Local
                    1: { cellWidth: 24 },  // Município (reduzido 28->24)
                    2: { cellWidth: 16 },  // Tipo
                    3: { cellWidth: 12 },  // Vel
                    4: { cellWidth: 16 },  // Class
                    5: { cellWidth: 14 },  // Sent
                    6: { cellWidth: 14 },  // Dist
                    7: { cellWidth: 27 },  // Últ. Verif (aumentado 22->27)
                    8: { cellWidth: 16 },  // Checks
                    9: { cellWidth: 22 },  // Status (reduzido 24->22)
                    10: { cellWidth: 14 }, // Fotos
                },
                didDrawPage: (data) => {
                    // Adicionar rodapé em cada página da tabela
                    const pageCount = doc.internal.getNumberOfPages();
                    this.addPageFooter(doc, doc.internal.getCurrentPageInfo().pageNumber);
                }
            });

            // ========================================
            // PÁGINAS DETALHADAS COM FOTOS EM GRID 2x2
            // ========================================
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
                const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
                this.addPageFooter(doc, currentPage);

                // Radar header
                doc.setFontSize(16);
                doc.setTextColor(99, 102, 241);
                doc.text(`Km ${radar.km} - BR-040`, 14, 15);

                doc.setFontSize(9);
                doc.setTextColor(60);

                let classificacao = 'RURAL';
                if (radar.tipoVia === 'rural-urbana') classificacao = 'RCU';
                else if (radar.tipoVia === 'urbana') classificacao = 'URBANA';

                doc.text(`Tipo: ${radar.tipoRadar || 'PER'} | Velocidade: ${radar.velocidade || 60} km/h | Classificação: ${classificacao}`, 14, 22);
                doc.text(`Sentido: ${radar.sentido || 'N/A'} | Município: ${radar.municipio || 'N/A'}`, 14, 27);

                if (lastChecklist) {
                    doc.text(`Última Verificação: ${this.formatDate(lastChecklist.date)} | Status: ${this.getStatusLabel(lastChecklist.status)}`, 14, 32);
                }

                // Observações (última linha das informações do radar)
                let nextY = lastChecklist ? 37 : 32;
                if (radar.descricao || lastChecklist?.observacoes) {
                    doc.setFontSize(8);
                    doc.setTextColor(80);
                    const obs = radar.descricao || lastChecklist?.observacoes || '';
                    const splitObs = doc.splitTextToSize(obs, 275);
                    // Limitar a 2 linhas para não ocupar muito espaço
                    const limitedObs = splitObs.slice(0, 2);
                    doc.text(`Observações: ${limitedObs.join(' ')}`, 14, nextY);
                    nextY += 5;
                }

                // GRID 2x2 DE FOTOS (economiza páginas!)
                const gridCols = 2;
                const gridRows = 2;
                const photosPerPage = gridCols * gridRows; // 4 fotos por página

                const imgWidth = 125;  // Reduzido para caber na página
                const imgHeight = 70;  // Reduzido de 80 para 70 para não sobrepor rodapé
                const marginX = 14;
                const marginY = 38;
                const gapX = 8;
                const gapY = 6;

                for (let i = 0; i < allPhotos.length; i += photosPerPage) {
                    if (i > 0) {
                        doc.addPage();
                        const newPage = doc.internal.getCurrentPageInfo().pageNumber;
                        this.addPageFooter(doc, newPage);

                        // Repeat header on continuation page
                        doc.setFontSize(14);
                        doc.setTextColor(99, 102, 241);
                        doc.text(`Km ${radar.km} (continuação)`, 14, 15);
                    }

                    // Draw grid of photos
                    const pagePhotos = allPhotos.slice(i, i + photosPerPage);

                    pagePhotos.forEach((photo, index) => {
                        const row = Math.floor(index / gridCols);
                        const col = index % gridCols;

                        const x = marginX + col * (imgWidth + gapX);
                        const y = (i > 0 ? 22 : marginY) + row * (imgHeight + gapY);

                        try {
                            doc.addImage(photo.data, 'JPEG', x, y, imgWidth, imgHeight);

                            // Photo label
                            doc.setFontSize(8);
                            doc.setTextColor(255);
                            doc.setFillColor(0, 0, 0, 0.7);
                            doc.rect(x, y + imgHeight - 8, imgWidth, 8, 'F');
                            doc.text(`Foto ${i + index + 1}`, x + imgWidth / 2, y + imgHeight - 3, { align: 'center' });
                        } catch (err) {
                            console.error('Error adding photo:', err);
                        }
                    });
                }

                // Observations (se houver espaço na página)
                if (radar.descricao || lastChecklist?.observacoes) {
                    const obsY = marginY + 2 * (imgHeight + gapY) + 5;

                    // Se não houver espaço suficiente (menos de 15px até rodapé), adicionar nova página
                    if (false) { // DESABILITADO: Observações nunca vão para nova página
                        doc.addPage();
                        this.addPageFooter(doc, doc.internal.getCurrentPageInfo().pageNumber);
                        doc.setFontSize(14);
                        doc.setTextColor(99, 102, 241);
                        doc.text(`Km ${radar.km} - Observações`, 14, 15);

                        doc.setFontSize(10);
                        doc.setTextColor(60);
                        doc.text('Observações:', 14, 25);
                        doc.setFontSize(9);
                        const obs = radar.descricao || lastChecklist?.observacoes || '';
                        const splitObs = doc.splitTextToSize(obs, 275);
                        doc.text(splitObs, 14, 32);
                    } // else removido: Observações aparecem apenas no cabeçalho
                }
            }

            // Add total page count to all pages (canto direito)
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(9);
                doc.setTextColor(120);
                doc.text(`Página ${i} de ${totalPages}`, 282, 200, { align: 'right' });
            }

            // Save PDF
            const fileName = `Relatorio_Radares_BR040_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            this.showToast('Relatório profissional exportado com sucesso!', 'success');

        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showToast('Erro ao exportar PDF: ' + error.message, 'error');
        }
    },

    /**
     * Add professional footer to PDF page
     */
    addPageFooter(doc, pageNumber) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Relatório gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 200);
        doc.text('BR-040 - Sistema de Fiscalização de Radares', 148, 200, { align: 'center' });
        // Page number will be added at the end with total count
    },

    /**
     * Open lightbox with image preview
     */
    openLightbox(photos, currentIndex) {
        this.lightboxPhotos = photos;
        this.lightboxCurrentIndex = currentIndex;

        const modal = document.getElementById('lightbox-modal');
        const img = document.getElementById('lightbox-image');
        const caption = modal.querySelector('.lightbox-caption');

        img.src = photos[currentIndex].data;
        caption.textContent = `Foto ${currentIndex + 1} de ${photos.length}`;

        modal.classList.add('open');
    },

    /**
     * Navigate lightbox (previous/next)
     */
    navigateLightbox(direction) {
        const newIndex = this.lightboxCurrentIndex + direction;

        if (newIndex >= 0 && newIndex < this.lightboxPhotos.length) {
            this.lightboxCurrentIndex = newIndex;

            const img = document.getElementById('lightbox-image');
            const caption = document.querySelector('.lightbox-caption');

            img.src = this.lightboxPhotos[newIndex].data;
            caption.textContent = `Foto ${newIndex + 1} de ${this.lightboxPhotos.length}`;
        }
    },

    /**
     * Close lightbox
     */
    closeLightbox() {
        document.getElementById('lightbox-modal').classList.remove('open');
    },

    /**
     * Setup lightbox event listeners
     */
    setupLightbox() {
        // Close button
        const closeBtn = document.querySelector('.lightbox-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeLightbox();
            });
        }

        // Navigation buttons
        const prevBtn = document.querySelector('.lightbox-prev');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.navigateLightbox(-1);
            });
        }

        const nextBtn = document.querySelector('.lightbox-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.navigateLightbox(1);
            });
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('lightbox-modal');
            if (modal && modal.classList.contains('open')) {
                if (e.key === 'Escape') {
                    this.closeLightbox();
                }
                // Arrow keys for navigation
                if (e.key === 'ArrowLeft') this.navigateLightbox(-1);
                if (e.key === 'ArrowRight') this.navigateLightbox(1);
            }
        });

        // Click outside to close
        const modal = document.getElementById('lightbox-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.id === 'lightbox-modal') {
                    this.closeLightbox();
                }
            });
        }
    },


    /**
     * Export to Excel with photos report
     */
    async exportToExcel() {
        try {
            this.showToast('Gerando Excel e relatório de fotos...', 'info');

            const radares = await this.getFilteredRadaresForExport();
            const checklists = await db.getChecklists();

            if (radares.length === 0) {
                this.showToast('Nenhum dado para exportar com os filtros selecionados', 'warning');
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
