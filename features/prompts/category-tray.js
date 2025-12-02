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

// Track which sections are in tray mode
const trayModeEnabled = new Set();

// Persistent cache for section prompt IDs (survives DOM refreshes)
// Key: section name (from getSectionId), Value: array of {identifier, name}
const sectionPromptIdsCache = new Map();

// Track compact view state per section
const compactViewState = new Map();

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
 * Initialize the category tray system
 */
export function initCategoryTray() {
    console.log('[NemoTray] ====== INIT CALLED ======');
    logger.info('Initializing category tray system');

    // Try multiple times with increasing delays to catch sections
    const delays = [500, 1000, 2000, 3000, 5000];
    delays.forEach(delay => {
        setTimeout(() => {
            console.log(`[NemoTray] Checking for sections after ${delay}ms...`);
            const count = convertToTrayMode();
            if (count > 0) {
                console.log(`[NemoTray] Converted ${count} sections after ${delay}ms`);
            }
            // Also refresh progress bars to catch any ST overwrites
            refreshAllSectionProgressBars();
        }, delay);
    });

    // Additional delayed refresh to catch late ST updates
    setTimeout(() => refreshAllSectionProgressBars(), 6000);
    setTimeout(() => refreshAllSectionProgressBars(), 8000);

    // Watch for prompt manager re-renders
    const observer = new MutationObserver((mutations) => {
        // Only run if we see relevant changes
        const hasRelevantChanges = mutations.some(m =>
            m.addedNodes.length > 0 ||
            (m.target.classList && m.target.classList.contains('nemo-engine-section'))
        );

        if (hasRelevantChanges) {
            clearTimeout(window._trayDebounce);
            window._trayDebounce = setTimeout(() => {
                convertToTrayMode();
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

        // If no prompts in DOM and no cache, this section has no prompts (skip it)
        if (!hasPromptsInDOM && !cachedPromptIds) {
            console.log('[NemoTray] No prompts in section (may contain sub-sections only):', sectionName);
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
            });

            // Store in persistent cache (survives DOM refreshes)
            sectionPromptIdsCache.set(sectionName, sectionPromptIds);
            console.log(`[NemoTray] Cached ${sectionPromptIds.length} prompt IDs for section:`, sectionName);

            // Remove prompt DOM elements (they contain heavy content)
            promptElements.forEach(el => el.remove());
            console.log(`[NemoTray] Removed ${promptElements.length} prompt DOM elements from:`, sectionName);
        } else {
            // Restore from cache (DOM was refreshed by SillyTavern)
            sectionPromptIds = cachedPromptIds;
            console.log(`[NemoTray] Restored ${sectionPromptIds.length} prompt IDs from cache for:`, sectionName);
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

        // Keep section closed
        section.open = false;

        converted++;
    });

    if (converted > 0) {
        console.log('[NemoTray] Converted', converted, 'sections to tray mode');
    }

    return converted;
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

    // Close other open trays and clear their references
    document.querySelectorAll('.nemo-tray-section').forEach(otherSection => {
        if (otherSection !== section && otherSection._nemoCategoryTray) {
            console.log('[NemoTray] Removing existing tray from:', getSectionId(otherSection));
            otherSection._nemoCategoryTray.remove();
            delete otherSection._nemoCategoryTray;
            otherSection.classList.remove('nemo-tray-open');
        }
    });

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
        const tooltipHtml = p.tooltip ? `<div class="nemo-prompt-card-tooltip">${escapeHtml(p.tooltip)}</div>` : '';
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
                <div class="nemo-prompt-card-header">
                    <span class="nemo-prompt-card-name">${escapeHtml(p.name)}${badgeHtml}</span>
                    <div class="nemo-prompt-card-actions">
                        ${depIndicatorsHtml}
                        <span class="nemo-prompt-card-edit" title="Preview content">
                            <i class="fa-solid fa-eye fa-xs"></i>
                        </span>
                        <span class="nemo-prompt-card-status">${p.isEnabled ? '✓' : ''}</span>
                    </div>
                </div>
                ${tooltipHtml}
            </div>
        `;
    });

    trayContent += `
        </div>
        <div class="nemo-tray-footer">
            <span class="nemo-tray-hint">Click to toggle • ↑↓←→ Navigate • Space/Enter Toggle • ${prompts.filter(p => p.isEnabled).length}/${prompts.length} active</span>
        </div>
    `;

    tray.innerHTML = trayContent;

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
    const closeOnOutsideClick = (e) => {
        const clickedInTray = tray.contains(e.target);
        const clickedOnSection = section.contains(e.target);
        if (!clickedInTray && !clickedOnSection) {
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

    if (tray) {
        // Remove click-outside handler
        if (tray._closeHandler) {
            document.removeEventListener('click', tray._closeHandler);
        }
        // Remove keyboard handler (must match capture flag)
        if (tray._keyHandler) {
            document.removeEventListener('keydown', tray._keyHandler, true);
        }
        tray.classList.add('nemo-tray-closing');
        setTimeout(() => {
            tray.remove();
            delete section._nemoCategoryTray;
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
 * Update section progress bar using stored prompt IDs (after DOM removal)
 * This calculates enabled count from promptManager data
 */
function updateSectionProgressFromStoredIds(section) {
    const storedPromptIds = section._nemoPromptIds;
    if (!storedPromptIds || storedPromptIds.length === 0) {
        return;
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
            summary.removeAttribute('tabindex');
            summary.removeAttribute('role');
            summary.removeAttribute('aria-expanded');
        }

        // Remove tray-related classes and attributes
        section.classList.remove('nemo-tray-section', 'nemo-tray-open');
        delete section.dataset.trayConverted;
        delete section._nemoPromptIds;

        // Remove hidden content class
        const content = section.querySelector('.nemo-section-content');
        if (content) {
            content.classList.remove('nemo-tray-hidden-content');
        }
    });

    // Clear tray mode tracking
    trayModeEnabled.clear();
    // Note: We keep sectionPromptIdsCache in case sections are re-enabled later

    console.log('[NemoTray] Tray mode disabled');
    logger.info('Tray mode disabled for all sections');
}
