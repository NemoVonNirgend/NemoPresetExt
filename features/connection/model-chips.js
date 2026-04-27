/**
 * NemoPresetExt - Model Quick-Switch Chips
 *
 * Renders a chip bar below each model select showing favorites and recent models.
 * Clicking a chip instantly switches to that model.
 */

import { getFavorites, getRecent, isFavorite } from './model-favorites.js';
import logger from '../../core/logger.js';

/** @type {string[]} */
let targetSelects = [];

/** @type {Record<string, string>} */
let selectToSource = {};

/**
 * Get the display name for a model from a select's options.
 * @param {string} selectId
 * @param {string} modelId
 * @returns {string}
 */
function getModelDisplayName(selectId, modelId) {
    const option = document.querySelector(`${selectId} option[value="${CSS.escape(modelId)}"]`);
    if (option) {
        // Use short display text, truncate if needed
        let text = option.textContent.trim();
        // Remove provider prefixes like "openai/" for display
        if (text.includes('/')) {
            const parts = text.split('/');
            text = parts[parts.length - 1];
        }
        return text.length > 30 ? text.substring(0, 28) + '...' : text;
    }
    // Fallback: use modelId, shortened
    const shortId = modelId.includes('/') ? modelId.split('/').pop() : modelId;
    return shortId.length > 30 ? shortId.substring(0, 28) + '...' : shortId;
}

/**
 * Check if a model exists as an option in the select.
 * @param {string} selectId
 * @param {string} modelId
 * @returns {boolean}
 */
function modelExistsInSelect(selectId, modelId) {
    return !!document.querySelector(`${selectId} option[value="${CSS.escape(modelId)}"]`);
}

/**
 * Render chip bar for a specific select.
 * @param {string} selectId
 */
function renderChips(selectId) {
    const source = selectToSource[selectId];
    if (!source || source === 'chat_completion_source') return;

    const $select = $(selectId);
    if (!$select.length) return;

    // Find or create chip container
    const containerId = `nemo-chips-${selectId.replace('#', '')}`;
    let container = document.getElementById(containerId);

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'nemo-model-chips';
        container.dataset.for = selectId;

        // Insert after the select (or after its Select2 container)
        const select2Container = $select.next('.select2-container');
        if (select2Container.length) {
            select2Container.after(container);
        } else {
            $select.after(container);
        }
    }

    // Get current value
    const currentValue = String($select.val() || '');

    // Gather favorites and recent, deduplicate
    const favorites = getFavorites(source).filter(id => modelExistsInSelect(selectId, id));
    const recent = getRecent(source).filter(id =>
        modelExistsInSelect(selectId, id) && !favorites.includes(id),
    );

    // Clear and rebuild
    container.innerHTML = '';

    // Render favorite chips
    for (const modelId of favorites) {
        const chip = createChip(selectId, modelId, currentValue, true);
        container.appendChild(chip);
    }

    // Render recent chips (max 3 to avoid overflow)
    for (const modelId of recent.slice(0, 3)) {
        const chip = createChip(selectId, modelId, currentValue, false);
        container.appendChild(chip);
    }
}

/**
 * Create a chip element.
 * @param {string} selectId
 * @param {string} modelId
 * @param {string} currentValue
 * @param {boolean} isFav
 * @returns {HTMLElement}
 */
function createChip(selectId, modelId, currentValue, isFav) {
    const chip = document.createElement('span');
    chip.className = 'nemo-model-chip';
    if (currentValue === modelId) {
        chip.classList.add('active');
    }
    chip.dataset.model = modelId;
    chip.dataset.selectId = selectId;
    chip.title = modelId;

    const displayName = getModelDisplayName(selectId, modelId);

    if (isFav) {
        chip.innerHTML = `<i class="fa-solid fa-star nemo-chip-star"></i> ${escapeHtml(displayName)}`;
    } else {
        chip.textContent = displayName;
    }

    // Click to switch model
    chip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const $target = $(selectId);
        if ($target.length) {
            $target.val(modelId).trigger('change');
        }
    });

    return chip;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export const ModelChips = {
    /**
     * Initialize chip bars for all target selects.
     * @param {string[]} selects - Array of select CSS IDs
     * @param {Record<string, string>} sourceMap - Map of select ID to provider source key
     */
    initialize(selects, sourceMap) {
        targetSelects = selects;
        selectToSource = sourceMap;

        // Initial render
        this.renderAll();

        logger.debug('Model Chips initialized', { selectCount: selects.length });
    },

    /**
     * Render chips for all target selects.
     */
    renderAll() {
        for (const selectId of targetSelects) {
            renderChips(selectId);
        }
    },

    /**
     * Render chips for a specific select.
     * @param {string} selectId
     */
    renderForSelect(selectId) {
        renderChips(selectId);
    },

    /**
     * Destroy all chip bars.
     */
    destroy() {
        for (const selectId of targetSelects) {
            const containerId = `nemo-chips-${selectId.replace('#', '')}`;
            const container = document.getElementById(containerId);
            if (container) {
                container.remove();
            }
        }
        targetSelects = [];
        selectToSource = {};
        logger.debug('Model Chips destroyed');
    },
};
