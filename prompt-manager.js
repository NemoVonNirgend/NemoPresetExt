import { saveSettingsDebounced, eventSource, event_types } from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';
import { LOG_PREFIX, NEMO_EXTENSION_NAME, ensureSettingsNamespace, escapeRegex, delay, NEMO_SECTIONS_ENABLED_KEY, NEMO_SNAPSHOT_KEY, NEMO_FAVORITE_PRESETS_KEY } from './utils.js';
import { promptManager } from '../../../../scripts/openai.js';

// 1. CONFIGURATION & STATE
const NEMO_BUILT_IN_PATTERNS = ['=+', '⭐─+', '━+'];

const SELECTORS = {
    promptsContainer: '#completion_prompt_manager_list',
    promptItemRow: 'li.completion_prompt_manager_prompt',
    promptNameLink: 'span.completion_prompt_manager_prompt_name a.prompt-manager-inspect-action',
    toggleButton: '.prompt-manager-toggle-action',
    enabledToggleClass: 'fa-toggle-on',
    promptEditorPopup: '.completion_prompt_manager_popup_entry',
    promptEditorForm: '.completion_prompt_manager_popup_entry_form',
    promptEditorSaveBtn: '#completion_prompt_manager_popup_entry_form_save',
    promptEditorContent: '#completion_prompt_manager_popup_entry_form_prompt',
};

// State Variables
let DIVIDER_PREFIX_REGEX;
let openSectionStates = {};
let organizeTimeout;
let isSectionsFeatureEnabled = true;
let dropIndicator;

// 2. MODULE-SPECIFIC HELPERS
export async function loadAndSetDividerRegex() {
    let finalPatterns = [...NEMO_BUILT_IN_PATTERNS];
    if (ensureSettingsNamespace()) {
        const savedPatternString = extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern;
        if (savedPatternString) {
            const customPatterns = String(savedPatternString).split(',').map(p => p.trim()).filter(p => p.length > 0);
            finalPatterns.push(...customPatterns);
        }
    }
    const combinedPatternString = [...new Set(finalPatterns)].join('|');
    try {
        DIVIDER_PREFIX_REGEX = new RegExp(`^(${combinedPatternString})`);
    } catch (e) {
        console.error(`${LOG_PREFIX} Invalid regex pattern. Using built-ins only.`, e);
        DIVIDER_PREFIX_REGEX = new RegExp(`^(${NEMO_BUILT_IN_PATTERNS.join('|')})`);
    }
}

// 3. MAIN OBJECT
export const NemoPresetManager = {
    showStatusMessage: function(message, type = 'info', duration = 4000) {
        const statusDiv = document.getElementById('nemoSnapshotStatus');
        if (!statusDiv) return;
        if (statusDiv.nemoTimeout) clearTimeout(statusDiv.nemoTimeout);
        statusDiv.textContent = message;
        statusDiv.className = `nemo-status-message ${type}`;
        requestAnimationFrame(() => { statusDiv.classList.add('visible'); });
        statusDiv.nemoTimeout = setTimeout(() => { statusDiv.classList.remove('visible'); }, duration);
    },

    takeSnapshot: async function() {
        if (!promptManager) return;
        const activeIdentifiers = new Set();
        document.querySelectorAll(`${SELECTORS.promptsContainer} ${SELECTORS.toggleButton}.${SELECTORS.enabledToggleClass}`).forEach(toggle => {
            const promptLi = toggle.closest(SELECTORS.promptItemRow);
            if (promptLi) activeIdentifiers.add(promptLi.dataset.pmIdentifier);
        });
        const snapshotArray = Array.from(activeIdentifiers);
        localStorage.setItem(NEMO_SNAPSHOT_KEY, JSON.stringify(snapshotArray));
        document.getElementById('nemoApplySnapshotBtn').disabled = false;
        this.showStatusMessage(`Snapshot created with ${snapshotArray.length} active prompt(s).`, 'success');
    },

    applySnapshot: async function() {
        const snapshotJSON = localStorage.getItem(NEMO_SNAPSHOT_KEY);
        if (!snapshotJSON) { this.showStatusMessage('No snapshot taken.', 'error'); return; }
        const snapshotIdentifiers = new Set(JSON.parse(snapshotJSON));
        const allPromptItems = document.querySelectorAll(`${SELECTORS.promptsContainer} ${SELECTORS.promptItemRow}`);
        const togglesToClick = [];
        allPromptItems.forEach(item => {
            const identifier = item.dataset.pmIdentifier;
            const toggleButton = item.querySelector(SELECTORS.toggleButton);
            if (!identifier || !toggleButton) return;
            const isCurrentlyEnabled = toggleButton.classList.contains(SELECTORS.enabledToggleClass);
            const shouldBeEnabled = snapshotIdentifiers.has(identifier);
            if (isCurrentlyEnabled !== shouldBeEnabled) togglesToClick.push(toggleButton);
        });
        if (togglesToClick.length > 0) {
            this.showStatusMessage(`Applying snapshot... changing ${togglesToClick.length} prompts.`, 'info', 5000);
            for (const button of togglesToClick) {
                button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                await delay(50);
            }
            await delay(100);
            this.showStatusMessage(`Snapshot applied. ${snapshotIdentifiers.size} prompt(s) are now active.`, 'success');
        } else {
            this.showStatusMessage('Current state already matches snapshot.', 'info');
        }
    },

    getDividerInfo: function(promptElement, forceCheck = false) {
        if (!forceCheck && promptElement.dataset.nemoDividerChecked) {
            if (promptElement.dataset.nemoIsDivider === 'true') {
                return {
                    isDivider: true,
                    name: promptElement.dataset.nemoSectionName,
                    originalText: promptElement.dataset.nemoOriginalText
                };
            }
            return { isDivider: false };
        }

        const promptNameElement = promptElement.querySelector(SELECTORS.promptNameLink);
        if (!promptNameElement) return { isDivider: false };

        const promptName = promptNameElement.textContent.trim();
        const match = DIVIDER_PREFIX_REGEX.exec(promptName);

        promptElement.dataset.nemoDividerChecked = 'true';

        if (match) {
            let cleanName = promptName.substring(match[0].length).trim();
            const suffixRegex = new RegExp(`\\s*(${escapeRegex(match[1])})\\s*$`);
            cleanName = cleanName.replace(suffixRegex, '').trim() || "Section";
            
            promptElement.dataset.nemoIsDivider = 'true';
            promptElement.dataset.nemoSectionName = cleanName;
            promptElement.dataset.nemoOriginalText = promptName;
            
            return { isDivider: true, name: cleanName, originalText: promptName };
        }
        
        promptElement.dataset.nemoIsDivider = 'false';
        return { isDivider: false };
    },

    updateSectionCount: function(sectionElement) {
        if (!sectionElement || !sectionElement.matches('details.nemo-engine-section')) return;
        
        const content = sectionElement.querySelector('.nemo-section-content');
        if (!content) return;

        const totalCount = content.children.length;
        const enabledCount = content.querySelectorAll(`:scope > ${SELECTORS.promptItemRow} .${SELECTORS.enabledToggleClass}`).length;
        
        const countSpan = sectionElement.querySelector('summary .nemo-enabled-count');
        if (countSpan) countSpan.textContent = ` (${enabledCount}/${totalCount})`;
        
        const masterToggle = sectionElement.querySelector('.nemo-section-master-toggle');
        if (masterToggle) masterToggle.classList.toggle('nemo-active', enabledCount > 0);
    },

    processSingleItem: function(item, container) {
        const dividerInfo = this.getDividerInfo(item, true); // Force check on process
        item.draggable = true;

        // Add favorite button
        const controlsWrapper = item.querySelector('.completion_prompt_manager_prompt_controls');
        if (controlsWrapper && !controlsWrapper.querySelector('.nemo-favorite-btn')) {
            const favoriteBtn = document.createElement('div');
            favoriteBtn.className = 'nemo-favorite-btn menu_button menu_button_icon fa-solid fa-star';
            favoriteBtn.title = 'Favorite Preset';
            controlsWrapper.prepend(favoriteBtn);

            const presetId = item.dataset.pmIdentifier;
            if (this.isFavorite(presetId)) {
                favoriteBtn.classList.add('favorited');
            }

            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(presetId);
                favoriteBtn.classList.toggle('favorited');
            });
        }

        if (dividerInfo.isDivider) {
            item.classList.add('nemo-header-item');
            item.draggable = false;
            const details = document.createElement('details');
            details.className = 'nemo-engine-section';
            details.open = openSectionStates[dividerInfo.originalText] || false;
            
            const summary = document.createElement('summary');
            const nameSpan = item.querySelector('span.completion_prompt_manager_prompt_name');
            if (nameSpan) {
                const link = nameSpan.querySelector('a');
                if (link) link.textContent = dividerInfo.name;
                if (!nameSpan.querySelector('.nemo-enabled-count')) {
                    nameSpan.insertAdjacentHTML('beforeend', '<span class="nemo-enabled-count"></span>');
                }
            }

            const wrapper = item.querySelector('.nemo-right-controls-wrapper');
            if (wrapper && !wrapper.querySelector('.nemo-section-master-toggle')) {
                const masterToggleButton = document.createElement('button');
                masterToggleButton.className = 'menu_button nemo-section-master-toggle';
                masterToggleButton.title = 'Toggle all in section';
                masterToggleButton.innerHTML = '<i class="fa-solid fa-power-off"></i>';
                wrapper.prepend(masterToggleButton);
            }

            summary.appendChild(item);
            details.appendChild(summary);
            const contentDiv = document.createElement('div');
            contentDiv.className = 'nemo-section-content';
            details.appendChild(contentDiv);
            
            container.appendChild(details);
            this.updateSectionCount(details);
            return details;
        } else {
            const lastSection = container.lastElementChild;
            if (lastSection && lastSection.matches('details.nemo-engine-section')) {
                const content = lastSection.querySelector('.nemo-section-content');
                content.appendChild(item);
                this.updateSectionCount(lastSection);
            } else {
                container.appendChild(item);
            }
            return item;
        }
    },

    getFavorites: function() {
        const favorites = localStorage.getItem(NEMO_FAVORITE_PRESETS_KEY);
        return favorites ? JSON.parse(favorites) : [];
    },

    saveFavorites: function(favorites) {
        localStorage.setItem(NEMO_FAVORITE_PRESETS_KEY, JSON.stringify(favorites));
        eventSource.emit(event_types.NEMO_FAVORITES_UPDATED);
    },

    isFavorite: function(presetId) {
        return this.getFavorites().includes(presetId);
    },

    toggleFavorite: function(presetId) {
        let favorites = this.getFavorites();
        if (favorites.includes(presetId)) {
            favorites = favorites.filter(id => id !== presetId);
        } else {
            favorites.push(presetId);
        }
        this.saveFavorites(favorites);
    },

    organizePrompts: async function(forceFullReorganization = false) {
        const promptsContainer = document.querySelector(SELECTORS.promptsContainer);
        if (!promptsContainer || (promptsContainer.dataset.nemoOrganizing === 'true' && !forceFullReorganization)) return;
        promptsContainer.dataset.nemoOrganizing = 'true';

        isSectionsFeatureEnabled = localStorage.getItem(NEMO_SECTIONS_ENABLED_KEY) !== 'false';

        // First, always flatten the structure to start from a clean, predictable state.
        const sections = Array.from(promptsContainer.querySelectorAll('details.nemo-engine-section'));
        if (sections.length > 0) {
            const allPromptsInOrder = [];
            sections.forEach(section => {
                const headerItem = section.querySelector('summary > li.completion_prompt_manager_prompt');
                if (headerItem) {
                    // Restore original text before putting it back
                    const link = headerItem.querySelector(SELECTORS.promptNameLink);
                    if (link && headerItem.dataset.nemoOriginalText) {
                        link.textContent = headerItem.dataset.nemoOriginalText;
                    }
                    allPromptsInOrder.push(headerItem);
                }
                const contentItems = Array.from(section.querySelectorAll('.nemo-section-content > li.completion_prompt_manager_prompt'));
                allPromptsInOrder.push(...contentItems);
            });
            // Append all prompts to a fragment, clear the container, then add them back.
            const fragment = document.createDocumentFragment();
            allPromptsInOrder.forEach(p => fragment.appendChild(p));
            promptsContainer.innerHTML = '';
            promptsContainer.appendChild(fragment);
        }

        // Clean up metadata from all prompts now that they are "unwrapped"
        const allItems = Array.from(promptsContainer.querySelectorAll('li.completion_prompt_manager_prompt'));
        allItems.forEach(item => {
            delete item.dataset.nemoDividerChecked;
            delete item.dataset.nemoIsDivider;
            delete item.dataset.nemoSectionName;
            delete item.dataset.nemoOriginalText;
            item.classList.remove('nemo-header-item');
            item.draggable = true;
        });

        // If the feature is disabled, we're done. The list is flat.
        if (!isSectionsFeatureEnabled) {
            delete promptsContainer.dataset.nemoOrganizing;
            return;
        }

        // If the feature is enabled, rebuild the sections.
        const fragment = document.createDocumentFragment();
        const itemsToProcess = Array.from(promptsContainer.children);
        itemsToProcess.forEach(item => fragment.appendChild(item)); // Move all items to a fragment
        promptsContainer.innerHTML = ''; // Clear the container

        itemsToProcess.forEach(item => {
            if (item.matches('li.completion_prompt_manager_prompt')) {
                this.processSingleItem(item, promptsContainer); // processSingleItem will append to promptsContainer
            }
        });
        
        delete promptsContainer.dataset.nemoOrganizing;
    },

    handlePresetSearch: function() {
        const searchInput = document.getElementById('nemoPresetSearchInput');
        const searchTerm = searchInput.value.trim().toLowerCase();
        const promptsContainer = document.querySelector(SELECTORS.promptsContainer);
        if (!promptsContainer) return;

        promptsContainer.querySelectorAll(`${SELECTORS.promptItemRow}, details.nemo-engine-section`).forEach(el => el.style.display = 'none');
        if (searchTerm === '') {
            promptsContainer.querySelectorAll(`${SELECTORS.promptItemRow}, details.nemo-engine-section`).forEach(el => el.style.display = '');
            if (localStorage.getItem(NEMO_SECTIONS_ENABLED_KEY) !== 'false') {
                promptsContainer.querySelectorAll('details.nemo-engine-section').forEach(section => {
                    const summaryLi = section.querySelector('summary > li');
                    if (summaryLi) {
                        const dividerInfo = this.getDividerInfo(summaryLi);
                        section.open = openSectionStates[dividerInfo.originalText] || false;
                    }
                });
            }
            return;
        }
        promptsContainer.querySelectorAll(SELECTORS.promptItemRow).forEach(item => {
            const name = item.querySelector(SELECTORS.promptNameLink)?.textContent.trim().toLowerCase() || '';
            if (name.includes(searchTerm)) {
                item.style.display = '';
                const parentSection = item.closest('details.nemo-engine-section');
                if (parentSection) { parentSection.style.display = ''; parentSection.open = true; }
            }
        });
    },

    initializeSearchAndSections: function(container) {
        if (container.dataset.nemoPromptsInitialized) return;
        container.dataset.nemoPromptsInitialized = 'true';

        isSectionsFeatureEnabled = localStorage.getItem(NEMO_SECTIONS_ENABLED_KEY) !== 'false';

        if (!document.getElementById('nemoPresetSearchContainer')) {
            const searchAndStatusWrapper = document.createElement('div');
            searchAndStatusWrapper.id = 'nemoSearchAndStatusWrapper';
            searchAndStatusWrapper.innerHTML = `
                <div id="nemoPresetSearchContainer">
                    <input type="text" id="nemoPresetSearchInput" placeholder="Search loaded prompts..." class="text_pole">
                    <div class="nemo-search-controls">
                        <button id="nemoPresetSearchClear" title="Clear search" class="menu_button"><i class="fa-solid fa-times"></i></button>
                        <div class="nemo-search-divider"></div>
                        <button id="nemoToggleSectionsBtn" title="Toggle Collapsible Sections" class="menu_button"><i class="fa-solid fa-list-ul"></i></button>
                        <button id="nemoTakeSnapshotBtn" title="Take a snapshot of the current prompt state" class="menu_button"><i class="fa-solid fa-camera"></i></button>
                        <button id="nemoApplySnapshotBtn" title="Apply the last snapshot" class="menu_button" disabled><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                    </div>
                </div>
                <div id="nemoSnapshotStatus" class="nemo-status-message"></div>`;
            container.parentElement.insertBefore(searchAndStatusWrapper, container);

            if (localStorage.getItem(NEMO_SNAPSHOT_KEY)) {
                document.getElementById('nemoApplySnapshotBtn').disabled = false;
            }

            document.getElementById('nemoPresetSearchInput').addEventListener('input', this.handlePresetSearch.bind(this));
            document.getElementById('nemoPresetSearchClear').addEventListener('click', () => {
                const input = document.getElementById('nemoPresetSearchInput'); input.value = ''; this.handlePresetSearch(); input.focus();
            });
            document.getElementById('nemoTakeSnapshotBtn').addEventListener('click', this.takeSnapshot.bind(this));
            document.getElementById('nemoApplySnapshotBtn').addEventListener('click', this.applySnapshot.bind(this));
            const toggleBtn = document.getElementById('nemoToggleSectionsBtn');
            toggleBtn.classList.toggle('nemo-active', isSectionsFeatureEnabled);
            toggleBtn.addEventListener('click', () => {
                isSectionsFeatureEnabled = !isSectionsFeatureEnabled;
                localStorage.setItem(NEMO_SECTIONS_ENABLED_KEY, isSectionsFeatureEnabled);
                toggleBtn.classList.toggle('nemo-active', isSectionsFeatureEnabled);
                this.organizePrompts();
            });
        }
        this.organizePrompts();

        if (!document.getElementById('nemo-drop-indicator')) {
            dropIndicator = document.createElement('div');
            dropIndicator.id = 'nemo-drop-indicator';
            document.body.appendChild(dropIndicator);
        }

        let draggedItem = null;
        container.addEventListener('dragstart', (e) => {
            const target = e.target.closest('li.completion_prompt_manager_prompt');
            if (target && target.draggable) {
                draggedItem = target;
                setTimeout(() => target.classList.add('nemo-dragging'), 0);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', target.dataset.pmIdentifier);
            }
        });
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const target = e.target.closest('li.completion_prompt_manager_prompt');
            if (target && target !== draggedItem) {
                const rect = target.getBoundingClientRect();
                const isAfter = e.clientY > rect.top + rect.height / 2;
                const top = isAfter ? rect.bottom : rect.top;
                dropIndicator.style.display = 'block';
                dropIndicator.style.left = `${rect.left}px`;
                dropIndicator.style.top = `${top - 1}px`;
                dropIndicator.style.width = `${rect.width}px`;
            }
        });
        container.addEventListener('dragleave', (e) => {
            if (e.target === container) dropIndicator.style.display = 'none';
        });
        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropIndicator.style.display = 'none';
            const targetItem = e.target.closest('li.completion_prompt_manager_prompt');
            if (!targetItem || !draggedItem || targetItem === draggedItem) return;

            const oldSection = draggedItem.closest('details.nemo-engine-section');
            const targetParent = targetItem.parentElement;
            const rect = targetItem.getBoundingClientRect();
            const isAfter = e.clientY > rect.top + rect.height / 2;

            if (targetParent.matches('.nemo-section-content')) {
                 if (isAfter) targetParent.insertBefore(draggedItem, targetItem.nextSibling);
                 else targetParent.insertBefore(draggedItem, targetItem);
                 const newSection = targetParent.closest('details.nemo-engine-section');
                 if (oldSection !== newSection) {
                    this.updateSectionCount(oldSection);
                    this.updateSectionCount(newSection);
                 }
            } else {
                // Handle dropping outside of a section content area if necessary
                // For now, we assume valid drop targets are within sections or at the top level
            }
        });
        container.addEventListener('dragend', (e) => {
            if (draggedItem) draggedItem.classList.remove('nemo-dragging');
            draggedItem = null;
            dropIndicator.style.display = 'none';
        });

        container.addEventListener('click', (event) => {
            if (event.target.closest('summary') && !event.target.closest('a, button')) {
                const details = event.target.closest('details'); const li = details.querySelector('summary > li');
                const dividerInfo = this.getDividerInfo(li);
                setTimeout(() => { openSectionStates[dividerInfo.originalText] = details.open; }, 0);
            } else if (event.target.closest(SELECTORS.toggleButton)) {
                setTimeout(() => {
                    const section = event.target.closest('details.nemo-engine-section');
                    if (section) this.updateSectionCount(section);
                }, 100);
            } else if (event.target.closest('.nemo-section-master-toggle')) {
                event.preventDefault(); event.stopPropagation();
                const section = event.target.closest('details.nemo-engine-section');
                if (section) {
                    const promptsInSection = section.querySelectorAll(`.nemo-section-content ${SELECTORS.toggleButton}`);
                    const shouldEnable = Array.from(promptsInSection).some(toggle => !toggle.classList.contains(SELECTORS.enabledToggleClass));
                    promptsInSection.forEach(toggle => {
                        const isEnabled = toggle.classList.contains(SELECTORS.enabledToggleClass);
                        if ((shouldEnable && !isEnabled) || (!shouldEnable && isEnabled)) toggle.click();
                    });
                }
            }
        });
        const listObserver = new MutationObserver((mutations) => {
            if (container.dataset.nemoOrganizing === 'true') return;

            listObserver.disconnect(); // Disconnect to prevent observing our own changes

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // Handle added nodes
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.matches('li.completion_prompt_manager_prompt')) {
                            // Item was added, needs to be processed and placed correctly.
                            node.remove();
                            this.processSingleItem(node, container);
                        }
                    });

                    // Handle removed nodes
                    mutation.removedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.matches('li.completion_prompt_manager_prompt')) {
                            // If a prompt item is removed, we only need to update the count of its former parent section.
                            const oldParentDetails = mutation.target.closest('details.nemo-engine-section');
                            if (oldParentDetails) {
                                this.updateSectionCount(oldParentDetails);
                            }
                        }
                    });
                }
            }

            listObserver.observe(container, { childList: true, subtree: true }); // Reconnect
        });
        listObserver.observe(container, { childList: true, subtree: true });
    },

};