/**
 * Tool Registry
 * Registers and unregisters all NemosGuides tools with ST's ToolManager.
 * 4 tools: Rule Setup, Scene Assessment, Plan & Refine, Polish Prose.
 */

import { ToolManager } from '../../../../../tool-calling.js';
import { extension_settings } from '../../../../../extensions.js';

import { TOOL_NAME as SCENE_NAME, getDefinition as getSceneDef } from './tools/scene-assessment.js';
import { TOOL_NAME as PLAN_NAME, getDefinition as getPlanDef } from './tools/plan-and-refine.js';
import { TOOL_NAME as POLISH_NAME, getDefinition as getPolishDef } from './tools/polish-prose.js';
import { TOOL_NAME as RULES_NAME, getDefinition as getRulesDef } from './tools/rule-setup.js';
import { TOOL_NAME as WRITING_NAME, getDefinition as getWritingDef } from './tools/writing-check.js';
import { TOOL_NAME as DM_NAME, getDefinition as getDMDef } from './tools/dm-notes.js';

const LOG_PREFIX = '[NemosGuides]';
export const EXTENSION_NAME = 'NemosGuides';

/** All tool names for bulk operations. */
export const ALL_TOOL_NAMES = [RULES_NAME, SCENE_NAME, PLAN_NAME, POLISH_NAME, WRITING_NAME, DM_NAME];

/** Map of tool name to definition getter. */
const TOOL_DEFS = {
    [RULES_NAME]: getRulesDef,
    [SCENE_NAME]: getSceneDef,
    [PLAN_NAME]: getPlanDef,
    [POLISH_NAME]: getPolishDef,
    [WRITING_NAME]: getWritingDef,
    [DM_NAME]: getDMDef,
};

/** Human-readable display names for settings UI. */
export const TOOL_DISPLAY_NAMES = {
    [RULES_NAME]: 'Rule Setup',
    [SCENE_NAME]: 'Scene Assessment',
    [PLAN_NAME]: 'Plan & Refine',
    [POLISH_NAME]: 'Polish Prose',
    [WRITING_NAME]: 'Writing Check',
    [DM_NAME]: 'DM Notes',
};

/** Default settings for a single tool. */
export function getDefaultToolSettings() {
    return {
        enabled: true,
        stealth: false,
        preset: '',
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
    // DM Notes defaults to stealth — updates are best kept silent
    tools[DM_NAME].stealth = true;

    return {
        enabled: true,
        tools,
    };
}

/**
 * Get settings for a specific tool.
 * @param {string} toolName
 * @returns {object}
 */
export function getToolSettings(toolName) {
    const settings = extension_settings[EXTENSION_NAME];
    if (!settings?.enabled) {
        return { enabled: false, stealth: true, preset: '', prompt: '' };
    }
    return settings.tools?.[toolName] || getDefaultToolSettings();
}

/**
 * Register all enabled tools with ToolManager.
 */
export function registerAllTools() {
    unregisterAllTools();

    const settings = extension_settings[EXTENSION_NAME];
    if (!settings?.enabled) {
        console.log(`${LOG_PREFIX} Extension disabled, skipping tool registration.`);
        return;
    }

    let registered = 0;
    for (const [name, getDefFn] of Object.entries(TOOL_DEFS)) {
        try {
            const def = getDefFn();
            ToolManager.registerFunctionTool(def);
            registered++;
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to register tool "${name}":`, error);
        }
    }

    console.log(`${LOG_PREFIX} Registered ${registered}/${ALL_TOOL_NAMES.length} tools.`);
}

/**
 * Unregister all tools from ToolManager.
 */
export function unregisterAllTools() {
    for (const name of ALL_TOOL_NAMES) {
        ToolManager.unregisterFunctionTool(name);
    }
}
