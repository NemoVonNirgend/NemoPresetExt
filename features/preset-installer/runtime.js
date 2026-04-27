import { eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { oai_settings, openai_setting_names, openai_settings } from '../../../../../openai.js';
import { escapeHtml, getExtensionPath } from '../../core/utils.js';
import logger from '../../core/logger.js';
import { tutorialLauncher } from '../onboarding/tutorial-launcher.js';
import {
    GUIDES_TOOL_RESULTS_VARIABLE_NAME,
    PREFERENCES_VARIABLE_NAME,
} from '../nemolore/constants.js';
import { getNemoLoreSettings } from '../nemolore/settings.js';

const PRESET_VERSION = '9.3.1';
const PRESET_NAME = `Nemo Engine ${PRESET_VERSION}`;
const PRESET_ASSET_PATH = 'assets/nemo-engine-latest.json';
const INSTALLER_CARD_CLASS = 'nemo-engine-installer-section';
const INSTALLER_STYLE_ID = 'nemo-engine-installer-styles';
const SETTINGS_SELECTOR = '.nemo-preset-enhancer-settings';
const STATUS_IDLE = 'Bundled preset: Nemo Engine 9.3.1.';
const CORE_PACK_VARIABLE_SLOTS = [
    { name: 'NemoLoreTimeline', label: 'timeline memory' },
    { name: 'NemoLoreRetrievedArchive', label: 'retrieved archive' },
    { name: PREFERENCES_VARIABLE_NAME, label: 'cross-chat preferences' },
    { name: 'NemoGuidesInstructions', label: 'Guides instructions' },
    { name: GUIDES_TOOL_RESULTS_VARIABLE_NAME, label: 'Guides tool/preflight results' },
];

let initialized = false;
let settingsPoll = null;
let activeInstall = null;

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

function getPresetUrl() {
    return getExtensionPath(PRESET_ASSET_PATH);
}

function validateNemoEnginePreset(preset) {
    if (!preset || typeof preset !== 'object') {
        throw new Error('Preset JSON did not contain an object.');
    }

    if (!Array.isArray(preset.prompts)) {
        throw new Error('Preset JSON is missing the prompts array.');
    }

    if (!Array.isArray(preset.prompt_order)) {
        throw new Error('Preset JSON is missing prompt_order.');
    }

    const regexScripts = Array.isArray(preset.extensions?.regex_scripts)
        ? preset.extensions.regex_scripts
        : [];
    const enabledRegexScripts = regexScripts.filter(script => script?.disabled !== true);

    return {
        promptCount: preset.prompts.length,
        promptOrderCount: preset.prompt_order.reduce((count, orderGroup) => {
            return count + (Array.isArray(orderGroup?.order) ? orderGroup.order.length : 0);
        }, 0),
        regexScriptCount: regexScripts.length,
        enabledRegexScriptCount: enabledRegexScripts.length,
    };
}

export async function loadBundledNemoEnginePreset() {
    const response = await fetch(`${getPresetUrl()}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Could not load bundled preset (${response.status}).`);
    }

    const preset = await response.json();
    const stats = validateNemoEnginePreset(preset);
    return { preset, stats };
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

function upsertOpenAiPreset(name, presetBody, selectAfterInstall = true) {
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

    updateOpenAiPresetSelect(name, value, selectAfterInstall);

    if (selectAfterInstall) {
        oai_settings.preset_settings_openai = name;
        saveSettingsDebounced();
    }

    return value;
}

function selectOpenAiPreset(name) {
    const value = getPresetIndex(name);
    if (value === null) {
        throw new Error(`Preset "${name}" is not installed.`);
    }

    updateOpenAiPresetSelect(name, value, true);
    oai_settings.preset_settings_openai = name;
    saveSettingsDebounced();
}

function updateOpenAiPresetSelect(name, value, selectAfterInstall) {
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

    if (!selectAfterInstall) return;

    select.value = stringValue;
    option.selected = true;

    const jquery = window.jQuery || window.$;
    if (typeof jquery === 'function') {
        jquery(select).trigger('change');
    } else {
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

async function saveBundledPreset(name, presetBody, selectAfterInstall) {
    if (event_types.OAI_PRESET_IMPORT_READY) {
        await eventSource.emit(event_types.OAI_PRESET_IMPORT_READY, { data: presetBody, presetName: name });
    }

    const response = await fetch('/api/presets/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            apiId: 'openai',
            name,
            preset: presetBody,
        }),
    });

    if (!response.ok) {
        throw new Error(`Preset save failed (${response.status}).`);
    }

    const data = await response.json();
    const savedName = data?.name || name;
    upsertOpenAiPreset(savedName, presetBody, selectAfterInstall);
    return savedName;
}

export async function installBundledNemoEnginePreset(options = {}) {
    if (activeInstall) return activeInstall;

    const {
        presetName = PRESET_NAME,
        selectAfterInstall = true,
    } = options;

    activeInstall = (async () => {
        const { preset, stats } = await loadBundledNemoEnginePreset();
        const savedName = await saveBundledPreset(presetName, preset, selectAfterInstall);

        extension_settings.NemoPresetExt = extension_settings.NemoPresetExt || {};
        extension_settings.NemoPresetExt.nemoEnginePresetInstaller = {
            name: savedName,
            version: PRESET_VERSION,
            installedAt: new Date().toISOString(),
            promptCount: stats.promptCount,
            regexScriptCount: stats.regexScriptCount,
        };
        saveSettingsDebounced();

        return {
            name: savedName,
            version: PRESET_VERSION,
            stats,
            selected: selectAfterInstall,
        };
    })();

    try {
        return await activeInstall;
    } finally {
        activeInstall = null;
    }
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

export async function getNemoEngineSetupReport() {
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

    const { preset, stats } = await loadBundledNemoEnginePreset();
    report.stats = stats;
    report.bundledMissingSlots = findMissingCorePackSlots(preset);

    ensureOpenAiPresetState();

    const installerState = extension_settings.NemoPresetExt?.nemoEnginePresetInstaller || {};
    const installedName = String(installerState.name || PRESET_NAME).trim();
    const installedPreset = getOpenAiPresetByName(installedName) || getOpenAiPresetByName(PRESET_NAME);
    report.installed = !!installedPreset;
    report.installedName = installedPreset ? (getOpenAiPresetByName(installedName) ? installedName : PRESET_NAME) : installedName;
    report.installedVersion = String(installerState.version || '');
    report.installedMissingSlots = installedPreset ? findMissingCorePackSlots(installedPreset) : [];
    report.activeName = getActiveOpenAiPresetName();
    report.activeIsInstalled = !!report.installedName && report.activeName === report.installedName;

    const loreSettings = getNemoLoreSettings();
    const guidesSettings = loreSettings.guides || {};
    const preferenceVariable = String(loreSettings.preferenceVariableName || PREFERENCES_VARIABLE_NAME).trim();
    const toolResultsVariable = String(guidesSettings.toolResultsVariableName || GUIDES_TOOL_RESULTS_VARIABLE_NAME).trim();

    report.checks.push({
        state: 'ok',
        label: 'Bundled Nemo Engine 9.3.1 preset is readable',
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
        detail: report.installed ? `Installed as ${report.installedName}.` : 'Run Install / Update or Run Setup Wizard.',
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
    report.checks.push({
        state: preferenceVariable === PREFERENCES_VARIABLE_NAME ? 'ok' : 'warning',
        label: 'Preference variable matches the bundled core pack',
        detail: `${preferenceVariable} -> expected ${PREFERENCES_VARIABLE_NAME}.`,
    });
    report.checks.push({
        state: toolResultsVariable === GUIDES_TOOL_RESULTS_VARIABLE_NAME ? 'ok' : 'warning',
        label: 'Guides tool result variable matches the bundled core pack',
        detail: `${toolResultsVariable} -> expected ${GUIDES_TOOL_RESULTS_VARIABLE_NAME}.`,
    });

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

async function runPresetAwareSetup(card) {
    revealInstallerStatus(card);
    setStatus(card, 'Running preset-aware setup...', 'idle');
    const initial = await getNemoEngineSetupReport();
    const needsInstall = !initial.installed
        || initial.installedVersion !== PRESET_VERSION
        || initial.installedMissingSlots.length > 0;

    if (needsInstall) {
        await installBundledNemoEnginePreset({ selectAfterInstall: true });
    } else {
        selectOpenAiPreset(initial.installedName);
    }

    const report = await getNemoEngineSetupReport();
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
        <h3>Nemo Engine Preset Installer</h3>
        <p>Install or update the bundled ${escapeHtml(PRESET_NAME)} Chat Completion preset, then select it automatically for this session.</p>
        <div class="nemo-engine-installer-actions">
            <button class="nemo-engine-install-button menu_button interactable" type="button">
                Install / Update ${escapeHtml(PRESET_NAME)}
            </button>
            <button class="nemo-engine-setup-button menu_button interactable" type="button">
                Run Setup Wizard
            </button>
            <button class="nemo-engine-guide-button menu_button interactable" type="button">
                Open Setup Guide
            </button>
        </div>
        <div class="nemo-engine-installer-status" data-state="idle">${STATUS_IDLE}</div>
    `;

    const installButton = card.querySelector('.nemo-engine-install-button');
    const setupButton = card.querySelector('.nemo-engine-setup-button');
    const guideButton = card.querySelector('.nemo-engine-guide-button');

    installButton.addEventListener('click', async () => {
        installButton.disabled = true;
        setupButton.disabled = true;
        setStatus(card, 'Installing bundled preset...', 'idle');

        try {
            const result = await installBundledNemoEnginePreset();
            const report = await getNemoEngineSetupReport();
            setStatus(card, renderSetupReport(report), report.hasErrors ? 'error' : report.hasWarnings ? 'warning' : 'success');
            globalThis.toastr?.success(`Installed ${result.name}`, 'Nemo Engine');
        } catch (error) {
            logger.error('Nemo Engine preset install failed', error);
            setStatus(card, `Install failed: ${escapeHtml(error.message)}`, 'error');
            globalThis.toastr?.error('Preset install failed. Check the console for details.', 'Nemo Engine');
        } finally {
            installButton.disabled = false;
            setupButton.disabled = false;
        }
    });

    setupButton.addEventListener('click', async () => {
        installButton.disabled = true;
        setupButton.disabled = true;

        try {
            const report = await runPresetAwareSetup(card);
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
            installButton.disabled = false;
            setupButton.disabled = false;
        }
    });

    guideButton.addEventListener('click', () => {
        tutorialLauncher.startTutorial('nemoEngineSetup');
    });

    return card;
}

function mountInstallerCard(settingsContainer) {
    if (!settingsContainer || settingsContainer.querySelector(`.${INSTALLER_CARD_CLASS}`)) return;

    const card = createInstallerCard();
    const tutorialSection = settingsContainer.querySelector('.nemo-tutorials-button')?.closest('.nemo-settings-section');

    if (tutorialSection) {
        tutorialSection.insertAdjacentElement('afterend', card);
    } else {
        settingsContainer.insertBefore(card, settingsContainer.firstChild);
    }

    loadBundledNemoEnginePreset()
        .then(({ stats }) => {
            setStatus(card, `Bundled preset ready: ${formatStats(stats)}.`, 'idle');
        })
        .catch(error => {
            logger.error('Could not validate bundled Nemo Engine preset', error);
            setStatus(card, `Bundled preset could not be read: ${escapeHtml(error.message)}`, 'error');
        });
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
}
