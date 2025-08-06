import { getRequestHeaders, eventSource, event_types } from '../../../../script.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { oai_settings, openai_setting_names, promptManager } from '../../../../scripts/openai.js';
import { LOG_PREFIX, generateUUID, showColorPickerPopup, NEMO_METADATA_KEY, NEMO_FAVORITE_PRESETS_KEY } from './utils.js';

export class PresetNavigator {
    constructor(apiType) {
        this.apiType = apiType;
        this.navigatorElement = this.createNavigatorElement();
        this.mainView = this.navigatorElement.querySelector('#navigator-grid-view');
        this.breadcrumbs = this.navigatorElement.querySelector('#navigator-breadcrumbs');
        this.newFolderBtn = this.navigatorElement.querySelector('#navigator-new-synthetic-folder-btn');
        this.searchInput = this.navigatorElement.querySelector('#navigator-search-input');
        this.searchClearBtn = this.navigatorElement.querySelector('#navigator-search-clear');
        
        this.metadata = { folders: {}, presets: {} };
        this.currentPath = [{ id: 'root', name: 'Home' }];
        this.allPresets = [];
        this.selectedPreset = { value: null, name: null };
        this.bulkSelection = new Set();
        this.lastSelectedItem = null;
        this.viewMode = 'grid';
        this.currentSort = 'name-asc';
        this.currentFilter = 'all';

        this.isDragging = false;
        this.lastDropTarget = null;
        
        this.init();
    }
    
    // **FIX:** This now only creates the inner content of the modal.
    // `callGenericPopup` will provide the outer frame, header, and close button.
    createNavigatorElement() {
        const container = document.createElement('div');
        container.id = `nemo-preset-navigator-content-${generateUUID()}`;
        container.className = 'nemo-preset-navigator-content-wrapper'; // A class for the content itself
        container.innerHTML = `
            <div class="navigator-body">
                <div class="navigator-sidebar">
                    <div class="navigator-favorites-section">
                        <h4><i class="fa-solid fa-star"></i> Quick Favorites</h4>
                        <div id="navigator-favorites-list" class="navigator-favorites-list"></div>
                    </div>
                </div>
                <div class="navigator-main-panel">
                    <div id="navigator-grid-header">
                        <div id="navigator-breadcrumbs"></div>
                        <div id="navigator-header-controls">
                            <div id="navigator-search-controls">
                                <input type="search" id="navigator-search-input" class="text_pole" placeholder="Search...">
                                <button id="navigator-search-clear" title="Clear Search" class="menu_button"><i class="fa-solid fa-times"></i></button>
                            </div>
                            <div class="nemo-header-buttons">
                                <button id="navigator-filter-btn" class="menu_button" title="Filter"><i class="fa-solid fa-filter"></i></button>
                                <button id="navigator-sort-btn" class="menu_button" title="Sort"><i class="fa-solid fa-arrow-up-z-a"></i></button>
                                <button id="navigator-view-toggle-btn" class="menu_button" title="Switch View"><i class="fa-solid fa-list"></i></button>
                                <button id="navigator-new-synthetic-folder-btn" class="menu_button" title="New Folder"><i class="fa-solid fa-folder-plus"></i></button>
                            </div>
                        </div>
                    </div>
                    <div id="navigator-grid-view"></div>
                </div>
            </div>
            <div class="modal-footer">
                <div class="action-controls"><button id="navigator-import-btn" class="menu_button" title="Import preset from file"><i class="fa-solid fa-file-import"></i></button></div>
                <div class="action-controls"><button id="navigator-load-btn" class="menu_button" disabled><i class="fa-solid fa-upload"></i> Load Selected Preset</button></div>
            </div>`;
        return container;
    }

    init() {
        this.navigatorElement.querySelector('#navigator-load-btn').addEventListener('click', () => this.loadSelectedPreset());
        this.newFolderBtn.addEventListener('click', () => this.createNewFolder());
        this.searchInput.addEventListener('input', () => this.renderGridView());
        this.searchClearBtn.addEventListener('click', () => { this.searchInput.value = ''; this.renderGridView(); });
        this.mainView.addEventListener('click', (e) => this.handleGridClick(e), true);
        this.mainView.addEventListener('dblclick', (e) => this.handleGridDoubleClick(e));
        this.navigatorElement.querySelector('#navigator-import-btn').addEventListener('click', () => this.importPreset());
        this.navigatorElement.querySelector('#navigator-view-toggle-btn').addEventListener('click', () => this.toggleViewMode());
        this.navigatorElement.querySelector('#navigator-sort-btn').addEventListener('click', (e) => this.showSortMenu(e));
        this.navigatorElement.querySelector('#navigator-filter-btn').addEventListener('click', (e) => this.showFilterMenu(e));
        this.navigatorElement.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.navigatorElement.addEventListener('contextmenu', (e) => this.handleGridContextMenu(e));
        
        // Setup a single listener for hiding the context menu
        document.body.addEventListener('click', (e) => {
            if (!e.target.closest('.nemo-context-menu')) {
                this.hideContextMenu();
            }
        }, true);

        this.mainView.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.mainView.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.mainView.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.mainView.addEventListener('drop', (e) => this.handleDrop(e));
    }

    async open() {
        this.loadMetadata();
        // **FIX:** Await the preset list when opening, not on init.
        this.allPresets = await this.fetchPresetList();
        this.searchInput.value = '';
        this.bulkSelection.clear();
        this.render();
        
        // **FIX:** Pass the content element to the popup function.
        // It will now use the default ST modal frame.
        callGenericPopup(this.navigatorElement, POPUP_TYPE.DISPLAY, 'Preset Navigator', {
            wide: true,
            large: true,
            addCloseButton: true,
            onclose: () => this.cleanup()
        });
    }

    cleanup() {
        // This runs when the popup is closed.
        this.selectedPreset = { value: null, name: null };
        this.mainView.innerHTML = '';
        this.currentPath = [{ id: 'root', name: 'Home' }];
        this.hideContextMenu();
    }
    
    // **FIX:** Simplified and more reliable preset fetching logic.
    // It reads directly from the <select> element, which is the source of truth.
    async fetchPresetList() {
        const select = document.querySelector(`select[data-preset-manager-for="${this.apiType}"]`);
        if (!select) {
            console.error(`${LOG_PREFIX} Could not find preset select for API: ${this.apiType}`);
            return [];
        }
        return Array.from(select.options)
            .map(opt => ({ name: opt.textContent, value: opt.value }))
            .filter(item => item.name && item.value && item.value !== '---' && !item.name.includes('===')); // Filter out separators and headers
    }
    
    render() {
        this.renderBreadcrumbs();
        this.renderGridView();
        this.updateLoadButton();
        this.updateHeaderControls();
    }

    renderBreadcrumbs() {
        this.breadcrumbs.innerHTML = '';
        this.currentPath.forEach((part, index) => {
            const partEl = document.createElement('span');
            partEl.dataset.id = part.id;
            partEl.textContent = part.name;
            if (index < this.currentPath.length - 1) {
                partEl.classList.add('link');
                partEl.addEventListener('click', () => {
                    this.currentPath.splice(index + 1);
                    this.render();
                });
            }
            this.breadcrumbs.appendChild(partEl);
            if (index < this.currentPath.length - 1) {
                const separator = document.createElement('span');
                separator.textContent = ' / ';
                this.breadcrumbs.appendChild(separator);
            }
        });
    }

    renderGridView() {
        let metadataWasUpdated = false;
        const now = new Date().toISOString();
        this.allPresets.forEach(p => {
            if (!this.metadata.presets[p.name]) {
                this.metadata.presets[p.name] = { createdAt: now, lastModified: now };
                metadataWasUpdated = true;
            }
        });
        if (metadataWasUpdated) this.saveMetadata();

        const currentFolderId = this.currentPath[this.currentPath.length - 1].id;
        const searchTerm = this.searchInput.value.toLowerCase().trim();

        let items = [];
        Object.values(this.metadata.folders)
            .filter(folder => folder.parentId === currentFolderId)
            .forEach(folder => items.push({ type: 'folder', data: folder, id: folder.id, name: folder.name }));

        this.allPresets.forEach(p => {
            const meta = this.metadata.presets[p.name] || {};
            const isUncategorized = !meta.folderId;
            const isInCurrentFolder = meta.folderId === currentFolderId;
            const isInRootAndCurrentIsRoot = isUncategorized && currentFolderId === 'root';
            if (isInCurrentFolder || isInRootAndCurrentIsRoot) {
                items.push({ type: 'preset', data: { ...p, ...meta }, id: p.name, name: p.name });
            }
        });

        items = items.filter(item => {
            if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) return false;
            if (this.currentFilter === 'uncategorized' && item.type === 'preset' && item.data.folderId) return false;
            if (this.currentFilter === 'has-image' && item.type === 'preset' && !item.data.imageUrl) return false;
            if (this.currentFilter === 'favorites') {
                if (item.type === 'folder') return false; // Only show presets in favorites view
                const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PRESETS_KEY) || '[]');
                return favorites.includes(item.data.name);
            }
            return true;
        });

        items.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'preset') return -1;
            if (a.type === 'preset' && b.type === 'folder') return 1;
            const aDate = a.data.lastModified || a.data.createdAt || '1970-01-01';
            const bDate = b.data.lastModified || b.data.createdAt || '1970-01-01';
            switch (this.currentSort) {
                case 'name-desc': return b.name.localeCompare(a.name);
                case 'date-asc': return new Date(aDate) - new Date(bDate);
                case 'date-desc': return new Date(bDate) - new Date(aDate);
                case 'name-asc':
                default: return a.name.localeCompare(b.name);
            }
        });

        this.mainView.innerHTML = '';
        this.mainView.className = `view-mode-${this.viewMode}`;
        this.mainView.classList.add('fade-in');

        if (items.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'navigator-empty-state';
            emptyEl.innerHTML = searchTerm ? `<h3>No results for "${searchTerm}"</h3>` : `<h3>This folder is empty.</h3><p>Drag presets here to add them.</p>`;
            this.mainView.appendChild(emptyEl);
            return;
        }

        items.forEach(item => {
            const itemEl = (this.viewMode === 'grid') ? this.createGridItem(item) : this.createListItem(item);
            this.mainView.appendChild(itemEl);
        });
        this.updateBulkSelectionVisuals();
        this.renderFavoritesSidebar();
    }

    createGridItem(item) {
        const { type, data, id } = item;
        const itemEl = document.createElement('div');
        itemEl.className = `grid-item ${type}`;
        itemEl.dataset.type = type;
        itemEl.dataset.id = id;
        itemEl.draggable = true;
        if (type === 'preset') itemEl.dataset.value = data.value;
        if (data.color) itemEl.style.setProperty('--nemo-folder-color', data.color);

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        if (data.imageUrl) {
            icon.style.backgroundImage = `url('${data.imageUrl}')`;
        } else {
            icon.innerHTML = `<i class="fa-solid ${type === 'folder' ? 'fa-folder' : 'fa-file-lines'}"></i>`;
        }
        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = data.name.split('/').pop();
        const lastMod = data.lastModified ? new Date(data.lastModified).toLocaleDateString() : 'N/A';
        nameEl.title = `${data.name}\nModified: ${lastMod}`;
        itemEl.appendChild(icon);
        itemEl.appendChild(nameEl);

        // Add favorite toggle button for presets
        if (type === 'preset') {
            const favoriteBtn = document.createElement('button');
            favoriteBtn.className = 'menu_button nemo-favorite-btn';
            favoriteBtn.title = 'Toggle favorite';
            
            const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PRESETS_KEY) || '[]');
            const isFavorite = favorites.includes(data.name);
            favoriteBtn.innerHTML = `<i class="fa-solid fa-star ${isFavorite ? 'favorite-active' : ''}"></i>`;
            
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePresetFavorite(data.name);
            });
            
            itemEl.appendChild(favoriteBtn);
        }

        const menuBtn = document.createElement('button');
        menuBtn.className = 'menu_button nemo-item-menu-btn';
        menuBtn.title = 'More options';
        menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        itemEl.appendChild(menuBtn);

        if (type === 'preset' && this.selectedPreset.name === id) itemEl.classList.add('selected');
        return itemEl;
    }

    createListItem(item) {
        const { type, data, id } = item;
        const itemEl = document.createElement('div');
        itemEl.className = `grid-item list-item ${type}`;
        itemEl.dataset.type = type;
        itemEl.dataset.id = id;
        itemEl.draggable = true;
        if (type === 'preset') itemEl.dataset.value = data.value;
        if (data.color) itemEl.style.setProperty('--nemo-folder-color', data.color);

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        icon.innerHTML = `<i class="fa-solid ${type === 'folder' ? 'fa-folder' : 'fa-file-lines'}"></i>`;
        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = data.name.split('/').pop();
        nameEl.title = data.name;
        const dateEl = document.createElement('div');
        dateEl.className = 'item-date';
        dateEl.textContent = data.lastModified ? new Date(data.lastModified).toLocaleDateString() : '—';
        itemEl.appendChild(icon);
        itemEl.appendChild(nameEl);
        itemEl.appendChild(dateEl);

        const menuBtn = document.createElement('button');
        menuBtn.className = 'menu_button nemo-item-menu-btn';
        menuBtn.title = 'More options';
        menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        itemEl.appendChild(menuBtn);

        if (type === 'preset' && this.selectedPreset.name === id) itemEl.classList.add('selected');
        return itemEl;
    }

    handleDragStart(e) {
        this.isDragging = true;
        const item = e.target.closest('.grid-item');
        if (!item) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', item.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => item.classList.add('dragging-source'), 0);
    }

    handleDragOver(e) {
        e.preventDefault();
        const target = e.target.closest('.grid-item.folder');
        if (this.lastDropTarget && this.lastDropTarget !== target) {
            this.lastDropTarget.classList.remove('drag-over');
        }
        if (target) {
            target.classList.add('drag-over');
            this.lastDropTarget = target;
            e.dataTransfer.dropEffect = 'move';
        } else {
            e.dataTransfer.dropEffect = 'none';
            this.lastDropTarget = null;
        }
    }

    handleDragLeave(e) {
        const target = e.target.closest('.grid-item.folder');
        if (target) {
            target.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        if (this.lastDropTarget) {
            this.lastDropTarget.classList.remove('drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            const folderId = this.lastDropTarget.dataset.id;
            
            if (draggedId && folderId) {
                this.moveItemToFolder(draggedId, folderId);
            }
        }
        const draggedId = e.dataTransfer.getData('text/plain');
        const originalItem = this.mainView.querySelector(`.grid-item.dragging-source[data-id="${draggedId}"]`);
        if(originalItem) originalItem.classList.remove('dragging-source');

        this.isDragging = false;
        this.lastDropTarget = null;
    }
    
    async handleGridDoubleClick(e) {
        const item = e.target.closest('.grid-item.preset');
        if (!item) return;
        const { id, value } = item.dataset;
        this.mainView.querySelectorAll('.grid-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedPreset = { value, filename: id };
        this.updateLoadButton();
        await this.loadSelectedPreset();
    }

    handleGridClick(e) {
        const menuBtn = e.target.closest('.nemo-item-menu-btn');
        if (menuBtn) {
            e.preventDefault(); e.stopPropagation();
            const item = menuBtn.closest('.grid-item');
            const rect = menuBtn.getBoundingClientRect();
            const mockEvent = { clientX: rect.right, clientY: rect.top, preventDefault: () => {}, target: item };
            this.handleGridContextMenu(mockEvent);
            return;
        }

        const item = e.target.closest('.grid-item');
        if (!item) return;
        const { type, id, value } = item.dataset;

        if (e.shiftKey && this.lastSelectedItem) {
            this.handleShiftClick(item);
        } else if (e.ctrlKey || e.metaKey) {
            this.toggleBulkSelection(id);
            this.lastSelectedItem = item;
        } else {
            this.bulkSelection.clear();
            this.updateBulkSelectionVisuals();
            if (type === 'folder') {
                const folder = this.metadata.folders[id];
                if (folder) {
                    this.currentPath.push({ id: folder.id, name: folder.name });
                    this.render();
                }
            } else if (type === 'preset') {
                this.mainView.querySelectorAll('.grid-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedPreset = { value, name: id };
                this.lastSelectedItem = item;
            }
        }
        this.updateLoadButton();
    }

    handleGridContextMenu(e) {
        e.preventDefault();
        this.hideContextMenu(); // Hide any existing menu
        const item = e.target.closest('.grid-item');
        if (!item) return;

        const { type, id } = item.dataset;
        const isBulk = this.bulkSelection.size > 1 && this.bulkSelection.has(id);
        const menu = document.createElement('ul');
        menu.className = 'nemo-context-menu';
        let itemsHTML = '';

        if (isBulk) {
            itemsHTML = `<li data-action="bulk_move"><i class="fa-solid fa-folder-plus"></i><span>Move ${this.bulkSelection.size} items...</span></li><li data-action="bulk_delete"><i class="fa-solid fa-trash-can"></i><span>Delete ${this.bulkSelection.size} items</span></li>`;
        } else if (type === 'folder') {
            itemsHTML = `<li data-action="rename_folder" data-id="${id}"><i class="fa-solid fa-i-cursor"></i><span>Rename</span></li><li data-action="set_folder_color" data-id="${id}"><i class="fa-solid fa-palette"></i><span>Set Color</span></li><li data-action="delete_folder" data-id="${id}"><i class="fa-solid fa-trash-can"></i><span>Delete</span></li>`;
        } else if (type === 'preset') {
            // Check if preset is favorited
            const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PRESETS_KEY) || '[]');
            const isFavorite = favorites.includes(id);
            const favoriteAction = isFavorite ? 'unfavorite' : 'favorite';
            const favoriteText = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
            const favoriteIcon = isFavorite ? 'fa-star-half-stroke' : 'fa-star';
            
            itemsHTML = `<li data-action="${favoriteAction}" data-id="${id}"><i class="fa-solid ${favoriteIcon}"></i><span>${favoriteText}</span></li><li data-action="set_image" data-id="${id}"><i class="fa-solid fa-image"></i><span>Set Image</span></li><li data-action="add_to_folder" data-id="${id}"><i class="fa-solid fa-folder-plus"></i><span>Move to Folder...</span></li><li data-action="remove_from_folder" data-id="${id}"><i class="fa-solid fa-folder-minus"></i><span>Remove from Folder</span></li>`;
        }
        menu.innerHTML = itemsHTML;

        const popupContainer = item.closest('.popup');
        if (popupContainer) {
            popupContainer.appendChild(menu);
            const popupRect = popupContainer.getBoundingClientRect();
            menu.style.left = `${e.clientX - popupRect.left}px`;
            menu.style.top = `${e.clientY - popupRect.top}px`;
        } else {
            // Fallback if not in a popup (should not happen with callGenericPopup)
            document.body.appendChild(menu);
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
        }
        menu.style.display = 'block';

        menu.addEventListener('click', (me) => {
            const actionTarget = me.target.closest('li[data-action]');
            if (actionTarget) this.runContextMenuAction(actionTarget.dataset.action, actionTarget.dataset.id);
            this.hideContextMenu();
        }, { once: true });
    }
    
    async runContextMenuAction(action, id) {
        switch (action) {
            case 'favorite': {
                this.togglePresetFavorite(id);
                break;
            }
            case 'unfavorite': {
                this.togglePresetFavorite(id);
                break;
            }
            case 'rename_folder': {
                const folder = this.metadata.folders[id];
                if (!folder) return;
                const newName = await callGenericPopup('Enter new folder name:', POPUP_TYPE.INPUT, folder.name);
                if (newName && newName !== folder.name) {
                    folder.name = newName; this.updateMetadataTimestamp(id, 'folder'); this.saveMetadata(); this.render();
                }
                break;
            }
            case 'delete_folder': {
                const confirmed = await callGenericPopup(`Delete "${this.metadata.folders[id].name}"? Presets inside will become unassigned.`, POPUP_TYPE.CONFIRM);
                if (confirmed) {
                    Object.values(this.metadata.presets).forEach(p => { if (p.folderId === id) delete p.folderId; });
                    delete this.metadata.folders[id]; this.saveMetadata(); this.render();
                }
                break;
            }
            case 'set_image': { this.promptForLocalImage(id); break; }
            case 'set_folder_color': {
                const currentFolder = this.metadata.folders[id];
                const selectedColor = await showColorPickerPopup(currentFolder.color, `Set Color for "${currentFolder.name}"`);
                if (selectedColor !== null) {
                    this.metadata.folders[id].color = selectedColor; this.updateMetadataTimestamp(id, 'folder'); this.saveMetadata(); this.render();
                }
                break;
            }
            case 'add_to_folder': { this.moveItemToFolderDialog([id]); break; }
            case 'remove_from_folder': {
                if (this.metadata.presets[id]?.folderId) {
                    delete this.metadata.presets[id].folderId; this.updateMetadataTimestamp(id, 'preset'); this.saveMetadata(); this.render();
                }
                break;
            }
            case 'bulk_move': { this.moveItemToFolderDialog(Array.from(this.bulkSelection)); break; }
            case 'bulk_delete': {
                const confirmed = await callGenericPopup(`Delete ${this.bulkSelection.size} selected items? This cannot be undone.`, POPUP_TYPE.CONFIRM);
                if (confirmed) {
                    this.bulkSelection.forEach(itemId => {
                        if (this.metadata.presets[itemId]) delete this.metadata.presets[itemId];
                        if (this.metadata.folders[itemId]) delete this.metadata.folders[itemId];
                    });
                    this.saveMetadata(); this.bulkSelection.clear(); this.render();
                }
                break;
            }
        }
    }
    hideContextMenu() { document.querySelector('.nemo-context-menu')?.remove(); }
    async createNewFolder() {
        const name = await callGenericPopup('New Folder Name:', POPUP_TYPE.INPUT, 'New Folder');
        if (!name) return;
        const newId = generateUUID(); const parentId = this.currentPath[this.currentPath.length - 1].id;
        const now = new Date().toISOString(); this.metadata.folders[newId] = { id: newId, name, parentId, createdAt: now, lastModified: now };
        this.saveMetadata(); this.render();
    }
    promptForLocalImage(presetId) {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.style.display = 'none'; document.body.appendChild(input);
        input.onchange = () => {
            const file = input.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.metadata.presets[presetId] = this.metadata.presets[presetId] || {};
                    this.metadata.presets[presetId].imageUrl = e.target.result;
                    this.updateMetadataTimestamp(presetId, 'preset'); this.saveMetadata(); this.render();
                };
                reader.readAsDataURL(file);
            }
            document.body.removeChild(input);
        };
        input.click();
    }
    updateLoadButton() {
        const btn = this.navigatorElement.querySelector('#navigator-load-btn'); if (!btn) return;
        const selectedCount = this.bulkSelection.size;
        if (selectedCount > 1) {
            btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-ban"></i> ${selectedCount} items selected`;
        } else if (this.selectedPreset.value !== null) {
            btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-upload"></i> Load Selected Preset`;
        } else {
            btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-upload"></i> Load Selected Preset`;
        }
    }
    async loadSelectedPreset() {
        if (this.selectedPreset.value === null) return;
        const select = document.querySelector(`select[data-preset-manager-for="${this.apiType}"]`);
        if (select) {
            select.value = this.selectedPreset.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            // The popup will be closed by the onclose handler we set up.
            // Find the close button of the generic popup and click it.
            const popupCloseButton = this.navigatorElement.closest('.popup_outer, dialog.popup')?.querySelector('.popup-button-close');
            if(popupCloseButton) popupCloseButton.click();
        } else {
            callGenericPopup(`Could not find the preset dropdown for "${this.apiType}".`, 'error');
        }
    }
    loadMetadata() {
        try { const stored = localStorage.getItem(NEMO_METADATA_KEY); if (stored) { this.metadata = JSON.parse(stored); this.metadata.folders = this.metadata.folders || {}; this.metadata.presets = this.metadata.presets || {}; } }
        catch (ex) { console.error(`${LOG_PREFIX} Failed to load navigator metadata.`, ex); this.metadata = { folders: {}, presets: {} }; }
    }
    saveMetadata() { localStorage.setItem(NEMO_METADATA_KEY, JSON.stringify(this.metadata)); }
    updateMetadataTimestamp(id, type) { const item = (type === 'folder') ? this.metadata.folders[id] : this.metadata.presets[id]; if (item) item.lastModified = new Date().toISOString(); }
    async moveItemToFolder(itemId, folderId) {
        const itemType = this.metadata.folders[itemId] ? 'folder' : 'preset';
        if (itemType === 'folder') { this.metadata.folders[itemId].parentId = folderId; }
        else { this.metadata.presets[itemId] = this.metadata.presets[itemId] || {}; this.metadata.presets[itemId].folderId = folderId; }
        this.updateMetadataTimestamp(itemId, itemType); this.saveMetadata(); this.render();
    }
    async moveItemToFolderDialog(itemIds) {
        const folderNames = Object.values(this.metadata.folders).map(f => f.name).join(', ');
        if (!folderNames) { callGenericPopup("No folders created yet. Create a folder first.", 'info'); return; }
        const targetName = await callGenericPopup(`Enter folder name to move to:\n(${folderNames})`, POPUP_TYPE.INPUT);
        const targetFolder = Object.values(this.metadata.folders).find(f => f.name.toLowerCase() === targetName?.toLowerCase());
        if (targetFolder) {
            itemIds.forEach(id => {
                const isFolder = !!this.metadata.folders[id];
                if (isFolder) { this.metadata.folders[id].parentId = targetFolder.id; this.updateMetadataTimestamp(id, 'folder'); }
                else { this.metadata.presets[id] = this.metadata.presets[id] || {}; this.metadata.presets[id].folderId = targetFolder.id; this.updateMetadataTimestamp(id, 'preset'); }
            });
            this.saveMetadata(); this.render();
        } else if (targetName) {
            callGenericPopup(`Folder "${targetName}" not found.`, 'error');
        }
    }
    toggleBulkSelection(id) { if (this.bulkSelection.has(id)) { this.bulkSelection.delete(id); } else { this.bulkSelection.add(id); } this.updateBulkSelectionVisuals(); }
    handleShiftClick(clickedItem) {
        const allVisibleItems = Array.from(this.mainView.querySelectorAll('.grid-item'));
        const startIndex = allVisibleItems.indexOf(this.lastSelectedItem); const endIndex = allVisibleItems.indexOf(clickedItem);
        if (startIndex === -1 || endIndex === -1) return;
        const [start, end] = [startIndex, endIndex].sort((a, b) => a - b);
        for (let i = start; i <= end; i++) { this.bulkSelection.add(allVisibleItems[i].dataset.id); }
        this.updateBulkSelectionVisuals();
    }
    updateBulkSelectionVisuals() { this.mainView.querySelectorAll('.grid-item').forEach(el => el.classList.toggle('bulk-selected', this.bulkSelection.has(el.dataset.id))); }
    handleKeyDown(e) {
        if (e.key === ' ' && this.selectedPreset.name && !e.target.matches('input, textarea')) {
            e.preventDefault();
            const presetData = this.allPresets.find(p => p.name === this.selectedPreset.name);
            if (presetData) {
                const presetContent = oai_settings[presetData.value];
                const content = presetContent ? JSON.stringify(presetContent, null, 2) : 'Could not load preset content.';
                callGenericPopup(`<pre>${content.replace(/</g, "<")}</pre>`, POPUP_TYPE.DISPLAY, `Quick Look: ${presetData.name}`, { wide: true });
            }
        }
    }
    toggleViewMode() { this.viewMode = (this.viewMode === 'grid') ? 'list' : 'grid'; this.render(); }
    updateHeaderControls() {
        const viewBtn = this.navigatorElement.querySelector('#navigator-view-toggle-btn i');
        viewBtn.className = `fa-solid ${this.viewMode === 'grid' ? 'fa-list' : 'fa-grip'}`;
        viewBtn.parentElement.title = `Switch to ${this.viewMode === 'grid' ? 'List' : 'Grid'} View`;
    }
    showSortMenu(e) {
        e.stopPropagation(); this.hideContextMenu();
        const options = { 'name-asc': 'Name (A-Z)', 'name-desc': 'Name (Z-A)', 'date-desc': 'Date Modified (Newest)', 'date-asc': 'Date Modified (Oldest)' };
        const menu = document.createElement('ul'); menu.className = 'nemo-context-menu';
        menu.innerHTML = Object.entries(options).map(([key, value]) => `<li data-action="sort" data-value="${key}" class="${this.currentSort === key ? 'active' : ''}">${value}</li>`).join('');
        this.showMiniMenu(e.currentTarget, menu);
        menu.addEventListener('click', (me) => {
            const li = me.target.closest('li[data-action="sort"]');
            if (li) { this.currentSort = li.dataset.value; this.render(); }
            this.hideContextMenu();
        });
    }
    showFilterMenu(e) {
        e.stopPropagation(); this.hideContextMenu();
        const options = { 'all': 'All Items', 'favorites': '⭐ Favorites', 'uncategorized': 'Uncategorized', 'has-image': 'With Images' };
        const menu = document.createElement('ul'); menu.className = 'nemo-context-menu';
        menu.innerHTML = Object.entries(options).map(([key, value]) => `<li data-action="filter" data-value="${key}" class="${this.currentFilter === key ? 'active' : ''}">${value}</li>`).join('');
        this.showMiniMenu(e.currentTarget, menu);
        menu.addEventListener('click', (me) => {
            const li = me.target.closest('li[data-action="filter"]');
            if (li) { this.currentFilter = li.dataset.value; this.render(); }
            this.hideContextMenu();
        });
    }
    showMiniMenu(anchor, menu) {
        const popupContainer = anchor.closest('.popup');
        popupContainer.appendChild(menu);
        const anchorRect = anchor.getBoundingClientRect();
        const popupRect = popupContainer.getBoundingClientRect();
        menu.style.left = `${anchorRect.left - popupRect.left}px`;
        menu.style.top = `${anchorRect.bottom - popupRect.top + 5}px`;
        menu.style.display = 'block';
    }
    async importPreset() {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,.settings'; input.style.display = 'none';
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) { if (document.body.contains(input)) document.body.removeChild(input); return; }
            const fileName = file.name.replace(/\.[^/.]+$/, "");
            try {
                const presetBody = JSON.parse(await file.text());
                if (typeof presetBody.temp !== 'number' && typeof presetBody.temperature !== 'number') throw new Error("Invalid preset file.");
                if (Object.keys(openai_setting_names).includes(fileName)) {
                    if (!await callGenericPopup(`Preset "${fileName}" already exists. Overwrite?`, POPUP_TYPE.CONFIRM)) { if (document.body.contains(input)) document.body.removeChild(input); return; }
                }
                const saveResponse = await fetch(`/api/presets/save-openai?name=${encodeURIComponent(fileName)}`, { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify(presetBody) });
                if (!saveResponse.ok) throw new Error(`Server failed to save: ${await saveResponse.text()}`);
                const { name: newName, key: newKey } = await saveResponse.json();
                if (!newName || !newKey) throw new Error("Server response missing details.");
                openai_setting_names[newName] = newKey; oai_settings[newKey] = presetBody;
                const select = document.querySelector(`select[data-preset-manager-for="${this.apiType}"]`);
                if (select) {
                    // Check if option already exists to avoid duplicates
                    if (!select.querySelector(`option[value="${newKey}"]`)) {
                        select.appendChild(new Option(newName, newKey));
                    }
                }
                await callGenericPopup(`Preset "${fileName}" imported.`, 'success');
                this.allPresets = await this.fetchPresetList(); this.render();
            } catch (ex) { console.error(`${LOG_PREFIX} Preset import error:`, ex); callGenericPopup(`Import error: ${ex.message}`, 'error'); }
            finally { if (document.body.contains(input)) document.body.removeChild(input); }
        };
        document.body.appendChild(input); input.click();
    }

    togglePresetFavorite(presetName) {
        const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PRESETS_KEY) || '[]');
        const index = favorites.indexOf(presetName);
        
        if (index === -1) {
            favorites.push(presetName);
        } else {
            favorites.splice(index, 1);
        }
        
        localStorage.setItem(NEMO_FAVORITE_PRESETS_KEY, JSON.stringify(favorites));
        
        // Trigger favorites update event
        eventSource.emit(event_types.NEMO_FAVORITES_UPDATED);
        
        // Re-render to update the star icons and favorites sidebar
        this.render();
        this.renderFavoritesSidebar();
    }

    renderFavoritesSidebar() {
        const favoritesList = this.navigatorElement.querySelector('#navigator-favorites-list');
        if (!favoritesList) return;

        const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PRESETS_KEY) || '[]');
        favoritesList.innerHTML = '';

        if (favorites.length === 0) {
            favoritesList.innerHTML = '<div class="no-favorites">No favorites yet</div>';
            return;
        }

        favorites.forEach(presetName => {
            const preset = this.allPresets.find(p => p.name === presetName);
            console.log(`${LOG_PREFIX} Looking for preset:`, {
                presetName: presetName,
                found: !!preset,
                allPresetsCount: this.allPresets.length,
                samplePreset: this.allPresets[0]
            });
            if (preset) {
                const favoriteItem = document.createElement('div');
                favoriteItem.className = 'navigator-favorite-item';
                favoriteItem.innerHTML = `
                    <div class="favorite-item-icon">
                        <i class="fa-solid fa-file-lines"></i>
                    </div>
                    <div class="favorite-item-name" title="${preset.name}">${preset.name}</div>
                    <button class="favorite-remove-btn" title="Remove from favorites">
                        <i class="fa-solid fa-times"></i>
                    </button>
                `;
                favoriteItem.addEventListener('click', () => {
                    // Select this preset
                    this.selectedPreset = { value: preset.value, name: preset.name };
                    this.render();
                });
                
                favoriteItem.addEventListener('dblclick', () => {
                    // Select and load this preset
                    this.selectedPreset = { value: preset.value, name: preset.name };
                    this.updateLoadButton();
                    this.loadSelectedPreset();
                });
                
                // Add remove button event listener
                const removeBtn = favoriteItem.querySelector('.favorite-remove-btn');
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the item click
                    this.togglePresetFavorite(preset.name);
                });
                
                favoritesList.appendChild(favoriteItem);
            }
        });
    }
}

function renderFavorites(apiType) {
    const container = document.getElementById(`nemo-favorites-container-${apiType}`);
    const select = document.querySelector(`select[data-preset-manager-for="${apiType}"]`);
    if (!container || !select) return;

    container.innerHTML = '';
    const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PRESETS_KEY) || '[]');
    if (favorites.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    for (const presetId of favorites) {
        const option = Array.from(select.options).find(opt => opt.value === presetId);
        if (option) {
            const button = document.createElement('div');
            button.className = 'nemo-favorite-preset-button';
            button.textContent = option.textContent;
            button.title = `Load preset: ${option.textContent}`;
            button.addEventListener('click', () => {
                select.value = presetId;
                select.dispatchEvent(new Event('change'));
            });
            container.appendChild(button);
        }
    }
}

export function initPresetNavigatorForApi(apiType) {
    const selector = `select[data-preset-manager-for="${apiType}"]`;
    const originalSelect = document.querySelector(selector);
    if (!originalSelect || originalSelect.dataset.nemoPatched) return;
    originalSelect.dataset.nemoPatched = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'nemo-preset-selector-wrapper';
    const browseButton = document.createElement('button');
    browseButton.textContent = 'Browse...';
    browseButton.className = 'menu_button interactable';
    browseButton.addEventListener('click', () => {
        const navigator = new PresetNavigator(apiType);
        navigator.open();
    });
    originalSelect.parentElement.insertBefore(wrapper, originalSelect);
    wrapper.appendChild(originalSelect);
    wrapper.appendChild(browseButton);

    const favoritesContainer = document.createElement('div');
    favoritesContainer.id = `nemo-favorites-container-${apiType}`;
    favoritesContainer.className = 'nemo-favorites-container';
    wrapper.parentElement.insertBefore(favoritesContainer, wrapper.nextSibling);

    renderFavorites(apiType);
    eventSource.on(event_types.NEMO_FAVORITES_UPDATED, () => renderFavorites(apiType));
}