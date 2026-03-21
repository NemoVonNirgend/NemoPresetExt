/**
 * Background Organizer
 * Virtual folder grouping, view toggle, "By Type" sort, and settings drawer
 * for the SillyTavern backgrounds panel.
 */

import { extension_settings } from '../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../script.js';
import logger from '../../core/logger.js';
import { LOG_PREFIX } from '../../core/utils.js';

const UNCATEGORIZED = '__uncategorized__';

class BackgroundOrganizer {
    constructor() {
        this.isInitialized = false;
        this.isReorganizing = false;
        this.observer = null;
        this.viewMode = 'flat'; // 'flat' | 'folder'
        this.folderStates = {};
        this.settingsDrawerOpen = false;
    }

    // ── Settings persistence ──────────────────────────────────────────

    ensureSettings() {
        if (!extension_settings.NemoPresetExt) {
            extension_settings.NemoPresetExt = {};
        }
        if (!extension_settings.NemoPresetExt.backgroundOrganizer) {
            extension_settings.NemoPresetExt.backgroundOrganizer = {
                viewMode: 'flat',
                folderStates: {},
                settingsDrawerOpen: false,
            };
        }
        const saved = extension_settings.NemoPresetExt.backgroundOrganizer;
        this.viewMode = saved.viewMode || 'flat';
        this.folderStates = saved.folderStates || {};
        this.settingsDrawerOpen = saved.settingsDrawerOpen || false;
    }

    saveSettings() {
        extension_settings.NemoPresetExt.backgroundOrganizer = {
            viewMode: this.viewMode,
            folderStates: this.folderStates,
            settingsDrawerOpen: this.settingsDrawerOpen,
        };
        saveSettingsDebounced();
    }

    // ── Initialization ────────────────────────────────────────────────

    async initialize() {
        if (this.isInitialized) return;

        try {
            this.ensureSettings();
            this.loadCSS();
            this.injectViewToggle();
            this.injectByTypeSort();
            this.patchFilterHandler();
            this.observeContainer();
            this.wrapAnimatedSettings();

            // If saved view mode is folder, wait for ST to render backgrounds then apply
            if (this.viewMode === 'folder') {
                this.waitForBackgroundsThenApplyFolders();
            }

            this.isInitialized = true;
            logger.info(`${LOG_PREFIX} Background Organizer initialized (mode: ${this.viewMode})`);
        } catch (err) {
            logger.error(`${LOG_PREFIX} Background Organizer init failed:`, err);
        }
    }

    loadCSS() {
        if (document.getElementById('background-organizer-css')) return;
        const link = document.createElement('link');
        link.id = 'background-organizer-css';
        link.rel = 'stylesheet';
        link.href = new URL('background-organizer.css', import.meta.url).href;
        document.head.appendChild(link);
    }

    // ── View Toggle ───────────────────────────────────────────────────

    injectViewToggle() {
        const headerRow = document.querySelector('.bg-header-row-2');
        if (!headerRow) {
            logger.warn(`${LOG_PREFIX} bg-header-row-2 not found for view toggle`);
            return;
        }

        // Don't inject twice
        if (headerRow.querySelector('.bg-view-toggle')) return;

        const toggle = document.createElement('span');
        toggle.className = 'bg-view-toggle';
        toggle.innerHTML = `
            <button class="menu_button bg-view-btn" data-view="flat" title="Grid view">
                <i class="fa-solid fa-grip"></i>
            </button>
            <button class="menu_button bg-view-btn" data-view="folder" title="Folder view">
                <i class="fa-solid fa-folder-tree"></i>
            </button>
        `;

        headerRow.appendChild(toggle);
        this.updateToggleState(toggle);

        toggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.bg-view-btn');
            if (!btn) return;
            const newMode = btn.dataset.view;
            if (newMode === this.viewMode) return;

            this.viewMode = newMode;
            this.saveSettings();
            this.updateToggleState(toggle);

            if (newMode === 'folder') {
                this.applyFolderView();
            } else {
                this.removeFolderView();
            }
        });
    }

    updateToggleState(toggle) {
        toggle.querySelectorAll('.bg-view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === this.viewMode);
        });
    }

    // ── "By Type" Sort Option ─────────────────────────────────────────

    injectByTypeSort() {
        const sortSelect = document.getElementById('bg-sort');
        if (!sortSelect) return;
        if (sortSelect.querySelector('option[value="bytype"]')) return;

        const opt = document.createElement('option');
        opt.value = 'bytype';
        opt.textContent = 'By Type';
        opt.setAttribute('data-i18n', 'By Type');
        sortSelect.appendChild(opt);

        // Intercept sort change to handle our custom option
        sortSelect.addEventListener('change', () => {
            if (sortSelect.value === 'bytype') {
                // Let ST's handler run first (it will re-render with default sort),
                // then re-order by type after a tick
                requestAnimationFrame(() => this.sortByType());
            }
        });
    }

    sortByType() {
        const container = document.getElementById('bg_menu_content');
        if (!container) return;

        const typeOrder = { video: 0, animated: 1, image: 2 };

        const getTypeRank = (el) => {
            const file = el.getAttribute('bgfile') || '';
            const ext = file.split('.').pop().toLowerCase();
            if (['mp4', 'webm', 'avi', 'mov', 'mkv', 'ogv'].includes(ext)) return typeOrder.video;
            if (['gif', 'webp'].includes(ext)) return typeOrder.animated;
            return typeOrder.image;
        };

        // Collect all bg_example elements (may be inside folders or flat)
        const items = [...container.querySelectorAll('.bg_example')];
        items.sort((a, b) => {
            const rankDiff = getTypeRank(a) - getTypeRank(b);
            if (rankDiff !== 0) return rankDiff;
            const titleA = (a.getAttribute('title') || '').toLowerCase();
            const titleB = (b.getAttribute('title') || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });

        // If in folder mode, rebuild folders; otherwise reorder flat
        if (this.viewMode === 'folder') {
            this.removeFolderView();
            this.isReorganizing = true;
            items.forEach(item => container.appendChild(item));
            this.isReorganizing = false;
            this.applyFolderView();
        } else {
            this.isReorganizing = true;
            items.forEach(item => container.appendChild(item));
            this.isReorganizing = false;
        }
    }

    // ── Filter Patch ──────────────────────────────────────────────────

    patchFilterHandler() {
        const filterInput = document.getElementById('bg-filter');
        if (!filterInput) return;

        // Add our own input handler that runs after ST's
        filterInput.addEventListener('input', () => {
            // Debounce to run after ST's debounced handler
            clearTimeout(this._filterTimeout);
            this._filterTimeout = setTimeout(() => this.onFilterUpdate(), 350);
        });
    }

    onFilterUpdate() {
        if (this.viewMode !== 'folder') return;

        const filterValue = String($('#bg-filter').val()).toLowerCase();
        const container = document.getElementById('bg_menu_content');
        if (!container) return;

        container.querySelectorAll('.bg-folder-group').forEach(folder => {
            const items = folder.querySelectorAll('.bg_example');
            let visibleCount = 0;

            items.forEach(item => {
                const title = (item.getAttribute('title') || '').toLowerCase();
                const matches = !filterValue || title.includes(filterValue);
                item.classList.toggle('bg-filtered-out', !matches);
                // Also apply jQuery show/hide for ST compatibility
                if (matches) {
                    $(item).show();
                    visibleCount++;
                } else {
                    $(item).hide();
                }
            });

            folder.classList.toggle('bg-folder-empty', visibleCount === 0);
        });
    }

    // ── MutationObserver ──────────────────────────────────────────────

    observeContainer() {
        const container = document.getElementById('bg_menu_content');
        if (!container) {
            logger.warn(`${LOG_PREFIX} bg_menu_content not found for observer`);
            return;
        }

        this.observer = new MutationObserver((mutations) => {
            if (this.isReorganizing) return;

            // Only react to significant changes (ST re-rendering the list)
            const hasSignificantChange = mutations.some(m =>
                m.type === 'childList' && (m.addedNodes.length > 2 || m.removedNodes.length > 2)
            );

            if (hasSignificantChange && this.viewMode === 'folder') {
                // ST just re-rendered. Re-apply folder view after a tick.
                requestAnimationFrame(() => this.applyFolderView());
            }
        });

        this.observer.observe(container, { childList: true });
    }

    // ── Deferred Init ──────────────────────────────────────────────────

    waitForBackgroundsThenApplyFolders() {
        const container = document.getElementById('bg_menu_content');
        if (container && container.querySelectorAll(':scope > .bg_example').length > 0) {
            this.applyFolderView();
            // Also update the toggle buttons
            const toggle = document.querySelector('.bg-view-toggle');
            if (toggle) this.updateToggleState(toggle);
            return;
        }

        // Poll until backgrounds are rendered (ST loads them async)
        let attempts = 0;
        const check = setInterval(() => {
            attempts++;
            const c = document.getElementById('bg_menu_content');
            if (c && c.querySelectorAll(':scope > .bg_example').length > 0) {
                clearInterval(check);
                this.applyFolderView();
                const toggle = document.querySelector('.bg-view-toggle');
                if (toggle) this.updateToggleState(toggle);
            }
            if (attempts > 30) clearInterval(check); // Give up after 15s
        }, 500);
    }

    // ── Folder View ───────────────────────────────────────────────────

    /**
     * Parse a filename into a folder prefix.
     * Looks for common delimiters: hyphen, underscore, space.
     * e.g. "bedroom-cozy.jpg" → "bedroom", "city_night_rain.png" → "city"
     * Single-word filenames (no delimiter) → uncategorized
     */
    parsePrefix(filename) {
        // Strip extension
        const name = filename.replace(/\.[^.]+$/, '');
        // Try common delimiters
        for (const delim of ['-', '_', ' ']) {
            const idx = name.indexOf(delim);
            if (idx > 0) {
                return name.substring(0, idx).toLowerCase();
            }
        }
        return null; // No prefix pattern
    }

    applyFolderView() {
        const container = document.getElementById('bg_menu_content');
        if (!container) return;

        this.isReorganizing = true;

        // Remove any existing folder structure
        container.querySelectorAll('.bg-folder-group').forEach(g => {
            // Move items back to container before removing group
            const content = g.querySelector('.bg-folder-content');
            if (content) {
                while (content.firstChild) {
                    container.appendChild(content.firstChild);
                }
            }
            g.remove();
        });

        // Collect all bg_example elements
        const items = [...container.querySelectorAll(':scope > .bg_example')];
        if (items.length === 0) {
            this.isReorganizing = false;
            return;
        }

        // Group by prefix
        const groups = new Map();
        const uncategorized = [];

        items.forEach(item => {
            const file = item.getAttribute('bgfile') || item.getAttribute('title') || '';
            const prefix = this.parsePrefix(file);
            if (prefix) {
                if (!groups.has(prefix)) groups.set(prefix, []);
                groups.get(prefix).push(item);
            } else {
                uncategorized.push(item);
            }
        });

        // Merge single-item groups into uncategorized
        for (const [prefix, groupItems] of groups) {
            if (groupItems.length === 1) {
                uncategorized.push(groupItems[0]);
                groups.delete(prefix);
            }
        }

        container.classList.add('bg-folder-mode');

        // Add class to #bg_tabs to override height constraints
        const bgTabs = document.getElementById('bg_tabs');
        if (bgTabs) bgTabs.classList.add('bg-folder-active');

        // Sort folder names alphabetically
        const sortedPrefixes = [...groups.keys()].sort((a, b) => a.localeCompare(b));

        // Create folder groups
        for (const prefix of sortedPrefixes) {
            const groupItems = groups.get(prefix);
            const folder = this.createFolderElement(prefix, groupItems);
            container.appendChild(folder);
        }

        // Uncategorized at the end
        if (uncategorized.length > 0) {
            const folder = this.createFolderElement(UNCATEGORIZED, uncategorized);
            container.appendChild(folder);
        }

        this.isReorganizing = false;

        // Re-apply filter if active
        const filterValue = String($('#bg-filter').val()).toLowerCase();
        if (filterValue) {
            this.onFilterUpdate();
        }

        // Re-activate lazy loading for visible items
        this.reactivateLazyLoad();
    }

    createFolderElement(prefix, items) {
        const isOpen = prefix === UNCATEGORIZED
            ? (this.folderStates[prefix] !== false) // Uncategorized open by default
            : (this.folderStates[prefix] === true); // Others closed by default

        const displayName = prefix === UNCATEGORIZED ? 'Uncategorized' : prefix;

        const group = document.createElement('div');
        group.className = `bg-folder-group${isOpen ? ' open' : ''}`;
        group.dataset.folder = prefix;

        const header = document.createElement('div');
        header.className = 'bg-folder-header';
        header.innerHTML = `
            <i class="fa-solid fa-chevron-down bg-folder-chevron"></i>
            <i class="fa-solid fa-folder-open bg-folder-icon"></i>
            <span class="bg-folder-name">${displayName}</span>
            <span class="bg-folder-count">${items.length}</span>
        `;

        const content = document.createElement('div');
        content.className = 'bg-folder-content';

        // Move (not clone) items into folder
        items.forEach(item => content.appendChild(item));

        group.appendChild(header);
        group.appendChild(content);

        // Toggle handler
        header.addEventListener('click', () => {
            const wasOpen = group.classList.contains('open');
            group.classList.toggle('open');
            this.folderStates[prefix] = !wasOpen;
            this.saveSettings();

            // Re-activate lazy loading when opening
            if (!wasOpen) {
                this.reactivateLazyLoad(content);
            }
        });

        return group;
    }

    removeFolderView() {
        const container = document.getElementById('bg_menu_content');
        if (!container) return;

        this.isReorganizing = true;

        // Move all items back to container
        container.querySelectorAll('.bg-folder-group').forEach(group => {
            const content = group.querySelector('.bg-folder-content');
            if (content) {
                while (content.firstChild) {
                    container.appendChild(content.firstChild);
                }
            }
            group.remove();
        });

        container.classList.remove('bg-folder-mode');

        // Remove class from #bg_tabs
        const bgTabs = document.getElementById('bg_tabs');
        if (bgTabs) bgTabs.classList.remove('bg-folder-active');

        // Ensure all items are visible
        container.querySelectorAll('.bg_example').forEach(item => {
            item.classList.remove('bg-filtered-out');
        });

        this.isReorganizing = false;
    }

    // ── Lazy Loading ──────────────────────────────────────────────────

    reactivateLazyLoad(scope) {
        const target = scope || document.getElementById('bg_menu_content');
        if (!target) return;

        // Find lazy-load elements that haven't been loaded yet
        const lazyElements = target.querySelectorAll('.lazy-load-background');
        if (lazyElements.length === 0) return;

        // Use IntersectionObserver to trigger loading
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    // Trigger the same loading mechanism ST uses:
                    // ST's activateLazyLoader sets up its own observer, so we
                    // just need to make sure the element is visible in the viewport.
                    // Force a reflow by reading offsetHeight
                    void el.offsetHeight;
                    obs.unobserve(el);
                }
            });
        }, { root: null, rootMargin: '200px' });

        lazyElements.forEach(el => observer.observe(el));

        // Clean up observer after a reasonable time
        setTimeout(() => observer.disconnect(), 10000);
    }

    // ── Settings Drawer ───────────────────────────────────────────────

    wrapAnimatedSettings() {
        // Poll for the settings element since it's injected async
        const check = setInterval(() => {
            const settings = document.getElementById('animated-backgrounds-settings');
            if (!settings) return;

            // Already wrapped?
            if (settings.closest('.bg-settings-drawer')) {
                clearInterval(check);
                return;
            }

            clearInterval(check);
            this.createSettingsDrawer(settings);
        }, 500);

        // Stop polling after 15s
        setTimeout(() => clearInterval(check), 15000);
    }

    createSettingsDrawer(settingsEl) {
        const drawer = document.createElement('div');
        drawer.className = `bg-settings-drawer${this.settingsDrawerOpen ? ' open' : ''}`;

        const header = document.createElement('div');
        header.className = 'bg-settings-drawer-header';
        header.innerHTML = `
            <i class="fa-solid fa-chevron-down bg-settings-drawer-chevron"></i>
            <i class="fa-solid fa-film"></i>
            <span class="bg-settings-drawer-title">Animated Backgrounds Settings</span>
        `;

        const content = document.createElement('div');
        content.className = 'bg-settings-drawer-content';

        // Insert drawer before the settings element, then move settings inside
        settingsEl.parentNode.insertBefore(drawer, settingsEl);
        content.appendChild(settingsEl);
        drawer.appendChild(header);
        drawer.appendChild(content);

        header.addEventListener('click', () => {
            const wasOpen = drawer.classList.contains('open');
            drawer.classList.toggle('open');
            this.settingsDrawerOpen = !wasOpen;
            this.saveSettings();
        });
    }
}

export const backgroundOrganizer = new BackgroundOrganizer();
