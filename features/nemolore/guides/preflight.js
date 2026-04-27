/**
 * Silent preflight guide generation.
 *
 * This is the non-tool-call lane: before the normal response is assembled,
 * NemoLore can run a hidden guide pass through a selected Connection Manager
 * profile and expose the result through the Nemo Engine core-pack variable.
 */

import { getContext } from '../../../../../../extensions.js';
import { DEFAULT_SYSTEM_INSTRUCTION } from './prompts.js';
import { runSidecarGeneration, gatherContext } from './sidecar.js';
import {
    clearGuidesToolResultsVariable,
    getGuidesSettings,
    getToolResultsVariableName,
    isStealthFollowupActive,
} from './tool-registry.js';
import { setGlobalPromptVariable } from '../shared/variable-service.js';

const LOG_PREFIX = '[NemoLore:Guides:Preflight]';
const TOOL_NAME = 'NLG_silent_preflight';
const DEFAULT_MAX_TOKENS = 900;
const VARIABLE_LIMIT = 12000;

export const DEFAULT_PREFLIGHT_PROMPT = `[OOC: You are NemoLore Guides running a silent preflight pass before the main roleplay response.
Do NOT write the final response. Produce compact, actionable guidance for the next response only.

Use the latest user message, recent chat, and active story context to decide what would help the main model.
Prioritize:
- scene state: location, character positions, clothing, physical/emotional state
- continuity: recent facts, promises, threats, unresolved plot threads
- response planning: likely beats, constraints, pacing, and character voice
- quality warnings: repetition, user-autonomy risks, lore contradictions

If no extra guidance is needed, say "No special guidance." Do not mention tool calls.

Latest user message:
{{input}}

Recent context:
{{recent}}

Available Guides capabilities for reference:
{{guides}}]`;

let preflightRunning = false;

export function isPreflightRunning() {
    return preflightRunning;
}

export async function runSilentPreflight(type, opts, dryRun) {
    if (dryRun || preflightRunning || isStealthFollowupActive()) return;
    if (type !== undefined && type !== 'normal') return;

    const settings = getGuidesSettings();
    if (!settings?.enabled || !settings.preflightEnabled) return;

    const userInput = getPendingUserInput();
    if (!userInput && settings.preflightRequireInput !== false) return;

    preflightRunning = true;
    try {
        const variableName = getToolResultsVariableName(settings);
        const output = await runSidecarGeneration({
            prompt: buildPreflightPrompt(settings, userInput),
            profileId: settings.preflightProfileId || '',
            toolName: TOOL_NAME,
            toolParams: { mode: 'silent-preflight' },
            maxTokens: Number(settings.preflightMaxTokens) || DEFAULT_MAX_TOKENS,
            injectEphemeral: false,
            extraStorageInfo: [`Global variable: ${variableName}`],
        });

        const value = formatPreflightResult(output);
        setGlobalPromptVariable(variableName, trimVariable(value));
        console.debug(`${LOG_PREFIX} Wrote silent preflight result to ${variableName}.`);
    } catch (error) {
        clearGuidesToolResultsVariable(settings);
        console.error(`${LOG_PREFIX} Silent preflight failed`, error);
    } finally {
        preflightRunning = false;
    }
}

function getPendingUserInput() {
    const input = document.getElementById('send_textarea');
    if (input && 'value' in input) {
        return String(input.value || '').trim();
    }

    const context = getContext();
    const lastUser = [...(context.chat || [])].reverse().find(message => message?.is_user && !message?.is_system);
    return String(lastUser?.mes || '').trim();
}

function buildPreflightPrompt(settings, userInput) {
    const { recentMessages } = gatherContext(12);
    const template = String(settings.preflightPrompt || DEFAULT_PREFLIGHT_PROMPT);
    return template
        .replaceAll('{{input}}', userInput || '(No pending user input.)')
        .replaceAll('{{recent}}', recentMessages || '(No recent chat context.)')
        .replaceAll('{{guides}}', DEFAULT_SYSTEM_INSTRUCTION);
}

function formatPreflightResult(output) {
    return [
        '[NemoLore Guides silent preflight]',
        'Use this as hidden guidance for the next response. Do not mention this block.',
        '',
        String(output || '').trim() || 'No special guidance.',
    ].join('\n');
}

function trimVariable(value) {
    const text = String(value || '');
    if (text.length <= VARIABLE_LIMIT) return text;
    return `[Earlier NemoLore Guides preflight output truncated]\n${text.slice(-VARIABLE_LIMIT)}`;
}
