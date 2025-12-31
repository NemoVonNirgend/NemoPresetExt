import { saveSettingsDebounced, eventSource, event_types } from '../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../extensions.js';
import { LOG_PREFIX, NEMO_EXTENSION_NAME, ensureSettingsNamespace, escapeRegex, delay, getSortableDelay, debounce, debounce_timeout } from '../../core/utils.js';
import logger from '../../core/logger.js';
import { promptManager } from '../../../../../openai.js';
import { PromptNavigator } from './prompt-navigator.js';
import { CONSTANTS } from '../../core/constants.js';
import storage from '../../core/storage-migration.js';
import '../../lib/Sortable.min.js'; // Import Sortable
import { getTooltip } from './prompt-tooltips.js';
import { parsePromptDirectives } from '../directives/prompt-directives.js';
import { disableTrayMode } from './category-tray.js';

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
let openSectionStates = storage.getOpenSectionStates();
let isSectionsFeatureEnabled = storage.getSectionsEnabled();

/**
 * Capture current section open states from the DOM before a rebuild
 * This prevents race conditions where state isn't saved before re-render
 */
function captureCurrentSectionStates() {
    const container = document.querySelector(SELECTORS.promptsContainer);
    if (!container) return;

    container.querySelectorAll('details.nemo-engine-section').forEach(section => {
        const summaryLi = section.querySelector('summary > li');
        if (summaryLi) {
            const nameSpan = summaryLi.querySelector('span.completion_prompt_manager_prompt_name a');
            if (nameSpan) {
                // Use the original divider text as the key
                const dividerInfo = NemoPresetManager.getDividerInfo(summaryLi);
                if (dividerInfo.originalText) {
                    openSectionStates[dividerInfo.originalText] = section.open;
                }
            }
        }
    });
}

/**
 * Apply accordion enhancements to a prompt item immediately
 * This prevents flicker by applying styling before the MutationObserver fires
 * @param {HTMLElement} item - The prompt item element
 */
function applyAccordionEnhancement(item) {
    if (!item || item.dataset.accordionEnhanced === 'true') return;

    item.dataset.accordionEnhanced = 'true';
    item.classList.add('nemo-accordion-prompt');

    // Apply enabled/disabled styling
    const toggleBtn = item.querySelector('.prompt-manager-toggle-action');
    const isEnabled = toggleBtn?.classList.contains('fa-toggle-on');
    item.classList.toggle('nemo-accordion-prompt-enabled', isEnabled);
    item.classList.toggle('nemo-accordion-prompt-disabled', !isEnabled);
}

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
        logger.error('Invalid regex pattern. Using built-ins only', e);
        DIVIDER_PREFIX_REGEX = new RegExp(`^(${NEMO_BUILT_IN_PATTERNS.join('|')})`);
    }
}

/**
 * Extract tooltip from prompt content using {{// note }} syntax
 * Looks for {{// text }} at the start of the prompt content
 * @param {string} identifier - The prompt identifier (e.g., 'main', 'nsfw', etc.)
 * @returns {string|null} The extracted tooltip text or null if not found
 */
function extractTooltipFromPrompt(identifier) {
    try {
        // Use the imported prompt manager
        if (!promptManager) {
            return null;
        }

        // Get the prompt by identifier
        const prompt = promptManager.getPromptById(identifier);
        if (!prompt || !prompt.content) {
            return null;
        }

        // First, try to parse @tooltip directive using the directive parser
        const directives = parsePromptDirectives(prompt.content);
        if (directives.tooltip) {
            return directives.tooltip;
        }

        // Fallback: Look for plain {{// text }} at the start (backward compatibility)
        // This allows users to still use plain comments for tooltips
        const tooltipRegex = /^\s*\{\{\/\/\s*([\s\S]*?)\s*\}\}/;
        const match = prompt.content.match(tooltipRegex);

        if (match && match[1]) {
            const tooltip = match[1].trim();
            // Don't show directive syntax in tooltip
            if (!tooltip.startsWith('@')) {
                return tooltip;
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Apply tooltips to prompt items based on their names
 * First tries to extract from prompt content using {{// }} syntax,
 * then falls back to hardcoded tooltips
 * @param {HTMLElement} item - The prompt item element
 */
function applyTooltipToPrompt(item) {
    const nameLink = item.querySelector(SELECTORS.promptNameLink);
    if (!nameLink) {
        return;
    }

    const promptName = nameLink.getAttribute('title') || nameLink.textContent.trim();

    // Try to get the prompt identifier from data attributes
    const identifier = item.getAttribute('data-pm-identifier');

    // First, try to extract tooltip from prompt content
    let tooltipText = null;
    if (identifier) {
        tooltipText = extractTooltipFromPrompt(identifier);
    }

    // Fallback to hardcoded tooltips if no dynamic tooltip found
    if (!tooltipText) {
        tooltipText = getTooltip(promptName);
    }

    if (tooltipText) {
        // Store original title if it exists
        if (!nameLink.dataset.originalTitle) {
            nameLink.dataset.originalTitle = nameLink.getAttribute('title') || '';
        }

        // Set the tooltip as the title attribute
        nameLink.setAttribute('title', tooltipText);
        nameLink.classList.add('nemo-has-tooltip');
    }
}

// 3. MAIN OBJECT
export const NemoPresetManager = {
    // UI Functions
    showStatusMessage: function(message, type = 'info', duration = 4000) {
        const statusDiv = document.getElementById('nemoSnapshotStatus');
        if (!statusDiv) return;
        if (statusDiv.nemoTimeout) clearTimeout(statusDiv.nemoTimeout);
        statusDiv.textContent = message;
        statusDiv.className = `nemo-status-message ${type}`;
        requestAnimationFrame(() => { statusDiv.classList.add('visible'); });
        statusDiv.nemoTimeout = setTimeout(() => { statusDiv.classList.remove('visible'); }, duration);
    },

    createSearchAndStatusUI: function(container) {
        // Remove existing UI if it exists
        const existing = document.getElementById('nemoSearchAndStatusWrapper');
        if (existing) {
            existing.remove();
        }

        const searchAndStatusWrapper = document.createElement('div');
        searchAndStatusWrapper.id = 'nemoSearchAndStatusWrapper';
        searchAndStatusWrapper.innerHTML = `
            <div id="nemoPresetSearchContainer" role="search">
                <input type="text"
                       id="nemoPresetSearchInput"
                       placeholder="Search prompts (name & content)..."
                       class="text_pole"
                       aria-label="Search prompts by name or content"
                       autocomplete="off">
                <div class="nemo-search-controls" role="toolbar" aria-label="Prompt manager tools">
                    <button id="nemoPresetSearchClear"
                            title="Clear search"
                            class="menu_button"
                            aria-label="Clear search input"><i class="fa-solid fa-times" aria-hidden="true"></i></button>
                    <div class="nemo-search-divider" role="separator"></div>
                    <button id="nemoToggleSectionsBtn"
                            title="Toggle Collapsible Sections"
                            class="menu_button"
                            aria-label="Toggle collapsible sections"
                            aria-pressed="true"><i class="fa-solid fa-list-ul" aria-hidden="true"></i></button>
                    <button id="nemoPromptNavigatorBtn"
                            title="Browse Prompts with Folder Management"
                            class="menu_button"
                            aria-label="Open prompt navigator with folder management"><i class="fa-solid fa-folder-tree" aria-hidden="true"></i></button>
                    <button id="nemoArchiveNavigatorBtn"
                            title="Open Prompt Archive Navigator"
                            class="menu_button"
                            aria-label="Open prompt archive navigator"><i class="fa-solid fa-archive" aria-hidden="true"></i></button>
                    <button id="nemoTakeSnapshotBtn"
                            title="Take a snapshot of the current prompt state"
                            class="menu_button"
                            aria-label="Take snapshot of current prompt state"><i class="fa-solid fa-camera" aria-hidden="true"></i></button>
                    <button id="nemoApplySnapshotBtn"
                            title="Apply the last snapshot"
                            class="menu_button"
                            disabled
                            aria-label="Apply the last saved snapshot"
                            aria-disabled="true"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i></button>
                </div>
            </div>
            <div id="nemoSnapshotStatus" class="nemo-status-message" role="status" aria-live="polite" aria-atomic="true"></div>`;
        container.parentElement.insertBefore(searchAndStatusWrapper, container);
        
        logger.debug('Created search and status UI');
    },

    createReasoningSection: function(container) {
        // Remove existing Reasoning section if it exists
        const existing = document.getElementById('nemoReasoningSection');
        if (existing) {
            existing.remove();
        }

        // Find the Chat Completion Settings drawer to insert after it
        const chatCompletionDrawer = document.getElementById('nemo-drawer-openai_chat_settings');
        if (!chatCompletionDrawer) {
            logger.warn('Chat Completion Settings drawer not found, cannot position Reasoning section');
            return;
        }

        const reasoningSection = document.createElement('div');
        reasoningSection.id = 'nemoReasoningSection';
        reasoningSection.className = 'inline-drawer wide100p nemo-converted-drawer';
        reasoningSection.innerHTML = `
            <div class="inline-drawer-toggle inline-drawer-header interactable" tabindex="0">
                <b data-i18n="Reasoning">Reasoning</b>
                <div class="inline-drawer-icon fa-solid fa-chevron-down interactable down" tabindex="0"></div>
            </div>
            <div class="inline-drawer-content" style="display: none;">
                <!-- Start Reply With Section -->
                <div class="range-block">
                    <div class="wide100p">
                        <div class="flex-container alignItemsCenter">
                            <span data-i18n="Start Reply With">Start Reply With</span>
                        </div>
                        <textarea id="nemo-start-reply-with" class="text_pole textarea_compact autoSetHeight" 
                                  placeholder="Enter start reply text..." 
                                  style="font-family: Lexend, 'Noto Color Emoji', sans-serif;"></textarea>
                        <label class="checkbox_label" for="nemo-chat-show-reply-prefix-checkbox">
                            <input id="nemo-chat-show-reply-prefix-checkbox" type="checkbox">
                            <small data-i18n="Show reply prefix in chat">Show reply prefix in chat</small>
                        </label>
                    </div>
                </div>

                <!-- Reasoning Controls Section -->
                <div class="range-block">
                    <div class="flex-container alignItemsBaseline">
                        <label class="checkbox_label flex1" for="nemo-reasoning-auto-parse" title="Automatically parse reasoning blocks from main content between the reasoning prefix/suffix. Both fields must be defined and non-empty.">
                            <input id="nemo-reasoning-auto-parse" type="checkbox">
                            <small data-i18n="Auto-Parse">Auto-Parse</small>
                        </label>
                        <label class="checkbox_label flex1" for="nemo-reasoning-auto-expand" title="Automatically expand reasoning blocks.">
                            <input id="nemo-reasoning-auto-expand" type="checkbox">
                            <small data-i18n="Auto-Expand">Auto-Expand</small>
                        </label>
                        <label class="checkbox_label flex1" for="nemo-reasoning-show-hidden" title="Show reasoning time for models with hidden reasoning.">
                            <input id="nemo-reasoning-show-hidden" type="checkbox">
                            <small data-i18n="Show Hidden">Show Hidden</small>
                        </label>
                    </div>
                    <div class="flex-container alignItemsBaseline">
                        <label class="checkbox_label flex1" for="nemo-reasoning-add-to-prompts" title="Add existing reasoning blocks to prompts. To add a new reasoning block, use the message edit menu.">
                            <input id="nemo-reasoning-add-to-prompts" type="checkbox">
                            <small data-i18n="Add to Prompts">Add to Prompts</small>
                        </label>
                        <div class="flex1 flex-container alignItemsBaseline" title="Maximum number of reasoning blocks to be added per prompt, counting from the last message.">
                            <input id="nemo-reasoning-max-additions" class="text_pole textarea_compact widthUnset" type="number" min="0" max="999" style="font-family: Lexend, 'Noto Color Emoji', sans-serif;">
                            <small data-i18n="Max">Max</small>
                        </div>
                    </div>
                </div>

                <!-- Request Model Reasoning -->
                <div class="range-block">
                    <label for="nemo-openai-show-thoughts" class="checkbox_label widthFreeExpand">
                        <input id="nemo-openai-show-thoughts" type="checkbox">
                        <span data-i18n="Request model reasoning">Request model reasoning</span>
                    </label>
                    <div class="toggle-description justifyLeft marginBot5">
                        <span data-i18n="Allows the model to return its thinking process.">Allows the model to return its thinking process.</span>
                        <span data-i18n="This setting affects visibility only.">This setting affects visibility only.</span>
                    </div>
                </div>

                <!-- Reasoning Effort -->
                <div class="flex-container flexFlowColumn wide100p textAlignCenter marginTop10">
                    <div class="flex-container oneline-dropdown" title="Constrains effort on reasoning for reasoning models. Reducing reasoning effort can result in faster responses and fewer tokens used on reasoning in a response.">
                        <label for="nemo-openai-reasoning-effort">
                            <span data-i18n="Reasoning Effort">Reasoning Effort</span>
                        </label>
                        <select id="nemo-openai-reasoning-effort" style="font-family: Lexend, 'Noto Color Emoji', sans-serif;">
                            <option data-i18n="openai_reasoning_effort_auto" value="auto">Auto</option>
                            <option data-i18n="openai_reasoning_effort_minimum" value="min">Minimum</option>
                            <option data-i18n="openai_reasoning_effort_low" value="low">Low</option>
                            <option data-i18n="openai_reasoning_effort_medium" value="medium">Medium</option>
                            <option data-i18n="openai_reasoning_effort_high" value="high">High</option>
                            <option data-i18n="openai_reasoning_effort_maximum" value="max">Maximum</option>
                        </select>
                    </div>
                </div>

                <!-- Reasoning Formatting -->
                <div class="inline-drawer wide100p">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b data-i18n="Reasoning Formatting">Reasoning Formatting</b>
                        <div class="fa-solid fa-circle-chevron-down inline-drawer-icon down interactable" tabindex="0"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div class="flex-container" title="Select your current Reasoning Template">
                            <select id="nemo-reasoning-select" class="flex1 text_pole" style="font-family: Lexend, 'Noto Color Emoji', sans-serif;">
                                <option value="Blank">Blank</option>
                                <option value="DeepSeek">DeepSeek</option>
                                <option value="Gemini">Gemini</option>
                            </select>
                        </div>
                        <div class="flex-container">
                            <div class="flex1" title="Inserted before the reasoning content.">
                                <small data-i18n="Prefix">Prefix</small>
                                <textarea id="nemo-reasoning-prefix" class="text_pole textarea_compact autoSetHeight" style="font-family: Lexend, 'Noto Color Emoji', sans-serif;"></textarea>
                            </div>
                            <div class="flex1" title="Inserted after the reasoning content.">
                                <small data-i18n="Suffix">Suffix</small>
                                <textarea id="nemo-reasoning-suffix" class="text_pole textarea_compact autoSetHeight" style="font-family: Lexend, 'Noto Color Emoji', sans-serif;"></textarea>
                            </div>
                        </div>
                        <div class="flex-container">
                            <div class="flex1" title="Inserted between the reasoning and the message content.">
                                <small data-i18n="Separator">Separator</small>
                                <textarea id="nemo-reasoning-separator" class="text_pole textarea_compact autoSetHeight" style="font-family: Lexend, 'Noto Color Emoji', sans-serif;"></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        
        // Insert after the Chat Completion Settings drawer
        chatCompletionDrawer.parentNode.insertBefore(reasoningSection, chatCompletionDrawer.nextSibling);
        
        logger.debug('Created Reasoning section after Chat Completion Settings');
    },

    createLorebookSection: function(container) {
        // Remove existing Lorebook section if it exists
        const existing = document.getElementById('nemoLorebookSection');
        if (existing) {
            existing.remove();
        }

        // Find the best position to insert the Lorebook section
        const reasoningSection = document.getElementById('nemoReasoningSection');
        const chatCompletionDrawer = document.getElementById('nemo-drawer-openai_chat_settings');
        
        let insertAfter = reasoningSection || chatCompletionDrawer;
        if (!insertAfter) {
            logger.warn('No suitable position found for Lorebook section');
            return;
        }

        const lorebookSection = document.createElement('div');
        lorebookSection.id = 'nemoLorebookSection';
        lorebookSection.className = 'inline-drawer wide100p nemo-converted-drawer';
        lorebookSection.innerHTML = `
            <div class="inline-drawer-toggle inline-drawer-header interactable" tabindex="0">
                <b data-i18n="Lorebook Management">Lorebook Management</b>
                <div class="inline-drawer-icon fa-solid fa-chevron-down interactable down" tabindex="0"></div>
            </div>
            <div class="inline-drawer-content" style="display: none;">
                <!-- Active Lorebooks Section -->
                <div class="range-block">
                    <div class="wide100p">
                        <div class="flex-container alignItemsCenter">
                            <span data-i18n="Active Lorebooks">Active Lorebooks</span>
                        </div>
                        <div id="nemo-active-lorebooks" class="nemo-active-lorebooks-list">
                            <!-- Active lorebooks will be populated here -->
                        </div>
                    </div>
                </div>

                <!-- Add Lorebook Section -->
                <div class="range-block">
                    <div class="wide100p">
                        <div class="flex-container alignItemsCenter">
                            <span data-i18n="Add Lorebook">Add Lorebook</span>
                        </div>
                        <div class="flex-container">
                            <select id="nemo-lorebook-select" class="flex1 text_pole" style="font-family: Lexend, 'Noto Color Emoji', sans-serif;">
                                <option value="">Select a lorebook...</option>
                                <!-- Available lorebooks will be populated here -->
                            </select>
                            <button id="nemo-add-lorebook-btn" class="menu_button" title="Add selected lorebook">
                                <i class="fa-solid fa-plus"></i> Add
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        
        // Insert after the determined position
        insertAfter.parentNode.insertBefore(lorebookSection, insertAfter.nextSibling);
        
        const positionName = reasoningSection ? 'Reasoning section' : 'Chat Completion Settings';
        logger.debug(`Created Lorebook Management section after ${positionName}`);
    },

    refreshActiveLorebooksDisplay: function() {
        const activeLorebooksContainer = document.getElementById('nemo-active-lorebooks');
        const worldInfoSelect = document.getElementById('world_info');
        if (!activeLorebooksContainer || !worldInfoSelect) return;

        activeLorebooksContainer.innerHTML = '';
        const selectedOptions = Array.from(worldInfoSelect.selectedOptions);

        if (selectedOptions.length === 0) {
            activeLorebooksContainer.innerHTML = '<div class="nemo-no-lorebooks">No active lorebooks</div>';
            return;
        }

        selectedOptions.forEach(option => {
            const entryElement = document.createElement('div');
            entryElement.className = 'nemo-lorebook-entry';
            entryElement.innerHTML = `
                <div class="nemo-lorebook-info">
                    <span class="nemo-lorebook-name">${option.text}</span>
                </div>
                <button class="nemo-remove-lorebook menu_button menu_button_icon"
                        data-book-name="${option.text}"
                        title="Deactivate this lorebook">
                    <i class="fa-solid fa-times"></i>
                </button>`;
            activeLorebooksContainer.appendChild(entryElement);
        });
    },

    populateAvailableLorebooksDropdown: function() {
        const lorebookSelect = document.getElementById('nemo-lorebook-select');
        const worldInfoSelect = document.getElementById('world_info');
        if (!lorebookSelect || !worldInfoSelect) return;

        lorebookSelect.innerHTML = '<option value="">Select a lorebook...</option>';
        
        Array.from(worldInfoSelect.options).forEach(option => {
            if (option.value && !option.selected) {
                const newOption = document.createElement('option');
                newOption.value = option.text;
                newOption.textContent = option.text;
                lorebookSelect.appendChild(newOption);
            }
        });
    },

    /**
     * Get counts for a section (prompts only, not including sub-sections)
     * @param {HTMLElement} sectionElement - The section to count
     * @returns {{enabled: number, total: number}} The counts
     */
    getSectionDirectCounts: function(sectionElement) {
        const content = sectionElement.querySelector('.nemo-section-content');
        if (!content) return { enabled: 0, total: 0 };

        let totalCount = 0;
        let enabledCount = 0;

        // Check if section is in tray mode (prompts hidden from DOM)
        if (sectionElement._nemoPromptIds && sectionElement._nemoPromptIds.length > 0) {
            // Tray mode: get counts from stored prompt IDs using promptManager
            const storedPromptIds = sectionElement._nemoPromptIds;
            totalCount = storedPromptIds.length;

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
        } else {
            // Standard mode: count from DOM elements (only prompt items, not sub-sections)
            const promptItems = content.querySelectorAll(`:scope > ${SELECTORS.promptItemRow}:not(.nemo-tray-hidden-prompt)`);
            totalCount = promptItems.length;
            enabledCount = content.querySelectorAll(`:scope > ${SELECTORS.promptItemRow}:not(.nemo-tray-hidden-prompt) .${SELECTORS.enabledToggleClass}`).length;
        }

        return { enabled: enabledCount, total: totalCount };
    },

    /**
     * Recursively get aggregated counts for a section including all sub-sections
     * @param {HTMLElement} sectionElement - The section to count
     * @returns {{enabled: number, total: number}} The aggregated counts
     */
    getAggregatedCounts: function(sectionElement) {
        // Get direct counts for this section
        const directCounts = this.getSectionDirectCounts(sectionElement);
        let totalEnabled = directCounts.enabled;
        let totalCount = directCounts.total;

        // Find all direct child sub-sections and add their aggregated counts
        const content = sectionElement.querySelector('.nemo-section-content');
        if (content) {
            const subSections = content.querySelectorAll(':scope > details.nemo-engine-section');
            subSections.forEach(subSection => {
                const subCounts = this.getAggregatedCounts(subSection);
                totalEnabled += subCounts.enabled;
                totalCount += subCounts.total;
            });
        }

        return { enabled: totalEnabled, total: totalCount };
    },

    updateSectionCount: function(sectionElement) {
        if (!sectionElement || !sectionElement.matches('details.nemo-engine-section')) return;

        const content = sectionElement.querySelector('.nemo-section-content');
        if (!content) return;

        // Get aggregated counts (includes all sub-sections recursively)
        const { enabled: enabledCount, total: totalCount } = this.getAggregatedCounts(sectionElement);

        const countSpan = sectionElement.querySelector('summary .nemo-enabled-count');
        if (countSpan) countSpan.textContent = ` (${enabledCount}/${totalCount})`;

        const masterToggle = sectionElement.querySelector('.nemo-section-master-toggle');
        if (masterToggle) masterToggle.classList.toggle('nemo-active', enabledCount > 0);

        // Update progress bar
        const progressBar = sectionElement.querySelector('summary .nemo-section-progress');
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
    },

    // Core Logic
    takeSnapshot: async function() {
        try {
            logger.info('Starting snapshot capture...');
            
            const promptsContainer = document.querySelector(SELECTORS.promptsContainer);
            if (!promptsContainer) {
                logger.error('Prompts container not found');
                this.showStatusMessage('Error: Prompt manager not available.', 'error');
                return;
            }

            const activeIdentifiers = new Set();
            const enabledToggles = document.querySelectorAll(`${SELECTORS.promptsContainer} ${SELECTORS.toggleButton}.${SELECTORS.enabledToggleClass}`);
            
            logger.debug(`Found ${enabledToggles.length} enabled toggles`);
            
            enabledToggles.forEach(toggle => {
                const promptLi = toggle.closest(SELECTORS.promptItemRow);
                if (promptLi && promptLi.dataset.pmIdentifier) {
                    activeIdentifiers.add(promptLi.dataset.pmIdentifier);
                    logger.debug('Added to snapshot', { identifier: promptLi.dataset.pmIdentifier });
                }
            });

            const snapshotArray = Array.from(activeIdentifiers);
            console.log(`${LOG_PREFIX} Snapshot contains ${snapshotArray.length} prompts:`, snapshotArray);

            const currentApi = getContext().openai_api || 'openai';
            storage.saveSnapshot(currentApi, snapshotArray);
            
            const applySnapshotBtn = document.getElementById('nemoApplySnapshotBtn');
            if (applySnapshotBtn) {
                applySnapshotBtn.disabled = false;
            }
            
            this.showStatusMessage(`Snapshot created with ${snapshotArray.length} active prompt(s).`, 'success');
            console.log(`${LOG_PREFIX} Snapshot saved successfully`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error taking snapshot:`, error);
            this.showStatusMessage('Error creating snapshot.', 'error');
        }
    },

    applySnapshot: async function() {
        try {
            console.log(`${LOG_PREFIX} Starting snapshot application...`);

            const currentApi = getContext().openai_api || 'openai';
            const snapshotData = storage.getSnapshot(currentApi);
            if (!snapshotData || !Array.isArray(snapshotData)) {
                console.log(`${LOG_PREFIX} No snapshot found for ${currentApi}`);
                this.showStatusMessage('No snapshot taken.', 'error');
                return;
            }

            const snapshotIdentifiers = new Set(snapshotData);
            console.log(`${LOG_PREFIX} Applying snapshot with ${snapshotIdentifiers.size} prompts:`, Array.from(snapshotIdentifiers));
            
            const allPromptItems = document.querySelectorAll(`${SELECTORS.promptsContainer} ${SELECTORS.promptItemRow}`);
            console.log(`${LOG_PREFIX} Found ${allPromptItems.length} prompt items in DOM`);
            
            const togglesToClick = [];
            let matchedPrompts = 0;
            
            allPromptItems.forEach(item => {
                const identifier = item.dataset.pmIdentifier;
                const toggleButton = item.querySelector(SELECTORS.toggleButton);
                
                if (!identifier || !toggleButton) {
                    console.warn(`${LOG_PREFIX} Item missing identifier or toggle button:`, item);
                    return;
                }
                
                const isCurrentlyEnabled = toggleButton.classList.contains(SELECTORS.enabledToggleClass);
                const shouldBeEnabled = snapshotIdentifiers.has(identifier);
                
                if (snapshotIdentifiers.has(identifier)) {
                    matchedPrompts++;
                }
                
                if (isCurrentlyEnabled !== shouldBeEnabled) {
                    togglesToClick.push({
                        button: toggleButton,
                        identifier: identifier,
                        shouldEnable: shouldBeEnabled
                    });
                    console.log(`${LOG_PREFIX} Will toggle ${identifier}: ${isCurrentlyEnabled} -> ${shouldBeEnabled}`);
                }
            });

            console.log(`${LOG_PREFIX} Matched ${matchedPrompts} prompts from snapshot, ${togglesToClick.length} need toggling`);

            if (togglesToClick.length > 0) {
                this.showStatusMessage(`Applying snapshot... changing ${togglesToClick.length} prompts.`, 'info', 5000);
                
                for (const item of togglesToClick) {
                    console.log(`${LOG_PREFIX} Toggling ${item.identifier}`);
                    item.button.click();
                    await delay(50);
                }
                
                await delay(100);
                this.showStatusMessage(`Snapshot applied. ${snapshotIdentifiers.size} prompt(s) are now active.`, 'success');
                console.log(`${LOG_PREFIX} Snapshot application complete`);
            } else {
                this.showStatusMessage('Current state already matches snapshot.', 'info');
                console.log(`${LOG_PREFIX} No changes needed - current state matches snapshot`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error applying snapshot:`, error);
            this.showStatusMessage('Error applying snapshot.', 'error');
        }
    },

    // Capture current prompt toggle states before preset change
    capturePromptStates: async function() {
        try {
            console.log(`${LOG_PREFIX} Capturing prompt states before preset change...`);

            const activeIdentifiers = new Set();
            const enabledToggles = document.querySelectorAll(`${SELECTORS.promptsContainer} ${SELECTORS.toggleButton}.${SELECTORS.enabledToggleClass}`);

            enabledToggles.forEach(toggle => {
                const promptLi = toggle.closest(SELECTORS.promptItemRow);
                if (promptLi && promptLi.dataset.pmIdentifier) {
                    activeIdentifiers.add(promptLi.dataset.pmIdentifier);
                }
            });

            const stateArray = Array.from(activeIdentifiers);
            console.log(`${LOG_PREFIX} Captured ${stateArray.length} active prompts:`, stateArray);

            storage.savePromptStates(stateArray);

            return stateArray;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error capturing prompt states:`, error);
            return [];
        }
    },

    // Restore prompt toggle states after preset change by matching UIDs
    restorePromptStates: async function() {
        try {
            console.log(`${LOG_PREFIX} Restoring prompt states after preset change...`);

            const savedStates = storage.getPromptStates();
            if (!savedStates || savedStates.length === 0) {
                console.log(`${LOG_PREFIX} No saved prompt state found`);
                return;
            }

            const savedIdentifiers = new Set(savedStates);
            console.log(`${LOG_PREFIX} Restoring state for ${savedIdentifiers.size} prompts:`, Array.from(savedIdentifiers));

            // Wait for preset to actually load with polling and timeout
            const maxWaitTime = CONSTANTS.TIMEOUTS.PRESET_LOAD_MAX_WAIT;
            const pollInterval = CONSTANTS.TIMEOUTS.PRESET_LOAD_POLL_INTERVAL;
            let elapsedTime = 0;

            const waitForPresetLoad = async () => {
                while (elapsedTime < maxWaitTime) {
                    const promptList = document.querySelector(SELECTORS.promptsContainer);
                    const promptItems = promptList?.querySelectorAll(SELECTORS.promptItemRow);

                    // Check if prompts are actually loaded (not empty or in loading state)
                    if (promptItems && promptItems.length > 0) {
                        // Verify prompts have proper data attributes
                        const hasValidData = Array.from(promptItems).some(item =>
                            item.dataset.pmIdentifier
                        );
                        if (hasValidData) {
                            console.log(`${LOG_PREFIX} Preset loaded after ${elapsedTime}ms`);
                            return true;
                        }
                    }

                    await delay(pollInterval);
                    elapsedTime += pollInterval;
                }
                return false;
            };

            const isLoaded = await waitForPresetLoad();
            if (!isLoaded) {
                console.warn(`${LOG_PREFIX} Preset load timeout after ${maxWaitTime}ms - skipping restoration`);
                return;
            }

            const allPromptItems = document.querySelectorAll(`${SELECTORS.promptsContainer} ${SELECTORS.promptItemRow}`);
            console.log(`${LOG_PREFIX} Found ${allPromptItems.length} prompt items in new preset`);

            const togglesToClick = [];
            let matchedPrompts = 0;

            allPromptItems.forEach(item => {
                const identifier = item.dataset.pmIdentifier;
                const toggleButton = item.querySelector(SELECTORS.toggleButton);

                if (!identifier || !toggleButton) {
                    return;
                }

                const isCurrentlyEnabled = toggleButton.classList.contains(SELECTORS.enabledToggleClass);
                const shouldBeEnabled = savedIdentifiers.has(identifier);

                if (savedIdentifiers.has(identifier)) {
                    matchedPrompts++;
                    console.log(`${LOG_PREFIX} Matched prompt by UID: ${identifier}`);
                }

                // Only toggle if the state needs to change
                if (isCurrentlyEnabled !== shouldBeEnabled) {
                    togglesToClick.push({
                        button: toggleButton,
                        identifier: identifier,
                        shouldEnable: shouldBeEnabled
                    });
                    console.log(`${LOG_PREFIX} Will toggle ${identifier}: ${isCurrentlyEnabled} -> ${shouldBeEnabled}`);
                }
            });

            console.log(`${LOG_PREFIX} Matched ${matchedPrompts} prompts by UID from previous preset, ${togglesToClick.length} need toggling`);

            if (togglesToClick.length > 0) {
                this.showStatusMessage(`Restoring ${matchedPrompts} matching prompts from previous state...`, 'info', 3000);

                for (const item of togglesToClick) {
                    console.log(`${LOG_PREFIX} Toggling ${item.identifier}`);
                    item.button.click();
                    await delay(CONSTANTS.TIMEOUTS.TOGGLE_BATCH_DELAY);
                }

                await delay(CONSTANTS.TIMEOUTS.UI_UPDATE_DELAY);
                this.showStatusMessage(`Restored ${matchedPrompts} prompt(s) by matching UIDs.`, 'success');
                this.showPromptRestorationNotification(matchedPrompts, togglesToClick.length);
                console.log(`${LOG_PREFIX} Prompt state restoration complete`);
            } else if (matchedPrompts > 0) {
                console.log(`${LOG_PREFIX} ${matchedPrompts} prompts already in correct state`);
                this.showPromptRestorationNotification(matchedPrompts, 0);
            } else {
                console.log(`${LOG_PREFIX} No matching prompts found by UID in new preset`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error restoring prompt states:`, error);
        }
    },

    // Show a non-intrusive toast notification for prompt restoration
    showPromptRestorationNotification: function(matchedCount, toggledCount) {
        try {
            // Create toast notification element
            const toast = document.createElement('div');
            toast.className = 'nemo-prompt-restoration-toast';

            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-check-circle';

            const message = document.createElement('span');
            if (toggledCount > 0) {
                message.textContent = `Preset updated: ${matchedCount} prompt${matchedCount !== 1 ? 's' : ''} restored to previous state`;
            } else {
                message.textContent = `Preset updated: ${matchedCount} prompt${matchedCount !== 1 ? 's' : ''} already active`;
            }

            toast.appendChild(icon);
            toast.appendChild(message);

            // Add to document
            document.body.appendChild(toast);

            // Trigger animation
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            // Remove after delay
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, CONSTANTS.TIMEOUTS.TOAST_FADE_OUT);
            }, CONSTANTS.TIMEOUTS.TOAST_DURATION);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error showing restoration notification:`, error);
        }
    },

    refreshUI: function() {
        console.log(`${LOG_PREFIX} Refreshing UI...`);
        const container = document.querySelector(SELECTORS.promptsContainer);
        if (container) {
            // Check if UI elements exist, if not recreate them
            const searchContainer = document.getElementById('nemoPresetSearchContainer');
            const reasoningSection = document.getElementById('nemoReasoningSection');
            const lorebookSection = document.getElementById('nemoLorebookSection');
            const chatCompletionDrawer = document.getElementById('nemo-drawer-openai_chat_settings');
            
            if (!searchContainer) {
                console.log(`${LOG_PREFIX} Search UI missing, recreating...`);
                this.createSearchAndStatusUI(container);
            }
            
            // Check if reasoning section should be shown
            const shouldShowReasoning = extension_settings[NEMO_EXTENSION_NAME]?.enableReasoningSection !== false;
            if (shouldShowReasoning && !reasoningSection && chatCompletionDrawer) {
                console.log(`${LOG_PREFIX} Reasoning section missing, recreating...`);
                this.createReasoningSection(container);
            } else if (!shouldShowReasoning && reasoningSection) {
                console.log(`${LOG_PREFIX} Reasoning section disabled, removing...`);
                reasoningSection.remove();
            }
            
            // Check if lorebook management section should be shown
            const shouldShowLorebook = extension_settings[NEMO_EXTENSION_NAME]?.enableLorebookManagement !== false;
            const currentReasoningSection = document.getElementById('nemoReasoningSection');
            if (shouldShowLorebook && !lorebookSection && (currentReasoningSection || chatCompletionDrawer)) {
                console.log(`${LOG_PREFIX} Lorebook section missing, recreating...`);
                this.createLorebookSection(container);
            } else if (!shouldShowLorebook && lorebookSection) {
                console.log(`${LOG_PREFIX} Lorebook section disabled, removing...`);
                lorebookSection.remove();
            }
            
            // Re-setup event listeners in case they were lost during preset changes
            setTimeout(() => {
                this.setupEventListeners();
                this.checkExistingSnapshot();
                // Re-sync values after UI refresh
                this.syncStartReplyWithValues();
            }, 100);
        }
    },

    getDividerInfo: function(promptElement, forceCheck = false) {
        if (!forceCheck && promptElement.dataset.nemoDividerChecked) {
            if (promptElement.dataset.nemoIsDivider === 'true') {
                return {
                    isDivider: true,
                    isSubHeader: promptElement.dataset.nemoIsSubHeader === 'true',
                    name: promptElement.dataset.nemoSectionName,
                    originalText: promptElement.dataset.nemoOriginalText
                };
            }
            return { isDivider: false, isSubHeader: false };
        }

        const promptNameElement = promptElement.querySelector(SELECTORS.promptNameLink);
        if (!promptNameElement) return { isDivider: false, isSubHeader: false };

        const promptName = promptNameElement.textContent.trim();

        // Check for sub-header pattern: < text >
        const subHeaderMatch = /^<\s*(.+?)\s*>$/.exec(promptName);
        if (subHeaderMatch) {
            const cleanName = subHeaderMatch[1].trim() || "Sub-Section";

            promptElement.dataset.nemoDividerChecked = 'true';
            promptElement.dataset.nemoIsDivider = 'true';
            promptElement.dataset.nemoIsSubHeader = 'true';
            promptElement.dataset.nemoSectionName = cleanName;
            promptElement.dataset.nemoOriginalText = promptName;

            return { isDivider: true, isSubHeader: true, name: cleanName, originalText: promptName };
        }

        // Check for main header pattern: === text === or similar
        const match = DIVIDER_PREFIX_REGEX.exec(promptName);

        promptElement.dataset.nemoDividerChecked = 'true';

        if (match) {
            let cleanName = promptName.substring(match[0].length).trim();
            const suffixRegex = new RegExp(`\\s*(${escapeRegex(match[1])})\\s*$`);
            cleanName = cleanName.replace(suffixRegex, '').trim() || "Section";

            promptElement.dataset.nemoIsDivider = 'true';
            promptElement.dataset.nemoIsSubHeader = 'false';
            promptElement.dataset.nemoSectionName = cleanName;
            promptElement.dataset.nemoOriginalText = promptName;

            return { isDivider: true, isSubHeader: false, name: cleanName, originalText: promptName };
        }

        promptElement.dataset.nemoIsDivider = 'false';
        promptElement.dataset.nemoIsSubHeader = 'false';
        return { isDivider: false, isSubHeader: false };
    },

    // Favorites Logic
    getFavorites: function() {
        return storage.getFavoritePresets();
    },

    saveFavorites: function(favorites) {
        storage.saveFavoritePresets(favorites);
        eventSource.emit(CONSTANTS.EVENTS.FAVORITES_UPDATED);
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

    // ** REFACTORED RENDER/ORGANIZATION LOGIC **
    organizePrompts: async function(forceFullReorganization = false) {
        const promptsContainer = document.querySelector(SELECTORS.promptsContainer);
        if (!promptsContainer || (promptsContainer.dataset.nemoOrganizing === 'true' && !forceFullReorganization)) return;
        promptsContainer.dataset.nemoOrganizing = 'true';

        isSectionsFeatureEnabled = storage.getSectionsEnabled();

        // --- Start: Robust Flattening Logic ---
        const allPromptsInOrder = [];
        const allCurrentItems = Array.from(promptsContainer.querySelectorAll('li.completion_prompt_manager_prompt'));

        allCurrentItems.forEach(item => {
            // Restore original text if it's a header
            if (item.classList.contains('nemo-header-item')) {
                const link = item.querySelector(SELECTORS.promptNameLink);
                if (link && item.dataset.nemoOriginalText) {
                    link.textContent = item.dataset.nemoOriginalText;
                }
            }
            allPromptsInOrder.push(item);
        });

        const fragment = document.createDocumentFragment();
        allPromptsInOrder.forEach(p => fragment.appendChild(p));
        promptsContainer.innerHTML = '';
        promptsContainer.appendChild(fragment);
        // --- End: Robust Flattening Logic ---

        // Clean up metadata
        const allItems = Array.from(promptsContainer.querySelectorAll('li.completion_prompt_manager_prompt'));
        allItems.forEach(item => {
            delete item.dataset.nemoDividerChecked;
            delete item.dataset.nemoIsDivider;
            delete item.dataset.nemoSectionName;
            delete item.dataset.nemoOriginalText;
            item.classList.remove('nemo-header-item');
            item.draggable = true;
        });

        // Add favorite buttons and drag handles
        allItems.forEach(item => {
            // Add drag handle to non-header items if it doesn't exist
            if (!item.classList.contains('nemo-header-item') && !item.querySelector('.drag-handle')) {
                const dragHandle = document.createElement('span');
                dragHandle.className = 'drag-handle';
                dragHandle.innerHTML = '&#9776;'; // Hamburger icon
                item.prepend(dragHandle);
            }

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

            // Apply tooltips to prompt items
            applyTooltipToPrompt(item);
        });

        if (!isSectionsFeatureEnabled) {
            delete promptsContainer.dataset.nemoOrganizing;
            return;
        }

        // Capture current section states before clearing (prevents race condition)
        captureCurrentSectionStates();

        // Rebuild sections
        const itemsToProcess = Array.from(promptsContainer.children);
        promptsContainer.innerHTML = ''; // Clear the container

        itemsToProcess.forEach(item => {
            if (item.matches('li.completion_prompt_manager_prompt')) {
                this.processSingleItem(item, promptsContainer);
            }
        });
        
        delete promptsContainer.dataset.nemoOrganizing;
        this.initializeDragAndDrop(promptsContainer);
    },

    processSingleItem: function(item, container) {
        const dividerInfo = this.getDividerInfo(item, true);

        if (dividerInfo.isDivider) {
            item.classList.add('nemo-header-item');
            item.draggable = false;

            const details = document.createElement('details');
            // Build class list - include accordion class immediately if in accordion mode
            const isAccordionMode = storage.getDropdownStyle() === 'accordion';
            let className = dividerInfo.isSubHeader ? 'nemo-engine-section nemo-sub-section' : 'nemo-engine-section';
            if (isAccordionMode) {
                className += ' nemo-accordion-section';
                details.dataset.accordionConverted = 'true';
            }
            details.className = className;
            // Default to open (true) unless explicitly saved as closed
            details.open = openSectionStates[dividerInfo.originalText] !== false;

            const summary = document.createElement('summary');
            const nameSpan = item.querySelector('span.completion_prompt_manager_prompt_name');
            if (nameSpan) {
                const link = nameSpan.querySelector('a');
                if (link) link.textContent = dividerInfo.name;
                if (!nameSpan.querySelector('.nemo-enabled-count')) {
                    nameSpan.insertAdjacentHTML('beforeend', '<span class="nemo-enabled-count"></span>');
                }
                // Add progress bar after the count
                if (!nameSpan.querySelector('.nemo-section-progress')) {
                    nameSpan.insertAdjacentHTML('beforeend', '<span class="nemo-section-progress" title="Progress: enabled/total"></span>');
                }
            }

            summary.appendChild(item);
            details.appendChild(summary);
            const contentDiv = document.createElement('div');
            contentDiv.className = 'nemo-section-content';
            details.appendChild(contentDiv);

            // If this is a sub-header, try to nest it inside the last main section
            if (dividerInfo.isSubHeader) {
                const lastMainSection = this.findLastMainSection(container);
                if (lastMainSection) {
                    const mainContent = lastMainSection.querySelector('.nemo-section-content');
                    mainContent.appendChild(details);
                    this.updateSectionCount(lastMainSection);
                    return details;
                }
            }

            container.appendChild(details);
            this.updateSectionCount(details);
            return details;
        } else {
            // Apply accordion enhancement immediately if in accordion mode
            const isAccordionMode = storage.getDropdownStyle() === 'accordion';
            if (isAccordionMode) {
                applyAccordionEnhancement(item);
            }

            // Check if there's a sub-section to add to first, then main section
            const lastSubSection = this.findLastSubSection(container);
            if (lastSubSection) {
                const content = lastSubSection.querySelector('.nemo-section-content');
                content.appendChild(item);
                this.updateSectionCount(lastSubSection);
                // Also update parent section count
                const parentSection = lastSubSection.closest('details.nemo-engine-section:not(.nemo-sub-section)');
                if (parentSection) this.updateSectionCount(parentSection);
                return item;
            }

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

    findLastMainSection: function(container) {
        const sections = Array.from(container.querySelectorAll(':scope > details.nemo-engine-section:not(.nemo-sub-section)'));
        return sections[sections.length - 1] || null;
    },

    findLastSubSection: function(container) {
        const lastMainSection = this.findLastMainSection(container);
        if (!lastMainSection) return null;

        const subSections = Array.from(lastMainSection.querySelectorAll(':scope > .nemo-section-content > details.nemo-sub-section'));
        return subSections[subSections.length - 1] || null;
    },

    handlePresetSearch: function() {
        const searchInput = document.getElementById('nemoPresetSearchInput');
        const searchTerm = searchInput.value.trim().toLowerCase();
        const promptsContainer = document.querySelector(SELECTORS.promptsContainer);
        if (!promptsContainer) return;

        // Hide all items and sections initially
        promptsContainer.querySelectorAll(`${SELECTORS.promptItemRow}, details.nemo-engine-section`).forEach(el => el.style.display = 'none');
        
        if (searchTerm === '') {
            // Show all items when search is empty
            promptsContainer.querySelectorAll(`${SELECTORS.promptItemRow}, details.nemo-engine-section`).forEach(el => el.style.display = '');
            if (isSectionsFeatureEnabled) {
                promptsContainer.querySelectorAll('details.nemo-engine-section').forEach(section => {
                    const summaryLi = section.querySelector('summary > li');
                    if (summaryLi) {
                        const dividerInfo = this.getDividerInfo(summaryLi);
                        // Default to open unless explicitly saved as closed
                        section.open = openSectionStates[dividerInfo.originalText] !== false;
                    }
                });
            }
            return;
        }

        // Enhanced search: check both name and content
        const matchingItems = new Set();
        const sectionsWithMatches = new Set();

        promptsContainer.querySelectorAll(SELECTORS.promptItemRow).forEach(item => {
            let isMatch = false;
            
            // Search in prompt name
            const name = item.querySelector(SELECTORS.promptNameLink)?.textContent.trim().toLowerCase() || '';
            if (name.includes(searchTerm)) {
                isMatch = true;
            }
            
            // Search in prompt content
            if (!isMatch) {
                const identifier = item.dataset.pmIdentifier;
                if (identifier && promptManager?.serviceSettings?.prompts) {
                    const promptData = promptManager.serviceSettings.prompts.find(p => p.identifier === identifier);
                    if (promptData && promptData.content) {
                        const content = promptData.content.toLowerCase();
                        if (content.includes(searchTerm)) {
                            isMatch = true;
                        }
                    }
                }
            }
            
            if (isMatch) {
                matchingItems.add(item);
                item.style.display = '';
                
                // Mark parent section as having matches
                const parentSection = item.closest('details.nemo-engine-section');
                if (parentSection) {
                    sectionsWithMatches.add(parentSection);
                }
            }
        });

        // Show all sections that have matching items and ensure their headers are visible
        sectionsWithMatches.forEach(section => {
            section.style.display = '';
            section.open = true;
            
            // Ensure the header (summary) is visible
            const summaryLi = section.querySelector('summary > li');
            if (summaryLi) {
                summaryLi.style.display = '';
            }
        });

        console.log(`${LOG_PREFIX} Search for "${searchTerm}" found ${matchingItems.size} matching prompts in ${sectionsWithMatches.size} sections`);
    },

    // Event Handling & Initialization
    initialize: function(container) {
        if (container.dataset.nemoPromptsInitialized) return;
        container.dataset.nemoPromptsInitialized = 'true';

        this.createSearchAndStatusUI(container);

        // Check settings before creating optional sections
        if (extension_settings[NEMO_EXTENSION_NAME]?.enableReasoningSection !== false) {
            this.createReasoningSection(container);
        }

        if (extension_settings[NEMO_EXTENSION_NAME]?.enableLorebookManagement !== false) {
            this.createLorebookSection(container);
        }

        // Add event listeners with error handling
        this.setupEventListeners();

        container.addEventListener('click', this.handleContainerClick.bind(this));
        container.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        this.initializeObserver(container);
        this.createContextMenu();

        // Check if there's already a snapshot to enable the apply button
        this.checkExistingSnapshot();

        // Wait for prompts to be loaded before organizing
        // Use requestAnimationFrame to ensure DOM is fully rendered
        const waitForPromptsAndOrganize = () => {
            const promptItems = container.querySelectorAll('li.completion_prompt_manager_prompt');
            if (promptItems.length > 0) {
                // Prompts are loaded, organize them now
                this.organizePrompts();
            } else {
                // Prompts not loaded yet, wait a bit and try again
                // Use a short timeout to avoid blocking
                setTimeout(() => {
                    const itemsNow = container.querySelectorAll('li.completion_prompt_manager_prompt');
                    if (itemsNow.length > 0) {
                        this.organizePrompts();
                    } else {
                        // If still no prompts after delay, let the MutationObserver handle it
                        // This ensures we don't wait forever if there genuinely are no prompts
                        logger.debug('No prompts found after initialization delay, will wait for MutationObserver');
                    }
                }, 100);
            }
        };

        requestAnimationFrame(waitForPromptsAndOrganize);
    },

    setupEventListeners: function() {
        try {
            const searchInput = document.getElementById('nemoPresetSearchInput');
            const searchClear = document.getElementById('nemoPresetSearchClear');
            const takeSnapshotBtn = document.getElementById('nemoTakeSnapshotBtn');
            const applySnapshotBtn = document.getElementById('nemoApplySnapshotBtn');
            const toggleBtn = document.getElementById('nemoToggleSectionsBtn');
            const promptNavigatorBtn = document.getElementById('nemoPromptNavigatorBtn');
            const archiveNavigatorBtn = document.getElementById('nemoArchiveNavigatorBtn');

            if (searchInput) {
                searchInput.addEventListener('input', debounce(this.handlePresetSearch.bind(this), debounce_timeout.standard));
            }

            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    const input = document.getElementById('nemoPresetSearchInput'); 
                    if (input) {
                        input.value = ''; 
                        this.handlePresetSearch(); 
                        input.focus();
                    }
                });
            }

            if (takeSnapshotBtn) {
                takeSnapshotBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`${LOG_PREFIX} Taking snapshot...`);
                    this.takeSnapshot();
                });
            }

            if (applySnapshotBtn) {
                applySnapshotBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`${LOG_PREFIX} Applying snapshot...`);
                    this.applySnapshot();
                });
            }

            if (toggleBtn) {
                toggleBtn.classList.toggle('nemo-active', isSectionsFeatureEnabled);
                toggleBtn.setAttribute('aria-pressed', isSectionsFeatureEnabled);
                toggleBtn.addEventListener('click', async () => {
                    isSectionsFeatureEnabled = !isSectionsFeatureEnabled;
                    storage.setSectionsEnabled(isSectionsFeatureEnabled);
                    toggleBtn.classList.toggle('nemo-active', isSectionsFeatureEnabled);
                    toggleBtn.setAttribute('aria-pressed', isSectionsFeatureEnabled);

                    // When disabling sections, we need to revert tray mode first
                    // and trigger ST to re-render the prompt list (tray removed DOM elements)
                    if (!isSectionsFeatureEnabled) {
                        console.log(`${LOG_PREFIX} Disabling sections - reverting tray mode`);
                        disableTrayMode();

                        // Trigger ST prompt manager to re-render the list
                        if (promptManager && typeof promptManager.render === 'function') {
                            console.log(`${LOG_PREFIX} Triggering prompt manager re-render`);
                            promptManager.render();
                            // Wait for DOM to update before organizing
                            await delay(100);
                        }
                    }

                    this.organizePrompts(true);
                });
            }
            
            if (promptNavigatorBtn) {
                promptNavigatorBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showPromptNavigator();
                });
            }

            if (archiveNavigatorBtn) {
                archiveNavigatorBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showArchiveNavigator();
                });
            }

            // Setup Reasoning and Start Reply With synchronization
            this.setupReasoningSync();
            this.setupStartReplyWithSync();
            this.setupLorebookEventListeners();

            // Setup prompt state preservation on preset changes
            this.setupPromptStatePreservation();

            console.log(`${LOG_PREFIX} Event listeners attached successfully`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up event listeners:`, error);
        }
    },

    setupPromptStatePreservation: function() {
        try {
            // DISABLED: This feature causes extreme lag and doesn't work correctly
            // The polling loop in restorePromptStates causes UI freezing

            // Remove any existing listeners to prevent duplicates
            if (this._presetChangeAfterHandler) {
                eventSource.removeListener(event_types.OAI_PRESET_CHANGED_AFTER, this._presetChangeAfterHandler);
                this._presetChangeAfterHandler = null;
            }

            console.log(`${LOG_PREFIX} Prompt state preservation disabled to prevent lag`);
            return;

            // ORIGINAL CODE COMMENTED OUT:
            /*
            // Create bound handler for after preset change
            this._presetChangeAfterHandler = async () => {
                console.log(`${LOG_PREFIX} Preset change detected (AFTER) - restoring matching prompts`);
                await this.restorePromptStates();
            };

            // Listen for preset changes AFTER
            eventSource.on(event_types.OAI_PRESET_CHANGED_AFTER, this._presetChangeAfterHandler);

            // Also hook into preset select dropdowns to capture state before change
            const supportedApis = ['openai', 'novel', 'kobold', 'textgenerationwebui', 'anthropic', 'claude', 'google', 'scale', 'cohere', 'mistral', 'aix', 'openrouter'];
            supportedApis.forEach(api => {
                const select = document.querySelector(`select[data-preset-manager-for="${api}"]`);
                if (select && !select.dataset.nemoStatePreservationPatched) {
                    select.dataset.nemoStatePreservationPatched = 'true';

                    // Capture state before the change event fires
                    select.addEventListener('mousedown', () => {
                        console.log(`${LOG_PREFIX} Preset select mousedown - capturing current state`);
                        this.capturePromptStates();
                    });

                    // Also capture on keyboard navigation
                    select.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            console.log(`${LOG_PREFIX} Preset select keyboard - capturing current state`);
                            this.capturePromptStates();
                        }
                    });
                }
            });

            console.log(`${LOG_PREFIX} Prompt state preservation system initialized`);
            */
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up prompt state preservation:`, error);
        }
    },

    setupReasoningSync: function() {
        try {
            // Setup reasoning checkboxes
            this.setupCheckboxSync('nemo-reasoning-auto-parse', 'reasoning_auto_parse');
            this.setupCheckboxSync('nemo-reasoning-auto-expand', 'reasoning_auto_expand');
            this.setupCheckboxSync('nemo-reasoning-show-hidden', 'reasoning_show_hidden');
            this.setupCheckboxSync('nemo-reasoning-add-to-prompts', 'reasoning_add_to_prompts');
            this.setupCheckboxSync('nemo-openai-show-thoughts', 'openai_show_thoughts');

            // Setup number input
            this.setupNumberInputSync('nemo-reasoning-max-additions', 'reasoning_max_additions');

            // Setup select dropdowns
            this.setupSelectSync('nemo-openai-reasoning-effort', 'openai_reasoning_effort');
            this.setupSelectSync('nemo-reasoning-select', 'reasoning_select');

            // Setup textareas
            this.setupTextareaSync('nemo-reasoning-prefix', 'reasoning_prefix');
            this.setupTextareaSync('nemo-reasoning-suffix', 'reasoning_suffix');
            this.setupTextareaSync('nemo-reasoning-separator', 'reasoning_separator');

            console.log(`${LOG_PREFIX} Reasoning sync setup complete`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up Reasoning sync:`, error);
        }
    },

    setupRangeSlider: function(sliderId, counterId, settingKey, originalInputId) {
        try {
            const slider = document.getElementById(sliderId);
            const counter = document.getElementById(counterId);
            const originalInput = document.getElementById(originalInputId);

            if (!slider || !counter) {
                logger.debug(`Range slider elements not found: ${sliderId}`);
                return;
            }

            // Initialize value from original input if available
            if (originalInput) {
                slider.value = originalInput.value || slider.value;
                counter.textContent = parseFloat(slider.value).toFixed(2);
            }

            // Update counter and sync with original
            slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                counter.textContent = value.toFixed(2);
                
                if (originalInput) {
                    originalInput.value = value;
                    originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            // Listen for changes from original
            if (originalInput) {
                originalInput.addEventListener('input', () => {
                    if (slider.value !== originalInput.value) {
                        slider.value = originalInput.value;
                        counter.textContent = parseFloat(originalInput.value).toFixed(2);
                    }
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up range slider ${sliderId}:`, error);
        }
    },

    setupCheckboxSync: function(checkboxId, originalCheckboxId) {
        try {
            const checkbox = document.getElementById(checkboxId);
            const originalCheckbox = document.getElementById(originalCheckboxId);

            if (!checkbox) {
                logger.debug(`Checkbox not found: ${checkboxId}`);
                return;
            }

            // Initialize from original if available
            if (originalCheckbox) {
                checkbox.checked = originalCheckbox.checked;
            }

            // Sync to original
            checkbox.addEventListener('change', () => {
                if (originalCheckbox) {
                    originalCheckbox.checked = checkbox.checked;
                    originalCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            // Listen for changes from original
            if (originalCheckbox) {
                originalCheckbox.addEventListener('change', () => {
                    if (checkbox.checked !== originalCheckbox.checked) {
                        checkbox.checked = originalCheckbox.checked;
                    }
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up checkbox sync ${checkboxId}:`, error);
        }
    },

    setupNumberInputSync: function(inputId, originalInputId) {
        try {
            const input = document.getElementById(inputId);
            const originalInput = document.getElementById(originalInputId);

            if (!input) {
                logger.debug(`Number input not found: ${inputId}`);
                return;
            }

            // Initialize from original if available
            if (originalInput) {
                input.value = originalInput.value || '';
            }

            // Sync to original
            input.addEventListener('input', () => {
                if (originalInput) {
                    originalInput.value = input.value;
                    originalInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            // Listen for changes from original
            if (originalInput) {
                originalInput.addEventListener('input', () => {
                    if (input.value !== originalInput.value) {
                        input.value = originalInput.value;
                    }
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up number input sync ${inputId}:`, error);
        }
    },

    setupSelectSync: function(selectId, originalSelectId) {
        try {
            const select = document.getElementById(selectId);
            const originalSelect = document.getElementById(originalSelectId);

            if (!select) {
                logger.debug(`Select not found: ${selectId}`);
                return;
            }

            // Initialize from original if available
            if (originalSelect) {
                select.value = originalSelect.value || select.value;
            }

            // Sync to original
            select.addEventListener('change', () => {
                if (originalSelect) {
                    originalSelect.value = select.value;
                    originalSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            // Listen for changes from original
            if (originalSelect) {
                originalSelect.addEventListener('change', () => {
                    if (select.value !== originalSelect.value) {
                        select.value = originalSelect.value;
                    }
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up select sync ${selectId}:`, error);
        }
    },

    setupTextareaSync: function(textareaId, originalTextareaId) {
        try {
            const textarea = document.getElementById(textareaId);
            const originalTextarea = document.getElementById(originalTextareaId);

            if (!textarea) {
                logger.debug(`Textarea not found: ${textareaId}`);
                return;
            }

            // Initialize from original if available
            if (originalTextarea) {
                textarea.value = originalTextarea.value || '';
            }

            // Sync to original
            textarea.addEventListener('input', () => {
                if (originalTextarea) {
                    originalTextarea.value = textarea.value;
                    originalTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            // Listen for changes from original
            if (originalTextarea) {
                originalTextarea.addEventListener('input', () => {
                    if (textarea.value !== originalTextarea.value) {
                        textarea.value = originalTextarea.value;
                    }
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up textarea sync ${textareaId}:`, error);
        }
    },

    setupStartReplyWithSync: function() {
        try {
            const nemoTextarea = document.getElementById('nemo-start-reply-with');
            const nemoCheckbox = document.getElementById('nemo-chat-show-reply-prefix-checkbox');
            const originalTextarea = document.getElementById('start_reply_with');
            const originalCheckbox = document.getElementById('chat-show-reply-prefix-checkbox');

            if (!nemoTextarea || !nemoCheckbox) {
                logger.debug('Nemo Start Reply With elements not found');
                return;
            }

            // Initialize with current values from original elements
            this.syncStartReplyWithValues();

            // Add event listeners for bidirectional sync
            if (nemoTextarea) {
                nemoTextarea.addEventListener('input', () => {
                    if (originalTextarea) {
                        originalTextarea.value = nemoTextarea.value;
                        // Trigger input event on original to ensure proper saving
                        originalTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            }

            if (nemoCheckbox) {
                nemoCheckbox.addEventListener('change', () => {
                    if (originalCheckbox) {
                        originalCheckbox.checked = nemoCheckbox.checked;
                        // Trigger change event on original to ensure proper saving
                        originalCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }

            // Listen for changes from the original elements
            if (originalTextarea) {
                originalTextarea.addEventListener('input', () => {
                    if (nemoTextarea && nemoTextarea.value !== originalTextarea.value) {
                        nemoTextarea.value = originalTextarea.value;
                    }
                });
            }

            if (originalCheckbox) {
                originalCheckbox.addEventListener('change', () => {
                    if (nemoCheckbox && nemoCheckbox.checked !== originalCheckbox.checked) {
                        nemoCheckbox.checked = originalCheckbox.checked;
                    }
                });
            }

            console.log(`${LOG_PREFIX} Start Reply With sync setup complete`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up Start Reply With sync:`, error);
        }
    },

    syncStartReplyWithValues: function() {
        try {
            const nemoTextarea = document.getElementById('nemo-start-reply-with');
            const nemoCheckbox = document.getElementById('nemo-chat-show-reply-prefix-checkbox');
            const originalTextarea = document.getElementById('start_reply_with');
            const originalCheckbox = document.getElementById('chat-show-reply-prefix-checkbox');

            // Sync textarea values
            if (nemoTextarea && originalTextarea) {
                nemoTextarea.value = originalTextarea.value || '';
                console.log(`${LOG_PREFIX} Synced start reply text: "${originalTextarea.value}"`);
            }

            // Sync checkbox values
            if (nemoCheckbox && originalCheckbox) {
                nemoCheckbox.checked = originalCheckbox.checked;
                console.log(`${LOG_PREFIX} Synced show reply prefix: ${originalCheckbox.checked}`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error syncing Start Reply With values:`, error);
        }
    },

    setupLorebookEventListeners: function() {
        try {
            const addLorebookBtn = document.getElementById('nemo-add-lorebook-btn');
            const lorebookSelect = document.getElementById('nemo-lorebook-select');

            if (addLorebookBtn) {
                addLorebookBtn.addEventListener('click', () => {
                    this.addSelectedLorebook();
                });
            }

            // Handle remove lorebook clicks (delegated)
            const activeLorebooksContainer = document.getElementById('nemo-active-lorebooks');
            if (activeLorebooksContainer) {
                activeLorebooksContainer.addEventListener('click', (e) => {
                    const removeBtn = e.target.closest('.nemo-remove-lorebook');
                    if (removeBtn) {
                        const bookName = removeBtn.dataset.bookName;
                        this.removeLorebook(bookName);
                    }
                });
            }

            // Initial population of the UI
            this.populateAvailableLorebooksDropdown();
            this.refreshActiveLorebooksDisplay();

            // Listen for changes on the original world_info select to keep our UI in sync
            const worldInfoSelect = document.getElementById('world_info');
            if (worldInfoSelect) {
                $(worldInfoSelect).on('change', () => {
                    this.refreshActiveLorebooksDisplay();
                    this.populateAvailableLorebooksDropdown();
                });
            }

            console.log(`${LOG_PREFIX} Lorebook event listeners setup complete`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting up lorebook event listeners:`, error);
        }
    },

    addSelectedLorebook: function() {
        const lorebookSelect = document.getElementById('nemo-lorebook-select');
        const worldInfoSelect = document.getElementById('world_info');
        if (!lorebookSelect || !lorebookSelect.value || !worldInfoSelect) return;

        const bookName = lorebookSelect.value;
        const optionToSelect = Array.from(worldInfoSelect.options).find(opt => opt.text === bookName);

        if (optionToSelect) {
            optionToSelect.selected = true;
            // SillyTavern uses jQuery for this select list, so we trigger the change event with it.
            $(worldInfoSelect).trigger('change');
            this.refreshActiveLorebooksDisplay();
            this.populateAvailableLorebooksDropdown();
        }
    },

    removeLorebook: function(bookName) {
        const worldInfoSelect = document.getElementById('world_info');
        if (!worldInfoSelect) return;

        const optionToDeselect = Array.from(worldInfoSelect.options).find(opt => opt.text === bookName);

        if (optionToDeselect) {
            optionToDeselect.selected = false;
            $(worldInfoSelect).trigger('change');
            this.refreshActiveLorebooksDisplay();
            this.populateAvailableLorebooksDropdown();
        }
    },

    checkExistingSnapshot: function() {
        try {
            const currentApi = getContext().openai_api || 'openai';
            const snapshotData = storage.getSnapshot(currentApi);
            const applySnapshotBtn = document.getElementById('nemoApplySnapshotBtn');
            if (applySnapshotBtn) {
                applySnapshotBtn.disabled = !snapshotData || !Array.isArray(snapshotData) || snapshotData.length === 0;
                if (snapshotData && Array.isArray(snapshotData)) {
                    console.log(`${LOG_PREFIX} Existing snapshot found with ${snapshotData.length} prompts`);
                }
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error checking existing snapshot:`, error);
        }
    },

    handleContainerClick: function(event) {
        const { target } = event;
        const toggleButton = target.closest(SELECTORS.toggleButton);
        const masterToggle = target.closest('.nemo-section-master-toggle');
        const summary = target.closest('summary');

        if (toggleButton) {
            setTimeout(() => {
                const section = toggleButton.closest('details.nemo-engine-section');
                if (section) this.updateSectionCount(section);
            }, 100);
        } else if (masterToggle) {
            event.preventDefault();
            event.stopPropagation();
            const section = masterToggle.closest('details.nemo-engine-section');
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
        } else if (summary && !target.closest('a, button')) {
            const details = summary.closest('details');
            const li = details.querySelector('summary > li');
            const dividerInfo = this.getDividerInfo(li);
            // Save state synchronously to prevent race conditions with re-renders
            // The details.open will be the NEW state after the click
            // We use requestAnimationFrame to ensure the DOM has updated
            requestAnimationFrame(() => {
                openSectionStates[dividerInfo.originalText] = details.open;
            });
        }
    },

    initializeDragAndDrop: function(container) {
        // Initialize sortableInstances Set if not exists
        if (!this.sortableInstances) {
            this.sortableInstances = new Set();
        }

        // Destroy existing Sortable instance to prevent conflicts
        if (container.sortable) {
            try {
                container.sortable.destroy();
                this.sortableInstances.delete(container.sortable);
            } catch (error) {
                console.warn(`${LOG_PREFIX} Error destroying previous Sortable:`, error);
            }
        }

        // First, initialize Sortable for each section content area separately
        container.querySelectorAll('.nemo-section-content').forEach(sectionContent => {
            if (sectionContent.sortable) {
                try {
                    sectionContent.sortable.destroy();
                    this.sortableInstances.delete(sectionContent.sortable);
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Error destroying section Sortable:`, error);
                }
            }

            const sectionSortable = new window.Sortable(sectionContent, {
                group: 'nemo-prompts',
                animation: 150,
                delay: getSortableDelay(),
                draggable: '.completion_prompt_manager_prompt:not(.nemo-header-item)',
                handle: '.drag-handle',
                filter: '.nemo-header-item',
                onMove: (evt) => {
                    // Block any attempt to move into summary
                    if (evt.to.matches('summary') || evt.to.closest('summary') ||
                        evt.related.matches('summary') || evt.related.closest('summary') ||
                        evt.related.classList.contains('nemo-header-item')) {
                        return false;
                    }
                    return true;
                },
                onEnd: (evt) => {
                    const section = sectionContent.closest('details.nemo-engine-section');
                    if (section) {
                        this.updateSectionCount(section);
                    }
                }
            });

            sectionContent.sortable = sectionSortable;
            this.sortableInstances.add(sectionSortable);
        });

        // A single, powerful Sortable instance to manage everything at the top level
        const sortableInstance = new window.Sortable(container, {
            group: 'nemo-prompts',
            animation: 150,
            delay: getSortableDelay(), // Mobile-aware delay (50ms desktop, 750ms mobile)
            draggable: '.completion_prompt_manager_prompt:not(.nemo-header-item), .nemo-engine-section',
            handle: '.drag-handle, summary',
            filter: '.nemo-header-item',

            // Prevent dragging over summary elements (headers)
            onMove: (evt) => {
                const draggedElement = evt.dragged;
                const relatedElement = evt.related;
                const toElement = evt.to;

                // Prevent dropping into summary or header elements entirely
                if (toElement.matches('summary') ||
                    toElement.closest('summary') ||
                    relatedElement.matches('summary') ||
                    relatedElement.classList.contains('nemo-header-item') ||
                    relatedElement.closest('summary')) {
                    return false; // Prevent the move
                }

                // If dragging a prompt, ensure it can only be dropped in valid containers
                if (draggedElement.classList.contains('completion_prompt_manager_prompt')) {
                    // Reject if trying to drop into a summary
                    if (toElement.matches('summary') || toElement.closest('summary')) {
                        return false;
                    }

                    // Allow drop only in the main container or inside section content areas
                    const isValidTarget = relatedElement.matches('.completion_prompt_manager_prompt') ||
                                         relatedElement.matches('.nemo-section-content') ||
                                         relatedElement.closest('.nemo-section-content') ||
                                         (toElement === container && !toElement.closest('summary')) ||
                                         (toElement.classList.contains('nemo-section-content'));

                    return isValidTarget;
                }

                // For sections being dragged, ensure they're not dropped into summaries
                if (draggedElement.classList.contains('nemo-engine-section')) {
                    if (toElement.matches('summary') || toElement.closest('summary')) {
                        return false;
                    }
                }

                return true; // Allow the move for other elements
            },

            onEnd: (evt) => {
                const fromSection = evt.from.closest('details.nemo-engine-section');
                const toSection = evt.to.closest('details.nemo-engine-section');

                // Comprehensive check: If item was dropped into or near a summary, fix it
                const itemParent = evt.item.parentElement;

                // Check if the item ended up in a summary element
                if (itemParent && (itemParent.matches('summary') || itemParent.closest('summary'))) {
                    logger.warn('Item was dropped into summary, relocating to top...');
                    const section = itemParent.closest('details.nemo-engine-section');
                    if (section) {
                        const sectionContent = section.querySelector('.nemo-section-content');
                        if (sectionContent) {
                            // Insert at the beginning (top) of section content
                            if (sectionContent.firstChild) {
                                sectionContent.insertBefore(evt.item, sectionContent.firstChild);
                            } else {
                                sectionContent.appendChild(evt.item);
                            }
                        }
                    } else {
                        // If no section found, move to main container at the top
                        if (container.firstChild) {
                            container.insertBefore(evt.item, container.firstChild);
                        } else {
                            container.appendChild(evt.item);
                        }
                    }
                }

                // Also check if item is a sibling of a header item (side-by-side in summary)
                const nextSibling = evt.item.nextElementSibling;
                const prevSibling = evt.item.previousElementSibling;
                if ((nextSibling && nextSibling.classList.contains('nemo-header-item')) ||
                    (prevSibling && prevSibling.classList.contains('nemo-header-item'))) {
                    logger.warn('Item placed next to header, relocating to top...');
                    const section = evt.item.closest('details.nemo-engine-section');
                    if (section) {
                        const sectionContent = section.querySelector('.nemo-section-content');
                        if (sectionContent) {
                            // Insert at the beginning (top) of section content
                            if (sectionContent.firstChild) {
                                sectionContent.insertBefore(evt.item, sectionContent.firstChild);
                            } else {
                                sectionContent.appendChild(evt.item);
                            }
                        }
                    }
                }

                if (evt.item.matches('.completion_prompt_manager_prompt')) {
                    if (fromSection) this.updateSectionCount(fromSection);
                    setTimeout(() => {
                        if (toSection && fromSection !== toSection) {
                            this.updateSectionCount(toSection);
                        }
                    }, 50);
                }
            }
        });

        // Track the instance
        container.sortable = sortableInstance;
        this.sortableInstances.add(sortableInstance);
        console.log(`${LOG_PREFIX} Sortable instance created and tracked`);

        // Add a MutationObserver to catch any prompts that slip into summaries
        const summaryProtector = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE &&
                            node.classList.contains('completion_prompt_manager_prompt') &&
                            !node.classList.contains('nemo-header-item')) {

                            const parentSummary = node.closest('summary');
                            if (parentSummary) {
                                logger.warn('Detected prompt in summary, auto-relocating to top of section:', node);
                                const section = parentSummary.closest('details.nemo-engine-section');
                                if (section) {
                                    const sectionContent = section.querySelector('.nemo-section-content');
                                    if (sectionContent) {
                                        // Insert at the beginning (top) of section content
                                        if (sectionContent.firstChild) {
                                            sectionContent.insertBefore(node, sectionContent.firstChild);
                                        } else {
                                            sectionContent.appendChild(node);
                                        }
                                        this.updateSectionCount(section);
                                    }
                                }
                            }
                        }
                    });
                }
            });
        });

        // Observe all summary elements
        container.querySelectorAll('summary').forEach(summary => {
            summaryProtector.observe(summary, { childList: true, subtree: false });
        });

        // Store observer for cleanup
        if (!this.summaryProtectors) {
            this.summaryProtectors = [];
        }
        this.summaryProtectors.push(summaryProtector);
    },

    initializeObserver: function(container) {
        // Store observer references for cleanup
        if (!this.observers) {
            this.observers = {};
        }

        // Disconnect existing observer if present
        if (this.observers.listObserver) {
            this.observers.listObserver.disconnect();
            console.log(`${LOG_PREFIX} Disconnected previous list observer`);
        }

        const listObserver = new MutationObserver((mutations) => {
            if (container.dataset.nemoOrganizing === 'true') return;
            listObserver.disconnect();

            let needsReorg = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.matches('li.completion_prompt_manager_prompt') && !node.closest('details.nemo-engine-section')) {
                            needsReorg = true;
                        }
                    });
                    mutation.removedNodes.forEach(node => {
                         if (node.nodeType === Node.ELEMENT_NODE && node.matches('li.completion_prompt_manager_prompt')) {
                            const oldParentDetails = mutation.target.closest('details.nemo-engine-section');
                            if (oldParentDetails) {
                                this.updateSectionCount(oldParentDetails);
                            }
                        }
                    });
                }
            }

            if (needsReorg) {
                this.organizePrompts(true);
            }

            listObserver.observe(container, { childList: true, subtree: true });
        });

        this.observers.listObserver = listObserver;
        listObserver.observe(container, { childList: true, subtree: true });
        console.log(`${LOG_PREFIX} List observer initialized`);
    },

    // Context Menu for Prompt Movement
    createContextMenu: function() {
        // Remove existing context menu if it exists
        const existing = document.getElementById('nemo-prompt-context-menu');
        if (existing) existing.remove();

        const contextMenu = document.createElement('div');
        contextMenu.id = 'nemo-prompt-context-menu';
        contextMenu.className = 'nemo-context-menu';
        contextMenu.innerHTML = `
            <div class="nemo-context-menu-item" data-action="move-to-header">
                <i class="fa-solid fa-arrows-up-down"></i>
                Move to...
            </div>
            <div class="nemo-context-menu-separator"></div>
            <div class="nemo-context-menu-item" data-action="save-prompt">
                <i class="fa-solid fa-floppy-disk"></i>
                Save Prompt
            </div>
            <div class="nemo-context-menu-item" data-action="load-prompt">
                <i class="fa-solid fa-folder-open"></i>
                Load Prompt...
            </div>
            <div class="nemo-context-menu-separator"></div>
            <div class="nemo-context-menu-item" data-action="cancel">
                <i class="fa-solid fa-xmark"></i>
                Cancel
            </div>
        `;
        contextMenu.style.display = 'none';
        document.body.appendChild(contextMenu);

        // Add click handlers
        contextMenu.addEventListener('click', (e) => {
            console.log(`${LOG_PREFIX} Context menu clicked:`, e.target);
            const action = e.target.closest('[data-action]')?.dataset.action;
            console.log(`${LOG_PREFIX} Context menu action:`, action);
            
            if (action === 'move-to-header') {
                console.log(`${LOG_PREFIX} Move to header action triggered`);
                this.showHeaderSelectionDialog();
            } else if (action === 'save-prompt') {
                console.log(`${LOG_PREFIX} Save prompt action triggered`);
                this.showSavePromptDialog();
            } else if (action === 'load-prompt') {
                console.log(`${LOG_PREFIX} Load prompt action triggered`);
                this.showLoadPromptDialog();
            }
            this.hideContextMenu();
        });

        // Hide context menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    },

    handleContextMenu: function(e) {
        console.log(`${LOG_PREFIX} Context menu triggered on:`, e.target);
        
        // Only handle right-click on prompt items (not headers/dividers)
        const promptItem = e.target.closest('li.completion_prompt_manager_prompt');
        console.log(`${LOG_PREFIX} Found prompt item:`, promptItem);
        
        if (!promptItem) {
            console.log(`${LOG_PREFIX} No prompt item found - ignoring right-click`);
            return;
        }
        
        const dividerInfo = this.getDividerInfo(promptItem, true);
        console.log(`${LOG_PREFIX} Divider info:`, dividerInfo);
        
        if (dividerInfo.isDivider) {
            console.log(`${LOG_PREFIX} Item is a divider - ignoring right-click`);
            return;
        }

        e.preventDefault();
        this.selectedPromptItem = promptItem;
        console.log(`${LOG_PREFIX} Selected prompt item for move:`, this.selectedPromptItem);
        this.showContextMenu(e.pageX, e.pageY);
    },

    showContextMenu: function(x, y) {
        const contextMenu = document.getElementById('nemo-prompt-context-menu');
        if (!contextMenu) return;

        contextMenu.style.display = 'block';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';

        // Adjust position if menu goes off screen
        const rect = contextMenu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (rect.right > windowWidth) {
            contextMenu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > windowHeight) {
            contextMenu.style.top = (y - rect.height) + 'px';
        }
    },

    hideContextMenu: function() {
        const contextMenu = document.getElementById('nemo-prompt-context-menu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        // Don't clear selectedPromptItem here - we need it for the dialog
        // It will be cleared after the move operation completes
    },

    showHeaderSelectionDialog: function() {
        if (!this.selectedPromptItem) return;

        // Get all headers/sections - they might be in sections or flat list
        const container = document.querySelector(SELECTORS.promptsContainer);
        const headers = [];
        
        // Look for headers in sections (details.nemo-engine-section summary)
        const sections = container.querySelectorAll('details.nemo-engine-section');
        sections.forEach(section => {
            const headerItem = section.querySelector('summary li.completion_prompt_manager_prompt.nemo-header-item');
            if (headerItem) {
                headers.push({
                    element: headerItem,
                    section: section,
                    isInSection: true
                });
            }
        });
        
        // Also look for any flat headers that haven't been processed yet
        const flatHeaders = Array.from(container.querySelectorAll('li.completion_prompt_manager_prompt')).filter(item => 
            this.getDividerInfo(item, true).isDivider && !item.closest('details.nemo-engine-section')
        );
        flatHeaders.forEach(header => {
            headers.push({
                element: header,
                section: null,
                isInSection: false
            });
        });

        if (headers.length === 0) {
            this.showStatusMessage('No headers found to move prompt under.', 'warning');
            return;
        }

        // Create header selection dialog
        const dialog = document.createElement('div');
        dialog.id = 'nemo-header-selection-dialog';
        dialog.className = 'nemo-dialog-overlay';
        
        const headersList = headers.map((headerData, index) => {
            let headerName = 'Unidentified Header';
            
            // Try multiple ways to get the header name
            const dividerInfo = this.getDividerInfo(headerData.element, true);
            if (dividerInfo && dividerInfo.name) {
                headerName = dividerInfo.name;
            } else {
                // Fallback: try to get name from prompt name span
                const nameSpan = headerData.element.querySelector('.completion_prompt_manager_prompt_name');
                if (nameSpan) {
                    const link = nameSpan.querySelector('a');
                    headerName = link ? link.textContent.trim() : nameSpan.textContent.trim();
                    
                    // Clean up the header name (remove divider prefix if present)
                    if (DIVIDER_PREFIX_REGEX) {
                        headerName = headerName.replace(DIVIDER_PREFIX_REGEX, '').trim();
                    }
                }
            }
            
            const promptName = this.selectedPromptItem.querySelector('.completion_prompt_manager_prompt_name')?.textContent || 'Unknown Prompt';
            console.log(`${LOG_PREFIX} Header ${index}: name="${headerName}", isInSection=${headerData.isInSection}`);
            
            return `
                <div class="nemo-header-option" data-header-index="${index}">
                    <div class="nemo-header-name">${headerName}</div>
                    <div class="nemo-header-preview">Move "${promptName}" below this header</div>
                </div>
            `;
        }).join('');

        dialog.innerHTML = `
            <div class="nemo-dialog">
                <div class="nemo-dialog-header">
                    <h3>Move Prompt</h3>
                    <button class="nemo-dialog-close" aria-label="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="nemo-dialog-content">
                    <p>Select a header to move the prompt below:</p>
                    <div class="nemo-headers-list">
                        ${headersList}
                    </div>
                </div>
                <div class="nemo-dialog-actions">
                    <button class="nemo-btn-secondary" data-action="cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Add event listeners (using arrow function to preserve 'this' context)
        const dialogClickHandler = (e) => {
            console.log(`${LOG_PREFIX} Dialog clicked:`, e.target);
            
            const headerOption = e.target.closest('.nemo-header-option');
            const action = e.target.closest('[data-action]')?.dataset.action;
            const closeBtn = e.target.closest('.nemo-dialog-close');

            console.log(`${LOG_PREFIX} Click analysis:`, {
                headerOption,
                action,
                closeBtn,
                targetElement: e.target
            });

            if (headerOption) {
                const headerIndex = parseInt(headerOption.dataset.headerIndex);
                console.log(`${LOG_PREFIX} Header option clicked, index:`, headerIndex);
                console.log(`${LOG_PREFIX} Headers array:`, headers);
                console.log(`${LOG_PREFIX} Selected header data:`, headers[headerIndex]);
                console.log(`${LOG_PREFIX} About to call movePromptBelowHeader with:`, headers[headerIndex]);
                console.log(`${LOG_PREFIX} 'this' context:`, this);
                
                this.movePromptBelowHeader(headers[headerIndex]);
                dialog.remove();
            } else if (action === 'cancel' || closeBtn || e.target === dialog) {
                console.log(`${LOG_PREFIX} Dialog cancelled or closed`);
                this.selectedPromptItem = null; // Clear selection when cancelled
                dialog.remove();
            } else {
                console.log(`${LOG_PREFIX} Click ignored - no matching handler`);
            }
        };
        
        dialog.addEventListener('click', dialogClickHandler);

        // Focus management
        dialog.querySelector('.nemo-dialog-close').focus();
    },

    movePromptBelowHeader: function(headerData) {
        console.log(`${LOG_PREFIX} movePromptBelowHeader called with:`, headerData);
        console.log(`${LOG_PREFIX} this.selectedPromptItem:`, this.selectedPromptItem);
        
        if (!this.selectedPromptItem) {
            console.error(`${LOG_PREFIX} No selected prompt item`);
            return;
        }
        
        if (!headerData) {
            console.error(`${LOG_PREFIX} No header data provided`);
            return;
        }

        const targetHeader = headerData.element;
        const targetSection = headerData.section;
        
        console.log(`${LOG_PREFIX} Target header:`, targetHeader);
        console.log(`${LOG_PREFIX} Target section:`, targetSection);

        if (!targetHeader) {
            console.error(`${LOG_PREFIX} Header element not found`);
            this.showStatusMessage('Header not found.', 'error');
            return;
        }
        
        try {
            // Get the current section the prompt is in (if any)
            const fromSection = this.selectedPromptItem.closest('details.nemo-engine-section');

        console.log(`${LOG_PREFIX} Moving prompt to header. Target section:`, targetSection);
        console.log(`${LOG_PREFIX} Selected prompt item:`, this.selectedPromptItem);
        
        // Log current position before moving
        const originalParent = this.selectedPromptItem.parentNode;
        const originalNextSibling = this.selectedPromptItem.nextSibling;
        console.log(`${LOG_PREFIX} Original position - Parent:`, originalParent, 'Next sibling:', originalNextSibling);
        
        if (targetSection) {
            // Insert as first item in the target section
            const firstPrompt = targetSection.querySelector('li.completion_prompt_manager_prompt:not(.nemo-header-item)');
            
            console.log(`${LOG_PREFIX} First prompt in target section:`, firstPrompt);
            
            if (firstPrompt) {
                // Insert before the first existing prompt
                firstPrompt.parentNode.insertBefore(this.selectedPromptItem, firstPrompt);
                console.log(`${LOG_PREFIX} Inserted before first prompt`);
            } else {
                // No prompts in section yet, append directly to section
                targetSection.appendChild(this.selectedPromptItem);
                console.log(`${LOG_PREFIX} Appended to empty section`);
            }
        } else {
            // Insert directly after header in flat list
            const container = document.querySelector(SELECTORS.promptsContainer);
            
            // Find the next sibling after the header
            let insertPosition = targetHeader.nextSibling;
            while (insertPosition && insertPosition.nodeType !== Node.ELEMENT_NODE) {
                insertPosition = insertPosition.nextSibling;
            }
            
            if (insertPosition) {
                container.insertBefore(this.selectedPromptItem, insertPosition);
                console.log(`${LOG_PREFIX} Inserted after header in flat list`);
            } else {
                container.appendChild(this.selectedPromptItem);
                console.log(`${LOG_PREFIX} Appended to end of container`);
            }
        }

        // Log position after moving
        const newParent = this.selectedPromptItem.parentNode;
        const newNextSibling = this.selectedPromptItem.nextSibling;
        console.log(`${LOG_PREFIX} New position - Parent:`, newParent, 'Next sibling:', newNextSibling);
        
        // Verify the move actually happened
        if (newParent !== originalParent || newNextSibling !== originalNextSibling) {
            console.log(`${LOG_PREFIX} DOM move successful!`);
        } else {
            console.warn(`${LOG_PREFIX} DOM move failed - element is still in same position`);
        }

        // Update section counts
        if (fromSection) this.updateSectionCount(fromSection);
        if (targetSection && targetSection !== fromSection) this.updateSectionCount(targetSection);

        // Show success message
        const promptName = this.selectedPromptItem.querySelector('.completion_prompt_manager_prompt_name')?.textContent || 'Prompt';
        
        // Get header name using the same logic as dialog
        let headerName = 'Header';
        const dividerInfo = this.getDividerInfo(targetHeader, true);
        if (dividerInfo && dividerInfo.name) {
            headerName = dividerInfo.name;
        } else {
            const nameSpan = targetHeader.querySelector('.completion_prompt_manager_prompt_name');
            if (nameSpan) {
                const link = nameSpan.querySelector('a');
                headerName = link ? link.textContent.trim() : nameSpan.textContent.trim();
                if (DIVIDER_PREFIX_REGEX) {
                    headerName = headerName.replace(DIVIDER_PREFIX_REGEX, '').trim();
                }
            }
        }
        
        console.log(`${LOG_PREFIX} Move completed: "${promptName}" -> "${headerName}"`);
        this.showStatusMessage(`Moved "${promptName}" below "${headerName}"`, 'success', 3000);

        // Trigger reorganization and save
        console.log(`${LOG_PREFIX} Triggering reorganization after move...`);
        
        // Force reorganization to ensure proper structure
        setTimeout(() => {
            this.organizePrompts(true);
            
            // Then trigger save
            const updateButton = document.getElementById('completion_prompt_manager_update_button');
            if (updateButton) {
                updateButton.click();
                console.log(`${LOG_PREFIX} Save triggered after reorganization`);
            } else {
                console.warn(`${LOG_PREFIX} Update button not found`);
            }
        }, 150);

        this.selectedPromptItem = null;
        
        } catch (error) {
            console.error(`${LOG_PREFIX} Error in movePromptBelowHeader:`, error);
            this.showStatusMessage('Error moving prompt: ' + error.message, 'error');
            this.selectedPromptItem = null;
        }
    },

    // === PROMPT LIBRARY SYSTEM ===

    getPromptLibraryKey: function() {
        return 'nemo-prompt-library';
    },

    getPromptLibrary: function() {
        try {
            const stored = localStorage.getItem(this.getPromptLibraryKey());
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error(`${LOG_PREFIX} Error loading prompt library:`, error);
            return [];
        }
    },

    saveToPromptLibrary: function(promptData) {
        try {
            const library = this.getPromptLibrary();
            library.push({
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                title: promptData.title,
                content: promptData.content,
                role: promptData.role || '',
                identifier: promptData.identifier || '',
                dateCreated: new Date().toISOString(),
                dateModified: new Date().toISOString(),
                tags: promptData.tags || [],
                folder: promptData.folder || 'Default',
                isFavorite: false
            });
            localStorage.setItem(this.getPromptLibraryKey(), JSON.stringify(library));
            return true;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error saving to prompt library:`, error);
            return false;
        }
    },

    deleteFromPromptLibrary: function(promptId) {
        try {
            const library = this.getPromptLibrary();
            const filtered = library.filter(p => p.id !== promptId);
            localStorage.setItem(this.getPromptLibraryKey(), JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error deleting from prompt library:`, error);
            return false;
        }
    },

    extractPromptData: function(promptElement) {
        const nameElement = promptElement.querySelector('.completion_prompt_manager_prompt_name a');
        const title = nameElement ? nameElement.textContent.trim() : 'Untitled Prompt';
        const identifier = promptElement.dataset.pmIdentifier || '';
        
        // Get the actual prompt content from SillyTavern's prompt manager
        let content = '';
        let role = '';
        
        try {
            // Try multiple ways to access prompt content from SillyTavern
            if (identifier) {
                // Method 1: Try the imported promptManager
                if (promptManager && promptManager.serviceSettings && promptManager.serviceSettings.prompts) {
                    const promptData = promptManager.serviceSettings.prompts.find(p => p.identifier === identifier);
                    if (promptData) {
                        content = promptData.content || '';
                        role = promptData.role || '';
                        console.log(`${LOG_PREFIX} Found prompt content (method 1):`, {
                            identifier: identifier,
                            title: title,
                            contentLength: content.length,
                            role: role
                        });
                    }
                }
                
                // Method 2: Try accessing from window/global scope
                if (!content && window.promptManager) {
                    const promptData = window.promptManager.serviceSettings?.prompts?.find(p => p.identifier === identifier);
                    if (promptData) {
                        content = promptData.content || '';
                        role = promptData.role || '';
                        console.log(`${LOG_PREFIX} Found prompt content (method 2):`, {
                            identifier: identifier,
                            title: title,
                            contentLength: content.length,
                            role: role
                        });
                    }
                }
                
                // Method 3: Try direct access to prompts array
                if (!content && promptManager && promptManager.prompts) {
                    const promptData = promptManager.prompts.find(p => p.identifier === identifier);
                    if (promptData) {
                        content = promptData.content || '';
                        role = promptData.role || '';
                        console.log(`${LOG_PREFIX} Found prompt content (method 3):`, {
                            identifier: identifier,
                            title: title,
                            contentLength: content.length,
                            role: role
                        });
                    }
                }
                
                // Method 4: Debug what's available in promptManager
                if (!content) {
                    console.log(`${LOG_PREFIX} Debugging promptManager structure:`, {
                        promptManager: !!promptManager,
                        serviceSettings: !!promptManager?.serviceSettings,
                        prompts: !!promptManager?.prompts,
                        windowPromptManager: !!window.promptManager,
                        identifier: identifier,
                        availableKeys: promptManager ? Object.keys(promptManager) : 'N/A'
                    });
                }
            } else {
                console.warn(`${LOG_PREFIX} No identifier found in prompt element`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error extracting prompt content:`, error);
        }
        
        return {
            title: title,
            content: content,
            role: role,
            identifier: identifier,
            tags: []
        };
    },

    showSavePromptDialog: function() {
        if (!this.selectedPromptItem) return;

        const promptData = this.extractPromptData(this.selectedPromptItem);
        
        const dialog = document.createElement('div');
        dialog.id = 'nemo-save-prompt-dialog';
        dialog.className = 'nemo-dialog-overlay';
        
        dialog.innerHTML = `
            <div class="nemo-dialog">
                <div class="nemo-dialog-header">
                    <h3>Save Prompt to Library</h3>
                    <button class="nemo-dialog-close" aria-label="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="nemo-dialog-content">
                    <div class="nemo-form-group">
                        <label for="nemo-save-prompt-title">Prompt Title:</label>
                        <input type="text" id="nemo-save-prompt-title" value="${promptData.title}" 
                               placeholder="Enter a title for this prompt">
                    </div>
                    <div class="nemo-form-group">
                        <label for="nemo-save-prompt-tags">Tags (comma-separated):</label>
                        <input type="text" id="nemo-save-prompt-tags" 
                               placeholder="e.g. character, system, helper">
                    </div>
                    <div class="nemo-form-group">
                        <label>Preview:</label>
                        <div class="nemo-prompt-preview">
                            <strong>Title:</strong> ${promptData.title}<br>
                            <strong>Identifier:</strong> ${promptData.identifier}<br>
                            <small>Content will be saved with current prompt state</small>
                        </div>
                    </div>
                </div>
                <div class="nemo-dialog-actions">
                    <button class="nemo-btn-secondary" data-action="cancel">Cancel</button>
                    <button class="nemo-btn-primary" data-action="save">Save to Library</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const closeBtn = e.target.closest('.nemo-dialog-close');

            if (action === 'save') {
                const title = document.getElementById('nemo-save-prompt-title').value.trim();
                const tagsInput = document.getElementById('nemo-save-prompt-tags').value.trim();
                const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

                if (!title) {
                    alert('Please enter a title for the prompt.');
                    return;
                }

                const saveData = {
                    ...promptData,
                    title: title,
                    tags: tags
                };

                if (this.saveToPromptLibrary(saveData)) {
                    this.showStatusMessage(`Prompt "${title}" saved to library`, 'success', 3000);
                } else {
                    this.showStatusMessage('Failed to save prompt to library', 'error', 3000);
                }
                
                dialog.remove();
            } else if (action === 'cancel' || closeBtn || e.target === dialog) {
                dialog.remove();
            }
        });

        document.getElementById('nemo-save-prompt-title').focus();
    },

    showLoadPromptDialog: function() {
        const library = this.getPromptLibrary();
        
        if (library.length === 0) {
            this.showStatusMessage('No saved prompts found. Right-click on a prompt and select "Save Prompt" to build your library.', 'info', 4000);
            return;
        }

        const dialog = document.createElement('div');
        dialog.id = 'nemo-load-prompt-dialog';
        dialog.className = 'nemo-dialog-overlay';
        
        const promptsList = library.map(prompt => {
            const dateCreated = new Date(prompt.dateCreated).toLocaleDateString();
            const tagsHtml = prompt.tags.length > 0 ? 
                `<div class="nemo-prompt-tags">${prompt.tags.map(tag => `<span class="nemo-tag">${tag}</span>`).join('')}</div>` : '';
            
            return `
                <div class="nemo-saved-prompt-item" data-prompt-id="${prompt.id}">
                    <div class="nemo-saved-prompt-header">
                        <div class="nemo-saved-prompt-title">${prompt.title}</div>
                        <div class="nemo-saved-prompt-date">${dateCreated}</div>
                    </div>
                    ${tagsHtml}
                    <div class="nemo-saved-prompt-preview">
                        <small>ID: ${prompt.identifier || 'N/A'}</small>
                    </div>
                    <div class="nemo-saved-prompt-actions">
                        <button class="nemo-btn-small nemo-btn-primary" data-action="insert" data-prompt-id="${prompt.id}">
                            Insert Below Current
                        </button>
                        <button class="nemo-btn-small nemo-btn-danger" data-action="delete" data-prompt-id="${prompt.id}">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        dialog.innerHTML = `
            <div class="nemo-dialog nemo-dialog-large">
                <div class="nemo-dialog-header">
                    <h3>Load Prompt from Library (${library.length} saved)</h3>
                    <button class="nemo-dialog-close" aria-label="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="nemo-dialog-content">
                    <div class="nemo-saved-prompts-list">
                        ${promptsList}
                    </div>
                </div>
                <div class="nemo-dialog-actions">
                    <button class="nemo-btn-secondary" data-action="cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const promptId = e.target.closest('[data-prompt-id]')?.dataset.promptId;
            const closeBtn = e.target.closest('.nemo-dialog-close');

            if (action === 'insert' && promptId) {
                const prompt = library.find(p => p.id === promptId);
                if (prompt) {
                    this.insertPromptBelow(prompt);
                    this.showStatusMessage(`Inserted prompt "${prompt.title}"`, 'success', 3000);
                }
                dialog.remove();
            } else if (action === 'delete' && promptId) {
                if (confirm('Are you sure you want to delete this saved prompt?')) {
                    const prompt = library.find(p => p.id === promptId);
                    if (this.deleteFromPromptLibrary(promptId)) {
                        this.showStatusMessage(`Deleted prompt "${prompt?.title || 'Unknown'}"`, 'success', 3000);
                        // Refresh the dialog
                        dialog.remove();
                        this.showLoadPromptDialog();
                    }
                }
            } else if (action === 'cancel' || closeBtn || e.target === dialog) {
                dialog.remove();
            }
        });

        dialog.querySelector('.nemo-dialog-close').focus();
    },

    insertPromptBelow: function(promptData) {
        // This is a placeholder for the actual insertion logic
        // In the real implementation, we'd need to:
        // 1. Create a new prompt element with the saved data
        // 2. Insert it after the selected prompt
        // 3. Update the prompt manager's internal state
        
        console.log(`${LOG_PREFIX} Inserting prompt:`, promptData);
        this.showStatusMessage('Prompt insertion feature coming soon - this is a placeholder', 'info', 3000);
        
        // TODO: Implement actual prompt insertion
        // This would require interfacing with SillyTavern's prompt manager system
    },

    // === PROMPT NAVIGATOR ===
    
    showPromptNavigator: async function() {
        try {
            const navigator = new PromptNavigator();
            await navigator.open();
        } catch (error) {
            console.error(`${LOG_PREFIX} Error opening prompt navigator:`, error);
            this.showStatusMessage('Error opening prompt navigator', 'error');
        }
    },

    // === PROMPT ARCHIVE NAVIGATOR ===

    showArchiveNavigator: function() {
        const library = this.getPromptLibrary();
        
        // Organize by folders
        const folders = this.organizePromptsByFolders(library);
        const folderNames = Object.keys(folders).sort();
        
        const dialog = document.createElement('div');
        dialog.id = 'nemo-archive-navigator';
        dialog.className = 'nemo-dialog-overlay nemo-archive-overlay';
        
        const toolbarHtml = `
            <div class="nemo-archive-toolbar">
                <div class="nemo-archive-toolbar-left">
                    <button class="nemo-btn-small nemo-btn-primary" id="nemo-create-folder-btn">
                        <i class="fa-solid fa-folder-plus"></i> New Folder
                    </button>
                    <button class="nemo-btn-small nemo-btn-secondary" id="nemo-import-prompts-btn">
                        <i class="fa-solid fa-file-import"></i> Import
                    </button>
                    <button class="nemo-btn-small nemo-btn-secondary" id="nemo-export-prompts-btn">
                        <i class="fa-solid fa-file-export"></i> Export
                    </button>
                </div>
                <div class="nemo-archive-toolbar-center">
                    <input type="text" id="nemo-archive-search" placeholder="Search prompts..." class="nemo-archive-search">
                </div>
                <div class="nemo-archive-toolbar-right">
                    <select id="nemo-archive-sort" class="nemo-archive-sort">
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="name">Name A-Z</option>
                        <option value="modified">Recently Modified</option>
                    </select>
                    <button class="nemo-btn-small" id="nemo-toggle-favorites" title="Show only favorites">
                        <i class="fa-solid fa-star"></i>
                    </button>
                </div>
            </div>
        `;
        
        const sidebarHtml = this.buildFolderSidebar(folderNames, folders);
        const mainContentHtml = this.buildPromptGrid(library, 'all');
        
        dialog.innerHTML = `
            <div class="nemo-archive-dialog">
                <div class="nemo-archive-header">
                    <h2><i class="fa-solid fa-archive"></i> Prompt Archive Navigator</h2>
                    <div class="nemo-archive-stats">
                        ${library.length} prompts in ${folderNames.length} folders
                    </div>
                    <button class="nemo-dialog-close" aria-label="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                ${toolbarHtml}
                <div class="nemo-archive-body">
                    <div class="nemo-archive-sidebar">
                        ${sidebarHtml}
                    </div>
                    <div class="nemo-archive-main">
                        ${mainContentHtml}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        
        // Add event listeners
        this.setupArchiveNavigatorEvents(dialog, library, folders);
        
        // Focus search input
        dialog.querySelector('#nemo-archive-search').focus();
    },

    organizePromptsByFolders: function(library) {
        const folders = {};
        
        library.forEach(prompt => {
            const folderName = prompt.folder || 'Default';
            if (!folders[folderName]) {
                folders[folderName] = [];
            }
            folders[folderName].push(prompt);
        });
        
        return folders;
    },

    buildFolderSidebar: function(folderNames, folders) {
        const folderItems = folderNames.map(folderName => {
            const prompts = folders[folderName];
            const favoriteCount = prompts.filter(p => p.isFavorite).length;
            const favoriteIcon = favoriteCount > 0 ? `<i class="fa-solid fa-star nemo-folder-star"></i>` : '';
            
            return `
                <div class="nemo-folder-item ${folderName === 'Default' ? 'active' : ''}" data-folder="${folderName}">
                    <div class="nemo-folder-content">
                        <i class="fa-solid fa-folder"></i>
                        <span class="nemo-folder-name">${folderName}</span>
                        ${favoriteIcon}
                        <span class="nemo-folder-count">${prompts.length}</span>
                    </div>
                    <div class="nemo-folder-actions">
                        <button class="nemo-folder-action" data-action="rename" title="Rename folder">
                            <i class="fa-solid fa-pencil"></i>
                        </button>
                        <button class="nemo-folder-action" data-action="delete" title="Delete folder">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="nemo-folder-list">
                <div class="nemo-folder-item active" data-folder="all">
                    <div class="nemo-folder-content">
                        <i class="fa-solid fa-layer-group"></i>
                        <span class="nemo-folder-name">All Prompts</span>
                        <span class="nemo-folder-count">${Object.values(folders).flat().length}</span>
                    </div>
                </div>
                <div class="nemo-folder-item" data-folder="favorites">
                    <div class="nemo-folder-content">
                        <i class="fa-solid fa-star"></i>
                        <span class="nemo-folder-name">Favorites</span>
                        <span class="nemo-folder-count">${Object.values(folders).flat().filter(p => p.isFavorite).length}</span>
                    </div>
                </div>
                <div class="nemo-folder-divider"></div>
                ${folderItems}
            </div>
        `;
    },

    buildPromptGrid: function(prompts, folder, sortBy = 'newest', searchTerm = '', favoritesOnly = false) {
        let filteredPrompts = prompts;
        
        // Filter by folder
        if (folder && folder !== 'all') {
            if (folder === 'favorites') {
                filteredPrompts = prompts.filter(p => p.isFavorite);
            } else {
                filteredPrompts = prompts.filter(p => (p.folder || 'Default') === folder);
            }
        }
        
        // Filter by favorites
        if (favoritesOnly && folder !== 'favorites') {
            filteredPrompts = filteredPrompts.filter(p => p.isFavorite);
        }
        
        // Filter by search
        if (searchTerm) {
            filteredPrompts = filteredPrompts.filter(p => 
                p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.content && p.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
                p.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        
        // Sort prompts
        this.sortPrompts(filteredPrompts, sortBy);
        
        if (filteredPrompts.length === 0) {
            return `
                <div class="nemo-empty-state">
                    <i class="fa-solid fa-inbox"></i>
                    <h3>No prompts found</h3>
                    <p>No prompts match your current filters.</p>
                </div>
            `;
        }
        
        const promptCards = filteredPrompts.map(prompt => this.buildPromptCard(prompt)).join('');
        
        return `
            <div class="nemo-prompt-grid">
                ${promptCards}
            </div>
        `;
    },

    buildPromptCard: function(prompt) {
        // Escape HTML to prevent XSS and malformed HTML
        const escapeHtml = (text) => {
            if (!text) return '';
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const dateCreated = new Date(prompt.dateCreated).toLocaleDateString();
        const dateModified = prompt.dateModified ? new Date(prompt.dateModified).toLocaleDateString() : dateCreated;

        const tagsHtml = prompt.tags.length > 0 ?
            `<div class="nemo-prompt-tags">${prompt.tags.map(tag => `<span class="nemo-tag">${escapeHtml(tag)}</span>`).join('')}</div>` : '';

        const favoriteClass = prompt.isFavorite ? 'active' : '';

        // Escape the content preview to prevent HTML tags from being interpreted
        const contentPreview = prompt.content
            ? escapeHtml(prompt.content.substring(0, 100)) + (prompt.content.length > 100 ? '...' : '')
            : 'No content preview';

        return `
            <div class="nemo-prompt-card" data-prompt-id="${prompt.id}">
                <div class="nemo-prompt-card-header">
                    <div class="nemo-prompt-card-title">${escapeHtml(prompt.title)}</div>
                    <div class="nemo-prompt-card-actions">
                        <button class="nemo-prompt-action nemo-favorite-btn ${favoriteClass}" data-action="favorite" title="Toggle favorite">
                            <i class="fa-solid fa-star"></i>
                        </button>
                        <button class="nemo-prompt-action" data-action="edit" title="Edit prompt">
                            <i class="fa-solid fa-pencil"></i>
                        </button>
                        <button class="nemo-prompt-action" data-action="move" title="Move to folder">
                            <i class="fa-solid fa-folder-open"></i>
                        </button>
                        <button class="nemo-prompt-action" data-action="add-to-preset" title="Add to current preset">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                        <button class="nemo-prompt-action" data-action="delete" title="Delete prompt">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${tagsHtml}
                <div class="nemo-prompt-card-preview">
                    ${contentPreview}
                </div>
                <div class="nemo-prompt-card-meta">
                    <small>Created: ${dateCreated}</small>
                    ${dateModified !== dateCreated ? `<small>Modified: ${dateModified}</small>` : ''}
                    <small>Folder: ${escapeHtml(prompt.folder || 'Default')}</small>
                </div>
            </div>
        `;
    },

    sortPrompts: function(prompts, sortBy) {
        switch (sortBy) {
            case 'newest':
                prompts.sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
                break;
            case 'oldest':
                prompts.sort((a, b) => new Date(a.dateCreated) - new Date(b.dateCreated));
                break;
            case 'name':
                prompts.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'modified':
                prompts.sort((a, b) => new Date(b.dateModified || b.dateCreated) - new Date(a.dateModified || a.dateCreated));
                break;
        }
    },

    setupArchiveNavigatorEvents: function(dialog, library, folders) {
        const currentState = {
            selectedFolder: 'all',
            sortBy: 'newest',
            searchTerm: '',
            favoritesOnly: false
        };

        // Close dialog
        dialog.querySelector('.nemo-dialog-close').addEventListener('click', () => {
            dialog.remove();
        });

        // Click outside to close
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });

        // Folder selection
        dialog.addEventListener('click', (e) => {
            const folderItem = e.target.closest('.nemo-folder-item');
            if (folderItem && !e.target.closest('.nemo-folder-action')) {
                // Update active folder
                dialog.querySelectorAll('.nemo-folder-item').forEach(item => item.classList.remove('active'));
                folderItem.classList.add('active');
                
                currentState.selectedFolder = folderItem.dataset.folder;
                this.refreshArchiveMainContent(dialog, library, currentState);
            }
        });

        // Prompt actions
        dialog.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const promptId = e.target.closest('[data-prompt-id]')?.dataset.promptId;
            
            if (action && promptId) {
                this.handlePromptAction(action, promptId, dialog, library, currentState);
            }
        });

        // Search
        const searchInput = dialog.querySelector('#nemo-archive-search');
        searchInput.addEventListener('input', (e) => {
            currentState.searchTerm = e.target.value;
            this.refreshArchiveMainContent(dialog, library, currentState);
        });

        // Sort change
        dialog.querySelector('#nemo-archive-sort').addEventListener('change', (e) => {
            currentState.sortBy = e.target.value;
            this.refreshArchiveMainContent(dialog, library, currentState);
        });

        // Toggle favorites
        dialog.querySelector('#nemo-toggle-favorites').addEventListener('click', (e) => {
            currentState.favoritesOnly = !currentState.favoritesOnly;
            e.target.classList.toggle('active', currentState.favoritesOnly);
            this.refreshArchiveMainContent(dialog, library, currentState);
        });

        // New Folder button
        dialog.querySelector('#nemo-create-folder-btn').addEventListener('click', () => {
            this.showCreateFolderDialog(() => {
                // Refresh the entire navigator to show the new folder
                const updatedLibrary = this.getPromptLibrary();
                const updatedFolders = this.organizePromptsByFolders(updatedLibrary);
                this.refreshArchiveSidebar(dialog, updatedFolders);
                this.refreshArchiveMainContent(dialog, updatedLibrary, currentState);
            });
        });

        // Import button
        dialog.querySelector('#nemo-import-prompts-btn').addEventListener('click', () => {
            this.showImportPromptsDialog(() => {
                const updatedLibrary = this.getPromptLibrary();
                const updatedFolders = this.organizePromptsByFolders(updatedLibrary);
                this.refreshArchiveSidebar(dialog, updatedFolders);
                this.refreshArchiveMainContent(dialog, updatedLibrary, currentState);
            });
        });

        // Export button
        dialog.querySelector('#nemo-export-prompts-btn').addEventListener('click', () => {
            this.exportPromptLibrary();
        });
    },

    refreshArchiveMainContent: function(dialog, library, currentState) {
        const mainContainer = dialog.querySelector('.nemo-archive-main');
        const updatedLibrary = this.getPromptLibrary(); // Get fresh data
        
        const newContent = this.buildPromptGrid(
            updatedLibrary,
            currentState.selectedFolder,
            currentState.sortBy,
            currentState.searchTerm,
            currentState.favoritesOnly
        );
        
        mainContainer.innerHTML = newContent;
    },

    handlePromptAction: function(action, promptId, dialog, library, currentState) {
        switch (action) {
            case 'favorite':
                this.togglePromptFavorite(promptId);
                this.refreshArchiveMainContent(dialog, library, currentState);
                break;
            case 'edit':
                this.showEditPromptDialog(promptId, () => {
                    this.refreshArchiveMainContent(dialog, library, currentState);
                });
                break;
            case 'move':
                this.showMovePromptDialog(promptId, () => {
                    this.refreshArchiveMainContent(dialog, library, currentState);
                });
                break;
            case 'add-to-preset':
                this.addPromptToCurrentPreset(promptId);
                break;
            case 'delete':
                if (confirm('Are you sure you want to delete this prompt?')) {
                    this.deleteFromPromptLibrary(promptId);
                    this.refreshArchiveMainContent(dialog, library, currentState);
                }
                break;
        }
    },

    togglePromptFavorite: function(promptId) {
        try {
            const library = this.getPromptLibrary();
            const prompt = library.find(p => p.id === promptId);
            if (prompt) {
                prompt.isFavorite = !prompt.isFavorite;
                localStorage.setItem(this.getPromptLibraryKey(), JSON.stringify(library));
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error toggling favorite:`, error);
        }
    },

    addPromptToCurrentPreset: function(promptId) {
        try {
            const library = this.getPromptLibrary();
            const archivedPrompt = library.find(p => p.id === promptId);
            
            if (!archivedPrompt) {
                console.error(`${LOG_PREFIX} Archived prompt not found: ${promptId}`);
                this.showStatusMessage('Error: Archived prompt not found', 'error');
                return;
            }

            // Convert archive prompt to SillyTavern prompt format
            const newPrompt = {
                identifier: archivedPrompt.id || `archived_${Date.now()}`,
                name: archivedPrompt.title,
                system_prompt: false,
                marker: false,
                role: 'user',
                content: archivedPrompt.content || '',
                enabled: true
            };

            console.log(`${LOG_PREFIX} Attempting to add prompt: ${newPrompt.name} (${newPrompt.identifier})`);

            // Method 1: Try using imported promptManager (same as other functions in this file)
            if (promptManager && promptManager.serviceSettings && promptManager.serviceSettings.prompts) {
                console.log(`${LOG_PREFIX} Using imported promptManager.serviceSettings`);
                
                // Check if prompt already exists
                const existingPrompt = promptManager.serviceSettings.prompts.find(p => p.identifier === newPrompt.identifier);
                if (existingPrompt) {
                    this.showStatusMessage(`Prompt "${newPrompt.name}" already exists in current preset`, 'warning');
                    return;
                }

                // Add prompt to the top of the prompts array
                promptManager.serviceSettings.prompts.unshift(newPrompt);

                // Add to prompt order if available
                if (promptManager.serviceSettings.prompt_order) {
                    // Find active character's prompt order or default
                    let promptOrderEntry = null;
                    
                    // Try to find current character's order
                    if (promptManager.activeCharacter && promptManager.activeCharacter.id) {
                        promptOrderEntry = promptManager.serviceSettings.prompt_order.find(entry => 
                            entry.character_id === promptManager.activeCharacter.id
                        );
                    }
                    
                    // If no character-specific order found, use default/global
                    if (!promptOrderEntry) {
                        promptOrderEntry = promptManager.serviceSettings.prompt_order.find(entry => 
                            !entry.character_id || entry.character_id === 'default' || entry.character_id === null
                        );
                    }
                    
                    // If still no order found, create a default one
                    if (!promptOrderEntry) {
                        promptOrderEntry = {
                            character_id: null,
                            order: []
                        };
                        promptManager.serviceSettings.prompt_order.push(promptOrderEntry);
                    }
                    
                    // Add prompt to the top of the order
                    promptOrderEntry.order.unshift({
                        identifier: newPrompt.identifier,
                        enabled: true
                    });
                }

                // Save settings
                if (typeof promptManager.saveServiceSettings === 'function') {
                    promptManager.saveServiceSettings();
                } else if (typeof saveSettingsDebounced === 'function') {
                    saveSettingsDebounced();
                }

            // Method 2: Try using window.promptManager if available
            } else if (window.promptManager && typeof window.promptManager.addPrompt === 'function') {
                console.log(`${LOG_PREFIX} Using window.promptManager.addPrompt`);
                
                // Check if prompt already exists
                if (typeof window.promptManager.getPromptById === 'function') {
                    const existingPrompt = window.promptManager.getPromptById(newPrompt.identifier);
                    if (existingPrompt) {
                        this.showStatusMessage(`Prompt "${newPrompt.name}" already exists in current preset`, 'warning');
                        return;
                    }
                }

                // Add prompt using PromptManager API
                window.promptManager.addPrompt(newPrompt, newPrompt.identifier);

                // Add to prompt order for current character
                if (window.promptManager.activeCharacter && typeof window.promptManager.getPromptOrderForCharacter === 'function') {
                    const promptOrder = window.promptManager.getPromptOrderForCharacter(window.promptManager.activeCharacter);
                    if (promptOrder) {
                        promptOrder.unshift({
                            identifier: newPrompt.identifier,
                            enabled: true
                        });
                    }
                }

                // Save and refresh
                if (typeof window.promptManager.saveServiceSettings === 'function') {
                    window.promptManager.saveServiceSettings();
                }

            // Method 3: Try using direct oai_settings access as fallback
            } else if (window.oai_settings && window.oai_settings.prompts) {
                console.log(`${LOG_PREFIX} Using direct oai_settings access`);
                
                // Check if prompt already exists
                const existingPrompt = window.oai_settings.prompts.find(p => p.identifier === newPrompt.identifier);
                if (existingPrompt) {
                    this.showStatusMessage(`Prompt "${newPrompt.name}" already exists in current preset`, 'warning');
                    return;
                }

                // Add prompt to the top of the prompts array
                window.oai_settings.prompts.unshift(newPrompt);

                // Try to add to prompt order if available
                if (window.oai_settings.prompt_order) {
                    // Find the right prompt order entry (this is complex, so we'll add to the default one)
                    const defaultOrderEntry = window.oai_settings.prompt_order.find(entry => 
                        entry.character_id === null || entry.character_id === undefined || entry.character_id === 'default'
                    );
                    
                    if (defaultOrderEntry && defaultOrderEntry.order) {
                        defaultOrderEntry.order.unshift({
                            identifier: newPrompt.identifier,
                            enabled: true
                        });
                    }
                }

                // Save settings
                if (typeof saveSettingsDebounced === 'function') {
                    saveSettingsDebounced();
                }

            } else {
                console.error(`${LOG_PREFIX} No prompt system available. Available objects:`, {
                    importedPromptManager: !!promptManager,
                    windowPromptManager: !!window.promptManager,
                    oaiSettings: !!window.oai_settings,
                    promptManagerServiceSettings: !!(promptManager && promptManager.serviceSettings),
                    promptManagerPrompts: !!(promptManager && promptManager.serviceSettings && promptManager.serviceSettings.prompts)
                });
                this.showStatusMessage('Error: Prompt system not available', 'error');
                return;
            }

            // Try to refresh the UI
            if (promptManager && typeof promptManager.render === 'function') {
                promptManager.render();
            } else if (window.promptManager && typeof window.promptManager.render === 'function') {
                window.promptManager.render();
            } else if (this.refreshUI) {
                this.refreshUI();
            } else if (this.render) {
                this.render();
            }

            this.showStatusMessage(`✅ Added "${newPrompt.name}" to current preset!`, 'success', 3000);
            console.log(`${LOG_PREFIX} Successfully added prompt to current preset: ${newPrompt.name}`);
            
        } catch (error) {
            console.error(`${LOG_PREFIX} Error adding prompt to current preset:`, error);
            this.showStatusMessage(`Error adding prompt: ${error.message}`, 'error');
        }
    },

    showEditPromptDialog: function(promptId, callback) {
        const library = this.getPromptLibrary();
        const prompt = library.find(p => p.id === promptId);
        if (!prompt) return;

        console.log(`${LOG_PREFIX} Edit dialog for prompt:`, {
            id: prompt.id,
            title: prompt.title,
            contentLength: prompt.content ? prompt.content.length : 0,
            content: prompt.content ? prompt.content.substring(0, 100) + '...' : 'No content',
            tags: prompt.tags,
            folder: prompt.folder
        });

        // Escape HTML for safe insertion
        const escapeHtml = (text) => {
            if (!text) return '';
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const dialog = document.createElement('div');
        dialog.id = 'nemo-edit-prompt-dialog';
        dialog.className = 'nemo-dialog-overlay';
        
        dialog.innerHTML = `
            <div class="nemo-dialog">
                <div class="nemo-dialog-header">
                    <h3><i class="fa-solid fa-pencil"></i> Edit Prompt</h3>
                    <button class="nemo-dialog-close" aria-label="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="nemo-dialog-body">
                    <div class="nemo-form-group">
                        <label for="nemo-edit-title">Title:</label>
                        <input type="text" id="nemo-edit-title" value="${escapeHtml(prompt.title)}" class="text_pole">
                    </div>
                    <div class="nemo-form-group">
                        <label for="nemo-edit-content">Content:</label>
                        <textarea id="nemo-edit-content" class="text_pole" rows="10"></textarea>
                    </div>
                    <div class="nemo-form-group">
                        <label for="nemo-edit-tags">Tags (comma-separated):</label>
                        <input type="text" id="nemo-edit-tags" value="${escapeHtml(prompt.tags.join(', '))}" class="text_pole" placeholder="tag1, tag2, tag3">
                    </div>
                    <div class="nemo-form-group">
                        <label for="nemo-edit-folder">Folder:</label>
                        <input type="text" id="nemo-edit-folder" value="${escapeHtml(prompt.folder || 'Default')}" class="text_pole">
                    </div>
                </div>
                <div class="nemo-dialog-footer">
                    <button class="nemo-btn-secondary" id="nemo-edit-cancel">Cancel</button>
                    <button class="nemo-btn-primary" id="nemo-edit-save">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Set textarea content safely after DOM insertion
        const contentTextarea = dialog.querySelector('#nemo-edit-content');
        contentTextarea.value = prompt.content || '';

        // Event handlers
        dialog.querySelector('#nemo-edit-cancel').addEventListener('click', () => dialog.remove());
        dialog.querySelector('.nemo-dialog-close').addEventListener('click', () => dialog.remove());
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });

        dialog.querySelector('#nemo-edit-save').addEventListener('click', () => {
            const title = dialog.querySelector('#nemo-edit-title').value.trim();
            const content = dialog.querySelector('#nemo-edit-content').value.trim();
            const tagsInput = dialog.querySelector('#nemo-edit-tags').value.trim();
            const folder = dialog.querySelector('#nemo-edit-folder').value.trim() || 'Default';

            if (!title) {
                alert('Please enter a title for the prompt.');
                return;
            }

            const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

            try {
                const updatedLibrary = this.getPromptLibrary();
                const promptToUpdate = updatedLibrary.find(p => p.id === promptId);
                
                if (promptToUpdate) {
                    promptToUpdate.title = title;
                    promptToUpdate.content = content;
                    promptToUpdate.tags = tags;
                    promptToUpdate.folder = folder;
                    promptToUpdate.dateModified = new Date().toISOString();
                    
                    localStorage.setItem(this.getPromptLibraryKey(), JSON.stringify(updatedLibrary));
                    this.showStatusMessage('Prompt updated successfully!', 'success');
                    
                    dialog.remove();
                    if (callback) callback();
                }
            } catch (error) {
                console.error(`${LOG_PREFIX} Error updating prompt:`, error);
                alert('Failed to update prompt. Please try again.');
            }
        });
    },

    showMovePromptDialog: function(promptId, callback) {
        const library = this.getPromptLibrary();
        const prompt = library.find(p => p.id === promptId);
        if (!prompt) return;

        // Get all unique folders
        const folders = [...new Set(library.map(p => p.folder || 'Default'))].sort();
        const currentFolder = prompt.folder || 'Default';

        const dialog = document.createElement('div');
        dialog.id = 'nemo-move-prompt-dialog';
        dialog.className = 'nemo-dialog-overlay';
        
        const folderOptions = folders.map(folder => 
            `<option value="${folder}" ${folder === currentFolder ? 'selected' : ''}>${folder}</option>`
        ).join('');

        dialog.innerHTML = `
            <div class="nemo-dialog">
                <div class="nemo-dialog-header">
                    <h3><i class="fa-solid fa-folder-open"></i> Move Prompt</h3>
                    <button class="nemo-dialog-close" aria-label="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="nemo-dialog-body">
                    <p>Move "<strong>${prompt.title}</strong>" to folder:</p>
                    <div class="nemo-form-group">
                        <label for="nemo-move-folder-select">Select existing folder:</label>
                        <select id="nemo-move-folder-select" class="text_pole">
                            ${folderOptions}
                        </select>
                    </div>
                    <div class="nemo-form-group">
                        <label for="nemo-move-new-folder">Or create new folder:</label>
                        <input type="text" id="nemo-move-new-folder" class="text_pole" placeholder="New folder name">
                    </div>
                </div>
                <div class="nemo-dialog-footer">
                    <button class="nemo-btn-secondary" id="nemo-move-cancel">Cancel</button>
                    <button class="nemo-btn-primary" id="nemo-move-confirm">Move</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Event handlers
        dialog.querySelector('#nemo-move-cancel').addEventListener('click', () => dialog.remove());
        dialog.querySelector('.nemo-dialog-close').addEventListener('click', () => dialog.remove());
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });

        // Auto-clear select when typing in new folder input
        dialog.querySelector('#nemo-move-new-folder').addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                dialog.querySelector('#nemo-move-folder-select').value = '';
            }
        });

        dialog.querySelector('#nemo-move-confirm').addEventListener('click', () => {
            const selectedFolder = dialog.querySelector('#nemo-move-folder-select').value;
            const newFolder = dialog.querySelector('#nemo-move-new-folder').value.trim();
            
            const targetFolder = newFolder || selectedFolder || 'Default';

            try {
                const updatedLibrary = this.getPromptLibrary();
                const promptToMove = updatedLibrary.find(p => p.id === promptId);
                
                if (promptToMove) {
                    promptToMove.folder = targetFolder;
                    promptToMove.dateModified = new Date().toISOString();
                    
                    localStorage.setItem(this.getPromptLibraryKey(), JSON.stringify(updatedLibrary));
                    this.showStatusMessage(`Prompt moved to "${targetFolder}" folder!`, 'success');
                    
                    dialog.remove();
                    if (callback) callback();
                }
            } catch (error) {
                console.error(`${LOG_PREFIX} Error moving prompt:`, error);
                alert('Failed to move prompt. Please try again.');
            }
        });
    },

    refreshArchiveSidebar: function(dialog, folders) {
        const sidebarContainer = dialog.querySelector('.nemo-archive-sidebar');
        const folderNames = Object.keys(folders).sort();
        const newSidebarContent = this.buildFolderSidebar(folderNames, folders);
        sidebarContainer.innerHTML = newSidebarContent;
    },

    showCreateFolderDialog: function(callback) {
        const dialog = document.createElement('div');
        dialog.id = 'nemo-create-folder-dialog';
        dialog.className = 'nemo-dialog-overlay';
        
        dialog.innerHTML = `
            <div class="nemo-dialog">
                <div class="nemo-dialog-header">
                    <h3><i class="fa-solid fa-folder-plus"></i> Create New Folder</h3>
                    <button class="nemo-dialog-close" aria-label="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="nemo-dialog-body">
                    <div class="nemo-form-group">
                        <label for="nemo-new-folder-name">Folder Name:</label>
                        <input type="text" id="nemo-new-folder-name" class="text_pole" placeholder="Enter folder name" autofocus>
                    </div>
                    <p class="nemo-dialog-note">Note: The folder will be created when you move prompts into it.</p>
                </div>
                <div class="nemo-dialog-footer">
                    <button class="nemo-btn-secondary" id="nemo-folder-cancel">Cancel</button>
                    <button class="nemo-btn-primary" id="nemo-folder-create">Create Folder</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Event handlers
        dialog.querySelector('#nemo-folder-cancel').addEventListener('click', () => dialog.remove());
        dialog.querySelector('.nemo-dialog-close').addEventListener('click', () => dialog.remove());
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });

        dialog.querySelector('#nemo-folder-create').addEventListener('click', () => {
            const folderName = dialog.querySelector('#nemo-new-folder-name').value.trim();
            
            if (!folderName) {
                alert('Please enter a folder name.');
                return;
            }

            // Check if folder already exists
            const library = this.getPromptLibrary();
            const existingFolders = [...new Set(library.map(p => p.folder || 'Default'))];
            
            if (existingFolders.includes(folderName)) {
                alert('A folder with this name already exists.');
                return;
            }

            // Create a placeholder prompt in the new folder to ensure it shows up
            const placeholderPrompt = {
                id: 'folder-placeholder-' + Date.now(),
                title: `${folderName} Folder`,
                content: `This folder was created on ${new Date().toLocaleDateString()}. You can delete this placeholder prompt after adding your own prompts to this folder.`,
                tags: ['folder-placeholder'],
                folder: folderName,
                dateCreated: new Date().toISOString(),
                dateModified: new Date().toISOString(),
                isFavorite: false
            };

            try {
                library.push(placeholderPrompt);
                localStorage.setItem(this.getPromptLibraryKey(), JSON.stringify(library));
                this.showStatusMessage(`Folder "${folderName}" created successfully!`, 'success');
                
                dialog.remove();
                if (callback) callback();
            } catch (error) {
                console.error(`${LOG_PREFIX} Error creating folder:`, error);
                alert('Failed to create folder. Please try again.');
            }
        });

        // Enter key support
        dialog.querySelector('#nemo-new-folder-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                dialog.querySelector('#nemo-folder-create').click();
            }
        });
    },

    showImportPromptsDialog: function(callback) {
        const dialog = document.createElement('div');
        dialog.id = 'nemo-import-prompts-dialog';
        dialog.className = 'nemo-dialog-overlay';
        
        dialog.innerHTML = `
            <div class="nemo-dialog">
                <div class="nemo-dialog-header">
                    <h3><i class="fa-solid fa-file-import"></i> Import Prompts</h3>
                    <button class="nemo-dialog-close" aria-label="Close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="nemo-dialog-body">
                    <div class="nemo-form-group">
                        <label for="nemo-import-file">Select JSON file to import:</label>
                        <input type="file" id="nemo-import-file" accept=".json" class="text_pole">
                    </div>
                    <div class="nemo-form-group">
                        <label>
                            <input type="checkbox" id="nemo-import-merge" checked> 
                            Merge with existing prompts (uncheck to replace all prompts)
                        </label>
                    </div>
                    <div class="nemo-dialog-note">
                        <strong>Note:</strong> Import files should contain an array of prompt objects with the following structure:<br>
                        <code>{"title": "Prompt Name", "content": "Prompt content", "tags": ["tag1"], "folder": "Folder Name"}</code>
                    </div>
                </div>
                <div class="nemo-dialog-footer">
                    <button class="nemo-btn-secondary" id="nemo-import-cancel">Cancel</button>
                    <button class="nemo-btn-primary" id="nemo-import-confirm" disabled>Import</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Event handlers
        dialog.querySelector('#nemo-import-cancel').addEventListener('click', () => dialog.remove());
        dialog.querySelector('.nemo-dialog-close').addEventListener('click', () => dialog.remove());
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });

        // File selection handler
        dialog.querySelector('#nemo-import-file').addEventListener('change', (e) => {
            const importButton = dialog.querySelector('#nemo-import-confirm');
            importButton.disabled = !e.target.files.length;
        });

        dialog.querySelector('#nemo-import-confirm').addEventListener('click', () => {
            const fileInput = dialog.querySelector('#nemo-import-file');
            const mergeMode = dialog.querySelector('#nemo-import-merge').checked;
            
            if (!fileInput.files.length) return;

            const file = fileInput.files[0];
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    if (!Array.isArray(importedData)) {
                        throw new Error('Import file must contain an array of prompts.');
                    }

                    let currentLibrary = mergeMode ? this.getPromptLibrary() : [];
                    let importCount = 0;
                    
                    importedData.forEach((importPrompt, index) => {
                        if (importPrompt.title && typeof importPrompt.title === 'string') {
                            const prompt = {
                                id: 'imported-' + Date.now() + '-' + index,
                                title: importPrompt.title,
                                content: importPrompt.content || '',
                                tags: Array.isArray(importPrompt.tags) ? importPrompt.tags : [],
                                folder: importPrompt.folder || 'Imported',
                                dateCreated: importPrompt.dateCreated || new Date().toISOString(),
                                dateModified: new Date().toISOString(),
                                isFavorite: Boolean(importPrompt.isFavorite)
                            };
                            console.log(`${LOG_PREFIX} Importing prompt:`, {
                                title: prompt.title,
                                contentLength: prompt.content ? prompt.content.length : 0,
                                content: prompt.content ? prompt.content.substring(0, 100) + '...' : 'No content'
                            });
                            currentLibrary.push(prompt);
                            importCount++;
                        }
                    });

                    localStorage.setItem(this.getPromptLibraryKey(), JSON.stringify(currentLibrary));
                    this.showStatusMessage(`Successfully imported ${importCount} prompts!`, 'success');
                    
                    dialog.remove();
                    if (callback) callback();
                } catch (error) {
                    console.error(`${LOG_PREFIX} Error importing prompts:`, error);
                    alert('Failed to import prompts. Please check the file format and try again.\n\nError: ' + error.message);
                }
            };
            
            reader.readAsText(file);
        });
    },

    exportPromptLibrary: function() {
        try {
            const library = this.getPromptLibrary();
            
            if (library.length === 0) {
                alert('No prompts to export.');
                return;
            }

            // Create export data
            const exportData = library.map(prompt => ({
                title: prompt.title,
                content: prompt.content,
                tags: prompt.tags,
                folder: prompt.folder,
                dateCreated: prompt.dateCreated,
                dateModified: prompt.dateModified,
                isFavorite: prompt.isFavorite
            }));

            // Create and trigger download
            const dataBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `nemo-prompts-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showStatusMessage(`Exported ${library.length} prompts successfully!`, 'success');
        } catch (error) {
            console.error(`${LOG_PREFIX} Error exporting prompts:`, error);
            alert('Failed to export prompts. Please try again.');
        }
    },

    // Cleanup method to properly destroy all observers and listeners
    destroy: function() {
        console.log(`${LOG_PREFIX} Destroying NemoPresetManager...`);

        // Disconnect all observers
        if (this.observers) {
            Object.entries(this.observers).forEach(([name, observer]) => {
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                    console.log(`${LOG_PREFIX} Disconnected observer: ${name}`);
                }
            });
            this.observers = {};
        }

        // Remove event listeners
        if (this._presetChangeAfterHandler) {
            eventSource.removeListener(event_types.OAI_PRESET_CHANGED_AFTER, this._presetChangeAfterHandler);
            this._presetChangeAfterHandler = null;
        }

        // Destroy all Sortable instances
        this.destroyAllSortables();

        console.log(`${LOG_PREFIX} NemoPresetManager destroyed`);
    },

    // Destroy all Sortable instances
    destroyAllSortables: function() {
        if (this.sortableInstances) {
            this.sortableInstances.forEach(instance => {
                try {
                    instance.destroy();
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Error destroying Sortable:`, error);
                }
            });
            this.sortableInstances.clear();
            console.log(`${LOG_PREFIX} Destroyed all Sortable instances`);
        }
    }
};