// NemoLore Extension Entry Point
// NOTE: Core SillyTavern functions (loadExtensionSettings, saveExtensionSettings, etc.) are globally available.

import { extension_settings } from '../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../script.js';
import { UIManager } from './ui-manager.js';
import { AutoLorebookManager } from './auto-lorebook.js';
import { ChatManagementManager } from './chat-management.js';
import { NounHighlightingManager } from './noun-highlighting.js';
import { initializeEnhancedWorkflow } from './enhanced-workflow.js';
import { DashboardManager } from './ui/dashboard.js';
import { APIManager } from './api-manager.js';
import { NotificationManager } from './notification-manager.js';
import { SettingsManager } from './core/settings.js';
import { ContextInterceptor } from './context-interceptor.js';
import { VectorManager } from './vectorization/vector-manager.js';
import { AdvancedQuerySystem } from './vectorization/advanced-query-system.js';
import { CrossChatManager } from './vectorization/cross-chat-manager.js';
import { MemoryManager } from './vectorization/memory-manager.js';
import { performanceUtils } from './utils/performance-utils.js';

// Default settings structure
const DEFAULT_SETTINGS = {
    enabled: true,
    auto_summarize: true,
    auto_lorebook: true,
    debugMode: false,
    enable_summarization: true,
    enablePairedSummarization: true,  // Changed to true - paired summaries on by default
    hideMessagesWhenThreshold: true,
    runningMemorySize: 50,
    summary_max_length: 250,
    summaryTrigger: 20,
    contextPreservation: 50,
    enableCoreMemories: true,
    coreMemoryPromptLorebook: true,
    highlightNouns: true,
    enableVectorization: true,
    vectorSearchLimit: 3,
    enable_async_api: false,
    async_api_provider: '',
    async_api_key: '',
    async_api_model: '',
    async_api_endpoint: '',
};

/**
 * NemoLore Extension Main Class
 */
export class NemoLoreExtension {
    constructor() {
        this.settings = null;
        this.state = {
            currentChatLorebook: null,
            isSummarizing: false,
            isGeneratingLore: false,
        };
        this.workflowState = null;
    }

    /**
     * Load NemoLore CSS dynamically
     */
    loadCSS() {
        const cssPath = 'scripts/extensions/third-party/NemoPresetExt/features/nemolore/style.css';

        // Check if CSS is already loaded
        if (document.querySelector(`link[href="${cssPath}"]`)) {
            console.log('[NemoLore] CSS already loaded');
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = cssPath;
        document.head.appendChild(link);
        console.log('[NemoLore] CSS loaded successfully');
    }

    /**
     * Main initialization function for the NemoLore extension.
     */
    async initialize() {
        console.log('[NemoLore] Initializing Extension...');

        // Load CSS first
        this.loadCSS();

        // Load settings from the NemoPresetExt namespace
        const nemoPresetSettings = extension_settings.NemoPresetExt || {};
        const loadedSettings = nemoPresetSettings.nemolore || {};
        this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };

        // Save back the merged settings to persist any new defaults
        if (!extension_settings.NemoPresetExt) {
            extension_settings.NemoPresetExt = {};
        }
        extension_settings.NemoPresetExt.nemolore = this.settings;
        saveSettingsDebounced();

        // A collection of all manager classes to be passed to the workflow initializer
        const managerClasses = {
            UIManager,
            AutoLorebookManager,
            ChatManagementManager,
            NounHighlightingManager,
            DashboardManager,
            APIManager,
            NotificationManager,
            SettingsManager,
            ContextInterceptor,
            VectorManager,
            AdvancedQuerySystem,
            CrossChatManager,
            MemoryManager,
            PerformanceMonitor: performanceUtils,
        };

        // Initialize the enhanced workflow, which will in turn initialize all its component managers
        this.workflowState = await initializeEnhancedWorkflow(this.settings, this.state, managerClasses);

        // Make the dashboard globally accessible for the top bar button
        if (this.workflowState.dashboardManager) {
            window.nemoloreDashboardManager = this.workflowState.dashboardManager;
        }

        // Always add the UI button so users can access settings/dashboard even when disabled
        if (this.workflowState.uiManager) {
            this.workflowState.uiManager.addTopBarButton();
            if (!this.settings.enabled) {
                console.log('[NemoLore] Dashboard UI initialized (functionality disabled - toggle "Enable NemoLore" to activate)');
            }
        }

        console.log('[NemoLore] ✅ Extension Initialized Successfully');
    }
}