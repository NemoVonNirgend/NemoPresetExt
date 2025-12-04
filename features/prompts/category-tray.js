/**
 * Category Tray UI Component
 * Converts category sections into folder/drawer style with tray-based selection
 * Clicking a category header opens a tray showing available prompts with tooltips
 *
 * @module category-tray
 */

import logger from '../../core/logger.js';
import { parsePromptDirectives, validatePromptActivation, getAllPromptsWithState } from '../directives/prompt-directives.js';
import { getCachedDirectives, getPromptContentOnDemand } from '../../core/directive-cache.js';
import { showConflictToast } from '../directives/directive-ui.js';
import { promptManager } from '../../../../../openai.js';
import { chat_metadata, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { NEMO_EXTENSION_NAME } from '../../core/utils.js';
import storage from '../../core/storage-migration.js';
import { getTokenCountAsync } from '../../../../../tokenizers.js';

// Track which sections are in tray mode
const trayModeEnabled = new Set();

// Persistent cache for section prompt IDs (survives DOM refreshes)
// Key: section name (from getSectionId), Value: array of {identifier, name}
const sectionPromptIdsCache = new Map();

// Track compact view state per section
const compactViewState = new Map();

// Track currently dragged prompt for cross-section drops
let currentlyDraggedPrompt = null;
let currentlyDraggedFromSection = null;
let currentlyDraggedFromTray = null;
let currentDropTarget = null; // Section being hovered over during drag
let topLevelDropZone = null; // Drop zone for making prompts top-level
let isOverTopLevelDropZone = false;
let isDragging = false; // Flag to pause updates during drag
let currentContextMenu = null; // Track current context menu for cleanup

/**
 * Get saved presets from extension settings
 * @returns {Object} Map of preset names to enabled prompt arrays
 */
function getSavedPresets() {
    ensurePresetsNamespace();
    return extension_settings[NEMO_EXTENSION_NAME].promptPresets || {};
}

/**
 * Ensure presets namespace exists
 */
function ensurePresetsNamespace() {
    if (!extension_settings[NEMO_EXTENSION_NAME]) {
        extension_settings[NEMO_EXTENSION_NAME] = {};
    }
    if (!extension_settings[NEMO_EXTENSION_NAME].promptPresets) {
        extension_settings[NEMO_EXTENSION_NAME].promptPresets = {};
    }
}

/**
 * Save a preset
 * @param {string} name - Preset name
 * @param {string} sectionId - Section identifier
 * @param {Array} enabledPrompts - Array of enabled prompt identifiers
 */
function savePreset(name, sectionId, enabledPrompts) {
    ensurePresetsNamespace();
    const key = `${sectionId}::${name}`;
    extension_settings[NEMO_EXTENSION_NAME].promptPresets[key] = {
        name,
        sectionId,
        enabledPrompts,
        createdAt: Date.now()
    };
    saveSettingsDebounced();
    logger.info(`Saved preset "${name}" for section "${sectionId}" with ${enabledPrompts.length} prompts`);
}

/**
 * Load a preset
 * @param {string} key - Preset key (sectionId::name)
 * @returns {Object|null} Preset data or null
 */
function loadPreset(key) {
    ensurePresetsNamespace();
    return extension_settings[NEMO_EXTENSION_NAME].promptPresets[key] || null;
}

/**
 * Delete a preset
 * @param {string} key - Preset key
 */
function deletePreset(key) {
    ensurePresetsNamespace();
    delete extension_settings[NEMO_EXTENSION_NAME].promptPresets[key];
    saveSettingsDebounced();
    logger.info(`Deleted preset: ${key}`);
}

/**
 * Get presets for a specific section
 * @param {string} sectionId - Section identifier
 * @returns {Array} Array of preset objects for this section
 */
function getPresetsForSection(sectionId) {
    const allPresets = getSavedPresets();
    return Object.entries(allPresets)
        .filter(([key, preset]) => preset.sectionId === sectionId)
        .map(([key, preset]) => ({ key, ...preset }));
}

/**
 * Show a custom modal for entering preset name
 * @param {string} sectionName - Section name for display
 * @param {number} enabledCount - Number of enabled prompts
 * @returns {Promise<string|null>} The entered name or null if cancelled
 */
function showPresetNameModal(sectionName, enabledCount) {
    return new Promise((resolve) => {
        // Remove any existing modal
        document.querySelector('.nemo-preset-name-modal')?.remove();

        const modal = document.createElement('div');
        modal.className = 'nemo-preset-name-modal';
        modal.innerHTML = `
            <div class="nemo-preset-modal-backdrop"></div>
            <div class="nemo-preset-modal-container">
                <div class="nemo-preset-modal-header">
                    <i class="fa-solid fa-bookmark"></i>
                    <span>Save Preset</span>
                </div>
                <div class="nemo-preset-modal-body">
                    <div class="nemo-preset-modal-info">
                        <span class="nemo-preset-modal-section">${escapeHtml(sectionName)}</span>
                        <span class="nemo-preset-modal-count">${enabledCount} prompt${enabledCount !== 1 ? 's' : ''} enabled</span>
                    </div>
                    <label class="nemo-preset-modal-label">Preset Name</label>
                    <input type="text" class="nemo-preset-modal-input" placeholder="e.g., Romance Mode, Action Setup..." maxlength="50" autofocus>
                    <div class="nemo-preset-modal-suggestions">
                        <span class="nemo-preset-suggestion" data-name="Default">Default</span>
                        <span class="nemo-preset-suggestion" data-name="Minimal">Minimal</span>
                        <span class="nemo-preset-suggestion" data-name="Full">Full</span>
                        <span class="nemo-preset-suggestion" data-name="Custom">Custom</span>
                    </div>
                </div>
                <div class="nemo-preset-modal-footer">
                    <button class="nemo-preset-modal-cancel">Cancel</button>
                    <button class="nemo-preset-modal-save" disabled>
                        <i class="fa-solid fa-check"></i> Save Preset
                    </button>
                </div>
            </div>
        `;

        const input = modal.querySelector('.nemo-preset-modal-input');
        const saveBtn = modal.querySelector('.nemo-preset-modal-save');
        const cancelBtn = modal.querySelector('.nemo-preset-modal-cancel');
        const backdrop = modal.querySelector('.nemo-preset-modal-backdrop');

        // Enable/disable save button based on input
        input.addEventListener('input', () => {
            saveBtn.disabled = !input.value.trim();
        });

        // Quick suggestion clicks
        modal.querySelectorAll('.nemo-preset-suggestion').forEach(suggestion => {
            suggestion.addEventListener('click', () => {
                input.value = suggestion.dataset.name;
                input.dispatchEvent(new Event('input'));
                input.focus();
            });
        });

        // Save handler
        const handleSave = () => {
            const name = input.value.trim();
            if (name) {
                modal.remove();
                resolve(name);
            }
        };

        saveBtn.addEventListener('click', handleSave);

        // Enter key to save
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                handleSave();
            } else if (e.key === 'Escape') {
                modal.remove();
                resolve(null);
            }
        });

        // Cancel handlers
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        backdrop.addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        document.body.appendChild(modal);

        // Focus input after modal is in DOM
        requestAnimationFrame(() => input.focus());
    });
}

/**
 * Get current dropdown style mode
 * @returns {'tray' | 'accordion'} The current dropdown style
 */
function getDropdownStyle() {
    return storage.getDropdownStyle() || 'tray';
}

/**
 * Apply the appropriate mode based on current setting
 */
function applyCurrentMode() {
    const style = getDropdownStyle();
    console.log(`[NemoTray] Applying mode: ${style}`);

    if (style === 'accordion') {
        // First disable tray mode if it was active
        disableTrayMode();
        // Then apply accordion mode
        convertToAccordionMode();
        // Refresh counts with delays to catch late DOM updates
        setTimeout(() => updateAllAccordionSectionCounts(), 100);
        setTimeout(() => updateAllAccordionSectionCounts(), 300);
    } else {
        // First disable accordion mode if it was active
        disableAccordionMode();
        // Then apply tray mode
        convertToTrayMode();
        // Refresh progress bars
        setTimeout(() => refreshAllSectionProgressBars(), 100);
        setTimeout(() => refreshAllSectionProgressBars(), 300);
    }
}

/**
 * Initialize the category tray system
 */
export function initCategoryTray() {
    console.log('[NemoTray] ====== INIT CALLED ======');
    logger.info('Initializing category tray system');

    // Listen for dropdown style changes
    document.addEventListener('nemo-dropdown-style-changed', (e) => {
        console.log('[NemoTray] Dropdown style changed:', e.detail?.style);
        applyCurrentMode();
    });

    // Try multiple times with increasing delays to catch sections
    const delays = [500, 1000, 2000, 3000, 5000];
    delays.forEach(delay => {
        setTimeout(() => {
            console.log(`[NemoTray] Checking for sections after ${delay}ms...`);
            applyCurrentMode();
            // Also refresh progress bars to catch any ST overwrites
            refreshAllSectionProgressBars();
        }, delay);
    });

    // Additional delayed refresh to catch late ST updates
    setTimeout(() => refreshAllSectionProgressBars(), 6000);
    setTimeout(() => refreshAllSectionProgressBars(), 8000);

    // Watch for prompt manager re-renders
    const observer = new MutationObserver((mutations) => {
        // Skip updates during drag to prevent flickering
        if (isDragging) return;

        // Only run if we see relevant changes
        const hasRelevantChanges = mutations.some(m =>
            m.addedNodes.length > 0 ||
            (m.target.classList && m.target.classList.contains('nemo-engine-section'))
        );

        if (hasRelevantChanges) {
            clearTimeout(window._trayDebounce);
            window._trayDebounce = setTimeout(() => {
                // Double-check we're not dragging
                if (isDragging) return;
                applyCurrentMode();
                // Refresh progress bars after conversion
                setTimeout(() => refreshAllSectionProgressBars(), 100);
                setTimeout(() => refreshAllSectionProgressBars(), 300);
            }, 200);
        }
    });

    // Watch the whole document body for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('[NemoTray] Observer attached to document.body');
    logger.info('Category tray system initialized - watching for sections');
}

// Track top-level prompts container
let topLevelPromptsContainer = null;
const TOP_LEVEL_SECTION_ID = '__nemo_top_level__';

/**
 * Convert top-level prompts (outside any section) to use our tray system
 * This prevents lag from native SillyTavern drag handlers
 */
function convertTopLevelPrompts() {
    // Skip if container already exists and is in DOM
    if (topLevelPromptsContainer && document.contains(topLevelPromptsContainer)) {
        return 0;
    }

    const promptList = document.querySelector('#completion_prompt_manager_list');
    if (!promptList) return 0;

    // Find all top-level prompts (direct children of prompt list, not in sections)
    // Exclude any that are inside our created container
    const topLevelPrompts = promptList.querySelectorAll(':scope > li.completion_prompt_manager_prompt:not(.nemo-tray-hidden-prompt)');

    if (topLevelPrompts.length === 0 && !sectionPromptIdsCache.has(TOP_LEVEL_SECTION_ID)) {
        return 0;
    }

    // Don't re-process if we already have cached data and no new prompts
    if (topLevelPrompts.length === 0 && topLevelPromptsContainer) {
        return 0;
    }

    console.log('[NemoTray] Found top-level prompts:', topLevelPrompts.length);

    // Check for cached data
    let topLevelPromptIds = sectionPromptIdsCache.get(TOP_LEVEL_SECTION_ID);

    if (topLevelPrompts.length > 0) {
        // Extract and hide top-level prompts
        topLevelPromptIds = [];
        topLevelPrompts.forEach(el => {
            const identifier = el.getAttribute('data-pm-identifier');
            const nameEl = el.querySelector('.completion_prompt_manager_prompt_name a');
            const name = nameEl?.textContent?.trim() || identifier;
            if (identifier) {
                topLevelPromptIds.push({ identifier, name });
            }
            // Hide the prompt
            el.classList.add('nemo-tray-hidden-prompt');
        });

        // Cache the data
        sectionPromptIdsCache.set(TOP_LEVEL_SECTION_ID, topLevelPromptIds);
        console.log('[NemoTray] Cached', topLevelPromptIds.length, 'top-level prompt IDs');
    }

    // Create or update the top-level container if we have prompts
    if (topLevelPromptIds && topLevelPromptIds.length > 0) {
        createTopLevelContainer(promptList, topLevelPromptIds);
    }

    return topLevelPromptIds?.length || 0;
}

/**
 * Create the container for top-level prompts
 */
function createTopLevelContainer(promptList, promptIds) {
    // Remove existing container if any
    if (topLevelPromptsContainer) {
        topLevelPromptsContainer.remove();
        topLevelPromptsContainer = null;
    }

    // Also remove any orphaned top-level containers
    document.querySelectorAll('.nemo-top-level-section').forEach(el => {
        if (el !== topLevelPromptsContainer) {
            el.remove();
        }
    });

    // Create container element styled like a section
    topLevelPromptsContainer = document.createElement('details');
    topLevelPromptsContainer.className = 'nemo-engine-section nemo-top-level-section nemo-tray-section';
    topLevelPromptsContainer.dataset.trayConverted = 'true';
    topLevelPromptsContainer.open = false;
    topLevelPromptsContainer._nemoPromptIds = promptIds;

    // Create summary
    const summary = document.createElement('summary');
    summary.innerHTML = `
        <span class="completion_prompt_manager_prompt_name">
            <a>📌 Top Level Prompts</a>
        </span>
        <span class="nemo-section-count">(${promptIds.length})</span>
        <div class="nemo-section-progress-container">
            <div class="nemo-section-progress" style="width: 0%"></div>
        </div>
    `;

    // Create content area
    const content = document.createElement('div');
    content.className = 'nemo-section-content nemo-tray-hidden-content';

    topLevelPromptsContainer.appendChild(summary);
    topLevelPromptsContainer.appendChild(content);

    // Insert at the top of the prompt list
    promptList.insertBefore(topLevelPromptsContainer, promptList.firstChild);

    // Set up click handler for tray
    const clickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTray(topLevelPromptsContainer);
    };

    summary.addEventListener('click', clickHandler);
    summary._trayClickHandler = clickHandler;

    // Set up drop zone
    setupSectionDropZone(topLevelPromptsContainer, summary);

    // Update progress bar
    updateSectionProgressFromStoredIds(topLevelPromptsContainer);

    console.log('[NemoTray] Created top-level prompts container');
}

/**
 * Convert sections to tray mode (hide items, click to expand tray)
 * Works for both main sections and sub-sections that contain prompts
 * @returns {number} Number of sections converted
 */
function convertToTrayMode() {
    // Don't convert if sections feature is disabled
    if (!storage.getSectionsEnabled()) {
        console.log('[NemoTray] Sections disabled, skipping tray conversion');
        return 0;
    }

    // Target ALL sections (both main and sub-sections)
    const allSections = document.querySelectorAll('details.nemo-engine-section');

    console.log('[NemoTray] Found sections:', allSections.length);

    let converted = 0;

    allSections.forEach(section => {
        // Skip if already converted
        if (section.dataset.trayConverted === 'true') return;

        // Skip our top-level container (it's managed separately)
        if (section.classList.contains('nemo-top-level-section')) return;

        const summary = section.querySelector('summary');
        const content = section.querySelector('.nemo-section-content');
        if (!summary || !content) {
            console.log('[NemoTray] Missing summary or content for:', getSectionId(section));
            return;
        }

        const sectionName = getSectionId(section);

        // Check if this section has prompts in DOM
        const promptElements = content.querySelectorAll(':scope > li.completion_prompt_manager_prompt');
        const hasPromptsInDOM = promptElements.length > 0;

        // Check if we have cached data for this section (from previous conversion)
        const cachedPromptIds = sectionPromptIdsCache.get(sectionName);

        // Check if this section has sub-sections (parent section)
        const hasSubSections = content.querySelectorAll(':scope > details.nemo-engine-section').length > 0;

        // ALWAYS set up drop zone for all sections (so you can drag prompts INTO them)
        setupSectionDropZone(section, summary);

        // If no prompts in DOM and no cache, this section has no direct prompts
        // But still mark it as converted and set up basic structure for parent sections
        if (!hasPromptsInDOM && !cachedPromptIds) {
            console.log('[NemoTray] No direct prompts in section (parent with sub-sections only):', sectionName);

            // Mark as converted but with empty prompts
            section.dataset.trayConverted = 'true';
            section.classList.add('nemo-tray-section');
            section._nemoPromptIds = [];

            // Parent sections stay openable normally (no tray click handler)
            // Just set up for receiving drops
            converted++;
            return;
        }

        console.log('[NemoTray] Processing section:', sectionName, { hasPromptsInDOM, hasCachedData: !!cachedPromptIds });

        let sectionPromptIds;

        if (hasPromptsInDOM) {
            // Extract prompt identifiers from DOM (first time conversion)
            sectionPromptIds = [];
            promptElements.forEach(el => {
                const identifier = el.getAttribute('data-pm-identifier');
                const nameEl = el.querySelector('.completion_prompt_manager_prompt_name a');
                const name = nameEl?.textContent?.trim() || identifier;
                if (identifier) {
                    sectionPromptIds.push({ identifier, name });
                }
                // HIDE prompts instead of removing them (preserves DOM for mode switching)
                el.classList.add('nemo-tray-hidden-prompt');
            });

            // Store in persistent cache (survives DOM refreshes)
            sectionPromptIdsCache.set(sectionName, sectionPromptIds);
            console.log(`[NemoTray] Cached ${sectionPromptIds.length} prompt IDs for section:`, sectionName);
            console.log(`[NemoTray] Hidden ${promptElements.length} prompt DOM elements in:`, sectionName);
        } else if (cachedPromptIds) {
            // Restore from cache (DOM was refreshed by SillyTavern)
            sectionPromptIds = cachedPromptIds;
            console.log(`[NemoTray] Restored ${sectionPromptIds.length} prompt IDs from cache for:`, sectionName);
        } else {
            sectionPromptIds = [];
        }

        // Store on section element for quick access
        section._nemoPromptIds = sectionPromptIds;

        // Mark as converted
        section.dataset.trayConverted = 'true';
        section.classList.add('nemo-tray-section');
        content.classList.add('nemo-tray-hidden-content');

        // Update the section progress bar using stored prompt IDs
        // Update immediately and again after delays to catch ST overwrites
        updateSectionProgressFromStoredIds(section);
        setTimeout(() => updateSectionProgressFromStoredIds(section), 100);
        setTimeout(() => updateSectionProgressFromStoredIds(section), 500);

        // Create click handler
        const clickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[NemoTray] Clicked section:', getSectionId(section));
            toggleTray(section);
        };

        // Create keyboard handler for Enter/Space
        const keyHandler = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('[NemoTray] Keyboard activated section:', getSectionId(section));
                toggleTray(section);
            }
        };

        // Make summary focusable for keyboard navigation
        summary.setAttribute('tabindex', '0');
        summary.setAttribute('role', 'button');
        summary.setAttribute('aria-expanded', 'false');

        // Remove any existing listeners and add new ones
        summary.removeEventListener('click', summary._trayClickHandler);
        summary.removeEventListener('keydown', summary._trayKeyHandler);
        summary._trayClickHandler = clickHandler;
        summary._trayKeyHandler = keyHandler;
        summary.addEventListener('click', clickHandler);
        summary.addEventListener('keydown', keyHandler);

        // Note: Drop zone already set up earlier in convertToTrayMode

        // Keep section closed
        section.open = false;

        converted++;
    });

    if (converted > 0) {
        console.log('[NemoTray] Converted', converted, 'sections to tray mode');
    }

    // Also convert top-level prompts (outside sections) to prevent lag
    const topLevelCount = convertTopLevelPrompts();
    if (topLevelCount > 0) {
        console.log('[NemoTray] Converted', topLevelCount, 'top-level prompts');
    }

    return converted + topLevelCount;
}

// Track all section drop zone summaries
const sectionDropZones = new Set();

/**
 * Set up drop zone functionality on a section header
 * Allows dropping prompts onto closed sections to add them at the top
 * Uses HTML5 drag events for reliable detection
 * @param {HTMLElement} section - The section element
 * @param {HTMLElement} summary - The summary element
 */
function setupSectionDropZone(section, summary) {
    // Skip if already set up
    if (summary._dropZoneSetup) return;
    summary._dropZoneSetup = true;

    // Store section reference on summary for lookup during drop
    summary._nemoSection = section;

    // Add to tracking set
    sectionDropZones.add(summary);

    // Use HTML5 drag events for detection
    const dragOverHandler = (e) => {
        if (!currentlyDraggedPrompt) return;
        if (currentlyDraggedFromSection === section) return;

        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        summary.classList.add('nemo-drop-target-active');
        currentDropTarget = section;
    };

    const dragLeaveHandler = (e) => {
        // Check if leaving to a child element (still within summary)
        // relatedTarget is the element we're entering
        if (e.relatedTarget && summary.contains(e.relatedTarget)) {
            return; // Still within summary, don't clear
        }
        summary.classList.remove('nemo-drop-target-active');
        if (currentDropTarget === section) {
            currentDropTarget = null;
        }
    };

    const dropHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        summary.classList.remove('nemo-drop-target-active');
        // The actual move is handled in Sortable's onEnd
        // Just ensure the target is set
        if (currentlyDraggedPrompt && currentlyDraggedFromSection !== section) {
            currentDropTarget = section;
        }
    };

    summary.addEventListener('dragover', dragOverHandler);
    summary.addEventListener('dragleave', dragLeaveHandler);
    summary.addEventListener('drop', dropHandler);

    // Store handlers for cleanup
    summary._dragOverHandler = dragOverHandler;
    summary._dragLeaveHandler = dragLeaveHandler;
    summary._dropHandler = dropHandler;
}

/**
 * Move a prompt to the top of a target section
 * @param {string} identifier - Prompt identifier
 * @param {Object} promptData - Full prompt data object
 * @param {HTMLElement} fromSection - Source section
 * @param {HTMLElement} toSection - Destination section
 * @param {HTMLElement} fromTray - Source tray element (if open)
 */
async function movePromptToSectionTop(identifier, promptData, fromSection, toSection, fromTray) {
    if (!promptManager || !promptManager.activeCharacter) {
        console.warn('[NemoTray] Cannot move prompt: no active character');
        return;
    }

    try {
        const activeCharacter = promptManager.activeCharacter;
        const promptOrder = promptManager.getPromptOrderForCharacter(activeCharacter);

        if (!promptOrder || !Array.isArray(promptOrder)) {
            console.warn('[NemoTray] Cannot move prompt: invalid prompt order');
            return;
        }

        // Find and remove the prompt from its current position
        const currentIdx = promptOrder.findIndex(entry => entry.identifier === identifier);
        if (currentIdx === -1) {
            console.warn('[NemoTray] Cannot find prompt in order:', identifier);
            return;
        }

        const entry = promptOrder[currentIdx];
        promptOrder.splice(currentIdx, 1);

        // Find where to insert at the top of the target section
        // Get the first prompt in the target section
        const toSectionPrompts = toSection._nemoPromptIds || [];
        let insertIdx = promptOrder.length; // Default to end if section is empty

        if (toSectionPrompts.length > 0) {
            // Insert before the first prompt in the section
            const firstPromptId = toSectionPrompts[0]?.identifier;
            if (firstPromptId) {
                const firstIdx = promptOrder.findIndex(e => e.identifier === firstPromptId);
                if (firstIdx !== -1) {
                    insertIdx = firstIdx;
                }
            }
        }

        // Insert at the calculated position
        promptOrder.splice(insertIdx, 0, entry);

        // Save changes
        promptManager.saveServiceSettings();

        // Update cached prompt IDs for source section
        if (fromSection._nemoPromptIds) {
            fromSection._nemoPromptIds = fromSection._nemoPromptIds.filter(p => p.identifier !== identifier);
            sectionPromptIdsCache.set(getSectionId(fromSection), fromSection._nemoPromptIds);
        }

        // Update cached prompt IDs for destination section - add at top
        if (toSection._nemoPromptIds) {
            toSection._nemoPromptIds.unshift({ identifier: promptData.identifier, name: promptData.name });
        } else {
            toSection._nemoPromptIds = [{ identifier: promptData.identifier, name: promptData.name }];
        }
        sectionPromptIdsCache.set(getSectionId(toSection), toSection._nemoPromptIds);

        // Update progress bars
        updateSectionProgressFromStoredIds(fromSection);
        updateSectionProgressFromStoredIds(toSection);

        // If source tray is open, remove the card from it
        if (fromTray) {
            const card = fromTray.querySelector(`.nemo-prompt-card[data-identifier="${identifier}"]`);
            if (card) card.remove();

            // Update source tray's prompts array and footer
            const fromPrompts = fromTray._nemoPrompts;
            if (fromPrompts) {
                const idx = fromPrompts.findIndex(p => p.identifier === identifier);
                if (idx !== -1) fromPrompts.splice(idx, 1);
                updateTrayFooter(fromTray, fromPrompts);
            }
        }

        // If destination tray is open, refresh it to show the new prompt
        const toTray = toSection._nemoCategoryTray;
        if (toTray) {
            // Close and reopen to refresh
            closeTray(toSection);
            setTimeout(() => openTray(toSection), 50);
        }

        console.log('[NemoTray] Moved prompt', identifier, 'to top of', getSectionId(toSection));
    } catch (error) {
        console.error('[NemoTray] Error moving prompt to section top:', error);
    }
}

/**
 * Show the top-level drop zone when dragging starts
 * This allows users to drag prompts out of sections to make them top-level
 */
function showTopLevelDropZone() {
    // Remove existing if any
    hideTopLevelDropZone();

    // Find the prompt list container
    const promptList = document.querySelector('#completion_prompt_manager_list');
    if (!promptList) return;

    // Create the drop zone
    topLevelDropZone = document.createElement('div');
    topLevelDropZone.className = 'nemo-top-level-drop-zone';
    topLevelDropZone.innerHTML = `
        <div class="nemo-drop-zone-content">
            <i class="fa-solid fa-arrow-up"></i>
            <span>Drop here to make top-level prompt</span>
        </div>
    `;

    // Make it a valid drop target for HTML5 drag
    topLevelDropZone.setAttribute('draggable', 'false');

    // Use HTML5 drag events which fire during native drag
    topLevelDropZone.addEventListener('dragover', (e) => {
        if (!currentlyDraggedPrompt) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        topLevelDropZone.classList.add('nemo-drop-zone-active');
        isOverTopLevelDropZone = true;
    });

    topLevelDropZone.addEventListener('dragleave', (e) => {
        topLevelDropZone.classList.remove('nemo-drop-zone-active');
        isOverTopLevelDropZone = false;
    });

    topLevelDropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        topLevelDropZone.classList.remove('nemo-drop-zone-active');

        if (currentlyDraggedPrompt && currentlyDraggedFromSection) {
            console.log('[NemoTray] Drop on top-level zone detected');
            // The actual move is handled in Sortable's onEnd
            // Just ensure the flag is set
            isOverTopLevelDropZone = true;
        }
    });

    // Insert at the very top of the prompt list (after top-level container if exists)
    const firstSection = promptList.querySelector('details.nemo-engine-section');
    if (firstSection) {
        promptList.insertBefore(topLevelDropZone, firstSection);
    } else {
        promptList.insertBefore(topLevelDropZone, promptList.firstChild);
    }

    console.log('[NemoTray] Top-level drop zone shown');
}

/**
 * Hide the top-level drop zone
 */
function hideTopLevelDropZone() {
    if (topLevelDropZone) {
        topLevelDropZone.remove();
        topLevelDropZone = null;
    }
    isOverTopLevelDropZone = false;

    // Clear any section drop zone highlights
    sectionDropZones.forEach(summary => {
        summary.classList.remove('nemo-drop-target-active');
    });
    currentDropTarget = null;
}

/**
 * Move a prompt to our top-level prompts container
 * @param {string} identifier - Prompt identifier
 * @param {Object} promptData - Full prompt data object
 * @param {HTMLElement} fromSection - Source section
 * @param {HTMLElement} fromTray - Source tray element (if open)
 */
async function movePromptToTopLevel(identifier, promptData, fromSection, fromTray) {
    if (!promptManager || !promptManager.activeCharacter) {
        console.warn('[NemoTray] Cannot move prompt: no active character');
        return;
    }

    // Don't move if already in top-level
    if (fromSection === topLevelPromptsContainer || getSectionId(fromSection) === TOP_LEVEL_SECTION_ID) {
        console.log('[NemoTray] Prompt already in top-level, skipping move');
        return;
    }

    try {
        // Update cached prompt IDs for source section
        if (fromSection._nemoPromptIds) {
            fromSection._nemoPromptIds = fromSection._nemoPromptIds.filter(p => p.identifier !== identifier);
            sectionPromptIdsCache.set(getSectionId(fromSection), fromSection._nemoPromptIds);
        }

        // Add to top-level prompts cache (only if not already there)
        let topLevelPrompts = sectionPromptIdsCache.get(TOP_LEVEL_SECTION_ID) || [];
        const alreadyExists = topLevelPrompts.some(p => p.identifier === identifier);
        if (!alreadyExists) {
            topLevelPrompts.unshift({ identifier: promptData.identifier, name: promptData.name });
            sectionPromptIdsCache.set(TOP_LEVEL_SECTION_ID, topLevelPrompts);
        } else {
            console.log('[NemoTray] Prompt already exists in top-level cache, skipping add');
        }

        // Update the top-level container
        if (topLevelPromptsContainer) {
            topLevelPromptsContainer._nemoPromptIds = topLevelPrompts;
            updateSectionProgressFromStoredIds(topLevelPromptsContainer);

            // Update the count display
            const countSpan = topLevelPromptsContainer.querySelector('.nemo-section-count');
            if (countSpan) {
                countSpan.textContent = `(${topLevelPrompts.length})`;
            }

            // If top-level tray is open, refresh it
            if (topLevelPromptsContainer._nemoCategoryTray) {
                closeTray(topLevelPromptsContainer);
                setTimeout(() => openTray(topLevelPromptsContainer), 50);
            }
        } else {
            // Create the container if it doesn't exist
            const promptList = document.querySelector('#completion_prompt_manager_list');
            if (promptList) {
                createTopLevelContainer(promptList, topLevelPrompts);
            }
        }

        // Update progress bar for source section
        updateSectionProgressFromStoredIds(fromSection);

        // If source tray is open, remove the card from it
        if (fromTray) {
            const card = fromTray.querySelector(`.nemo-prompt-card[data-identifier="${identifier}"]`);
            if (card) card.remove();

            // Update source tray's prompts array and footer
            const fromPrompts = fromTray._nemoPrompts;
            if (fromPrompts) {
                const idx = fromPrompts.findIndex(p => p.identifier === identifier);
                if (idx !== -1) fromPrompts.splice(idx, 1);
                updateTrayFooter(fromTray, fromPrompts);
            }
        }

        console.log('[NemoTray] Moved prompt', identifier, 'to top-level');

        // Trigger a UI refresh to show the prompt in the list
        // The prompt should now appear as a top-level item after ST refreshes
    } catch (error) {
        console.error('[NemoTray] Error moving prompt to top-level:', error);
    }
}

/**
 * Toggle the tray for a section
 */
function toggleTray(section) {
    const sectionId = getSectionId(section);
    // Check stored reference instead of querySelector (tray is sibling, not child)
    const existingTray = section._nemoCategoryTray;

    if (existingTray) {
        closeTray(section);
    } else {
        openTray(section);
    }
}

/**
 * Get unique ID for a section
 */
function getSectionId(section) {
    const summary = section.querySelector('summary');
    const nameSpan = summary?.querySelector('.completion_prompt_manager_prompt_name a');
    return nameSpan?.textContent?.trim() || 'unknown';
}

/**
 * Open the tray for a section
 */
function openTray(section) {
    const sectionId = getSectionId(section);
    console.log('[NemoTray] openTray called for:', sectionId);

    // Prevent duplicate trays - check if one already exists or is closing
    if (section._nemoCategoryTray) {
        console.log('[NemoTray] Tray already exists for:', sectionId);
        return;
    }
    if (section._nemoTrayClosing) {
        console.log('[NemoTray] Tray is closing for:', sectionId);
        return;
    }

    // Get prompts from stored mapping (DOM elements were removed for performance)
    const storedPromptIds = section._nemoPromptIds;
    if (!storedPromptIds || storedPromptIds.length === 0) {
        console.log('[NemoTray] No stored prompt IDs for section:', sectionId);
        return;
    }

    const prompts = [];

    storedPromptIds.forEach(({ identifier, name }) => {
        // Get enabled state from promptManager data (the source of truth)
        let isEnabled = false;
        if (promptManager) {
            try {
                const activeCharacter = promptManager.activeCharacter;
                const promptOrderEntry = promptManager.getPromptOrderEntry(activeCharacter, identifier);
                isEnabled = promptOrderEntry?.enabled || false;
            } catch (e) {
                // Fallback to disabled if promptManager fails
                isEnabled = false;
            }
        }

        // Get directives from cache (fast - no content parsing needed)
        const cachedDirectives = getCachedDirectives(identifier) || {};
        const tooltip = cachedDirectives.tooltip || '';
        const badge = cachedDirectives.badge || null;
        const color = cachedDirectives.color || null;
        const highlight = cachedDirectives.highlight || false;
        // Dependency directives for visual indicators
        const requires = cachedDirectives.requires || [];
        const exclusiveWith = cachedDirectives.exclusiveWith || [];
        const conflictsWith = cachedDirectives.conflictsWith || [];

        prompts.push({
            identifier, name, isEnabled, tooltip, badge, color, highlight,
            requires, exclusiveWith, conflictsWith
        });
    });

    // Get compact view state for this section
    const isCompact = compactViewState.get(sectionId) || false;

    // Create tray HTML
    const tray = document.createElement('div');
    tray.className = `nemo-category-tray ${isCompact ? 'nemo-tray-compact' : ''}`;
    tray.setAttribute('tabindex', '0'); // Make tray focusable for keyboard nav

    const enabledCount = prompts.filter(p => p.isEnabled).length;
    const allEnabled = enabledCount === prompts.length;

    // Get presets for this section
    const sectionPresets = getPresetsForSection(sectionId);
    const hasPresets = sectionPresets.length > 0;

    let trayContent = `
        <div class="nemo-tray-header">
            <span class="nemo-tray-title">${escapeHtml(sectionId)}</span>
            <div class="nemo-tray-header-controls">
                <button class="nemo-tray-compact-toggle ${isCompact ? 'nemo-compact-active' : ''}" title="${isCompact ? 'Card View' : 'Compact View'}">
                    <i class="fa-solid ${isCompact ? 'fa-th-large' : 'fa-list'}"></i>
                </button>
                <div class="nemo-tray-presets-dropdown">
                    <button class="nemo-tray-presets-btn" title="Presets">
                        <i class="fa-solid fa-bookmark"></i>
                        ${hasPresets ? `<span class="nemo-preset-count">${sectionPresets.length}</span>` : ''}
                    </button>
                    <div class="nemo-presets-menu">
                        <div class="nemo-presets-header">Presets</div>
                        <button class="nemo-preset-save" title="Save current selection as preset">
                            <i class="fa-solid fa-plus"></i> Save Current
                        </button>
                        ${sectionPresets.length > 0 ? `
                            <div class="nemo-presets-divider"></div>
                            <div class="nemo-presets-list">
                                ${sectionPresets.map(p => `
                                    <div class="nemo-preset-item" data-preset-key="${escapeHtml(p.key)}">
                                        <span class="nemo-preset-name">${escapeHtml(p.name)}</span>
                                        <span class="nemo-preset-info">${p.enabledPrompts.length} prompts</span>
                                        <button class="nemo-preset-delete" title="Delete preset">
                                            <i class="fa-solid fa-trash fa-xs"></i>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<div class="nemo-presets-empty">No saved presets</div>'}
                    </div>
                </div>
                <button class="nemo-tray-toggle-all ${allEnabled ? 'nemo-all-enabled' : ''}" title="${allEnabled ? 'Disable All' : 'Enable All'}">
                    ${allEnabled ? '☑' : '☐'} All
                </button>
                <button class="nemo-tray-close" title="Close (Esc)">&times;</button>
            </div>
        </div>
        <div class="nemo-tray-grid">
    `;

    // Show all prompts as cards with tooltips and directive styling
    prompts.forEach((p, index) => {
        const enabledClass = p.isEnabled ? 'nemo-prompt-card-enabled' : '';
        const highlightClass = p.highlight ? 'nemo-prompt-card-highlighted' : '';
        // Escape identifier for use in data attribute
        const safeIdentifier = escapeHtml(p.identifier);

        // Build inline styles for color
        let cardStyle = '';
        if (p.color) {
            cardStyle = `style="--nemo-card-color: ${escapeHtml(p.color)}; border-left: 4px solid ${escapeHtml(p.color)};"`;
        }

        // Build badge HTML if present
        let badgeHtml = '';
        if (p.badge) {
            const badgeBg = p.color || '#4A9EFF';
            badgeHtml = `<span class="nemo-prompt-card-badge" style="background: ${escapeHtml(badgeBg)};">${escapeHtml(p.badge)}</span>`;
        }

        // Build dependency indicators
        let depIndicatorsHtml = '';
        const hasDeps = p.requires.length > 0 || p.exclusiveWith.length > 0 || p.conflictsWith.length > 0;
        if (hasDeps) {
            depIndicatorsHtml = '<div class="nemo-prompt-card-deps">';
            if (p.requires.length > 0) {
                depIndicatorsHtml += `<span class="nemo-dep-requires" title="Requires: ${escapeHtml(p.requires.join(', '))}"><i class="fa-solid fa-link fa-xs"></i></span>`;
            }
            if (p.exclusiveWith.length > 0) {
                depIndicatorsHtml += `<span class="nemo-dep-exclusive" title="Exclusive with: ${escapeHtml(p.exclusiveWith.join(', '))}"><i class="fa-solid fa-code-branch fa-xs"></i></span>`;
            }
            if (p.conflictsWith.length > 0) {
                depIndicatorsHtml += `<span class="nemo-dep-conflicts" title="Conflicts with: ${escapeHtml(p.conflictsWith.join(', '))}"><i class="fa-solid fa-triangle-exclamation fa-xs"></i></span>`;
            }
            depIndicatorsHtml += '</div>';
        }

        trayContent += `
            <div class="nemo-prompt-card ${enabledClass} ${highlightClass} ${hasDeps ? 'nemo-has-deps' : ''}"
                 data-identifier="${safeIdentifier}"
                 data-index="${index}"
                 data-requires="${escapeHtml(JSON.stringify(p.requires))}"
                 data-exclusive="${escapeHtml(JSON.stringify(p.exclusiveWith))}"
                 data-conflicts="${escapeHtml(JSON.stringify(p.conflictsWith))}"
                 ${cardStyle}>
                <div class="nemo-prompt-card-drag-handle" title="Drag to reorder">
                    <i class="fa-solid fa-grip-vertical"></i>
                </div>
                <div class="nemo-prompt-card-content">
                    <div class="nemo-prompt-card-header">
                        <span class="nemo-prompt-card-name">${escapeHtml(p.name)}${badgeHtml}</span>
                        <div class="nemo-prompt-card-actions">
                            ${depIndicatorsHtml}
                            <span class="nemo-prompt-card-move" title="Move to another section">
                                <i class="fa-solid fa-folder-arrow-down fa-xs"></i>
                            </span>
                            <span class="nemo-prompt-card-edit" title="Preview content">
                                <i class="fa-solid fa-eye fa-xs"></i>
                            </span>
                            <span class="nemo-prompt-card-status">${p.isEnabled ? '✓' : ''}</span>
                        </div>
                    </div>
                    <div class="nemo-prompt-card-meta">
                        <span class="nemo-prompt-card-tokens" title="Token count">
                            <i class="fa-solid fa-coins fa-xs"></i>
                            <span class="nemo-token-value">...</span>
                        </span>
                        ${p.tooltip ? `<span class="nemo-prompt-card-tooltip-text">${escapeHtml(p.tooltip)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    });

    trayContent += `
        </div>
        <div class="nemo-tray-footer">
            <span class="nemo-tray-hint">Click to toggle • Drag ≡ to reorder • ${prompts.filter(p => p.isEnabled).length}/${prompts.length} active</span>
        </div>
    `;

    tray.innerHTML = trayContent;

    // Initialize drag-and-drop reordering for tray cards
    const trayGrid = tray.querySelector('.nemo-tray-grid');
    if (trayGrid && typeof Sortable !== 'undefined') {
        // Store section reference on tray for cross-tray moves
        tray._nemoSection = section;
        tray._nemoPrompts = prompts;

        new Sortable(trayGrid, {
            animation: 0, // Disable animation for performance
            handle: '.nemo-prompt-card-drag-handle',
            group: 'nemo-tray-prompts', // Enable cross-tray dragging
            ghostClass: 'nemo-tray-card-ghost',
            forceFallback: false, // Use native drag (we use global mousemove for drop detection)
            onStart: (evt) => {
                // Set dragging flag to pause updates
                isDragging = true;

                // Track the dragged item for drop-on-section functionality
                const item = evt.item;
                const identifier = item.dataset.identifier;
                const promptData = prompts.find(p => p.identifier === identifier);

                currentlyDraggedPrompt = promptData;
                currentlyDraggedFromSection = section;
                currentlyDraggedFromTray = tray;

                // Show top-level drop zone
                showTopLevelDropZone();

                console.log('[NemoTray] Started dragging:', identifier);
            },
            onEnd: async (evt) => {
                const { from, to, oldIndex, newIndex, item } = evt;

                // Hide top-level drop zone
                hideTopLevelDropZone();

                // Get the source and destination trays
                const fromTray = from.closest('.nemo-category-tray');
                const toTray = to.closest('.nemo-category-tray');
                const fromSection = fromTray?._nemoSection;
                const toSection = toTray?._nemoSection;
                const fromPrompts = fromTray?._nemoPrompts;
                const toPrompts = toTray?._nemoPrompts;

                const identifier = item.dataset.identifier;

                // Check if dropped on top-level drop zone
                if (isOverTopLevelDropZone && currentlyDraggedPrompt) {
                    console.log('[NemoTray] Dropping to top-level');

                    await movePromptToTopLevel(
                        currentlyDraggedPrompt.identifier,
                        currentlyDraggedPrompt,
                        currentlyDraggedFromSection,
                        currentlyDraggedFromTray
                    );

                    // Remove the item from the tray
                    item.remove();

                    // Clear drag state
                    isDragging = false;
                    currentlyDraggedPrompt = null;
                    currentlyDraggedFromSection = null;
                    currentlyDraggedFromTray = null;
                    currentDropTarget = null;
                    isOverTopLevelDropZone = false;
                    return;
                }

                // Check if dropped on a section header (via mouse hover)
                if (currentDropTarget && currentlyDraggedPrompt && currentlyDraggedFromSection !== currentDropTarget) {
                    console.log('[NemoTray] Dropping on section header:', getSectionId(currentDropTarget));

                    // Move to top of target section
                    await movePromptToSectionTop(
                        currentlyDraggedPrompt.identifier,
                        currentlyDraggedPrompt,
                        currentlyDraggedFromSection,
                        currentDropTarget,
                        currentlyDraggedFromTray
                    );

                    // Remove the item from the source tray
                    item.remove();

                    // Update source tray's prompts array and footer
                    if (currentlyDraggedFromTray && currentlyDraggedFromTray._nemoPrompts) {
                        const fromPrompts = currentlyDraggedFromTray._nemoPrompts;
                        const idx = fromPrompts.findIndex(p => p.identifier === currentlyDraggedPrompt.identifier);
                        if (idx !== -1) fromPrompts.splice(idx, 1);
                        updateTrayFooter(currentlyDraggedFromTray, fromPrompts);
                    }

                    // Clear drop target visual
                    document.querySelectorAll('.nemo-drop-target-active').forEach(el => {
                        el.classList.remove('nemo-drop-target-active');
                    });

                    // Clear drag state
                    isDragging = false;
                    currentlyDraggedPrompt = null;
                    currentlyDraggedFromSection = null;
                    currentlyDraggedFromTray = null;
                    currentDropTarget = null;
                    return; // Skip normal Sortable handling
                }

                // Clear drop target if any
                currentDropTarget = null;

                if (fromTray !== toTray && fromSection && toSection && identifier) {
                    // Cross-tray move - update both sections
                    console.log('[NemoTray] Cross-tray move:', identifier, 'from', getSectionId(fromSection), 'to', getSectionId(toSection));

                    // Find the prompt data
                    const movedPromptData = fromPrompts?.find(p => p.identifier === identifier);

                    if (movedPromptData) {
                        // Remove from source prompts array
                        const sourceIdx = fromPrompts.findIndex(p => p.identifier === identifier);
                        if (sourceIdx !== -1) {
                            fromPrompts.splice(sourceIdx, 1);
                        }

                        // Add to destination prompts array
                        if (toPrompts) {
                            toPrompts.splice(newIndex, 0, movedPromptData);
                        }

                        // Move in SillyTavern's prompt order
                        await movePromptBetweenSectionsFromTray(identifier, fromSection, toSection, newIndex, toPrompts);

                        // Update cached prompt IDs for both sections
                        if (fromSection._nemoPromptIds) {
                            fromSection._nemoPromptIds = fromSection._nemoPromptIds.filter(p => p.identifier !== identifier);
                            sectionPromptIdsCache.set(getSectionId(fromSection), fromSection._nemoPromptIds);
                        }
                        if (toSection._nemoPromptIds && movedPromptData) {
                            toSection._nemoPromptIds.splice(newIndex, 0, { identifier: movedPromptData.identifier, name: movedPromptData.name });
                            sectionPromptIdsCache.set(getSectionId(toSection), toSection._nemoPromptIds);
                        }

                        // Update progress bars for both sections
                        updateSectionProgressFromStoredIds(fromSection);
                        updateSectionProgressFromStoredIds(toSection);

                        // Update tray footers
                        updateTrayFooter(fromTray, fromPrompts);
                        updateTrayFooter(toTray, toPrompts);
                    }
                } else if (oldIndex !== newIndex && fromPrompts) {
                    // Same-tray reorder
                    const [movedPrompt] = fromPrompts.splice(oldIndex, 1);
                    fromPrompts.splice(newIndex, 0, movedPrompt);

                    // Update SillyTavern's prompt order
                    reorderPromptsInSection(fromSection, fromPrompts.map(p => p.identifier));

                    console.log('[NemoTray] Reordered prompt from', oldIndex, 'to', newIndex);
                }

                // Update data-index attributes in the destination tray
                to.querySelectorAll('.nemo-prompt-card').forEach((card, i) => {
                    card.dataset.index = i;
                });

                // Also update source tray if different
                if (from !== to) {
                    from.querySelectorAll('.nemo-prompt-card').forEach((card, i) => {
                        card.dataset.index = i;
                    });
                }

                // Clear drag state
                isDragging = false;
                currentlyDraggedPrompt = null;
                currentlyDraggedFromSection = null;
                currentlyDraggedFromTray = null;
            }
        });
    }

    // Track currently focused card index for keyboard nav
    let focusedIndex = -1;

    // Helper to update visual focus
    const updateFocusedCard = (newIndex) => {
        const cards = tray.querySelectorAll('.nemo-prompt-card');
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= cards.length) newIndex = cards.length - 1;

        cards.forEach((card, i) => {
            card.classList.toggle('nemo-card-focused', i === newIndex);
        });
        focusedIndex = newIndex;

        // Scroll focused card into view
        if (cards[newIndex]) {
            cards[newIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    };

    // Helper to highlight related prompts on hover/focus
    const highlightRelated = (card, highlight) => {
        const requires = JSON.parse(card.dataset.requires || '[]');
        const exclusive = JSON.parse(card.dataset.exclusive || '[]');
        const conflicts = JSON.parse(card.dataset.conflicts || '[]');

        tray.querySelectorAll('.nemo-prompt-card').forEach(otherCard => {
            const otherId = otherCard.dataset.identifier;
            if (highlight) {
                if (requires.includes(otherId)) {
                    otherCard.classList.add('nemo-related-required');
                }
                if (exclusive.includes(otherId)) {
                    otherCard.classList.add('nemo-related-exclusive');
                }
                if (conflicts.includes(otherId)) {
                    otherCard.classList.add('nemo-related-conflict');
                }
            } else {
                otherCard.classList.remove('nemo-related-required', 'nemo-related-exclusive', 'nemo-related-conflict');
            }
        });
    };

    // Helper to update tray UI state (counter, toggle-all button, progress bar)
    const updateTrayState = () => {
        const enabledCount = prompts.filter(p => p.isEnabled).length;
        const allEnabled = enabledCount === prompts.length;

        // Update footer counter
        const footer = tray.querySelector('.nemo-tray-hint');
        if (footer) {
            footer.textContent = `Click to toggle • ↑↓←→ Navigate • Space/Enter Toggle • ${enabledCount}/${prompts.length} active`;
        }

        // Update toggle-all button
        const toggleAllBtn = tray.querySelector('.nemo-tray-toggle-all');
        if (toggleAllBtn) {
            toggleAllBtn.classList.toggle('nemo-all-enabled', allEnabled);
            toggleAllBtn.innerHTML = `${allEnabled ? '☑' : '☐'} All`;
            toggleAllBtn.title = allEnabled ? 'Disable All' : 'Enable All';
        }

        // Update progress bar on section
        updateSectionProgressBar(section, enabledCount, prompts.length);
    };

    // Compact view toggle handler
    tray.querySelector('.nemo-tray-compact-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        const newCompact = !tray.classList.contains('nemo-tray-compact');
        tray.classList.toggle('nemo-tray-compact', newCompact);
        compactViewState.set(sectionId, newCompact);

        const btn = tray.querySelector('.nemo-tray-compact-toggle');
        btn.classList.toggle('nemo-compact-active', newCompact);
        btn.title = newCompact ? 'Card View' : 'Compact View';
        btn.innerHTML = `<i class="fa-solid ${newCompact ? 'fa-th-large' : 'fa-list'}"></i>`;
    });

    // Presets dropdown toggle
    const presetsBtn = tray.querySelector('.nemo-tray-presets-btn');
    const presetsMenu = tray.querySelector('.nemo-presets-menu');
    presetsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        presetsMenu.classList.toggle('nemo-presets-open');
    });

    // Save preset handler
    tray.querySelector('.nemo-preset-save').addEventListener('click', async (e) => {
        e.stopPropagation();
        presetsMenu.classList.remove('nemo-presets-open');

        const enabledPrompts = prompts.filter(p => p.isEnabled);
        const name = await showPresetNameModal(sectionId, enabledPrompts.length);

        if (name) {
            savePreset(name, sectionId, enabledPrompts.map(p => p.identifier));
            // Refresh tray to show new preset
            closeTray(section);
            setTimeout(() => openTray(section), 50);
        }
    });

    // Load preset handlers
    // Note: Uses performToggle directly since loading a preset is an explicit user choice
    tray.querySelectorAll('.nemo-preset-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.nemo-preset-delete')) return; // Don't load if clicking delete
            e.stopPropagation();
            const presetKey = item.dataset.presetKey;
            const preset = loadPreset(presetKey);
            if (preset) {
                // Apply preset - disable all, then enable preset prompts (skip validation)
                prompts.forEach(p => {
                    const shouldEnable = preset.enabledPrompts.includes(p.identifier);
                    if (p.isEnabled !== shouldEnable) {
                        performToggle(p.identifier, shouldEnable);
                        p.isEnabled = shouldEnable;
                    }
                });

                // Update all cards visually
                tray.querySelectorAll('.nemo-prompt-card').forEach(card => {
                    const identifier = card.dataset.identifier;
                    const prompt = prompts.find(p => p.identifier === identifier);
                    if (prompt?.isEnabled) {
                        card.classList.add('nemo-prompt-card-enabled');
                        card.querySelector('.nemo-prompt-card-status').textContent = '✓';
                    } else {
                        card.classList.remove('nemo-prompt-card-enabled');
                        card.querySelector('.nemo-prompt-card-status').textContent = '';
                    }
                });

                updateTrayState();
                presetsMenu.classList.remove('nemo-presets-open');
                logger.info(`Loaded preset: ${preset.name}`);
            }
        });
    });

    // Delete preset handlers
    tray.querySelectorAll('.nemo-preset-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.nemo-preset-item');
            const presetKey = item.dataset.presetKey;
            if (confirm('Delete this preset?')) {
                deletePreset(presetKey);
                item.remove();
                // Update count badge
                const remaining = tray.querySelectorAll('.nemo-preset-item').length;
                const countBadge = tray.querySelector('.nemo-preset-count');
                if (countBadge) {
                    if (remaining > 0) {
                        countBadge.textContent = remaining;
                    } else {
                        countBadge.remove();
                    }
                }
                if (remaining === 0) {
                    const list = tray.querySelector('.nemo-presets-list');
                    const divider = tray.querySelector('.nemo-presets-divider');
                    if (list) list.remove();
                    if (divider) divider.remove();
                    const menu = tray.querySelector('.nemo-presets-menu');
                    menu.insertAdjacentHTML('beforeend', '<div class="nemo-presets-empty">No saved presets</div>');
                }
            }
        });
    });

    // Add event handlers
    tray.querySelector('.nemo-tray-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTray(section);
    });

    // Toggle-all button handler
    // Note: Uses performToggle directly to skip individual validation popups
    // (user explicitly wants all enabled/disabled - showing 20 popups would be bad UX)
    tray.querySelector('.nemo-tray-toggle-all').addEventListener('click', (e) => {
        e.stopPropagation();
        const enabledCount = prompts.filter(p => p.isEnabled).length;
        const newState = enabledCount < prompts.length; // Enable all if not all enabled, else disable all

        // Toggle all prompts (skip validation for bulk action)
        prompts.forEach(p => {
            if (p.isEnabled !== newState) {
                performToggle(p.identifier, newState);
                p.isEnabled = newState;
            }
        });

        // Update all cards visually
        tray.querySelectorAll('.nemo-prompt-card').forEach(card => {
            if (newState) {
                card.classList.add('nemo-prompt-card-enabled');
                card.querySelector('.nemo-prompt-card-status').textContent = '✓';
            } else {
                card.classList.remove('nemo-prompt-card-enabled');
                card.querySelector('.nemo-prompt-card-status').textContent = '';
            }
        });

        updateTrayState();
    });

    // Click on prompt cards to toggle
    tray.querySelectorAll('.nemo-prompt-card').forEach(card => {
        // Hover handlers for dependency highlighting
        card.addEventListener('mouseenter', () => highlightRelated(card, true));
        card.addEventListener('mouseleave', () => highlightRelated(card, false));

        card.addEventListener('click', (e) => {
            e.stopPropagation();
            const identifier = card.dataset.identifier;
            const prompt = prompts.find(p => p.identifier === identifier);
            if (prompt) {
                const newState = !prompt.isEnabled;

                // Helper to update card UI
                const updateCardUI = (enabled) => {
                    prompt.isEnabled = enabled;
                    if (enabled) {
                        card.classList.add('nemo-prompt-card-enabled');
                        card.querySelector('.nemo-prompt-card-status').textContent = '✓';
                    } else {
                        card.classList.remove('nemo-prompt-card-enabled');
                        card.querySelector('.nemo-prompt-card-status').textContent = '';
                    }
                    updateTrayState();
                };

                // Toggle with validation - pass callback for async validation result
                const toggleSuccessful = togglePrompt(identifier, newState, (cancelled) => {
                    // This callback is called when validation popup is resolved
                    if (!cancelled) {
                        // User proceeded - update UI to enabled state
                        updateCardUI(true);
                    }
                    // If cancelled, UI stays as-is (disabled)
                });

                // If toggle was immediately successful (no validation needed or disabling)
                if (toggleSuccessful) {
                    updateCardUI(newState);
                }
                // If not successful, we're waiting for user decision via callback
            }
        });

        // Preview button click handler
        const editBtn = card.querySelector('.nemo-prompt-card-edit');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't trigger card toggle
                const identifier = card.dataset.identifier;
                const prompt = prompts.find(p => p.identifier === identifier);
                if (prompt) {
                    showPromptPreview(identifier, prompt.name);
                }
            });
        }

        // Move button click handler
        const moveBtn = card.querySelector('.nemo-prompt-card-move');
        if (moveBtn) {
            moveBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't trigger card toggle
                const identifier = card.dataset.identifier;
                const prompt = prompts.find(p => p.identifier === identifier);
                if (prompt) {
                    // Create a synthetic event at the button position for menu placement
                    const rect = moveBtn.getBoundingClientRect();
                    const syntheticEvent = {
                        preventDefault: () => {},
                        stopPropagation: () => {},
                        clientX: rect.left,
                        clientY: rect.bottom + 5
                    };
                    showPromptMoveContextMenu(syntheticEvent, prompt, section, tray, card);
                }
            });
        }

        // Right-click context menu for moving prompts
        card.addEventListener('contextmenu', (e) => {
            const identifier = card.dataset.identifier;
            const prompt = prompts.find(p => p.identifier === identifier);
            if (prompt) {
                showPromptMoveContextMenu(e, prompt, section, tray, card);
            }
        });

        // Load token count asynchronously
        const tokenSpan = card.querySelector('.nemo-token-value');
        if (tokenSpan) {
            const identifier = card.dataset.identifier;
            loadPromptTokenCount(identifier).then(count => {
                if (tokenSpan && document.body.contains(tokenSpan)) {
                    tokenSpan.textContent = count !== null ? count.toLocaleString() : '?';
                }
            });
        }
    });

    // Keyboard navigation handler
    // Uses capture phase and stopImmediatePropagation to prevent ST swipe handlers
    const keyHandler = (e) => {
        // Only handle if tray is still in DOM and focused
        if (!document.body.contains(tray)) return;

        const cards = tray.querySelectorAll('.nemo-prompt-card');
        const grid = tray.querySelector('.nemo-tray-grid');
        const isCompact = tray.classList.contains('nemo-tray-compact');

        // Calculate columns based on grid layout
        const gridWidth = grid.offsetWidth;
        const cardWidth = cards[0]?.offsetWidth || 180;
        const columns = isCompact ? 1 : Math.max(1, Math.floor(gridWidth / cardWidth));

        // Helper to block event from reaching ST
        const blockEvent = () => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };

        switch (e.key) {
            case 'Escape':
                blockEvent();
                closeTray(section);
                document.removeEventListener('keydown', keyHandler, true);
                break;
            case 'ArrowDown':
                blockEvent();
                updateFocusedCard(focusedIndex + columns);
                break;
            case 'ArrowUp':
                blockEvent();
                updateFocusedCard(focusedIndex - columns);
                break;
            case 'ArrowRight':
                blockEvent();
                updateFocusedCard(focusedIndex + 1);
                break;
            case 'ArrowLeft':
                blockEvent();
                updateFocusedCard(focusedIndex - 1);
                break;
            case ' ':
            case 'Enter':
                blockEvent();
                if (focusedIndex >= 0 && focusedIndex < cards.length) {
                    cards[focusedIndex].click();
                }
                break;
            case 'Home':
                blockEvent();
                updateFocusedCard(0);
                break;
            case 'End':
                blockEvent();
                updateFocusedCard(cards.length - 1);
                break;
        }
    };

    // Use capture phase to intercept before ST handlers
    document.addEventListener('keydown', keyHandler, true);
    tray._keyHandler = keyHandler;

    // Insert tray AFTER the details element (not inside it, since details is closed)
    section.after(tray);

    // Store reference to associated tray on section
    section._nemoCategoryTray = tray;

    // Mark section as having open tray
    section.classList.add('nemo-tray-open');

    // Update aria-expanded for accessibility
    const summary = section.querySelector('summary');
    if (summary) summary.setAttribute('aria-expanded', 'true');

    // Focus tray for keyboard navigation
    tray.focus();

    console.log('[NemoTray] Tray inserted after section, tray element:', tray);

    // Add click-outside handler to close tray
    // Note: Don't close if clicking on another tray (for cross-tray dragging)
    const closeOnOutsideClick = (e) => {
        const clickedInTray = tray.contains(e.target);
        const clickedOnSection = section.contains(e.target);
        const clickedOnAnotherTray = e.target.closest('.nemo-category-tray');
        const clickedOnAnotherSection = e.target.closest('.nemo-tray-section');

        // Don't close if clicked in this tray, on this section, or on any other tray/section
        if (!clickedInTray && !clickedOnSection && !clickedOnAnotherTray && !clickedOnAnotherSection) {
            closeTray(section);
            document.removeEventListener('click', closeOnOutsideClick);
        }
    };
    // Delay adding the listener to avoid immediate trigger
    setTimeout(() => {
        document.addEventListener('click', closeOnOutsideClick);
    }, 10);
    // Store reference so we can remove it on manual close
    tray._closeHandler = closeOnOutsideClick;

    trayModeEnabled.add(sectionId);
    logger.info(`Opened tray for: ${sectionId}`);
}

/**
 * Close the tray for a section
 */
function closeTray(section) {
    const sectionId = getSectionId(section);
    // Get tray from stored reference (since it's a sibling, not child)
    const tray = section._nemoCategoryTray;

    // Prevent double-closing
    if (section._nemoTrayClosing) {
        return;
    }

    if (tray) {
        // Set closing flag to prevent race conditions
        section._nemoTrayClosing = true;

        // Remove click-outside handler
        if (tray._closeHandler) {
            document.removeEventListener('click', tray._closeHandler);
        }
        // Remove keyboard handler (must match capture flag)
        if (tray._keyHandler) {
            document.removeEventListener('keydown', tray._keyHandler, true);
        }
        tray.classList.add('nemo-tray-closing');

        // Clear reference immediately to prevent toggleTray confusion
        delete section._nemoCategoryTray;

        setTimeout(() => {
            tray.remove();
            delete section._nemoTrayClosing;
        }, 200);
    }

    section.classList.remove('nemo-tray-open');

    // Update aria-expanded for accessibility
    const summary = section.querySelector('summary');
    if (summary) summary.setAttribute('aria-expanded', 'false');

    trayModeEnabled.delete(sectionId);
}

/**
 * Refresh the tray content (after toggle)
 */
function refreshTray(section) {
    closeTray(section);
    setTimeout(() => openTray(section), 50);
}

/**
 * Toggle a prompt's enabled state with dependency validation
 * @param {string} identifier - Prompt identifier
 * @param {boolean} enabled - New enabled state
 * @param {Function} [onValidationFailed] - Optional callback when validation fails (receives boolean: true if cancelled)
 * @returns {boolean} Whether the toggle was immediately successful (false if waiting for user decision)
 */
function togglePrompt(identifier, enabled, onValidationFailed = null) {
    if (!promptManager) return false;

    try {
        // Only validate when ENABLING a prompt
        if (enabled) {
            const allPrompts = getAllPromptsWithState();
            const issues = validatePromptActivation(identifier, allPrompts);

            if (issues.length > 0) {
                const hasErrors = issues.some(i => i.severity === 'error');

                // Show conflict toast and let user decide
                showConflictToast(issues, identifier, (proceed) => {
                    if (proceed) {
                        // User chose to proceed - handle auto-resolution if applicable
                        handleAutoResolution(issues, identifier);
                        performToggle(identifier, true);
                    }
                    // Call the callback to update UI
                    if (onValidationFailed) {
                        onValidationFailed(!proceed);
                    }
                });
                return false; // Don't toggle yet - waiting for user decision
            }
        }

        // No validation issues or disabling - proceed with toggle
        performToggle(identifier, enabled);
        return true;
    } catch (error) {
        logger.error('Error toggling prompt:', error);
        return false;
    }
}

/**
 * Perform the actual toggle operation (no validation)
 * @param {string} identifier - Prompt identifier
 * @param {boolean} enabled - New enabled state
 */
function performToggle(identifier, enabled) {
    if (!promptManager) return;

    try {
        const activeCharacter = promptManager.activeCharacter;
        const promptOrderEntry = promptManager.getPromptOrderEntry(activeCharacter, identifier);

        if (promptOrderEntry) {
            promptOrderEntry.enabled = enabled;
            promptManager.saveServiceSettings();
            logger.info(`Toggled prompt ${identifier} to ${enabled}`);
        }
    } catch (error) {
        logger.error('Error performing toggle:', error);
    }
}

/**
 * Reorder prompts within a section by updating SillyTavern's prompt order
 * @param {HTMLElement} section - The section element
 * @param {string[]} newOrder - Array of prompt identifiers in new order
 */
function reorderPromptsInSection(section, newOrder) {
    if (!promptManager || !promptManager.activeCharacter) {
        console.warn('[NemoTray] Cannot reorder: no active character');
        return;
    }

    try {
        const activeCharacter = promptManager.activeCharacter;
        const promptOrder = promptManager.getPromptOrderForCharacter(activeCharacter);

        if (!promptOrder || !Array.isArray(promptOrder)) {
            console.warn('[NemoTray] Cannot reorder: invalid prompt order');
            return;
        }

        // Find the indices of our prompts in the full prompt order
        const promptIndices = new Map();
        newOrder.forEach(id => {
            const idx = promptOrder.findIndex(entry => entry.identifier === id);
            if (idx !== -1) {
                promptIndices.set(id, idx);
            }
        });

        // If we found prompts, reorder them while keeping them in the same position range
        if (promptIndices.size > 0) {
            // Get the entries and their current positions
            const entries = [];
            const positions = [];
            newOrder.forEach(id => {
                const idx = promptIndices.get(id);
                if (idx !== undefined) {
                    entries.push(promptOrder[idx]);
                    positions.push(idx);
                }
            });

            // Sort positions to get the range
            positions.sort((a, b) => a - b);

            // Place entries back in sorted positions with new order
            entries.forEach((entry, i) => {
                promptOrder[positions[i]] = entry;
            });

            // Save the changes
            promptManager.saveServiceSettings();

            // Update cached prompt IDs for this section
            if (section._nemoPromptIds) {
                section._nemoPromptIds = newOrder.map(id => {
                    const existing = section._nemoPromptIds.find(p => p.identifier === id);
                    return existing || { identifier: id, name: id };
                });
                sectionPromptIdsCache.set(getSectionId(section), section._nemoPromptIds);
            }

            console.log('[NemoTray] Successfully reordered prompts in section');
        }
    } catch (error) {
        console.error('[NemoTray] Error reordering prompts:', error);
    }
}

/**
 * Move a prompt between sections when dragging between trays
 * @param {string} identifier - The prompt identifier
 * @param {HTMLElement} fromSection - Source section element
 * @param {HTMLElement} toSection - Destination section element
 * @param {number} newIndex - New index in destination
 * @param {Array} destPrompts - Array of prompts in destination tray
 */
async function movePromptBetweenSectionsFromTray(identifier, fromSection, toSection, newIndex, destPrompts) {
    if (!promptManager || !promptManager.activeCharacter) {
        console.warn('[NemoTray] Cannot move prompt: no active character');
        return;
    }

    try {
        const activeCharacter = promptManager.activeCharacter;
        const promptOrder = promptManager.getPromptOrderForCharacter(activeCharacter);

        if (!promptOrder || !Array.isArray(promptOrder)) {
            console.warn('[NemoTray] Cannot move prompt: invalid prompt order');
            return;
        }

        // Find the prompt's current position and remove it
        const currentIdx = promptOrder.findIndex(entry => entry.identifier === identifier);
        if (currentIdx === -1) {
            console.warn('[NemoTray] Cannot find prompt in order:', identifier);
            return;
        }

        const entry = promptOrder[currentIdx];
        promptOrder.splice(currentIdx, 1);

        // Find where to insert in the destination section
        // Use the prompt at newIndex in destPrompts as reference
        let insertIdx = promptOrder.length; // Default to end

        if (destPrompts && destPrompts.length > 0) {
            if (newIndex >= 0 && newIndex < destPrompts.length) {
                // Find the prompt at newIndex position in destination
                const targetIdentifier = destPrompts[newIndex]?.identifier;
                if (targetIdentifier && targetIdentifier !== identifier) {
                    const targetIdx = promptOrder.findIndex(e => e.identifier === targetIdentifier);
                    if (targetIdx !== -1) {
                        insertIdx = targetIdx;
                    }
                }
            } else if (newIndex > 0 && destPrompts[newIndex - 1]) {
                // Insert after the previous prompt
                const prevIdentifier = destPrompts[newIndex - 1]?.identifier;
                if (prevIdentifier) {
                    const prevIdx = promptOrder.findIndex(e => e.identifier === prevIdentifier);
                    if (prevIdx !== -1) {
                        insertIdx = prevIdx + 1;
                    }
                }
            }
        }

        // Ensure valid index
        if (insertIdx < 0) insertIdx = 0;
        if (insertIdx > promptOrder.length) insertIdx = promptOrder.length;

        // Insert at new position
        promptOrder.splice(insertIdx, 0, entry);

        // Save the changes
        promptManager.saveServiceSettings();

        console.log('[NemoTray] Moved prompt', identifier, 'from', getSectionId(fromSection), 'to', getSectionId(toSection), 'at index', insertIdx);
    } catch (error) {
        console.error('[NemoTray] Error moving prompt between sections:', error);
    }
}

/**
 * Update the footer of a tray to reflect current prompt counts
 * @param {HTMLElement} tray - The tray element
 * @param {Array} prompts - Array of prompts in the tray
 */
function updateTrayFooter(tray, prompts) {
    if (!tray || !prompts) return;

    const footer = tray.querySelector('.nemo-tray-hint');
    if (footer) {
        const enabledCount = prompts.filter(p => p.isEnabled).length;
        footer.textContent = `Click to toggle • Drag ≡ to reorder • ${enabledCount}/${prompts.length} active`;
    }

    // Also update the toggle-all button state
    const toggleAllBtn = tray.querySelector('.nemo-tray-toggle-all');
    if (toggleAllBtn) {
        const enabledCount = prompts.filter(p => p.isEnabled).length;
        const allEnabled = enabledCount === prompts.length;
        toggleAllBtn.classList.toggle('nemo-all-enabled', allEnabled);
        toggleAllBtn.innerHTML = `${allEnabled ? '☑' : '☐'} All`;
        toggleAllBtn.title = allEnabled ? 'Disable All' : 'Enable All';
    }
}

/**
 * Get all available sections for the move context menu
 * @returns {Array} Array of {id, name, section} objects
 */
function getAllSections() {
    const sections = [];

    // Add top-level section if exists
    if (topLevelPromptsContainer) {
        sections.push({
            id: TOP_LEVEL_SECTION_ID,
            name: '📌 Top Level Prompts',
            section: topLevelPromptsContainer
        });
    }

    // Get all tray-converted sections
    document.querySelectorAll('details.nemo-tray-section').forEach(section => {
        // Skip top-level container (already added above)
        if (section.classList.contains('nemo-top-level-section')) return;

        const sectionId = getSectionId(section);
        sections.push({
            id: sectionId,
            name: sectionId,
            section: section
        });
    });

    return sections;
}

/**
 * Hide the current context menu if any
 */
function hideContextMenu() {
    if (currentContextMenu) {
        currentContextMenu.remove();
        currentContextMenu = null;
    }
}

/**
 * Show context menu for moving a prompt to a different section
 * @param {MouseEvent} e - The contextmenu event
 * @param {Object} promptData - The prompt data object
 * @param {HTMLElement} fromSection - The source section
 * @param {HTMLElement} fromTray - The source tray
 * @param {HTMLElement} card - The prompt card element
 */
function showPromptMoveContextMenu(e, promptData, fromSection, fromTray, card) {
    e.preventDefault();
    e.stopPropagation();

    // Hide any existing menu
    hideContextMenu();

    // Get all available sections
    const sections = getAllSections();
    const currentSectionId = getSectionId(fromSection);

    // Filter out current section
    const availableSections = sections.filter(s => s.id !== currentSectionId);

    if (availableSections.length === 0) {
        console.log('[NemoTray] No other sections available for move');
        return;
    }

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'nemo-context-menu nemo-tray-context-menu';
    menu.style.display = 'block';

    // Add header
    menu.innerHTML = `
        <div class="nemo-context-menu-header">
            <i class="fa-solid fa-arrows-up-down-left-right"></i>
            <span>Move to...</span>
        </div>
    `;

    // Add section options
    availableSections.forEach(({ id, name, section }) => {
        const item = document.createElement('div');
        item.className = 'nemo-context-menu-item';

        // Use different icon for top-level vs regular sections
        const icon = id === TOP_LEVEL_SECTION_ID
            ? 'fa-solid fa-arrow-up'
            : 'fa-solid fa-folder';

        item.innerHTML = `
            <i class="${icon}"></i>
            <span>${escapeHtml(name)}</span>
        `;

        item.addEventListener('click', async () => {
            hideContextMenu();

            if (id === TOP_LEVEL_SECTION_ID) {
                // Move to top-level
                await movePromptToTopLevel(
                    promptData.identifier,
                    promptData,
                    fromSection,
                    fromTray
                );
            } else {
                // Move to section
                await movePromptToSectionTop(
                    promptData.identifier,
                    promptData,
                    fromSection,
                    section,
                    fromTray
                );
            }

            // Remove the card from current tray
            card.remove();

            // Update source tray's prompts array and footer
            const fromPrompts = fromTray._nemoPrompts;
            if (fromPrompts) {
                const idx = fromPrompts.findIndex(p => p.identifier === promptData.identifier);
                if (idx !== -1) fromPrompts.splice(idx, 1);
                updateTrayFooter(fromTray, fromPrompts);
            }

            console.log('[NemoTray] Moved prompt via context menu:', promptData.identifier, 'to', name);
        });

        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    currentContextMenu = menu;

    // Position the menu at cursor
    const menuRect = menu.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;

    // Keep menu within viewport
    if (x + menuRect.width > window.innerWidth) {
        x = window.innerWidth - menuRect.width - 5;
    }
    if (y + menuRect.height > window.innerHeight) {
        y = window.innerHeight - menuRect.height - 5;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Close on click outside
    const closeHandler = (evt) => {
        if (!menu.contains(evt.target)) {
            hideContextMenu();
            document.removeEventListener('click', closeHandler);
        }
    };

    // Delay adding listener to avoid immediate close
    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 10);

    // Close on escape
    const escHandler = (evt) => {
        if (evt.key === 'Escape') {
            hideContextMenu();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// Cache for token counts to avoid repeated calculations
const tokenCountCache = new Map();

/**
 * Load token count for a prompt asynchronously
 * @param {string} identifier - Prompt identifier
 * @returns {Promise<number|null>} Token count or null if failed
 */
async function loadPromptTokenCount(identifier) {
    // Check cache first
    if (tokenCountCache.has(identifier)) {
        return tokenCountCache.get(identifier);
    }

    try {
        // Get prompt content
        const content = getPromptContentOnDemand(identifier);
        if (!content) {
            return null;
        }

        // Get token count
        const count = await getTokenCountAsync(content);

        // Cache the result
        tokenCountCache.set(identifier, count);

        return count;
    } catch (error) {
        console.warn('[NemoTray] Failed to get token count for:', identifier, error);
        return null;
    }
}

/**
 * Handle auto-resolution of conflicts when user chooses to proceed
 * @param {Array} issues - Validation issues
 * @param {string} promptId - ID of the prompt being enabled
 */
function handleAutoResolution(issues, promptId) {
    const allPrompts = getAllPromptsWithState();
    const prompt = allPrompts.find(p => p.identifier === promptId);
    if (!prompt || !prompt.content) return;

    const directives = parsePromptDirectives(prompt.content);

    for (const issue of issues) {
        // Auto-disable conflicting prompts if specified in @auto-disable
        if (issue.type === 'exclusive' || issue.type === 'category-limit' || issue.type === 'mutual-exclusive-group') {
            if (issue.conflictingPrompt && directives.autoDisable.includes(issue.conflictingPrompt.identifier)) {
                performToggle(issue.conflictingPrompt.identifier, false);
                logger.info(`Auto-disabled conflicting prompt: ${issue.conflictingPrompt.name}`);
            }
            if (issue.conflictingPrompts) {
                for (const p of issue.conflictingPrompts) {
                    if (directives.autoDisable.includes(p.identifier)) {
                        performToggle(p.identifier, false);
                        logger.info(`Auto-disabled conflicting prompt: ${p.name}`);
                    }
                }
            }
        }

        // Auto-enable required prompts if @auto-enable-dependencies is set
        if (issue.type === 'missing-dependency' && directives.autoEnableDependencies) {
            if (issue.requiredPrompt) {
                performToggle(issue.requiredPrompt.identifier, true);
                logger.info(`Auto-enabled required prompt: ${issue.requiredPrompt.name}`);
            }
        }
    }
}

/**
 * Show a preview modal for a prompt with resolved variables
 */
function showPromptPreview(identifier, name) {
    // Get prompt content on-demand (only fetched when preview is opened)
    const content = getPromptContentOnDemand(identifier);

    if (!content) {
        logger.warn(`No content found for prompt: ${identifier}`);
        return;
    }

    // Get chat variables directly from chat_metadata
    const chatVariables = chat_metadata?.variables || {};

    // Get global variables from extension_settings
    const globalVariables = extension_settings?.variables?.global || {};

    // Process content to highlight and resolve variables
    // Match patterns like {{getvar::name}} or {{getglobalvar::name}}
    const processedContent = content.replace(
        /\{\{(getvar|getglobalvar)::([^}]+)\}\}/gi,
        (match, type, varName) => {
            let value = '';
            let varSource = '';

            if (type.toLowerCase() === 'getvar') {
                value = chatVariables[varName];
                varSource = 'Local';
            } else if (type.toLowerCase() === 'getglobalvar') {
                value = globalVariables[varName];
                varSource = 'Global';
            }

            // Check if value exists
            const hasValue = value !== undefined && value !== null;
            const displayValue = hasValue ? String(value) : '[not set]';

            // Return a marked-up version showing the variable name and its value
            return `<span class="nemo-var-resolved ${hasValue ? '' : 'nemo-var-unset'}" data-var-name="${escapeHtml(varName)}" data-var-type="${type}" title="${varSource} Variable: ${escapeHtml(varName)}">${escapeHtml(displayValue)}</span>`;
        }
    );

    // Also highlight other macros that aren't resolved (just show them as-is but styled)
    const finalContent = processedContent.replace(
        /\{\{(?!getvar|getglobalvar)([^}]+)\}\}/gi,
        (match, inner) => {
            return `<span class="nemo-macro-unresolved" title="Macro: ${escapeHtml(inner)}">${escapeHtml(match)}</span>`;
        }
    );

    // Remove existing preview modal if any
    document.querySelector('.nemo-prompt-preview-modal')?.remove();

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'nemo-prompt-preview-modal';
    modal.innerHTML = `
        <div class="nemo-preview-backdrop"></div>
        <div class="nemo-preview-container">
            <div class="nemo-preview-header">
                <span class="nemo-preview-title">${escapeHtml(name)}</span>
                <div class="nemo-preview-header-actions">
                    <button class="nemo-preview-edit-btn" title="Edit in Prompt Manager">
                        <i class="fa-solid fa-pencil"></i> Edit
                    </button>
                    <button class="nemo-preview-close" title="Close">&times;</button>
                </div>
            </div>
            <div class="nemo-preview-legend">
                <span class="nemo-legend-item"><span class="nemo-var-resolved-sample"></span> Resolved Variable (read-only)</span>
                <span class="nemo-legend-item"><span class="nemo-macro-unresolved-sample"></span> Unresolved Macro</span>
            </div>
            <div class="nemo-preview-content">${finalContent.replace(/\n/g, '<br>')}</div>
            <div class="nemo-preview-footer">
                <span class="nemo-preview-hint">Variables shown are current values from chat context. They cannot be edited here.</span>
            </div>
        </div>
    `;

    // Close handlers
    modal.querySelector('.nemo-preview-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.nemo-preview-backdrop').addEventListener('click', () => modal.remove());

    // Edit button - directly open the prompt manager editor
    modal.querySelector('.nemo-preview-edit-btn').addEventListener('click', () => {
        modal.remove();

        // Directly call promptManager methods to open the editor
        try {
            if (promptManager) {
                // Clear any existing forms
                if (typeof promptManager.clearEditForm === 'function') {
                    promptManager.clearEditForm();
                }
                if (typeof promptManager.clearInspectForm === 'function') {
                    promptManager.clearInspectForm();
                }

                // Get the prompt by identifier
                const prompt = promptManager.getPromptById(identifier);
                if (prompt) {
                    // Load prompt into edit form and show popup
                    promptManager.loadPromptIntoEditForm(prompt);
                    promptManager.showPopup();
                    logger.info(`Opened editor for prompt: ${identifier}`);
                } else {
                    logger.warn(`Prompt not found: ${identifier}`);
                    alert(`Could not find prompt: ${name}. Please use the main Prompt Manager to edit.`);
                }
            } else {
                logger.warn('promptManager not available');
                alert(`Prompt Manager not available. Please use the main Prompt Manager to edit.`);
            }
        } catch (e) {
            logger.error('Failed to open prompt editor:', e);
            alert(`Could not open editor for prompt: ${name}. Please use the main Prompt Manager to edit.`);
        }
    });

    // ESC to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(modal);
    logger.info(`Showing preview for prompt: ${name}`);
}

/**
 * Refresh progress bars for all converted sections
 * Called periodically to ensure progress bars stay updated after ST refreshes
 */
function refreshAllSectionProgressBars() {
    document.querySelectorAll('details.nemo-tray-section').forEach(section => {
        if (section._nemoPromptIds || sectionPromptIdsCache.has(getSectionId(section))) {
            // Restore from cache if needed
            if (!section._nemoPromptIds) {
                section._nemoPromptIds = sectionPromptIdsCache.get(getSectionId(section));
            }
            updateSectionProgressFromStoredIds(section);
        }
    });
}

/**
 * Get direct counts for a section from stored prompt IDs (tray mode)
 * @param {HTMLElement} section - The section element
 * @returns {{enabled: number, total: number}} The direct counts
 */
function getDirectCountsFromStoredIds(section) {
    const storedPromptIds = section._nemoPromptIds;
    if (!storedPromptIds || storedPromptIds.length === 0) {
        return { enabled: 0, total: 0 };
    }

    const totalCount = storedPromptIds.length;
    let enabledCount = 0;

    if (promptManager) {
        const activeCharacter = promptManager.activeCharacter;
        storedPromptIds.forEach(({ identifier }) => {
            try {
                const promptOrderEntry = promptManager.getPromptOrderEntry(activeCharacter, identifier);
                if (promptOrderEntry?.enabled) {
                    enabledCount++;
                }
            } catch (e) {
                // Ignore errors for individual prompts
            }
        });
    }

    return { enabled: enabledCount, total: totalCount };
}

/**
 * Recursively get aggregated counts for a section including all sub-sections
 * @param {HTMLElement} section - The section element
 * @returns {{enabled: number, total: number}} The aggregated counts
 */
function getAggregatedCountsFromStoredIds(section) {
    // Get direct counts for this section
    const directCounts = getDirectCountsFromStoredIds(section);
    let totalEnabled = directCounts.enabled;
    let totalCount = directCounts.total;

    // Find all direct child sub-sections and add their aggregated counts
    const content = section.querySelector('.nemo-section-content');
    if (content) {
        const subSections = content.querySelectorAll(':scope > details.nemo-engine-section');
        subSections.forEach(subSection => {
            const subCounts = getAggregatedCountsFromStoredIds(subSection);
            totalEnabled += subCounts.enabled;
            totalCount += subCounts.total;
        });
    }

    return { enabled: totalEnabled, total: totalCount };
}

/**
 * Update section progress bar using stored prompt IDs (after DOM removal)
 * This calculates enabled count from promptManager data, aggregating sub-sections
 */
function updateSectionProgressFromStoredIds(section) {
    // Get aggregated counts including all sub-sections
    const { enabled: enabledCount, total: totalCount } = getAggregatedCountsFromStoredIds(section);

    updateSectionProgressBar(section, enabledCount, totalCount);
}

/**
 * Update the progress bar on a section header
 */
function updateSectionProgressBar(section, enabledCount, totalCount) {
    const progressBar = section.querySelector('summary .nemo-section-progress');
    if (progressBar) {
        const percentage = totalCount > 0 ? (enabledCount / totalCount) * 100 : 0;
        progressBar.style.setProperty('--progress-width', `${percentage}%`);
        progressBar.setAttribute('data-enabled', enabledCount);
        progressBar.setAttribute('data-total', totalCount);

        // Color coding based on percentage
        progressBar.classList.remove('nemo-progress-none', 'nemo-progress-partial', 'nemo-progress-full');
        if (enabledCount === 0) {
            progressBar.classList.add('nemo-progress-none');
        } else if (enabledCount === totalCount) {
            progressBar.classList.add('nemo-progress-full');
        } else {
            progressBar.classList.add('nemo-progress-partial');
        }
    }

    // Also update the count span if present
    const countSpan = section.querySelector('summary .nemo-enabled-count');
    if (countSpan) {
        countSpan.textContent = ` (${enabledCount}/${totalCount})`;
    }

    // Update all ancestor (parent) sections to reflect new aggregated counts
    updateAncestorSections(section);
}

/**
 * Update all ancestor sections with their aggregated counts
 * Called when a child section's count changes
 * @param {HTMLElement} section - The section that was just updated
 */
function updateAncestorSections(section) {
    // Find the parent section (the section containing this one)
    let parentContent = section.parentElement;
    while (parentContent) {
        // Check if parent content is inside a section
        const parentSection = parentContent.closest('details.nemo-engine-section');
        if (parentSection && parentSection !== section) {
            // Found a parent section - update its aggregated counts
            const { enabled, total } = getAggregatedCountsFromStoredIds(parentSection);

            // Update progress bar directly (without triggering another ancestor update)
            const progressBar = parentSection.querySelector('summary .nemo-section-progress');
            if (progressBar) {
                const percentage = total > 0 ? (enabled / total) * 100 : 0;
                progressBar.style.setProperty('--progress-width', `${percentage}%`);
                progressBar.setAttribute('data-enabled', enabled);
                progressBar.setAttribute('data-total', total);

                progressBar.classList.remove('nemo-progress-none', 'nemo-progress-partial', 'nemo-progress-full');
                if (enabled === 0) {
                    progressBar.classList.add('nemo-progress-none');
                } else if (enabled === total) {
                    progressBar.classList.add('nemo-progress-full');
                } else {
                    progressBar.classList.add('nemo-progress-partial');
                }
            }

            const countSpan = parentSection.querySelector('summary .nemo-enabled-count');
            if (countSpan) {
                countSpan.textContent = ` (${enabled}/${total})`;
            }

            // Continue up the tree
            parentContent = parentSection.parentElement;
        } else {
            break;
        }
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Disable tray mode for all sections
 * Called when sections feature is toggled off
 * This removes tray conversion flags and handlers so sections can be properly flattened
 */
export function disableTrayMode() {
    console.log('[NemoTray] Disabling tray mode for all sections');

    // Close all open trays
    document.querySelectorAll('.nemo-tray-section').forEach(section => {
        if (section._nemoCategoryTray) {
            const tray = section._nemoCategoryTray;
            if (tray._closeHandler) {
                document.removeEventListener('click', tray._closeHandler);
            }
            if (tray._keyHandler) {
                document.removeEventListener('keydown', tray._keyHandler, true);
            }
            tray.remove();
            delete section._nemoCategoryTray;
        }

        // Remove click/key handlers from summary
        const summary = section.querySelector('summary');
        if (summary) {
            if (summary._trayClickHandler) {
                summary.removeEventListener('click', summary._trayClickHandler);
                delete summary._trayClickHandler;
            }
            if (summary._trayKeyHandler) {
                summary.removeEventListener('keydown', summary._trayKeyHandler);
                delete summary._trayKeyHandler;
            }
            // Remove from drop zone tracking and event handlers
            if (summary._dragOverHandler) {
                summary.removeEventListener('dragover', summary._dragOverHandler);
                delete summary._dragOverHandler;
            }
            if (summary._dragLeaveHandler) {
                summary.removeEventListener('dragleave', summary._dragLeaveHandler);
                delete summary._dragLeaveHandler;
            }
            if (summary._dropHandler) {
                summary.removeEventListener('drop', summary._dropHandler);
                delete summary._dropHandler;
            }
            sectionDropZones.delete(summary);
            delete summary._dropZoneSetup;
            delete summary._nemoSection;
            summary.classList.remove('nemo-drop-target-active');

            summary.removeAttribute('tabindex');
            summary.removeAttribute('role');
            summary.removeAttribute('aria-expanded');
        }

        // Remove tray-related classes and attributes
        section.classList.remove('nemo-tray-section', 'nemo-tray-open');
        delete section.dataset.trayConverted;
        delete section._nemoPromptIds;

        // Remove hidden content class and unhide prompts
        const content = section.querySelector('.nemo-section-content');
        if (content) {
            content.classList.remove('nemo-tray-hidden-content');
            // Unhide all hidden prompts
            content.querySelectorAll('.nemo-tray-hidden-prompt').forEach(prompt => {
                prompt.classList.remove('nemo-tray-hidden-prompt');
            });
        }
    });

    // Remove top-level prompts container
    if (topLevelPromptsContainer) {
        topLevelPromptsContainer.remove();
        topLevelPromptsContainer = null;
    }
    // Clear the top-level cache
    sectionPromptIdsCache.delete(TOP_LEVEL_SECTION_ID);

    // Also unhide any prompts that might be outside sections
    document.querySelectorAll('.nemo-tray-hidden-prompt').forEach(prompt => {
        prompt.classList.remove('nemo-tray-hidden-prompt');
    });

    // Clear tray mode tracking
    trayModeEnabled.clear();
    // Note: We keep sectionPromptIdsCache in case sections are re-enabled later

    // Clear any drag state
    currentlyDraggedPrompt = null;
    currentlyDraggedFromSection = null;
    currentlyDraggedFromTray = null;
    currentDropTarget = null;
    isOverTopLevelDropZone = false;
    hideTopLevelDropZone();

    console.log('[NemoTray] Tray mode disabled');
    logger.info('Tray mode disabled for all sections');
}

/**
 * Convert sections to accordion mode (inline expand with prompts visible)
 * Keeps prompts in DOM, uses native <details> expand/collapse
 * @returns {number} Number of sections converted
 */
function convertToAccordionMode() {
    // Don't convert if sections feature is disabled
    if (!storage.getSectionsEnabled()) {
        console.log('[NemoTray] Sections disabled, skipping accordion conversion');
        return 0;
    }

    const allSections = document.querySelectorAll('details.nemo-engine-section');
    console.log('[NemoTray] Converting to accordion mode, sections:', allSections.length);

    let converted = 0;

    allSections.forEach(section => {
        // Skip if already in accordion mode
        if (section.dataset.accordionConverted === 'true') return;

        const summary = section.querySelector('summary');
        const content = section.querySelector('.nemo-section-content');
        if (!summary || !content) return;

        // Mark as accordion mode
        section.dataset.accordionConverted = 'true';
        section.classList.add('nemo-accordion-section');

        // Ensure content is visible (remove tray hidden class if present)
        content.classList.remove('nemo-tray-hidden-content');

        // Unhide any prompts that were hidden by tray mode
        content.querySelectorAll('.nemo-tray-hidden-prompt').forEach(prompt => {
            prompt.classList.remove('nemo-tray-hidden-prompt');
        });

        // Apply enhanced styling to prompt items for better enabled state visibility
        const promptItems = content.querySelectorAll('li.completion_prompt_manager_prompt');
        promptItems.forEach(item => {
            enhancePromptItemForAccordion(item);
        });

        // Initialize drag-and-drop for this section's content
        initAccordionDragDrop(section);

        converted++;
    });

    if (converted > 0) {
        console.log('[NemoTray] Converted', converted, 'sections to accordion mode');
        // Update all section counts after conversion
        updateAllAccordionSectionCounts();
    }

    return converted;
}

/**
 * Update section counts for all accordion sections
 * Uses DOM-based counting since prompts are visible
 */
async function updateAllAccordionSectionCounts() {
    try {
        const { NemoPresetManager } = await import('./prompt-manager.js');
        document.querySelectorAll('details.nemo-accordion-section').forEach(section => {
            if (NemoPresetManager?.updateSectionCount) {
                NemoPresetManager.updateSectionCount(section);
            }
        });
        console.log('[NemoTray] Updated all accordion section counts');
    } catch (e) {
        console.warn('[NemoTray] Could not update section counts:', e);
    }
}

/**
 * Enhance a prompt item for accordion mode with better enabled state visibility
 * @param {HTMLElement} item - The prompt item element
 */
function enhancePromptItemForAccordion(item) {
    if (item.dataset.accordionEnhanced === 'true') return;
    item.dataset.accordionEnhanced = 'true';
    item.classList.add('nemo-accordion-prompt');

    // Check current enabled state and update styling
    updateAccordionItemEnabledState(item);

    // Watch for toggle changes
    const toggleBtn = item.querySelector('.prompt-manager-toggle-action');
    if (toggleBtn) {
        const updateHandler = () => {
            setTimeout(() => updateAccordionItemEnabledState(item), 50);
        };
        toggleBtn.addEventListener('click', updateHandler);
        item._accordionToggleHandler = updateHandler;
    }
}

/**
 * Update the enabled state styling for an accordion prompt item
 * @param {HTMLElement} item - The prompt item element
 */
function updateAccordionItemEnabledState(item) {
    const toggleBtn = item.querySelector('.prompt-manager-toggle-action');
    const isEnabled = toggleBtn?.classList.contains('fa-toggle-on');

    item.classList.toggle('nemo-accordion-prompt-enabled', isEnabled);
    item.classList.toggle('nemo-accordion-prompt-disabled', !isEnabled);
}

/**
 * Initialize drag-and-drop for an accordion section
 * Supports both reordering within a section and moving between sections
 * @param {HTMLElement} section - The section element
 */
function initAccordionDragDrop(section) {
    const content = section.querySelector('.nemo-section-content');
    if (!content || content._accordionSortable) return;

    // Use Sortable if available
    if (typeof Sortable !== 'undefined') {
        content._accordionSortable = new Sortable(content, {
            animation: 0, // Disable animation for performance
            handle: '.drag-handle',
            group: 'nemo-accordion-prompts', // Allow dragging between all accordion sections
            ghostClass: 'nemo-accordion-drag-ghost',
            forceFallback: false, // Use native drag for better performance
            filter: '.nemo-header-item, details.nemo-engine-section', // Don't allow dragging headers or sub-sections
            onEnd: async (evt) => {
                const { from, to, item } = evt;
                const fromSection = from.closest('details.nemo-engine-section');
                const toSection = to.closest('details.nemo-engine-section');

                // Get the prompt identifier
                const identifier = item.getAttribute('data-pm-identifier');

                if (fromSection !== toSection && identifier) {
                    // Moving between sections - update SillyTavern's prompt order
                    console.log('[NemoTray] Moving prompt between sections:', identifier);
                    await movePromptBetweenSections(item, fromSection, toSection, evt.newIndex);
                }

                // Update section counts for both source and destination
                try {
                    const { NemoPresetManager } = await import('./prompt-manager.js');
                    if (NemoPresetManager?.updateSectionCount) {
                        NemoPresetManager.updateSectionCount(fromSection);
                        if (toSection !== fromSection) {
                            NemoPresetManager.updateSectionCount(toSection);
                        }
                        // Also update any parent sections
                        updateParentSectionCounts(fromSection);
                        if (toSection !== fromSection) {
                            updateParentSectionCounts(toSection);
                        }
                    }
                } catch (e) {
                    console.warn('[NemoTray] Could not update section counts after drag:', e);
                }

                console.log('[NemoTray] Accordion item reordered/moved');
            },
            onAdd: (evt) => {
                // Item was added from another section - enhance it for accordion mode
                const item = evt.item;
                if (!item.dataset.accordionEnhanced) {
                    enhancePromptItemForAccordion(item);
                }
            }
        });
        console.log('[NemoTray] Initialized accordion drag-drop for section:', getSectionId(section));
    }
}

/**
 * Move a prompt between sections in SillyTavern's prompt order
 * @param {HTMLElement} item - The prompt item being moved
 * @param {HTMLElement} fromSection - Source section
 * @param {HTMLElement} toSection - Destination section
 * @param {number} newIndex - New index within destination section
 */
async function movePromptBetweenSections(item, fromSection, toSection, newIndex) {
    if (!promptManager || !promptManager.activeCharacter) {
        console.warn('[NemoTray] Cannot move prompt: no active character');
        return;
    }

    try {
        const identifier = item.getAttribute('data-pm-identifier');
        const activeCharacter = promptManager.activeCharacter;
        const promptOrder = promptManager.getPromptOrderForCharacter(activeCharacter);

        if (!promptOrder || !Array.isArray(promptOrder)) {
            console.warn('[NemoTray] Cannot move prompt: invalid prompt order');
            return;
        }

        // Find the prompt's current position
        const currentIdx = promptOrder.findIndex(entry => entry.identifier === identifier);
        if (currentIdx === -1) {
            console.warn('[NemoTray] Cannot find prompt in order:', identifier);
            return;
        }

        // Get the entry and remove it from current position
        const entry = promptOrder[currentIdx];
        promptOrder.splice(currentIdx, 1);

        // Find where to insert in the destination section
        // Get all prompts in the destination section
        const destContent = toSection.querySelector('.nemo-section-content');
        const destPrompts = destContent.querySelectorAll(':scope > li.completion_prompt_manager_prompt');

        let insertIdx;
        if (newIndex >= destPrompts.length || newIndex < 0) {
            // Insert at the end of the section - find the last prompt in dest section
            const lastPromptInDest = destPrompts[destPrompts.length - 1];
            if (lastPromptInDest) {
                const lastId = lastPromptInDest.getAttribute('data-pm-identifier');
                insertIdx = promptOrder.findIndex(e => e.identifier === lastId);
                if (insertIdx !== -1) insertIdx++; // Insert after
            } else {
                // Empty section - find section header position
                insertIdx = promptOrder.length; // Default to end
            }
        } else {
            // Insert before the prompt at newIndex
            const targetPrompt = destPrompts[newIndex];
            if (targetPrompt && targetPrompt !== item) {
                const targetId = targetPrompt.getAttribute('data-pm-identifier');
                insertIdx = promptOrder.findIndex(e => e.identifier === targetId);
            } else if (newIndex > 0 && destPrompts[newIndex - 1]) {
                // Insert after the previous prompt
                const prevId = destPrompts[newIndex - 1].getAttribute('data-pm-identifier');
                insertIdx = promptOrder.findIndex(e => e.identifier === prevId);
                if (insertIdx !== -1) insertIdx++;
            } else {
                insertIdx = promptOrder.length;
            }
        }

        // Ensure valid index
        if (insertIdx < 0) insertIdx = 0;
        if (insertIdx > promptOrder.length) insertIdx = promptOrder.length;

        // Insert at new position
        promptOrder.splice(insertIdx, 0, entry);

        // Save the changes
        promptManager.saveServiceSettings();

        console.log('[NemoTray] Moved prompt', identifier, 'to index', insertIdx);
    } catch (error) {
        console.error('[NemoTray] Error moving prompt between sections:', error);
    }
}

/**
 * Update parent section counts after a prompt move
 * @param {HTMLElement} section - The section that was modified
 */
async function updateParentSectionCounts(section) {
    try {
        const { NemoPresetManager } = await import('./prompt-manager.js');
        let parent = section.parentElement?.closest('details.nemo-engine-section');
        while (parent) {
            if (NemoPresetManager?.updateSectionCount) {
                NemoPresetManager.updateSectionCount(parent);
            }
            parent = parent.parentElement?.closest('details.nemo-engine-section');
        }
    } catch (e) {
        console.warn('[NemoTray] Could not update parent section counts:', e);
    }
}

/**
 * Disable accordion mode for all sections
 */
function disableAccordionMode() {
    console.log('[NemoTray] Disabling accordion mode for all sections');

    document.querySelectorAll('.nemo-accordion-section').forEach(section => {
        // Remove accordion classes and attributes
        section.classList.remove('nemo-accordion-section');
        delete section.dataset.accordionConverted;

        const content = section.querySelector('.nemo-section-content');
        if (content) {
            // Destroy sortable if exists
            if (content._accordionSortable) {
                content._accordionSortable.destroy();
                delete content._accordionSortable;
            }
        }

        // Clean up prompt item enhancements
        const promptItems = section.querySelectorAll('li.completion_prompt_manager_prompt');
        promptItems.forEach(item => {
            item.classList.remove('nemo-accordion-prompt', 'nemo-accordion-prompt-enabled', 'nemo-accordion-prompt-disabled');
            delete item.dataset.accordionEnhanced;

            // Remove toggle handler
            if (item._accordionToggleHandler) {
                const toggleBtn = item.querySelector('.prompt-manager-toggle-action');
                if (toggleBtn) {
                    toggleBtn.removeEventListener('click', item._accordionToggleHandler);
                }
                delete item._accordionToggleHandler;
            }
        });
    });

    console.log('[NemoTray] Accordion mode disabled');
    logger.info('Accordion mode disabled for all sections');
}
