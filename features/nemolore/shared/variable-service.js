import { extension_settings } from '../../../../../../extensions.js';
import { getGlobalVariable, setGlobalVariable } from '../../../../../../variables.js';

const VARIABLE_NAME_PATTERN = /^[A-Za-z0-9_.:-]+$/;

function ensureGlobalVariableStore() {
    extension_settings.variables = extension_settings.variables || {};
    extension_settings.variables.global = extension_settings.variables.global || {};
}

export function normalizePromptVariableName(name, fallback) {
    const value = String(name || '').trim();
    if (value && VARIABLE_NAME_PATTERN.test(value)) {
        return value;
    }
    return fallback;
}

export function setGlobalPromptVariable(name, value) {
    ensureGlobalVariableStore();
    setGlobalVariable(name, String(value || ''));
}

export function clearGlobalPromptVariable(name) {
    if (!name) return;
    setGlobalPromptVariable(name, '');
}

export function getGlobalPromptVariable(name) {
    ensureGlobalVariableStore();
    return String(getGlobalVariable(name) || '');
}
