/**
 * Polish Prose Tool (Auditor Gremlin)
 * Line-edits and refines prose for quality.
 */

import { runSidecarGeneration, getToolInjectionConfig } from '../sidecar.js';
import { DEFAULT_PROMPTS } from '../prompts.js';
import { getToolSettings } from '../tool-registry.js';

export const TOOL_NAME = 'NG_polish_prose';

export function getDefinition() {
    const settings = getToolSettings(TOOL_NAME);
    return {
        name: TOOL_NAME,
        displayName: 'Polish Prose',
        description: 'Line-edit and refine prose text — fix awkward phrasing, eliminate repetition, enhance evocative language, and improve flow while maintaining character voice. Use this to polish a draft response before presenting it.',
        parameters: {
            type: 'object',
            properties: {
                text: {
                    type: 'string',
                    description: 'The prose text to polish and refine',
                },
            },
            required: ['text'],
        },
        action: execute,
        formatMessage: () => 'Polishing prose...',
        shouldRegister: () => getToolSettings(TOOL_NAME).enabled,
        stealth: settings.stealth,
    };
}

async function execute({ text } = {}) {
    if (!text) {
        return 'Error: No text provided to polish. Pass the prose in the "text" parameter.';
    }

    const settings = getToolSettings(TOOL_NAME);
    const template = settings.prompt || DEFAULT_PROMPTS.polish_prose;
    const prompt = template.replace('{{TEXT}}', text);

    return await runSidecarGeneration({
        prompt,
        preset: settings.preset || undefined,
        toolName: TOOL_NAME,
        toolParams: { text: text?.substring(0, 60) },
        inject: getToolInjectionConfig(TOOL_NAME),
    });
}
