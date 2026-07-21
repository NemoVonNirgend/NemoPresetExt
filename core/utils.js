import { extension_settings } from '../../../../extensions.js';
import { applySettingsSchema } from './feature-settings.js';

export { FEATURE_DEFAULTS, SETTINGS_DEFAULTS, SETTINGS_SCHEMA_VERSION, isFeatureEnabled } from './feature-settings.js';
export { escapeHtml } from '../../../../utils.js';

export const LOG_PREFIX = '[NemoPresetExt]';
export const NEMO_EXTENSION_NAME = 'NemoPresetExt';

export function getExtensionPath(relativePath = '') {
    return `scripts/extensions/third-party/${NEMO_EXTENSION_NAME}/${relativePath}`;
}

export function ensureSettingsNamespace() {
    if (!extension_settings) return false;
    extension_settings[NEMO_EXTENSION_NAME] ||= {};
    applySettingsSchema(extension_settings[NEMO_EXTENSION_NAME]);
    return true;
}

export function waitForElement(selector, callback, timeout = 5000) {
    const started = Date.now();
    function poll() {
        const element = document.querySelector(selector);
        if (element) callback(element);
        else if (Date.now() - started < timeout) requestAnimationFrame(poll);
        else console.warn(`${LOG_PREFIX} Timed out waiting for element: ${selector}`);
    }
    poll();
}
