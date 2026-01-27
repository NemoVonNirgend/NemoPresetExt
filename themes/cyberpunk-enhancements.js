/**
 * Cyberpunk/Arasaka Theme Enhancements
 * Adds CLI-style UI elements and terminal effects
 */

// MutationObserver to keep body class persistent
let bodyClassObserver = null;

// Check if Cyberpunk theme is active
function isCyberpunkThemeActive() {
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isStylesheetLoaded = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('cyberpunk');
    const hasBodyClass = document.body.classList.contains('nemo-theme-cyberpunk');
    return hasBodyClass || isStylesheetLoaded;
}

// Ensure body class is added when theme is active
export function ensureBodyClass() {
    // Only add body class if the cyberpunk stylesheet is actually loaded
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isCyberpunkStylesheet = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('cyberpunk');

    if (isCyberpunkStylesheet) {
        if (!document.body.classList.contains('nemo-theme-cyberpunk')) {
            document.body.classList.add('nemo-theme-cyberpunk');
            console.log('[Cyberpunk Theme] Added body class nemo-theme-cyberpunk');
        }
    } else {
        // Remove class if stylesheet is not loaded
        if (document.body.classList.contains('nemo-theme-cyberpunk')) {
            document.body.classList.remove('nemo-theme-cyberpunk');
            console.log('[Cyberpunk Theme] Removed body class - stylesheet not active');
        }
    }
}

// Start watching for body class removal and re-add it
function startBodyClassWatcher() {
    if (bodyClassObserver) {
        return; // Already watching
    }

    bodyClassObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                // Only re-add if the cyberpunk stylesheet is actually loaded
                const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
                const isCyberpunkStylesheet = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('cyberpunk');

                if (isCyberpunkStylesheet && !document.body.classList.contains('nemo-theme-cyberpunk')) {
                    console.log('[Cyberpunk Theme] Body class was removed, re-adding...');
                    document.body.classList.add('nemo-theme-cyberpunk');
                }
            }
        }
    });

    bodyClassObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });

    console.log('[Cyberpunk Theme] Body class watcher started');
}

// Also periodically check and re-add the class (backup for edge cases)
let classCheckInterval = null;
function startPeriodicClassCheck() {
    if (classCheckInterval) {
        return;
    }

    // Check every 500ms for the first 10 seconds
    let checks = 0;
    classCheckInterval = setInterval(() => {
        checks++;

        // Only re-add if the cyberpunk stylesheet is actually loaded
        const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
        const isCyberpunkStylesheet = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('cyberpunk');

        if (isCyberpunkStylesheet && !document.body.classList.contains('nemo-theme-cyberpunk')) {
            document.body.classList.add('nemo-theme-cyberpunk');
            console.log('[Cyberpunk Theme] Periodic check: Re-added body class');
        }

        // Stop after 20 checks (10 seconds)
        if (checks >= 20) {
            clearInterval(classCheckInterval);
            classCheckInterval = null;
            console.log('[Cyberpunk Theme] Periodic check completed');
        }
    }, 500);
}

// Track if we've initialized
let initialized = false;

// Initialize Cyberpunk enhancements
export function initCyberpunkEnhancements() {
    console.log('[Cyberpunk Theme] initCyberpunkEnhancements called');

    // Check if theme stylesheet is loaded first
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isCyberpunkStylesheet = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('cyberpunk');

    if (!isCyberpunkStylesheet) {
        console.log('[Cyberpunk Theme] Cyberpunk stylesheet not loaded, skipping');
        return;
    }

    // Ensure body class
    ensureBodyClass();

    // Start watching for body class changes (to prevent removal)
    startBodyClassWatcher();

    // Also start periodic checking as backup
    startPeriodicClassCheck();

    if (!isCyberpunkThemeActive()) {
        console.log('[Cyberpunk Theme] Theme not active, skipping enhancements');
        return;
    }

    if (initialized) {
        console.log('[Cyberpunk Theme] Already initialized');
        return;
    }

    console.log('[Cyberpunk Theme] Initializing enhancements...');

    // Create the custom header bar (backup for CSS)
    createHeaderBar();

    // Add terminal boot sequence effect
    addBootSequence();

    // Add system time display
    addSystemClock();

    // Add typing sound effect option
    setupTypingEffects();

    // Add glitch effect on certain interactions
    setupGlitchEffects();

    // Setup cyberpunk terminal modals for drawers
    setupCyberpunkModals();

    initialized = true;
    console.log('[Cyberpunk Theme] Enhancements initialized');
}

// Create the Arasaka header bar via JavaScript
function createHeaderBar() {
    // Check if already exists
    if (document.getElementById('cyberpunk-header-bar')) {
        return;
    }

    const headerBar = document.createElement('div');
    headerBar.id = 'cyberpunk-header-bar';
    headerBar.innerHTML = `
        <div class="cyber-logo">NEMONET//NEURAL_LINK</div>
        <div class="cyber-spacer"></div>
        <div class="cyber-status" id="cyberpunk-system-clock">SYS_TIME: --:--:--</div>
    `;

    // Try to insert before #sheld (main content area) or at the start of body
    const sheld = document.getElementById('sheld');
    if (sheld && sheld.parentNode) {
        sheld.parentNode.insertBefore(headerBar, sheld);
    } else {
        // Fallback: insert at the very beginning of body
        document.body.insertBefore(headerBar, document.body.firstChild);
    }

    console.log('[Cyberpunk Theme] Header bar created');
}

// Add a brief boot sequence animation on page load
function addBootSequence() {
    // Only show on initial load, not on theme switch
    if (sessionStorage.getItem('cyberpunk-booted')) {
        return;
    }

    const bootOverlay = document.createElement('div');
    bootOverlay.id = 'cyberpunk-boot-overlay';
    bootOverlay.innerHTML = `
        <div class="cyberpunk-boot-content">
            <div class="cyberpunk-boot-logo">NEMONET</div>
            <div class="cyberpunk-boot-subtitle">NEURAL INTERFACE v2.077</div>
            <div class="cyberpunk-boot-progress">
                <div class="cyberpunk-boot-bar"></div>
            </div>
            <div class="cyberpunk-boot-status">INITIALIZING SYSTEM...</div>
        </div>
    `;

    // Add boot styles
    const bootStyles = document.createElement('style');
    bootStyles.id = 'cyberpunk-boot-styles';
    bootStyles.textContent = `
        #cyberpunk-boot-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #0a0a0f;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bootFadeOut 0.5s ease 2.5s forwards;
        }

        .cyberpunk-boot-content {
            text-align: center;
            font-family: 'Consolas', monospace;
        }

        .cyberpunk-boot-logo {
            font-size: 48px;
            font-weight: bold;
            color: #ff1744;
            letter-spacing: 15px;
            text-shadow: 0 0 30px rgba(255, 23, 68, 0.5);
            animation: bootGlitch 0.3s ease infinite;
        }

        .cyberpunk-boot-subtitle {
            font-size: 14px;
            color: #00fff9;
            letter-spacing: 5px;
            margin-top: 10px;
            text-shadow: 0 0 10px rgba(0, 255, 249, 0.5);
        }

        .cyberpunk-boot-progress {
            width: 300px;
            height: 4px;
            background: #1a1a28;
            margin: 30px auto;
            border: 1px solid #2a2a3a;
            overflow: hidden;
        }

        .cyberpunk-boot-bar {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #ff1744, #00fff9);
            animation: bootProgress 2s ease-out forwards;
            box-shadow: 0 0 10px rgba(0, 255, 249, 0.5);
        }

        .cyberpunk-boot-status {
            font-size: 12px;
            color: #888899;
            letter-spacing: 2px;
            animation: bootStatusBlink 0.5s ease infinite;
        }

        @keyframes bootGlitch {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-2px); }
            75% { transform: translateX(2px); }
        }

        @keyframes bootProgress {
            0% { width: 0%; }
            50% { width: 60%; }
            100% { width: 100%; }
        }

        @keyframes bootStatusBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        @keyframes bootFadeOut {
            to {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
            }
        }
    `;

    document.head.appendChild(bootStyles);
    document.body.appendChild(bootOverlay);

    // Mark as booted
    sessionStorage.setItem('cyberpunk-booted', 'true');

    // Remove overlay after animation
    setTimeout(() => {
        bootOverlay.remove();
        bootStyles.remove();
    }, 3000);

    console.log('[Cyberpunk Theme] Boot sequence started');
}

// Add a system clock to the header bar
function addSystemClock() {
    // Find the clock element (created in header bar)
    const clock = document.getElementById('cyberpunk-system-clock');

    if (!clock) {
        console.log('[Cyberpunk Theme] No clock element found');
        return;
    }

    // Check if already running
    if (clock.dataset.clockRunning === 'true') return;
    clock.dataset.clockRunning = 'true';

    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        clock.textContent = `SYS_TIME: ${hours}:${minutes}:${seconds}`;
    }

    updateClock();
    setInterval(updateClock, 1000);

    console.log('[Cyberpunk Theme] System clock started');
}

// Setup typing effects for the input area
function setupTypingEffects() {
    const sendTextarea = document.getElementById('send_textarea');
    if (!sendTextarea) return;

    // Add a subtle glow effect when typing
    sendTextarea.addEventListener('input', () => {
        sendTextarea.style.boxShadow = '0 0 20px rgba(0, 255, 249, 0.3), inset 0 0 30px rgba(0, 255, 249, 0.05)';

        // Reset after a short delay
        clearTimeout(sendTextarea._glowTimeout);
        sendTextarea._glowTimeout = setTimeout(() => {
            sendTextarea.style.boxShadow = '';
        }, 500);
    });

    console.log('[Cyberpunk Theme] Typing effects initialized');
}

// Setup glitch effects on hover/interactions
function setupGlitchEffects() {
    // Add glitch effect to buttons on hover
    const buttons = document.querySelectorAll('.menu_button, .drawer-icon');

    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.classList.add('cyber-glitch-hover');
        });

        button.addEventListener('mouseleave', () => {
            button.classList.remove('cyber-glitch-hover');
        });
    });

    // Add glitch styles if not already present
    if (!document.getElementById('cyberpunk-glitch-styles')) {
        const glitchStyles = document.createElement('style');
        glitchStyles.id = 'cyberpunk-glitch-styles';
        glitchStyles.textContent = `
            .cyber-glitch-hover {
                animation: cyberGlitchHover 0.3s ease;
            }

            @keyframes cyberGlitchHover {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-1px); }
                40% { transform: translateX(1px); }
                60% { transform: translateX(-1px); }
                80% { transform: translateX(1px); }
            }
        `;
        document.head.appendChild(glitchStyles);
    }

    console.log('[Cyberpunk Theme] Glitch effects initialized');
}

// ============================================================
// CYBERPUNK TERMINAL MODAL SYSTEM
// ============================================================

// Setup cyberpunk modals for drawer content
function setupCyberpunkModals() {
    const settingsHolder = document.getElementById('top-settings-holder');
    if (!settingsHolder) {
        console.log('[Cyberpunk Theme] top-settings-holder not found');
        return;
    }

    // Create the modal overlay
    createCyberpunkModalOverlay();

    // Get all drawer elements
    const drawers = settingsHolder.querySelectorAll('.drawer');

    drawers.forEach(drawer => {
        const drawerId = drawer.id;
        const drawerIcon = drawer.querySelector('.drawer-icon');

        if (!drawerIcon) return;

        // Add click handler to open modal
        drawerIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            openCyberpunkModal(drawerId);
        }, true);
    });

    // Handle ESC key globally
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCyberpunkModal();
        }
    });

    console.log('[Cyberpunk Theme] Modal system initialized');
}

// Create the cyberpunk modal overlay
function createCyberpunkModalOverlay() {
    // Remove existing if any
    const existing = document.getElementById('cyberpunk-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cyberpunk-modal-overlay';
    overlay.className = 'cyberpunk-modal-overlay';
    overlay.innerHTML = `
        <div class="cyberpunk-modal-container" role="dialog" aria-modal="true" aria-labelledby="cyberpunk-modal-title">
            <div class="cyberpunk-modal-header">
                <div class="cyberpunk-modal-header-left">
                    <span class="cyberpunk-modal-prefix">&gt; SYSTEM://</span>
                    <span class="cyberpunk-modal-title" id="cyberpunk-modal-title">TERMINAL</span>
                </div>
                <div class="cyberpunk-modal-header-right">
                    <div class="cyberpunk-modal-controls">
                        <button type="button" class="cyberpunk-modal-control minimize" aria-label="Minimize window" tabindex="0">─</button>
                        <button type="button" class="cyberpunk-modal-control maximize" aria-label="Maximize window" tabindex="0">□</button>
                        <button type="button" class="cyberpunk-modal-control close" id="cyberpunk-modal-close" aria-label="Close window" tabindex="0">×</button>
                    </div>
                </div>
            </div>
            <div class="cyberpunk-modal-body-wrapper">
                <div class="cyberpunk-modal-sidebar">
                    <div class="cyberpunk-modal-nav" id="cyberpunk-modal-nav">
                    </div>
                </div>
                <div class="cyberpunk-modal-content">
                    <div class="cyberpunk-modal-body" id="cyberpunk-modal-body">
                    </div>
                </div>
            </div>
            <div class="cyberpunk-modal-footer">
                <span class="cyberpunk-modal-footer-text">PRESS [ESC] TO CLOSE | NEMONET TERMINAL v2.077</span>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Add modal styles
    addCyberpunkModalStyles();

    // Close on clicking backdrop
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeCyberpunkModal();
        }
    });

    // Close button handler
    const closeBtn = overlay.querySelector('#cyberpunk-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeCyberpunkModal();
        });
    }

    console.log('[Cyberpunk Theme] Modal overlay created');
}

// Add styles for the modal
function addCyberpunkModalStyles() {
    if (document.getElementById('cyberpunk-modal-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'cyberpunk-modal-styles';
    styles.textContent = `
        .cyberpunk-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(5px);
            z-index: 99998;
            align-items: center;
            justify-content: center;
            animation: cyberpunkModalFadeIn 0.2s ease;
        }

        .cyberpunk-modal-overlay.visible {
            display: flex;
        }

        @keyframes cyberpunkModalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .cyberpunk-modal-container {
            width: 90%;
            max-width: 1200px;
            height: 85vh;
            background: #0a0a0f;
            border: 1px solid #00fff9;
            box-shadow:
                0 0 30px rgba(0, 255, 249, 0.3),
                inset 0 0 60px rgba(0, 255, 249, 0.05);
            display: flex;
            flex-direction: column;
            animation: cyberpunkModalSlideIn 0.3s ease;
        }

        @keyframes cyberpunkModalSlideIn {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .cyberpunk-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: linear-gradient(90deg, #ff1744 0%, #0d0d14 30%, #0d0d14 70%, #00fff9 100%);
            border-bottom: 1px solid #2a2a3a;
        }

        .cyberpunk-modal-header-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .cyberpunk-modal-prefix {
            color: #00fff9;
            font-family: 'Consolas', monospace;
            font-size: 12px;
            text-shadow: 0 0 10px rgba(0, 255, 249, 0.5);
        }

        .cyberpunk-modal-title {
            color: #e0e0e0;
            font-family: 'Consolas', monospace;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .cyberpunk-modal-controls {
            display: flex;
            gap: 8px;
        }

        .cyberpunk-modal-control {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Consolas', monospace;
            font-size: 16px;
            color: #888899;
            cursor: pointer;
            border: 1px solid #2a2a3a;
            background: #1a1a28;
            transition: all 0.2s ease;
        }

        .cyberpunk-modal-control:hover {
            color: #00fff9;
            border-color: #00fff9;
            text-shadow: 0 0 10px rgba(0, 255, 249, 0.5);
        }

        .cyberpunk-modal-control.close:hover {
            color: #ff1744;
            border-color: #ff1744;
            text-shadow: 0 0 10px rgba(255, 23, 68, 0.5);
            background: rgba(255, 23, 68, 0.2);
        }

        .cyberpunk-modal-body-wrapper {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        .cyberpunk-modal-sidebar {
            width: 170px;
            min-width: 170px;
            max-width: 170px;
            background: #0d0d14;
            border-right: 1px solid #2a2a3a;
            overflow-y: auto;
            flex-shrink: 0;
        }

        .cyberpunk-modal-nav {
            padding: 6px;
        }

        .cyberpunk-modal-nav-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            color: #888899;
            font-family: 'Consolas', monospace;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            border-left: 2px solid transparent;
            transition: all 0.2s ease;
        }

        .cyberpunk-modal-nav-item:hover {
            color: #00fff9;
            background: rgba(0, 255, 249, 0.05);
            border-left-color: #00fff9;
        }

        .cyberpunk-modal-nav-item.active {
            color: #ff1744;
            background: rgba(255, 23, 68, 0.1);
            border-left-color: #ff1744;
        }

        .cyberpunk-modal-nav-item i {
            width: 16px;
            text-align: center;
        }

        .cyberpunk-modal-content {
            flex: 1;
            overflow-y: auto;
            background: #0a0a0f;
        }

        .cyberpunk-modal-body {
            padding: 16px;
            min-height: 100%;
        }

        .cyberpunk-modal-body .drawer-content {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }

        .cyberpunk-modal-footer {
            padding: 8px 16px;
            background: #0d0d14;
            border-top: 1px solid #2a2a3a;
            display: flex;
            justify-content: center;
        }

        .cyberpunk-modal-footer-text {
            color: #555566;
            font-family: 'Consolas', monospace;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        /* Scrollbar styling for modal */
        .cyberpunk-modal-content::-webkit-scrollbar,
        .cyberpunk-modal-sidebar::-webkit-scrollbar {
            width: 6px;
        }

        .cyberpunk-modal-content::-webkit-scrollbar-track,
        .cyberpunk-modal-sidebar::-webkit-scrollbar-track {
            background: #0a0a0f;
        }

        .cyberpunk-modal-content::-webkit-scrollbar-thumb,
        .cyberpunk-modal-sidebar::-webkit-scrollbar-thumb {
            background: #2a2a3a;
            border-radius: 3px;
        }

        .cyberpunk-modal-content::-webkit-scrollbar-thumb:hover,
        .cyberpunk-modal-sidebar::-webkit-scrollbar-thumb:hover {
            background: #00fff9;
        }
    `;

    document.head.appendChild(styles);
}

// Return modal content back to original drawer
function returnCyberpunkModalContent() {
    const modalBody = document.getElementById('cyberpunk-modal-body');
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
                console.log('[Cyberpunk Theme] Returned content to:', drawerContent.dataset.originalParent);
            }

            delete drawerContent.dataset.originalParent;
            delete drawerContent.dataset.wasDisplay;
        }
    });

    modalBody.innerHTML = '';
}

// Open the cyberpunk modal
function openCyberpunkModal(drawerId) {
    const overlay = document.getElementById('cyberpunk-modal-overlay');
    const modalBody = document.getElementById('cyberpunk-modal-body');
    const modalTitle = document.getElementById('cyberpunk-modal-title');
    const modalNav = document.getElementById('cyberpunk-modal-nav');

    if (!overlay || !modalBody) {
        console.log('[Cyberpunk Theme] Modal elements not found');
        return;
    }

    const drawer = document.getElementById(drawerId);
    if (!drawer) {
        console.log('[Cyberpunk Theme] Drawer not found:', drawerId);
        return;
    }

    const drawerContent = drawer.querySelector('.drawer-content');
    if (!drawerContent) {
        console.log('[Cyberpunk Theme] Drawer content not found in:', drawerId);
        return;
    }

    // Return any existing content first
    returnCyberpunkModalContent();

    // Update title
    modalTitle.textContent = getCyberpunkDrawerTitle(drawerId);

    // Update navigation
    modalNav.innerHTML = generateCyberpunkNav(drawerId);

    // Attach nav click handlers
    modalNav.querySelectorAll('.cyberpunk-modal-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;
            if (targetId && targetId !== drawerId) {
                openCyberpunkModal(targetId);
            }
        });
    });

    // Move content to modal
    drawerContent.dataset.originalParent = drawerId;
    drawerContent.dataset.wasDisplay = drawerContent.style.display || '';

    modalBody.appendChild(drawerContent);

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
    console.log('[Cyberpunk Theme] Modal opened for:', drawerId);
}

// Close the cyberpunk modal
function closeCyberpunkModal() {
    const overlay = document.getElementById('cyberpunk-modal-overlay');
    if (!overlay) return;

    returnCyberpunkModalContent();

    overlay.classList.remove('visible');
    document.body.style.overflow = '';
    delete overlay.dataset.currentDrawer;
    console.log('[Cyberpunk Theme] Modal closed');
}

// Generate sidebar navigation
function generateCyberpunkNav(activeDrawerId) {
    const navItems = [
        { id: 'ai-config-button', icon: 'fa-microchip', label: 'AI_CONFIG' },
        { id: 'sys-settings-button', icon: 'fa-plug', label: 'CONNECTION' },
        { id: 'advanced-formatting-button', icon: 'fa-code', label: 'FORMATTING' },
        { id: 'WI-SP-button', icon: 'fa-database', label: 'WORLD_INFO' },
        { id: 'user-settings-button', icon: 'fa-user-gear', label: 'USER_CFG' },
        { id: 'backgrounds-button', icon: 'fa-image', label: 'BACKGROUNDS' },
        { id: 'extensions-settings-button', icon: 'fa-puzzle-piece', label: 'EXTENSIONS' },
        { id: 'persona-management-button', icon: 'fa-id-card', label: 'PERSONAS' },
        { id: 'rightNavHolder', icon: 'fa-users', label: 'CHARACTERS' },
    ];

    return navItems.map(item => `
        <button type="button" class="cyberpunk-modal-nav-item ${item.id === activeDrawerId ? 'active' : ''}"
                data-target="${item.id}"
                aria-label="Navigate to ${item.label.replace(/_/g, ' ')}"
                aria-current="${item.id === activeDrawerId ? 'page' : 'false'}"
                tabindex="0">
            <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
            <span>${item.label}</span>
        </button>
    `).join('');
}

// Get title for drawer
function getCyberpunkDrawerTitle(drawerId) {
    const titles = {
        'ai-config-button': 'AI_CONFIGURATION',
        'sys-settings-button': 'CONNECTION_SETTINGS',
        'advanced-formatting-button': 'ADVANCED_FORMATTING',
        'WI-SP-button': 'WORLD_INFO_DATABASE',
        'user-settings-button': 'USER_SETTINGS',
        'backgrounds-button': 'BACKGROUND_MANAGER',
        'extensions-settings-button': 'EXTENSION_MODULES',
        'persona-management-button': 'PERSONA_MANAGER',
        'rightNavHolder': 'CHARACTER_DATABASE',
    };
    return titles[drawerId] || 'TERMINAL';
}

// ============================================================
// END MODAL SYSTEM
// ============================================================

// Cleanup function for when theme is switched
export function cleanupCyberpunkEnhancements() {
    // Stop the body class watcher
    if (bodyClassObserver) {
        bodyClassObserver.disconnect();
        bodyClassObserver = null;
        console.log('[Cyberpunk Theme] Body class watcher stopped');
    }

    // Stop the periodic class check
    if (classCheckInterval) {
        clearInterval(classCheckInterval);
        classCheckInterval = null;
    }

    // Remove header bar
    const headerBar = document.getElementById('cyberpunk-header-bar');
    if (headerBar) headerBar.remove();

    // Remove clock
    const clock = document.getElementById('cyberpunk-system-clock');
    if (clock) clock.remove();

    // Remove boot elements
    const bootOverlay = document.getElementById('cyberpunk-boot-overlay');
    if (bootOverlay) bootOverlay.remove();

    const bootStyles = document.getElementById('cyberpunk-boot-styles');
    if (bootStyles) bootStyles.remove();

    // Remove glitch styles
    const glitchStyles = document.getElementById('cyberpunk-glitch-styles');
    if (glitchStyles) glitchStyles.remove();

    // Remove modal elements
    const modalOverlay = document.getElementById('cyberpunk-modal-overlay');
    if (modalOverlay) modalOverlay.remove();

    const modalStyles = document.getElementById('cyberpunk-modal-styles');
    if (modalStyles) modalStyles.remove();

    // Reset initialized flag
    initialized = false;

    console.log('[Cyberpunk Theme] Enhancements cleaned up');
}

// Auto-initialization function
function autoInit() {
    // Only initialize if the cyberpunk stylesheet is actually loaded
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isCyberpunkStylesheet = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('cyberpunk');

    if (isCyberpunkStylesheet && !initialized) {
        console.log('[Cyberpunk Theme] Auto-init triggered');
        initCyberpunkEnhancements();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
} else {
    autoInit();
}

// Try auto-init at multiple time points to catch different loading scenarios
setTimeout(autoInit, 500);
setTimeout(autoInit, 1000);
setTimeout(autoInit, 1500);
setTimeout(autoInit, 3000);
setTimeout(autoInit, 5000);
setTimeout(autoInit, 8000);

// Re-initialize on theme change / stylesheet load
const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (isCyberpunkThemeActive() && !initialized) {
                console.log('[Cyberpunk Theme] Theme class change detected, initializing...');
                initCyberpunkEnhancements();
            }
        }
        if (mutation.type === 'childList' && mutation.target === document.head) {
            mutation.addedNodes.forEach(node => {
                if (node.id === 'nemo-theme-stylesheet' && node.href && node.href.includes('cyberpunk')) {
                    console.log('[Cyberpunk Theme] Stylesheet loaded, ensuring body class...');
                    ensureBodyClass();
                    setTimeout(initCyberpunkEnhancements, 500);
                }
            });
        }
    });
});

themeObserver.observe(document.body, { attributes: true });
themeObserver.observe(document.head, { childList: true });

export default { initCyberpunkEnhancements, ensureBodyClass, cleanupCyberpunkEnhancements };
