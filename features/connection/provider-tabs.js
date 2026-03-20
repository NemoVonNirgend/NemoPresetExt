/**
 * NemoPresetExt - Provider Tabs
 *
 * Replaces the #chat_completion_source dropdown with clickable tab pills.
 * Clicking a tab sets the hidden dropdown's value and triggers 'change'
 * so SillyTavern's native show/hide logic handles the rest.
 */

import logger from '../../core/logger.js';

/** @type {HTMLElement|null} */
let wrapperContainer = null;

/** @type {HTMLElement|null} */
let tabContainer = null;

/** @type {HTMLSelectElement|null} */
let originalDropdown = null;

/** @type {HTMLElement|null} */
let originalLabel = null;

/**
 * Build provider tabs and the outer wrapper that contains tabs + model panel.
 * The wrapper is prepended to #openai_api so it's always at the top and
 * cannot be affected by ST's data-source toggle logic.
 * @returns {{ wrapper: HTMLElement, tabsEl: HTMLElement } | null}
 */
function buildTabs() {
    const sourceSelect = /** @type {HTMLSelectElement} */ (document.getElementById('chat_completion_source'));
    if (!sourceSelect) {
        logger.warn('ProviderTabs: #chat_completion_source not found');
        return null;
    }

    const apiContainer = sourceSelect.closest('#openai_api');
    if (!apiContainer) {
        logger.warn('ProviderTabs: #openai_api container not found');
        return null;
    }

    originalDropdown = sourceSelect;

    // Hide the original dropdown and its label
    const label = sourceSelect.previousElementSibling;
    if (label && label.tagName === 'H4') {
        originalLabel = /** @type {HTMLElement} */ (label);
        originalLabel.classList.add('nemo-hidden-by-selector');
    }
    sourceSelect.classList.add('nemo-hidden-by-selector');

    // Hide Select2 container if ST applied one
    const select2El = sourceSelect.nextElementSibling;
    if (select2El && select2El.classList.contains('select2-container')) {
        select2El.classList.add('nemo-hidden-by-selector');
    }

    // Create the outer wrapper — this is our "safe zone"
    // It's explicitly styled inline so no external CSS can hide it
    wrapperContainer = document.createElement('div');
    wrapperContainer.id = 'nemo-model-selector-wrapper';
    wrapperContainer.style.cssText = 'display: block !important; visibility: visible !important;';

    // Create tab container
    tabContainer = document.createElement('div');
    tabContainer.className = 'nemo-provider-tabs';
    tabContainer.id = 'nemo-provider-tabs';

    // Read all options (flatten optgroups)
    const options = sourceSelect.querySelectorAll('option');
    const currentValue = sourceSelect.value;

    for (const option of options) {
        if (!option.value) continue;

        const tab = document.createElement('div');
        tab.className = 'nemo-provider-tab';
        if (option.value === currentValue) {
            tab.classList.add('active');
        }
        tab.dataset.provider = option.value;
        tab.textContent = option.textContent.trim();
        tab.title = option.textContent.trim();

        // Rename "Custom (OpenAI-compatible)" to "Proxies"
        if (option.value === 'custom') {
            tab.textContent = 'Proxies';
            tab.title = 'Custom OpenAI-compatible Proxies';
        }

        tab.addEventListener('click', () => {
            onTabClick(option.value);
        });

        tabContainer.appendChild(tab);
    }

    wrapperContainer.appendChild(tabContainer);

    // PREPEND to #openai_api so it's always the first child
    apiContainer.prepend(wrapperContainer);

    logger.debug('ProviderTabs: Built tabs', { count: options.length });

    return { wrapper: wrapperContainer, tabsEl: tabContainer };
}

/**
 * Handle tab click — update dropdown and trigger change.
 * @param {string} sourceValue
 */
function onTabClick(sourceValue) {
    if (!originalDropdown) return;

    // Update active tab immediately (before ST processes the change)
    if (tabContainer) {
        tabContainer.querySelectorAll('.nemo-provider-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.provider === sourceValue);
        });
    }

    // Set the hidden dropdown value and trigger change for ST
    $(originalDropdown).val(sourceValue).trigger('change');
}

export const ProviderTabs = {
    /**
     * Initialize provider tabs. Returns the wrapper element for the model panel to attach to.
     * @returns {{ wrapper: HTMLElement, tabsEl: HTMLElement } | null}
     */
    initialize() {
        return buildTabs();
    },

    /**
     * Get the wrapper container (for ModelCards to insert into).
     * @returns {HTMLElement|null}
     */
    getWrapper() {
        return wrapperContainer;
    },

    /**
     * Sync active tab to current dropdown value (called on external changes).
     */
    syncActive() {
        if (!tabContainer || !originalDropdown) return;
        const current = originalDropdown.value;
        tabContainer.querySelectorAll('.nemo-provider-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.provider === current);
        });
    },

    /**
     * Get the current active source.
     * @returns {string}
     */
    getActive() {
        return originalDropdown ? originalDropdown.value : '';
    },

    /**
     * Destroy tabs and restore original dropdown.
     */
    destroy() {
        if (wrapperContainer) {
            wrapperContainer.remove();
            wrapperContainer = null;
            tabContainer = null;
        }
        if (originalDropdown) {
            originalDropdown.classList.remove('nemo-hidden-by-selector');
            const select2Container = originalDropdown.nextElementSibling;
            if (select2Container && select2Container.classList.contains('select2-container')) {
                select2Container.classList.remove('nemo-hidden-by-selector');
            }
            originalDropdown = null;
        }
        if (originalLabel) {
            originalLabel.classList.remove('nemo-hidden-by-selector');
            originalLabel = null;
        }
    },
};
