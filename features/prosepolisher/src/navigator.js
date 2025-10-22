import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { openai_setting_names } from '../../../../../../../scripts/openai.js';
import { state } from './state.js';

const LOG_PREFIX = `[ProsePolisher:Navigator]`;
// CHANGED: Using a unique localStorage key to prevent conflicts with other extensions.
const PROSE_POLISHER_METADATA_KEY = 'prosePolisherNavigatorMetadata';

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function injectNavigatorModal() {
    if (document.getElementById('pp-preset-navigator-modal')) return;
    // CHANGED: All 'id' attributes are now prefixed with 'pp-' to ensure they are unique.
    const modalHTML = `
    <div id="pp-preset-navigator-modal" style="display:none;">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Select Gremlin Preset</h2>
                <span class="close-button">×</span>
            </div>
            <div class="navigator-body">
                <div class="navigator-main-panel">
                    <div id="pp-navigator-grid-header">
                        <div id="pp-navigator-breadcrumbs"></div>
                        <div id="pp-navigator-header-controls">
                            <div id="pp-navigator-search-controls">
                                <input type="search" id="pp-navigator-search-input" class="text_pole" placeholder="Search presets...">
                                <button id="pp-navigator-search-clear" title="Clear Search" class="menu_button"><i class="fa-solid fa-times"></i></button>
                            </div>
                            <div class="nemo-header-buttons">
                                <button id="pp-navigator-view-toggle-btn" class="menu_button" title="Switch View"><i class="fa-solid fa-list"></i></button>
                                <button id="pp-navigator-new-folder-btn" class="menu_button" title="New Folder"><i class="fa-solid fa-folder-plus"></i></button>
                            </div>
                        </div>
                    </div>
                    <div id="pp-navigator-grid-view"></div>
                </div>
            </div>
            <div class="modal-footer">
                <span></span>
                <button id="pp-navigator-select-btn" class="menu_button" disabled><i class="fa-solid fa-check"></i> Select Preset</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

export class PresetNavigator {
    constructor() {
        this.modal = null;
        this.mainView = null;
        this.breadcrumbs = null;
        this.searchInput = null;
        this.metadata = { folders: {}, presets: {} };
        this.currentPath = [{ id: 'root', name: 'Home' }];
        this.allPresets = [];
        this.selectedPreset = { value: null, filename: null };
        this.targetSelectId = null;
        this.viewMode = 'grid';
    }

    init() {
        // CHANGED: All query selectors now use the unique 'pp-' prefixed IDs.
        this.modal = document.getElementById('pp-preset-navigator-modal');
        this.mainView = this.modal.querySelector('#pp-navigator-grid-view');
        this.breadcrumbs = this.modal.querySelector('#pp-navigator-breadcrumbs');
        this.searchInput = this.modal.querySelector('#pp-navigator-search-input');
        this.modal.querySelector('#pp-navigator-select-btn').addEventListener('click', () => this.selectPreset());
        this.modal.querySelector('#pp-navigator-new-folder-btn').addEventListener('click', () => this.createNewFolder());
        this.modal.querySelector('.close-button').addEventListener('click', () => this.close());
        this.searchInput.addEventListener('input', () => this.renderGridView());
        this.modal.querySelector('#pp-navigator-search-clear').addEventListener('click', () => { this.searchInput.value = ''; this.renderGridView(); });
        this.modal.querySelector('#pp-navigator-view-toggle-btn').addEventListener('click', () => this.toggleViewMode());
        this.mainView.addEventListener('click', (e) => this.handleGridClick(e));
        this.mainView.addEventListener('dblclick', (e) => this.handleGridDoubleClick(e));
    }

    async open(targetSelectId) {
        console.log('[ProsePolisher:Navigator] Opening navigator modal...');
        if (!state.isAppReady) {
            console.log('[ProsePolisher:Navigator] App not ready, showing toast');
            window.toastr.info("SillyTavern is still loading, please wait.");
            return;
        }

        console.log('[ProsePolisher:Navigator] Modal element:', this.modal);
        this.targetSelectId = targetSelectId;
        this.loadMetadata();
        this.allPresets = this.fetchPresetList();
        this.searchInput.value = '';
        console.log('[ProsePolisher:Navigator] Setting modal display to flex...');
        this.modal.style.display = 'flex';
        console.log('[ProsePolisher:Navigator] Modal display after setting:', getComputedStyle(this.modal).display);
        console.log('[ProsePolisher:Navigator] Modal visibility:', getComputedStyle(this.modal).visibility);
        console.log('[ProsePolisher:Navigator] Modal z-index:', getComputedStyle(this.modal).zIndex);
        if (!document.querySelector('.popup_background.prose-polisher')) {
            const overlay = document.createElement('div');
            overlay.className = 'popup_background prose-polisher';
            overlay.style.zIndex = getComputedStyle(this.modal).zIndex - 1;
            overlay.onclick = () => this.close();
            document.body.appendChild(overlay);
        }
        this.render();
    }

    close() {
        if (this.modal) this.modal.style.display = 'none';
        document.querySelector('.popup_background.prose-polisher')?.remove();
        this.selectedPreset = { value: null, filename: null };
        this.currentPath = [{ id: 'root', name: 'Home' }];
        this.targetSelectId = null;
    }

    render() {
        this.renderBreadcrumbs();
        this.renderGridView();
        this.updateSelectButton();
    }

    renderBreadcrumbs() {
        this.breadcrumbs.innerHTML = '';
        this.currentPath.forEach((part, index) => {
            const partEl = document.createElement('span');
            partEl.dataset.id = part.id;
            partEl.textContent = part.name;
            if (index < this.currentPath.length - 1) {
                partEl.classList.add('link');
                partEl.addEventListener('click', () => { this.currentPath.splice(index + 1); this.render(); });
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
        Object.values(this.metadata.folders).filter(f => f.parentId === currentFolderId).forEach(f => items.push({ type: 'folder', data: f, id: f.id, name: f.name }));
        this.allPresets.forEach(p => {
            const meta = this.metadata.presets[p.name] || {};
            if ((meta.folderId === currentFolderId) || (!meta.folderId && currentFolderId === 'root')) {
                items.push({ type: 'preset', data: p, id: p.name, name: p.name });
            }
        });
        items = items.filter(item => searchTerm ? item.name.toLowerCase().includes(searchTerm) : true);
        items.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'preset') return -1;
            if (a.type === 'preset' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
        this.mainView.innerHTML = '';
        this.mainView.className = `view-mode-${this.viewMode}`;
        if (items.length === 0) {
            this.mainView.innerHTML = `<div class="navigator-empty-state"><h3>This folder is empty.</h3></div>`;
            return;
        }
        items.forEach(item => this.mainView.appendChild((this.viewMode === 'grid') ? this.createGridItem(item) : this.createListItem(item)));
    }

    createGridItem(item) {
        const { type, data, id } = item;
        const itemEl = document.createElement('div');
        itemEl.className = `grid-item ${type}`;
        itemEl.dataset.type = type;
        itemEl.dataset.id = id;
        if (type === 'preset') itemEl.dataset.value = data.name;

        // Set folder color as CSS variable for inheritance
        if (data.color) {
            itemEl.style.setProperty('--nemo-folder-color', data.color);
            console.log(`[ProsePolisher Navigator] Setting folder color: ${data.color} for ${data.name}`);
        }

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        icon.innerHTML = `<i class="fa-solid ${type === 'folder' ? 'fa-folder' : 'fa-file-lines'}"></i>`;

        // Apply color directly to icon if it's a folder with custom color
        if (type === 'folder' && data.color) {
            icon.style.color = data.color;
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = data.name.split('/').pop();
        itemEl.appendChild(icon);
        itemEl.appendChild(nameEl);
        if (type === 'preset' && this.selectedPreset.filename === id) itemEl.classList.add('selected');
        return itemEl;
    }

    createListItem(item) { return this.createGridItem(item); }

    handleGridClick(e) {
        const item = e.target.closest('.grid-item');
        if (!item) return;
        const { type, id, value } = item.dataset;
        if (type === 'folder') {
            this.currentPath.push({ id: this.metadata.folders[id].id, name: this.metadata.folders[id].name });
            this.render();
        } else if (type === 'preset') {
            this.mainView.querySelectorAll('.grid-item.selected').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            this.selectedPreset = { value: value, filename: id };
        }
        this.updateSelectButton();
    }

    handleGridDoubleClick(e) {
        const item = e.target.closest('.grid-item.preset');
        if (!item) return;
        this.selectedPreset = { value: item.dataset.value, filename: item.dataset.id };
        this.selectPreset();
    }

    selectPreset() {
        if (!this.selectedPreset.value || !this.targetSelectId) return;
        const targetSelect = document.getElementById(this.targetSelectId);
        if (targetSelect) {
            targetSelect.value = this.selectedPreset.value;
            targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        this.close();
    }

    updateSelectButton() {
        this.modal.querySelector('#pp-navigator-select-btn').disabled = this.selectedPreset.value === null;
    }

    fetchPresetList() {
        return state.isAppReady && openai_setting_names ? Object.keys(openai_setting_names).map(name => ({ name })) : [];
    }

    loadMetadata() {
        try {
            // CHANGED: Reading from the unique localStorage key.
            const stored = localStorage.getItem(PROSE_POLISHER_METADATA_KEY);
            if (stored) this.metadata = { folders: {}, presets: {}, ...JSON.parse(stored) };
        } catch (ex) { this.metadata = { folders: {}, presets: {} }; }
    }

    saveMetadata() {
        // CHANGED: Saving to the unique localStorage key.
        localStorage.setItem(PROSE_POLISHER_METADATA_KEY, JSON.stringify(this.metadata));
    }

    async createNewFolder() {
        if (!state.isAppReady) { window.toastr.info("SillyTavern is still loading, please wait."); return; }

        const name = await callGenericPopup('New Folder Name:', POPUP_TYPE.INPUT, 'New Folder');
        if (!name) return;
        const newId = generateUUID();
        const parentId = this.currentPath[this.currentPath.length - 1].id;
        this.metadata.folders[newId] = { id: newId, name, parentId };
        this.saveMetadata();
        this.render();
    }

    toggleViewMode() {
        this.viewMode = (this.viewMode === 'grid') ? 'list' : 'grid';
        this.render();
        this.modal.querySelector('#pp-navigator-view-toggle-btn i').className = `fa-solid ${this.viewMode === 'grid' ? 'fa-list' : 'fa-grip'}`;
    }
}