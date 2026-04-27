/**
 * Guided Generation Tools - Main Entry Point
 *
 * AI-driven guided generation via tool calls. Instead of manually toggling
 * auto-trigger guides, the AI model gets tool calls and autonomously decides
 * when to invoke scene analysis, response planning, and prose refinement.
 *
 * Architecture:
 *   index.js         - This file. Init, settings, event wiring.
 *   sidecar.js       - Shared sidecar LLM generation via STScript /gen.
 *   tool-registry.js - Registers/unregisters all tools with ToolManager.
 *   prompts.js       - Default prompt templates for all tools.
 *   tools/           - One file per built-in tool.
 *   activity-feed.js - Floating widget showing real-time tool activity.
 */

import {
    chat,
    deleteMessage,
    eventSource,
    event_types,
    saveSettingsDebounced,
} from '/script.js';
import { extension_settings, getContext } from '../../../../../../extensions.js';
import {
    ALL_TOOL_NAMES,
    clearGuidesToolResultsVariable,
    getDefaultSettings,
    getGuidesSettings,
    getToolResultsVariableName,
    isStealthFollowupActive,
    isGuidesToolName,
    registerAllTools,
    unregisterAllTools,
} from './tool-registry.js';
import { initActivityFeed } from './activity-feed.js';
import { DEFAULT_SYSTEM_INSTRUCTION } from './prompts.js';
import { runSilentPreflight } from './preflight.js';
import { clearAllTrackers, ensureBookExists, buildTrackerStatusMessage } from './lorebook-manager.js';
import { autoGenerateRules } from './tools/rule-setup.js';
import { initDMNotes } from './tools/dm-notes.js';
import { buildWritingWarnings } from './writing-analyzer.js';
import { runPromptAdvisor, applyAllRecommendations, resetAdvisorState } from './prompt-advisor.js';
import { runFreshChatSetup } from './guides-setup.js';
import { applyPromptBlock, clearPromptBlock, mapPromptPosition, mapPromptRole } from '../shared/prompt-service.js';
import {
    ACTIVE_NEMOSTACK_PRESET,
    getNemoStackPresetOptions,
    getSupportedConnectionProfiles,
} from '../shared/model-service.js';
import {
    buildCustomToolsInstruction,
    createDefaultCustomTool,
    normalizeCustomTools,
    sanitizeCustomToolName,
} from './custom-tools.js';

const LOG_PREFIX = '[NemoLore:Guides]';
const PROMPT_KEY = 'nlg_system_instruction';
const HIDDEN_REASONING_BLOCK_PATTERN = /<(think|cot)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Track the last chat ID to detect new chats. */
let lastChatId = null;
const registeredEventHandlers = [];

function registerGuidesEventHandler(eventName, handler) {
    eventSource.on(eventName, handler);
    registeredEventHandlers.push([eventName, handler]);
}

function getProfileOptions() {
    try {
        return getSupportedConnectionProfiles();
    } catch (error) {
        console.warn(`${LOG_PREFIX} Could not load Connection Manager profiles`, error);
        return [];
    }
}

function renderToolProfileSelect(select, selectedProfileId) {
    const dropdown = $(select);
    const profiles = getProfileOptions();
    const selected = String(selectedProfileId || '');

    dropdown.empty();
    dropdown.append($('<option></option>').val('').text('Use memory profile, otherwise current API'));

    for (const profile of profiles) {
        dropdown.append($('<option></option>').val(profile.id).text(profile.name || profile.id));
    }

    if (selected && !profiles.some(profile => profile.id === selected)) {
        dropdown.append($('<option></option>').val(selected).text(`Missing profile: ${selected}`));
    }

    dropdown.val(selected);
}

function renderNemoStackPresetSelect(selectedPresetId) {
    const dropdown = $('#nlg_plan_stack_preset');
    if (!dropdown.length) return;

    const selected = String(selectedPresetId || '');
    const presets = getNemoStackPresetOptions();

    dropdown.empty();
    dropdown.append($('<option></option>').val('').text('Off - use Guides Plan -> Brainstorm -> Refine'));
    dropdown.append($('<option></option>').val(ACTIVE_NEMOSTACK_PRESET).text('Use active NemoStack preset'));

    for (const preset of presets) {
        dropdown.append($('<option></option>').val(preset.id).text(preset.name || preset.id));
    }

    if (selected && selected !== ACTIVE_NEMOSTACK_PRESET && !presets.some(preset => preset.id === selected)) {
        dropdown.append($('<option></option>').val(selected).text(`Missing preset: ${selected}`));
    }

    dropdown.val(selected);
}

/**
 * Ensure extension settings exist with defaults.
 */
function loadSettings() {
    const defaults = getDefaultSettings();
    const settings = getGuidesSettings();
    let changed = false;
    if (!settings.tools) {
        settings.tools = defaults.tools;
        changed = true;
    }
    for (const toolName of Object.keys(settings.tools)) {
        if (!ALL_TOOL_NAMES.includes(toolName)) {
            delete settings.tools[toolName];
            changed = true;
        }
    }

    const normalizedCustomTools = normalizeCustomTools(settings.customTools);
    if (JSON.stringify(settings.customTools || []) !== JSON.stringify(normalizedCustomTools)) {
        settings.customTools = normalizedCustomTools;
        changed = true;
    }
    for (const toolName of ALL_TOOL_NAMES) {
        if (!settings.tools[toolName]) {
            settings.tools[toolName] = defaults.tools[toolName];
            changed = true;
        }

        const toolSettings = settings.tools[toolName];
        for (const [key, value] of Object.entries(defaults.tools[toolName])) {
            if (toolSettings[key] === undefined) {
                toolSettings[key] = value;
                changed = true;
            }
        }

        if (Object.prototype.hasOwnProperty.call(toolSettings, 'preset')) {
            delete toolSettings.preset;
            changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(toolSettings, 'stealth')) {
            delete toolSettings.stealth;
            changed = true;
        }
    }

    if (Object.prototype.hasOwnProperty.call(settings, '_migratedStealthDefaults')) {
        delete settings._migratedStealthDefaults;
        changed = true;
    }

    // Ensure prompt stack advisor settings exist.
    if (settings.autoAdvisor === undefined) {
        settings.autoAdvisor = false;
    }

    if (settings.planningPipelinePresetId === undefined) {
        settings.planningPipelinePresetId = defaults.planningPipelinePresetId;
        changed = true;
    }

    if (settings.cleanupToolCallIntermediates === undefined) {
        settings.cleanupToolCallIntermediates = defaults.cleanupToolCallIntermediates;
        changed = true;
    }
    if (settings.stealthToolCalls === undefined) {
        settings.stealthToolCalls = defaults.stealthToolCalls;
        changed = true;
    }
    if (settings.toolResultsVariableName === undefined) {
        settings.toolResultsVariableName = defaults.toolResultsVariableName;
        changed = true;
    }
    if (settings.preflightEnabled === undefined) {
        settings.preflightEnabled = defaults.preflightEnabled;
        changed = true;
    }
    if (settings.preflightReplaceToolCalls === undefined) {
        settings.preflightReplaceToolCalls = defaults.preflightReplaceToolCalls;
        changed = true;
    }
    if (settings.preflightRequireInput === undefined) {
        settings.preflightRequireInput = defaults.preflightRequireInput;
        changed = true;
    }
    if (settings.preflightProfileId === undefined) {
        settings.preflightProfileId = defaults.preflightProfileId;
        changed = true;
    }
    if (settings.preflightMaxTokens === undefined) {
        settings.preflightMaxTokens = defaults.preflightMaxTokens;
        changed = true;
    }
    if (settings.preflightPrompt === undefined) {
        settings.preflightPrompt = defaults.preflightPrompt;
        changed = true;
    }

    // Ensure writing analysis setting exists
    if (settings.writingAnalysis === undefined) {
        settings.writingAnalysis = true;
    }

    // Ensure auto-rules setting exists
    if (settings.autoGenerateRules === undefined) {
        settings.autoGenerateRules = true;
    }

    // Ensure lorebook settings exist
    if (settings.lorebookName === undefined) {
        settings.lorebookName = '';
    }

    // Ensure system instruction settings exist
    if (settings.systemInstruction === undefined) {
        settings.systemInstruction = '';
    }
    if (settings.injectSystemInstruction === undefined) {
        settings.injectSystemInstruction = true;
    }
    if (settings.instructionPosition === undefined) {
        settings.instructionPosition = 'in_chat';
    }
    if (settings.instructionDepth === undefined) {
        settings.instructionDepth = 1;
    }
    if (settings.instructionRole === undefined) {
        settings.instructionRole = 'system';
    }

    if (changed) {
        saveSettingsDebounced();
    }
}

/**
 * Update the settings UI to reflect current state.
 */
function updateSettingsUI() {
    const settings = getGuidesSettings();
    if (!settings) return;

    $('#nlg_enabled').prop('checked', settings.enabled);
    $('#nlg_lorebook_name').val(settings.lorebookName || '');
    $('#nlg_auto_rules').prop('checked', settings.autoGenerateRules !== false);
    $('#nlg_writing_analysis').prop('checked', settings.writingAnalysis !== false);
    $('#nlg_auto_advisor').prop('checked', settings.autoAdvisor || false);
    $('#nlg_stealth_tool_calls').prop('checked', settings.stealthToolCalls !== false);
    $('#nlg_tool_results_variable').val(getToolResultsVariableName(settings));
    $('#nlg_preflight_enabled').prop('checked', !!settings.preflightEnabled);
    $('#nlg_preflight_replace_tools').prop('checked', settings.preflightReplaceToolCalls !== false);
    $('#nlg_preflight_require_input').prop('checked', settings.preflightRequireInput !== false);
    renderToolProfileSelect($('#nlg_preflight_profile'), settings.preflightProfileId || '');
    $('#nlg_preflight_max_tokens').val(settings.preflightMaxTokens || 900);
    $('#nlg_preflight_prompt').val(settings.preflightPrompt || '');
    $('#nlg_cleanup_tool_intermediates').prop('checked', settings.cleanupToolCallIntermediates !== false);
    renderNemoStackPresetSelect(settings.planningPipelinePresetId || '');
    $('#nlg_inject_instruction').prop('checked', settings.injectSystemInstruction);
    $('#nlg_instruction_position').val(settings.instructionPosition);
    $('#nlg_instruction_depth').val(settings.instructionDepth);
    $('#nlg_instruction_role').val(settings.instructionRole);
    $('#nlg_system_instruction').val(settings.systemInstruction || '');

    for (const toolName of ALL_TOOL_NAMES) {
        const toolSettings = settings.tools[toolName];
        if (!toolSettings) continue;

        const section = $(`.nlg-tool-section[data-tool="${toolName}"]`);
        if (!section.length) continue;

        section.find('.nlg-tool-enabled').prop('checked', toolSettings.enabled);
        section.find('.nlg-tool-inject').prop('checked', toolSettings.injectResult || false);
        section.find('.nlg-inject-options').toggle(!!toolSettings.injectResult);
        section.find('.nlg-tool-inject-position').val(toolSettings.injectPosition || 'chat');
        section.find('.nlg-tool-inject-depth').val(toolSettings.injectDepth ?? 1);
        section.find('.nlg-tool-inject-ephemeral').prop('checked', toolSettings.injectEphemeral !== false);
        renderToolProfileSelect(section.find('.nlg-tool-profile'), toolSettings.profileId || '');
        section.find('.nlg-tool-prompt').val(toolSettings.prompt || '');
    }

    renderCustomToolsUI(settings);
}

function renderCustomToolsUI(settings = getGuidesSettings()) {
    const container = $('#nlg_custom_tools');
    if (!container.length) return;

    const tools = normalizeCustomTools(settings.customTools);
    settings.customTools = tools;
    container.empty();

    if (!tools.length) {
        container.append($('<div></div>')
            .addClass('nlg-custom-tools-empty nemo-lore-muted')
            .text('No custom tools yet. Add one to expose a safe template-based tool call to compatible models.'));
        return;
    }

    for (const [index, tool] of tools.entries()) {
        const card = $('<div></div>')
            .addClass('nlg-custom-tool-card nemo-lore-card')
            .attr('data-index', String(index));

        const header = $('<div></div>').addClass('nlg-custom-tool-header');
        const title = $('<strong></strong>').text(tool.displayName || tool.name);
        const removeButton = $('<div></div>')
            .addClass('menu_button menu_button_icon nlg-delete-custom-tool')
            .attr('title', 'Delete this custom tool.')
            .append($('<i></i>').addClass('fa-solid fa-trash-can'))
            .append($('<span></span>').text('Delete'));
        header.append(title, removeButton);

        const toggles = $('<div></div>').addClass('nlg-custom-tool-toggles');
        toggles.append(createCustomCheckbox('enabled', tool.enabled, 'Enabled', 'Registers this custom tool when NemoLore Guides is enabled.'));

        const grid = $('<div></div>').addClass('nlg-custom-tool-grid');
        grid.append(createCustomTextField('displayName', tool.displayName, 'Display Name', 'Friendly name shown in the tool activity feed.'));
        grid.append(createCustomTextField('name', tool.name, 'Tool Name', 'Function name sent to the model. It will be sanitized to NLG_custom_* automatically.'));

        card.append(header, toggles, grid);
        card.append(createCustomTextarea('description', tool.description, 'Description', 'Tell the model when to call this tool.', 3));
        card.append(createCustomTextField('inputDescription', tool.inputDescription, 'Input Description', 'Describe what the model should pass in the input parameter.'));
        card.append(createCustomTextarea('responseTemplate', tool.responseTemplate, 'Response Template', 'Returned text. Supported variables: {{input}}, {{json}}, {{tool_name}}, {{tool_display_name}}, {{timestamp}}.', 5));
        card.append($('<small></small>')
            .addClass('nlg-hint')
            .text('Custom tools are text templates only. They cannot run JavaScript or access files.'));

        container.append(card);
    }
}

function createCustomCheckbox(field, checked, label, title) {
    const wrapper = $('<label></label>').addClass('checkbox_label').attr('title', title);
    const input = $('<input />')
        .attr('type', 'checkbox')
        .attr('data-nlg-custom-field', field)
        .prop('checked', !!checked);
    wrapper.append(input, $('<span></span>').text(label));
    return wrapper;
}

function createCustomTextField(field, value, label, title) {
    const wrapper = $('<label></label>').attr('title', title);
    wrapper.append($('<span></span>').text(label));
    wrapper.append($('<input />')
        .addClass('text_pole')
        .attr('type', 'text')
        .attr('data-nlg-custom-field', field)
        .attr('title', title)
        .val(value || ''));
    return wrapper;
}

function createCustomTextarea(field, value, label, title, rows) {
    const wrapper = $('<label></label>').attr('title', title);
    wrapper.append($('<span></span>').text(label));
    wrapper.append($('<textarea></textarea>')
        .addClass('text_pole')
        .attr('rows', String(rows))
        .attr('data-nlg-custom-field', field)
        .attr('title', title)
        .val(value || ''));
    return wrapper;
}

/**
 * Bind event handlers for settings UI elements.
 */
function bindSettingsEvents() {
    // Global enable toggle
    $('#nlg_enabled').on('change', function () {
        const enabled = !!$(this).prop('checked');
        const settings = getGuidesSettings();
        settings.enabled = enabled;
        saveSettingsDebounced();

        if (enabled) {
            // Activating: register tools, inject instruction, init activity feed
            registerAllTools();
            updateSystemInstruction();
            initActivityFeed();
            ensureBookExists().catch(err => console.error(`${LOG_PREFIX} Lorebook init failed:`, err));
        } else {
            // Deactivating: unregister tools, clear injected prompt
            unregisterAllTools();
            updateSystemInstruction(); // clears the prompt since enabled=false
        }
    });

    // Lorebook settings
    $('#nlg_lorebook_name').on('input', function () {
        const settings = getGuidesSettings();
        settings.lorebookName = $(this).val().trim();
        saveSettingsDebounced();
    });

    $('#nlg_clear_trackers').on('click', async function () {
        await clearAllTrackers();
        toastr.info('All NemoLore tracker entries cleared.', 'NemoLore Guides');
    });

    // Rule Setup settings
    $('#nlg_auto_rules').on('change', function () {
        const settings = getGuidesSettings();
        settings.autoGenerateRules = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    // Prompt Stack Advisor
    $('#nlg_run_advisor').on('click', async function () {
        await runPromptAdvisor();
    });

    $('#nlg_apply_recommendations').on('click', async function () {
        await applyAllRecommendations();
    });

    $('#nlg_auto_advisor').on('change', function () {
        const settings = getGuidesSettings();
        settings.autoAdvisor = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#nlg_cleanup_tool_intermediates').on('change', function () {
        const settings = getGuidesSettings();
        settings.cleanupToolCallIntermediates = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#nlg_stealth_tool_calls').on('change', function () {
        const settings = getGuidesSettings();
        settings.stealthToolCalls = !!$(this).prop('checked');
        saveSettingsDebounced();
        registerAllTools();
    });

    $('#nlg_tool_results_variable').on('change', function () {
        const settings = getGuidesSettings();
        settings.toolResultsVariableName = String($(this).val() || '').trim();
        $('#nlg_tool_results_variable').val(getToolResultsVariableName(settings));
        saveSettingsDebounced();
    });

    $('#nlg_preflight_enabled').on('change', function () {
        const settings = getGuidesSettings();
        settings.preflightEnabled = !!$(this).prop('checked');
        saveSettingsDebounced();
        registerAllTools();
    });

    $('#nlg_preflight_replace_tools').on('change', function () {
        const settings = getGuidesSettings();
        settings.preflightReplaceToolCalls = !!$(this).prop('checked');
        saveSettingsDebounced();
        registerAllTools();
    });

    $('#nlg_preflight_require_input').on('change', function () {
        const settings = getGuidesSettings();
        settings.preflightRequireInput = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#nlg_preflight_profile').on('change', function () {
        const settings = getGuidesSettings();
        settings.preflightProfileId = String($(this).val() || '');
        saveSettingsDebounced();
    });

    $('#nlg_preflight_max_tokens').on('input', function () {
        const settings = getGuidesSettings();
        settings.preflightMaxTokens = Math.max(128, parseInt($(this).val()) || 900);
        saveSettingsDebounced();
    });

    $('#nlg_preflight_prompt').on('input', function () {
        const settings = getGuidesSettings();
        settings.preflightPrompt = String($(this).val() || '');
        saveSettingsDebounced();
    });

    $('#nlg_reset_preflight_prompt').on('click', function () {
        const settings = getGuidesSettings();
        settings.preflightPrompt = '';
        $('#nlg_preflight_prompt').val('');
        saveSettingsDebounced();
    });

    $('#nlg_plan_stack_preset').on('change', function () {
        const settings = getGuidesSettings();
        settings.planningPipelinePresetId = String($(this).val() || '');
        saveSettingsDebounced();
    });

    // Writing analysis toggle
    $('#nlg_writing_analysis').on('change', function () {
        const settings = getGuidesSettings();
        settings.writingAnalysis = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#nlg_generate_rules').on('click', async function () {
        toastr.info('Generating story rules...', 'NemoLore Guides');
        try {
            await autoGenerateRules();
            toastr.success('Story rules generated and saved to lorebook.', 'NemoLore Guides');
        } catch (error) {
            console.error(`${LOG_PREFIX} Rule generation failed:`, error);
            toastr.error('Failed to generate story rules. Check the console for details.', 'NemoLore Guides');
        }
    });

    // System instruction settings
    $('#nlg_inject_instruction').on('change', function () {
        const settings = getGuidesSettings();
        settings.injectSystemInstruction = !!$(this).prop('checked');
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#nlg_instruction_position').on('change', function () {
        const settings = getGuidesSettings();
        settings.instructionPosition = $(this).val();
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#nlg_instruction_depth').on('input', function () {
        const settings = getGuidesSettings();
        settings.instructionDepth = parseInt($(this).val()) || 1;
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#nlg_instruction_role').on('change', function () {
        const settings = getGuidesSettings();
        settings.instructionRole = $(this).val();
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#nlg_system_instruction').on('input', function () {
        const settings = getGuidesSettings();
        settings.systemInstruction = $(this).val();
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#nlg_reset_instruction').on('click', function () {
        const settings = getGuidesSettings();
        settings.systemInstruction = '';
        $('#nlg_system_instruction').val('');
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#nlg_add_custom_tool').on('click', function () {
        const settings = getGuidesSettings();
        const tools = normalizeCustomTools(settings.customTools);
        tools.push(createDefaultCustomTool(tools.length + 1));
        settings.customTools = normalizeCustomTools(tools);
        saveSettingsDebounced();
        renderCustomToolsUI(settings);
        registerAllTools();
        updateSystemInstruction();
    });

    $('#nlg_custom_tools').on('input change', '[data-nlg-custom-field]', function (event) {
        const field = $(this).attr('data-nlg-custom-field');
        if (field === 'name' && event.type === 'input') {
            return;
        }

        const card = $(this).closest('.nlg-custom-tool-card');
        const index = Number(card.attr('data-index'));
        const settings = getGuidesSettings();
        const tools = normalizeCustomTools(settings.customTools);
        if (!Number.isInteger(index) || !tools[index]) return;

        if ($(this).attr('type') === 'checkbox') {
            tools[index][field] = !!$(this).prop('checked');
        } else if (field === 'name') {
            tools[index].name = sanitizeCustomToolName($(this).val(), `tool_${index + 1}`);
        } else {
            tools[index][field] = String($(this).val() || '');
        }

        settings.customTools = normalizeCustomTools(tools);
        saveSettingsDebounced();
        registerAllTools();
        updateSystemInstruction();

        if (field === 'name') {
            renderCustomToolsUI(settings);
        }
    });

    $('#nlg_custom_tools').on('click', '.nlg-delete-custom-tool', function () {
        const card = $(this).closest('.nlg-custom-tool-card');
        const index = Number(card.attr('data-index'));
        const settings = getGuidesSettings();
        const tools = normalizeCustomTools(settings.customTools);
        if (!Number.isInteger(index) || !tools[index]) return;

        tools.splice(index, 1);
        settings.customTools = normalizeCustomTools(tools);
        saveSettingsDebounced();
        renderCustomToolsUI(settings);
        registerAllTools();
        updateSystemInstruction();
    });

    // Per-tool settings
    $('.nlg-tool-section').each(function () {
        const section = $(this);
        const toolName = section.data('tool');
        if (!toolName) return;

        section.find('.nlg-tool-enabled').on('change', function () {
            const settings = getGuidesSettings();
            if (!settings?.tools?.[toolName]) return;
            settings.tools[toolName].enabled = !!$(this).prop('checked');
            saveSettingsDebounced();
            registerAllTools();
        });

        // Inject toggle + options visibility
        section.find('.nlg-tool-inject').on('change', function () {
            const settings = getGuidesSettings();
            if (!settings?.tools?.[toolName]) return;
            const checked = !!$(this).prop('checked');
            settings.tools[toolName].injectResult = checked;
            section.find('.nlg-inject-options').toggle(checked);
            saveSettingsDebounced();
        });

        section.find('.nlg-tool-inject-position').on('change', function () {
            const settings = getGuidesSettings();
            if (!settings?.tools?.[toolName]) return;
            settings.tools[toolName].injectPosition = $(this).val();
            saveSettingsDebounced();
        });

        section.find('.nlg-tool-inject-depth').on('input', function () {
            const settings = getGuidesSettings();
            if (!settings?.tools?.[toolName]) return;
            settings.tools[toolName].injectDepth = parseInt($(this).val()) || 1;
            saveSettingsDebounced();
        });

        section.find('.nlg-tool-inject-ephemeral').on('change', function () {
            const settings = getGuidesSettings();
            if (!settings?.tools?.[toolName]) return;
            settings.tools[toolName].injectEphemeral = !!$(this).prop('checked');
            saveSettingsDebounced();
        });

        section.find('.nlg-tool-profile').on('change', function () {
            const settings = getGuidesSettings();
            if (!settings?.tools?.[toolName]) return;
            settings.tools[toolName].profileId = String($(this).val() || '');
            saveSettingsDebounced();
        });

        section.find('.nlg-tool-prompt').on('input', function () {
            const settings = getGuidesSettings();
            if (!settings?.tools?.[toolName]) return;
            settings.tools[toolName].prompt = $(this).val();
            saveSettingsDebounced();
        });

        section.find('.nlg-reset-prompt').on('click', function () {
            const settings = getGuidesSettings();
            if (!settings?.tools?.[toolName]) return;
            settings.tools[toolName].prompt = '';
            section.find('.nlg-tool-prompt').val('');
            saveSettingsDebounced();
        });
    });
}

/**
 * Map position setting string to extension_prompt_types enum.
 */
function updateSystemInstruction() {
    const settings = getGuidesSettings();

    if (!settings?.enabled || !settings?.injectSystemInstruction) {
        clearPromptBlock(PROMPT_KEY);
        return;
    }

    if (!hasAnyEnabledTool(settings)) {
        clearPromptBlock(PROMPT_KEY);
        return;
    }

    const instruction = (settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION) + buildCustomToolsInstruction();
    const position = mapPromptPosition(settings.instructionPosition);
    const depth = settings.instructionDepth ?? 1;
    const role = mapPromptRole(settings.instructionRole);

    applyPromptBlock(PROMPT_KEY, instruction, { position, depth, role });
}

/**
 * Handle generation start — inject system instruction with dynamic tracker status.
 */
async function onGenerationStarted(type, opts, dryRun) {
    if (dryRun) return;

    const settings = getGuidesSettings();
    if (!isStealthFollowupActive()) {
        clearGuidesToolResultsVariable(settings);
    }

    if (!settings?.enabled || !settings?.injectSystemInstruction) {
        clearPromptBlock(PROMPT_KEY);
        return;
    }

    if (!hasAnyEnabledTool(settings)) {
        clearPromptBlock(PROMPT_KEY);
        return;
    }

    // Build the instruction with dynamic tracker status and writing quality warnings
    const baseInstruction = settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
    const customToolsInstruction = buildCustomToolsInstruction();
    const trackerStatus = await buildTrackerStatusMessage();
    const writingWarnings = buildWritingWarnings();
    const fullInstruction = baseInstruction + customToolsInstruction + trackerStatus + writingWarnings;

    const position = mapPromptPosition(settings.instructionPosition);
    const depth = settings.instructionDepth ?? 1;
    const role = mapPromptRole(settings.instructionRole);

    applyPromptBlock(PROMPT_KEY, fullInstruction, { position, depth, role });
}

function hasAnyEnabledTool(settings) {
    return ALL_TOOL_NAMES.some(name => settings.tools?.[name]?.enabled)
        || normalizeCustomTools(settings.customTools).some(tool => tool.enabled);
}

function stripHiddenReasoningBlocks(text) {
    return String(text || '').replace(HIDDEN_REASONING_BLOCK_PATTERN, '').trim();
}

function isRemovableToolIntermediary(message) {
    if (!message || message.is_user || message.is_system) return false;
    if (message.extra?.tool_invocations) return false;

    const visibleContent = stripHiddenReasoningBlocks(message.mes);
    return !visibleContent || visibleContent === '...';
}

async function cleanupThinkingOnlyToolIntermediary(invocations) {
    const settings = getGuidesSettings();
    if (!settings?.enabled || settings.cleanupToolCallIntermediates === false) return;
    if (!Array.isArray(invocations) || !invocations.length) return;
    if (!invocations.every(invocation => isGuidesToolName(invocation?.name))) return;

    const toolResultIndex = chat.length - 1;
    const toolResultMessage = chat[toolResultIndex];
    if (!toolResultMessage?.extra?.tool_invocations) return;

    const candidateIndex = toolResultIndex - 1;
    const candidate = chat[candidateIndex];
    if (!isRemovableToolIntermediary(candidate)) return;

    try {
        await deleteMessage(candidateIndex, undefined, false);
        console.debug(`${LOG_PREFIX} Removed thinking-only tool-call intermediary message.`);
    } catch (error) {
        console.warn(`${LOG_PREFIX} Failed to remove tool-call intermediary message`, error);
    }
}

/**
 * Handle chat change — detect new chats and wipe trackers.
 */
async function onChatChanged() {
    const settings = getGuidesSettings();
    if (!settings?.enabled) return;

    const context = getContext();
    const currentChatId = context?.chatId || null;

    if (!currentChatId) return;

    // Detect new chat: chat ID changed AND chat has 0-1 messages (just greeting or empty)
    const isNewChat = currentChatId !== lastChatId;
    lastChatId = currentChatId;

    if (isNewChat) {
        // Reset advisor state so stale recommendations don't carry over
        resetAdvisorState();

        const chatLength = context.chat?.filter(m => !m.is_system)?.length || 0;
        if (chatLength <= 1) {
            console.log(`${LOG_PREFIX} New chat detected — wiping tracker entries.`);
            await clearAllTrackers();

            // Auto-run prompt stack advisor only on truly fresh chats.
            const settings = getGuidesSettings();
            if (settings?.autoAdvisor) {
                setTimeout(() => {
                    runPromptAdvisor().catch(err => {
                        console.error(`${LOG_PREFIX} Auto prompt stack advisor failed:`, err);
                    });
                }, 2000);
            }
        }
    }
}

/**
 * Handle first user message — wipe trackers if this is the first real message.
 * This catches the case where the user sends the first message in a brand new chat.
 */
async function onFirstMessage() {
    const settings = getGuidesSettings();
    if (!settings?.enabled) return;

    const context = getContext();

    // Count non-system messages. If this is the first user message (greeting + 1 user msg = 2 total),
    // run parallel setup for a fresh start.
    const userMessages = context.chat?.filter(m => m.is_user && !m.is_system)?.length || 0;
    if (userMessages === 1) {
        console.log(`${LOG_PREFIX} First message in chat — running parallel fresh-chat setup.`);
        await clearAllTrackers();

        // Run Rule Setup + Scene Assessment + DM Notes in parallel via ConnectionPool
        // This populates all trackers BEFORE the main generation, so the AI sees them
        // in context and just writes its response normally (no tool calls needed).
        try {
            const success = await runFreshChatSetup();
            if (success) {
                console.log(`${LOG_PREFIX} Fresh-chat setup complete — trackers populated.`);
            } else {
                console.warn(`${LOG_PREFIX} Parallel setup unavailable — AI will use tool calls instead.`);
                // Fallback: initialize DM notes scratchpad at minimum
                initDMNotes().catch(err => {
                    console.error(`${LOG_PREFIX} DM notes initialization failed:`, err);
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Fresh-chat setup failed:`, error);
        }
    }
}

/**
 * Initialize the extension.
 */
export async function initGuides() {
    console.log(`${LOG_PREFIX} Initializing...`);

    // Load settings
    loadSettings();

    // Bind settings events and populate UI (always - so users can toggle the feature)
    bindSettingsEvents();
    updateSettingsUI();

    // Always wire event listeners — handlers check settings.enabled internally
    if (event_types.GENERATION_STARTED) {
        registerGuidesEventHandler(event_types.GENERATION_STARTED, onGenerationStarted);
    }

    if (event_types.GENERATION_AFTER_COMMANDS) {
        registerGuidesEventHandler(event_types.GENERATION_AFTER_COMMANDS, runSilentPreflight);
    }

    if (event_types.TOOL_CALLS_PERFORMED) {
        registerGuidesEventHandler(event_types.TOOL_CALLS_PERFORMED, cleanupThinkingOnlyToolIntermediary);
    }

    registerGuidesEventHandler(event_types.CHAT_CHANGED, async () => {
        const s = getGuidesSettings();
        if (!s?.enabled) return;
        registerAllTools();
        updateSystemInstruction();
        await onChatChanged();
    });

    if (event_types.MESSAGE_SENT) {
        registerGuidesEventHandler(event_types.MESSAGE_SENT, onFirstMessage);
    }

    // Check if guides are enabled — if not, stop here (settings panel is still visible)
    const settings = getGuidesSettings();
    if (!settings?.enabled) {
        console.log(`${LOG_PREFIX} Settings panel loaded (guides disabled — enable in settings to activate).`);
        return;
    }

    // Initialize activity feed widget
    initActivityFeed();

    // Register tools
    registerAllTools();

    // Set initial system instruction
    updateSystemInstruction();

    // Ensure the NLG lorebook exists on startup
    await ensureBookExists();

    console.log(`${LOG_PREFIX} Extension loaded successfully.`);
}

export function cleanupGuides() {
    while (registeredEventHandlers.length) {
        const [eventName, handler] = registeredEventHandlers.pop();
        eventSource.removeListener(eventName, handler);
    }
    clearPromptBlock(PROMPT_KEY);
    unregisterAllTools();
    lastChatId = null;
}


