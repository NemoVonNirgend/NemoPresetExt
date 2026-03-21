import { LOG_PREFIX } from '../../core/utils.js';

/**
 * NemoMarketplace — Curated recommendations popup for extensions, presets, lorebooks, etc.
 * Injected into the top settings bar next to the Extensions button.
 */

const RECOMMENDATIONS_URL = 'https://raw.githubusercontent.com/NemoVonNirgend/NemoPresetExt/main/features/marketplace/recommendations.json';

const CATEGORY_ICONS = {
    extensions: 'fa-puzzle-piece',
    presets: 'fa-sliders',
    lorebooks: 'fa-book-atlas',
    characters: 'fa-user-pen',
    tools: 'fa-wrench',
    themes: 'fa-palette',
    guides: 'fa-graduation-cap',
    community: 'fa-users',
};

const CATEGORY_COLORS = {
    extensions: '#6eb5ff',
    presets: '#ff9f43',
    lorebooks: '#a29bfe',
    characters: '#fd79a8',
    tools: '#00cec9',
    themes: '#e17055',
    guides: '#55efc4',
    community: '#e056fd',
};

/** @type {Array<{name: string, description: string, author: string, url: string, category: string, image?: string, tags?: string[]}>} */
const FALLBACK_DATA = [
    {
        name: 'NemoPresetExt',
        description: 'Complete UI overhaul for SillyTavern — preset navigation, world info redesign, connection panel, prompt categories, themes, and more.',
        author: 'Nemo',
        url: 'https://github.com/NemoVonNirgend/NemoPresetExt',
        category: 'extensions',
        tags: ['ui', 'presets', 'world-info', 'must-have'],
    },
    {
        name: 'NemoEngine',
        description: 'Advanced modular preset system with Vex personalities, dynamic prompt engineering, genre/writing style modules, and multi-model optimization.',
        author: 'Nemo',
        url: 'https://github.com/NemoVonNirgend/NemoEngine',
        category: 'presets',
        tags: ['prompt-engineering', 'modular', 'vex'],
    },
    {
        name: 'TunnelVision',
        description: 'Activity feed and monitoring extension for SillyTavern — track what\'s happening in your chats in real time.',
        author: 'Coneja-Chibi',
        url: 'https://github.com/Coneja-Chibi/TunnelVision',
        category: 'extensions',
        tags: ['monitoring', 'activity-feed'],
    },
    {
        name: 'BunnyMo',
        description: 'A curated lorebook collection by Coneja-Chibi for enriching your SillyTavern roleplay experience.',
        author: 'Coneja-Chibi',
        url: 'https://github.com/Coneja-Chibi/BunnyMo',
        category: 'lorebooks',
        image: 'scripts/extensions/third-party/NemoPresetExt/features/marketplace/images/bunnymo.webp',
        tags: ['lore', 'worldbuilding'],
    },
    {
        name: 'The HawThorne Directives',
        description: 'A preset collection with fine-tuned directives and prompt configurations for optimized AI behavior.',
        author: 'Coneja-Chibi',
        url: 'https://github.com/Coneja-Chibi/The-HawThorne-Directives',
        category: 'presets',
        image: 'scripts/extensions/third-party/NemoPresetExt/features/marketplace/images/hawthorne.png',
        tags: ['directives', 'prompt-tuning'],
    },
    {
        name: 'Rabbit Response Team',
        description: 'Response quality and formatting extension for SillyTavern by Coneja-Chibi.',
        author: 'Coneja-Chibi',
        url: 'https://github.com/Coneja-Chibi/Rabbit-Response-Team',
        category: 'extensions',
        tags: ['response', 'formatting'],
    },
    {
        name: 'Marinara\'s Spaghetti Recipe',
        description: 'Popular universal preset collection with optimized settings for multiple APIs and models.',
        author: 'SpicyMarinara',
        url: 'https://github.com/SpicyMarinara/SillyTavern-Settings',
        category: 'presets',
        tags: ['universal', 'popular', 'multi-model'],
    },
    {
        name: 'Lucid Loom',
        description: 'Chat presets from Lucid Cards — polished presets for creative roleplay.',
        author: 'Lucid Cards',
        url: 'https://lucid.cards/chat-presets',
        category: 'presets',
        tags: ['roleplay', 'creative'],
    },
    {
        name: 'AI Preset',
        description: 'Discord community for AI preset sharing, prompt engineering discussion, and SillyTavern support.',
        author: 'Nemo',
        url: 'https://discord.gg/CnBsYV5m5E',
        category: 'community',
        tags: ['presets', 'support', 'discussion'],
    },
    {
        name: 'RoleCall',
        description: 'Nemo\'s dedicated chat platform Discord — connect with other roleplayers, share characters, presets, and creative content.',
        author: 'Nemo',
        url: 'https://discord.gg/nmHdXvCWbD',
        category: 'community',
        tags: ['chat-platform', 'roleplay', 'social'],
    },
    {
        name: 'SillyTavern Docs',
        description: 'Official SillyTavern documentation — setup guides, features, API configuration, and troubleshooting.',
        author: 'SillyTavern Team',
        url: 'https://docs.sillytavern.app/',
        category: 'guides',
        tags: ['documentation', 'setup', 'official'],
    },
];

export const NemoMarketplace = {
    _data: [],
    _isOpen: false,
    _activeCategory: 'all',
    _searchTerm: '',

    initialize: function () {
        console.log(`${LOG_PREFIX} Initializing Marketplace...`);
        this._injectButton();
        this._loadData();
    },

    _injectButton: function () {
        const topSettingsHolder = document.getElementById('top-settings-holder');
        if (!topSettingsHolder) {
            console.warn(`${LOG_PREFIX} top-settings-holder not found, retrying...`);
            setTimeout(() => this._injectButton(), 500);
            return;
        }

        // Don't double-inject
        if (document.getElementById('nemo-marketplace-button')) return;

        // Find the extensions drawer to position relative to it
        const extensionsDrawer = Array.from(topSettingsHolder.querySelectorAll('.drawer')).find(d => {
            const icon = d.querySelector('.drawer-icon');
            return icon && icon.title === 'Extensions';
        });

        // Find persona drawer to move it
        const personaDrawer = Array.from(topSettingsHolder.querySelectorAll('.drawer')).find(d => {
            const icon = d.querySelector('.drawer-icon');
            return icon && (icon.title === 'Persona Management' || icon.getAttribute('data-i18n')?.includes('Persona'));
        });

        // Create marketplace button
        const marketplaceDrawer = document.createElement('div');
        marketplaceDrawer.id = 'nemo-marketplace-button';
        marketplaceDrawer.className = 'drawer';
        marketplaceDrawer.innerHTML = `
            <div class="drawer-toggle">
                <div class="drawer-icon fa-solid fa-store fa-fw closedIcon" title="Nemo Marketplace"></div>
            </div>
        `;

        // Insert marketplace button before extensions
        if (extensionsDrawer) {
            topSettingsHolder.insertBefore(marketplaceDrawer, extensionsDrawer);
        } else {
            // Fallback: just append
            topSettingsHolder.appendChild(marketplaceDrawer);
        }

        // Move persona drawer to after extensions (original position)
        if (personaDrawer && extensionsDrawer && extensionsDrawer.nextSibling) {
            topSettingsHolder.insertBefore(personaDrawer, extensionsDrawer.nextSibling);
        }

        // Click handler — open popup instead of a drawer
        const icon = marketplaceDrawer.querySelector('.drawer-icon');
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            this._togglePopup();
        });

        console.log(`${LOG_PREFIX} Marketplace button injected`);
    },

    _loadData: async function () {
        try {
            const response = await fetch(RECOMMENDATIONS_URL, { cache: 'no-cache' });
            if (response.ok) {
                this._data = await response.json();
                console.log(`${LOG_PREFIX} Loaded ${this._data.length} marketplace items from GitHub`);
                return;
            }
        } catch (e) {
            console.warn(`${LOG_PREFIX} Failed to fetch marketplace data from GitHub, using fallback`, e);
        }
        this._data = FALLBACK_DATA;
    },

    _togglePopup: function () {
        if (this._isOpen) {
            this._closePopup();
        } else {
            this._openPopup();
        }
    },

    _openPopup: function () {
        if (document.getElementById('nemo-marketplace-popup')) return;

        this._isOpen = true;
        this._activeCategory = 'all';
        this._searchTerm = '';

        const overlay = document.createElement('div');
        overlay.id = 'nemo-marketplace-popup';
        overlay.className = 'nemo-marketplace-overlay';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._closePopup();
        });

        const popup = document.createElement('div');
        popup.className = 'nemo-marketplace-popup';

        popup.innerHTML = `
            <div class="nemo-marketplace-header">
                <div class="nemo-marketplace-title">
                    <i class="fa-solid fa-store"></i>
                    <h2>Nemo Marketplace</h2>
                    <span class="nemo-marketplace-subtitle">Curated picks for SillyTavern</span>
                </div>
                <button class="nemo-marketplace-close menu_button menu_button_icon fa-solid fa-times" title="Close"></button>
            </div>
            <div class="nemo-marketplace-toolbar">
                <div class="nemo-marketplace-search-wrap">
                    <i class="fa-solid fa-search"></i>
                    <input type="search" id="nemo-marketplace-search" class="text_pole" placeholder="Search recommendations...">
                </div>
                <div class="nemo-marketplace-categories">
                    <button class="nemo-marketplace-cat-btn active" data-category="all">All</button>
                </div>
            </div>
            <div class="nemo-marketplace-grid" id="nemo-marketplace-grid">
            </div>
            <div class="nemo-marketplace-footer">
                <span class="nemo-marketplace-footer-text">
                    <i class="fa-solid fa-heart"></i> Curated by Nemo &mdash; Want to suggest something? Open an issue on GitHub!
                </span>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Wire up close button
        popup.querySelector('.nemo-marketplace-close').addEventListener('click', () => this._closePopup());

        // Build category buttons
        const categories = [...new Set(this._data.map(item => item.category))];
        const catContainer = popup.querySelector('.nemo-marketplace-categories');
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'nemo-marketplace-cat-btn';
            btn.dataset.category = cat;
            btn.innerHTML = `<i class="fa-solid ${CATEGORY_ICONS[cat] || 'fa-tag'}"></i> ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
            btn.addEventListener('click', () => {
                catContainer.querySelectorAll('.nemo-marketplace-cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._activeCategory = cat;
                this._renderGrid();
            });
            catContainer.appendChild(btn);
        });

        // "All" button handler
        catContainer.querySelector('[data-category="all"]').addEventListener('click', function () {
            catContainer.querySelectorAll('.nemo-marketplace-cat-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });

        // Search handler
        const searchInput = popup.querySelector('#nemo-marketplace-search');
        searchInput.addEventListener('input', () => {
            this._searchTerm = searchInput.value.toLowerCase();
            this._renderGrid();
        });

        this._renderGrid();

        // Focus search
        requestAnimationFrame(() => searchInput.focus());

        // ESC to close
        this._escHandler = (e) => {
            if (e.key === 'Escape') this._closePopup();
        };
        document.addEventListener('keydown', this._escHandler);
    },

    _closePopup: function () {
        const overlay = document.getElementById('nemo-marketplace-popup');
        if (overlay) {
            overlay.classList.add('nemo-marketplace-closing');
            setTimeout(() => overlay.remove(), 200);
        }
        this._isOpen = false;
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    },

    _renderGrid: function () {
        const grid = document.getElementById('nemo-marketplace-grid');
        if (!grid) return;

        let items = this._data;

        // Filter by category
        if (this._activeCategory !== 'all') {
            items = items.filter(item => item.category === this._activeCategory);
        }

        // Filter by search
        if (this._searchTerm) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(this._searchTerm) ||
                item.description.toLowerCase().includes(this._searchTerm) ||
                item.author.toLowerCase().includes(this._searchTerm) ||
                (item.tags && item.tags.some(t => t.toLowerCase().includes(this._searchTerm)))
            );
        }

        if (items.length === 0) {
            grid.innerHTML = `
                <div class="nemo-marketplace-empty">
                    <i class="fa-solid fa-box-open"></i>
                    <p>No recommendations found</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = items.map(item => this._renderCard(item)).join('');

        // Attach click handlers for cards
        grid.querySelectorAll('.nemo-marketplace-card').forEach((card, i) => {
            card.addEventListener('click', () => {
                const url = items[i].url;
                if (url) window.open(url, '_blank', 'noopener');
            });
        });
    },

    _renderCard: function (item) {
        const catColor = CATEGORY_COLORS[item.category] || '#6eb5ff';
        const catIcon = CATEGORY_ICONS[item.category] || 'fa-tag';
        const imageHtml = item.image
            ? `<div class="nemo-marketplace-card-image" style="background-image: url('${item.image}')"></div>`
            : `<div class="nemo-marketplace-card-image nemo-marketplace-card-image-placeholder">
                    <i class="fa-solid ${catIcon}"></i>
               </div>`;

        const tagsHtml = item.tags
            ? item.tags.map(tag => `<span class="nemo-marketplace-tag">${tag}</span>`).join('')
            : '';

        return `
            <div class="nemo-marketplace-card" tabindex="0">
                ${imageHtml}
                <div class="nemo-marketplace-card-body">
                    <div class="nemo-marketplace-card-category" style="color: ${catColor}">
                        <i class="fa-solid ${catIcon}"></i> ${item.category}
                    </div>
                    <h3 class="nemo-marketplace-card-title">${item.name}</h3>
                    <p class="nemo-marketplace-card-desc">${item.description}</p>
                    <div class="nemo-marketplace-card-footer">
                        <span class="nemo-marketplace-card-author"><i class="fa-solid fa-user"></i> ${item.author}</span>
                        ${tagsHtml ? `<div class="nemo-marketplace-card-tags">${tagsHtml}</div>` : ''}
                    </div>
                </div>
                <div class="nemo-marketplace-card-action">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </div>
            </div>
        `;
    },

    _escHandler: null,
};
