// ProsePolisher Extension Entry Point for NemoPresetExt
// Wraps the original ProsePolisher extension to work within NemoPresetExt

import { eventSource, event_types, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../extensions.js';
import { callGenericPopup, POPUP_TYPE } from '../../../../../popup.js';
import { UIManager } from './src/ui-manager.js';
import { state } from './src/state.js';
import { runGremlinPlanningPipeline, applyGremlinEnvironment, applyGremlinWriterChaosOption, selectChaosOption } from './src/projectgremlin.js';
import { executeGen } from './src/api-service.js';
import { Analyzer } from './src/analyzer.js';
import { EXTENSION_NAME, LOG_PREFIX, EXTENSION_FOLDER_PATH, PROSE_POLISHER_ID_PREFIX, defaultSettings, DEFAULT_WRITER_INSTRUCTIONS_TEMPLATE, DEFAULT_AUDITOR_INSTRUCTIONS_TEMPLATE } from './src/constants.js';
import { initializeEventListeners } from './src/events.js';
import { initializeProjectGremlin, setupRegexUIObserver, setupEventListeners } from './src/initialization.js';
import { regexManager } from './src/regex-manager.js';
import { ErrorHandler } from './src/error-handler.js';
import { RegexNavigator } from './src/regex-navigator.js';
import { updateGlobalRegexArray } from './src/global-regex-integration.js';

/**
 * ProsePolisher Extension Main Class
 */
export class ProsePolisherExtension {
    constructor() {
        this.state = state;
        this.uiManager = null;
    }

    /**
     * Load ProsePolisher CSS dynamically
     */
    loadCSS() {
        const cssPath = 'scripts/extensions/third-party/NemoPresetExt/features/prosepolisher/styles.css';

        // Check if CSS is already loaded
        if (document.querySelector(`link[href="${cssPath}"]`)) {
            console.log(`${LOG_PREFIX} CSS already loaded`);
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = cssPath;
        document.head.appendChild(link);
        console.log(`${LOG_PREFIX} CSS loaded successfully`);
    }

    /**
     * Initialize the ProsePolisher extension
     */
    async initialize() {
        console.log(`${LOG_PREFIX} Initializing ProsePolisher extension...`);

        try {
            // Load CSS first
            this.loadCSS();

            // Initialize UI manager
            this.state.uiManager = new UIManager();
            this.uiManager = this.state.uiManager;

            // Load settings from NemoPresetExt namespace
            const nemoPresetSettings = extension_settings.NemoPresetExt || {};
            const loadedSettings = nemoPresetSettings.prosepolisher || {};
            const settings = { ...defaultSettings, ...loadedSettings };

            // Save back to NemoPresetExt namespace
            if (!extension_settings.NemoPresetExt) {
                extension_settings.NemoPresetExt = {};
            }
            extension_settings.NemoPresetExt.prosepolisher = settings;

            // Also maintain compatibility with original EXTENSION_NAME for internal use
            extension_settings[EXTENSION_NAME] = settings;

            if (saveSettingsDebounced) {
                saveSettingsDebounced();
            }

            // Initialize core components
            await this.initializeExtensionCore(settings);

            // Set up event listeners
            this.setupEventHandlers();

            console.log(`${LOG_PREFIX} ✅ ProsePolisher initialized successfully`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to initialize ProsePolisher:`, error);
            throw error;
        }
    }

    /**
     * Initialize core extension components
     */
    async initializeExtensionCore(settings) {
        try {
            console.log(`${LOG_PREFIX} Initializing core components...`);

            // Validate connection profiles
            this.validateAndCleanupConnectionProfiles(settings);

            // Initialize dynamic rules
            this.state.dynamicRules = settings.dynamicRules || [];
            this.state.dynamicRules.forEach(rule => {
                if (!rule.id) rule.id = `DYN_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            });

            // Load static rules
            const staticResponse = await fetch(`${EXTENSION_FOLDER_PATH}/src/regex_rules.json`);
            if (!staticResponse.ok) throw new Error("Failed to fetch regex_rules.json");
            this.state.staticRules = await staticResponse.json();
            this.state.staticRules.forEach(rule => {
                if (!rule.id) {
                    rule.id = (rule.scriptName
                        ? PROSE_POLISHER_ID_PREFIX + rule.scriptName.replace(/\s+/g, '_')
                        : PROSE_POLISHER_ID_PREFIX + `staticrule_${Math.random().toString(36).substr(2, 5)}`) + '_static';
                }
            });

            // NOTE: Settings HTML injection skipped - will be loaded by NemoLore Dashboard
            // The dashboard will load settings.html and call setupUIControls when needed
            console.log(`${LOG_PREFIX} Skipping HTML injection - will be handled by NemoLore Dashboard`);

            // Initialize analyzer
            this.state.prosePolisherAnalyzer = new Analyzer({
                settings,
                callGenericPopup,
                POPUP_TYPE,
                toastr: window.toastr,
                saveSettingsDebounced,
                compileActiveRules: this.compileInternalActiveRules.bind(this),
                updateGlobalRegexArrayCallback: this.updateGlobalRegexArray.bind(this),
                compiledRegexes: this.getCompiledRegexes()
            });

            // Load saved analyzer state from previous session
            const loaded = this.state.prosePolisherAnalyzer.loadAnalyzerState();
            if (loaded) {
                console.log(`${LOG_PREFIX} Loaded analyzer state from previous session`);
            }

            // Initialize Regex Navigator
            console.log('[ProsePolisher] Creating regexNavigator instance...');
            this.state.regexNavigator = new RegexNavigator();
            console.log('[ProsePolisher] regexNavigator initialization complete');

            // NOTE: Event listeners and UI controls will be initialized by the dashboard
            // when it loads the ProsePolisher tab
            console.log(`${LOG_PREFIX} Core initialization complete - UI will be initialized by dashboard`);

            console.log(`${LOG_PREFIX} Core components initialized`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Critical failure during core initialization:`, error);
            window.toastr.error("ProsePolisher failed to initialize core components. See console.");
            throw error;
        }
    }

    /**
     * Set up UI controls and event listeners
     */
    async setupUIControls(settings) {
        const staticToggle = document.getElementById('prose_polisher_enable_static');
        const dynamicToggle = document.getElementById('prose_polisher_enable_dynamic');
        const triggerInput = document.getElementById('prose_polisher_dynamic_trigger');
        const globalRegexToggle = document.getElementById('prose_polisher_enable_global_regex');

        if (staticToggle) staticToggle.checked = settings.isStaticEnabled;
        if (dynamicToggle) dynamicToggle.checked = settings.isDynamicEnabled;
        if (triggerInput) triggerInput.value = settings.dynamicTriggerCount;

        // Initialize Smart Learning Settings inputs
        const slopThresholdInput = document.getElementById('prose_polisher_slop_threshold');
        const leaderboardUpdateCycleInput = document.getElementById('prose_polisher_leaderboard_update_cycle');
        const pruningCycleInput = document.getElementById('prose_polisher_pruning_cycle');
        const ngramMaxInput = document.getElementById('prose_polisher_ngram_max');
        const patternMinCommonInput = document.getElementById('prose_polisher_pattern_min_common');

        if (slopThresholdInput) slopThresholdInput.value = settings.slopThreshold;
        if (leaderboardUpdateCycleInput) leaderboardUpdateCycleInput.value = settings.leaderboardUpdateCycle;
        if (pruningCycleInput) pruningCycleInput.value = settings.pruningCycle;
        if (ngramMaxInput) ngramMaxInput.value = settings.ngramMax;
        if (patternMinCommonInput) patternMinCommonInput.value = settings.patternMinCommon;

        // Global regex toggle
        if (globalRegexToggle) {
            globalRegexToggle.checked = settings.integrateWithGlobalRegex;
            globalRegexToggle.addEventListener('change', async () => {
                settings.integrateWithGlobalRegex = globalRegexToggle.checked;
                saveSettingsDebounced();
                await this.updateGlobalRegexArray();
                const regexListContainer = document.getElementById('saved_regex_scripts');
                if (regexListContainer) {
                    this.state.uiManager.hideRulesInStandardUI();
                }
                this.state.uiManager.showReloadPrompt();
            });
        }

        // Static/dynamic toggle listeners
        if (staticToggle) {
            staticToggle.addEventListener('change', async () => {
                settings.isStaticEnabled = staticToggle.checked;
                saveSettingsDebounced();
                await this.updateGlobalRegexArray();
                this.state.uiManager.showReloadPrompt();
            });
        }

        if (dynamicToggle) {
            dynamicToggle.addEventListener('change', async () => {
                settings.isDynamicEnabled = dynamicToggle.checked;
                if (!dynamicToggle.checked && this.state.prosePolisherAnalyzer) {
                    this.state.prosePolisherAnalyzer.messageCounterForTrigger = 0;
                }
                saveSettingsDebounced();
                await this.updateGlobalRegexArray();
                this.state.uiManager.showReloadPrompt();
            });
        }

        if (triggerInput) {
            triggerInput.addEventListener('input', () => {
                const value = parseInt(triggerInput.value, 10);
                if (!isNaN(value) && value >= 1) {
                    settings.dynamicTriggerCount = value;
                    saveSettingsDebounced();
                }
            });
        }

        // Regex Generation Method Controls
        await this.setupRegexGenerationControls(settings);

        // Initialize Project Gremlin
        const { updateGremlinSettingsVisibility } = await initializeProjectGremlin(
            settings,
            this.state.uiManager.showApiEditorPopup,
            this.state.uiManager.showInstructionsEditorPopup,
            this.state.uiManager.updateGremlinApiDisplay
        );

        // Queue ready tasks
        this.state.queueReadyTask(async () => {
            try {
                this.updateRegexGenControlsVisibility(settings);
                updateGremlinSettingsVisibility();
            } catch (err) {
                console.error(`${LOG_PREFIX} Error in post-initialization setup:`, err);
            }

            setupEventListeners(this.onBeforeGremlinGeneration.bind(this), this.onUserMessageRenderedForGremlin.bind(this));
            await this.updateGlobalRegexArray();
            this.compileInternalActiveRules();
            setupRegexUIObserver();
        });
    }

    /**
     * Set up regex generation controls
     */
    async setupRegexGenerationControls(settings) {
        const regexGenMethodSelector = document.getElementById('pp_regex_gen_method_selector');
        const regexGenAiSelector = document.getElementById('pp_regex_gen_ai_selector');
        const regexTwinsCyclesSelector = document.getElementById('pp_regex_twins_cycles_selector');
        const skipTriageCheck = document.getElementById('pp_skip_triage_check');

        if (regexGenMethodSelector) {
            regexGenMethodSelector.value = settings.regexGenerationMethod;
            regexGenMethodSelector.addEventListener('change', () => {
                settings.regexGenerationMethod = regexGenMethodSelector.value;
                saveSettingsDebounced();
                this.updateRegexGenControlsVisibility(settings);
            });
        }

        if (regexGenAiSelector) {
            regexGenAiSelector.value = settings.regexGeneratorRole;
            regexGenAiSelector.addEventListener('change', () => {
                settings.regexGeneratorRole = regexGenAiSelector.value;
                saveSettingsDebounced();
            });
        }

        if (regexTwinsCyclesSelector) {
            regexTwinsCyclesSelector.value = settings.regexTwinsCycles;
            regexTwinsCyclesSelector.addEventListener('change', () => {
                settings.regexTwinsCycles = parseInt(regexTwinsCyclesSelector.value, 10);
                saveSettingsDebounced();
            });
        }

        if (skipTriageCheck) {
            skipTriageCheck.checked = settings.skipTriageCheck;
            skipTriageCheck.addEventListener('change', () => {
                settings.skipTriageCheck = skipTriageCheck.checked;
                saveSettingsDebounced();
            });
        }
    }

    /**
     * Update regex generation controls visibility
     */
    updateRegexGenControlsVisibility(settings) {
        if (!this.state.isAppReady) return;

        const singleGremlinControls = document.getElementById('pp_regex_gen_single_gremlin_controls');
        const iterativeTwinsControls = document.getElementById('pp_regex_gen_iterative_twins_controls');
        const method = settings.regexGenerationMethod;

        if (singleGremlinControls) {
            singleGremlinControls.style.display = (method === 'single') ? 'flex' : 'none';
        }
        if (iterativeTwinsControls) {
            iterativeTwinsControls.style.display = (method === 'twins') ? 'flex' : 'none';
        }
    }

    /**
     * Set up event handlers
     */
    setupEventHandlers() {
        eventSource.on(event_types.APP_READY, () => {
            this.state.runReadyQueue();
        });

        // Listen for NemoLore summary events (Integration Opportunity 2.2)
        this.setupNemoLoreIntegration();
    }

    /**
     * Set up NemoLore integration event listeners (Integration Opportunity 2.2)
     * Listens for summary creation events and analyzes them for patterns
     */
    setupNemoLoreIntegration() {
        // Import event bus
        const eventBus = window.nemoPresetEventBus;
        if (!eventBus) {
            console.log(`${LOG_PREFIX} NemoLore event bus not available, skipping summary integration`);
            return;
        }

        const settings = extension_settings[EXTENSION_NAME];
        if (!settings.analyzeNemoLoreSummaries) {
            console.log(`${LOG_PREFIX} NemoLore summary analysis is disabled in settings`);
            return;
        }

        // Listen for summary creation events
        eventBus.on('nemolore:summary_created', (data) => {
            if (!this.state.prosePolisherAnalyzer) {
                return; // Analyzer not ready yet
            }

            console.log(`${LOG_PREFIX} Received NemoLore summary event`, data);

            // Analyze the summary text for patterns
            if (data.summary) {
                this.state.prosePolisherAnalyzer.analyzeSummary(data.summary, {
                    messageIndices: data.messageIndices,
                    type: data.type,
                    isCoreMemory: data.isCoreMemory
                });
            }
        });

        console.log(`${LOG_PREFIX} ✅ NemoLore integration event listener registered`);
    }

    /**
     * Helper functions
     */
    getCompiledRegexes() {
        const settings = extension_settings[EXTENSION_NAME];
        const rulesToCompile = this.state.getActiveRules(settings);
        return regexManager.getCompiledRegexes(rulesToCompile);
    }

    compileInternalActiveRules() {
        const settings = extension_settings[EXTENSION_NAME];
        const rules = this.state.getActiveRules(settings);
        console.log(`${LOG_PREFIX} Request to compile internal active rules. Active: ${rules.length}. Global integration: ${settings.integrateWithGlobalRegex}`);
    }

    applyProsePolisherReplacements(text) {
        if (!text) return text;
        const settings = extension_settings[EXTENSION_NAME];
        const rulesToApply = this.state.getActiveRules(settings);
        return regexManager.applyReplacements(text, rulesToApply);
    }

    async updateGlobalRegexArray() {
        // Delegate to the shared implementation
        return await updateGlobalRegexArray();
    }

    validateAndCleanupConnectionProfiles(settings) {
        try {
            const connectionProfiles = extension_settings.connectionManager?.profiles || {};
            const availableProfiles = Object.keys(connectionProfiles);
            let cleanupNeeded = false;

            const gremlinRoles = ['Papa', 'Twins', 'Mama'];
            gremlinRoles.forEach(role => {
                const profileKey = `gremlin${role}Profile`;
                const currentProfile = settings[profileKey];

                if (currentProfile && !availableProfiles.includes(currentProfile)) {
                    console.warn(`${LOG_PREFIX} Connection profile "${currentProfile}" no longer exists for ${role}. Clearing reference.`);
                    settings[profileKey] = '';
                    cleanupNeeded = true;
                }
            });

            if (settings.gremlinWriterChaosOptions) {
                settings.gremlinWriterChaosOptions.forEach(option => {
                    if (option.profile && !availableProfiles.includes(option.profile)) {
                        console.warn(`${LOG_PREFIX} Connection profile "${option.profile}" no longer exists for chaos option. Clearing reference.`);
                        option.profile = '';
                        cleanupNeeded = true;
                    }
                });
            }

            if (cleanupNeeded) {
                console.log(`${LOG_PREFIX} Cleaned up invalid connection profile references.`);
                saveSettingsDebounced();
            }
        } catch (err) {
            console.warn(`${LOG_PREFIX} Error during connection profile validation:`, err);
        }
    }

    // Event handlers (placeholder methods - full implementation would be too long)
    async onBeforeGremlinGeneration(type, generateArgsObject, dryRun) {
        if (!this.state.isAppReady) return;
        if (this.state.isPipelineRunning) {
            console.log('[ProjectGremlin] Pipeline running, allowing internal /gen call.');
            return;
        }
        return;
    }

    async onUserMessageRenderedForGremlin(messageId) {
        // Full implementation from original content.js would go here
        // This is a placeholder for the merge
        console.log(`${LOG_PREFIX} onUserMessageRenderedForGremlin called for message ${messageId}`);
    }
}
