// Shared NemoPresetExt utilities used by the core and merged prompt workstation.

import { callGenericPopup, POPUP_TYPE } from '../../../../popup.js';
import { extension_settings } from '../../../../extensions.js';
import {
    delay,
    debounce,
    debounceAsync,
    throttle,
    escapeHtml,
    uuidv4,
    getSortableDelay,
    flashHighlight,
    isValidUrl,
    removeFromArray,
    onlyUnique,
} from '../../../../utils.js';
import { debounce_timeout } from '../../../../constants.js';
import {
    applySettingsSchema,
    migratePromptToolsSettings,
} from './feature-settings.js';

export {
    delay,
    debounce,
    debounceAsync,
    throttle,
    escapeHtml,
    getSortableDelay,
    flashHighlight,
    isValidUrl,
    removeFromArray,
    onlyUnique,
    debounce_timeout,
};
export {
    FEATURE_DEFAULTS,
    PROMPT_UI_MODES,
    SETTINGS_DEFAULTS,
    SETTINGS_SCHEMA_VERSION,
    isFeatureEnabled,
    normalizePromptUiMode,
} from './feature-settings.js';

export const LOG_PREFIX = '[NemoPresetExt]';
export const NEMO_EXTENSION_NAME = 'NemoPresetExt';

export const NEMO_SNAPSHOT_KEY = 'nemoPromptSnapshotData';
export const NEMO_METADATA_KEY = 'nemoNavigatorMetadata';
export const NEMO_SECTIONS_ENABLED_KEY = 'nemoSectionsEnabled';
export const NEMO_CHAR_METADATA_KEY = 'nemoCharacterNavigatorMetadata';
export const NEMO_FAVORITE_PRESETS_KEY = 'nemo-favorite-presets';
export const NEMO_FAVORITE_CHARACTERS_KEY = 'nemo-favorite-characters';
export const NEMO_PROMPT_STATE_KEY = 'nemoPromptToggleState';

export const PREDEFINED_COLORS = Object.freeze([
    { name: 'Default', value: '' },
    { name: 'Red', value: '#E53935' },
    { name: 'Pink', value: '#D81B60' },
    { name: 'Purple', value: '#8E24AA' },
    { name: 'Deep Purple', value: '#5E35B1' },
    { name: 'Indigo', value: '#3949AB' },
    { name: 'Blue', value: '#1E88E5' },
    { name: 'Light Blue', value: '#039BE5' },
    { name: 'Cyan', value: '#00ACC1' },
    { name: 'Teal', value: '#00897B' },
    { name: 'Green', value: '#43A047' },
    { name: 'Light Green', value: '#7CB342' },
    { name: 'Lime', value: '#C0CA33' },
    { name: 'Yellow', value: '#FDD835' },
    { name: 'Amber', value: '#FFB300' },
    { name: 'Orange', value: '#FB8C00' },
    { name: 'Deep Orange', value: '#F4511E' },
    { name: 'Brown', value: '#6D4C41' },
    { name: 'Grey', value: '#757575' },
    { name: 'Blue Grey', value: '#546E7A' },
]);

export function getExtensionPath(relativePath = '') {
    return `scripts/extensions/third-party/${NEMO_EXTENSION_NAME}/${relativePath}`;
}

export function ensureSettingsNamespace() {
    if (!extension_settings) return false;
    const settings = extension_settings[NEMO_EXTENSION_NAME] ||= {};
    migratePromptToolsSettings(settings, extension_settings.NemoPromptTools);
    applySettingsSchema(settings);
    return true;
}

export function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateUUID() {
    return uuidv4();
}

/**
 * Poll for a DOM node while retaining the historical callback contract.
 * Returns a cleanup function so new callers can cancel the wait explicitly.
 */
export function waitForElement(selector, callback, timeout = 5000) {
    const started = Date.now();
    let frame = null;
    let cancelled = false;

    const poll = () => {
        if (cancelled) return;
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }
        if (Date.now() - started >= timeout) {
            console.warn(`${LOG_PREFIX} Timed out waiting for element: ${selector}`);
            return;
        }
        frame = requestAnimationFrame(poll);
    };

    poll();
    return () => {
        cancelled = true;
        if (frame !== null) cancelAnimationFrame(frame);
    };
}

export async function showColorPickerPopup(currentValue, title = 'Select Color') {
    const popupId = `nemo-color-picker-${generateUUID()}`;
    const swatches = PREDEFINED_COLORS.map(color => {
        const selected = color.value === currentValue ? ' selected' : '';
        const background = color.value || '#777';
        return `<button type="button" class="nemo-color-swatch${selected}" data-color="${color.value}" style="background-color:${background}" title="${escapeHtml(color.name)}" aria-label="${escapeHtml(color.name)}"></button>`;
    }).join('');
    const html = `
        <div id="${popupId}" class="nemo-color-picker-popup">
            <h4>${escapeHtml(title)}</h4>
            <div class="nemo-color-swatches">${swatches}</div>
            <button type="button" class="menu_button" data-action="clear">Clear Color</button>
        </div>`;

    void callGenericPopup(html, POPUP_TYPE.TEXT, '', {
        wide: false,
        large: false,
        okButton: 'Cancel',
    });

    return new Promise(resolve => {
        let settled = false;
        const settle = value => {
            if (settled) return;
            settled = true;
            resolve(value);
            const popup = document.getElementById(popupId)?.closest('.popup_outer, dialog.popup, dialog[data-id], .popup');
            popup?.querySelector('.popup-button-close, .popup-button-ok')?.click();
        };

        waitForElement(`#${popupId}`, element => {
            element.querySelectorAll('[data-color]').forEach(swatch => {
                swatch.addEventListener('click', () => settle(swatch.dataset.color));
            });
            element.querySelector('[data-action="clear"]')?.addEventListener('click', () => settle(''));
            element.closest('.popup_outer, dialog.popup, dialog[data-id], .popup')
                ?.querySelector('.popup-button-ok')
                ?.addEventListener('click', () => settle(null), { once: true });
        }, 2500);
    });
}

export function showToast(message, type = 'info', duration = 4000) {
    const iconByType = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        info: 'fa-circle-info',
        warning: 'fa-triangle-exclamation',
    };
    const toast = document.createElement('div');
    toast.className = `nemo-toast ${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
        <i class="fa-solid ${iconByType[type] ?? iconByType.info} nemo-toast-icon" aria-hidden="true"></i>
        <div class="nemo-toast-content">${escapeHtml(String(message))}</div>
        <button type="button" class="nemo-toast-close" aria-label="Close notification"><i class="fa-solid fa-times"></i></button>`;

    let timer = null;
    const remove = () => {
        if (timer !== null) clearTimeout(timer);
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector('.nemo-toast-close')?.addEventListener('click', remove);
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    timer = setTimeout(remove, duration);
    return toast;
}
