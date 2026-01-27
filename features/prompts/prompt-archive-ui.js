// prompt-archive-ui.js
// UI components for the prompt archive system

import { NemoPromptArchive } from './prompt-archive.js';

export const NemoPromptArchiveUI = {
    initialized: false,
    
    initialize: function() {
        if (this.initialized) return;
        
        // Initialize the archive system first
        NemoPromptArchive.initialize();
        
        // Add archive UI to prompt manager
        this.injectArchiveUI();
        
        this.initialized = true;
    },

    injectArchiveUI: function() {
        // Wait for prompt manager to be available
        const checkPromptManager = setInterval(() => {
            const promptContainer = document.querySelector('#completion_prompt_manager_list');
            if (promptContainer && !document.querySelector('#nemo-prompt-archive-section')) {
                clearInterval(checkPromptManager);
                this.createArchiveSection();
            }
        }, 1000);
    },

    createArchiveSection: function() {
        // Find a good place to inject the archive UI
        const promptManagerContainer = document.querySelector('#completion_prompt_manager_list').parentElement;
        
        // Create archive section
        const archiveSection = document.createElement('details');
        archiveSection.id = 'nemo-prompt-archive-section';
        archiveSection.className = 'nemo-engine-section';
        archiveSection.innerHTML = `
            <summary>
                <span style="color: var(--nemo-primary-accent); font-weight: bold;">
                    📁 Prompt Archive
                </span>
                <div class="nemo-right-controls-wrapper">
                    <button class="menu_button nemo-section-master-toggle" id="nemo-create-archive-btn" title="Create new archive">
                        <i class="fa-solid fa-plus"></i> Create Archive
                    </button>
                    <button class="menu_button" id="nemo-import-archive-btn" title="Import archive from file">
                        <i class="fa-solid fa-file-import"></i> Import
                    </button>
                </div>
            </summary>
            <div class="nemo-section-content">
                <div id="nemo-archive-stats" style="margin-bottom: 15px; padding: 10px; background: var(--nemo-tertiary-bg); border-radius: 6px; font-size: 0.9em;">
                    <div id="nemo-archive-stats-content">Loading archive statistics...</div>
                </div>
                <div id="nemo-archive-list">
                    <!-- Archive items will be populated here -->
                </div>
            </div>
        `;
        
        // Insert before the prompt list
        promptManagerContainer.insertBefore(archiveSection, promptManagerContainer.firstChild);
        
        // Set up event listeners
        this.setupArchiveEventListeners();
        
        // Populate with existing archives
        this.refreshArchiveList();
        this.updateArchiveStats();
    },

    setupArchiveEventListeners: function() {
        // Create archive button
        document.getElementById('nemo-create-archive-btn').addEventListener('click', () => {
            this.showCreateArchiveDialog();
        });
        
        // Import archive button
        document.getElementById('nemo-import-archive-btn').addEventListener('click', () => {
            this.showImportArchiveDialog();
        });
    },

    showCreateArchiveDialog: function() {
        const name = prompt('Enter archive name:');
        if (!name || !name.trim()) return;
        
        const description = prompt('Enter archive description (optional):') || '';
        
        const archiveId = NemoPromptArchive.createArchive(name.trim(), description.trim());
        if (archiveId) {
            this.refreshArchiveList();
            this.updateArchiveStats();
            this.showNotification(`Archive "${name}" created successfully!`, 'success');
        } else {
            this.showNotification('Failed to create archive', 'error');
        }
    },

    showImportArchiveDialog: function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const archiveId = NemoPromptArchive.importArchive(e.target.result);
                    if (archiveId) {
                        this.refreshArchiveList();
                        this.updateArchiveStats();
                        this.showNotification('Archive imported successfully!', 'success');
                    } else {
                        this.showNotification('Failed to import archive', 'error');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    },

    refreshArchiveList: function() {
        const listContainer = document.getElementById('nemo-archive-list');
        if (!listContainer) return;
        
        const archives = NemoPromptArchive.getAllArchives();
        
        if (archives.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--nemo-text-muted); font-style: italic;">
                    No archives created yet. Click "Create Archive" to save your current prompts.
                </div>
            `;
            return;
        }
        
        listContainer.innerHTML = archives.map(archive => this.createArchiveItem(archive)).join('');
        
        // Add event listeners for archive items
        this.setupArchiveItemListeners();
    },

    createArchiveItem: function(archive) {
        const date = new Date(archive.timestamp).toLocaleString();
        const { totalPrompts, totalSystemPrompts } = archive.metadata;
        
        // Create lists of individual prompts and system prompts
        const promptsList = this.createPromptsList(archive);
        const systemPromptsList = this.createSystemPromptsList(archive);
        
        return `
            <div class="nemo-archive-item" data-archive-id="${archive.id}">
                <div class="nemo-archive-header">
                    <div class="nemo-archive-title">
                        <strong>${this.escapeHtml(archive.name)}</strong>
                        <span class="nemo-archive-date">${date}</span>
                    </div>
                    <div class="nemo-archive-actions">
                        <button class="menu_button nemo-archive-toggle" title="Show/hide archive contents">
                            <i class="fa-solid fa-chevron-down"></i> Details
                        </button>
                        <button class="menu_button nemo-archive-restore" title="Restore entire archive">
                            <i class="fa-solid fa-undo"></i> Restore All
                        </button>
                        <button class="menu_button nemo-archive-merge" title="Merge with current prompts">
                            <i class="fa-solid fa-code-merge"></i> Merge All
                        </button>
                        <button class="menu_button nemo-archive-export" title="Export to file">
                            <i class="fa-solid fa-download"></i> Export
                        </button>
                        <button class="menu_button nemo-archive-delete redWarningBG" title="Delete archive">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
                <div class="nemo-archive-info">
                    ${archive.description ? `<div class="nemo-archive-description">${this.escapeHtml(archive.description)}</div>` : ''}
                    <div class="nemo-archive-stats">
                        <span class="nemo-stat"><i class="fa-solid fa-comments"></i> ${totalPrompts} prompts</span>
                        <span class="nemo-stat"><i class="fa-solid fa-cog"></i> ${totalSystemPrompts} system prompts</span>
                    </div>
                </div>
                <div class="nemo-archive-contents" style="display: none;">
                    ${promptsList}
                    ${systemPromptsList}
                </div>
            </div>
        `;
    },

    createPromptsList: function(archive) {
        if (!archive.promptData.prompts || archive.promptData.prompts.length === 0) {
            return '';
        }

        const promptItems = archive.promptData.prompts.map(prompt => `
            <div class="nemo-prompt-item" data-prompt-id="${prompt.identifier}" data-archive-id="${archive.id}">
                <div class="nemo-prompt-info">
                    <span class="nemo-prompt-name">${this.escapeHtml(prompt.name || prompt.identifier)}</span>
                    <span class="nemo-prompt-role">${prompt.role || 'user'}</span>
                </div>
                <div class="nemo-prompt-preview">${this.escapeHtml(prompt.content ? prompt.content.substring(0, 100) : '').trim()}${prompt.content && prompt.content.length > 100 ? '...' : ''}</div>
            </div>
        `).join('');

        return `
            <div class="nemo-prompts-section">
                <h4><i class="fa-solid fa-comments"></i> Prompts</h4>
                <div class="nemo-prompts-list">
                    ${promptItems}
                </div>
            </div>
        `;
    },

    createSystemPromptsList: function(archive) {
        if (!archive.systemPromptData || archive.systemPromptData.length === 0) {
            return '';
        }

        const systemPromptItems = archive.systemPromptData.map(prompt => `
            <div class="nemo-system-prompt-item" data-prompt-name="${prompt.name}" data-archive-id="${archive.id}">
                <div class="nemo-prompt-info">
                    <span class="nemo-prompt-name">${this.escapeHtml(prompt.name)}</span>
                    <span class="nemo-prompt-role">system</span>
                </div>
                <div class="nemo-prompt-preview">${this.escapeHtml(prompt.content ? prompt.content.substring(0, 100) : '').trim()}${prompt.content && prompt.content.length > 100 ? '...' : ''}</div>
            </div>
        `).join('');

        return `
            <div class="nemo-system-prompts-section">
                <h4><i class="fa-solid fa-cog"></i> System Prompts</h4>
                <div class="nemo-system-prompts-list">
                    ${systemPromptItems}
                </div>
            </div>
        `;
    },

    setupArchiveItemListeners: function() {
        // Toggle archive details
        document.querySelectorAll('.nemo-archive-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const archiveItem = e.target.closest('.nemo-archive-item');
                const contentsDiv = archiveItem.querySelector('.nemo-archive-contents');
                const icon = btn.querySelector('i');
                
                if (contentsDiv.style.display === 'none') {
                    contentsDiv.style.display = 'block';
                    icon.className = 'fa-solid fa-chevron-up';
                    // Set up event listeners for the newly visible prompt items
                    this.setupPromptItemListeners(archiveItem);
                } else {
                    contentsDiv.style.display = 'none';
                    icon.className = 'fa-solid fa-chevron-down';
                }
            });
        });
        
        // Restore archive
        document.querySelectorAll('.nemo-archive-restore').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const archiveId = e.target.closest('.nemo-archive-item').dataset.archiveId;
                this.confirmRestore(archiveId, false);
            });
        });
        
        // Merge archive
        document.querySelectorAll('.nemo-archive-merge').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const archiveId = e.target.closest('.nemo-archive-item').dataset.archiveId;
                this.confirmRestore(archiveId, true);
            });
        });
        
        // Export archive
        document.querySelectorAll('.nemo-archive-export').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const archiveId = e.target.closest('.nemo-archive-item').dataset.archiveId;
                NemoPromptArchive.exportArchive(archiveId);
            });
        });
        
        // Delete archive
        document.querySelectorAll('.nemo-archive-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const archiveId = e.target.closest('.nemo-archive-item').dataset.archiveId;
                this.confirmDelete(archiveId);
            });
        });

    },

    setupPromptItemListeners: function(archiveItem) {
        // Set up right-click context menu for individual prompts within this archive item
        const promptItems = archiveItem.querySelectorAll('.nemo-prompt-item');
        const systemPromptItems = archiveItem.querySelectorAll('.nemo-system-prompt-item');

        // Right-click context menu for individual prompts
        promptItems.forEach(item => {
            // Remove any existing listeners to avoid duplicates
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            // Add a visual indicator that these are interactive
            newItem.title = 'Right-click to add this prompt to current preset';
            
            newItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const archiveId = newItem.dataset.archiveId;
                const promptId = newItem.dataset.promptId;
                this.showPromptContextMenu(e, archiveId, promptId, 'prompt');
            });

            // Also add regular click handler as fallback
            newItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const archiveId = newItem.dataset.archiveId;
                const promptId = newItem.dataset.promptId;
                this.showPromptContextMenu(e, archiveId, promptId, 'prompt');
            });
        });

        // Right-click context menu for individual system prompts
        systemPromptItems.forEach(item => {
            // Remove any existing listeners to avoid duplicates
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            // Add a visual indicator that these are interactive
            newItem.title = 'Right-click to add this system prompt to current preset';
            
            newItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const archiveId = newItem.dataset.archiveId;
                const promptName = newItem.dataset.promptName;
                this.showPromptContextMenu(e, archiveId, promptName, 'system');
            });

            // Also add regular click handler as fallback
            newItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const archiveId = newItem.dataset.archiveId;
                const promptName = newItem.dataset.promptName;
                this.showPromptContextMenu(e, archiveId, promptName, 'system');
            });
        });
    },

    confirmRestore: function(archiveId, mergeMode) {
        const archive = NemoPromptArchive.getArchive(archiveId);
        if (!archive) return;
        
        const action = mergeMode ? 'merge with' : 'replace';
        const promptCount = archive.metadata.totalPrompts || 0;
        const systemPromptCount = archive.metadata.totalSystemPrompts || 0;
        
        const message = `Are you sure you want to ${action} your current prompts with "${archive.name}"?\n\n` +
                       `This archive contains:\n• ${promptCount} prompts\n• ${systemPromptCount} system prompts\n\n` +
                       (mergeMode ? 'These will be added to your current setup.' : 'This will replace all your current prompts!');
        
        if (confirm(message)) {
            // Show loading notification
            this.showNotification('Restoring archive...', 'info');
            
            // Add a slight delay to show loading notification
            setTimeout(() => {
                const success = NemoPromptArchive.restoreArchive(archiveId, {
                    restorePrompts: true,
                    restoreSystemPrompts: true,
                    mergeMode: mergeMode
                });
                
                if (success) {
                    this.showNotification(
                        `✅ Archive "${archive.name}" ${mergeMode ? 'merged' : 'restored'} successfully!\n\n` +
                        `📝 ${promptCount} prompts added to active prompt arrays\n` +
                        `⚙️ ${systemPromptCount} system prompts processed\n\n` +
                        `Prompts are now available in the prompt manager and will be used in chat completion.`,
                        'success'
                    );
                } else {
                    this.showNotification(
                        `❌ Archive restoration had issues. Some prompts may not have been restored correctly.\n\n` +
                        `Check the browser console (F12) for detailed error information.`,
                        'error'
                    );
                }
            }, 100);
        }
    },

    confirmDelete: function(archiveId) {
        const archive = NemoPromptArchive.getArchive(archiveId);
        if (!archive) return;
        
        if (confirm(`Are you sure you want to delete the archive "${archive.name}"?\n\nThis action cannot be undone.`)) {
            if (NemoPromptArchive.deleteArchive(archiveId)) {
                this.refreshArchiveList();
                this.updateArchiveStats();
                this.showNotification(`Archive "${archive.name}" deleted`, 'success');
            } else {
                this.showNotification('Failed to delete archive', 'error');
            }
        }
    },

    updateArchiveStats: function() {
        const statsContainer = document.getElementById('nemo-archive-stats-content');
        if (!statsContainer) return;
        
        const stats = NemoPromptArchive.getArchiveStats();
        
        if (stats.totalArchives === 0) {
            statsContainer.innerHTML = '📁 No archives created yet';
            return;
        }
        
        statsContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; text-align: center;">
                <div><strong>${stats.totalArchives}</strong><br><small>Archives</small></div>
                <div><strong>${stats.totalPrompts}</strong><br><small>Total Prompts</small></div>
                <div><strong>${stats.totalSystemPrompts}</strong><br><small>System Prompts</small></div>
                <div><strong>${stats.newestArchive ? new Date(stats.newestArchive.timestamp).toLocaleDateString() : 'N/A'}</strong><br><small>Latest Archive</small></div>
            </div>
        `;
    },

    showNotification: function(message, type = 'info') {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    },

    showPromptContextMenu: function(event, archiveId, promptIdentifier, type) {
        // Remove any existing context menu
        this.removeContextMenu();
        
        const menu = document.createElement('div');
        menu.className = 'nemo-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${event.clientY}px;
            left: ${event.clientX}px;
            background: var(--nemo-secondary-bg, #2a2a2a);
            border: 1px solid var(--nemo-border-color, #444);
            border-radius: 6px;
            padding: 5px 0;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 180px;
        `;
        
        const addToCurrentOption = document.createElement('div');
        addToCurrentOption.className = 'nemo-context-menu-item';
        addToCurrentOption.style.cssText = `
            padding: 8px 15px;
            cursor: pointer;
            color: white;
            font-size: 14px;
            transition: background-color 0.2s;
        `;
        addToCurrentOption.innerHTML = `<i class="fa-solid fa-plus"></i> Add to Current Preset`;
        
        addToCurrentOption.addEventListener('mouseover', () => {
            addToCurrentOption.style.backgroundColor = 'var(--nemo-primary-accent, #4CAF50)';
        });
        
        addToCurrentOption.addEventListener('mouseout', () => {
            addToCurrentOption.style.backgroundColor = 'transparent';
        });
        
        addToCurrentOption.addEventListener('click', () => {
            this.addSinglePromptToPreset(archiveId, promptIdentifier, type);
            this.removeContextMenu();
        });

        menu.appendChild(addToCurrentOption);
        document.body.appendChild(menu);

        // Remove menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', this.removeContextMenu.bind(this), { once: true });
        }, 10);
    },

    removeContextMenu: function() {
        const existing = document.querySelector('.nemo-context-menu');
        if (existing) {
            existing.remove();
        }
    },

    addSinglePromptToPreset: function(archiveId, promptIdentifier, type) {
        let success = false;
        let promptName = promptIdentifier;
        
        if (type === 'prompt') {
            success = NemoPromptArchive.addPromptToCurrentPreset(archiveId, promptIdentifier);
            // Get the actual prompt name for display
            const archive = NemoPromptArchive.getArchive(archiveId);
            if (archive) {
                const prompt = archive.promptData.prompts.find(p => p.identifier === promptIdentifier);
                if (prompt) {
                    promptName = prompt.name || prompt.identifier;
                }
            }
        } else if (type === 'system') {
            success = NemoPromptArchive.addSystemPromptToCurrentPreset(archiveId, promptIdentifier);
            promptName = promptIdentifier; // For system prompts, identifier is the name
        }
        
        if (success) {
            this.showNotification(
                `✅ Successfully added "${promptName}" to current preset!\n\n` +
                `The prompt is now available in your prompt manager and will be used in chat completion.`,
                'success'
            );
        } else {
            this.showNotification(
                `⚠️ Could not add "${promptName}" to current preset.\n\n` +
                `It may already exist or there was an error. Check the console for details.`,
                'error'
            );
        }
    },

    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};