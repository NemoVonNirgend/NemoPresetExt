// extensions-tab-overhaul.js
// Enhanced extensions tab with full-screen views and folder management

import { LOG_PREFIX } from '../core/utils.js';
import { extension_settings } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../script.js';

export const ExtensionsTabOverhaul = {
    initialized: false,
    currentView: 'main', // 'main' or 'fullscreen'
    currentExtension: null,
    customFolders: {},
    extensionTags: {},
    originalExtensions: [], // Store original extension elements
    
    // Define default categories for extensions
    defaultCategories: {
        'Core': ['assets_container'],
        'Image': ['sd_container', 'expressions_container', 'caption_container', 'live2d_container', 'vrm_container'],
        'Audio': ['tts_container', 'rvc_container', 'stt_container', 'audio_container', 'silence_container'],
        'Memory': ['summarize_container', 'vectors_container', 'chromadb_container', 'qvink_memory_settings', 'vectors_enhanced_container'],
        'Utilities': ['websearch_container', 'regex_container', 'randomizer_container', 'message_limit_container', 'injects_container', 'accuweather_container', 'blip_container', 'emulatorjs_container', 'qr_container', 'translation_container', 'idle_container', 'hypebot_container', 'rss_container', 'timelines_container', 'webllm_container'],
        'NemoSuite': [
            'nemo-ext-prose-polisher',
            'nemo-ext-nemopreset-ui',
            'nemo-ext-nemopreset-ui-extensions',
            'nemo-ext-ember'
        ],
        'UI & Themes': ['SillyTavernMoonlitEchoesTheme-drawer', 'rewrite-extension-settings', 'loremanager_settings', 'noass_settings', 'stsc--settings', 'charCreator_settings', 'weatherpack-settings', 'worldInfoRecommender_settings', 'lootTipEnabled', 'example-extension-settings'],
    },

    initialize: function() {
        if (this.initialized) return;
        
        // Load saved settings
        this.loadSettings();
        
        const pollForExtensions = setInterval(() => {
            const extensionsContainer1 = document.getElementById('extensions_settings');
            const extensionsContainer2 = document.getElementById('extensions_settings2');
            
            // Wait for both containers to exist and have extensions loaded
            const container1Children = extensionsContainer1 ? extensionsContainer1.children.length : 0;
            const container2Children = extensionsContainer2 ? extensionsContainer2.children.length : 0;
            const totalExtensions = container1Children + container2Children;
            
            console.log(`${LOG_PREFIX} Checking extensions: container1=${container1Children}, container2=${container2Children}, total=${totalExtensions}`);
            
            if (extensionsContainer1 && totalExtensions > 0) {
                clearInterval(pollForExtensions);
                setTimeout(() => {
                    this.setupTabExtensionView();
                    this.createEnhancedInterface(extensionsContainer1);
                    this.setupEventListeners();
                    this.initialized = true;
                    console.log(`${LOG_PREFIX} Enhanced Extensions Tab initialized with ${totalExtensions} extensions`);
                }, 500);
            }
        }, 1000);
    },

    loadSettings: function() {
        const settings = extension_settings.NemoPresetExt?.extensionOverhaul || {};
        this.customFolders = settings.customFolders || {};
        this.extensionTags = settings.extensionTags || {};
    },

    saveSettings: function() {
        if (!extension_settings.NemoPresetExt) {
            extension_settings.NemoPresetExt = {};
        }
        extension_settings.NemoPresetExt.extensionOverhaul = {
            customFolders: this.customFolders,
            extensionTags: this.extensionTags
        };
        saveSettingsDebounced();
        
        console.log(`${LOG_PREFIX} Settings saved:`, {
            customFolders: Object.keys(this.customFolders),
            extensionTags: this.extensionTags
        });
    },

    setupTabExtensionView: function() {
        // Create tab-contained extension view
        const extensionsContainer = document.getElementById('extensions_settings');
        const overlay = document.createElement('div');
        overlay.id = 'nemo-tab-extension-overlay';
        overlay.className = 'nemo-tab-extension-view';
        overlay.innerHTML = `
            <div class="nemo-extension-view-header">
                <button class="nemo-back-button" id="nemo-back-to-main">
                    <i class="fa-solid fa-arrow-left"></i>
                    Back to Extensions
                </button>
                <div class="nemo-extension-title" id="nemo-current-extension-title">Extension Settings</div>
            </div>
            <div class="nemo-extension-view-content" id="nemo-extension-view-content">
                <!-- Extension content will be moved here -->
            </div>
        `;
        // Insert at the beginning of the container so it appears at the top
        extensionsContainer.insertBefore(overlay, extensionsContainer.firstChild);
    },

    discoverExtensions: function() {
        const extensions = [];
        const containers = document.querySelectorAll('#extensions_settings > *, #extensions_settings2 > *');
        
        console.log(`${LOG_PREFIX} Found ${containers.length} potential extension containers`);
        
        containers.forEach(container => {
            // Skip our own UI elements (but NOT the main settings panel)
            if (container.id === 'nemo-suite-drawer' ||
                container.id === 'nemo-tab-extension-overlay' ||
                container.classList.contains('nemo-extensions-search') ||
                container.classList.contains('nemo-extensions-layout') ||
                container.classList.contains('nemo-folder-controls')) {
                return;
            }

            let id = container.id;
            const titleElement = container.querySelector('.inline-drawer-header b, h4, .extension-name, [data-extension-name]');
            let title = 'Unknown Extension';
            
            if (titleElement) {
                title = titleElement.textContent.trim();
            } else if (container.dataset.extensionName) {
                title = container.dataset.extensionName;
            } else if (id) {
                title = id.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }

            if (!id) {
                id = `nemo-ext-${title.replace(/\s+/g, '-').toLowerCase()}`;
                container.id = id;
            }
            
            console.log(`${LOG_PREFIX} Discovered extension:`, { id, title, className: container.className });
            
            // Debug: Check if this extension matches any NemoSuite extensions
            const nemoSuiteIds = ['nemo-ext-prose-polisher', 'nemo-ext-nemopreset-ui', 'nemo-ext-ember'];
            if (nemoSuiteIds.includes(id)) {
                console.log(`${LOG_PREFIX} Found NemoSuite extension: ${id} (${title})`);
            }
            
            extensions.push({
                id: id,
                element: container,
                title: title,
                originalParent: container.parentNode
            });
        });
        
        console.log(`${LOG_PREFIX} Total extensions discovered: ${extensions.length}`);
        
        // Debug: List all discovered extension IDs
        console.log(`${LOG_PREFIX} All discovered extension IDs:`, extensions.map(ext => ext.id));
        
        return extensions;
    },

    createEnhancedInterface: function(container) {
        const discoveredExtensions = this.discoverExtensions();
        if (discoveredExtensions.length === 0) return;

        // Store original extensions for cleanup (keep the actual elements, don't clone)
        this.originalExtensions = discoveredExtensions.map(ext => ({
            element: ext.element,
            originalParent: ext.originalParent
        }));

        // Create search and folder controls
        const controlsContainer = document.createElement('div');
        controlsContainer.innerHTML = `
            <div class="nemo-folder-controls">
                <div>
                    <button class="nemo-add-folder-button" id="nemo-add-custom-folder">
                        <i class="fa-solid fa-plus"></i>
                        Add Custom Folder
                    </button>
                </div>
            </div>
            <div class="nemo-extensions-search">
                <div class="flex-container alignItemsCenter" style="margin-bottom: 15px; gap: 10px;">
                    <i class="fa-solid fa-search" style="opacity: 0.7;"></i>
                    <input type="search" id="nemo-extensions-search" 
                           placeholder="Search extensions and folders..." 
                           class="text_pole">
                </div>
            </div>
        `;

        // Create layout container
        const layoutContainer = document.createElement('div');
        layoutContainer.className = 'nemo-extensions-layout';
        
        const leftColumn = document.createElement('div');
        leftColumn.className = 'nemo-extensions-column';
        const rightColumn = document.createElement('div');
        rightColumn.className = 'nemo-extensions-column';

        // Group extensions
        const groupedExtensions = this.groupExtensions(discoveredExtensions);
        const allCategories = [...Object.keys(this.defaultCategories), ...Object.keys(this.customFolders), 'Other'];
        
        allCategories.forEach((category, index) => {
            const hasExtensions = groupedExtensions[category] && groupedExtensions[category].length > 0;
            const isCustomFolder = this.customFolders.hasOwnProperty(category);
            
            // Show folder if it has extensions OR if it's a custom folder (even if empty)
            if (hasExtensions || isCustomFolder) {
                const folder = this.createFolder(category, groupedExtensions[category] || []);
                
                if (index % 2 === 0) {
                    leftColumn.appendChild(folder);
                } else {
                    rightColumn.appendChild(folder);
                }
            }
        });
        
        layoutContainer.appendChild(leftColumn);
        layoutContainer.appendChild(rightColumn);

        // Clear and setup containers
        const settings1 = document.getElementById('extensions_settings');
        const settings2 = document.getElementById('extensions_settings2');
        
        settings1.innerHTML = '';
        if(settings2) {
            settings2.innerHTML = '';
            settings2.style.display = 'none';
        }
        
        settings1.appendChild(controlsContainer);
        settings1.appendChild(layoutContainer);
        
        this.addSearchHandler();
        this.setupContextMenu();
    },

    groupExtensions: function(extensions) {
        const grouped = {};
        
        extensions.forEach(ext => {
            let category = 'Other';
            
            // Check custom folder assignments first
            if (this.extensionTags[ext.id]) {
                const customFolder = this.extensionTags[ext.id];
                if (!grouped[customFolder]) grouped[customFolder] = [];
                grouped[customFolder].push(ext);
                return;
            }
            
            // Check default categories
            for (const cat in this.defaultCategories) {
                if (this.defaultCategories[cat].includes(ext.id)) {
                    category = cat;
                    break;
                }
            }
            
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(ext);
        });
        
        // Debug: Log the grouped results
        console.log(`${LOG_PREFIX} Grouped extensions:`, grouped);
        console.log(`${LOG_PREFIX} Categories with extensions:`, Object.keys(grouped));
        if (grouped['NemoSuite']) {
            console.log(`${LOG_PREFIX} NemoSuite contains:`, grouped['NemoSuite'].map(ext => `${ext.id} (${ext.title})`));
        } else {
            console.log(`${LOG_PREFIX} NemoSuite category not found in grouped extensions`);
        }
        
        return grouped;
    },

    createFolder: function(categoryName, extensions) {
        const isCustom = this.customFolders.hasOwnProperty(categoryName);
        const folder = document.createElement('div');
        folder.className = 'inline-drawer wide100p nemo-extension-category-drawer';
        folder.dataset.category = categoryName;
        
        folder.innerHTML = `
            <div class="inline-drawer-toggle inline-drawer-header interactable" tabindex="0">
                <b>${categoryName}</b>
                ${isCustom ? '<i class="fa-solid fa-trash nemo-folder-delete" style="margin-left: 10px; opacity: 0.6; cursor: pointer; color: #ff6b6b;" title="Delete folder"></i>' : ''}
                <div class="inline-drawer-icon fa-solid fa-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content" style="display: none;"></div>
        `;
        
        const content = folder.querySelector('.inline-drawer-content');
        if (extensions.length === 0 && isCustom) {
            // Show a message for empty custom folders
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'nemo-empty-folder-message';
            emptyMessage.style.cssText = `
                padding: 15px;
                text-align: center;
                color: var(--nemo-text-muted, #888);
                font-style: italic;
                font-size: 0.9em;
            `;
            emptyMessage.textContent = 'This folder is empty. Move extensions here using the folder button or right-click menu.';
            content.appendChild(emptyMessage);
        } else {
            extensions.forEach(ext => {
                const card = this.createExtensionCard(ext);
                content.appendChild(card);
            });
        }
        
        return folder;
    },

    createExtensionCard: function(extension) {
        const tags = this.getExtensionTags(extension.id);
        const card = document.createElement('div');
        card.className = 'nemo-extension-card';
        card.dataset.extensionId = extension.id;
        
        card.innerHTML = `
            <div class="nemo-card-header">
                <div class="nemo-card-title">${extension.title}</div>
                <div class="nemo-card-actions">
                    <button class="nemo-folder-button" title="Move to folder">
                        <i class="fa-solid fa-folder"></i>
                    </button>
                    <button class="nemo-options-button" title="More Options">
                        <i class="fa-solid fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
            <div class="nemo-card-folder">
                ${tags.map(tag => `<span class="nemo-folder-badge ${tag.custom ? 'nemo-custom-folder' : ''}">${tag.name}</span>`).join('')}
            </div>
        `;
        
        // Store reference to original extension element
        card._extensionElement = extension.element;
        card._extensionData = extension;
        
        return card;
    },

    getExtensionTags: function(extensionId) {
        const tags = [];
        
        // Add category tag
        for (const category in this.defaultCategories) {
            if (this.defaultCategories[category].includes(extensionId)) {
                tags.push({ name: category, custom: false });
                break;
            }
        }
        
        // Add custom folder assignment
        if (this.extensionTags[extensionId]) {
            tags.push({ name: this.extensionTags[extensionId], custom: true });
        }
        
        return tags;
    },

    setupEventListeners: function() {
        // Extension card clicks
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.nemo-extension-card');
            if (card && !e.target.closest('.nemo-card-actions')) {
                if (card._extensionData) {
                    this.openExtensionFullScreen(card._extensionData);
                }
            }
            
            // Back button
            if (e.target.closest('#nemo-back-to-main')) {
                this.closeFullScreen();
            }
            
            // Add custom folder
            if (e.target.closest('#nemo-add-custom-folder')) {
                this.promptForCustomFolder();
            }
            
            // Delete custom folder
            if (e.target.closest('.nemo-folder-delete')) {
                e.stopPropagation();
                const folderHeader = e.target.closest('.inline-drawer-header');
                const folder = folderHeader.closest('.nemo-extension-category-drawer');
                const folderName = folder.dataset.category;
                this.confirmDeleteCustomFolder(folderName);
            }
            
            // Folder button
            if (e.target.closest('.nemo-folder-button')) {
                e.stopPropagation();
                const card = e.target.closest('.nemo-extension-card');
                const extensionId = card.dataset.extensionId;
                this.showFolderSelectionDialog(extensionId);
            }
        });
        
        // Context menu
        document.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.nemo-extension-card');
            if (card) {
                e.preventDefault();
                this.showContextMenu(card, e.clientX, e.clientY);
            }
        });
        
        // Hide context menu on click elsewhere
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });
    },

    openExtensionFullScreen: function(extensionData) {
        const overlay = document.getElementById('nemo-tab-extension-overlay');
        const titleElement = document.getElementById('nemo-current-extension-title');
        const contentElement = document.getElementById('nemo-extension-view-content');
        
        if (!overlay) {
            this.setupTabExtensionView();
            return this.openExtensionFullScreen(extensionData);
        }
        
        // Hide the main extension interface
        this.hideMainInterface();
        
        // Update title
        titleElement.textContent = extensionData.title;
        
        // Move extension content to tab view
        contentElement.innerHTML = '';
        
        // Store the original parent for restoration later
        extensionData.originalParent = extensionData.element.parentNode;
        
        // Move the ACTUAL extension element (not a clone) to maintain functionality
        const extensionElement = extensionData.element;
        
        // If it's a drawer, open it and show content directly
        if (extensionElement.querySelector('.inline-drawer-content')) {
            const drawerContent = extensionElement.querySelector('.inline-drawer-content');
            // Don't force display:block for NemoPreset settings - preserve custom styling
            if (!extensionElement.classList.contains('nemo-preset-enhancer-settings')) {
                drawerContent.style.display = 'block';
            }
            // Move the entire extension element to maintain all functionality
            contentElement.appendChild(extensionElement);
        } else {
            contentElement.appendChild(extensionElement);
        }
        
        // Show overlay within the tab
        overlay.classList.add('active');
        this.currentView = 'extension';
        this.currentExtension = extensionData;
    },

    closeFullScreen: function() {
        const overlay = document.getElementById('nemo-tab-extension-overlay');
        overlay.classList.remove('active');
        
        // Restore the extension element to its original location
        if (this.currentExtension && this.currentExtension.element) {
            const extensionElement = this.currentExtension.element;
            const originalParent = this.currentExtension.originalParent;
            
            if (originalParent && originalParent.parentNode) {
                console.log(`${LOG_PREFIX} Restoring extension element to original parent`);
                originalParent.appendChild(extensionElement);
                
                // If it was a drawer, restore proper state
                if (extensionElement.querySelector('.inline-drawer-content')) {
                    const drawerContent = extensionElement.querySelector('.inline-drawer-content');
                    drawerContent.style.display = 'none'; // Close drawer by default
                }
            }
        }
        
        // Show the main extension interface again
        this.showMainInterface();
        
        // Force save any pending changes
        console.log(`${LOG_PREFIX} Back button pressed, ensuring all settings are saved`);
        this.saveSettings();
        
        this.currentView = 'main';
        this.currentExtension = null;
    },

    hideMainInterface: function() {
        // Hide the specific elements we created for the card interface
        const controls = document.querySelector('.nemo-folder-controls');
        const search = document.querySelector('.nemo-extensions-search');
        const layout = document.querySelector('.nemo-extensions-layout');
        
        if (controls) controls.style.display = 'none';
        if (search) search.style.display = 'none';
        if (layout) layout.style.display = 'none';
    },

    showMainInterface: function() {
        // Show the card interface elements again
        const controls = document.querySelector('.nemo-folder-controls');
        const search = document.querySelector('.nemo-extensions-search');
        const layout = document.querySelector('.nemo-extensions-layout');
        
        if (controls) controls.style.display = '';
        if (search) search.style.display = '';
        if (layout) layout.style.display = '';
    },

    promptForCustomFolder: function() {
        const folderName = prompt('Enter custom folder name:');
        if (folderName && folderName.trim()) {
            const cleanName = folderName.trim();
            if (!this.customFolders[cleanName] && !this.defaultCategories[cleanName]) {
                this.customFolders[cleanName] = [];
                this.saveSettings();
                
                // Add the new folder to the interface without breaking layout
                this.addCustomFolderToInterface(cleanName);
                console.log(`${LOG_PREFIX} Created custom folder: ${cleanName}`);
            } else {
                alert('A folder with that name already exists!');
            }
        }
    },

    addCustomFolderToInterface: function(folderName) {
        // Find the layout container
        const layoutContainer = document.querySelector('.nemo-extensions-layout');
        if (!layoutContainer) return;
        
        const leftColumn = layoutContainer.children[0];
        const rightColumn = layoutContainer.children[1];
        
        // Create empty folder
        const folder = this.createFolder(folderName, []);
        
        // Add to appropriate column based on current distribution
        const leftFolders = leftColumn.children.length;
        const rightFolders = rightColumn.children.length;
        
        if (leftFolders <= rightFolders) {
            leftColumn.appendChild(folder);
        } else {
            rightColumn.appendChild(folder);
        }
    },

    confirmDeleteCustomFolder: function(folderName) {
        // Check if it's actually a custom folder
        if (!this.customFolders.hasOwnProperty(folderName)) {
            console.warn(`${LOG_PREFIX} Attempted to delete non-custom folder: ${folderName}`);
            return;
        }

        // Count extensions in this folder
        const extensionsInFolder = Object.values(this.extensionTags).filter(tag => tag === folderName).length;
        
        let message = `Are you sure you want to delete the custom folder "${folderName}"?`;
        if (extensionsInFolder > 0) {
            message += `\n\nThis folder contains ${extensionsInFolder} extension${extensionsInFolder > 1 ? 's' : ''}. `;
            message += 'These extensions will be moved back to their default categories.';
        }
        message += '\n\nThis action cannot be undone.';

        if (confirm(message)) {
            this.deleteCustomFolder(folderName);
        }
    },

    deleteCustomFolder: function(folderName) {
        console.log(`${LOG_PREFIX} Deleting custom folder: ${folderName}`);
        
        // Move all extensions out of this folder back to default categories
        const extensionsToReassign = [];
        for (const [extensionId, assignedFolder] of Object.entries(this.extensionTags)) {
            if (assignedFolder === folderName) {
                extensionsToReassign.push(extensionId);
                delete this.extensionTags[extensionId];
            }
        }
        
        // Remove the folder from custom folders
        delete this.customFolders[folderName];
        
        // Save settings
        this.saveSettings();
        
        // Log the operation
        console.log(`${LOG_PREFIX} Deleted folder "${folderName}" and reassigned ${extensionsToReassign.length} extensions to default categories`);
        
        // Refresh the interface to reflect changes
        this.refreshInterface();
        
        // Show success message
        this.showNotification(`Custom folder "${folderName}" deleted successfully. ${extensionsToReassign.length > 0 ? `${extensionsToReassign.length} extension${extensionsToReassign.length > 1 ? 's' : ''} moved to default categories.` : ''}`, 'success');
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
            max-width: 350px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            font-size: 14px;
            line-height: 1.4;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    },

    setupContextMenu: function() {
        const menu = document.createElement('div');
        menu.id = 'nemo-extension-context-menu';
        menu.className = 'nemo-context-menu';
        menu.innerHTML = `
            <div class="nemo-context-menu-item" data-action="move-to-folder">
                <i class="fa-solid fa-folder"></i>
                Move to Folder
            </div>
            <div class="nemo-context-menu-separator"></div>
            <div class="nemo-context-menu-item" data-action="remove-from-folder">
                <i class="fa-solid fa-folder-minus"></i>
                Remove from Custom Folders
            </div>
        `;
        document.body.appendChild(menu);
        
        // Context menu clicks
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.nemo-context-menu-item');
            if (item) {
                const action = item.dataset.action;
                this.handleContextAction(action, this._contextMenuTarget);
                this.hideContextMenu();
            }
        });
    },

    showContextMenu: function(card, x, y) {
        const menu = document.getElementById('nemo-extension-context-menu');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
        this._contextMenuTarget = card;
    },

    hideContextMenu: function() {
        const menu = document.getElementById('nemo-extension-context-menu');
        if (menu) {
            menu.style.display = 'none';
        }
    },

    handleContextAction: function(action, card) {
        const extensionId = card.dataset.extensionId;
        
        switch (action) {
            case 'move-to-folder':
                this.showFolderSelectionDialog(extensionId);
                break;
            case 'remove-from-folder':
                // Remove from custom folders (keep in default categories)
                delete this.extensionTags[extensionId];
                this.saveSettings();
                this.refreshInterface();
                break;
        }
    },

    showFolderSelectionDialog: function(extensionId) {
        // Create a better dialog than prompt() for folder selection
        const dialog = document.createElement('div');
        dialog.className = 'nemo-folder-selection-dialog';
        dialog.innerHTML = `
            <div class="nemo-dialog-overlay">
                <div class="nemo-dialog-content">
                    <div class="nemo-dialog-header">
                        <h3>Move Extension to Folder</h3>
                        <button class="nemo-dialog-close">&times;</button>
                    </div>
                    <div class="nemo-dialog-body">
                        <p>Select a folder for this extension:</p>
                        <div class="nemo-folder-list">
                            ${this.createFolderOptionsList(extensionId)}
                        </div>
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--nemo-border-color);">
                            <button class="nemo-btn-secondary" id="nemo-create-new-folder">
                                <i class="fa-solid fa-plus"></i> Create New Folder
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Add event listeners
        dialog.querySelector('.nemo-dialog-close').addEventListener('click', () => {
            dialog.remove();
        });
        
        dialog.querySelector('.nemo-dialog-overlay').addEventListener('click', (e) => {
            if (e.target === dialog.querySelector('.nemo-dialog-overlay')) {
                dialog.remove();
            }
        });
        
        dialog.querySelector('#nemo-create-new-folder').addEventListener('click', () => {
            const newFolderName = prompt('Enter new folder name:');
            if (newFolderName && newFolderName.trim()) {
                const cleanName = newFolderName.trim();
                if (!this.customFolders[cleanName] && !this.defaultCategories[cleanName]) {
                    this.customFolders[cleanName] = [];
                    this.extensionTags[extensionId] = cleanName;
                    this.saveSettings();
                    this.refreshInterface();
                    dialog.remove();
                } else {
                    alert('A folder with that name already exists!');
                }
            }
        });
        
        // Folder option clicks
        dialog.querySelectorAll('.nemo-folder-option').forEach(option => {
            option.addEventListener('click', () => {
                const folderName = option.dataset.folderName;
                
                console.log(`${LOG_PREFIX} Moving extension ${extensionId} to folder: ${folderName}`);
                
                if (folderName === 'default') {
                    // Remove from custom folders - let it go back to default category
                    delete this.extensionTags[extensionId];
                    console.log(`${LOG_PREFIX} Removed extension ${extensionId} from custom folders`);
                } else {
                    // Move to selected folder
                    this.extensionTags[extensionId] = folderName;
                    console.log(`${LOG_PREFIX} Assigned extension ${extensionId} to folder ${folderName}`);
                }
                
                console.log(`${LOG_PREFIX} Current extension assignments:`, this.extensionTags);
                console.log(`${LOG_PREFIX} Current custom folders:`, this.customFolders);
                
                this.saveSettings();
                this.refreshInterface();
                dialog.remove();
            });
        });
    },

    createFolderOptionsList: function(extensionId) {
        const currentFolder = this.extensionTags[extensionId];
        const allFolders = [
            ...Object.keys(this.defaultCategories),
            ...Object.keys(this.customFolders)
        ];
        
        let html = `<div class="nemo-folder-option ${!currentFolder ? 'selected' : ''}" data-folder-name="default">
            <i class="fa-solid fa-home"></i>
            <span>Default Category</span>
            ${!currentFolder ? '<i class="fa-solid fa-check"></i>' : ''}
        </div>`;
        
        allFolders.forEach(folder => {
            const isCustom = this.customFolders.hasOwnProperty(folder);
            const isSelected = currentFolder === folder;
            html += `
                <div class="nemo-folder-option ${isSelected ? 'selected' : ''}" data-folder-name="${folder}">
                    <i class="fa-solid fa-${isCustom ? 'folder-plus' : 'folder'}"></i>
                    <span>${folder}</span>
                    ${isCustom ? '<span class="nemo-custom-badge">Custom</span>' : ''}
                    ${isSelected ? '<i class="fa-solid fa-check"></i>' : ''}
                </div>
            `;
        });
        
        return html;
    },

    addSearchHandler: function() {
        const searchInput = document.getElementById('nemo-extensions-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.applySearchFilter(e.target.value);
            });
        }
    },

    applySearchFilter: function(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const folders = document.querySelectorAll('.nemo-extension-category-drawer');

        folders.forEach(folder => {
            let hasVisibleExtension = false;
            const cards = folder.querySelectorAll('.nemo-extension-card');
            
            cards.forEach(card => {
                const title = card.querySelector('.nemo-card-title').textContent.toLowerCase();
                const folderBadges = Array.from(card.querySelectorAll('.nemo-folder-badge')).map(badge => badge.textContent.toLowerCase());
                const allText = [title, ...folderBadges].join(' ');
                
                if (allText.includes(term)) {
                    card.style.display = '';
                    hasVisibleExtension = true;
                } else {
                    card.style.display = 'none';
                }
            });

            folder.style.display = hasVisibleExtension ? '' : 'none';
            
            // Open folder if it has visible extensions and search term exists
            if (hasVisibleExtension && term) {
                const content = folder.querySelector('.inline-drawer-content');
                const icon = folder.querySelector('.inline-drawer-icon');
                content.style.display = 'block';
                icon.classList.remove('down');
                icon.classList.add('up');
            }
        });
    },

    refreshInterface: function() {
        console.log(`${LOG_PREFIX} Refreshing interface after folder change`);
        
        // Instead of recreating everything, just reorganize existing extensions
        this.reorganizeExtensions();
    },
    
    reorganizeExtensions: function() {
        // Get the current layout container
        const layoutContainer = document.querySelector('.nemo-extensions-layout');
        if (!layoutContainer) {
            console.warn(`${LOG_PREFIX} Layout container not found during refresh`);
            return;
        }

        // Get all extension cards BEFORE clearing anything
        const allExtensionCards = document.querySelectorAll('.nemo-extension-card');
        const extensions = [];
        
        // Rebuild extension data from existing cards
        allExtensionCards.forEach(card => {
            const extensionId = card.dataset.extensionId;
            const extensionData = card._extensionData;
            
            if (extensionId && extensionData) {
                extensions.push({
                    id: extensionId,
                    element: extensionData.element,
                    title: extensionData.title,
                    originalParent: extensionData.originalParent
                });
            }
        });
        
        console.log(`${LOG_PREFIX} Found ${extensions.length} extensions to reorganize`);
        
        if (extensions.length === 0) {
            console.warn(`${LOG_PREFIX} No extensions found for reorganization, using stored original extensions`);
            // Fall back to using the originally stored extensions
            if (this.originalExtensions && this.originalExtensions.length > 0) {
                const fallbackExtensions = this.originalExtensions.map(orig => ({
                    id: orig.element.id,
                    element: orig.element,
                    title: this.getExtensionTitle(orig.element),
                    originalParent: orig.originalParent
                }));
                extensions.push(...fallbackExtensions);
                console.log(`${LOG_PREFIX} Using ${extensions.length} stored extensions`);
            }
        }
        
        if (extensions.length === 0) {
            console.error(`${LOG_PREFIX} No extensions available for reorganization`);
            return;
        }

        const leftColumn = layoutContainer.children[0];
        const rightColumn = layoutContainer.children[1];
        
        // Clear existing folders but keep the columns
        leftColumn.innerHTML = '';
        rightColumn.innerHTML = '';
        
        // Group extensions based on current folder assignments
        const groupedExtensions = this.groupExtensions(extensions);
        const allCategories = [...Object.keys(this.defaultCategories), ...Object.keys(this.customFolders), 'Other'];
        
        // Recreate folders with updated organization
        allCategories.forEach((category, index) => {
            const hasExtensions = groupedExtensions[category] && groupedExtensions[category].length > 0;
            const isCustomFolder = this.customFolders.hasOwnProperty(category);
            
            // Show folder if it has extensions OR if it's a custom folder (even if empty)
            if (hasExtensions || isCustomFolder) {
                const folder = this.createFolder(category, groupedExtensions[category] || []);
                
                if (index % 2 === 0) {
                    leftColumn.appendChild(folder);
                } else {
                    rightColumn.appendChild(folder);
                }
            }
        });
        
        console.log(`${LOG_PREFIX} Interface reorganization completed`);
    },
    
    getExtensionTitle: function(element) {
        const titleElement = element.querySelector('.inline-drawer-header b, h4, .extension-name, [data-extension-name]');
        if (titleElement) {
            return titleElement.textContent.trim();
        } else if (element.dataset.extensionName) {
            return element.dataset.extensionName;
        } else if (element.id) {
            return element.id.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        return 'Unknown Extension';
    },

    cleanup: function() {
        console.log(`${LOG_PREFIX} Starting cleanup...`);
        
        // First, make sure we're showing the main interface
        this.showMainInterface();
        
        // Close any open extension view and restore elements properly
        if (this.currentView === 'extension') {
            this.closeFullScreen();
        }
        
        // Remove our custom elements
        const overlay = document.getElementById('nemo-tab-extension-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        const contextMenu = document.getElementById('nemo-extension-context-menu');
        if (contextMenu) {
            contextMenu.remove();
        }
        
        // Restore original extensions to their containers
        const settings1 = document.getElementById('extensions_settings');
        const settings2 = document.getElementById('extensions_settings2');
        
        console.log(`${LOG_PREFIX} Restoring ${this.originalExtensions.length} extensions`);
        
        // COMPLETELY clear settings1 content first
        if (settings1) {
            settings1.innerHTML = '';
            // Remove the data attribute that marks it as grouped
            settings1.removeAttribute('data-nemo-grouped');
        }
        
        // Restore settings2 visibility and clear it too
        if (settings2) {
            settings2.style.display = '';
            settings2.innerHTML = '';
        }
        
        // Restore original extension elements to their proper containers
        this.originalExtensions.forEach(({ element, originalParent }) => {
            console.log(`${LOG_PREFIX} Restoring extension:`, element.id, 'to parent:', originalParent?.id);
            
            // Determine target container
            let targetContainer = settings1; // Default to settings1
            if (originalParent && originalParent.id === 'extensions_settings2') {
                targetContainer = settings2;
            }
            
            // Restore the extension element
            if (targetContainer && element) {
                targetContainer.appendChild(element);
            }
        });
        
        console.log(`${LOG_PREFIX} Cleanup completed - interface should be restored to original state`);
        this.initialized = false;
        this.currentView = 'main';
        this.currentExtension = null;
        this.originalExtensions = [];
        
        // Ensure the disabled state is persisted
        console.log(`${LOG_PREFIX} Ensuring settings are saved after cleanup`);
        this.saveSettings();
    }
};