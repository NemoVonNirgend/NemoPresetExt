// user-settings-tabs.js
// Overhauls the User Settings tab to use a tabbed interface

import { LOG_PREFIX, NEMO_EXTENSION_NAME } from '../core/utils.js';

export const UserSettingsTabs = {
    initialized: false,
    activeTab: 'ui-theme',

    initialize: function() {
        if (this.initialized) return;
        
        // Cleanup any existing tab interface first
        this.cleanup();

        // Wait for the user settings block to be available
        const pollForUserSettings = setInterval(() => {
            const userSettingsBlock = document.getElementById('user-settings-block');
            const userSettingsContent = document.getElementById('user-settings-block-content');
            
            if (userSettingsBlock && userSettingsContent && 
                !userSettingsBlock.querySelector('.nemo-user-settings-tabs') &&
                userSettingsContent.children.length > 0) {
                clearInterval(pollForUserSettings);
                
                // Small delay to ensure all content is loaded
                setTimeout(() => {
                    this.createTabbedInterface();
                    this.initialized = true;
                    console.log(`${LOG_PREFIX} User Settings Tabs initialized`);
                }, 100);
            }
        }, 500);
    },

    createTabbedInterface: function() {
        try {
            const userSettingsContent = document.getElementById('user-settings-block-content');
            if (!userSettingsContent) {
                console.error(`${LOG_PREFIX} Could not find user-settings-block-content`);
                return;
            }

            // Create tab navigation
            const tabNavigation = document.createElement('div');
            tabNavigation.className = 'nemo-user-settings-tabs';
            tabNavigation.innerHTML = `
                <button class="nemo-user-settings-tab active" data-tab="ui-theme">
                    <i class="fa-solid fa-palette"></i> UI Theme
                </button>
                <button class="nemo-user-settings-tab" data-tab="character-handling">
                    <i class="fa-solid fa-users"></i> Character Handling
                </button>
                <button class="nemo-user-settings-tab" data-tab="chat-messages">
                    <i class="fa-solid fa-comments"></i> Chat Messages
                </button>
            `;

            // Insert tab navigation before the content
            userSettingsContent.parentNode.insertBefore(tabNavigation, userSettingsContent);

            // Reorganize content into tabs
            this.reorganizeContent();

            // Add tab click handlers
            this.addTabHandlers();
            
            // Add custom input handlers
            this.addCustomInputHandlers();
            
            // Add search functionality
            this.addSearchHandler();
            
            console.log(`${LOG_PREFIX} Tabbed interface created successfully`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating tabbed interface:`, error);
        }
    },

    reorganizeContent: function() {
        const userSettingsContent = document.getElementById('user-settings-block-content');
        
        // Store original content elements before moving them
        const originalElements = {
            uiThemeBlock: document.querySelector('[name="UserSettingsFirstColumn"]'),
            secondColumn: document.querySelector('[name="UserSettingsSecondColumn"]'),
            thirdColumn: document.querySelector('[name="UserSettingsThirdColumn"]')
        };
        
        // Create tab content containers
        const uiThemeTab = document.createElement('div');
        uiThemeTab.className = 'nemo-user-settings-tab-content active';
        uiThemeTab.id = 'nemo-tab-ui-theme';

        const characterHandlingTab = document.createElement('div');
        characterHandlingTab.className = 'nemo-user-settings-tab-content';
        characterHandlingTab.id = 'nemo-tab-character-handling';

        const chatMessagesTab = document.createElement('div');
        chatMessagesTab.className = 'nemo-user-settings-tab-content';
        chatMessagesTab.id = 'nemo-tab-chat-messages';

        // Move UI Theme content (entire first column)
        if (originalElements.uiThemeBlock) {
            const uiPresetBlock = originalElements.uiThemeBlock.querySelector('#UI-presets-block');
            const themeElements = originalElements.uiThemeBlock.querySelector('[name="themeElements"]');
            
            // Add theme selector first (full width)
            if (uiPresetBlock) {
                uiThemeTab.appendChild(uiPresetBlock);
            }
            
            // Create wrapper for two-column layout
            const mainContentWrapper = document.createElement('div');
            mainContentWrapper.className = 'nemo-ui-theme-main-content';
            
            // Add theme elements to left column
            if (themeElements) {
                mainContentWrapper.appendChild(themeElements);
            }
            
            // Find and move Custom CSS from second column to right column BEFORE appending wrapper
            if (originalElements.secondColumn) {
                const customCSSBlock = originalElements.secondColumn.querySelector('#CustomCSS-block');
                if (customCSSBlock) {
                    // Remove from second column first
                    customCSSBlock.remove();
                    // Add to right column of main wrapper
                    mainContentWrapper.appendChild(customCSSBlock);
                    console.log(`${LOG_PREFIX} Moved Custom CSS to UI Theme tab`);
                }
            }
            
            uiThemeTab.appendChild(mainContentWrapper);
        }

        // Move Character Handling content (second column content, excluding Custom CSS)
        if (originalElements.secondColumn) {
            const characterHandlingToggles = originalElements.secondColumn.querySelector('[name="CharacterHandlingToggles"]');
            const miscellaneousToggles = originalElements.secondColumn.querySelector('[name="MiscellaneousToggles"]');
            
            if (characterHandlingToggles) {
                characterHandlingTab.appendChild(characterHandlingToggles);
            }
            if (miscellaneousToggles) {
                characterHandlingTab.appendChild(miscellaneousToggles);
            }
        }

        // Move Chat Messages content (third column content)
        if (originalElements.thirdColumn) {
            const powerUserOptions = originalElements.thirdColumn.querySelector('#power-user-option-checkboxes');
            if (powerUserOptions) {
                chatMessagesTab.appendChild(powerUserOptions);
            }
        }

        // Clear original content and add new tabs
        userSettingsContent.innerHTML = '';
        userSettingsContent.appendChild(uiThemeTab);
        userSettingsContent.appendChild(characterHandlingTab);
        userSettingsContent.appendChild(chatMessagesTab);
        
        console.log(`${LOG_PREFIX} Content reorganized into tabs`);
    },

    addTabHandlers: function() {
        const tabs = document.querySelectorAll('.nemo-user-settings-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
    },

    switchTab: function(tabName) {
        // Update active tab button
        const tabs = document.querySelectorAll('.nemo-user-settings-tab');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update active tab content
        const tabContents = document.querySelectorAll('.nemo-user-settings-tab-content');
        tabContents.forEach(content => {
            if (content.id === `nemo-tab-${tabName}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        this.activeTab = tabName;
        console.log(`${LOG_PREFIX} Switched to tab: ${tabName}`);
    },

    addCustomInputHandlers: function() {
        // Handle chat truncation input to show "Unlimited" when value is 0
        const chatTruncationCounter = document.getElementById('chat_truncation_counter');
        if (chatTruncationCounter) {
            const updateDisplay = () => {
                if (chatTruncationCounter.value === '0') {
                    chatTruncationCounter.setAttribute('data-original-value', '0');
                    chatTruncationCounter.value = 'Unlimited';
                    chatTruncationCounter.style.color = 'var(--nemo-primary-accent, #4a9eff)';
                } else if (chatTruncationCounter.hasAttribute('data-original-value')) {
                    // Only reset color if we were previously showing "Unlimited"
                    chatTruncationCounter.removeAttribute('data-original-value');
                    chatTruncationCounter.style.color = '';
                }
            };

            const handleFocus = () => {
                if (chatTruncationCounter.value === 'Unlimited') {
                    chatTruncationCounter.value = '0';
                    chatTruncationCounter.style.color = '';
                }
            };

            const handleBlur = () => {
                updateDisplay();
            };

            // Initial display update
            updateDisplay();
            
            // Add event listeners
            chatTruncationCounter.addEventListener('input', updateDisplay);
            chatTruncationCounter.addEventListener('focus', handleFocus);
            chatTruncationCounter.addEventListener('blur', handleBlur);
            
            console.log(`${LOG_PREFIX} Added custom input handlers for chat truncation`);
        }
    },

    addSearchHandler: function() {
        // Define keywords for each tab
        const tabKeywords = {
            'ui-theme': [
                'theme', 'color', 'css', 'custom', 'style', 'appearance', 'visual', 'ui', 'interface',
                'background', 'font', 'blur', 'shadow', 'waifu', 'visual novel', 'expand', 'zen',
                'lab mode', 'reduced motion', 'fast ui', 'palette'
            ],
            'character-handling': [
                'character', 'handling', 'miscellaneous', 'streaming', 'fps', 'smooth', 'message',
                'sound', 'audio', 'api', 'urls', 'lorebook', 'world', 'import', 'dialog',
                'input', 'text', 'markdown', 'hotkeys', 'restore', 'moving', 'ui', 'panels',
                'movingui', 'preset', 'reload', 'debug', 'cleanup', 'truncation', 'load'
            ],
            'chat-messages': [
                'chat', 'messages', 'timer', 'timestamp', 'model', 'icon', 'avatar', 'token',
                'compact', 'swipe', 'hotswap', 'magnification', 'folders', 'tags', 'edit',
                'click', 'power user', 'options'
            ]
        };

        // Listen for search events on the user settings block
        const userSettingsBlock = document.getElementById('user-settings-block');
        if (userSettingsBlock) {
            // Check if there's a search functionality we can hook into
            const searchInput = userSettingsBlock.querySelector('input[type="search"], input[placeholder*="search"], input[placeholder*="Search"]');
            
            if (searchInput) {
                const handleSearch = (searchTerm) => {
                    if (!searchTerm || searchTerm.length < 2) {
                        this.clearSearchFilter();
                        return;
                    }
                    
                    this.applySearchFilter(searchTerm);
                };

                // Add search event listeners
                searchInput.addEventListener('input', (e) => {
                    handleSearch(e.target.value);
                });
                
                searchInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') {
                        handleSearch(e.target.value);
                    }
                });
                
                console.log(`${LOG_PREFIX} Added search handler for user settings tabs`);
            } else {
                // If no search input exists, create one
                this.createSearchInput();
            }
        }
    },

    createSearchInput: function() {
        const userSettingsBlock = document.getElementById('user-settings-block');
        const tabNavigation = document.querySelector('.nemo-user-settings-tabs');
        
        if (userSettingsBlock && tabNavigation) {
            const searchContainer = document.createElement('div');
            searchContainer.className = 'nemo-user-settings-search';
            searchContainer.innerHTML = `
                <div class="flex-container alignItemsCenter" style="margin-bottom: 15px; gap: 10px;">
                    <i class="fa-solid fa-search" style="color: var(--nemo-text-color); opacity: 0.7;"></i>
                    <input type="search" id="nemo-user-settings-search" 
                           placeholder="Search settings..." 
                           style="flex: 1; padding: 8px 12px; border: 1px solid var(--nemo-border-color); 
                                  border-radius: 4px; background: var(--nemo-tertiary-bg); 
                                  color: var(--nemo-text-color); font-size: 14px;">
                </div>
            `;
            
            // Insert search before tab navigation
            userSettingsBlock.insertBefore(searchContainer, tabNavigation);
            
            const searchInput = document.getElementById('nemo-user-settings-search');
            if (searchInput) {
                const handleSearch = (searchTerm) => {
                    if (!searchTerm || searchTerm.length < 2) {
                        this.clearSearchFilter();
                        return;
                    }
                    
                    this.applySearchFilter(searchTerm);
                };

                searchInput.addEventListener('input', (e) => {
                    handleSearch(e.target.value);
                });
                
                searchInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') {
                        handleSearch(e.target.value);
                    }
                });
                
                console.log(`${LOG_PREFIX} Created search input for user settings tabs`);
            }
        }
    },

    applySearchFilter: function(searchTerm) {
        const term = searchTerm.toLowerCase();
        const tabNavigation = document.querySelector('.nemo-user-settings-tabs');
        const userSettingsContent = document.getElementById('user-settings-block-content');
        
        if (!tabNavigation || !userSettingsContent) return;

        // Hide tab navigation during search
        tabNavigation.style.display = 'none';
        
        // Create or show search results container
        let searchResults = document.getElementById('nemo-search-results');
        if (!searchResults) {
            searchResults = document.createElement('div');
            searchResults.id = 'nemo-search-results';
            searchResults.className = 'nemo-search-results-container';
            userSettingsContent.parentNode.insertBefore(searchResults, userSettingsContent);
        }
        
        // Hide original tab content
        userSettingsContent.style.display = 'none';
        searchResults.style.display = 'block';
        
        // Clear previous search results
        searchResults.innerHTML = '';
        
        const matchingElements = [];
        
        // Search through all tab content
        const allTabs = ['nemo-tab-ui-theme', 'nemo-tab-character-handling', 'nemo-tab-chat-messages'];
        
        allTabs.forEach(tabId => {
            const tab = document.getElementById(tabId);
            if (!tab) return;
            
            const tabName = tabId.replace('nemo-tab-', '').replace('-', ' ');
            
            // Search through all elements in the tab
            const elements = tab.querySelectorAll('*');
            elements.forEach(element => {
                const text = element.textContent || '';
                const placeholder = element.getAttribute('placeholder') || '';
                const title = element.getAttribute('title') || '';
                const dataI18n = element.getAttribute('data-i18n') || '';
                
                const searchableText = `${text} ${placeholder} ${title} ${dataI18n}`.toLowerCase();
                
                if (searchableText.includes(term) && this.isRelevantElement(element)) {
                    const parent = this.findRelevantParent(element);
                    if (parent && !matchingElements.some(item => item.element === parent)) {
                        matchingElements.push({
                            element: parent,
                            tabName: tabName,
                            relevance: this.calculateRelevance(searchableText, term)
                        });
                    }
                }
            });
        });
        
        // Sort by relevance
        matchingElements.sort((a, b) => b.relevance - a.relevance);
        
        if (matchingElements.length === 0) {
            searchResults.innerHTML = `
                <div class="nemo-no-results">
                    <i class="fa-solid fa-search"></i>
                    <p>No settings found matching "<strong>${searchTerm}</strong>"</p>
                </div>
            `;
        } else {
            const resultsHeader = document.createElement('div');
            resultsHeader.className = 'nemo-search-results-header';
            resultsHeader.innerHTML = `
                <h4>Search Results for "<strong>${searchTerm}</strong>" (${matchingElements.length} found)</h4>
            `;
            searchResults.appendChild(resultsHeader);
            
            matchingElements.forEach(({ element, tabName, relevance }, index) => {
                const clone = element.cloneNode(true);
                
                // Create result container
                const resultItem = document.createElement('div');
                resultItem.className = 'nemo-search-result-item';
                resultItem.innerHTML = `
                    <div class="nemo-search-result-header">
                        <span class="nemo-search-result-tab">${tabName.toUpperCase()}</span>
                        <span class="nemo-search-result-relevance">${Math.round(relevance)}% match</span>
                    </div>
                `;
                
                resultItem.appendChild(clone);
                searchResults.appendChild(resultItem);
                
                // Make cloned interactive elements work
                this.makeCloneInteractive(clone, element);
            });
        }
        
        console.log(`${LOG_PREFIX} Applied search filter for: "${searchTerm}" (${matchingElements.length} results)`);
    },

    clearSearchFilter: function() {
        const tabNavigation = document.querySelector('.nemo-user-settings-tabs');
        const userSettingsContent = document.getElementById('user-settings-block-content');
        const searchResults = document.getElementById('nemo-search-results');
        
        // Show tab navigation and content
        if (tabNavigation) tabNavigation.style.display = '';
        if (userSettingsContent) userSettingsContent.style.display = '';
        if (searchResults) searchResults.style.display = 'none';
        
        // Ensure the active tab is visible
        const activeTabContent = document.querySelector('.nemo-user-settings-tab-content.active');
        if (activeTabContent) {
            activeTabContent.style.display = 'block';
        }
        
        console.log(`${LOG_PREFIX} Cleared search filter`);
    },

    isRelevantElement: function(element) {
        // Filter out elements that shouldn't be included in search results
        const tagName = element.tagName.toLowerCase();
        const className = element.className || '';
        
        // Include form controls, labels, buttons, and containers with meaningful content
        if (['input', 'select', 'textarea', 'button', 'label'].includes(tagName)) {
            return true;
        }
        
        // Include containers with specific classes that represent settings
        if (className.includes('checkbox_label') || 
            className.includes('flex-container') || 
            className.includes('menu_button') ||
            element.hasAttribute('data-i18n')) {
            return true;
        }
        
        return false;
    },

    findRelevantParent: function(element) {
        // Find the most appropriate parent container for the matching element
        let current = element;
        
        while (current && current.parentNode) {
            // Look for meaningful containers
            if (current.className && (
                current.className.includes('checkbox_label') ||
                current.className.includes('flex-container') ||
                current.className.includes('inline-drawer') ||
                current.tagName.toLowerCase() === 'label'
            )) {
                return current;
            }
            current = current.parentNode;
        }
        
        return element;
    },

    calculateRelevance: function(text, term) {
        const words = text.split(/\s+/);
        let score = 0;
        
        // Exact match gets highest score
        if (text.includes(term)) score += 100;
        
        // Word matches
        words.forEach(word => {
            if (word.includes(term)) score += 50;
            if (term.includes(word) && word.length > 2) score += 25;
        });
        
        return Math.min(score, 100);
    },

    makeCloneInteractive: function(clone, original) {
        // Make sure cloned form elements sync with originals
        const clonedInputs = clone.querySelectorAll('input, select, textarea');
        const originalInputs = original.querySelectorAll('input, select, textarea');
        
        clonedInputs.forEach((clonedInput, index) => {
            const originalInput = originalInputs[index];
            if (originalInput) {
                // Sync initial values
                if (clonedInput.type === 'checkbox' || clonedInput.type === 'radio') {
                    clonedInput.checked = originalInput.checked;
                } else {
                    clonedInput.value = originalInput.value;
                }
                
                // Add event listeners to sync changes
                clonedInput.addEventListener('change', () => {
                    if (originalInput.type === 'checkbox' || originalInput.type === 'radio') {
                        originalInput.checked = clonedInput.checked;
                    } else {
                        originalInput.value = clonedInput.value;
                    }
                    
                    // Trigger multiple events to ensure SillyTavern picks up the changes
                    originalInput.dispatchEvent(new Event('change', { bubbles: true }));
                    originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                });
                
                // Also sync input events for real-time updates
                clonedInput.addEventListener('input', () => {
                    if (originalInput.type !== 'checkbox' && originalInput.type !== 'radio') {
                        originalInput.value = clonedInput.value;
                        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            }
        });
        
        // Handle buttons
        const clonedButtons = clone.querySelectorAll('button, .menu_button');
        const originalButtons = original.querySelectorAll('button, .menu_button');
        
        clonedButtons.forEach((clonedButton, index) => {
            const originalButton = originalButtons[index];
            if (originalButton) {
                clonedButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    originalButton.click();
                });
            }
        });
    },

    // Method to restore original layout if needed
    restoreOriginalLayout: function() {
        const userSettingsContent = document.getElementById('user-settings-block-content');
        const tabNavigation = document.querySelector('.nemo-user-settings-tabs');
        
        if (tabNavigation) {
            tabNavigation.remove();
        }
        
        if (userSettingsContent) {
            // This would need to restore the original three-column layout
            // For now, just remove the tab structure
            const tabContents = userSettingsContent.querySelectorAll('.nemo-user-settings-tab-content');
            tabContents.forEach(tab => {
                // Move content back out of tabs
                while (tab.firstChild) {
                    userSettingsContent.appendChild(tab.firstChild);
                }
                tab.remove();
            });
        }
        
        this.initialized = false;
        console.log(`${LOG_PREFIX} Original layout restored`);
    },

    // Method to cleanup existing tab interface
    cleanup: function() {
        const existingTabs = document.querySelector('.nemo-user-settings-tabs');
        const existingSearch = document.querySelector('.nemo-user-settings-search');
        const existingSearchResults = document.getElementById('nemo-search-results');
        
        if (existingTabs) existingTabs.remove();
        if (existingSearch) existingSearch.remove();
        if (existingSearchResults) existingSearchResults.remove();
        
        // Reset any modified display styles
        const userSettingsContent = document.getElementById('user-settings-block-content');
        if (userSettingsContent) {
            userSettingsContent.style.display = '';
        }
    }
};