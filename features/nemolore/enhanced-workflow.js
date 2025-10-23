/**
 * Enhanced Workflow System - Phase 2 Integration
 * Complete entry point for all advanced NemoLore features
 */

import {
    eventSource,
    event_types,
    getCurrentChatId,
    getContext,
    MacrosParser
} from './utils/st-compatibility.js';

// Module Imports
import { VectorManager } from './vectorization/vector-manager.js';
import { AdvancedQuerySystem } from './vectorization/advanced-query-system.js';
import { CrossChatManager } from './vectorization/cross-chat-manager.js';
import { MemoryManager } from './vectorization/memory-manager.js';
import { performanceUtils as PerformanceMonitor } from './utils/performance-utils.js';
import { DashboardManager } from './ui/dashboard.js';
import { ContextInterceptor } from './context-interceptor.js';
import { ChatManagementManager } from './chat-management.js';
import { SettingsManager } from './core/settings.js';
import { NounHighlightingManager } from './noun-highlighting.js';
import { APIManager } from './api-manager.js';
import { AutoLorebookManager } from './auto-lorebook.js';
import { NotificationManager } from './notification-manager.js';
import { UIManager } from './ui-manager.js';


// Global state container for the workflow
let enhancedWorkflowState = {
    vectorManager: null,
    querySystem: null,
    crossChatManager: null,
    memoryManager: null,
    performanceMonitor: null,
    dashboardManager: null,
    contextInterceptor: null,
    chatManagementManager: null,
    settingsManager: null,
    nounHighlightingManager: null,
    notificationManager: null,
    uiManager: null,
    apiManager: null,
    autoLorebookManager: null,
    isInitialized: false
};

/**
 * Initialize the complete Enhanced Workflow System.
 * This function orchestrates the setup of all NemoLore managers.
 */
export async function initializeEnhancedWorkflow(settings, state, managerClasses) {
    if (enhancedWorkflowState.isInitialized) {
        console.log('[NemoLore Enhanced Workflow] Already initialized');
        return enhancedWorkflowState;
    }

    console.log('[NemoLore Enhanced Workflow] Starting Phase 2 initialization...');

    try {
        // Initialize managers in the correct order
        enhancedWorkflowState.settingsManager = new SettingsManager();
        await enhancedWorkflowState.settingsManager.initialize();
        // Use the settingsManager.settings object directly - all managers will share the same reference
        settings = enhancedWorkflowState.settingsManager.settings;

        enhancedWorkflowState.notificationManager = new NotificationManager();
        enhancedWorkflowState.notificationManager.initialize();

        enhancedWorkflowState.apiManager = new APIManager(settings);
        enhancedWorkflowState.apiManager.initialize();

        enhancedWorkflowState.memoryManager = new MemoryManager(settings, state, enhancedWorkflowState.apiManager);
        await enhancedWorkflowState.memoryManager.initialize();

        enhancedWorkflowState.uiManager = new UIManager(settings, state, enhancedWorkflowState.memoryManager);
        enhancedWorkflowState.uiManager.initialize();

        enhancedWorkflowState.autoLorebookManager = new AutoLorebookManager(settings, state);
        await enhancedWorkflowState.autoLorebookManager.initialize();

        enhancedWorkflowState.vectorManager = new VectorManager(settings, state);
        await enhancedWorkflowState.vectorManager.initialize();

        enhancedWorkflowState.querySystem = new AdvancedQuerySystem(enhancedWorkflowState.vectorManager, settings);
        await enhancedWorkflowState.querySystem.initialize();

        enhancedWorkflowState.crossChatManager = new CrossChatManager(settings, state);
        await enhancedWorkflowState.crossChatManager.initialize();

        enhancedWorkflowState.performanceMonitor = PerformanceMonitor;

        enhancedWorkflowState.chatManagementManager = new ChatManagementManager(settings, state, enhancedWorkflowState.notificationManager, enhancedWorkflowState.autoLorebookManager);
        await enhancedWorkflowState.chatManagementManager.initialize();

        enhancedWorkflowState.nounHighlightingManager = new NounHighlightingManager(settings, state);
        enhancedWorkflowState.nounHighlightingManager.initialize();

        enhancedWorkflowState.dashboardManager = new DashboardManager(settings, state, enhancedWorkflowState.uiManager, enhancedWorkflowState.autoLorebookManager, enhancedWorkflowState.settingsManager);
        await enhancedWorkflowState.dashboardManager.initialize();
        enhancedWorkflowState.uiManager.setDashboardManager(enhancedWorkflowState.dashboardManager);

        enhancedWorkflowState.contextInterceptor = new ContextInterceptor(settings, state);
        await enhancedWorkflowState.contextInterceptor.initialize();

        // Register the interceptor globally for SillyTavern to use
        if (typeof window !== 'undefined') {
            window.nemolore_intercept_messages = enhancedWorkflowState.contextInterceptor.interceptMessages.bind(enhancedWorkflowState.contextInterceptor);
            // Expose workflow state globally for noun highlighting and other features
            window.nemoLoreWorkflowState = enhancedWorkflowState;
        }

        // Set up event listeners that connect the managers
        setupEventListeners();

        // Register macros for summary injection
        registerMacros();

        enhancedWorkflowState.isInitialized = true;
        console.log('[NemoLore Enhanced Workflow] ✅ Phase 2 initialization completed successfully');

        return enhancedWorkflowState;
        
    } catch (error) {
        console.error('[NemoLore Enhanced Workflow] ❌ Initialization failed:', error);
        throw error;
    }
}

/**
 * Set up event listeners for SillyTavern integration.
 */
function setupEventListeners() {
    if (!eventSource || !event_types) {
        console.error('[NemoLore Enhanced Workflow] Event system imports failed!');
        return;
    }

    eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);
    eventSource.on(event_types.MESSAGE_SENT, handleMessageSent);
    eventSource.on(event_types.MESSAGE_RECEIVED, handleMessageReceived);
    eventSource.on(event_types.CHARACTER_CHANGED, handleCharacterChanged);

    // Listen to CHARACTER_MESSAGE_RENDERED which fires when character chat is fully loaded
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, handleCharacterMessageRendered);

    console.log('[NemoLore Enhanced Workflow] ✅ Event listeners registered successfully');

    // Initial chat setup is now triggered by CHAT_CHANGED
}

// Event handler functions
async function handleChatChanged(data) {
    if (enhancedWorkflowState.contextInterceptor) await enhancedWorkflowState.contextInterceptor.onChatChanged(data);
    if (enhancedWorkflowState.crossChatManager) await enhancedWorkflowState.crossChatManager.onChatChanged(data);
    if (enhancedWorkflowState.chatManagementManager) {
        const chatId = getCurrentChatId();
        await enhancedWorkflowState.chatManagementManager.handleIntelligentLorebookSetup(chatId);
    }
    if (enhancedWorkflowState.nounHighlightingManager) {
        enhancedWorkflowState.nounHighlightingManager.clearAllHighlighting();
        setTimeout(() => enhancedWorkflowState.nounHighlightingManager.refreshChatHighlighting(), 500);
    }
}

async function handleMessageSent(data) {
    // Note: MemoryManager now handles its own MESSAGE_SENT events via internal listeners
    if (enhancedWorkflowState.vectorManager) await enhancedWorkflowState.vectorManager.processMessage(data);
    if (enhancedWorkflowState.performanceMonitor) enhancedWorkflowState.performanceMonitor.incrementCounter('messages_sent');
    if (enhancedWorkflowState.nounHighlightingManager) {
        setTimeout(() => enhancedWorkflowState.nounHighlightingManager.refreshChatHighlighting(), 100);
    }
}

async function handleMessageReceived(data) {
    // Note: MemoryManager now handles its own MESSAGE_RECEIVED events via internal listeners
    if (enhancedWorkflowState.vectorManager) await enhancedWorkflowState.vectorManager.processMessage(data);
    if (enhancedWorkflowState.performanceMonitor) enhancedWorkflowState.performanceMonitor.incrementCounter('messages_received');
    if (enhancedWorkflowState.nounHighlightingManager) {
        setTimeout(() => enhancedWorkflowState.nounHighlightingManager.refreshChatHighlighting(), 100);
    }
}

async function handleCharacterChanged(data) {
    if (enhancedWorkflowState.contextInterceptor) await enhancedWorkflowState.contextInterceptor.onCharacterChanged(data);
}

// Track if we've already shown the setup for this chat
let hasShownSetupForChat = new Set();

// Handle CHARACTER_MESSAGE_RENDERED - fires when character chat is actually loaded with this_chid set
async function handleCharacterMessageRendered(data) {
    console.log('[NemoLore Enhanced Workflow] CHARACTER_MESSAGE_RENDERED event fired');
    
    // The CHAT_CHANGED event now reliably handles the setup logic.
    // This handler can be used for character-specific actions in the future.
}

/**
 * Register macros for summary injection into prompts
 */
function registerMacros() {
    if (!MacrosParser) {
        console.warn('[NemoLore Enhanced Workflow] MacrosParser not available, skipping macro registration');
        return;
    }

    try {
        // Register {{NemoLore}} macro
        MacrosParser.registerMacro('NemoLore', () => {
            if (!enhancedWorkflowState.memoryManager) return '';
            return enhancedWorkflowState.memoryManager.getSummariesForInjection();
        });

        // Register {{nemolore_summaries}} macro (alias)
        MacrosParser.registerMacro('nemolore_summaries', () => {
            if (!enhancedWorkflowState.memoryManager) return '';
            return enhancedWorkflowState.memoryManager.getSummariesForInjection();
        });

        console.log('[NemoLore Enhanced Workflow] ✅ Macros registered: {{NemoLore}}, {{nemolore_summaries}}');
    } catch (error) {
        console.error('[NemoLore Enhanced Workflow] Failed to register macros:', error);
    }
}

export function getEnhancedWorkflowState() {
    return enhancedWorkflowState;
}

console.log('[NemoLore Enhanced Workflow] Module loaded - Phase 2 Integration System ready');
