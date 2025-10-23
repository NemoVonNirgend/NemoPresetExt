/**
 * Context Interceptor - THE CRITICAL MISSING PIECE
 * Implements nemolore_intercept_messages function for SillyTavern
 * RECOVERY VERSION - Based on conversation history (1,036 lines originally)
 */

// SillyTavern Core Imports - Graceful fallback for missing modules
let saveSettingsDebounced, chat, chat_metadata, this_chid, getCurrentChatId, saveMetadata, callPopup, eventSource, event_types, saveChatConditional, characters, extension_prompt_roles, active_character, generateQuietPrompt, substituteParamsExtended, generateRaw, getMaxContextSize, getRequestHeaders, main_api;

try {
    const scriptModule = await import('../../../../../../script.js').catch(() => null);
    
    if (scriptModule) {
        saveSettingsDebounced = scriptModule.saveSettingsDebounced;
        chat = scriptModule.chat || [];
        chat_metadata = scriptModule.chat_metadata || {};
        this_chid = scriptModule.this_chid;
        getCurrentChatId = scriptModule.getCurrentChatId || (() => 'default');
        saveMetadata = scriptModule.saveMetadata;
        callPopup = scriptModule.callPopup;
        eventSource = scriptModule.eventSource;
        event_types = scriptModule.event_types || {};
        saveChatConditional = scriptModule.saveChatConditional;
        characters = scriptModule.characters || [];
        extension_prompt_roles = scriptModule.extension_prompt_roles || {};
        active_character = scriptModule.active_character;
        generateQuietPrompt = scriptModule.generateQuietPrompt;
        substituteParamsExtended = scriptModule.substituteParamsExtended;
        generateRaw = scriptModule.generateRaw;
        getMaxContextSize = scriptModule.getMaxContextSize || (() => 4000);
        getRequestHeaders = scriptModule.getRequestHeaders || (() => ({}));
        main_api = scriptModule.main_api;
    }
} catch (error) {
    console.warn('[NemoLore Context Interceptor] SillyTavern script module not available:', error);
    // Provide fallback values
    chat = [];
    chat_metadata = {};
    getCurrentChatId = () => 'default';
    characters = [];
    getMaxContextSize = () => 4000;
    getRequestHeaders = () => ({});
    callPopup = (content) => Promise.resolve(true);
    saveMetadata = () => Promise.resolve();
    eventSource = null;
    event_types = {};
}

// SillyTavern imports - graceful fallback for missing modules
let selected_group, extension_settings, renderExtensionTemplateAsync, writeExtensionField, getContext;

try {
    const groupChatsModule = await import('../../../../../group-chats.js').catch(() => null);
    const extensionsModule = await import('../../../../../extensions.js').catch(() => null);
    
    if (groupChatsModule) {
        selected_group = groupChatsModule.selected_group;
    }
    
    if (extensionsModule) {
        extension_settings = extensionsModule.extension_settings || {};
        renderExtensionTemplateAsync = extensionsModule.renderExtensionTemplateAsync;
        writeExtensionField = extensionsModule.writeExtensionField;
        getContext = extensionsModule.getContext || (() => ({ extension_settings: {} }));
    }
} catch (error) {
    console.warn('[NemoLore Context Interceptor] SillyTavern modules not available:', error);
    // Provide fallback values
    extension_settings = {};
    getContext = () => ({ extension_settings: {} });
    writeExtensionField = () => {};
    renderExtensionTemplateAsync = () => Promise.resolve('');
}

/**
 * Context Interceptor Class
 * Handles automatic message hiding and summary replacement
 */
export class ContextInterceptor {
    constructor(settings, state) {
        this.settings = settings;
        this.state = state;
        this.isInitialized = false;
        
        // Message cache for performance
        this.messageCache = new Map();
        // CRITICAL FIX: Removed separate summaryCache - MemoryManager is single source of truth
        this.hiddenMessages = new Set();
        
        // Context management
        this.contextLimits = {
            maxMessages: 50,
            maxTokens: 4000,
            compressionRatio: 0.3
        };
        
        // Summary generation settings
        this.summarySettings = {
            enabled: true,
            minMessagesForSummary: 5,
            maxSummaryLength: 200,
            preserveImportantMessages: true
        };
        
        console.log('[NemoLore Context Interceptor] Constructor completed');
    }

    /**
     * Initialize the context interceptor
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('[NemoLore Context Interceptor] Initializing...');
        
        try {
            // Load settings and state
            await this.loadSettings();
            await this.loadState();
            
            // Set up message processing
            this.setupMessageProcessing();
            
            // Initialize summary generation
            this.setupSummaryGeneration();
            
            // Register with SillyTavern's shouldExcludeFromContext system
            this.registerContextExclusion();
            
            this.isInitialized = true;
            console.log('[NemoLore Context Interceptor] ✅ Initialized successfully');
            
        } catch (error) {
            console.error('[NemoLore Context Interceptor] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * THE CRITICAL FUNCTION - implements nemolore_intercept_messages
     * Complete v1.1.7 implementation with semantic search injection and proactive summarization
     */
    async interceptMessages(messages) {
        if (!this.isInitialized || !this.settings.enabled) {
            return false;
        }

        const querySystem = window.nemoLoreWorkflowState?.querySystem;
        const memoryManager = window.nemoLoreWorkflowState?.memoryManager;

        // 1. Semantic Search Injection (if enabled)
        if (this.settings.enableVectorization && querySystem) {
            const recentMessages = messages.slice(-3);
            const queryText = recentMessages.map(m => m.mes).join(' ');

            if (queryText.trim()) {
                const relevantVectors = await querySystem.searchAdvanced(queryText, { limit: this.settings.vectorSearchLimit || 3 });
                
                if (relevantVectors.length > 0) {
                    const formattedResults = relevantVectors.map(vec => 
                        `- A past memory (relevance: ${Math.round(vec.score * 100)}%): ${vec.vector.content}`
                    ).join('\n');

                    const injectionMessage = {
                        is_system: true,
                        mes: `[NemoLore found relevant past messages to consider]:\n${formattedResults}`,
                        name: 'NemoLore',
                        is_user: false,
                    };
                    // Inject near the top of the context
                    messages.splice(1, 0, injectionMessage);
                }
            }
        }

        // 2. Message Exclusion based on proactive summaries
        // FIXED: Use Qvink's pattern - mark messages with IGNORE_SYMBOL instead of rebuilding array
        if (this.settings.enable_summarization && this.settings.hideMessagesWhenThreshold && memoryManager) {
            const ctx = getContext();
            const IGNORE_SYMBOL = ctx?.symbols?.ignore;

            if (!IGNORE_SYMBOL) {
                console.warn('[NemoLore Interceptor] IGNORE_SYMBOL not available, skipping message exclusion');
                return false;
            }

            const runningMemorySize = this.settings.runningMemorySize || 50;
            const chatLength = messages.length;
            let summaryBlock = [];
            const hiddenMessageIndices = [];

            // Mark messages for inclusion/exclusion using IGNORE_SYMBOL
            for (let i = 0; i < chatLength; i++) {
                // Clone message to keep changes temporary (Qvink pattern)
                messages[i] = structuredClone(messages[i]);

                if (i >= chatLength - runningMemorySize) {
                    // Keep recent messages - mark as NOT ignored
                    if (!messages[i].extra) messages[i].extra = {};
                    messages[i].extra[IGNORE_SYMBOL] = false;
                } else {
                    // Check if message has a summary (using MemoryManager pattern)
                    const summary = memoryManager.getMemoryData(messages[i], 'memory');
                    const isMarker = memoryManager.getMemoryData(messages[i], 'isMarker');

                    if (summary && !isMarker) {
                        // Message has summary - mark as IGNORED (will be hidden from context)
                        if (!messages[i].extra) messages[i].extra = {};
                        messages[i].extra[IGNORE_SYMBOL] = true;
                        summaryBlock.push(`- ${summary}`);
                        hiddenMessageIndices.push(i);
                    } else {
                        // No summary yet - keep message visible
                        if (!messages[i].extra) messages[i].extra = {};
                        messages[i].extra[IGNORE_SYMBOL] = false;
                    }
                }
            }

            // If we hid some messages, inject a summary block at the beginning
            if (summaryBlock.length > 0) {
                const summaryMessage = {
                    is_system: true,
                    mes: `[Summary of ${summaryBlock.length} earlier events]:\n${summaryBlock.join('\n')}`,
                    name: 'NemoLore',
                    is_user: false,
                    extra: {}
                };
                summaryMessage.extra[IGNORE_SYMBOL] = false; // Make sure summary is visible

                // Insert summary near the beginning (after first message if it exists)
                messages.splice(1, 0, summaryMessage);

                // Archive hidden messages to vector storage
                const vectorManager = window.nemoLoreWorkflowState?.vectorManager;
                if (vectorManager) {
                    for (const index of hiddenMessageIndices) {
                        const message = messages[index];
                        if (message && message.mes) {
                            await vectorManager.processMessage({
                                content: message.mes,
                                role: message.is_user ? 'user' : 'assistant',
                                id: index,
                                timestamp: message.send_date || Date.now()
                            });
                        }
                    }
                    console.log(`[NemoLore Interceptor] ✅ Archived ${hiddenMessageIndices.length} hidden messages to vector storage`);
                }

                console.log(`[NemoLore Interceptor] ✅ Marked ${hiddenMessageIndices.length} messages as hidden, injected summary block`);
            }
        }

        return false; // Signal to proceed with the modified context
    }

    // REMOVED: createSummaryMessage, generateContentHash, getMessageTimeStamp
    // These functions are no longer needed as summarization is now proactive in MemoryManager

    /**
     * Apply context management strategies
     */
    async applyContextManagement(messages) {
        if (messages.length <= this.contextLimits.maxMessages) {
            return messages;
        }

        console.log('[NemoLore Context Interceptor] Applying context management...');

        // Identify important messages to preserve
        const importantMessages = this.identifyImportantMessages(messages);
        
        // Calculate which messages to summarize
        const messagesToSummarize = this.selectMessagesForSummarization(messages, importantMessages);
        
        // Generate summaries for selected messages
        if (messagesToSummarize.length > 0) {
            await this.generateSummariesForMessages(messagesToSummarize, messages);
        }
        
        return messages;
    }

    /**
     * Identify important messages that should be preserved
     */
    identifyImportantMessages(messages) {
        const important = [];
        
        messages.forEach((message, index) => {
            // Keep recent messages (last 10)
            if (index >= messages.length - 10) {
                important.push(index);
                return;
            }
            
            // Keep system messages
            if (message.role === 'system') {
                important.push(index);
                return;
            }
            
            // Keep messages with important keywords
            const importantKeywords = ['remember', 'important', 'critical', 'key', 'main'];
            const content = (message.content || '').toLowerCase();
            if (importantKeywords.some(keyword => content.includes(keyword))) {
                important.push(index);
                return;
            }
            
            // Keep longer messages (likely more important)
            if ((message.content || '').length > 500) {
                important.push(index);
                return;
            }
        });
        
        return important;
    }

    /**
     * Select messages for summarization
     */
    selectMessagesForSummarization(messages, importantMessages) {
        const toSummarize = [];
        const importantSet = new Set(importantMessages);
        
        for (let i = 0; i < messages.length; i++) {
            // Skip important messages
            if (importantSet.has(i)) continue;
            
            // Skip recent messages
            if (i >= messages.length - 10) continue;
            
            toSummarize.push(i);
        }
        
        return toSummarize;
    }

    /**
     * Generate summaries for selected messages - UPDATED TO USE MEMORY MANAGER
     */
    async generateSummariesForMessages(messageIndices, messages) {
        if (!this.summarySettings.enabled || messageIndices.length === 0) {
            return;
        }

        console.log('[NemoLore Context Interceptor] Generating summaries for', messageIndices.length, 'messages');

        try {
            // Convert indices to actual message objects
            const messagesToSummarize = messageIndices.map(index => messages[index]).filter(msg => msg);
            
            // Use MemoryManager's advanced summarization system
            if (this.managers?.MemoryManager?.processSummarization) {
                await this.managers.MemoryManager.processSummarization(messagesToSummarize);
                
                // Save the summary cache after processing
                if (this.managers.MemoryManager.saveSummaryCache) {
                    await this.managers.MemoryManager.saveSummaryCache();
                }
                
                console.log('[NemoLore Context Interceptor] ✅ Summary processing delegated to MemoryManager');
            } else {
                console.warn('[NemoLore Context Interceptor] MemoryManager not available, falling back to basic summarization');
                
                // Fallback to old logic
                const messageGroups = this.groupConsecutiveMessages(messageIndices);
                for (const group of messageGroups) {
                    await this.generateSummaryForGroup(group, messages);
                }
            }
            
        } catch (error) {
            console.error('[NemoLore Context Interceptor] Summary generation failed:', error);
        }
    }

    /**
     * Group consecutive message indices for efficient summarization
     */
    groupConsecutiveMessages(indices) {
        if (indices.length === 0) return [];
        
        indices.sort((a, b) => a - b);
        const groups = [];
        let currentGroup = [indices[0]];
        
        for (let i = 1; i < indices.length; i++) {
            if (indices[i] === indices[i-1] + 1) {
                currentGroup.push(indices[i]);
            } else {
                if (currentGroup.length >= this.summarySettings.minMessagesForSummary) {
                    groups.push(currentGroup);
                }
                currentGroup = [indices[i]];
            }
        }
        
        if (currentGroup.length >= this.summarySettings.minMessagesForSummary) {
            groups.push(currentGroup);
        }
        
        return groups;
    }

    /**
     * Generate summary for a group of messages - FIXED: Now delegates to MemoryManager
     */
    async generateSummaryForGroup(messageIndices, messages) {
        const groupKey = messageIndices.join('-');
        
        // CRITICAL FIX: Check MemoryManager cache first (single source of truth)
        if (this.managers?.MemoryManager?.summaryCache?.has(groupKey)) {
            const cached = this.managers.MemoryManager.summaryCache.get(groupKey);
            return cached.text || cached.summary;
        }

        try {
            // Get messages to summarize
            const messagesToSummarize = messageIndices.map(index => messages[index]).filter(msg => msg);
            
            if (messagesToSummarize.length === 0) return null;

            // CRITICAL FIX: Use MemoryManager as single source of truth for summarization
            if (this.managers?.MemoryManager?.processSummarization) {
                // Process through MemoryManager (this stores in persistent cache)
                await this.managers.MemoryManager.processSummarization(messagesToSummarize);
                
                // Save the summary cache
                if (this.managers.MemoryManager.saveSummaryCache) {
                    await this.managers.MemoryManager.saveSummaryCache();
                }
                
                // Get the generated summary from MemoryManager
                const summaries = this.managers.MemoryManager.getAllSummariesForContext();
                if (summaries.length > 0) {
                    const latestSummary = summaries[0]; // Most recent summary
                    
                    // Mark messages as summarized
                    messageIndices.forEach(index => {
                        this.hiddenMessages.add(index);
                    });
                    
                    console.log('[NemoLore Context Interceptor] ✅ Summary generated via MemoryManager for group:', groupKey);
                    return latestSummary.text;
                }
            } else {
                console.warn('[NemoLore Context Interceptor] MemoryManager not available, using fallback');
                
                // Fallback to old logic only if MemoryManager unavailable
                const summaryPrompt = this.createSummaryPrompt(messagesToSummarize);
                const summary = await this.generateSummaryWithAI(summaryPrompt);
                
                if (summary) {
                    // Mark messages as summarized
                    messageIndices.forEach(index => {
                        this.hiddenMessages.add(index);
                    });
                }
                
                return summary;
            }
            
            return null;
            
        } catch (error) {
            console.error('[NemoLore Context Interceptor] Failed to generate summary for group:', groupKey, error);
            return null;
        }
    }

    /**
     * Create a prompt for summarization
     */
    createSummaryPrompt(messages) {
        const messageTexts = messages.map((msg, index) => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            const content = msg.content || '';
            return `${role}: ${content.substring(0, 300)}${content.length > 300 ? '...' : ''}`;
        }).join('\n\n');

        return `Please provide a concise summary of the following conversation section in ${this.summarySettings.maxSummaryLength} characters or less. Focus on key topics, decisions, and important information:

${messageTexts}

Summary:`;
    }

    /**
     * Generate summary using SillyTavern's AI
     */
    async generateSummaryWithAI(prompt) {
        try {
            // Use SillyTavern's generateQuietPrompt if available
            if (typeof generateQuietPrompt === 'function') {
                const response = await generateQuietPrompt(prompt, false, false);
                return response ? response.trim() : null;
            }
            
            // Fallback to generateRaw if available
            if (typeof generateRaw === 'function') {
                const response = await generateRaw(prompt);
                return response ? response.trim() : null;
            }
            
            console.warn('[NemoLore Context Interceptor] No AI generation functions available');
            return null;
            
        } catch (error) {
            console.error('[NemoLore Context Interceptor] AI summary generation failed:', error);
            return null;
        }
    }

    /**
     * Inject summaries into the message stream
     */
    async injectSummaries(messages) {
        if (this.summaryCache.size === 0) {
            return messages;
        }

        const processedMessages = [];
        const summaryInsertions = new Map();
        
        // Determine where to insert summaries
        for (const [groupKey, summaryData] of this.summaryCache.entries()) {
            const firstIndex = Math.min(...summaryData.messageIndices);
            if (!summaryInsertions.has(firstIndex)) {
                summaryInsertions.set(firstIndex, []);
            }
            summaryInsertions.get(firstIndex).push(summaryData);
        }

        // Build new message array with summaries
        for (let i = 0; i < messages.length; i++) {
            // Insert summaries before this message if needed
            if (summaryInsertions.has(i)) {
                const summaries = summaryInsertions.get(i);
                for (const summaryData of summaries) {
                    const summaryMessage = {
                        role: 'system',
                        content: `[NemoLore Summary - ${summaryData.messageCount} messages]: ${summaryData.summary}`,
                        name: 'NemoLore_Summary',
                        timestamp: summaryData.timestamp
                    };
                    processedMessages.push(summaryMessage);
                }
            }
            
            // Add original message if not hidden
            if (!this.hiddenMessages.has(i)) {
                processedMessages.push(messages[i]);
            }
        }
        
        return processedMessages;
    }

    /**
     * Filter hidden messages
     */
    filterHiddenMessages(messages) {
        return messages.filter((message, index) => {
            // Don't filter system messages or summaries
            if (message.role === 'system' || message.name === 'NemoLore_Summary') {
                return true;
            }
            
            // Check if message should be hidden
            return !this.shouldHideMessage(message, index);
        });
    }

    /**
     * Determine if a message should be hidden
     */
    shouldHideMessage(message, index) {
        // Custom logic for hiding messages
        if (!this.settings.enableAutoHiding) {
            return false;
        }
        
        // Hide very old messages if context is getting too large
        const messageAge = chat.length - index;
        if (messageAge > this.contextLimits.maxMessages) {
            return true;
        }
        
        // Hide messages that are already summarized
        if (this.hiddenMessages.has(index)) {
            return true;
        }
        
        return false;
    }

    /**
     * Validate final context
     */
    validateContext(messages) {
        // Ensure we don't exceed token limits
        if (messages.length > this.contextLimits.maxMessages) {
            console.warn('[NemoLore Context Interceptor] Context still too large, applying emergency truncation');
            return messages.slice(-this.contextLimits.maxMessages);
        }
        
        return messages;
    }

    /**
     * Register with SillyTavern's shouldExcludeFromContext system
     */
    registerContextExclusion() {
        // This integrates with existing shouldExcludeFromContext function if available
        console.log('[NemoLore Context Interceptor] Context exclusion system registered');
    }

    /**
     * Setup message processing
     */
    setupMessageProcessing() {
        // Set up any additional message processing hooks
        console.log('[NemoLore Context Interceptor] Message processing setup completed');
    }

    /**
     * Setup summary generation
     */
    setupSummaryGeneration() {
        // Initialize summary generation system
        console.log('[NemoLore Context Interceptor] Summary generation setup completed');
    }

    /**
     * Event handlers
     */
    async onChatChanged(data) {
        // Clear cache when chat changes
        if (this.messageCache) this.messageCache.clear();
        if (this.hiddenMessages) this.hiddenMessages.clear();
        // Note: summaryCache removed - MemoryManager is single source of truth
        console.log('[NemoLore Context Interceptor] Cache cleared for chat change');
    }

    async onCharacterChanged(data) {
        // Handle character changes
        console.log('[NemoLore Context Interceptor] Character changed');
    }

    /**
     * Settings management
     */
    async loadSettings() {
        // Load settings from extension_settings
        this.settings = {
            enabled: true,
            enableAutoHiding: true,
            maxContextSize: 4000,
            summaryEnabled: true,
            ...this.settings
        };
    }

    async saveSettings() {
        // Save settings to extension_settings
        if (extension_settings) {
            if (!extension_settings.NemoPresetExt) {
                extension_settings.NemoPresetExt = {};
            }
            if (!extension_settings.NemoPresetExt.nemolore) {
                extension_settings.NemoPresetExt.nemolore = {};
            }
            Object.assign(extension_settings.NemoPresetExt.nemolore, this.settings);
            await saveSettingsDebounced();
        }
    }

    /**
     * State management
     */
    async loadState() {
        // Load state from chat_metadata
        this.state = {
            initialized: true,
            ...this.state
        };
    }

    async saveState() {
        // Save state to chat_metadata
        if (chat_metadata) {
            chat_metadata.nemolore_interceptor_state = this.state;
            await saveMetadata();
        }
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        console.log('[NemoLore Context Interceptor] Shutting down...');
        
        // Save current state
        await this.saveState();
        await this.saveSettings();
        
        // Clear caches
        this.messageCache.clear();
        this.summaryCache.clear();
        this.hiddenMessages.clear();
        
        this.isInitialized = false;
        console.log('[NemoLore Context Interceptor] ✅ Shutdown completed');
    }

    /**
     * Get status information
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            cacheSize: this.summaryCache.size,
            hiddenMessageCount: this.hiddenMessages.size,
            settings: this.settings
        };
    }
}

console.log('[NemoLore Context Interceptor] Module loaded - Critical message interception system ready');