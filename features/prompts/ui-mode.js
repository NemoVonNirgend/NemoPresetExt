import {
    PROMPT_UI_MODES,
    normalizePromptUiMode,
} from '../../core/feature-settings.js';

export const PROMPT_UI_MODE_DESCRIPTORS = Object.freeze({
    [PROMPT_UI_MODES.CLASSIC]: Object.freeze({
        mode: PROMPT_UI_MODES.CLASSIC,
        skin: 'classic',
        featureProfile: 'legacy',
        label: 'Classic 3.4',
    }),
    [PROMPT_UI_MODES.MODERN]: Object.freeze({
        mode: PROMPT_UI_MODES.MODERN,
        skin: 'modern',
        featureProfile: 'full',
        label: 'Modern',
    }),
    [PROMPT_UI_MODES.CLASSIC_PLUS]: Object.freeze({
        mode: PROMPT_UI_MODES.CLASSIC_PLUS,
        skin: 'classic',
        featureProfile: 'full',
        label: 'Classic+',
    }),
});

export function resolvePromptUiMode(settingsOrMode) {
    const rawMode = typeof settingsOrMode === 'string'
        ? settingsOrMode
        : settingsOrMode?.promptUiMode;
    const mode = normalizePromptUiMode(rawMode);
    return PROMPT_UI_MODE_DESCRIPTORS[mode];
}

export function applyPromptUiMode(settingsOrMode, target = document.body) {
    const descriptor = resolvePromptUiMode(settingsOrMode);
    if (!target) return descriptor;

    const changed = target.dataset.nemoPromptUi !== descriptor.mode
        || target.dataset.nemoPromptSkin !== descriptor.skin
        || target.dataset.nemoPromptFeatures !== descriptor.featureProfile;

    target.dataset.nemoPromptUi = descriptor.mode;
    target.dataset.nemoPromptSkin = descriptor.skin;
    target.dataset.nemoPromptFeatures = descriptor.featureProfile;
    target.classList.toggle('nemo-prompt-ui-classic', descriptor.skin === 'classic');
    target.classList.toggle('nemo-prompt-ui-modern', descriptor.skin === 'modern');
    if (changed) {
        target.dispatchEvent(new CustomEvent('nemo:prompt-ui-mode-changed', {
            detail: { ...descriptor },
        }));
    }
    return descriptor;
}

export function cleanupPromptUiMode(target = document.body) {
    if (!target) return;
    delete target.dataset.nemoPromptUi;
    delete target.dataset.nemoPromptSkin;
    delete target.dataset.nemoPromptFeatures;
    target.classList.remove('nemo-prompt-ui-classic', 'nemo-prompt-ui-modern');
}

export function usesFullPromptFeatures(settingsOrMode) {
    return resolvePromptUiMode(settingsOrMode).featureProfile === 'full';
}
