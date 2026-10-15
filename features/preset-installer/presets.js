import { digest } from '../../core/sha256.js';

export const NEMO_ENGINE_VERSION = '12.1';
export const DEFAULT_PRESET_ID = 'standard';

// Each asset is an exact portable release export, tested with this extension.
// Updating a release requires updating its checksum and running the import audit.
export const NEMO_ENGINE_PRESETS = Object.freeze([
    {
        id: 'standard', name: 'Nemo Engine v12.1', label: 'Standard — ordinary spaces (recommended)',
        description: 'Direct Vex, genre, author, and style controls. Start here for the simpler configuration.',
        assetPath: 'assets/nemo-engine/v12.1-standard.json',
        sha256: '42027f4ad25f13ffd3d8ce881d4a2b2007c5dcaac2bbf350ed56c45faf443d0f',
        bytes: 3288357, promptCount: 569,
    },
    {
        id: 'full', name: 'Nemo Engine v12.1 full', label: 'Full — ordinary spaces',
        description: 'Adds combined Vex selection and the Genre × Author × Style recipe libraries.',
        assetPath: 'assets/nemo-engine/v12.1-full.json',
        assetParts: 10,
        sha256: '6c8b0add6faff04556ffc2b200fd37f51a0ff98654df4efce397ce80d462076e',
        bytes: 28991021, promptCount: 786,
    },
    {
        id: 'standard-braille', name: 'Nemo Engine v12.1 [braile space]', label: 'Standard — Braille spaces',
        description: 'Standard edition with Braille blanks in prompt prose and the context-conversion regex pair enabled.',
        assetPath: 'assets/nemo-engine/v12.1-standard-braille.json',
        sha256: '1715aa7e7c0443f84306758ed72ce28d4975a50f01a94eb8c19d09bc30d68d46',
        bytes: 3679617, promptCount: 569,
    },
    {
        id: 'full-braille', name: 'Nemo Engine v12.1 full [braile space]', label: 'Full — Braille spaces',
        description: 'Full edition with Braille blanks in prompts, Vex text, and recipes, plus context conversion.',
        assetPath: 'assets/nemo-engine/v12.1-full-braille.json',
        assetParts: 13,
        sha256: 'b01378f4fb25729020622a9a88cc45b02b97f3649f1ce61ca3b7338e05802a66',
        bytes: 36946325, promptCount: 786,
    },
].map(entry => Object.freeze({ ...entry, version: NEMO_ENGINE_VERSION, regexScriptCount: 493 })));

export function getNemoEnginePreset(id = DEFAULT_PRESET_ID) {
    const entry = NEMO_ENGINE_PRESETS.find(preset => preset.id === id);
    if (!entry) throw new Error(`Unknown Nemo Engine edition: ${id}.`);
    return entry;
}

export function validateNemoEnginePreset(preset) {
    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
        throw new Error('Preset JSON did not contain an object.');
    }
    if (!Array.isArray(preset.prompts)) throw new Error('Preset JSON is missing the prompts array.');
    if (!Array.isArray(preset.prompt_order)) throw new Error('Preset JSON is missing prompt_order.');
    const regexScripts = Array.isArray(preset.extensions?.regex_scripts) ? preset.extensions.regex_scripts : [];
    return {
        promptCount: preset.prompts.length,
        promptOrderCount: preset.prompt_order.reduce((count, group) => count + (group?.order?.length || 0), 0),
        regexScriptCount: regexScripts.length,
        enabledRegexScriptCount: regexScripts.filter(script => script?.disabled !== true).length,
    };
}

export function getNemoEngineAssetPaths(entry, url = entry.assetPath) {
    return entry.assetParts
        ? Array.from({ length: entry.assetParts }, (_, index) => `${url}.part-${String(index + 1).padStart(2, '0')}`)
        : [url];
}

export async function loadNemoEnginePreset(entry, { url = entry.assetPath, fetchFn = globalThis.fetch } = {}) {
    // Full exports are split at UTF-8 boundaries; concatenation preserves their
    // original portable bytes without requiring any browser decompression API.
    let text = '';
    for (const asset of getNemoEngineAssetPaths(entry, url)) {
        const response = await fetchFn(asset, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Could not load bundled preset (${response.status}).`);
        text += await response.text();
    }
    if (await digest(text) !== entry.sha256) {
        throw new Error('The bundled preset does not match this extension release. Update NemoPresetExt and reload SillyTavern.');
    }
    const preset = JSON.parse(text);
    const stats = validateNemoEnginePreset(preset);
    if (stats.promptCount !== entry.promptCount || stats.regexScriptCount !== entry.regexScriptCount) {
        throw new Error('The bundled preset does not match its edition catalog.');
    }
    return { preset, stats };
}
