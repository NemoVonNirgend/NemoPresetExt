import { matchedUserFilePath } from '../../core/user-file-path.js';
/** Stage 3/5: reversible ordinary-prompt storage. Never evaluates prompt macros. */
export const BODY_KEY = 'nemoPromptBody';
export const SCHEMA = 1;
export const MAX_BODY_CHARS = 2 * 1024 * 1024;
export const MAX_SHELL_CHARS = 65536;
const HEX = /^[a-f0-9]{64}$/;
const WARNING = '\n[NemoPresetExt: this prompt is stored externally. Enable the extension or restore a portable export before generating.]';

export function shellFor(content) {
    const blocks = [];
    const leading = /^\s*(\{\{\/\/[\s\S]*?\}\})/.exec(content)?.[1];
    if (leading) blocks.push(leading);
    const comments = /\{\{\/\/([\s\S]*?)\}\}/g;
    let match;
    while ((match = comments.exec(content))) {
        if (match.index === content.indexOf(leading) && match[0] === leading) continue;
        if (match[1].split(/\r?\n/).some(line => line.trim().startsWith('@'))) blocks.push(match[0]);
    }
    return blocks.join('\n') + WARNING;
}

export function descriptorOf(prompt) {
    return prompt?.[BODY_KEY] ?? null;
}
export function checkedDescriptor(d) {
    const sha256 = d?.ref?.sha256;
    const name = HEX.test(sha256 ?? '') ? `nemo-prompts-${sha256}.json` : '';
    if (!d || d.schema !== SCHEMA || !HEX.test(sha256 ?? '') ||
        !matchedUserFilePath(d.ref?.path, name) ||
        !Number.isSafeInteger(d.index) || d.index < 0 || d.index > 4096 ||
        !Number.isSafeInteger(d.characters) || d.characters < 0 || d.characters > MAX_BODY_CHARS ||
        typeof d.shell !== 'string' || d.shell.length > MAX_SHELL_CHARS) {
        throw new Error('Invalid Nemo prompt-body reference. Restore a portable preset.');
    }
    return d;
}
export function isCold(prompt) {
    const d = descriptorOf(prompt);
    return Boolean(d && prompt.content === checkedDescriptor(d).shell);
}
export function bodyRevision(prompt) {
    const d = descriptorOf(prompt);
    return isCold(prompt) ? `${d.ref.sha256}:${d.index}` : prompt.content;
}
export function hasBodies(preset) {
    return Boolean(preset?.prompts?.some(p => descriptorOf(p)));
}
export function isNemoPreset(preset) {
    const ids = new Set((preset?.prompts ?? []).map(p => p?.identifier));
    // Names are user editable; structure is the authority. Tavo has a distinct dialect.
    return ids.has('nemo-user-role-character') && ids.has('v11-classic-user-message-ender') &&
        !/tavo/i.test(preset.preset_name ?? '') &&
        !(preset.prompts ?? []).some(p => /^\s*<%/.test(p.content ?? ''));
}
export function eligible(prompt) {
    return prompt && typeof prompt.content === 'string' && Boolean(prompt.content.length) &&
        prompt.content.length <= MAX_BODY_CHARS && !prompt.marker && !prompt.system_prompt &&
        !['main', 'nsfw', 'jailbreak', 'nc-writing-resolver'].includes(prompt.identifier) &&
        !/^nemo-init-/.test(prompt.identifier) && !descriptorOf(prompt) &&
        shellFor(prompt.content).length <= MAX_SHELL_CHARS;
}
export function validatePreset(preset) {
    if (!Array.isArray(preset?.prompts) || !Array.isArray(preset.prompt_order)) throw new Error('Invalid prompt preset.');
    const ids = new Set();
    for (const p of preset.prompts) {
        if (!p || typeof p.identifier !== 'string' || ids.has(p.identifier)) throw new Error('Duplicate or invalid prompt identifier.');
        ids.add(p.identifier);
        if (descriptorOf(p)) checkedDescriptor(descriptorOf(p));
    }
    for (const profile of preset.prompt_order) {
        if (!Array.isArray(profile.order)) throw new Error('Invalid prompt order.');
        const seen = new Set();
        for (const entry of profile.order) {
            if (!ids.has(entry.identifier) || seen.has(entry.identifier)) throw new Error('Missing or duplicate prompt-order reference.');
            seen.add(entry.identifier);
        }
    }
}
export function portablePrompt(prompt, content) {
    const copy = { ...prompt, content };
    delete copy[BODY_KEY];
    return copy;
}
export function blockSerialization(object, error) {
    Object.defineProperty(object, 'toJSON', { configurable: true, enumerable: false, value() { throw error; } });
}
