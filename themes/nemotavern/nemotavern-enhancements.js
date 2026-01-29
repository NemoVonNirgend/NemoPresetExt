/**
 * NemoTavern Theme Enhancements
 * Modern glassmorphism UI with floating panels, command palette, and unified settings
 */

// Track initialization state
let initialized = false;
let reactAppMounted = false;
let bodyClassObserver = null;

// Base path for loading assets
const EXTENSION_BASE_PATH = 'scripts/extensions/third-party/NemoPresetExt/';

/**
 * Check if NemoTavern theme is active
 */
function isNemoTavernThemeActive() {
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isStylesheetLoaded = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('nemotavern');
    const hasBodyClass = document.body.classList.contains('nemo-theme-nemotavern');
    return hasBodyClass || isStylesheetLoaded;
}

/**
 * Ensure body class is added when theme is active
 */
export function ensureBodyClass() {
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isNemoStylesheet = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('nemotavern');

    if (isNemoStylesheet) {
        if (!document.body.classList.contains('nemo-theme-nemotavern')) {
            document.body.classList.add('nemo-theme-nemotavern');
            console.log('[NemoTavern Theme] Added body class nemo-theme-nemotavern');
        }
    } else {
        if (document.body.classList.contains('nemo-theme-nemotavern')) {
            document.body.classList.remove('nemo-theme-nemotavern');
            console.log('[NemoTavern Theme] Removed body class - stylesheet not active');
        }
    }
}

/**
 * Start watching for body class removal and re-add it
 */
function startBodyClassWatcher() {
    if (bodyClassObserver) {
        return; // Already watching
    }

    bodyClassObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
                const isNemoStylesheet = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('nemotavern');

                if (isNemoStylesheet && !document.body.classList.contains('nemo-theme-nemotavern')) {
                    console.log('[NemoTavern Theme] Body class was removed, re-adding...');
                    document.body.classList.add('nemo-theme-nemotavern');
                }
            }
        }
    });

    bodyClassObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });

    console.log('[NemoTavern Theme] Body class watcher started');
}

/**
 * Create the React mount point
 */
function createReactMountPoint() {
    if (document.getElementById('nemo-root')) {
        return document.getElementById('nemo-root');
    }

    const root = document.createElement('div');
    root.id = 'nemo-root';
    document.body.appendChild(root);

    console.log('[NemoTavern Theme] React mount point created');
    return root;
}

/**
 * Load and mount the React application
 */
async function mountReactApp() {
    if (reactAppMounted) {
        console.log('[NemoTavern Theme] React app already mounted');
        return;
    }

    const root = createReactMountPoint();

    try {
        // Load the bundled React app
        const scriptPath = EXTENSION_BASE_PATH + 'features/nemotavern/react/dist/nemotavern.js';

        // Check if script already exists
        if (document.querySelector(`script[src="${scriptPath}"]`)) {
            console.log('[NemoTavern Theme] React bundle already loaded');
            reactAppMounted = true;
            return;
        }

        const script = document.createElement('script');
        script.src = scriptPath;
        script.type = 'module';

        await new Promise((resolve, reject) => {
            script.onload = () => {
                console.log('[NemoTavern Theme] React bundle loaded successfully');
                reactAppMounted = true;
                resolve();
            };
            script.onerror = (e) => {
                console.warn('[NemoTavern Theme] Failed to load React bundle, falling back to vanilla JS', e);
                reject(e);
            };
            document.body.appendChild(script);
        });

        // Add UI active class for hiding original drawers
        document.body.classList.add('nemo-ui-active');

    } catch (error) {
        console.warn('[NemoTavern Theme] React app not available, using vanilla enhancements', error);
        initVanillaEnhancements();
    }
}

/**
 * Unmount React application
 */
function unmountReactApp() {
    if (!reactAppMounted) return;

    // Dispatch cleanup event for React
    window.dispatchEvent(new CustomEvent('nemo:cleanup'));

    // Remove the root element
    const root = document.getElementById('nemo-root');
    if (root) {
        root.remove();
    }

    // Remove UI active class
    document.body.classList.remove('nemo-ui-active');

    // Remove the script
    const script = document.querySelector(`script[src*="nemotavern.js"]`);
    if (script) {
        script.remove();
    }

    reactAppMounted = false;
    console.log('[NemoTavern Theme] React app unmounted');
}

/**
 * Initialize vanilla JS enhancements (fallback if React not available)
 */
function initVanillaEnhancements() {
    console.log('[NemoTavern Theme] Initializing vanilla enhancements...');

    // Setup command palette keyboard shortcut
    setupCommandPaletteShortcut();

    // Apply basic glassmorphism to existing elements
    applyBasicGlassmorphism();
}

/**
 * Setup Cmd/Ctrl+K keyboard shortcut for command palette
 */
function setupCommandPaletteShortcut() {
    document.addEventListener('keydown', (e) => {
        // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();

            // Dispatch event for React to handle
            window.dispatchEvent(new CustomEvent('nemo:toggle-command-palette'));

            // If React not mounted, show basic command palette
            if (!reactAppMounted) {
                showBasicCommandPalette();
            }
        }

        // Escape to close
        if (e.key === 'Escape') {
            window.dispatchEvent(new CustomEvent('nemo:close-command-palette'));
            hideBasicCommandPalette();
        }
    });

    console.log('[NemoTavern Theme] Command palette shortcut registered (Cmd/Ctrl+K)');
}

/**
 * Show basic command palette (vanilla JS fallback)
 */
function showBasicCommandPalette() {
    if (document.getElementById('nemo-basic-command-palette')) return;

    const overlay = document.createElement('div');
    overlay.id = 'nemo-basic-command-palette';
    overlay.className = 'nemo-command-overlay nemo-animate-fade-in';

    overlay.innerHTML = `
        <div class="nemo-command-palette nemo-animate-scale-in">
            <input
                type="text"
                class="nemo-command-input"
                placeholder="Type a command..."
                autofocus
            />
            <div class="nemo-command-list">
                <div class="nemo-command-item active" data-action="settings">
                    <span class="nemo-command-item-icon"><i class="fa-solid fa-gear"></i></span>
                    <span class="nemo-command-item-label">Open Settings</span>
                    <span class="nemo-command-item-shortcut">⌘,</span>
                </div>
                <div class="nemo-command-item" data-action="characters">
                    <span class="nemo-command-item-icon"><i class="fa-solid fa-users"></i></span>
                    <span class="nemo-command-item-label">Character List</span>
                </div>
                <div class="nemo-command-item" data-action="world-info">
                    <span class="nemo-command-item-icon"><i class="fa-solid fa-book"></i></span>
                    <span class="nemo-command-item-label">World Info</span>
                </div>
                <div class="nemo-command-item" data-action="extensions">
                    <span class="nemo-command-item-icon"><i class="fa-solid fa-puzzle-piece"></i></span>
                    <span class="nemo-command-item-label">Extensions</span>
                </div>
                <div class="nemo-command-item" data-action="new-chat">
                    <span class="nemo-command-item-icon"><i class="fa-solid fa-plus"></i></span>
                    <span class="nemo-command-item-label">New Chat</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Focus input
    const input = overlay.querySelector('.nemo-command-input');
    input.focus();

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            hideBasicCommandPalette();
        }
    });

    // Handle item clicks
    overlay.querySelectorAll('.nemo-command-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            executeCommand(action);
            hideBasicCommandPalette();
        });
    });

    // Handle keyboard navigation
    input.addEventListener('keydown', (e) => {
        const items = overlay.querySelectorAll('.nemo-command-item');
        const activeItem = overlay.querySelector('.nemo-command-item.active');
        const activeIndex = Array.from(items).indexOf(activeItem);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (activeIndex + 1) % items.length;
            items.forEach(i => i.classList.remove('active'));
            items[nextIndex].classList.add('active');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = (activeIndex - 1 + items.length) % items.length;
            items.forEach(i => i.classList.remove('active'));
            items[prevIndex].classList.add('active');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeItem) {
                executeCommand(activeItem.dataset.action);
                hideBasicCommandPalette();
            }
        }
    });

    // Filter on input
    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const items = overlay.querySelectorAll('.nemo-command-item');

        items.forEach(item => {
            const label = item.querySelector('.nemo-command-item-label').textContent.toLowerCase();
            item.style.display = label.includes(query) ? 'flex' : 'none';
        });

        // Reset active state
        const visibleItems = overlay.querySelectorAll('.nemo-command-item[style="display: flex"], .nemo-command-item:not([style])');
        items.forEach(i => i.classList.remove('active'));
        if (visibleItems.length > 0) {
            visibleItems[0].classList.add('active');
        }
    });
}

/**
 * Hide basic command palette
 */
function hideBasicCommandPalette() {
    const palette = document.getElementById('nemo-basic-command-palette');
    if (palette) {
        palette.remove();
    }
}

/**
 * Execute a command action
 */
function executeCommand(action) {
    console.log('[NemoTavern Theme] Executing command:', action);

    switch (action) {
        case 'settings':
            // Click the settings drawer icon
            document.querySelector('#user-settings-button .drawer-icon')?.click();
            break;
        case 'characters':
            document.querySelector('#rightNavHolder .drawer-icon')?.click();
            break;
        case 'world-info':
            document.querySelector('#WI-SP-button .drawer-icon')?.click();
            break;
        case 'extensions':
            document.querySelector('#extensions-settings-button .drawer-icon')?.click();
            break;
        case 'new-chat':
            document.querySelector('#option_start_new_chat')?.click();
            break;
        default:
            console.log('[NemoTavern Theme] Unknown command:', action);
    }
}

/**
 * Apply basic glassmorphism to existing elements
 */
function applyBasicGlassmorphism() {
    // Elements that should get the glass treatment
    const glassElements = [
        '.drawer-content',
        '.popup',
        '#top-bar'
    ];

    glassElements.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.classList.add('nemo-glass-panel');
        });
    });

    console.log('[NemoTavern Theme] Applied basic glassmorphism');
}

/**
 * Initialize NemoTavern enhancements
 */
export function initNemoTavernEnhancements() {
    console.log('[NemoTavern Theme] initNemoTavernEnhancements called');

    // Check if theme stylesheet is loaded first
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isNemoStylesheet = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('nemotavern');

    if (!isNemoStylesheet) {
        console.log('[NemoTavern Theme] NemoTavern stylesheet not loaded, skipping');
        return;
    }

    // Ensure body class
    ensureBodyClass();

    // Start watching for body class changes
    startBodyClassWatcher();

    if (!isNemoTavernThemeActive()) {
        console.log('[NemoTavern Theme] Theme not active, skipping enhancements');
        return;
    }

    if (initialized) {
        console.log('[NemoTavern Theme] Already initialized');
        return;
    }

    console.log('[NemoTavern Theme] Initializing enhancements...');

    // Mount the React application
    mountReactApp();

    initialized = true;
    console.log('[NemoTavern Theme] Enhancements initialized');
}

/**
 * Cleanup function for when theme is switched
 */
export function cleanupNemoTavernEnhancements() {
    // Stop the body class watcher
    if (bodyClassObserver) {
        bodyClassObserver.disconnect();
        bodyClassObserver = null;
        console.log('[NemoTavern Theme] Body class watcher stopped');
    }

    // Unmount React app
    unmountReactApp();

    // Hide command palette
    hideBasicCommandPalette();

    // Remove glass classes
    document.querySelectorAll('.nemo-glass-panel').forEach(el => {
        el.classList.remove('nemo-glass-panel');
    });

    // Reset initialized flag
    initialized = false;

    console.log('[NemoTavern Theme] Enhancements cleaned up');
}

// ===== Event Bridge for React <-> Vanilla JS =====

/**
 * Open a specific panel by ID
 */
export function openPanel(panelId) {
    window.dispatchEvent(new CustomEvent('nemo:open-panel', { detail: { panelId } }));
}

/**
 * Close a specific panel by ID
 */
export function closePanel(panelId) {
    window.dispatchEvent(new CustomEvent('nemo:close-panel', { detail: { panelId } }));
}

/**
 * Toggle command palette
 */
export function toggleCommandPalette() {
    window.dispatchEvent(new CustomEvent('nemo:toggle-command-palette'));
}

/**
 * Toggle settings modal
 */
export function toggleSettings() {
    window.dispatchEvent(new CustomEvent('nemo:toggle-settings'));
}

// ===== Auto-initialization =====

function autoInit() {
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isNemoStylesheet = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('nemotavern');

    if (isNemoStylesheet && !initialized) {
        console.log('[NemoTavern Theme] Auto-init triggered');
        initNemoTavernEnhancements();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
} else {
    autoInit();
}

// Try auto-init at multiple time points
setTimeout(autoInit, 500);
setTimeout(autoInit, 1000);
setTimeout(autoInit, 2000);
setTimeout(autoInit, 5000);

// Watch for theme stylesheet load
const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (isNemoTavernThemeActive() && !initialized) {
                console.log('[NemoTavern Theme] Theme class change detected, initializing...');
                initNemoTavernEnhancements();
            }
        }
        if (mutation.type === 'childList' && mutation.target === document.head) {
            mutation.addedNodes.forEach(node => {
                if (node.id === 'nemo-theme-stylesheet' && node.href && node.href.includes('nemotavern')) {
                    console.log('[NemoTavern Theme] Stylesheet loaded, ensuring body class...');
                    ensureBodyClass();
                    setTimeout(initNemoTavernEnhancements, 500);
                }
            });
        }
    });
});

themeObserver.observe(document.body, { attributes: true });
themeObserver.observe(document.head, { childList: true });

export default {
    initNemoTavernEnhancements,
    cleanupNemoTavernEnhancements,
    ensureBodyClass,
    openPanel,
    closePanel,
    toggleCommandPalette,
    toggleSettings
};
