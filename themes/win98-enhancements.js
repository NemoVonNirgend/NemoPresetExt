/**
 * Windows 98 Theme Enhancements
 * Adds interactive elements like system tray clock, Start menu, and window controls
 */

// Check if Win98 theme is active (check for CSS file OR body class)
function isWin98ThemeActive() {
    // Check if the theme stylesheet is loaded
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isStylesheetLoaded = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('win98');

    // Check body class
    const hasBodyClass = document.body.classList.contains('nemo-theme-win98');

    return hasBodyClass || isStylesheetLoaded;
}

// Ensure body class is added when theme is active
function ensureBodyClass() {
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    if (themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('win98')) {
        if (!document.body.classList.contains('nemo-theme-win98')) {
            document.body.classList.add('nemo-theme-win98');
            console.log('[Win98 Theme] Added missing body class nemo-theme-win98');
        }
    }
}

// Initialize Windows 98 enhancements
export function initWin98Enhancements() {
    // First ensure the body class is there
    ensureBodyClass();

    if (!isWin98ThemeActive()) {
        console.log('[Win98 Theme] Theme not active, skipping enhancements');
        return;
    }

    console.log('[Win98 Theme] Initializing enhancements...');

    // Add system tray with clock
    addSystemTray();

    // Add window control buttons to panels
    addWindowControls();

    // Initialize Start menu
    initStartMenu();

    // Add startup sound option
    addStartupSound();

    // Update chat window title with character name
    updateChatWindowTitle();

    console.log('[Win98 Theme] Enhancements initialized');
}

// System Tray with Clock
function addSystemTray() {
    const settingsHolder = document.getElementById('top-settings-holder');
    if (!settingsHolder) {
        console.log('[Win98 Theme] top-settings-holder not found');
        return;
    }

    // Check if already added
    if (document.getElementById('win98-systray')) {
        console.log('[Win98 Theme] Systray already exists');
        return;
    }

    console.log('[Win98 Theme] Adding systray to taskbar');

    const systray = document.createElement('div');
    systray.id = 'win98-systray';
    systray.className = 'win98-systray';
    systray.setAttribute('role', 'status');
    systray.setAttribute('aria-label', 'System tray');
    systray.innerHTML = `
        <div class="win98-systray-icons" style="display: flex; gap: 4px;" aria-label="System icons">
            <button class="win98-systray-icon" title="Volume" aria-label="Volume control" style="cursor: pointer; background: none; border: none; padding: 0;">🔊</button>
        </div>
        <time class="win98-clock" id="win98-clock" style="min-width: 60px; text-align: center;" aria-live="polite"></time>
    `;

    // Style the systray with all necessary properties
    systray.style.cssText = `
        margin-left: auto !important;
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        padding: 2px 8px !important;
        background: #c0c0c0 !important;
        border: 1px solid !important;
        border-color: #808080 #ffffff #ffffff #808080 !important;
        box-shadow: inset 1px 1px 0 #404040 !important;
        height: 24px !important;
        font-family: 'MS Sans Serif', Tahoma, sans-serif !important;
        font-size: 14px !important;
        color: #000000 !important;
        flex-shrink: 0 !important;
        order: 9999 !important;
    `;

    settingsHolder.appendChild(systray);
    console.log('[Win98 Theme] Systray added successfully');

    // Update clock every second
    updateClock();
    setInterval(updateClock, 1000);
}

function updateClock() {
    const clockEl = document.getElementById('win98-clock');
    if (!clockEl) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    clockEl.textContent = `${displayHours}:${minutes} ${ampm}`;
}

// Window Control Buttons (minimize, maximize, close)
function addWindowControls() {
    // Add to left panel
    addControlsToPanel('left-nav-panel', 'AI Config');
    // Add to right panel
    addControlsToPanel('right-nav-panel', 'Settings');
}

function addControlsToPanel(panelId, title) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    if (panel.querySelector('.win98-window-controls')) return;

    const controls = document.createElement('div');
    controls.className = 'win98-window-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Window controls');
    controls.innerHTML = `
        <button class="win98-window-btn win98-minimize" title="Minimize" aria-label="Minimize window">_</button>
        <button class="win98-window-btn win98-maximize" title="Maximize" aria-label="Maximize window">□</button>
        <button class="win98-window-btn win98-close" title="Close" aria-label="Close window">×</button>
    `;

    // Style
    controls.style.cssText = `
        position: absolute;
        top: 3px;
        right: 4px;
        display: flex;
        gap: 2px;
        z-index: 100;
    `;

    // Style buttons
    const buttons = controls.querySelectorAll('.win98-window-btn');
    buttons.forEach(btn => {
        btn.style.cssText = `
            width: 16px;
            height: 14px;
            background: #c0c0c0;
            border: 1px solid;
            border-color: #ffffff #404040 #404040 #ffffff;
            font-family: 'MS Sans Serif', Tahoma, sans-serif;
            font-size: 10px;
            font-weight: bold;
            line-height: 10px;
            padding: 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
    });

    // Close button handler
    const closeBtn = controls.querySelector('.win98-close');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Find the drawer icon and click it to close
        const drawerId = panelId === 'left-nav-panel' ? 'leftNavDrawerIcon' : null;
        if (drawerId) {
            const drawerIcon = document.getElementById(drawerId);
            if (drawerIcon) drawerIcon.click();
        } else {
            // For right panel, find by panel relationship
            const drawerToggle = panel.closest('.drawer')?.querySelector('.drawer-toggle');
            if (drawerToggle) drawerToggle.click();
        }
    });

    panel.appendChild(controls);
}

// Start Menu
function initStartMenu() {
    const settingsHolder = document.getElementById('top-settings-holder');
    if (!settingsHolder) return;

    // Check if already added
    if (document.getElementById('win98-start-menu')) return;

    // Create Start menu
    const startMenu = document.createElement('div');
    startMenu.id = 'win98-start-menu';
    startMenu.className = 'win98-start-menu';
    startMenu.setAttribute('role', 'menu');
    startMenu.setAttribute('aria-label', 'Start menu');
    startMenu.innerHTML = `
        <div class="win98-start-sidebar" aria-hidden="true">
            <span class="win98-start-sidebar-text">SillyTavern</span>
        </div>
        <div class="win98-start-items" role="group">
            <button class="win98-start-item" data-action="programs" role="menuitem" aria-haspopup="true">
                <span class="win98-start-icon" aria-hidden="true">📁</span>
                <span>Programs</span>
                <span class="win98-arrow" aria-hidden="true">▸</span>
            </button>
            <button class="win98-start-item" data-action="characters" role="menuitem">
                <span class="win98-start-icon" aria-hidden="true">👤</span>
                <span>Characters</span>
            </button>
            <button class="win98-start-item" data-action="settings" role="menuitem">
                <span class="win98-start-icon" aria-hidden="true">⚙️</span>
                <span>Settings</span>
            </button>
            <hr class="win98-start-separator" role="separator">
            <button class="win98-start-item" data-action="help" role="menuitem">
                <span class="win98-start-icon" aria-hidden="true">❓</span>
                <span>Help</span>
            </button>
            <hr class="win98-start-separator" role="separator">
            <button class="win98-start-item" data-action="shutdown" role="menuitem">
                <span class="win98-start-icon" aria-hidden="true">🔌</span>
                <span>Shut Down...</span>
            </button>
        </div>
    `;

    // Style the menu
    startMenu.style.cssText = `
        position: fixed;
        bottom: 36px;
        left: 4px;
        width: 200px;
        background: #c0c0c0;
        border: 2px solid;
        border-color: #ffffff #404040 #404040 #ffffff;
        box-shadow: 4px 4px 0 rgba(0,0,0,0.4);
        display: none;
        z-index: 10001;
        font-family: 'MS Sans Serif', Tahoma, sans-serif;
        font-size: 14px;
    `;

    document.body.appendChild(startMenu);

    // Style sidebar
    const sidebar = startMenu.querySelector('.win98-start-sidebar');
    sidebar.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 24px;
        background: linear-gradient(180deg, #000080, #1084d0);
        display: flex;
        align-items: flex-end;
        padding-bottom: 8px;
    `;

    const sidebarText = sidebar.querySelector('.win98-start-sidebar-text');
    sidebarText.style.cssText = `
        color: #c0c0c0;
        font-weight: bold;
        font-size: 18px;
        writing-mode: vertical-lr;
        transform: rotate(180deg);
        letter-spacing: 2px;
    `;

    // Style items container
    const itemsContainer = startMenu.querySelector('.win98-start-items');
    itemsContainer.style.cssText = `
        margin-left: 24px;
        padding: 4px 0;
    `;

    // Style items
    const items = startMenu.querySelectorAll('.win98-start-item');
    items.forEach(item => {
        item.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            cursor: pointer;
        `;

        item.addEventListener('mouseenter', () => {
            item.style.background = '#000080';
            item.style.color = '#ffffff';
        });

        item.addEventListener('mouseleave', () => {
            item.style.background = '';
            item.style.color = '';
        });

        item.addEventListener('click', () => handleStartMenuAction(item.dataset.action));
    });

    // Style separators
    const separators = startMenu.querySelectorAll('.win98-start-separator');
    separators.forEach(sep => {
        sep.style.cssText = `
            border: none;
            border-top: 1px solid #808080;
            border-bottom: 1px solid #ffffff;
            margin: 4px 8px;
        `;
    });

    // Add click handler to Start button area
    settingsHolder.addEventListener('click', (e) => {
        // Check if clicking on the Start button (::before pseudo-element area)
        const rect = settingsHolder.getBoundingClientRect();
        if (e.clientX < rect.left + 80 && e.clientY > rect.top) {
            toggleStartMenu();
        }
    });

    // Close menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && !e.target.closest('#top-settings-holder')) {
            startMenu.style.display = 'none';
        }
    });
}

function toggleStartMenu() {
    const menu = document.getElementById('win98-start-menu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

function handleStartMenuAction(action) {
    const menu = document.getElementById('win98-start-menu');
    if (menu) menu.style.display = 'none';

    switch (action) {
        case 'characters':
            // Open character list
            const charButton = document.querySelector('#rm_button_characters');
            if (charButton) charButton.click();
            break;
        case 'settings':
            // Open settings panel
            const settingsIcon = document.querySelector('.drawer-icon[title="User Settings"]');
            if (settingsIcon) settingsIcon.click();
            break;
        case 'help':
            // Open help/docs
            window.open('https://docs.sillytavern.app/', '_blank');
            break;
        case 'shutdown':
            // Fun shutdown dialog
            showShutdownDialog();
            break;
        case 'programs':
            // Could show submenu with AI Config, Extensions, etc.
            const aiConfig = document.getElementById('leftNavDrawerIcon');
            if (aiConfig) aiConfig.click();
            break;
    }
}

function showShutdownDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'win98-shutdown-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'win98-shutdown-title');
    dialog.innerHTML = `
        <div class="win98-shutdown-content">
            <div class="win98-shutdown-titlebar" id="win98-shutdown-title">
                Shut Down SillyTavern
            </div>
            <div class="win98-shutdown-body">
                <div class="win98-shutdown-icon" aria-hidden="true">🖥️</div>
                <div class="win98-shutdown-text">
                    <p id="win98-shutdown-desc">What do you want the computer to do?</p>
                    <select class="win98-shutdown-select" aria-labelledby="win98-shutdown-desc">
                        <option>Refresh page</option>
                        <option>Just kidding, keep chatting!</option>
                    </select>
                </div>
            </div>
            <div class="win98-shutdown-buttons">
                <button class="win98-shutdown-ok" aria-label="Confirm shutdown action">OK</button>
                <button class="win98-shutdown-cancel" aria-label="Cancel and close dialog">Cancel</button>
            </div>
        </div>
    `;

    // Style dialog
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 20000;
    `;

    const content = dialog.querySelector('.win98-shutdown-content');
    content.style.cssText = `
        background: #c0c0c0;
        border: 2px solid;
        border-color: #ffffff #404040 #404040 #ffffff;
        box-shadow: 4px 4px 0 rgba(0,0,0,0.5);
        width: 350px;
    `;

    const titlebar = dialog.querySelector('.win98-shutdown-titlebar');
    titlebar.style.cssText = `
        background: linear-gradient(90deg, #000080, #1084d0);
        color: white;
        padding: 4px 8px;
        font-weight: bold;
        font-family: 'MS Sans Serif', Tahoma, sans-serif;
        font-size: 14px;
    `;

    const body = dialog.querySelector('.win98-shutdown-body');
    body.style.cssText = `
        display: flex;
        padding: 16px;
        gap: 16px;
        font-family: 'MS Sans Serif', Tahoma, sans-serif;
        font-size: 14px;
    `;

    const icon = dialog.querySelector('.win98-shutdown-icon');
    icon.style.cssText = `
        font-size: 48px;
    `;

    const select = dialog.querySelector('.win98-shutdown-select');
    select.style.cssText = `
        width: 100%;
        padding: 4px;
        margin-top: 8px;
        border: 2px solid;
        border-color: #808080 #ffffff #ffffff #808080;
        font-family: 'MS Sans Serif', Tahoma, sans-serif;
        font-size: 14px;
    `;

    const buttons = dialog.querySelector('.win98-shutdown-buttons');
    buttons.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 8px;
        padding: 0 16px 16px;
    `;

    const btnStyle = `
        padding: 4px 24px;
        background: #c0c0c0;
        border: 2px solid;
        border-color: #ffffff #404040 #404040 #ffffff;
        font-family: 'MS Sans Serif', Tahoma, sans-serif;
        font-size: 14px;
        cursor: pointer;
    `;

    dialog.querySelector('.win98-shutdown-ok').style.cssText = btnStyle;
    dialog.querySelector('.win98-shutdown-cancel').style.cssText = btnStyle;

    document.body.appendChild(dialog);

    // Button handlers
    dialog.querySelector('.win98-shutdown-ok').addEventListener('click', () => {
        const selected = select.value;
        dialog.remove();
        if (selected === 'Refresh page') {
            window.location.reload();
        }
    });

    dialog.querySelector('.win98-shutdown-cancel').addEventListener('click', () => {
        dialog.remove();
    });
}

// Startup Sound (optional fun feature)
function addStartupSound() {
    // Could play Windows 98 startup sound on page load
    // Disabled by default to avoid annoying users
}

// Update chat window title with character name
function updateChatWindowTitle() {
    // Observer to update title when character changes
    const observer = new MutationObserver(() => {
        if (!isWin98ThemeActive()) return;

        const charName = document.getElementById('selected_chat_pole')?.value ||
                        document.querySelector('.selected_chat_block .ch_name')?.textContent ||
                        'Chat';

        // Update the title bar text via CSS custom property
        document.documentElement.style.setProperty('--win98-chat-title', `'MSN Messenger - ${charName}'`);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
}

// Auto-initialize when DOM is ready
function autoInit() {
    // First ensure body class is there (in case theme-manager didn't add it)
    ensureBodyClass();

    // Then initialize enhancements
    setTimeout(initWin98Enhancements, 100);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
} else {
    autoInit();
}

// Also try again after a delay to catch late-loading elements
setTimeout(autoInit, 1000);
setTimeout(autoInit, 2000);

// Re-initialize on theme change or stylesheet addition
const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        // Check for class changes on body
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (isWin98ThemeActive()) {
                initWin98Enhancements();
            }
        }
        // Check for new stylesheets being added (theme being applied)
        if (mutation.type === 'childList' && mutation.target === document.head) {
            mutation.addedNodes.forEach(node => {
                if (node.id === 'nemo-theme-stylesheet' && node.href && node.href.includes('win98')) {
                    ensureBodyClass();
                    setTimeout(initWin98Enhancements, 100);
                }
            });
        }
    });
});

themeObserver.observe(document.body, { attributes: true });
themeObserver.observe(document.head, { childList: true });

export default { initWin98Enhancements, ensureBodyClass };
