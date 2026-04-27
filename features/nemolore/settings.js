import { extension_settings } from '../../../../../extensions.js';
import { NEMO_EXTENSION_NAME } from '../../core/utils.js';
import {
    DEFAULT_SETTINGS,
    FEATURE_PATH,
    FEATURE_SETTINGS_KEY,
    STYLE_ELEMENT_ID,
} from './constants.js';

export function getNemoLoreSettings() {
    extension_settings[NEMO_EXTENSION_NAME] = extension_settings[NEMO_EXTENSION_NAME] || {};

    if (!extension_settings[NEMO_EXTENSION_NAME][FEATURE_SETTINGS_KEY]) {
        extension_settings[NEMO_EXTENSION_NAME][FEATURE_SETTINGS_KEY] = {};
    }

    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (extension_settings[NEMO_EXTENSION_NAME][FEATURE_SETTINGS_KEY][key] === undefined) {
            extension_settings[NEMO_EXTENSION_NAME][FEATURE_SETTINGS_KEY][key] = value;
        }
    }

    return extension_settings[NEMO_EXTENSION_NAME][FEATURE_SETTINGS_KEY];
}

export function ensureNemoLoreStyles() {
    if (document.getElementById(STYLE_ELEMENT_ID)) {
        return;
    }

    const link = document.createElement('link');
    link.id = STYLE_ELEMENT_ID;
    link.rel = 'stylesheet';
    link.href = `${FEATURE_PATH}/style.css`;
    document.head.appendChild(link);
}
