// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - Main Entry Point
// Universal HTML/JS renderer that works transparently with any AI-generated code

import { extension_settings } from '../../../../../extensions.js';
import { saveSettingsDebounced, eventSource, event_types } from '../../../../../../script.js';
import { UniversalRenderer } from './core/UniversalRenderer.js';
import { AssetPackSystem } from './core/AssetPackSystem.js';
import { AssetPackManager } from './core/AssetPackManager.js';
import { AssetPackCreator } from './ui/AssetPackCreator.js';

const MODULE_NAME = 'Ember';

class Ember2Extension {
    constructor() {
        this.universalRenderer = new UniversalRenderer();
        this.assetPackSystem = new AssetPackSystem();
        this.assetPackManager = new AssetPackManager();
        this.assetPackCreator = new AssetPackCreator();
        this.activeAssetPacks = new Map(); // Track active asset packs for context injection

        this.settings = {
            enabled: true,
            autoDetect: true,
            alwaysRender: true,
            debugMode: false,
            assetPacks: []
        };

        this.activeRenders = new Map();
    }

    /**
     * Load Ember CSS dynamically
     */
    loadCSS() {
        const cssPath = 'scripts/extensions/third-party/NemoPresetExt/features/ember/style.css';

        // Check if CSS is already loaded
        if (document.querySelector(`link[href="${cssPath}"]`)) {
            console.log('[Ember 2.0] CSS already loaded');
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = cssPath;
        document.head.appendChild(link);
        console.log('[Ember 2.0] CSS loaded successfully');
    }

    /**
     * Initialize the extension
     */
    async initialize() {
        console.log('[Ember 2.0] Initializing...');

        try {
            // Load CSS first
            this.loadCSS();

            // Load settings
            this.loadSettings();

            // Initialize core systems
            await this.initializeSystems();

            // Set up event listeners
            await this.setupEventListeners();

            // Set up message handling
            this.setupMessageHandling();

            // Set up context injection for active asset packs
            this.setupContextInjection();

            // NOTE: UI initialization is handled by NemoPresetExt settings system
            // await this.initializeUI();

            // Load saved asset packs
            await this.assetPackManager.loadPacks();

            // Load built-in templates
            await this.loadBuiltinTemplates();

            console.log('[Ember 2.0] Successfully initialized!');

            // Expose API globally for external access
            window.ember = {
                assetPackSystem: this.assetPackSystem,
                assetPackManager: this.assetPackManager,
                universalRenderer: this.universalRenderer,
                assetPackCreator: this.assetPackCreator,
                settings: this.settings,

                // Asset pack convenience methods
                registerAssetPack: (assetPackData) => this.universalRenderer.registerAssetPack(assetPackData),
                renderAssetPack: (packId, messageId, messageElement, position) =>
                    this.universalRenderer.renderAssetPack(packId, messageId, messageElement, position),
                getAssetPackState: (messageId) => this.universalRenderer.getAssetPackStateForInjection(messageId),

                // UI methods
                openAssetPackCreator: (existingPack) => this.assetPackCreator.open(existingPack)
            };

        } catch (error) {
            console.error('[Ember 2.0] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize core systems
     */
    async initializeSystems() {
        // Set up message passing for universal renderer
        window.addEventListener('message', (event) => {
            this.universalRenderer.handleMessage(event);
        });

        console.log('[Ember 2.0] Universal renderer initialized - will detect and run ANY code automatically');
    }

    /**
     * Wait for SillyTavern context to be available
     */
    async waitForSillyTavern(maxWaitTime = 10000) {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            // Check multiple possible patterns
            if ((window.SillyTavern?.eventSource && window.SillyTavern?.event_types) ||
                (window.eventSource && window.event_types)) {
                console.log('[Ember 2.0] SillyTavern context found');
                return true;
            }

            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.warn('[Ember 2.0] Timed out waiting for SillyTavern context');
        return false;
    }

    /**
     * Set up event listeners
     */
    async setupEventListeners() {
        // Use the imported eventSource and event_types from script.js
        console.log('[Ember 2.0] Event system detection:');
        console.log('- eventSource:', typeof eventSource, !!eventSource);
        console.log('- event_types:', typeof event_types, !!event_types);

        // Wait a bit for events to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!eventSource || !event_types) {
            console.error('[Ember 2.0] Event system not available from imports');
            // Try to access through window as fallback
            if (window.eventSource && window.event_types) {
                console.log('[Ember 2.0] Using window fallback for event system');
            } else {
                console.log('[Ember 2.0] Searching for event system...');

                // Check if events module is available globally
                if (typeof window.eventemitter !== 'undefined') {
                    console.log('[Ember 2.0] Found eventemitter on window');
                }

                // Try importing or accessing through different methods
                try {
                    // Check if we can find the event emitter through DOM or other means
                    const scripts = document.querySelectorAll('script');
                    console.log('[Ember 2.0] Loaded scripts:', scripts.length);
                } catch (e) {
                    console.log('[Ember 2.0] Error checking scripts:', e);
                }
            }
        }

        if (!eventSource || !event_types) {
            console.log('[Ember 2.0] SillyTavern event system not available, using alternative approach');
            this.setupAlternativeListeners();
            return;
        }

        // Message rendering events
        eventSource.on(event_types.USER_MESSAGE_RENDERED, (messageId) => {
            this.handleMessageRender(messageId, true);
        });

        eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
            this.handleMessageRender(messageId, false);
        });

        // Message change events - ENHANCED SUPPORT!
        eventSource.on(event_types.MESSAGE_EDITED, (messageId) => {
            this.handleMessageEdit(messageId);
        });

        eventSource.on(event_types.MESSAGE_UPDATED, (messageId) => {
            this.handleMessageUpdate(messageId);
        });

        // MISSING SWIPE EVENT - ADD THIS!
        eventSource.on(event_types.MESSAGE_SWIPED, (messageId) => {
            this.handleMessageSwipe(messageId);
        });

        // Optional: Additional useful events
        eventSource.on(event_types.MESSAGE_DELETED, (messageId) => {
            this.handleMessageDelete(messageId);
        });

        // Chat events
        eventSource.on(event_types.CHAT_LOADED, () => {
            this.processExistingMessages();
        });

        eventSource.on(event_types.CHAT_CHANGED, () => {
            this.cleanup();
            this.processExistingMessages();
        });

        console.log('[Ember 2.0] Event listeners set up with MESSAGE_SWIPED support');
    }

    /**
     * Set up proper event listeners using SillyTavern's event system
     * Replaces console hijacking with proper event handling
     */
    setupAlternativeListeners() {
        console.log('[Ember 2.0] Setting up message event listeners');

        // Check if event system is available
        if (!eventSource || !event_types) {
            console.warn('[Ember 2.0] Event system not available, will retry...');
            setTimeout(() => this.setupAlternativeListeners(), 1000);
            return;
        }

        // Listen for character messages
        if (event_types.CHARACTER_MESSAGE_RENDERED) {
            eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
                console.log(`[Ember 2.0] Character message rendered: ${messageId}`);
                setTimeout(() => {
                    window.Ember2.handleMessageRender(messageId, false);
                }, 100);
            });
            console.log('[Ember 2.0] ✅ Registered CHARACTER_MESSAGE_RENDERED event');
        }

        // Listen for user messages
        if (event_types.USER_MESSAGE_RENDERED) {
            eventSource.on(event_types.USER_MESSAGE_RENDERED, (messageId) => {
                console.log(`[Ember 2.0] User message rendered: ${messageId}`);
                setTimeout(() => {
                    window.Ember2.handleMessageRender(messageId, true);
                }, 100);
            });
            console.log('[Ember 2.0] ✅ Registered USER_MESSAGE_RENDERED event');
        }

        // Setup swipe listeners for swipe detection
        this.setupSwipeClickListeners();

        // Process existing messages on startup
        setTimeout(() => this.processExistingMessages(), 500);

        console.log('[Ember 2.0] ✅ Event listeners configured successfully');
    }

    /**
     * Setup click listeners for swipe buttons - NEW METHOD
     */
    setupSwipeClickListeners() {
        // Swipe detection with single processing call (the method handles timing internally)
        $(document).on('click', '.swipe_right', (event) => {
            console.log('[Ember 2.0] Swipe right clicked');
            const messageElement = $(event.target).closest('.mes');
            const messageId = Number(messageElement.attr('mesid'));
            if (!isNaN(messageId)) {
                console.log(`[Ember 2.0] Detected swipe right on message ${messageId}`);
                this.handleMessageSwipe(messageId);
            }
        });

        $(document).on('click', '.swipe_left', (event) => {
            console.log('[Ember 2.0] Swipe left clicked');
            const messageElement = $(event.target).closest('.mes');
            const messageId = Number(messageElement.attr('mesid'));
            if (!isNaN(messageId)) {
                console.log(`[Ember 2.0] Detected swipe left on message ${messageId}`);
                this.handleMessageSwipe(messageId);
            }
        });

        // Also listen for message edit completion
        $(document).on('click', '.mes_edit_done', (event) => {
            console.log('[Ember 2.0] Edit done clicked');
            const messageElement = $(event.target).closest('.mes');
            const messageId = Number(messageElement.attr('mesid'));
            if (!isNaN(messageId)) {
                console.log(`[Ember 2.0] Detected message edit completion on message ${messageId}`);
                setTimeout(() => this.handleMessageEdit(messageId), 150);
                setTimeout(() => this.handleMessageEdit(messageId), 400);
            }
        });

        // Additional DOM mutation observer for content changes
        this.setupContentChangeObserver();

        console.log('[Ember 2.0] Enhanced swipe and edit click listeners set up');
    }

    /**
     * Setup observer for content changes - NEW METHOD
     */
    setupContentChangeObserver() {
        const chatContainer = document.querySelector('#chat');
        if (!chatContainer) return;

        // Observer specifically for text content changes in messages
        const contentObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    // Check if this is a message text area that changed
                    const messageElement = mutation.target.closest?.('.mes') ||
                                         (mutation.target.parentNode?.closest ? mutation.target.parentNode.closest('.mes') : null);

                    if (messageElement) {
                        const messageId = Number(messageElement.getAttribute('mesid'));
                        if (!isNaN(messageId)) {
                            // Check if message has code content and isn't already processed
                            const mesText = messageElement.querySelector('.mes_text');
                            if (mesText && !mesText.dataset.emberLastProcessed) {
                                console.log(`[Ember 2.0] Content change detected in message ${messageId}`);

                                // Debounce processing
                                clearTimeout(this.contentChangeTimers?.[messageId]);
                                if (!this.contentChangeTimers) this.contentChangeTimers = {};

                                this.contentChangeTimers[messageId] = setTimeout(() => {
                                    const currentContent = mesText.textContent || mesText.innerText || '';
                                    if (currentContent !== mesText.dataset.emberLastContent) {
                                        console.log(`[Ember 2.0] Processing content change in message ${messageId}`);
                                        mesText.dataset.emberLastContent = currentContent;
                                        mesText.dataset.emberLastProcessed = Date.now();
                                        this.handleMessageSwipe(messageId);
                                    }
                                }, 200);
                            }
                        }
                    }
                }
            });
        });

        contentObserver.observe(chatContainer, {
            childList: true,
            subtree: true,
            characterData: true
        });

        console.log('[Ember 2.0] Content change observer set up');
    }

    /**
     * Set up message handling - now completely automatic
     */
    setupMessageHandling() {
        // No specific processors needed - UniversalRenderer handles everything
        console.log('[Ember 2.0] Universal message handling enabled - any code will be detected and executed');
    }

    /**
     * Handle message rendering - now completely automatic and transparent
     */
    async handleMessageRender(messageId, isUser) {
        if (!this.settings.enabled) return;

        try {
            const messageElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
            if (!messageElement) return;

            // Skip if already processed (with timestamp check to avoid stuck states)
            const lastProcessed = messageElement.dataset.ember2Processed;
            const now = Date.now();

            if (lastProcessed && (now - parseInt(lastProcessed)) < 1000) {
                console.log(`[Ember 2.0] Message ${messageId} recently processed, skipping`);
                return;
            }

            // Check if there are already ember containers to prevent duplicates
            const existingContainers = messageElement.querySelectorAll('.ember-html-document-container, .ember-sandbox-container, .ember-html-container');
            if (existingContainers.length > 0) {
                console.log(`[Ember 2.0] Message ${messageId} already has ${existingContainers.length} ember containers, skipping`);
                return;
            }

            // Get message content
            const context = window.SillyTavern?.getContext?.() || window.getContext?.();
            if (!context?.chat) return;

            const messageData = context.chat[messageId];
            if (!messageData) return;

            const content = messageData.mes;

            // Mark as being processed with timestamp
            messageElement.dataset.ember2Processed = now.toString();

            console.log(`[Ember 2.0] Processing message ${messageId} with content length: ${content.length}`);

            // Try to render with universal renderer - it will auto-detect everything
            const success = await this.universalRenderer.renderContentWithAssetPacks(messageId, messageElement, content);

            if (success) {
                console.log(`[Ember 2.0] Successfully auto-rendered content in message ${messageId}`);

                // Parse AI response for asset pack state updates if this is a character message
                if (!isUser) {
                    this.universalRenderer.parseAIResponse(content, messageId);
                }
            } else {
                // Even if no content was rendered, we should still clean AI responses of STATE_UPDATE tags
                if (!isUser && this.activeAssetPacks.size > 0) {
                    console.log(`[Ember 2.0] Cleaning STATE_UPDATE tags from message ${messageId}`);
                    this.universalRenderer.processAndCleanAIResponse(messageId);
                }

                // Reset flag if rendering failed
                delete messageElement.dataset.ember2Processed;
            }

        } catch (error) {
            console.error(`[Ember 2.0] Error processing message ${messageId}:`, error);
            // Reset flag on error
            const messageElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
            if (messageElement) {
                delete messageElement.dataset.ember2Processed;
            }
        }
    }

    /**
     * Handle message edit - cleanup and re-process
     */
    async handleMessageEdit(messageId) {
        console.log(`[Ember 2.0] Message ${messageId} edited, cleaning up`);

        // Cleanup previous render
        this.universalRenderer.cleanup(messageId);
        this.activeRenders.delete(messageId);

        // Get the actual message element and reset processing flag
        const messageElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
        if (messageElement) {
            delete messageElement.dataset.ember2Processed;
        }

        // Re-process with multiple attempts
        const attemptReprocess = (delay) => {
            setTimeout(() => {
                const context = window.SillyTavern?.getContext?.() || window.getContext?.();
                if (context?.chat) {
                    const messageData = context.chat[messageId];
                    if (messageData) {
                        console.log(`[Ember 2.0] Re-processing edited message ${messageId} after ${delay}ms delay`);
                        this.handleMessageRender(messageId, messageData.is_user);
                    }
                }
            }, delay);
        };

        attemptReprocess(100);
        attemptReprocess(300);
    }

    /**
     * Handle message swipe - IMPROVED METHOD
     */
    async handleMessageSwipe(messageId) {
        console.log(`[Ember 2.0] Message ${messageId} swiped, setting up content watcher`);

        // Cleanup previous render for this message
        this.universalRenderer.cleanup(messageId);
        this.activeRenders.delete(messageId);

        // Get the actual message element
        const messageElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
        if (!messageElement) {
            console.log(`[Ember 2.0] Message element ${messageId} not found for swipe`);
            return;
        }

        // Store current content to detect changes
        const initialContent = messageElement.textContent || messageElement.innerText || '';

        // Reset processing flag
        delete messageElement.dataset.ember2Processed;

        // Create a content watcher that waits for the message to actually change
        let attempts = 0;
        const maxAttempts = 20; // 4 seconds total

        const contentWatcher = () => {
            attempts++;
            const currentContent = messageElement.textContent || messageElement.innerText || '';

            console.log(`[Ember 2.0] Swipe watcher attempt ${attempts} for message ${messageId}`);

            // Check if content has changed and has some substance
            if (currentContent !== initialContent && currentContent.length > 10) {
                console.log(`[Ember 2.0] Content changed detected for message ${messageId}, processing`);

                // Only process once the content has actually changed
                const context = window.SillyTavern?.getContext?.() || window.getContext?.();
                if (context?.chat && context.chat[messageId]) {
                    const isUser = context.chat[messageId].is_user;
                    this.handleMessageRender(messageId, isUser);
                }
                return; // Stop watching
            }

            // Keep watching if content hasn't changed yet
            if (attempts < maxAttempts) {
                setTimeout(contentWatcher, 200);
            } else {
                console.log(`[Ember 2.0] Swipe watcher timed out for message ${messageId}`);
            }
        };

        // Start watching for content changes
        setTimeout(contentWatcher, 200);
    }

    /**
     * Handle message update - NEW METHOD
     */
    async handleMessageUpdate(messageId) {
        console.log(`[Ember 2.0] Message ${messageId} updated, re-processing`);

        // Similar to edit handling
        this.universalRenderer.cleanup(messageId);
        this.activeRenders.delete(messageId);

        setTimeout(() => {
            const context = window.SillyTavern?.getContext?.() || window.getContext?.();
            if (context?.chat && context.chat[messageId]) {
                const isUser = context.chat[messageId].is_user;
                this.handleMessageRender(messageId, isUser);
            }
        }, 100);
    }

    /**
     * Handle message delete - NEW METHOD
     */
    async handleMessageDelete(messageId) {
        console.log(`[Ember 2.0] Message ${messageId} deleted, cleaning up`);

        this.universalRenderer.cleanup(messageId);
        this.activeRenders.delete(messageId);
    }

    /**
     * Process existing messages in chat
     */
    processExistingMessages() {
        console.log('[Ember 2.0] Processing existing messages');

        const context = window.SillyTavern?.getContext?.() || window.getContext?.();
        if (!context?.chat) return;

        const messages = document.querySelectorAll('#chat .mes');
        for (const messageElement of messages) {
            const messageId = Number(messageElement.getAttribute('mesid'));
            const messageData = context.chat[messageId];

            if (messageData) {
                this.handleMessageRender(messageId, messageData.is_user);
            }
        }
    }

    /**
     * Initialize UI and settings
     */
    async initializeUI() {
        try {
            // Load settings HTML
            const settingsHtml = await this.loadSettingsHtml();
            $('#extensions_settings').append(settingsHtml);

            // Bind settings events
            this.bindSettingsEvents();

            console.log('[Ember 2.0] UI initialized');

        } catch (error) {
            console.error('[Ember 2.0] Failed to initialize UI:', error);
        }
    }

    /**
     * Load settings HTML
     */
    async loadSettingsHtml() {
        const settingsPath = `scripts/extensions/third-party/${MODULE_NAME}/settings.html`;
        const response = await fetch(settingsPath);

        if (!response.ok) {
            throw new Error(`Failed to load settings: ${response.status}`);
        }

        return await response.text();
    }

    /**
     * Bind settings events
     */
    bindSettingsEvents() {
        // Main settings
        $('#ember2-enabled').on('change', () => {
            this.settings.enabled = $('#ember2-enabled').is(':checked');
            this.saveSettings();
        });

        $('#ember2-auto-detect').on('change', () => {
            this.settings.autoDetect = $('#ember2-auto-detect').is(':checked');
            this.saveSettings();
        });

        // Asset pack management
        $('#ember2-pack-creator').on('click', () => {
            this.assetPackCreator.open();
        });

        $('#ember2-import-pack').on('click', () => {
            this.showImportDialog();
        });

        $('#ember2-create-pack').on('click', () => {
            this.showCreateDialog();
        });

        $('#ember2-pack-library').on('click', () => {
            this.showPackLibrary();
        });

        console.log('[Ember 2.0] Settings events bound');
    }

    /**
     * Show import dialog
     */
    showImportDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.js,.json,.zip';
        input.multiple = true;

        input.addEventListener('change', async (event) => {
            const files = event.target.files;
            for (const file of files) {
                try {
                    const pack = await this.assetPackManager.importPack(file, 'file');
                    console.log(`[Ember 2.0] Successfully imported pack: ${pack.id}`);
                    this.updatePackLibrary();
                } catch (error) {
                    console.error(`[Ember 2.0] Failed to import ${file.name}:`, error);
                    alert(`Failed to import ${file.name}: ${error.message}`);
                }
            }
        });

        input.click();
    }

    /**
     * Show create dialog
     */
    showCreateDialog() {
        const templates = this.assetPackManager.getTemplates();
        const templateOptions = templates.map(t =>
            `<option value="${t.id}">${t.name} - ${t.description}</option>`
        ).join('');

        const dialog = `
            <div id="ember2-create-dialog" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--black900); border: 2px solid var(--white30); border-radius: 10px; padding: 20px; z-index: 9999; min-width: 400px; color: var(--grey0);">
                <h3 style="color: var(--grey0); margin-bottom: 15px;">Create Asset Pack</h3>
                <label>Template:</label>
                <select id="ember2-template-select" style="width: 100%; margin-bottom: 10px;">
                    ${templateOptions}
                </select>
                <label>Pack Name:</label>
                <input type="text" id="ember2-pack-name" placeholder="my-awesome-pack" style="width: 100%; margin-bottom: 10px;">
                <label>Display Name:</label>
                <input type="text" id="ember2-display-name" placeholder="My Awesome Pack" style="width: 100%; margin-bottom: 10px;">
                <div style="text-align: right; margin-top: 15px;">
                    <button id="ember2-create-cancel">Cancel</button>
                    <button id="ember2-create-confirm" style="margin-left: 10px;">Create</button>
                </div>
            </div>
            <div id="ember2-dialog-backdrop" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9998;"></div>
        `;

        $('body').append(dialog);

        $('#ember2-create-cancel, #ember2-dialog-backdrop').on('click', () => {
            $('#ember2-create-dialog, #ember2-dialog-backdrop').remove();
        });

        $('#ember2-create-confirm').on('click', async () => {
            const template = $('#ember2-template-select').val();
            const packName = $('#ember2-pack-name').val().trim();
            const displayName = $('#ember2-display-name').val().trim();

            if (!packName) {
                alert('Pack name is required');
                return;
            }

            try {
                const pack = await this.assetPackManager.createFromTemplate(template, packName, {
                    displayName: displayName || packName,
                    author: 'User'
                });

                console.log(`[Ember 2.0] Created pack from template: ${pack.id}`);
                this.updatePackLibrary();
                $('#ember2-create-dialog, #ember2-dialog-backdrop').remove();

            } catch (error) {
                console.error('[Ember 2.0] Failed to create pack:', error);
                alert(`Failed to create pack: ${error.message}`);
            }
        });
    }

    /**
     * Show export format dialog
     */
    showExportDialog(packId) {
        return new Promise((resolve) => {
            const dialog = `
                <div id="ember2-export-dialog" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--black900); border: 2px solid var(--white30); border-radius: 10px; padding: 20px; z-index: 9999; min-width: 400px; color: var(--grey0);">
                    <h3 style="color: var(--grey0); margin-bottom: 15px;">Export Asset Pack</h3>
                    <p>Choose export format for pack: <strong>${packId}</strong></p>

                    <div style="margin: 15px 0;">
                        <label style="display: block; margin-bottom: 10px;">
                            <input type="radio" name="export-format" value="zip" checked style="margin-right: 10px;">
                            <strong>ZIP Package</strong> - Complete pack with assets (recommended)
                        </label>
                        <label style="display: block; margin-bottom: 10px;">
                            <input type="radio" name="export-format" value="json" style="margin-right: 10px;">
                            <strong>JSON File</strong> - Pack data only (for backup)
                        </label>
                        <label style="display: block; margin-bottom: 10px;">
                            <input type="radio" name="export-format" value="js" style="margin-right: 10px;">
                            <strong>JavaScript</strong> - Standalone script
                        </label>
                    </div>

                    <div style="text-align: right; margin-top: 20px;">
                        <button id="ember2-export-cancel">Cancel</button>
                        <button id="ember2-export-confirm" style="margin-left: 10px;">Export</button>
                    </div>
                </div>
                <div id="ember2-export-backdrop" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9998;"></div>
            `;

            $('body').append(dialog);

            $('#ember2-export-cancel, #ember2-export-backdrop').on('click', () => {
                $('#ember2-export-dialog, #ember2-export-backdrop').remove();
                resolve(null);
            });

            $('#ember2-export-confirm').on('click', () => {
                const selectedFormat = $('input[name="export-format"]:checked').val();
                $('#ember2-export-dialog, #ember2-export-backdrop').remove();
                resolve(selectedFormat);
            });
        });
    }

    /**
     * Show enhanced pack library with examples
     */
    showPackLibrary() {
        // Get both saved packs and registered packs from universal renderer
        const savedPacks = this.assetPackManager.getAvailablePacks();
        const registeredPacks = Array.from(this.universalRenderer.registeredAssetPacks.values());

        // Combine and deduplicate
        const allPacks = new Map();

        // Add saved packs
        savedPacks.forEach(pack => {
            allPacks.set(pack.id, { ...pack, source: 'saved' });
        });

        // Add registered packs (including examples)
        registeredPacks.forEach(pack => {
            if (!allPacks.has(pack.id)) {
                allPacks.set(pack.id, { ...pack, source: 'example' });
            }
        });

        const packArray = Array.from(allPacks.values());

        const packList = packArray.map(pack => {
            const isExample = pack.source === 'example';
            const tags = pack.metadata.tags || [];

            return `
                <div style="
                    border: 1px solid var(--white30);
                    margin: 15px 0;
                    padding: 20px;
                    border-radius: 12px;
                    background: ${isExample ? 'linear-gradient(135deg, rgba(116, 185, 255, 0.15), rgba(108, 92, 231, 0.15))' : 'var(--black800)'};
                    position: relative;
                    ${isExample ? 'border-left: 4px solid #74b9ff;' : ''}
                    transition: all 0.2s ease;
                    cursor: pointer;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.5)'" onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
                    ${isExample ? '<div style="position: absolute; top: 10px; right: 15px; background: #74b9ff; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">EXAMPLE</div>' : ''}

                    <div style="display: flex; align-items: start; gap: 15px;">
                        <div style="font-size: 32px; line-height: 1;">${this.getPackEmoji(pack.metadata.tags)}</div>
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 8px 0; color: var(--grey0); font-size: 18px; font-weight: bold;">
                                ${pack.metadata.displayName || pack.id}
                            </h4>
                            <p style="margin: 0 0 12px 0; color: var(--grey50); line-height: 1.4; font-size: 14px;">
                                ${pack.metadata.description || 'No description'}
                            </p>

                            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0;">
                                ${tags.map(tag => `<span style="
                                    background: var(--white20);
                                    color: var(--grey0);
                                    padding: 3px 8px;
                                    border-radius: 12px;
                                    font-size: 11px;
                                    font-weight: 500;
                                    border: 1px solid var(--white30);
                                ">#${tag}</span>`).join('')}
                            </div>

                            <div style="font-size: 12px; color: var(--grey70); margin: 8px 0;">
                                Version: ${pack.metadata.version} • Author: ${pack.metadata.author}
                                ${pack.stateSchema?.variables ? ` • ${Object.keys(pack.stateSchema.variables).length} variables` : ''}
                            </div>

                            <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                                ${this.activeAssetPacks.has(pack.id) ?
                                    `<button onclick="window.ember2.deactivatePack('${pack.id}')" style="
                                        background: linear-gradient(135deg, #dc3545, #c82333);
                                        color: white;
                                        border: 1px solid #dc3545;
                                        padding: 8px 16px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-size: 12px;
                                        font-weight: bold;
                                        transition: all 0.2s ease;
                                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🚫 Deactivate Pack</button>` :
                                    `<button onclick="window.ember2.activatePack('${pack.id}')" style="
                                        background: linear-gradient(135deg, #28a745, #20c997);
                                        color: white;
                                        border: 1px solid #28a745;
                                        padding: 8px 16px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-size: 12px;
                                        font-weight: bold;
                                        transition: all 0.2s ease;
                                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🎯 Activate Pack</button>`
                                }

                                <button onclick="window.ember2.previewPack('${pack.id}')" style="
                                    background: linear-gradient(135deg, #17a2b8, #007bff);
                                    color: white;
                                    border: 1px solid #17a2b8;
                                    padding: 8px 16px;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                    font-weight: bold;
                                    transition: all 0.2s ease;
                                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">👁️ Preview</button>

                                <button onclick="window.ember2.exportPack('${pack.id}')" style="
                                    background: linear-gradient(135deg, #ffc107, #fd7e14);
                                    color: #333;
                                    border: 1px solid #ffc107;
                                    padding: 8px 16px;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                    font-weight: bold;
                                    transition: all 0.2s ease;
                                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">📤 Export</button>

                                ${!isExample ? `<button onclick="window.ember2.editPack('${pack.id}')" style="
                                    background: linear-gradient(135deg, #6f42c1, #495057);
                                    color: white;
                                    border: 1px solid #6f42c1;
                                    padding: 8px 16px;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                    font-weight: bold;
                                    transition: all 0.2s ease;
                                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">✏️ Edit</button>` : ''}

                                ${!isExample ? `<button onclick="window.ember2.removePack('${pack.id}')" style="
                                    background: linear-gradient(135deg, #dc3545, #c82333);
                                    color: white;
                                    border: 1px solid #dc3545;
                                    padding: 8px 16px;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                    font-weight: bold;
                                    transition: all 0.2s ease;
                                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">🗑️ Remove</button>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const library = `
            <div id="ember2-library-dialog" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--black900);
                border: 2px solid var(--white30);
                border-radius: 15px;
                padding: 25px;
                z-index: 9999;
                width: 90%;
                max-width: 800px;
                max-height: 85%;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.7);
                color: var(--grey0);
            ">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid var(--white30); padding-bottom: 15px;">
                    <div>
                        <h3 style="margin: 0; color: var(--grey0); font-size: 24px; font-weight: bold;">📦 Asset Pack Library</h3>
                        <p style="margin: 5px 0 0 0; color: var(--grey50); font-size: 14px;">
                            ${packArray.length} packs available • Click "Activate Pack" to use in conversations
                        </p>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <div style="background: rgba(116, 185, 255, 0.1); border: 1px solid rgba(116, 185, 255, 0.3); border-radius: 10px; padding: 15px;">
                        <h4 style="margin: 0 0 8px 0; color: #74b9ff;">💡 How to Use Asset Packs</h4>
                        <div style="font-size: 14px; line-height: 1.5;">
                            <p style="margin: 0 0 10px 0;"><strong>Method 1: Direct Activation (Recommended)</strong></p>
                            <p style="margin: 0 0 8px 0;">Click "🎯 Activate Pack" to immediately show the interactive display in your chat!</p>

                            <p style="margin: 15px 0 10px 0;"><strong>Method 2: AI Trigger System</strong></p>
                            <p style="margin: 0 0 8px 0;">Add <code style="background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 4px;">[ASSET_PACK:pack-name]</code> to messages for AI-triggered activation.</p>
                            <p style="margin: 0; font-size: 13px; opacity: 0.8;">This allows the AI to automatically activate specific packs based on conversation context.</p>
                        </div>
                    </div>
                </div>

                ${packList || '<p style="text-align: center; color: var(--grey50); padding: 40px; font-size: 16px;">No asset packs available.</p>'}

                <div style="text-align: right; margin-top: 20px; border-top: 1px solid var(--white30); padding-top: 15px;">
                    <button id="ember2-library-close" style="
                        background: linear-gradient(135deg, var(--white20), var(--white30));
                        color: var(--grey0);
                        border: 1px solid var(--white30);
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Close</button>
                </div>
            </div>
            <div id="ember2-library-backdrop" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                z-index: 9998;
                backdrop-filter: blur(5px);
            "></div>
        `;

        $('body').append(library);

        $('#ember2-library-close, #ember2-library-backdrop').on('click', () => {
            $('#ember2-library-dialog, #ember2-library-backdrop').remove();
        });

        // Note: Manual chat injection removed - now using automatic context injection system

        // Add notification helper method to the main class
        this.showPackNotification = (message, type = 'info') => {
            const colors = {
                success: '#28a745',
                error: '#dc3545',
                info: '#17a2b8',
                warning: '#ffc107'
            };

            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${colors[type]};
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10000;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                font-weight: bold;
                font-size: 14px;
                animation: slideIn 0.3s ease;
            `;
            notification.textContent = message;

            // Add animation styles
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);

            document.body.appendChild(notification);

            // Auto remove after 4 seconds
            setTimeout(() => {
                notification.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => notification.remove(), 300);
            }, 4000);
        };

        // Expose methods for pack management
        window.ember2 = {
            extension: this, // Reference to extension instance
            activatePack: async (packId) => {
                try {
                    const pack = allPacks.get(packId);
                    if (!pack) {
                        alert('Asset pack not found!');
                        return;
                    }

                    // Close library first
                    $('#ember2-library-dialog, #ember2-library-backdrop').remove();

                    // Check if pack is already active
                    const extensionInstance = window.ember2.extension;
                    if (!extensionInstance || !extensionInstance.universalRenderer) {
                        throw new Error('Ember extension not properly initialized');
                    }

                    if (extensionInstance.universalRenderer.activeAssetPacks && extensionInstance.universalRenderer.activeAssetPacks.has(packId)) {
                        // Show notification that it's already active
                        extensionInstance.showPackNotification(`📱 ${pack.metadata.displayName || packId} is already active!`, 'info');
                        return;
                    }

                    // Register the pack if not already registered
                    if (!extensionInstance.universalRenderer.registeredAssetPacks.has(packId)) {
                        await extensionInstance.universalRenderer.registerAssetPack(pack);
                    }

                    // Create an AssetPack instance for rendering
                    const assetPackInstance = await extensionInstance.universalRenderer.createAssetPackInstance(pack);

                    // Find a good container for rendering
                    const renderContainer = document.querySelector('#chat') || document.querySelector('#sheld') || document.body;

                    // Generate unique message ID for direct activation
                    const messageId = 'direct_activation_' + Date.now();

                    // Render the pack with proper parameters
                    const instanceId = await assetPackInstance.render(messageId, renderContainer, 'end');

                    if (instanceId) {
                        // Add to active packs (both renderer and extension tracking)
                        extensionInstance.universalRenderer.activeAssetPacks.set(packId, assetPackInstance);
                        extensionInstance.activeAssetPacks.set(packId, assetPackInstance);

                        // Update context injection with this new active pack
                        extensionInstance.updateAssetPackContext();

                        // Find the rendered container for scrolling
                        const renderedContainer = renderContainer.querySelector(`[data-pack-id="${packId}"]`);

                        // Show success notification
                        extensionInstance.showPackNotification(`✅ ${pack.metadata.displayName || packId} activated and displayed!`, 'success');

                        // Scroll to the rendered pack if found
                        if (renderedContainer) {
                            renderedContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }

                        console.log(`[Ember 2.0] Asset pack ${packId} activated and rendered with instance ID: ${instanceId}`);
                    } else {
                        throw new Error('Failed to render asset pack - no instance ID returned');
                    }

                } catch (error) {
                    console.error('[Ember 2.0] Pack activation failed:', error);
                    const extensionInstance = window.ember2.extension;
                    if (extensionInstance && extensionInstance.showPackNotification) {
                        extensionInstance.showPackNotification(`❌ Failed to activate ${packId}: ${error.message}`, 'error');
                    } else {
                        alert(`Failed to activate ${packId}: ${error.message}`);
                    }
                }
            },

            previewPack: async (packId) => {
                const pack = allPacks.get(packId);
                if (!pack) return;

                // Create preview modal with proper theming
                const preview = `
                    <div id="ember2-preview-dialog" style="
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: var(--black900);
                        border: 2px solid var(--white30);
                        border-radius: 15px;
                        padding: 0;
                        z-index: 9999;
                        width: 90%;
                        max-width: 900px;
                        max-height: 85%;
                        overflow: hidden;
                        color: var(--grey0);
                        box-shadow: 0 20px 60px rgba(0,0,0,0.7);
                    ">
                        <!-- Header -->
                        <div style="
                            padding: 20px 25px;
                            border-bottom: 2px solid var(--white30);
                            background: var(--black800);
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        ">
                            <div>
                                <h3 style="margin: 0; color: var(--grey0); font-size: 20px;">🔍 Asset Pack Preview</h3>
                                <p style="margin: 5px 0 0 0; color: var(--grey50); font-size: 14px;">${pack.metadata.displayName || pack.id}</p>
                            </div>
                            <button id="ember2-preview-close" style="
                                background: var(--white20);
                                border: 1px solid var(--white30);
                                color: var(--grey0);
                                padding: 8px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: bold;
                            ">✕</button>
                        </div>

                        <!-- Content Tabs -->
                        <div style="
                            background: var(--black850);
                            border-bottom: 1px solid var(--white30);
                            display: flex;
                            gap: 0;
                        ">
                            <button id="preview-tab-live" class="preview-tab active" style="
                                background: var(--black800);
                                border: none;
                                border-bottom: 3px solid #74b9ff;
                                color: var(--grey0);
                                padding: 12px 20px;
                                cursor: pointer;
                                font-weight: bold;
                            ">🎯 Live Preview</button>
                            <button id="preview-tab-code" class="preview-tab" style="
                                background: var(--black850);
                                border: none;
                                border-bottom: 3px solid transparent;
                                color: var(--grey50);
                                padding: 12px 20px;
                                cursor: pointer;
                            ">📝 Code & Settings</button>
                        </div>

                        <!-- Tab Content -->
                        <div style="
                            overflow-y: auto;
                            max-height: calc(85vh - 140px);
                            padding: 25px;
                        ">
                            <!-- Live Preview Tab -->
                            <div id="preview-content-live" class="preview-content">
                                <div style="
                                    background: var(--black850);
                                    border: 2px dashed var(--white30);
                                    border-radius: 12px;
                                    padding: 20px;
                                    margin-bottom: 20px;
                                    text-align: center;
                                ">
                                    <h4 style="color: var(--grey0); margin: 0 0 10px 0;">📱 Asset Pack Display</h4>
                                    <p style="color: var(--grey50); margin: 0 0 15px 0; font-size: 14px;">
                                        This is how the asset pack will appear when activated:
                                    </p>
                                    <div id="ember2-preview-render" style="
                                        background: var(--black800);
                                        border: 1px solid var(--white30);
                                        border-radius: 8px;
                                        padding: 15px;
                                        margin: 15px 0;
                                        min-height: 200px;
                                        position: relative;
                                    ">
                                        <!-- Live render will be inserted here -->
                                    </div>
                                </div>

                                <!-- Pack Info -->
                                <div style="
                                    background: var(--black850);
                                    border: 1px solid var(--white30);
                                    border-radius: 8px;
                                    padding: 15px;
                                    margin: 15px 0;
                                ">
                                    <h5 style="color: var(--grey0); margin: 0 0 10px 0;">📋 Pack Information</h5>
                                    <p style="color: var(--grey70); margin: 5px 0; font-size: 13px;"><strong>Description:</strong> ${pack.metadata.description || 'No description'}</p>
                                    <p style="color: var(--grey70); margin: 5px 0; font-size: 13px;"><strong>Author:</strong> ${pack.metadata.author || 'Unknown'}</p>
                                    <p style="color: var(--grey70); margin: 5px 0; font-size: 13px;"><strong>Version:</strong> ${pack.metadata.version || '1.0.0'}</p>
                                    ${pack.stateSchema?.variables ? `<p style="color: var(--grey70); margin: 5px 0; font-size: 13px;"><strong>Variables:</strong> ${Object.keys(pack.stateSchema.variables).length} state variables</p>` : ''}
                                </div>
                            </div>

                            <!-- Code Tab -->
                            <div id="preview-content-code" class="preview-content" style="display: none;">
                                ${pack.stateSchema?.variables ? `
                                    <div style="margin: 15px 0;">
                                        <h5 style="color: var(--grey0); margin: 0 0 10px 0;">⚙️ State Variables</h5>
                                        <div style="background: var(--black850); border: 1px solid var(--white30); border-radius: 8px; padding: 15px;">
                                            ${Object.entries(pack.stateSchema.variables).map(([name, def]) =>
                                                `<div style="margin: 8px 0; padding: 8px; background: var(--black800); border-radius: 4px;">
                                                    <strong style="color: var(--grey0);">${name}</strong>
                                                    <span style="color: var(--grey50); font-size: 12px;">(${def.type})</span><br>
                                                    <span style="color: var(--grey70); font-size: 13px;">Default: ${JSON.stringify(def.default)}</span><br>
                                                    <span style="color: var(--grey60); font-size: 12px;">${def.description || 'No description'}</span>
                                                </div>`
                                            ).join('')}
                                        </div>
                                    </div>
                                ` : ''}

                                ${pack.chatInjection?.template ? `
                                    <div style="margin: 15px 0;">
                                        <h5 style="color: var(--grey0); margin: 0 0 10px 0;">🤖 AI Integration Template</h5>
                                        <pre style="
                                            background: var(--black850);
                                            border: 1px solid var(--white30);
                                            padding: 15px;
                                            border-radius: 8px;
                                            font-size: 12px;
                                            overflow-x: auto;
                                            color: var(--grey0);
                                            white-space: pre-wrap;
                                        ">${pack.chatInjection.template}</pre>
                                    </div>
                                ` : ''}

                                ${pack.content ? `
                                    <div style="margin: 15px 0;">
                                        <h5 style="color: var(--grey0); margin: 0 0 10px 0;">📄 JavaScript Code</h5>
                                        <pre style="
                                            background: var(--black850);
                                            border: 1px solid var(--white30);
                                            padding: 15px;
                                            border-radius: 8px;
                                            font-size: 11px;
                                            overflow-x: auto;
                                            color: var(--grey0);
                                            white-space: pre-wrap;
                                            max-height: 300px;
                                        ">${pack.content.substring(0, 2000)}${pack.content.length > 2000 ? '...\n\n[Code truncated for preview]' : ''}</pre>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    <div id="ember2-preview-backdrop" style="
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0,0,0,0.8);
                        z-index: 9998;
                    "></div>
                `;

                $('body').append(preview);

                // Set up tab switching
                $('.preview-tab').on('click', function() {
                    $('.preview-tab').removeClass('active');
                    $('.preview-tab').css({
                        'background': 'var(--black850)',
                        'border-bottom': '3px solid transparent',
                        'color': 'var(--grey50)'
                    });
                    $('.preview-content').hide();

                    $(this).addClass('active');
                    $(this).css({
                        'background': 'var(--black800)',
                        'border-bottom': '3px solid #74b9ff',
                        'color': 'var(--grey0)'
                    });

                    const tabId = $(this).attr('id').replace('preview-tab-', '');
                    $(`#preview-content-${tabId}`).show();
                });

                // Set up close handlers
                $('#ember2-preview-close, #ember2-preview-backdrop').on('click', () => {
                    $('#ember2-preview-dialog, #ember2-preview-backdrop').remove();
                });

                // Render the actual asset pack live preview
                try {
                    const renderContainer = document.getElementById('ember2-preview-render');
                    if (renderContainer && pack.content) {
                        // Create a sandboxed environment for the preview
                        const previewFrame = document.createElement('iframe');
                        previewFrame.style.cssText = 'width: 100%; height: 350px; border: none; background: transparent; border-radius: 6px;';

                        renderContainer.appendChild(previewFrame);

                        const frameDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;

                        // Create preview environment
                        const previewHTML = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
                                <style>
                                    :root {
                                        --black800: #1a1a1a;
                                        --grey0: #ffffff;
                                        --grey50: #888888;
                                        --white30: #4a4a4a;
                                    }
                                    body {
                                        margin: 0;
                                        padding: 10px;
                                        font-family: Arial, sans-serif;
                                        background: var(--black800);
                                        color: var(--grey0);
                                        overflow-x: hidden;
                                    }
                                    * {
                                        box-sizing: border-box;
                                    }
                                    ${pack.cssContent || ''}
                                </style>
                            </head>
                            <body>
                                ${pack.htmlContent || '<div id="root"></div>'}
                                <script>
                                    // Ensure jQuery is available with fallback
                                    if (typeof $ === 'undefined') {
                                        window.$ = function(selector) {
                                            const mockElement = {
                                                on: () => mockElement,
                                                off: () => mockElement,
                                                click: () => mockElement,
                                                append: () => mockElement,
                                                remove: () => mockElement,
                                                val: () => 'mock_value',
                                                text: () => 'mock_text',
                                                html: () => 'mock_html',
                                                css: () => mockElement,
                                                attr: () => mockElement,
                                                addClass: () => mockElement,
                                                removeClass: () => mockElement,
                                                find: () => mockElement,
                                                parent: () => mockElement,
                                                length: 1
                                            };
                                            return mockElement;
                                        };
                                        window.jQuery = window.$;
                                    }

                                    // Mock state storage for preview
                                    const previewState = {
                                        args: {},
                                        context: {},
                                        state: {}
                                    };

                                    // Complete mock Ember API for preview
                                    window.ember = {
                                        inject: (data) => {
                                            console.log('Preview inject:', data);
                                            // Show mock injection in preview
                                            const mockDiv = document.createElement('div');
                                            mockDiv.style.cssText = 'position: fixed; top: 10px; right: 10px; background: #28a745; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; z-index: 1000;';
                                            mockDiv.textContent = '✓ AI Inject: ' + (data.content || JSON.stringify(data));
                                            document.body.appendChild(mockDiv);
                                            setTimeout(() => mockDiv.remove(), 2000);
                                        },
                                        setContextField: (field, value) => {
                                            console.log('Preview context:', field, value);
                                            previewState.context[field] = value;
                                        },
                                        getContextField: (field) => previewState.context[field] || 'preview_value',
                                        setState: (key, value) => {
                                            console.log('Preview state:', key, value);
                                            previewState.state[key] = value;
                                        },
                                        getState: (key) => previewState.state[key] || 'preview_state',
                                        // Additional Ember API methods
                                        render: (html) => {
                                            console.log('Preview render:', html);
                                            if (html && root) {
                                                root.innerHTML = html;
                                            }
                                        },
                                        clear: () => {
                                            console.log('Preview clear');
                                            if (root) root.innerHTML = '';
                                        },
                                        update: (updates) => {
                                            console.log('Preview update:', updates);
                                            Object.assign(previewState, updates);
                                        },
                                        getData: (key) => previewState[key] || null,
                                        setData: (key, value) => {
                                            previewState[key] = value;
                                            console.log('Preview setData:', key, value);
                                        },
                                        trigger: (event, data) => {
                                            console.log('Preview trigger:', event, data);
                                        },
                                        on: (event, handler) => {
                                            console.log('Preview on:', event);
                                            return { off: () => console.log('Preview off:', event) };
                                        },
                                        off: (event) => console.log('Preview off:', event)
                                    };

                                    // Mock global functions with proper state management
                                    function getArg(name) {
                                        if (previewState.args[name] !== undefined) {
                                            return previewState.args[name];
                                        }
                                        // Return sample values based on common argument types
                                        if (name.includes('level') || name.includes('affection') || name.includes('trust')) return 50;
                                        if (name.includes('status') || name.includes('relationship')) return 'single';
                                        if (name.includes('name')) return 'Preview User';
                                        return 'preview_value';
                                    }
                                    function setArg(name, value) {
                                        console.log('Preview arg:', name, value);
                                        previewState.args[name] = value;
                                    }

                                    // Mock additional global functions that asset packs might use
                                    function setState(key, value) {
                                        console.log('Preview setState:', key, value);
                                        previewState.state[key] = value;
                                    }
                                    function getState(key) {
                                        return previewState.state[key] || null;
                                    }

                                    // Mock jQuery-style event handlers for compatibility
                                    function on(event, selector, handler) {
                                        console.log('Preview event binding:', event, selector);
                                        // Mock event binding - in preview mode, we don't actually bind events
                                        return { off: () => {} };
                                    }

                                    // Mock common global functions
                                    window.on = on;
                                    window.off = () => {};
                                    window.trigger = () => {};

                                    // Mock common chart libraries if needed
                                    if (typeof Chart === 'undefined') {
                                        window.Chart = function(canvas, config) {
                                            console.log('Preview Chart created:', config);
                                            // Create a simple mock chart visualization
                                            const ctx = canvas.getContext('2d');
                                            ctx.fillStyle = '#74b9ff';
                                            ctx.fillRect(10, 10, 50, 100);
                                            ctx.fillStyle = '#a29bfe';
                                            ctx.fillRect(70, 30, 50, 80);
                                            ctx.fillStyle = '#fd79a8';
                                            ctx.fillRect(130, 50, 50, 60);
                                            ctx.fillStyle = '#fdcb6e';
                                            ctx.fillRect(190, 20, 50, 90);

                                            ctx.fillStyle = '#fff';
                                            ctx.font = '12px Arial';
                                            ctx.fillText('Preview Chart', 10, 140);
                                        };
                                    }

                                    // Mock fetch for any API calls
                                    if (typeof fetch === 'undefined') {
                                        window.fetch = () => Promise.resolve({
                                            json: () => Promise.resolve({ preview: true, data: 'mock_data' })
                                        });
                                    }

                                    // Mock SillyTavern API functions that asset packs might use
                                    window.getCurrentPrompt = () => 'This is a preview prompt for the asset pack demonstration.';
                                    window.injectPrompt = (text) => {
                                        console.log('Preview injectPrompt:', text);
                                        // Show visual feedback
                                        const injectDiv = document.createElement('div');
                                        injectDiv.style.cssText = 'position: fixed; top: 50px; right: 10px; background: #667eea; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; z-index: 1000; max-width: 200px;';
                                        injectDiv.textContent = '💬 Injected: ' + (text || 'prompt text');
                                        document.body.appendChild(injectDiv);
                                        setTimeout(() => injectDiv.remove(), 3000);
                                    };
                                    window.getContext = () => ({
                                        char_name: 'Preview Character',
                                        user_name: 'Preview User',
                                        chat_metadata: {}
                                    });
                                    window.setContextField = (field, value) => {
                                        console.log('Preview setContextField:', field, value);
                                        previewState.context[field] = value;
                                    };
                                    window.getContextField = (field) => previewState.context[field] || 'preview_context_value';
                                    window.eventSource = {
                                        on: (event, handler) => console.log('Preview event listener:', event),
                                        off: (event, handler) => console.log('Preview event unlisten:', event),
                                        emit: (event, data) => console.log('Preview event emit:', event, data)
                                    };
                                    window.addOneMessage = (message) => console.log('Preview addOneMessage:', message);
                                    window.Generate = () => console.log('Preview Generate called');
                                    window.getChatId = () => 'preview_chat_id';
                                    window.getCharacters = () => [{ name: 'Preview Character', avatar: 'preview.png' }];
                                    window.saveSettingsDebounced = () => console.log('Preview settings saved');

                                    // Additional Ember-specific functions
                                    window.sendMessage = (text) => {
                                        console.log('Preview sendMessage:', text);
                                        const msgDiv = document.createElement('div');
                                        msgDiv.style.cssText = 'position: fixed; top: 90px; right: 10px; background: #28a745; color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; z-index: 1000; max-width: 200px;';
                                        msgDiv.textContent = '📤 Sent: ' + (text || 'message');
                                        document.body.appendChild(msgDiv);
                                        setTimeout(() => msgDiv.remove(), 3000);
                                    };
                                    window.updateContext = (updates) => {
                                        console.log('Preview updateContext:', updates);
                                        Object.assign(previewState.context, updates);
                                    };
                                    window.getActiveCharacter = () => ({ name: 'Preview Character', id: 'preview_char' });
                                    window.getUserName = () => 'Preview User';
                                    window.getCharacterName = () => 'Preview Character';
                                    window.isCharacterSelected = () => true;
                                    window.getChatHistory = () => [
                                        { mes: 'Hello! This is a preview message.', is_user: false },
                                        { mes: 'Hi there! This is a user message in preview.', is_user: true }
                                    ];
                                    window.getLastMessage = () => ({ mes: 'This is the last message in preview.', is_user: false });
                                    window.appendMessage = (message) => console.log('Preview appendMessage:', message);
                                    window.insertMessage = (message, index) => console.log('Preview insertMessage:', message, 'at', index);
                                    window.deleteMessage = (index) => console.log('Preview deleteMessage at index:', index);
                                    window.editMessage = (index, newText) => console.log('Preview editMessage:', index, newText);
                                    window.scrollChatToBottom = () => console.log('Preview scrollChatToBottom');
                                    window.highlightMessage = (index) => console.log('Preview highlightMessage:', index);

                                    // Mock power_user object that some extensions might use
                                    window.power_user = {
                                        name: 'Preview User',
                                        avatar: 'preview_avatar.png',
                                        chat_completion_source: 'preview_api',
                                        persona_description: 'Preview persona'
                                    };

                                    // Initialize preview with sample data for better demonstration
                                    if ('${pack.metadata.name}' === 'enhanced-dating-sim' || '${pack.metadata.name}' === 'dating-simulator') {
                                        previewState.args = {
                                            'relationship_status': 'single',
                                            'trust_level': 35,
                                            'affection_level': 42,
                                            'last_interaction': 'compliment'
                                        };
                                    }

                                    // Root element for asset pack rendering
                                    const root = document.getElementById('root') || document.body;

                                    try {
                                        // Add preview indicator
                                        const previewBadge = document.createElement('div');
                                        previewBadge.style.cssText = 'position: absolute; top: 5px; left: 5px; background: #17a2b8; color: white; padding: 4px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; z-index: 1000;';
                                        previewBadge.textContent = 'PREVIEW MODE';
                                        document.body.appendChild(previewBadge);

                                        // Additional commonly used functions
                                        window.getTime = () => new Date().toLocaleTimeString();
                                        window.getDate = () => new Date().toLocaleDateString();
                                        window.getTimestamp = () => Date.now();
                                        window.formatDate = (date) => new Date(date).toLocaleDateString();
                                        window.formatTime = (date) => new Date(date).toLocaleTimeString();
                                        window.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                                        window.random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
                                        window.randomChoice = (array) => array[Math.floor(Math.random() * array.length)];
                                        window.localStorage = {
                                            getItem: (key) => previewState['storage_' + key] || null,
                                            setItem: (key, value) => {
                                                previewState['storage_' + key] = value;
                                                console.log('Preview localStorage.setItem:', key, value);
                                            },
                                            removeItem: (key) => {
                                                delete previewState['storage_' + key];
                                                console.log('Preview localStorage.removeItem:', key);
                                            },
                                            clear: () => {
                                                Object.keys(previewState).filter(k => k.startsWith('storage_')).forEach(k => delete previewState[k]);
                                                console.log('Preview localStorage.clear');
                                            }
                                        };

                                        // Global error handler for undefined function calls
                                        window.onerror = function(msg, url, line, col, error) {
                                            console.error('Preview error:', msg);
                                            if (msg.includes('is not defined')) {
                                                const functionName = msg.match(/(\\w+) is not defined/)?.[1];
                                                if (functionName) {
                                                    console.log('Creating mock function for:', functionName);
                                                    window[functionName] = function(...args) {
                                                        console.log('Mock function ' + functionName + ' called with:', args);
                                                        // Return appropriate mock values based on function name
                                                        if (functionName.includes('get') || functionName.includes('fetch')) {
                                                            return 'preview_' + functionName.toLowerCase();
                                                        }
                                                        if (functionName.includes('Current') || functionName.includes('Active')) {
                                                            return 'current_preview_value';
                                                        }
                                                        if (functionName.includes('inject') || functionName.includes('Prompt')) {
                                                            return (text) => {
                                                                console.log('Auto-created inject function called with:', text);
                                                                const div = document.createElement('div');
                                                                div.style.cssText = 'position: fixed; top: 130px; right: 10px; background: #ffc107; color: #333; padding: 8px 12px; border-radius: 4px; font-size: 12px; z-index: 1000; max-width: 200px;';
                                                                div.textContent = '⚡ Auto-Mock: ' + (text || functionName);
                                                                document.body.appendChild(div);
                                                                setTimeout(() => div.remove(), 3000);
                                                            };
                                                        }
                                                        return {};
                                                    };
                                                    // Try to re-execute the failed code
                                                    return false; // Allow retrying
                                                }
                                            }
                                            return true; // Prevent default error handling
                                        };

                                        // More proactive undefined function handling
                                        const originalGet = Object.getOwnPropertyDescriptor;
                                        window.addEventListener('unhandledrejection', function(event) {
                                            console.log('Preview unhandled promise rejection:', event.reason);
                                            event.preventDefault();
                                        });

                                        ${pack.content}
                                    } catch (error) {
                                        console.error('Preview error:', error);
                                        root.innerHTML = '<div style="color: #ff6b6b; padding: 20px; text-align: center; border: 2px dashed #ff6b6b; border-radius: 8px; margin: 10px;">' +
                                            '<h4 style="margin: 0 0 10px 0;">⚠️ Preview Error</h4>' +
                                            '<p style="margin: 0; font-size: 14px;">' + error.message + '</p>' +
                                            '<small style="opacity: 0.7; display: block; margin-top: 10px;">' +
                                                'Check the "Code &amp; Settings" tab for more details.' +
                                            '</small>' +
                                        '</div>';
                                    }
                                </script>
                            </body>
                            </html>
                        `;

                        frameDoc.open();
                        frameDoc.write(previewHTML);
                        frameDoc.close();
                    } else {
                        document.getElementById('ember2-preview-render').innerHTML = `
                            <div style="text-align: center; padding: 40px; color: var(--grey50);">
                                <h4>No Preview Available</h4>
                                <p>This asset pack doesn't contain executable content for preview.</p>
                            </div>
                        `;
                    }
                } catch (error) {
                    console.error('Preview rendering error:', error);
                    document.getElementById('ember2-preview-render').innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #ff6b6b;">
                            <h4>Preview Error</h4>
                            <p>${error.message}</p>
                        </div>
                    `;
                }
            },

            editPack: (packId) => {
                const pack = allPacks.get(packId);
                if (pack && pack.source !== 'example') {
                    // Close library and open creator with this pack
                    $('#ember2-library-dialog, #ember2-library-backdrop').remove();
                    window.ember.openAssetPackCreator(pack);
                }
            },

            exportPack: async (packId, format = null) => {
                try {
                    const pack = allPacks.get(packId);
                    if (!pack) {
                        alert('Pack not found');
                        return;
                    }

                    // Show format selection dialog if format not specified
                    if (!format) {
                        const selectedFormat = await window.ember2.showExportDialog(packId);
                        if (!selectedFormat) return; // User cancelled
                        format = selectedFormat;
                    }

                    let blob, filename;

                    switch (format) {
                        case 'json':
                            const content = JSON.stringify(pack, null, 2);
                            blob = new Blob([content], { type: 'application/json' });
                            filename = `${pack.metadata?.name || packId}.json`;
                            break;

                        case 'zip':
                            blob = await this.assetPackManager.exportAsZip(pack);
                            filename = `${pack.metadata?.name || packId}.zip`;
                            break;

                        case 'js':
                            const jsContent = await this.assetPackManager.exportAsJavaScript(pack);
                            blob = new Blob([jsContent], { type: 'application/javascript' });
                            filename = `${pack.metadata?.name || packId}.js`;
                            break;

                        default:
                            throw new Error(`Unknown export format: ${format}`);
                    }

                    // Download file
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    console.log(`[Ember 2.0] Exported pack ${packId} as ${format.toUpperCase()}`);

                } catch (error) {
                    console.error('[Ember 2.0] Export failed:', error);
                    alert(`Export failed: ${error.message}`);
                }
            },

            removePack: (packId) => {
                if (confirm(`Remove asset pack "${packId}"?\\n\\nThis will permanently delete the pack from your library.`)) {
                    try {
                        this.assetPackManager.removePack(packId);
                        this.updatePackLibrary();
                        $('#ember2-library-dialog, #ember2-library-backdrop').remove();
                        this.showPackLibrary();
                    } catch (error) {
                        alert(`Remove failed: ${error.message}`);
                    }
                }
            }
        };

        // Add pack deactivation function
        window.ember2.deactivatePack = (packId) => {
            try {
                // Get the pack instance for proper cleanup
                const pack = this.universalRenderer.registeredAssetPacks.get(packId);
                const assetPackInstance = this.activeAssetPacks.get(packId);

                // Properly cleanup pack instances (this will unregister positions)
                if (pack && assetPackInstance) {
                    // Find all active instances for this pack and clean them up
                    for (const [instanceId, instance] of pack.activeInstances) {
                        pack.cleanup(instanceId);
                    }
                }

                // Remove from active packs
                this.activeAssetPacks.delete(packId);
                this.universalRenderer.activeAssetPacks.delete(packId);

                // Update context to remove this pack's prompts
                this.updateAssetPackContext();

                // Remove any remaining rendered UI elements (fallback)
                const renderedElements = document.querySelectorAll(`[data-pack-id="${packId}"]`);
                renderedElements.forEach(element => element.remove());

                // Show notification
                const displayName = pack?.metadata?.displayName || packId;
                this.showPackNotification(`🚫 ${displayName} deactivated`, 'info');

                console.log(`[Ember 2.0] Deactivated pack: ${packId}`);

                // Refresh the library if open to update activation status
                this.updatePackLibrary();

            } catch (error) {
                console.error('[Ember 2.0] Failed to deactivate pack:', error);
                this.showPackNotification(`⚠️ Failed to deactivate pack: ${error.message}`, 'warning');
            }
        };
    }

    /**
     * Get emoji for pack based on tags
     */
    getPackEmoji(tags = []) {
        const emojiMap = {
            'dating': '💕',
            'rpg': '⚔️',
            'pet': '🐾',
            'space': '🚀',
            'cooking': '👨‍🍳',
            'fitness': '💪',
            'business': '🏢',
            'inventory': '🎒',
            'stats': '📊',
            'simulation': '🎮',
            'health': '❤️',
            'food': '🍳',
            'exercise': '🏃',
            'sci-fi': '🛸',
            'adventure': '🗺️'
        };

        for (const tag of tags) {
            if (emojiMap[tag]) {
                return emojiMap[tag];
            }
        }

        return '📦'; // Default emoji
    }

    /**
     * Update pack library display
     */
    updatePackLibrary() {
        // Refresh the library if it's open
        if ($('#ember2-library-dialog').length > 0) {
            $('#ember2-library-dialog, #ember2-library-backdrop').remove();
            this.showPackLibrary();
        }
    }

    /**
     * Load settings
     */
    loadSettings() {
        // Use NemoPresetExt namespace instead of standalone Ember namespace
        if (extension_settings.NemoPresetExt?.ember) {
            Object.assign(this.settings, extension_settings.NemoPresetExt.ember);
        }

        // UI updates handled by NemoPresetExt settings system
        // $('#ember2-enabled').prop('checked', this.settings.enabled);
        // $('#ember2-auto-detect').prop('checked', this.settings.autoDetect);

        console.log('[Ember 2.0] Settings loaded:', this.settings);
    }

    /**
     * Save settings
     */
    saveSettings() {
        // Store Ember settings under NemoPresetExt namespace
        if (!extension_settings.NemoPresetExt) {
            extension_settings.NemoPresetExt = {};
        }
        extension_settings.NemoPresetExt.ember = { ...this.settings };
        saveSettingsDebounced();
        console.log('[Ember 2.0] Settings saved');
    }

    /**
     * Load built-in templates and examples
     */
    async loadBuiltinTemplates() {
        try {
            // Load the enhanced dating sim template
            const { createEnhancedDatingSimPack } = await import('./templates/dating-sim-enhanced.js');

            const datingSim = createEnhancedDatingSimPack({
                characterName: 'Character',
                position: 'end'
            });

            this.universalRenderer.registerAssetPack(datingSim);
            console.log('[Ember 2.0] Loaded built-in template: Enhanced Dating Sim');

            // Load example asset pack library
            const { getAllExamplePacks } = await import('./templates/ExampleAssetPacks.js');
            const examplePacks = getAllExamplePacks();

            for (const pack of examplePacks) {
                this.universalRenderer.registerAssetPack(pack);
                console.log(`[Ember 2.0] Loaded example pack: ${pack.metadata.displayName}`);
            }

            console.log(`[Ember 2.0] Loaded ${examplePacks.length} example asset packs`);

        } catch (error) {
            console.warn('[Ember 2.0] Failed to load built-in templates:', error);
        }
    }

    /**
     * Set up continuous context injection for active asset packs
     */
    setupContextInjection() {
        // Update context whenever message generation starts
        if (window.eventSource) {
            window.eventSource.on('MESSAGE_SENDING', () => {
                this.updateAssetPackContext();
            });

            // Also update on chat changes to handle new conversations
            window.eventSource.on('CHAT_CHANGED', () => {
                this.updateAssetPackContext();
            });
        }

        console.log('[Ember 2.0] Context injection system initialized');
    }

    /**
     * Update extension prompts with active asset pack context
     */
    updateAssetPackContext() {
        try {
            // Clear any existing asset pack prompts
            this.clearAssetPackContext();

            // Add prompts for each active asset pack
            for (const [packId, assetPackInstance] of this.activeAssetPacks) {
                const pack = this.universalRenderer.registeredAssetPacks.get(packId);
                if (!pack || !pack.chatInjection) continue;

                // Build context content with current state
                let contextContent = '';

                // Part 1: Current state information for LLM
                if (pack.chatInjection.template) {
                    contextContent += `📱 Active Asset Pack: ${pack.metadata?.displayName || pack.id}\n\n`;

                    // Substitute variables in template with current state values
                    let processedTemplate = pack.chatInjection.template.trim();
                    if (assetPackInstance && assetPackInstance.state) {
                        for (const [varName, value] of Object.entries(assetPackInstance.state)) {
                            const placeholder = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
                            let displayValue = value;
                            if (Array.isArray(value)) {
                                displayValue = value.join(', ');
                            }
                            processedTemplate = processedTemplate.replace(placeholder, displayValue);
                        }
                    }

                    contextContent += processedTemplate + '\n\n';
                }

                // Part 2: Update instructions for LLM
                if (pack.chatInjection.instructions) {
                    contextContent += 'Asset Pack Update Instructions:\n';
                    contextContent += pack.chatInjection.instructions.trim() + '\n\n';
                    contextContent += 'Use [STATE_UPDATE] tags in your responses to update the asset pack state.\n';
                    contextContent += 'Example: [STATE_UPDATE] VarName +5 [/STATE_UPDATE]\n';
                }

                // Inject at depth 0 (system level) using SillyTavern's extension prompt system
                const promptKey = `EMBER_ASSET_PACK_${packId.toUpperCase()}`;

                // Check if SillyTavern's setExtensionPrompt is available
                if (typeof setExtensionPrompt === 'function' && typeof extension_prompt_types !== 'undefined') {
                    setExtensionPrompt(
                        promptKey,
                        contextContent,
                        extension_prompt_types.IN_CHAT,
                        0, // depth 0 = system level
                        false, // don't scan for world info
                        extension_prompt_roles?.SYSTEM || 'system'
                    );

                    console.log(`[Ember 2.0] Updated context for active pack: ${pack.metadata?.displayName || packId}`);
                } else {
                    console.warn('[Ember 2.0] SillyTavern context injection not available');
                }
            }
        } catch (error) {
            console.error('[Ember 2.0] Failed to update asset pack context:', error);
        }
    }

    /**
     * Clear all asset pack context prompts
     */
    clearAssetPackContext() {
        try {
            if (typeof setExtensionPrompt === 'function' && typeof extension_prompt_types !== 'undefined') {
                // Clear prompts for all registered packs
                for (const packId of this.universalRenderer.registeredAssetPacks.keys()) {
                    const promptKey = `EMBER_ASSET_PACK_${packId.toUpperCase()}`;
                    setExtensionPrompt(promptKey, '', extension_prompt_types.IN_CHAT, 0);
                }
            }
        } catch (error) {
            console.error('[Ember 2.0] Failed to clear asset pack context:', error);
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Clean up all active renders
        for (const [messageId] of this.activeRenders) {
            this.universalRenderer.cleanup(messageId);
        }
        this.activeRenders.clear();

        // Clear active asset packs and context
        this.activeAssetPacks.clear();
        this.clearAssetPackContext();

        console.log('[Ember 2.0] Cleaned up resources');
    }
}


// Export the class for integration with NemoPresetExt
export { Ember2Extension };
