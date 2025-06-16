// Import necessary SillyTavern objects/functions
import {
    saveSettingsDebounced,
    getRequestHeaders,
    eventSource,
    event_types,
} from '../../../../script.js';
import {
    extension_settings,
    getContext,
} from '../../../extensions.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { oai_settings, openai_setting_names, promptManager, Message } from '../../../../scripts/openai.js';

// 0. DYNAMIC DEPENDENCY LOADING
// -----------------------------------------------------------------------------
const LOG_PREFIX = `[NemoPresetExt]`;

// 1. CONFIGURATION
// -----------------------------------------------------------------------------
const NEMO_EXTENSION_NAME = "NemoPresetExt";
const NEMO_DEFAULT_REGEX_PATTERN = '=+';
const NEMO_SNAPSHOT_KEY = 'nemoPromptSnapshotData'; // localStorage key
const NEMO_METADATA_KEY = 'nemoNavigatorMetadata'; // localStorage key for folders/images

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
    promptControls: '.prompt_manager_prompt_controls',
    promptManagerHeader: '#completion_prompt_manager .completion_prompt_manager_header',
    promptPresetSelect: '#completion_prompt_manager_footer_append_prompt',
};

// State Variables
let DIVIDER_PREFIX_REGEX = new RegExp(`^(${NEMO_DEFAULT_REGEX_PATTERN})`);
let openSectionStates = {};
let organizeTimeout;

// 2. UTILITY & HELPER FUNCTIONS
// -----------------------------------------------------------------------------
function ensureSettingsNamespace() {
    if (!extension_settings) return false;
    extension_settings[NEMO_EXTENSION_NAME] = extension_settings[NEMO_EXTENSION_NAME] || {};
    return true;
}

async function loadAndSetDividerRegex() {
    let patternString = NEMO_DEFAULT_REGEX_PATTERN;
    if (ensureSettingsNamespace()) {
        const savedPattern = extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern;
        if (savedPattern) patternString = String(savedPattern).trim();
    }
    try {
        DIVIDER_PREFIX_REGEX = new RegExp(`^(${patternString})`);
    } catch (e) {
        console.error(`${LOG_PREFIX} Invalid regex pattern. Using default.`, e);
        DIVIDER_PREFIX_REGEX = new RegExp(`^(${NEMO_DEFAULT_REGEX_PATTERN})`);
    }
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const delay = ms => new Promise(res => setTimeout(res, ms));

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 3. SNAPSHOT FUNCTIONS
// -----------------------------------------------------------------------------
function showStatusMessage(message, type = 'info', duration = 4000) {
    const statusDiv = document.getElementById('nemoSnapshotStatus');
    if (!statusDiv) return;

    if (statusDiv.nemoTimeout) clearTimeout(statusDiv.nemoTimeout);

    statusDiv.textContent = message;
    statusDiv.className = `nemo-status-message ${type}`;
    
    requestAnimationFrame(() => {
        statusDiv.classList.add('visible');
    });

    statusDiv.nemoTimeout = setTimeout(() => {
        statusDiv.classList.remove('visible');
    }, duration);
}

async function takeSnapshot() {
    if (!promptManager) return;
    const activeIdentifiers = new Set();
    document.querySelectorAll(`${SELECTORS.promptsContainer} ${SELECTORS.toggleButton}.${SELECTORS.enabledToggleClass}`).forEach(toggle => {
        const promptLi = toggle.closest(SELECTORS.promptItemRow);
        if (promptLi) {
            activeIdentifiers.add(promptLi.dataset.pmIdentifier);
        }
    });

    const snapshotArray = Array.from(activeIdentifiers);
    localStorage.setItem(NEMO_SNAPSHOT_KEY, JSON.stringify(snapshotArray));
    document.getElementById('nemoApplySnapshotBtn').disabled = false;
    showStatusMessage(`Snapshot created with ${snapshotArray.length} active prompt(s).`, 'success');
}

async function applySnapshot() {
    const snapshotJSON = localStorage.getItem(NEMO_SNAPSHOT_KEY);
    if (!snapshotJSON) {
        showStatusMessage('No snapshot taken.', 'error');
        return;
    }
    const snapshotIdentifiers = new Set(JSON.parse(snapshotJSON));
    
    const allPromptItems = document.querySelectorAll(`${SELECTORS.promptsContainer} ${SELECTORS.promptItemRow}`);
    const togglesToClick = [];

    allPromptItems.forEach(item => {
        const identifier = item.dataset.pmIdentifier;
        const toggleButton = item.querySelector(SELECTORS.toggleButton);
        if (!identifier || !toggleButton) return;

        const isCurrentlyEnabled = toggleButton.classList.contains(SELECTORS.enabledToggleClass);
        const shouldBeEnabled = snapshotIdentifiers.has(identifier);

        if (isCurrentlyEnabled !== shouldBeEnabled) {
            togglesToClick.push(toggleButton);
        }
    });

    if (togglesToClick.length > 0) {
        showStatusMessage(`Applying snapshot... changing ${togglesToClick.length} prompts.`, 'info', 5000);
        for (const button of togglesToClick) {
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            await delay(50);
        }
        await delay(100);
        showStatusMessage(`Snapshot applied. ${snapshotIdentifiers.size} prompt(s) are now active.`, 'success');
    } else {
        showStatusMessage('Current state already matches snapshot.', 'info');
    }
}


// 4. COLLAPSIBLE SECTIONS & SEARCH
function getDividerInfo(promptElement) {
    const promptNameElement = promptElement.querySelector(SELECTORS.promptNameLink);
    if (!promptNameElement) return { isDivider: false };

    const promptName = promptNameElement.textContent.trim();
    if (DIVIDER_PREFIX_REGEX.test(promptName)) {
        const match = promptName.match(DIVIDER_PREFIX_REGEX);
        let cleanName = promptName.substring(match[0].length).trim();
        const suffixRegex = new RegExp(`\\s*(${escapeRegex(match[1])}|=+)\\s*$`);
        cleanName = cleanName.replace(suffixRegex, '').trim();
        return { isDivider: true, name: cleanName || "Section", originalText: promptName };
    }
    return { isDivider: false };
}

function updateSectionCount(sectionElement) {
    if (!sectionElement) return;
    
    const content = sectionElement.querySelector('.nemo-section-content');
    if (!content) return;
    
    const totalCount = content.querySelectorAll(SELECTORS.toggleButton).length;
    const enabledCount = content.querySelectorAll(`${SELECTORS.toggleButton}.${SELECTORS.enabledToggleClass}`).length;

    const countSpan = sectionElement.querySelector('summary .nemo-enabled-count');
    if (countSpan) {
        countSpan.textContent = ` (${enabledCount}/${totalCount})`;
    }

    const masterToggle = sectionElement.querySelector('.nemo-section-master-toggle');
    if(masterToggle){
        masterToggle.classList.toggle('nemo-active', enabledCount > 0);
    }
}

async function organizePrompts() {
    const promptsContainer = document.querySelector(SELECTORS.promptsContainer);
    if (!promptsContainer || promptsContainer.dataset.nemoOrganizing === 'true') return;
    promptsContainer.dataset.nemoOrganizing = 'true';

    promptsContainer.querySelectorAll('details.nemo-engine-section').forEach(section => {
        const content = section.querySelector('.nemo-section-content');
        if (content) {
            while (content.firstChild) {
                section.parentNode.insertBefore(content.firstChild, section);
            }
        }
        const summaryLi = section.querySelector('summary > li');
        if (summaryLi) {
            section.parentNode.insertBefore(summaryLi, section);
        }
        section.remove();
    });

    const allItems = Array.from(promptsContainer.children);
    let currentSectionContent = null;

    for (const item of allItems) {
        if (!item.matches(SELECTORS.promptItemRow)) continue;
        
        const controls = item.querySelector(SELECTORS.promptControls);
        if (controls && !controls.closest('.nemo-right-controls-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'nemo-right-controls-wrapper';
            controls.parentNode.insertBefore(wrapper, controls);
            wrapper.appendChild(controls);
        }

        const dividerInfo = getDividerInfo(item);
        if (dividerInfo.isDivider) {
            const details = document.createElement('details'); 
            details.className = 'nemo-engine-section'; 
            details.open = openSectionStates[dividerInfo.originalText] || false;
            
            const summary = document.createElement('summary'); 
            const nameSpan = item.querySelector('span.completion_prompt_manager_prompt_name');
            if (nameSpan && !nameSpan.querySelector('.nemo-enabled-count')) {
                nameSpan.insertAdjacentHTML('beforeend', '<span class="nemo-enabled-count"></span>');
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
            promptsContainer.appendChild(details);
            currentSectionContent = contentDiv;
        } else {
            if (currentSectionContent) {
                currentSectionContent.appendChild(item);
            }
        }
    }

    promptsContainer.querySelectorAll('details.nemo-engine-section').forEach(updateSectionCount);
    delete promptsContainer.dataset.nemoOrganizing;
}

function handlePresetSearch() {
    const searchInput = document.getElementById('nemoPresetSearchInput');
    const searchTerm = searchInput.value.trim().toLowerCase();
    const promptsContainer = document.querySelector(SELECTORS.promptsContainer);
    if (!promptsContainer) return;

    promptsContainer.querySelectorAll(`${SELECTORS.promptItemRow}, details.nemo-engine-section`).forEach(el => el.style.display = 'none');

    if (searchTerm === '') {
        promptsContainer.querySelectorAll(`${SELECTORS.promptItemRow}, details.nemo-engine-section`).forEach(el => el.style.display = '');
        promptsContainer.querySelectorAll('details.nemo-engine-section').forEach(section => {
            const summaryLi = section.querySelector('summary > li');
            if (summaryLi) {
                const dividerInfo = getDividerInfo(summaryLi);
                section.open = openSectionStates[dividerInfo.originalText] || false;
            }
        });
        return;
    }

    promptsContainer.querySelectorAll(SELECTORS.promptItemRow).forEach(item => {
        const name = item.querySelector(SELECTORS.promptNameLink)?.textContent.trim().toLowerCase() || '';
        if (name.includes(searchTerm)) {
            item.style.display = '';
            const parentSection = item.closest('details.nemo-engine-section');
            if (parentSection) { 
                parentSection.style.display = ''; 
                parentSection.open = true; 
            }
        }
    });
}

function initializeSearchAndSections(container) {
    if (container.dataset.nemoPromptsInitialized) return;
    container.dataset.nemoPromptsInitialized = 'true';

    if (!document.getElementById('nemoPresetSearchContainer')) {
        const searchAndStatusWrapper = document.createElement('div');
        searchAndStatusWrapper.id = 'nemoSearchAndStatusWrapper';
        searchAndStatusWrapper.innerHTML = `
            <div id="nemoPresetSearchContainer">
                <input type="text" id="nemoPresetSearchInput" placeholder="Search loaded prompts..." class="text_pole">
                <div class="nemo-search-controls">
                    <button id="nemoPresetSearchClear" title="Clear search" class="menu_button"><i class="fa-solid fa-times"></i></button>
                    <div class="nemo-search-divider"></div>
                    <button id="nemoTakeSnapshotBtn" title="Take a snapshot of the current prompt state" class="menu_button"><i class="fa-solid fa-camera"></i></button>
                    <button id="nemoApplySnapshotBtn" title="Apply the last snapshot" class="menu_button" disabled><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                </div>
            </div>
            <div id="nemoSnapshotStatus" class="nemo-status-message"></div>
        `;
        container.parentElement.insertBefore(searchAndStatusWrapper, container);
        
        const applyBtn = document.getElementById('nemoApplySnapshotBtn');
        if (localStorage.getItem(NEMO_SNAPSHOT_KEY)) {
            applyBtn.disabled = false;
        }

        document.getElementById('nemoPresetSearchInput').addEventListener('input', handlePresetSearch);
        document.getElementById('nemoPresetSearchClear').addEventListener('click', () => { 
            const input = document.getElementById('nemoPresetSearchInput'); 
            input.value = ''; 
            handlePresetSearch(); 
            input.focus(); 
        });
        document.getElementById('nemoTakeSnapshotBtn').addEventListener('click', takeSnapshot);
        document.getElementById('nemoApplySnapshotBtn').addEventListener('click', applySnapshot);
    }

    organizePrompts();

    container.addEventListener('click', (event) => {
        if (event.target.closest('summary') && !event.target.closest('a, button')) {
            const details = event.target.closest('details'); 
            const li = details.querySelector('summary > li');
            const dividerInfo = getDividerInfo(li);
            setTimeout(() => { openSectionStates[dividerInfo.originalText] = details.open; }, 0);
        } else if (event.target.closest(SELECTORS.toggleButton)) {
            setTimeout(() => {
                const section = event.target.closest('details.nemo-engine-section');
                if (section) {
                    updateSectionCount(section);
                }
            }, 100);
        } else if (event.target.closest('.nemo-section-master-toggle')) {
            event.preventDefault();
            event.stopPropagation();
            const section = event.target.closest('details.nemo-engine-section');
            if (section) {
                const promptsInSection = section.querySelectorAll(`.nemo-section-content ${SELECTORS.toggleButton}`);
                const shouldEnable = Array.from(promptsInSection).some(toggle => !toggle.classList.contains(SELECTORS.enabledToggleClass));
                promptsInSection.forEach(toggle => {
                    const isEnabled = toggle.classList.contains(SELECTORS.enabledToggleClass);
                    if ((shouldEnable && !isEnabled) || (!shouldEnable && isEnabled)) {
                        toggle.click();
                    }
                });
            }
        }
    });

    const listObserver = new MutationObserver(() => {
        listObserver.disconnect();
        clearTimeout(organizeTimeout);
        organizeTimeout = setTimeout(async () => {
            await organizePrompts();
            listObserver.observe(container, { childList: true });
        }, 250);
    });
    listObserver.observe(container, { childList: true });
}


// 5. CONTEXTUAL TRIGGERS
function savePromptTriggers(promptId, triggerData) { if (!ensureSettingsNamespace()) return; const triggers = extension_settings[NEMO_EXTENSION_NAME].nemoPromptTriggers || {}; if (triggerData && triggerData.keys && triggerData.keys.length > 0) { triggers[promptId] = triggerData; } else { delete triggers[promptId]; } extension_settings[NEMO_EXTENSION_NAME].nemoPromptTriggers = triggers; saveSettingsDebounced(); }
function loadPromptTriggers(promptId) { return extension_settings[NEMO_EXTENSION_NAME]?.nemoPromptTriggers?.[promptId] || null; }
function replicateMatchKeys(haystack, needle, options) { const { caseSensitive, matchWholeWords } = options; const regexMatch = needle.match(/^\/(.+)\/([gimsuy]*)$/); if (regexMatch) { try { return new RegExp(regexMatch[1], regexMatch[2]).test(haystack); } catch (e) { console.error(`${LOG_PREFIX} Invalid Regex: ${needle}`, e); return false; } } const h = caseSensitive ? haystack : haystack.toLowerCase(); const n = caseSensitive ? needle : needle.toLowerCase(); return matchWholeWords ? new RegExp(`\\b${escapeRegex(n)}\\b`).test(h) : h.includes(n); }
function injectTriggerUI(popupElement) { if (popupElement.querySelector('.nemo-triggers-container')) return; const form = popupElement.querySelector(SELECTORS.promptEditorForm); const saveButton = popupElement.querySelector(SELECTORS.promptEditorSaveBtn); if (!form || !saveButton) return; const promptId = saveButton.getAttribute('data-pm-prompt'); const promptData = loadPromptTriggers(promptId); const triggerHTML = `<div class="nemo-triggers-container"><label for="nemo_trigger_keys">Contextual Triggers (Keywords/Regex, comma-separated)</label><textarea id="nemo_trigger_keys" class="text_pole" placeholder="e.g., help, /order d+/, /fight scene/i"></textarea><div class="nemo-triggers-settings"><label class="checkbox_label"><input type="checkbox" id="nemo_trigger_case_sensitive"><span>Case-Sensitive</span></label><label class="checkbox_label"><input type="checkbox" id="nemo_trigger_whole_word"><span>Match Whole Words</span></label></div><div class="text_muted">If provided, this prompt will be temporarily activated if it's disabled and triggers are found in chat history.</div></div>`; form.querySelector(SELECTORS.promptEditorContent).parentElement.insertAdjacentHTML('afterend', triggerHTML); const keysInput = form.querySelector('#nemo_trigger_keys'); const caseInput = form.querySelector('#nemo_trigger_case_sensitive'); const wordInput = form.querySelector('#nemo_trigger_whole_word'); if (promptData) { keysInput.value = promptData.keys.join(', '); caseInput.checked = promptData.caseSensitive || false; wordInput.checked = promptData.wholeWord || false; } saveButton.addEventListener('click', () => { savePromptTriggers(promptId, { keys: keysInput.value.split(',').map(k => k.trim()).filter(Boolean), caseSensitive: caseInput.checked, wholeWord: wordInput.checked, }); }, { capture: true }); }
function initContextualTriggers() { let temporarilyActivated = []; const onGenerationStart = () => { const context = getContext(); if (!context.chat) return; const chatHistory = context.chat.slice(-context.depth).map(m => m.mes).join('\n'); temporarilyActivated = []; const disabledPrompts = document.querySelectorAll(`${SELECTORS.promptItemRow}:not(:has(.${SELECTORS.enabledToggleClass}))`); for (const promptRow of disabledPrompts) { const promptId = promptRow.getAttribute('data-pm-identifier'); const triggerData = loadPromptTriggers(promptId); if (!triggerData || !triggerData.keys || !triggerData.keys.length === 0) continue; const isTriggered = triggerData.keys.some(key => replicateMatchKeys(chatHistory, key, { caseSensitive: triggerData.caseSensitive, matchWholeWords: triggerData.wholeWord })); if (isTriggered) { const toggle = promptRow.querySelector(SELECTORS.toggleButton); if (toggle) { toggle.click(); temporarilyActivated.push(toggle); } } } }; const onGenerationEnd = () => { for (const toggle of temporarilyActivated) { if (document.body.contains(toggle)) toggle.click(); } temporarilyActivated = []; }; eventSource.on(event_types.GENERATION_STARTED, onGenerationStart); eventSource.on(event_types.GENERATION_ENDED, onGenerationEnd); eventSource.on(event_types.GENERATION_STOPPED, onGenerationEnd); }


// 6. PRESET NAVIGATOR
class PresetNavigator {
    constructor(apiType) {
        this.apiType = apiType;
        this.modal = document.getElementById('nemo-preset-navigator-modal');
        this.mainView = document.getElementById('navigator-grid-view');
        this.breadcrumbs = document.getElementById('navigator-breadcrumbs');
        this.newFolderBtn = document.getElementById('navigator-new-synthetic-folder-btn');
        this.searchInput = document.getElementById('navigator-search-input');
        this.searchClearBtn = document.getElementById('navigator-search-clear');
        
        // NEW: State for enhanced features
        this.metadata = { folders: {}, presets: {} };
        this.currentPath = [{ id: 'root', name: 'Home' }];
        this.allPresets = [];
        this.selectedPreset = { value: null, filename: null };
        this.bulkSelection = new Set();
        this.lastSelectedItem = null; // For shift-click
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.currentSort = 'name-asc'; // e.g., 'name-desc', 'date-asc', 'date-desc'
        this.currentFilter = 'all'; // 'all', 'uncategorized', 'has-image'

        this.longPressTimer = null;
        this.isDragging = false;
        this.draggedItem = null;
        this.ghostElement = null;
        this.lastDropTarget = null;
        this.gestureHappened = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.DRAG_THRESHOLD = 10;

        this.init();
    }

    init() {
        this.modal.querySelector('#navigator-load-btn').addEventListener('click', () => this.loadSelectedPreset());
        this.newFolderBtn.addEventListener('click', () => this.createNewFolder());
        
        const closeButton = this.modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                const popupBg = document.querySelector('.popup_background');
                if (popupBg) popupBg.click();
            });
        }

        this.searchInput.addEventListener('input', () => this.renderGridView());
        this.searchClearBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.renderGridView();
        });

        this.mainView.addEventListener('click', (e) => this.handleGridClick(e), true);
        this.mainView.addEventListener('dblclick', (e) => this.handleGridDoubleClick(e));
        this.modal.querySelector('#navigator-import-btn').addEventListener('click', () => this.importPreset());

        document.addEventListener('click', () => this.hideContextMenu(), true);
        
        this.modal.querySelector('#navigator-view-toggle-btn').addEventListener('click', () => this.toggleViewMode());
        this.modal.querySelector('#navigator-sort-btn').addEventListener('click', (e) => this.showSortMenu(e));
        this.modal.querySelector('#navigator-filter-btn').addEventListener('click', (e) => this.showFilterMenu(e));
        this.modal.addEventListener('keydown', (e) => this.handleKeyDown(e));


        this.mainView.addEventListener('contextmenu', (e) => this.handleGridContextMenu(e));
        this.mainView.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.mainView.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.mainView.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.mainView.addEventListener('drop', (e) => this.handleDrop(e));

        this.mainView.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.mainView.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.mainView.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        this.mainView.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
    }

    async open() {
        this.loadMetadata();
        this.allPresets = await this.fetchPresetList();
        this.searchInput.value = '';
        this.bulkSelection.clear();
        this.render();
        
        const content = this.modal.querySelector('.modal-content');
        if (!content) return;
        
        callGenericPopup(content, POPUP_TYPE.DISPLAY, null, { wide: true, large: true });
    }

    close() {
        this.selectedPreset = { value: null, filename: null };
        this.mainView.innerHTML = '';
        this.currentPath = [{ id: 'root', name: 'Home' }];
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

        // 1. GATHER ALL ITEMS (folders and presets)
        let items = [];
        // Add folders
        Object.values(this.metadata.folders)
            .filter(folder => folder.parentId === currentFolderId)
            .forEach(folder => items.push({ type: 'folder', data: folder, id: folder.id, name: folder.name }));

        // Add presets
        this.allPresets.forEach(p => {
            const meta = this.metadata.presets[p.name] || {};
            const isUncategorized = !meta.folderId;
            const isInCurrentFolder = meta.folderId === currentFolderId;
            const isInRootAndCurrentIsRoot = isUncategorized && currentFolderId === 'root';

            if (isInCurrentFolder || isInRootAndCurrentIsRoot) {
                items.push({ type: 'preset', data: { ...p, ...meta }, id: p.name, name: p.name });
            }
        });
        
        // 2. FILTER
        items = items.filter(item => {
            // Search filter
            if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) {
                return false;
            }
            // Advanced filter
            if (this.currentFilter === 'uncategorized' && item.type === 'preset' && item.data.folderId) {
                return false;
            }
            if (this.currentFilter === 'has-image' && item.type === 'preset' && !item.data.imageUrl) {
                return false;
            }
            return true;
        });

        // 3. SORT
        items.sort((a, b) => {
            // Always keep folders on top
            if (a.type === 'folder' && b.type === 'preset') return -1;
            if (a.type === 'preset' && b.type === 'folder') return 1;

            const aDate = a.data.lastModified || a.data.createdAt || '1970-01-01';
            const bDate = b.data.lastModified || b.data.createdAt || '1970-01-01';

            switch (this.currentSort) {
                case 'name-desc': return b.name.localeCompare(a.name);
                case 'date-asc': return new Date(aDate) - new Date(bDate);
                case 'date-desc': return new Date(bDate) - new Date(aDate);
                case 'name-asc':
                default:
                    return a.name.localeCompare(b.name);
            }
        });

        // 4. RENDER
        this.mainView.innerHTML = '';
        this.mainView.className = `view-mode-${this.viewMode}`;
        this.mainView.classList.add('fade-in');

        if (items.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'navigator-empty-state';
            emptyEl.innerHTML = searchTerm ? `<h3>No results for "${searchTerm}"</h3>` : `<h3>This folder is empty.</h3><p>Drag presets here to add them.</p>`;
            this.mainView.appendChild(emptyEl);
            return;
        }

        items.forEach(item => {
            const itemEl = (this.viewMode === 'grid') ? this.createGridItem(item) : this.createListItem(item);
            this.mainView.appendChild(itemEl);
        });

        this.updateBulkSelectionVisuals();
    }

    createGridItem(item) {
        const { type, data, id } = item;
        const itemEl = document.createElement('div');
        itemEl.className = `grid-item ${type}`;
        itemEl.dataset.type = type;
        itemEl.dataset.id = id;
        itemEl.draggable = true;

        if (type === 'preset') {
            itemEl.dataset.value = data.value;
        }
        if (data.color) {
            itemEl.style.setProperty('--nemo-folder-color', data.color);
        }

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        if (data.imageUrl) {
            icon.style.backgroundImage = `url('${data.imageUrl}')`;
        } else {
            icon.innerHTML = `<i class="fa-solid ${type === 'folder' ? 'fa-folder' : 'fa-file-lines'}"></i>`;
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = data.name.split('/').pop();
        
        const lastMod = data.lastModified ? new Date(data.lastModified).toLocaleDateString() : 'N/A';
        nameEl.title = `${data.name}\nModified: ${lastMod}`;
        
        itemEl.appendChild(icon);
        itemEl.appendChild(nameEl);

        if (type === 'preset' && this.selectedPreset.filename === id) {
            itemEl.classList.add('selected');
        }

        return itemEl;
    }
    
    createListItem(item) {
        const { type, data, id } = item;
        const itemEl = document.createElement('div');
        itemEl.className = `grid-item list-item ${type}`;
        itemEl.dataset.type = type;
        itemEl.dataset.id = id;
        itemEl.draggable = true;

        if (type === 'preset') {
            itemEl.dataset.value = data.value;
        }
        if (data.color) {
            itemEl.style.setProperty('--nemo-folder-color', data.color);
        }

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        icon.innerHTML = `<i class="fa-solid ${type === 'folder' ? 'fa-folder' : 'fa-file-lines'}"></i>`;
        
        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = data.name.split('/').pop();
        nameEl.title = data.name;

        const dateEl = document.createElement('div');
        dateEl.className = 'item-date';
        dateEl.textContent = data.lastModified ? new Date(data.lastModified).toLocaleDateString() : '—';
        
        itemEl.appendChild(icon);
        itemEl.appendChild(nameEl);
        itemEl.appendChild(dateEl);

        if (type === 'preset' && this.selectedPreset.filename === id) {
            itemEl.classList.add('selected');
        }
        return itemEl;
    }

    async handleGridDoubleClick(e) {
        const item = e.target.closest('.grid-item.preset');
        if (!item) return;
        
        const { id, value } = item.dataset;
        this.mainView.querySelectorAll('.grid-item.selected').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedPreset = { value: value, filename: id };
        this.updateLoadButton();

        await this.loadSelectedPreset();
    }

    handleGridClick(e) {
        if (this.gestureHappened) {
            e.preventDefault(); e.stopPropagation(); this.gestureHappened = false; return;
        }
        const item = e.target.closest('.grid-item');
        if (!item) return;

        const { type, id, value } = item.dataset;
        
        if (e.shiftKey && this.lastSelectedItem) {
            this.handleShiftClick(item);
        } else if (e.ctrlKey || e.metaKey) {
            this.toggleBulkSelection(id);
            this.lastSelectedItem = item;
        } else {
            this.bulkSelection.clear();
            this.updateBulkSelectionVisuals();

            if (type === 'folder') {
                const folder = this.metadata.folders[id];
                if (folder) {
                    this.currentPath.push({ id: folder.id, name: folder.name });
                    this.render();
                }
            } else if (type === 'preset') {
                this.mainView.querySelectorAll('.grid-item.selected').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedPreset = { value: value, filename: id };
                this.lastSelectedItem = item;
            }
        }
        this.updateLoadButton();
    }

    handleGridContextMenu(e) {
        e.preventDefault();
        this.hideContextMenu();
        const item = e.target.closest('.grid-item');
        if (!item) return;

        const { type, id } = item.dataset;
        const isBulk = this.bulkSelection.size > 1 && this.bulkSelection.has(id);
        const menu = document.createElement('ul');
        menu.className = 'nemo-context-menu';

        let itemsHTML = '';
        if (isBulk) {
            const count = this.bulkSelection.size;
            itemsHTML = `
                <li data-action="bulk_move"><i class="fa-solid fa-folder-plus"></i><span>Move ${count} items...</span></li>
                <li data-action="bulk_delete"><i class="fa-solid fa-trash-can"></i><span>Delete ${count} items</span></li>
            `;
        } else if (type === 'folder') {
            itemsHTML = `
                <li data-action="rename_folder" data-id="${id}"><i class="fa-solid fa-i-cursor"></i><span>Rename</span></li>
                <li data-action="set_folder_color" data-id="${id}"><i class="fa-solid fa-palette"></i><span>Set Color</span></li>
                <li data-action="delete_folder" data-id="${id}"><i class="fa-solid fa-trash-can"></i><span>Delete</span></li>
            `;
        } else if (type === 'preset') {
            itemsHTML = `
                <li data-action="set_image" data-id="${id}"><i class="fa-solid fa-image"></i><span>Set Image</span></li>
                <li data-action="add_to_folder" data-id="${id}"><i class="fa-solid fa-folder-plus"></i><span>Move to Folder...</span></li>
                <li data-action="remove_from_folder" data-id="${id}"><i class="fa-solid fa-folder-minus"></i><span>Remove from Folder</span></li>
            `;
        }
        menu.innerHTML = itemsHTML;

        const popupContainer = item.closest('.popup');
        if (!popupContainer) {
            console.error(`${LOG_PREFIX} Could not find popup container for context menu.`);
            return;
        }
        popupContainer.appendChild(menu);
        
        menu.style.visibility = 'hidden';
        menu.style.display = 'block';
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        menu.style.display = 'none';
        menu.style.visibility = 'visible';

        const popupRect = popupContainer.getBoundingClientRect();
        let localX, localY;

        if (window.innerWidth <= 768) {
            let viewportX = e.clientX - (menuWidth / 2);
            const margin = 10;
            if (viewportX < margin) viewportX = margin;
            if (viewportX + menuWidth > window.innerWidth - margin) viewportX = window.innerWidth - menuWidth - margin;
            localX = viewportX - popupRect.left;
        } else {
            localX = e.clientX - popupRect.left;
            if (e.clientX + menuWidth > window.innerWidth) localX = e.clientX - popupRect.left - menuWidth;
        }

        localY = e.clientY - popupRect.top;
        if (e.clientY + menuHeight > window.innerHeight) localY = e.clientY - popupRect.top - menuHeight;

        menu.style.left = `${localX}px`;
        menu.style.top = `${localY}px`;
        menu.style.display = 'block';

        menu.addEventListener('click', (me) => {
            const actionTarget = me.target.closest('li[data-action]');
            if (actionTarget) {
                this.runContextMenuAction(actionTarget.dataset.action, actionTarget.dataset.id);
            }
            this.hideContextMenu();
        });
    }
    
    // MODIFIED: This function is the key to the fix.
    handleTouchStart(e) {
        this.gestureHappened = false;
        const item = e.target.closest('.grid-item');
        if (!item) return;

        // Only initiate drag/long-press logic if the item is ALREADY selected.
        // This prevents interfering with the browser's native scrolling on non-selected items.
        if (item.classList.contains('selected') || item.classList.contains('bulk-selected')) {
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;

            // Set up a long-press for the context menu
            this.longPressTimer = setTimeout(() => {
                this.gestureHappened = true;
                const mockEvent = { clientX: this.touchStartX, clientY: this.touchStartY, preventDefault: () => {}, target: e.target };
                this.handleGridContextMenu(mockEvent);
            }, 500);

            // Set the item as a potential drag target.
            // This will be checked in handleTouchMove to initiate the drag.
            if (item.dataset.type === 'preset' || item.dataset.type === 'folder') {
                this.draggedItem = item;
            }
        }
        // If the item is NOT selected, we do nothing here. The browser will handle
        // the touch as a scroll, and the 'click' event will handle selection on tap.
    }

    handleTouchMove(e) {
        // This check is now the gatekeeper. It will only be true if the touch
        // started on an already-selected item, as per the new handleTouchStart logic.
        if (!this.draggedItem) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > this.DRAG_THRESHOLD) {
            clearTimeout(this.longPressTimer);
            
            if (!this.isDragging) {
                this.isDragging = true;
                this.gestureHappened = true;
                this.ghostElement = this.draggedItem.cloneNode(true);
                this.ghostElement.classList.add('dragging');
                Object.assign(this.ghostElement.style, {
                    position: 'fixed', zIndex: '100000', pointerEvents: 'none',
                    width: `${this.draggedItem.offsetWidth}px`, height: `${this.draggedItem.offsetHeight}px`,
                });
                document.body.appendChild(this.ghostElement);
                this.draggedItem.classList.add('dragging-source');
            }
        }

        if (this.isDragging) {
            // Prevent default scroll behavior ONLY if we are actually dragging.
            e.preventDefault();
            this.ghostElement.style.left = `${touch.clientX - this.ghostElement.offsetWidth / 2}px`;
            this.ghostElement.style.top = `${touch.clientY - this.ghostElement.offsetHeight / 2}px`;

            this.ghostElement.style.display = 'none';
            const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
            this.ghostElement.style.display = '';

            const dropTarget = elementUnder ? elementUnder.closest('.grid-item.folder') : null;

            if (this.lastDropTarget && this.lastDropTarget !== dropTarget) {
                this.lastDropTarget.classList.remove('drag-over');
            }
            if (dropTarget) {
                dropTarget.classList.add('drag-over');
                this.lastDropTarget = dropTarget;
            } else {
                this.lastDropTarget = null;
            }
        }
    }

    handleTouchEnd(e) {
        clearTimeout(this.longPressTimer);

        if (this.isDragging) {
            if (this.lastDropTarget) {
                const draggedId = this.draggedItem.dataset.id;
                const folderId = this.lastDropTarget.dataset.id;
                if (draggedId && folderId) {
                    this.moveItemToFolder(draggedId, folderId);
                }
                this.lastDropTarget.classList.remove('drag-over');
            }
            this.draggedItem.classList.remove('dragging-source');
            if (this.ghostElement) document.body.removeChild(this.ghostElement);
        }

        this.isDragging = false;
        this.draggedItem = null;
        this.ghostElement = null;
        this.lastDropTarget = null;
    }

    handleDragStart(e) {
        this.isDragging = true;
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
            this.lastDropTarget = null;
        }
    }

    handleDragLeave(e) {
        const target = e.target.closest('.grid-item.folder');
        if (target) {
            target.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        if (this.lastDropTarget) {
            this.lastDropTarget.classList.remove('drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            const folderId = this.lastDropTarget.dataset.id;
            
            if (draggedId && folderId) {
                this.moveItemToFolder(draggedId, folderId);
            }
        }
        const draggedId = e.dataTransfer.getData('text/plain');
        const originalItem = this.mainView.querySelector(`.grid-item[data-id="${draggedId}"]`) || document.querySelector(`.grid-item.dragging-source[data-id="${draggedId}"]`);
        if(originalItem) originalItem.classList.remove('dragging-source');

        this.isDragging = false;
        this.lastDropTarget = null;
    }

    async runContextMenuAction(action, id) {
        switch (action) {
            case 'rename_folder': {
                const folder = this.metadata.folders[id];
                if (!folder) return;
                const newName = await callGenericPopup('Enter new folder name:', POPUP_TYPE.INPUT, folder.name);
                if (newName && newName !== folder.name) {
                    folder.name = newName;
                    this.updateMetadataTimestamp(id, 'folder');
                    this.saveMetadata(); this.render();
                }
                break;
            }
            case 'delete_folder': {
                const confirmed = await callGenericPopup(`Delete "${this.metadata.folders[id].name}"? Presets inside will become unassigned.`, POPUP_TYPE.CONFIRM);
                if (confirmed) {
                    Object.values(this.metadata.presets).forEach(p => { if (p.folderId === id) delete p.folderId; });
                    delete this.metadata.folders[id];
                    this.saveMetadata(); this.render();
                }
                break;
            }
            case 'set_image': { this.promptForLocalImage(id); break; }
            case 'set_folder_color': {
                const color = await callGenericPopup('Enter a CSS color for the folder (e.g., #ff5733, red):', POPUP_TYPE.INPUT, this.metadata.folders[id].color || '');
                if (color !== null) {
                    this.metadata.folders[id].color = color;
                    this.updateMetadataTimestamp(id, 'folder');
                    this.saveMetadata(); this.render();
                }
                break;
            }
            case 'add_to_folder': { this.moveItemToFolderDialog([id]); break; }
            case 'remove_from_folder': {
                if (this.metadata.presets[id]?.folderId) {
                    delete this.metadata.presets[id].folderId;
                    this.updateMetadataTimestamp(id, 'preset');
                    this.saveMetadata(); this.render();
                }
                break;
            }
            case 'bulk_move': { this.moveItemToFolderDialog(Array.from(this.bulkSelection)); break; }
            case 'bulk_delete': {
                const confirmed = await callGenericPopup(`Delete ${this.bulkSelection.size} selected items? This cannot be undone.`, POPUP_TYPE.CONFIRM);
                if (confirmed) {
                    this.bulkSelection.forEach(itemId => {
                        if (this.metadata.presets[itemId]) delete this.metadata.presets[itemId];
                        if (this.metadata.folders[itemId]) delete this.metadata.folders[itemId];
                    });
                    this.saveMetadata();
                    this.bulkSelection.clear();
                    this.render();
                }
                break;
            }
        }
    }

    hideContextMenu() {
        document.querySelector('.nemo-context-menu')?.remove();
    }
    
    async createNewFolder() {
        const name = await callGenericPopup('New Folder Name:', POPUP_TYPE.INPUT, 'New Folder');
        if (!name) return;
        const newId = generateUUID();
        const parentId = this.currentPath[this.currentPath.length - 1].id;
        const now = new Date().toISOString();
        this.metadata.folders[newId] = { id: newId, name, parentId, createdAt: now, lastModified: now };
        this.saveMetadata(); this.render();
    }

    promptForLocalImage(presetId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
    
        // Visually hide the input but keep it in the layout for mobile compatibility.
        input.style.position = 'fixed';
        input.style.top = '-1000px';
        input.style.left = '-1000px';
    
        // This function will handle cleaning up the input element.
        const cleanup = () => {
            if (document.body.contains(input)) {
                document.body.removeChild(input);
            }
            window.removeEventListener('focus', cleanup);
        };
    
        // Listen for when a file is selected.
        input.addEventListener('change', () => {
            const file = input.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    this.metadata.presets[presetId] = this.metadata.presets[presetId] || {};
                    this.metadata.presets[presetId].imageUrl = dataUrl;
                    this.updateMetadataTimestamp(presetId, 'preset');
                    this.saveMetadata();
                    this.render();
                };
                reader.readAsDataURL(file);
            }
        });
    
        // Listen for the window to regain focus. This happens when the file
        // picker is closed, either by selection or cancellation. This is a
        // reliable way to trigger the cleanup.
        window.addEventListener('focus', cleanup, { once: true });
    
        // Add the input to the document and trigger the click.
        document.body.appendChild(input);
        input.click();
    }

    async fetchPresetList() {
        if (this.apiType === 'openai' && openai_setting_names) {
            return Object.keys(openai_setting_names).map(name => ({
                name: name,
                value: openai_setting_names[name]
            }));
        }
        
        const select = document.querySelector(`select[data-preset-manager-for="${this.apiType}"]`);
        return select ? Array.from(select.options).map(opt => ({ name: opt.textContent, value: opt.value })).filter(item => item.name && item.value) : [];
    }

    updateLoadButton() {
        const btn = document.querySelector('#navigator-load-btn');
        if (!btn) return; 
        const selectedCount = this.bulkSelection.size;
        
        if (selectedCount > 1) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-ban"></i> ${selectedCount} items selected`;
        } else if (this.selectedPreset.value !== null) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-upload"></i> Load Selected Preset`;
        } else {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-upload"></i> Load Selected Preset`;
        }
    }

    async loadSelectedPreset() {
        if (this.selectedPreset.value === null) return;
        const select = document.querySelector(`select[data-preset-manager-for="${this.apiType}"]`);
        if (select) {
            if (this.apiType === 'openai') {
                select.value = this.selectedPreset.value;
            } else {
                const option = Array.from(select.options).find(opt => opt.textContent === this.selectedPreset.filename);
                if (option) select.value = option.value;
            }
            select.dispatchEvent(new Event('change', { bubbles: true }));

            await delay(50);

            const closeButton = document.querySelector('.popup-button-close');
            if (closeButton) {
                closeButton.click();
            }
        } else {
            callGenericPopup(`Could not find the preset dropdown for "${this.apiType}".`, 'error');
        }
    }

    loadMetadata() {
        try {
            const stored = localStorage.getItem(NEMO_METADATA_KEY);
            if (stored) {
                this.metadata = JSON.parse(stored);
                this.metadata.folders = this.metadata.folders || {};
                this.metadata.presets = this.metadata.presets || {};
            }
        } catch (ex) {
            console.error(`${LOG_PREFIX} Failed to load navigator metadata.`, ex);
            this.metadata = { folders: {}, presets: {} };
        }
    }

    saveMetadata() {
        localStorage.setItem(NEMO_METADATA_KEY, JSON.stringify(this.metadata));
    }
    
    updateMetadataTimestamp(id, type) {
        const item = (type === 'folder') ? this.metadata.folders[id] : this.metadata.presets[id];
        if (item) {
            item.lastModified = new Date().toISOString();
        }
    }

    async moveItemToFolder(itemId, folderId) {
        const itemType = this.metadata.folders[itemId] ? 'folder' : 'preset';
        if (itemType === 'folder') {
            this.metadata.folders[itemId].parentId = folderId;
        } else {
            this.metadata.presets[itemId] = this.metadata.presets[itemId] || {};
            this.metadata.presets[itemId].folderId = folderId;
        }
        this.updateMetadataTimestamp(itemId, itemType);
        this.saveMetadata();
        this.render();
    }
    
    async moveItemToFolderDialog(itemIds) {
        const folderNames = Object.values(this.metadata.folders).map(f => f.name).join(', ');
        if (!folderNames) {
            callGenericPopup("No folders created yet. Create a folder first.", "info");
            return;
        }
        const targetName = await callGenericPopup(`Enter folder name to move to:\n(${folderNames})`, POPUP_TYPE.INPUT);
        const targetFolder = Object.values(this.metadata.folders).find(f => f.name.toLowerCase() === targetName?.toLowerCase());
        if (targetFolder) {
            itemIds.forEach(id => {
                const isFolder = !!this.metadata.folders[id];
                if (isFolder) {
                    this.metadata.folders[id].parentId = targetFolder.id;
                    this.updateMetadataTimestamp(id, 'folder');
                } else {
                    this.metadata.presets[id] = this.metadata.presets[id] || {};
                    this.metadata.presets[id].folderId = targetFolder.id;
                    this.updateMetadataTimestamp(id, 'preset');
                }
            });
            this.saveMetadata();
            this.render();
        } else if (targetName) {
            callGenericPopup(`Folder "${targetName}" not found.`, "error");
        }
    }
    
    toggleBulkSelection(id) {
        if (this.bulkSelection.has(id)) {
            this.bulkSelection.delete(id);
        } else {
            this.bulkSelection.add(id);
        }
        this.updateBulkSelectionVisuals();
    }
    
    handleShiftClick(clickedItem) {
        const allVisibleItems = Array.from(this.mainView.querySelectorAll('.grid-item'));
        const startIndex = allVisibleItems.indexOf(this.lastSelectedItem);
        const endIndex = allVisibleItems.indexOf(clickedItem);
        if (startIndex === -1 || endIndex === -1) return;

        const [start, end] = [startIndex, endIndex].sort((a,b) => a - b);
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

    handleKeyDown(e) {
        if (e.key === ' ' && this.selectedPreset.filename && !e.target.matches('input, textarea')) {
            e.preventDefault();
            const presetData = this.allPresets.find(p => p.name === this.selectedPreset.filename);
            if (presetData) {
                const presetContent = oai_settings[presetData.value];
                const content = presetContent ? JSON.stringify(presetContent, null, 2) : 'Could not load preset content.';
                callGenericPopup(`<pre>${content.replace(/</g, "<")}</pre>`, POPUP_TYPE.DISPLAY, `Quick Look: ${presetData.name}`, { wide: true });
            }
        }
    }
    
    toggleViewMode() {
        this.viewMode = (this.viewMode === 'grid') ? 'list' : 'grid';
        this.render();
    }
    
    updateHeaderControls() {
        const viewBtn = this.modal.querySelector('#navigator-view-toggle-btn i');
        viewBtn.className = `fa-solid ${this.viewMode === 'grid' ? 'fa-list' : 'fa-grip'}`;
        viewBtn.parentElement.title = `Switch to ${this.viewMode === 'grid' ? 'List' : 'Grid'} View`;
    }

    showSortMenu(e) {
        this.hideContextMenu();
        const options = {
            'name-asc': 'Name (A-Z)', 'name-desc': 'Name (Z-A)',
            'date-desc': 'Date Modified (Newest)', 'date-asc': 'Date Modified (Oldest)'
        };
        const menu = document.createElement('ul');
        menu.className = 'nemo-context-menu';
        menu.innerHTML = Object.entries(options).map(([key, value]) => 
            `<li data-action="sort" data-value="${key}" class="${this.currentSort === key ? 'active' : ''}">${value}</li>`
        ).join('');
        
        this.showMiniMenu(e.currentTarget, menu);
        menu.addEventListener('click', (me) => {
            const li = me.target.closest('li[data-action="sort"]');
            if (li) {
                this.currentSort = li.dataset.value;
                this.render();
            }
            this.hideContextMenu();
        });
    }
    
    showFilterMenu(e) {
        this.hideContextMenu();
        const options = { 'all': 'All Items', 'uncategorized': 'Uncategorized', 'has-image': 'With Images' };
        const menu = document.createElement('ul');
        menu.className = 'nemo-context-menu';
        menu.innerHTML = Object.entries(options).map(([key, value]) => 
            `<li data-action="filter" data-value="${key}" class="${this.currentFilter === key ? 'active' : ''}">${value}</li>`
        ).join('');
        
        this.showMiniMenu(e.currentTarget, menu);
        menu.addEventListener('click', (me) => {
            const li = me.target.closest('li[data-action="filter"]');
            if (li) {
                this.currentFilter = li.dataset.value;
                this.render();
            }
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

    async importPreset() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.settings';
        input.style.display = 'none';

        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) {
                document.body.removeChild(input);
                return;
            }

            const fileName = file.name.replace(/\.[^/.]+$/, "");
            const fileContent = await file.text();
            
            try {
                const presetBody = JSON.parse(fileContent);

                if (typeof presetBody.temp !== 'number' && typeof presetBody.temperature !== 'number') {
                    throw new Error("This does not appear to be a valid SillyTavern preset file.");
                }

                if (Object.keys(openai_setting_names).includes(fileName)) {
                    const confirm = await callGenericPopup(`Preset "${fileName}" already exists. Overwrite?`, POPUP_TYPE.CONFIRM);
                    if (!confirm) {
                        document.body.removeChild(input);
                        return;
                    }
                }

                const saveResponse = await fetch(`/api/presets/save-openai?name=${encodeURIComponent(fileName)}`, {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify(presetBody),
                });

                if (!saveResponse.ok) {
                    throw new Error(`Server failed to save preset: ${await saveResponse.text()}`);
                }
                
                const responseData = await saveResponse.json();
                const { name: newName, key: newKey } = responseData;

                if (!newName || !newKey) {
                    throw new Error("Server response did not include new preset details.");
                }
                
                // Update client-side state without reloading
                openai_setting_names[newName] = newKey;
                oai_settings[newKey] = presetBody;

                const select = document.querySelector(`select[data-preset-manager-for="${this.apiType}"]`);
                if (select) {
                    const newOption = new Option(newName, newKey);
                    select.appendChild(newOption);
                }

                await callGenericPopup(`Preset "${fileName}" imported successfully.`, 'success');

                // Refresh the navigator view
                this.allPresets = await this.fetchPresetList();
                this.render();

            } catch (ex) {
                console.error(`${LOG_PREFIX} Error importing preset:`, ex);
                callGenericPopup(`Error importing preset: ${ex.message}`, 'error');
            } finally {
                if (document.body.contains(input)) {
                    document.body.removeChild(input);
                }
            }
        };

        document.body.appendChild(input);
        input.click();
    }

    exportMetadata() {
        const dataStr = JSON.stringify(this.metadata, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sillytavern_navigator_backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    importMetadata() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json'; input.style.display = 'none';
        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (file) {
                try {
                    const text = await file.text();
                    const importedData = JSON.parse(text);
                    if (importedData.folders && importedData.presets) {
                        const confirmed = await callGenericPopup('Replace current navigator data with the imported file? This cannot be undone.', POPUP_TYPE.CONFIRM);
                        if (confirmed) {
                            this.metadata = importedData;
                            this.saveMetadata();
                            this.render();
                        }
                    } else {
                        callGenericPopup('Invalid metadata file.', 'error');
                    }
                } catch (ex) {
                    callGenericPopup('Failed to read or parse the file.', 'error');
                }
            }
            document.body.removeChild(input);
        });
        document.body.appendChild(input); input.click();
    }
}

function injectNavigatorModal() {
    if (document.getElementById('nemo-preset-navigator-modal')) return;
    // MODIFIED: Removed the export button from the modal footer HTML
    const modalHTML = `
    <div id="nemo-preset-navigator-modal" class="nemo-preset-navigator-modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Preset Navigator</h2>
                <span class="close-button">×</span>
            </div>
            <div class="navigator-body">
                <div class="navigator-main-panel">
                    <div id="navigator-grid-header">
                        <div id="navigator-breadcrumbs"></div>
                        <div id="navigator-header-controls">
                            <div id="navigator-search-controls">
                                <input type="search" id="navigator-search-input" class="text_pole" placeholder="Search...">
                                <button id="navigator-search-clear" title="Clear Search" class="menu_button"><i class="fa-solid fa-times"></i></button>
                            </div>
                            <div class="nemo-header-buttons">
                                <button id="navigator-filter-btn" class="menu_button" title="Filter"><i class="fa-solid fa-filter"></i></button>
                                <button id="navigator-sort-btn" class="menu_button" title="Sort"><i class="fa-solid fa-arrow-up-z-a"></i></button>
                                <button id="navigator-view-toggle-btn" class="menu_button" title="Switch View"><i class="fa-solid fa-list"></i></button>
                                <button id="navigator-new-synthetic-folder-btn" class="menu_button" title="New Folder"><i class="fa-solid fa-folder-plus"></i></button>
                            </div>
                        </div>
                    </div>
                    <div id="navigator-grid-view"></div>
                </div>
            </div>
            <div class="modal-footer">
                <div class="action-controls">
                    <button id="navigator-import-btn" class="menu_button" title="Import preset from file"><i class="fa-solid fa-file-import"></i></button>
                </div>
                <div class="action-controls">
                    <button id="navigator-load-btn" class="menu_button" disabled><i class="fa-solid fa-upload"></i> Load Selected Preset</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    if (!document.querySelector('.nemo-loading-overlay')) {
        document.body.insertAdjacentHTML('beforeend', '<div class="nemo-loading-overlay"><div class="nemo-spinner"></div></div>');
    }
}

function initPresetNavigatorForApi(apiType) {
    const selector = `select[data-preset-manager-for="${apiType}"]`;
    const originalSelect = document.querySelector(selector);
    if (!originalSelect || originalSelect.dataset.nemoPatched) return;

    originalSelect.dataset.nemoPatched = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'nemo-preset-selector-wrapper';

    const browseButton = document.createElement('button');
    browseButton.textContent = 'Browse...';
    browseButton.className = 'menu_button interactable';
    
    browseButton.addEventListener('click', (event) => {
        document.getElementById('nemo-preset-navigator-modal')?.remove();
        injectNavigatorModal();
        const navigator = new PresetNavigator(apiType);
        navigator.open();
    });

    originalSelect.parentElement.insertBefore(wrapper, originalSelect);
    wrapper.appendChild(originalSelect);
    wrapper.appendChild(browseButton);
}


// 7. INITIALIZATION
async function initializeNemoSettingsUI() {
    const pollForSettings = setInterval(async () => {
        const container = document.getElementById('extensions_settings');
        if (container && !document.querySelector('.nemo-preset-enhancer-settings')) {
            clearInterval(pollForSettings);
            ensureSettingsNamespace();
            const response = await fetch(`scripts/extensions/third-party/${NEMO_EXTENSION_NAME}/settings.html`);
            if (!response.ok) { console.error(`${LOG_PREFIX} Failed to fetch settings.html`); return; }
            container.insertAdjacentHTML('beforeend', await response.text());
            const regexInput = document.getElementById('nemoDividerRegexPattern');
            const saveButton = document.getElementById('nemoSaveRegexSettings');
            const statusDiv = document.getElementById('nemoRegexStatus');
            regexInput.value = extension_settings[NEMO_EXTENSION_NAME]?.dividerRegexPattern || NEMO_DEFAULT_REGEX_PATTERN;
            saveButton.addEventListener('click', async () => {
                const pattern = regexInput.value.trim() || NEMO_DEFAULT_REGEX_PATTERN;
                try {
                    new RegExp(`^(${pattern})`);
                    extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern = pattern;
                    saveSettingsDebounced();
                    await loadAndSetDividerRegex();
                    await organizePrompts();
                    statusDiv.textContent = 'Pattern saved!'; statusDiv.style.color = 'lightgreen';
                } catch(e) {
                    statusDiv.textContent = 'Invalid Regex!'; statusDiv.style.color = 'red';
                }
                setTimeout(() => statusDiv.textContent = '', 4000);
            });
        }
    }, 500);
}

$(document).ready(() => {
    setTimeout(async function() {
        try {
            console.log(`${LOG_PREFIX} Initializing...`);
            ensureSettingsNamespace();
            
            await loadAndSetDividerRegex();
            initContextualTriggers();
            injectNavigatorModal();

            const observer = new MutationObserver((mutations) => {
                const promptList = document.querySelector(SELECTORS.promptsContainer);
                if (promptList && !promptList.dataset.nemoPromptsInitialized) {
                    initializeSearchAndSections(promptList);
                }
                
                const apis = ['openai', 'novel', 'kobold', 'textgenerationwebui'];
                apis.forEach(api => {
                    const select = document.querySelector(`select[data-preset-manager-for="${api}"]`);
                    if (select && !select.dataset.nemoPatched) {
                        initPresetNavigatorForApi(api);
                    }
                });

                for (const mutation of mutations) {
                    const popup = document.querySelector(`${SELECTORS.promptEditorPopup}:not([data-nemo-trigger-ui-injected])`);
                    if (popup) {
                        injectTriggerUI(popup);
                        popup.dataset.nemoTriggerUiInjected = 'true';
                    }
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });
            await initializeNemoSettingsUI();
            console.log(`${LOG_PREFIX} Initialization complete.`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Critical failure during initialization:`, error);
        }
    }, 1000); 
});
