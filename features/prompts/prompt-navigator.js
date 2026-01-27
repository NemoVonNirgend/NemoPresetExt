import { callGenericPopup, POPUP_TYPE } from '../../../../../popup.js';
import { LOG_PREFIX, generateUUID, debounce } from '../../core/utils.js';
import { promptManager } from '../../../../../openai.js';

// New storage keys for prompt navigator
const NEMO_PROMPT_METADATA_KEY = 'nemoPromptNavigatorMetadata';
const NEMO_FAVORITE_PROMPTS_KEY = 'nemo-favorite-prompts';

export class PromptNavigator {
    constructor() {
        this.navigatorElement = null;
        this.mainView = null;
        this.breadcrumbs = null;
        this.searchInput = null;
        this.searchClearBtn = null;
        
        this.metadata = { folders: {}, prompts: {} };
        this.currentPath = [{ id: 'root', name: 'Home' }];
        this.allPrompts = [];
        this.selectedPrompt = { identifier: null, name: null };
        this.bulkSelection = new Set();
        this.lastSelectedItem = null;
        this.viewMode = 'grid';
        this.currentSort = 'name-asc';
        this.currentFilter = 'all';
        this.debouncedRender = debounce(() => this.render(), 250);
    }

    async init() {
        const response = await fetch('scripts/extensions/third-party/NemoPresetExt/prompt-navigator.html');
        const htmlContent = await response.text();
        
        this.navigatorElement = document.createElement('div');
        this.navigatorElement.innerHTML = htmlContent;
        
        // Cache DOM elements
        this.mainView = this.navigatorElement.querySelector('#prompt-navigator-grid-view');
        this.breadcrumbs = this.navigatorElement.querySelector('#prompt-navigator-breadcrumbs');
        this.searchInput = this.navigatorElement.querySelector('#prompt-navigator-search-input');
        this.searchClearBtn = this.navigatorElement.querySelector('#prompt-navigator-search-clear');
        this.newFolderBtn = this.navigatorElement.querySelector('#prompt-navigator-new-folder-btn');
        this.viewToggleBtn = this.navigatorElement.querySelector('#prompt-navigator-view-toggle-btn');
        this.sortBtn = this.navigatorElement.querySelector('#prompt-navigator-sort-btn');
        this.filterBtn = this.navigatorElement.querySelector('#prompt-navigator-filter-btn');
        this.importBtn = this.navigatorElement.querySelector('#prompt-navigator-import-btn');
        this.loadBtn = this.navigatorElement.querySelector('#prompt-navigator-load-btn');

        // Add event listeners
        this.newFolderBtn.addEventListener('click', () => this.createNewFolder());
        this.searchInput.addEventListener('input', this.debouncedRender);
        this.searchClearBtn.addEventListener('click', () => { this.searchInput.value = ''; this.render(); });
        this.viewToggleBtn.addEventListener('click', () => this.toggleViewMode());
        this.sortBtn.addEventListener('click', (e) => this.showSortMenu(e));
        this.filterBtn.addEventListener('click', (e) => this.showFilterMenu(e));
        this.importBtn.addEventListener('click', () => this.showImportDialog());
        this.loadBtn.addEventListener('click', () => this.loadSelectedPrompt());

        this.mainView.addEventListener('click', (e) => this.handleGridClick(e));
        this.mainView.addEventListener('dblclick', (e) => this.handleGridDoubleClick(e));
        this.navigatorElement.addEventListener('contextmenu', (e) => this.handleGridContextMenu(e));

        // Setup event listeners for hiding the context menu
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nemo-context-menu')) {
                this.hideContextMenu();
            }
        });
        
        document.addEventListener('contextmenu', (e) => {
            if (!e.target.closest('.nemo-prompt-navigator-content-wrapper')) {
                this.hideContextMenu();
            }
        });
    }

    async open() {
        await this.init();
        this.loadMetadata();
        this.allPrompts = await this.fetchPromptList();
        this.searchInput.value = '';
        this.bulkSelection.clear();
        this.render();
        
        callGenericPopup(this.navigatorElement, POPUP_TYPE.DISPLAY, 'Prompt Navigator', {
            wide: true,
            large: true,
            addCloseButton: true,
            onclose: () => this.cleanup()
        });
    }

    cleanup() {
        this.selectedPrompt = { identifier: null, name: null };
        this.mainView.innerHTML = '';
        this.currentPath = [{ id: 'root', name: 'Home' }];
        this.hideContextMenu();
    }

    async fetchPromptList() {
        // Get prompts from the completion prompt manager
        const promptsContainer = document.querySelector('#completion_prompt_manager_list');
        if (!promptsContainer) {
            console.error(`${LOG_PREFIX} Could not find completion prompt manager`);
            return [];
        }

        const promptItems = promptsContainer.querySelectorAll('li.completion_prompt_manager_prompt');
        const prompts = [];

        promptItems.forEach(item => {
            const nameLink = item.querySelector('span.completion_prompt_manager_prompt_name a');
            const promptName = nameLink ? nameLink.textContent.trim() : '';
            const identifier = item.dataset.pmIdentifier || '';
            const role = item.dataset.pmRole || '';
            
            if (promptName && identifier) {
                prompts.push({
                    identifier: identifier,
                    name: promptName,
                    role: role,
                    element: item
                });
            }
        });

        return prompts;
    }

    loadMetadata() {
        try {
            const savedMetadata = localStorage.getItem(NEMO_PROMPT_METADATA_KEY);
            if (savedMetadata) {
                this.metadata = JSON.parse(savedMetadata);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error loading prompt navigator metadata:`, error);
            this.metadata = { folders: {}, prompts: {} };
        }
    }

    saveMetadata() {
        try {
            localStorage.setItem(NEMO_PROMPT_METADATA_KEY, JSON.stringify(this.metadata));
        } catch (error) {
            console.error(`${LOG_PREFIX} Error saving prompt navigator metadata:`, error);
        }
    }

    updateMetadataTimestamp(id, type) {
        const now = new Date().toISOString();
        if (type === 'folder' && this.metadata.folders[id]) {
            this.metadata.folders[id].lastModified = now;
        } else if (type === 'prompt' && this.metadata.prompts[id]) {
            this.metadata.prompts[id].lastModified = now;
        }
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
        
        // Ensure all prompts have metadata entries
        this.allPrompts.forEach(p => {
            if (!this.metadata.prompts[p.identifier]) {
                this.metadata.prompts[p.identifier] = { createdAt: now, lastModified: now };
                metadataWasUpdated = true;
            }
        });

        if (metadataWasUpdated) this.saveMetadata();

        const currentFolderId = this.currentPath[this.currentPath.length - 1].id;
        const searchTerm = this.searchInput.value.toLowerCase().trim();

        let items = [];
        
        // Add folders to the items list
        Object.values(this.metadata.folders)
            .filter(folder => folder.parentId === currentFolderId)
            .forEach(folder => items.push({ type: 'folder', data: folder, id: folder.id, name: folder.name }));

        // Add prompts to the items list
        this.allPrompts.forEach(p => {
            const meta = this.metadata.prompts[p.identifier] || {};
            const isUncategorized = !meta.folderId;
            const isInCurrentFolder = meta.folderId === currentFolderId;
            const isInRootAndCurrentIsRoot = isUncategorized && currentFolderId === 'root';
            
            if (isInCurrentFolder || isInRootAndCurrentIsRoot) {
                items.push({ type: 'prompt', data: p, id: p.identifier, name: p.name });
            }
        });

        // Filtering
        items = items.filter(item => {
            if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) return false;
            if (this.currentFilter === 'uncategorized' && item.type === 'prompt' && item.data.folderId) return false;
            if (this.currentFilter === 'favorites') {
                if (item.type === 'folder') return false; // Only show prompts in favorites view
                const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PROMPTS_KEY) || '[]');
                return favorites.includes(item.data.identifier);
            }
            return true;
        });

        // Sorting
        items.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            
            switch (this.currentSort) {
                case 'name-desc': return b.name.localeCompare(a.name);
                case 'name-asc':
                default: return a.name.localeCompare(b.name);
            }
        });

        this.mainView.className = `view-mode-${this.viewMode}`;
        const fragment = document.createDocumentFragment();

        if (items.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'prompt-navigator-empty-state';
            emptyEl.innerHTML = searchTerm ? `<h3>No results for "${searchTerm}"</h3>` : `<h3>This folder is empty.</h3>`;
            fragment.appendChild(emptyEl);
        } else {
            items.forEach(item => {
                const itemEl = this.createGridItem(item);
                fragment.appendChild(itemEl);
            });
        }
        
        this.mainView.innerHTML = '';
        this.mainView.appendChild(fragment);
        this.renderFavoritesSidebar();
    }

    createGridItem(item) {
        const { type, data, id } = item;
        const itemEl = document.createElement('div');
        itemEl.className = `grid-item ${type}`;
        itemEl.dataset.type = type;
        itemEl.dataset.id = id;
        itemEl.draggable = true;

        // Set folder color as CSS variable for inheritance
        if (data.color) {
            itemEl.style.setProperty('--nemo-folder-color', data.color);
        }

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        icon.innerHTML = `<i class="fa-solid ${type === 'folder' ? 'fa-folder' : 'fa-file-text'}"></i>`;

        // Apply color directly to icon if it's a folder with custom color
        if (type === 'folder' && data.color) {
            icon.style.color = data.color;
        }
        
        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = data.name;
        const lastMod = data.lastModified ? new Date(data.lastModified).toLocaleDateString() : 'N/A';
        nameEl.title = `${data.name}\nModified: ${lastMod}`;
        
        itemEl.appendChild(icon);
        itemEl.appendChild(nameEl);

        // Add favorite toggle button for prompts
        if (type === 'prompt') {
            const favoriteBtn = document.createElement('button');
            favoriteBtn.className = 'menu_button nemo-favorite-btn';
            favoriteBtn.title = 'Toggle favorite';
            
            const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PROMPTS_KEY) || '[]');
            const isFavorite = favorites.includes(data.identifier);
            favoriteBtn.innerHTML = `<i class="fa-solid fa-star ${isFavorite ? 'favorite-active' : ''}"></i>`;
            
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePromptFavorite(data.identifier);
            });
            
            itemEl.appendChild(favoriteBtn);
        }

        if (type === 'prompt' && this.selectedPrompt.identifier === id) itemEl.classList.add('selected');
        return itemEl;
    }

    toggleViewMode() {
        this.viewMode = (this.viewMode === 'grid') ? 'list' : 'grid';
        this.render();
    }

    updateHeaderControls() {
        const viewIcon = this.viewToggleBtn.querySelector('i');
        viewIcon.className = `fa-solid ${this.viewMode === 'grid' ? 'fa-list' : 'fa-grip'}`;
        this.viewToggleBtn.title = `Switch to ${this.viewMode === 'grid' ? 'List' : 'Grid'} View`;
    }

    updateLoadButton() {
        this.loadBtn.disabled = !this.selectedPrompt.identifier;
    }

    async loadSelectedPrompt() {
        if (!this.selectedPrompt.identifier) return;
        
        // Find the prompt element and trigger its inspection
        const promptEl = document.querySelector(`li[data-pm-identifier="${this.selectedPrompt.identifier}"]`);
        if (promptEl) {
            const inspectLink = promptEl.querySelector('a.prompt-manager-inspect-action');
            if (inspectLink) {
                inspectLink.click();
                // Close the navigator popup
                const closeButton = this.navigatorElement.closest('.popup_outer, dialog.popup')?.querySelector('.popup-button-close');
                if (closeButton) closeButton.click();
            }
        }
    }

    async createNewFolder() {
        const name = await callGenericPopup('New Folder Name:', POPUP_TYPE.INPUT, 'New Folder');
        if (!name) return;
        
        const newId = generateUUID();
        const parentId = this.currentPath[this.currentPath.length - 1].id;
        const now = new Date().toISOString();
        
        this.metadata.folders[newId] = { 
            id: newId, 
            name, 
            parentId, 
            createdAt: now, 
            lastModified: now 
        };
        
        this.saveMetadata();
        this.render();
    }

    togglePromptFavorite(identifier) {
        const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PROMPTS_KEY) || '[]');
        const index = favorites.indexOf(identifier);
        
        if (index === -1) {
            favorites.push(identifier);
        } else {
            favorites.splice(index, 1);
        }
        
        localStorage.setItem(NEMO_FAVORITE_PROMPTS_KEY, JSON.stringify(favorites));
        
        // Re-render to update the star icons and favorites sidebar
        this.render();
        this.renderFavoritesSidebar();
    }

    renderFavoritesSidebar() {
        const favoritesList = this.navigatorElement.querySelector('#prompt-navigator-favorites-list');
        if (!favoritesList) return;

        const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PROMPTS_KEY) || '[]');
        favoritesList.innerHTML = '';

        if (favorites.length === 0) {
            favoritesList.innerHTML = '<div class="no-favorites">No favorites yet</div>';
            return;
        }

        favorites.forEach(identifier => {
            const prompt = this.allPrompts.find(p => p.identifier === identifier);
            if (prompt) {
                const favoriteItem = document.createElement('div');
                favoriteItem.className = 'navigator-favorite-item';
                favoriteItem.innerHTML = `
                    <div class="favorite-item-icon">
                        <i class="fa-solid fa-file-text"></i>
                    </div>
                    <div class="favorite-item-name" title="${prompt.name}">${prompt.name}</div>
                    <button class="favorite-remove-btn" title="Remove from favorites">
                        <i class="fa-solid fa-times"></i>
                    </button>
                `;
                
                favoriteItem.addEventListener('click', () => {
                    // Select this prompt
                    this.selectedPrompt = { identifier: prompt.identifier, name: prompt.name };
                    this.render();
                });
                
                favoriteItem.addEventListener('dblclick', () => {
                    // Select and load this prompt
                    this.selectedPrompt = { identifier: prompt.identifier, name: prompt.name };
                    this.updateLoadButton();
                    this.loadSelectedPrompt();
                });
                
                // Add remove button event listener
                const removeBtn = favoriteItem.querySelector('.favorite-remove-btn');
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the item click
                    this.togglePromptFavorite(identifier);
                });
                
                favoritesList.appendChild(favoriteItem);
            }
        });
    }

    handleGridClick(e) {
        const item = e.target.closest('.grid-item');
        if (!item) return;

        const { type, id } = item.dataset;

        if (e.shiftKey && this.lastSelectedItem) {
            this.handleShiftClick(item);
        } else if (e.ctrlKey || e.metaKey) {
            this.toggleBulkSelection(id);
            this.lastSelectedItem = item;
        } else {
            this.bulkSelection.clear();
            if (type === 'folder') {
                const folder = this.metadata.folders[id];
                if (folder) {
                    this.currentPath.push({ id: folder.id, name: folder.name });
                    this.render();
                }
            } else if (type === 'prompt') {
                this.mainView.querySelectorAll('.grid-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                const prompt = this.allPrompts.find(p => p.identifier === id);
                this.selectedPrompt = { identifier: id, name: prompt ? prompt.name : '' };
                this.lastSelectedItem = item;
            }
        }
        this.updateBulkSelectionVisuals();
        this.updateLoadButton();
    }

    handleGridDoubleClick(e) {
        const item = e.target.closest('.grid-item');
        if (!item || item.dataset.type !== 'prompt') return;
        
        // First select the prompt
        const id = item.dataset.id;
        this.mainView.querySelectorAll('.grid-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        const prompt = this.allPrompts.find(p => p.identifier === id);
        this.selectedPrompt = { identifier: id, name: prompt ? prompt.name : '' };
        this.updateLoadButton();
        
        // Then load it
        this.loadSelectedPrompt();
    }

    handleGridContextMenu(e) {
        e.preventDefault();
        this.hideContextMenu(); // Hide any existing menu
        const item = e.target.closest('.grid-item');
        if (!item) return;

        const { type, id } = item.dataset;
        const menu = document.createElement('ul');
        menu.className = 'nemo-context-menu';
        let itemsHTML = '';

        if (type === 'folder') {
            itemsHTML = `
                <li data-action="rename_folder" data-id="${id}">
                    <i class="fa-solid fa-i-cursor"></i><span>Rename</span>
                </li>
                <li data-action="set_folder_color" data-id="${id}">
                    <i class="fa-solid fa-palette"></i><span>Set Color</span>
                </li>
                <li data-action="delete_folder" data-id="${id}">
                    <i class="fa-solid fa-trash-can"></i><span>Delete</span>
                </li>
            `;
        } else if (type === 'prompt') {
            const favorites = JSON.parse(localStorage.getItem(NEMO_FAVORITE_PROMPTS_KEY) || '[]');
            const isFavorite = favorites.includes(id);
            const favoriteAction = isFavorite ? 'unfavorite' : 'favorite';
            const favoriteText = isFavorite ? 'Remove from Favorites' : 'Add to Favorites';
            const favoriteIcon = isFavorite ? 'fa-star-half-stroke' : 'fa-star';
            
            itemsHTML = `
                <li data-action="${favoriteAction}" data-id="${id}">
                    <i class="fa-solid ${favoriteIcon}"></i><span>${favoriteText}</span>
                </li>
                <li data-action="add_to_archive" data-id="${id}">
                    <i class="fa-solid fa-archive"></i><span>Add to Archive</span>
                </li>
                <li data-action="move_to_header" data-id="${id}">
                    <i class="fa-solid fa-arrow-up"></i><span>Move to Header</span>
                </li>
                <li data-action="add_to_folder" data-id="${id}">
                    <i class="fa-solid fa-folder-plus"></i><span>Move to Folder...</span>
                </li>
            `;
        }
        
        menu.innerHTML = itemsHTML;

        // Find the popup container - ST uses .popup_outer or dialog.popup
        const popupContainer = item.closest('.popup_outer, dialog.popup, .popup');
        if (popupContainer) {
            popupContainer.appendChild(menu);
            const popupRect = popupContainer.getBoundingClientRect();
            menu.style.left = `${e.clientX - popupRect.left}px`;
            menu.style.top = `${e.clientY - popupRect.top}px`;
        } else {
            // Fallback - append to body with fixed positioning
            document.body.appendChild(menu);
            menu.style.position = 'fixed';
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;
        }
        menu.style.display = 'block';

        menu.addEventListener('click', async (me) => {
            const actionTarget = me.target.closest('li[data-action]');
            if (actionTarget) {
                this.hideContextMenu(); // Hide first
                await this.runContextMenuAction(actionTarget.dataset.action, actionTarget.dataset.id);
            }
        }, { once: true });
    }

    async runContextMenuAction(action, id) {
        switch (action) {
            case 'favorite':
            case 'unfavorite': {
                this.togglePromptFavorite(id);
                break;
            }
            case 'add_to_archive': {
                await this.addPromptToArchive(id);
                break;
            }
            case 'move_to_header': {
                await this.movePromptToHeader(id);
                break;
            }
            case 'add_to_folder': {
                this.moveItemToFolderDialog([id]);
                break;
            }
            case 'rename_folder': {
                const folder = this.metadata.folders[id];
                if (!folder) return;
                const newName = await callGenericPopup('Enter new folder name:', POPUP_TYPE.INPUT, folder.name);
                if (newName && newName.trim() && newName !== folder.name) {
                    folder.name = newName.trim();
                    this.updateMetadataTimestamp(id, 'folder');
                    this.saveMetadata();
                    this.render();
                }
                break;
            }
            case 'set_folder_color': {
                const { showColorPickerPopup } = await import('../../../../../utils.js');
                const folder = this.metadata.folders[id];
                if (!folder) return;
                const color = await showColorPickerPopup(folder.color || '', 'Select Folder Color');
                if (color !== null) {
                    folder.color = color;
                    this.updateMetadataTimestamp(id, 'folder');
                    this.saveMetadata();
                    this.render();
                }
                break;
            }
            case 'delete_folder': {
                const folder = this.metadata.folders[id];
                if (!folder) return;
                const confirmed = await callGenericPopup(`Delete "${folder.name}"? Prompts inside will become unassigned.`, POPUP_TYPE.CONFIRM);
                if (confirmed) {
                    Object.values(this.metadata.prompts).forEach(prompt => {
                        if (prompt.folderId === id) {
                            delete prompt.folderId;
                        }
                    });
                    delete this.metadata.folders[id];
                    this.saveMetadata();
                    this.render();
                }
                break;
            }
        }
    }

    async moveItemToFolderDialog(itemIds) {
        const folderNames = Object.values(this.metadata.folders).map(f => f.name).join(', ');
        if (!folderNames) {
            callGenericPopup("No folders created yet. Create a folder first.", 'info');
            return;
        }
        
        const targetName = await callGenericPopup(`Enter folder name to move to:\n(${folderNames})`, POPUP_TYPE.INPUT);
        const targetFolder = Object.values(this.metadata.folders).find(f => f.name.toLowerCase() === targetName?.toLowerCase());
        
        if (targetFolder) {
            itemIds.forEach(id => {
                if (this.metadata.folders[id]) {
                    // Moving a folder
                    this.metadata.folders[id].parentId = targetFolder.id;
                    this.updateMetadataTimestamp(id, 'folder');
                } else {
                    // Moving a prompt
                    this.metadata.prompts[id] = this.metadata.prompts[id] || {};
                    this.metadata.prompts[id].folderId = targetFolder.id;
                    this.updateMetadataTimestamp(id, 'prompt');
                }
            });
            this.saveMetadata();
            this.bulkSelection.clear();
            this.updateBulkSelectionVisuals();
            this.render();
        } else if (targetName) {
            callGenericPopup(`Folder "${targetName}" not found.`, 'error');
        }
    }

    showSortMenu(e) {
        e.stopPropagation(); 
        this.hideContextMenu();
        const options = { 'name-asc': 'Name (A-Z)', 'name-desc': 'Name (Z-A)' };
        const menu = document.createElement('ul'); 
        menu.className = 'nemo-context-menu';
        menu.innerHTML = Object.entries(options).map(([key, value]) => 
            `<li data-action="sort" data-value="${key}" class="${this.currentSort === key ? 'active' : ''}">${value}</li>`
        ).join('');
        this.showMiniMenu(e.currentTarget, menu);
        menu.addEventListener('click', (me) => {
            const li = me.target.closest('li[data-action="sort"]');
            if (li) { this.currentSort = li.dataset.value; this.render(); }
            this.hideContextMenu();
        });
    }

    showFilterMenu(e) {
        e.stopPropagation(); 
        this.hideContextMenu();
        const options = { 'all': 'All Items', 'favorites': '⭐ Favorites', 'uncategorized': 'Uncategorized' };
        const menu = document.createElement('ul'); 
        menu.className = 'nemo-context-menu';
        menu.innerHTML = Object.entries(options).map(([key, value]) => 
            `<li data-action="filter" data-value="${key}" class="${this.currentFilter === key ? 'active' : ''}">${value}</li>`
        ).join('');
        this.showMiniMenu(e.currentTarget, menu);
        menu.addEventListener('click', (me) => {
            const li = me.target.closest('li[data-action="filter"]');
            if (li) { this.currentFilter = li.dataset.value; this.render(); }
            this.hideContextMenu();
        });
    }

    showMiniMenu(anchor, menu) {
        // Find the popup container - ST uses .popup_outer or dialog.popup
        const popupContainer = anchor.closest('.popup_outer, dialog.popup, .popup');
        if (popupContainer) {
            popupContainer.appendChild(menu);
            const anchorRect = anchor.getBoundingClientRect();
            const popupRect = popupContainer.getBoundingClientRect();
            menu.style.left = `${anchorRect.left - popupRect.left}px`;
            menu.style.top = `${anchorRect.bottom - popupRect.top + 5}px`;
        } else {
            // Fallback - append to body with fixed positioning
            document.body.appendChild(menu);
            menu.style.position = 'fixed';
            const anchorRect = anchor.getBoundingClientRect();
            menu.style.left = `${anchorRect.left}px`;
            menu.style.top = `${anchorRect.bottom + 5}px`;
        }
        menu.style.display = 'block';
    }

    hideContextMenu() {
        // Remove context menus from navigator element
        this.navigatorElement?.querySelectorAll('.nemo-context-menu').forEach(menu => menu.remove());
        // Also remove any context menus from document (in case they're attached elsewhere)
        document.querySelectorAll('.nemo-context-menu').forEach(menu => menu.remove());
    }

    // Selection Methods
    toggleBulkSelection(id) {
        const itemEl = this.mainView.querySelector(`.grid-item[data-id="${id}"]`);
        if (this.bulkSelection.has(id)) {
            this.bulkSelection.delete(id);
            itemEl?.classList.remove('bulk-selected');
        } else {
            this.bulkSelection.add(id);
            itemEl?.classList.add('bulk-selected');
        }
    }

    updateBulkSelectionVisuals() {
        this.mainView.querySelectorAll('.grid-item').forEach(el => {
            el.classList.toggle('bulk-selected', this.bulkSelection.has(el.dataset.id));
        });
    }

    handleShiftClick(clickedItem) {
        const allVisibleItems = Array.from(this.mainView.querySelectorAll('.grid-item'));
        const startIndex = allVisibleItems.indexOf(this.lastSelectedItem);
        const endIndex = allVisibleItems.indexOf(clickedItem);
        if (startIndex === -1 || endIndex === -1) return;

        const [start, end] = [startIndex, endIndex].sort((a, b) => a - b);
        for (let i = start; i <= end; i++) {
            this.bulkSelection.add(allVisibleItems[i].dataset.id);
        }
        this.updateBulkSelectionVisuals();
    }

    showHeaderSelectionDialog() {
        if (!this.selectedPromptData) return;

        // Get all headers/sections from the completion prompt manager
        const container = document.querySelector('#completion_prompt_manager_list');
        if (!container) {
            callGenericPopup('Completion prompt manager not found', 'error');
            return;
        }

        const headers = [];
        
        // Look for headers in sections (details.nemo-engine-section summary)
        const sections = container.querySelectorAll('details.nemo-engine-section');
        sections.forEach(section => {
            const headerItem = section.querySelector('summary li.completion_prompt_manager_prompt.nemo-header-item');
            if (headerItem) {
                const nameEl = headerItem.querySelector('.completion_prompt_manager_prompt_name a');
                const headerName = nameEl ? nameEl.textContent.trim() : 'Unknown Header';
                headers.push({
                    element: headerItem,
                    section: section,
                    name: headerName,
                    identifier: headerItem.dataset.pmIdentifier,
                    isInSection: true
                });
            }
        });
        
        // Also look for any flat headers that haven't been processed yet
        const flatHeaders = Array.from(container.querySelectorAll('li.completion_prompt_manager_prompt')).filter(item => {
            // Check if this is a header/divider by looking for typical header patterns
            const nameEl = item.querySelector('.completion_prompt_manager_prompt_name a');
            const name = nameEl ? nameEl.textContent.trim() : '';
            const isHeader = name.match(/^[-=⭐━+]{2,}/) || item.classList.contains('nemo-header-item');
            return isHeader && !item.closest('details.nemo-engine-section');
        });
        
        flatHeaders.forEach(header => {
            const nameEl = header.querySelector('.completion_prompt_manager_prompt_name a');
            const headerName = nameEl ? nameEl.textContent.trim() : 'Unknown Header';
            headers.push({
                element: header,
                section: null,
                name: headerName,
                identifier: header.dataset.pmIdentifier,
                isInSection: false
            });
        });

        if (headers.length === 0) {
            callGenericPopup('No headers found in the prompt manager. Headers are prompts that start with divider patterns like ===, ⭐─, or ━━.', 'info');
            return;
        }

        // Create the dialog
        const dialogHtml = `
            <div class="nemo-header-selection-dialog">
                <h3>Select Header Position</h3>
                <p>Choose where to move "${this.selectedPromptData.prompt.name}":</p>
                <div class="nemo-header-list" style="max-height: 300px; overflow-y: auto; margin: 15px 0;">
                    ${headers.map((header, index) => `
                        <div class="nemo-header-option" data-index="${index}" style="padding: 8px 12px; border: 1px solid var(--SmartThemeBorderColor); margin: 4px 0; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <i class="fa-solid ${header.isInSection ? 'fa-folder' : 'fa-file-lines'}"></i>
                            <span>${header.name}</span>
                            ${header.isInSection ? '<small style="opacity: 0.7;"> (in section)</small>' : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="nemo-header-actions" style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="nemo-header-cancel" class="menu_button caution">Cancel</button>
                    <button id="nemo-header-confirm" class="menu_button" disabled>Move Here</button>
                </div>
            </div>
        `;

        const dialogElement = document.createElement('div');
        dialogElement.innerHTML = dialogHtml;

        callGenericPopup(dialogElement, POPUP_TYPE.DISPLAY, 'Move to Header', {
            wide: false,
            large: false,
            addCloseButton: false
        });

        let selectedIndex = -1;
        const headerOptions = dialogElement.querySelectorAll('.nemo-header-option');
        const confirmBtn = dialogElement.querySelector('#nemo-header-confirm');
        const cancelBtn = dialogElement.querySelector('#nemo-header-cancel');

        // Add selection handling
        headerOptions.forEach((option, index) => {
            option.addEventListener('click', () => {
                // Clear previous selections
                headerOptions.forEach(opt => opt.style.backgroundColor = '');
                
                // Select current option
                option.style.backgroundColor = 'var(--SmartThemeQuoteColor)';
                selectedIndex = index;
                confirmBtn.disabled = false;
            });
        });

        const closeDialog = () => {
            const popup = dialogElement.closest('.popup_outer, dialog.popup');
            if (popup) {
                const closeButton = popup.querySelector('.popup-button-close');
                if (closeButton) closeButton.click();
            }
            this.selectedPromptData = null; // Clean up
        };

        confirmBtn.addEventListener('click', async () => {
            if (selectedIndex >= 0) {
                closeDialog();
                await this.movePromptToSelectedHeader(headers[selectedIndex]);
            }
        });

        cancelBtn.addEventListener('click', closeDialog);
    }

    async movePromptToSelectedHeader(selectedHeader) {
        try {
            if (!this.selectedPromptData) return;

            const { prompt, data } = this.selectedPromptData;
            
            console.log(`${LOG_PREFIX} Moving prompt "${prompt.name}" to header "${selectedHeader.name}"`);
            
            // Find the position after the selected header
            let targetPosition = selectedHeader.element;
            
            if (selectedHeader.isInSection) {
                // If it's in a section, we need to move within that section
                const section = selectedHeader.section;
                const sectionContent = section.querySelector('summary').nextElementSibling;
                if (sectionContent) {
                    targetPosition = sectionContent.firstElementChild || selectedHeader.element;
                }
            }

            // Use the prompt manager's move functionality if available
            if (typeof window.NemoPresetManager !== 'undefined' && window.NemoPresetManager.movePromptToPosition) {
                await window.NemoPresetManager.movePromptToPosition(data.identifier, selectedHeader.identifier);
            } else {
                // Fallback: try to manipulate the DOM directly
                const sourceElement = document.querySelector(`li[data-pm-identifier="${data.identifier}"]`);
                if (sourceElement && targetPosition) {
                    // Insert after the header
                    targetPosition.parentNode.insertBefore(sourceElement, targetPosition.nextSibling);
                }
            }

            callGenericPopup(`"${prompt.name}" moved to header "${selectedHeader.name}" successfully!`, 'success');
            
            // Refresh the prompt list in the navigator
            this.allPrompts = await this.fetchPromptList();
            this.render();
            
        } catch (error) {
            console.error(`${LOG_PREFIX} Error moving prompt to selected header:`, error);
            callGenericPopup('Error moving prompt to header', 'error');
        } finally {
            this.selectedPromptData = null; // Clean up
        }
    }

    async addPromptToArchive(promptId) {
        try {
            // Find the prompt data
            const prompt = this.allPrompts.find(p => p.identifier === promptId);
            if (!prompt) {
                callGenericPopup('Prompt not found', 'error');
                return;
            }

            // Get the prompt content from SillyTavern's prompt manager
            if (typeof promptManager !== 'undefined' && promptManager.serviceSettings?.prompts) {
                const promptData = promptManager.serviceSettings.prompts.find(p => p.identifier === promptId);
                if (!promptData) {
                    callGenericPopup('Prompt data not found', 'error');
                    return;
                }

                // Get the existing prompt library or create a new one
                const existingLibrary = JSON.parse(localStorage.getItem('nemoPromptSnapshotData') || '{}');
                const library = existingLibrary.prompts || {};

                // Create a unique key for the prompt (use name with timestamp if needed)
                let promptKey = prompt.name;
                let counter = 1;
                while (library[promptKey]) {
                    promptKey = `${prompt.name} (${counter})`;
                    counter++;
                }

                // Add the prompt to the library
                library[promptKey] = {
                    name: prompt.name,
                    role: prompt.role || 'user',
                    content: promptData.content || '',
                    identifier: prompt.identifier,
                    addedAt: new Date().toISOString(),
                    source: 'prompt-navigator'
                };

                // Save back to localStorage
                const updatedLibrary = {
                    ...existingLibrary,
                    prompts: library,
                    lastModified: new Date().toISOString()
                };

                localStorage.setItem('nemoPromptSnapshotData', JSON.stringify(updatedLibrary));

                callGenericPopup(`Prompt "${prompt.name}" added to archive successfully!`, 'success');
                
                console.log(`${LOG_PREFIX} Added prompt to archive:`, promptKey);
            } else {
                callGenericPopup('Prompt manager not available', 'error');
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error adding prompt to archive:`, error);
            callGenericPopup('Error adding prompt to archive', 'error');
        }
    }

    async showImportDialog() {
        try {
            // Get the prompt library from localStorage
            const libraryData = localStorage.getItem('nemoPromptSnapshotData');
            if (!libraryData) {
                callGenericPopup('No archived prompts found to import', 'info');
                return;
            }

            const library = JSON.parse(libraryData);
            const prompts = library.prompts || {};
            const promptNames = Object.keys(prompts);

            if (promptNames.length === 0) {
                callGenericPopup('No archived prompts found to import', 'info');
                return;
            }

            // Create a selection dialog
            const options = promptNames.map(name => `<option value="${name}">${name}</option>`).join('');
            const dialogHtml = `
                <div class="nemo-import-dialog">
                    <h3>Import Archived Prompt</h3>
                    <p>Select a prompt to import from your archive:</p>
                    <select id="nemo-import-prompt-select" class="text_pole" style="width: 100%; margin: 10px 0;">
                        ${options}
                    </select>
                    <div class="nemo-import-actions" style="margin-top: 15px;">
                        <button id="nemo-import-to-completion" class="menu_button">Import to Completion Prompts</button>
                        <button id="nemo-import-to-header" class="menu_button">Import to Header</button>
                        <button id="nemo-import-cancel" class="menu_button caution">Cancel</button>
                    </div>
                </div>
            `;

            const dialogElement = document.createElement('div');
            dialogElement.innerHTML = dialogHtml;

            callGenericPopup(dialogElement, POPUP_TYPE.DISPLAY, 'Import Prompt', {
                wide: false,
                large: false,
                addCloseButton: false
            });

            // Add event listeners to the buttons
            const importToCompletionBtn = dialogElement.querySelector('#nemo-import-to-completion');
            const importToHeaderBtn = dialogElement.querySelector('#nemo-import-to-header');
            const cancelBtn = dialogElement.querySelector('#nemo-import-cancel');
            const selectEl = dialogElement.querySelector('#nemo-import-prompt-select');

            const closeDialog = () => {
                const popup = dialogElement.closest('.popup_outer, dialog.popup');
                if (popup) {
                    const closeButton = popup.querySelector('.popup-button-close');
                    if (closeButton) closeButton.click();
                }
            };

            importToCompletionBtn.addEventListener('click', async () => {
                const selectedPrompt = selectEl.value;
                if (selectedPrompt) {
                    closeDialog();
                    await this.importPromptToCompletion(selectedPrompt, prompts[selectedPrompt]);
                }
            });

            importToHeaderBtn.addEventListener('click', async () => {
                const selectedPrompt = selectEl.value;
                if (selectedPrompt) {
                    closeDialog();
                    await this.importPromptToHeader(selectedPrompt, prompts[selectedPrompt]);
                }
            });

            cancelBtn.addEventListener('click', closeDialog);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error showing import dialog:`, error);
            callGenericPopup('Error loading archived prompts', 'error');
        }
    }

    async importPromptToCompletion(promptName, _promptData) {
        try {
            // This would require interfacing with SillyTavern's prompt manager
            // For now, show a message that this feature needs implementation
            callGenericPopup(`Importing "${promptName}" to completion prompts is not yet implemented. This would require direct integration with SillyTavern's prompt manager.`, 'info');
        } catch (error) {
            console.error(`${LOG_PREFIX} Error importing prompt to completion:`, error);
            callGenericPopup('Error importing prompt', 'error');
        }
    }

    async importPromptToHeader(promptName, promptData) {
        // Store the prompt data for the header selection dialog
        this.selectedPromptData = {
            prompt: { name: `Imported: ${promptName}` },
            data: promptData
        };

        // Show the header selection dialog
        this.showHeaderSelectionDialog();
    }

    async movePromptToHeader(promptId) {
        try {
            // Find the prompt data
            const prompt = this.allPrompts.find(p => p.identifier === promptId);
            if (!prompt) {
                callGenericPopup('Prompt not found', 'error');
                return;
            }

            // Get the prompt content from SillyTavern's prompt manager
            if (typeof promptManager !== 'undefined' && promptManager.serviceSettings?.prompts) {
                const promptData = promptManager.serviceSettings.prompts.find(p => p.identifier === promptId);
                if (!promptData) {
                    callGenericPopup('Prompt data not found', 'error');
                    return;
                }

                // Store the prompt data for the header selection dialog
                this.selectedPromptData = {
                    prompt: prompt,
                    data: promptData
                };

                // Show the header selection dialog
                this.showHeaderSelectionDialog();
            } else {
                callGenericPopup('Prompt manager not available', 'error');
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error moving prompt to header:`, error);
            callGenericPopup('Error moving prompt to header', 'error');
        }
    }

    async moveToHeaderCommon(promptData, promptName) {
        try {
            // Check if we have access to the prompt manager functions
            if (typeof window.NemoPresetManager !== 'undefined' && window.NemoPresetManager.moveToHeader) {
                // Use the existing moveToHeader function from the prompt manager
                await window.NemoPresetManager.moveToHeader(promptData.content || '', promptName);
                callGenericPopup(`"${promptName}" moved to header successfully!`, 'success');
            } else {
                // Fallback: try to find and populate header fields directly
                const headerTextarea = document.querySelector('#rm_api_url, #api_url_text, textarea[placeholder*="header"], textarea[name*="header"], #CustomPromptHeader, textarea#main_prompt');
                
                if (headerTextarea) {
                    // Add to existing content or replace
                    const existingContent = headerTextarea.value.trim();
                    const separator = existingContent ? '\n\n' : '';
                    const newContent = existingContent + separator + `// ${promptName}\n${promptData.content || ''}`;
                    
                    headerTextarea.value = newContent;
                    headerTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    callGenericPopup(`"${promptName}" added to header successfully!`, 'success');
                } else {
                    callGenericPopup('Could not find header field to populate. Make sure you are in the correct API settings.', 'warning');
                }
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error in moveToHeaderCommon:`, error);
            callGenericPopup('Error moving content to header', 'error');
        }
    }
}