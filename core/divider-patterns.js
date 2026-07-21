import { extension_settings } from '../../../../extensions.js';
import { NEMO_EXTENSION_NAME } from './utils.js';

export const BUILT_IN_DIVIDER_PATTERNS = Object.freeze(['=+', '\u2b50\u2500+', '\u2501+']);

export function getCustomDividerPatterns() {
    return String(extension_settings[NEMO_EXTENSION_NAME]?.dividerRegexPattern ?? '')
        .split(',')
        .map(pattern => pattern.trim())
        .filter(Boolean);
}

export function validateDividerPatterns(patterns = getCustomDividerPatterns()) {
    for (const pattern of patterns) new RegExp(pattern);
    return [...new Set([...BUILT_IN_DIVIDER_PATTERNS, ...patterns])];
}
