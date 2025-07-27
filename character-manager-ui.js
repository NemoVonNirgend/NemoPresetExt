import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { getContext } from '../../../extensions.js';
import { LOG_PREFIX, generateUUID } from './utils.js';
import { loadCharacterMetadata, saveCharacterMetadata, updateMetadataTimestamp } from './character-manager.js';
import { selectCharacterById } from '../../../../script.js';

export class CharacterManagerUI {
    constructor() {
        this.element = document.createElement('div');
        this.element.id = `nemo-character-manager-content-${generateUUID()}`;
        this.currentPath = [];
        this.selectedCharacter = null;
        this.bulkSelection = new Set();
        this.lastSelectedItem = null;
        this.viewMode = 'grid';
        this.currentSort = 'name-asc';
        this.currentFilter = 'all';
        this.isInitialized = false;
        this.allCharacters = [];
        this.metadata = { folders: {}, characters: {} };
    }

    async init() {
        if (this.isInitialized) return;

        const response = await fetch('scripts/extensions/third-party/NemoPresetExt/character-manager-ui.html');
        this.element.innerHTML = await response.text();

        this.mainView = this.element.querySelector('#char-manager-grid-view');
        this.breadcrumbs = this.element.querySelector('#char-manager-breadcrumbs');
        this.searchInput = this.element.querySelector('#char-manager-search-input');
        this.searchClearBtn = this.element.querySelector('#char-manager-search-clear');

        this.element.querySelector('#char-manager-load-btn').addEventListener('click', () => this.loadSelectedCharacter());
        this.element.querySelector('#char-manager-new-folder-btn').addEventListener('click', () => this.createNewFolder());
        this.searchInput.addEventListener('input', () => this.render());
        this.searchClearBtn.addEventListener('click', () => { this.searchInput.value = ''; this.render(); });
        this.element.querySelector('#char-manager-view-toggle-btn').addEventListener('click', () => this.toggleViewMode());
        
        // Placeholder for soon-to-be-implemented features
        this.element.querySelector('#char-manager-sort-btn').addEventListener('click', (e) => this.showSortMenu(e));
        this.element.querySelector('#char-manager-filter-btn').addEventListener('click', (e) => this.showFilterMenu(e));

        this.mainView.addEventListener('click', (e) => this.handleGridClick(e), true);
        this.mainView.addEventListener('dblclick', (e) => this.handleGridDoubleClick(e));
        this.element.addEventListener('contextmenu', (e) => this.handleGridContextMenu(e));

        this.mainView.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.mainView.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.mainView.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.mainView.addEventListener('drop', (e) => this.handleDrop(e));
        this.isInitialized = true;
    }

    async open() {
        await this.init();

        // Load metadata from localStorage
        this.metadata = loadCharacterMetadata();

        // Fetch all characters from the backend
        const context = getContext();
        await context.getCharacters();
        this.allCharacters = [...context.characters];

        // Reset path and render
        this.currentPath = [{ id: 'root', name: 'Home' }];
        this.render();

        callGenericPopup(this.element, POPUP_TYPE.DISPLAY, 'Character Manager', {
            wide: true,
            large: true,
            addCloseButton: true,
        });
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
        const currentFolderId = this.currentPath[this.currentPath.length - 1].id;
        const searchTerm = this.searchInput.value.toLowerCase().trim();

        let items = [];
        // Add folders to the items list
        Object.values(this.metadata.folders).forEach(folder => {
            if (folder.parentId === currentFolderId) {
                items.push({ type: 'folder', data: folder, id: folder.id, name: folder.name });
            }
        });

        // Add characters to the items list
        this.allCharacters.forEach(character => {
            const meta = this.metadata.characters[character.avatar] || {};
            const isUncategorized = !meta.folderId;
            const isInCurrentFolder = meta.folderId === currentFolderId;
            const isInRootAndCurrentIsRoot = isUncategorized && currentFolderId === 'root';
            if (isInCurrentFolder || isInRootAndCurrentIsRoot) {
                items.push({ type: 'character', data: character, id: character.avatar, name: character.name });
            }
        });

        // Filtering
        items = items.filter(item => {
            if (!searchTerm) return true; // No search term, show all

            const nameMatch = item.name.toLowerCase().includes(searchTerm);

            // If it's a character, also check tags
            if (item.type === 'character') {
                const tagMatch = item.data.tags && Array.isArray(item.data.tags)
                    ? item.data.tags.some(tag => tag.toLowerCase().includes(searchTerm))
                    : false;
                return nameMatch || tagMatch;
            }

            // For folders, only search by name
            return nameMatch;
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

        this.mainView.innerHTML = '';
        this.mainView.className = `view-mode-${this.viewMode}`;

        if (items.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'char-manager-empty-state';
            emptyEl.innerHTML = searchTerm ? `<h3>No results for "${searchTerm}"</h3>` : `<h3>This folder is empty.</h3>`;
            this.mainView.appendChild(emptyEl);
            return;
        }

        items.forEach(item => {
            const itemEl = (this.viewMode === 'grid') ? this.createGridItem(item) : this.createListItem(item);
            this.mainView.appendChild(itemEl);
        });
    }

    updateLoadButton() {
        const btn = this.element.querySelector('#char-manager-load-btn');
        btn.disabled = !this.selectedCharacter;
    }

    async loadSelectedCharacter() {
        if (!this.selectedCharacter) return;
    
        try {
            const context = getContext();
            const characterIndex = context.characters.findIndex(c => c.avatar === this.selectedCharacter.avatar);
    
            if (characterIndex !== -1) {
                await selectCharacterById(characterIndex);
                const closeButton = this.element.closest('.popup_outer, dialog.popup')?.querySelector('.popup-button-close');
                if (closeButton) closeButton.click();
            } else {
                throw new Error('Character not found in global character list.');
            }
        } catch (error) {
            console.error(`Error loading character ${this.selectedCharacter.name}:`, error);
            callGenericPopup(`Failed to load character: ${this.selectedCharacter.name}`, 'error');
        }
    }

    async createNewFolder() {
        const name = await callGenericPopup('New Folder Name:', POPUP_TYPE.INPUT, 'New Folder');
        if (!name) return;
        const newId = generateUUID();
        const parentId = this.currentPath[this.currentPath.length - 1].id;
        const now = new Date().toISOString();
        this.metadata.folders[newId] = { id: newId, name, parentId, createdAt: now, lastModified: now };
        saveCharacterMetadata(this.metadata);
        this.render();
    }

    createGridItem(item) {
        const { type, data, id } = item;
        const itemEl = document.createElement('div');
        itemEl.className = `grid-item ${type}`;
        itemEl.dataset.type = type;
        itemEl.dataset.id = id;
        itemEl.draggable = true;

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        if (type === 'character' && data.avatar) {
            // Use the correct thumbnail URL format
            icon.style.backgroundImage = `url('/thumbnail?type=avatar&file=${encodeURIComponent(data.avatar)}')`;
        } else {
            icon.innerHTML = `<i class="fa-solid ${type === 'folder' ? 'fa-folder' : 'fa-user'}"></i>`;
        }
        
        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = data.name;
        nameEl.title = data.name;
        
        itemEl.appendChild(icon);
        itemEl.appendChild(nameEl);

        return itemEl;
    }

    createListItem(item) {
        const { type, data, id } = item;
        const itemEl = document.createElement('div');
        itemEl.className = `grid-item list-item ${type}`;
        itemEl.dataset.type = type;
        itemEl.dataset.id = id;
        itemEl.draggable = true;

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        if (type === 'character' && data.avatar) {
            // For list view, maybe just an icon is better
            icon.innerHTML = `<i class="fa-solid fa-user"></i>`;
        } else {
            icon.innerHTML = `<i class="fa-solid fa-folder"></i>`;
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = data.name;
        nameEl.title = data.name;

        const dateEl = document.createElement('div');
        dateEl.className = 'item-date';
        dateEl.textContent = 'N/A'; // Placeholder for modification date

        itemEl.appendChild(icon);
        itemEl.appendChild(nameEl);
        itemEl.appendChild(dateEl);

        return itemEl;
    }

    // New methods to be added
    toggleViewMode() {
        this.viewMode = (this.viewMode === 'grid') ? 'list' : 'grid';
        this.render();
    }

    updateHeaderControls() {
        const viewBtn = this.element.querySelector('#char-manager-view-toggle-btn i');
        viewBtn.className = `fa-solid ${this.viewMode === 'grid' ? 'fa-list' : 'fa-grip'}`;
        viewBtn.parentElement.title = `Switch to ${this.viewMode === 'grid' ? 'List' : 'Grid'} View`;
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
            } else if (type === 'character') {
                this.mainView.querySelectorAll('.grid-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedCharacter = this.allCharacters.find(c => c.avatar === id);
                this.lastSelectedItem = item;
            }
        }
        this.updateBulkSelectionVisuals();
        this.updateLoadButton();
    }

    handleGridDoubleClick(e) {
        const item = e.target.closest('.grid-item.character');
        if (!item) return;
        this.loadSelectedCharacter();
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
            itemsHTML = `<li data-action="rename_folder" data-id="${id}"><i class="fa-solid fa-i-cursor"></i><span>Rename</span></li><li data-action="delete_folder" data-id="${id}"><i class="fa-solid fa-trash-can"></i><span>Delete</span></li>`;
        } else if (type === 'character') {
            itemsHTML = `<li data-action="add_to_folder" data-id="${id}"><i class="fa-solid fa-folder-plus"></i><span>Move to Folder...</span></li>`;
        }
        menu.innerHTML = itemsHTML;

        const popupContainer = item.closest('.popup');
        popupContainer.appendChild(menu);
        const popupRect = popupContainer.getBoundingClientRect();
        menu.style.left = `${e.clientX - popupRect.left}px`;
        menu.style.top = `${e.clientY - popupRect.top}px`;
        menu.style.display = 'block';

        menu.addEventListener('click', (me) => {
            const actionTarget = me.target.closest('li[data-action]');
            if (actionTarget) this.runContextMenuAction(actionTarget.dataset.action, actionTarget.dataset.id);
            this.hideContextMenu();
        }, { once: true });
    }

    async runContextMenuAction(action, id) {
        switch (action) {
            case 'rename_folder': {
                const folder = this.metadata.folders[id];
                if (!folder) return;
                const newName = await callGenericPopup('Enter new folder name:', POPUP_TYPE.INPUT, folder.name);
                if (newName && newName.trim() && newName !== folder.name) {
                    folder.name = newName.trim();
                    updateMetadataTimestamp(this.metadata, id, 'folder');
                    saveCharacterMetadata(this.metadata);
                    this.render();
                }
                break;
            }
            case 'delete_folder': {
                const folder = this.metadata.folders[id];
                if (!folder) return;
                const confirmed = await callGenericPopup(`Delete "${folder.name}"? Characters inside will become unassigned.`, POPUP_TYPE.CONFIRM);
                if (confirmed) {
                    Object.values(this.metadata.characters).forEach(char => {
                        if (char.folderId === id) {
                            delete char.folderId;
                        }
                    });
                    delete this.metadata.folders[id];
                    saveCharacterMetadata(this.metadata);
                    this.render();
                }
                break;
            }
            case 'add_to_folder': {
                this.moveItemToFolderDialog([id]);
                break;
            }
        }
    }

    hideContextMenu() {
        this.element.querySelector('.nemo-context-menu')?.remove();
    }

    showSortMenu(e) {
        e.stopPropagation(); this.hideContextMenu();
        const options = { 'name-asc': 'Name (A-Z)', 'name-desc': 'Name (Z-A)'};
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
        const options = { 'all': 'All Items', 'uncategorized': 'Uncategorized' };
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

    updateBulkSelectionVisuals() {
        this.mainView.querySelectorAll('.grid-item').forEach(el => {
            el.classList.toggle('bulk-selected', this.bulkSelection.has(el.dataset.id));
        });
    }

    // Drag and Drop Methods
    handleDragStart(e) {
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
        }
    }

    handleDragLeave(e) {
        const target = e.target.closest('.grid-item.folder');
        if (target) {
            target.classList.remove('drag-over');
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        if (this.lastDropTarget) {
            this.lastDropTarget.classList.remove('drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            const folderId = this.lastDropTarget.dataset.id;
            
            if (draggedId && folderId) {
                this.moveItemToFolder(draggedId, folderId);
            }
        }
        const draggedItem = this.mainView.querySelector('.dragging-source');
        if(draggedItem) draggedItem.classList.remove('dragging-source');
        
        this.lastDropTarget = null;
    }

    async moveItemToFolder(itemId, folderId) {
        const itemType = this.metadata.folders[itemId] ? 'folder' : 'character';
        if (itemType === 'folder') {
            this.metadata.folders[itemId].parentId = folderId;
        } else {
            this.metadata.characters[itemId] = this.metadata.characters[itemId] || {};
            this.metadata.characters[itemId].folderId = folderId;
        }
        updateMetadataTimestamp(this.metadata, itemId, itemType);
        saveCharacterMetadata(this.metadata);
        this.render();
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
                this.moveItemToFolder(id, targetFolder.id);
            });
            this.bulkSelection.clear();
            this.updateBulkSelectionVisuals();
        } else if (targetName) {
            callGenericPopup(`Folder "${targetName}" not found.`, 'error');
        }
    }
}