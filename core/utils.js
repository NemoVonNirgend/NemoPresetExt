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

export const DEFAULT_POLLINATIONS_PROMPT_BEST_PRACTICES = [
    'clear focal subject',
    'coherent composition',
    'consistent character design across panels',
    'accurate anatomy and hands',
    'expressive faces',
    'clean readable silhouettes',
    'consistent lighting and perspective',
    'background matches the scene',
    'polished finished illustration'
].join(', ');

export const DEFAULT_POLLINATIONS_NEGATIVE_BEST_PRACTICES = [
    'inconsistent character design',
    'off-model character',
    'bad anatomy',
    'bad hands',
    'extra fingers',
    'missing fingers',
    'warped face',
    'confusing composition',
    'unreadable panel',
    'unwanted text',
    'garbled lettering',
    'watermark',
    'logo',
    'signature'
].join(', ');

export const POLLINATIONS_IMAGE_STYLE_PRESETS = Object.freeze([
    {
        id: 'none',
        label: 'No Style Preset',
        prompt: '',
        negative: ''
    },
    {
        id: 'manga_panels',
        label: 'Manga Panels',
        prompt: 'manga panel illustration, clean ink linework, screentone shading, expressive character acting, dramatic panel composition, readable action flow',
        negative: 'muddy screentones, broken panel flow, cluttered linework'
    },
    {
        id: 'anime_key_visual',
        label: 'Anime Key Visual',
        prompt: 'anime key visual, crisp cel shading, vibrant color design, cinematic lighting, clean character consistency, polished promotional illustration',
        negative: 'flat lighting, inconsistent cel shading, off-model character'
    },
    {
        id: 'western_comic',
        label: 'Western Comic',
        prompt: 'western comic book illustration, bold inks, dynamic poses, controlled halftone texture, strong readable silhouettes, punchy color contrast',
        negative: 'muddy colors, chaotic linework, unreadable action'
    },
    {
        id: 'cinematic_realism',
        label: 'Cinematic Realism',
        prompt: 'cinematic realistic illustration, natural lighting, film still composition, believable materials, depth of field, grounded color grading',
        negative: 'plastic skin, uncanny face, overprocessed HDR, waxy texture'
    },
    {
        id: 'fantasy_concept',
        label: 'Fantasy Concept Art',
        prompt: 'fantasy concept art, atmospheric lighting, detailed costume design, believable environment design, painterly finish, epic scale',
        negative: 'generic armor, noisy details, incoherent environment'
    },
    {
        id: 'watercolor_storybook',
        label: 'Watercolor Storybook',
        prompt: 'watercolor storybook illustration, soft washes, gentle texture, warm expressive composition, delicate linework, charming hand-painted feel',
        negative: 'harsh digital edges, muddy wash, over-rendered texture'
    },
    {
        id: 'noir_ink',
        label: 'Noir Ink',
        prompt: 'noir ink illustration, high contrast lighting, deep shadows, rim light, moody composition, crisp black and white rendering',
        negative: 'low contrast, gray muddy shadows, unclear silhouettes'
    },
    {
        id: 'art_nouveau',
        label: 'Art Nouveau Poster',
        prompt: 'art nouveau poster style, flowing ornamental shapes, elegant linework, decorative framing, harmonious color palette, graceful composition',
        negative: 'stiff posing, cluttered ornament, mismatched patterns'
    },
    {
        id: 'ukiyo_e',
        label: 'Woodblock Print',
        prompt: 'ukiyo-e inspired woodblock print, flat color fields, flowing contour lines, patterned fabric detail, balanced negative space, print texture',
        negative: 'photoreal rendering, noisy gradients, muddy print texture'
    },
    {
        id: 'impressionist',
        label: 'Impressionist Painting',
        prompt: 'impressionist painting, visible brushwork, luminous color, soft natural light, atmospheric edges, expressive painterly texture',
        negative: 'overly sharp digital detail, muddy color mixing, plastic finish'
    }
]);

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

// 2. PATH HELPERS
/**
 * Get the full path to a file within the NemoPresetExt extension directory.
 * Use this instead of hardcoding 'scripts/extensions/third-party/NemoPresetExt/...' everywhere.
 * @param {string} relativePath - Path relative to the extension root (e.g., 'settings.html')
 * @returns {string} Full path from SillyTavern root
 */
export function getExtensionPath(relativePath = '') {
    return `scripts/extensions/third-party/${NEMO_EXTENSION_NAME}/${relativePath}`;
}

// 3. UTILITY FUNCTIONS
export function ensureSettingsNamespace() {
    // *** THIS IS THE FIX ***
    if (!extension_settings) {
        return false;
    }
    extension_settings[NEMO_EXTENSION_NAME] = extension_settings[NEMO_EXTENSION_NAME] || {};

    // Initialize default settings if they don't exist
    const defaults = {
        nemoEnableWidePanels: false,
        enableConnectionPanelOverhaul: true,
        enableTabOverhauls: true,
        nemoEnableExtensionsTabOverhaul: true,
        enablePromptManager: true,
        dropdownStyle: 'tray',
        dropdownTheme: 'st',
        enablePresetNavigator: true,
        enableDirectives: true,
        enableAnimatedBackgrounds: true,
        enablePanelToggle: true,
        enableReasoningSection: true,
        enableLorebookManagement: true,
        enableHTMLTrimming: false,
        htmlTrimmingKeepCount: 0,  // Default to 0 (no auto-trim)
        dividerRegexPattern: '',
        // UI Theme settings - 'none', 'win98', 'discord'
        uiTheme: 'none',
        // Mobile enhancements - auto-detected on touch devices, can be disabled
        enableMobileEnhancements: true,
        // Enhanced model selector with search, favorites, and quick-switch chips
        enableModelSelector: true,
        // Pollinations interceptor prompt consistency helpers
        nemoPollinationsStylePreset: 'none',
        nemoPollinationsPromptBestPractices: true,
        nemoPollinationsBestPracticesPrompt: DEFAULT_POLLINATIONS_PROMPT_BEST_PRACTICES,
        nemoPollinationsNegativeBestPracticesPrompt: DEFAULT_POLLINATIONS_NEGATIVE_BEST_PRACTICES
    };

    // Apply defaults for any missing settings
    for (const [key, value] of Object.entries(defaults)) {
        if (extension_settings[NEMO_EXTENSION_NAME][key] === undefined) {
            extension_settings[NEMO_EXTENSION_NAME][key] = value;
        }
    }

    // The dropdown theme setting was introduced with Nemo Blue as the first
    // draft default. Prefer ST theme integration unless users change it later.
    if (extension_settings[NEMO_EXTENSION_NAME]._dropdownThemeDefaultStV1 !== true) {
        if (extension_settings[NEMO_EXTENSION_NAME].dropdownTheme === undefined || extension_settings[NEMO_EXTENSION_NAME].dropdownTheme === 'nemo') {
            extension_settings[NEMO_EXTENSION_NAME].dropdownTheme = 'st';
        }
        extension_settings[NEMO_EXTENSION_NAME]._dropdownThemeDefaultStV1 = true;
    }

    // Correct a short-lived dev migration that disabled primary NemoPresetExt UI
    // systems. These overhauls are core extension functionality, so restore them
    // once and leave future user changes alone.
    if (extension_settings[NEMO_EXTENSION_NAME]._restorePrimaryUiDefaultsV1 !== true) {
        Object.assign(extension_settings[NEMO_EXTENSION_NAME], {
            enableConnectionPanelOverhaul: true,
            enableTabOverhauls: true,
            nemoEnableExtensionsTabOverhaul: true,
            enableModelSelector: true,
            enableReasoningSection: true,
            enableLorebookManagement: true,
            _restorePrimaryUiDefaultsV1: true,
        });
    }

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

// Debug flag for verbose logging - set to true during development
const DEBUG_UTILS = false;

export async function showColorPickerPopup(currentSelectedColorValue, title = "Select Color") {
    return new Promise((resolve) => {
        if (DEBUG_UTILS) console.log(`${LOG_PREFIX} showColorPickerPopup called with value: ${currentSelectedColorValue}`);

        const popupId = `nemo-color-picker-${generateUUID()}`;

        // Add ID directly to content HTML so we can reliably find it
        let contentHtml = `<div id="${popupId}" class="nemo-color-picker-popup"><h4>${title}</h4><div class="nemo-color-swatches">`;
        PREDEFINED_COLORS.forEach(color => {
            const isSelected = color.value === currentSelectedColorValue;
            contentHtml += `<div class="nemo-color-swatch ${isSelected ? 'selected' : ''}" data-color="${color.value}" style="background-color:${color.value || '#777' };" title="${color.name}"></div>`;
        });
        contentHtml += `</div><button id="nemo-clear-folder-color-btn" class="menu_button popup-button">Clear Color</button></div>`;

        if (DEBUG_UTILS) console.log(`${LOG_PREFIX} Creating popup with id: ${popupId}`);

        // Call the popup WITHOUT awaiting (it shouldn't block)
        callGenericPopup(contentHtml, POPUP_TYPE.TEXT, '', {
            wide: false,
            large: false,
            okButton: 'Cancel'
        });

        // Wait for the popup element to exist in the DOM
        waitForElement(`#${popupId}`, (popupElement) => {
            if (DEBUG_UTILS) console.log(`${LOG_PREFIX} Popup element found, attaching handlers`);
            popupElement.dataset.resolved = "false";

            // Try multiple selectors to find the popup container
            const stPopupOuter = popupElement.closest('.popup_outer, dialog.popup, dialog[data-id], .popup');

            if (DEBUG_UTILS) console.log(`${LOG_PREFIX} Popup outer element:`, stPopupOuter);
            if (DEBUG_UTILS) console.log(`${LOG_PREFIX} Popup element parent:`, popupElement.parentElement);

            // Ensure the popup appears on top of other modals
            if (stPopupOuter) {
                stPopupOuter.style.zIndex = '10003';
                if (DEBUG_UTILS) console.log(`${LOG_PREFIX} Set popup z-index to 10003 on:`, stPopupOuter.tagName, stPopupOuter.className);
            } else {
                // Fallback: try setting z-index on parent element
                const parent = popupElement.parentElement;
                if (parent) {
                    parent.style.zIndex = '10003';
                    if (DEBUG_UTILS) console.log(`${LOG_PREFIX} Set z-index on parent element:`, parent.tagName, parent.className);
                }
            }

            // Find all popup backgrounds and set the last one (most recent) to high z-index
            const allPopupBgs = document.querySelectorAll('.popup_background');
            if (DEBUG_UTILS) console.log(`${LOG_PREFIX} Found ${allPopupBgs.length} popup backgrounds`);
            if (allPopupBgs.length > 0) {
                const latestBg = allPopupBgs[allPopupBgs.length - 1];
                latestBg.style.zIndex = '10002';
                if (DEBUG_UTILS) console.log(`${LOG_PREFIX} Set latest popup background z-index to 10002`);
            }

            const handleClose = (value) => {
                if (DEBUG_UTILS) console.log(`${LOG_PREFIX} handleClose called with value: ${value}`);
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
