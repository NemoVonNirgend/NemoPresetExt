// advanced-formatting-tabs.js
// Overhauls the Advanced Formatting section to use a tabbed interface with search

import { LOG_PREFIX } from './utils.js';

export const AdvancedFormattingTabs = {
    initialized: false,
    activeTab: 'context-template',

    initialize: function() {
        if (this.initialized) return;
        
        // Cleanup any existing tab interface first
        this.cleanup();

        // Wait for the Advanced Formatting drawer to be available
        const pollForAdvancedFormatting = setInterval(() => {
            // Look for the Advanced Formatting drawer with specific ID
            const advancedFormattingDrawer = document.getElementById('AdvancedFormatting');
            
            if (advancedFormattingDrawer && 
                !advancedFormattingDrawer.querySelector('.nemo-advanced-formatting-tabs') &&
                advancedFormattingDrawer.querySelector('.flex-container.spaceEvenly')) {
                clearInterval(pollForAdvancedFormatting);
                
                // Small delay to ensure all content is loaded
                setTimeout(() => {
                    this.createTabbedInterface(advancedFormattingDrawer);
                    this.initialized = true;
                    console.log(`${LOG_PREFIX} Advanced Formatting Tabs initialized`);
                }, 100);
            }
        }, 500);
    },

    createTabbedInterface: function(advancedFormattingDrawer) {
        try {
            const mainContentArea = advancedFormattingDrawer.querySelector('.flex-container.spaceEvenly');
            if (!mainContentArea) {
                console.error(`${LOG_PREFIX} Could not find Advanced Formatting main content area`);
                return;
            }

            // Create search input first
            const searchContainer = document.createElement('div');
            searchContainer.className = 'nemo-advanced-formatting-search';
            searchContainer.innerHTML = `
                <div class="flex-container alignItemsCenter" style="margin-bottom: 15px; gap: 10px;">
                    <i class="fa-solid fa-search" style="color: var(--nemo-text-color); opacity: 0.7;"></i>
                    <input type="search" id="nemo-advanced-formatting-search" 
                           placeholder="Search advanced formatting options..." 
                           style="flex: 1; padding: 8px 12px; border: 1px solid var(--nemo-border-color); 
                                  border-radius: 4px; background: var(--nemo-tertiary-bg); 
                                  color: var(--nemo-text-color); font-size: 14px;">
                </div>
            `;

            // Create tab navigation
            const tabNavigation = document.createElement('div');
            tabNavigation.className = 'nemo-advanced-formatting-tabs';
            tabNavigation.innerHTML = `
                <button class="nemo-advanced-formatting-tab active" data-tab="context-template">
                    <i class="fa-solid fa-file-text"></i> Context Template
                </button>
                <button class="nemo-advanced-formatting-tab" data-tab="instruct-template">
                    <i class="fa-solid fa-clipboard-list"></i> Instruct Template
                </button>
                <button class="nemo-advanced-formatting-tab" data-tab="system-prompt">
                    <i class="fa-solid fa-cogs"></i> System Prompt
                </button>
                <button class="nemo-advanced-formatting-tab" data-tab="reasoning-misc">
                    <i class="fa-solid fa-brain"></i> Reasoning/Misc
                </button>
            `;

            // Insert search and navigation before the main content area
            mainContentArea.parentNode.insertBefore(searchContainer, mainContentArea);
            mainContentArea.parentNode.insertBefore(tabNavigation, mainContentArea);

            // Reorganize content into tabs
            this.reorganizeContent(mainContentArea);

            // Add tab click handlers
            this.addTabHandlers();
            
            // Add search functionality
            this.addSearchHandler();
            
            console.log(`${LOG_PREFIX} Advanced Formatting tabbed interface created successfully`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating Advanced Formatting tabbed interface:`, error);
        }
    },

    reorganizeContent: function(mainContentArea) {
        // Get the three main columns
        const contextSettingsColumn = document.getElementById('ContextSettings');
        const instructSettingsColumn = document.getElementById('InstructSettingsColumn');  
        const systemPromptColumn = document.getElementById('SystemPromptColumn');
        
        if (!contextSettingsColumn || !instructSettingsColumn || !systemPromptColumn) {
            console.error(`${LOG_PREFIX} Could not find all Advanced Formatting columns`);
            return;
        }
        
        // Create tab content containers
        const contextTemplateTab = document.createElement('div');
        contextTemplateTab.className = 'nemo-advanced-formatting-tab-content active';
        contextTemplateTab.id = 'nemo-tab-context-template';

        const instructTemplateTab = document.createElement('div');
        instructTemplateTab.className = 'nemo-advanced-formatting-tab-content';
        instructTemplateTab.id = 'nemo-tab-instruct-template';

        const systemPromptTab = document.createElement('div');
        systemPromptTab.className = 'nemo-advanced-formatting-tab-content';
        systemPromptTab.id = 'nemo-tab-system-prompt';

        const reasoningMiscTab = document.createElement('div');
        reasoningMiscTab.className = 'nemo-advanced-formatting-tab-content';
        reasoningMiscTab.id = 'nemo-tab-reasoning-misc';

        // Move Context Settings column to Context Template tab
        contextTemplateTab.appendChild(contextSettingsColumn);
        
        // Move Instruct Settings column to Instruct Template tab  
        instructTemplateTab.appendChild(instructSettingsColumn);
        
        // Split System Prompt Column content
        const systemPromptChildren = Array.from(systemPromptColumn.children);
        systemPromptChildren.forEach(child => {
            const childText = child.textContent || '';
            const childId = child.getAttribute('name') || child.id || '';
            
            // System Prompt specific content goes to System Prompt tab
            if (childText.includes('System Prompt') || childId === 'SystemPromptBlock' || 
                child.querySelector('#sysprompt_select') || child.querySelector('#sysprompt_content')) {
                systemPromptTab.appendChild(child);
            }
            // Everything else goes to Reasoning/Misc tab
            else {
                reasoningMiscTab.appendChild(child);
            }
        });

        // Clear original content and add new tabs
        mainContentArea.innerHTML = '';
        mainContentArea.appendChild(contextTemplateTab);
        mainContentArea.appendChild(instructTemplateTab);
        mainContentArea.appendChild(systemPromptTab);
        mainContentArea.appendChild(reasoningMiscTab);
        
        console.log(`${LOG_PREFIX} Advanced Formatting content reorganized into tabs`);
    },


    addTabHandlers: function() {
        const tabs = document.querySelectorAll('.nemo-advanced-formatting-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
    },

    switchTab: function(tabName) {
        // Update active tab button
        const tabs = document.querySelectorAll('.nemo-advanced-formatting-tab');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Update active tab content
        const tabContents = document.querySelectorAll('.nemo-advanced-formatting-tab-content');
        tabContents.forEach(content => {
            if (content.id === `nemo-tab-${tabName}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        this.activeTab = tabName;
        console.log(`${LOG_PREFIX} Switched to Advanced Formatting tab: ${tabName}`);
    },

    addSearchHandler: function() {
        const searchInput = document.getElementById('nemo-advanced-formatting-search');
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
            
            console.log(`${LOG_PREFIX} Added search handler for Advanced Formatting tabs`);
        }
    },

    applySearchFilter: function(searchTerm) {
        const term = searchTerm.toLowerCase();
        const tabNavigation = document.querySelector('.nemo-advanced-formatting-tabs');
        const mainContentArea = document.querySelector('.flex-container.spaceEvenly');
        
        if (!tabNavigation || !mainContentArea) return;

        // Hide tab navigation during search
        tabNavigation.style.display = 'none';
        
        // Create or show search results container
        let searchResults = document.getElementById('nemo-advanced-formatting-search-results');
        if (!searchResults) {
            searchResults = document.createElement('div');
            searchResults.id = 'nemo-advanced-formatting-search-results';
            searchResults.className = 'nemo-search-results-container';
            mainContentArea.parentNode.insertBefore(searchResults, mainContentArea);
        }
        
        // Hide original tab content
        mainContentArea.style.display = 'none';
        searchResults.style.display = 'block';
        
        // Clear previous search results
        searchResults.innerHTML = '';
        
        const matchingElements = [];
        
        // Search through all tab content
        const allTabs = ['nemo-tab-context-template', 'nemo-tab-instruct-template', 'nemo-tab-system-prompt', 'nemo-tab-reasoning-misc'];
        
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
                const id = element.getAttribute('id') || '';
                
                const searchableText = `${text} ${placeholder} ${title} ${dataI18n} ${id}`.toLowerCase();
                
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
                    <p>No advanced formatting options found matching "<strong>${searchTerm}</strong>"</p>
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
        
        console.log(`${LOG_PREFIX} Applied Advanced Formatting search filter for: "${searchTerm}" (${matchingElements.length} results)`);
    },

    clearSearchFilter: function() {
        const tabNavigation = document.querySelector('.nemo-advanced-formatting-tabs');
        const mainContentArea = document.querySelector('.flex-container.spaceEvenly');
        const searchResults = document.getElementById('nemo-advanced-formatting-search-results');
        
        // Show tab navigation and content
        if (tabNavigation) tabNavigation.style.display = '';
        if (mainContentArea) mainContentArea.style.display = '';
        if (searchResults) searchResults.style.display = 'none';
        
        // Ensure the active tab is visible
        const activeTabContent = document.querySelector('.nemo-advanced-formatting-tab-content.active');
        if (activeTabContent) {
            activeTabContent.style.display = 'block';
        }
        
        console.log(`${LOG_PREFIX} Cleared Advanced Formatting search filter`);
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
            className.includes('range-block') ||
            className.includes('inline-drawer') ||
            className.includes('completion_prompt_manager') ||
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
                current.className.includes('range-block') ||
                current.className.includes('inline-drawer') ||
                current.className.includes('flex-container') ||
                current.className.includes('completion_prompt_manager') ||
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
        const advancedFormattingDrawer = document.getElementById('AdvancedFormatting');
        const tabNavigation = document.querySelector('.nemo-advanced-formatting-tabs');
        const searchContainer = document.querySelector('.nemo-advanced-formatting-search');
        const mainContentArea = document.querySelector('.flex-container.spaceEvenly');
        
        if (tabNavigation) {
            tabNavigation.remove();
        }
        
        if (searchContainer) {
            searchContainer.remove();
        }
        
        if (mainContentArea && advancedFormattingDrawer) {
            // Get the tab contents and restore them to the main content area
            const contextTemplateTab = document.getElementById('nemo-tab-context-template');
            const instructTemplateTab = document.getElementById('nemo-tab-instruct-template');
            const systemPromptTab = document.getElementById('nemo-tab-system-prompt');
            const reasoningMiscTab = document.getElementById('nemo-tab-reasoning-misc');
            
            // Clear main content area
            mainContentArea.innerHTML = '';
            
            // Restore original three-column layout
            if (contextTemplateTab && contextTemplateTab.firstChild) {
                mainContentArea.appendChild(contextTemplateTab.firstChild); // ContextSettings
            }
            if (instructTemplateTab && instructTemplateTab.firstChild) {
                mainContentArea.appendChild(instructTemplateTab.firstChild); // InstructSettingsColumn
            }
            
            // Restore SystemPromptColumn by combining system prompt and reasoning/misc content
            const systemPromptColumn = document.createElement('div');
            systemPromptColumn.id = 'SystemPromptColumn';
            systemPromptColumn.className = 'flex-container flexNoGap flexFlowColumn flex1';
            
            if (systemPromptTab) {
                while (systemPromptTab.firstChild) {
                    systemPromptColumn.appendChild(systemPromptTab.firstChild);
                }
            }
            if (reasoningMiscTab) {
                while (reasoningMiscTab.firstChild) {
                    systemPromptColumn.appendChild(reasoningMiscTab.firstChild);
                }
            }
            
            mainContentArea.appendChild(systemPromptColumn);
            
            // Remove tab containers
            if (contextTemplateTab) contextTemplateTab.remove();
            if (instructTemplateTab) instructTemplateTab.remove();
            if (systemPromptTab) systemPromptTab.remove();
            if (reasoningMiscTab) reasoningMiscTab.remove();
        }
        
        this.initialized = false;
        console.log(`${LOG_PREFIX} Advanced Formatting original layout restored`);
    },

    // Method to cleanup existing tab interface
    cleanup: function() {
        const existingTabs = document.querySelector('.nemo-advanced-formatting-tabs');
        const existingSearch = document.querySelector('.nemo-advanced-formatting-search');
        const existingSearchResults = document.getElementById('nemo-advanced-formatting-search-results');
        
        if (existingTabs) existingTabs.remove();
        if (existingSearch) existingSearch.remove();
        if (existingSearchResults) existingSearchResults.remove();
        
        // Reset any modified display styles
        const mainContentArea = document.querySelector('.flex-container.spaceEvenly');
        if (mainContentArea) {
            mainContentArea.style.display = '';
        }
    }
};