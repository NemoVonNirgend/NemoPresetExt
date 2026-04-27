/**
 * NemoPresetExt Theme Manager
 * Handles optional UI themes like Windows 98 and Discord
 */

import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { LOG_PREFIX, NEMO_EXTENSION_NAME, getExtensionPath } from '../core/utils.js';
import { initWin98Enhancements, cleanupWin98Enhancements } from '../themes/win98-enhancements.js';
import { initDiscordEnhancements, cleanupDiscordEnhancements } from '../themes/discord-enhancements.js';
import { initCyberpunkEnhancements, cleanupCyberpunkEnhancements } from '../themes/cyberpunk-enhancements.js';
import { initNemoTavernEnhancements, cleanupNemoTavernEnhancements } from '../themes/nemotavern/nemotavern-enhancements.js';

// Available themes configuration
const THEMES = {
    none: {
        name: 'None',
        description: 'Default SillyTavern theme',
        cssFile: null,
        bodyClass: null
    },
    win98: {
        name: 'Windows 98',
        description: 'Classic retro OS style',
        cssFile: 'themes/win98-theme.css',
        bodyClass: 'nemo-theme-win98'
    },
    discord: {
        name: 'Discord',
        description: 'Chat app style interface',
        cssFile: 'themes/discord-theme.css',
        bodyClass: 'nemo-theme-discord'
    },
    cyberpunk: {
        name: 'Cyberpunk',
        description: 'NemoNet CLI terminal style',
        cssFile: 'themes/cyberpunk-theme.css',
        bodyClass: 'nemo-theme-cyberpunk'
    },
    nemotavern: {
        name: 'NemoTavern',
        description: 'Modern glassmorphism UI with floating panels',
        cssFile: 'themes/nemotavern/nemotavern-theme.css',
        bodyClass: 'nemo-theme-nemotavern'
    }
};

// Track loaded theme stylesheets
let loadedThemeStylesheet = null;

// Base path now uses centralized getExtensionPath() from core/utils.js

/**
 * Detect mobile viewport. Themes break layouts on small screens and users
 * have reported getting stuck in them, so we refuse to apply non-default
 * themes when this returns true. Saved settings are preserved — the theme
 * just isn't applied until the viewport is large enough.
 * @returns {boolean}
 */
function isMobileViewport() {
    try {
        if (window.matchMedia) {
            return window.matchMedia('(max-width: 768px)').matches;
        }
    } catch (_) { /* fall through */ }
    const w = window.innerWidth || document.documentElement?.clientWidth || 0;
    return w > 0 && w <= 768;
}

/**
 * Run cleanup for every theme's enhancements. Each cleanup is a best-effort
 * teardown that no-ops if its DOM/observers were never created. Calling all
 * four every time avoids needing to track which theme was previously active.
 */
function cleanupAllThemeEnhancements() {
    try { cleanupWin98Enhancements(); } catch (e) { console.warn(`${LOG_PREFIX} Win98 cleanup failed`, e); }
    try { cleanupDiscordEnhancements(); } catch (e) { console.warn(`${LOG_PREFIX} Discord cleanup failed`, e); }
    try { cleanupCyberpunkEnhancements(); } catch (e) { console.warn(`${LOG_PREFIX} Cyberpunk cleanup failed`, e); }
    try { cleanupNemoTavernEnhancements(); } catch (e) { console.warn(`${LOG_PREFIX} NemoTavern cleanup failed`, e); }
}

/**
 * Strip any applied theme class/stylesheet from the page without
 * mutating the saved setting.
 */
function stripAppliedTheme() {
    Object.values(THEMES).forEach(t => {
        if (t.bodyClass) document.body.classList.remove(t.bodyClass);
    });
    if (loadedThemeStylesheet) {
        loadedThemeStylesheet.remove();
        loadedThemeStylesheet = null;
    }
    document.getElementById('nemo-theme-stylesheet')?.remove();
    cleanupAllThemeEnhancements();
}

/**
 * Show a small toast explaining that themes are disabled on mobile.
 */
function showMobileThemeBlockedNotice() {
    const id = 'nemo-mobile-theme-blocked-notice';
    document.getElementById(id)?.remove();

    const notice = document.createElement('div');
    notice.id = id;
    notice.innerHTML = '<i class="fa-solid fa-mobile-screen"></i><span>Themes are disabled on mobile. Default UI will be used until you switch to a larger screen.</span>';
    notice.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(40,40,40,0.95);color:#fff;padding:10px 14px;border:1px solid rgba(255,200,50,0.5);border-radius:8px;display:flex;align-items:center;gap:10px;z-index:10001;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-size:0.85em;max-width:90vw;line-height:1.3;';
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 4500);
}

/**
 * Load a theme CSS file dynamically
 * @param {string} themeName - The theme identifier
 */
async function loadThemeCSS(themeName) {
    const theme = THEMES[themeName];

    if (!theme || !theme.cssFile) {
        console.log(`${LOG_PREFIX} No CSS file for theme: ${themeName}`);
        return;
    }

    // Remove any previously loaded theme stylesheet
    if (loadedThemeStylesheet) {
        console.log(`${LOG_PREFIX} Removing previous theme stylesheet`);
        loadedThemeStylesheet.remove();
        loadedThemeStylesheet = null;
    }

    // Create and load the new stylesheet
    const cssPath = getExtensionPath(theme.cssFile);
    console.log(`${LOG_PREFIX} Loading theme CSS from: ${cssPath}`);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = cssPath;
    link.id = 'nemo-theme-stylesheet';

    // Wait for the stylesheet to load
    return new Promise((resolve, reject) => {
        link.onload = () => {
            console.log(`${LOG_PREFIX} Theme CSS loaded successfully: ${cssPath}`);
            loadedThemeStylesheet = link;
            resolve();
        };
        link.onerror = (e) => {
            console.error(`${LOG_PREFIX} Failed to load theme CSS: ${cssPath}`, e);
            reject(e);
        };

        document.head.appendChild(link);
    });
}

/**
 * Apply a theme to the document
 * @param {string} themeName - The theme identifier
 */
export async function applyTheme(themeName) {
    console.log(`${LOG_PREFIX} applyTheme called with: ${themeName}`);

    const theme = THEMES[themeName];

    if (!theme) {
        console.warn(`${LOG_PREFIX} Unknown theme: ${themeName}`);
        return;
    }

    // Mobile guard: refuse to apply any non-default theme on small viewports.
    // The saved setting is left alone so the theme returns on desktop.
    if (themeName !== 'none' && theme.cssFile && isMobileViewport()) {
        console.log(`${LOG_PREFIX} Mobile viewport detected — blocking theme: ${themeName}`);
        stripAppliedTheme();
        showMobileThemeBlockedNotice();
        return;
    }

    // Remove all theme classes from body
    Object.values(THEMES).forEach(t => {
        if (t.bodyClass) {
            document.body.classList.remove(t.bodyClass);
            console.log(`${LOG_PREFIX} Removed body class: ${t.bodyClass}`);
        }
    });

    // Remove previous theme stylesheet
    if (loadedThemeStylesheet) {
        loadedThemeStylesheet.remove();
        loadedThemeStylesheet = null;
        console.log(`${LOG_PREFIX} Removed previous stylesheet`);
    }

    // Tear down enhancements from any previously-active theme (clocks,
    // observers, modal overlays, body-scroll locks, etc.). Each cleanup is
    // a no-op if its theme wasn't active.
    cleanupAllThemeEnhancements();

    // If theme is 'none', we're done
    if (themeName === 'none' || !theme.cssFile) {
        console.log(`${LOG_PREFIX} Theme reset to default`);
        return;
    }

    // Load the new theme CSS
    try {
        await loadThemeCSS(themeName);

        // Add the theme class to body
        if (theme.bodyClass) {
            document.body.classList.add(theme.bodyClass);
            console.log(`${LOG_PREFIX} Added body class: ${theme.bodyClass}`);
            console.log(`${LOG_PREFIX} Body classes now: ${document.body.className}`);
        }

        // Initialize theme-specific enhancements
        if (themeName === 'win98') {
            setTimeout(() => {
                initWin98Enhancements();
            }, 100);
        } else if (themeName === 'discord') {
            setTimeout(() => {
                initDiscordEnhancements();
            }, 100);
        } else if (themeName === 'cyberpunk') {
            setTimeout(() => {
                initCyberpunkEnhancements();
            }, 100);
        } else if (themeName === 'nemotavern') {
            setTimeout(() => {
                initNemoTavernEnhancements();
            }, 100);
        }

        console.log(`${LOG_PREFIX} Applied theme: ${theme.name}`);
    } catch (error) {
        console.error(`${LOG_PREFIX} Failed to apply theme: ${themeName}`, error);
    }
}

/**
 * Get the current theme setting
 * @returns {string} The current theme identifier
 */
export function getCurrentTheme() {
    const theme = extension_settings[NEMO_EXTENSION_NAME]?.uiTheme || 'none';
    console.log(`${LOG_PREFIX} getCurrentTheme: ${theme}`, extension_settings[NEMO_EXTENSION_NAME]);
    return theme;
}

/**
 * Set the theme and save settings
 * @param {string} themeName - The theme identifier
 */
export function setTheme(themeName) {
    if (!THEMES[themeName]) {
        console.warn(`${LOG_PREFIX} Invalid theme: ${themeName}`);
        return;
    }

    if (extension_settings[NEMO_EXTENSION_NAME]) {
        extension_settings[NEMO_EXTENSION_NAME].uiTheme = themeName;
        saveSettingsDebounced();
    }
}

/**
 * Initialize theme selector UI event handlers
 * Uses polling to wait for the settings HTML to load
 */
export function initThemeSelector() {
    // Poll for theme cards since settings HTML loads asynchronously
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max

    const pollForThemeCards = setInterval(() => {
        attempts++;
        const themeCards = document.querySelectorAll('.nemo-theme-card');

        if (themeCards.length > 0) {
            clearInterval(pollForThemeCards);
            attachThemeCardHandlers(themeCards);
        } else if (attempts >= maxAttempts) {
            clearInterval(pollForThemeCards);
            console.log(`${LOG_PREFIX} Theme cards not found after ${maxAttempts} attempts, skipping theme selector init`);
        }
    }, 100);
}

/**
 * Attach event handlers to theme cards
 * @param {NodeListOf<Element>} themeCards - The theme card elements
 */
function attachThemeCardHandlers(themeCards) {
    // Set the currently selected theme
    const currentTheme = getCurrentTheme();
    const mobile = isMobileViewport();

    themeCards.forEach(card => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio && radio.value === currentTheme) {
            radio.checked = true;
        }
        // Visually mark non-default cards as disabled on mobile
        if (mobile && radio && radio.value !== 'none') {
            card.classList.add('nemo-theme-card-mobile-disabled');
            card.style.opacity = '0.55';
            card.title = 'Themes are disabled on mobile';
        }
    });

    // Banner above the cards explaining the mobile lock
    if (mobile && themeCards.length > 0) {
        const container = themeCards[0].parentElement;
        if (container && !container.querySelector('.nemo-mobile-theme-banner')) {
            const banner = document.createElement('div');
            banner.className = 'nemo-mobile-theme-banner';
            banner.innerHTML = '<i class="fa-solid fa-mobile-screen"></i> Themes are disabled on mobile to prevent layout issues. Saved themes will return on a larger screen.';
            banner.style.cssText = 'background:rgba(255,200,50,0.12);border:1px solid rgba(255,200,50,0.4);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:0.85em;color:var(--SmartThemeBodyColor,#eee);display:flex;align-items:center;gap:8px;line-height:1.3;';
            container.insertBefore(banner, themeCards[0]);
        }
    }

    // Add click handlers to theme cards
    themeCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const radio = card.querySelector('input[type="radio"]');
            if (!radio) return;

            // Block non-default selections on mobile
            if (radio.value !== 'none' && isMobileViewport()) {
                e.preventDefault();
                e.stopPropagation();
                showMobileThemeBlockedNotice();
                // Force the radio state to reflect the actual applied theme ('none')
                themeCards.forEach(c => {
                    const r = c.querySelector('input[type="radio"]');
                    if (r) r.checked = (r.value === 'none');
                });
                return;
            }

            // Don't trigger if clicking on the radio itself (it handles itself)
            if (e.target.type === 'radio') return;

            radio.checked = true;
            handleThemeChange(radio.value);
        });

        // Also handle radio change directly
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
            radio.addEventListener('change', (e) => {
                if (!e.target.checked) return;

                if (e.target.value !== 'none' && isMobileViewport()) {
                    showMobileThemeBlockedNotice();
                    themeCards.forEach(c => {
                        const r = c.querySelector('input[type="radio"]');
                        if (r) r.checked = (r.value === 'none');
                    });
                    return;
                }

                handleThemeChange(e.target.value);
            });
        }
    });

    console.log(`${LOG_PREFIX} Theme selector initialized with ${themeCards.length} theme cards (mobile=${mobile})`);
}

/**
 * Handle theme change from UI
 * @param {string} themeName - The selected theme
 */
function handleThemeChange(themeName) {
    setTheme(themeName);

    // Show a notification that refresh is required
    const statusElement = document.createElement('div');
    statusElement.className = 'nemo-theme-change-notice';
    statusElement.innerHTML = `
        <i class="fa-solid fa-info-circle"></i>
        <span>Theme will be applied after page refresh</span>
        <button class="nemo-refresh-now-btn">Refresh Now</button>
    `;
    statusElement.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--SmartThemeQuoteColor, #4a9eff);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;

    // Add animation keyframes if not already present
    if (!document.getElementById('nemo-theme-notice-styles')) {
        const style = document.createElement('style');
        style.id = 'nemo-theme-notice-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .nemo-refresh-now-btn {
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
            }
            .nemo-refresh-now-btn:hover {
                background: rgba(255,255,255,0.3);
            }
        `;
        document.head.appendChild(style);
    }

    // Remove any existing notice
    const existingNotice = document.querySelector('.nemo-theme-change-notice');
    if (existingNotice) {
        existingNotice.remove();
    }

    document.body.appendChild(statusElement);

    // Add refresh button handler
    const refreshBtn = statusElement.querySelector('.nemo-refresh-now-btn');
    refreshBtn.addEventListener('click', () => {
        window.location.reload();
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (statusElement.parentNode) {
            statusElement.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => statusElement.remove(), 300);
        }
    }, 5000);

    console.log(`${LOG_PREFIX} Theme changed to: ${themeName}`);
}

/**
 * Initialize themes on page load
 * Should be called during extension initialization
 */
export async function initializeThemes() {
    console.log(`${LOG_PREFIX} initializeThemes called`);

    const currentTheme = getCurrentTheme();
    console.log(`${LOG_PREFIX} Current theme setting: "${currentTheme}"`);

    if (currentTheme && currentTheme !== 'none') {
        console.log(`${LOG_PREFIX} Applying saved theme: ${currentTheme}`);
        await applyTheme(currentTheme);
    } else {
        console.log(`${LOG_PREFIX} No theme to apply (theme is "${currentTheme}")`);
    }
}

// Export available themes for reference
export { THEMES };
