import { LOG_PREFIX } from './utils.js';
import { debounce } from '../../../../scripts/utils.js';

export const NemoWorldInfoUI = {
    _currentWorld: { name: null, data: null },

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
            elements.forEach((el, i) => {
                if (el) {
                    // The wrapper div is not needed as getWorldEntry returns a complete element
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

    loadCSS: function() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'scripts/extensions/third-party/NemoPresetExt/world-info-ui.css';
        document.head.appendChild(link);
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

                originalPanel.innerHTML = html;
                console.log(`${LOG_PREFIX} Injected new World Info UI into existing panel.`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error injecting UI:`, error);
        }
    },

    displayLorebookEntries: async function(lorebookName) {
        const worldEditorSelect = document.getElementById('world_editor_select');
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
        const worldInfoSelect = document.getElementById('world_info');
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
        const fragment = document.createDocumentFragment();

        for (const option of selectElement.options) {
            if (option.value) {
                const lorebookItem = document.createElement('div');
                lorebookItem.className = 'nemo-lorebook-item';
                lorebookItem.dataset.name = option.text;

                const textSpan = document.createElement('span');
                textSpan.className = 'nemo-lorebook-item-text';
                textSpan.textContent = option.text;
                lorebookItem.appendChild(textSpan);

                lorebookItem.addEventListener('click', () => {
                    this.displayLorebookEntries(option.text);
                });

                const addButton = document.createElement('div');
                addButton.className = 'nemo-add-lorebook-button';
                addButton.textContent = '✚';
                addButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const worldInfoSelect = document.getElementById('world_info');
                    const correspondingOption = Array.from(worldInfoSelect.options).find(opt => opt.text === option.text);
                    if (correspondingOption) {
                        correspondingOption.selected = true;
                        $(worldInfoSelect).trigger('change');
                        this.updateActiveLorebooksList();
                    }
                });

                lorebookItem.appendChild(addButton);
                fragment.appendChild(lorebookItem);
            }
        }

        lorebookList.appendChild(fragment);
        this.updateActiveLorebooksList();
    },

    initSearch: function() {
        const searchInput = document.getElementById('nemo-world-info-search');
        const lorebookList = document.getElementById('nemo-world-info-list');

        if (searchInput && lorebookList) {
            searchInput.addEventListener('input', (event) => {
                const searchTerm = event.target.value.toLowerCase();
                const lorebookItems = lorebookList.getElementsByClassName('nemo-lorebook-item');

                for (const item of lorebookItems) {
                    const itemName = item.textContent.toLowerCase();
                    if (itemName.includes(searchTerm)) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
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

    initManagementButtons: function() {
        const newButton = document.getElementById('nemo-world-info-new-button');
        const importButton = document.getElementById('nemo-world-info-import-button');
        const originalCreateButton = document.getElementById('world_create_button');
        const originalImportButton = document.getElementById('world_import_button');

        if (newButton && originalCreateButton) {
            newButton.addEventListener('click', () => originalCreateButton.click());
        }
        if (importButton && originalImportButton) {
            importButton.addEventListener('click', () => originalImportButton.click());
        }
    },

    initialize: function() {
        console.log(`${LOG_PREFIX} Initializing World Info UI Redesign...`);
        const self = this;

        // Monkey-patch the global displayWorldEntries function to intercept data for virtual scrolling
        if (window.displayWorldEntries && $.fn.pagination) {
            const originalPagination = $.fn.pagination;
            $.fn.pagination = function(options) {
                if (this.attr('id') === 'world_info_pagination') {
                    console.log(`${LOG_PREFIX} Intercepted pagination. Initializing virtual scroller.`);
                    try {
                        const allEntries = options.dataSource(); // This calls the original getDataArray
                        self.virtualScroller.init(self._currentWorld.name, self._currentWorld.data, allEntries);
                    } catch (err) {
                        console.error(`${LOG_PREFIX} Error initializing virtual scroller:`, err);
                    }
                    return this; // Return jQuery object for chaining
                }
                return originalPagination.apply(this, arguments);
            };

            const originalDisplay = window.displayWorldEntries;
            window.displayWorldEntries = async function(name, data, ...args) {
                self._currentWorld.name = name;
                self._currentWorld.data = data;
                // Hide pagination controls via CSS instead of removing the element
                document.getElementById('world_info_pagination').style.display = 'none';
                return originalDisplay.apply(this, [name, data, ...args]);
            };
            console.log(`${LOG_PREFIX} Patched displayWorldEntries and pagination.`);
        }

        this.loadCSS();

        const observer = new MutationObserver(async (mutations, obs) => {
            const worldInfoSelect = document.getElementById('world_info');
            const originalPanel = document.getElementById('WorldInfo');

            if (worldInfoSelect && originalPanel) {
                obs.disconnect();
                
                await this.injectUI();
                
                setTimeout(() => {
                    this.populateLorebooksFromSelect(worldInfoSelect);
                    this.initSearch();
                    this.initTabs();
                    this.moveSettingsPanel();
                    this.initManagementButtons();

                    const bufferSelect = document.getElementById('nemo-world-info-buffer-size');
                    if (bufferSelect) {
                        bufferSelect.value = localStorage.getItem('nemo-wi-buffer-size') || '60';
                        bufferSelect.addEventListener('change', () => {
                            localStorage.setItem('nemo-wi-buffer-size', bufferSelect.value);
                            // Re-initialize if a world is active
                            if (this.virtualScroller.allEntries.length > 0) {
                                this.virtualScroller.init(this._currentWorld.name, this._currentWorld.data, this.virtualScroller.allEntries);
                            }
                        });
                    }
                    
                    const worldInfoSelectObserver = new MutationObserver(() => {
                        this.updateActiveLorebooksList();
                    });
                    worldInfoSelectObserver.observe(worldInfoSelect, { attributes: true, childList: true, subtree: true });
                }, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
};