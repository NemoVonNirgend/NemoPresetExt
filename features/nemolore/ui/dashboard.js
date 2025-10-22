// NOTE: Core SillyTavern functions (saveSettingsDebounced, callPopup) are globally available.

import { extension_settings, getContext } from '../../../../../../../scripts/extensions.js';
import { callGenericPopup, POPUP_TYPE } from '../../../../../../../scripts/popup.js';
import { APIManager } from '../api-manager.js';

export class DashboardManager {
    constructor(settings, state, uiManager, autoLorebookManager, settingsManager = null) {
        this.settings = settings;
        this.state = state;
        this.uiManager = uiManager;
        this.autoLorebookManager = autoLorebookManager;
        this.settingsManager = settingsManager;
        this.apiManager = new APIManager(settings);
        this.isInitialized = false;
        this.config = { containerId: 'nemolore-dashboard' };
    }

    async initialize() {
        if (this.isInitialized) return;

        // Initialize API Manager with preset switching
        await this.apiManager.initialize();
        console.log('[NemoLore Dashboard Manager] API Manager initialized with preset switching');

        await this.render();
        this.bindEvents();
        this.isInitialized = true;
        console.log('[NemoLore Dashboard Manager] Initialized successfully');
    }

    async render() {
        console.log('[NemoLore Dashboard] Starting render...');
        console.log('🚨 [NemoLore Dashboard] RENDER CALLED');

        // Create or get backdrop
        let backdrop = document.getElementById('nemolore-dashboard-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'nemolore-dashboard-backdrop';
            backdrop.className = 'nemolore-dashboard-backdrop';
            backdrop.style.display = 'none';
            document.body.appendChild(backdrop);
        }

        let container = document.getElementById(this.config.containerId);
        if (!container) {
            console.log('🚨 [NemoLore Dashboard] Creating new container');
            container = document.createElement('div');
            container.id = this.config.containerId;
            container.className = 'nemolore-advanced-dashboard';
            container.style.display = 'none';
            container.style.flexDirection = 'column';
            container.style.position = 'fixed';
            container.style.zIndex = '10000';
            document.body.appendChild(container);
            console.log('🚨 [NemoLore Dashboard] Container appended to body');
        } else {
            console.log('🚨 [NemoLore Dashboard] Using existing container');
        }

        container.innerHTML = `
            <div class="nemolore-dashboard-header">
                <div class="nemolore-dashboard-tabs">
                    <button class="nemolore-tab-button active" data-tab="overview"><i class="fa-solid fa-chart-pie"></i> Overview</button>
                    <button class="nemolore-tab-button" data-tab="quality"><i class="fa-solid fa-shield-alt"></i> Quality</button>
                    <button class="nemolore-tab-button" data-tab="settings"><i class="fa-solid fa-sliders"></i> NemoLore</button>
                    <button class="nemolore-tab-button" data-tab="prosepolisher"><i class="fa-solid fa-spell-check"></i> ProsePolisher</button>
                    <button class="nemolore-tab-button" data-tab="api"><i class="fa-solid fa-bolt"></i> API</button>
                    <button class="nemolore-tab-button" data-tab="debug"><i class="fa-solid fa-bug"></i> Debug</button>
                </div>
                <div class="nemolore-dashboard-actions">
                    <button id="nemolore_close_dashboard" class="nemolore-action-btn" title="Close Dashboard"><i class="fa-solid fa-times"></i></button>
                </div>
            </div>
            <div class="nemolore-dashboard-content">
                <div id="nemolore-tab-overview" class="nemolore-tab-content active"></div>
                <div id="nemolore-tab-quality" class="nemolore-tab-content"></div>
                <div id="nemolore-tab-settings" class="nemolore-tab-content"></div>
                <div id="nemolore-tab-prosepolisher" class="nemolore-tab-content"></div>
                <div id="nemolore-tab-api" class="nemolore-tab-content"></div>
                <div id="nemolore-tab-debug" class="nemolore-tab-content"></div>
            </div>`;

        console.log('[NemoLore Dashboard] Rendering settings tabs...');
        document.getElementById('nemolore-tab-settings').innerHTML = this.generateSettingsHTML();
        document.getElementById('nemolore-tab-api').innerHTML = this.generateApiSettingsHTML();

        console.log('[NemoLore Dashboard] Loading ProsePolisher settings...');
        console.log('[NemoLore Dashboard] 🚨 EMERGENCY: About to load ProsePolisher settings');
        // Load ProsePolisher settings from original HTML file
        await this.loadProsePolisherSettings();
        console.log('[NemoLore Dashboard] 🚨 EMERGENCY: ProsePolisher settings load complete');

        console.log('[NemoLore Dashboard] Updating overview and populating values...');
        this.updateOverviewContent(document.getElementById('nemolore-tab-overview'));
        this.populateSettingsValues();

        console.log('[NemoLore Dashboard] Render complete');
    }

    bindEvents() {
        const container = document.getElementById(this.config.containerId);
        if (!container) return;

        // Close dashboard button
        container.querySelector('#nemolore_close_dashboard')?.addEventListener('click', () => {
            container.style.display = 'none';
            const backdrop = document.getElementById('nemolore-dashboard-backdrop');
            if (backdrop) backdrop.style.display = 'none';
        });

        // Hide dashboard when other drawers are clicked (Extensions, etc.)
        // This prevents the dashboard from overlaying other content
        document.addEventListener('click', (e) => {
            // Check if a drawer toggle was clicked (but not the NemoLore dashboard toggle)
            const drawerToggle = e.target.closest('.drawer-toggle');
            if (drawerToggle) {
                const isNemoLoreToggle = drawerToggle.closest('#nemolore-button');
                if (!isNemoLoreToggle) {
                    // A different drawer was clicked, hide the NemoLore dashboard
                    container.style.display = 'none';
                    const backdrop = document.getElementById('nemolore-dashboard-backdrop');
                    if (backdrop) backdrop.style.display = 'none';
                    console.log('[NemoLore Dashboard] Hidden due to other drawer opening');
                }
            }
        });

        container.querySelectorAll('.nemolore-tab-button').forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });

        container.querySelectorAll('.nemolore-toggle-input').forEach(toggle => {
            toggle.addEventListener('change', (event) => {
                this.settings[event.target.dataset.setting] = event.target.checked;
                this.saveSettings();
                if (event.target.dataset.setting === 'enable_async_api') {
                    document.getElementById('nemolore_async_api_container').style.display = event.target.checked ? 'block' : 'none';
                }
                if (event.target.dataset.setting === 'useProjectGremlinForLorebook') {
                    document.getElementById('nemolore_gremlin_stages_container').style.display = event.target.checked ? 'block' : 'none';
                }
                if (event.target.dataset.setting === 'highlightNouns') {
                    // Refresh highlighting when toggled
                    const nounHighlightingManager = window.nemoLoreWorkflowState?.nounHighlightingManager;
                    if (nounHighlightingManager) {
                        if (event.target.checked) {
                            nounHighlightingManager.refreshChatHighlighting();
                        } else {
                            nounHighlightingManager.clearAllHighlighting();
                        }
                    }
                }
            });
        });

        container.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (event) => {
                const output = document.getElementById(`${event.target.id}_output`);
                if (output) output.textContent = event.target.value;
            });
            slider.addEventListener('change', (event) => {
                this.settings[event.target.dataset.setting] = parseInt(event.target.value, 10);
                this.saveSettings();
            });
        });

        // Bind NemoLore action buttons with error handling
        const viewSummariesBtn = container.querySelector('#nemolore_view_summaries');
        const exportSummariesBtn = container.querySelector('#nemolore_export_summaries');
        const systemCheckBtn = container.querySelector('#nemolore_system_check');

        if (viewSummariesBtn) {
            viewSummariesBtn.addEventListener('click', () => {
                console.log('[NemoLore Dashboard] View Summaries button clicked');
                this.uiManager.showSummaryViewer();
            });
            console.log('[NemoLore Dashboard] View Summaries button bound');
        } else {
            console.warn('[NemoLore Dashboard] View Summaries button not found');
        }

        if (exportSummariesBtn) {
            exportSummariesBtn.addEventListener('click', () => {
                console.log('[NemoLore Dashboard] Export Summaries button clicked');
                this.uiManager.exportSummariesToJSON();
            });
            console.log('[NemoLore Dashboard] Export Summaries button bound');
        } else {
            console.warn('[NemoLore Dashboard] Export Summaries button not found');
        }

        if (systemCheckBtn) {
            systemCheckBtn.addEventListener('click', () => {
                console.log('[NemoLore Dashboard] System Check button clicked');
                this.uiManager.runSystemCheck();
            });
            console.log('[NemoLore Dashboard] System Check button bound');
        } else {
            console.warn('[NemoLore Dashboard] System Check button not found');
        }

        container.querySelectorAll('#nemolore-tab-api [data-setting]').forEach(input => {
            if (input.tagName === 'SELECT' || input.type === 'text' || input.type === 'password') {
                input.addEventListener('change', (event) => {
                    this.settings[event.target.dataset.setting] = event.target.value;
                    this.saveSettings();
                });
            }
        });
        
        // Bind API tab buttons
        const apiProviderSelect = container.querySelector('#nemolore_async_api_provider');
        const refreshModelsBtn = container.querySelector('#nemolore_refresh_models');
        const testApiBtn = container.querySelector('#nemolore_test_async_api');

        if (apiProviderSelect) {
            apiProviderSelect.addEventListener('change', () => {
                console.log('[NemoLore Dashboard] API Provider changed');
                this.fetchModelsForProvider();
            });
            console.log('[NemoLore Dashboard] API Provider selector bound');
        } else {
            console.warn('[NemoLore Dashboard] API Provider selector not found');
        }

        if (refreshModelsBtn) {
            refreshModelsBtn.addEventListener('click', () => {
                console.log('[NemoLore Dashboard] Refresh Models button clicked');
                this.fetchModelsForProvider(true);
            });
            console.log('[NemoLore Dashboard] Refresh Models button bound');
        } else {
            console.warn('[NemoLore Dashboard] Refresh Models button not found');
        }

        if (testApiBtn) {
            testApiBtn.addEventListener('click', () => {
                console.log('[NemoLore Dashboard] Test API button clicked');
                this.testApiConnection();
            });
            console.log('[NemoLore Dashboard] Test API button bound');
        } else {
            console.warn('[NemoLore Dashboard] Test API button not found');
        }

        // Note: ProsePolisher events are bound by ProsePolisher's own initialization code

        this.bindOverviewActions();
    }
    
    bindOverviewActions() {
        console.log('[NemoLore Dashboard] bindOverviewActions() called');
        const overviewTab = document.getElementById('nemolore-tab-overview');
        if (!overviewTab) {
            console.warn('[NemoLore Dashboard] Overview tab not found');
            return;
        }

        const buttons = overviewTab.querySelectorAll('.action-button');
        console.log('[NemoLore Dashboard] Found', buttons.length, 'action buttons');
        console.log('[NemoLore Dashboard] Button elements:', buttons);

        // Don't clone - just bind directly like Quality tab does
        buttons.forEach((button, index) => {
            const action = button.dataset.action;
            console.log(`[NemoLore Dashboard] Binding action button ${index}: ${action}`);
            console.log(`[NemoLore Dashboard] Button element:`, button);

            // Remove old listeners by cloning just this button
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            // Add listener to the new button
            newButton.addEventListener('click', (event) => {
                console.log('[NemoLore Dashboard] 🎯 Quick Action button clicked:', action);
                console.log('[NemoLore Dashboard] Event target:', event.target);
                console.log('[NemoLore Dashboard] this.handleQuickAction:', typeof this.handleQuickAction);
                console.log('[NemoLore Dashboard] this.autoLorebookManager:', !!this.autoLorebookManager);

                try {
                    this.handleQuickAction(action);
                } catch (error) {
                    console.error('[NemoLore Dashboard] ❌ Error in handleQuickAction:', error);
                    console.error('[NemoLore Dashboard] Stack:', error.stack);
                }
            });

            console.log(`[NemoLore Dashboard] ✅ Listener added to button ${index}`);
        });

        console.log('[NemoLore Dashboard] bindOverviewActions() complete');
    }

    /**
     * Load ProsePolisher settings from the original HTML file
     */
    async loadProsePolisherSettings() {
        console.log('[NemoLore Dashboard] loadProsePolisherSettings() called');

        try {
            const settingsPath = 'scripts/extensions/third-party/NemoPresetExt/features/prosepolisher/settings.html';
            console.log('[NemoLore Dashboard] Fetching from path:', settingsPath);

            const response = await fetch(settingsPath);
            console.log('[NemoLore Dashboard] Fetch response status:', response.status);

            if (!response.ok) {
                throw new Error(`Failed to load ProsePolisher settings: ${response.status}`);
            }

            const htmlContent = await response.text();
            console.log('[NemoLore Dashboard] HTML content loaded, length:', htmlContent.length);

            // Inject the HTML into the ProsePolisher tab
            const prosePolisherTab = document.getElementById('nemolore-tab-prosepolisher');
            console.log('[NemoLore Dashboard] ProsePolisher tab element:', prosePolisherTab);

            if (prosePolisherTab) {
                prosePolisherTab.innerHTML = htmlContent;
                console.log('[NemoLore Dashboard] ProsePolisher settings HTML injected successfully');
                console.log('[NemoLore Dashboard] Tab innerHTML length:', prosePolisherTab.innerHTML.length);

                // Wait for the HTML to settle in the DOM, then wait for ProsePolisher to initialize
                console.log('🚨 [NemoLore Dashboard] About to schedule initializeProsePolisherUI...');
                requestAnimationFrame(() => {
                    console.log('🚨 [NemoLore Dashboard] First RAF fired');
                    requestAnimationFrame(() => {
                        console.log('🚨 [NemoLore Dashboard] Second RAF fired, waiting for ProsePolisher to initialize...');
                        // ProsePolisher initializes asynchronously - poll for it to be ready
                        this.waitForProsePolisherAndInitialize();
                    });
                });
            } else {
                console.error('[NemoLore Dashboard] ProsePolisher tab element not found!');
            }
        } catch (error) {
            console.error('[NemoLore Dashboard] ❌ Failed to load ProsePolisher settings:', error);
            console.error('[NemoLore Dashboard] Error stack:', error.stack);

            // Fallback message
            const prosePolisherTab = document.getElementById('nemolore-tab-prosepolisher');
            if (prosePolisherTab) {
                prosePolisherTab.innerHTML = `
                    <div class="nemolore-settings-panel">
                        <h3>⚠️ ProsePolisher Settings</h3>
                        <p style="color: #9ca3af;">Failed to load ProsePolisher settings. Please check console for errors.</p>
                        <p style="color: #9ca3af;">Error: ${error.message}</p>
                    </div>
                `;
                console.log('[NemoLore Dashboard] Error fallback message inserted');
            }
        }
    }

    /**
     * Wait for ProsePolisher to finish initializing, then initialize its UI
     * Uses polling with timeout to handle async initialization
     */
    waitForProsePolisherAndInitialize(attempts = 0, maxAttempts = 50) {
        const checkInterval = 100; // Check every 100ms

        console.log(`🚨 [NemoLore Dashboard] Polling for ProsePolisher... (attempt ${attempts + 1}/${maxAttempts})`);

        if (window.ProsePolisher) {
            console.log('🚨 [NemoLore Dashboard] ✅ ProsePolisher found! Initializing UI...');
            this.initializeProsePolisherUI();
            return;
        }

        if (attempts >= maxAttempts) {
            console.error(`🚨 [NemoLore Dashboard] ❌ ProsePolisher not found after ${maxAttempts} attempts (${maxAttempts * checkInterval}ms)`);
            console.error('🚨 [NemoLore Dashboard] ProsePolisher may have failed to initialize - showing error message');
            // Call initializeProsePolisherUI anyway so it can show the error message
            this.initializeProsePolisherUI();
            return;
        }

        // Try again after a short delay
        setTimeout(() => {
            this.waitForProsePolisherAndInitialize(attempts + 1, maxAttempts);
        }, checkInterval);
    }

    /**
     * Initialize ProsePolisher UI after HTML injection
     * This manually recreates ProsePolisher's initialization logic for the dashboard
     */
    async initializeProsePolisherUI() {
        console.log('🚨 [NemoLore Dashboard] ========== initializeProsePolisherUI CALLED ==========');

        let settings;
        try {
            console.log('🚨 [NemoLore Dashboard] Step 1: Checking extension_settings...');

            // Try multiple ways to access extension_settings
            const ext_settings = extension_settings || window.extension_settings || getContext()?.extension_settings;
            console.log('🚨 [NemoLore Dashboard] Step 2: ext_settings obtained:', !!ext_settings);

            if (!ext_settings) {
                console.error('🚨 [NemoLore Dashboard] ❌ Cannot access extension_settings at all!');
                console.log('🚨 [NemoLore Dashboard] extension_settings:', typeof extension_settings);
                console.log('🚨 [NemoLore Dashboard] window.extension_settings:', typeof window.extension_settings);
                console.log('🚨 [NemoLore Dashboard] getContext():', typeof getContext);
                return;
            }

            console.log('🚨 [NemoLore Dashboard] Step 3: Checking for ProsePolisher...');
            settings = ext_settings.ProsePolisher;

            if (!settings) {
                console.error('🚨 [NemoLore Dashboard] ❌ ProsePolisher settings not found in extension_settings');
                console.log('🚨 [NemoLore Dashboard] Available keys:', Object.keys(ext_settings).filter(k => k.includes('Prose') || k.includes('Nemo')));
                return;
            }

            console.log('🚨 [NemoLore Dashboard] ✅ ProsePolisher settings found!');
            console.log('[NemoLore Dashboard] Initializing ProsePolisher UI...');
        } catch (topError) {
            console.error('🚨🚨🚨 [NemoLore Dashboard] CRITICAL ERROR at start:', topError);
            console.error('🚨🚨🚨 Stack:', topError.stack);
            console.error('🚨🚨🚨 Error message:', topError.message);
            return;
        }

        try {
            // Verify the ProsePolisher tab content container exists
            const prosePolisherTab = document.getElementById('nemolore-tab-prosepolisher');
            if (!prosePolisherTab) {
                console.error('[NemoLore Dashboard] ProsePolisher tab container not found!');
                return;
            }

            // Verify key elements exist within the tab
            const testButton = document.getElementById('prose_polisher_open_navigator_button');
            console.log('[NemoLore Dashboard] Navigator button element:', testButton);

            const allButtons = [
                'prose_polisher_open_navigator_button',
                'prose_polisher_analyze_chat_button',
                'prose_polisher_view_frequency_button',
                'prose_polisher_manage_whitelist_button',
                'prose_polisher_manage_blacklist_button',
                'prose_polisher_clear_frequency_button'
            ];

            console.log('[NemoLore Dashboard] Checking all button elements...');
            let allButtonsFound = true;
            allButtons.forEach(id => {
                const el = document.getElementById(id);
                const found = !!el;
                console.log(`  ${id}: ${found ? 'FOUND' : 'NOT FOUND'}`);
                if (!found) allButtonsFound = false;
            });

            if (!allButtonsFound) {
                console.error('[NemoLore Dashboard] Not all button elements were found! Event binding may fail.');
            }

            // Get ProsePolisher state reference
            // NOTE: ProsePolisher is exposed as window.ProsePolisher (not window.prosePolisherState)
            const ppExtension = window.ProsePolisher;
            const ppState = ppExtension?.state;

            console.log('🚨 [NemoLore Dashboard] Step 4: ProsePolisher state check:', {
                ppExtension: !!ppExtension,
                ppState: !!ppState,
                regexNavigator: !!ppState?.regexNavigator,
                uiManager: !!ppState?.uiManager,
                prosePolisherAnalyzer: !!ppState?.prosePolisherAnalyzer
            });

            if (!ppExtension) {
                console.error('🚨 [NemoLore Dashboard] ❌ window.ProsePolisher not found!');
                console.log('🚨 [NemoLore Dashboard] Available window props:', Object.keys(window).filter(k => k.includes('Prose') || k.includes('prose')));
                console.log('🚨 [NemoLore Dashboard] ProsePolisher may be disabled or failed to initialize');

                // Show user-friendly error message in the tab
                const prosePolisherTab = document.getElementById('nemolore-tab-prosepolisher');
                if (prosePolisherTab) {
                    prosePolisherTab.innerHTML = `
                        <div class="nemolore-settings-panel" style="text-align: center; padding: 60px 20px;">
                            <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">
                                <i class="fa-solid fa-exclamation-triangle"></i>
                            </div>
                            <h3 style="color: #dc2626; margin-bottom: 15px;">ProsePolisher Not Available</h3>
                            <p style="color: #9ca3af; margin-bottom: 25px; max-width: 600px; margin-left: auto; margin-right: auto;">
                                ProsePolisher is either disabled in settings or failed to initialize during startup.
                            </p>
                            <div style="background: #1f2937; border: 1px solid #374151; border-radius: 8px; padding: 20px; max-width: 600px; margin: 0 auto; text-align: left;">
                                <h4 style="margin-top: 0; color: #f3f4f6;"><i class="fa-solid fa-tools"></i> Troubleshooting Steps:</h4>
                                <ol style="color: #d1d5db; line-height: 1.8;">
                                    <li>Open your browser's console (F12) and look for ProsePolisher error messages</li>
                                    <li>Check if you see <code style="background: #111827; padding: 2px 6px; border-radius: 3px;">🚨 [NemoPresetExt] enableProsePolisher setting: false</code> - if so, ProsePolisher is disabled</li>
                                    <li>Look for errors starting with <code style="background: #111827; padding: 2px 6px; border-radius: 3px;">🚨 [NemoPresetExt] ❌ ProsePolisher initialization FAILED</code></li>
                                    <li>Try reloading SillyTavern to see if it resolves the issue</li>
                                </ol>
                            </div>
                            <button class="menu_button" style="margin-top: 25px;" onclick="location.reload()">
                                <i class="fa-solid fa-sync"></i> Reload SillyTavern
                            </button>
                        </div>
                    `;
                }
                return;
            }

            if (!ppState) {
                console.error('🚨 [NemoLore Dashboard] ❌ ProsePolisher.state not found!');
                return;
            }

            if (!ppState.regexNavigator) {
                console.error('[NemoLore Dashboard] ppState.regexNavigator not initialized!');
                return;
            }

            console.log('[NemoLore Dashboard] Importing ProsePolisher modules...');
            // Re-import necessary modules dynamically
            // Path from features/nemolore/ui/ to features/prosepolisher/src/
            const initializationModule = await import('../../prosepolisher/src/initialization.js');
            const eventsModule = await import('../../prosepolisher/src/events.js');
            console.log('[NemoLore Dashboard] Modules imported successfully');

            console.log('[NemoLore Dashboard] Calling initializeEventListeners()...');
            // Re-bind event listeners to the new HTML elements
            let eventBindingSuccess = false;
            try {
                eventsModule.initializeEventListeners();
                console.log('[NemoLore Dashboard] ✅ Event listeners initialized successfully');
                eventBindingSuccess = true;
            } catch (eventError) {
                console.error('[NemoLore Dashboard] ❌ Error during event listener initialization:', eventError);
                console.error('[NemoLore Dashboard] Stack trace:', eventError.stack);
                console.log('[NemoLore Dashboard] Will use fallback event binding...');
            }

            // FALLBACK: Only bind events directly if the event module failed
            if (!eventBindingSuccess) {
                console.log('🚨 [NemoLore Dashboard] 🔧 Using fallback event binding...');
                this.bindProsePolisherEventsFallback(ppState);
                console.log('🚨 [NemoLore Dashboard] ✅ Fallback event binding completed');
            } else {
                console.log('🚨 [NemoLore Dashboard] ✅ Using standard event binding (fallback not needed)');
            }

            // Verify button has listeners now
            const navigatorBtn = document.getElementById('prose_polisher_open_navigator_button');
            if (navigatorBtn) {
                console.log('[NemoLore Dashboard] Checking if button has pointerup listener...');
                // Manually test by clicking
                console.log('[NemoLore Dashboard] Try clicking the "Manage Text Rules" button now');
            }

            console.log('🚨 [NemoLore Dashboard] Step 5: Setting up UI controls...');
            // Call setupUIControls to populate form values
            if (ppExtension && typeof ppExtension.setupUIControls === 'function') {
                await ppExtension.setupUIControls(settings);
                console.log('🚨 [NemoLore Dashboard] ✅ UI controls setup complete');
            } else {
                console.warn('🚨 [NemoLore Dashboard] ⚠️ setupUIControls not available');
            }

            console.log('🚨 [NemoLore Dashboard] Step 6: Setting up regex generation controls...');
            // Setup regex generation controls
            if (ppExtension && typeof ppExtension.setupRegexGenerationControls === 'function') {
                await ppExtension.setupRegexGenerationControls(settings);
                console.log('🚨 [NemoLore Dashboard] ✅ Regex generation controls setup complete');
            } else {
                console.warn('🚨 [NemoLore Dashboard] ⚠️ setupRegexGenerationControls not available');
            }

            console.log('[NemoLore Dashboard] Initializing Project Gremlin...');
            // Re-initialize Project Gremlin
            if (typeof initializationModule.initializeProjectGremlin === 'function') {
                const { updateGremlinSettingsVisibility } = await initializationModule.initializeProjectGremlin(
                    settings,
                    ppState.uiManager.showApiEditorPopup.bind(ppState.uiManager),
                    ppState.uiManager.showInstructionsEditorPopup.bind(ppState.uiManager),
                    ppState.uiManager.updateGremlinApiDisplay.bind(ppState.uiManager)
                );

                console.log('[NemoLore Dashboard] Project Gremlin initialized');

                // Update Gremlin settings visibility
                if (updateGremlinSettingsVisibility) {
                    updateGremlinSettingsVisibility();
                }
            } else {
                console.warn('[NemoLore Dashboard] initializeProjectGremlin not available');
            }

            console.log('[NemoLore Dashboard] Updating regex generation controls visibility...');
            // Update regex generation controls visibility
            if (ppExtension && typeof ppExtension.updateRegexGenControlsVisibility === 'function') {
                ppExtension.updateRegexGenControlsVisibility(settings);
            }

            console.log('[NemoLore Dashboard] ✅ ProsePolisher UI initialized successfully');
            console.log('[NemoLore Dashboard] You can now test the buttons');
        } catch (error) {
            console.error('[NemoLore Dashboard] ❌ Error initializing ProsePolisher UI:', error);
            console.error('[NemoLore Dashboard] Stack trace:', error.stack);
        }
    }

    /**
     * Fallback event binding for ProsePolisher buttons
     * This bypasses the events.js module and binds directly
     */
    bindProsePolisherEventsFallback(ppState) {
        console.log('🚨🚨🚨 [NemoLore Dashboard] FALLBACK FUNCTION ENTERED 🚨🚨🚨');
        console.log('[NemoLore Dashboard] 🔧 FALLBACK: Binding ProsePolisher events directly...');

        if (!ppState) {
            console.error('🚨 [NemoLore Dashboard] ❌ FALLBACK: ppState not available');
            console.error('🚨 [NemoLore Dashboard] ppState value:', ppState);
            return;
        }

        console.log('🚨 [NemoLore Dashboard] ✅ FALLBACK: ppState is available, proceeding with binding...');

        // Button IDs and their handlers
        const buttonBindings = [
            {
                id: 'prose_polisher_open_navigator_button',
                handler: () => {
                    console.log('[NemoLore Dashboard] 🎯 FALLBACK: Navigator button clicked!');
                    try {
                        if (!ppState.regexNavigator) {
                            console.error('[NemoLore Dashboard] regexNavigator not available');
                            window.toastr?.error('Text Rules navigator not initialized');
                            return;
                        }
                        ppState.regexNavigator.open();
                    } catch (error) {
                        console.error('[NemoLore Dashboard] Error opening navigator:', error);
                        window.toastr?.error('Error opening text rules navigator');
                    }
                },
                name: 'Navigator'
            },
            {
                id: 'prose_polisher_analyze_chat_button',
                handler: () => {
                    console.log('[NemoLore Dashboard] 🎯 FALLBACK: Analyze Chat button clicked!');
                    ppState.prosePolisherAnalyzer?.manualAnalyzeChatHistory();
                },
                name: 'Analyze Chat'
            },
            {
                id: 'prose_polisher_view_frequency_button',
                handler: () => {
                    console.log('[NemoLore Dashboard] 🎯 FALLBACK: View Frequency button clicked!');
                    ppState.uiManager?.showFrequencyLeaderboard();
                },
                name: 'View Frequency'
            },
            {
                id: 'prose_polisher_manage_whitelist_button',
                handler: () => {
                    console.log('[NemoLore Dashboard] 🎯 FALLBACK: Whitelist button clicked!');
                    ppState.uiManager?.showWhitelistManager();
                },
                name: 'Whitelist Manager'
            },
            {
                id: 'prose_polisher_manage_blacklist_button',
                handler: () => {
                    console.log('[NemoLore Dashboard] 🎯 FALLBACK: Blacklist button clicked!');
                    ppState.uiManager?.showBlacklistManager();
                },
                name: 'Blacklist Manager'
            },
            {
                id: 'prose_polisher_clear_frequency_button',
                handler: () => {
                    console.log('[NemoLore Dashboard] 🎯 FALLBACK: Clear Frequency button clicked!');
                    ppState.prosePolisherAnalyzer?.clearFrequencyData();
                },
                name: 'Clear Frequency'
            }
        ];

        // Bind all buttons
        let successCount = 0;
        let failCount = 0;

        buttonBindings.forEach(({ id, handler, name }) => {
            const button = document.getElementById(id);
            if (button) {
                // Remove any existing listeners by cloning
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);

                // Add new listener
                newButton.addEventListener('click', handler);
                newButton.addEventListener('pointerup', handler);

                console.log(`[NemoLore Dashboard] ✅ FALLBACK: ${name} button bound successfully`);
                successCount++;
            } else {
                console.error(`[NemoLore Dashboard] ❌ FALLBACK: ${name} button (${id}) not found`);
                failCount++;
            }
        });

        console.log(`[NemoLore Dashboard] 🔧 FALLBACK: Bound ${successCount} buttons, ${failCount} failed`);
    }

    generateSettingsHTML() {
        return `
            <div class="nemolore-settings-container">
                <!-- Core Settings Section -->
                <div class="nemolore-settings-section">
                    <div class="nemolore-section-header">
                        <div class="nemolore-section-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <i class="fa-solid fa-brain"></i>
                        </div>
                        <div class="nemolore-section-title">
                            <h3>Core Settings</h3>
                            <p>Essential NemoLore functionality</p>
                        </div>
                    </div>
                    <div class="nemolore-settings-content">
                        ${this.createToggle('enabled', 'Enable NemoLore', 'Master switch for all NemoLore features')}
                        ${this.createToggle('auto_summarize', 'Auto Summarize New Chats', 'Automatically start summarizing when a new chat begins')}
                        ${this.createToggle('auto_lorebook', 'Auto-Create Lorebook for New Chats', 'Generate lorebook entries from new conversations')}
                        ${this.createToggle('debugMode', 'Enable Debug Mode', 'Show detailed logs in browser console')}
                    </div>
                </div>

                <!-- Summarization Settings Section -->
                <div class="nemolore-settings-section">
                    <div class="nemolore-section-header">
                        <div class="nemolore-section-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                            <i class="fa-solid fa-file-lines"></i>
                        </div>
                        <div class="nemolore-section-title">
                            <h3>Summarization</h3>
                            <p>Control how messages are summarized</p>
                        </div>
                    </div>
                    <div class="nemolore-settings-content">
                        ${this.createToggle('enable_summarization', 'Enable Smart Summarization', 'Use AI to create intelligent summaries of conversations')}
                        ${this.createToggle('enablePairedSummarization', 'Enable Paired Summarization', 'Summarize user and AI messages together')}
                        ${this.createToggle('hideMessagesWhenThreshold', 'Hide Old Messages After Summarization', 'Automatically hide messages once summarized')}
                        ${this.createSlider('runningMemorySize', 'Visible Messages', 10, 200, 5, 'Number of recent messages to keep visible')}
                        ${this.createSlider('summary_max_length', 'Max Summary Length (words)', 50, 500, 25, 'Maximum words per summary')}
                        ${this.createSlider('summaryTrigger', 'Summary Trigger (Messages)', 5, 50, 1, 'Summarize after this many messages')}
                        ${this.createSlider('contextPreservation', 'Context Preservation (%)', 10, 90, 5, 'How much context to preserve in summaries')}
                    </div>
                </div>

                <!-- Core Memory Section -->
                <div class="nemolore-settings-section">
                    <div class="nemolore-section-header">
                        <div class="nemolore-section-icon" style="background: linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%);">
                            <i class="fa-solid fa-star"></i>
                        </div>
                        <div class="nemolore-section-title">
                            <h3>Core Memory System</h3>
                            <p>Track and preserve important information</p>
                        </div>
                    </div>
                    <div class="nemolore-settings-content">
                        ${this.createToggle('enableCoreMemories', 'Enable Core Memory System', 'Identify and preserve crucial story elements')}
                        ${this.createToggle('coreMemoryPromptLorebook', 'Add Core Memories to Lorebook', 'Automatically create lorebook entries from core memories')}
                        ${this.createToggle('enableFrequencyBasedCoreMemory', 'Use Frequency Analysis', 'Detect core memories using ProsePolisher\'s n-gram frequency data')}
                    </div>
                </div>

                <!-- Advanced Features Section -->
                <div class="nemolore-settings-section">
                    <div class="nemolore-section-header">
                        <div class="nemolore-section-icon" style="background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <div class="nemolore-section-title">
                            <h3>Advanced Features</h3>
                            <p>Enhanced functionality and integrations</p>
                        </div>
                    </div>
                    <div class="nemolore-settings-content">
                        ${this.createToggle('highlightNouns', 'Enable Noun Highlighting', 'Visually highlight important entities in chat')}
                        ${this.createToggle('enableVectorization', 'Enable Semantic Search', 'Use vector embeddings for intelligent memory retrieval')}
                        ${this.createSlider('vectorSearchLimit', 'Search Results to Inject', 1, 10, 1, 'Number of relevant memories to inject into context')}
                    </div>
                </div>

                <!-- Project Gremlin Section -->
                <div class="nemolore-settings-section">
                    <div class="nemolore-section-header">
                        <div class="nemolore-section-icon" style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);">
                            <i class="fa-solid fa-hat-wizard"></i>
                        </div>
                        <div class="nemolore-section-title">
                            <h3>Project Gremlin Integration</h3>
                            <p>Multi-stage AI refinement pipeline</p>
                        </div>
                    </div>
                    <div class="nemolore-settings-content">
                        ${this.createToggle('useProjectGremlinForLorebook', 'Enable Project Gremlin for Lorebooks', 'Use 5-stage AI refinement pipeline for higher quality lorebook entries')}
                        <div id="nemolore_gremlin_stages_container" style="display: none; margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 3px solid #f472b6;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <i class="fa-solid fa-info-circle" style="color: #f472b6;"></i>
                                <p style="font-size: 0.9em; color: #d1d5db; margin: 0;">
                                    Select which pipeline stages to use. Disable stages you don't need for faster generation.
                                </p>
                            </div>
                            ${this.createToggle('gremlinUsePapa', 'Papa Gremlin', 'Creates strategic blueprint for the content')}
                            ${this.createToggle('gremlinUseTwins', 'Twins Gremlins', 'Add creative variations and perspectives')}
                            ${this.createToggle('gremlinUseMama', 'Mama Gremlin', 'Synthesizes and audits the plan')}
                            ${this.createToggle('gremlinUseWriter', 'Writer Gremlin', 'Generates final polished content')}
                            ${this.createToggle('gremlinUseAuditor', 'Auditor Gremlin', 'Final quality check and refinement')}
                        </div>
                    </div>
                </div>

                <!-- Actions Section -->
                <div class="nemolore-settings-section">
                    <div class="nemolore-section-header">
                        <div class="nemolore-section-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
                            <i class="fa-solid fa-bolt"></i>
                        </div>
                        <div class="nemolore-section-title">
                            <h3>Quick Actions</h3>
                            <p>Manage your NemoLore data</p>
                        </div>
                    </div>
                    <div class="nemolore-settings-content">
                        <div class="nemolore-actions-grid">
                            <button id="nemolore_view_summaries" class="nemolore-action-button">
                                <i class="fa-solid fa-eye"></i>
                                <span>View Summaries</span>
                            </button>
                            <button id="nemolore_export_summaries" class="nemolore-action-button">
                                <i class="fa-solid fa-download"></i>
                                <span>Export Summaries</span>
                            </button>
                            <button id="nemolore_system_check" class="nemolore-action-button">
                                <i class="fa-solid fa-stethoscope"></i>
                                <span>System Check</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    generateApiSettingsHTML() {
        return `
            <div class="nemolore-settings-grid">
                <div class="nemolore-settings-panel">
                    <h3>🔌 Async API Settings</h3>
                    ${this.createToggle('enable_async_api', 'Enable Independent Async API', 'Recommended for background processing')}
                    <div id="nemolore_async_api_container" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid #374151;">
                        <div class="nemolore-setting-row">
                            <label for="nemolore_async_api_provider" class="nemolore-api-label">
                                <span>API Provider</span>
                                <select id="nemolore_async_api_provider" data-setting="async_api_provider" class="text_pole">
                                    <option value="">Select Provider</option>
                                    <option value="openai">OpenAI</option>
                                    <option value="gemini">Google Gemini</option>
                                    <option value="claude">Anthropic Claude</option>
                                    <option value="openrouter">OpenRouter</option>
                                </select>
                            </label>
                        </div>
                        <div class="nemolore-setting-row">
                            <label for="nemolore_async_api_key" class="nemolore-api-label">
                                <span>API Key</span>
                                <input id="nemolore_async_api_key" data-setting="async_api_key" type="password" class="text_pole" placeholder="Enter your API key">
                            </label>
                        </div>
                        <div class="nemolore-setting-row">
                            <label for="nemolore_async_api_model" class="nemolore-api-label">
                                <span>Model</span>
                                <select id="nemolore_async_api_model" data-setting="async_api_model" class="text_pole">
                                    <option value="">Select model after choosing provider</option>
                                </select>
                            </label>
                        </div>
                        <div class="nemolore-setting-row">
                            <label for="nemolore_async_api_endpoint" class="nemolore-api-label">
                                <span>Custom Endpoint (Optional)</span>
                                <input id="nemolore_async_api_endpoint" data-setting="async_api_endpoint" type="text" class="text_pole" placeholder="Leave blank for default">
                            </label>
                        </div>
                        <div class="nemolore-actions-grid" style="margin-top: 20px;">
                            <button id="nemolore_refresh_models" class="menu_button"><i class="fa-solid fa-sync"></i> Refresh Models</button>
                            <button id="nemolore_test_async_api" class="menu_button"><i class="fa-solid fa-vial"></i> Test Connection</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    createToggle(id, label, description = '') {
        const descHtml = description ? `<div class="nemolore-setting-description">${description}</div>` : '';
        return `
            <div class="nemolore-setting-row">
                <label for="nemolore_${id}" class="nemolore-toggle-label">
                    <div class="nemolore-label-content">
                        <span class="nemolore-label-text">${label}</span>
                        ${descHtml}
                    </div>
                    <div class="nemolore-toggle-switch">
                        <input type="checkbox" id="nemolore_${id}" data-setting="${id}" class="nemolore-toggle-input">
                        <span class="nemolore-toggle-slider"></span>
                    </div>
                </label>
            </div>`;
    }

    createSlider(id, label, min, max, step, description = '') {
        const descHtml = description ? `<div class="nemolore-setting-description">${description}</div>` : '';
        return `
            <div class="nemolore-setting-row nemolore-slider-row">
                <div class="nemolore-slider-header">
                    <label for="nemolore_${id}" class="nemolore-slider-label">
                        <span>${label}</span>
                        <span class="nemolore-slider-value" id="nemolore_${id}_output">${this.settings[id] || min}</span>
                    </label>
                    ${descHtml}
                </div>
                <input type="range" id="nemolore_${id}" data-setting="${id}" min="${min}" max="${max}" step="${step}" class="nemolore-slider-input">
            </div>`;
    }

    populateSettingsValues() {
        document.querySelectorAll('[data-setting]').forEach(el => {
            const key = el.dataset.setting;
            const value = this.settings[key];
            if (value !== undefined) {
                if (el.type === 'checkbox') {
                    el.checked = value;
                } else if (el.type === 'range') {
                    el.value = value;
                    const output = document.getElementById(`${el.id}_output`);
                    if (output) output.textContent = value;
                } else {
                    el.value = value;
                }
            }
        });

        // Show/hide async API container
        const enableApiToggle = document.getElementById('nemolore_enable_async_api');
        const apiContainer = document.getElementById('nemolore_async_api_container');
        if (enableApiToggle && apiContainer) {
            apiContainer.style.display = enableApiToggle.checked ? 'block' : 'none';
        }

        // Show/hide Gremlin stages container
        const gremlinToggle = document.getElementById('nemolore_useProjectGremlinForLorebook');
        const gremlinContainer = document.getElementById('nemolore_gremlin_stages_container');
        if (gremlinToggle && gremlinContainer) {
            gremlinContainer.style.display = gremlinToggle.checked ? 'block' : 'none';
        }

        // Set default values for Gremlin stages if not defined (default to true)
        if (this.settings.gremlinUsePapa === undefined) this.settings.gremlinUsePapa = true;
        if (this.settings.gremlinUseTwins === undefined) this.settings.gremlinUseTwins = true;
        if (this.settings.gremlinUseMama === undefined) this.settings.gremlinUseMama = true;
        if (this.settings.gremlinUseWriter === undefined) this.settings.gremlinUseWriter = true;
        if (this.settings.gremlinUseAuditor === undefined) this.settings.gremlinUseAuditor = true;

        // Set default value for frequency-based core memory detection (default to true)
        if (this.settings.enableFrequencyBasedCoreMemory === undefined) this.settings.enableFrequencyBasedCoreMemory = true;
    }

    async fetchModelsForProvider(force = false) {
        const provider = document.getElementById('nemolore_async_api_provider').value;
        const modelSelect = document.getElementById('nemolore_async_api_model');
        if (!provider || !modelSelect) {
            if(modelSelect) modelSelect.innerHTML = '<option value="">Select a provider first</option>';
            return;
        }
        modelSelect.innerHTML = '<option value="">Fetching models...</option>';
        try {
            const models = await this.apiManager.getModels(provider, this.settings, force);
            if (models && models.length > 0) {
                modelSelect.innerHTML = models.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
                modelSelect.value = this.settings.async_api_model || '';
            } else {
                modelSelect.innerHTML = '<option value="">No models found or API error</option>';
            }
        } catch (error) {
            console.error(`[NemoLore] Failed to fetch models for ${provider}:`, error);
            modelSelect.innerHTML = `<option value="">Error: ${error.message}</option>`;
        }
    }

    async testApiConnection() {
        callGenericPopup('<p><i class="fa-solid fa-spinner fa-spin"></i> Testing API connection...</p>', POPUP_TYPE.TEXT);
        try {
            const tempSettings = { ...this.settings };
            document.querySelectorAll('#nemolore-tab-api [data-setting]').forEach(input => {
                tempSettings[input.dataset.setting] = input.type === 'checkbox' ? input.checked : input.value;
            });
            const result = await this.apiManager.testConnection(tempSettings);
            if (result.success) {
                callGenericPopup(`<p>✅ Connection successful!<br>Models available: ${result.modelCount}</p>`, POPUP_TYPE.TEXT);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('[NemoLore] API Test Failed:', error);
            callGenericPopup(`<p>❌ Connection failed: ${error.message}</p>`, POPUP_TYPE.TEXT);
        }
    }

    handleQuickAction(action) {
        console.log(`[NemoLore Dashboard] handleQuickAction called with action: "${action}"`);
        console.log('[NemoLore Dashboard] Dependencies check:', {
            autoLorebookManager: !!this.autoLorebookManager,
            uiManager: !!this.uiManager,
            apiManager: !!this.apiManager,
            settings: !!this.settings
        });

        if (!this.autoLorebookManager) {
            console.error('[NemoLore Dashboard] ❌ autoLorebookManager not available!');
            if (window.toastr) {
                window.toastr.error('Auto-lorebook manager not initialized. Cannot perform this action.');
            }
            return;
        }

        try {
            switch (action) {
                case 'optimize':
                    console.log('[NemoLore Dashboard] Triggering Optimize All...');
                    this.triggerOptimizeAll();
                    break;
                case 'core-memory':
                    console.log('[NemoLore Dashboard] Triggering Create Core Memory...');
                    this.triggerCreateCoreMemory();
                    break;
                case 'categorize':
                    console.log('[NemoLore Dashboard] Triggering Auto-Categorize...');
                    this.triggerAutoCategorize();
                    break;
                case 'insights':
                    console.log('[NemoLore Dashboard] Triggering AI Insights...');
                    this.triggerAIInsights();
                    break;
                default:
                    console.warn(`[NemoLore Dashboard] Unknown quick action: ${action}`);
                    if (window.toastr) {
                        window.toastr.warning(`Unknown action: ${action}`);
                    }
            }
        } catch (error) {
            console.error(`[NemoLore Dashboard] ❌ Error executing action "${action}":`, error);
            console.error('[NemoLore Dashboard] Stack:', error.stack);
            if (window.toastr) {
                window.toastr.error(`Failed to execute ${action}: ${error.message}`);
            }
        }
    }

    async triggerOptimizeAll() {
        const entities = this.autoLorebookManager.entityDatabase ? Array.from(this.autoLorebookManager.entityDatabase.values()) : [];
        if (entities.length < 2) {
            callGenericPopup('<p>Not enough entities to optimize.</p>', POPUP_TYPE.TEXT);
            return;
        }
        const potentialDuplicates = new Map();
        const sortedEntities = [...entities].sort((a, b) => a.name.length - b.name.length);
        for (let i = 0; i < sortedEntities.length; i++) {
            for (let j = i + 1; j < sortedEntities.length; j++) {
                if (sortedEntities[j].name.toLowerCase().includes(sortedEntities[i].name.toLowerCase())) {
                    if (!potentialDuplicates.has(sortedEntities[i].name)) {
                        potentialDuplicates.set(sortedEntities[i].name, [sortedEntities[i]]);
                    }
                    potentialDuplicates.get(sortedEntities[i].name).push(sortedEntities[j]);
                }
            }
        }
        if (potentialDuplicates.size === 0) {
            callGenericPopup('<p>No potential duplicate entities found.</p>', POPUP_TYPE.TEXT);
            return;
        }
        this.processNextDuplicate(Array.from(potentialDuplicates.values()));
    }

    async processNextDuplicate(duplicateGroups) {
        if (duplicateGroups.length === 0) {
            callGenericPopup('<p>✅ Optimization check complete.</p>', POPUP_TYPE.TEXT);
            this.updateOverviewContent(document.getElementById('nemolore-tab-overview'));
            return;
        }
        const group = duplicateGroups.shift();
        const primary = group[0];
        const duplicates = group.slice(1);
        const result = await callGenericPopup(`<h3>Merge Duplicate Entity?</h3><p>Merge <strong>${duplicates.map(d => d.name).join(', ')}</strong> into <strong>${primary.name}</strong>?</p>`, POPUP_TYPE.CONFIRM);
        if (result) {
            await this.mergeEntities(primary, duplicates);
        }
        this.processNextDuplicate(duplicateGroups);
    }

    async mergeEntities(primary, duplicates) {
        const db = this.autoLorebookManager.entityDatabase;
        for (const duplicate of duplicates) {
            primary.mentions = (primary.mentions || 1) + (duplicate.mentions || 1);
            primary.contexts = [...(primary.contexts || []), ...(duplicate.contexts || [])];
            db.delete(duplicate.name.toLowerCase());
        }
        primary.contexts = [...new Set(primary.contexts)];
        db.set(primary.name.toLowerCase(), primary);
        await this.autoLorebookManager.saveEntityDatabase();
    }

    async triggerCreateCoreMemory() {
        const result = await callGenericPopup('<h3>Create a New Core Memory</h3><textarea id="nemolore_core_memory_input" class="text_pole" rows="6" placeholder="Enter a significant piece of information..."></textarea>', POPUP_TYPE.CONFIRM);
        if (result) {
            const memoryText = document.getElementById('nemolore_core_memory_input').value.trim();
            if (memoryText) {
                await this.autoLorebookManager.addCoreMemoryToLorebook({ text: memoryText });
                this.updateOverviewContent(document.getElementById('nemolore-tab-overview'));
            }
        }
    }

    async triggerAutoCategorize() {
        const result = await callGenericPopup('<h3>Auto-Categorize Memories?</h3><p>This will analyze memories and create new lorebook entries. This may consume tokens.</p>', POPUP_TYPE.CONFIRM);
        if (result) {
            const summaries = this.uiManager.memoryManager?.getAllSummariesForContext?.() || [];
            const entities = this.autoLorebookManager.entityDatabase ? Array.from(this.autoLorebookManager.entityDatabase.values()) : [];
            await this.runAICategorization(summaries, entities);
        }
    }

    async runAICategorization(summaries, entities) {
        callGenericPopup('<p><i class="fa-solid fa-spinner fa-spin"></i> AI categorization is in progress...</p>', POPUP_TYPE.TEXT);
        const prompt = `Analyze the following memories and group them into 3-5 logical categories. Format as a JSON object where keys are category names and values are arrays of memories.\n\n**Memories:**\nSummaries:\n- ${summaries.map(s => s.text).join('\n- ')}\n\nEntities:\n- ${entities.map(e => `${e.name} (${e.type})`).join('\n- ')}`;
        try {
            const response = await this.apiManager.generateSummary(prompt, this.settings);
            const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
            if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
            const categories = JSON.parse(jsonMatch[1] || jsonMatch[2]);
            let entriesCreated = 0;
            for (const [category, memories] of Object.entries(categories)) {
                if (memories.length > 0) {
                    await this.autoLorebookManager.createLorebookEntry(this.state.currentChatLorebook, {
                        title: `Category: ${category}`,
                        keywords: category.split(' ').join(', '),
                        content: `- ${memories.join('\n- ')}`
                    });
                    entriesCreated++;
                }
            }
            callGenericPopup(`<p>✅ Auto-categorization complete! Created ${entriesCreated} new lorebook entries.</p>`, POPUP_TYPE.TEXT);
            this.updateOverviewContent(document.getElementById('nemolore-tab-overview'));
        } catch (error) {
            callGenericPopup(`<p>❌ Auto-categorization failed: ${error.message}</p>`, POPUP_TYPE.TEXT);
        }
    }

    async triggerAIInsights() {
        const result = await callGenericPopup('<h3>Get AI Insights?</h3><p>Analyze memories to identify plot hooks and character arcs. This may consume tokens.</p>', POPUP_TYPE.CONFIRM);
        if (result) {
            const summaries = this.uiManager.memoryManager?.getAllSummariesForContext?.() || [];
            const entities = this.autoLorebookManager.entityDatabase ? Array.from(this.autoLorebookManager.entityDatabase.values()) : [];
            await this.runAIInsights(summaries, entities);
        }
    }

    async runAIInsights(summaries, entities) {
        callGenericPopup('<p><i class="fa-solid fa-spinner fa-spin"></i> Generating AI insights...</p>', POPUP_TYPE.TEXT);
        const prompt = `You are a creative writing assistant. Generate three distinct insights (Plot Hook, Character Arc, Relationship Dynamic) from the following data. Format as a JSON object with a key "insights", which is an array of objects with "type" and "description".\n\n**Data:**\nSummaries:\n- ${summaries.map(s => s.text).join('\n- ')}\n\nEntities:\n- ${entities.map(e => `${e.name} (${e.type})`).join('\n- ')}`;
        try {
            const response = await this.apiManager.generateSummary(prompt, this.settings);
            const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
            if (!jsonMatch) throw new Error("AI response did not contain valid JSON.");
            const insights = JSON.parse(jsonMatch[1] || jsonMatch[2]).insights;
            const icons = { 'Plot Hook': 'fa-map-signs', 'Character Arc': 'fa-user-graduate', 'Relationship Dynamic': 'fa-users' };
            const insightsHtml = `<h3><i class="fa-solid fa-brain"></i> AI-Generated Insights</h3><div class="nemolore-insights-list">${insights.map(insight => `<div class="nemolore-insight-item"><h4><i class="fa-solid ${icons[insight.type] || 'fa-lightbulb'}"></i> ${insight.type}</h4><p>${insight.description}</p></div>`).join('')}</div>`;
            callGenericPopup(insightsHtml, POPUP_TYPE.TEXT);
        } catch (error) {
            callGenericPopup(`<p>❌ AI Insights failed: ${error.message}</p>`, POPUP_TYPE.TEXT);
        }
    }
    
    switchTab(tabName) {
        console.log(`[NemoLore Dashboard] Switching to tab: ${tabName}`);
        const container = document.getElementById(this.config.containerId);

        // Remove active class from all tab buttons
        container.querySelectorAll('.nemolore-tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to clicked tab button
        const activeButton = container.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }

        // Hide ALL tab content panels first
        container.querySelectorAll('.nemolore-tab-content').forEach(panel => {
            panel.classList.remove('active');
            panel.style.display = 'none'; // Explicitly hide
        });

        // Show only the active tab content
        const activePanel = container.querySelector(`#nemolore-tab-${tabName}`);
        if (activePanel) {
            activePanel.classList.add('active');
            activePanel.style.display = 'block'; // Explicitly show
            this.updateTabContent(tabName, activePanel);
            console.log(`[NemoLore Dashboard] ✅ Activated tab: ${tabName}`);
        } else {
            console.warn(`[NemoLore Dashboard] ⚠️ Tab panel not found: nemolore-tab-${tabName}`);
        }
    }

    updateTabContent(tabName, panel) {
        if (tabName === 'overview') this.updateOverviewContent(panel);
        else if (tabName === 'quality') this.updateQualityContent(panel);
        else if (tabName === 'debug') this.updateDebugContent(panel);
        // ProsePolisher tab content is loaded once from HTML file, no updates needed
    }

    calculateQualityDistribution() {
        const entities = this.autoLorebookManager.entityDatabase ? Array.from(this.autoLorebookManager.entityDatabase.values()) : [];
        const distribution = { Perfect: { count: 0 }, Excellent: { count: 0 }, Good: { count: 0 }, Auto: { count: 0 } };
        if (entities.length === 0) {
            distribution.Auto.count = this.uiManager.memoryManager?.getSummaryCount?.() || 0;
        } else {
            for (const entity of entities) {
                const confidence = entity.confidence || 0;
                if (confidence >= 0.95) distribution.Perfect.count++;
                else if (confidence >= 0.85) distribution.Excellent.count++;
                else if (confidence >= 0.7) distribution.Good.count++;
                else distribution.Auto.count++;
            }
        }
        const total = entities.length || distribution.Auto.count;
        Object.keys(distribution).forEach(key => {
            distribution[key].percentage = total > 0 ? (distribution[key].count / total * 100).toFixed(0) : 0;
        });
        return distribution;
    }

    updateOverviewContent(panel) {
        if (!panel) return;
        const stats = this.autoLorebookManager.getEntityStatistics ? this.autoLorebookManager.getEntityStatistics() : {};
        const summaryCount = this.uiManager.memoryManager?.getSummaryCount?.() || 0;
        const totalMemories = summaryCount + (stats.totalEntities || 0);
        const avgConfidence = stats.averageConfidence ? (stats.averageConfidence * 100).toFixed(0) : 0;
        const quality = this.calculateQualityDistribution();
        panel.innerHTML = `
            <div class="nemolore-stats-grid">
                <div class="nemolore-stat-card"><div class="nemolore-stat-icon" style="background:#2563eb;"><i class="fa-solid fa-brain"></i></div><div class="nemolore-stat-info"><div class="nemolore-stat-number">${totalMemories}</div><div class="nemolore-stat-label">Total Memories</div></div></div>
                <div class="nemolore-stat-card"><div class="nemolore-stat-icon" style="background:#db2777;"><i class="fa-solid fa-star"></i></div><div class="nemolore-stat-info"><div class="nemolore-stat-number">${stats.totalEntities || 0}</div><div class="nemolore-stat-label">Total Entities</div></div></div>
                <div class="nemolore-stat-card"><div class="nemolore-stat-icon" style="background:#16a34a;"><i class="fa-solid fa-database"></i></div><div class="nemolore-stat-info"><div class="nemolore-stat-number">${stats.totalMentions || 0}</div><div class="nemolore-stat-label">Total Mentions</div></div></div>
                <div class="nemolore-stat-card"><div class="nemolore-stat-icon" style="background:#f97316;"><i class="fa-solid fa-percent"></i></div><div class="nemolore-stat-info"><div class="nemolore-stat-number">${avgConfidence}%</div><div class="nemolore-stat-label">Avg. Confidence</div></div></div>
            </div>
            <div class="nemolore-quick-actions-section">
                <h3>Quick Actions</h3>
                <div class="nemolore-quick-actions-grid">
                    <button class="nemolore-quick-action-btn action-button" data-action="optimize"><div class="nemolore-action-icon"><i class="fa-solid fa-cog"></i></div><div class="nemolore-action-label">Optimize All</div></button>
                    <button class="nemolore-quick-action-btn action-button" data-action="core-memory"><div class="nemolore-action-icon"><i class="fa-solid fa-star"></i></div><div class="nemolore-action-label">Create Core Memory</div></button>
                    <button class="nemolore-quick-action-btn action-button" data-action="categorize"><div class="nemolore-action-icon"><i class="fa-solid fa-layer-group"></i></div><div class="nemolore-action-label">Auto-Categorize</div></button>
                    <button class="nemolore-quick-action-btn action-button" data-action="insights"><div class="nemolore-action-icon"><i class="fa-solid fa-brain"></i></div><div class="nemolore-action-label">AI Insights</div></button>
                </div>
            </div>
            <div class="nemolore-quality-section">
                <h3>Memory Quality Distribution</h3>
                <div class="nemolore-quality-list">
                    <div class="nemolore-quality-item"><span class="nemolore-quality-label">Perfect</span><div class="nemolore-quality-bar"><div class="nemolore-quality-fill" style="width:${quality.Perfect.percentage}%; background:#2563eb;"></div></div><span class="nemolore-quality-count">${quality.Perfect.count}</span></div>
                    <div class="nemolore-quality-item"><span class="nemolore-quality-label">Excellent</span><div class="nemolore-quality-bar"><div class="nemolore-quality-fill" style="width:${quality.Excellent.percentage}%; background:#16a34a;"></div></div><span class="nemolore-quality-count">${quality.Excellent.count}</span></div>
                    <div class="nemolore-quality-item"><span class="nemolore-quality-label">Good</span><div class="nemolore-quality-bar"><div class="nemolore-quality-fill" style="width:${quality.Good.percentage}%; background:#f97316;"></div></div><span class="nemolore-quality-count">${quality.Good.count}</span></div>
                    <div class="nemolore-quality-item"><span class="nemolore-quality-label">Auto</span><div class="nemolore-quality-bar"><div class="nemolore-quality-fill" style="width:${quality.Auto.percentage}%; background:#9ca3af;"></div></div><span class="nemolore-quality-count">${quality.Auto.count}</span></div>
                </div>
            </div>`;
        this.bindOverviewActions();
    }

    /**
     * Update Quality tab content with cross-system metrics (Integration Opportunity 3.1)
     */
    updateQualityContent(panel) {
        if (!panel) return;

        // Get NemoLore metrics
        const summaryCount = this.uiManager.memoryManager?.getSummaryCount?.() || 0;
        const summaries = this.uiManager.memoryManager?.getAllSummariesForContext?.() || [];

        // Calculate summary quality metrics
        let averageSummaryQuality = 0;
        let lowQualitySummaries = 0;
        let summaryQualityDistribution = { excellent: 0, good: 0, medium: 0, low: 0, poor: 0 };

        for (const summary of summaries) {
            const quality = this.uiManager.memoryManager?.calculateSummaryQuality?.(summary.text);
            if (quality) {
                averageSummaryQuality += quality.slopScore;
                if (quality.needsRegeneration) lowQualitySummaries++;

                // Update distribution
                if (summaryQualityDistribution[quality.quality] !== undefined) {
                    summaryQualityDistribution[quality.quality]++;
                }
            }
        }

        if (summaries.length > 0) {
            averageSummaryQuality = (averageSummaryQuality / summaries.length).toFixed(1);
        }

        // Try to get ProsePolisher metrics (if available)
        const prosePolisherExtension = typeof window !== 'undefined' ? window.ProsePolisher : null;
        const prosePolisherState = prosePolisherExtension?.state;
        const prosePolisherAnalyzer = prosePolisherState?.prosePolisherAnalyzer;

        let prosePolisherMetrics = {
            available: false,
            totalPhrases: 0,
            highSlopCount: 0,
            topPhrase: 'N/A',
            topPhraseScore: 0,
            leaderboard: []
        };

        if (prosePolisherAnalyzer) {
            prosePolisherMetrics.available = true;
            prosePolisherMetrics.totalPhrases = prosePolisherAnalyzer.ngramFrequencies?.size || 0;

            // Get leaderboard data
            const leaderboardData = prosePolisherAnalyzer.analyzedLeaderboardData;
            if (leaderboardData && leaderboardData.merged) {
                const sortedPhrases = Object.entries(leaderboardData.merged).sort((a, b) => b[1] - a[1]);

                if (sortedPhrases.length > 0) {
                    prosePolisherMetrics.topPhrase = sortedPhrases[0][0];
                    prosePolisherMetrics.topPhraseScore = sortedPhrases[0][1].toFixed(1);
                }

                prosePolisherMetrics.leaderboard = sortedPhrases.slice(0, 5);
                prosePolisherMetrics.highSlopCount = sortedPhrases.filter(([_, score]) => score > 8.0).length;
            }
        }

        // Generate Quality Dashboard HTML
        panel.innerHTML = `
            <div class="nemolore-quality-dashboard">
                <h3><i class="fa-solid fa-shield-alt"></i> Unified Quality Insights</h3>
                <p class="nemolore-quality-description">Combined quality metrics from NemoLore and ProsePolisher systems</p>

                <!-- NemoLore Memory Quality Section -->
                <div class="nemolore-quality-section">
                    <h4><i class="fa-solid fa-brain"></i> NemoLore Memory Quality</h4>
                    <div class="nemolore-stats-grid">
                        <div class="nemolore-stat-card">
                            <div class="nemolore-stat-icon" style="background:#2563eb;">
                                <i class="fa-solid fa-file-lines"></i>
                            </div>
                            <div class="nemolore-stat-info">
                                <div class="nemolore-stat-number">${summaryCount}</div>
                                <div class="nemolore-stat-label">Total Summaries</div>
                            </div>
                        </div>
                        <div class="nemolore-stat-card">
                            <div class="nemolore-stat-icon" style="background:${lowQualitySummaries > 0 ? '#dc2626' : '#16a34a'};">
                                <i class="fa-solid ${lowQualitySummaries > 0 ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i>
                            </div>
                            <div class="nemolore-stat-info">
                                <div class="nemolore-stat-number">${lowQualitySummaries}</div>
                                <div class="nemolore-stat-label">Flagged for Review</div>
                            </div>
                        </div>
                        <div class="nemolore-stat-card">
                            <div class="nemolore-stat-icon" style="background:#f97316;">
                                <i class="fa-solid fa-chart-line"></i>
                            </div>
                            <div class="nemolore-stat-info">
                                <div class="nemolore-stat-number">${averageSummaryQuality}</div>
                                <div class="nemolore-stat-label">Avg. Slop Score</div>
                            </div>
                        </div>
                    </div>

                    <div class="nemolore-quality-distribution">
                        <h5>Quality Distribution</h5>
                        ${Object.entries(summaryQualityDistribution).map(([level, count]) => {
                            const colors = {
                                excellent: '#2563eb',
                                good: '#16a34a',
                                medium: '#f97316',
                                low: '#dc2626',
                                poor: '#7f1d1d'
                            };
                            const percentage = summaries.length > 0 ? (count / summaries.length * 100).toFixed(0) : 0;
                            return `
                                <div class="nemolore-quality-item">
                                    <span class="nemolore-quality-label">${level.charAt(0).toUpperCase() + level.slice(1)}</span>
                                    <div class="nemolore-quality-bar">
                                        <div class="nemolore-quality-fill" style="width:${percentage}%; background:${colors[level]};"></div>
                                    </div>
                                    <span class="nemolore-quality-count">${count} (${percentage}%)</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- ProsePolisher Prose Quality Section -->
                <div class="nemolore-quality-section">
                    <h4><i class="fa-solid fa-spell-check"></i> ProsePolisher Analysis</h4>
                    ${prosePolisherMetrics.available ? `
                        <div class="nemolore-stats-grid">
                            <div class="nemolore-stat-card">
                                <div class="nemolore-stat-icon" style="background:#8b5cf6;">
                                    <i class="fa-solid fa-hashtag"></i>
                                </div>
                                <div class="nemolore-stat-info">
                                    <div class="nemolore-stat-number">${prosePolisherMetrics.totalPhrases}</div>
                                    <div class="nemolore-stat-label">Tracked Phrases</div>
                                </div>
                            </div>
                            <div class="nemolore-stat-card">
                                <div class="nemolore-stat-icon" style="background:${prosePolisherMetrics.highSlopCount > 0 ? '#dc2626' : '#16a34a'};">
                                    <i class="fa-solid ${prosePolisherMetrics.highSlopCount > 0 ? 'fa-flag' : 'fa-thumbs-up'}"></i>
                                </div>
                                <div class="nemolore-stat-info">
                                    <div class="nemolore-stat-number">${prosePolisherMetrics.highSlopCount}</div>
                                    <div class="nemolore-stat-label">High Repetition</div>
                                </div>
                            </div>
                            <div class="nemolore-stat-card">
                                <div class="nemolore-stat-icon" style="background:#f59e0b;">
                                    <i class="fa-solid fa-trophy"></i>
                                </div>
                                <div class="nemolore-stat-info">
                                    <div class="nemolore-stat-number">${prosePolisherMetrics.topPhraseScore}</div>
                                    <div class="nemolore-stat-label">Top Phrase Score</div>
                                </div>
                            </div>
                        </div>

                        ${prosePolisherMetrics.leaderboard.length > 0 ? `
                            <div class="nemolore-leaderboard">
                                <h5>Most Repetitive Phrases</h5>
                                <div class="nemolore-leaderboard-list">
                                    ${prosePolisherMetrics.leaderboard.map(([phrase, score], index) => `
                                        <div class="nemolore-leaderboard-item">
                                            <span class="nemolore-leaderboard-rank">#${index + 1}</span>
                                            <span class="nemolore-leaderboard-phrase">"${phrase}"</span>
                                            <span class="nemolore-leaderboard-score" style="color: ${score > 10 ? '#dc2626' : score > 5 ? '#f97316' : '#16a34a'};">
                                                ${score.toFixed(1)}
                                            </span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    ` : `
                        <div class="nemolore-info-panel">
                            <i class="fa-solid fa-info-circle"></i>
                            <p>ProsePolisher is not active. Enable ProsePolisher to see prose quality analysis.</p>
                        </div>
                    `}
                </div>

                <!-- Cross-System Actions -->
                <div class="nemolore-quality-section">
                    <h4><i class="fa-solid fa-tools"></i> Quality Actions</h4>
                    <div class="nemolore-quick-actions-grid">
                        ${lowQualitySummaries > 0 ? `
                            <button class="nemolore-quick-action-btn action-button" data-action="regenerate-flagged">
                                <div class="nemolore-action-icon"><i class="fa-solid fa-sync"></i></div>
                                <div class="nemolore-action-label">Regenerate Flagged (${lowQualitySummaries})</div>
                            </button>
                        ` : ''}
                        ${prosePolisherMetrics.available ? `
                            <button class="nemolore-quick-action-btn action-button" data-action="view-prosepolisher-leaderboard">
                                <div class="nemolore-action-icon"><i class="fa-solid fa-list-ol"></i></div>
                                <div class="nemolore-action-label">Full Repetition Report</div>
                            </button>
                        ` : ''}
                        <button class="nemolore-quick-action-btn action-button" data-action="generate-quality-report">
                            <div class="nemolore-action-icon"><i class="fa-solid fa-file-export"></i></div>
                            <div class="nemolore-action-label">Generate AI Quality Report</div>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Bind action buttons
        panel.querySelectorAll('.action-button').forEach(button => {
            button.addEventListener('click', (event) => {
                this.handleQualityAction(event.currentTarget.dataset.action);
            });
        });
    }

    /**
     * Handle quality tab actions
     */
    async handleQualityAction(action) {
        switch (action) {
            case 'regenerate-flagged':
                await this.regenerateFlaggedSummaries();
                break;
            case 'view-prosepolisher-leaderboard':
                if (window.ProsePolisher?.state?.uiManager) {
                    window.ProsePolisher.state.uiManager.showFrequencyLeaderboard();
                }
                break;
            case 'generate-quality-report':
                await this.generateAIQualityReport();
                break;
            default:
                console.warn(`[NemoLore Dashboard] Unknown quality action: ${action}`);
        }
    }

    /**
     * Regenerate flagged summaries (Integration Opportunity 2.1)
     */
    async regenerateFlaggedSummaries() {
        const memoryManager = this.uiManager.memoryManager;
        if (!memoryManager || !memoryManager.summariesNeedingRegeneration) {
            callGenericPopup('<p>No summaries flagged for regeneration.</p>', POPUP_TYPE.TEXT);
            return;
        }

        const flaggedIndices = Array.from(memoryManager.summariesNeedingRegeneration);

        if (flaggedIndices.length === 0) {
            callGenericPopup('<p>No summaries flagged for regeneration.</p>', POPUP_TYPE.TEXT);
            return;
        }

        const confirmed = await callGenericPopup(
            `<h3>Regenerate Low-Quality Summaries?</h3><p>This will regenerate ${flaggedIndices.length} summaries that were flagged for quality issues.</p>`,
            POPUP_TYPE.CONFIRM
        );

        if (confirmed) {
            callGenericPopup(`<p><i class="fa-solid fa-spinner fa-spin"></i> Regenerating ${flaggedIndices.length} summaries...</p>`, POPUP_TYPE.TEXT);

            for (const index of flaggedIndices) {
                await memoryManager.summarizeMessage(index);
            }

            memoryManager.summariesNeedingRegeneration.clear();
            this.updateQualityContent(document.getElementById('nemolore-tab-quality'));

            callGenericPopup(`<p>✅ Successfully regenerated ${flaggedIndices.length} summaries!</p>`, POPUP_TYPE.TEXT);
        }
    }

    /**
     * Generate AI-powered quality report (Integration Opportunity 3.1)
     */
    async generateAIQualityReport() {
        callGenericPopup('<p><i class="fa-solid fa-spinner fa-spin"></i> Generating AI quality report...</p>', POPUP_TYPE.TEXT);

        const summaries = this.uiManager.memoryManager?.getAllSummariesForContext?.() || [];
        const prosePolisherExtension = window.ProsePolisher;
        const prosePolisherState = prosePolisherExtension?.state;

        let prompt = `You are a quality analysis assistant. Analyze the following conversation quality data and provide a comprehensive report with insights and recommendations.

**NemoLore Summary Data:**
- Total summaries: ${summaries.length}
- Summary quality distribution: ${JSON.stringify(this.calculateSummaryQualityDistribution(summaries))}

`;

        if (prosePolisherState?.prosePolisherAnalyzer) {
            const analyzer = prosePolisherState.prosePolisherAnalyzer;
            const leaderboard = analyzer.analyzedLeaderboardData;

            prompt += `**ProsePolisher Analysis:**
- Total tracked phrases: ${analyzer.ngramFrequencies?.size || 0}
- Top repetitive phrases: ${JSON.stringify(Object.fromEntries(Object.entries(leaderboard.merged || {}).slice(0, 5)))}

`;
        }

        prompt += `Provide a structured quality report with:
1. Overall Quality Assessment (1-10 score)
2. Top 3 Strengths
3. Top 3 Areas for Improvement
4. Specific Recommendations for the User

Format as a clean, readable HTML report.`;

        try {
            const response = await this.apiManager.generateSummary(prompt, this.settings);
            const reportHtml = `<div class="nemolore-quality-report"><h3><i class="fa-solid fa-clipboard-check"></i> AI Quality Report</h3>${response.content}</div>`;
            callGenericPopup(reportHtml, POPUP_TYPE.TEXT);
        } catch (error) {
            callGenericPopup(`<p>❌ Failed to generate quality report: ${error.message}</p>`, POPUP_TYPE.TEXT);
        }
    }

    /**
     * Calculate summary quality distribution helper
     * @private
     */
    calculateSummaryQualityDistribution(summaries) {
        const distribution = { excellent: 0, good: 0, medium: 0, low: 0, poor: 0 };

        for (const summary of summaries) {
            const quality = this.uiManager.memoryManager?.calculateSummaryQuality?.(summary.text);
            if (quality && distribution[quality.quality] !== undefined) {
                distribution[quality.quality]++;
            }
        }

        return distribution;
    }

    updateDebugContent(panel) {
        if (!panel) return;
        panel.innerHTML = `<h3>Debug Information</h3><pre>${JSON.stringify({ settings: this.settings, state: this.state }, null, 2)}</pre>`;
    }

    saveSettings() {
        // If we have a settingsManager, use it for proper saving
        if (this.settingsManager && typeof this.settingsManager.save === 'function') {
            console.log('[NemoLore Dashboard] Saving settings via SettingsManager');
            this.settingsManager.save();
            return;
        }

        // Fallback: save directly to extension_settings
        const context = getContext();
        if (context && context.extension_settings) {
            // Save to the correct namespace: NemoPresetExt.nemolore
            if (!context.extension_settings.NemoPresetExt) {
                context.extension_settings.NemoPresetExt = {};
            }
            context.extension_settings.NemoPresetExt.nemolore = this.settings;
            saveSettingsDebounced();
            console.log('[NemoLore Dashboard] Settings saved to extension_settings.NemoPresetExt.nemolore (fallback)');
        }
    }

    /**
     * Toggle dashboard visibility
     */
    toggleDashboard() {
        const container = document.getElementById(this.config.containerId);
        if (!container) {
            console.warn('[NemoLore Dashboard Manager] Dashboard container not found');
            return;
        }

        if (container.style.display === 'none' || !container.style.display) {
            // Ensure it's appended to body and not trapped in drawer
            if (container.parentElement !== document.body) {
                document.body.appendChild(container);
            }
            container.style.display = 'flex';
            container.style.position = 'fixed';
            container.style.zIndex = '9999';
            this.updateOverviewContent(document.getElementById('nemolore-tab-overview'));
            console.log('[NemoLore Dashboard Manager] Dashboard opened');
        } else {
            container.style.display = 'none';
            console.log('[NemoLore Dashboard Manager] Dashboard closed');
        }
    }

    /**
     * Show dashboard
     */
    showDashboard() {
        const container = document.getElementById(this.config.containerId);
        if (container) {
            container.style.display = 'block';
            this.updateOverviewContent(document.getElementById('nemolore-tab-overview'));
            console.log('[NemoLore Dashboard Manager] Dashboard shown');
        }
    }

    /**
     * Hide dashboard
     */
    hideDashboard() {
        const container = document.getElementById(this.config.containerId);
        if (container) {
            container.style.display = 'none';
            console.log('[NemoLore Dashboard Manager] Dashboard hidden');
        }
        // Also hide the backdrop
        const backdrop = document.getElementById('nemolore-dashboard-backdrop');
        if (backdrop) {
            backdrop.style.display = 'none';
        }
    }
}

console.log('[NemoLore Dashboard Manager] Module loaded');