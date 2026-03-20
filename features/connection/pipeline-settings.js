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

/** @type {HTMLElement|null} */
let btnEl = null;

/** @type {HTMLElement|null} */
let panelEl = null;

/** @type {string|null} Current preset id being edited */
let currentPresetId = null;

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Build an <option> list from the connection pool.
 * @param {string|null} selectedId - Currently selected connection id
 * @returns {string} HTML options string
 */
function buildConnectionOptions(selectedId) {
    const connections = ConnectionPool.getAll();
    let html = '<option value="">(none)</option>';
    for (const conn of connections) {
        const sel = conn.id === selectedId ? ' selected' : '';
        const display = `${conn.label} (${conn.source}/${conn.model})`;
        html += `<option value="${conn.id}"${sel}>${escapeHtml(display)}</option>`;
    }
    return html;
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
 * Create a model-select + temperature + max_tokens field row.
 * @param {string} labelText
 * @param {string} prefix - data attribute prefix (e.g. 'recall', 'analysis')
 * @param {object} values - { connectionId, temperature, max_tokens }
 * @returns {string}
 */
function buildStageFields(labelText, prefix, values) {
    const connOpts = buildConnectionOptions(values.connectionId);
    return `
        <div class="nemo-stack-field-row">
            <label>${escapeHtml(labelText)} Model</label>
            <select class="nemo-stack-model-select" data-stage="${prefix}" data-field="connectionId">${connOpts}</select>
        </div>
        <div class="nemo-stack-field-row">
            <label>Temperature</label>
            <input type="number" class="nemo-stack-input" data-stage="${prefix}" data-field="temperature"
                   value="${values.temperature}" min="0" max="2" step="0.1">
        </div>
        <div class="nemo-stack-field-row">
            <label>Max Tokens</label>
            <input type="number" class="nemo-stack-input" data-stage="${prefix}" data-field="max_tokens"
                   value="${values.max_tokens}" min="100" max="32000" step="100">
        </div>`;
}

/**
 * Build a single drafter row.
 * @param {number} index
 * @param {object} drafter - { connectionId, temperature, max_tokens }
 * @returns {string}
 */
function buildDrafterRow(index, drafter) {
    const label = DRAFTER_LABELS[index] || String(index + 1);
    const connOpts = buildConnectionOptions(drafter.connectionId);
    return `
        <div class="nemo-stack-drafter-row" data-index="${index}">
            <span class="nemo-stack-drafter-label">${label}</span>
            <select class="nemo-stack-model-select" data-field="connectionId">${connOpts}</select>
            <input type="number" class="nemo-stack-input" data-field="temperature"
                   value="${drafter.temperature}" min="0" max="2" step="0.1">
            <input type="number" class="nemo-stack-input" data-field="max_tokens"
                   value="${drafter.max_tokens}" min="100" max="32000" step="100">
            <button class="nemo-stack-remove-btn" title="Remove drafter"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
}

// ─── Panel Rendering ────────────────────────────────────────────

/**
 * Build the full panel HTML for the given preset.
 * @param {object} preset
 * @returns {string}
 */
function buildPanelHtml(preset) {
    const allPresets = PipelinePresets.getAll();
    const connections = ConnectionPool.getAll();
    const hasConnections = connections.length > 0;
    const emptyMsg = '<div class="nemo-stack-empty-msg">No connections registered. Add connections via the API Router to configure the pipeline.</div>';

    // Preset selector
    let presetOptions = '';
    for (const [id, p] of Object.entries(allPresets)) {
        const sel = id === preset.id ? ' selected' : '';
        presetOptions += `<option value="${id}"${sel}>${escapeHtml(p.name || id)}</option>`;
    }

    const isDefault = preset.id === 'nemo-stack' || preset.id === 'nemo-stack-flash';

    // Drafter rows
    let drafterRowsHtml = '';
    if (hasConnections) {
        for (let i = 0; i < preset.drafters.length; i++) {
            drafterRowsHtml += buildDrafterRow(i, preset.drafters[i]);
        }
    }

    // Prompt texts (read-only display)
    const recallPromptPreview = PipelinePrompts.buildRecallMessages('(system prompt)', [{ role: 'user', content: '(conversation)' }])[0]?.content || '';
    const analysisPromptPreview = PipelinePrompts.buildAnalysisMessages('(system prompt)', [{ role: 'user', content: '(conversation)' }])[0]?.content || '';
    const drafterRulesPreview = PipelinePrompts.getDrafterRules('{{user}}');
    const antiSlopPreview = PipelinePrompts.getAntiSlopRules();

    return `
        <!-- Header -->
        <div class="nemo-stack-header">
            <select id="nemo-stack-preset-select">${presetOptions}</select>
            <button class="nemo-stack-header-btn" id="nemo-stack-clone-btn" title="Clone current preset">New Preset</button>
            <button class="nemo-stack-header-btn danger" id="nemo-stack-delete-btn" title="Delete custom preset"
                    ${isDefault ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}>Delete</button>
            <button class="nemo-stack-header-btn close-btn" id="nemo-stack-close-btn" title="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <!-- Stage 1: Recall + Analysis -->
        <div class="nemo-stack-section" data-section="recall">
            <div class="nemo-stack-section-header">
                <i class="fa-solid fa-chevron-right"></i>
                <span>Stage 1: Recall + Analysis</span>
            </div>
            <div class="nemo-stack-section-content">
                ${hasConnections ? `
                    ${buildStageFields('Recall', 'recall', preset.recall)}
                    <hr style="border-color:var(--SmartThemeBorderColor);margin:6px 0">
                    ${buildStageFields('Analysis', 'analysis', preset.analysis)}
                ` : emptyMsg}
                <button class="nemo-stack-prompt-toggle" data-target="recall-prompt">
                    <i class="fa-solid fa-eye"></i> Recall Prompt
                </button>
                <textarea class="nemo-stack-prompt-area" id="nemo-stack-recall-prompt" readonly>${escapeHtml(recallPromptPreview)}</textarea>
                <button class="nemo-stack-prompt-toggle" data-target="analysis-prompt">
                    <i class="fa-solid fa-eye"></i> Analysis Prompt
                </button>
                <textarea class="nemo-stack-prompt-area" id="nemo-stack-analysis-prompt" readonly>${escapeHtml(analysisPromptPreview)}</textarea>
            </div>
        </div>

        <!-- Stage 2: Drafters -->
        <div class="nemo-stack-section" data-section="drafters">
            <div class="nemo-stack-section-header">
                <i class="fa-solid fa-chevron-right"></i>
                <span>Stage 2: Drafters (${preset.drafters.length})</span>
            </div>
            <div class="nemo-stack-section-content">
                ${hasConnections ? `
                    <div class="nemo-stack-drafters-list" id="nemo-stack-drafters-list">
                        ${drafterRowsHtml}
                    </div>
                    <button class="nemo-stack-add-drafter-btn" id="nemo-stack-add-drafter"
                            ${preset.drafters.length >= MAX_DRAFTERS ? 'disabled style="opacity:0.4"' : ''}>
                        <i class="fa-solid fa-plus"></i> Add Drafter
                    </button>
                ` : emptyMsg}
                <button class="nemo-stack-prompt-toggle" data-target="drafter-rules">
                    <i class="fa-solid fa-eye"></i> Drafter Rules
                </button>
                <textarea class="nemo-stack-prompt-area" id="nemo-stack-drafter-rules" readonly>${escapeHtml(drafterRulesPreview)}</textarea>
            </div>
        </div>

        <!-- Stage 3: Consolidation -->
        <div class="nemo-stack-section" data-section="consolidation">
            <div class="nemo-stack-section-header">
                <i class="fa-solid fa-chevron-right"></i>
                <span>Stage 3: Consolidation</span>
            </div>
            <div class="nemo-stack-section-content">
                ${hasConnections ? buildStageFields('Consolidator', 'consolidator', preset.consolidator) : emptyMsg}
                <button class="nemo-stack-prompt-toggle" data-target="anti-slop">
                    <i class="fa-solid fa-eye"></i> Anti-Slop Rules
                </button>
                <textarea class="nemo-stack-prompt-area" id="nemo-stack-anti-slop" readonly>${escapeHtml(antiSlopPreview)}</textarea>
            </div>
        </div>

        <!-- Footer -->
        <div class="nemo-stack-footer">
            <button class="nemo-stack-footer-btn primary" id="nemo-stack-save-btn">Save</button>
            <button class="nemo-stack-footer-btn" id="nemo-stack-validate-btn">Validate</button>
            <button class="nemo-stack-footer-btn" id="nemo-stack-test-btn">Test Pipeline</button>
        </div>

        <!-- Validation results -->
        <div class="nemo-stack-validation" id="nemo-stack-validation"></div>

        <!-- Test results -->
        <div class="nemo-stack-test-results" id="nemo-stack-test-results"></div>
    `;
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
    panelEl.innerHTML = buildPanelHtml(preset);
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
        const connSelect = /** @type {HTMLSelectElement} */ (row.querySelector('[data-field="connectionId"]'));
        const tempInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-field="temperature"]'));
        const tokensInput = /** @type {HTMLInputElement} */ (row.querySelector('[data-field="max_tokens"]'));
        drafters.push({
            connectionId: connSelect?.value || null,
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

    // Re-label
    let html = '';
    for (let i = 0; i < drafters.length; i++) {
        drafters[i].label = DRAFTER_LABELS[i] || String(i + 1);
        html += buildDrafterRow(i, drafters[i]);
    }
    listEl.innerHTML = html;

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
        const connSelect = /** @type {HTMLSelectElement} */ (
            panelEl.querySelector(`[data-stage="${stage}"][data-field="connectionId"]`)
        );
        const tempInput = /** @type {HTMLInputElement} */ (
            panelEl.querySelector(`[data-stage="${stage}"][data-field="temperature"]`)
        );
        const tokensInput = /** @type {HTMLInputElement} */ (
            panelEl.querySelector(`[data-stage="${stage}"][data-field="max_tokens"]`)
        );

        const target = stage === 'consolidator' ? updated.consolidator : updated[stage];
        if (target) {
            if (connSelect) target.connectionId = connSelect.value || null;
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
