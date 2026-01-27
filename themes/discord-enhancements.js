/**
 * Discord Theme Enhancements
 * Adds Discord-style UI elements and ensures theme is properly applied
 */

// Check if Discord theme is active (check for CSS file OR body class)
function isDiscordThemeActive() {
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    const isStylesheetLoaded = themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('discord');
    const hasBodyClass = document.body.classList.contains('nemo-theme-discord');
    return hasBodyClass || isStylesheetLoaded;
}

// Ensure body class is added when theme is active
export function ensureBodyClass() {
    const themeStylesheet = document.getElementById('nemo-theme-stylesheet');
    if (themeStylesheet && themeStylesheet.href && themeStylesheet.href.includes('discord')) {
        if (!document.body.classList.contains('nemo-theme-discord')) {
            document.body.classList.add('nemo-theme-discord');
            console.log('[Discord Theme] Added missing body class nemo-theme-discord');
        }
    }
}

// Track if we've initialized
let initialized = false;

// Initialize Discord enhancements
export function initDiscordEnhancements() {
    ensureBodyClass();

    if (!isDiscordThemeActive()) {
        console.log('[Discord Theme] Theme not active, skipping enhancements');
        return;
    }

    if (initialized) {
        console.log('[Discord Theme] Already initialized');
        return;
    }

    console.log('[Discord Theme] Initializing enhancements...');

    // Setup Discord-style modal for drawers
    setupDiscordModals();

    // Setup quick links folder
    setupQuickLinksFolder();

    // Setup DM sidebar with HotSwap characters
    setupDMSidebar();

    // Setup character image drawer
    setupImageDrawer();

    initialized = true;
    console.log('[Discord Theme] Enhancements initialized');
}

// Setup Discord-style modals for drawer content
function setupDiscordModals() {
    const settingsHolder = document.getElementById('top-settings-holder');
    if (!settingsHolder) {
        console.log('[Discord Theme] top-settings-holder not found');
        return;
    }

    // Create the modal overlay (hidden by default)
    createModalOverlay();

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

            // Open the modal with this drawer's content
            openDiscordModal(drawerId);
        }, true);
    });

    // Handle ESC key globally
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDiscordModal();
        }
    });

    console.log('[Discord Theme] Modal system initialized');
}

// Create the modal overlay element
function createModalOverlay() {
    // Remove existing if any
    const existing = document.getElementById('discord-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'discord-modal-overlay';
    overlay.className = 'discord-settings-overlay';
    // Hidden by default via CSS (no .visible class)
    overlay.innerHTML = `
        <div class="discord-settings-container">
            <div class="discord-settings-sidebar">
                <div class="discord-settings-nav" id="discord-modal-nav">
                </div>
            </div>
            <div class="discord-settings-content">
                <div class="discord-settings-header">
                    <h2 id="discord-modal-title">Settings</h2>
                </div>
                <div class="discord-settings-body" id="discord-modal-body">
                </div>
            </div>
            <div class="discord-settings-close">
                <button class="discord-close-btn" title="Close" id="discord-modal-close">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <span class="discord-close-hint">ESC</span>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Close on clicking backdrop
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeDiscordModal();
        }
    });

    // Close button - use event delegation on container for reliability
    const container = overlay.querySelector('.discord-settings-container');
    if (container) {
        container.addEventListener('click', (e) => {
            // Check if clicked element is close button or its icon
            if (e.target.closest('#discord-modal-close') || e.target.closest('.discord-close-btn')) {
                e.preventDefault();
                e.stopPropagation();
                closeDiscordModal();
            }
        });
    }

    console.log('[Discord Theme] Modal overlay created');
}

// Return any content currently in modal back to its original drawer
function returnModalContent() {
    const modalBody = document.getElementById('discord-modal-body');
    if (!modalBody) return;

    // Find any drawer-content elements in the modal
    const contents = modalBody.querySelectorAll('.drawer-content');
    contents.forEach(drawerContent => {
        if (drawerContent.dataset.originalParent) {
            const originalDrawer = document.getElementById(drawerContent.dataset.originalParent);
            if (originalDrawer) {
                // Reset styles
                drawerContent.style.display = drawerContent.dataset.wasDisplay || '';
                drawerContent.style.position = '';
                drawerContent.style.width = '';
                drawerContent.style.height = '';
                drawerContent.style.maxHeight = '';
                drawerContent.style.transform = '';
                drawerContent.style.opacity = '';
                drawerContent.style.visibility = '';

                // Move back to original drawer
                originalDrawer.appendChild(drawerContent);
                console.log('[Discord Theme] Returned content to:', drawerContent.dataset.originalParent);
            }

            // Clean up data attributes
            delete drawerContent.dataset.originalParent;
            delete drawerContent.dataset.wasDisplay;
        }
    });

    // Clear the modal body
    modalBody.innerHTML = '';
}

// Open the Discord modal with specific drawer content
function openDiscordModal(drawerId) {
    const overlay = document.getElementById('discord-modal-overlay');
    const modalBody = document.getElementById('discord-modal-body');
    const modalTitle = document.getElementById('discord-modal-title');
    const modalNav = document.getElementById('discord-modal-nav');

    if (!overlay || !modalBody) {
        console.log('[Discord Theme] Modal elements not found');
        return;
    }

    // Get the drawer and its content
    const drawer = document.getElementById(drawerId);
    if (!drawer) {
        console.log('[Discord Theme] Drawer not found:', drawerId);
        return;
    }

    const drawerContent = drawer.querySelector('.drawer-content');
    if (!drawerContent) {
        console.log('[Discord Theme] Drawer content not found in:', drawerId);
        return;
    }

    // FIRST: Return any existing content back to its original drawer
    returnModalContent();

    // Update title
    modalTitle.textContent = getDrawerTitle(drawerId);

    // Update navigation
    modalNav.innerHTML = generateSettingsNav(drawerId);

    // Attach nav click handlers
    modalNav.querySelectorAll('.discord-settings-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.dataset.target;
            if (targetId && targetId !== drawerId) {
                openDiscordModal(targetId);
            }
        });
    });

    // MOVE (not clone) the drawer content into the modal
    // Store reference to original parent
    drawerContent.dataset.originalParent = drawerId;
    drawerContent.dataset.wasDisplay = drawerContent.style.display || '';

    // Move content to modal
    modalBody.appendChild(drawerContent);

    // Make sure it's visible
    drawerContent.style.display = 'block';
    drawerContent.style.position = 'static';
    drawerContent.style.width = '100%';
    drawerContent.style.height = 'auto';
    drawerContent.style.maxHeight = 'none';
    drawerContent.style.transform = 'none';
    drawerContent.style.opacity = '1';
    drawerContent.style.visibility = 'visible';

    // Show overlay using class (CSS handles display: flex)
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // Mark as open
    overlay.dataset.currentDrawer = drawerId;
    console.log('[Discord Theme] Modal opened for:', drawerId);
}

// Close the Discord modal
function closeDiscordModal() {
    const overlay = document.getElementById('discord-modal-overlay');

    if (!overlay) return;

    // Return any content back to original drawers
    returnModalContent();

    // Hide overlay by removing visible class
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
    delete overlay.dataset.currentDrawer;
    console.log('[Discord Theme] Modal closed');
}

// Setup quick links folder in server sidebar
function setupQuickLinksFolder() {
    const settingsHolder = document.getElementById('top-settings-holder');
    if (!settingsHolder) return;

    // Check if folder already exists
    if (document.getElementById('discord-links-folder')) return;

    // Quick links configuration
    const quickLinks = [
        // Character Card Sites
        { type: 'header', label: 'Characters' },
        { url: 'https://chub.ai/', icon: 'fa-fire', label: 'Chub.ai', color: '#ff6b35' },
        { url: 'https://janitorai.com/', icon: 'fa-broom', label: 'JanitorAI', color: '#8b5cf6' },
        { url: 'https://nemonet.online/', icon: 'fa-n', label: 'NemoNet', color: '#10b981' },
        { url: 'https://github.com/NemoVonNirgend/NemoEngine', icon: 'fa-brands fa-github', label: 'NemoEngine Preset', color: '#8b5cf6' },

        { type: 'separator' },

        // API Providers
        { type: 'header', label: 'APIs' },
        { url: 'https://console.anthropic.com/', icon: 'fa-a', label: 'Claude API (Anthropic)', color: '#d97706' },
        { url: 'https://aistudio.google.com/apikey', icon: 'fa-g', label: 'Gemini API (Google)', color: '#4285f4' },
        { url: 'https://openrouter.ai/', icon: 'fa-route', label: 'OpenRouter', color: '#6366f1' },

        { type: 'separator' },

        // Communities
        { type: 'header', label: 'Community' },
        { url: 'https://discord.gg/FzqbGVuWrq', icon: 'fa-brands fa-discord', label: 'SillyTavern Discord', color: '#5865f2' },
        { url: 'https://www.reddit.com/r/SillyTavernAI/', icon: 'fa-brands fa-reddit', label: 'SillyTavern Reddit', color: '#ff4500' },
        { url: 'https://discord.gg/CnBsYV5m5E', icon: 'fa-brands fa-discord', label: 'AiPreset Discord', color: '#5865f2' },

        { type: 'separator' },

        // Resources
        { type: 'header', label: 'Resources' },
        { url: 'https://docs.sillytavern.app/', icon: 'fa-book', label: 'SillyTavern Docs', color: '#06b6d4' },
    ];

    // Create folder container
    const folder = document.createElement('div');
    folder.id = 'discord-links-folder';
    folder.className = 'discord-links-folder';

    // Create folder button
    const folderBtn = document.createElement('button');
    folderBtn.className = 'discord-folder-btn';
    folderBtn.innerHTML = '<i class="fa-solid fa-folder" aria-hidden="true"></i>';
    folderBtn.title = 'Quick Links';
    folderBtn.setAttribute('aria-label', 'Quick Links folder');
    folderBtn.setAttribute('aria-expanded', 'false');

    // Create folder content container
    const folderContent = document.createElement('div');
    folderContent.className = 'discord-folder-content';

    // Build links
    quickLinks.forEach(link => {
        if (link.type === 'separator') {
            const sep = document.createElement('div');
            sep.className = 'discord-folder-separator';
            folderContent.appendChild(sep);
        } else if (link.type === 'header') {
            // Skip headers for now, just visual grouping via separators
        } else {
            const linkEl = document.createElement('a');
            linkEl.href = link.url;
            linkEl.target = '_blank';
            linkEl.rel = 'noopener noreferrer';
            linkEl.className = 'discord-folder-link';
            linkEl.setAttribute('data-tooltip', link.label);

            // Determine icon class
            const iconClass = link.icon.startsWith('fa-brands') ? link.icon : `fa-solid ${link.icon}`;
            linkEl.innerHTML = `<i class="${iconClass}"></i>`;

            // Apply custom color on hover via inline style
            if (link.color) {
                linkEl.style.setProperty('--link-color', link.color);
                linkEl.addEventListener('mouseenter', () => {
                    linkEl.style.background = link.color;
                });
                linkEl.addEventListener('mouseleave', () => {
                    linkEl.style.background = '';
                });
            }

            folderContent.appendChild(linkEl);
        }
    });

    // Toggle folder expansion
    folderBtn.addEventListener('click', () => {
        const isExpanded = folderContent.classList.contains('expanded');
        if (isExpanded) {
            folderContent.classList.remove('expanded');
            folderBtn.classList.remove('expanded');
            folderBtn.innerHTML = '<i class="fa-solid fa-folder" aria-hidden="true"></i>';
            folderBtn.setAttribute('aria-expanded', 'false');
        } else {
            folderContent.classList.add('expanded');
            folderBtn.classList.add('expanded');
            folderBtn.innerHTML = '<i class="fa-solid fa-folder-open" aria-hidden="true"></i>';
            folderBtn.setAttribute('aria-expanded', 'true');
        }
    });

    folder.appendChild(folderBtn);
    folder.appendChild(folderContent);

    // Add separator before folder
    const separator = document.createElement('div');
    separator.style.cssText = 'width: 32px; height: 2px; background: var(--discord-border); border-radius: 1px; margin: 8px 0;';

    // Append to settings holder
    settingsHolder.appendChild(separator);
    settingsHolder.appendChild(folder);

    console.log('[Discord Theme] Quick links folder created');
}

// Setup Discord DM sidebar with HotSwap characters
function setupDMSidebar() {
    // Check if sidebar already exists
    if (document.getElementById('discord-dm-sidebar')) return;

    // Create the sidebar
    const sidebar = document.createElement('div');
    sidebar.id = 'discord-dm-sidebar';
    sidebar.className = 'discord-dm-sidebar';

    sidebar.setAttribute('role', 'complementary');
    sidebar.setAttribute('aria-label', 'Direct Messages sidebar');
    sidebar.innerHTML = `
        <div class="discord-dm-search">
            <input type="text" placeholder="Find or start a conversation" id="discord-dm-search-input" aria-label="Search conversations">
        </div>
        <nav class="discord-dm-nav" aria-label="Quick navigation">
            <button class="discord-dm-nav-item" id="discord-nav-characters" title="All Characters" aria-label="View all characters">
                <i class="fa-solid fa-users" aria-hidden="true"></i>
                <span>Characters</span>
            </button>
        </nav>
        <div class="discord-dm-header">
            <span class="discord-dm-header-title" id="discord-dm-header-label">Direct Messages</span>
            <button class="discord-dm-header-add" title="Select Character" aria-label="Add new conversation">
                <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>
        </div>
        <div class="discord-dm-list" id="discord-dm-list" role="list" aria-labelledby="discord-dm-header-label">
        </div>
    `;

    document.body.appendChild(sidebar);

    // Add toggle button to server bar
    const settingsHolder = document.getElementById('top-settings-holder');
    if (settingsHolder) {
        // Check if toggle already exists
        if (!document.getElementById('discord-dm-toggle')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'discord-dm-toggle';
            toggleBtn.className = 'discord-dm-toggle active';
            toggleBtn.innerHTML = '<i class="fa-solid fa-message" aria-hidden="true"></i>';
            toggleBtn.title = 'Toggle DM Sidebar';
            toggleBtn.setAttribute('aria-label', 'Toggle Direct Messages sidebar');
            toggleBtn.setAttribute('aria-expanded', 'true');

            // Insert after the ST logo (at the beginning after pseudo-elements)
            settingsHolder.insertBefore(toggleBtn, settingsHolder.firstChild);

            // Toggle sidebar visibility
            toggleBtn.addEventListener('click', () => {
                const isOpen = document.body.classList.contains('discord-dm-open');
                if (isOpen) {
                    document.body.classList.remove('discord-dm-open');
                    sidebar.style.display = 'none';
                    toggleBtn.classList.remove('active');
                    toggleBtn.setAttribute('aria-expanded', 'false');
                } else {
                    document.body.classList.add('discord-dm-open');
                    sidebar.style.display = 'flex';
                    toggleBtn.classList.add('active');
                    toggleBtn.setAttribute('aria-expanded', 'true');
                }
            });
        }
    }

    // Show sidebar by default
    document.body.classList.add('discord-dm-open');

    // Click handlers
    document.getElementById('discord-nav-characters').addEventListener('click', () => {
        // Open character management modal
        const rightNavHolder = document.getElementById('rightNavHolder');
        if (rightNavHolder) {
            openDiscordModal('rightNavHolder');
        }
    });

    document.querySelector('.discord-dm-header-add').addEventListener('click', () => {
        // Open character management modal
        openDiscordModal('rightNavHolder');
    });

    // Search functionality
    document.getElementById('discord-dm-search-input').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.discord-dm-item');
        items.forEach(item => {
            const name = item.querySelector('.discord-dm-name')?.textContent.toLowerCase() || '';
            item.style.display = name.includes(query) ? 'flex' : 'none';
        });
    });

    // Initial population
    populateDMList();

    // Watch for changes to HotSwap
    observeHotSwapChanges();

    console.log('[Discord Theme] DM sidebar created');
}

// Populate DM list with HotSwap characters
function populateDMList() {
    const dmList = document.getElementById('discord-dm-list');
    if (!dmList) return;

    // Get avatars from the original HotSwap container
    const hotswapContainer = document.querySelector('#right-nav-panel .hotswap');
    if (!hotswapContainer) {
        dmList.innerHTML = `
            <div class="discord-dm-empty">
                <i class="fa-solid fa-star"></i>
                <div>Favorite characters to see them here</div>
            </div>
        `;
        return;
    }

    // Get all character avatars from hotswap
    const avatars = hotswapContainer.querySelectorAll('.avatar');

    if (avatars.length === 0) {
        dmList.innerHTML = `
            <div class="discord-dm-empty">
                <i class="fa-solid fa-star"></i>
                <div>Favorite characters to see them here</div>
            </div>
        `;
        return;
    }

    dmList.innerHTML = '';

    avatars.forEach(avatar => {
        let charName = avatar.getAttribute('title') || avatar.querySelector('img')?.getAttribute('title') || 'Unknown';
        // Remove [Character] or [Group] prefix if present
        charName = charName.replace(/^\[Character\]\s*/i, '').replace(/^\[Group\]\s*/i, '');
        // Take only the first line (before any newline) to remove "File: ..." suffix
        charName = charName.split('\n')[0].trim();
        // Remove "file:" prefix and file extension if still present
        charName = charName.replace(/^file:\s*/i, '').replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
        const imgSrc = avatar.querySelector('img')?.src || avatar.style.backgroundImage?.replace(/url\(['"]?([^'"]+)['"]?\)/, '$1') || 'img/ai4.png';
        const chid = avatar.getAttribute('chid') || avatar.dataset.chid || '';

        const dmItem = document.createElement('div');
        dmItem.className = 'discord-dm-item';
        dmItem.dataset.chid = chid;
        dmItem.innerHTML = `
            <div class="discord-dm-avatar-wrapper" data-img-src="${imgSrc}" data-char-name="${charName}">
                <img class="discord-dm-avatar" src="${imgSrc}" alt="${charName}" onerror="this.src='img/ai4.png'">
                <div class="discord-dm-online-indicator"></div>
            </div>
            <div class="discord-dm-info">
                <div class="discord-dm-name">${charName}</div>
            </div>
        `;

        // Click on avatar to show full image
        const avatarWrapper = dmItem.querySelector('.discord-dm-avatar-wrapper');
        avatarWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            openImageDrawer(imgSrc, charName);
        });

        // Click on name/info area to select character
        const infoArea = dmItem.querySelector('.discord-dm-info');
        infoArea.addEventListener('click', (e) => {
            e.stopPropagation();
            avatar.click();
            // Update active state
            document.querySelectorAll('.discord-dm-item').forEach(item => item.classList.remove('active'));
            dmItem.classList.add('active');
        });

        // Click on whole item also selects (but avatar click is handled separately)
        dmItem.addEventListener('click', () => {
            avatar.click();
            // Update active state
            document.querySelectorAll('.discord-dm-item').forEach(item => item.classList.remove('active'));
            dmItem.classList.add('active');
        });

        dmList.appendChild(dmItem);
    });
}

// Observe HotSwap container for changes
function observeHotSwapChanges() {
    const hotswapContainer = document.querySelector('#right-nav-panel .hotswap');
    if (!hotswapContainer) {
        // Retry later if container not found
        setTimeout(observeHotSwapChanges, 1000);
        return;
    }

    const observer = new MutationObserver(() => {
        populateDMList();
    });

    observer.observe(hotswapContainer, {
        childList: true,
        subtree: true,
        attributes: true
    });

    // Also observe for character selection changes
    const chatContainer = document.getElementById('chat');
    if (chatContainer) {
        const chatObserver = new MutationObserver(() => {
            // Update active state based on current character
            updateActiveDMItem();
        });
        chatObserver.observe(chatContainer, { childList: true });
    }
}

// Update active DM item based on current character
function updateActiveDMItem() {
    // Get current character from the selected character display
    const selectedChar = document.querySelector('#rm_button_selected_ch h2')?.textContent?.trim();
    if (!selectedChar) return;

    document.querySelectorAll('.discord-dm-item').forEach(item => {
        const itemName = item.querySelector('.discord-dm-name')?.textContent?.trim();
        if (itemName === selectedChar) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Setup character profile panel (persistent, resizes chat)
function setupImageDrawer() {
    // Check if panel already exists
    if (document.getElementById('discord-profile-panel')) return;

    // Create profile panel
    const panel = document.createElement('div');
    panel.id = 'discord-profile-panel';
    panel.className = 'discord-profile-panel';

    panel.innerHTML = `
        <div class="discord-profile-banner">
            <button class="discord-profile-close" id="discord-profile-close" aria-label="Close profile panel">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
            <div class="discord-profile-avatar-wrapper">
                <img class="discord-profile-avatar" id="discord-profile-avatar" src="img/ai4.png" alt="Character avatar">
                <div class="discord-profile-status" aria-hidden="true"></div>
            </div>
        </div>
        <div class="discord-profile-body">
            <div class="discord-profile-name" id="discord-profile-name">Character</div>
            <div class="discord-profile-username" id="discord-profile-username">character</div>

            <div class="discord-profile-card">
                <div class="discord-profile-section-title">About Me</div>
                <div class="discord-profile-section-content" id="discord-profile-about">
                    Click on a character's avatar to view their profile.
                </div>

                <div class="discord-profile-divider" aria-hidden="true"></div>

                <div class="discord-profile-meta">
                    <div class="discord-profile-meta-item">
                        <strong>Member Since</strong>
                        <span id="discord-profile-since">-</span>
                    </div>
                    <div class="discord-profile-meta-item">
                        <strong>Messages</strong>
                        <span id="discord-profile-messages">-</span>
                    </div>
                </div>
            </div>

            <button class="discord-profile-view-full" id="discord-profile-view-full" aria-label="View full character image">
                <i class="fa-solid fa-expand" aria-hidden="true"></i> View Full Image
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    // Create image modal for full view
    const modal = document.createElement('div');
    modal.id = 'discord-image-modal';
    modal.className = 'discord-image-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Character image viewer');
    modal.innerHTML = `
        <button class="discord-image-modal-close" id="discord-image-modal-close" aria-label="Close image viewer">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <img id="discord-image-modal-img" src="" alt="Full size character image">
    `;
    document.body.appendChild(modal);

    // Close panel handler
    document.getElementById('discord-profile-close').addEventListener('click', closeProfilePanel);

    // View full image handler
    document.getElementById('discord-profile-view-full').addEventListener('click', () => {
        const avatarSrc = document.getElementById('discord-profile-avatar').src;
        openImageModal(avatarSrc);
    });

    // Click avatar to view full image
    document.getElementById('discord-profile-avatar').addEventListener('click', () => {
        const avatarSrc = document.getElementById('discord-profile-avatar').src;
        openImageModal(avatarSrc);
    });

    // Image modal close handlers
    document.getElementById('discord-image-modal-close').addEventListener('click', closeImageModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeImageModal();
    });

    // ESC key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modal.classList.contains('open')) {
                closeImageModal();
            }
        }
    });

    // Add click handler for chat message avatars using event delegation
    const chat = document.getElementById('chat');
    if (chat) {
        chat.addEventListener('click', (e) => {
            // Check if clicked on avatar in message
            const avatarWrapper = e.target.closest('.mesAvatarWrapper .avatar');
            if (avatarWrapper) {
                e.preventDefault();
                e.stopPropagation();

                const img = avatarWrapper.querySelector('img');
                if (img) {
                    // Get full size image path
                    let imgSrc = img.src;
                    // Convert thumbnail to full size
                    if (imgSrc.includes('/thumbnail?')) {
                        const urlParams = new URLSearchParams(imgSrc.split('?')[1]);
                        const file = urlParams.get('file');
                        const type = urlParams.get('type');
                        if (file && type === 'avatar') {
                            imgSrc = `/characters/${file}`;
                        }
                    }

                    // Get character info from the message
                    const mes = avatarWrapper.closest('.mes');
                    const charName = mes?.querySelector('.name_text')?.textContent || 'Character';
                    const isUser = mes?.getAttribute('is_user') === 'true';

                    // Get character description if available
                    let description = '';
                    let messageCount = 0;

                    // Count messages from this character
                    document.querySelectorAll('.mes').forEach(m => {
                        const name = m.querySelector('.name_text')?.textContent;
                        if (name === charName) messageCount++;
                    });

                    openProfilePanel(imgSrc, charName, description, messageCount, isUser);
                }
            }
        });
    }

    console.log('[Discord Theme] Profile panel created');
}

// Open profile panel with character info
function openProfilePanel(imgSrc, charName, description, messageCount, isUser) {
    const panel = document.getElementById('discord-profile-panel');
    if (!panel) return;

    // Update avatar
    const avatar = document.getElementById('discord-profile-avatar');
    avatar.src = imgSrc;
    avatar.onerror = () => { avatar.src = 'img/ai4.png'; };

    // Update name
    document.getElementById('discord-profile-name').textContent = charName;
    document.getElementById('discord-profile-username').textContent = charName.toLowerCase().replace(/\s+/g, '_');

    // Update about section
    const aboutEl = document.getElementById('discord-profile-about');
    if (isUser) {
        aboutEl.textContent = 'This is you!';
    } else {
        aboutEl.textContent = description || 'A character in this conversation.';
    }

    // Update meta
    document.getElementById('discord-profile-since').textContent = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('discord-profile-messages').textContent = messageCount > 0 ? messageCount : '-';

    // Show panel and adjust layout
    panel.classList.add('open');
    document.body.classList.add('discord-profile-open');
}

// Close profile panel
function closeProfilePanel() {
    const panel = document.getElementById('discord-profile-panel');
    if (panel) {
        panel.classList.remove('open');
        document.body.classList.remove('discord-profile-open');
    }
}

// Open full image modal
function openImageModal(imgSrc) {
    const modal = document.getElementById('discord-image-modal');
    const img = document.getElementById('discord-image-modal-img');
    if (modal && img) {
        img.src = imgSrc;
        modal.classList.add('open');
    }
}

// Close image modal
function closeImageModal() {
    const modal = document.getElementById('discord-image-modal');
    if (modal) {
        modal.classList.remove('open');
    }
}

// Generate settings navigation sidebar
function generateSettingsNav(activeDrawerId) {
    const navItems = [
        { id: 'ai-config-button', icon: 'fa-microchip', label: 'AI Config' },
        { id: 'sys-settings-button', icon: 'fa-plug', label: 'Connection' },
        { id: 'advanced-formatting-button', icon: 'fa-font', label: 'Formatting' },
        { id: 'WI-SP-button', icon: 'fa-book', label: 'World Info' },
        { id: 'user-settings-button', icon: 'fa-cog', label: 'User Settings' },
        { id: 'backgrounds-button', icon: 'fa-image', label: 'Backgrounds' },
        { id: 'extensions-settings-button', icon: 'fa-cubes', label: 'Extensions' },
        { id: 'persona-management-button', icon: 'fa-user', label: 'Personas' },
        { id: 'rightNavHolder', icon: 'fa-users', label: 'Characters' },
    ];

    return navItems.map(item => `
        <div class="discord-settings-nav-item ${item.id === activeDrawerId ? 'active' : ''}" data-target="${item.id}">
            <i class="fa-solid ${item.icon}"></i>
            <span>${item.label}</span>
        </div>
    `).join('');
}

// Get title for drawer
function getDrawerTitle(drawerId) {
    const titles = {
        'ai-config-button': 'AI Configuration',
        'sys-settings-button': 'Connection Settings',
        'advanced-formatting-button': 'Advanced Formatting',
        'WI-SP-button': 'World Info & Soft Prompts',
        'user-settings-button': 'User Settings',
        'backgrounds-button': 'Backgrounds',
        'extensions-settings-button': 'Extensions',
        'persona-management-button': 'Persona Management',
        'rightNavHolder': 'Character Management',
    };
    return titles[drawerId] || 'Settings';
}

// Auto-initialize when DOM is ready
function autoInit() {
    ensureBodyClass();
    setTimeout(initDiscordEnhancements, 500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
} else {
    autoInit();
}

setTimeout(autoInit, 1500);
setTimeout(autoInit, 3000);

// Re-initialize on theme change
const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (isDiscordThemeActive() && !initialized) {
                initDiscordEnhancements();
            }
        }
        if (mutation.type === 'childList' && mutation.target === document.head) {
            mutation.addedNodes.forEach(node => {
                if (node.id === 'nemo-theme-stylesheet' && node.href && node.href.includes('discord')) {
                    ensureBodyClass();
                    setTimeout(initDiscordEnhancements, 500);
                }
            });
        }
    });
});

themeObserver.observe(document.body, { attributes: true });
themeObserver.observe(document.head, { childList: true });

export default { initDiscordEnhancements, ensureBodyClass };
