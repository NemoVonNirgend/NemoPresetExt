/**
 * NemoPresetExt - Text Completion Selector
 *
 * Mirrors the Chat Completion ModelSelector for the Text Completion panel.
 * Replaces the #textgen_type dropdown with provider tabs and model cards.
 */

import { eventSource, event_types, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { getFavorites, isFavorite, toggleFavorite, pushRecent } from './model-favorites.js';
import logger from '../../core/logger.js';

const NEMO_EXTENSION_NAME = 'NemoPresetExt';

/**
 * Map of Text Completion provider keys to their model select IDs.
 * Providers with no model select (KoboldCpp, HuggingFace) are omitted.
 * Text inputs (generic, ooba) are included — we read their datalist/value.
 */
const TC_SOURCE_TO_SELECT = {
    'aphrodite': '#aphrodite_model',
    'dreamgen': '#model_dreamgen_select',
    'infermaticai': '#model_infermaticai_select',
    'llamacpp': '#llamacpp_model',
    'mancer': '#mancer_model',
    'ollama': '#ollama_model',
    'openrouter': '#openrouter_model',
    'tabby': '#tabby_model',
    'togetherai': '#model_togetherai_select',
    'vllm': '#vllm_model',
};

/** Providers that use text inputs instead of selects */
const TC_TEXT_INPUT_PROVIDERS = {
    'ooba': '#custom_model_textgenerationwebui',
    'generic': '#generic_model_textgenerationwebui',
};

/** Providers with no model selection at all, or with their own built-in model browser */
const TC_NO_MODEL_PROVIDERS = ['koboldcpp', 'huggingface', 'featherless'];

/** Provider display names */
const TC_PROVIDER_NAMES = {
    'aphrodite': 'Aphrodite',
    'dreamgen': 'DreamGen',
    'featherless': 'Featherless',
    'generic': 'Generic',
    'huggingface': 'HuggingFace',
    'infermaticai': 'InfermaticAI',
    'koboldcpp': 'KoboldCpp',
    'llamacpp': 'llama.cpp',
    'mancer': 'Mancer',
    'ollama': 'Ollama',
    'openrouter': 'OpenRouter',
    'tabby': 'TabbyAPI',
    'ooba': 'oobabooga',
    'togetherai': 'TogetherAI',
    'vllm': 'vLLM',
};

// --- State ---

/** @type {HTMLElement|null} */
let wrapperContainer = null;

/** @type {HTMLElement|null} */
let tabContainer = null;

/** @type {HTMLElement|null} */
let panelContainer = null;

/** @type {HTMLElement|null} */
let gridContainer = null;

/** @type {HTMLInputElement|null} */
let searchInput = null;

/** @type {HTMLElement|null} */
let resultCount = null;

/** @type {HTMLSelectElement|null} */
let originalDropdown = null;

/** @type {HTMLElement|null} */
let originalLabel = null;

/** @type {string} */
let currentSource = '';

/** @type {Set<string>} */
const hiddenSelects = new Set();

/** @type {MutationObserver|null} */
let repopulationObserver = null;

/** @type {number|null} */
let refreshTimer = null;

/** @type {number|null} */
let searchDebounce = null;

// --- Utility functions ---

function readModelsFromSelect(selectId) {
    const select = document.querySelector(selectId);
    if (!select) return [];

    const models = [];
    const options = select.querySelectorAll('option');
    for (const option of options) {
        if (!option.value || option.value === '' || option.textContent.includes('Connect to the API')) continue;
        const optgroup = option.closest('optgroup');
        models.push({
            value: option.value,
            text: option.textContent.trim(),
            group: optgroup ? optgroup.label : '',
        });
    }
    return models;
}

function getDisplayName(text, value) {
    if (text && text !== value) return text;
    if (value.includes('/')) return value.split('/').pop();
    return value;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Card rendering ---

function createCard(model, source, currentValue) {
    const card = document.createElement('div');
    card.className = 'nemo-model-card';
    if (model.value === currentValue) card.classList.add('active');
    card.dataset.model = model.value;
    card.dataset.provider = source;

    const displayName = getDisplayName(model.text, model.value);
    const isFav = isFavorite(`tc_${source}`, model.value);

    const header = document.createElement('div');
    header.className = 'nemo-card-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'nemo-card-name';
    nameEl.textContent = displayName;

    const favStar = document.createElement('i');
    favStar.className = `fa-${isFav ? 'solid' : 'regular'} fa-star nemo-card-fav${isFav ? ' active' : ''}`;
    favStar.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    favStar.addEventListener('click', (e) => {
        e.stopPropagation();
        const newState = toggleFavorite(`tc_${source}`, model.value);
        favStar.className = `fa-${newState ? 'solid' : 'regular'} fa-star nemo-card-fav${newState ? ' active' : ''}`;
        favStar.title = newState ? 'Remove from favorites' : 'Add to favorites';
    });

    header.appendChild(nameEl);
    header.appendChild(favStar);
    card.appendChild(header);

    if (model.value !== displayName) {
        const idEl = document.createElement('div');
        idEl.className = 'nemo-card-id';
        idEl.textContent = model.value;
        idEl.title = model.value;
        card.appendChild(idEl);
    }

    card.addEventListener('click', () => selectModel(source, model.value));
    return card;
}

function selectModel(source, modelValue) {
    const selectId = TC_SOURCE_TO_SELECT[source];
    if (!selectId) return;

    const $select = $(selectId);
    if (!$select.length) return;

    $select.val(modelValue).trigger('change');
    pushRecent(`tc_${source}`, modelValue);

    if (gridContainer) {
        gridContainer.querySelectorAll('.nemo-model-card').forEach(card => {
            card.classList.toggle('active', card.dataset.model === modelValue && card.dataset.provider === source);
        });
    }
}

function renderForSource(source) {
    if (!gridContainer) return;
    currentSource = source;

    // No model select for these providers
    if (TC_NO_MODEL_PROVIDERS.includes(source)) {
        gridContainer.innerHTML = '<div class="nemo-model-empty"><i class="fa-solid fa-microchip"></i>This provider uses its own model management</div>';
        updateResultCount(0);
        return;
    }

    // Text input providers
    if (TC_TEXT_INPUT_PROVIDERS[source]) {
        const inputId = TC_TEXT_INPUT_PROVIDERS[source];
        const input = document.querySelector(inputId);
        gridContainer.innerHTML = '';

        const note = document.createElement('div');
        note.className = 'nemo-model-empty';
        note.innerHTML = `<i class="fa-solid fa-keyboard"></i>Type the model name in the field below`;
        gridContainer.appendChild(note);

        // Show the text input (un-hide it)
        if (input) input.closest('.flex-container, div')?.style.removeProperty('display');

        updateResultCount(0);
        return;
    }

    const selectId = TC_SOURCE_TO_SELECT[source];
    if (!selectId) {
        gridContainer.innerHTML = '<div class="nemo-model-empty"><i class="fa-solid fa-circle-question"></i>Unknown provider</div>';
        updateResultCount(0);
        return;
    }

    let models = readModelsFromSelect(selectId);
    if (models.length === 0) {
        gridContainer.innerHTML = '<div class="nemo-model-empty"><i class="fa-solid fa-plug-circle-xmark"></i>Connect to the API to see available models</div>';
        updateResultCount(0);
        return;
    }

    const $select = $(selectId);
    const currentValue = String($select.val() || '');

    const favorites = getFavorites(`tc_${source}`);
    const sorted = [...models].sort((a, b) => {
        const aFav = favorites.includes(a.value);
        const bFav = favorites.includes(b.value);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.text.localeCompare(b.text);
    });

    gridContainer.innerHTML = '';
    for (const model of sorted) {
        gridContainer.appendChild(createCard(model, source, currentValue));
    }
    updateResultCount(sorted.length);
}

function renderCrossProvider(query) {
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    const lowerQuery = query.toLowerCase();
    let totalResults = 0;

    for (const [source, selectId] of Object.entries(TC_SOURCE_TO_SELECT)) {
        const models = readModelsFromSelect(selectId);
        const matches = models.filter(m =>
            m.text.toLowerCase().includes(lowerQuery) ||
            m.value.toLowerCase().includes(lowerQuery),
        );
        if (matches.length === 0) continue;

        const header = document.createElement('div');
        header.className = 'nemo-provider-group-header';
        header.innerHTML = `<i class="fa-solid fa-server"></i> ${escapeHtml(TC_PROVIDER_NAMES[source] || source)} <span style="opacity:0.6">(${matches.length})</span>`;
        gridContainer.appendChild(header);

        const $select = $(selectId);
        const currentValue = String($select.val() || '');

        for (const model of matches.slice(0, 20)) {
            gridContainer.appendChild(createCard(model, source, currentValue));
        }
        if (matches.length > 20) {
            const more = document.createElement('div');
            more.className = 'nemo-model-empty';
            more.style.padding = '8px';
            more.textContent = `...and ${matches.length - 20} more`;
            gridContainer.appendChild(more);
        }
        totalResults += matches.length;
    }

    if (totalResults === 0) {
        gridContainer.innerHTML = '<div class="nemo-model-empty"><i class="fa-solid fa-search"></i>No models found matching your search</div>';
    }
    updateResultCount(totalResults, true);
}

function onSearch(query) {
    if (!query || query.trim().length === 0) {
        renderForSource(currentSource);
        return;
    }
    renderCrossProvider(query.trim());
}

function updateResultCount(count, crossProvider = false) {
    if (!resultCount) return;
    if (count === 0) {
        resultCount.textContent = '';
    } else if (crossProvider) {
        resultCount.textContent = `${count} model${count !== 1 ? 's' : ''} across all providers`;
    } else {
        resultCount.textContent = `${count} model${count !== 1 ? 's' : ''}`;
    }
}

// --- Hide/restore model selects ---

function hideModelSelect(selectId) {
    const el = document.querySelector(selectId);
    if (!el) return;
    el.classList.add('nemo-hidden-by-selector');

    let sibling = el.nextElementSibling;
    if (sibling && sibling.classList.contains('select2-container')) {
        sibling.classList.add('nemo-hidden-by-selector');
    }

    const prev = el.previousElementSibling;
    if (prev && prev.tagName === 'H4') {
        prev.classList.add('nemo-hidden-by-selector');
    }
    hiddenSelects.add(selectId);
}

function restoreModelSelect(selectId) {
    const el = document.querySelector(selectId);
    if (!el) return;
    el.classList.remove('nemo-hidden-by-selector');

    let sibling = el.nextElementSibling;
    if (sibling && sibling.classList.contains('select2-container')) {
        sibling.classList.remove('nemo-hidden-by-selector');
    }

    const prev = el.previousElementSibling;
    if (prev && prev.tagName === 'H4') {
        prev.classList.remove('nemo-hidden-by-selector');
    }
    hiddenSelects.delete(selectId);
}

function hideAllModelSelects() {
    for (const selectId of Object.values(TC_SOURCE_TO_SELECT)) {
        hideModelSelect(selectId);
    }
}

// --- Provider tabs ---

function buildTabs() {
    const sourceSelect = /** @type {HTMLSelectElement} */ (document.getElementById('textgen_type'));
    if (!sourceSelect) return null;

    const apiContainer = document.getElementById('textgenerationwebui_api');
    if (!apiContainer) return null;

    originalDropdown = sourceSelect;

    // Hide original dropdown and label
    const label = sourceSelect.previousElementSibling;
    if (label && label.tagName === 'H4') {
        originalLabel = /** @type {HTMLElement} */ (label);
        originalLabel.classList.add('nemo-hidden-by-selector');
    }
    sourceSelect.classList.add('nemo-hidden-by-selector');

    const select2El = sourceSelect.nextElementSibling;
    if (select2El && select2El.classList.contains('select2-container')) {
        select2El.classList.add('nemo-hidden-by-selector');
    }

    // Create wrapper
    wrapperContainer = document.createElement('div');
    wrapperContainer.id = 'nemo-tc-selector-wrapper';
    wrapperContainer.style.cssText = 'display: block !important; visibility: visible !important;';

    // Create tabs
    tabContainer = document.createElement('div');
    tabContainer.className = 'nemo-provider-tabs';
    tabContainer.id = 'nemo-tc-provider-tabs';

    const options = sourceSelect.querySelectorAll('option');
    const currentValue = sourceSelect.value;

    for (const option of options) {
        if (!option.value) continue;
        const tab = document.createElement('div');
        tab.className = 'nemo-provider-tab';
        if (option.value === currentValue) tab.classList.add('active');
        // Use data-tg-provider (NOT data-tg-type) to avoid ST's showTypeSpecificControls hiding them
        tab.dataset.tgProvider = option.value;
        tab.textContent = TC_PROVIDER_NAMES[option.value] || option.textContent.trim();
        tab.title = option.textContent.trim();

        tab.addEventListener('click', () => onTabClick(option.value));
        tabContainer.appendChild(tab);
    }

    wrapperContainer.appendChild(tabContainer);

    // Build model panel
    panelContainer = document.createElement('div');
    panelContainer.className = 'nemo-connection-panel';
    panelContainer.id = 'nemo-tc-model-panel';

    // Search bar
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'nemo-model-search-wrapper';

    const searchIcon = document.createElement('i');
    searchIcon.className = 'fa-solid fa-magnifying-glass search-icon';
    searchWrapper.appendChild(searchIcon);

    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'nemo-model-search';
    searchInput.placeholder = 'Search models across all text completion providers...';
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => onSearch(searchInput.value), 200);
    });
    searchWrapper.appendChild(searchInput);
    panelContainer.appendChild(searchWrapper);

    // Result count
    resultCount = document.createElement('div');
    resultCount.className = 'nemo-model-result-count';
    panelContainer.appendChild(resultCount);

    // Grid
    gridContainer = document.createElement('div');
    gridContainer.className = 'nemo-model-grid';
    panelContainer.appendChild(gridContainer);

    wrapperContainer.appendChild(panelContainer);

    // Prepend to container
    apiContainer.prepend(wrapperContainer);

    return wrapperContainer;
}

function onTabClick(sourceValue) {
    if (!originalDropdown) return;

    if (tabContainer) {
        tabContainer.querySelectorAll('.nemo-provider-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tgProvider === sourceValue);
        });
    }

    $(originalDropdown).val(sourceValue).trigger('change');

    // After ST processes the change, update cards
    setTimeout(() => {
        hideAllModelSelects();
        renderForSource(sourceValue);
        setupRepopulationObserver();
    }, 200);
}

function syncTabs() {
    if (!tabContainer || !originalDropdown) return;
    const current = originalDropdown.value;
    tabContainer.querySelectorAll('.nemo-provider-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tgProvider === current);
    });
}

// --- Repopulation observer ---

function setupRepopulationObserver() {
    if (repopulationObserver) repopulationObserver.disconnect();

    repopulationObserver = new MutationObserver(() => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            hideAllModelSelects();
            if (searchInput && searchInput.value.trim()) {
                onSearch(searchInput.value);
            } else {
                renderForSource(currentSource);
            }
        }, 200);
    });

    for (const selectId of Object.values(TC_SOURCE_TO_SELECT)) {
        const el = document.querySelector(selectId);
        if (el) repopulationObserver.observe(el, { childList: true });
    }
}

// --- External event handler ---

function onTextgenTypeChanged() {
    const source = originalDropdown ? originalDropdown.value : '';
    if (!source) return;

    syncTabs();
    setTimeout(() => {
        hideAllModelSelects();
        renderForSource(source);
        setupRepopulationObserver();
    }, 200);
}

// --- Public API ---

export const TextCompletionSelector = {
    initialize() {
        const sourceSelect = document.getElementById('textgen_type');
        if (!sourceSelect) {
            logger.warn('TextCompletionSelector: #textgen_type not found, aborting');
            return;
        }

        const wrapper = buildTabs();
        if (!wrapper) {
            logger.warn('TextCompletionSelector: Failed to build tabs');
            return;
        }

        // Disable button
        const disableBtn = document.createElement('button');
        disableBtn.className = 'nemo-selector-disable-btn';
        disableBtn.title = 'Revert to default dropdown';
        disableBtn.innerHTML = '<i class="fa-solid fa-arrow-rotate-left"></i>';
        disableBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            extension_settings[NEMO_EXTENSION_NAME].enableModelSelector = false;
            saveSettingsDebounced();
            TextCompletionSelector.destroy();
            const toggle = document.getElementById('nemoEnableModelSelector');
            if (toggle) toggle.checked = false;
        });
        wrapper.style.position = 'relative';
        wrapper.appendChild(disableBtn);

        hideAllModelSelects();

        const currentSource = sourceSelect.value;
        renderForSource(currentSource);

        // Listen for textgen type changes
        // ST doesn't have a specific event for this, so we watch the select
        $(sourceSelect).on('change.nemoTC', onTextgenTypeChanged);

        setupRepopulationObserver();

        logger.info('TextCompletionSelector: Initialized with provider tabs + card grid');
    },

    destroy() {
        if (originalDropdown) {
            $(originalDropdown).off('change.nemoTC');
        }

        if (repopulationObserver) {
            repopulationObserver.disconnect();
            repopulationObserver = null;
        }
        clearTimeout(refreshTimer);
        clearTimeout(searchDebounce);

        for (const selectId of [...hiddenSelects]) {
            restoreModelSelect(selectId);
        }

        if (wrapperContainer) {
            wrapperContainer.remove();
            wrapperContainer = null;
        }

        if (originalDropdown) {
            originalDropdown.classList.remove('nemo-hidden-by-selector');
            const select2El = originalDropdown.nextElementSibling;
            if (select2El && select2El.classList.contains('select2-container')) {
                select2El.classList.remove('nemo-hidden-by-selector');
            }
            originalDropdown = null;
        }

        if (originalLabel) {
            originalLabel.classList.remove('nemo-hidden-by-selector');
            originalLabel = null;
        }

        tabContainer = null;
        panelContainer = null;
        gridContainer = null;
        searchInput = null;
        resultCount = null;
        currentSource = '';

        logger.info('TextCompletionSelector: Destroyed, original UI restored');
    },
};
