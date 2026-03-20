/**
 * NemoTavern Theme Enhancements
 * Modern glassmorphism UI with floating panels, command palette, and unified settings
 */

// Track initialization state
let initialized = false;
let reactAppMounted = false;
let bodyClassObserver = null;

// Base path for loading assets — centralized constant
import { getExtensionPath } from '../../core/utils.js';

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
        const scriptPath = getExtensionPath('features/nemotavern/react/dist/nemotavern.js');

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

    // Setup glassmorphism modal system for drawer content (same pattern as Discord/Cyberpunk themes)
    setupNemoTavernModals();

    // Mount the React application
    mountReactApp();

    initialized = true;
    console.log('[NemoTavern Theme] Enhancements initialized');
}

// ============================================================
// NEMOTAVERN GLASSMORPHISM MODAL SYSTEM
// Adapted from the proven Discord/Cyberpunk theme modal pattern.
// Intercepts drawer icon clicks, physically moves .drawer-content
// into a glassmorphism overlay, and returns it on close.
// ============================================================

const NEMO_MODAL_NAV_ITEMS = [
    { id: 'ai-config-button', icon: 'fa-microchip', label: 'AI Config' },
    { id: 'sys-settings-button', icon: 'fa-plug', label: 'Connection' },
    { id: 'advanced-formatting-button', icon: 'fa-code', label: 'Formatting' },
    { id: 'WI-SP-button', icon: 'fa-book', label: 'World Info' },
    { id: 'user-settings-button', icon: 'fa-gear', label: 'User Settings' },
    { id: 'backgrounds-button', icon: 'fa-image', label: 'Backgrounds' },
    { id: 'extensions-settings-button', icon: 'fa-puzzle-piece', label: 'Extensions' },
    { id: 'persona-management-button', icon: 'fa-id-card', label: 'Personas' },
    { id: 'rightNavHolder', icon: 'fa-users', label: 'Characters' },
];

const NEMO_MODAL_TITLES = {
    'ai-config-button': 'AI Configuration',
    'sys-settings-button': 'Connection Settings',
    'advanced-formatting-button': 'Advanced Formatting',
    'WI-SP-button': 'World Info',
    'user-settings-button': 'User Settings',
    'backgrounds-button': 'Backgrounds',
    'extensions-settings-button': 'Extensions',
    'persona-management-button': 'Persona Management',
    'rightNavHolder': 'Character Management',
};

function setupNemoTavernModals() {
    const settingsHolder = document.getElementById('top-settings-holder');
    if (!settingsHolder) {
        console.log('[NemoTavern Theme] top-settings-holder not found');
        return;
    }

    // Create the modal overlay (hidden by default)
    createNemoModalOverlay();

    // Inject the quick-access menu button (top-right corner)
    injectQuickAccessMenu();

    // Intercept drawer icon clicks to open our modal instead
    const drawers = settingsHolder.querySelectorAll('.drawer');
    drawers.forEach(drawer => {
        const drawerId = drawer.id;
        const drawerIcon = drawer.querySelector('.drawer-icon');
        if (!drawerIcon) return;

        drawerIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            openNemoModal(drawerId);
        }, true);
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNemoModal();
    });

    console.log('[NemoTavern Theme] Modal system initialized');
}

function createNemoModalOverlay() {
    const existing = document.getElementById('nemo-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'nemo-modal-overlay';
    overlay.className = 'nemo-modal-overlay';
    overlay.innerHTML = `
        <div class="nemo-modal-container" role="dialog" aria-modal="true" aria-labelledby="nemo-modal-title">
            <div class="nemo-modal-sidebar">
                <div class="nemo-modal-sidebar-header">Settings</div>
                <div class="nemo-modal-nav" id="nemo-modal-nav"></div>
            </div>
            <div class="nemo-modal-main">
                <div class="nemo-modal-header">
                    <h2 id="nemo-modal-title" class="nemo-modal-title">Settings</h2>
                    <button class="nemo-modal-close" id="nemo-modal-close" aria-label="Close settings">
                        <i class="fa-solid fa-xmark"></i>
                        <span class="nemo-modal-close-hint">ESC</span>
                    </button>
                </div>
                <div class="nemo-modal-body" id="nemo-modal-body"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeNemoModal();
    });

    // Close button
    const closeBtn = overlay.querySelector('#nemo-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeNemoModal();
        });
    }

    // Inject modal styles
    addNemoModalStyles();

    console.log('[NemoTavern Theme] Modal overlay created');
}

function returnNemoModalContent() {
    const modalBody = document.getElementById('nemo-modal-body');
    if (!modalBody) return;

    const contents = modalBody.querySelectorAll('.drawer-content');
    contents.forEach(drawerContent => {
        if (drawerContent.dataset.originalParent) {
            const originalDrawer = document.getElementById(drawerContent.dataset.originalParent);
            if (originalDrawer) {
                drawerContent.style.display = drawerContent.dataset.wasDisplay || '';
                drawerContent.style.position = '';
                drawerContent.style.width = '';
                drawerContent.style.height = '';
                drawerContent.style.maxHeight = '';
                drawerContent.style.transform = '';
                drawerContent.style.opacity = '';
                drawerContent.style.visibility = '';
                originalDrawer.appendChild(drawerContent);
                console.log('[NemoTavern Theme] Returned content to:', drawerContent.dataset.originalParent);
            }
            delete drawerContent.dataset.originalParent;
            delete drawerContent.dataset.wasDisplay;
        }
    });
    modalBody.innerHTML = '';
}

function openNemoModal(drawerId) {
    const overlay = document.getElementById('nemo-modal-overlay');
    const modalBody = document.getElementById('nemo-modal-body');
    const modalTitle = document.getElementById('nemo-modal-title');
    const modalNav = document.getElementById('nemo-modal-nav');

    if (!overlay || !modalBody) {
        console.log('[NemoTavern Theme] Modal elements not found');
        return;
    }

    const drawer = document.getElementById(drawerId);
    if (!drawer) {
        console.log('[NemoTavern Theme] Drawer not found:', drawerId);
        return;
    }

    const drawerContent = drawer.querySelector('.drawer-content');
    if (!drawerContent) {
        console.log('[NemoTavern Theme] Drawer content not found in:', drawerId);
        return;
    }

    // Return any existing content first
    returnNemoModalContent();

    // Update title
    modalTitle.textContent = NEMO_MODAL_TITLES[drawerId] || 'Settings';

    // Update sidebar nav
    modalNav.innerHTML = NEMO_MODAL_NAV_ITEMS.map(item => `
        <button type="button" class="nemo-modal-nav-item ${item.id === drawerId ? 'active' : ''}"
                data-target="${item.id}" aria-label="${item.label}">
            <i class="fa-solid ${item.icon}"></i>
            <span>${item.label}</span>
        </button>
    `).join('');

    // Attach nav click handlers
    modalNav.querySelectorAll('.nemo-modal-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;
            if (targetId && targetId !== drawerId) {
                openNemoModal(targetId);
            }
        });
    });

    // Move drawer content into modal (the proven pattern)
    drawerContent.dataset.originalParent = drawerId;
    drawerContent.dataset.wasDisplay = drawerContent.style.display || '';
    modalBody.appendChild(drawerContent);

    // Force visible
    drawerContent.style.display = 'block';
    drawerContent.style.position = 'static';
    drawerContent.style.width = '100%';
    drawerContent.style.height = 'auto';
    drawerContent.style.maxHeight = 'none';
    drawerContent.style.transform = 'none';
    drawerContent.style.opacity = '1';
    drawerContent.style.visibility = 'visible';

    // Show overlay
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
    overlay.dataset.currentDrawer = drawerId;

    console.log('[NemoTavern Theme] Modal opened for:', drawerId);
}

function closeNemoModal() {
    const overlay = document.getElementById('nemo-modal-overlay');
    if (!overlay) return;

    returnNemoModalContent();
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
    delete overlay.dataset.currentDrawer;
    console.log('[NemoTavern Theme] Modal closed');
}

/**
 * Inject a floating quick-access menu button (top-right corner).
 * Opens the modal directly — doesn't rely on ST's drawer toggle.
 */
function injectQuickAccessMenu() {
    if (document.getElementById('nemo-escape-hatch')) return;

    const container = document.createElement('div');
    container.id = 'nemo-escape-hatch';
    container.innerHTML = `
        <button id="nemo-escape-hatch-toggle" title="NemoTavern Quick Menu" aria-label="Open quick settings menu">
            <i class="fa-solid fa-bars"></i>
        </button>
        <div id="nemo-escape-hatch-menu" class="nemo-escape-menu-hidden">
            <button data-drawer="extensions-settings-button"><i class="fa-solid fa-puzzle-piece"></i> Extensions</button>
            <button data-drawer="user-settings-button"><i class="fa-solid fa-gear"></i> Settings</button>
            <button data-drawer="ai-config-button"><i class="fa-solid fa-microchip"></i> AI Config</button>
            <button data-drawer="WI-SP-button"><i class="fa-solid fa-book"></i> World Info</button>
            <button data-drawer="backgrounds-button"><i class="fa-solid fa-image"></i> Backgrounds</button>
            <button data-drawer="rightNavHolder"><i class="fa-solid fa-users"></i> Characters</button>
        </div>
    `;

    document.body.appendChild(container);

    const toggle = container.querySelector('#nemo-escape-hatch-toggle');
    const menu = container.querySelector('#nemo-escape-hatch-menu');

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('nemo-escape-menu-hidden');
    });

    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            menu.classList.add('nemo-escape-menu-hidden');
        }
    });

    // Each button opens the modal directly
    menu.querySelectorAll('button[data-drawer]').forEach(btn => {
        btn.addEventListener('click', () => {
            openNemoModal(btn.dataset.drawer);
            menu.classList.add('nemo-escape-menu-hidden');
        });
    });

    console.log('[NemoTavern Theme] Quick access menu injected');
}

function addNemoModalStyles() {
    if (document.getElementById('nemo-modal-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'nemo-modal-styles';
    styles.textContent = `
        /* Quick Access Menu Button */
        #nemo-escape-hatch {
            position: fixed;
            top: 12px;
            right: 12px;
            z-index: 99999;
        }
        #nemo-escape-hatch-toggle {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            background: rgba(13, 13, 20, 0.85);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            transition: all 0.2s ease;
        }
        #nemo-escape-hatch-toggle:hover {
            background: rgba(99, 102, 241, 0.3);
            border-color: rgba(99, 102, 241, 0.6);
            color: #fff;
            box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
        }
        #nemo-escape-hatch-menu {
            position: absolute;
            top: 42px;
            right: 0;
            min-width: 180px;
            background: rgba(13, 13, 20, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 10px;
            padding: 6px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        #nemo-escape-hatch-menu button {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            background: transparent;
            color: rgba(255, 255, 255, 0.8);
            font-size: 13px;
            cursor: pointer;
            transition: all 0.15s ease;
            text-align: left;
            white-space: nowrap;
        }
        #nemo-escape-hatch-menu button:hover {
            background: rgba(99, 102, 241, 0.2);
            color: #fff;
        }
        #nemo-escape-hatch-menu button i {
            width: 16px;
            text-align: center;
            opacity: 0.7;
        }
        .nemo-escape-menu-hidden {
            display: none !important;
        }

        /* Modal Overlay */
        .nemo-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99998;
            align-items: center;
            justify-content: center;
            animation: nemoModalFadeIn 0.2s ease;
        }
        .nemo-modal-overlay.visible {
            display: flex;
        }
        @keyframes nemoModalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        /* Modal Container */
        .nemo-modal-container {
            width: 92%;
            max-width: 1200px;
            height: 85vh;
            background: rgba(22, 22, 35, 0.98);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 16px;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.15);
            display: flex;
            overflow: hidden;
            animation: nemoModalSlideIn 0.3s ease;
        }
        @keyframes nemoModalSlideIn {
            from { transform: translateY(-20px) scale(0.98); opacity: 0; }
            to { transform: translateY(0) scale(1); opacity: 1; }
        }

        /* Sidebar */
        .nemo-modal-sidebar {
            width: 200px;
            min-width: 200px;
            background: rgba(16, 16, 28, 0.95);
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        }
        .nemo-modal-sidebar-header {
            padding: 20px 16px 12px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: rgba(255, 255, 255, 0.55);
        }
        .nemo-modal-nav {
            display: flex;
            flex-direction: column;
            padding: 0 8px;
            gap: 2px;
        }
        .nemo-modal-nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border: none;
            border-radius: 8px;
            background: transparent;
            color: rgba(255, 255, 255, 0.75);
            font-size: 14px;
            cursor: pointer;
            transition: all 0.15s ease;
            text-align: left;
        }
        .nemo-modal-nav-item:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
        }
        .nemo-modal-nav-item.active {
            background: rgba(99, 102, 241, 0.2);
            color: #c7d2fe;
        }
        .nemo-modal-nav-item i {
            width: 20px;
            text-align: center;
            font-size: 15px;
            opacity: 0.8;
        }

        /* Main Content Area */
        .nemo-modal-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .nemo-modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .nemo-modal-title {
            font-size: 18px;
            font-weight: 600;
            color: #fff;
            margin: 0;
        }
        .nemo-modal-close {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            transition: all 0.15s ease;
            font-size: 14px;
        }
        .nemo-modal-close:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border-color: rgba(255, 255, 255, 0.3);
        }
        .nemo-modal-close-hint {
            font-size: 10px;
            opacity: 0.5;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 4px;
            padding: 1px 5px;
        }

        /* Body (where drawer content goes) */
        .nemo-modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 20px 24px;
        }
        .nemo-modal-body .drawer-content {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }

        /* Scrollbar */
        .nemo-modal-body::-webkit-scrollbar,
        .nemo-modal-sidebar::-webkit-scrollbar {
            width: 6px;
        }
        .nemo-modal-body::-webkit-scrollbar-track,
        .nemo-modal-sidebar::-webkit-scrollbar-track {
            background: transparent;
        }
        .nemo-modal-body::-webkit-scrollbar-thumb,
        .nemo-modal-sidebar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 3px;
        }
        .nemo-modal-body::-webkit-scrollbar-thumb:hover,
        .nemo-modal-sidebar::-webkit-scrollbar-thumb:hover {
            background: rgba(99, 102, 241, 0.5);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .nemo-modal-sidebar {
                width: 56px;
                min-width: 56px;
            }
            .nemo-modal-nav-item span {
                display: none;
            }
            .nemo-modal-sidebar-header {
                display: none;
            }
        }
    `;
    document.head.appendChild(styles);
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

    // Close and return any modal content before cleanup
    closeNemoModal();

    // Remove modal elements
    const modalOverlay = document.getElementById('nemo-modal-overlay');
    if (modalOverlay) modalOverlay.remove();
    const modalStyles = document.getElementById('nemo-modal-styles');
    if (modalStyles) modalStyles.remove();
    const escapeHatch = document.getElementById('nemo-escape-hatch');
    if (escapeHatch) escapeHatch.remove();

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
