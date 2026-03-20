/**
 * NemoPresetExt - Model Cards
 *
 * NanoGPT-style card grid for model selection with cross-provider search.
 * Replaces model dropdowns with a rich card interface.
 */

import { getFavorites, isFavorite, toggleFavorite, pushRecent } from './model-favorites.js';
import { model_list } from '../../../../../openai.js';
import logger from '../../core/logger.js';
import { ProxyManager } from './proxy-manager.js';

/**
 * Map of provider source keys to their model select IDs.
 * @type {Record<string, string>}
 */
const SOURCE_TO_SELECT = {
    'openai': '#model_openai_select',
    'claude': '#model_claude_select',
    'makersuite': '#model_google_select',
    'vertexai': '#model_vertexai_select',
    'deepseek': '#model_deepseek_select',
    'ai21': '#model_ai21_select',
    'mistralai': '#model_mistralai_select',
    'groq': '#model_groq_select',
    'cohere': '#model_cohere_select',
    'perplexity': '#model_perplexity_select',
    'xai': '#model_xai_select',
    'custom': '#model_custom_select',
    'pollinations': '#model_pollinations_select',
    'moonshot': '#model_moonshot_select',
    'fireworks': '#model_fireworks_select',
    'zai': '#model_zai_select',
    'siliconflow': '#model_siliconflow_select',
    'cometapi': '#model_cometapi_select',
    'openrouter': '#model_openrouter_select',
    'aimlapi': '#model_aimlapi_select',
    'electronhub': '#model_electronhub_select',
    'chutes': '#model_chutes_select',
    'nanogpt': '#model_nanogpt_select',
    'azure_openai': '#azure_openai_model',
};

/** Provider display names (for cross-provider search headers) */
const PROVIDER_NAMES = {
    'openai': 'OpenAI',
    'claude': 'Claude (Anthropic)',
    'makersuite': 'Google AI Studio',
    'vertexai': 'Google Vertex AI',
    'deepseek': 'DeepSeek',
    'ai21': 'AI21',
    'mistralai': 'MistralAI',
    'groq': 'Groq',
    'cohere': 'Cohere',
    'perplexity': 'Perplexity',
    'xai': 'xAI (Grok)',
    'custom': 'Custom (OpenAI-compatible)',
    'pollinations': 'Pollinations',
    'moonshot': 'Moonshot AI',
    'fireworks': 'Fireworks AI',
    'zai': 'Z.AI (GLM)',
    'siliconflow': 'SiliconFlow',
    'cometapi': 'CometAPI',
    'openrouter': 'OpenRouter',
    'aimlapi': 'AI/ML API',
    'electronhub': 'Electron Hub',
    'chutes': 'Chutes',
    'nanogpt': 'NanoGPT',
    'azure_openai': 'Azure OpenAI',
};

/** @type {HTMLElement|null} */
let panelContainer = null;

/** @type {HTMLInputElement|null} */
let searchInput = null;

/** @type {HTMLElement|null} */
let gridContainer = null;

/** @type {HTMLElement|null} */
let resultCount = null;

/** @type {string} Current active provider source */
let currentSource = '';

/** @type {Function|null} Callback when a model is selected cross-provider */
let onCrossProviderSelect = null;

/** Debounce timer for search */
let searchDebounce = null;

/** @type {HTMLElement|null} Filter bar container */
let filterBar = null;

/** @type {HTMLElement|null} Proxy bar container (shown for 'custom' source) */
let proxyBarContainer = null;

/** @type {HTMLAnchorElement|null} Get API Key link */
let apiKeyLink = null;

/** Current filter/sort state */
let currentFilter = 'all'; // 'all' | 'free' | 'paid'
let currentSort = 'name';  // 'name' | 'price' | 'context'

/** Providers that have pricing metadata (show filter bar for these) */
const PROVIDERS_WITH_PRICING = [
    'openrouter', 'electronhub', 'chutes', 'nanogpt', 'aimlapi',
];

/** API key signup URLs for providers */
const PROVIDER_API_URLS = {
    'openai': 'https://platform.openai.com/api-keys',
    'claude': 'https://console.anthropic.com/settings/keys',
    'openrouter': 'https://openrouter.ai/keys',
    'makersuite': 'https://aistudio.google.com/apikey',
    'vertexai': 'https://console.cloud.google.com/apis/credentials',
    'deepseek': 'https://platform.deepseek.com/api_keys',
    'mistralai': 'https://console.mistral.ai/api-keys',
    'groq': 'https://console.groq.com/keys',
    'cohere': 'https://dashboard.cohere.com/api-keys',
    'perplexity': 'https://www.perplexity.ai/settings/api',
    'xai': 'https://console.x.ai/',
    'ai21': 'https://studio.ai21.com/account/api-key',
    'electronhub': 'https://www.electronhub.ai/',
    'chutes': 'https://chutes.ai/app/api-keys',
    'nanogpt': 'https://nano-gpt.com/api',
    'aimlapi': 'https://aimlapi.com/app/keys',
    'fireworks': 'https://fireworks.ai/account/api-keys',
    'siliconflow': 'https://cloud.siliconflow.cn/account/ak',
    'moonshot': 'https://platform.moonshot.cn/console/api-keys',
    'pollinations': 'https://pollinations.ai/',
    'zai': 'https://z.ai/manage-apikey/apikey-list',
};

/**
 * Get model metadata from the imported model_list.
 * @param {string} modelId
 * @returns {object|null}
 */
function getModelMeta(modelId) {
    if (Array.isArray(model_list) && model_list.length > 0) {
        return model_list.find(m => m.id === modelId) || null;
    }
    return null;
}

/**
 * Read models from a select element.
 * @param {string} selectId - CSS selector
 * @returns {Array<{value: string, text: string, group: string}>}
 */
function readModelsFromSelect(selectId) {
    const select = document.querySelector(selectId);
    if (!select) return [];

    const models = [];
    const options = select.querySelectorAll('option');

    for (const option of options) {
        if (!option.value || option.value === '' || option.textContent.includes('Connect to the API')) {
            continue;
        }

        // Get optgroup label if present
        const optgroup = option.closest('optgroup');
        const group = optgroup ? optgroup.label : '';

        models.push({
            value: option.value,
            text: option.textContent.trim(),
            group,
        });
    }

    return models;
}

/**
 * Get a short display name for a model.
 * @param {string} text - Full model text
 * @param {string} value - Model value/ID
 * @returns {string}
 */
function getDisplayName(text, value) {
    // If text is different from value, prefer text (it's usually a cleaner name)
    if (text && text !== value) return text;
    // Remove vendor prefix
    if (value.includes('/')) {
        return value.split('/').pop();
    }
    return value;
}

/**
 * Format a number as a shortened string (e.g., 128000 → "128K").
 * @param {number} n
 * @returns {string}
 */
function formatTokenCount(n) {
    if (!n || isNaN(n)) return '';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Create a single model card element.
 * @param {object} model - { value, text, group }
 * @param {string} source - Provider source key
 * @param {string} currentValue - Currently selected model value
 * @param {boolean} showProvider - Whether to show provider badge
 * @returns {HTMLElement}
 */
function createCard(model, source, currentValue, showProvider = false) {
    const card = document.createElement('div');
    card.className = 'nemo-model-card';
    if (model.value === currentValue) {
        card.classList.add('active');
    }
    card.dataset.model = model.value;
    card.dataset.provider = source;

    const displayName = getDisplayName(model.text, model.value);
    const isFav = isFavorite(source, model.value);
    const meta = getModelMeta(model.value);

    // Header: name + favorite star
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
        const newState = toggleFavorite(source, model.value);
        favStar.className = `fa-${newState ? 'solid' : 'regular'} fa-star nemo-card-fav${newState ? ' active' : ''}`;
        favStar.title = newState ? 'Remove from favorites' : 'Add to favorites';
    });

    header.appendChild(nameEl);
    header.appendChild(favStar);
    card.appendChild(header);

    // Model ID subtitle
    if (model.value !== displayName) {
        const idEl = document.createElement('div');
        idEl.className = 'nemo-card-id';
        idEl.textContent = model.value;
        idEl.title = model.value;
        card.appendChild(idEl);
    }

    // Provider badge (cross-provider search)
    if (showProvider) {
        const badge = document.createElement('span');
        badge.className = 'nemo-card-provider-badge';
        badge.textContent = PROVIDER_NAMES[source] || source;
        card.appendChild(badge);
    }

    // Stats row (context, pricing)
    const statsRow = document.createElement('div');
    statsRow.className = 'nemo-card-stats';

    const ctxLen = meta?.context_length || meta?.max_model_len || meta?.tokens;
    if (ctxLen) {
        const stat = document.createElement('span');
        stat.className = 'nemo-card-stat';
        stat.innerHTML = `<i class="fa-solid fa-database"></i> ${formatTokenCount(ctxLen)} ctx`;
        statsRow.appendChild(stat);
    }

    // Pricing (varies by provider — OpenRouter is per-token, others are per-1M tokens)
    const pricing = meta?.pricing;
    if (pricing) {
        const rawInput = pricing.prompt ?? pricing.input;
        const rawOutput = pricing.completion ?? pricing.output;
        if (rawInput !== undefined && rawOutput !== undefined) {
            const stat = document.createElement('span');
            stat.className = 'nemo-card-stat';
            const inNum = Number(rawInput);
            const outNum = Number(rawOutput);
            if (inNum === 0 && outNum === 0) {
                stat.innerHTML = '<i class="fa-solid fa-gift"></i> Free';
            } else {
                // Normalize to per-1M tokens: if values are tiny (< 0.01), they're per-token
                const scale = (inNum > 0 && inNum < 0.01) || (outNum > 0 && outNum < 0.01) ? 1000000 : 1;
                const inPrice = (inNum * scale).toFixed(2);
                const outPrice = (outNum * scale).toFixed(2);
                stat.innerHTML = `<i class="fa-solid fa-coins"></i> $${inPrice}/$${outPrice}/M`;
            }
            statsRow.appendChild(stat);
        }
    }

    if (statsRow.children.length > 0) {
        card.appendChild(statsRow);
    }

    // Capability icons
    const caps = [];
    if (meta?.metadata?.vision || meta?.input_modalities?.includes('image')) {
        caps.push({ icon: 'fa-eye', title: 'Vision' });
    }
    if (meta?.metadata?.reasoning || meta?.supported_features?.includes('reasoning')) {
        caps.push({ icon: 'fa-brain', title: 'Reasoning' });
    }
    if (meta?.metadata?.function_call || meta?.supported_features?.includes('structured_outputs')) {
        caps.push({ icon: 'fa-wrench', title: 'Tool Use' });
    }
    if (meta?.premium_model) {
        caps.push({ icon: 'fa-crown', title: 'Premium' });
    }

    if (caps.length > 0) {
        const capsRow = document.createElement('div');
        capsRow.className = 'nemo-card-capabilities';
        for (const cap of caps) {
            const icon = document.createElement('i');
            icon.className = `fa-solid ${cap.icon} nemo-card-cap-icon`;
            icon.title = cap.title;
            capsRow.appendChild(icon);
        }
        card.appendChild(capsRow);
    }

    // Info toggle button
    const hasInfoData = ctxLen || pricing || model.group || meta?.name;
    if (hasInfoData) {
        const infoBtn = document.createElement('button');
        infoBtn.className = 'nemo-card-info-toggle';
        infoBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Info';
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = card.querySelector('.nemo-card-info-panel');
            if (panel) {
                const isOpen = panel.classList.toggle('open');
                infoBtn.classList.toggle('open', isOpen);
            }
        });
        card.appendChild(infoBtn);

        // Info panel (hidden by default)
        const infoPanel = document.createElement('div');
        infoPanel.className = 'nemo-card-info-panel';

        const addInfoRow = (label, value) => {
            if (!value) return;
            const row = document.createElement('div');
            row.className = 'nemo-card-info-row';
            row.innerHTML = `<span class="nemo-card-info-label">${escapeHtml(label)}</span><span class="nemo-card-info-value">${escapeHtml(value)}</span>`;
            infoPanel.appendChild(row);
        };

        addInfoRow('Model ID', model.value);
        if (meta?.name && meta.name !== displayName) addInfoRow('Full Name', meta.name);
        if (model.group) addInfoRow('Group', model.group);
        if (ctxLen) addInfoRow('Context', formatTokenCount(ctxLen) + ' tokens');
        if (pricing) {
            const inp = Number(pricing.prompt ?? pricing.input ?? 0);
            const out = Number(pricing.completion ?? pricing.output ?? 0);
            // Normalize: if values are tiny (< 0.01), they're per-token — convert to per-1M
            const scale = (inp > 0 && inp < 0.01) || (out > 0 && out < 0.01) ? 1000000 : 1;
            if (inp !== undefined) addInfoRow('Input Price', `$${(inp * scale).toFixed(2)} / 1M tokens`);
            if (out !== undefined) addInfoRow('Output Price', `$${(out * scale).toFixed(2)} / 1M tokens`);
        }
        if (showProvider) addInfoRow('Provider', PROVIDER_NAMES[source] || source);

        card.appendChild(infoPanel);
    }

    // Click to select model
    card.addEventListener('click', () => {
        selectModel(source, model.value);
    });

    return card;
}

/**
 * Select a model — set the hidden select value and trigger change.
 * @param {string} source - Provider source key
 * @param {string} modelValue - Model value
 */
function selectModel(source, modelValue) {
    // If different provider, switch provider first
    if (source !== currentSource && onCrossProviderSelect) {
        onCrossProviderSelect(source, modelValue);
        return;
    }

    const selectId = SOURCE_TO_SELECT[source];
    if (!selectId) return;

    const $select = $(selectId);
    if (!$select.length) return;

    $select.val(modelValue).trigger('change');
    pushRecent(source, modelValue);

    // Update active card
    if (gridContainer) {
        gridContainer.querySelectorAll('.nemo-model-card').forEach(card => {
            card.classList.toggle('active', card.dataset.model === modelValue && card.dataset.provider === source);
        });
    }
}

/**
 * Render model cards for the current provider.
 * @param {string} source - Provider source key
 */
function renderForSource(source) {
    if (!gridContainer) return;

    currentSource = source;
    const hasPricing = PROVIDERS_WITH_PRICING.includes(source);

    // Show/hide proxy bar (only for 'custom' source)
    if (proxyBarContainer) {
        proxyBarContainer.style.display = source === 'custom' ? 'block' : 'none';
        if (source === 'custom') {
            ProxyManager.refresh();
        }
    }

    // Show/hide filter bar
    if (filterBar) {
        filterBar.style.display = hasPricing ? 'flex' : 'none';
    }

    // Show/hide Get API Key link
    if (apiKeyLink) {
        const url = PROVIDER_API_URLS[source];
        if (url) {
            apiKeyLink.href = url;
            apiKeyLink.style.display = 'inline-flex';
        } else {
            apiKeyLink.style.display = 'none';
        }
    }

    const selectId = SOURCE_TO_SELECT[source];
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

    // Apply pricing filter (only for providers with pricing data)
    if (hasPricing && currentFilter !== 'all') {
        models = models.filter(m => {
            const meta = getModelMeta(m.value);
            const pricing = meta?.pricing;
            if (!pricing) return currentFilter === 'paid'; // No pricing info = assume paid
            const inputPrice = pricing.prompt ?? pricing.input ?? 0;
            const outputPrice = pricing.completion ?? pricing.output ?? 0;
            const isFree = Number(inputPrice) === 0 && Number(outputPrice) === 0;
            return currentFilter === 'free' ? isFree : !isFree;
        });
    }

    // Sort
    const favorites = getFavorites(source);
    const sorted = [...models].sort((a, b) => {
        // Favorites always first
        const aFav = favorites.includes(a.value);
        const bFav = favorites.includes(b.value);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;

        // Then apply selected sort
        if (hasPricing && currentSort !== 'name') {
            const aMeta = getModelMeta(a.value);
            const bMeta = getModelMeta(b.value);

            if (currentSort === 'price-asc' || currentSort === 'price-desc') {
                const aRaw = Number(aMeta?.pricing?.prompt ?? aMeta?.pricing?.input ?? 999);
                const bRaw = Number(bMeta?.pricing?.prompt ?? bMeta?.pricing?.input ?? 999);
                // Normalize: per-token values (< 0.01) scaled to per-1M for consistent comparison
                const aPrice = (aRaw > 0 && aRaw < 0.01) ? aRaw * 1000000 : aRaw;
                const bPrice = (bRaw > 0 && bRaw < 0.01) ? bRaw * 1000000 : bRaw;
                return currentSort === 'price-asc' ? aPrice - bPrice : bPrice - aPrice;
            }

            if (currentSort === 'context') {
                const aCtx = aMeta?.context_length || aMeta?.max_model_len || aMeta?.tokens || 0;
                const bCtx = bMeta?.context_length || bMeta?.max_model_len || bMeta?.tokens || 0;
                return bCtx - aCtx; // Descending
            }
        }

        return a.text.localeCompare(b.text);
    });

    gridContainer.innerHTML = '';

    if (sorted.length === 0) {
        gridContainer.innerHTML = `<div class="nemo-model-empty"><i class="fa-solid fa-filter-circle-xmark"></i>No ${currentFilter} models found</div>`;
        updateResultCount(0);
        return;
    }

    for (const model of sorted) {
        gridContainer.appendChild(createCard(model, source, currentValue));
    }

    updateResultCount(sorted.length);
}

/**
 * Render cross-provider search results.
 * @param {string} query - Search query
 */
function renderCrossProvider(query) {
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    const lowerQuery = query.toLowerCase();
    let totalResults = 0;

    for (const [source, selectId] of Object.entries(SOURCE_TO_SELECT)) {
        const models = readModelsFromSelect(selectId);
        const matches = models.filter(m =>
            m.text.toLowerCase().includes(lowerQuery) ||
            m.value.toLowerCase().includes(lowerQuery),
        );

        if (matches.length === 0) continue;

        // Provider group header
        const header = document.createElement('div');
        header.className = 'nemo-provider-group-header';
        header.innerHTML = `<i class="fa-solid fa-server"></i> ${escapeHtml(PROVIDER_NAMES[source] || source)} <span style="opacity:0.6">(${matches.length})</span>`;
        gridContainer.appendChild(header);

        // Get current value for this provider's select
        const $select = $(selectId);
        const currentValue = String($select.val() || '');

        for (const model of matches.slice(0, 20)) { // Limit per provider
            gridContainer.appendChild(createCard(model, source, currentValue, true));
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

/**
 * Handle search input.
 * @param {string} query
 */
function onSearch(query) {
    if (!query || query.trim().length === 0) {
        // No search — show current provider models
        renderForSource(currentSource);
        return;
    }

    // Cross-provider search
    renderCrossProvider(query.trim());
}

/**
 * Update the result count display.
 * @param {number} count
 * @param {boolean} crossProvider
 */
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

/**
 * Build the model panel (search bar + grid).
 * @returns {HTMLElement}
 */
function buildPanel() {
    panelContainer = document.createElement('div');
    panelContainer.className = 'nemo-connection-panel';
    panelContainer.id = 'nemo-model-panel';

    // Search bar
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'nemo-model-search-wrapper';

    const searchIcon = document.createElement('i');
    searchIcon.className = 'fa-solid fa-magnifying-glass search-icon';
    searchWrapper.appendChild(searchIcon);

    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'nemo-model-search';
    searchInput.placeholder = 'Search models across all providers...';
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            onSearch(searchInput.value);
        }, 200);
    });
    searchWrapper.appendChild(searchInput);
    panelContainer.appendChild(searchWrapper);

    // Proxy manager bar (shown only for 'custom' source)
    proxyBarContainer = document.createElement('div');
    proxyBarContainer.id = 'nemo-proxy-bar-container';
    proxyBarContainer.style.display = 'none';
    panelContainer.appendChild(proxyBarContainer);
    ProxyManager.initialize(proxyBarContainer);

    // Get API Key link
    apiKeyLink = document.createElement('a');
    apiKeyLink.className = 'nemo-get-api-key';
    apiKeyLink.target = '_blank';
    apiKeyLink.rel = 'noopener noreferrer';
    apiKeyLink.innerHTML = '<i class="fa-solid fa-key"></i> Get API Key';
    apiKeyLink.style.display = 'none';
    panelContainer.appendChild(apiKeyLink);

    // Filter/Sort bar (hidden by default, shown for providers with pricing)
    filterBar = document.createElement('div');
    filterBar.className = 'nemo-model-filter-bar';
    filterBar.style.display = 'none';
    filterBar.innerHTML = `
        <div class="nemo-filter-group">
            <button class="nemo-filter-btn active" data-filter="all">All</button>
            <button class="nemo-filter-btn" data-filter="free"><i class="fa-solid fa-gift"></i> Free</button>
            <button class="nemo-filter-btn" data-filter="paid"><i class="fa-solid fa-coins"></i> Paid</button>
        </div>
        <div class="nemo-sort-group">
            <select class="nemo-sort-select">
                <option value="name">Sort: Name</option>
                <option value="price-asc">Sort: Price ↑</option>
                <option value="price-desc">Sort: Price ↓</option>
                <option value="context">Sort: Context ↓</option>
            </select>
        </div>
    `;

    // Filter button click handlers
    filterBar.querySelectorAll('.nemo-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            filterBar.querySelectorAll('.nemo-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderForSource(currentSource);
        });
    });

    // Sort select handler
    const sortSelect = filterBar.querySelector('.nemo-sort-select');
    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        renderForSource(currentSource);
    });

    panelContainer.appendChild(filterBar);

    // Result count
    resultCount = document.createElement('div');
    resultCount.className = 'nemo-model-result-count';
    panelContainer.appendChild(resultCount);

    // Grid
    gridContainer = document.createElement('div');
    gridContainer.className = 'nemo-model-grid';
    panelContainer.appendChild(gridContainer);

    return panelContainer;
}

export const ModelCards = {
    /**
     * Initialize the model cards panel.
     * @param {HTMLElement} wrapperEl - Wrapper container to append the panel into
     * @param {Function} crossProviderSelectCb - Callback(source, modelValue) for cross-provider selection
     * @returns {HTMLElement} The panel container
     */
    initialize(wrapperEl, crossProviderSelectCb) {
        onCrossProviderSelect = crossProviderSelectCb;
        const panel = buildPanel();
        wrapperEl.appendChild(panel);
        logger.debug('ModelCards: Panel built');
        return panel;
    },

    /**
     * Show models for a specific provider.
     * @param {string} source - Provider source key
     */
    showForSource(source) {
        // Clear search when switching providers
        if (searchInput) searchInput.value = '';
        // Reset filter to 'all' when switching providers
        currentFilter = 'all';
        if (filterBar) {
            filterBar.querySelectorAll('.nemo-filter-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.filter === 'all'),
            );
            const sortSelect = filterBar.querySelector('.nemo-sort-select');
            if (sortSelect) sortSelect.value = 'name';
            currentSort = 'name';
        }
        renderForSource(source);
    },

    /**
     * Refresh the current view (e.g., after model list repopulation).
     */
    refresh() {
        if (searchInput && searchInput.value.trim()) {
            onSearch(searchInput.value);
        } else {
            renderForSource(currentSource);
        }
    },

    /**
     * Get the select ID for a given source.
     * @param {string} source
     * @returns {string|undefined}
     */
    getSelectId(source) {
        return SOURCE_TO_SELECT[source];
    },

    /**
     * Get all source-to-select mappings.
     * @returns {Record<string, string>}
     */
    getAllSelects() {
        return { ...SOURCE_TO_SELECT };
    },

    /**
     * Destroy the panel.
     */
    destroy() {
        ProxyManager.destroy();
        if (panelContainer) {
            panelContainer.remove();
            panelContainer = null;
        }
        searchInput = null;
        gridContainer = null;
        resultCount = null;
        proxyBarContainer = null;
        currentSource = '';
        onCrossProviderSelect = null;
        clearTimeout(searchDebounce);
    },
};
