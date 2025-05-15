// Import necessary SillyTavern objects/functions
import {
    extension_settings, // The global object holding all extension settings
} from '../../../extensions.js'; // Path to ST's extensions.js

import {
    saveSettingsDebounced, // Function to save all extension settings
} from '../../../../script.js'; // Path to ST's main script.js

// 1. CONFIGURATION
// -----------------------------------------------------------------------------

// NEMO_EXTENSION_NAME: The unique name for this extension.
// IMPORTANT: This should match the "display_name" in manifest.json if used for path construction.
// Also used as the key in extension_settings.
const NEMO_EXTENSION_NAME = "NemoPresetExt"; // Matches manifest.json

// NEMO_DEFAULT_REGEX_PATTERN: The default regular expression pattern used to identify "divider" prompts.
// This pattern is used if no custom pattern is saved in settings.
// It looks for one or more '=' characters.
const NEMO_DEFAULT_REGEX_PATTERN = '=+';

// Settings will be stored under extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern

// DIVIDER_PREFIX_REGEX: The compiled regular expression object.
// Initialized with the default, will be updated by loadAndSetDividerRegex().
// The `^` ensures the pattern matches from the beginning of the prompt name.
// The parentheses create a capturing group for the matched divider characters.
let DIVIDER_PREFIX_REGEX = new RegExp(`^(${NEMO_DEFAULT_REGEX_PATTERN})`);

// DOM Selectors for targeting elements in SillyTavern's UI.
const PROMPTS_CONTAINER_SELECTOR = '#completion_prompt_manager_list'; // The <ul> element holding all prompt items.
const PROMPT_ITEM_ROW_SELECTOR = 'li.completion_prompt_manager_prompt'; // Each individual prompt <li> item.
const PROMPT_NAME_SELECTOR_IN_ITEM = 'span.completion_prompt_manager_prompt_name a.prompt-manager-inspect-action'; // The <a> tag within the name span.
const INTERACTIVE_ELEMENTS_INSIDE_ROW = [ // Selectors for elements within a prompt row that should not trigger section toggle.
    'a.prompt-manager-inspect-action',
    '.prompt-manager-detach-action',
    '.prompt-manager-edit-action',
    '.prompt-manager-toggle-action',
].join(', ');

// Configuration for UI behavior.
const MIN_OVERLAY_DISPLAY_TIME_MS = 400; // Minimum time the loading overlay is shown to prevent flickering.
const ST_TOGGLE_ENABLED_CLASS = 'fa-toggle-on'; // SillyTavern's class for an enabled toggle icon.
const ST_TOGGLE_ICON_SELECTOR = '.prompt-manager-toggle-action'; // Selector for the toggle icon.

// State variables.
let openSectionStates = {}; // Stores the open/closed state of <details> sections, keyed by original divider text.
let overlayElement = null; // Holds the DOM element for the loading overlay.
let settingsUiInitialized = false; // Flag to prevent multiple initializations of the settings UI.
let mainFeatureInitialized = false; // Flag to prevent multiple initializations of the main organizing feature.

// LOG_PREFIX: Standardized prefix for console log messages from this extension.
const LOG_PREFIX = `[${NEMO_EXTENSION_NAME}]`;

/**
 * Ensures that the namespace for this extension's settings exists within the global `extension_settings`.
 * Creates it as an empty object if it doesn't exist.
 * @returns {boolean} True if the namespace exists or was created, false if `extension_settings` itself is not available.
 */
function ensureSettingsNamespace() {
    if (!extension_settings) {
        console.error(`${LOG_PREFIX} CRITICAL: extension_settings object not imported/available!`);
        return false; // Indicates a critical failure in loading ST's core settings object.
    }
    // Ensure our extension's specific settings object exists.
    extension_settings[NEMO_EXTENSION_NAME] = extension_settings[NEMO_EXTENSION_NAME] || {};
    return true;
}


// 2. HELPER FUNCTIONS (for the UI Enhancer feature)
// -----------------------------------------------------------------------------

/**
 * Loads the divider regex pattern from extension settings or uses the default.
 * Compiles the pattern into the global DIVIDER_PREFIX_REGEX.
 * Handles invalid regex patterns by falling back to the default.
 */
async function loadAndSetDividerRegex() {
    console.log(`${LOG_PREFIX} loadAndSetDividerRegex called`);
    let patternString = NEMO_DEFAULT_REGEX_PATTERN; // Start with the default pattern.

    if (!ensureSettingsNamespace()) {
        // If the settings namespace can't be ensured, log a warning and use the default.
        console.warn(`${LOG_PREFIX} Settings namespace could not be ensured. Using default regex.`);
    } else {
        // Check if a custom pattern is stored in settings.
        const savedPattern = extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern;
        if (savedPattern !== undefined && savedPattern !== null && String(savedPattern).trim() !== '') {
            patternString = String(savedPattern).trim();
            console.log(`${LOG_PREFIX} Loaded regex pattern from extension_settings: "${patternString}"`);
        } else {
            // If no pattern is saved or it's empty, initialize with the default.
            // This doesn't save it, just sets it for the current session if it was missing.
            extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern = NEMO_DEFAULT_REGEX_PATTERN;
            console.log(`${LOG_PREFIX} No saved regex pattern, initialized with default: "${NEMO_DEFAULT_REGEX_PATTERN}"`);
        }
    }

    try {
        // Attempt to compile the regex pattern.
        DIVIDER_PREFIX_REGEX = new RegExp(`^(${patternString})`);
        console.log(`${LOG_PREFIX} Successfully set DIVIDER_PREFIX_REGEX to:`, DIVIDER_PREFIX_REGEX);
    } catch (e) {
        // If the pattern is invalid, log an error and fall back to the default.
        console.error(`${LOG_PREFIX} Invalid regex pattern "${patternString}". Falling back to default: "${NEMO_DEFAULT_REGEX_PATTERN}". Error: ${e.message}`);
        DIVIDER_PREFIX_REGEX = new RegExp(`^(${NEMO_DEFAULT_REGEX_PATTERN})`);
        // If an invalid pattern was loaded, also reset it in the stored settings to the default.
        if (ensureSettingsNamespace()) {
            extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern = NEMO_DEFAULT_REGEX_PATTERN;
        }
    }
}

/**
 * Analyzes a prompt list item to determine if it's a divider and extracts its name.
 * @param {HTMLElement} promptElement - The <li> element of the prompt.
 * @returns {object} An object with `isDivider` (boolean), and if true, `name` (cleaned name),
 *                   `originalText` (full prompt name), and `identifier` (full prompt name, for state).
 */
function getDividerInfo(promptElement) {
    const promptNameElement = promptElement.querySelector(PROMPT_NAME_SELECTOR_IN_ITEM);
    if (promptNameElement) {
        const promptName = promptNameElement.textContent.trim();
        // Test if the prompt name starts with the divider pattern.
        if (DIVIDER_PREFIX_REGEX.test(promptName)) {
            const match = promptName.match(DIVIDER_PREFIX_REGEX);
            // Remove the matched prefix from the name.
            let cleanName = promptName.substring(match[0].length).trim();
            // Also try to remove a similar suffix (e.g., "=== Section Name ===" -> "Section Name").
            // This regex matches the divider pattern (escaped) or multiple '=' at the end of the string, surrounded by optional spaces.
            const suffixRegex = new RegExp(`\\s*(${match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|=+)\\s*$`);
            cleanName = cleanName.replace(suffixRegex, '').trim();
            return {
                isDivider: true,
                name: cleanName || "Section", // Default to "Section" if cleanName is empty.
                originalText: promptName,    // The full original text of the divider.
                identifier: promptName       // Used as a key for `openSectionStates`.
            };
        }
    }
    return { isDivider: false }; // Not a divider.
}

/**
 * Gets an existing loading overlay or creates a new one within the specified container.
 * @param {HTMLElement} container - The parent element for the overlay.
 * @returns {HTMLElement} The overlay DOM element.
 */
function getOrCreateLoadingOverlay(container) {
    if (!overlayElement) {
        overlayElement = document.createElement('div');
        overlayElement.className = 'nemo-loading-overlay'; // For styling.
        const spinner = document.createElement('div');
        spinner.className = 'nemo-spinner'; // For styling.
        overlayElement.appendChild(spinner);

        // Overlay needs the container to have a non-static position.
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        container.appendChild(overlayElement);
    }
    return overlayElement;
}

/**
 * Shows the loading overlay.
 * @param {HTMLElement} container - The container where the overlay should appear.
 */
function showLoadingOverlay(container) {
    const overlay = getOrCreateLoadingOverlay(container);
    // Use requestAnimationFrame to ensure class change happens after element is in DOM and ready for transition.
    requestAnimationFrame(() => {
        overlay.classList.add('nemo-visible');
    });
}

/**
 * Hides the loading overlay.
 */
function hideLoadingOverlay() {
    if (overlayElement) {
        overlayElement.classList.remove('nemo-visible');
    }
}

/**
 * Ensures that the SillyTavern prompt controls (edit, toggle, etc.) and token count
 * are wrapped consistently within a '.nemo-right-controls-wrapper' span for styling and layout.
 * This function is complex due to the varied ways ST might structure these elements.
 * @param {HTMLElement} liElement - The prompt <li> element.
 * @returns {HTMLElement|null} The '.nemo-right-controls-wrapper' span, or null if input is invalid.
 */
function ensureRightControlsStructure(liElement) {
    if (!liElement || !liElement.matches(PROMPT_ITEM_ROW_SELECTOR)) { return null; }

    let rightSideWrapper = liElement.querySelector(':scope > .nemo-right-controls-wrapper');
    if (!rightSideWrapper) {
        // Create the wrapper if it doesn't exist.
        rightSideWrapper = document.createElement('span');
        rightSideWrapper.classList.add('nemo-right-controls-wrapper');
        liElement.appendChild(rightSideWrapper); // Append it to the <li>

        // Identify key elements to move into the wrapper.
        const nameSpan = liElement.querySelector(':scope > span.completion_prompt_manager_prompt_name');
        let stControlsOuterOriginalSpan = null; // Potential outer span ST uses for controls.
        let stTokensSpan = null; // The span containing token count.

        // Iterate over direct children of the <li> to find controls and tokens.
        Array.from(liElement.children).forEach(child => {
            // Skip elements we aren't interested in moving (name, drag handle, or the wrapper itself).
            if (child === nameSpan || child.classList.contains('drag-handle') || child === rightSideWrapper) { return; }

            // Check if this child IS or CONTAINS the ST prompt controls.
            if (child.querySelector('.prompt_manager_prompt_controls') || child.classList.contains('prompt_manager_prompt_controls')) {
                // Ensure it's not already part of another (unexpected) nemo wrapper, or our current one.
                if (!child.closest('.nemo-right-controls-wrapper') || child.closest('.nemo-right-controls-wrapper') === rightSideWrapper) {
                    if (!stControlsOuterOriginalSpan) stControlsOuterOriginalSpan = child; // Capture the outermost element containing controls.
                }
            } else if (child.classList.contains('prompt_manager_prompt_tokens')) {
                // Similar logic for the tokens span.
                 if (!child.closest('.nemo-right-controls-wrapper') || child.closest('.nemo-right-controls-wrapper') === rightSideWrapper) {
                    if (!stTokensSpan) stTokensSpan = child;
                }
            }
        });

        // Fallback/Refinement: If ST controls are nested deeper, try to find their immediate parent span.
        const actualControlsElement = liElement.querySelector('.prompt_manager_prompt_controls');
        if (actualControlsElement && (!stControlsOuterOriginalSpan || !stControlsOuterOriginalSpan.contains(actualControlsElement))) {
            let parentCandidate = actualControlsElement.parentElement;
            // If controls are inside a SPAN that is a direct child of the LI.
            if (parentCandidate && parentCandidate.tagName === 'SPAN' && parentCandidate.parentElement === liElement) {
                if (!parentCandidate.closest('.nemo-right-controls-wrapper') || parentCandidate.closest('.nemo-right-controls-wrapper') === rightSideWrapper) {
                     stControlsOuterOriginalSpan = parentCandidate;
                }
            }
        }
        // Fallback for tokens if not found initially.
        if (!stTokensSpan) {
            const tokensCand = liElement.querySelector('.prompt_manager_prompt_tokens');
            if (tokensCand && (!tokensCand.closest('.nemo-right-controls-wrapper') || tokensCand.closest('.nemo-right-controls-wrapper') === rightSideWrapper)) {
                 stTokensSpan = tokensCand;
            }
        }

        // Move the identified ST controls container and tokens span into our wrapper.
        if (stControlsOuterOriginalSpan && stControlsOuterOriginalSpan.parentElement === liElement) {
            rightSideWrapper.appendChild(stControlsOuterOriginalSpan);
        }
        if (stTokensSpan && stTokensSpan.parentElement === liElement) {
            rightSideWrapper.appendChild(stTokensSpan);
        }
    }

    // Post-move cleanup: Ensure .prompt_manager_prompt_controls is a direct child of the wrapper,
    // removing any intermediate (now possibly empty) span.
    const promptControlsElem = rightSideWrapper.querySelector('.prompt_manager_prompt_controls');
    if (promptControlsElem) {
        const parentOfControls = promptControlsElem.parentElement;
        // If promptControlsElem is inside an intermediate span that itself is inside rightSideWrapper
        if (parentOfControls && parentOfControls !== rightSideWrapper && parentOfControls.parentElement === rightSideWrapper && parentOfControls.tagName === 'SPAN') {
            const tokensInWrapper = rightSideWrapper.querySelector('.prompt_manager_prompt_tokens');
            // Determine where to re-insert the controls (before tokens, if tokens exist).
            let insertBeforeNode = (tokensInWrapper && parentOfControls.nextSibling === tokensInWrapper) ? tokensInWrapper : null;
            rightSideWrapper.insertBefore(promptControlsElem, insertBeforeNode);

            // Remove the intermediate span if it's empty or only contained the controls we moved.
            if (parentOfControls.childNodes.length === 0 || !parentOfControls.querySelector(':scope > *:not(.prompt_manager_prompt_controls)')) {
                parentOfControls.remove();
            }
            // Ensure tokens are appended last if they were also in the intermediate span and are not part of controls.
            if (tokensInWrapper && tokensInWrapper.parentElement === rightSideWrapper && !promptControlsElem.contains(tokensInWrapper)) {
                rightSideWrapper.appendChild(tokensInWrapper);
            }
        }
    }
    return rightSideWrapper;
}


/**
 * Updates the summary element of a collapsible section with a count of enabled prompt items.
 * @param {HTMLElement} summaryElement - The <summary> element of the section.
 * @param {number} enabledCount - The number of enabled items in that section.
 */
function updateSummaryWithCounts(summaryElement, enabledCount) {
    // Ensure the summary element and its child <li> are valid.
    if (!summaryElement || !summaryElement.firstChild || summaryElement.firstChild.tagName !== 'LI') { return; }
    const liElementInSummary = summaryElement.firstChild;
    if (!liElementInSummary.matches(PROMPT_ITEM_ROW_SELECTOR)) return;

    // Get or create the standardized right-side controls wrapper.
    const rightSideWrapper = ensureRightControlsStructure(liElementInSummary);
    if (rightSideWrapper) {
        let countSpan = rightSideWrapper.querySelector('.nemo-enabled-count');
        if (!countSpan) {
            // Create the count span if it doesn't exist.
            countSpan = document.createElement('span');
            countSpan.classList.add('nemo-enabled-count'); // For styling.
            // Insert the count span before other controls in the wrapper.
            rightSideWrapper.insertBefore(countSpan, rightSideWrapper.firstChild);
        }
        countSpan.textContent = ` (${enabledCount})`; // Update text content.
    }
}

/**
 * The core function that reorganizes prompts into collapsible sections based on dividers.
 * This function manipulates the DOM significantly.
 */
async function organizePrompts() {
    // Ensure DIVIDER_PREFIX_REGEX is up-to-date.
    if (!DIVIDER_PREFIX_REGEX) {
        console.warn(`${LOG_PREFIX} DIVIDER_PREFIX_REGEX not set before organizePrompts. Attempting to load.`);
        await loadAndSetDividerRegex();
    }

    const organizeStartTime = performance.now();
    const promptsContainer = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
    if (!promptsContainer) {
        hideLoadingOverlay(); // Hide overlay if container isn't found.
        return;
    }
    showLoadingOverlay(promptsContainer); // Show loading overlay during processing.

    // Snapshot current open/closed states of existing sections to preserve them.
    const currentOnPageSections = promptsContainer.querySelectorAll('details.nemo-engine-section');
    const newOpenStatesSnapshot = {};
    currentOnPageSections.forEach(section => {
        const summary = section.querySelector('summary');
        const liInSummary = summary ? summary.querySelector(PROMPT_ITEM_ROW_SELECTOR) : null;
        if (liInSummary) {
            const dividerInfo = getDividerInfo(liInSummary);
            if (dividerInfo.isDivider) {
                newOpenStatesSnapshot[dividerInfo.originalText] = section.open;
            }
        }
    });
    // Merge with existing states, new snapshot takes precedence for items on page.
    openSectionStates = { ...openSectionStates, ...newOpenStatesSnapshot };

    const newSectionsMap = new Map(); // To hold newly created/found section elements and their data.
    const topLevelNonDividerItems = []; // For prompt items not belonging to any section.
    const directChildren = Array.from(promptsContainer.children); // Get all direct children of the prompt list.
    let currentSectionContext = null; // Tracks the current <details> element being populated.

    directChildren.forEach(childLi => {
        // Process only valid prompt <li> items.
        if (!childLi.matches(PROMPT_ITEM_ROW_SELECTOR)) return;

        // If this <li> is already part of a summary in an existing .nemo-engine-section,
        // it means this section was likely rendered by ST or a previous run.
        // We should adopt it into our newSectionsMap.
        if (childLi.parentElement && childLi.parentElement.tagName === 'SUMMARY' &&
            childLi.parentElement.parentElement && childLi.parentElement.parentElement.classList.contains('nemo-engine-section')) {
            const existingSection = childLi.parentElement.parentElement;
            if (!newSectionsMap.has(existingSection)) {
                const existingDividerInfo = getDividerInfo(childLi);
                newSectionsMap.set(existingSection, {
                    summaryEl: childLi.parentElement,
                    contentEl: existingSection.querySelector('.nemo-section-content'),
                    items: [], // Items will be populated if they are found "loose" later
                    originalDividerText: existingDividerInfo?.originalText
                });
                // Restore open state if known.
                if (existingDividerInfo && existingDividerInfo.isDivider && openSectionStates.hasOwnProperty(existingDividerInfo.originalText)) {
                    existingSection.open = openSectionStates[existingDividerInfo.originalText];
                }
            }
            currentSectionContext = existingSection; // This is now the current section.
            return; // Item handled, move to next child.
        }

        // Check if the current <li> is a divider.
        const dividerInfo = getDividerInfo(childLi);
        if (dividerInfo.isDivider) {
            // Create a new <details> (collapsible section) element.
            const newDetailsSection = document.createElement('details');
            newDetailsSection.classList.add('nemo-engine-section'); // For styling.
            // Set open state based on stored preferences, default to closed.
            newDetailsSection.open = openSectionStates[dividerInfo.originalText] || false;

            const summary = document.createElement('summary'); // The clickable header.
            const nextSibling = childLi.nextSibling; // Store for re-insertion point.
            summary.appendChild(childLi); // Move the divider <li> into the <summary>.

            // Event listener to update openSectionStates when a section is toggled.
            summary.addEventListener('click', function(event) {
                // Prevent toggling if an interactive element within the summary's <li> was clicked.
                if (event.target.closest(INTERACTIVE_ELEMENTS_INSIDE_ROW)) return;

                const detailsElement = this.parentElement; // The <details> element.
                // Use setTimeout to allow the 'open' property to update before reading it.
                setTimeout(() => {
                    const liInSum = this.querySelector(PROMPT_ITEM_ROW_SELECTOR);
                    if(liInSum) {
                        const currentDivInfo = getDividerInfo(liInSum);
                        if (currentDivInfo.isDivider) {
                            openSectionStates[currentDivInfo.originalText] = detailsElement.open;
                        }
                    }
                }, 0);
            });

            newDetailsSection.appendChild(summary);
            const newSectionContentDiv = document.createElement('div'); // Container for items in this section.
            newSectionContentDiv.classList.add('nemo-section-content'); // For styling (indentation).
            newDetailsSection.appendChild(newSectionContentDiv);

            // Insert the new section into the main prompts container.
            promptsContainer.insertBefore(newDetailsSection, nextSibling);

            // Store the new section and its parts.
            newSectionsMap.set(newDetailsSection, {
                summaryEl: summary,
                contentEl: newSectionContentDiv,
                items: [], // Items belonging to this section.
                originalDividerText: dividerInfo.originalText
            });
            currentSectionContext = newDetailsSection; // This is now the current section.
        } else {
            // If it's not a divider, add it to the current section or to top-level items.
            if (currentSectionContext && newSectionsMap.has(currentSectionContext)) {
                newSectionsMap.get(currentSectionContext).items.push(childLi);
            } else {
                topLevelNonDividerItems.push(childLi);
            }
        }
    });

    // Populate sections with their items and update counts.
    newSectionsMap.forEach((sectionData, sectionElement) => {
        let enabledCountInSection = 0;
        sectionData.items.forEach(itemLi => {
            sectionData.contentEl.appendChild(itemLi); // Move item into its section's content div.
            ensureRightControlsStructure(itemLi); // Standardize its controls.
            // Count if item is enabled.
            if (itemLi.querySelector(`${ST_TOGGLE_ICON_SELECTOR}.${ST_TOGGLE_ENABLED_CLASS}`)) {
                enabledCountInSection++;
            }
        });
        updateSummaryWithCounts(sectionData.summaryEl, enabledCountInSection);
        // Re-apply open state (might be redundant if set at creation, but safe).
        if (sectionData.originalDividerText && openSectionStates.hasOwnProperty(sectionData.originalDividerText)) {
            sectionElement.open = openSectionStates[sectionData.originalDividerText];
        }
    });

    // Append any top-level non-divider items back to the main container.
    topLevelNonDividerItems.forEach(itemLi => {
        if (itemLi.parentElement !== promptsContainer) { // Only append if not already there.
            promptsContainer.appendChild(itemLi);
        }
        ensureRightControlsStructure(itemLi); // Standardize its controls.
    });

    // Final pass to ensure all sections (especially pre-existing ones not fully processed by newSectionsMap population)
    // have correct counts and item structures.
    promptsContainer.querySelectorAll('details.nemo-engine-section').forEach(section => {
        const summaryEl = section.querySelector('summary');
        const liInSummary = summaryEl ? summaryEl.querySelector(PROMPT_ITEM_ROW_SELECTOR) : null;
        if(liInSummary){
            let enabledCount = 0;
            // Recalculate enabled items within this section's content.
            section.querySelectorAll(`.nemo-section-content > ${PROMPT_ITEM_ROW_SELECTOR} ${ST_TOGGLE_ICON_SELECTOR}.${ST_TOGGLE_ENABLED_CLASS}`).forEach(() => enabledCount++);
            updateSummaryWithCounts(summaryEl, enabledCount);

            const currentDividerInfo = getDividerInfo(liInSummary);
            if (currentDividerInfo.isDivider && openSectionStates.hasOwnProperty(currentDividerInfo.originalText)) {
                section.open = openSectionStates[currentDividerInfo.originalText]; // Ensure open state.
            }
        }
        // Ensure all items within the section content have standardized controls.
        section.querySelectorAll(`.nemo-section-content > ${PROMPT_ITEM_ROW_SELECTOR}`).forEach(itemLi => ensureRightControlsStructure(itemLi));
    });

    promptsContainer.dataset.nemoOrganized = 'true'; // Mark container as processed.

    const organizeEndTime = performance.now();
    const durationMs = organizeEndTime - organizeStartTime;
    const remainingTimeMs = MIN_OVERLAY_DISPLAY_TIME_MS - durationMs;

    // Ensure overlay is visible for a minimum duration to avoid flicker.
    setTimeout(() => requestAnimationFrame(hideLoadingOverlay), Math.max(0, remainingTimeMs));
}


// 3. SETTINGS UI INJECTION
// -----------------------------------------------------------------------------
// Path to the folder containing extension assets like settings.html and styles.css
// This path construction assumes SillyTavern places extensions in a predictable way.
// NEMO_EXTENSION_NAME should match the folder name ST creates for the extension.
const extensionBaseFolderPath = `scripts/extensions/third-party/${NEMO_EXTENSION_NAME}`;

/**
 * Initializes and injects the settings UI for this extension into SillyTavern's extensions settings page.
 */
async function initializeNemoSettingsUI() {
    if (settingsUiInitialized) {
        console.log(`${LOG_PREFIX} Settings UI already initialized or initialization attempted.`);
        return;
    }
    settingsUiInitialized = true; // Set flag to prevent re-entry.
    console.log(`${LOG_PREFIX} Attempting to initialize settings UI...`);

    if (!ensureSettingsNamespace()) {
        console.error(`${LOG_PREFIX} Cannot initialize settings UI because settings namespace is not available.`);
        // Optionally display an error in the UI if ST's settings panel is available.
        const extensionsSettingsContainer = document.getElementById('extensions_settings');
        if (extensionsSettingsContainer && !document.querySelector('.nemo-preset-enhancer-error')) {
            extensionsSettingsContainer.insertAdjacentHTML('beforeend', `<div class="nemo-preset-enhancer-error" style="color:red; padding:10px;"><b>${NEMO_EXTENSION_NAME} Settings Error:</b> Core settings API missing. Check console.</div>`);
        }
        return;
    }

    try {
        const extensionsSettingsContainer = document.getElementById('extensions_settings');
        if (!extensionsSettingsContainer) {
            // If ST's main settings container isn't ready, retry after a delay.
            console.error(`${LOG_PREFIX} #extensions_settings container not found. Settings UI cannot be injected yet. Will retry.`);
            settingsUiInitialized = false; // Reset flag to allow retry.
            setTimeout(initializeNemoSettingsUI, 1500); // Retry after 1.5 seconds.
            return;
        }
        console.log(`${LOG_PREFIX} Found #extensions_settings container.`);

        // Check if settings HTML is already injected (e.g., by a previous attempt or HMR).
        if (document.querySelector('.nemo-preset-enhancer-settings')) {
            console.log(`${LOG_PREFIX} Settings UI snippet already present in DOM. Skipping injection.`);
        } else {
            // Fetch and inject the settings.html snippet.
            // Construct the path using extensionBaseFolderPath, which is built using the corrected NEMO_EXTENSION_NAME.
            const settingsHtmlPath = `${extensionBaseFolderPath}/settings.html`; // REVERTED to use extensionBaseFolderPath
            console.log(`${LOG_PREFIX} Fetching settings HTML from: ${settingsHtmlPath}`);
            const response = await fetch(settingsHtmlPath);
            if (!response.ok) {
                // For debugging, it's useful to include the path that failed.
                throw new Error(`Failed to fetch settings.html from '${settingsHtmlPath}': ${response.status} ${response.statusText}`);
            }
            const settingsHtmlSnippet = await response.text();
            console.log(`${LOG_PREFIX} Successfully fetched settings.html snippet.`);
            extensionsSettingsContainer.insertAdjacentHTML('beforeend', settingsHtmlSnippet);
            console.log(`${LOG_PREFIX} Settings HTML snippet injected.`);
        }

        // Get references to the UI elements from the injected HTML.
        const regexInput = document.getElementById('nemoDividerRegexPattern');
        const saveButton = document.getElementById('nemoSaveRegexSettings');
        const statusDiv = document.getElementById('nemoRegexStatus');

        if (!regexInput || !saveButton || !statusDiv) {
            console.error(`${LOG_PREFIX} One or more settings UI elements (input, button, status) not found after injection. Check IDs in settings.html.`);
            return;
        }

        // Load the current regex pattern into the input field.
        // `extension_settings` should be populated by `loadAndSetDividerRegex` or have the default.
        regexInput.value = extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern || NEMO_DEFAULT_REGEX_PATTERN;
        console.log(`${LOG_PREFIX} Loaded initial regex pattern for settings UI: "${regexInput.value}"`);

        // Event listener for the save button.
        saveButton.addEventListener('click', async () => {
            console.log(`${LOG_PREFIX} Save settings button clicked.`);

            // Ensure necessary ST APIs are available for saving.
            if (!ensureSettingsNamespace() || typeof saveSettingsDebounced !== 'function') {
                statusDiv.textContent = 'Error: ST settings API not available for saving.';
                statusDiv.style.color = 'red';
                console.error(`${LOG_PREFIX} saveSettingsDebounced function or extension_settings not available.`);
                return;
            }

            const newPattern = regexInput.value.trim();
            // Use default if input is empty, otherwise use the trimmed input.
            let patternToSave = newPattern === '' ? NEMO_DEFAULT_REGEX_PATTERN : newPattern;

            // Validate the regex pattern before saving.
            try {
                new RegExp(`^(${patternToSave})`); // Test compilation.
            } catch (e) {
                statusDiv.textContent = `Invalid Regex: ${e.message}. Not saved.`;
                statusDiv.style.color = 'red';
                console.error(`${LOG_PREFIX} Invalid regex entered: ${patternToSave}`, e);
                return;
            }

            try {
                // Update the settings object directly.
                extension_settings[NEMO_EXTENSION_NAME].dividerRegexPattern = patternToSave;
                saveSettingsDebounced(); // Call ST's global function to persist all extension settings.

                statusDiv.textContent = 'Regex pattern saved!';
                statusDiv.style.color = 'lightgreen';
                console.log(`${LOG_PREFIX} Regex pattern "${patternToSave}" saved to settings.`);

                // Reload the regex for immediate use and re-process prompts.
                await loadAndSetDividerRegex();

                // Mark the prompts container as needing re-organization.
                const promptsContainer = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
                if (promptsContainer) promptsContainer.dataset.nemoOrganized = 'false'; // Trigger re-organization

                // Clear status message after a few seconds.
                setTimeout(() => { if(statusDiv) statusDiv.textContent = ''; }, 3000);
            } catch (error) {
                statusDiv.textContent = 'Error saving settings.';
                statusDiv.style.color = 'red';
                console.error(`${LOG_PREFIX} Error saving regex setting:`, error);
            }
        });
        console.log(`${LOG_PREFIX} Settings UI fully initialized and event listeners attached.`);
    } catch (error) {
        console.error(`${LOG_PREFIX} Critical error initializing settings UI:`, error);
        // Display a generic error in the settings panel if possible.
        const extensionsSettingsContainer = document.getElementById('extensions_settings');
        if (extensionsSettingsContainer && !document.querySelector('.nemo-preset-enhancer-error')) {
            extensionsSettingsContainer.insertAdjacentHTML('beforeend', `<div class="nemo-preset-enhancer-error" style="color:red; padding:10px;"><b>${NEMO_EXTENSION_NAME} Settings Error:</b> Failed to load UI. Check console. Details: ${error.message}</div>`);
        }
    }
}


// 4. EXECUTION LOGIC (for the UI Enhancer feature) - Observer and main feature init
// -----------------------------------------------------------------------------

// DOM observer to detect changes in the prompt list (e.g., new prompts added, deleted).
const targetNode = document.body; // Observe the whole body for flexibility.
const observerConfig = { childList: true, subtree: true }; // Watch for additions/removals of nodes in the entire subtree.
let organizeTimeout = null; // Timeout ID for debouncing organizePrompts calls.

/**
 * Callback function for the MutationObserver.
 * It checks if relevant changes occurred in the prompts list and triggers re-organization.
 * @param {MutationRecord[]} mutationsList - A list of mutations that occurred.
 * @param {MutationObserver} observer - The observer instance.
 */
const observerCallback = function(mutationsList, observer) {
    let relevantChangeNearPrompts = false;
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') { // Only interested in structural changes.
            // Helper to check if a node is relevant to the prompt manager.
            const isRelevantNode = (node) => node.nodeType === 1 && ( // Is an element node
                (node.matches && (node.matches(PROMPT_ITEM_ROW_SELECTOR) || node.matches(PROMPTS_CONTAINER_SELECTOR))) ||
                (node.querySelector && (node.querySelector(PROMPT_ITEM_ROW_SELECTOR) || node.querySelector(PROMPTS_CONTAINER_SELECTOR)))
            );

            // Check if the mutation target or added/removed nodes are related to the prompt list.
            if (mutation.target.closest(PROMPTS_CONTAINER_SELECTOR) ||
                isRelevantNode(mutation.target) ||
                Array.from(mutation.addedNodes).some(isRelevantNode) ||
                Array.from(mutation.removedNodes).some(isRelevantNode)) {
                relevantChangeNearPrompts = true;
                break; // Found a relevant change, no need to check further mutations.
            }
        }
    }

    if (relevantChangeNearPrompts) {
        clearTimeout(organizeTimeout); // Clear any pending organization.
        // Debounce the call to organize prompts to avoid rapid-fire execution.
        organizeTimeout = setTimeout(async () => {
            const presetEditorContainer = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
            if (presetEditorContainer) {
                await loadAndSetDividerRegex(); // Ensure regex is current.

                // Determine if a full re-organization is needed or just an update of counts/structure.
                let needsReProcessing = !presetEditorContainer.dataset.nemoOrganized; // Not organized yet.
                if (!needsReProcessing) {
                    // Or, if it was organized, but new top-level dividers have appeared.
                    const directDividers = presetEditorContainer.querySelectorAll(`${PROMPTS_CONTAINER_SELECTOR} > ${PROMPT_ITEM_ROW_SELECTOR}`);
                    for (const li of directDividers) {
                        if (getDividerInfo(li).isDivider) {
                            needsReProcessing = true; // Found a new divider at the top level.
                            break;
                        }
                    }
                }

                if (needsReProcessing) {
                    await organizePrompts(); // Full re-organization.
                } else {
                    // If already organized and no new top-level dividers, just update existing sections.
                    presetEditorContainer.querySelectorAll('details.nemo-engine-section').forEach(section => {
                        let enabledCount = 0;
                        section.querySelectorAll(`.nemo-section-content > ${PROMPT_ITEM_ROW_SELECTOR} ${ST_TOGGLE_ICON_SELECTOR}.${ST_TOGGLE_ENABLED_CLASS}`).forEach(() => enabledCount++);
                        updateSummaryWithCounts(section.querySelector('summary'), enabledCount);
                        // Ensure structure of items within sections.
                        section.querySelectorAll(`.nemo-section-content > ${PROMPT_ITEM_ROW_SELECTOR}`).forEach(itemLi => ensureRightControlsStructure(itemLi));
                    });
                    // Ensure structure of top-level non-divider items.
                    presetEditorContainer.querySelectorAll(`${PROMPTS_CONTAINER_SELECTOR} > ${PROMPT_ITEM_ROW_SELECTOR}`).forEach(itemLi => {
                        if (!getDividerInfo(itemLi).isDivider) ensureRightControlsStructure(itemLi);
                    });
                }
            } else {
                hideLoadingOverlay(); // Hide overlay if container is gone.
            }
        }, 300); // Wait 300ms after the last relevant DOM change.
    }
};

// Create the MutationObserver instance with the callback.
const observer = new MutationObserver(observerCallback);

/**
 * Initializes the main UI enhancing features of the extension (prompt organization, observer).
 */
async function initializeMainFeature() {
    if (mainFeatureInitialized) return; // Prevent re-initialization.
    mainFeatureInitialized = true;
    console.log(`${LOG_PREFIX} Initializing main UI Enhancer feature...`);

    await loadAndSetDividerRegex(); // Load regex pattern on startup.

    // Perform an initial organization if the prompt container exists.
    const presetEditorContainer = document.querySelector(PROMPTS_CONTAINER_SELECTOR);
    if (presetEditorContainer) {
        await organizePrompts();
    } else {
        // Log a warning if the container isn't found; organization will happen when it appears via observer.
        console.warn(`${LOG_PREFIX} Prompt container not found on init. Feature may not work until it appears.`);
    }

    // Start observing the DOM for changes.
    observer.observe(targetNode, observerConfig);
    console.log(`${LOG_PREFIX} Main UI Enhancer feature initialized and observer started.`);
}


// Entry point: Initialize everything
// -----------------------------------------------------------------------------

/**
 * Main initialization function for the entire extension.
 * Initializes the UI enhancing feature and the settings UI.
 */
async function initializeExtension() {
    console.log(`${LOG_PREFIX} Full extension initialization sequence starting.`);
    // Initialize the main prompt organization feature. This also calls loadAndSetDividerRegex.
    await initializeMainFeature();

    // Initialize the settings UI.
    // Check if document is already loaded, otherwise wait for 'load' event.
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
       await initializeNemoSettingsUI();
    } else {
        window.addEventListener('load', async () => {
            await initializeNemoSettingsUI();
        });
    }
    console.log(`${LOG_PREFIX} Full extension initialization sequence finished (or scheduled).`);
}

// Start the extension initialization process.
// Wait for DOMContentLoaded if the document is still loading,
// otherwise, use a small timeout to ensure ST's own scripts have likely run.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initializeExtension, 300));
} else {
    // Increased delay slightly to give ST more time if already loaded.
    setTimeout(initializeExtension, 300);
}

console.log(`${LOG_PREFIX} content.js script loaded.`);
