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
    const enabledToggles = document.querySelectorAll(`${SELECTORS.promptsContainer} ${SELECTORS.toggleButton}.${SELECTORS.enabledToggleClass}`);
    const activeIdentifiers = new Set();
    enabledToggles.forEach(toggle => {
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
    const countSpan = sectionElement.querySelector('summary .nemo-enabled-count');
    if (!countSpan) return;
    const enabledCount = sectionElement.querySelectorAll(`.nemo-section-content ${SELECTORS.toggleButton}.${SELECTORS.enabledToggleClass}`).length;
    const totalCount = sectionElement.querySelectorAll('.nemo-section-content .prompt-manager-toggle-action').length;
    countSpan.textContent = ` (${enabledCount}/${totalCount})`;
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
        const summary = section.querySelector('summary');
        const content = section.querySelector('.nemo-section-content');
        if (content) { while (content.firstChild) { section.parentNode.insertBefore(content.firstChild, section); } }
        if (summary) { const summaryLi = summary.querySelector('summary > li'); if (summaryLi) { summaryLi.querySelector('.nemo-enabled-count')?.remove(); section.parentNode.insertBefore(summaryLi, section); } }
        section.remove();
    });

    const allItems = Array.from(promptsContainer.children);
    promptsContainer.innerHTML = '';
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
            const details = document.createElement('details'); details.className = 'nemo-engine-section'; details.open = openSectionStates[dividerInfo.originalText] || false;
            const summary = document.createElement('summary'); 
            item.querySelector('span.completion_prompt_manager_prompt_name').insertAdjacentHTML('beforeend', '<span class="nemo-enabled-count"></span>'); 

            const masterToggleButton = document.createElement('button');
            masterToggleButton.className = 'menu_button nemo-section-master-toggle';
            masterToggleButton.title = 'Toggle all in section';
            masterToggleButton.innerHTML = '<i class="fa-solid fa-power-off"></i>';
            item.querySelector('.nemo-right-controls-wrapper').prepend(masterToggleButton);

            summary.appendChild(item); 
            details.appendChild(summary);
            const contentDiv = document.createElement('div'); contentDiv.className = 'nemo-section-content'; details.appendChild(contentDiv);
            promptsContainer.appendChild(details);
            currentSectionContent = contentDiv;
        } else { (currentSectionContent || promptsContainer).appendChild(item); }
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
            if (summaryLi) { const dividerInfo = getDividerInfo(summaryLi); section.open = openSectionStates[dividerInfo.originalText] || false; }
        });
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
            const details = event.target.closest('details'); const li = details.querySelector('summary > li'); const dividerInfo = getDividerInfo(li);
            setTimeout(() => { openSectionStates[dividerInfo.originalText] = details.open; }, 0);
        } else if (event.target.closest(SELECTORS.toggleButton)) {
            setTimeout(() => updateSectionCount(event.target.closest('details.nemo-engine-section')), 100);
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
        
        this.metadata = { folders: {}, presets: {} };
        this.currentPath = [{ id: 'root', name: 'Home' }];
        this.allPresets = [];
        this.selectedPreset = { value: null, filename: null };

        this.init();
    }

    init() {
        this.modal.querySelector('.close-button').addEventListener('click', () => this.close());
        this.modal.querySelector('#navigator-load-btn').addEventListener('click', () => this.loadSelectedPreset());
        this.newFolderBtn.addEventListener('click', () => this.createNewFolder());
        
        // Search listeners
        this.searchInput.addEventListener('input', () => this.renderGridView());
        this.searchClearBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.renderGridView();
        });

        // Event delegation for the grid view
        this.mainView.addEventListener('click', (e) => this.handleGridClick(e));
        this.mainView.addEventListener('contextmenu', (e) => this.handleGridContextMenu(e));
        this.mainView.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.mainView.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.mainView.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.mainView.addEventListener('drop', (e) => this.handleDrop(e));

        document.addEventListener('click', () => this.hideContextMenu(), true);
    }

    async open() {
        this.loadMetadata();
        this.allPresets = await this.fetchPresetList();
        this.searchInput.value = '';
        this.modal.style.display = 'block';
        this.render();
    }

    close() {
        this.modal.style.display = 'none';
        this.selectedPreset = { value: null, filename: null };
        this.mainView.innerHTML = '';
        this.currentPath = [{ id: 'root', name: 'Home' }];
    }

    render() {
        this.renderBreadcrumbs();
        this.renderGridView();
        this.updateLoadButton();
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
        this.mainView.innerHTML = '';
        const currentFolderId = this.currentPath[this.currentPath.length - 1].id;
        const searchTerm = this.searchInput.value.toLowerCase().trim();

        // Filter and Render Sub-folders
        Object.values(this.metadata.folders)
            .filter(folder => folder.parentId === currentFolderId && folder.name.toLowerCase().includes(searchTerm))
            .sort((a,b) => a.name.localeCompare(b.name))
            .forEach(folder => {
                const item = this.createGridItem(folder.name, 'folder', folder.id);
                this.mainView.appendChild(item);
            });

        // Get presets assigned to this folder
        const presetsInThisFolder = new Set();
        Object.entries(this.metadata.presets).forEach(([filename, data]) => {
            if (data.folderId === currentFolderId) {
                presetsInThisFolder.add(filename);
            }
        });

        // Filter and Render assigned presets
        this.allPresets
            .filter(p => presetsInThisFolder.has(p.name) && p.name.toLowerCase().includes(searchTerm))
            .sort((a,b) => a.name.localeCompare(b.name))
            .forEach(p => {
                const presetMeta = this.metadata.presets[p.name] || {};
                const item = this.createGridItem(p.name, 'preset', p.name, p.value, presetMeta.imageUrl);
                this.mainView.appendChild(item);
            });
        
        // In root, also filter and render unassigned presets
        if (currentFolderId === 'root') {
             this.allPresets
                .filter(p => !this.metadata.presets[p.name]?.folderId && p.name.toLowerCase().includes(searchTerm))
                .sort((a,b) => a.name.localeCompare(b.name))
                .forEach(p => {
                    const item = this.createGridItem(p.name, 'preset', p.name, p.value);
                    this.mainView.appendChild(item);
                });
        }
    }

    createGridItem(name, type, id, value = '', imageUrl = '') {
        const item = document.createElement('div');
        item.className = `grid-item ${type}`;
        item.dataset.type = type;
        item.dataset.id = id;
        item.draggable = (type === 'preset');

        if (type === 'preset') {
            item.dataset.value = value;
        }

        const icon = document.createElement('div');
        icon.className = 'item-icon';
        if (imageUrl) {
            icon.style.backgroundImage = `url('${imageUrl}')`;
        } else {
            icon.innerHTML = `<i class="fa-solid ${type === 'folder' ? 'fa-folder' : 'fa-file-lines'}"></i>`;
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'item-name';
        nameEl.textContent = name.split('/').pop();
        nameEl.title = name;
        
        item.appendChild(icon);
        item.appendChild(nameEl);

        if (type === 'preset' && this.selectedPreset.filename === id) {
            item.classList.add('selected');
        }

        return item;
    }

    // --- Event Handlers ---
    handleGridClick(e) {
        const item = e.target.closest('.grid-item');
        if (!item) return;

        const { type, id, value } = item.dataset;

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
            this.updateLoadButton();
        }
    }

    handleGridContextMenu(e) {
        e.preventDefault();
        this.hideContextMenu();
        const item = e.target.closest('.grid-item');
        if (!item) return;

        const { type, id } = item.dataset;
        const menu = document.createElement('ul');
        menu.className = 'nemo-context-menu';

        let itemsHTML = '';
        if (type === 'folder') {
            itemsHTML = `
                <li data-action="rename_folder" data-id="${id}"><i class="fa-solid fa-i-cursor"></i> Rename</li>
                <li data-action="delete_folder" data-id="${id}"><i class="fa-solid fa-trash-can"></i> Delete</li>
            `;
        } else if (type === 'preset') {
            itemsHTML = `
                <li data-action="set_image" data-id="${id}"><i class="fa-solid fa-image"></i> Set Image</li>
                <li data-action="add_to_folder" data-id="${id}"><i class="fa-solid fa-folder-plus"></i> Add to Folder...</li>
                <li data-action="remove_from_folder" data-id="${id}"><i class="fa-solid fa-folder-minus"></i> Remove from current Folder</li>
            `;
        }
        menu.innerHTML = itemsHTML;
        document.body.appendChild(menu);

        menu.style.display = 'block';
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;

        menu.addEventListener('click', (me) => {
            const actionTarget = me.target.closest('li[data-action]');
            if (actionTarget) {
                this.runContextMenuAction(actionTarget.dataset.action, actionTarget.dataset.id);
            }
            this.hideContextMenu();
        });
    }

    async runContextMenuAction(action, id) {
        switch (action) {
            case 'rename_folder': {
                const folder = this.metadata.folders[id];
                if (!folder) return;
                const newName = await callGenericPopup('Enter new folder name:', POPUP_TYPE.INPUT, folder.name);
                if (newName && newName !== folder.name) {
                    folder.name = newName;
                    this.saveMetadata();
                    this.render();
                }
                break;
            }
            case 'delete_folder': {
                const confirmed = await callGenericPopup(`Delete "${this.metadata.folders[id].name}"? Presets inside will become unassigned.`, POPUP_TYPE.CONFIRM);
                if (confirmed) {
                    Object.values(this.metadata.presets).forEach(p => {
                        if (p.folderId === id) delete p.folderId;
                    });
                    delete this.metadata.folders[id];
                    this.saveMetadata();
                    this.render();
                }
                break;
            }
            case 'set_image': {
                this.promptForLocalImage(id);
                break;
            }
            case 'add_to_folder': {
                const folderNames = Object.values(this.metadata.folders).map(f => f.name).join(', ');
                if (!folderNames) {
                    callGenericPopup("No folders created yet. Create a folder first.", "info");
                    return;
                }
                const targetName = await callGenericPopup(`Enter folder name to add to:\n(${folderNames})`, POPUP_TYPE.INPUT);
                const targetFolder = Object.values(this.metadata.folders).find(f => f.name.toLowerCase() === targetName?.toLowerCase());
                if (targetFolder) {
                    this.metadata.presets[id] = this.metadata.presets[id] || {};
                    this.metadata.presets[id].folderId = targetFolder.id;
                    this.saveMetadata();
                    this.render();
                } else if(targetName) {
                    callGenericPopup(`Folder "${targetName}" not found.`, "error");
                }
                break;
            }
            case 'remove_from_folder': {
                if (this.metadata.presets[id]?.folderId) {
                    delete this.metadata.presets[id].folderId;
                    this.saveMetadata();
                    this.render();
                }
                break;
            }
        }
    }

    hideContextMenu() {
        document.querySelector('.nemo-context-menu')?.remove();
    }

    // --- Drag and Drop Handlers ---
    handleDragStart(e) {
        const item = e.target.closest('.grid-item.preset');
        if (!item) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', item.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        const target = e.target.closest('.grid-item.folder');
        if (target) {
            target.classList.add('drag-over');
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

    handleDrop(e) {
        e.preventDefault();
        const folderItem = e.target.closest('.grid-item.folder');
        if (folderItem) {
            folderItem.classList.remove('drag-over');
            const presetId = e.dataTransfer.getData('text/plain');
            const folderId = folderItem.dataset.id;
            
            if (presetId && folderId) {
                this.metadata.presets[presetId] = this.metadata.presets[presetId] || {};
                this.metadata.presets[presetId].folderId = folderId;
                this.saveMetadata();
                this.render();
            }
        }
        const draggingEl = this.mainView.querySelector('.dragging');
        if (draggingEl) draggingEl.classList.remove('dragging');
    }
    
    // --- Other logic ---
    async createNewFolder() {
        const name = await callGenericPopup('New Folder Name:', POPUP_TYPE.INPUT, 'New Folder');
        if (!name) return;
        const newId = generateUUID();
        const parentId = this.currentPath[this.currentPath.length - 1].id;
        this.metadata.folders[newId] = { id: newId, name, parentId };
        this.saveMetadata();
        this.render();
    }

    promptForLocalImage(presetId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';

        input.addEventListener('change', () => {
            const file = input.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    this.metadata.presets[presetId] = this.metadata.presets[presetId] || {};
                    this.metadata.presets[presetId].imageUrl = dataUrl;
                    this.saveMetadata();
                    this.render();
                };
                reader.readAsDataURL(file);
            }
            document.body.removeChild(input);
        });

        document.body.appendChild(input);
        input.click();
    }

    async fetchPresetList() {
        let select;
        if (this.apiType === 'prompt') {
            select = document.querySelector(SELECTORS.promptPresetSelect);
        } else {
            select = document.querySelector(`select[data-preset-manager-for="${this.apiType}"]`);
        }
        return select ? Array.from(select.options).map(opt => ({ name: opt.textContent, value: opt.value })).filter(item => item.name && item.value) : [];
    }

    updateLoadButton() {
        const btn = this.modal.querySelector('#navigator-load-btn');
        btn.disabled = !this.selectedPreset.value;
    }

    async loadSelectedPreset() {
        if (!this.selectedPreset.value) return;
        
        const select = (this.apiType === 'prompt')
            ? document.querySelector(SELECTORS.promptPresetSelect)
            : document.querySelector(`select[data-preset-manager-for="${this.apiType}"]`);
        
        if (select) {
            select.value = this.selectedPreset.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            this.close();
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
}

function injectNavigatorModal() {
    if (document.getElementById('nemo-preset-navigator-modal')) return;
    const modalHTML = `
    <div id="nemo-preset-navigator-modal" class="nemo-preset-navigator-modal">
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
                            <button id="navigator-new-synthetic-folder-btn" class="menu_button" title="New Folder"><i class="fa-solid fa-folder-plus"></i> New Folder</button>
                        </div>
                    </div>
                    <div id="navigator-grid-view"></div>
                </div>
            </div>
            <div class="modal-footer">
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
    browseButton.className = 'menu_button';
    browseButton.addEventListener('click', () => {
        const navigator = new PresetNavigator(apiType);
        navigator.open();
    });

    originalSelect.parentElement.insertBefore(wrapper, originalSelect);
    wrapper.appendChild(originalSelect);
    wrapper.appendChild(browseButton);
}

function initPromptManagerNavigator() {
    const header = document.querySelector(SELECTORS.promptManagerHeader);
    if (header && !header.querySelector('#nemo-browse-prompts-btn')) {
        const browseButton = document.createElement('button');
        browseButton.id = 'nemo-browse-prompts-btn';
        browseButton.className = 'menu_button';
        browseButton.innerHTML = '<i class="fa-solid fa-folder-open"></i> Browse Prompts...';
        browseButton.addEventListener('click', () => {
            const navigator = new PresetNavigator('prompt');
            navigator.open();
        });
        header.appendChild(browseButton);
    }
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

// Use the delayed initialization pattern to ensure all core scripts are loaded.
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
                
                initPromptManagerNavigator();

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
