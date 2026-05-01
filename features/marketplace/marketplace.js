import { LOG_PREFIX } from '../../core/utils.js';
import {
    importPromptBundle,
    loadPromptBundle,
    loadPromptLibrary,
    PROMPT_LIBRARY_SOURCES,
} from './prompt-library.js';

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

const CATEGORY_LABELS = {
    extensions: 'Extensions',
    presets: 'Presets',
    lorebooks: 'Lorebooks',
    characters: 'Characters',
    tools: 'Tools',
    themes: 'Themes',
    guides: 'Guides',
    community: 'Community',
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
        name: 'NemoLite',
        description: 'Lightweight NemoEngine-style preset package for SillyTavern users who want a smaller, easier setup.',
        author: 'forgloryandhonor-cpu',
        url: 'https://github.com/forgloryandhonor-cpu/nemo-engine-lite',
        category: 'presets',
        tags: ['lightweight', 'nemo-engine', 'preset'],
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
    _data: FALLBACK_DATA,
    _isOpen: false,
    _activeView: 'marketplace',
    _activeCategory: 'all',
    _searchTerm: '',
    _promptFiles: [],
    _promptLibraryLoaded: false,
    _promptLibraryLoading: false,
    _promptLibraryErrors: [],
    _activePromptSource: 'all',

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
                this._data = this._mergeLocalRecommendations(await response.json());
                console.log(`${LOG_PREFIX} Loaded ${this._data.length} marketplace items from GitHub`);
                return;
            }
        } catch (e) {
            console.warn(`${LOG_PREFIX} Failed to fetch marketplace data from GitHub, using fallback`, e);
        }
        this._data = FALLBACK_DATA;
    },

    _mergeLocalRecommendations: function (remoteData) {
        const merged = Array.isArray(remoteData) ? [...remoteData] : [];
        const seen = new Set(merged.map(item => this._getRecommendationKey(item)));

        FALLBACK_DATA.forEach(item => {
            const key = this._getRecommendationKey(item);
            if (!seen.has(key)) {
                merged.push(item);
                seen.add(key);
            }
        });

        return merged.length > 0 ? merged : FALLBACK_DATA;
    },

    _getRecommendationKey: function (item) {
        const url = String(item?.url || '').trim().toLowerCase();
        if (url) return `url:${url}`;
        return `name:${String(item?.name || '').trim().toLowerCase()}`;
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
        this._activeView = 'marketplace';
        this._activeCategory = 'all';
        this._activePromptSource = 'all';
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
                    <span class="nemo-marketplace-title-mark"><i class="fa-solid fa-store"></i></span>
                    <div>
                        <h2>Nemo Marketplace</h2>
                        <p class="nemo-marketplace-subtitle">Curated SillyTavern extensions, presets, lorebooks, and guides.</p>
                    </div>
                </div>
                <div class="nemo-marketplace-header-actions">
                    <div class="nemo-marketplace-stat" aria-label="${this._data.length} marketplace items">
                        <strong>${this._data.length}</strong>
                        <span>picks</span>
                    </div>
                    <button class="nemo-marketplace-close menu_button menu_button_icon fa-solid fa-times" title="Close" aria-label="Close Nemo Marketplace"></button>
                </div>
            </div>
            <div class="nemo-marketplace-body">
                <aside class="nemo-marketplace-sidebar" aria-label="Marketplace filters">
                    <div class="nemo-marketplace-view-switch" aria-label="Marketplace view">
                        <button type="button" class="nemo-marketplace-view-btn active" data-view="marketplace">
                            <i class="fa-solid fa-store"></i> Catalog
                        </button>
                        <button type="button" class="nemo-marketplace-view-btn" data-view="prompts">
                            <i class="fa-solid fa-file-import"></i> Prompts
                        </button>
                    </div>
                    <label class="nemo-marketplace-search-label" for="nemo-marketplace-search">Search marketplace</label>
                    <div class="nemo-marketplace-search-wrap">
                        <i class="fa-solid fa-search"></i>
                        <input type="search" id="nemo-marketplace-search" class="text_pole" placeholder="Search recommendations...">
                    </div>
                    <div class="nemo-marketplace-filter-title">Categories</div>
                    <div class="nemo-marketplace-categories" aria-label="Categories">
                        <button type="button" class="nemo-marketplace-cat-btn active" data-category="all" aria-pressed="true">
                            <span><i class="fa-solid fa-layer-group"></i> All</span>
                            <strong>${this._data.length}</strong>
                        </button>
                    </div>
                </aside>
                <section class="nemo-marketplace-results" aria-labelledby="nemo-marketplace-results-title">
                    <div class="nemo-marketplace-results-head">
                        <div>
                            <span class="nemo-marketplace-results-kicker">Browse</span>
                            <h3 id="nemo-marketplace-results-title">All recommendations</h3>
                        </div>
                        <span class="nemo-marketplace-result-count" id="nemo-marketplace-result-count">${this._data.length} items</span>
                    </div>
                    <div class="nemo-marketplace-grid" id="nemo-marketplace-grid"></div>
                </section>
            </div>
            <div class="nemo-marketplace-footer">
                <span class="nemo-marketplace-footer-text">
                    <i class="fa-solid fa-heart"></i> Curated by Nemo. Suggestions welcome on GitHub.
                </span>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Wire up close button
        popup.querySelector('.nemo-marketplace-close').addEventListener('click', () => this._closePopup());

        const viewSwitch = popup.querySelector('.nemo-marketplace-view-switch');
        const catContainer = popup.querySelector('.nemo-marketplace-categories');

        viewSwitch.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const button = target?.closest('.nemo-marketplace-view-btn');
            if (!button) return;
            this._setActiveView(button.dataset.view);
        });

        catContainer.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const button = target?.closest('.nemo-marketplace-cat-btn');
            if (!button) return;
            this._setActiveFilter(button.dataset.category);
        });

        const grid = popup.querySelector('#nemo-marketplace-grid');
        grid.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const importButton = target?.closest('.nemo-marketplace-prompt-import');
            if (!importButton) return;
            this._importPromptFile(importButton.dataset.promptId, importButton);
        });

        // Search handler
        const searchInput = popup.querySelector('#nemo-marketplace-search');
        searchInput.addEventListener('input', () => {
            this._searchTerm = searchInput.value.trim().toLowerCase();
            this._renderCurrentView();
        });

        this._renderFilters();
        this._renderCurrentView();

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

    _setActiveView: function (view) {
        this._activeView = view === 'prompts' ? 'prompts' : 'marketplace';
        this._searchTerm = '';

        const popup = document.querySelector('.nemo-marketplace-popup');
        const searchInput = popup?.querySelector('#nemo-marketplace-search');
        if (searchInput) {
            searchInput.value = '';
            searchInput.placeholder = this._activeView === 'prompts'
                ? 'Search prompt files...'
                : 'Search recommendations...';
        }

        popup?.querySelectorAll('.nemo-marketplace-view-btn').forEach(button => {
            button.classList.toggle('active', button.dataset.view === this._activeView);
        });

        this._renderFilters();
        this._renderCurrentView();

        if (this._activeView === 'prompts') {
            this._ensurePromptLibraryLoaded();
        }
    },

    _setActiveFilter: function (category) {
        if (this._activeView === 'prompts') {
            this._activePromptSource = category || 'all';
        } else {
            this._activeCategory = category || 'all';
        }
        this._renderFilters();
        this._renderCurrentView();
    },

    _renderFilters: function () {
        const container = document.querySelector('.nemo-marketplace-categories');
        const title = document.querySelector('.nemo-marketplace-filter-title');
        if (!container) return;

        container.innerHTML = '';

        if (this._activeView === 'prompts') {
            if (title) title.textContent = 'Prompt Sources';
            container.appendChild(this._createFilterButton({
                id: 'all',
                label: 'All Sources',
                icon: 'fa-layer-group',
                count: this._promptFiles.length,
                active: this._activePromptSource === 'all',
            }));

            PROMPT_LIBRARY_SOURCES.forEach(source => {
                container.appendChild(this._createFilterButton({
                    id: source.id,
                    label: source.name,
                    icon: source.icon,
                    count: this._promptFiles.filter(file => file.sourceId === source.id).length,
                    active: this._activePromptSource === source.id,
                }));
            });
            return;
        }

        if (title) title.textContent = 'Categories';
        container.appendChild(this._createFilterButton({
            id: 'all',
            label: 'All',
            icon: 'fa-layer-group',
            count: this._data.length,
            active: this._activeCategory === 'all',
        }));

        const categories = [...new Set(this._data.map(item => item.category || 'other'))];
        categories.forEach(cat => {
            container.appendChild(this._createFilterButton({
                id: cat,
                label: this._getCategoryLabel(cat),
                icon: CATEGORY_ICONS[cat] || 'fa-tag',
                count: this._getCategoryCount(cat),
                active: this._activeCategory === cat,
            }));
        });
    },

    _createFilterButton: function ({ id, label, icon, count, active }) {
        const btn = document.createElement('button');
        btn.className = `nemo-marketplace-cat-btn${active ? ' active' : ''}`;
        btn.type = 'button';
        btn.dataset.category = id;
        btn.setAttribute('aria-pressed', String(active));
        btn.innerHTML = `
            <span><i class="fa-solid ${icon}"></i> ${this._escapeHtml(label)}</span>
            <strong>${count}</strong>
        `;
        return btn;
    },

    _renderCurrentView: function () {
        if (this._activeView === 'prompts') {
            this._renderPromptLibrary();
        } else {
            this._renderGrid();
        }
    },

    _renderGrid: function () {
        const grid = document.getElementById('nemo-marketplace-grid');
        if (!grid) return;

        let items = this._data;

        // Filter by category
        if (this._activeCategory !== 'all') {
            items = items.filter(item => (item.category || 'other') === this._activeCategory);
        }

        // Filter by search
        if (this._searchTerm) {
            items = items.filter(item =>
                this._toSearchText(item.name).includes(this._searchTerm) ||
                this._toSearchText(item.description).includes(this._searchTerm) ||
                this._toSearchText(item.author).includes(this._searchTerm) ||
                (Array.isArray(item.tags) && item.tags.some(t => this._toSearchText(t).includes(this._searchTerm)))
            );
        }

        const resultTitle = document.getElementById('nemo-marketplace-results-title');
        const resultCount = document.getElementById('nemo-marketplace-result-count');
        const categoryLabel = this._activeCategory === 'all'
            ? 'All recommendations'
            : this._getCategoryLabel(this._activeCategory);
        const resultTitleText = this._searchTerm
            ? (this._activeCategory === 'all' ? 'Search results' : `Search in ${categoryLabel}`)
            : categoryLabel;
        if (resultTitle) resultTitle.textContent = resultTitleText;
        if (resultCount) resultCount.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}`;

        if (items.length === 0) {
            grid.innerHTML = `
                <div class="nemo-marketplace-empty">
                    <i class="fa-solid fa-box-open"></i>
                    <h3>No recommendations found</h3>
                    <p>Try another search term or category.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = items.map(item => this._renderCard(item)).join('');
    },

    _ensurePromptLibraryLoaded: async function () {
        if (this._promptLibraryLoaded || this._promptLibraryLoading) return;

        this._promptLibraryLoading = true;
        this._renderPromptLibrary();

        try {
            const { files, errors } = await loadPromptLibrary();
            this._promptFiles = files;
            this._promptLibraryErrors = errors;
            this._promptLibraryLoaded = true;
        } catch (error) {
            this._promptLibraryErrors = [error.message || 'Unable to load prompt library'];
        } finally {
            this._promptLibraryLoading = false;
            this._renderFilters();
            this._renderPromptLibrary();
        }
    },

    _renderPromptLibrary: function () {
        const grid = document.getElementById('nemo-marketplace-grid');
        if (!grid) return;

        const resultTitle = document.getElementById('nemo-marketplace-results-title');
        const resultCount = document.getElementById('nemo-marketplace-result-count');

        if (resultTitle) resultTitle.textContent = this._searchTerm ? 'Prompt search results' : 'Prompt Library';

        if (this._promptLibraryLoading) {
            if (resultCount) resultCount.textContent = 'Loading';
            grid.innerHTML = this._renderStatus('fa-spinner fa-spin', 'Loading prompt library', 'Fetching Nemo Engine prompt folders from GitHub.');
            return;
        }

        if (!this._promptLibraryLoaded && this._promptFiles.length === 0 && this._promptLibraryErrors.length === 0) {
            if (resultCount) resultCount.textContent = 'Ready';
            grid.innerHTML = this._renderStatus('fa-file-import', 'Prompt library ready', 'Prompt files will load from GitHub when this tab opens.');
            return;
        }

        let files = this._promptFiles;
        if (this._activePromptSource !== 'all') {
            files = files.filter(file => file.sourceId === this._activePromptSource);
        }

        if (this._searchTerm) {
            files = files.filter(file =>
                this._toSearchText(file.title).includes(this._searchTerm) ||
                this._toSearchText(file.name).includes(this._searchTerm) ||
                this._toSearchText(file.sourceName).includes(this._searchTerm) ||
                this._toSearchText(file.path).includes(this._searchTerm)
            );
        }

        if (resultCount) resultCount.textContent = `${files.length} ${files.length === 1 ? 'file' : 'files'}`;

        if (files.length === 0) {
            const detail = this._promptLibraryErrors.length > 0
                ? this._promptLibraryErrors.join(' ')
                : 'Try another search term or source.';
            grid.innerHTML = this._renderStatus('fa-box-open', 'No prompt files found', detail);
            return;
        }

        const warningHtml = this._promptLibraryErrors.length > 0
            ? `<div class="nemo-marketplace-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${this._escapeHtml(this._promptLibraryErrors.join(' '))}</div>`
            : '';

        grid.innerHTML = `${warningHtml}${files.map(file => this._renderPromptFileCard(file)).join('')}`;
    },

    _renderPromptFileCard: function (file) {
        return `
            <div class="nemo-marketplace-prompt-card">
                <div class="nemo-marketplace-prompt-source">
                    <span><i class="fa-solid ${this._escapeAttribute(file.sourceIcon)}"></i> ${this._escapeHtml(file.sourceName)}</span>
                    <strong>${this._escapeHtml(file.extension || 'FILE')}</strong>
                </div>
                <h3>${this._escapeHtml(file.title)}</h3>
                <p>${this._escapeHtml(file.path)}</p>
                <div class="nemo-marketplace-prompt-actions">
                    <a href="${this._escapeAttribute(file.url)}" target="_blank" rel="noopener noreferrer" class="menu_button">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> View
                    </a>
                    <button type="button" class="menu_button nemo-marketplace-prompt-import" data-prompt-id="${this._escapeAttribute(file.id)}">
                        <i class="fa-solid fa-file-import"></i> Import
                    </button>
                </div>
            </div>
        `;
    },

    _renderStatus: function (icon, title, detail) {
        return `
            <div class="nemo-marketplace-empty">
                <i class="fa-solid ${icon}"></i>
                <h3>${this._escapeHtml(title)}</h3>
                <p>${this._escapeHtml(detail)}</p>
            </div>
        `;
    },

    _importPromptFile: async function (promptId, button) {
        const file = this._promptFiles.find(item => item.id === promptId);
        if (!file || !button) return;

        const originalHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing';

        try {
            const bundle = await loadPromptBundle(file);
            const result = await importPromptBundle(bundle);
            button.innerHTML = '<i class="fa-solid fa-check"></i> Imported';
            window.toastr?.success?.(
                `Imported ${result.total} prompt${result.total === 1 ? '' : 's'} from ${file.title}.`,
                'Nemo Marketplace',
            );
        } catch (error) {
            button.disabled = false;
            button.innerHTML = originalHtml;
            console.error(`${LOG_PREFIX} Failed to import marketplace prompt file`, error);
            window.toastr?.error?.(error.message || 'Prompt import failed.', 'Nemo Marketplace');
        }
    },

    _renderCard: function (item) {
        const catColor = CATEGORY_COLORS[item.category] || '#6eb5ff';
        const catIcon = CATEGORY_ICONS[item.category] || 'fa-tag';
        const categoryLabel = this._getCategoryLabel(item.category);
        const safeUrl = this._getSafeExternalUrl(item.url);
        const safeImage = this._getSafeAssetUrl(item.image);
        const name = this._escapeHtml(item.name || 'Untitled recommendation');
        const description = this._escapeHtml(item.description || 'No description available.');
        const author = this._escapeHtml(item.author || 'Unknown author');
        const tagName = safeUrl ? 'a' : 'div';
        const linkAttrs = safeUrl
            ? ` href="${this._escapeAttribute(safeUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${this._escapeAttribute(item.name || 'marketplace item')}"`
            : ' aria-disabled="true"';
        const imageHtml = safeImage
            ? `<div class="nemo-marketplace-card-image"><img src="${this._escapeAttribute(safeImage)}" alt="" loading="lazy"></div>`
            : `<div class="nemo-marketplace-card-image nemo-marketplace-card-image-placeholder">
                    <i class="fa-solid ${catIcon}"></i>
               </div>`;

        const tagsHtml = Array.isArray(item.tags)
            ? item.tags.slice(0, 4).map(tag => `<span class="nemo-marketplace-tag">${this._escapeHtml(tag)}</span>`).join('')
            : '';

        return `
            <${tagName} class="nemo-marketplace-card"${linkAttrs}>
                ${imageHtml}
                <div class="nemo-marketplace-card-body">
                    <div class="nemo-marketplace-card-category" style="color: ${catColor}">
                        <i class="fa-solid ${catIcon}"></i> ${this._escapeHtml(categoryLabel)}
                    </div>
                    <h3 class="nemo-marketplace-card-title">${name}</h3>
                    <p class="nemo-marketplace-card-desc">${description}</p>
                    <div class="nemo-marketplace-card-footer">
                        <span class="nemo-marketplace-card-author"><i class="fa-solid fa-user"></i> ${author}</span>
                        ${tagsHtml ? `<div class="nemo-marketplace-card-tags">${tagsHtml}</div>` : ''}
                    </div>
                </div>
                <div class="nemo-marketplace-card-action">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </div>
            </${tagName}>
        `;
    },

    _getCategoryLabel: function (category) {
        const raw = String(category || 'other');
        if (CATEGORY_LABELS[raw]) return CATEGORY_LABELS[raw];
        return raw.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    },

    _getCategoryCount: function (category) {
        if (category === 'all') return this._data.length;
        return this._data.filter(item => (item.category || 'other') === category).length;
    },

    _toSearchText: function (value) {
        return String(value || '').toLowerCase();
    },

    _escapeHtml: function (value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[char]));
    },

    _escapeAttribute: function (value) {
        return this._escapeHtml(value).replace(/`/g, '&#96;');
    },

    _getSafeExternalUrl: function (value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            const url = new URL(raw, window.location.href);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    },

    _getSafeAssetUrl: function (value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            const url = new URL(raw, window.location.href);
            return ['http:', 'https:'].includes(url.protocol) ? raw : '';
        } catch {
            return '';
        }
    },

    _escHandler: null,
};
