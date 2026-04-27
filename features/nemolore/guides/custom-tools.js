/**
 * User-defined Guides tools.
 *
 * These are intentionally template-based. Users can define tool names,
 * descriptions, and returned text without granting arbitrary code execution.
 */

import { getNemoLoreSettings } from '../settings.js';

export const CUSTOM_TOOL_PREFIX = 'NLG_custom_';

const GUIDES_SETTINGS_KEY = 'guides';
const MAX_CUSTOM_TOOLS = 25;
const MAX_TEMPLATE_LENGTH = 4000;
const FALLBACK_TEMPLATE = 'Custom tool result for {{tool_display_name}}:\n{{input}}';

export function createDefaultCustomTool(index = 1) {
    const suffix = `tool_${index}`;
    return {
        id: createId(),
        name: `${CUSTOM_TOOL_PREFIX}${suffix}`,
        displayName: `Custom Tool ${index}`,
        description: 'Describe when the model should call this tool.',
        inputDescription: 'The information this tool needs from the model.',
        responseTemplate: FALLBACK_TEMPLATE,
        enabled: true,
    };
}

export function normalizeCustomTools(tools = []) {
    if (!Array.isArray(tools)) {
        return [];
    }

    const seen = new Set();
    return tools
        .slice(0, MAX_CUSTOM_TOOLS)
        .map((tool, index) => normalizeCustomTool(tool, index + 1, seen));
}

export function getCustomTools() {
    const loreSettings = getNemoLoreSettings();
    const settings = loreSettings?.[GUIDES_SETTINGS_KEY];
    return normalizeCustomTools(settings?.customTools || []);
}

export function getCustomToolNames() {
    return getCustomTools().map(tool => tool.name);
}

export function getCustomToolDisplayName(name) {
    const tool = getCustomTools().find(item => item.name === name);
    return tool?.displayName || name;
}

export function getCustomToolDefinitions() {
    return getCustomTools()
        .filter(tool => tool.enabled)
        .map(tool => ({
            name: tool.name,
            displayName: tool.displayName || tool.name,
            description: tool.description || 'User-defined NemoLore tool.',
            parameters: {
                type: 'object',
                properties: {
                    input: {
                        type: 'string',
                        description: tool.inputDescription || 'Information the tool needs from the model.',
                    },
                },
                required: [],
            },
            action: params => runCustomTool(tool, params),
            formatMessage: ({ input } = {}) => `Running ${tool.displayName || tool.name}${input ? `: ${truncate(input, 60)}` : ''}...`,
            shouldRegister: () => tool.enabled,
        }));
}

export function isCustomToolName(name) {
    return typeof name === 'string' && name.startsWith(CUSTOM_TOOL_PREFIX);
}

export function sanitizeCustomToolName(value, fallback = 'tool') {
    const raw = String(value || '')
        .trim()
        .replace(new RegExp(`^${CUSTOM_TOOL_PREFIX}`, 'i'), '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48);

    const suffix = raw || fallback;
    return `${CUSTOM_TOOL_PREFIX}${suffix}`.slice(0, 64);
}

export function buildCustomToolsInstruction() {
    const tools = getCustomTools().filter(tool => tool.enabled);
    if (!tools.length) {
        return '';
    }

    const lines = [
        '',
        '**Custom Tools** — User-defined safe template tools:',
    ];

    for (const tool of tools) {
        const display = tool.displayName || tool.name;
        const description = tool.description || 'User-defined tool.';
        lines.push(`- ${tool.name} (${display}): ${description}`);
    }

    lines.push('- Custom tools return template-based text. Read their result and use it as context for your next response.');
    return `\n${lines.join('\n')}`;
}

function normalizeCustomTool(tool, index, seen) {
    const fallback = `tool_${index}`;
    const candidateName = sanitizeCustomToolName(tool?.name || tool?.displayName || fallback, fallback);
    const name = uniqueName(candidateName, seen);

    return {
        id: String(tool?.id || createId()),
        name,
        displayName: truncate(String(tool?.displayName || `Custom Tool ${index}`), 80),
        description: truncate(String(tool?.description || 'Describe when the model should call this tool.'), 500),
        inputDescription: truncate(String(tool?.inputDescription || 'The information this tool needs from the model.'), 300),
        responseTemplate: truncate(String(tool?.responseTemplate || FALLBACK_TEMPLATE), MAX_TEMPLATE_LENGTH),
        enabled: tool?.enabled !== false,
    };
}

function uniqueName(name, seen) {
    if (!seen.has(name)) {
        seen.add(name);
        return name;
    }

    const base = name.slice(0, 57);
    let suffix = 2;
    let candidate = `${base}_${suffix}`;
    while (seen.has(candidate)) {
        suffix++;
        candidate = `${base}_${suffix}`;
    }

    seen.add(candidate);
    return candidate;
}

function runCustomTool(tool, params = {}) {
    const input = params?.input === undefined ? '' : String(params.input);
    const replacements = {
        input,
        json: JSON.stringify(params || {}, null, 2),
        tool_name: tool.name,
        tool_display_name: tool.displayName || tool.name,
        timestamp: new Date().toISOString(),
    };

    const template = String(tool.responseTemplate || FALLBACK_TEMPLATE);
    return template.replace(/{{\s*(input|json|tool_name|tool_display_name|timestamp)\s*}}/g, (_, key) => replacements[key] ?? '');
}

function createId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function truncate(value, max) {
    return value.length > max ? value.slice(0, max) : value;
}
