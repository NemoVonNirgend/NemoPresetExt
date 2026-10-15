import { eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { oai_settings, openai_setting_names, openai_settings } from '../../../../../openai.js';
import { getPresetManager } from '../../../../../preset-manager.js';
import { escapeHtml, getExtensionPath } from '../../core/utils.js';
import logger from '../../core/logger.js';
import { DEFAULT_PRESET_ID, NEMO_ENGINE_PRESETS, NEMO_ENGINE_VERSION, getNemoEnginePreset, loadNemoEnginePreset } from './presets.js';
import { createPresetInstaller } from './controller.js';

const PRESET_VERSION = NEMO_ENGINE_VERSION;
const PRESET_NAME = getNemoEnginePreset().name;
const INSTALLER_CARD_CLASS = 'nemo-engine-installer-section';
const INSTALLER_STYLE_ID = 'nemo-engine-installer-styles';
const SETTINGS_SELECTOR = '#nemo-engine-installer-mount';
const PREFERENCES_VARIABLE_NAME = 'NemoLorePreferences';
const GUIDES_TOOL_RESULTS_VARIABLE_NAME = 'NemoGuidesToolResults';
const CORE_PACK_VARIABLE_SLOTS = [
    { name: 'NemoLoreTimeline', label: 'timeline memory' },
    { name: 'NemoLoreRetrievedArchive', label: 'retrieved archive' },
    { name: PREFERENCES_VARIABLE_NAME, label: 'cross-chat preferences' },
    { name: 'NemoGuidesInstructions', label: 'Guides instructions' },
    { name: GUIDES_TOOL_RESULTS_VARIABLE_NAME, label: 'Guides tool/preflight results' },
];

let initialized = false;
let settingsPoll = null;
const presetInspections = new Map();

function clonePreset(preset) {
    return typeof structuredClone === 'function'
        ? structuredClone(preset)
        : JSON.parse(JSON.stringify(preset));
}

function setStatus(card, message, state = 'idle') {
    const status = card?.querySelector('.nemo-engine-installer-status');
    if (!status) return;
    status.dataset.state = state;
    status.innerHTML = message;
}

function revealInstallerStatus(card) {
    const status = card?.querySelector('.nemo-engine-installer-status');
    (status || card)?.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'center' });
}

export async function loadBundledNemoEnginePreset(presetId = DEFAULT_PRESET_ID) {
    const entry = getNemoEnginePreset(presetId);
    const result = await loadNemoEnginePreset(entry, { url: getExtensionPath(entry.assetPath) });
    presetInspections.set(entry.id, {
        stats: result.stats,
        missingSlots: findMissingCorePackSlots(result.preset),
        slotPromptIds: result.preset.prompts.filter(prompt => CORE_PACK_VARIABLE_SLOTS.some(slot =>
            prompt.content?.includes(`{{getglobalvar::${slot.name}}}`))).map(prompt => prompt.identifier),
    });
    return result;
}

function ensureOpenAiPresetState() {
    if (!Array.isArray(openai_settings) || !openai_setting_names || typeof openai_setting_names !== 'object') {
        throw new Error('SillyTavern OpenAI preset state is not ready yet.');
    }
}

function getPresetIndex(name) {
    if (!Object.prototype.hasOwnProperty.call(openai_setting_names, name)) {
        return null;
    }
    const value = Number(openai_setting_names[name]);
    return Number.isInteger(value) ? value : null;
}

function upsertOpenAiPreset(name, presetBody) {
    ensureOpenAiPresetState();

    const existingIndex = getPresetIndex(name);
    let value;

    if (existingIndex !== null) {
        value = existingIndex;
        const currentPreset = openai_settings[value] || {};
        Object.keys(currentPreset).forEach(key => delete currentPreset[key]);
        Object.assign(currentPreset, clonePreset(presetBody));
        openai_settings[value] = currentPreset;
    } else {
        openai_settings.push(clonePreset(presetBody));
        value = openai_settings.length - 1;
        openai_setting_names[name] = value;
    }

    updateOpenAiPresetSelect(name, value);

    return value;
}

async function selectOpenAiPreset(name) {
    const value = getPresetIndex(name);
    if (value === null) {
        throw new Error(`Preset "${name}" is not installed.`);
    }

    const manager = getPresetManager('openai');
    if (!manager || !document.querySelector('#settings_preset_openai')) {
        throw new Error('The Chat Completion preset selector is not ready. Wait for SillyTavern to finish starting.');
    }
    // Current ST waits for OAI_PRESET_CHANGED_BEFORE/AFTER and runtime hydration.
    await manager.selectPreset(String(value));
    saveSettingsDebounced();
}

function updateOpenAiPresetSelect(name, value) {
    const select = document.querySelector('#settings_preset_openai');
    if (!select) return;

    const stringValue = String(value);
    let option = select.querySelector(`option[value="${CSS.escape(stringValue)}"]`);
    if (!option) {
        option = document.createElement('option');
        option.value = stringValue;
        select.appendChild(option);
    }

    option.textContent = name;
}

async function saveBundledPreset(body) {
    const response = await fetch('/api/presets/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body,
    });

    if (!response.ok) {
        throw new Error(`Preset save failed (${response.status}).`);
    }

    const data = await response.json();
    if (!data?.name) throw new Error('SillyTavern did not return a saved preset name.');
    return data.name;
}

const installer = createPresetInstaller({
    async loadPreset(entry) {
        ensureOpenAiPresetState();
        if (!event_types.OAI_PRESET_IMPORT_READY || !getPresetManager('openai') || !document.querySelector('#settings_preset_openai')) {
            throw new Error('SillyTavern is not ready for Chat Completion preset imports. Finish startup and retry.');
        }
        return loadBundledNemoEnginePreset(entry.id);
    },
    processPreset: (data, presetName) => eventSource.emit(event_types.OAI_PRESET_IMPORT_READY, { data, presetName }),
    savePreset: saveBundledPreset,
    registerPreset: upsertOpenAiPreset,
    selectPreset: selectOpenAiPreset,
    getPresetNames: () => Object.keys(openai_setting_names),
    recordInstall(result) {
        extension_settings.NemoPresetExt = extension_settings.NemoPresetExt || {};
        const previous = extension_settings.NemoPresetExt.nemoEnginePresetInstaller || {};
        const record = {
            name: result.name,
            version: result.version,
            presetId: result.id,
            sha256: result.sha256,
            installedAt: new Date().toISOString(),
            promptCount: result.stats.promptCount,
            regexScriptCount: result.stats.regexScriptCount,
        };
        extension_settings.NemoPresetExt.nemoEnginePresetInstaller = {
            ...record, presets: { ...previous.presets, [result.id]: record },
        };
        saveSettingsDebounced();
    },
});

export function installBundledNemoEnginePreset(options = {}) {
    return installer.install(options);
}

function formatStats(stats) {
    return `${stats.promptCount} prompts, ${stats.regexScriptCount} regex scripts (${stats.enabledRegexScriptCount} enabled)`;
}

function getActiveOpenAiPresetName() {
    const configured = String(oai_settings?.preset_settings_openai || '').trim();
    if (configured) {
        return configured;
    }

    const select = document.querySelector('#settings_preset_openai');
    return String(select?.selectedOptions?.[0]?.textContent || '').trim();
}

function getOpenAiPresetByName(name) {
    if (!name) {
        return null;
    }

    const index = getPresetIndex(name);
    if (index === null) {
        return null;
    }

    return openai_settings[index] || null;
}

function findMissingCorePackSlots(preset) {
    const text = JSON.stringify(preset || {});
    return CORE_PACK_VARIABLE_SLOTS
        .filter(slot => !text.includes(`{{getglobalvar::${slot.name}}}`));
}

function formatMissingSlots(slots) {
    return slots.length
        ? slots.map(slot => `${slot.name} (${slot.label})`).join(', ')
        : 'All core-pack variable slots found.';
}

export async function getNemoEngineSetupReport({ presetId = DEFAULT_PRESET_ID } = {}) {
    const entry = getNemoEnginePreset(presetId);
    const report = {
        stats: null,
        bundledMissingSlots: [],
        installedMissingSlots: [],
        installed: false,
        installedName: '',
        installedVersion: '',
        activeName: '',
        activeIsInstalled: false,
        checks: [],
    };

    if (!presetInspections.has(entry.id)) await loadBundledNemoEnginePreset(entry.id);
    const { stats, missingSlots, slotPromptIds } = presetInspections.get(entry.id);
    report.stats = stats;
    report.bundledMissingSlots = missingSlots;

    ensureOpenAiPresetState();

    const allState = extension_settings.NemoPresetExt?.nemoEnginePresetInstaller || {};
    const installerState = allState.presets?.[entry.id] || (allState.presetId === entry.id ? allState : {});
    const installedName = String(installerState.name || entry.name).trim();
    const installedPreset = getOpenAiPresetByName(installedName);
    report.installed = !!installedPreset;
    report.installedName = installedName;
    report.installedVersion = String(installerState.version || '');
    report.installedSha256 = String(installerState.sha256 || '');
    if (installedPreset) {
        const prompts = await Promise.all(installedPreset.prompts.filter(prompt => slotPromptIds.includes(prompt.identifier)).map(async prompt => ({
            content: await (globalThis.NemoColdPrompts?.readBody(prompt) ?? prompt.content),
        })));
        report.installedMissingSlots = findMissingCorePackSlots({ prompts });
    }
    report.activeName = getActiveOpenAiPresetName();
    report.activeIsInstalled = !!report.installedName && report.activeName === report.installedName;


    report.checks.push({
        state: 'ok',
        label: `Bundled ${entry.name} matches this extension release`,
        detail: formatStats(stats),
    });
    report.checks.push({
        state: report.bundledMissingSlots.length ? 'error' : 'ok',
        label: 'Bundled core pack contains NemoLore/NemoGuides slots',
        detail: formatMissingSlots(report.bundledMissingSlots),
    });
    report.checks.push({
        state: report.installed ? 'ok' : 'warning',
        label: 'Nemo Engine preset is installed in SillyTavern',
        detail: report.installed ? `Installed as ${report.installedName}.` : 'Click Import & Process or Run Setup Wizard.',
    });
    report.checks.push({
        state: !report.installed || !report.installedMissingSlots.length ? 'ok' : 'warning',
        label: 'Installed preset matches the current core-pack slots',
        detail: report.installed ? formatMissingSlots(report.installedMissingSlots) : 'Not installed yet.',
    });
    report.checks.push({
        state: report.activeIsInstalled ? 'ok' : 'warning',
        label: 'Nemo Engine is selected as the active Chat Completion preset',
        detail: report.activeName ? `Active preset: ${report.activeName}.` : 'No active OpenAI preset detected yet.',
    });

    for (const [label, runtime] of [['Recipes', globalThis.NemoRecipeRuntime], ['Vex', globalThis.NemoVexRuntime]]) {
        const compatibility = runtime?.getStats?.().compatibility;
        if (!report.installed || compatibility?.presetName !== report.installedName) continue;
        report.checks.push({ state: compatibility.mode === 'native' ? 'warning' : 'ok',
            label: `${label}: ${compatibility.mode === 'native' ? 'native execution' : 'indexed and optimized'}`,
            detail: compatibility.mode === 'native'
                ? 'Imported with original prompts. ' + compatibility.reason
                : 'Compatible selector and library structure was verified.',
        });
    }


    report.hasErrors = report.checks.some(check => check.state === 'error');
    report.hasWarnings = report.checks.some(check => check.state === 'warning');
    return report;
}

function renderSetupReport(report) {
    const checks = report.checks.map(check => `
        <div class="nemo-engine-setup-check" data-state="${escapeHtml(check.state)}">
            <strong>${escapeHtml(check.label)}</strong>
            <span>${escapeHtml(check.detail)}</span>
        </div>
    `).join('');
    const summary = report.hasErrors
        ? 'Setup found a blocking preset issue.'
        : report.hasWarnings
            ? 'Setup is usable, but some items need attention.'
            : 'Setup is ready.';

    return `
        <div class="nemo-engine-setup-report">
            <div><strong>${escapeHtml(summary)}</strong></div>
            <div class="nemo-engine-setup-checklist">${checks}</div>
        </div>
    `;
}

async function runPresetAwareSetup(card, presetId) {
    const entry = getNemoEnginePreset(presetId);
    revealInstallerStatus(card);
    setStatus(card, 'Running preset-aware setup...', 'idle');
    const initial = await getNemoEngineSetupReport({ presetId });
    const needsInstall = !initial.installed
        || initial.installedVersion !== PRESET_VERSION
        || initial.installedSha256 !== entry.sha256
        || initial.installedMissingSlots.length > 0;

    if (needsInstall) {
        await installBundledNemoEnginePreset({ presetId, onProgress: message => setStatus(card, escapeHtml(message)) });
    } else {
        await selectOpenAiPreset(initial.installedName);
    }

    const report = await getNemoEngineSetupReport({ presetId });
    setStatus(card, renderSetupReport(report), report.hasErrors ? 'error' : report.hasWarnings ? 'warning' : 'success');
    revealInstallerStatus(card);
    return report;
}

function ensureInstallerStyles() {
    if (document.getElementById(INSTALLER_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = INSTALLER_STYLE_ID;
    style.textContent = `
        .${INSTALLER_CARD_CLASS} {
            border-color: rgba(74, 159, 255, 0.45);
            background:
                radial-gradient(circle at top left, rgba(74, 159, 255, 0.18), transparent 34%),
                rgba(255, 255, 255, 0.035);
        }

        .nemo-engine-installer-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 12px 0;
        }

        .nemo-engine-install-button {
            background: linear-gradient(135deg, #3f8fdb 0%, #2468ad 100%);
            color: #fff;
            font-weight: 700;
        }

        .nemo-engine-edition-label {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin: 12px 0 6px;
        }

        .nemo-engine-edition {
            width: 100%;
            min-width: 0;
        }

        .nemo-engine-setup-button {
            background: linear-gradient(135deg, #5a9f6f 0%, #2f7450 100%);
            color: #fff;
            font-weight: 700;
        }

        .nemo-engine-guide-button {
            background: rgba(255, 255, 255, 0.08);
        }

        .nemo-engine-installer-status {
            color: #cfd8e3;
            font-size: 13px;
            line-height: 1.45;
            min-height: 18px;
        }

        .nemo-engine-installer-status[data-state="success"] {
            color: #8ee59c;
        }

        .nemo-engine-installer-status[data-state="error"] {
            color: #ff9a9a;
        }

        .nemo-engine-installer-status[data-state="warning"] {
            color: #ffd27a;
        }

        .nemo-engine-setup-report {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .nemo-engine-setup-checklist {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .nemo-engine-setup-check {
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 6px;
            padding: 7px 9px;
            background: rgba(0, 0, 0, 0.12);
        }

        .nemo-engine-setup-check strong,
        .nemo-engine-setup-check span {
            display: block;
        }

        .nemo-engine-setup-check[data-state="ok"] {
            border-color: rgba(142, 229, 156, 0.45);
        }

        .nemo-engine-setup-check[data-state="warning"] {
            border-color: rgba(255, 210, 122, 0.55);
        }

        .nemo-engine-setup-check[data-state="error"] {
            border-color: rgba(255, 154, 154, 0.55);
        }
    `;
    document.head.appendChild(style);
}

function createInstallerCard() {
    const card = document.createElement('div');
    card.className = `nemo-settings-section ${INSTALLER_CARD_CLASS}`;
    card.innerHTML = `
        <h3>Nemo Engine v${escapeHtml(PRESET_VERSION)} Preset Installer</h3>
        <p>Choose a compatible edition, then import, process, and select it in one click.</p>
        <label class="nemo-engine-edition-label">
            Preset edition
            <select class="nemo-engine-edition text_pole">
                ${NEMO_ENGINE_PRESETS.map(entry => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>`).join('')}
            </select>
        </label>
        <p class="nemo-engine-edition-description"></p>
        <p class="notes">Includes all 493 regex scripts. Existing presets are kept as separate copies.</p>
        <div class="nemo-engine-installer-actions">
            <button class="nemo-engine-install-button menu_button interactable" type="button">
                Import &amp; Process
            </button>
            <button class="nemo-engine-setup-button menu_button interactable" type="button">
                Run Setup Wizard
            </button>
            <button class="nemo-engine-guide-button menu_button interactable" type="button">
                Open Setup Guide
            </button>
        </div>
        <div class="nemo-engine-installer-status" data-state="idle" role="status" aria-live="polite"></div>
    `;

    const installButton = card.querySelector('.nemo-engine-install-button');
    const setupButton = card.querySelector('.nemo-engine-setup-button');
    const guideButton = card.querySelector('.nemo-engine-guide-button');
    const editionSelect = card.querySelector('.nemo-engine-edition');
    const description = card.querySelector('.nemo-engine-edition-description');
    const previousId = extension_settings.NemoPresetExt?.nemoEnginePresetInstaller?.presetId;
    editionSelect.value = NEMO_ENGINE_PRESETS.some(entry => entry.id === previousId) ? previousId : DEFAULT_PRESET_ID;
    function refreshEdition() {
        const entry = getNemoEnginePreset(editionSelect.value);
        description.textContent = entry.description;
        setStatus(card, `Bundled compatible edition: ${escapeHtml(entry.name)} · ${(entry.bytes / 1_000_000).toFixed(1)} MB.`, 'idle');
    }
    function setBusy(busy) {
        installButton.disabled = busy;
        setupButton.disabled = busy;
        editionSelect.disabled = busy;
        card.setAttribute('aria-busy', String(busy));
    }
    editionSelect.addEventListener('change', refreshEdition);
    refreshEdition();

    installButton.addEventListener('click', async () => {
        const presetId = editionSelect.value;
        setBusy(true);

        try {
            const result = await installBundledNemoEnginePreset({ presetId, onProgress: message => setStatus(card, escapeHtml(message)) });
            const report = await getNemoEngineSetupReport({ presetId });
            setStatus(card, renderSetupReport(report), report.hasErrors ? 'error' : report.hasWarnings ? 'warning' : 'success');
            globalThis.toastr?.success(`Installed ${result.name}`, 'Nemo Engine');
        } catch (error) {
            logger.error('Nemo Engine preset install failed', error);
            setStatus(card, `Install failed: ${escapeHtml(error.message)}`, 'error');
            globalThis.toastr?.error('Preset install failed. Check the console for details.', 'Nemo Engine');
        } finally {
            setBusy(false);
        }
    });

    setupButton.addEventListener('click', async () => {
        const presetId = editionSelect.value;
        setBusy(true);

        try {
            const report = await runPresetAwareSetup(card, presetId);
            if (report.hasErrors) {
                globalThis.toastr?.error('Setup found a blocking preset issue.', 'Nemo Engine');
            } else if (report.hasWarnings) {
                globalThis.toastr?.warning('Setup completed with warnings.', 'Nemo Engine');
            } else {
                globalThis.toastr?.success('Nemo Engine setup is ready.', 'Nemo Engine');
            }
        } catch (error) {
            logger.error('Nemo Engine setup wizard failed', error);
            setStatus(card, `Setup failed: ${escapeHtml(error.message)}`, 'error');
            globalThis.toastr?.error('Setup wizard failed. Check the console for details.', 'Nemo Engine');
        } finally {
            setBusy(false);
        }
    });

    guideButton.addEventListener('click', () => {
        window.open('/' + getExtensionPath('NEMO_ENGINE_SETUP.md'), '_blank', 'noopener');
    });

    return card;
}

function mountInstallerCard(settingsContainer) {
    if (!settingsContainer || settingsContainer.querySelector(`.${INSTALLER_CARD_CLASS}`)) return;

    const card = createInstallerCard();
    settingsContainer.insertBefore(card, settingsContainer.firstChild);
    // Load large Full exports only when an import or setup check is requested.
}

export function initNemoEngineInstaller() {
    if (initialized) return;
    initialized = true;

    ensureInstallerStyles();

    window.NemoEngineInstaller = {
        install: installBundledNemoEnginePreset,
        loadPreset: loadBundledNemoEnginePreset,
        getSetupReport: getNemoEngineSetupReport,
        version: PRESET_VERSION,
        presetName: PRESET_NAME,
        presets: NEMO_ENGINE_PRESETS,
    };

    settingsPoll = setInterval(() => {
        const settingsContainer = document.querySelector(SETTINGS_SELECTOR);
        if (!settingsContainer) return;
        clearInterval(settingsPoll);
        settingsPoll = null;
        mountInstallerCard(settingsContainer);
    }, 500);

    logger.info('Nemo Engine installer initialized');
}

export function cleanupNemoEngineInstaller() {
    if (settingsPoll) {
        clearInterval(settingsPoll);
        settingsPoll = null;
    }

    document.querySelectorAll(`.${INSTALLER_CARD_CLASS}`).forEach(card => card.remove());
    document.getElementById(INSTALLER_STYLE_ID)?.remove();

    if (window.NemoEngineInstaller?.version === PRESET_VERSION) {
        delete window.NemoEngineInstaller;
    }

    initialized = false;
    presetInspections.clear();
}
