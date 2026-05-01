// extensions-tab-overhaul.js
// Enhanced extensions tab with full-screen views and folder management

import { LOG_PREFIX } from '../core/utils.js';
import { extension_settings } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import logger from '../core/logger.js';

export const ExtensionsTabOverhaul = {
    initialized: false,
    currentView: 'main', // 'main' or 'fullscreen'
    currentExtension: null,
    currentCompanionExtensions: [],
    hiddenCompanionExtensions: [],
    customFolders: {},
    extensionTags: {},
    originalExtensions: [], // Store original extension elements
    imagePromptTemplates: [
        {
            id: 'anime_scene',
            label: 'Anime Scene',
            icon: 'fa-star',
            positive: 'masterpiece, best quality, anime illustration, cohesive character design, expressive faces, clear scene composition, cinematic lighting, detailed background, clean linework, {prompt}',
            negative: 'lowres, worst quality, low quality, bad anatomy, bad hands, extra fingers, missing fingers, malformed limbs, deformed face, bad eyes, text, watermark, signature, jpeg artifacts, blurry, cropped, duplicate characters, inconsistent outfit',
        },
        {
            id: 'manga_panel',
            label: 'Manga Panel',
            icon: 'fa-book-open',
            positive: 'manga illustration, comic panel composition, clean ink linework, screentone shading, expressive character acting, readable silhouettes, detailed environment, dramatic framing, {prompt}',
            negative: 'lowres, messy panel layout, muddy screentones, broken lineart, bad anatomy, bad hands, malformed fingers, unreadable face, text, speech bubbles, watermark, signature, jpeg artifacts, blurry, cropped',
        },
        {
            id: 'cinematic',
            label: 'Cinematic',
            icon: 'fa-film',
            positive: 'cinematic composition, natural lighting, strong focal point, realistic materials, detailed environment, balanced depth of field, consistent character appearance, atmospheric color grading, {prompt}',
            negative: 'lowres, overexposed, underexposed, motion blur, bad anatomy, distorted hands, deformed face, uncanny eyes, duplicate limbs, text, watermark, signature, compression artifacts, cropped subject',
        },
        {
            id: 'clean_negative',
            label: 'Clean Negative',
            icon: 'fa-broom',
            positive: 'best quality, clear composition, consistent character details, detailed scene, {prompt}',
            negative: 'lowres, worst quality, low quality, normal quality, bad anatomy, bad hands, extra fingers, missing fingers, extra limbs, malformed limbs, deformed face, bad eyes, cross-eye, text, watermark, signature, username, jpeg artifacts, blurry, cropped, out of frame',
        },
    ],
    
    // IDs to skip — these aren't real extensions (stray style tags, etc.)
    skipIds: ['nemo-ext-unknown-extension'],

    // Friendly display names for extension containers that lack proper title elements
    friendlyNames: {
        'assets_container': 'Download Extensions & Assets',
        'typing_indicator_container': 'Typing Indicator',
        'sd_container': 'Image Generation',
        'expressions_container': 'Character Expressions',
        'caption_container': 'Image Captioning',
        'blip_container': 'Multimodal (LLaVA)',
        'live2d_container': 'Live2D',
        'vrm_container': 'VRM Characters',
        'tts_container': 'Text-to-Speech',
        'rvc_container': 'RVC Voice Conversion',
        'stt_container': 'Speech-to-Text',
        'audio_container': 'Ambient Audio',
        'silence_container': 'Silence Player',
        'summarize_container': 'Summarize',
        'vectors_container': 'Vector Storage',
        'chromadb_container': 'ChromaDB',
        'qvink_memory_settings': 'Qvink Memory',
        'vectors_enhanced_container': 'Enhanced Vectors',
        'websearch_container': 'Web Search',
        'regex_container': 'Regex',
        'randomizer_container': 'Randomizer',
        'qr_container': 'Quick Reply',
        'translation_container': 'Chat Translation',
        'objective_container': 'Objectives / Tasks',
        'dice_container': 'Dice Roller',
        'message_limit_container': 'Message Limit',
        'injects_container': 'Data Bank Injections',
        'idle_container': 'Idle Response',
        'hypebot_container': 'HypeBot',
        'accuweather_container': 'AccuWeather',
        'rss_container': 'RSS Feed',
        'emulatorjs_container': 'EmulatorJS',
        'webllm_container': 'WebLLM (Local)',
        'timelines_container': 'Timelines',
        'spotify_settings': 'Spotify',
        'tunnelvision_settings': 'TunnelVision',
        'nemo_lore_settings': 'NemoLore',
        'nemo_rewrite_settings': 'Nemo Rewrite',
    },

    // Define default categories for extensions
    defaultCategories: {
        'Core': ['assets_container'],
        'Image': ['sd_container', 'expressions_container', 'caption_container', 'blip_container', 'live2d_container', 'vrm_container'],
        'Audio': ['tts_container', 'rvc_container', 'stt_container', 'audio_container', 'silence_container', 'spotify_settings'],
        'Memory': ['summarize_container', 'vectors_container', 'chromadb_container', 'qvink_memory_settings', 'vectors_enhanced_container'],
        'Utilities': ['websearch_container', 'regex_container', 'randomizer_container', 'qr_container', 'translation_container', 'objective_container', 'dice_container', 'typing_indicator_container'],
        'Chat Features': ['message_limit_container', 'injects_container', 'idle_container', 'hypebot_container'],
        'Integrations': ['accuweather_container', 'rss_container', 'emulatorjs_container', 'webllm_container', 'timelines_container'],
        'NemoSuite': [
            // NemoPresetExt core settings (this extension)
            'nemo-preset-ext-settings',
            // Nemo companion extensions
            'tunnelvision_settings',
            'nemo_lore_settings',
            'nemo_rewrite_settings',
            'nemo-rewrite-settings',
            'nemo-ext-nemo-rewrite',
            'nemo-ext-nemorewrite',
            'nemorewrite-settings',
            'nemorewrite_settings',
            // Standalone Nemo extensions (if installed separately)
            'nemo-ext-prose-polisher',
            'nemo-ext-prosepolisher',
            'prose-polisher-settings',
            'prosepolisher_settings',
            'nemo-ext-ember',
            'ember-settings',
            'ember_settings',
            'nemo-ext-nemo-lore',
            'nemo-ext-nemolore',
            'nemolore-settings',
            'nemolore_settings',
            'nemo-ext-mood-music',
            'nemo-ext-moodmusic',
            'moodmusic-settings',
            'moodmusic_settings',
            'nemo-ext-card-emporium',
            'nemo-ext-cardemporium',
            'card-emporium-settings',
            'cardemporium_settings',
            'nemo-vrm-settings',
            'nemovrm_settings',
            'nemo-ext-nemovrm'
        ],
        'UI & Themes': ['SillyTavernMoonlitEchoesTheme-drawer', 'rewrite-extension-settings', 'loremanager_settings', 'noass_settings', 'stsc--settings', 'charCreator_settings', 'weatherpack-settings', 'worldInfoRecommender_settings', 'lootTipEnabled', 'example-extension-settings'],
    },

    initialize: function() {
        if (this.initialized) {
            logger.debug('Extensions Tab Overhaul already initialized - skipping');
            return;
        }

        // Load saved settings
        this.loadSettings();

        let pollCount = 0;
        const pollForExtensions = setInterval(() => {
            const extensionsContainer1 = document.getElementById('extensions_settings');
            const extensionsContainer2 = document.getElementById('extensions_settings2');

            // Wait for both containers to exist and have extensions loaded
            const container1Children = extensionsContainer1 ? extensionsContainer1.children.length : 0;
            const container2Children = extensionsContainer2 ? extensionsContainer2.children.length : 0;
            const totalExtensions = container1Children + container2Children;

            pollCount++;

            // Wait for at least 5 seconds (5 polls) AND have extensions, OR timeout at 20 seconds
            if ((extensionsContainer1 && totalExtensions > 0 && pollCount >= 5) || pollCount >= 20) {
                clearInterval(pollForExtensions);

                // Set initialized FIRST to prevent double initialization
                this.initialized = true;

                setTimeout(() => {
                    this.setupTabExtensionView();
                    this.createEnhancedInterface(extensionsContainer1);
                    this.setupEventListeners();
                    this.hideDuplicateSettings();

                    logger.info('Enhanced Extensions Tab initialized', { totalExtensions });
                }, 2000); // Wait 2 full seconds after deciding to initialize
            }
        }, 1000);
    },

    loadSettings: function() {
        const settings = extension_settings.NemoPresetExt?.extensionOverhaul || {};
        this.customFolders = settings.customFolders || {};
        this.extensionTags = settings.extensionTags || {};
    },

    saveSettings: function() {
        if (!extension_settings.NemoPresetExt) {
            extension_settings.NemoPresetExt = {};
        }
        extension_settings.NemoPresetExt.extensionOverhaul = {
            customFolders: this.customFolders,
            extensionTags: this.extensionTags
        };
        saveSettingsDebounced();
    },

    hideDuplicateSettings: function() {
        const hideAttempt = () => {
            const allSettings = document.querySelectorAll('.nemo-preset-enhancer-settings');

            allSettings.forEach((el) => {
                const isInCard = el.closest('.nemo-extension-card');
                const isInOverlay = el.closest('#nemo-extension-view-content');
                const isInTabOverlay = el.closest('#nemo-tab-extension-overlay');

                // Only hide if it's NOT inside a card or any overlay
                if (!isInCard && !isInOverlay && !isInTabOverlay) {
                    el.style.display = 'none';
                }
            });
        };

        // Try multiple times with increasing delays to catch all duplicates
        setTimeout(hideAttempt, 500);
        setTimeout(hideAttempt, 1000);
        setTimeout(hideAttempt, 2000);

        // Disconnect any prior observer so we don't stack them on re-init
        if (this._dupObserver) {
            this._dupObserver.disconnect();
        }

        // Set up a MutationObserver to catch any future duplicates
        this._dupObserver = new MutationObserver(() => {
            hideAttempt();
        });

        // Observe the extensions settings containers for any changes
        const extensionsContainer1 = document.getElementById('extensions_settings');
        const extensionsContainer2 = document.getElementById('extensions_settings2');

        if (extensionsContainer1) {
            this._dupObserver.observe(extensionsContainer1, { childList: true, subtree: true });
        }
        if (extensionsContainer2) {
            this._dupObserver.observe(extensionsContainer2, { childList: true, subtree: true });
        }
    },

    setupTabExtensionView: function() {
        // Create tab-contained extension view
        const extensionsContainer = document.getElementById('extensions_settings');
        const overlay = document.createElement('div');
        overlay.id = 'nemo-tab-extension-overlay';
        overlay.className = 'nemo-tab-extension-view';
        overlay.innerHTML = `
            <div class="nemo-extension-view-header">
                <button class="nemo-back-button" id="nemo-back-to-main">
                    <i class="fa-solid fa-arrow-left"></i>
                    Back to Extensions
                </button>
                <div class="nemo-extension-title" id="nemo-current-extension-title">Extension Settings</div>
            </div>
            <div class="nemo-extension-view-content" id="nemo-extension-view-content">
                <!-- Extension content will be moved here -->
            </div>
        `;
        // Insert at the beginning of the container so it appears at the top
        extensionsContainer.insertBefore(overlay, extensionsContainer.firstChild);
    },

    discoverExtensions: function() {
        const extensions = [];
        this.hiddenCompanionExtensions = [];
        const containers = document.querySelectorAll('#extensions_settings > *, #extensions_settings2 > *');

        containers.forEach(container => {
            // Skip non-element nodes and non-DIV elements (e.g. stray <style> tags)
            if (container.nodeType !== Node.ELEMENT_NODE || container.tagName === 'STYLE' || container.tagName === 'SCRIPT') {
                return;
            }

            // Skip our own UI elements (but NOT nemo-preset-enhancer-settings, we want that!)
            if (container.id === 'nemo-suite-drawer' ||
                container.id === 'nemo-tab-extension-overlay' ||
                container.classList.contains('nemo-extensions-search') ||
                container.classList.contains('nemo-extensions-layout') ||
                container.classList.contains('nemo-folder-controls')) {
                return;
            }

            let id = container.id;

            // Skip explicitly blacklisted IDs
            if (id && this.skipIds.includes(id)) {
                return;
            }

            // Skip empty containers that have no settings UI
            // (many ST containers are just empty shells with no content)
            if (container.children.length === 0) {
                return;
            }

            // Determine title: friendly name > DOM element > fallback from ID
            let title = 'Unknown Extension';

            if (this.friendlyNames[id]) {
                title = this.friendlyNames[id];
            } else {
                const titleElement = container.querySelector('.inline-drawer-header b, h4, .extension-name, [data-extension-name]');
                if (titleElement) {
                    title = titleElement.textContent.trim();
                } else if (container.dataset.extensionName) {
                    title = container.dataset.extensionName;
                } else if (id) {
                    title = id.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
            }

            // Special handling for NemoPresetExt settings
            if (container.classList.contains('nemo-preset-enhancer-settings')) {
                id = 'nemo-preset-ext-settings';
                title = 'NemoPreset UI Extensions';
                container.id = id;
            } else if (!id) {
                id = `nemo-ext-${title.replace(/\s+/g, '-').toLowerCase()}`;
                container.id = id;
            }

            extensions.push({
                id: id,
                element: container,
                title: title,
                originalParent: container.parentNode
            });
        });

        const hasSummarize = extensions.some(extension => extension.id === 'summarize_container');
        const hasNemoLore = extensions.some(extension => extension.id === 'nemo_lore_settings');

        if (hasSummarize && hasNemoLore) {
            return extensions.filter(extension => {
                if (extension.id === 'nemo_lore_settings') {
                    this.hiddenCompanionExtensions.push({
                        element: extension.element,
                        originalParent: extension.originalParent,
                        display: extension.element.style.display,
                    });
                    extension.element.style.display = 'none';
                    return false;
                }
                return true;
            });
        }

        return extensions;
    },

    createEnhancedInterface: function(container) {
        // Check if the interface is already created by looking for our layout element
        const existingLayout = document.querySelector('.nemo-extensions-layout');
        if (existingLayout) {
            return;
        }

        const discoveredExtensions = this.discoverExtensions();
        if (discoveredExtensions.length === 0) return;

        // Store original extensions for cleanup (keep the actual elements, don't clone)
        this.originalExtensions = discoveredExtensions.map(ext => ({
            element: ext.element,
            originalParent: ext.originalParent
        }));

        // Create search and folder controls
        const controlsContainer = document.createElement('div');
        controlsContainer.innerHTML = `
            <div class="nemo-folder-controls">
                <div>
                    <button class="nemo-add-folder-button" id="nemo-add-custom-folder">
                        <i class="fa-solid fa-plus"></i>
                        Add Custom Folder
                    </button>
                </div>
            </div>
            <div class="nemo-extensions-search">
                <div class="flex-container alignItemsCenter" style="margin-bottom: 15px; gap: 10px;">
                    <i class="fa-solid fa-search" style="opacity: 0.7;"></i>
                    <input type="search" id="nemo-extensions-search" 
                           placeholder="Search extensions and folders..." 
                           class="text_pole">
                </div>
            </div>
        `;

        // Create layout container
        const layoutContainer = document.createElement('div');
        layoutContainer.className = 'nemo-extensions-layout';
        
        const leftColumn = document.createElement('div');
        leftColumn.className = 'nemo-extensions-column';
        const rightColumn = document.createElement('div');
        rightColumn.className = 'nemo-extensions-column';

        // Group extensions
        const groupedExtensions = this.groupExtensions(discoveredExtensions);
        const allCategories = [...Object.keys(this.defaultCategories), ...Object.keys(this.customFolders), 'Other'];
        
        allCategories.forEach((category, index) => {
            const hasExtensions = groupedExtensions[category] && groupedExtensions[category].length > 0;
            const isCustomFolder = this.customFolders.hasOwnProperty(category);
            
            // Show folder if it has extensions OR if it's a custom folder (even if empty)
            if (hasExtensions || isCustomFolder) {
                const folder = this.createFolder(category, groupedExtensions[category] || []);
                
                if (index % 2 === 0) {
                    leftColumn.appendChild(folder);
                } else {
                    rightColumn.appendChild(folder);
                }
            }
        });
        
        layoutContainer.appendChild(leftColumn);
        layoutContainer.appendChild(rightColumn);

        // Setup containers
        const settings1 = document.getElementById('extensions_settings');
        const settings2 = document.getElementById('extensions_settings2');

        // Hide all original extension elements (they'll be shown when cards are clicked)
        discoveredExtensions.forEach(ext => {
            ext.element.style.display = 'none';
        });

        // Hide settings2 container
        if(settings2) {
            settings2.style.display = 'none';
        }

        // Prepend our interface to settings1 (don't clear it, just add to the beginning)
        settings1.insertBefore(layoutContainer, settings1.firstChild);
        settings1.insertBefore(controlsContainer, settings1.firstChild);
        
        this.addSearchHandler();
        this.setupContextMenu();
    },

    groupExtensions: function(extensions) {
        const grouped = {};
        
        extensions.forEach(ext => {
            let category = 'Other';
            
            // Check custom folder assignments first
            if (this.extensionTags[ext.id]) {
                const customFolder = this.extensionTags[ext.id];
                if (!grouped[customFolder]) grouped[customFolder] = [];
                grouped[customFolder].push(ext);
                return;
            }
            
            // Check default categories
            for (const cat in this.defaultCategories) {
                if (this.defaultCategories[cat].includes(ext.id)) {
                    category = cat;
                    break;
                }
            }
            
            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(ext);
        });

        return grouped;
    },

    createFolder: function(categoryName, extensions) {
        const isCustom = this.customFolders.hasOwnProperty(categoryName);
        const folder = document.createElement('div');
        folder.className = 'inline-drawer wide100p nemo-extension-category-drawer';
        folder.dataset.category = categoryName;
        
        folder.innerHTML = `
            <div class="inline-drawer-toggle inline-drawer-header interactable" tabindex="0">
                <b>${categoryName}</b>
                ${isCustom ? '<i class="fa-solid fa-trash nemo-folder-delete" style="margin-left: 10px; opacity: 0.6; cursor: pointer; color: #ff6b6b;" title="Delete folder"></i>' : ''}
                <div class="inline-drawer-icon fa-solid fa-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content" style="display: none;"></div>
        `;
        
        const content = folder.querySelector('.inline-drawer-content');
        if (extensions.length === 0 && isCustom) {
            // Show a message for empty custom folders
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'nemo-empty-folder-message';
            emptyMessage.style.cssText = `
                padding: 15px;
                text-align: center;
                color: var(--nemo-text-muted, #888);
                font-style: italic;
                font-size: 0.9em;
            `;
            emptyMessage.textContent = 'This folder is empty. Move extensions here using the folder button or right-click menu.';
            content.appendChild(emptyMessage);
        } else {
            extensions.forEach(ext => {
                const card = this.createExtensionCard(ext);
                content.appendChild(card);
            });
        }
        
        return folder;
    },

    createExtensionCard: function(extension) {
        const tags = this.getExtensionTags(extension.id);
        const card = document.createElement('div');
        card.className = 'nemo-extension-card';
        card.dataset.extensionId = extension.id;
        
        card.innerHTML = `
            <div class="nemo-card-header">
                <div class="nemo-card-title">${extension.title}</div>
                <div class="nemo-card-actions">
                    <button class="nemo-folder-button" title="Move to folder">
                        <i class="fa-solid fa-folder"></i>
                    </button>
                    <button class="nemo-options-button" title="More Options">
                        <i class="fa-solid fa-ellipsis-v"></i>
                    </button>
                </div>
            </div>
            <div class="nemo-card-folder">
                ${tags.map(tag => `<span class="nemo-folder-badge ${tag.custom ? 'nemo-custom-folder' : ''}">${tag.name}</span>`).join('')}
            </div>
        `;
        
        // Store reference to original extension element
        card._extensionElement = extension.element;
        card._extensionData = extension;
        
        return card;
    },

    getExtensionTags: function(extensionId) {
        const tags = [];
        
        // Add category tag
        for (const category in this.defaultCategories) {
            if (this.defaultCategories[category].includes(extensionId)) {
                tags.push({ name: category, custom: false });
                break;
            }
        }
        
        // Add custom folder assignment
        if (this.extensionTags[extensionId]) {
            tags.push({ name: this.extensionTags[extensionId], custom: true });
        }
        
        return tags;
    },

    setupEventListeners: function() {
        // Abort any prior listeners so toggling the feature off-then-on
        // doesn't stack multiple document-level handlers.
        if (this._listenerCtrl) {
            this._listenerCtrl.abort();
        }
        this._listenerCtrl = new AbortController();
        const signal = this._listenerCtrl.signal;

        // Extension card clicks
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.nemo-extension-card');
            if (card && !e.target.closest('.nemo-card-actions')) {
                if (card._extensionData) {
                    this.openExtensionFullScreen(card._extensionData);
                }
            }

            // Back button
            if (e.target.closest('#nemo-back-to-main')) {
                this.closeFullScreen();
            }

            // Add custom folder
            if (e.target.closest('#nemo-add-custom-folder')) {
                this.promptForCustomFolder();
            }

            // Delete custom folder
            if (e.target.closest('.nemo-folder-delete')) {
                e.stopPropagation();
                const folderHeader = e.target.closest('.inline-drawer-header');
                const folder = folderHeader.closest('.nemo-extension-category-drawer');
                const folderName = folder.dataset.category;
                this.confirmDeleteCustomFolder(folderName);
            }

            // Folder button
            if (e.target.closest('.nemo-folder-button')) {
                e.stopPropagation();
                const card = e.target.closest('.nemo-extension-card');
                const extensionId = card.dataset.extensionId;
                this.showFolderSelectionDialog(extensionId);
            }
        }, { signal });

        // Context menu
        document.addEventListener('contextmenu', (e) => {
            const card = e.target.closest('.nemo-extension-card');
            if (card) {
                e.preventDefault();
                this.showContextMenu(card, e.clientX, e.clientY);
            }
        }, { signal });

        // Hide context menu on click elsewhere
        document.addEventListener('click', () => {
            this.hideContextMenu();
        }, { signal });
    },

    openExtensionFullScreen: function(extensionData) {
        const overlay = document.getElementById('nemo-tab-extension-overlay');
        const titleElement = document.getElementById('nemo-current-extension-title');
        const contentElement = document.getElementById('nemo-extension-view-content');
        
        if (!overlay) {
            this.setupTabExtensionView();
            return this.openExtensionFullScreen(extensionData);
        }
        
        // Hide the main extension interface
        this.hideMainInterface();
        
        // Update title
        titleElement.textContent = extensionData.title;
        
        // Move extension content to tab view
        contentElement.innerHTML = '';
        
        // Store the original parent for restoration later
        extensionData.originalParent = extensionData.element.parentNode;
        
        // Move the ACTUAL extension element (not a clone) to maintain functionality
        const extensionElement = extensionData.element;

        // Make sure the element is visible
        extensionElement.style.display = '';

        // If it's a drawer, open it and show content directly
        if (extensionElement.querySelector('.inline-drawer-content')) {
            const drawerContent = extensionElement.querySelector('.inline-drawer-content');
            drawerContent.style.display = 'block';
            // Move the entire extension element to maintain all functionality
            contentElement.appendChild(extensionElement);
        } else {
            contentElement.appendChild(extensionElement);
        }

        if (extensionElement.id === 'sd_container') {
            this.enhanceImageGenerationSettings(extensionElement);
        }

        if (extensionElement.id === 'summarize_container') {
            this.enhanceSummarizeSettings(extensionElement);
        }

        if (extensionElement.id === 'qr_container') {
            this.enhanceQuickReplySettings(extensionElement);
        }

        if (extensionElement.id === 'regex_container') {
            this.enhanceRegexSettings(extensionElement);
        }

        if (extensionElement.id === 'tts_container') {
            this.enhanceTtsSettings(extensionElement);
        }

        if (extensionElement.id === 'vectors_container') {
            this.enhanceVectorSettings(extensionElement);
        }

        // Show overlay within the tab
        overlay.classList.add('active');
        this.currentView = 'extension';
        this.currentExtension = extensionData;
    },

    enhanceImageGenerationSettings: function(extensionElement) {
        const mainDrawerContent = extensionElement.querySelector('.sd_settings > .inline-drawer:first-child > .inline-drawer-content');
        if (!mainDrawerContent || mainDrawerContent.dataset.nemoSdEnhanced === 'true') {
            return;
        }

        mainDrawerContent.dataset.nemoSdEnhanced = 'true';
        extensionElement.classList.add('nemo-sd-enhanced');

        const layout = document.createElement('div');
        layout.className = 'nemo-sd-settings-layout';

        const workflowSection = this.createImageGenerationSection('Workflow', 'fa-wand-magic-sparkles', 'nemo-sd-workflow-section');
        const sourceSection = this.createImageGenerationSection('Source', 'fa-plug', 'nemo-sd-source-section');
        const modelSection = this.createImageGenerationSection('Model', 'fa-cubes', 'nemo-sd-model-section');
        const generationSection = this.createImageGenerationSection('Generation', 'fa-sliders', 'nemo-sd-generation-section');
        const styleSection = this.createImageGenerationSection('Style', 'fa-palette', 'nemo-sd-style-section');
        const visibilitySection = this.createImageGenerationSection('Visibility', 'fa-eye', 'nemo-sd-visibility-section');

        const workflowGrid = document.createElement('div');
        workflowGrid.className = 'nemo-sd-toggle-grid';
        const workflowToggleIds = [
            'sd_refine_mode',
            'sd_function_tool',
            'sd_interactive_mode',
            'sd_multimodal_captioning',
            'sd_free_extend',
            'sd_snap',
            'sd_minimal_prompt_processing',
        ];
        this.moveElements(workflowGrid, workflowToggleIds.map(id => mainDrawerContent.querySelector(`label[for="${id}"]`)));
        workflowSection.body.appendChild(workflowGrid);

        const sourcePicker = document.createElement('div');
        sourcePicker.className = 'nemo-sd-source-picker';
        this.moveElements(sourcePicker, [
            mainDrawerContent.querySelector('label[for="sd_source"]'),
            mainDrawerContent.querySelector('#sd_source'),
        ]);
        sourceSection.body.appendChild(sourcePicker);

        const providerGrid = document.createElement('div');
        providerGrid.className = 'nemo-sd-provider-grid';
        const directChildren = Array.from(mainDrawerContent.children);
        const firstModelRow = this.getDirectChildContaining(mainDrawerContent, '#sd_model');
        const firstModelRowIndex = firstModelRow ? directChildren.indexOf(firstModelRow) : directChildren.length;
        this.moveElements(providerGrid, directChildren.filter((element, index) => element.matches('[data-sd-source]') && index < firstModelRowIndex));
        sourceSection.body.appendChild(providerGrid);

        this.moveElements(modelSection.body, [
            this.getDirectChildContaining(mainDrawerContent, '#sd_model'),
            this.getDirectChildContaining(mainDrawerContent, '#sd_sampler'),
            this.getDirectChildContaining(mainDrawerContent, '#sd_resolution'),
        ]);

        this.moveElements(generationSection.body, [
            this.getDirectChildContaining(mainDrawerContent, '#sd_steps'),
            this.getDirectChildContaining(mainDrawerContent, '#sd_dimensions_block'),
            this.getDirectChildContaining(mainDrawerContent, '#sd_hr_scale'),
            this.getDirectChildContaining(mainDrawerContent, '#sd_restore_faces'),
            this.getDirectChildContaining(mainDrawerContent, '#sd_adetailer_face'),
            this.getDirectChildContaining(mainDrawerContent, '#sd_novel_sm'),
            this.getDirectChildContaining(mainDrawerContent, '#sd_seed'),
        ]);

        const styleHeading = Array.from(mainDrawerContent.children).find(element => element.matches('h4') && element.textContent.trim().includes('Style'));
        const visibilityHeading = Array.from(mainDrawerContent.children).find(element => element.matches('h4') && element.textContent.trim().includes('Chat Message Visibility'));
        const styleStart = styleHeading?.previousElementSibling?.tagName === 'HR' ? styleHeading.previousElementSibling : styleHeading;
        const visibilityStart = visibilityHeading?.previousElementSibling?.tagName === 'HR' ? visibilityHeading.previousElementSibling : visibilityHeading;

        this.moveElements(styleSection.body, this.collectSiblingRange(styleStart, visibilityStart));
        this.addImagePromptSuggestions(styleSection.body);
        this.moveElements(visibilitySection.body, this.collectSiblingRange(visibilityStart, null));

        [
            workflowSection.element,
            sourceSection.element,
            modelSection.element,
            generationSection.element,
            styleSection.element,
            visibilitySection.element,
        ].forEach(section => {
            if (section.querySelector('.nemo-sd-card-body')?.children.length) {
                layout.appendChild(section);
            }
        });

        const remainder = Array.from(mainDrawerContent.children);
        if (remainder.length) {
            const advancedSection = this.createImageGenerationSection('Advanced', 'fa-layer-group', 'nemo-sd-advanced-section');
            this.moveElements(advancedSection.body, remainder);
            layout.appendChild(advancedSection.element);
        }

        mainDrawerContent.appendChild(layout);
    },

    createImageGenerationSection: function(title, icon, className) {
        const element = document.createElement('section');
        element.className = `nemo-sd-card ${className}`;
        element.innerHTML = `
            <div class="nemo-sd-card-header">
                <i class="fa-solid ${icon}"></i>
                <h3>${title}</h3>
            </div>
            <div class="nemo-sd-card-body"></div>
        `;

        return {
            element,
            body: element.querySelector('.nemo-sd-card-body'),
        };
    },

    addImagePromptSuggestions: function(styleBody) {
        const promptInput = styleBody.querySelector('#sd_prompt_prefix');
        const negativeInput = styleBody.querySelector('#sd_negative_prompt');

        if (!promptInput || !negativeInput || styleBody.querySelector('.nemo-sd-prompt-suggestions')) {
            return;
        }

        const panel = document.createElement('div');
        panel.className = 'nemo-sd-prompt-suggestions';
        panel.innerHTML = `
            <div class="nemo-sd-suggestions-header">
                <i class="fa-solid fa-lightbulb"></i>
                <span>Prompt Suggestions</span>
            </div>
            <div class="nemo-sd-suggestion-buttons"></div>
        `;

        const buttonsContainer = panel.querySelector('.nemo-sd-suggestion-buttons');
        this.imagePromptTemplates.forEach(template => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'nemo-sd-template-button';
            button.dataset.templateId = template.id;
            button.innerHTML = `
                <i class="fa-solid ${template.icon}"></i>
                <span>${template.label}</span>
            `;
            button.addEventListener('click', () => {
                this.applyImagePromptTemplate(template, promptInput, negativeInput);
            });
            buttonsContainer.appendChild(button);
        });

        const insertionPoint = styleBody.querySelector('label[for="sd_prompt_prefix"]') || promptInput;
        styleBody.insertBefore(panel, insertionPoint);
    },

    applyImagePromptTemplate: function(template, promptInput, negativeInput) {
        promptInput.value = template.positive;
        negativeInput.value = template.negative;
        this.dispatchNativeInput(promptInput);
        this.dispatchNativeInput(negativeInput);
        saveSettingsDebounced();
    },

    dispatchNativeInput: function(element) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    },

    enhanceQuickReplySettings: function(extensionElement) {
        const settingsRoot = extensionElement.querySelector('#qr--settings');
        const drawerContent = settingsRoot?.querySelector(':scope > .inline-drawer > .inline-drawer-content');

        if (!settingsRoot || !drawerContent) {
            return;
        }

        extensionElement.classList.add('nemo-qr-enhanced');
        this.observeQuickReplyRerenders(extensionElement, drawerContent);

        if (drawerContent.querySelector(':scope > .nemo-qr-settings-layout') || drawerContent.dataset.nemoQrEnhancing === 'true') {
            return;
        }

        drawerContent.dataset.nemoQrEnhancing = 'true';

        try {
            drawerContent.querySelectorAll(':scope > hr').forEach(separator => separator.remove());

            const layout = document.createElement('div');
            layout.className = 'nemo-qr-settings-layout';

            const generalSection = this.createQuickReplySection('General', 'fa-bolt', 'nemo-qr-general-section');
            const scopesSection = this.createQuickReplySection('Active Sets', 'fa-layer-group', 'nemo-qr-scopes-section');
            const editorSection = this.createQuickReplySection('Set Editor', 'fa-pen-to-square', 'nemo-qr-editor-section');

            const toggleGrid = document.createElement('div');
            toggleGrid.className = 'nemo-qr-toggle-grid';
            this.moveElements(toggleGrid, [
                this.getDirectChildContaining(drawerContent, '#qr--isEnabled'),
                this.getDirectChildContaining(drawerContent, '#qr--isCombined'),
                this.getDirectChildContaining(drawerContent, '#qr--showPopoutButton'),
            ]);
            generalSection.body.appendChild(toggleGrid);

            const scopeGrid = document.createElement('div');
            scopeGrid.className = 'nemo-qr-scope-grid';
            this.moveElements(scopeGrid, [
                this.getDirectChildContaining(drawerContent, '#qr--global'),
                this.getDirectChildContaining(drawerContent, '#qr--chat'),
                this.getDirectChildContaining(drawerContent, '#qr--character'),
            ]);
            scopesSection.body.appendChild(scopeGrid);

            this.moveElements(editorSection.body, [
                this.getDirectChildContaining(drawerContent, '#qr--editor'),
            ]);

            [
                generalSection.element,
                scopesSection.element,
                editorSection.element,
            ].forEach(section => {
                if (section.querySelector('.nemo-qr-card-body')?.children.length) {
                    layout.appendChild(section);
                }
            });

            const remainder = Array.from(drawerContent.children);
            if (remainder.length) {
                const advancedSection = this.createQuickReplySection('Additional Options', 'fa-sliders', 'nemo-qr-advanced-section');
                this.moveElements(advancedSection.body, remainder);
                layout.appendChild(advancedSection.element);
            }

            drawerContent.appendChild(layout);
        } finally {
            delete drawerContent.dataset.nemoQrEnhancing;
        }
    },

    createQuickReplySection: function(title, icon, className) {
        const element = document.createElement('section');
        element.className = `nemo-qr-card ${className}`;
        element.innerHTML = `
            <div class="nemo-qr-card-header">
                <i class="fa-solid ${icon}"></i>
                <h3>${title}</h3>
            </div>
            <div class="nemo-qr-card-body"></div>
        `;

        return {
            element,
            body: element.querySelector('.nemo-qr-card-body'),
        };
    },

    observeQuickReplyRerenders: function(extensionElement, drawerContent) {
        if (drawerContent._nemoQrObserver) {
            return;
        }

        drawerContent._nemoQrObserver = new MutationObserver(() => {
            if (drawerContent.dataset.nemoQrEnhancing === 'true' || drawerContent.querySelector(':scope > .nemo-qr-settings-layout')) {
                return;
            }

            clearTimeout(drawerContent._nemoQrEnhanceTimer);
            drawerContent._nemoQrEnhanceTimer = setTimeout(() => {
                this.enhanceQuickReplySettings(extensionElement);
            }, 0);
        });
        drawerContent._nemoQrObserver.observe(drawerContent, { childList: true });
    },

    enhanceRegexSettings: function(extensionElement) {
        const drawerContent = extensionElement.querySelector('.regex_settings > .inline-drawer > .inline-drawer-content');

        if (!drawerContent || drawerContent.dataset.nemoRegexEnhanced === 'true') {
            return;
        }

        drawerContent.dataset.nemoRegexEnhanced = 'true';
        extensionElement.classList.add('nemo-regex-enhanced');
        drawerContent.querySelectorAll(':scope > hr').forEach(separator => separator.remove());

        const layout = document.createElement('div');
        layout.className = 'nemo-regex-settings-layout';

        const actionsSection = this.createRegexSection('Actions', 'fa-wand-magic-sparkles', 'nemo-regex-actions-section');
        const presetsSection = this.createRegexSection('Presets', 'fa-bookmark', 'nemo-regex-presets-section');
        const scriptsSection = this.createRegexSection('Scripts', 'fa-code', 'nemo-regex-scripts-section');

        const actionBar = this.getDirectChildContaining(drawerContent, '#open_regex_editor');
        if (actionBar) {
            actionBar.classList.add('nemo-regex-action-bar');
            actionsSection.body.appendChild(actionBar);
        }

        const bulkOperations = this.getDirectChildContaining(drawerContent, '#bulk_select_all_toggle');
        if (bulkOperations) {
            bulkOperations.classList.add('nemo-regex-bulk-bar');
            actionsSection.body.appendChild(bulkOperations);
        }

        this.moveElements(presetsSection.body, [
            this.getDirectChildContaining(drawerContent, '#regex_presets_block'),
        ]);

        const scriptGrid = document.createElement('div');
        scriptGrid.className = 'nemo-regex-script-grid';
        this.moveElements(scriptGrid, [
            this.getDirectChildContaining(drawerContent, '#global_scripts_block'),
            this.getDirectChildContaining(drawerContent, '#preset_scripts_block'),
            this.getDirectChildContaining(drawerContent, '#scoped_scripts_block'),
        ]);
        scriptsSection.body.appendChild(scriptGrid);

        [
            actionsSection.element,
            presetsSection.element,
            scriptsSection.element,
        ].forEach(section => {
            if (section.querySelector('.nemo-regex-card-body')?.children.length) {
                layout.appendChild(section);
            }
        });

        const remainder = Array.from(drawerContent.children);
        if (remainder.length) {
            const advancedSection = this.createRegexSection('Additional Options', 'fa-layer-group', 'nemo-regex-advanced-section');
            this.moveElements(advancedSection.body, remainder);
            layout.appendChild(advancedSection.element);
        }

        drawerContent.appendChild(layout);
    },

    createRegexSection: function(title, icon, className) {
        const element = document.createElement('section');
        element.className = `nemo-regex-card ${className}`;
        element.innerHTML = `
            <div class="nemo-regex-card-header">
                <i class="fa-solid ${icon}"></i>
                <h3>${title}</h3>
            </div>
            <div class="nemo-regex-card-body"></div>
        `;

        return {
            element,
            body: element.querySelector('.nemo-regex-card-body'),
        };
    },

    enhanceTtsSettings: function(extensionElement) {
        const drawerContent = extensionElement.querySelector('#tts_settings > .inline-drawer > .inline-drawer-content');

        if (!drawerContent || drawerContent.dataset.nemoTtsEnhanced === 'true') {
            return;
        }

        drawerContent.dataset.nemoTtsEnhanced = 'true';
        extensionElement.classList.add('nemo-tts-enhanced');
        drawerContent.querySelectorAll(':scope > hr, :scope > br').forEach(separator => separator.remove());

        const layout = document.createElement('div');
        layout.className = 'nemo-tts-settings-layout';

        const providerSection = this.createTtsSection('Provider', 'fa-plug', 'nemo-tts-provider-section');
        const behaviorSection = this.createTtsSection('Behavior', 'fa-sliders', 'nemo-tts-behavior-section');
        const playbackSection = this.createTtsSection('Playback', 'fa-volume-high', 'nemo-tts-playback-section');
        const voiceMapSection = this.createTtsSection('Voice Map', 'fa-users-gear', 'nemo-tts-voicemap-section');
        const providerSettingsSection = this.createTtsSection('Provider Settings', 'fa-microchip', 'nemo-tts-provider-settings-section');

        const providerPicker = document.createElement('div');
        providerPicker.className = 'nemo-tts-provider-picker';
        const providerLabel = Array.from(drawerContent.children).find(element => element.matches('span') && element.textContent.trim().includes('TTS Provider'));
        this.moveElements(providerPicker, [
            drawerContent.querySelector('#tts_status'),
            providerLabel,
            this.getDirectChildContaining(drawerContent, '#tts_provider'),
            this.getDirectChildContaining(drawerContent, '#tts_voices'),
        ]);
        providerSection.body.appendChild(providerPicker);

        const behaviorBlock = this.getDirectChildContaining(drawerContent, '#tts_enabled');
        if (behaviorBlock) {
            behaviorBlock.classList.add('nemo-tts-behavior-grid');
            behaviorSection.body.appendChild(behaviorBlock);
        }

        this.moveElements(playbackSection.body, [
            this.getDirectChildContaining(drawerContent, '#playback_rate_block'),
        ]);

        this.moveElements(voiceMapSection.body, [
            this.getDirectChildContaining(drawerContent, '#tts_voicemap_block'),
        ]);

        this.moveElements(providerSettingsSection.body, [
            this.getDirectChildContaining(drawerContent, '#tts_provider_settings'),
        ]);

        [
            providerSection.element,
            behaviorSection.element,
            playbackSection.element,
            voiceMapSection.element,
            providerSettingsSection.element,
        ].forEach(section => {
            if (section.querySelector('.nemo-tts-card-body')?.children.length) {
                layout.appendChild(section);
            }
        });

        const remainder = Array.from(drawerContent.children);
        if (remainder.length) {
            const advancedSection = this.createTtsSection('Additional Options', 'fa-layer-group', 'nemo-tts-advanced-section');
            this.moveElements(advancedSection.body, remainder);
            layout.appendChild(advancedSection.element);
        }

        drawerContent.appendChild(layout);
    },

    createTtsSection: function(title, icon, className) {
        const element = document.createElement('section');
        element.className = `nemo-tts-card ${className}`;
        element.innerHTML = `
            <div class="nemo-tts-card-header">
                <i class="fa-solid ${icon}"></i>
                <h3>${title}</h3>
            </div>
            <div class="nemo-tts-card-body"></div>
        `;

        return {
            element,
            body: element.querySelector('.nemo-tts-card-body'),
        };
    },

    enhanceVectorSettings: function(extensionElement) {
        const drawerContent = extensionElement.querySelector('.vectors_settings > .inline-drawer > .inline-drawer-content');

        if (!drawerContent || drawerContent.dataset.nemoVectorsEnhanced === 'true') {
            return;
        }

        drawerContent.dataset.nemoVectorsEnhanced = 'true';
        extensionElement.classList.add('nemo-vectors-enhanced');
        drawerContent.querySelectorAll(':scope > hr').forEach(separator => separator.remove());

        const layout = document.createElement('div');
        layout.className = 'nemo-vectors-settings-layout';

        const providerSection = this.createVectorSection('Provider', 'fa-plug', 'nemo-vectors-provider-section');
        const retrievalSection = this.createVectorSection('Retrieval', 'fa-magnifying-glass', 'nemo-vectors-retrieval-section');
        const worldInfoSection = this.createVectorSection('World Info', 'fa-book-atlas', 'nemo-vectors-world-info-section');
        const filesSection = this.createVectorSection('Files', 'fa-file-lines', 'nemo-vectors-files-section');
        const chatSection = this.createVectorSection('Chat', 'fa-comments', 'nemo-vectors-chat-section');

        const providerGrid = document.createElement('div');
        providerGrid.className = 'nemo-vectors-provider-grid';
        this.moveElements(providerGrid, [
            this.getDirectChildContaining(drawerContent, '#vectors_source'),
            ...Array.from(drawerContent.querySelectorAll(':scope > [id$="_vectorsModel"], :scope > #vector_altEndpointUrl, :scope > #nomicai_apiKey')),
        ]);
        providerSection.body.appendChild(providerGrid);

        const retrievalGrid = document.createElement('div');
        retrievalGrid.className = 'nemo-vectors-retrieval-grid';
        this.moveElements(retrievalGrid, [
            this.getDirectChildContaining(drawerContent, '#vectors_query'),
            this.getDirectChildContaining(drawerContent, '#vectors_include_wi'),
        ]);
        retrievalSection.body.appendChild(retrievalGrid);

        this.moveElements(worldInfoSection.body, [
            this.findDirectHeading(drawerContent, 'World Info settings'),
            this.getDirectChildContaining(drawerContent, '#vectors_enabled_world_info'),
            this.getDirectChildContaining(drawerContent, '#vectors_world_info_settings'),
        ]);

        this.moveElements(filesSection.body, [
            this.findDirectHeading(drawerContent, 'File vectorization settings'),
            this.getDirectChildContaining(drawerContent, '#vectors_enabled_files'),
            this.getDirectChildContaining(drawerContent, '#vectors_files_settings'),
        ]);

        this.moveElements(chatSection.body, [
            this.findDirectHeading(drawerContent, 'Chat vectorization settings'),
            this.getDirectChildContaining(drawerContent, '#vectors_enabled_chats'),
            this.getDirectChildContaining(drawerContent, '#vectors_chats_settings'),
        ]);

        [
            providerSection.element,
            retrievalSection.element,
            worldInfoSection.element,
            filesSection.element,
            chatSection.element,
        ].forEach(section => {
            if (section.querySelector('.nemo-vectors-card-body')?.children.length) {
                layout.appendChild(section);
            }
        });

        const remainder = Array.from(drawerContent.children);
        if (remainder.length) {
            const advancedSection = this.createVectorSection('Additional Options', 'fa-layer-group', 'nemo-vectors-advanced-section');
            this.moveElements(advancedSection.body, remainder);
            layout.appendChild(advancedSection.element);
        }

        drawerContent.appendChild(layout);
    },

    createVectorSection: function(title, icon, className) {
        const element = document.createElement('section');
        element.className = `nemo-vectors-card ${className}`;
        element.innerHTML = `
            <div class="nemo-vectors-card-header">
                <i class="fa-solid ${icon}"></i>
                <h3>${title}</h3>
            </div>
            <div class="nemo-vectors-card-body"></div>
        `;

        return {
            element,
            body: element.querySelector('.nemo-vectors-card-body'),
        };
    },

    findDirectHeading: function(parent, text) {
        return Array.from(parent.children).find(element => element.matches('h4') && element.textContent.trim().includes(text)) || null;
    },

    enhanceSummarizeSettings: function(extensionElement) {
        const drawerContent = extensionElement.querySelector('#memory_settings > .inline-drawer:first-child > .inline-drawer-content');
        const summaryContents = extensionElement.querySelector('#summaryExtensionDrawerContents');

        if (!drawerContent || !summaryContents) {
            return;
        }

        extensionElement.classList.add('nemo-memory-enhanced');

        let tabsShell = drawerContent.querySelector('.nemo-memory-tabs-shell');
        let summaryPanel = drawerContent.querySelector('[data-nemo-memory-panel="summary"]');
        let lorePanel = drawerContent.querySelector('[data-nemo-memory-panel="nemolore"]');

        if (!tabsShell) {
            tabsShell = document.createElement('div');
            tabsShell.className = 'nemo-memory-tabs-shell';
            tabsShell.innerHTML = `
                <div class="nemo-memory-tabs" role="tablist" aria-label="Memory settings">
                    <button class="nemo-memory-tab active" type="button" data-nemo-memory-tab="summary" role="tab" aria-selected="true">
                        <i class="fa-solid fa-database"></i>
                        <span>Summarize</span>
                    </button>
                    <button class="nemo-memory-tab" type="button" data-nemo-memory-tab="nemolore" role="tab" aria-selected="false">
                        <i class="fa-solid fa-brain"></i>
                        <span>NemoLore</span>
                    </button>
                </div>
                <div class="nemo-memory-tab-panels">
                    <section class="nemo-memory-panel active" data-nemo-memory-panel="summary" role="tabpanel"></section>
                    <section class="nemo-memory-panel" data-nemo-memory-panel="nemolore" role="tabpanel"></section>
                </div>
            `;
            drawerContent.appendChild(tabsShell);

            summaryPanel = tabsShell.querySelector('[data-nemo-memory-panel="summary"]');
            lorePanel = tabsShell.querySelector('[data-nemo-memory-panel="nemolore"]');
            summaryPanel.appendChild(summaryContents);

            tabsShell.querySelectorAll('.nemo-memory-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    this.activateMemoryTab(tabsShell, tab.dataset.nemoMemoryTab);
                });
            });
        }

        this.enhanceSummaryPanel(summaryPanel);
        this.attachNemoLoreToSummary(lorePanel);
    },

    enhanceSummaryPanel: function(summaryPanel) {
        if (!summaryPanel || summaryPanel.dataset.nemoSummaryEnhanced === 'true') {
            return;
        }

        const summaryContents = summaryPanel.querySelector('#summaryExtensionDrawerContents');
        if (!summaryContents) {
            return;
        }

        summaryPanel.dataset.nemoSummaryEnhanced = 'true';

        const layout = document.createElement('div');
        layout.className = 'nemo-summary-layout';

        const currentSection = this.createMemorySection('Current Summary', 'fa-scroll', 'nemo-summary-current-section');
        const controlsSection = this.createMemorySection('Controls', 'fa-sliders', 'nemo-summary-controls-section');
        const settingsSection = this.createMemorySection('Settings', 'fa-gear', 'nemo-summary-settings-section');

        const memoryContents = summaryContents.querySelector('#memory_contents');
        const memoryHeader = memoryContents?.previousElementSibling;

        this.moveElements(currentSection.body, [
            summaryContents.querySelector('label[for="summary_source"]'),
            summaryContents.querySelector('#summary_source'),
            memoryHeader,
            memoryContents,
        ]);

        this.moveElements(controlsSection.body, Array.from(summaryContents.querySelectorAll(':scope > .memory_contents_controls')));

        const settingsBlock = summaryContents.querySelector('#summarySettingsBlock');
        if (settingsBlock) {
            settingsBlock.style.display = 'block';
            settingsSection.body.appendChild(settingsBlock);
        }

        [
            currentSection.element,
            controlsSection.element,
            settingsSection.element,
        ].forEach(section => {
            if (section.querySelector('.nemo-memory-card-body')?.children.length) {
                layout.appendChild(section);
            }
        });

        const remainder = Array.from(summaryContents.children);
        if (remainder.length) {
            const advancedSection = this.createMemorySection('Additional Options', 'fa-layer-group', 'nemo-summary-advanced-section');
            this.moveElements(advancedSection.body, remainder);
            layout.appendChild(advancedSection.element);
        }

        summaryContents.appendChild(layout);
    },

    createMemorySection: function(title, icon, className) {
        const element = document.createElement('section');
        element.className = `nemo-memory-card ${className}`;
        element.innerHTML = `
            <div class="nemo-memory-card-header">
                <i class="fa-solid ${icon}"></i>
                <h3>${title}</h3>
            </div>
            <div class="nemo-memory-card-body"></div>
        `;

        return {
            element,
            body: element.querySelector('.nemo-memory-card-body'),
        };
    },

    attachNemoLoreToSummary: function(lorePanel) {
        if (!lorePanel) {
            return;
        }

        const loreElement = document.getElementById('nemo_lore_settings');
        const loreTab = lorePanel.closest('.nemo-memory-tabs-shell')?.querySelector('[data-nemo-memory-tab="nemolore"]');

        if (!loreElement) {
            lorePanel.innerHTML = '<div class="nemo-memory-empty">NemoLore settings are not loaded.</div>';
            loreTab?.setAttribute('disabled', 'disabled');
            return;
        }

        loreTab?.removeAttribute('disabled');

        if (loreElement.parentElement !== lorePanel) {
            if (!this.hiddenCompanionExtensions.some(item => item.element === loreElement)) {
                this.hiddenCompanionExtensions.push({
                    element: loreElement,
                    originalParent: loreElement.parentNode,
                    display: loreElement.style.display,
                });
            }

            this.currentCompanionExtensions = this.currentCompanionExtensions.filter(item => item.element !== loreElement);
            this.currentCompanionExtensions.push({
                element: loreElement,
                originalParent: loreElement.parentNode,
                display: loreElement.style.display,
            });
            loreElement.style.display = '';
            lorePanel.innerHTML = '';
            lorePanel.appendChild(loreElement);
        }

        this.enhanceNemoLoreCompanion(loreElement);
    },

    enhanceNemoLoreCompanion: function(loreElement) {
        loreElement.classList.add('nemo-lore-memory-companion');

        const drawerContent = loreElement.querySelector(':scope > .inline-drawer > .inline-drawer-content');
        if (drawerContent) {
            drawerContent.style.display = 'block';
        }
    },

    activateMemoryTab: function(tabsShell, tabName) {
        tabsShell.querySelectorAll('.nemo-memory-tab').forEach(tab => {
            const isActive = tab.dataset.nemoMemoryTab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });

        tabsShell.querySelectorAll('.nemo-memory-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.nemoMemoryPanel === tabName);
        });
    },

    moveElements: function(target, elements) {
        const seen = new Set();

        elements.filter(Boolean).forEach(element => {
            if (seen.has(element)) {
                return;
            }
            seen.add(element);
            target.appendChild(element);
        });
    },

    getDirectChildContaining: function(parent, selector) {
        const element = parent.querySelector(selector);
        if (!element) {
            return null;
        }

        return Array.from(parent.children).find(child => child === element || child.contains(element)) || null;
    },

    collectSiblingRange: function(startElement, endElement) {
        const elements = [];
        let current = startElement;

        while (current && current !== endElement) {
            elements.push(current);
            current = current.nextElementSibling;
        }

        return elements;
    },

    closeFullScreen: function() {
        const overlay = document.getElementById('nemo-tab-extension-overlay');
        overlay.classList.remove('active');
        
        // Restore the extension element to its original location
        if (this.currentExtension && this.currentExtension.element) {
            const extensionElement = this.currentExtension.element;
            const originalParent = this.currentExtension.originalParent;

            if (originalParent && originalParent.parentNode) {
                originalParent.appendChild(extensionElement);

                // Hide the element again (since we hid all extensions in createEnhancedInterface)
                extensionElement.style.display = 'none';

                // If it was a drawer, restore proper state
                if (extensionElement.querySelector('.inline-drawer-content')) {
                    const drawerContent = extensionElement.querySelector('.inline-drawer-content');
                    drawerContent.style.display = 'none'; // Close drawer by default
                }
            }
        }

        this.currentCompanionExtensions.forEach(companion => {
            if (companion.originalParent && companion.originalParent.parentNode && companion.element) {
                companion.originalParent.appendChild(companion.element);
                companion.element.style.display = companion.display ?? 'none';
            }
        });
        this.currentCompanionExtensions = [];
        
        // Show the main extension interface again
        this.showMainInterface();

        // Force save any pending changes
        this.saveSettings();
        
        this.currentView = 'main';
        this.currentExtension = null;
    },

    hideMainInterface: function() {
        // Hide the specific elements we created for the card interface
        const controls = document.querySelector('.nemo-folder-controls');
        const search = document.querySelector('.nemo-extensions-search');
        const layout = document.querySelector('.nemo-extensions-layout');
        
        if (controls) controls.style.display = 'none';
        if (search) search.style.display = 'none';
        if (layout) layout.style.display = 'none';
    },

    showMainInterface: function() {
        // Show the card interface elements again
        const controls = document.querySelector('.nemo-folder-controls');
        const search = document.querySelector('.nemo-extensions-search');
        const layout = document.querySelector('.nemo-extensions-layout');
        
        if (controls) controls.style.display = '';
        if (search) search.style.display = '';
        if (layout) layout.style.display = '';
    },

    promptForCustomFolder: function() {
        const folderName = prompt('Enter custom folder name:');
        if (folderName && folderName.trim()) {
            const cleanName = folderName.trim();
            if (!this.customFolders[cleanName] && !this.defaultCategories[cleanName]) {
                this.customFolders[cleanName] = [];
                this.saveSettings();

                // Add the new folder to the interface without breaking layout
                this.addCustomFolderToInterface(cleanName);
            } else {
                alert('A folder with that name already exists!');
            }
        }
    },

    addCustomFolderToInterface: function(folderName) {
        // Find the layout container
        const layoutContainer = document.querySelector('.nemo-extensions-layout');
        if (!layoutContainer) return;
        
        const leftColumn = layoutContainer.children[0];
        const rightColumn = layoutContainer.children[1];
        
        // Create empty folder
        const folder = this.createFolder(folderName, []);
        
        // Add to appropriate column based on current distribution
        const leftFolders = leftColumn.children.length;
        const rightFolders = rightColumn.children.length;
        
        if (leftFolders <= rightFolders) {
            leftColumn.appendChild(folder);
        } else {
            rightColumn.appendChild(folder);
        }
    },

    confirmDeleteCustomFolder: function(folderName) {
        // Check if it's actually a custom folder
        if (!this.customFolders.hasOwnProperty(folderName)) {
            return;
        }

        // Count extensions in this folder
        const extensionsInFolder = Object.values(this.extensionTags).filter(tag => tag === folderName).length;
        
        let message = `Are you sure you want to delete the custom folder "${folderName}"?`;
        if (extensionsInFolder > 0) {
            message += `\n\nThis folder contains ${extensionsInFolder} extension${extensionsInFolder > 1 ? 's' : ''}. `;
            message += 'These extensions will be moved back to their default categories.';
        }
        message += '\n\nThis action cannot be undone.';

        if (confirm(message)) {
            this.deleteCustomFolder(folderName);
        }
    },

    deleteCustomFolder: function(folderName) {
        // Move all extensions out of this folder back to default categories
        const extensionsToReassign = [];
        for (const [extensionId, assignedFolder] of Object.entries(this.extensionTags)) {
            if (assignedFolder === folderName) {
                extensionsToReassign.push(extensionId);
                delete this.extensionTags[extensionId];
            }
        }

        // Remove the folder from custom folders
        delete this.customFolders[folderName];

        // Save settings
        this.saveSettings();

        // Refresh the interface to reflect changes
        this.refreshInterface();

        // Show success message
        this.showNotification(`Custom folder "${folderName}" deleted successfully. ${extensionsToReassign.length > 0 ? `${extensionsToReassign.length} extension${extensionsToReassign.length > 1 ? 's' : ''} moved to default categories.` : ''}`, 'success');
    },

    showNotification: function(message, type = 'info') {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            max-width: 350px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            font-size: 14px;
            line-height: 1.4;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 4000);
    },

    setupContextMenu: function() {
        const menu = document.createElement('div');
        menu.id = 'nemo-extension-context-menu';
        menu.className = 'nemo-context-menu';
        menu.innerHTML = `
            <div class="nemo-context-menu-item" data-action="move-to-folder">
                <i class="fa-solid fa-folder"></i>
                Move to Folder
            </div>
            <div class="nemo-context-menu-separator"></div>
            <div class="nemo-context-menu-item" data-action="remove-from-folder">
                <i class="fa-solid fa-folder-minus"></i>
                Remove from Custom Folders
            </div>
        `;
        document.body.appendChild(menu);
        
        // Context menu clicks
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.nemo-context-menu-item');
            if (item) {
                const action = item.dataset.action;
                this.handleContextAction(action, this._contextMenuTarget);
                this.hideContextMenu();
            }
        });
    },

    showContextMenu: function(card, x, y) {
        const menu = document.getElementById('nemo-extension-context-menu');
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
        this._contextMenuTarget = card;
    },

    hideContextMenu: function() {
        const menu = document.getElementById('nemo-extension-context-menu');
        if (menu) {
            menu.style.display = 'none';
        }
    },

    handleContextAction: function(action, card) {
        const extensionId = card.dataset.extensionId;
        
        switch (action) {
            case 'move-to-folder':
                this.showFolderSelectionDialog(extensionId);
                break;
            case 'remove-from-folder':
                // Remove from custom folders (keep in default categories)
                delete this.extensionTags[extensionId];
                this.saveSettings();
                this.refreshInterface();
                break;
        }
    },

    showFolderSelectionDialog: function(extensionId) {
        // Create a better dialog than prompt() for folder selection
        const dialog = document.createElement('div');
        dialog.className = 'nemo-folder-selection-dialog';
        dialog.innerHTML = `
            <div class="nemo-dialog-overlay">
                <div class="nemo-dialog-content">
                    <div class="nemo-dialog-header">
                        <h3>Move Extension to Folder</h3>
                        <button class="nemo-dialog-close">&times;</button>
                    </div>
                    <div class="nemo-dialog-body">
                        <p>Select a folder for this extension:</p>
                        <div class="nemo-folder-list">
                            ${this.createFolderOptionsList(extensionId)}
                        </div>
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--nemo-border-color);">
                            <button class="nemo-btn-secondary" id="nemo-create-new-folder">
                                <i class="fa-solid fa-plus"></i> Create New Folder
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Add event listeners
        dialog.querySelector('.nemo-dialog-close').addEventListener('click', () => {
            dialog.remove();
        });
        
        dialog.querySelector('.nemo-dialog-overlay').addEventListener('click', (e) => {
            if (e.target === dialog.querySelector('.nemo-dialog-overlay')) {
                dialog.remove();
            }
        });
        
        dialog.querySelector('#nemo-create-new-folder').addEventListener('click', () => {
            const newFolderName = prompt('Enter new folder name:');
            if (newFolderName && newFolderName.trim()) {
                const cleanName = newFolderName.trim();
                if (!this.customFolders[cleanName] && !this.defaultCategories[cleanName]) {
                    this.customFolders[cleanName] = [];
                    this.extensionTags[extensionId] = cleanName;
                    this.saveSettings();
                    this.refreshInterface();
                    dialog.remove();
                } else {
                    alert('A folder with that name already exists!');
                }
            }
        });
        
        // Folder option clicks
        dialog.querySelectorAll('.nemo-folder-option').forEach(option => {
            option.addEventListener('click', () => {
                const folderName = option.dataset.folderName;

                if (folderName === 'default') {
                    // Remove from custom folders - let it go back to default category
                    delete this.extensionTags[extensionId];
                } else {
                    // Move to selected folder
                    this.extensionTags[extensionId] = folderName;
                }

                this.saveSettings();
                this.refreshInterface();
                dialog.remove();
            });
        });
    },

    createFolderOptionsList: function(extensionId) {
        const currentFolder = this.extensionTags[extensionId];
        const allFolders = [
            ...Object.keys(this.defaultCategories),
            ...Object.keys(this.customFolders)
        ];
        
        let html = `<div class="nemo-folder-option ${!currentFolder ? 'selected' : ''}" data-folder-name="default">
            <i class="fa-solid fa-home"></i>
            <span>Default Category</span>
            ${!currentFolder ? '<i class="fa-solid fa-check"></i>' : ''}
        </div>`;
        
        allFolders.forEach(folder => {
            const isCustom = this.customFolders.hasOwnProperty(folder);
            const isSelected = currentFolder === folder;
            html += `
                <div class="nemo-folder-option ${isSelected ? 'selected' : ''}" data-folder-name="${folder}">
                    <i class="fa-solid fa-${isCustom ? 'folder-plus' : 'folder'}"></i>
                    <span>${folder}</span>
                    ${isCustom ? '<span class="nemo-custom-badge">Custom</span>' : ''}
                    ${isSelected ? '<i class="fa-solid fa-check"></i>' : ''}
                </div>
            `;
        });
        
        return html;
    },

    addSearchHandler: function() {
        const searchInput = document.getElementById('nemo-extensions-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.applySearchFilter(e.target.value);
            });
        }
    },

    applySearchFilter: function(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const folders = document.querySelectorAll('.nemo-extension-category-drawer');

        folders.forEach(folder => {
            let hasVisibleExtension = false;
            const cards = folder.querySelectorAll('.nemo-extension-card');
            
            cards.forEach(card => {
                const title = card.querySelector('.nemo-card-title').textContent.toLowerCase();
                const folderBadges = Array.from(card.querySelectorAll('.nemo-folder-badge')).map(badge => badge.textContent.toLowerCase());
                const allText = [title, ...folderBadges].join(' ');
                
                if (allText.includes(term)) {
                    card.style.display = '';
                    hasVisibleExtension = true;
                } else {
                    card.style.display = 'none';
                }
            });

            folder.style.display = hasVisibleExtension ? '' : 'none';
            
            // Open folder if it has visible extensions and search term exists
            if (hasVisibleExtension && term) {
                const content = folder.querySelector('.inline-drawer-content');
                const icon = folder.querySelector('.inline-drawer-icon');
                content.style.display = 'block';
                icon.classList.remove('down');
                icon.classList.add('up');
            }
        });
    },

    refreshInterface: function() {
        // Check if the interface exists before trying to refresh
        const layoutContainer = document.querySelector('.nemo-extensions-layout');
        if (!layoutContainer) {
            return;
        }

        this.reorganizeExtensions();
    },

    reorganizeExtensions: function() {
        // Get the current layout container
        const layoutContainer = document.querySelector('.nemo-extensions-layout');
        if (!layoutContainer) {
            return;
        }

        // Get all extension cards BEFORE clearing anything
        const allExtensionCards = document.querySelectorAll('.nemo-extension-card');
        const extensions = [];

        // Rebuild extension data from existing cards
        allExtensionCards.forEach(card => {
            const extensionId = card.dataset.extensionId;
            const extensionData = card._extensionData;

            if (extensionId && extensionData) {
                extensions.push({
                    id: extensionId,
                    element: extensionData.element,
                    title: extensionData.title,
                    originalParent: extensionData.originalParent
                });
            }
        });

        if (extensions.length === 0) {
            // Fall back to using the originally stored extensions
            if (this.originalExtensions && this.originalExtensions.length > 0) {
                const fallbackExtensions = this.originalExtensions.map(orig => ({
                    id: orig.element.id,
                    element: orig.element,
                    title: this.getExtensionTitle(orig.element),
                    originalParent: orig.originalParent
                }));
                extensions.push(...fallbackExtensions);
            }
        }

        if (extensions.length === 0) {
            return;
        }

        const leftColumn = layoutContainer.children[0];
        const rightColumn = layoutContainer.children[1];
        
        // Clear existing folders but keep the columns
        leftColumn.innerHTML = '';
        rightColumn.innerHTML = '';
        
        // Group extensions based on current folder assignments
        const groupedExtensions = this.groupExtensions(extensions);
        const allCategories = [...Object.keys(this.defaultCategories), ...Object.keys(this.customFolders), 'Other'];
        
        // Recreate folders with updated organization
        allCategories.forEach((category, index) => {
            const hasExtensions = groupedExtensions[category] && groupedExtensions[category].length > 0;
            const isCustomFolder = this.customFolders.hasOwnProperty(category);
            
            // Show folder if it has extensions OR if it's a custom folder (even if empty)
            if (hasExtensions || isCustomFolder) {
                const folder = this.createFolder(category, groupedExtensions[category] || []);
                
                if (index % 2 === 0) {
                    leftColumn.appendChild(folder);
                } else {
                    rightColumn.appendChild(folder);
                }
            }
        });
    },
    
    getExtensionTitle: function(element) {
        const titleElement = element.querySelector('.inline-drawer-header b, h4, .extension-name, [data-extension-name]');
        if (titleElement) {
            return titleElement.textContent.trim();
        } else if (element.dataset.extensionName) {
            return element.dataset.extensionName;
        } else if (element.id) {
            return element.id.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        return 'Unknown Extension';
    },

    cleanup: function() {
        // Disconnect the duplicate-detector observer so it stops firing
        if (this._dupObserver) {
            this._dupObserver.disconnect();
            this._dupObserver = null;
        }

        // Abort document-level click/contextmenu listeners
        if (this._listenerCtrl) {
            this._listenerCtrl.abort();
            this._listenerCtrl = null;
        }

        // First, make sure we're showing the main interface
        this.showMainInterface();

        // Close any open extension view and restore elements properly
        if (this.currentView === 'extension') {
            this.closeFullScreen();
        }

        // Remove our custom elements
        const overlay = document.getElementById('nemo-tab-extension-overlay');
        if (overlay) {
            overlay.remove();
        }

        const contextMenu = document.getElementById('nemo-extension-context-menu');
        if (contextMenu) {
            contextMenu.remove();
        }

        // Restore original extensions to their containers
        const settings1 = document.getElementById('extensions_settings');
        const settings2 = document.getElementById('extensions_settings2');

        // COMPLETELY clear settings1 content first
        if (settings1) {
            settings1.innerHTML = '';
            // Remove the data attribute that marks it as grouped
            settings1.removeAttribute('data-nemo-grouped');
        }

        // Restore settings2 visibility and clear it too
        if (settings2) {
            settings2.style.display = '';
            settings2.innerHTML = '';
        }

        // Restore original extension elements to their proper containers
        this.originalExtensions.forEach(({ element, originalParent }) => {
            // Determine target container
            let targetContainer = settings1; // Default to settings1
            if (originalParent && originalParent.id === 'extensions_settings2') {
                targetContainer = settings2;
            }

            // Restore the extension element
            if (targetContainer && element) {
                targetContainer.appendChild(element);
            }
        });

        this.hiddenCompanionExtensions.forEach(({ element, originalParent, display }) => {
            let targetContainer = settings1;
            if (originalParent && originalParent.id === 'extensions_settings2') {
                targetContainer = settings2;
            }

            if (targetContainer && element) {
                targetContainer.appendChild(element);
                element.style.display = display ?? '';
            }
        });

        this.initialized = false;
        this.currentView = 'main';
        this.currentExtension = null;
        this.originalExtensions = [];
        this.hiddenCompanionExtensions = [];
        this.currentCompanionExtensions = [];

        // Ensure the disabled state is persisted
        this.saveSettings();
    }
};
