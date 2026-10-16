/**
 * Recognize generated, inert loader placeholders despite presentation changes.
 * Never use this comparison for executable controls or stored source integrity.
 */
export function matchesRuntimeLoader(content, expected) {
    if (typeof content !== 'string' || typeof expected !== 'string') return false;
    if (content === expected) return true;
    const normalize = text => text
        .replace(/\{\{\/\/[^{}]*\}\}|\{\{trim\}\}/g, '')
        .replace(/[\s\u2800]+/g, ' ')
        .trim();
    return normalize(content) === normalize(expected);
}
