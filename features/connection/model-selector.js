/**
 * NemoPresetExt - Enhanced Model Selector (Orchestrator)
 *
 * Replaces the Chat Completion Source dropdown with provider tabs
 * and all model dropdowns with a NanoGPT-style card grid.
 * Supports cross-provider model search.
 */

import { eventSource, event_types, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { ProviderTabs } from './provider-tabs.js';
import { ModelCards } from './model-cards.js';
import { pushRecent } from './model-favorites.js';
import { PipelineSettingsUI } from './pipeline-settings.js';
import { TextCompletionSelector } from './textcomp-selector.js';
import logger from '../../core/logger.js';

const NEMO_EXTENSION_NAME = 'NemoPresetExt';

/** Set of select IDs we have hidden */
const hiddenSelects = new Set();

/** MutationObserver for model list repopulation */
let repopulationObserver = null;

/** Debounce timer for refresh */
let refreshTimer = null;

/**
 * Hide a model select and its label/Select2 container.
 * @param {string} selectId - CSS selector
 */
function hideModelSelect(selectId) {
    const el = document.querySelector(selectId);
    if (!el) return;

    el.classList.add('nemo-hidden-by-selector');

    // Hide the Select2 container if present (could be next or next-next sibling)
    let sibling = el.nextElementSibling;
    while (sibling) {
        if (sibling.classList.contains('select2-container')) {
            sibling.classList.add('nemo-hidden-by-selector');
            break;
        }
        // Only check immediate siblings, don't go too far
        if (sibling !== el.nextElementSibling) break;
        sibling = sibling.nextElementSibling;
    }

    // Hide the H4 label above
    const prev = el.previousElementSibling;
    if (prev && prev.tagName === 'H4') {
        prev.classList.add('nemo-hidden-by-selector');
    }

    hiddenSelects.add(selectId);
}

/**
 * Restore a hidden model select.
 * @param {string} selectId
 */
function restoreModelSelect(selectId) {
    const el = document.querySelector(selectId);
    if (!el) return;

    el.classList.remove('nemo-hidden-by-selector');

    let sibling = el.nextElementSibling;
    while (sibling) {
        if (sibling.classList.contains('select2-container')) {
            sibling.classList.remove('nemo-hidden-by-selector');
            break;
        }
        if (sibling !== el.nextElementSibling) break;
        sibling = sibling.nextElementSibling;
    }

    const prev = el.previousElementSibling;
    if (prev && prev.tagName === 'H4') {
        prev.classList.remove('nemo-hidden-by-selector');
    }

    hiddenSelects.delete(selectId);
}

/**
 * Hide ALL model selects across ALL providers.
 * Called once at initialization — our card grid replaces them all.
 */
function hideAllModelSelects() {
    const allSelects = ModelCards.getAllSelects();
    for (const selectId of Object.values(allSelects)) {
        hideModelSelect(selectId);
    }
    logger.debug('ModelSelector: Hidden all model selects', { count: hiddenSelects.size });
}

/**
 * Handle cross-provider model selection.
 * Switches provider first, then selects the model after a delay.
 * @param {string} targetSource - Provider to switch to
 * @param {string} modelValue - Model to select
 */
function handleCrossProviderSelect(targetSource, modelValue) {
    const sourceSelect = document.getElementById('chat_completion_source');
    if (!sourceSelect) return;

    // Switch provider via the hidden dropdown
    $(sourceSelect).val(targetSource).trigger('change');

    // After provider switch completes, select the model
    // Use longer delay to let ST reconnect and repopulate
    setTimeout(() => {
        const selectId = ModelCards.getSelectId(targetSource);
        if (!selectId) return;

        const $modelSelect = $(selectId);
        if ($modelSelect.length) {
            $modelSelect.val(modelValue).trigger('change');
            pushRecent(targetSource, modelValue);
        }

        // Re-render cards for the new provider
        ModelCards.showForSource(targetSource);
        ProviderTabs.syncActive();

        // Re-hide selects (ST may have shown some during toggle)
        hideAllModelSelects();
    }, 600);
}

/**
 * Handle provider change — update tabs and cards.
 * @param {string} [newSource] - New provider source (from event arg)
 */
function onProviderChanged(newSource) {
    // Use event argument if available, otherwise read from dropdown
    const source = newSource || ProviderTabs.getActive();
    if (!source) return;

    logger.debug('ModelSelector: Provider changed to', source);

    // Sync tab highlight
    ProviderTabs.syncActive();

    // Wait for ST to finish its DOM updates (toggleChatCompletionForms, reconnectOpenAi)
    setTimeout(() => {
        // Re-hide all model selects (ST may have shown the new provider's select)
        hideAllModelSelects();

        // Show model cards for the new provider
        ModelCards.showForSource(source);

        // Re-observe for repopulation
        setupRepopulationObserver();
    }, 200);
}

/**
 * Watch model selects for dynamic repopulation (options added/removed).
 */
function setupRepopulationObserver() {
    if (repopulationObserver) {
        repopulationObserver.disconnect();
    }

    repopulationObserver = new MutationObserver(() => {
        // Model list repopulated — refresh cards after debounce
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            // Re-hide selects (repopulation may have disrupted our state)
            hideAllModelSelects();
            ModelCards.refresh();
        }, 200);
    });

    // Observe all model selects for option changes
    const allSelects = ModelCards.getAllSelects();
    for (const selectId of Object.values(allSelects)) {
        const el = document.querySelector(selectId);
        if (el) {
            repopulationObserver.observe(el, { childList: true });
        }
    }
}

export const ModelSelector = {
    /**
     * Initialize the enhanced model selector.
     */
    initialize() {
        const sourceSelect = document.getElementById('chat_completion_source');
        if (!sourceSelect) {
            logger.warn('ModelSelector: #chat_completion_source not found, aborting');
            return;
        }

        const currentSource = sourceSelect.value;

        // Remove re-enable button if present
        document.getElementById('nemo-selector-reenable-btn')?.remove();

        // 1. Create provider tabs (replaces the dropdown)
        //    Tabs are wrapped in a "safe" container prepended to #openai_api
        const result = ProviderTabs.initialize();
        if (!result) {
            logger.warn('ModelSelector: Failed to create provider tabs');
            return;
        }

        // 2. Add disable button to the wrapper (top-right)
        const disableBtn = document.createElement('button');
        disableBtn.className = 'nemo-selector-disable-btn';
        disableBtn.title = 'Revert to default dropdowns';
        disableBtn.innerHTML = '<i class="fa-solid fa-arrow-rotate-left"></i>';
        disableBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            extension_settings[NEMO_EXTENSION_NAME].enableModelSelector = false;
            saveSettingsDebounced();
            ModelSelector.destroy();
            try { TextCompletionSelector.destroy(); } catch (_) { /* ignore */ }
            // Also update the settings toggle if it exists
            const toggle = document.getElementById('nemoEnableModelSelector');
            if (toggle) toggle.checked = false;
        });
        result.wrapper.style.position = 'relative';
        result.wrapper.appendChild(disableBtn);

        // 3. Create model cards panel (inside the wrapper, after tabs)
        ModelCards.initialize(result.wrapper, handleCrossProviderSelect);

        // 3. Hide ALL model selects (our card grid replaces them all)
        hideAllModelSelects();

        // 4. Show model cards for current provider
        ModelCards.showForSource(currentSource);

        // 5. Watch for provider changes (ST passes source as first arg)
        eventSource.on(event_types.CHATCOMPLETION_SOURCE_CHANGED, onProviderChanged);

        // 6. Watch for model changes (from external sources like preset load)
        if (event_types.CHATCOMPLETION_MODEL_CHANGED) {
            eventSource.on(event_types.CHATCOMPLETION_MODEL_CHANGED, () => {
                setTimeout(() => ModelCards.refresh(), 150);
            });
        }

        // 7. Set up repopulation observer
        setupRepopulationObserver();

        // 8. Load CSS
        if (!document.querySelector('link[href*="model-selector.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'scripts/extensions/third-party/NemoPresetExt/features/connection/model-selector.css';
            document.head.appendChild(link);
        }

        // 9. Load pipeline settings CSS
        if (!document.querySelector('link[href*="pipeline-settings.css"]')) {
            const pipeLink = document.createElement('link');
            pipeLink.rel = 'stylesheet';
            pipeLink.href = 'scripts/extensions/third-party/NemoPresetExt/features/connection/pipeline-settings.css';
            document.head.appendChild(pipeLink);
        }

        // 10. Load proxy manager CSS
        if (!document.querySelector('link[href*="proxy-manager.css"]')) {
            const proxyLink = document.createElement('link');
            proxyLink.rel = 'stylesheet';
            proxyLink.href = 'scripts/extensions/third-party/NemoPresetExt/features/connection/proxy-manager.css';
            document.head.appendChild(proxyLink);
        }

        // 11. Initialize Nemo Stack pipeline settings UI
        PipelineSettingsUI.initialize(result.wrapper);

        logger.info('ModelSelector: Initialized with provider tabs + card grid + pipeline settings');
    },

    /**
     * Destroy everything and restore original UI.
     */
    destroy() {
        // Remove event listeners
        eventSource.removeListener(event_types.CHATCOMPLETION_SOURCE_CHANGED, onProviderChanged);

        // Disconnect observer
        if (repopulationObserver) {
            repopulationObserver.disconnect();
            repopulationObserver = null;
        }
        clearTimeout(refreshTimer);

        // Restore all hidden selects
        for (const selectId of [...hiddenSelects]) {
            restoreModelSelect(selectId);
        }

        // Destroy sub-modules
        PipelineSettingsUI.destroy();
        ModelCards.destroy();
        ProviderTabs.destroy();

        // Remove CSS — keep it loaded for the re-enable button styling
        // (it's lightweight and harmless)

        // Inject re-enable button next to the restored dropdown
        this.injectReEnableButton();

        logger.info('ModelSelector: Destroyed, original UI restored');
    },

    /**
     * Inject a banner button above the dropdown to re-enable the overhaul.
     */
    /**
     * Inject the re-enable button. Called from destroy() and from content.js
     * when the feature is disabled on page load.
     */
    injectReEnableButton() {
        // Remove any existing re-enable button
        document.getElementById('nemo-selector-reenable-btn')?.remove();

        const sourceSelect = document.getElementById('chat_completion_source');
        if (!sourceSelect) return;

        const btn = document.createElement('div');
        btn.id = 'nemo-selector-reenable-btn';
        btn.title = 'Open Enhanced Selector';
        btn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#aaa;cursor:pointer;font-size:13px;background:rgba(0,0,0,0.15);user-select:none;transition:all 0.15s;flex-shrink:0;';
        btn.innerHTML = '<i class="fa-solid fa-grip"></i>';

        btn.addEventListener('mouseenter', () => {
            btn.style.borderColor = '#4a90d9';
            btn.style.color = '#ccc';
            btn.style.background = 'rgba(74,144,217,0.12)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.borderColor = 'rgba(255,255,255,0.12)';
            btn.style.color = '#aaa';
            btn.style.background = 'rgba(0,0,0,0.15)';
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.remove();
            extension_settings[NEMO_EXTENSION_NAME].enableModelSelector = true;
            saveSettingsDebounced();
            const toggle = document.getElementById('nemoEnableModelSelector');
            if (toggle) toggle.checked = true;
            ModelSelector.initialize();
            try { TextCompletionSelector.initialize(); } catch (_) { /* ignore */ }
        });

        // Insert right after the select dropdown, inline
        sourceSelect.parentNode.insertBefore(btn, sourceSelect.nextSibling);
        // Make the parent flex so button sits inline with dropdown
        if (sourceSelect.parentNode) {
            sourceSelect.parentNode.style.display = 'flex';
            sourceSelect.parentNode.style.alignItems = 'center';
            sourceSelect.parentNode.style.gap = '6px';
        }
        logger.debug('ModelSelector: Re-enable button injected');
    },

    /**
     * Re-initialize a specific select (e.g., after dynamic content change).
     * @param {string} _selectId
     */
    reinitializeSelect(_selectId) {
        ModelCards.refresh();
    },
};
