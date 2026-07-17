const UNSAFE_PRESET_NAMES = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isSafePresetName(value) {
    return typeof value === 'string'
        && value.length > 0
        && value === value.trim()
        && !UNSAFE_PRESET_NAMES.has(value);
}

/**
 * Validate untrusted preset JSON and copy it into a prototype-free map.
 *
 * @param {unknown} value
 * @returns {Record<string, string[]> | null}
 */
export function normalizePresetMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const normalized = Object.create(null);
    for (const [presetName, lorebookNames] of Object.entries(value)) {
        if (!isSafePresetName(presetName)) return null;
        if (!Array.isArray(lorebookNames) || lorebookNames.some(name => typeof name !== 'string')) {
            return null;
        }
        normalized[presetName] = [...lorebookNames];
    }

    return normalized;
}
