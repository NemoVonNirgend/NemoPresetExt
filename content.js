// Import necessary SillyTavern objects/functions
import {
    extension_settings,
} from '../../../extensions.js';

import {
    saveSettingsDebounced,
} from '../../../../script.js';

// 1. CONFIGURATION
// -----------------------------------------------------------------------------
const NEMO_EXTENSION_NAME = "NemoPresetExt"; // Should match "display_name" in manifest.json
const NEMO_DEFAULT_REGEX_PATTERN = '=+';      // Default regex for identifying divider prompts
let DIVIDER_PREFIX_REGEX = new RegExp(`^(${NEMO_DEFAULT_REGEX_PATTERN})`); // Compiled regex

// DOM Selectors
const PROMPTS_CONTAINER_SELECTOR = '#completion_prompt_manager_list';
const PROMPT_ITEM_ROW_SELECTOR = 'li.completion_prompt_manager_prompt';
const PROMPT_NAME_SELECTOR_IN_ITEM = 'span.completion_prompt_manager_prompt_name a.prompt-manager-inspect-action';
const INTERACTIVE_ELEMENTS_INSIDE_ROW = [ // Elements within a summary that should not toggle section
    'a.prompt-manager-inspect-action',
    '.prompt-manager-detach-action',
    '.prompt-manager-edit-action',
    '.prompt-manager-toggle-action',
].join(', ');

// UI Behavior Configuration
const MIN_OVERLAY_DISPLAY_TIME_MS = 400; // Prevents loading overlay flicker
const ST_TOGGLE_ENABLED_CLASS = 'fa-toggle-on'; // SillyTavern's class for an enabled toggle
const ST_TOGGLE_ICON_SELECTOR = '.prompt-manager-toggle-action';

// State Variables
let openSectionStates = {};         // Stores open/closed state of <details> sections
let overlayElement = null;          // Loading overlay DOM element
let settingsUiInitialized = false;  // Prevents multiple settings UI initializations
let mainFeatureInitialized = false; // Prevents multiple main feature initializations
let searchUiInitialized = false;    // Prevents multiple search UI initializations

const LOG_PREFIX = `[${NEMO_EXTENSION_NAME}]`;

/**
 * Ensures the settings namespace for this extension exists.
 */
function ensureSettingsNamespace() {
    if (!extension_settings) {
        console.error(`${LOG_PREFIX} CRITICAL: extension_settings object not available!`);
        return false;
    }
    extension_settings[NEMO_EXTENSION_NAME] = extension_settings[NEMO_EXTENSION_NAME] || {};
    return true;
}

// 2. HELPER FUNCTIONS (Collapsible Sections & UI Enhancements)
// -----------------------------------------------------------------------------

/**
 * Loads the divider regex pattern from settings or uses the default.
 */
async function loadAndSetDividerRegex() {
    let patternString = NEMO_DEFAULT_REGEX_PATTERN;
    if (ensureSettingsNamespace()) {
        const savedPattern = extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern;
        if (savedPattern !== undefined && savedPattern !== null && String(savedPattern).trim() !== '') {
            patternString = String(savedPattern).trim();
        } else {
            // Initialize with default if no pattern is saved or it's empty
            extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern = NEMO_DEFAULT_REGEX_PATTERN;
        }
    }
    try {
        DIVIDER_PREFIX_REGEX = new RegExp(`^(${patternString})`);
    } catch (e) {
        console.error(`${LOG_PREFIX} Invalid regex pattern "${patternString}". Falling back to default. Error: ${e.message}`);
        DIVIDER_PREFIX_REGEX = new RegExp(`^(${NEMO_DEFAULT_REGEX_PATTERN})`);
        if (ensureSettingsNamespace()) { // Reset invalid pattern in settings
            extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern = NEMO_DEFAULT_REGEX_PATTERN;
        }
    }
}

/**
 * Analyzes a prompt <li> to determine if it's a divider and extracts its name.
 */
function getDividerInfo(promptElement) {
    const promptNameElement = promptElement.querySelector(PROMPT_NAME_SELECTOR_IN_ITEM);
    if (promptNameElement) {
        const promptName = promptNameElement.textContent.trim();
        if (DIVIDER_PREFIX_REGEX.test(promptName)) {
            const match = promptName.match(DIVIDER_PREFIX_REGEX);
            let cleanName = promptName.substring(match[0].length).trim();
            // Attempt to remove a similar suffix (e.g., "=== Section Name ===" -> "Section Name")
            const suffixRegex = new RegExp(`\\s*(${match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|=+)\\s*$`);
            cleanName = cleanName.replace(suffixRegex, '').trim();
            return { isDivider: true, name: cleanName || "Section", originalText: promptName, identifier: promptName };
        }
    }
    return { isDivider: false };
}

function getOrCreateLoadingOverlay(container) {
    if (!overlayElement) {
        overlayElement = document.createElement('div');
        overlayElement.className = 'nemo-loading-overlay';
        const spinner = document.createElement('div');
        spinner.className = 'nemo-spinner';
        overlayElement.appendChild(spinner);
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative'; // Overlay needs positioned parent
        }
        container.appendChild(overlayElement);
    }
    return overlayElement;
}

function showLoadingOverlay(container) {
    const overlay = getOrCreateLoadingOverlay(container);
    requestAnimationFrame(() => overlay.classList.add('nemo-visible'));
}

function hideLoadingOverlay() {
    if (overlayElement) overlayElement.classList.remove('nemo-visible');
}

/**
 * Standardizes the structure of right-side controls (ST buttons, token count) within a prompt item.
 */
function ensureRightControlsStructure(liElement) {
    if (!liElement || !liElement.matches(PROMPT_ITEM_ROW_SELECTOR)) { return null; }
    let rightSideWrapper = liElement.querySelector(':scope > .nemo-right-controls-wrapper');
    if (!rightSideWrapper) {
        rightSideWrapper = document.createElement('span');
        rightSideWrapper.classList.add('nemo-right-controls-wrapper');
        liElement.appendChild(rightSideWrapper);
        // Identify and move ST's controls and token count into this wrapper
        const nameSpan = liElement.querySelector(':scope > span.completion_prompt_manager_prompt_name');
        let stControlsOuterOriginalSpan = null;
        let stTokensSpan = null;
        Array.from(liElement.children).forEach(child => {
            if (child === nameSpan || child.classList.contains('drag-handle') || child === rightSideWrapper) return;
            if (child.querySelector('.prompt_manager_prompt_controls') || child.classList.contains('prompt_manager_prompt_controls')) {
                if (!child.closest('.nemo-right-controls-wrapper') || child.closest('.nemo-right-controls-wrapper') === rightSideWrapper) {
                    if (!stControlsOuterOriginalSpan) stControlsOuterOriginalSpan = child;
                }
            } else if (child.classList.contains('prompt_manager_prompt_tokens')) {
                 if (!child.closest('.nemo-right-controls-wrapper') || child.closest('.nemo-right-controls-wrapper') === rightSideWrapper) {
                    if (!stTokensSpan) stTokensSpan = child;
                }
            }
        });
        // Fallbacks if elements are nested differently
        const actualControlsElement = liElement.querySelector('.prompt_manager_prompt_controls');
        if (actualControlsElement && (!stControlsOuterOriginalSpan || !stControlsOuterOriginalSpan.contains(actualControlsElement))) {
            let parentCandidate = actualControlsElement.parentElement;
            if (parentCandidate && parentCandidate.tagName === 'SPAN' && parentCandidate.parentElement === liElement) {
                if (!parentCandidate.closest('.nemo-right-controls-wrapper') || parentCandidate.closest('.nemo-right-controls-wrapper') === rightSideWrapper) {
                     stControlsOuterOriginalSpan = parentCandidate;
                }
            }
        }
        if (!stTokensSpan) {
            const tokensCand = liElement.querySelector('.prompt_manager_prompt_tokens');
            if (tokensCand && (!tokensCand.closest('.nemo-right-controls-wrapper') || tokensCand.closest('.nemo-right-controls-wrapper') === rightSideWrapper)) {
                 stTokensSpan = tokensCand;
            }
        }
        if (stControlsOuterOriginalSpan && stControlsOuterOriginalSpan.parentElement === liElement) rightSideWrapper.appendChild(stControlsOuterOriginalSpan);
        if (stTokensSpan && stTokensSpan.parentElement === liElement) rightSideWrapper.appendChild(stTokensSpan);
    }
    // Ensure .prompt_manager_prompt_controls is a direct child of the wrapper, removing intermediate spans
    const promptControlsElem = rightSideWrapper.querySelector('.prompt_manager_prompt_controls');
    if (promptControlsElem) {
        const parentOfControls = promptControlsElem.parentElement;
        if (parentOfControls && parentOfControls !== rightSideWrapper && parentOfControls.parentElement === rightSideWrapper && parentOfControls.tagName === 'SPAN') {
            const tokensInWrapper = rightSideWrapper.querySelector('.prompt_manager_prompt_tokens');
            let insertBeforeNode = (tokensInWrapper && parentOfControls.nextSibling === tokensInWrapper) ? tokensInWrapper : null;
            rightSideWrapper.insertBefore(promptControlsElem, insertBeforeNode);
            if (parentOfControls.childNodes.length === 0 || !parentOfControls.querySelector(':scope > *:not(.prompt_manager_prompt_controls)')) parentOfControls.remove();
            if (tokensInWrapper && tokensInWrapper.parentElement === rightSideWrapper && !promptControlsElem.contains(tokensInWrapper)) rightSideWrapper.appendChild(tokensInWrapper);
        }
    }
    return rightSideWrapper;
}

/**
 * Updates a section summary with the count of enabled items within that section.
 */
function updateSummaryWithCounts(summaryElement, enabledCount) {
    if (!summaryElement || !summaryElement.firstChild || summaryElement.firstChild.tagName !== 'LI') return;
    const liElementInSummary = summaryElement.firstChild;
    if (!liElementInSummary.matches(PROMPT_ITEM_ROW_SELECTOR)) return;
    const rightSideWrapper = ensureRightControlsStructure(liElementInSummary);
    if (rightSideWrapper) {
        let countSpan = rightSideWrapper.querySelector('.nemo-enabled-count');
        if (!countSpan) {
            countSpan = document.createElement('span');
            countSpan.classList.add('nemo-enabled-count');
            rightSideWrapper.insertBefore(countSpan, rightSideWrapper.firstChild);
        }
        countSpan.textContent = ` (${enabledCount})`;
    }
}

/**
 * Core DOM manipulation function to organize prompts into collapsible sections.
 */
async function organizePrompts() {
    if (!DIVIDER_PREFIX_REGEX) await loadAndSetDividerRegex();
    const organizeStartTime = performance.now();
    const promptsContainer = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
    if (!promptsContainer) { hideLoadingOverlay(); return; }
    showLoadingOverlay(promptsContainer);

    // Snapshot current open/closed states to preserve them across re-renders
    const currentOnPageSections = promptsContainer.querySelectorAll('details.nemo-engine-section');
    const newOpenStatesSnapshot = {};
    currentOnPageSections.forEach(section => {
        const summary = section.querySelector('summary');
        const liInSummary = summary ? summary.querySelector(PROMPT_ITEM_ROW_SELECTOR) : null;
        if (liInSummary) {
            const dividerInfo = getDividerInfo(liInSummary);
            if (dividerInfo.isDivider) newOpenStatesSnapshot[dividerInfo.originalText] = section.open;
        }
    });
    openSectionStates = { ...openSectionStates, ...newOpenStatesSnapshot };

    const newSectionsMap = new Map(); // Holds newly created/found section elements
    const topLevelNonDividerItems = []; // Prompts not belonging to any section
    const directChildren = Array.from(promptsContainer.children);
    let currentSectionContext = null; // Tracks the current <details> element

    directChildren.forEach(childLi => {
        if (!childLi.matches(PROMPT_ITEM_ROW_SELECTOR)) return; // Process only prompt <li> items
        // Adopt existing sections if they were rendered by ST or a previous run
        if (childLi.parentElement && childLi.parentElement.tagName === 'SUMMARY' &&
            childLi.parentElement.parentElement && childLi.parentElement.parentElement.classList.contains('nemo-engine-section')) {
            const existingSection = childLi.parentElement.parentElement;
            if (!newSectionsMap.has(existingSection)) {
                const existingDividerInfo = getDividerInfo(childLi);
                newSectionsMap.set(existingSection, { summaryEl: childLi.parentElement, contentEl: existingSection.querySelector('.nemo-section-content'), items: [], originalDividerText: existingDividerInfo?.originalText });
                if (existingDividerInfo && existingDividerInfo.isDivider && openSectionStates.hasOwnProperty(existingDividerInfo.originalText)) existingSection.open = openSectionStates[existingDividerInfo.originalText];
            }
            currentSectionContext = existingSection; return;
        }
        // Check if the current <li> is a new divider
        const dividerInfo = getDividerInfo(childLi);
        if (dividerInfo.isDivider) {
            const newDetailsSection = document.createElement('details');
            newDetailsSection.classList.add('nemo-engine-section');
            newDetailsSection.open = openSectionStates[dividerInfo.originalText] || false; // Restore open state or default to closed
            const summary = document.createElement('summary');
            const nextSibling = childLi.nextSibling; // For re-insertion point
            summary.appendChild(childLi); // Move divider <li> into <summary>
            summary.addEventListener('click', function(event) { // Persist open/closed state
                if (event.target.closest(INTERACTIVE_ELEMENTS_INSIDE_ROW)) return; // Don't toggle if ST controls clicked
                const detailsElement = this.parentElement;
                setTimeout(() => { // Allow 'open' property to update
                    const liInSum = this.querySelector(PROMPT_ITEM_ROW_SELECTOR);
                    if(liInSum) {
                        const currentDivInfo = getDividerInfo(liInSum);
                        if (currentDivInfo.isDivider) openSectionStates[currentDivInfo.originalText] = detailsElement.open;
                    }
                }, 0);
            });
            newDetailsSection.appendChild(summary);
            const newSectionContentDiv = document.createElement('div');
            newSectionContentDiv.classList.add('nemo-section-content');
            newDetailsSection.appendChild(newSectionContentDiv);
            promptsContainer.insertBefore(newDetailsSection, nextSibling);
            newSectionsMap.set(newDetailsSection, { summaryEl: summary, contentEl: newSectionContentDiv, items: [], originalDividerText: dividerInfo.originalText });
            currentSectionContext = newDetailsSection;
        } else { // Not a divider, add to current section or top-level
            if (currentSectionContext && newSectionsMap.has(currentSectionContext)) newSectionsMap.get(currentSectionContext).items.push(childLi);
            else topLevelNonDividerItems.push(childLi);
        }
    });

    // Populate sections with their items and update counts
    newSectionsMap.forEach((sectionData, sectionElement) => {
        let enabledCountInSection = 0;
        sectionData.items.forEach(itemLi => {
            sectionData.contentEl.appendChild(itemLi);
            ensureRightControlsStructure(itemLi);
            if (itemLi.querySelector(`${ST_TOGGLE_ICON_SELECTOR}.${ST_TOGGLE_ENABLED_CLASS}`)) enabledCountInSection++;
        });
        updateSummaryWithCounts(sectionData.summaryEl, enabledCountInSection);
        if (sectionData.originalDividerText && openSectionStates.hasOwnProperty(sectionData.originalDividerText)) sectionElement.open = openSectionStates[sectionData.originalDividerText];
    });

    // Append any top-level non-divider items back to the main container
    topLevelNonDividerItems.forEach(itemLi => {
        if (itemLi.parentElement !== promptsContainer) promptsContainer.appendChild(itemLi);
        ensureRightControlsStructure(itemLi);
    });

    // Final pass to ensure all sections have correct counts and item structures
    promptsContainer.querySelectorAll('details.nemo-engine-section').forEach(section => {
        const summaryEl = section.querySelector('summary');
        const liInSummary = summaryEl ? summaryEl.querySelector(PROMPT_ITEM_ROW_SELECTOR) : null;
        if(liInSummary){
            let enabledCount = 0;
            section.querySelectorAll(`.nemo-section-content > ${PROMPT_ITEM_ROW_SELECTOR} ${ST_TOGGLE_ICON_SELECTOR}.${ST_TOGGLE_ENABLED_CLASS}`).forEach(() => enabledCount++);
            updateSummaryWithCounts(summaryEl, enabledCount);
            const currentDividerInfo = getDividerInfo(liInSummary);
            if (currentDividerInfo.isDivider && openSectionStates.hasOwnProperty(currentDividerInfo.originalText)) section.open = openSectionStates[currentDividerInfo.originalText];
        }
        section.querySelectorAll(`.nemo-section-content > ${PROMPT_ITEM_ROW_SELECTOR}`).forEach(itemLi => ensureRightControlsStructure(itemLi));
    });

    promptsContainer.dataset.nemoOrganized = 'true'; // Mark container as processed
    const organizeEndTime = performance.now();
    const durationMs = organizeEndTime - organizeStartTime;
    const remainingTimeMs = MIN_OVERLAY_DISPLAY_TIME_MS - durationMs;
    setTimeout(() => requestAnimationFrame(hideLoadingOverlay), Math.max(0, remainingTimeMs)); // Ensure overlay visible for min time
}

// 3. SETTINGS UI INJECTION
// -----------------------------------------------------------------------------
const extensionBaseFolderPath = `scripts/extensions/third-party/${NEMO_EXTENSION_NAME}`;

async function initializeNemoSettingsUI() {
    if (settingsUiInitialized) return;
    settingsUiInitialized = true;
    if (!ensureSettingsNamespace()) { /* Error handling omitted for brevity */ return; }
    try {
        const extensionsSettingsContainer = document.getElementById('extensions_settings');
        if (!extensionsSettingsContainer) { settingsUiInitialized = false; setTimeout(initializeNemoSettingsUI, 1500); return; }
        if (!document.querySelector('.nemo-preset-enhancer-settings')) {
            const settingsHtmlPath = `${extensionBaseFolderPath}/settings.html`; // Path for fetching settings.html
            const response = await fetch(settingsHtmlPath);
            if (!response.ok) throw new Error(`Failed to fetch settings.html from '${settingsHtmlPath}': ${response.status} ${response.statusText}`);
            extensionsSettingsContainer.insertAdjacentHTML('beforeend', await response.text());
        }
        const regexInput = document.getElementById('nemoDividerRegexPattern');
        const saveButton = document.getElementById('nemoSaveRegexSettings');
        const statusDiv = document.getElementById('nemoRegexStatus');
        if (!regexInput || !saveButton || !statusDiv) { console.error(`${LOG_PREFIX} Settings UI elements not found.`); return; }
        regexInput.value = extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern || NEMO_DEFAULT_REGEX_PATTERN;
        saveButton.addEventListener('click', async () => {
            if (!ensureSettingsNamespace() || typeof saveSettingsDebounced !== 'function') { /* Error handling */ return; }
            let patternToSave = regexInput.value.trim() === '' ? NEMO_DEFAULT_REGEX_PATTERN : regexInput.value.trim();
            try { new RegExp(`^(${patternToSave})`); } catch (e) { statusDiv.textContent = `Invalid Regex: ${e.message}. Not saved.`; statusDiv.style.color = 'red'; return; }
            try {
                extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern = patternToSave;
                saveSettingsDebounced();
                statusDiv.textContent = 'Regex pattern saved!'; statusDiv.style.color = 'lightgreen';
                await loadAndSetDividerRegex(); // Reload regex for immediate use
                const pc = document.querySelector(PROMPTS_CONTAINER_SELECTOR); if (pc) pc.dataset.nemoOrganized = 'false'; // Trigger re-organization
                setTimeout(() => { if(statusDiv) statusDiv.textContent = ''; }, 3000);
            } catch (error) { statusDiv.textContent = 'Error saving settings.'; statusDiv.style.color = 'red'; }
        });
    } catch (error) {
        console.error(`${LOG_PREFIX} Critical error initializing settings UI:`, error);
        const esc = document.getElementById('extensions_settings');
        if (esc && !document.querySelector('.nemo-preset-enhancer-error')) {
            esc.insertAdjacentHTML('beforeend', `<div class="nemo-preset-enhancer-error" style="color:red; padding:10px;"><b>${NEMO_EXTENSION_NAME} Settings Error:</b> Failed to load UI. Check console. Details: ${error.message}</div>`);
        }
    }
}

// 4. SEARCH FEATURE FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Shows all prompts and sections (used when clearing search).
 */
function showAllPromptsAndSections() {
    const promptsContainer = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
    if (!promptsContainer) return;
    promptsContainer.querySelectorAll(':scope > details.nemo-engine-section, :scope > li.completion_prompt_manager_prompt').forEach(el => {
        el.style.removeProperty('display'); // Revert to CSS-defined display
        if (el.tagName === 'DETAILS') { // Ensure items within sections are also shown
            el.querySelectorAll(':scope > .nemo-section-content > li.completion_prompt_manager_prompt').forEach(liEl => {
                liEl.style.removeProperty('display');
            });
        }
    });
}

/**
 * Handles live search filtering of presets.
 */
function handlePresetSearch() {
    const searchInput = document.getElementById('nemoPresetSearchInput');
    if (!searchInput) return; // Search UI not ready
    const searchTerm = searchInput.value.trim().toLowerCase();
    const promptsContainer = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
    if (!promptsContainer) return;

    if (searchTerm === '') { // If search is cleared
        showAllPromptsAndSections();
        // Restore open/closed states of sections
        promptsContainer.querySelectorAll(':scope > details.nemo-engine-section').forEach(sectionEl => {
            const summaryLi = sectionEl.querySelector(':scope > summary > li.completion_prompt_manager_prompt');
            if (summaryLi) {
                const dividerInfo = getDividerInfo(summaryLi);
                if (dividerInfo.isDivider) { // Only act on actual dividers
                    sectionEl.open = openSectionStates[dividerInfo.originalText] || false; // Restore or default to closed
                }
            }
        });
        return;
    }

    const getLiName = (liElement) => { const nameAnchor = liElement.querySelector(PROMPT_NAME_SELECTOR_IN_ITEM); return nameAnchor ? nameAnchor.textContent.trim().toLowerCase() : ''; };

    // Filter sections
    promptsContainer.querySelectorAll(':scope > details.nemo-engine-section').forEach(sectionEl => {
        let sectionContainsMatch = false;
        const summaryLi = sectionEl.querySelector(':scope > summary > li.completion_prompt_manager_prompt');
        if (summaryLi && getLiName(summaryLi).includes(searchTerm)) sectionContainsMatch = true; // Check section title

        sectionEl.querySelectorAll(':scope > .nemo-section-content > li.completion_prompt_manager_prompt').forEach(itemLi => { // Check items within section
            if (getLiName(itemLi).includes(searchTerm)) { sectionContainsMatch = true; itemLi.style.removeProperty('display'); }
            else itemLi.style.display = 'none';
        });
        if (sectionContainsMatch) { sectionEl.style.removeProperty('display'); sectionEl.open = true; } // Show and open section if match found
        else sectionEl.style.display = 'none'; // Hide section
    });

    // Filter top-level (non-sectioned) items
    promptsContainer.querySelectorAll(':scope > li.completion_prompt_manager_prompt').forEach(itemLi => {
        if (getLiName(itemLi).includes(searchTerm)) itemLi.style.removeProperty('display');
        else itemLi.style.display = 'none';
    });
}

/**
 * Initializes and injects the search bar UI if not already present.
 */
function initializePresetSearchUI() {
    if (document.getElementById('nemoPresetSearchContainer')) { // Check if already injected
        if (!searchUiInitialized) searchUiInitialized = true; // Ensure flag is set if UI exists
        return;
    }

    const promptsListElement = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
    if (!promptsListElement || !promptsListElement.parentElement) {
        // If prompts container isn't ready, retry. This is important for initial load.
        searchUiInitialized = false; // Allow retry by resetting flag
        setTimeout(initializePresetSearchUI, 1500);
        return;
    }

    const searchContainer = document.createElement('div');
    searchContainer.id = 'nemoPresetSearchContainer';
    searchContainer.style.marginBottom = '10px'; searchContainer.style.display = 'flex';
    const searchInput = document.createElement('input');
    searchInput.type = 'text'; searchInput.id = 'nemoPresetSearchInput'; searchInput.placeholder = 'Search loaded prompts...';
    searchInput.style.flexGrow = '1'; searchInput.style.marginRight = '5px'; searchInput.classList.add('text_pole'); // ST class for styling
    const clearButton = document.createElement('button');
    clearButton.id = 'nemoPresetSearchClear'; clearButton.innerHTML = '<i class="fa-solid fa-times"></i>'; clearButton.title = 'Clear search';
    clearButton.classList.add('menu_button'); clearButton.style.minWidth = 'auto'; // ST class for styling
    searchContainer.appendChild(searchInput); searchContainer.appendChild(clearButton);
    promptsListElement.parentElement.insertBefore(searchContainer, promptsListElement); // Inject before the list
    searchInput.addEventListener('input', handlePresetSearch);
    clearButton.addEventListener('click', () => { searchInput.value = ''; handlePresetSearch(); searchInput.focus(); });
    searchUiInitialized = true; // Mark as initialized after successful injection
}

/**
 * Attaches shared event listeners, e.g., for resetting search on prompt toggle.
 */
function attachSharedEventListeners(container) {
    if (!container.dataset.nemoSharedListenersAttached) { // Prevent multiple attachments
        container.addEventListener('click', function(event) {
            // Reset search if a prompt toggle is clicked while search is active
            const toggleButton = event.target.closest(ST_TOGGLE_ICON_SELECTOR);
            const searchInput = document.getElementById('nemoPresetSearchInput');
            if (toggleButton && searchInput && searchInput.value.trim() !== '') {
                searchInput.value = ''; handlePresetSearch(); // Clear search and re-filter (shows all)
            }
        });
        container.dataset.nemoSharedListenersAttached = 'true';
    }
}

// 5. EXECUTION LOGIC - Observer and Main Feature Initialization
// -----------------------------------------------------------------------------
const targetNode = document.body; // Observe the whole body for flexibility
const observerConfig = { childList: true, subtree: true }; // Watch for additions/removals
let organizeTimeout = null; // Debounce re-organization

const observerCallback = function(mutationsList, observer) {
    let relevantChangeNearPrompts = false;
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            const isRelevantNode = (node) => node.nodeType === 1 && ((node.matches && (node.matches(PROMPT_ITEM_ROW_SELECTOR) || node.matches(PROMPTS_CONTAINER_SELECTOR))) || (node.querySelector && (node.querySelector(PROMPT_ITEM_ROW_SELECTOR) || node.querySelector(PROMPTS_CONTAINER_SELECTOR))));
            if (mutation.target.closest(PROMPTS_CONTAINER_SELECTOR) || isRelevantNode(mutation.target) || Array.from(mutation.addedNodes).some(isRelevantNode) || Array.from(mutation.removedNodes).some(isRelevantNode)) {
                relevantChangeNearPrompts = true; break;
            }
        }
    }
    if (relevantChangeNearPrompts) {
        clearTimeout(organizeTimeout);
        organizeTimeout = setTimeout(async () => {
            const presetEditorContainer = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
            if (presetEditorContainer) {
                await loadAndSetDividerRegex();
                // Determine if full re-organization is needed or just a light update
                let needsReProcessing = !presetEditorContainer.dataset.nemoOrganized;
                if (!needsReProcessing) { // Check for new top-level dividers if already organized
                    const directDividers = presetEditorContainer.querySelectorAll(`${PROMPTS_CONTAINER_SELECTOR} > ${PROMPT_ITEM_ROW_SELECTOR}`);
                    for (const li of directDividers) { if (getDividerInfo(li).isDivider) { needsReProcessing = true; break; } }
                }
                if (needsReProcessing) {
                    await organizePrompts(); // Full re-organization
                } else { // Light update of counts and controls structure for existing sections
                    presetEditorContainer.querySelectorAll('details.nemo-engine-section').forEach(section => {
                        let enabledCount = 0;
                        section.querySelectorAll(`.nemo-section-content > ${PROMPT_ITEM_ROW_SELECTOR} ${ST_TOGGLE_ICON_SELECTOR}.${ST_TOGGLE_ENABLED_CLASS}`).forEach(() => enabledCount++);
                        updateSummaryWithCounts(section.querySelector('summary'), enabledCount);
                        section.querySelectorAll(`.nemo-section-content > ${PROMPT_ITEM_ROW_SELECTOR}`).forEach(itemLi => ensureRightControlsStructure(itemLi));
                    });
                    presetEditorContainer.querySelectorAll(`${PROMPTS_CONTAINER_SELECTOR} > ${PROMPT_ITEM_ROW_SELECTOR}`).forEach(itemLi => { if (!getDividerInfo(itemLi).isDivider) ensureRightControlsStructure(itemLi); });
                }
                // Ensure search UI is present and re-apply filter if search is active
                initializePresetSearchUI(); // This will re-inject search UI if it was removed
                const searchInput = document.getElementById('nemoPresetSearchInput');
                if (searchInput && searchInput.value.trim() !== '') {
                    handlePresetSearch();
                }
                if (presetEditorContainer) attachSharedEventListeners(presetEditorContainer); // Ensure event listeners are active
            } else {
                hideLoadingOverlay(); // Hide overlay if container is gone
            }
        }, 300); // Debounce for 300ms
    }
};

const observer = new MutationObserver(observerCallback);

async function initializeMainFeature() {
    if (mainFeatureInitialized) return;
    mainFeatureInitialized = true;
    await loadAndSetDividerRegex();
    initializePresetSearchUI(); // Initial attempt to add search UI

    const presetEditorContainer = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
    if (presetEditorContainer) {
        await organizePrompts(); // Organize prompts after search UI attempt
        attachSharedEventListeners(presetEditorContainer);
        initializePresetSearchUI(); // One more check to ensure search UI is present after initial organization
    }
    observer.observe(targetNode, observerConfig);
}

async function initializeExtension() {
    await initializeMainFeature(); // Initialize collapsible sections and search
    // Initialize settings UI once the document is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
       await initializeNemoSettingsUI();
    } else {
        window.addEventListener('load', async () => { await initializeNemoSettingsUI(); });
    }
}

// Start the extension after a short delay to allow ST to initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initializeExtension, 300));
} else {
    setTimeout(initializeExtension, 300);
}
console.log(`${LOG_PREFIX} content.js script loaded.`);
