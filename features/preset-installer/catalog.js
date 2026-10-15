/** Bundled portable releases verified against the extension's import pipeline. */
export const PRESET_VERSION = '12.1';
export const DEFAULT_VARIANT = 'standard';
export const PRESET_VARIANTS = Object.freeze([
    { id: 'standard', name: 'Nemo Engine v12.1', label: 'Standard · Ordinary spaces (recommended)',
        description: 'Direct Vex and writing controls. A straightforward starting point.',
        full: false, braille: false, sourceBytes: 3288357, compressedBytes: 649742,
        sha256: '42027f4ad25f13ffd3d8ce881d4a2b2007c5dcaac2bbf350ed56c45faf443d0f' },
    { id: 'standard-braille', name: 'Nemo Engine v12.1 [braile space]', label: 'Standard · Braille spaces',
        description: 'Standard controls with Braille spacing and context-conversion rules.',
        full: false, braille: true, sourceBytes: 3679617, compressedBytes: 683045,
        sha256: '1715aa7e7c0443f84306758ed72ce28d4975a50f01a94eb8c19d09bc30d68d46' },
    { id: 'full', name: 'Nemo Engine v12.1 full', label: 'Full · Ordinary spaces',
        description: 'Adds combined Vex Council selection and Genre × Author × Style recipes.',
        full: true, braille: false, sourceBytes: 28991021, compressedBytes: 8318550,
        sha256: '6c8b0add6faff04556ffc2b200fd37f51a0ff98654df4efce397ce80d462076e' },
    { id: 'full-braille', name: 'Nemo Engine v12.1 full [braile space]', label: 'Full · Braille spaces',
        description: 'Vex Council and writing recipes with Braille spacing and context-conversion rules.',
        full: true, braille: true, sourceBytes: 36946325, compressedBytes: 8858791,
        sha256: 'b01378f4fb25729020622a9a88cc45b02b97f3649f1ce61ca3b7338e05802a66' },
].map(variant => Object.freeze({ ...variant, version: PRESET_VERSION,
    assetPath: `assets/presets/${variant.id}-v${PRESET_VERSION}.json.gz`,
    promptCount: variant.full ? 786 : 569, regexScriptCount: 493 })));

export function presetVariant(id = DEFAULT_VARIANT) {
    const variant = PRESET_VARIANTS.find(entry => entry.id === id);
    if (!variant) throw new Error(`Unknown Nemo Engine preset edition: ${id}`);
    return variant;
}
