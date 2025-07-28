import { LOG_PREFIX } from './utils.js';
import { debounce } from '../../../../scripts/utils.js';
import { Popup } from '../../../../scripts/popup.js';
import { getFreeWorldName, createNewWorldInfo } from '../../../../scripts/world-info.js';

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
    folderState: {},
    storageKey: 'nemo-wi-folder-state',

    virtualScroller: {
        allEntries: [],
        container: null,
        scrollContainer: null,
        itemsContainer: null,
        spacer: null,
        entryHeight: 45, // A reasonable default estimate
        buffer: 30,
        lastRenderedRange: { start: -1, end: -1 },
        onScroll: null,

        init(name, data, allEntries) {
            this.destroy(); // Clean up previous state
            console.log(`${LOG_PREFIX} Virtual scroller init with ${allEntries.length} entries.`);

            const bufferSize = Number(localStorage.getItem('nemo-wi-buffer-size')) || 60;
            this.buffer = bufferSize / 2;

            this.worldName = name;
            this.worldData = data;
            this.allEntries = allEntries;
            this.container = document.getElementById('world_popup_entries_list');
            this.scrollContainer = document.getElementById('nemo-world-info-entries-panel');

            if (!this.container || !this.scrollContainer) return;

            this.container.innerHTML = ''; // Clear list
            this.spacer = document.createElement('div');
            this.spacer.style.height = `${this.allEntries.length * this.entryHeight}px`;
            this.itemsContainer = document.createElement('div');
            this.itemsContainer.style.position = 'absolute';
            this.itemsContainer.style.width = '100%';
            this.itemsContainer.style.top = '0';


            this.container.appendChild(this.spacer);
            this.container.appendChild(this.itemsContainer);

            this.onScroll = debounce(this.render.bind(this), 50);
            this.scrollContainer.addEventListener('scroll', this.onScroll);

            this.render(); // Initial render
        },

        async render() {
            const scrollTop = this.scrollContainer.scrollTop;
            const containerHeight = this.scrollContainer.clientHeight;

            const startIndex = Math.max(0, Math.floor(scrollTop / this.entryHeight) - this.buffer);
            const endIndex = Math.min(this.allEntries.length, Math.ceil((scrollTop + containerHeight) / this.entryHeight) + this.buffer);

            if (startIndex === this.lastRenderedRange.start && endIndex === this.lastRenderedRange.end) {
                return; // No change in visible range
            }

            this.lastRenderedRange = { start: startIndex, end: endIndex };

            const fragment = document.createDocumentFragment();
            const promises = [];

            for (let i = startIndex; i < endIndex; i++) {
                const entry = this.allEntries[i];
                if (entry) {
                    promises.push(window.getWorldEntry(this.worldName, this.worldData, entry));
                }
            }

            const elements = await Promise.all(promises);
            elements.forEach((el) => {
                if (el) {
                    fragment.appendChild(el[0]);
                }
            });

            this.itemsContainer.innerHTML = '';
            this.itemsContainer.appendChild(fragment);
            this.itemsContainer.style.transform = `translateY(${startIndex * this.entryHeight}px)`;
        },

        destroy() {
            if (this.scrollContainer && this.onScroll) {
                this.scrollContainer.removeEventListener('scroll', this.onScroll);
            }
            this.allEntries = [];
            if (this.container) this.container.innerHTML = '';
            this.lastRenderedRange = { start: -1, end: -1 };
            this.onScroll = null;
        }
    },

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
                console.log(`${LOG_PREFIX} Injected new World Info UI into existing panel.`);
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
                $(worldInfoSelect).trigger('change');
                this.updateActiveLorebooksList();
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
                this.updateActiveLorebooksList();
            }
        });

        lorebookItem.appendChild(addButton);
        return lorebookItem;
    },

    createFolderElement: function(folderName) {
        const folderElement = document.createElement('div');
        folderElement.className = 'nemo-folder';
        folderElement.dataset.folderName = folderName;

        const header = document.createElement('div');
        header.className = 'nemo-folder-header';
        header.innerHTML = `<span class="nemo-folder-toggle">▶</span> ${folderName}`;
        header.addEventListener('click', () => {
            folderElement.classList.toggle('open');
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
                animation: 0,
                handle: '.nemo-drag-handle',
                filter: '.nemo-folder.open', // Prevent open folders from being dragged
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
            searchInput.addEventListener('input', (event) => {
                const searchTerm = (/** @type {HTMLInputElement} */ (event.target)).value.toLowerCase();
                const lorebookItems = lorebookList.getElementsByClassName('nemo-lorebook-item');

                for (const item of Array.from(lorebookItems)) {
                    const itemName = item.textContent.toLowerCase();
                    if (itemName.includes(searchTerm)) {
                        (/** @type {HTMLElement} */ (item)).style.display = '';
                    } else {
                        (/** @type {HTMLElement} */ (item)).style.display = 'none';
                    }
                }
            });
        }
    },

    moveSettingsPanel: function() {
        const settingsPanel = document.getElementById('wiActivationSettings');
        const newSettingsContainer = document.getElementById('nemo-world-info-settings-panel');

        if (settingsPanel && newSettingsContainer) {
            newSettingsContainer.appendChild(settingsPanel);
            settingsPanel.style.display = ''; // Make it visible again
        }
    },

    initTabs: function() {
        const entriesTab = document.getElementById('nemo-world-info-entries-tab');
        const settingsTab = document.getElementById('nemo-world-info-settings-tab');
        const entriesPanel = document.getElementById('nemo-world-info-entries-panel');
        const settingsPanel = document.getElementById('nemo-world-info-settings-panel');

        if (entriesTab && settingsTab && entriesPanel && settingsPanel) {
            entriesTab.addEventListener('click', () => {
                entriesTab.classList.add('active');
                settingsTab.classList.remove('active');
                entriesPanel.classList.add('active');
                settingsPanel.classList.remove('active');
            });

            settingsTab.addEventListener('click', () => {
                settingsTab.classList.add('active');
                entriesTab.classList.remove('active');
                settingsPanel.classList.add('active');
                entriesPanel.classList.remove('active');
            });
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
            this.populateLorebooksFromSelect(/** @type {HTMLSelectElement} */ (document.getElementById('world_info')));
            
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
            this.populateLorebooksFromSelect(/** @type {HTMLSelectElement} */ (document.getElementById('world_info')));
        }
    },

    initUI: function(worldInfoSelect) {
        this.populateLorebooksFromSelect(worldInfoSelect);
        this.initSearch();
        this.initTabs();
        this.moveSettingsPanel();
        this.initManagementButtons();

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
        const self = this;

        if (window.displayWorldEntries && $.fn.pagination) {
            const originalPagination = $.fn.pagination;
            /** @type {any} */
            ($.fn.pagination) = function(options) {
                if (this.attr('id') === 'world_info_pagination') {
                    console.log(`${LOG_PREFIX} Intercepted pagination. Initializing virtual scroller.`);
                    try {
                        const allEntries = options.dataSource();
                        self.virtualScroller.init(self._currentWorld.name, self._currentWorld.data, allEntries);
                    } catch (err) {
                        console.error(`${LOG_PREFIX} Error initializing virtual scroller:`, err);
                    }
                    return this;
                }
                return originalPagination.apply(this, /** @type {any} */ (arguments));
            };

            const originalDisplay = window.displayWorldEntries;
            window.displayWorldEntries = async function(name, data, ...args) {
                self._currentWorld.name = name;
                self._currentWorld.data = data;
                document.getElementById('world_info_pagination').style.display = 'none';
                return originalDisplay.apply(this, [name, data, ...args]);
            };
            console.log(`${LOG_PREFIX} Patched displayWorldEntries and pagination.`);
        }

        const observer = new MutationObserver(async (mutations, obs) => {
            const worldInfoSelect = /** @type {HTMLSelectElement} */ (document.getElementById('world_info'));
            const originalPanel = document.getElementById('WorldInfo');

            if (worldInfoSelect && originalPanel) {
                obs.disconnect();
                await this.injectUI();
                this.initUI(worldInfoSelect);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    moveSelectedToFolder: function(targetFolderName) {
        this._selectedItems.forEach(lorebookName => {
            // Remove from any existing folder
            for (const folderName in this.folderState) {
                const index = this.folderState[folderName].indexOf(lorebookName);
                if (index > -1) {
                    this.folderState[folderName].splice(index, 1);
                }
            }
            // Add to new folder
            if (this.folderState[targetFolderName]) {
                this.folderState[targetFolderName].push(lorebookName);
            }
        });

        this.saveFolderState();
        this.populateLorebooksFromSelect(/** @type {HTMLSelectElement} */ (document.getElementById('world_info')));
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
        nemoSearch.addEventListener('input', () => {
            originalSearch.value = nemoSearch.value;
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
        });
    }
};