import { eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { oai_settings, openai_setting_names, openai_settings } from '../../../../../openai.js';
import { escapeHtml, getExtensionPath } from '../../core/utils.js';
import logger from '../../core/logger.js';
import { PRESET_VERSION, DEFAULT_VARIANT, PRESET_VARIANTS, presetVariant } from './catalog.js';
import { loadPresetAsset } from './asset-loader.js';

const PRESET_NAME = presetVariant().name;
const INSTALLER_CARD_CLASS = 'nemo-engine-installer-section';
const INSTALLER_STYLE_ID = 'nemo-engine-installer-styles';
const SETTINGS_SELECTOR = '#nemo-engine-installer-mount';
const STATUS_IDLE = `Four verified v${PRESET_VERSION} editions included. Choose one, then import and process.`;

let initialized = false;
let settingsPoll = null;
let activeInstall = null;
let activeVariantId = null;

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

function getPresetUrl(variant) {
    return getExtensionPath(variant.assetPath);
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

export async function loadBundledNemoEnginePreset(variantId = DEFAULT_VARIANT) {
    const variant = presetVariant(variantId);
    const preset = await loadPresetAsset(variant, getPresetUrl(variant));
    const stats = validateNemoEnginePreset(preset);
    if (stats.promptCount !== variant.promptCount || stats.regexScriptCount !== variant.regexScriptCount) {
        throw new Error('Bundled preset does not match its release catalog. Update the extension and retry.');
    }
    return { preset, stats, variant };
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

function requireImportPipeline(variant) {
    const settings = extension_settings.NemoPresetExt || {};
    if (!event_types.OAI_PRESET_IMPORT_READY || !globalThis.NemoColdPrompts
        || (variant.full && (!globalThis.NemoVexRuntime || !globalThis.NemoRecipeRuntime))) {
        throw new Error('Preset processing is not ready. Reload SillyTavern and retry.');
    }
    if (settings.enableColdPromptStorage === false
        || (variant.full && (settings.enableVexRuntime === false || settings.enableRecipeRuntime === false))) {
        throw new Error('Enable automatic preset storage in NemoPresetExt before using the one-click installer.');
    }
}

function processedPreset(preset, variant) {
    // ST swallows event-listener exceptions. Runtime failures install a toJSON
    // barrier, so serialize BEFORE checking descriptors or sending the save.
    const serialized = JSON.stringify(preset);
    if (!preset.prompts.some(p => p.nemoPromptBody)
        || (variant.full && (!preset.extensions?.nemoVexRuntime || !preset.extensions?.nemoRecipeRuntime))) {
        throw new Error('Preset processing did not finish. Reload NemoPresetExt and retry.');
    }
    return serialized;
}

async function saveBundledPreset(name, presetBody, selectAfterInstall, variant) {
    requireImportPipeline(variant);
    await eventSource.emit(event_types.OAI_PRESET_IMPORT_READY, { data: presetBody, presetName: name });
    const serialized = processedPreset(presetBody, variant);

    const response = await fetch('/api/presets/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            apiId: 'openai',
            name,
            preset: JSON.parse(serialized),
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
    const variant = presetVariant(options.variantId);
    if (activeInstall) {
        if (activeVariantId !== variant.id) throw new Error('Another preset edition is still being installed.');
        return activeInstall;
    }
    const {
        presetName = variant.name,
        selectAfterInstall = true,
    } = options;

    requireImportPipeline(variant);
    activeVariantId = variant.id;
    activeInstall = (async () => {
        const { preset, stats } = await loadBundledNemoEnginePreset(variant.id);
        const savedName = await saveBundledPreset(presetName, preset, selectAfterInstall, variant);

        extension_settings.NemoPresetExt = extension_settings.NemoPresetExt || {};
        const receipt = {
            name: savedName,
            version: PRESET_VERSION,
            variantId: variant.id,
            sourceSha256: variant.sha256,
            processed: true,
            installedAt: new Date().toISOString(),
            promptCount: stats.promptCount,
            regexScriptCount: stats.regexScriptCount,
        };
        extension_settings.NemoPresetExt.nemoEnginePresetInstaller = receipt;
        const installations = extension_settings.NemoPresetExt.nemoEnginePresetInstallations ||= {};
        installations[variant.id] = receipt;
        saveSettingsDebounced();

        return {
            name: savedName,
            version: PRESET_VERSION,
            variantId: variant.id,
            stats,
            selected: selectAfterInstall,
        };
    })();

    try {
        return await activeInstall;
    } finally {
        activeInstall = null;
        activeVariantId = null;
    }
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

export async function getNemoEngineSetupReport(options = {}) {
    const variant = presetVariant(options.variantId);
    ensureOpenAiPresetState();
    const settings = extension_settings.NemoPresetExt || {};
    const receipt = settings.nemoEnginePresetInstallations?.[variant.id]
        || (settings.nemoEnginePresetInstaller?.variantId === variant.id ? settings.nemoEnginePresetInstaller : {});
    const installedName = receipt.name || variant.name;
    const installedPreset = getOpenAiPresetByName(installedName);
    const verified = receipt.version === PRESET_VERSION && receipt.sourceSha256 === variant.sha256
        && receipt.processed === true;
    const processed = !!installedPreset?.prompts?.some(p => p.nemoPromptBody)
        && (!variant.full || !!(installedPreset.extensions?.nemoVexRuntime && installedPreset.extensions?.nemoRecipeRuntime));
    const report = {
        variantId: variant.id,
        stats: { promptCount: variant.promptCount, regexScriptCount: variant.regexScriptCount },
        installed: !!installedPreset, installedName, installedVersion: receipt.version || '',
        activeName: getActiveOpenAiPresetName(), verified: verified && processed,
        checks: [],
    };
    report.activeIsInstalled = report.installed && report.activeName === installedName;
    report.checks.push({ state: 'ok', label: `${variant.name} is included with this extension`,
        detail: `${variant.promptCount} prompts, ${variant.regexScriptCount} regex scripts. ${variant.description}` });
    report.checks.push({ state: report.installed ? 'ok' : 'warning',
        label: 'Preset is installed in SillyTavern',
        detail: report.installed ? `Installed as ${installedName}.` : 'Choose Import and process to install this edition.' });
    report.checks.push({ state: report.verified ? 'ok' : 'warning',
        label: 'Compatible release imported and processed',
        detail: report.verified ? `Verified v${PRESET_VERSION} release; preset storage is ready.`
            : 'Use Import and process to install the verified release.' });
    report.checks.push({ state: report.activeIsInstalled ? 'ok' : 'warning',
        label: 'Edition is selected as the active Chat Completion preset',
        detail: report.activeName ? `Active preset: ${report.activeName}.` : 'No active Chat Completion preset detected.' });
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
            ? 'The selected edition needs attention.'
            : 'Setup is ready.';

    return `
        <div class="nemo-engine-setup-report">
            <div><strong>${escapeHtml(summary)}</strong></div>
            <div class="nemo-engine-setup-checklist">${checks}</div>
        </div>
    `;
}

async function runPresetAwareSetup(card, variantId = DEFAULT_VARIANT) {
    revealInstallerStatus(card);
    setStatus(card, 'Running preset-aware setup...', 'idle');
    const initial = await getNemoEngineSetupReport({ variantId });
    const needsInstall = !initial.installed
        || !initial.verified;

    if (needsInstall) {
        await installBundledNemoEnginePreset({ variantId, selectAfterInstall: true });
    } else {
        selectOpenAiPreset(initial.installedName);
    }

    const report = await getNemoEngineSetupReport({ variantId });
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

        .nemo-engine-preset-variant {
            width: 100%;
            margin: 6px 0;
        }

        .nemo-engine-preset-description {
            font-size: 13px;
            line-height: 1.45;
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
        <p>Choose a verified v${PRESET_VERSION} edition. One click imports, processes, saves, and selects it.</p>
        <label>Preset edition
            <select class="nemo-engine-preset-variant text_pole">
                ${PRESET_VARIANTS.map(variant => `<option value="${escapeHtml(variant.id)}">${escapeHtml(variant.label)}</option>`).join('')}
            </select>
        </label>
        <p class="nemo-engine-preset-description">${escapeHtml(presetVariant().description)}</p>
        <p>Reimporting replaces the installed copy of this edition. Save custom edits under another preset name first.</p>
        <div class="nemo-engine-installer-actions">
            <button class="nemo-engine-install-button menu_button interactable" type="button">
                Import and process
            </button>
            <button class="nemo-engine-setup-button menu_button interactable" type="button">
                Check / repair selected edition
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
    const variantSelect = card.querySelector('.nemo-engine-preset-variant');
    const lastVariant = extension_settings.NemoPresetExt?.nemoEnginePresetInstaller?.variantId;
    variantSelect.value = PRESET_VARIANTS.some(variant => variant.id === lastVariant) ? lastVariant : DEFAULT_VARIANT;
    card.querySelector('.nemo-engine-preset-description').textContent = presetVariant(variantSelect.value).description;
    variantSelect.addEventListener('change', () => {
        card.querySelector('.nemo-engine-preset-description').textContent = presetVariant(variantSelect.value).description;
        setStatus(card, STATUS_IDLE);
    });

    installButton.addEventListener('click', async () => {
        installButton.disabled = true;
        setupButton.disabled = true;
        variantSelect.disabled = true;
        const variantId = variantSelect.value;
        setStatus(card, 'Verifying and processing the selected preset. Full editions may take a moment…', 'idle');

        try {
            const result = await installBundledNemoEnginePreset({ variantId });
            const report = await getNemoEngineSetupReport({ variantId });
            setStatus(card, renderSetupReport(report), report.hasErrors ? 'error' : report.hasWarnings ? 'warning' : 'success');
            globalThis.toastr?.success(`Imported and processed ${result.name}`, 'Nemo Engine');
        } catch (error) {
            logger.error('Nemo Engine preset install failed', error);
            setStatus(card, `Install failed: ${escapeHtml(error.message)}`, 'error');
            globalThis.toastr?.error('Preset install failed. Check the console for details.', 'Nemo Engine');
        } finally {
            installButton.disabled = false;
            setupButton.disabled = false;
            variantSelect.disabled = false;
        }
    });

    setupButton.addEventListener('click', async () => {
        installButton.disabled = true;
        setupButton.disabled = true;
        variantSelect.disabled = true;

        try {
            const report = await runPresetAwareSetup(card, variantSelect.value);
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
            variantSelect.disabled = false;
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

    // Load only the chosen asset on demand, not every time settings are opened.
    setStatus(card, STATUS_IDLE);
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
        variants: PRESET_VARIANTS,
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
