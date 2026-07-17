import { LOG_PREFIX, getExtensionPath } from '../../core/utils.js';
import logger from '../../core/logger.js';
import { isSafePresetName, normalizePresetMap } from './preset-validation.js';
import { debounce } from '../../../../../../scripts/utils.js';
import { Popup } from '../../../../../../scripts/popup.js';
import {
    createNewWorldInfo,
    getFreeWorldName,
    loadWorldInfo,
    openWorldInfoEditor,
    saveWorldInfo,
    updateWorldInfoList,
    world_info_case_sensitive,
    world_info_match_whole_words,
    world_names,
} from '../../../../../../scripts/world-info.js';
import { eventSource, event_types } from '../../../../../../script.js';

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createLiteralKeywordExpression(keyword, entry) {
    const escaped = escapeRegExp(keyword);
    const wholeWords = entry.matchWholeWords ?? world_info_match_whole_words;
    const startBoundary = wholeWords && /^\w/.test(keyword) ? String.raw`\b` : '';
    const endBoundary = wholeWords && /\w$/.test(keyword) ? String.raw`\b` : '';
    const caseSensitive = entry.caseSensitive ?? world_info_case_sensitive;
    const flags = caseSensitive ? '' : 'i';
    return new RegExp(`${startBoundary}${escaped}${endBoundary}`, flags);
}

/**
 * @typedef {object} WorldInfoEntry
 * @property {string} uid
 * @property {string[]} key
 * @property {string[]} keysecondary
 * @property {string} comment
 * @property {string} content
 * @property {boolean} constant
 * @property {boolean} selective
 * @property {number} selectiveLogic
 * @property {boolean} addMemo
 * @property {number} order
 * @property {number} position
 * @property {boolean} disable
 * @property {boolean} excludeRecursion
 * @property {boolean} preventRecursion
 * @property {boolean} delayUntilRecursion
 * @property {number} probability
 * @property {boolean} useProbability
 * @property {number} depth
 * @property {string} group
 * @property {boolean} groupOverride
 * @property {number} groupWeight
 * @property {number|null} scanDepth
 * @property {boolean|null} caseSensitive
 * @property {boolean|null} matchWholeWords
 * @property {boolean|null} useGroupScoring
 * @property {string} automationId
 * @property {number} role
 * @property {number|null} sticky
 * @property {number|null} cooldown
 * @property {number|null} delay
 * @property {string[]} triggers
 */

/**
 * @typedef {object} WorldInfoData
 * @property {Object.<string, WorldInfoEntry>} entries
 */

export const NemoWorldInfoUI = {
    _currentWorld: { name: null, data: null },
    _selectedItems: new Set(),
    _selectedEntries: new Set(),
    _selectionBook: null,
    _lastSelectedEntry: null,
    _uiInjected: false,
    _isRefreshingUI: false,
    folderState: {},
    storageKey: 'nemo-wi-folder-state',
    _presets: Object.create(null),
    _currentPreset: '',
    presetStorageKey: 'nemo-wi-presets',
    _activeEntries: [],
    _selectedLorebookName: null,
    _abortController: null,
    _panelObserver: null,
    _worldSelectObserver: null,
    _entriesObserver: null,
    _preservedPanel: null,
    _settingsPlaceholder: null,
    _settingsDisplay: null,
    _activeEntriesHandler: null,
    _generationStartedHandler: null,
    _chatChangedHandler: null,
    _worldInfoUpdatedHandler: null,
    _stylesheetOwned: false,
    _loadSequence: 0,
    _searchSequence: 0,
    _previewSequence: 0,
    _previewTimer: null,

    injectUI: async function() {
        try {
            const response = await fetch(getExtensionPath('features/world-info/world-info-ui.html'), { signal: this._abortController?.signal });
            if (!response.ok) {
                throw new Error(`Failed to fetch UI template: ${response.statusText}`);
            }
            const html = await response.text();
            
            const originalPanel = document.getElementById('WorldInfo');
            if (!originalPanel || originalPanel.querySelector('#nemo-world-info-redesign')) return;

            const preserved = document.createElement('div');
            preserved.id = 'nemo-native-world-info-preserved';
            preserved.hidden = true;
            preserved.inert = true;
            preserved.setAttribute('aria-hidden', 'true');

            // Park the complete native tree to retain SillyTavern's event handlers.
            // Only the two render targets are replaced by the redesigned workspace.
            const nativeEntries = originalPanel.querySelector('#world_popup_entries_list');
            const nativePagination = originalPanel.querySelector('#world_info_pagination');
            if (nativeEntries) nativeEntries.id = 'nemo-native-world-popup-entries-list';
            if (nativePagination) nativePagination.id = 'nemo-native-world-info-pagination';

            while (originalPanel.firstChild) preserved.appendChild(originalPanel.firstChild);
            document.body.appendChild(preserved);
            this._preservedPanel = preserved;

            const template = document.createElement('template');
            template.innerHTML = html.trim();
            originalPanel.replaceChildren(template.content.cloneNode(true));
            this.enhanceAccessibility();
            this.setWorkspaceState('idle', 'Select a lorebook to view and edit its entries.');
        } catch (error) {
            logger.error('Error injecting UI', error);
            this.restoreNativePanel();
            throw error;
        }
    },

    displayLorebookEntries: async function(lorebookName) {
        const loadSequence = ++this._loadSequence;
        this._selectedLorebookName = lorebookName;
        document.querySelectorAll('.nemo-lorebook-item').forEach(item => {
            item.classList.toggle('nemo-lorebook-selected', /** @type {HTMLElement} */ (item).dataset.name === lorebookName);
        });
        this.setWorkspaceState('loading', `Loading ${lorebookName}...`);

        try {
            const data = await loadWorldInfo(lorebookName);
            if (loadSequence !== this._loadSequence) return;
            if (!data?.entries) throw new Error(`Could not load lorebook "${lorebookName}".`);

            this._currentWorld = { name: lorebookName, data };
            openWorldInfoEditor(lorebookName);
            this.setWorkspaceState('ready');
            queueMicrotask(() => this.enhanceRenderedEntries());
        } catch (error) {
            if (loadSequence !== this._loadSequence) return;
            logger.error(`Could not open lorebook "${lorebookName}"`, error);
            this.setWorkspaceState('error', `Could not load ${lorebookName}. Try refreshing the lorebook list.`);
        }
    },

    setWorkspaceState: function(state, message = '') {
        const panel = document.getElementById('nemo-world-info-entries-panel');
        const emptyState = document.getElementById('nemo-wi-empty-state');
        const entriesContent = document.getElementById('nemo-wi-entries-content');
        if (!panel || !emptyState || !entriesContent) return;

        let status = document.getElementById('nemo-wi-workspace-status');
        if (!status) {
            status = document.createElement('p');
            status.id = 'nemo-wi-workspace-status';
            status.className = 'nemo-wi-workspace-status';
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            emptyState.appendChild(status);
        }

        panel.dataset.state = state;
        panel.setAttribute('aria-busy', String(state === 'loading'));
        status.textContent = message;
        emptyState.hidden = state === 'ready';
        entriesContent.hidden = state !== 'ready';
        entriesContent.style.display = state === 'ready' ? '' : 'none';
    },

    enhanceAccessibility: function() {
        const root = document.getElementById('nemo-world-info-redesign');
        if (!root) return;
        const signal = this._abortController?.signal;
        const listenerOptions = signal ? { signal } : undefined;

        root.setAttribute('role', 'region');
        root.setAttribute('aria-label', 'Lorebook workspace');

        const tabList = root.querySelector('.nemo-world-info-tabs');
        const tabs = Array.from(root.querySelectorAll('.nemo-world-info-tab'));
        tabList?.setAttribute('role', 'tablist');
        tabs.forEach(tab => {
            const panelId = tab.id.replace(/-tab$/, '-panel');
            const panel = document.getElementById(panelId);
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', panelId);
            tab.setAttribute('aria-selected', String(tab.classList.contains('active')));
            tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
            if (panel) {
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', tab.id);
            }
        });

        tabList?.addEventListener('keydown', event => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                const currentIndex = Math.max(0, tabs.indexOf(document.activeElement));
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
                nextTab?.focus();
                nextTab?.click();
            }
        }, listenerOptions);

        const activateControlOnKeyboard = event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.currentTarget.click();
            }
        };

        root.querySelectorAll('.menu_button[title], .nemo-world-info-tab').forEach(control => {
            if (control instanceof HTMLButtonElement) {
                control.type = 'button';
            } else {
                control.setAttribute('role', control.classList.contains('nemo-world-info-tab') ? 'tab' : 'button');
                if (!control.classList.contains('nemo-world-info-tab')) control.tabIndex = 0;
                control.addEventListener('keydown', activateControlOnKeyboard, listenerOptions);
            }
            const label = control.getAttribute('title') || control.textContent?.trim();
            if (label && !control.hasAttribute('aria-label')) control.setAttribute('aria-label', label);
        });

        const labels = {
            'nemo-world-info-search': 'Search lorebooks',
            'nemo-world-info-preset-select': 'Lorebook preset',
            'nemo-world-info-entry-search': 'Search entries',
            'nemo-world-info-entry-sort': 'Sort entries',
            'nemo-primary-keyword-preview-input': 'Text to preview against primary keywords',
            'nemo-primary-keyword-preview-results': 'Primary keyword preview results',
        };
        for (const [id, label] of Object.entries(labels)) {
            document.getElementById(id)?.setAttribute('aria-label', label);
        }

        document.getElementById('nemo-world-info-list')?.setAttribute('role', 'listbox');
        document.getElementById('nemo-world-info-active-list')?.setAttribute('aria-live', 'polite');
        document.getElementById('nemo-world-info-active-entries-list')?.setAttribute('aria-live', 'polite');
        document.getElementById('nemo-primary-keyword-preview-results')?.setAttribute('aria-live', 'polite');

    },

    updateActiveLorebooksList: function() {
        this.updateActiveEntriesPanel();
        const activeList = document.getElementById('nemo-world-info-active-list');
        const worldInfoSelect = /** @type {HTMLSelectElement} */ (document.getElementById('world_info'));
        if (!activeList || !worldInfoSelect) return;

        activeList.replaceChildren();
        const selectedOptions = Array.from(worldInfoSelect.selectedOptions);
        if (selectedOptions.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'nemo-wi-active-empty';
            empty.textContent = 'None active globally';
            activeList.appendChild(empty);
            return;
        }

        for (const option of selectedOptions) {
            const activeItem = document.createElement('div');
            activeItem.className = 'nemo-active-lorebook-item';
            activeItem.textContent = option.text;
            
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'nemo-remove-lorebook-button';
            removeButton.textContent = '\u00d7';
            removeButton.setAttribute('aria-label', `Deactivate ${option.text}`);
            removeButton.addEventListener('click', () => {
                option.selected = false;
                const worldInfoSelect = /** @type {HTMLSelectElement} */ (document.getElementById('world_info'));
                $(worldInfoSelect).trigger('change');
                this.refreshLorebookUI();
            });

            activeItem.appendChild(removeButton);
            activeList.appendChild(activeItem);
        }
    },

    syncLorebookSelectionUI: function() {
        const lorebookItems = Array.from(document.querySelectorAll('#nemo-world-info-list .nemo-lorebook-item'));
        const availableNames = new Set(lorebookItems.map(item => /** @type {HTMLElement} */ (item).dataset.name).filter(Boolean));
        for (const selectedName of this._selectedItems) {
            if (!availableNames.has(selectedName)) this._selectedItems.delete(selectedName);
        }

        lorebookItems.forEach(item => {
            const name = /** @type {HTMLElement} */ (item).dataset.name;
            const selected = Boolean(name && this._selectedItems.has(name));
            item.classList.toggle('selected', selected);
            item.setAttribute('aria-selected', String(selected));
        });
    },

    toggleLorebookSelection: function(lorebookName) {
        if (this._selectedItems.has(lorebookName)) {
            this._selectedItems.delete(lorebookName);
        } else {
            this._selectedItems.add(lorebookName);
        }
        this.syncLorebookSelectionUI();
    },

    openLorebook: function(lorebookName) {
        this._selectedItems.clear();
        this._selectedItems.add(lorebookName);
        this.syncLorebookSelectionUI();
        void this.displayLorebookEntries(lorebookName);
    },

    populateLorebooksFromSelect: function(selectElement) {
        const lorebookList = document.getElementById('nemo-world-info-list');
        if (!lorebookList) return;

        this.destroySortable();
        lorebookList.innerHTML = '';
        
        // Create folders
        for (const folderName in this.folderState) {
            const folderElement = this.createFolderElement(folderName);
            lorebookList.appendChild(folderElement);
        }

        // Create a dedicated container for unassigned lorebooks
        const unassignedContainer = document.createElement('div');
        unassignedContainer.id = 'nemo-unassigned-lorebooks-container';

        // Create lorebook items
        const unassignedLorebooksFragment = document.createDocumentFragment();
        for (const option of selectElement.options) {
            if (option.value) {
                const lorebookItem = this.createLorebookElement(option);
                const folderName = this.findFolderForLorebook(option.text);
                if (folderName) {
                    const folder = Array.from(lorebookList.querySelectorAll('.nemo-folder')).find(item => item.dataset.folderName === folderName);
                    const folderContent = folder?.querySelector('.nemo-folder-content');
                    if (folderContent) {
                        folderContent.appendChild(lorebookItem);
                    }
                } else {
                    unassignedLorebooksFragment.appendChild(lorebookItem);
                }
            }
        }
        unassignedContainer.appendChild(unassignedLorebooksFragment);
        lorebookList.appendChild(unassignedContainer);
        if (!lorebookList.querySelector('.nemo-lorebook-item')) {
            const empty = document.createElement('p');
            empty.className = 'nemo-wi-helper-empty';
            empty.setAttribute('role', 'status');
            empty.textContent = 'No lorebooks yet. Create one or import an existing lorebook.';
            lorebookList.appendChild(empty);
        }

        this.syncLorebookSelectionUI();
        this.updateActiveLorebooksList();
    },

    createLorebookElement: function(option) {
        const lorebookItem = document.createElement('div');
        lorebookItem.className = 'nemo-lorebook-item';
        lorebookItem.dataset.name = option.text;
        lorebookItem.tabIndex = 0;
        lorebookItem.setAttribute('role', 'option');
        lorebookItem.setAttribute('aria-selected', 'false');
        lorebookItem.title = option.text; // Full name on hover

        const dragHandle = document.createElement('div');
        dragHandle.className = 'nemo-drag-handle';
        dragHandle.setAttribute('aria-hidden', 'true');
        dragHandle.innerHTML = '&#9776;'; // Unicode for "hamburger" icon
        lorebookItem.appendChild(dragHandle);

        const textSpan = document.createElement('span');
        textSpan.className = 'nemo-lorebook-item-text';
        textSpan.textContent = option.text;
        lorebookItem.appendChild(textSpan);

        lorebookItem.addEventListener('click', (event) => {
            const moveToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemo-world-info-move-toggle'));
            if (moveToggle?.checked) return;

            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                this.toggleLorebookSelection(option.text);
                return;
            }

            this.openLorebook(option.text);
        });

        lorebookItem.addEventListener('keydown', (event) => {
            if (event.target !== lorebookItem) return;
            if (event.key === ' ') {
                event.preventDefault();
                this.toggleLorebookSelection(option.text);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                this.openLorebook(option.text);
            }
        });

        lorebookItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this._selectedItems.has(option.text)) {
                this._selectedItems.clear();
                this._selectedItems.add(option.text);
                this.syncLorebookSelectionUI();
            }
            this.showContextMenu(e.clientX, e.clientY);
        });

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'nemo-add-lorebook-button';
        addButton.textContent = '+';
        addButton.setAttribute('aria-label', `Activate ${option.text}`);
        addButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const worldInfoSelect = /** @type {HTMLSelectElement} */ (document.getElementById('world_info'));
            const correspondingOption = Array.from(worldInfoSelect.options).find(opt => opt.text === option.text);
            if (correspondingOption) {
                correspondingOption.selected = true;
                $(worldInfoSelect).trigger('change');
                this.refreshLorebookUI();
            }
        });

        lorebookItem.appendChild(addButton);
        return lorebookItem;
    },

    createFolderElement: function(folderName) {
        const folderElement = document.createElement('div');
        folderElement.className = 'nemo-folder';
        folderElement.dataset.folderName = folderName;
        
        logger.debug('Creating folder element', {
            folderName: folderName,
            className: folderElement.className,
            hasOpenClass: folderElement.classList.contains('open')
        });

        const header = document.createElement('div');
        header.className = 'nemo-folder-header';
        header.tabIndex = 0;
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', 'false');
        const folderToggle = document.createElement('span');
        folderToggle.className = 'nemo-folder-toggle';
        folderToggle.textContent = '\u25b6';
        header.append(folderToggle, document.createTextNode(` ${folderName}`));
        header.addEventListener('click', () => {
            folderElement.classList.toggle('open');
            header.setAttribute('aria-expanded', String(folderElement.classList.contains('open')));
            logger.debug('Folder toggle clicked', {
                folderName: folderName,
                isOpen: folderElement.classList.contains('open'),
                className: folderElement.className
            });
        });

        header.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                header.click();
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'nemo-delete-folder-button';
        deleteButton.textContent = '\u00d7';
        deleteButton.setAttribute('aria-label', `Delete folder ${folderName}`);
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteFolder(folderName);
        });
        header.appendChild(deleteButton);

        const content = document.createElement('div');
        content.className = 'nemo-folder-content';

        folderElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            folderElement.classList.add('nemo-drag-over');
        });
        folderElement.addEventListener('dragleave', () => {
            folderElement.classList.remove('nemo-drag-over');
        });
        folderElement.addEventListener('drop', (e) => {
            e.preventDefault();
            folderElement.classList.remove('nemo-drag-over');
            try {
                const lorebookNames = JSON.parse(e.dataTransfer?.getData('text/plain') || '[]');
                if (Array.isArray(lorebookNames)) lorebookNames.forEach(name => this.moveSelectedToFolder(folderName, name));
            } catch (error) {
                logger.warn('Ignored invalid lorebook drag data', error);
            }
        });

        folderElement.appendChild(header);
        folderElement.appendChild(content);
        return folderElement;
    },

    findFolderForLorebook: function(lorebookName) {
        for (const folderName in this.folderState) {
            if (this.folderState[folderName].includes(lorebookName)) {
                return folderName;
            }
        }
        return null;
    },

    initSortable: function() {
        if (typeof Sortable === 'undefined') {
            logger.warn('Sortable.js not found. Drag-and-drop functionality will be disabled.');
            return;
        }

        const self = this;
        const list = document.getElementById('nemo-world-info-list');
        if (!list) return; // Ensure the list exists before proceeding

        const unassignedContainer = document.getElementById('nemo-unassigned-lorebooks-container');
        const folderContents = list.querySelectorAll('.nemo-folder-content');

        const allLists = [unassignedContainer, ...Array.from(folderContents)].filter(Boolean);

        allLists.forEach(el => {
            if (/** @type {any} */ (el)._sortable) {
                /** @type {any} */ (el)._sortable.destroy();
            }
            /** @type {any} */ (el)._sortable = new Sortable(/** @type {HTMLElement} */ (el), {
                group: 'lorebooks',
                animation: 150,
                handle: '.nemo-drag-handle',
                onEnd: function(evt) {
                    const itemEl = evt.item;
                    const lorebookName = itemEl.dataset.name;
                    const toFolderEl = evt.to.closest('.nemo-folder');
                    const fromFolderEl = evt.from.closest('.nemo-folder');

                    const fromFolderName = fromFolderEl ? fromFolderEl.dataset.folderName : null;
                    const toFolderName = toFolderEl ? toFolderEl.dataset.folderName : null;

                    // Remove from old folder
                    if (fromFolderName && self.folderState[fromFolderName]) {
                        const index = self.folderState[fromFolderName].indexOf(lorebookName);
                        if (index > -1) {
                            self.folderState[fromFolderName].splice(index, 1);
                        }
                    }

                    // Add to new folder
                    if (toFolderName && self.folderState[toFolderName]) {
                        self.folderState[toFolderName].splice(evt.newIndex, 0, lorebookName);
                    }
                    
                    self.saveFolderState();
                }
            });
        });
    },

    destroySortable: function() {
        const list = document.getElementById('nemo-world-info-list');
        if (!list) return;

        const unassignedContainer = document.getElementById('nemo-unassigned-lorebooks-container');
        const folderContents = list.querySelectorAll('.nemo-folder-content');
        const allLists = [unassignedContainer, ...Array.from(folderContents)].filter(Boolean);

        allLists.forEach(el => {
            const sortableElement = /** @type {any} */ (el);
            if (sortableElement._sortable) {
                sortableElement._sortable.destroy();
                delete sortableElement._sortable;
            }
        });
    },

    initSearch: function() {
        const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('nemo-world-info-search'));
        const lorebookList = document.getElementById('nemo-world-info-list');

        if (searchInput && lorebookList) {
            (/** @type {HTMLInputElement} */ (searchInput)).addEventListener('input', /** @type {any} */ (debounce(async (event) => {
                const sequence = ++this._searchSequence;
                const searchTerm = (/** @type {HTMLInputElement} */ (event.target)).value.toLowerCase();
                lorebookList.setAttribute('aria-busy', 'true');
                try {
                    const matchedBooks = await this.performSearch(searchTerm);
                    if (sequence !== this._searchSequence || this._abortController?.signal.aborted) return;

                    const allBooks = lorebookList.querySelectorAll('.nemo-lorebook-item');
                    allBooks.forEach(book => (/** @type {HTMLElement} */ (book)).style.display = 'none');
                    const allFolders = lorebookList.querySelectorAll('.nemo-folder');
                    allFolders.forEach(folder => (/** @type {HTMLElement} */ (folder)).style.display = 'none');

                    matchedBooks.forEach(bookName => {
                        const bookElement = Array.from(allBooks).find(book => book.dataset.name === bookName);
                        if (bookElement) {
                            (/** @type {HTMLElement} */ (bookElement)).style.display = '';
                            const parentFolder = bookElement.closest('.nemo-folder');
                            if (parentFolder) {
                                (/** @type {HTMLElement} */ (parentFolder)).style.display = '';
                                parentFolder.classList.add('open');
                            }
                        }
                    });

                    if (!searchTerm) {
                        allBooks.forEach(book => (/** @type {HTMLElement} */ (book)).style.display = '');
                        allFolders.forEach(folder => (/** @type {HTMLElement} */ (folder)).style.display = '');
                    }
                } finally {
                    if (sequence === this._searchSequence) lorebookList.setAttribute('aria-busy', 'false');
                }
            }, 300)));
        }
    },

    performSearch: async function(searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        if (!lowerCaseSearchTerm) return new Set(world_names);
        const matchedBooks = new Set();
    
        for (const name of world_names) {
            if (name.toLowerCase().includes(lowerCaseSearchTerm)) {
                matchedBooks.add(name);
                continue;
            }
    
            let world;
            try {
                world = await loadWorldInfo(name);
            } catch (error) {
                logger.warn(`Could not search lorebook "${name}"`, error);
                continue;
            }
            for (const entry of Object.values(world?.entries ?? {})) {
                const content = entry.content?.toLowerCase() || '';
                const comment = entry.comment?.toLowerCase() || '';
                const keys = (entry.key ?? []).join(',').toLowerCase();
    
                if (content.includes(lowerCaseSearchTerm) || comment.includes(lowerCaseSearchTerm) || keys.includes(lowerCaseSearchTerm)) {
                    matchedBooks.add(name);
                    break;
                }
            }
        }
    
        return matchedBooks;
    },

    moveSettingsPanel: function() {
        const settingsPanel = document.getElementById('wiActivationSettings');
        const newSettingsContainer = document.querySelector('#nemo-world-info-settings-panel .nemo-panel-content-wrapper');

        if (settingsPanel && newSettingsContainer) {
            this._settingsPlaceholder = document.createComment('nemo-world-info-settings-home');
            this._settingsDisplay = settingsPanel.style.display;
            settingsPanel.parentNode?.insertBefore(this._settingsPlaceholder, settingsPanel);
            newSettingsContainer.appendChild(settingsPanel);
            settingsPanel.style.display = '';
        }
    },

    initTabs: function() {
        const tabs = {
            entries: document.getElementById('nemo-world-info-entries-tab'),
            activeEntries: document.getElementById('nemo-world-info-active-entries-tab'),
            orderHelper: document.getElementById('nemo-world-info-order-helper-tab'),
            primaryKeywordPreview: document.getElementById('nemo-world-info-primary-keyword-preview-tab'),
            settings: document.getElementById('nemo-world-info-settings-tab'),
        };
        const panels = {
            entries: document.getElementById('nemo-world-info-entries-panel'),
            activeEntries: document.getElementById('nemo-world-info-active-entries-panel'),
            orderHelper: document.getElementById('nemo-world-info-order-helper-panel'),
            primaryKeywordPreview: document.getElementById('nemo-world-info-primary-keyword-preview-panel'),
            settings: document.getElementById('nemo-world-info-settings-panel'),
        };
        const signal = this._abortController?.signal;
        const listenerOptions = signal ? { signal } : undefined;
        const setActiveTab = tabName => {
            for (const name of Object.keys(tabs)) {
                const active = name === tabName;
                tabs[name]?.classList.toggle('active', active);
                tabs[name]?.setAttribute('aria-selected', String(active));
                if (tabs[name]) tabs[name].tabIndex = active ? 0 : -1;
                panels[name]?.classList.toggle('active', active);
                if (panels[name]) {
                    panels[name].hidden = !active;
                    panels[name].setAttribute('aria-hidden', String(!active));
                }
            }
        };
        tabs.entries?.addEventListener('click', () => setActiveTab('entries'), listenerOptions);
        tabs.activeEntries?.addEventListener('click', () => {
            setActiveTab('activeEntries');
            this.updateActiveEntriesPanel();
        }, listenerOptions);
        tabs.orderHelper?.addEventListener('click', () => {
            setActiveTab('orderHelper');
            this.populateOrderHelper();
        }, listenerOptions);
        tabs.primaryKeywordPreview?.addEventListener('click', () => setActiveTab('primaryKeywordPreview'), listenerOptions);
        tabs.settings?.addEventListener('click', () => setActiveTab('settings'), listenerOptions);
        setActiveTab('entries');
    },

    initLeftPanelToggle: function() {
        const toggleButton = document.getElementById('nemo-world-info-toggle-left-panel');
        const closeButton = document.getElementById('nemo-world-info-close-left-panel');
        const container = document.querySelector('.nemo-world-info-container');
        if (!toggleButton || !container) return;

        const signal = this._abortController?.signal;
        const listenerOptions = signal ? { signal } : undefined;
        const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
        const storageKey = 'nemo-wi-left-panel-state';
        const savedState = localStorage.getItem(storageKey);
        let isHidden = savedState === null ? isMobile() : savedState === 'true';

        const applyState = () => this.updateLeftPanelState(container, isHidden, isMobile());
        const persistState = () => localStorage.setItem(storageKey, String(isHidden));
        const togglePanel = () => {
            isHidden = !isHidden;
            applyState();
            persistState();
            if (!isHidden && isMobile()) document.getElementById('nemo-world-info-search')?.focus();
        };
        const hidePanel = () => {
            if (isHidden) return;
            isHidden = true;
            applyState();
            persistState();
            toggleButton.focus();
        };

        applyState();
        toggleButton.addEventListener('click', togglePanel, listenerOptions);
        closeButton?.addEventListener('click', hidePanel, listenerOptions);
        window.addEventListener('resize', debounce(applyState, 200), listenerOptions);
    },

    updateLeftPanelState: function(container, isHidden, mobile) {
        const toggleButton = document.getElementById('nemo-world-info-toggle-left-panel');
        const leftPanel = container.querySelector('.nemo-world-info-left-column');
        if (mobile) {
            container.classList.toggle('mobile-left-panel-visible', !isHidden);
            container.classList.remove('left-panel-hidden');
        } else {
            container.classList.toggle('left-panel-hidden', isHidden);
            container.classList.remove('mobile-left-panel-visible');
        }

        leftPanel?.setAttribute('aria-hidden', String(isHidden));
        if (leftPanel && !leftPanel.id) leftPanel.id = 'nemo-world-info-sidebar';
        if (toggleButton) {
            toggleButton.className = 'menu_button menu_button_icon fa-solid ' + (isHidden ? 'fa-bars' : 'fa-times');
            toggleButton.title = isHidden ? 'Show lorebook sidebar' : 'Hide lorebook sidebar';
            toggleButton.setAttribute('aria-label', toggleButton.title);
            toggleButton.setAttribute('aria-expanded', String(!isHidden));
            toggleButton.setAttribute('aria-controls', leftPanel?.id || 'nemo-world-info-sidebar');
        }
    },

    loadFolderState: function() {
        try {
            const state = localStorage.getItem(this.storageKey);
            this.folderState = state ? JSON.parse(state) : {};
        } catch (e) {
            logger.error('Error loading folder state', e);
            this.folderState = {};
        }
    },

    saveFolderState: function() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.folderState));
        } catch (e) {
            logger.error('Error saving folder state', e);
        }
    },

    initManagementButtons: function() {
        const signal = this._abortController?.signal;
        const listenerOptions = signal ? { signal } : undefined;
        document.getElementById('nemo-world-info-new-button')?.addEventListener('click', async () => {
            const tempName = getFreeWorldName();
            const finalName = await Popup.show.input('Create a new World Info', 'Enter a name for the new file:', tempName);
            if (finalName) await createNewWorldInfo(finalName, { interactive: true });
        }, listenerOptions);
        document.getElementById('nemo-world-info-import-button')?.addEventListener('click', () => {
            document.getElementById('world_import_file')?.click();
        }, listenerOptions);
        document.getElementById('nemo-world-info-new-folder-button')?.addEventListener('click', () => this.createNewFolder(), listenerOptions);
    },

    createNewFolder: async function() {
        const folderName = await Popup.show.input('Create New Folder', 'Enter a name for the new folder:');
        if (folderName && !this.folderState[folderName]) {
            this.folderState[folderName] = [];
            this.saveFolderState();
            this.refreshLorebookUI();
            
            const moveToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemo-world-info-move-toggle'));
            if (moveToggle && !moveToggle.checked) {
                moveToggle.checked = true;
                moveToggle.dispatchEvent(new Event('change'));
            }
        } else if (folderName) {
            Popup.show.text("A folder with that name already exists.");
        }
    },

    deleteFolder: async function(folderName) {
        const confirmation = await Popup.show.confirm(`Delete Folder`, `Are you sure you want to delete the folder "${folderName}"? Lorebooks inside will be moved to the unassigned area.`);
        if (confirmation) {
            delete this.folderState[folderName];
            this.saveFolderState();
            this.refreshLorebookUI();
        }
    },

    initUI: function(worldInfoSelect) {
        if (!(worldInfoSelect instanceof HTMLSelectElement)) {
            throw new Error('SillyTavern world_info selector was not available.');
        }

        this.populateLorebooksFromSelect(worldInfoSelect);
        this.initSearch();
        this.initTabs();
        this.initLeftPanelToggle();
        this.moveSettingsPanel();
        this.initManagementButtons();
        this.initPresetManagement();
        this.initOrderHelper();
        this.initPrimaryKeywordPreview();
        this.initEntryManagement();

        const signal = this._abortController?.signal;
        const listenerOptions = signal ? { signal } : undefined;
        const moveToggle = document.getElementById('nemo-world-info-move-toggle');
        const lorebookList = document.getElementById('nemo-world-info-list');
        moveToggle?.addEventListener('change', () => {
            const moving = Boolean(moveToggle.checked);
            lorebookList?.classList.toggle('nemo-move-mode', moving);
            moving ? this.initSortable() : this.destroySortable();
        }, listenerOptions);

        const refreshLorebookList = () => {
            this.populateLorebooksFromSelect(worldInfoSelect);
            this.updateActiveLorebooksList();
        };
        worldInfoSelect.addEventListener('change', refreshLorebookList, listenerOptions);
        this._worldSelectObserver = new MutationObserver(refreshLorebookList);
        this._worldSelectObserver.observe(worldInfoSelect, { childList: true, subtree: true });

        const entriesList = document.getElementById('world_popup_entries_list');
        if (entriesList) {
            this._entriesObserver = new MutationObserver(() => this.enhanceRenderedEntries());
            this._entriesObserver.observe(entriesList, { childList: true, subtree: true });
            this.enhanceRenderedEntries();
        }
    },

    /**
     * Load the extension-owned World Info stylesheet.
     */
    loadCSS: function() {
        const cssPath = getExtensionPath('features/world-info/world-info-ui.css');
        if (document.getElementById('nemo-world-info-styles')) return;
        const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(link => link.href === new URL(cssPath, document.baseURI).href);
        if (existing) {
            existing.id = 'nemo-world-info-styles';
            return;
        }

        const link = document.createElement('link');
        link.id = 'nemo-world-info-styles';
        link.rel = 'stylesheet';
        link.href = cssPath;
        link.dataset.nemoOwned = 'true';
        document.head.appendChild(link);
        this._stylesheetOwned = true;
    },

    enhanceRenderedEntries: function() {
        const entriesList = document.getElementById('world_popup_entries_list');
        const bookName = this._currentWorld?.name ?? this._selectedLorebookName;
        if (!entriesList || !bookName) return;
        const signal = this._abortController?.signal;
        const listenerOptions = signal ? { signal } : undefined;

        entriesList.querySelectorAll('.world_entry').forEach(entryEl => {
            if (entryEl.dataset.nemoListenersAdded === 'true') return;
            entryEl.dataset.nemoListenersAdded = 'true';
            entryEl.draggable = true;
            entryEl.setAttribute('aria-selected', 'false');

            entryEl.addEventListener('dragstart', event => {
                const uid = entryEl.getAttribute('uid');
                if (uid && this._selectedEntries.size === 0) this._selectedEntries.add(uid);
                event.dataTransfer?.setData('text/plain', JSON.stringify([...this._selectedEntries]));
            }, listenerOptions);

            entryEl.addEventListener('click', event => {
                const uid = entryEl.getAttribute('uid');
                if (!uid) return;
                if (this._selectionBook && this._selectionBook !== bookName) this._selectedEntries.clear();
                this._selectionBook = bookName;

                const allEntries = Array.from(entriesList.querySelectorAll('.world_entry'));
                if (event.shiftKey && this._lastSelectedEntry) {
                    const start = allEntries.findIndex(element => element.getAttribute('uid') === this._lastSelectedEntry);
                    const end = allEntries.indexOf(entryEl);
                    if (start >= 0 && end >= 0) {
                        allEntries.slice(Math.min(start, end), Math.max(start, end) + 1).forEach(element => {
                            const entryUid = element.getAttribute('uid');
                            if (entryUid) this._selectedEntries.add(entryUid);
                        });
                    }
                } else if (event.ctrlKey || event.metaKey) {
                    this._selectedEntries.has(uid) ? this._selectedEntries.delete(uid) : this._selectedEntries.add(uid);
                } else {
                    this._selectedEntries.clear();
                    this._selectedEntries.add(uid);
                }

                allEntries.forEach(element => {
                    const selected = this._selectedEntries.has(element.getAttribute('uid'));
                    element.classList.toggle('nemo-entry-selected', selected);
                    element.setAttribute('aria-selected', String(selected));
                });
                this._lastSelectedEntry = uid;
            }, listenerOptions);
        });
    },

    initialize: function() {
        if (this._abortController) return;
        logger.info('Initializing World Info UI Redesign...');
        this._abortController = new AbortController();
        this.loadCSS();
        this.loadFolderState();
        this.loadPresets();

        const clearActiveEntries = () => {
            this._activeEntries = [];
            if (document.getElementById('nemo-world-info-active-entries-panel')?.classList.contains('active')) {
                this.updateActiveEntriesPanel();
            }
        };
        this._activeEntriesHandler = entryList => {
            this._activeEntries = Array.isArray(entryList) ? entryList : [];
            if (document.getElementById('nemo-world-info-active-entries-panel')?.classList.contains('active')) {
                this.updateActiveEntriesPanel();
            }
        };
        this._generationStartedHandler = clearActiveEntries;
        this._chatChangedHandler = clearActiveEntries;
        this._worldInfoUpdatedHandler = (name, data) => {
            if (name === this._currentWorld?.name && data?.entries) this._currentWorld.data = data;
            this.refreshLorebookUI();
            this.enhanceRenderedEntries();
        };
        eventSource.on(event_types.WORLD_INFO_ACTIVATED, this._activeEntriesHandler);
        eventSource.on(event_types.GENERATION_STARTED, this._generationStartedHandler);
        eventSource.on(event_types.CHAT_CHANGED, this._chatChangedHandler);
        eventSource.on(event_types.WORLDINFO_UPDATED, this._worldInfoUpdatedHandler);

        const checkAndInject = async () => {
            if (this._uiInjected) return;
            const panel = document.getElementById('WorldInfo');
            if (!panel || window.getComputedStyle(panel).display === 'none') return;
            this._uiInjected = true;
            try {
                await this.injectUI();
                this.initUI(document.getElementById('world_info'));
                logger.info('Nemo World Info UI initialized successfully');
            } catch (error) {
                logger.error('Error during World Info UI injection', error);
                this._uiInjected = false;
            }
        };

        this._panelObserver = new MutationObserver(() => {
            const panel = document.getElementById('WorldInfo');
            if (panel && this._panelObserver) {
                this._panelObserver.disconnect();
                this._panelObserver.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
            }
            checkAndInject();
        });

        const panel = document.getElementById('WorldInfo');
        if (panel) {
            this._panelObserver.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
            checkAndInject();
        } else {
            this._panelObserver.observe(document.body, { childList: true, subtree: true });
        }
    },

    restoreNativePanel: function() {
        const originalPanel = document.getElementById('WorldInfo');
        const preserved = this._preservedPanel;
        if (!originalPanel || !preserved) return;

        const settingsPanel = document.getElementById('wiActivationSettings');
        if (settingsPanel && this._settingsPlaceholder?.parentNode) {
            settingsPanel.style.display = this._settingsDisplay ?? '';
            this._settingsPlaceholder.replaceWith(settingsPanel);
        }
        this._settingsPlaceholder = null;
        this._settingsDisplay = null;

        const nativeEntries = preserved.querySelector('#nemo-native-world-popup-entries-list');
        const nativePagination = preserved.querySelector('#nemo-native-world-info-pagination');
        if (nativeEntries) nativeEntries.id = 'world_popup_entries_list';
        if (nativePagination) nativePagination.id = 'world_info_pagination';
        originalPanel.replaceChildren(...preserved.childNodes);
        preserved.remove();
        this._preservedPanel = null;

        const editorSelect = document.getElementById('world_editor_select');
        if (editorSelect?.value) queueMicrotask(() => editorSelect.dispatchEvent(new Event('change')));
    },

    destroy: function() {
        this._loadSequence++;
        this._searchSequence++;
        this._previewSequence++;
        clearTimeout(this._previewTimer);
        this._previewTimer = null;
        this._abortController?.abort();
        this._abortController = null;
        this._panelObserver?.disconnect();
        this._worldSelectObserver?.disconnect();
        this._entriesObserver?.disconnect();
        this._panelObserver = null;
        this._worldSelectObserver = null;
        this._entriesObserver = null;
        if (this._activeEntriesHandler) eventSource.removeListener(event_types.WORLD_INFO_ACTIVATED, this._activeEntriesHandler);
        if (this._generationStartedHandler) eventSource.removeListener(event_types.GENERATION_STARTED, this._generationStartedHandler);
        if (this._chatChangedHandler) eventSource.removeListener(event_types.CHAT_CHANGED, this._chatChangedHandler);
        if (this._worldInfoUpdatedHandler) eventSource.removeListener(event_types.WORLDINFO_UPDATED, this._worldInfoUpdatedHandler);
        this._activeEntriesHandler = null;
        this._generationStartedHandler = null;
        this._chatChangedHandler = null;
        this._worldInfoUpdatedHandler = null;
        this._activeEntries = [];
        this.destroySortable();
        const orderHelper = /** @type {any} */ (document.getElementById('nemo-world-info-order-helper-list'));
        orderHelper?.sortable?.destroy();
        if (orderHelper) delete orderHelper.sortable;
        document.getElementById('nemo-wi-context-menu')?.remove();
        if (this._stylesheetOwned) document.getElementById('nemo-world-info-styles')?.remove();
        this._stylesheetOwned = false;
        this.restoreNativePanel();
        this._uiInjected = false;
        this._selectedItems.clear();
        this._selectedEntries.clear();
        this._selectionBook = null;
        this._lastSelectedEntry = null;
        this._selectedLorebookName = null;
        this._currentWorld = { name: null, data: null };
    },

    moveSelectedToFolder: function(targetFolderName, lorebookName) {
        // If a specific lorebook is passed, move only that one. Otherwise, move all selected.
        const itemsToMove = lorebookName ? [lorebookName] : Array.from(this._selectedItems);

        itemsToMove.forEach(item => {
            // Remove from any existing folder
            for (const folderName in this.folderState) {
                const index = this.folderState[folderName].indexOf(item);
                if (index > -1) {
                    this.folderState[folderName].splice(index, 1);
                }
            }
            // Add to new folder
            if (this.folderState[targetFolderName]) {
                this.folderState[targetFolderName].push(item);
            }
        });

        this._selectedItems.clear();
        this.saveFolderState();
        this.refreshLorebookUI();
    },

    showContextMenu: function(x, y) {
        document.getElementById('nemo-wi-context-menu')?.remove();
        if (this._selectedItems.size === 0) return;

        const menu = document.createElement('div');
        menu.id = 'nemo-wi-context-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Lorebook actions');

        const duplicateButton = document.createElement('button');
        duplicateButton.type = 'button';
        duplicateButton.className = 'nemo-context-menu-item';
        duplicateButton.setAttribute('role', 'menuitem');
        duplicateButton.textContent = this._selectedItems.size > 1 ? 'Duplicate selected lorebooks' : 'Duplicate lorebook';
        duplicateButton.addEventListener('click', async () => {
            duplicateButton.disabled = true;
            duplicateButton.textContent = 'Duplicating...';
            try {
                const reservedNames = new Set(world_names);
                for (const itemName of this._selectedItems) {
                    const fromBook = await loadWorldInfo(itemName);
                    if (!fromBook) continue;
                    let copyNumber = 1;
                    let newName = 'Copy of ' + itemName;
                    while (reservedNames.has(newName)) {
                        newName = 'Copy of ' + itemName + ' (' + copyNumber + ')';
                        copyNumber++;
                    }
                    reservedNames.add(newName);
                    await saveWorldInfo(newName, structuredClone(fromBook), true);
                }
                await updateWorldInfoList();
                this.refreshLorebookUI();
            } catch (error) {
                logger.error('Could not duplicate selected lorebooks', error);
                Popup.show.text('Could not duplicate the selected lorebook(s).');
            } finally {
                menu.remove();
            }
        });
        menu.appendChild(duplicateButton);

        const folderNames = Object.keys(this.folderState);
        if (folderNames.length > 0) {
            const label = document.createElement('div');
            label.className = 'nemo-context-menu-label';
            label.textContent = 'Move to folder';
            menu.appendChild(label);
            for (const folderName of folderNames) {
                const folderButton = document.createElement('button');
                folderButton.type = 'button';
                folderButton.className = 'nemo-context-menu-item';
                folderButton.setAttribute('role', 'menuitem');
                folderButton.textContent = folderName;
                folderButton.addEventListener('click', () => {
                    this.moveSelectedToFolder(folderName);
                    menu.remove();
                });
                menu.appendChild(folderButton);
            }
        }

        document.body.appendChild(menu);
        const menuBounds = menu.getBoundingClientRect();
        const gutter = 8;
        menu.style.left = Math.max(gutter, Math.min(x, window.innerWidth - menuBounds.width - gutter)) + 'px';
        menu.style.top = Math.max(gutter, Math.min(y, window.innerHeight - menuBounds.height - gutter)) + 'px';
        duplicateButton.focus();

        const signal = this._abortController?.signal;
        const closeMenu = event => {
            if (event.type === 'keydown' && event.key !== 'Escape') return;
            if (event.type === 'click' && menu.contains(event.target)) return;
            menu.remove();
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('keydown', closeMenu);
        };
        queueMicrotask(() => {
            if (signal?.aborted) return;
            const options = signal ? { signal } : undefined;
            document.addEventListener('click', closeMenu, options);
            document.addEventListener('keydown', closeMenu, options);
        });
    },

    initPresetManagement: function() {
        const presetSelect = document.getElementById('nemo-world-info-preset-select');
        presetSelect.addEventListener('change', () => this.activatePreset());

        document.getElementById('nemo-world-info-preset-new').addEventListener('click', () => this.createNewPreset());
        document.getElementById('nemo-world-info-preset-update').addEventListener('click', () => this.updatePreset());
        document.getElementById('nemo-world-info-preset-rename').addEventListener('click', () => this.renamePreset());
        document.getElementById('nemo-world-info-preset-delete').addEventListener('click', () => this.deletePreset());
        document.getElementById('nemo-world-info-preset-import').addEventListener('click', () => this.importPreset());
        document.getElementById('nemo-world-info-preset-export').addEventListener('click', () => this.exportPreset());

        this.populatePresetSelect();
    },

    populatePresetSelect: function() {
        const presetSelect = document.getElementById('nemo-world-info-preset-select');
        if (!(presetSelect instanceof HTMLSelectElement)) return;

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Select Preset --';
        presetSelect.replaceChildren(placeholder);
        for (const presetName of Object.keys(this._presets)) {
            const option = document.createElement('option');
            option.value = presetName;
            option.textContent = presetName;
            presetSelect.appendChild(option);
        }
        presetSelect.value = this._currentPreset;
    },

    activatePreset: function() {
        const presetSelect = document.getElementById('nemo-world-info-preset-select');
        const worldInfoSelect = document.getElementById('world_info');
        if (!(presetSelect instanceof HTMLSelectElement) || !(worldInfoSelect instanceof HTMLSelectElement)) return;

        const presetName = presetSelect.value;
        this._currentPreset = presetName;
        if (!presetName || !Object.hasOwn(this._presets, presetName)) return;

        const lorebookNames = this._presets[presetName];
        for (const option of worldInfoSelect.options) {
            option.selected = lorebookNames.includes(option.text);
        }
        $(worldInfoSelect).trigger('change');
        this.refreshLorebookUI();
    },

    createNewPreset: async function() {
        const requestedName = await Popup.show.input('Create New Preset', 'Enter a name for the new preset:');
        if (typeof requestedName !== 'string') return;
        const presetName = requestedName.trim();
        if (!isSafePresetName(presetName)) {
            Popup.show.text('Enter a non-empty preset name that is not reserved.');
            return;
        }
        if (Object.hasOwn(this._presets, presetName)) {
            Popup.show.text('A preset with that name already exists.');
            return;
        }

        const worldInfoSelect = document.getElementById('world_info');
        if (!(worldInfoSelect instanceof HTMLSelectElement)) return;
        this._presets[presetName] = Array.from(worldInfoSelect.selectedOptions, option => option.text);
        this._currentPreset = presetName;
        this.savePresets();
        this.populatePresetSelect();
    },

    updatePreset: async function() {
        if (!this._currentPreset || !Object.hasOwn(this._presets, this._currentPreset)) {
            Popup.show.text('No preset selected to update.');
            return;
        }

        const worldInfoSelect = document.getElementById('world_info');
        if (!(worldInfoSelect instanceof HTMLSelectElement)) return;
        this._presets[this._currentPreset] = Array.from(worldInfoSelect.selectedOptions, option => option.text);
        this.savePresets();
        Popup.show.text(`Preset "${this._currentPreset}" updated.`);
    },

    renamePreset: async function() {
        if (!this._currentPreset || !Object.hasOwn(this._presets, this._currentPreset)) {
            Popup.show.text('No preset selected to rename.');
            return;
        }

        const requestedName = await Popup.show.input('Rename Preset', 'Enter the new name for the preset:', this._currentPreset);
        if (typeof requestedName !== 'string') return;
        const newName = requestedName.trim();
        if (newName === this._currentPreset) return;
        if (!isSafePresetName(newName)) {
            Popup.show.text('Enter a non-empty preset name that is not reserved.');
            return;
        }
        if (Object.hasOwn(this._presets, newName)) {
            Popup.show.text('A preset with that name already exists.');
            return;
        }

        this._presets[newName] = this._presets[this._currentPreset];
        delete this._presets[this._currentPreset];
        this._currentPreset = newName;
        this.savePresets();
        this.populatePresetSelect();
    },

    deletePreset: async function() {
        if (!this._currentPreset || !Object.hasOwn(this._presets, this._currentPreset)) {
            Popup.show.text('No preset selected to delete.');
            return;
        }

        const confirmation = await Popup.show.confirm('Delete Preset', `Are you sure you want to delete the preset "${this._currentPreset}"?`);
        if (!confirmation) return;
        delete this._presets[this._currentPreset];
        this._currentPreset = '';
        this.savePresets();
        this.populatePresetSelect();
    },

    importPreset: function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', async event => {
            const file = /** @type {HTMLInputElement} */(event.target).files?.[0];
            if (!file) return;

            try {
                const importedPresets = normalizePresetMap(JSON.parse(await file.text()));
                if (!importedPresets) {
                    Popup.show.text('Invalid preset file. Every preset must have a safe name and a list of lorebook names.');
                    return;
                }
                const importedEntries = Object.entries(importedPresets);
                if (importedEntries.length === 0) {
                    Popup.show.text('No presets were found in that file.');
                    return;
                }

                const nextPresets = normalizePresetMap(this._presets);
                if (!nextPresets) throw new Error('Existing preset state is invalid.');
                for (const [presetName, lorebookNames] of importedEntries) {
                    if (Object.hasOwn(nextPresets, presetName)) {
                        const overwrite = await Popup.show.confirm('Preset Exists', `A preset named "${presetName}" already exists. Overwrite it?`);
                        if (!overwrite) continue;
                    }
                    nextPresets[presetName] = [...lorebookNames];
                }

                this._presets = nextPresets;
                this.savePresets();
                this.populatePresetSelect();
                Popup.show.text('Presets imported successfully.');
            } catch (error) {
                logger.error('Error importing presets', error);
                Popup.show.text('Failed to import presets. Check that the file contains a valid preset map.');
            }
        }, { once: true });
        input.click();
    },

    exportPreset: function() {
        if (!this._currentPreset || !Object.hasOwn(this._presets, this._currentPreset)) {
            Popup.show.text('No preset selected to export.');
            return;
        }

        const presetData = Object.create(null);
        presetData[this._currentPreset] = [...this._presets[this._currentPreset]];
        const blob = new Blob([JSON.stringify(presetData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${this._currentPreset}.preset.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    },

    refreshLorebookUI: function() {
        if (this._isRefreshingUI) return; // Re-entrancy guard

        this._isRefreshingUI = true;
        try {
            const worldInfoSelect = document.getElementById('world_info');
            if (worldInfoSelect) {
                this.populateLorebooksFromSelect(worldInfoSelect);
                this.updateActiveLorebooksList();

                // Restore selected lorebook highlight after rebuild
                if (this._selectedLorebookName) {
                    document.querySelectorAll('.nemo-lorebook-item').forEach(item => {
                        item.classList.toggle('nemo-lorebook-selected', /** @type {HTMLElement} */ (item).dataset.name === this._selectedLorebookName);
                    });
                }
            }
        } finally {
            this._isRefreshingUI = false;
        }
    },

    loadPresets: function() {
        try {
            const state = localStorage.getItem(this.presetStorageKey);
            if (!state) {
                this._presets = Object.create(null);
                return;
            }

            const presets = normalizePresetMap(JSON.parse(state));
            if (!presets) throw new Error('Stored preset data failed validation.');
            this._presets = presets;
        } catch (error) {
            logger.error(`${LOG_PREFIX} Error loading presets:`, error);
            this._presets = Object.create(null);
            this._currentPreset = '';
            Popup.show.text('Saved lorebook presets were invalid and could not be loaded.');
        }
    },

    savePresets: function() {
        try {
            const presets = normalizePresetMap(this._presets);
            if (!presets) throw new Error('Preset data failed validation.');
            this._presets = presets;
            localStorage.setItem(this.presetStorageKey, JSON.stringify(presets));
        } catch (error) {
            logger.error(`${LOG_PREFIX} Error saving presets:`, error);
            Popup.show.text('Lorebook presets could not be saved because their data was invalid.');
        }
    },

    updateActiveEntriesPanel: function() {
        const listElement = document.getElementById('nemo-world-info-active-entries-list');
        const groupByBook = document.getElementById('nemo-active-entries-group-by-book');
        const showInOrder = document.getElementById('nemo-active-entries-show-in-order');
        if (!listElement || !groupByBook || !showInOrder) return;
        listElement.replaceChildren();

        const entryLabel = entry => entry.comment?.trim() || (entry.key ?? []).join(', ') || 'Untitled entry';
        const activeEntries = [...this._activeEntries];
        activeEntries.sort((a, b) => {
            if (showInOrder.checked) {
                const depthDifference = (b.depth ?? Number.MAX_SAFE_INTEGER) - (a.depth ?? Number.MAX_SAFE_INTEGER);
                if (depthDifference) return depthDifference;
                const orderDifference = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
                if (orderDifference) return orderDifference;
            }
            return entryLabel(a).localeCompare(entryLabel(b));
        });

        if (activeEntries.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'nemo-wi-helper-empty';
            empty.textContent = 'No lorebook entries have activated in this chat yet.';
            listElement.appendChild(empty);
            return;
        }

        if (groupByBook.checked) {
            const grouped = new Map();
            for (const entry of activeEntries) {
                const bookName = entry.world || 'Unknown lorebook';
                if (!grouped.has(bookName)) grouped.set(bookName, []);
                grouped.get(bookName).push(entry);
            }
            for (const [bookName, entries] of grouped) {
                const group = document.createElement('section');
                group.className = 'nemo-active-entry-group';
                const groupHeader = document.createElement('h3');
                groupHeader.className = 'nemo-active-entry-group-header';
                groupHeader.textContent = bookName;
                group.appendChild(groupHeader);
                for (const entry of entries) {
                    const item = document.createElement('div');
                    item.className = 'nemo-active-entry-item';
                    item.textContent = entryLabel(entry);
                    group.appendChild(item);
                }
                listElement.appendChild(group);
            }
            return;
        }

        for (const entry of activeEntries) {
            const item = document.createElement('div');
            item.className = 'nemo-active-entry-item';
            item.textContent = (entry.world || 'Unknown lorebook') + ': ' + entryLabel(entry);
            listElement.appendChild(item);
        }
    },

    initOrderHelper: function() {
        document.getElementById('nemo-order-helper-apply')?.addEventListener('click', () => this.applyOrderHelper());
        
    },

    populateOrderHelper: async function() {
        const listElement = document.getElementById('nemo-world-info-order-helper-list');
        if (!listElement) return;
        listElement.setAttribute('aria-busy', 'true');
        listElement.textContent = 'Loading entries...';

        let entries = [...this._activeEntries];

        // If no active entries from generation, load from current lorebook
        if (entries.length === 0 && this._currentWorld?.name) {
            try {
                const world = await loadWorldInfo(this._currentWorld.name);
                entries = Object.entries(world?.entries ?? {}).map(([uid, entry]) => ({
                    ...entry, uid, world: this._currentWorld.name,
                })).filter(e => !e.disable);
                entries.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            } catch (e) {
                logger.error('Error loading lorebook for order helper', e);
            }
        }

        listElement.replaceChildren();
        listElement.setAttribute('aria-busy', 'false');

        if (entries.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'nemo-wi-helper-empty';
            empty.textContent = 'No entries available. Select a lorebook, or generate a message to populate active entries.';
            listElement.appendChild(empty);
            return;
        }

        entries.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'nemo-order-helper-item';
            const label = entry.comment ?? (entry.key ? entry.key.join(', ') : 'Untitled');
            const handle = document.createElement('span');
            handle.className = 'nemo-order-helper-handle';
            handle.textContent = '\u2630';
            const labelElement = document.createElement('span');
            labelElement.className = 'nemo-order-helper-label';
            labelElement.textContent = `${entry.world}: ${label}`;
            const orderElement = document.createElement('span');
            orderElement.className = 'nemo-order-helper-order';
            orderElement.textContent = `#${entry.order ?? '\u2014'}`;
            item.append(handle, document.createTextNode(' '), labelElement, document.createTextNode(' '), orderElement);
            item.dataset.book = entry.world;
            item.dataset.uid = entry.uid;
            listElement.appendChild(item);
        });

        if (typeof Sortable !== 'undefined') {
            if (/** @type {any} */(listElement).sortable) /** @type {any} */(listElement).sortable.destroy();
            /** @type {any} */(listElement).sortable = new Sortable(listElement, { animation: 150, handle: '.nemo-order-helper-handle' });
        }
    },

    applyOrderHelper: async function() {
        const startInput = document.getElementById('nemo-order-helper-start');
        const stepInput = document.getElementById('nemo-order-helper-step');
        const descendingInput = document.getElementById('nemo-order-helper-descending');
        const listElement = document.getElementById('nemo-world-info-order-helper-list');
        if (!(startInput instanceof HTMLInputElement)
            || !(stepInput instanceof HTMLInputElement)
            || !(descendingInput instanceof HTMLInputElement)
            || !listElement) {
            return;
        }

        const start = Number.parseInt(startInput.value, 10);
        const step = Number.parseInt(stepInput.value, 10);
        if (!Number.isFinite(start) || !Number.isFinite(step)) {
            Popup.show.text('Enter valid start and step values.');
            return;
        }

        const descending = descendingInput.checked;
        const items = Array.from(listElement.children);
        let currentOrder = start;
        if (descending) {
            items.reverse();
        }

        const booksToSave = new Map();
        for (const item of items) {
            const bookName = /** @type {HTMLElement} */(item).dataset.book;
            const uid = /** @type {HTMLElement} */(item).dataset.uid;
            if (!bookName || uid === undefined) continue;

            if (!booksToSave.has(bookName)) {
                const book = await loadWorldInfo(bookName);
                if (book) booksToSave.set(bookName, book);
            }

            const book = booksToSave.get(bookName);
            if (book?.entries?.[uid]) {
                book.entries[uid].order = currentOrder;
                currentOrder += step;
            }
        }

        for (const [bookName, book] of booksToSave) {
            await saveWorldInfo(bookName, book, true);
        }

        Popup.show.text('Order updated successfully.');
    },
    initPrimaryKeywordPreview: function() {
        const input = document.getElementById('nemo-primary-keyword-preview-input');
        const scope = document.getElementById('nemo-primary-keyword-preview-scope');
        if (!(input instanceof HTMLTextAreaElement)) return;
        const signal = this._abortController?.signal;
        const schedule = () => {
            clearTimeout(this._previewTimer);
            this._previewTimer = setTimeout(() => {
                this._previewTimer = null;
                if (!signal?.aborted) this.runPrimaryKeywordPreview();
            }, 300);
        };
        input.addEventListener('input', schedule, signal ? { signal } : undefined);
        scope?.addEventListener('change', schedule, signal ? { signal } : undefined);
        signal?.addEventListener('abort', () => {
            clearTimeout(this._previewTimer);
            this._previewTimer = null;
        }, { once: true });
    },

    runPrimaryKeywordPreview: async function() {
        const sequence = ++this._previewSequence;
        const input = document.getElementById('nemo-primary-keyword-preview-input');
        const results = document.getElementById('nemo-primary-keyword-preview-results');
        const scopeSelect = document.getElementById('nemo-primary-keyword-preview-scope');
        if (!(input instanceof HTMLTextAreaElement) || !results) return;
        const text = input.value.trim();
        results.replaceChildren();
        if (!text) {
            results.removeAttribute('aria-busy');
            return;
        }

        const scope = scopeSelect?.value ?? 'current';
        let lorebooksToScan = [];
        let emptyScopeMessage = '';
        if (scope === 'current') {
            if (this._currentWorld?.name) {
                lorebooksToScan = [this._currentWorld.name];
            } else {
                emptyScopeMessage = 'Select a lorebook to preview primary keywords.';
            }
        } else if (scope === 'active') {
            const worldInfoSelect = document.getElementById('world_info');
            lorebooksToScan = worldInfoSelect instanceof HTMLSelectElement
                ? Array.from(worldInfoSelect.selectedOptions, option => option.text)
                : [];
            if (lorebooksToScan.length === 0) emptyScopeMessage = 'No active lorebooks to preview.';
        } else if (scope === 'all') {
            lorebooksToScan = [...world_names];
            if (lorebooksToScan.length === 0) emptyScopeMessage = 'No lorebooks are available to preview.';
        }

        if (emptyScopeMessage) {
            const empty = document.createElement('div');
            empty.className = 'list-group-item';
            empty.textContent = emptyScopeMessage;
            results.appendChild(empty);
            results.removeAttribute('aria-busy');
            return;
        }

        results.setAttribute('aria-busy', 'true');
        results.textContent = 'Checking primary keywords...';
        const triggeredEntries = new Set();
        let failedBooks = 0;

        for (const bookName of lorebooksToScan) {
            try {
                const world = await loadWorldInfo(bookName);
                if (sequence !== this._previewSequence) return;
                for (const entry of Object.values(world?.entries ?? {})) {
                    if (entry.disable) continue;
                    const label = entry.comment?.trim() || (entry.key ?? []).join(', ') || 'Untitled entry';
                    for (const keyword of entry.key ?? []) {
                        if (!keyword || keyword.length > 500) continue;
                        try {
                            let expression;
                            if (keyword.startsWith('/') && keyword.lastIndexOf('/') > 0) {
                                const lastSlash = keyword.lastIndexOf('/');
                                expression = new RegExp(keyword.slice(1, lastSlash), keyword.slice(lastSlash + 1));
                            } else {
                                expression = createLiteralKeywordExpression(keyword, entry);
                            }
                            if (expression.test(text)) {
                                triggeredEntries.add(bookName + ': ' + label);
                                break;
                            }
                        } catch (error) {
                            logger.warn('Skipped an invalid lorebook keyword expression', { bookName, keyword, error });
                        }
                    }
                }
            } catch (error) {
                failedBooks++;
                logger.warn('Could not scan lorebook', { bookName, error });
            }
        }

        if (sequence !== this._previewSequence) return;
        results.replaceChildren();
        results.setAttribute('aria-busy', 'false');
        if (triggeredEntries.size === 0) {
            const empty = document.createElement('div');
            empty.className = 'list-group-item';
            empty.textContent = failedBooks > 0
                ? 'No primary keyword matches. ' + failedBooks + ' lorebook(s) could not be read.'
                : 'No primary keyword matches.';
            results.appendChild(empty);
            return;
        }

        for (const entryText of [...triggeredEntries].sort()) {
            const item = document.createElement('div');
            item.className = 'list-group-item';
            item.textContent = entryText;
            results.appendChild(item);
        }
        if (failedBooks > 0) {
            const warning = document.createElement('p');
            warning.className = 'nemo-wi-preview-warning';
            warning.textContent = failedBooks + ' lorebook(s) could not be read.';
            results.appendChild(warning);
        }
    },

    initEntryManagement: function() {
        const signal = this._abortController?.signal;
        const listenerOptions = signal ? { signal } : undefined;
        const proxies = {
            'nemo-world-info-entry-new': 'world_popup_new',
            'nemo-world-info-entry-rename': 'world_popup_name_button',
            'nemo-world-info-entry-duplicate': 'world_duplicate',
            'nemo-world-info-entry-export': 'world_popup_export',
            'nemo-world-info-entry-delete': 'world_popup_delete',
            'nemo-world-info-entry-open-all': 'OpenAllWIEntries',
            'nemo-world-info-entry-close-all': 'CloseAllWIEntries',
            'nemo-world-info-entry-fill-memos': 'world_backfill_memos',
            'nemo-world-info-entry-apply-sort': 'world_apply_current_sorting',
            'nemo-world-info-entry-refresh': 'world_refresh',
        };
        for (const [proxyId, nativeId] of Object.entries(proxies)) {
            document.getElementById(proxyId)?.addEventListener('click', () => document.getElementById(nativeId)?.click(), listenerOptions);
        }

        const nemoSearch = document.getElementById('nemo-world-info-entry-search');
        const originalSearch = document.getElementById('world_info_search');
        nemoSearch?.addEventListener('input', () => {
            if (originalSearch) {
                originalSearch.value = nemoSearch.value;
                originalSearch.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, listenerOptions);

        const nemoSort = document.getElementById('nemo-world-info-entry-sort');
        const originalSort = document.getElementById('world_info_sort_order');
        if (nemoSort && originalSort) {
            nemoSort.replaceChildren(...Array.from(originalSort.options, option => option.cloneNode(true)));
            nemoSort.value = originalSort.value;
            nemoSort.addEventListener('change', () => {
                originalSort.value = nemoSort.value;
                originalSort.dispatchEvent(new Event('change', { bubbles: true }));
            }, listenerOptions);
        }
    }
};
