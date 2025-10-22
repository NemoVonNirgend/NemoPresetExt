// NemoPresetExt/utils.js

import { callGenericPopup, POPUP_TYPE } from '../../../../popup.js';
import { extension_settings } from '../../../../extensions.js';

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
export const NEMO_PROMPT_STATE_KEY = 'nemoPromptToggleState';


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

// Import SillyTavern standard utilities instead of custom implementations
export {
    delay,
    debounce,
    debounceAsync,
    throttle,
    escapeHtml,
    uuidv4 as generateUUID,
    getSortableDelay,
    flashHighlight,
    isValidUrl,
    removeFromArray,
    onlyUnique
} from '../../../../utils.js';

export { debounce_timeout } from '../../../../constants.js';

// Async localStorage wrapper to prevent UI blocking
export const LocalStorageAsync = {
    setItem: async function(key, value) {
        return new Promise((resolve, reject) => {
            try {
                // Use requestIdleCallback for non-blocking storage
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(() => {
                        try {
                            localStorage.setItem(key, value);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }, { timeout: 1000 });
                } else {
                    // Fallback for browsers without requestIdleCallback
                    setTimeout(() => {
                        try {
                            localStorage.setItem(key, value);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }, 0);
                }
            } catch (error) {
                reject(error);
            }
        });
    },

    getItem: function(key) {
        // Synchronous reads are generally fine as they're fast
        return localStorage.getItem(key);
    },

    removeItem: async function(key) {
        return new Promise((resolve, reject) => {
            try {
                if ('requestIdleCallback' in window) {
                    requestIdleCallback(() => {
                        try {
                            localStorage.removeItem(key);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }, { timeout: 1000 });
                } else {
                    setTimeout(() => {
                        try {
                            localStorage.removeItem(key);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }, 0);
                }
            } catch (error) {
                reject(error);
            }
        });
    }
};

// Note: generateUUID, debounce, escapeHtml are now imported from SillyTavern utils above

export async function showColorPickerPopup(currentSelectedColorValue, title = "Select Color") {
    return new Promise((resolve) => {
        console.log(`${LOG_PREFIX} showColorPickerPopup called with value: ${currentSelectedColorValue}`);

        let contentHtml = `<div class="nemo-color-picker-popup"><h4>${title}</h4><div class="nemo-color-swatches">`;
        PREDEFINED_COLORS.forEach(color => {
            const isSelected = color.value === currentSelectedColorValue;
            contentHtml += `<div class="nemo-color-swatch ${isSelected ? 'selected' : ''}" data-color="${color.value}" style="background-color:${color.value || '#777' };" title="${color.name}"></div>`;
        });
        contentHtml += `</div><button id="nemo-clear-folder-color-btn" class="menu_button popup-button">Clear Color</button></div>`;

        const popupId = `nemo-color-picker-${generateUUID()}`;
        console.log(`${LOG_PREFIX} Creating popup with id: ${popupId}`);

        // Call the popup WITHOUT awaiting (it shouldn't block)
        callGenericPopup(contentHtml, POPUP_TYPE.TEXT, '', {
            wide: false,
            large: false,
            okButton: 'Cancel',
            id: popupId
        });

        // Wait for the popup element to exist in the DOM
        waitForElement(`#${popupId}`, (popupElement) => {
            console.log(`${LOG_PREFIX} Popup element found, attaching handlers`);
            popupElement.dataset.resolved = "false";

            // Try multiple selectors to find the popup container
            const stPopupOuter = popupElement.closest('.popup_outer, dialog.popup, dialog[data-id], .popup');

            console.log(`${LOG_PREFIX} Popup outer element:`, stPopupOuter);
            console.log(`${LOG_PREFIX} Popup element parent:`, popupElement.parentElement);

            // Ensure the popup appears on top of other modals
            if (stPopupOuter) {
                stPopupOuter.style.zIndex = '10003';
                console.log(`${LOG_PREFIX} Set popup z-index to 10003 on:`, stPopupOuter.tagName, stPopupOuter.className);
            } else {
                // Fallback: try setting z-index on parent element
                const parent = popupElement.parentElement;
                if (parent) {
                    parent.style.zIndex = '10003';
                    console.log(`${LOG_PREFIX} Set z-index on parent element:`, parent.tagName, parent.className);
                }
            }

            // Find all popup backgrounds and set the last one (most recent) to high z-index
            const allPopupBgs = document.querySelectorAll('.popup_background');
            console.log(`${LOG_PREFIX} Found ${allPopupBgs.length} popup backgrounds`);
            if (allPopupBgs.length > 0) {
                const latestBg = allPopupBgs[allPopupBgs.length - 1];
                latestBg.style.zIndex = '10002';
                console.log(`${LOG_PREFIX} Set latest popup background z-index to 10002`);
            }

            const handleClose = (value) => {
                console.log(`${LOG_PREFIX} handleClose called with value: ${value}`);
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

            // Handle cancel button
            const cancelButton = stPopupOuter?.querySelector('.popup-button-ok');
            if (cancelButton) {
                cancelButton.addEventListener('click', () => handleClose(null));
            }
        }, 2000);
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

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duration in milliseconds (default: 4000)
 */
export function showToast(message, type = 'info', duration = 4000) {
    const icons = {
        success: 'fa-circle-check',
        error: 'fa-circle-xmark',
        info: 'fa-circle-info',
        warning: 'fa-triangle-exclamation'
    };

    const toast = document.createElement('div');
    toast.className = `nemo-toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
        <i class="fa-solid ${icons[type]} nemo-toast-icon" aria-hidden="true"></i>
        <div class="nemo-toast-content">${escapeHtml(message)}</div>
        <button class="nemo-toast-close" aria-label="Close notification">
            <i class="fa-solid fa-times" aria-hidden="true"></i>
        </button>
    `;

    document.body.appendChild(toast);

    // Close button handler
    const closeBtn = toast.querySelector('.nemo-toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });

    // Show toast
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto-hide after duration
    const hideTimeout = setTimeout(() => {
        removeToast(toast);
    }, duration);

    // Store timeout ID for manual close
    toast._hideTimeout = hideTimeout;

    return toast;
}

function removeToast(toast) {
    if (toast._hideTimeout) {
        clearTimeout(toast._hideTimeout);
    }

    toast.classList.remove('show');
    toast.classList.add('hide');

    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 300); // Match CSS transition duration
}