import {
    extension_prompts,
    saveSettingsDebounced,
} from '../../../../../../script.js';
import { getContext, extension_settings } from '../../../../../extensions.js';
import {
    DEFAULT_SETTINGS,
    PREFERENCES_VARIABLE_NAME,
    PREFERENCES_PROMPT_TAG,
    PROMPT_TAG,
    RETRIEVAL_PROMPT_TAG,
} from './constants.js';
import { getNemoLoreSettings } from './settings.js';
import { ConnectionManagerRequestService } from '../../../../shared.js';
import { ALL_TOOL_NAMES, getDefaultSettings, getDefaultToolSettings, getGuidesSettings } from './guides/tool-registry.js';
import { runSidecarGeneration } from './guides/sidecar.js';
import { ToolManager } from '../../../../../tool-calling.js';
import {
    getGlobalPromptVariable,
    normalizePromptVariableName,
} from './shared/variable-service.js';

const DEBUG_GLOBAL = 'NemoLoreDebug';
const GUIDE_PROMPT_TAG = 'nlg_system_instruction';
const DEBUG_MEMORY_PROFILE = 'nemo-debug-memory-profile';
const DEBUG_TOOL_PROFILE = 'nemo-debug-tool-profile';

function clone(value) {
    return JSON.parse(JSON.stringify(value ?? {}));
}

function replaceObject(target, source) {
    for (const key of Object.keys(target)) {
        delete target[key];
    }

    Object.assign(target, clone(source));
    return target;
}

function getRootSettings() {
    extension_settings.NemoPresetExt = extension_settings.NemoPresetExt || {};
    return extension_settings.NemoPresetExt;
}

function getPromptValue(tag) {
    return extension_prompts[tag]?.value || '';
}

function getProfileSelectStatus() {
    return Array.from(document.querySelectorAll('.nlg-tool-profile')).map(select => ({
        value: select.value,
        optionCount: select.options.length,
        firstOption: select.options[0]?.textContent || '',
    }));
}

function getLegacyStatus() {
    const guides = getGuidesSettings();
    const toolKeys = Object.keys(guides.tools || {});
    return {
        ngSettingsCount: document.querySelectorAll('#ng-settings').length,
        ngEnabledCount: document.querySelectorAll('#ng_enabled').length,
        ngToolKeys: toolKeys.filter(key => key.startsWith('NG_')),
        oldPresetInputs: document.querySelectorAll('.nlg-tool-preset').length,
    };
}

function restoreSettings(previousNemoLore) {
    const root = getRootSettings();
    root.nemoLore = replaceObject(root.nemoLore || {}, previousNemoLore);

    const cfg = getNemoLoreSettings();
    const guides = getGuidesSettings();
    $('#nemo_lore_enabled').prop('checked', !!cfg.enabled);
    $('#nlg_enabled').prop('checked', !!guides.enabled);
    saveSettingsDebounced();
}

function createResult(name, passed, details = {}) {
    return { name, passed, details };
}

export function installNemoLoreDebug() {
    window[DEBUG_GLOBAL] = {
        help() {
            return [
                'NemoLoreDebug.status() - inspect mounted UI, settings, prompt blocks, profiles, and legacy keys.',
                'await NemoLoreDebug.testProfileRouting() - mock Connection Manager and verify memory-profile inheritance plus per-tool override.',
                'await NemoLoreDebug.testDisableAll() - click the Disable All button, verify Memory and Guides turn off, then restore previous settings.',
                'await NemoLoreDebug.runSelfTest() - run the non-destructive smoke suite.',
            ];
        },

        status() {
            const cfg = getNemoLoreSettings();
            const guides = getGuidesSettings();
            const profileSelects = getProfileSelectStatus();
            const preferenceVariableName = normalizePromptVariableName(cfg.preferenceVariableName, PREFERENCES_VARIABLE_NAME);

            return {
                mounted: !!document.getElementById('nemo_lore_settings'),
                defaults: {
                    memoryEnabled: DEFAULT_SETTINGS.enabled,
                    guidesEnabled: getDefaultSettings().enabled,
                },
                settings: {
                    memoryEnabled: cfg.enabled,
                    backgroundEnabled: cfg.backgroundEnabled,
                    memoryProfileId: cfg.memoryProfileId || '',
                    guidesEnabled: guides.enabled,
                    enabledToolNames: Object.entries(guides.tools || {})
                        .filter(([, tool]) => tool?.enabled)
                        .map(([name]) => name),
                },
                ui: {
                    memoryToggleChecked: !!document.getElementById('nemo_lore_enabled')?.checked,
                    guidesToggleChecked: !!document.getElementById('nlg_enabled')?.checked,
                    disableAllButtonMounted: !!document.getElementById('nemo_lore_disable_all'),
                    profileSelectCount: profileSelects.length,
                    profileSelects,
                },
                prompts: {
                    timelineChars: getPromptValue(PROMPT_TAG).length,
                    retrievalChars: getPromptValue(RETRIEVAL_PROMPT_TAG).length,
                    preferencesChars: getPromptValue(PREFERENCES_PROMPT_TAG).length,
                    preferenceVariableName,
                    preferenceVariableChars: getGlobalPromptVariable(preferenceVariableName).length,
                    guidesInstructionChars: getPromptValue(GUIDE_PROMPT_TAG).length,
                },
                legacy: getLegacyStatus(),
            };
        },

        async testProfileRouting() {
            const root = getRootSettings();
            const previousNemoLore = clone(root.nemoLore);
            const context = getContext();
            const originalSendRequest = ConnectionManagerRequestService.sendRequest;
            const originalExecuteSlashCommands = context.executeSlashCommandsWithOptions;
            const calls = [];
            const scripts = [];

            try {
                const cfg = getNemoLoreSettings();
                const guides = getGuidesSettings();
                guides.tools = guides.tools || {};
                guides.tools.NLG_rule_setup = guides.tools.NLG_rule_setup || getDefaultToolSettings();

                cfg.memoryProfileId = DEBUG_MEMORY_PROFILE;
                guides.tools.NLG_rule_setup.profileId = '';

                ConnectionManagerRequestService.sendRequest = async (profileId, messages, maxTokens, options) => {
                    calls.push({ profileId, messages, maxTokens, options });
                    return { content: `debug response for ${profileId}` };
                };

                context.executeSlashCommandsWithOptions = async (script) => {
                    scripts.push(script);
                    return { pipe: '' };
                };

                const inherited = await runSidecarGeneration({
                    prompt: 'NemoLore debug profile inheritance probe',
                    toolName: 'NLG_rule_setup',
                    maxTokens: 17,
                });

                guides.tools.NLG_rule_setup.profileId = DEBUG_TOOL_PROFILE;
                const overridden = await runSidecarGeneration({
                    prompt: 'NemoLore debug profile override probe',
                    toolName: 'NLG_rule_setup',
                    maxTokens: 19,
                });

                const passed = calls.length === 2
                    && calls[0]?.profileId === DEBUG_MEMORY_PROFILE
                    && calls[1]?.profileId === DEBUG_TOOL_PROFILE
                    && calls[0]?.options?.includePreset === true
                    && calls[0]?.options?.includeInstruct === true
                    && inherited.includes(DEBUG_MEMORY_PROFILE)
                    && overridden.includes(DEBUG_TOOL_PROFILE)
                    && scripts.length === 0;

                return createResult('profileRouting', passed, { calls, inherited, overridden, scriptsCount: scripts.length });
            } finally {
                ConnectionManagerRequestService.sendRequest = originalSendRequest;
                context.executeSlashCommandsWithOptions = originalExecuteSlashCommands;
                restoreSettings(previousNemoLore);
            }
        },

        async testDisableAll() {
            const root = getRootSettings();
            const previousNemoLore = clone(root.nemoLore);
            const originalUnregister = ToolManager.unregisterFunctionTool;
            const unregisterCalls = [];

            try {
                const cfg = getNemoLoreSettings();
                const guides = getGuidesSettings();

                cfg.enabled = true;
                guides.enabled = true;
                $('#nemo_lore_enabled').prop('checked', true);
                $('#nlg_enabled').prop('checked', true).trigger('change');

                ToolManager.unregisterFunctionTool = function (name) {
                    unregisterCalls.push(name);
                    return originalUnregister.call(this, name);
                };

                document.getElementById('nemo_lore_disable_all')?.click();
                await new Promise(resolve => setTimeout(resolve, 250));

                const passed = cfg.enabled === false
                    && guides.enabled === false
                    && document.getElementById('nemo_lore_enabled')?.checked === false
                    && document.getElementById('nlg_enabled')?.checked === false
                    && ALL_TOOL_NAMES.every(name => unregisterCalls.includes(name));

                return createResult('disableAll', passed, {
                    memoryEnabled: cfg.enabled,
                    guidesEnabled: guides.enabled,
                    unregisterCalls,
                });
            } finally {
                ToolManager.unregisterFunctionTool = originalUnregister;
                restoreSettings(previousNemoLore);

                const restoredGuides = getGuidesSettings();
                $('#nemo_lore_enabled').trigger('input');
                $('#nlg_enabled').prop('checked', !!restoredGuides.enabled).trigger('change');
            }
        },

        async runSelfTest() {
            const status = this.status();
            const checks = [
                createResult('settingsMounted', status.mounted === true, { mounted: status.mounted }),
                createResult('defaultsOff', status.defaults.memoryEnabled === false && status.defaults.guidesEnabled === false, status.defaults),
                createResult('profileSelectorsMounted', status.ui.profileSelectCount === 4 && status.ui.profileSelects.every(select => select.optionCount > 0), status.ui.profileSelects),
                createResult('legacyClean', status.legacy.ngSettingsCount === 0 && status.legacy.ngEnabledCount === 0 && status.legacy.ngToolKeys.length === 0 && status.legacy.oldPresetInputs === 0, status.legacy),
                await this.testProfileRouting(),
                await this.testDisableAll(),
            ];

            return {
                passed: checks.every(check => check.passed),
                checks,
                status: this.status(),
            };
        },
    };

    return window[DEBUG_GLOBAL];
}

export function uninstallNemoLoreDebug() {
    delete window[DEBUG_GLOBAL];
}
