import { LOG_PREFIX } from './utils.js';
import { debounce, navigation_option } from '../../../../scripts/utils.js';
import { Popup } from '../../../../scripts/popup.js';
import { getFreeWorldName, createNewWorldInfo, loadWorldInfo, world_names, saveWorldInfo, createWorldInfoEntry, deleteWorldInfoEntry, deleteWIOriginalDataValue } from '../../../../scripts/world-info.js';
import { eventSource, event_types } from '../../../../script.js';
import { accountStorage } from '../../../../scripts/util/AccountStorage.js';

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

/**
 * @global
 * @property {function(string, WorldInfoData, WorldInfoEntry): Promise<JQuery<HTMLElement>>} getWorldEntry
 * @property {function(string, WorldInfoData, ...any): Promise<void>} displayWorldEntries
 */

export const NemoWorldInfoUI = {
    _currentWorld: { name: null, data: null },
    _selectedItems: new Set(),
    _selectedEntries: new Set(),
    _selectionBook: null,
    _lastSelectedEntry: null,
    _clipboard: { items: new Set(), cut: false },
    _uiInjected: false,
    _isRefreshingUI: false,
    folderState: {},
    storageKey: 'nemo-wi-folder-state',
    _presets: {},
    _currentPreset: '',
    presetStorageKey: 'nemo-wi-presets',
    _activeEntries: [],

    injectUI: async function() {
        try {
            const response = await fetch('scripts/extensions/third-party/NemoPresetExt/world-info-ui.html');
            if (!response.ok) {
                throw new Error(`Failed to fetch UI template: ${response.statusText}`);
            }
            const html = await response.text();
            
            const originalPanel = document.getElementById('WorldInfo');
            if (originalPanel) {
                // Preserve the elements the original script needs
                const settingsPanel = document.getElementById('wiActivationSettings');
                const editorSelect = document.getElementById('world_editor_select');
                const createButton = document.getElementById('world_create_button');
                const importButton = document.getElementById('world_import_button');
                const importFileInput = document.getElementById('world_import_file');
                const worldInfoSelect = document.getElementById('world_info');

                if (worldInfoSelect) {
                    document.body.appendChild(worldInfoSelect);
                    worldInfoSelect.style.display = 'none';
                }
                if (settingsPanel) {
                    document.body.appendChild(settingsPanel);
                    settingsPanel.style.display = 'none';
                }
                if (editorSelect) {
                    document.body.appendChild(editorSelect);
                    editorSelect.style.display = 'none';
                }
                if (createButton) {
                    document.body.appendChild(createButton);
                    createButton.style.display = 'none';
                }
                if (importButton) {
                    document.body.appendChild(importButton);
                    importButton.style.display = 'none';
                }
                if (importFileInput) {
                    document.body.appendChild(importFileInput);
                    importFileInput.style.display = 'none';
                }

                // Preserve all controls needed by the original script
                const idsToPreserve = [
                    'world_popup_name_button', 'OpenAllWIEntries', 'CloseAllWIEntries', 'world_popup_new',
                    'world_backfill_memos', 'world_apply_current_sorting', 'world_popup_export',
                    'world_duplicate', 'world_popup_delete', 'world_info_search', 'world_info_sort_order',
                    'world_refresh'
                ];
        
                idsToPreserve.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        document.body.appendChild(el);
                        el.style.display = 'none';
                    }
                });

                originalPanel.innerHTML = html;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error injecting UI:`, error);
        }
    },

    displayLorebookEntries: async function(lorebookName) {
        const worldEditorSelect = /** @type {HTMLSelectElement} */ (document.getElementById('world_editor_select'));
        if (worldEditorSelect) {
            const option = Array.from(worldEditorSelect.options).find(opt => opt.text === lorebookName);
            if (option) {
                worldEditorSelect.value = option.value;
                worldEditorSelect.dispatchEvent(new Event('change'));
            }
        }
    },

    updateActiveLorebooksList: function() {
        this.updateActiveEntriesPanel();
        const activeList = document.getElementById('nemo-world-info-active-list');
        const worldInfoSelect = /** @type {HTMLSelectElement} */ (document.getElementById('world_info'));
        if (!activeList || !worldInfoSelect) return;

        activeList.innerHTML = '';
        const selectedOptions = Array.from(worldInfoSelect.selectedOptions);

        for (const option of selectedOptions) {
            const activeItem = document.createElement('div');
            activeItem.className = 'nemo-active-lorebook-item';
            activeItem.textContent = option.text;
            
            const removeButton = document.createElement('div');
            removeButton.className = 'nemo-remove-lorebook-button';
            removeButton.textContent = '✖';
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

    populateLorebooksFromSelect: function(selectElement) {
        const lorebookList = document.getElementById('nemo-world-info-list');
        if (!lorebookList) return;

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
                    const folderContent = lorebookList.querySelector(`.nemo-folder[data-folder-name="${folderName}"] .nemo-folder-content`);
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

        this.updateActiveLorebooksList();
    },

    createLorebookElement: function(option) {
        const lorebookItem = document.createElement('div');
        lorebookItem.className = 'nemo-lorebook-item';
        lorebookItem.dataset.name = option.text;

        const dragHandle = document.createElement('div');
        dragHandle.className = 'nemo-drag-handle';
        dragHandle.innerHTML = '&#9776;'; // Unicode for "hamburger" icon
        lorebookItem.appendChild(dragHandle);

        const textSpan = document.createElement('span');
        textSpan.className = 'nemo-lorebook-item-text';
        textSpan.textContent = option.text;
        lorebookItem.appendChild(textSpan);

        lorebookItem.addEventListener('click', (e) => {
            const moveToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemo-world-info-move-toggle'));
            if (moveToggle.checked) return;

            if (e.ctrlKey) {
                e.preventDefault();
                lorebookItem.classList.toggle('selected');
                if (lorebookItem.classList.contains('selected')) {
                    this._selectedItems.add(option.text);
                } else {
                    this._selectedItems.delete(option.text);
                }
            } else {
                // Clear selection if not holding ctrl
                if (!e.ctrlKey) {
                    document.querySelectorAll('.nemo-lorebook-item.selected').forEach(item => item.classList.remove('selected'));
                    this._selectedItems.clear();
                }
                this.displayLorebookEntries(option.text);
            }
        });

        lorebookItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this._selectedItems.has(option.text)) {
                document.querySelectorAll('.nemo-lorebook-item.selected').forEach(item => item.classList.remove('selected'));
                this._selectedItems.clear();
                lorebookItem.classList.add('selected');
                this._selectedItems.add(option.text);
            }
            this.showContextMenu(e.clientX, e.clientY);
        });

        const addButton = document.createElement('div');
        addButton.className = 'nemo-add-lorebook-button';
        addButton.textContent = '✚';
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
        
        console.log(`${LOG_PREFIX} Creating folder element:`, {
            folderName: folderName,
            className: folderElement.className,
            hasOpenClass: folderElement.classList.contains('open')
        });

        const header = document.createElement('div');
        header.className = 'nemo-folder-header';
        header.innerHTML = `<span class="nemo-folder-toggle">▶</span> ${folderName}`;
        header.addEventListener('click', () => {
            folderElement.classList.toggle('open');
            console.log(`${LOG_PREFIX} Folder toggle clicked:`, {
                folderName: folderName,
                isOpen: folderElement.classList.contains('open'),
                className: folderElement.className
            });
        });

        const deleteButton = document.createElement('div');
        deleteButton.className = 'nemo-delete-folder-button';
        deleteButton.innerHTML = '&#10006;'; // Cross icon
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
            const lorebookNames = JSON.parse(e.dataTransfer.getData('text/plain'));
            lorebookNames.forEach(name => this.moveSelectedToFolder(folderName, name));
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
            console.warn(`${LOG_PREFIX} Sortable.js not found. Drag-and-drop functionality will be disabled.`);
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
            new Sortable(/** @type {HTMLElement} */ (el), {
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
            if (/** @type {any} */ (el)._sortable) {
                /** @type {any} */ (el)._sortable.destroy();
            }
        });
    },

    initSearch: function() {
        const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('nemo-world-info-search'));
        const lorebookList = document.getElementById('nemo-world-info-list');

        if (searchInput && lorebookList) {
            (/** @type {HTMLInputElement} */ (searchInput)).addEventListener('input', /** @type {any} */ (debounce(async (event) => {
                const searchTerm = (/** @type {HTMLInputElement} */ (event.target)).value.toLowerCase();
                const matchedBooks = await this.performSearch(searchTerm);

                // Hide all books and folders initially
                const allBooks = lorebookList.querySelectorAll('.nemo-lorebook-item');
                allBooks.forEach(book => (/** @type {HTMLElement} */ (book)).style.display = 'none');
                const allFolders = lorebookList.querySelectorAll('.nemo-folder');
                allFolders.forEach(folder => (/** @type {HTMLElement} */ (folder)).style.display = 'none');

                // Show only matched books and their parent folders
                matchedBooks.forEach(bookName => {
                    const bookElement = lorebookList.querySelector(`.nemo-lorebook-item[data-name="${bookName}"]`);
                    if (bookElement) {
                        (/** @type {HTMLElement} */ (bookElement)).style.display = '';
                        const parentFolder = bookElement.closest('.nemo-folder');
                        if (parentFolder) {
                            (/** @type {HTMLElement} */ (parentFolder)).style.display = '';
                            if (!parentFolder.classList.contains('open')) {
                                parentFolder.classList.add('open');
                            }
                        }
                    }
                });

                // If search is empty, show everything
                if (!searchTerm) {
                    allBooks.forEach(book => (/** @type {HTMLElement} */ (book)).style.display = '');
                    allFolders.forEach(folder => (/** @type {HTMLElement} */ (folder)).style.display = '');
                }
            }, 300)));
        }
    },

    performSearch: async function(searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const matchedBooks = new Set();
    
        for (const name of world_names) {
            if (name.toLowerCase().includes(lowerCaseSearchTerm)) {
                matchedBooks.add(name);
                continue;
            }
    
            const world = await loadWorldInfo(name);
            for (const entry of Object.values(world.entries)) {
                const content = entry.content?.toLowerCase() || '';
                const comment = entry.comment?.toLowerCase() || '';
                const keys = entry.key.join(',').toLowerCase();
    
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
            newSettingsContainer.appendChild(settingsPanel);
            settingsPanel.style.display = ''; // Make it visible again
        }
    },

    initTabs: function() {
        const tabs = {
            entries: document.getElementById('nemo-world-info-entries-tab'),
            activeEntries: document.getElementById('nemo-world-info-active-entries-tab'),
            orderHelper: document.getElementById('nemo-world-info-order-helper-tab'),
            loreSimulator: document.getElementById('nemo-world-info-lore-simulator-tab'),
            settings: document.getElementById('nemo-world-info-settings-tab'),
        };
        const panels = {
            entries: document.getElementById('nemo-world-info-entries-panel'),
            activeEntries: document.getElementById('nemo-world-info-active-entries-panel'),
            orderHelper: document.getElementById('nemo-world-info-order-helper-panel'),
            loreSimulator: document.getElementById('nemo-world-info-lore-simulator-panel'),
            settings: document.getElementById('nemo-world-info-settings-panel'),
        };

        const setActiveTab = (tabName) => {
            for (const name in tabs) {
                tabs[name].classList.toggle('active', name === tabName);
                panels[name].classList.toggle('active', name === tabName);
            }
        };

        tabs.entries.addEventListener('click', () => setActiveTab('entries'));
        tabs.activeEntries.addEventListener('click', () => {
            setActiveTab('activeEntries');
            this.updateActiveEntriesPanel();
        });
        tabs.orderHelper.addEventListener('click', () => {
            setActiveTab('orderHelper');
            this.populateOrderHelper();
        });
        tabs.loreSimulator.addEventListener('click', () => setActiveTab('loreSimulator'));
        tabs.settings.addEventListener('click', () => setActiveTab('settings'));
    },

    initLeftPanelToggle: function() {
        const toggleButton = document.getElementById('nemo-world-info-toggle-left-panel');
        const closeButton = document.getElementById('nemo-world-info-close-left-panel');
        const container = document.querySelector('.nemo-world-info-container');
        
        if (!toggleButton || !container) return;

        // Check if we're on mobile
        const isMobile = () => window.innerWidth <= 768;
        
        // Load saved state from localStorage
        const storageKey = 'nemo-wi-left-panel-state';
        const savedState = localStorage.getItem(storageKey);
        
        let isHidden = false;
        if (savedState !== null) {
            isHidden = savedState === 'true';
        } else if (isMobile()) {
            // On mobile, hide by default
            isHidden = true;
        }

        // Apply initial state
        this.updateLeftPanelState(container, isHidden, isMobile());
        
        const togglePanel = () => {
            isHidden = !isHidden;
            this.updateLeftPanelState(container, isHidden, isMobile());
            
            // Save state to localStorage
            localStorage.setItem(storageKey, isHidden.toString());
            
            console.log(`${LOG_PREFIX} Left panel toggled: ${isHidden ? 'hidden' : 'visible'}`);
        };

        const hidePanel = () => {
            if (!isHidden) {
                isHidden = true;
                this.updateLeftPanelState(container, isHidden, isMobile());
                
                // Save state to localStorage
                localStorage.setItem(storageKey, isHidden.toString());
                
                console.log(`${LOG_PREFIX} Left panel hidden`);
            }
        };
        
        toggleButton.addEventListener('click', togglePanel);
        if (closeButton) {
            closeButton.addEventListener('click', hidePanel);
        }

        // Handle window resize
        window.addEventListener('resize', debounce(() => {
            this.updateLeftPanelState(container, isHidden, isMobile());
        }, 250));
    },

    updateLeftPanelState: function(container, isHidden, mobile) {
        const toggleButton = document.getElementById('nemo-world-info-toggle-left-panel');
        
        if (mobile) {
            // On mobile, use mobile-specific classes
            container.classList.toggle('mobile-left-panel-visible', !isHidden);
            container.classList.remove('left-panel-hidden');
        } else {
            // On desktop, use desktop-specific classes
            container.classList.toggle('left-panel-hidden', isHidden);
            container.classList.remove('mobile-left-panel-visible');
        }
        
        // Update button icon and tooltip based on state
        if (toggleButton) {
            if (isHidden) {
                toggleButton.className = 'menu_button menu_button_icon fa-solid fa-bars';
                toggleButton.innerHTML = ''; 
                toggleButton.title = 'Show Left Panel';
                // Force visibility for debugging
                toggleButton.style.cssText = `
                    background: rgba(0, 0, 0, 0.5) !important;
                    border: 1px solid rgba(255, 255, 255, 0.3) !important;
                    color: white !important;
                    position: fixed !important;
                    top: 60px !important;
                    left: 10px !important;
                    z-index: 1001 !important;
                    opacity: 0.9 !important;
                    display: block !important;
                    visibility: visible !important;
                    min-width: 40px !important;
                    min-height: 32px !important;
                    border-radius: 4px !important;
                    transition: all 0.2s ease !important;
                    font-size: 16px !important;
                `;
            } else {
                toggleButton.className = 'menu_button menu_button_icon fa-solid fa-times';
                toggleButton.innerHTML = '';
                toggleButton.title = 'Hide Left Panel';
                // Reset to CSS-controlled styling when visible
                toggleButton.style.cssText = '';
            }
        }
    },

    loadFolderState: function() {
        try {
            const state = localStorage.getItem(this.storageKey);
            this.folderState = state ? JSON.parse(state) : {};
        } catch (e) {
            console.error(`${LOG_PREFIX} Error loading folder state:`, e);
            this.folderState = {};
        }
    },

    saveFolderState: function() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.folderState));
        } catch (e) {
            console.error(`${LOG_PREFIX} Error saving folder state:`, e);
        }
    },

    initManagementButtons: function() {
        $(document).on('click', '#nemo-world-info-new-button', async () => {
            const tempName = getFreeWorldName();
            const finalName = await Popup.show.input('Create a new World Info', 'Enter a name for the new file:', tempName);

            if (finalName) {
                await createNewWorldInfo(finalName, { interactive: true });
            }
        });

        $(document).on('click', '#nemo-world-info-import-button', () => {
            $('#world_import_file').trigger('click');
        });

        $(document).on('click', '#nemo-world-info-new-folder-button', () => this.createNewFolder());
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
            Popup.show.alert("A folder with that name already exists.");
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
        this.populateLorebooksFromSelect(worldInfoSelect);
        this.initSearch();
        this.initTabs();
        this.initLeftPanelToggle();
        this.moveSettingsPanel();
        this.initManagementButtons();
        this.initPresetManagement();
        this.initMacroPicker();
        this.initOrderHelper();
        this.initLoreSimulator();

        const moveToggle = /** @type {HTMLInputElement} */ (document.getElementById('nemo-world-info-move-toggle'));
        const lorebookList = document.getElementById('nemo-world-info-list');

        moveToggle.addEventListener('change', () => {
            if (moveToggle.checked) {
                lorebookList.classList.add('nemo-move-mode');
                this.initSortable();
            } else {
                lorebookList.classList.remove('nemo-move-mode');
                this.destroySortable();
            }
        });

        this.initEntryManagement();

        const worldInfoSelectObserver = new MutationObserver(() => {
            this.populateLorebooksFromSelect(worldInfoSelect);
            this.updateActiveLorebooksList();
        });
        worldInfoSelectObserver.observe(worldInfoSelect, { attributes: true, childList: true, subtree: true });

        // The new UI has its own drawers, so these are handled locally.
        // The original buttons are preserved and hidden, and the new UI buttons trigger clicks on them.
        // These handlers are for the original (now hidden) buttons.
        const openAll = document.getElementById('OpenAllWIEntries');
        if (openAll) {
            openAll.addEventListener('click', () => {
                document.querySelectorAll('.inline-drawer-toggle:not(.open)').forEach(el => (/** @type {HTMLElement} */ (el)).click());
            });
        }

        const closeAll = document.getElementById('CloseAllWIEntries');
        if (closeAll) {
            closeAll.addEventListener('click', () => {
                document.querySelectorAll('.inline-drawer-toggle.open').forEach(el => (/** @type {HTMLElement} */ (el)).click());
            });
        }
    },

    initialize: function() {
        console.log(`${LOG_PREFIX} Initializing World Info UI Redesign...`);
        this.loadFolderState();
        this.loadPresets();
        const self = this;

        if (window.getWorldEntry && window.displayWorldEntries && $.fn.pagination) {
            const originalGetWorldEntry = window.getWorldEntry;
            window.getWorldEntry = async function(...args) {
                const entryEl = await originalGetWorldEntry.apply(this, args);
                return entryEl;
            };

            const originalDisplay = window.displayWorldEntries;
            window.displayWorldEntries = async function(name, data, ...args) {
                self._currentWorld.name = name;
                self._currentWorld.data = data;

                // Call the original display function and let it handle the rendering
                const result = await originalDisplay.apply(this, [name, data, ...args]);

                // The original function now handles populating the list,
                // so we just need to add our custom event listeners to the entries.
                const entriesList = document.getElementById('world_popup_entries_list');
                entriesList.querySelectorAll('.world_entry').forEach(entryEl => {
                    // Prevent re-adding listeners if they already exist
                    if (entryEl.dataset.nemoListenersAdded) return;
                    entryEl.dataset.nemoListenersAdded = 'true';

                    entryEl.setAttribute('draggable', 'true');
                    entryEl.addEventListener('dragstart', /** @param {DragEvent} event */(event) => {
                        if (self._selectedEntries.size > 0) {
                            event.dataTransfer.setData('text/plain', JSON.stringify([...self._selectedEntries]));
                        }
                    });
                    entryEl.addEventListener('click', /** @param {MouseEvent} event */(event) => {
                        const uid = entryEl.getAttribute('uid');
                        if (!uid) return;

                        if (self._selectionBook && self._selectionBook !== name) {
                            self._selectedEntries.clear();
                            document.querySelectorAll('.world_entry.nemo-entry-selected').forEach(el => el.classList.remove('nemo-entry-selected'));
                        }
                        self._selectionBook = name;

                        if (event.shiftKey && self._lastSelectedEntry) {
                            const allEntries = Array.from(entriesList.querySelectorAll('.world_entry'));
                            const start = allEntries.findIndex(el => el.getAttribute('uid') === self._lastSelectedEntry);
                            const end = allEntries.findIndex(el => el.getAttribute('uid') === uid);
                            const range = allEntries.slice(Math.min(start, end), Math.max(start, end) + 1);
                            range.forEach(el => {
                                self._selectedEntries.add(el.getAttribute('uid'));
                                el.classList.add('nemo-entry-selected');
                            });
                        } else if (event.ctrlKey) {
                            if (self._selectedEntries.has(uid)) {
                                self._selectedEntries.delete(uid);
                                entryEl.classList.remove('nemo-entry-selected');
                            } else {
                                self._selectedEntries.add(uid);
                                entryEl.classList.add('nemo-entry-selected');
                            }
                        } else {
                            document.querySelectorAll('.world_entry.nemo-entry-selected').forEach(el => el.classList.remove('nemo-entry-selected'));
                            self._selectedEntries.clear();
                            self._selectedEntries.add(uid);
                            entryEl.classList.add('nemo-entry-selected');
                        }
                        self._lastSelectedEntry = uid;
                    });
                });

                return result;
            };
        }

        eventSource.on(event_types.WORLD_INFO_ACTIVATED, (entryList) => {
            self._activeEntries = entryList;
            const panel = document.getElementById('nemo-world-info-active-entries-panel');
            if (panel && panel.classList.contains('active')) {
                self.updateActiveEntriesPanel();
            }
        });

        const observer = new MutationObserver(async (mutations, obs) => {
            const worldInfoSelect = /** @type {HTMLSelectElement} */ (document.getElementById('world_info'));
            const settingsPanel = document.getElementById('wiActivationSettings');

            if (worldInfoSelect && settingsPanel && !this._uiInjected) {
                this._uiInjected = true; // Prevent re-injection
                obs.disconnect();
                await this.injectUI();
                this.initUI(worldInfoSelect);
            }
        });

        observer.observe(document.getElementById('WorldInfo'), {
            childList: true,
            subtree: true
        });
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

        this.saveFolderState();
        this.refreshLorebookUI();
        this._selectedItems.clear(); // Deselect after move
    },

    showContextMenu: function(x, y) {
        // Remove existing context menu
        const existingMenu = document.getElementById('nemo-wi-context-menu');
        if (existingMenu) existingMenu.remove();

        if (this._selectedItems.size === 0) return;

        const menu = document.createElement('div');
        menu.id = 'nemo-wi-context-menu';
        menu.style.top = `${y}px`;
        menu.style.left = `${x}px`;

        const copyItem = document.createElement('div');
        copyItem.className = 'nemo-context-menu-item';
        copyItem.textContent = 'Copy';
        copyItem.addEventListener('click', () => {
            this._clipboard.items = new Set(this._selectedItems);
            this._clipboard.cut = false;
            menu.remove();
        });
        menu.appendChild(copyItem);

        const cutItem = document.createElement('div');
        cutItem.className = 'nemo-context-menu-item';
        cutItem.textContent = 'Cut';
        cutItem.addEventListener('click', () => {
            this._clipboard.items = new Set(this._selectedItems);
            this._clipboard.cut = true;
            menu.remove();
        });
        menu.appendChild(cutItem);

        const duplicateItem = document.createElement('div');
        duplicateItem.className = 'nemo-context-menu-item';
        duplicateItem.textContent = 'Duplicate';
        duplicateItem.addEventListener('click', async () => {
            for (const itemName of this._selectedItems) {
                const fromBook = await loadWorldInfo(itemName);
                if (!fromBook) continue;

                let i = 1;
                let newName = `Copy of ${itemName}`;
                if (world_names.includes(newName)) {
                    newName = `${newName} (${i})`;
                    while (world_names.includes(newName)) {
                        i++;
                        newName = `${newName} (${i})`;
                    }
                }

                await saveWorldInfo(newName, fromBook, true);
            }
            this.refreshLorebookUI();
            menu.remove();
        });
        menu.appendChild(duplicateItem);

        const moveToFolderItem = document.createElement('div');
        moveToFolderItem.className = 'nemo-context-menu-item';
        moveToFolderItem.textContent = 'Move to folder';

        const subMenu = document.createElement('div');
        subMenu.className = 'nemo-context-submenu';

        const folderNames = Object.keys(this.folderState);
        if (folderNames.length > 0) {
            folderNames.forEach(folderName => {
                const folderItem = document.createElement('div');
                folderItem.className = 'nemo-context-submenu-item';
                folderItem.textContent = folderName;
                folderItem.addEventListener('click', () => {
                    this.moveSelectedToFolder(folderName);
                    menu.remove();
                });
                subMenu.appendChild(folderItem);
            });
        } else {
            const noFoldersItem = document.createElement('div');
            noFoldersItem.className = 'nemo-context-submenu-item disabled';
            noFoldersItem.textContent = 'No folders available';
            subMenu.appendChild(noFoldersItem);
        }

        moveToFolderItem.appendChild(subMenu);
        menu.appendChild(moveToFolderItem);
        document.body.appendChild(menu);

        const clickOutsideHandler = (event) => {
            if (!menu.contains(event.target)) {
                menu.remove();
                document.removeEventListener('click', clickOutsideHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', clickOutsideHandler), 0);
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
        const presetSelect = /** @type {HTMLSelectElement} */(document.getElementById('nemo-world-info-preset-select'));
        presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';
        for (const presetName in this._presets) {
            const option = document.createElement('option');
            option.value = presetName;
            option.textContent = presetName;
            presetSelect.appendChild(option);
        }
        presetSelect.value = this._currentPreset;
    },

    activatePreset: function() {
        const presetSelect = /** @type {HTMLSelectElement} */(document.getElementById('nemo-world-info-preset-select'));
        const presetName = presetSelect.value;
        this._currentPreset = presetName;

        if (presetName && this._presets[presetName]) {
            const worldInfoSelect = /** @type {HTMLSelectElement} */(document.getElementById('world_info'));
            Array.from(worldInfoSelect.options).forEach(opt => {
                opt.selected = this._presets[presetName].includes(opt.text);
            });
            $(worldInfoSelect).trigger('change');
            this.refreshLorebookUI();
        }
    },

    createNewPreset: async function() {
        const presetName = await Popup.show.input('Create New Preset', 'Enter a name for the new preset:');
        if (presetName && !this._presets[presetName]) {
            const worldInfoSelect = /** @type {HTMLSelectElement} */(document.getElementById('world_info'));
            const activeLorebooks = Array.from(worldInfoSelect.selectedOptions).map(opt => opt.text);
            this._presets[presetName] = activeLorebooks;
            this._currentPreset = presetName;
            this.savePresets();
            this.populatePresetSelect();
        } else if (presetName) {
            Popup.show.alert('A preset with that name already exists.');
        }
    },

    updatePreset: async function() {
        if (this._currentPreset && this._presets[this._currentPreset]) {
            const worldInfoSelect = /** @type {HTMLSelectElement} */(document.getElementById('world_info'));
            this._presets[this._currentPreset] = Array.from(worldInfoSelect.selectedOptions).map(opt => opt.text);
            this.savePresets();
            Popup.show.alert(`Preset "${this._currentPreset}" updated.`);
        } else {
            Popup.show.alert('No preset selected to update.');
        }
    },

    renamePreset: async function() {
        if (this._currentPreset) {
            const newName = await Popup.show.input('Rename Preset', 'Enter the new name for the preset:', this._currentPreset);
            if (newName && newName !== this._currentPreset && !this._presets[newName]) {
                this._presets[newName] = this._presets[this._currentPreset];
                delete this._presets[this._currentPreset];
                this._currentPreset = newName;
                this.savePresets();
                this.populatePresetSelect();
            } else if (newName) {
                Popup.show.alert('A preset with that name already exists.');
            }
        } else {
            Popup.show.alert('No preset selected to rename.');
        }
    },

    deletePreset: async function() {
        if (this._currentPreset) {
            const confirmation = await Popup.show.confirm('Delete Preset', `Are you sure you want to delete the preset "${this._currentPreset}"?`);
            if (confirmation) {
                delete this._presets[this._currentPreset];
                this._currentPreset = '';
                this.savePresets();
                this.populatePresetSelect();
            }
        } else {
            Popup.show.alert('No preset selected to delete.');
        }
    },

    importPreset: function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', async (event) => {
            const file = /** @type {HTMLInputElement} */(event.target).files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const importedPresets = JSON.parse(text);
                    for (const presetName in importedPresets) {
                        if (this._presets[presetName]) {
                            const overwrite = await Popup.show.confirm('Preset Exists', `A preset named "${presetName}" already exists. Overwrite it?`);
                            if (!overwrite) continue;
                        }
                        this._presets[presetName] = importedPresets[presetName];
                    }
                    this.savePresets();
                    this.populatePresetSelect();
                    Popup.show.alert('Presets imported successfully.');
                } catch (e) {
                    console.error(`${LOG_PREFIX} Error importing presets:`, e);
                    Popup.show.alert('Failed to import presets. Check the file format and console for errors.');
                }
            }
        });
        input.click();
    },

    exportPreset: function() {
        if (!this._currentPreset) {
            Popup.show.alert('No preset selected to export.');
            return;
        }

        const presetData = { [this._currentPreset]: this._presets[this._currentPreset] };
        const blob = new Blob([JSON.stringify(presetData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this._currentPreset}.preset.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
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
            }
        } finally {
            this._isRefreshingUI = false;
        }
    },

    loadPresets: function() {
        try {
            const state = localStorage.getItem(this.presetStorageKey);
            this._presets = state ? JSON.parse(state) : {};
        } catch (e) {
            console.error(`${LOG_PREFIX} Error loading presets:`, e);
            this._presets = {};
        }
    },

    savePresets: function() {
        try {
            localStorage.setItem(this.presetStorageKey, JSON.stringify(this._presets));
        } catch (e) {
            console.error(`${LOG_PREFIX} Error saving presets:`, e);
        }
    },

    updateActiveEntriesPanel: async function() {
        const listElement = document.getElementById('nemo-world-info-active-entries-list');
        const groupByBook = /** @type {HTMLInputElement} */(document.getElementById('nemo-active-entries-group-by-book')).checked;
        const showInOrder = /** @type {HTMLInputElement} */(document.getElementById('nemo-active-entries-show-in-order')).checked;

        listElement.innerHTML = '';

        let activeEntries = [...this._activeEntries];

        if (showInOrder) {
            activeEntries.sort((a, b) => {
                if ((a.depth ?? Number.MAX_SAFE_INTEGER) < (b.depth ?? Number.MAX_SAFE_INTEGER)) return 1;
                if ((a.depth ?? Number.MAX_SAFE_INTEGER) > (b.depth ?? Number.MAX_SAFE_INTEGER)) return -1;
                if ((a.order ?? Number.MAX_SAFE_INTEGER) > (b.order ?? Number.MAX_SAFE_INTEGER)) return 1;
                if ((a.order ?? Number.MAX_SAFE_INTEGER) < (b.order ?? Number.MAX_SAFE_INTEGER)) return -1;
                return (a.comment ?? a.key.join(', ')).toLowerCase().localeCompare((b.comment ?? b.key.join(', ')).toLowerCase());
            });
        } else {
            activeEntries.sort((a, b) => (a.comment ?? a.key.join(', ')).localeCompare(b.comment ?? b.key.join(', ')));
        }

        if (groupByBook) {
            const grouped = activeEntries.reduce((acc, entry) => {
                const bookName = entry.world;
                if (!acc[bookName]) {
                    acc[bookName] = [];
                }
                acc[bookName].push(entry);
                return acc;
            }, {});

            for (const bookName in grouped) {
                const group = document.createElement('div');
                group.className = 'nemo-active-entry-group';
                group.innerHTML = `<div class="nemo-active-entry-group-header">${bookName}</div>`;
                grouped[bookName].forEach(entry => {
                    const item = document.createElement('div');
                    item.className = 'nemo-active-entry-item';
                    item.textContent = entry.comment ?? entry.key.join(', ');
                    group.appendChild(item);
                });
                listElement.appendChild(group);
            }
        } else {
            activeEntries.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'nemo-active-entry-item';
                item.textContent = `${entry.world}: ${entry.comment ?? entry.key.join(', ')}`;
                listElement.appendChild(item);
            });
        }
    },

    initMacroPicker: function() {
        const btn = document.getElementById('nemo-world-info-entry-macro-picker');
        btn.addEventListener('click', async () => {
            const modal = document.getElementById('nemo-macro-picker-modal');
            const content = modal.querySelector('#nemo-macro-picker-list');
            // This is a temporary fix, as the Popup constructor seems to have changed.
            // I'll skip the popup creation for now to avoid breaking the code.
            // TODO: Investigate the correct way to create a popup with content.
            console.log('Macro Picker popup temporarily disabled.');
        });
    },

    populateMacroPicker: async function() {
        const listElement = document.getElementById('nemo-macro-picker-list');
        listElement.innerHTML = 'Loading...';

        const allBooks = {};
        for (const name of world_names) {
            const world = await loadWorldInfo(name);
            allBooks[name] = Object.values(world.entries);
        }

        listElement.innerHTML = '';
        for (const bookName in allBooks) {
            const group = document.createElement('div');
            group.className = 'nemo-macro-picker-group';
            group.innerHTML = `<div class="nemo-macro-picker-group-header">${bookName}</div>`;
            allBooks[bookName].forEach(entry => {
                const item = document.createElement('div');
                item.className = 'nemo-macro-picker-item';
                item.textContent = entry.comment ?? entry.key.join(', ');
                item.addEventListener('click', () => {
                    const macro = `{{wi::${bookName}::${entry.comment ?? entry.key.join(', ')}}}`;
                    const editor = /** @type {HTMLTextAreaElement} */(document.querySelector('#nemo-world-info-entries-panel .inline-drawer-content.open textarea[name="content"]'));
                    if (editor) {
                        const start = editor.selectionStart;
                        const end = editor.selectionEnd;
                        editor.value = editor.value.substring(0, start) + macro + editor.value.substring(end);
                        editor.selectionStart = editor.selectionEnd = start + macro.length;
                        editor.focus();
                    }
                    document.getElementById('nemo-macro-picker-modal').style.display = 'none';
                });
                group.appendChild(item);
            });
            listElement.appendChild(group);
        }
    },

    initOrderHelper: function() {
        document.getElementById('nemo-order-helper-apply').addEventListener('click', () => this.applyOrderHelper());
        
    },

    populateOrderHelper: async function() {
        const listElement = document.getElementById('nemo-world-info-order-helper-list');
        listElement.innerHTML = 'Loading...';

        const activeEntries = this._activeEntries;

        listElement.innerHTML = '';
        activeEntries.forEach(entry => {
            const item = document.createElement('div');
            item.className = 'nemo-order-helper-item';
            item.textContent = `${entry.world}: ${entry.comment ?? entry.key.join(', ')}`;
            item.dataset.book = entry.world;
            item.dataset.uid = entry.uid;
            listElement.appendChild(item);
        });

        if (typeof Sortable !== 'undefined') {
            if (/** @type {any} */(listElement).sortable) /** @type {any} */(listElement).sortable.destroy();
            /** @type {any} */(listElement).sortable = new Sortable(listElement, { animation: 150 });
        }
    },

    applyOrderHelper: async function() {
        const start = parseInt(/** @type {HTMLInputElement} */(document.getElementById('nemo-order-helper-start')).value);
        const step = parseInt(/** @type {HTMLInputElement} */(document.getElementById('nemo-order-helper-step')).value);
        const descending = /** @type {HTMLInputElement} */(document.getElementById('nemo-order-helper-descending')).checked;
        const listElement = document.getElementById('nemo-world-info-order-helper-list');
        const items = Array.from(listElement.children);

        let currentOrder = start;
        if (descending) {
            items.reverse();
        }

        const booksToSave = {};

        for (const item of items) {
            const bookName = /** @type {HTMLElement} */(item).dataset.book;
            const uid = /** @type {HTMLElement} */(item).dataset.uid;

            if (!booksToSave[bookName]) {
                booksToSave[bookName] = await loadWorldInfo(bookName);
            }

            if (booksToSave[bookName].entries[uid]) {
                booksToSave[bookName].entries[uid].order = currentOrder;
                currentOrder += step;
            }
        }

        for (const bookName in booksToSave) {
            await saveWorldInfo(bookName, booksToSave[bookName]);
        }

        Popup.show.alert('Order updated successfully.');
    },
initLoreSimulator: function() {
    const input = document.getElementById('nemo-lore-simulator-input');
    (/** @type {HTMLTextAreaElement} */ (input)).addEventListener('input', /** @type {any} */ (debounce(() => this.runLoreSimulator(), 300)));
},

runLoreSimulator: async function() {
    const inputElement = /** @type {HTMLTextAreaElement} */ (document.getElementById('nemo-lore-simulator-input'));
    const resultsElement = document.getElementById('nemo-lore-simulator-results');
    const worldInfoSelect = /** @type {HTMLSelectElement} */ (document.getElementById('world_info'));
    const text = inputElement.value;

    resultsElement.innerHTML = '';
    if (!text.trim()) {
        return;
    }

    const activeLorebooks = Array.from(worldInfoSelect.selectedOptions).map(opt => opt.text);
    const triggeredEntries = new Set();

    for (const bookName of activeLorebooks) {
        const world = await loadWorldInfo(bookName);
        for (const entry of Object.values(world.entries)) {
            if (entry.disable) continue;

            const keywords = entry.key;
            for (const keyword of keywords) {
                if (!keyword) continue;

                let regex;
                try {
                    // Check if the keyword is a regex literal (e.g., /pattern/i)
                    if (keyword.startsWith('/') && keyword.lastIndexOf('/') > 0) {
                        const lastSlash = keyword.lastIndexOf('/');
                        const pattern = keyword.substring(1, lastSlash);
                        const flags = keyword.substring(lastSlash + 1);
                        regex = new RegExp(pattern, flags);
                    } else {
                        // It's a plain keyword, escape it and match whole word
                        const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
                    }

                    if (regex.test(text)) {
                        triggeredEntries.add(`${bookName}: ${entry.comment ?? entry.key.join(', ')}`);
                        break;
                    }
                } catch (e) {
                    console.warn(`${LOG_PREFIX} Invalid regex in keyword, skipping: "${keyword}" in book "${bookName}"`, e);
                }
            }
        }
    }

    if (triggeredEntries.size > 0) {
        const sortedEntries = Array.from(triggeredEntries).sort();
        for (const entryText of sortedEntries) {
            const item = document.createElement('div');
            item.className = 'list-group-item';
            item.textContent = entryText;
            resultsElement.appendChild(item);
        }
    } else {
        resultsElement.innerHTML = '<div class="list-group-item">No entries activated.</div>';
    }
},



    initEntryManagement: function() {
        // Re-route clicks to original hidden buttons
        document.getElementById('nemo-world-info-entry-new').addEventListener('click', () => document.getElementById('world_popup_new').click());
        document.getElementById('nemo-world-info-entry-rename').addEventListener('click', () => document.getElementById('world_popup_name_button').click());
        document.getElementById('nemo-world-info-entry-duplicate').addEventListener('click', () => document.getElementById('world_duplicate').click());
        document.getElementById('nemo-world-info-entry-export').addEventListener('click', () => document.getElementById('world_popup_export').click());
        document.getElementById('nemo-world-info-entry-delete').addEventListener('click', () => document.getElementById('world_popup_delete').click());
        document.getElementById('nemo-world-info-entry-open-all').addEventListener('click', () => document.getElementById('OpenAllWIEntries').click());
        document.getElementById('nemo-world-info-entry-close-all').addEventListener('click', () => document.getElementById('CloseAllWIEntries').click());
        document.getElementById('nemo-world-info-entry-fill-memos').addEventListener('click', () => document.getElementById('world_backfill_memos').click());
        document.getElementById('nemo-world-info-entry-apply-sort').addEventListener('click', () => document.getElementById('world_apply_current_sorting').click());
        document.getElementById('nemo-world-info-entry-refresh').addEventListener('click', () => document.getElementById('world_refresh').click());

        // Sync search and sort
        const nemoSearch = /** @type {HTMLInputElement} */ (document.getElementById('nemo-world-info-entry-search'));
        const originalSearch = /** @type {HTMLInputElement} */ (document.getElementById('world_info_search'));
        const lorebookSearch = /** @type {HTMLInputElement} */ (document.getElementById('nemo-world-info-search'));

        nemoSearch.addEventListener('input', () => {
            originalSearch.value = nemoSearch.value;
            originalSearch.dispatchEvent(new Event('input'));
            lorebookSearch.value = nemoSearch.value;
            lorebookSearch.dispatchEvent(new Event('input'));
        });

        lorebookSearch.addEventListener('input', () => {
            nemoSearch.value = lorebookSearch.value;
            originalSearch.value = lorebookSearch.value;
            originalSearch.dispatchEvent(new Event('input'));
        });

        const nemoSort = /** @type {HTMLSelectElement} */ (document.getElementById('nemo-world-info-entry-sort'));
        const originalSort = /** @type {HTMLSelectElement} */ (document.getElementById('world_info_sort_order'));
        
        // Clone sort options
        Array.from(originalSort.options).forEach(opt => nemoSort.add(/** @type {HTMLOptionElement} */ (opt.cloneNode(true))));
        nemoSort.value = originalSort.value;

        nemoSort.addEventListener('change', () => {
            originalSort.value = nemoSort.value;
            originalSort.dispatchEvent(new Event('change'));

            if (nemoSort.options[nemoSort.selectedIndex].text === 'Custom') {
                this.initEntriesSortable();
            } else {
                if (this.virtualScroller.itemsContainer && /** @type {any} */(this.virtualScroller.itemsContainer)._sortable) {
                    /** @type {any} */(this.virtualScroller.itemsContainer)._sortable.destroy();
                }
            }
        });
    }
};