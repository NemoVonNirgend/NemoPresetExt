import {
    extension_prompt_roles,
    extension_prompt_types,
    setExtensionPrompt,
} from '/script.js';

export function applyPromptBlock(tag, text, {
    position = extension_prompt_types.IN_CHAT,
    depth = 0,
    role = extension_prompt_roles.SYSTEM,
} = {}) {
    const resolvedPosition = typeof position === 'string' ? mapPromptPosition(position) : position;
    const resolvedRole = typeof role === 'string' ? mapPromptRole(role) : role;
    setExtensionPrompt(tag, text || '', resolvedPosition, depth, false, resolvedRole);
}

export function clearPromptBlock(tag, options = {}) {
    applyPromptBlock(tag, '', options);
}

export function mapPromptPosition(value) {
    switch (value) {
        case 'in_prompt':
            return extension_prompt_types.IN_PROMPT;
        case 'before_prompt':
            return extension_prompt_types.BEFORE_PROMPT;
        case 'in_chat':
        default:
            return extension_prompt_types.IN_CHAT;
    }
}

export function mapPromptRole(value) {
    switch (value) {
        case 'user':
            return extension_prompt_roles.USER;
        case 'assistant':
            return extension_prompt_roles.ASSISTANT;
        case 'system':
        default:
            return extension_prompt_roles.SYSTEM;
    }
}
