/**
 * Tool Registry
 * Registers and unregisters all NemoLore Guides tools with ST's ToolManager.
 * Built-in tools: Rule Setup, Scene Assessment, Plan & Refine, Polish Prose,
 * Writing Check, DM Notes, and Roll Dice. User-defined template tools are
 * registered dynamically from settings.
 */

import { ToolManager } from '../../../../../../tool-calling.js';
import { Generate, chat, deleteMessage } from '../../../../../../../script.js';
import { getNemoLoreSettings } from '../settings.js';
import { GUIDES_TOOL_RESULTS_VARIABLE_NAME } from '../constants.js';
import {
    clearGlobalPromptVariable,
    getGlobalPromptVariable,
    normalizePromptVariableName,
    setGlobalPromptVariable,
} from '../shared/variable-service.js';

import { TOOL_NAME as SCENE_NAME, getDefinition as getSceneDef } from './tools/scene-assessment.js';
import { TOOL_NAME as PLAN_NAME, getDefinition as getPlanDef } from './tools/plan-and-refine.js';
import { TOOL_NAME as POLISH_NAME, getDefinition as getPolishDef } from './tools/polish-prose.js';
import { TOOL_NAME as RULES_NAME, getDefinition as getRulesDef } from './tools/rule-setup.js';
import { TOOL_NAME as WRITING_NAME, getDefinition as getWritingDef } from './tools/writing-check.js';
import { TOOL_NAME as DM_NAME, getDefinition as getDMDef } from './tools/dm-notes.js';
import { TOOL_NAME as DICE_NAME, getDefinition as getDiceDef } from './tools/roll-dice.js';
import {
    getCustomToolDefinitions,
    getCustomToolDisplayName,
    getCustomToolNames,
    isCustomToolName,
} from './custom-tools.js';

const LOG_PREFIX = '[NemoLore:Guides]';
export const GUIDES_SETTINGS_KEY = 'guides';
const STEALTH_FOLLOWUP_DELAY_MS = 350;
const TOOL_RESULTS_VARIABLE_LIMIT = 12000;
const HIDDEN_REASONING_BLOCK_PATTERN = /<(think|cot)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Built-in tool names for settings migrations and bulk operations. */
export const ALL_TOOL_NAMES = [RULES_NAME, SCENE_NAME, PLAN_NAME, POLISH_NAME, WRITING_NAME, DM_NAME, DICE_NAME];

/** Map of tool name to definition getter. */
const TOOL_DEFS = {
    [RULES_NAME]: getRulesDef,
    [SCENE_NAME]: getSceneDef,
    [PLAN_NAME]: getPlanDef,
    [POLISH_NAME]: getPolishDef,
    [WRITING_NAME]: getWritingDef,
    [DM_NAME]: getDMDef,
    [DICE_NAME]: getDiceDef,
};

/** Human-readable display names for settings UI. */
export const TOOL_DISPLAY_NAMES = {
    [RULES_NAME]: 'Rule Setup',
    [SCENE_NAME]: 'Scene Assessment',
    [PLAN_NAME]: 'Plan & Refine',
    [POLISH_NAME]: 'Polish Prose',
    [WRITING_NAME]: 'Writing Check',
    [DM_NAME]: 'DM Notes',
    [DICE_NAME]: 'Roll Dice',
};

let lastRegisteredCustomToolNames = [];
let stealthFollowupTimer = null;
let stealthFollowupRunning = false;
let suppressToolsForStealthFollowup = false;
let activeToolResultsVariableName = GUIDES_TOOL_RESULTS_VARIABLE_NAME;

/** Default settings for a single tool. */
export function getDefaultToolSettings() {
    return {
        enabled: true,
        profileId: '',
        prompt: '',
        // Injection settings
        injectResult: false,
        injectPosition: 'chat',
        injectDepth: 1,
        injectRole: 'system',
        injectEphemeral: true,
        injectScan: false,
    };
}

/** Default settings for the entire extension. */
export function getDefaultSettings() {
    const tools = {};
    for (const name of ALL_TOOL_NAMES) {
        tools[name] = getDefaultToolSettings();
    }
    return {
        enabled: false,
        tools,
        customTools: [],
        stealthToolCalls: true,
        toolResultsVariableName: GUIDES_TOOL_RESULTS_VARIABLE_NAME,
        preflightEnabled: false,
        preflightReplaceToolCalls: true,
        preflightRequireInput: true,
        preflightProfileId: '',
        preflightMaxTokens: 900,
        preflightPrompt: '',
        cleanupToolCallIntermediates: true,
        planningPipelinePresetId: '',
    };
}

export function getGuidesSettings() {
    const loreSettings = getNemoLoreSettings();
    if (!loreSettings[GUIDES_SETTINGS_KEY]) {
        loreSettings[GUIDES_SETTINGS_KEY] = getDefaultSettings();
    }
    return loreSettings[GUIDES_SETTINGS_KEY];
}

export function getRegisteredToolNames() {
    return [...ALL_TOOL_NAMES, ...getCustomToolNames()];
}

export function isGuidesToolName(name) {
    return ALL_TOOL_NAMES.includes(name) || isCustomToolName(name);
}

export function getToolDisplayName(name) {
    if (TOOL_DISPLAY_NAMES[name]) {
        return TOOL_DISPLAY_NAMES[name];
    }
    return getCustomToolDisplayName(name);
}

export function isStealthFollowupActive() {
    return stealthFollowupRunning || suppressToolsForStealthFollowup;
}

export function getToolResultsVariableName(settings = getGuidesSettings()) {
    const variableName = normalizePromptVariableName(
        settings?.toolResultsVariableName,
        GUIDES_TOOL_RESULTS_VARIABLE_NAME,
    );
    if (settings && settings.toolResultsVariableName !== variableName) {
        settings.toolResultsVariableName = variableName;
    }
    return variableName;
}

export function clearGuidesToolResultsVariable(settings = getGuidesSettings()) {
    clearGlobalPromptVariable(getToolResultsVariableName(settings));
}

/**
 * Get settings for a specific tool.
 * @param {string} toolName
 * @returns {object}
 */
export function getToolSettings(toolName) {
    const settings = getGuidesSettings();
    if (!settings?.enabled) {
        return { enabled: false, profileId: '', prompt: '' };
    }
    return settings.tools?.[toolName] || getDefaultToolSettings();
}

/**
 * Register all enabled tools with ToolManager.
 */
export function registerAllTools() {
    unregisterAllTools();

    const settings = getGuidesSettings();
    if (!settings?.enabled) {
        console.log(`${LOG_PREFIX} Extension disabled, skipping tool registration.`);
        return;
    }

    if (settings.preflightEnabled && settings.preflightReplaceToolCalls !== false) {
        console.log(`${LOG_PREFIX} Silent preflight mode enabled, skipping native tool registration.`);
        return;
    }

    let registered = 0;
    for (const [name, getDefFn] of Object.entries(TOOL_DEFS)) {
        try {
            const def = wrapToolDefinition(getDefFn());
            ToolManager.registerFunctionTool(def);
            registered++;
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to register tool "${name}":`, error);
        }
    }

    const customDefs = getCustomToolDefinitions();
    lastRegisteredCustomToolNames = customDefs.map(def => def.name);
    for (const def of customDefs) {
        try {
            ToolManager.registerFunctionTool(wrapToolDefinition(def));
            registered++;
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to register custom tool "${def.name}":`, error);
        }
    }

    console.log(`${LOG_PREFIX} Registered ${registered}/${ALL_TOOL_NAMES.length + customDefs.length} tools.`);
}

/**
 * Unregister all tools from ToolManager.
 */
export function unregisterAllTools() {
    const names = new Set([
        ...ALL_TOOL_NAMES,
        ...lastRegisteredCustomToolNames,
        ...getCustomToolNames(),
    ]);

    for (const name of names) {
        ToolManager.unregisterFunctionTool(name);
    }

    lastRegisteredCustomToolNames = [];
}

function wrapToolDefinition(definition) {
    const settings = getGuidesSettings();
    const stealthEnabled = settings.stealthToolCalls !== false;
    const originalAction = definition.action;
    const originalShouldRegister = definition.shouldRegister;

    return {
        ...definition,
        stealth: stealthEnabled,
        shouldRegister: async () => {
            if (suppressToolsForStealthFollowup) {
                return false;
            }
            return typeof originalShouldRegister === 'function'
                ? await originalShouldRegister()
                : true;
        },
        action: async (params = {}) => {
            const result = await originalAction(params);
            if (getGuidesSettings().stealthToolCalls !== false) {
                persistStealthToolResult(definition, params, result);
            }
            return result;
        },
    };
}

function persistStealthToolResult(definition, params, result) {
    try {
        const settings = getGuidesSettings();
        const variableName = getToolResultsVariableName(settings);
        activeToolResultsVariableName = variableName;

        const entry = formatToolResultForVariable(definition, params, result);
        const current = getGlobalPromptVariable(variableName).trim();
        const next = trimToolResultsVariable([current, entry].filter(Boolean).join('\n\n---\n\n'));
        setGlobalPromptVariable(variableName, next);
        scheduleStealthFollowup();
    } catch (error) {
        console.error(`${LOG_PREFIX} Failed to persist stealth tool result`, error);
    }
}

function formatToolResultForVariable(definition, params, result) {
    const displayName = definition.displayName || getToolDisplayName(definition.name) || definition.name;
    const serializedParams = JSON.stringify(params || {}, null, 2);
    const serializedResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

    return [
        '[NemoLore Guides tool result]',
        `Tool: ${displayName} (${definition.name})`,
        `Time: ${new Date().toISOString()}`,
        '',
        'Parameters:',
        serializedParams,
        '',
        'Result:',
        serializedResult || '[No content]',
        '',
        'Instruction: Use this result in the next response. Do not call the same tool again just to retrieve this result.',
    ].join('\n');
}

function trimToolResultsVariable(value) {
    const text = String(value || '');
    if (text.length <= TOOL_RESULTS_VARIABLE_LIMIT) {
        return text;
    }
    return `[Earlier NemoLore Guides tool results truncated]\n${text.slice(-TOOL_RESULTS_VARIABLE_LIMIT)}`;
}

function scheduleStealthFollowup() {
    if (stealthFollowupTimer || stealthFollowupRunning) return;
    stealthFollowupTimer = setTimeout(() => {
        stealthFollowupTimer = null;
        runStealthFollowup().catch(error => {
            console.error(`${LOG_PREFIX} Stealth follow-up generation failed`, error);
        });
    }, STEALTH_FOLLOWUP_DELAY_MS);
}

async function runStealthFollowup() {
    const settings = getGuidesSettings();
    if (!settings?.enabled || settings.stealthToolCalls === false) return;

    stealthFollowupRunning = true;
    suppressToolsForStealthFollowup = true;
    try {
        await removeThinkingOnlyStealthIntermediary();
        await Generate('normal', { depth: 1 });
    } finally {
        clearGlobalPromptVariable(activeToolResultsVariableName || getToolResultsVariableName(settings));
        suppressToolsForStealthFollowup = false;
        stealthFollowupRunning = false;
    }
}

async function removeThinkingOnlyStealthIntermediary() {
    const candidateIndex = chat.length - 1;
    const candidate = chat[candidateIndex];
    if (!isRemovableToolIntermediary(candidate)) return;

    try {
        await deleteMessage(candidateIndex, undefined, false);
    } catch (error) {
        console.warn(`${LOG_PREFIX} Failed to remove stealth tool-call intermediary`, error);
    }
}

function isRemovableToolIntermediary(message) {
    if (!message || message.is_user || message.is_system) return false;
    if (message.extra?.tool_invocations) return false;

    const visibleContent = String(message.mes || '').replace(HIDDEN_REASONING_BLOCK_PATTERN, '').trim();
    return !visibleContent || visibleContent === '...';
}
