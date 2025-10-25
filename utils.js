// NemoPresetExt/utils.js

import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { extension_settings } from '../../../extensions.js';

// 1. CONSTANTS
export const LOG_PREFIX = `[NemoPresetExt]`;
export const NEMO_EXTENSION_NAME = "NemoPresetExt";

// SHARED LOCALSTORAGE KEYS
export const NEMO_SNAPSHOT_KEY = 'nemoPromptSnapshotData';
export const NEMO_METADATA_KEY = 'nemoNavigatorMetadata';
export const NEMO_SECTIONS_ENABLED_KEY = 'nemoSectionsEnabled';
export const NEMO_CHAR_METADATA_KEY = 'nemoCharacterNavigatorMetadata';
export const NEMO_FAVORITE_PRESETS_KEY = 'nemo-favorite-presets';
export const NEMO_FAVORITE_CHARACTERS_KEY = 'nemo-favorite-characters';


export const PREDEFINED_COLORS = [
    { name: 'Default', value: '' }, { name: 'Red', value: '#E53935' },
    { name: 'Pink', value: '#D81B60' }, { name: 'Purple', value: '#8E24AA' },
    { name: 'Deep Purple', value: '#5E35B1' }, { name: 'Indigo', value: '#3949AB' },
    { name: 'Blue', value: '#1E88E5' }, { name: 'Light Blue', value: '#039BE5' },
    { name: 'Cyan', value: '#00ACC1' }, { name: 'Teal', value: '#00897B' },
    { name: 'Green', value: '#43A047' }, { name: 'Light Green', value: '#7CB342' },
    { name: 'Lime', value: '#C0CA33' }, { name: 'Yellow', value: '#FDD835' },
    { name: 'Amber', value: '#FFB300' }, { name: 'Orange', value: '#FB8C00' },
    { name: 'Deep Orange', value: '#F4511E' }, { name: 'Brown', value: '#6D4C41' },
    { name: 'Grey', value: '#757575' }, { name: 'Blue Grey', value: '#546E7A' }
];

// 2. UTILITY FUNCTIONS
export function ensureSettingsNamespace() {
    // *** THIS IS THE FIX ***
    if (!extension_settings) {
        return false;
    }
    extension_settings[NEMO_EXTENSION_NAME] = extension_settings[NEMO_EXTENSION_NAME] || {};
    return true;
}

export function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const delay = ms => new Promise(res => setTimeout(res, ms));

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

export async function showColorPickerPopup(currentSelectedColorValue, title = "Select Color") {
    return new Promise((resolve) => {
        let contentHtml = `<div class="nemo-color-picker-popup"><h4>${title}</h4><div class="nemo-color-swatches">`;
        PREDEFINED_COLORS.forEach(color => {
            const isSelected = color.value === currentSelectedColorValue;
            contentHtml += `<div class="nemo-color-swatch ${isSelected ? 'selected' : ''}" data-color="${color.value}" style="background-color:${color.value || '#777' };" title="${color.name}"></div>`;
        });
        contentHtml += `</div><button id="nemo-clear-folder-color-btn" class="menu_button popup-button">Clear Color</button></div>`;

        const popupId = `nemo-color-picker-${generateUUID()}`;

        callGenericPopup(contentHtml, POPUP_TYPE.DISPLAY_HTML, null, {
            wide: false,
            large: false,
            Buttons: [],
            id: popupId,
            onclose: () => {
                const popupElement = document.getElementById(popupId);
                if (popupElement && !popupElement.dataset.resolved) {
                    resolve(null);
                }
            }
        });
        const popupElement = document.getElementById(popupId);

        if (popupElement) {
            popupElement.dataset.resolved = "false";
            const stPopupOuter = popupElement.closest('.popup_outer, dialog.popup');

            const handleClose = (value) => {
                if (popupElement.dataset.resolved === "true") return;
                popupElement.dataset.resolved = "true";
                resolve(value);
                if (stPopupOuter) {
                    const stCloseButton = stPopupOuter.querySelector('.popup-button-close');
                    if (stCloseButton) stCloseButton.click();
                    else {
                        stPopupOuter.remove();
                        const bg = document.querySelector('.popup_background.flex-center');
                        if (bg) bg.remove();
                    }
                }
            };

            popupElement.querySelectorAll('.nemo-color-swatch').forEach(swatch => {
                swatch.addEventListener('click', () => handleClose(swatch.dataset.color));
            });
            const clearButton = popupElement.querySelector('#nemo-clear-folder-color-btn');
            if (clearButton) {
                clearButton.addEventListener('click', () => handleClose(''));
            }
        } else {
            resolve(null);
        }
    });
}
/**
 * Waits for a DOM element to appear before executing a callback.
 * Uses requestAnimationFrame for efficient polling.
 * @param {string} selector - The CSS selector of the element to wait for.
 * @param {function} callback - The function to execute once the element is found.
 * @param {number} [timeout=5000] - The maximum time to wait in milliseconds.
 */
export function waitForElement(selector, callback, timeout = 5000) {
    const startTime = Date.now();

    function poll() {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
        } else if (Date.now() - startTime < timeout) {
            requestAnimationFrame(poll);
        } else {
            console.warn(`${LOG_PREFIX} Timed out waiting for element: ${selector}`);
        }
    }

    poll();
}