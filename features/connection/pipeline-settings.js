/**
 * NemoPresetExt - Pipeline Settings UI (Nemo Stack)
 *
 * Provides a settings panel inside the connection panel for configuring
 * the model pipeline presets (recall, analysis, drafters, consolidation).
 */

import { ConnectionPool } from './connection-pool.js';
import { PipelinePresets } from './pipeline-presets.js';
import { PipelinePrompts } from './pipeline-prompts.js';
import { ModelPipeline } from './model-pipeline.js';
import logger from '../../core/logger.js';

const log = logger.module('PipelineSettings');

const MAX_DRAFTERS = 8;
const DRAFTER_LABELS = 'ABCDEFGH';

/** @type {Record<string, string>} */
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

/** @type {Record<string, string>} */
const PROVIDER_NAMES = {
    'openai': 'OpenAI', 'claude': 'Claude', 'makersuite': 'Google AI Studio',
    'vertexai': 'Vertex AI', 'deepseek': 'DeepSeek', 'ai21': 'AI21',
    'mistralai': 'MistralAI', 'groq': 'Groq', 'cohere': 'Cohere',
    'perplexity': 'Perplexity', 'xai': 'xAI', 'custom': 'Custom/Proxy',
    'pollinations': 'Pollinations', 'moonshot': 'Moonshot', 'fireworks': 'Fireworks',
    'zai': 'Z.AI', 'siliconflow': 'SiliconFlow', 'cometapi': 'CometAPI',
    'openrouter': 'OpenRouter', 'aimlapi': 'AI/ML API', 'electronhub': 'Electron Hub',
    'chutes': 'Chutes', 'nanogpt': 'NanoGPT', 'azure_openai': 'Azure OpenAI',
};

/** @type {HTMLElement|null} */
let btnEl = null;

/** @type {HTMLElement|null} */
let panelEl = null;

/** @type {string|null} Current preset id being edited */
let currentPresetId = null;

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Format a source::model value for display.
 * @param {string} value - e.g., "openrouter::google/gemma-3-27b-it:free"
 * @returns {string} e.g., "google/gemma-3-27b-it:free (OpenRouter)"
 */
function formatDisplayValue(value) {
    if (!value || !value.includes('::')) return value || '(none)';
    const [source, model] = value.split('::', 2);
    const providerName = PROVIDER_NAMES[source] || source;
    return `${model} (${providerName})`;
}

/**
 * Render filtered model options into the dropdown.
 * @param {HTMLElement} dropdown
 * @param {string} query - Filter text
 * @param {HTMLElement} container - Parent picker container
 */
function renderDropdown(dropdown, query, container) {
    dropdown.innerHTML = '';
    const lowerQuery = query.toLowerCase();
    let totalResults = 0;

    // Saved Connections from ConnectionPool
    const connections = ConnectionPool.getAll();
    if (connections.length > 0) {
        const matches = [];
        for (const conn of connections) {
            const display = `${conn.label} (${conn.source}/${conn.model})`;
            if (!query || display.toLowerCase().includes(lowerQuery)) {
                matches.push({ text: display, value: conn.id });
            }
        }
        if (matches.length > 0) {
            const header = document.createElement('div');
            header.className = 'nemo-stack-picker-group';
            header.textContent = 'Saved Connections';
            dropdown.appendChild(header);

            for (const match of matches) {
                const item = document.createElement('div');
                item.className = 'nemo-stack-picker-item';
                if (container.dataset.value === match.value) {
                    item.classList.add('selected');
                }
                item.textContent = match.text;
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    container.dataset.value = match.value;
                    const input = container.querySelector('.nemo-stack-model-picker-input');
                    if (input) /** @type {HTMLInputElement} */ (input).value = match.text;
                    dropdown.classList.remove('open');
                });
                dropdown.appendChild(item);
                totalResults++;
            }
        }
    }

    for (const [source, selectId] of Object.entries(SOURCE_TO_SELECT)) {
        const select = document.querySelector(selectId);
        if (!select) continue;

        const options = select.querySelectorAll('option');
        const matches = [];

        for (const option of options) {
            if (!option.value || (option.textContent || '').toLowerCase().includes('connect to the api')) continue;
            const text = (option.textContent || '').trim();
            if (!text) continue;
            const value = option.value;

            if (!query || text.toLowerCase().includes(lowerQuery) || value.toLowerCase().includes(lowerQuery) || (PROVIDER_NAMES[source] || '').toLowerCase().includes(lowerQuery)) {
                matches.push({ text, value, source });
            }
        }

        if (matches.length === 0) continue;

        // Provider group header
        const header = document.createElement('div');
        header.className = 'nemo-stack-picker-group';
        header.textContent = PROVIDER_NAMES[source] || source;
        dropdown.appendChild(header);

        // Model options (limit per provider when no search query)
        const limit = query ? 30 : 15;
        for (const match of matches.slice(0, limit)) {
            const item = document.createElement('div');
            item.className = 'nemo-stack-picker-item';
            const fullValue = `${match.source}::${match.value}`;
            if (container.dataset.value === fullValue) {
                item.classList.add('selected');
            }
            item.textContent = match.text;
            item.title = `${match.value} (${PROVIDER_NAMES[match.source] || match.source})`;

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                container.dataset.value = fullValue;
                const input = container.querySelector('.nemo-stack-model-picker-input');
                if (input) /** @type {HTMLInputElement} */ (input).value = formatDisplayValue(fullValue);
                dropdown.classList.remove('open');
            });

            dropdown.appendChild(item);
            totalResults++;
        }

        if (matches.length > limit) {
            const more = document.createElement('div');
            more.className = 'nemo-stack-picker-more';
            more.textContent = `...${matches.length - limit} more (type to filter)`;
            dropdown.appendChild(more);
        }
    }

    if (totalResults === 0) {
        const empty = document.createElement('div');
        empty.className = 'nemo-stack-picker-empty';
        empty.textContent = query ? 'No models match your search' : 'No models available';
        dropdown.appendChild(empty);
    }
}

/**
 * Create a searchable model picker widget.
 * @param {string} currentValue - Current source::model value (or empty)
 * @param {string} fieldName - Field identifier for data attributes
 * @returns {HTMLElement} The picker container element
 */
function createModelPicker(currentValue, fieldName) {
    const container = document.createElement('div');
    container.className = 'nemo-stack-model-picker';
    container.dataset.field = fieldName;
    container.dataset.value = currentValue || '';

    // Display input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'nemo-stack-model-picker-input';
    input.placeholder = 'Search models...';
    input.value = currentValue ? formatDisplayValue(currentValue) : '';

    // Dropdown panel
    const dropdown = document.createElement('div');
    dropdown.className = 'nemo-stack-model-picker-dropdown';

    // On focus: show dropdown with all models
    input.addEventListener('focus', () => {
        input.select();
        renderDropdown(dropdown, '', container);
        dropdown.classList.add('open');
    });

    // On input: filter models
    input.addEventListener('input', () => {
        renderDropdown(dropdown, input.value.trim(), container);
        if (!dropdown.classList.contains('open')) {
            dropdown.classList.add('open');
        }
    });

    // Close on escape
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdown.classList.remove('open');
            input.blur();
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!container.contains(/** @type {Node} */ (e.target))) {
            dropdown.classList.remove('open');
            // Restore display value if user didn't select
            input.value = container.dataset.value ? formatDisplayValue(container.dataset.value) : '';
        }
    });

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'nemo-stack-model-picker-clear';
    clearBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    clearBtn.title = 'Clear selection';
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        container.dataset.value = '';
        input.value = '';
        dropdown.classList.remove('open');
    });

    container.appendChild(input);
    container.appendChild(clearBtn);
    container.appendChild(dropdown);

    return container;
}

/**
 * Minimal HTML escaping for display strings.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Create model-select + temperature + max_tokens field rows as a DocumentFragment.
 * @param {string} labelText
 * @param {string} prefix - data attribute prefix (e.g. 'recall', 'analysis')
 * @param {object} values - { connectionId, temperature, max_tokens }
 * @returns {DocumentFragment}
 */
function buildStageFields(labelText, prefix, values) {
    const frag = document.createDocumentFragment();

    // Model picker row
    const modelRow = document.createElement('div');
    modelRow.className = 'nemo-stack-field-row';
    const modelLabel = document.createElement('label');
    modelLabel.textContent = `${labelText} Model`;
    modelRow.appendChild(modelLabel);
    const picker = createModelPicker(values.connectionId || '', 'connectionId');
    picker.dataset.stage = prefix;
    modelRow.appendChild(picker);
    frag.appendChild(modelRow);

    // Temperature row
    const tempRow = document.createElement('div');
    tempRow.className = 'nemo-stack-field-row';
    const tempLabel = document.createElement('label');
    tempLabel.textContent = 'Temperature';
    tempRow.appendChild(tempLabel);
    const tempInput = document.createElement('input');
    tempInput.type = 'number';
    tempInput.className = 'nemo-stack-input';
    tempInput.dataset.stage = prefix;
    tempInput.dataset.field = 'temperature';
    tempInput.value = String(values.temperature);
    tempInput.min = '0';
    tempInput.max = '2';
    tempInput.step = '0.1';
    tempRow.appendChild(tempInput);
    frag.appendChild(tempRow);

    // Max tokens row
    const tokensRow = document.createElement('div');
    tokensRow.className = 'nemo-stack-field-row';
    const tokensLabel = document.createElement('label');
    tokensLabel.textContent = 'Max Tokens';
    tokensRow.appendChild(tokensLabel);
    const tokensInput = document.createElement('input');
    tokensInput.type = 'number';
    tokensInput.className = 'nemo-stack-input';
    tokensInput.dataset.stage = prefix;
    tokensInput.dataset.field = 'max_tokens';
    tokensInput.value = String(values.max_tokens);
    tokensInput.min = '100';
    tokensInput.max = '32000';
    tokensInput.step = '100';
    tokensRow.appendChild(tokensInput);
    frag.appendChild(tokensRow);

    return frag;
}

/**
 * Build a single drafter row as a DOM element.
 * @param {number} index
 * @param {object} drafter - { connectionId, temperature, max_tokens }
 * @returns {HTMLElement}
 */
function buildDrafterRow(index, drafter) {
    const label = DRAFTER_LABELS[index] || String(index + 1);

    const row = document.createElement('div');
    row.className = 'nemo-stack-drafter-row';
    row.dataset.index = String(index);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'nemo-stack-drafter-label';
    labelSpan.textContent = label;
    row.appendChild(labelSpan);

    const picker = createModelPicker(drafter.connectionId || '', 'connectionId');
    row.appendChild(picker);

    const tempInput = document.createElement('input');
    tempInput.type = 'number';
    tempInput.className = 'nemo-stack-input';
    tempInput.dataset.field = 'temperature';
    tempInput.value = String(drafter.temperature);
    tempInput.min = '0';
    tempInput.max = '2';
    tempInput.step = '0.1';
    row.appendChild(tempInput);

    const tokensInput = document.createElement('input');
    tokensInput.type = 'number';
    tokensInput.className = 'nemo-stack-input';
    tokensInput.dataset.field = 'max_tokens';
    tokensInput.value = String(drafter.max_tokens);
    tokensInput.min = '100';
    tokensInput.max = '32000';
    tokensInput.step = '100';
    row.appendChild(tokensInput);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'nemo-stack-remove-btn';
    removeBtn.title = 'Remove drafter';
    removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    row.appendChild(removeBtn);

    return row;
}

// ─── Panel Rendering ────────────────────────────────────────────

/**
 * Build the full panel DOM for the given preset.
 * @param {object} preset
 * @returns {DocumentFragment}
 */
function buildPanelDom(preset) {
    const frag = document.createDocumentFragment();
    const allPresets = PipelinePresets.getAll();
    const isDefault = preset.id === 'nemo-stack' || preset.id === 'nemo-stack-flash';

    // Prompt texts (read-only display)
    const recallPromptPreview = PipelinePrompts.buildRecallMessages('(system prompt)', [{ role: 'user', content: '(conversation)' }])[0]?.content || '';
    const analysisPromptPreview = PipelinePrompts.buildAnalysisMessages('(system prompt)', [{ role: 'user', content: '(conversation)' }])[0]?.content || '';
    const drafterRulesPreview = PipelinePrompts.getDrafterRules('{{user}}');
    const antiSlopPreview = PipelinePrompts.getAntiSlopRules();

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'nemo-stack-header';
    const presetSelect = document.createElement('select');
    presetSelect.id = 'nemo-stack-preset-select';
    for (const [id, p] of Object.entries(allPresets)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = p.name || id;
        if (id === preset.id) opt.selected = true;
        presetSelect.appendChild(opt);
    }
    header.appendChild(presetSelect);
    header.insertAdjacentHTML('beforeend', `
        <button class="nemo-stack-header-btn" id="nemo-stack-clone-btn" title="Clone current preset">New Preset</button>
        <button class="nemo-stack-header-btn danger" id="nemo-stack-delete-btn" title="Delete custom preset"
                ${isDefault ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}>Delete</button>
        <button class="nemo-stack-header-btn close-btn" id="nemo-stack-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>
    `);
    frag.appendChild(header);

    // ── Stage 1: Recall + Analysis ──
    const section1 = document.createElement('div');
    section1.className = 'nemo-stack-section';
    section1.dataset.section = 'recall';
    section1.innerHTML = `
        <div class="nemo-stack-section-header">
            <i class="fa-solid fa-chevron-right"></i>
            <span>Stage 1: Recall + Analysis</span>
        </div>`;
    const content1 = document.createElement('div');
    content1.className = 'nemo-stack-section-content';
    content1.appendChild(buildStageFields('Recall', 'recall', preset.recall));
    const hr = document.createElement('hr');
    hr.style.borderColor = 'var(--SmartThemeBorderColor)';
    hr.style.margin = '6px 0';
    content1.appendChild(hr);
    content1.appendChild(buildStageFields('Analysis', 'analysis', preset.analysis));
    content1.insertAdjacentHTML('beforeend', `
        <button class="nemo-stack-prompt-toggle" data-target="recall-prompt">
            <i class="fa-solid fa-eye"></i> Recall Prompt
        </button>
        <textarea class="nemo-stack-prompt-area" id="nemo-stack-recall-prompt" readonly>${escapeHtml(recallPromptPreview)}</textarea>
        <button class="nemo-stack-prompt-toggle" data-target="analysis-prompt">
            <i class="fa-solid fa-eye"></i> Analysis Prompt
        </button>
        <textarea class="nemo-stack-prompt-area" id="nemo-stack-analysis-prompt" readonly>${escapeHtml(analysisPromptPreview)}</textarea>
    `);
    section1.appendChild(content1);
    frag.appendChild(section1);

    // ── Stage 2: Drafters ──
    const section2 = document.createElement('div');
    section2.className = 'nemo-stack-section';
    section2.dataset.section = 'drafters';
    section2.innerHTML = `
        <div class="nemo-stack-section-header">
            <i class="fa-solid fa-chevron-right"></i>
            <span>Stage 2: Drafters (${preset.drafters.length})</span>
        </div>`;
    const content2 = document.createElement('div');
    content2.className = 'nemo-stack-section-content';
    const draftersList = document.createElement('div');
    draftersList.className = 'nemo-stack-drafters-list';
    draftersList.id = 'nemo-stack-drafters-list';
    for (let i = 0; i < preset.drafters.length; i++) {
        draftersList.appendChild(buildDrafterRow(i, preset.drafters[i]));
    }
    content2.appendChild(draftersList);
    content2.insertAdjacentHTML('beforeend', `
        <button class="nemo-stack-add-drafter-btn" id="nemo-stack-add-drafter"
                ${preset.drafters.length >= MAX_DRAFTERS ? 'disabled style="opacity:0.4"' : ''}>
            <i class="fa-solid fa-plus"></i> Add Drafter
        </button>
        <button class="nemo-stack-prompt-toggle" data-target="drafter-rules">
            <i class="fa-solid fa-eye"></i> Drafter Rules
        </button>
        <textarea class="nemo-stack-prompt-area" id="nemo-stack-drafter-rules" readonly>${escapeHtml(drafterRulesPreview)}</textarea>
    `);
    section2.appendChild(content2);
    frag.appendChild(section2);

    // ── Stage 3: Consolidation ──
    const section3 = document.createElement('div');
    section3.className = 'nemo-stack-section';
    section3.dataset.section = 'consolidation';
    section3.innerHTML = `
        <div class="nemo-stack-section-header">
            <i class="fa-solid fa-chevron-right"></i>
            <span>Stage 3: Consolidation</span>
        </div>`;
    const content3 = document.createElement('div');
    content3.className = 'nemo-stack-section-content';
    content3.appendChild(buildStageFields('Consolidator', 'consolidator', preset.consolidator));
    content3.insertAdjacentHTML('beforeend', `
        <button class="nemo-stack-prompt-toggle" data-target="anti-slop">
            <i class="fa-solid fa-eye"></i> Anti-Slop Rules
        </button>
        <textarea class="nemo-stack-prompt-area" id="nemo-stack-anti-slop" readonly>${escapeHtml(antiSlopPreview)}</textarea>
    `);
    section3.appendChild(content3);
    frag.appendChild(section3);

    // ── Footer ──
    const footerHtml = `
        <div class="nemo-stack-footer">
            <button class="nemo-stack-footer-btn primary" id="nemo-stack-save-btn">Save</button>
            <button class="nemo-stack-footer-btn" id="nemo-stack-validate-btn">Validate</button>
            <button class="nemo-stack-footer-btn" id="nemo-stack-test-btn">Test Pipeline</button>
        </div>
        <div class="nemo-stack-validation" id="nemo-stack-validation"></div>
        <div class="nemo-stack-test-results" id="nemo-stack-test-results"></div>
    `;
    const footerWrapper = document.createElement('div');
    footerWrapper.innerHTML = footerHtml;
    while (footerWrapper.firstChild) {
        frag.appendChild(footerWrapper.firstChild);
    }

    return frag;
}

// ─── Event Binding ──────────────────────────────────────────────

/**
 * Bind all interactive events inside the panel.
 */
function bindPanelEvents() {
    if (!panelEl) return;

    // Close button
    panelEl.querySelector('#nemo-stack-close-btn')?.addEventListener('click', () => {
        PipelineSettingsUI.toggle();
    });

    // Preset selector change
    panelEl.querySelector('#nemo-stack-preset-select')?.addEventListener('change', (e) => {
        const newId = /** @type {HTMLSelectElement} */ (e.target).value;
        loadPreset(newId);
    });

    // Clone preset
    panelEl.querySelector('#nemo-stack-clone-btn')?.addEventListener('click', () => {
        cloneCurrentPreset();
    });

    // Delete preset
    panelEl.querySelector('#nemo-stack-delete-btn')?.addEventListener('click', () => {
        deleteCurrentPreset();
    });

    // Section headers (collapse/expand)
    panelEl.querySelectorAll('.nemo-stack-section-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.closest('.nemo-stack-section');
            if (section) section.classList.toggle('open');
        });
    });

    // Prompt toggle buttons
    panelEl.querySelectorAll('.nemo-stack-prompt-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const textarea = panelEl.querySelector(`#nemo-stack-${targetId}`);
            if (textarea) textarea.classList.toggle('open');
        });
    });

    // Add drafter
    panelEl.querySelector('#nemo-stack-add-drafter')?.addEventListener('click', () => {
        addDrafter();
    });

    // Remove drafter (delegated)
    panelEl.querySelector('#nemo-stack-drafters-list')?.addEventListener('click', (e) => {
        const removeBtn = /** @type {HTMLElement} */ (e.target).closest('.nemo-stack-remove-btn');
        if (removeBtn) {
            const row = removeBtn.closest('.nemo-stack-drafter-row');
            if (row) removeDrafter(parseInt(row.dataset.index, 10));
        }
    });

    // Save
    panelEl.querySelector('#nemo-stack-save-btn')?.addEventListener('click', () => {
        saveCurrentPreset();
    });

    // Validate
    panelEl.querySelector('#nemo-stack-validate-btn')?.addEventListener('click', () => {
        validateCurrentPreset();
    });

    // Test pipeline
    panelEl.querySelector('#nemo-stack-test-btn')?.addEventListener('click', () => {
        testPipeline();
    });
}

// ─── Preset Actions ─────────────────────────────────────────────

/**
 * Load a preset into the panel.
 * @param {string} presetId
 */
function loadPreset(presetId) {
    const preset = PipelinePresets.get(presetId);
    if (!preset) {
        log.warn(`Preset not found: ${presetId}`);
        return;
    }
    currentPresetId = presetId;
    PipelinePresets.setActive(presetId);
    renderPanel(preset);
}

/**
 * Re-render the panel contents for a preset.
 * @param {object} preset
 */
function renderPanel(preset) {
    if (!panelEl) return;
    panelEl.innerHTML = '';
    panelEl.appendChild(buildPanelDom(preset));
    bindPanelEvents();
}

/**
 * Clone the current preset with a new name.
 */
function cloneCurrentPreset() {
    if (!currentPresetId) return;
    const timestamp = Date.now().toString(36);
    const newId = `custom-${timestamp}`;
    const newName = prompt('Enter a name for the new preset:', `Custom (${new Date().toLocaleDateString()})`);
    if (!newName) return;

    try {
        const cloned = PipelinePresets.clone(currentPresetId, newId, newName);
        PipelinePresets.save(cloned);
        loadPreset(newId);
        log.info(`Cloned preset ${currentPresetId} -> ${newId}`);
    } catch (err) {
        log.error('Failed to clone preset', err);
    }
}

/**
 * Delete the current custom preset.
 */
function deleteCurrentPreset() {
    if (!currentPresetId) return;
    if (currentPresetId === 'nemo-stack' || currentPresetId === 'nemo-stack-flash') return;

    if (!confirm(`Delete preset "${currentPresetId}"?`)) return;

    try {
        PipelinePresets.delete(currentPresetId);
        loadPreset('nemo-stack');
        log.info(`Deleted preset: ${currentPresetId}`);
    } catch (err) {
        log.error('Failed to delete preset', err);
    }
}

// ─── Drafter Management ─────────────────────────────────────────

/**
 * Read current drafter state from the DOM.
 * @returns {Array<{connectionId: string|null, temperature: number, max_tokens: number}>}
 */
function readDraftersFromDom() {
    if (!panelEl) return [];
    const rows = panelEl.querySelectorAll('.nemo-stack-drafter-row');
    const drafters = [];
    rows.forEach((row, i) => {
        const picker = /** @type {HTMLElement|null} */ (row.querySelector('.nemo-stack-model-picker'));
        const tempInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-field="temperature"]'));
        const tokensInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-field="max_tokens"]'));
        drafters.push({
            connectionId: picker?.dataset.value || null,
            label: DRAFTER_LABELS[i] || String(i + 1),
            temperature: parseFloat(tempInput?.value) || 0.8,
            max_tokens: parseInt(tokensInput?.value, 10) || 4096,
        });
    });
    return drafters;
}

/**
 * Add a new empty drafter slot.
 */
function addDrafter() {
    const drafters = readDraftersFromDom();
    if (drafters.length >= MAX_DRAFTERS) return;

    drafters.push({ connectionId: null, label: '', temperature: 0.8, max_tokens: 4096 });
    rebuildDraftersList(drafters);
}

/**
 * Remove a drafter by index and re-label.
 * @param {number} index
 */
function removeDrafter(index) {
    const drafters = readDraftersFromDom();
    if (drafters.length <= 1) return; // minimum 1
    drafters.splice(index, 1);
    rebuildDraftersList(drafters);
}

/**
 * Rebuild the drafter list DOM from an array.
 * @param {Array} drafters
 */
function rebuildDraftersList(drafters) {
    const listEl = panelEl?.querySelector('#nemo-stack-drafters-list');
    if (!listEl) return;

    // Re-label and rebuild DOM
    listEl.innerHTML = '';
    for (let i = 0; i < drafters.length; i++) {
        drafters[i].label = DRAFTER_LABELS[i] || String(i + 1);
        listEl.appendChild(buildDrafterRow(i, drafters[i]));
    }

    // Re-bind remove buttons via delegation (already bound on parent)

    // Update add button state
    const addBtn = panelEl?.querySelector('#nemo-stack-add-drafter');
    if (addBtn) {
        if (drafters.length >= MAX_DRAFTERS) {
            addBtn.setAttribute('disabled', '');
            addBtn.style.opacity = '0.4';
        } else {
            addBtn.removeAttribute('disabled');
            addBtn.style.opacity = '';
        }
    }

    // Update section header count
    const sectionHeader = panelEl?.querySelector('[data-section="drafters"] .nemo-stack-section-header span');
    if (sectionHeader) {
        sectionHeader.textContent = `Stage 2: Drafters (${drafters.length})`;
    }
}

// ─── Save / Validate / Test ─────────────────────────────────────

/**
 * Read all form values and save the preset.
 */
function saveCurrentPreset() {
    if (!currentPresetId || !panelEl) return;

    const preset = PipelinePresets.get(currentPresetId);
    if (!preset) return;

    const updated = JSON.parse(JSON.stringify(preset));

    // Read stage fields
    for (const stage of ['recall', 'analysis', 'consolidator']) {
        const picker = /** @type {HTMLElement|null} */ (
            panelEl.querySelector(`.nemo-stack-model-picker[data-stage="${stage}"]`)
        );
        const tempInput = /** @type {HTMLInputElement} */ (
            panelEl.querySelector(`[data-stage="${stage}"][data-field="temperature"]`)
        );
        const tokensInput = /** @type {HTMLInputElement} */ (
            panelEl.querySelector(`[data-stage="${stage}"][data-field="max_tokens"]`)
        );

        const target = stage === 'consolidator' ? updated.consolidator : updated[stage];
        if (target) {
            if (picker) target.connectionId = picker.dataset.value || null;
            if (tempInput) target.temperature = parseFloat(tempInput.value) || target.temperature;
            if (tokensInput) target.max_tokens = parseInt(tokensInput.value, 10) || target.max_tokens;
        }
    }

    // Read drafters
    updated.drafters = readDraftersFromDom();

    PipelinePresets.save(updated);
    log.info(`Saved preset: ${currentPresetId}`);

    // Brief visual feedback
    const saveBtn = panelEl.querySelector('#nemo-stack-save-btn');
    if (saveBtn) {
        const orig = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        setTimeout(() => { saveBtn.textContent = orig; }, 1200);
    }
}

/**
 * Run validation on the current preset and display results.
 */
async function validateCurrentPreset() {
    if (!currentPresetId || !panelEl) return;

    const resultEl = panelEl.querySelector('#nemo-stack-validation');
    if (!resultEl) return;

    resultEl.className = 'nemo-stack-validation open';
    resultEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validating...';

    try {
        const result = await ModelPipeline.validatePreset(currentPresetId);

        if (result.configured) {
            resultEl.className = 'nemo-stack-validation open success';
            resultEl.innerHTML = '<div class="nemo-stack-validation-item"><i class="fa-solid fa-check"></i> All connections configured and available</div>';
        } else {
            resultEl.className = 'nemo-stack-validation open error';
            resultEl.innerHTML = result.missing.map(msg =>
                `<div class="nemo-stack-validation-item"><i class="fa-solid fa-xmark"></i> ${escapeHtml(msg)}</div>`,
            ).join('');
        }
    } catch (err) {
        resultEl.className = 'nemo-stack-validation open error';
        resultEl.innerHTML = `<div class="nemo-stack-validation-item"><i class="fa-solid fa-xmark"></i> Validation error: ${escapeHtml(String(err))}</div>`;
    }
}

/**
 * Run a test pipeline execution with sample data.
 */
async function testPipeline() {
    if (!currentPresetId || !panelEl) return;

    const resultEl = panelEl.querySelector('#nemo-stack-test-results');
    if (!resultEl) return;

    resultEl.className = 'nemo-stack-test-results open';
    resultEl.innerHTML = '<div class="nemo-stack-test-status"><i class="fa-solid fa-spinner fa-spin"></i> Running pipeline test...</div>';

    const statusLines = [];

    try {
        const result = await ModelPipeline.execute({
            presetId: currentPresetId,
            systemPrompt: 'You are a creative fiction writer.',
            messages: [
                { role: 'user', content: 'Write a short scene in a tavern.' },
            ],
            userName: 'Player',
            onStatus: (stage, msg) => {
                statusLines.push(`[${stage}] ${msg}`);
                resultEl.innerHTML =
                    statusLines.map(l => `<div class="nemo-stack-test-status">${escapeHtml(l)}</div>`).join('') +
                    '<div class="nemo-stack-test-status"><i class="fa-solid fa-spinner fa-spin"></i> Running...</div>';
            },
        });

        let timingHtml = '';
        if (result.timings) {
            const t = result.timings;
            timingHtml = `<div class="nemo-stack-test-timing">
                Recall+Analysis: ${t.recall_ms ?? '?'}ms | Drafts: ${t.drafts_ms ?? '?'}ms | Consolidation: ${t.consolidation_ms ?? '?'}ms | Total: ${t.total_ms ?? '?'}ms
            </div>`;
        }

        const previewText = result.text
            ? (result.text.length > 500 ? result.text.substring(0, 500) + '...' : result.text)
            : '(no output)';

        resultEl.innerHTML =
            statusLines.map(l => `<div class="nemo-stack-test-status">${escapeHtml(l)}</div>`).join('') +
            timingHtml +
            (result.error ? `<div class="nemo-stack-test-status" style="color:#e74c3c">${escapeHtml(result.error)}</div>` : '') +
            `<div class="nemo-stack-test-preview">${escapeHtml(previewText)}</div>`;

    } catch (err) {
        resultEl.innerHTML =
            statusLines.map(l => `<div class="nemo-stack-test-status">${escapeHtml(l)}</div>`).join('') +
            `<div class="nemo-stack-test-status" style="color:#e74c3c">Error: ${escapeHtml(String(err))}</div>`;
    }
}

// ─── Public API ─────────────────────────────────────────────────

export const PipelineSettingsUI = {
    /**
     * Insert the Nemo Stack button into the connection panel wrapper.
     * @param {HTMLElement} wrapperEl - The #nemo-model-selector-wrapper element
     */
    initialize(wrapperEl) {
        if (btnEl) return; // already initialized

        // Create the trigger button
        btnEl = document.createElement('button');
        btnEl.className = 'nemo-stack-btn';
        btnEl.innerHTML = '<i class="fa-solid fa-layer-group"></i> Nemo Stack';
        btnEl.addEventListener('click', () => this.toggle());

        // Create the panel container (hidden by default)
        panelEl = document.createElement('div');
        panelEl.className = 'nemo-stack-panel';
        panelEl.id = 'nemo-stack-panel';

        // Insert after provider tabs
        const tabsEl = wrapperEl.querySelector('#nemo-provider-tabs');
        if (tabsEl) {
            tabsEl.after(btnEl);
            btnEl.after(panelEl);
        } else {
            wrapperEl.appendChild(btnEl);
            wrapperEl.appendChild(panelEl);
        }

        log.debug('PipelineSettingsUI initialized');
    },

    /**
     * Remove the panel and button from the DOM.
     */
    destroy() {
        if (panelEl) {
            panelEl.remove();
            panelEl = null;
        }
        if (btnEl) {
            btnEl.remove();
            btnEl = null;
        }
        currentPresetId = null;
        log.debug('PipelineSettingsUI destroyed');
    },

    /**
     * Toggle the settings panel open/closed.
     */
    toggle() {
        if (!panelEl || !btnEl) return;

        const isOpen = panelEl.classList.contains('open');

        if (isOpen) {
            // Close
            panelEl.classList.remove('open');
            btnEl.classList.remove('active');
            // Show model cards again
            const grid = panelEl.closest('#nemo-model-selector-wrapper')?.querySelector('.nemo-model-grid');
            if (grid) /** @type {HTMLElement} */ (grid).style.display = '';
        } else {
            // Open — load the active preset (or first available)
            const activeId = PipelinePresets.getActiveId() || 'nemo-stack';
            loadPreset(activeId);
            panelEl.classList.add('open');
            btnEl.classList.add('active');
            // Hide model cards
            const grid = panelEl.closest('#nemo-model-selector-wrapper')?.querySelector('.nemo-model-grid');
            if (grid) /** @type {HTMLElement} */ (grid).style.display = 'none';
        }
    },

    /**
     * Refresh the panel contents (e.g., after connection pool changes).
     */
    refresh() {
        if (!panelEl || !panelEl.classList.contains('open')) return;
        const presetId = currentPresetId || PipelinePresets.getActiveId() || 'nemo-stack';
        const preset = PipelinePresets.get(presetId);
        if (preset) {
            renderPanel(preset);
        }
    },
};
