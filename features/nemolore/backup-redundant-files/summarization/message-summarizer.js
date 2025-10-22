/**
 * Message Summarizer
 * RECOVERY VERSION - AI-powered message summarization system
 */

// SillyTavern Core Imports - FIXED PATHS
import {
    saveSettingsDebounced,
    chat,
    chat_metadata,
    this_chid,
    getCurrentChatId,
    saveMetadata,
    callPopup,
    eventSource,
    event_types,
    saveChatConditional,
    characters,
    extension_prompt_roles,
    active_character,
    generateQuietPrompt,
    substituteParamsExtended,
    generateRaw,
    getMaxContextSize,
    getRequestHeaders,
    main_api
} from '../../../../../../../../script.js';

// SillyTavern imports - graceful fallback for missing modules
let selected_group, extension_settings, renderExtensionTemplateAsync, writeExtensionField, getContext;

try {
    const groupChatsModule = await import('../../../../../../../../scripts/group-chats.js').catch(() => null);
    const extensionsModule = await import('../../../../../../../../scripts/extensions.js').catch(() => null);
    
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
    console.warn('[NemoLore Message Summarizer] SillyTavern modules not available:', error);
    // Provide fallback values
    extension_settings = {};
    getContext = () => ({ extension_settings: {} });
    writeExtensionField = () => {};
    renderExtensionTemplateAsync = () => Promise.resolve('');
}

import { eventSystem, NEMOLORE_EVENTS } from '../../core/event-system.js';

/**
 * AI-Powered Message Summarization System
 */
export class MessageSummarizer {
    constructor(settings) {
        this.settings = settings;
        this.isInitialized = false;
        
        // Summarization cache
        this.summaryCache = new Map();
        this.processingQueue = [];
        this.isProcessing = false;
        
        // Summary templates
        this.summaryTemplates = {
            conversation: "Summarize the following conversation section, focusing on key topics, decisions, and important information:",
            narrative: "Provide a concise summary of this narrative section, highlighting main events and character actions:",
            dialogue: "Summarize this dialogue section, capturing the main points and emotional context:",
            description: "Condense this descriptive text while preserving important details:",
            action: "Summarize this action sequence, focusing on outcomes and consequences:"
        };
        
        // Summary quality metrics
        this.qualityThresholds = {
            minLength: 20,
            maxLength: 500,
            compressionRatio: 0.3,
            coherenceScore: 0.7
        };
        
        console.log('[NemoLore Message Summarizer] Constructor completed');
    }

    /**
     * Initialize the message summarizer
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('[NemoLore Message Summarizer] Initializing...');
        
        try {
            // Set up summarization engine
            this.setupSummarizationEngine();
            
            // Load cached summaries
            await this.loadSummaryCache();
            
            // Set up processing queue
            this.setupProcessingQueue();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('[NemoLore Message Summarizer] ✅ Initialized successfully');
            
        } catch (error) {
            console.error('[NemoLore Message Summarizer] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Set up summarization engine
     */
    setupSummarizationEngine() {
        // Configure AI generation settings
        this.generationSettings = {
            max_length: this.settings.summarization?.maxLength || 200,
            temperature: 0.3, // Low temperature for consistency
            top_p: 0.9,
            frequency_penalty: 0.1,
            presence_penalty: 0.1
        };
        
        console.log('[NemoLore Message Summarizer] Summarization engine setup completed');
    }

    /**
     * Load cached summaries
     */
    async loadSummaryCache() {
        try {
            const chatId = getCurrentChatId();
            if (chatId) {
                // Load from local storage or metadata
                const cacheKey = `nemolore_summaries_${chatId}`;
                const cached = localStorage.getItem(cacheKey);
                
                if (cached) {
                    const parsedCache = JSON.parse(cached);
                    for (const [key, value] of Object.entries(parsedCache)) {
                        this.summaryCache.set(key, value);
                    }
                }
            }
            
            console.log(`[NemoLore Message Summarizer] Loaded ${this.summaryCache.size} cached summaries`);
            
        } catch (error) {
            console.warn('[NemoLore Message Summarizer] Failed to load summary cache:', error);
        }
    }

    /**
     * Set up processing queue
     */
    setupProcessingQueue() {
        // Process queue every 2 seconds
        this.queueInterval = setInterval(() => {
            if (!this.isProcessing && this.processingQueue.length > 0) {
                this.processQueueBatch();
            }
        }, 2000);
        
        console.log('[NemoLore Message Summarizer] Processing queue setup completed');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        eventSystem.on(NEMOLORE_EVENTS.CONTEXT_INTERCEPTED, (data) => {
            this.handleContextIntercepted(data);
        });
        
        console.log('[NemoLore Message Summarizer] Event listeners setup completed');
    }

    /**
     * Handle context interception event
     */
    handleContextIntercepted(data) {
        if (data.messagesToSummarize && data.messagesToSummarize.length > 0) {
            this.queueSummarization(data.messagesToSummarize);
        }
    }

    /**
     * Queue messages for summarization
     */
    queueSummarization(messages) {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.processingQueue.push({
            id: batchId,
            messages: messages,
            timestamp: Date.now(),
            priority: this.calculatePriority(messages)
        });
        
        // Sort queue by priority
        this.processingQueue.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Calculate processing priority
     */
    calculatePriority(messages) {
        let priority = 0;
        
        // More messages = higher priority
        priority += messages.length * 10;
        
        // Recent messages = higher priority
        const now = Date.now();
        const averageAge = messages.reduce((sum, msg) => {
            const age = now - (msg.timestamp || now);
            return sum + age;
        }, 0) / messages.length;
        
        priority += Math.max(0, 100 - (averageAge / (1000 * 60 * 60))); // Age in hours
        
        // Important message indicators
        const importantCount = messages.filter(msg => 
            this.isImportantMessage(msg)).length;
        priority += importantCount * 20;
        
        return priority;
    }

    /**
     * Check if message is important
     */
    isImportantMessage(message) {
        const content = (message.content || message.mes || '').toLowerCase();
        
        // Check for important keywords
        const importantKeywords = [
            'important', 'critical', 'urgent', 'remember', 'note',
            'decision', 'plan', 'goal', 'objective', 'key'
        ];
        
        return importantKeywords.some(keyword => content.includes(keyword)) ||
               content.length > 500 || // Long messages often important
               message.role === 'system'; // System messages are important
    }

    /**
     * Process a batch from the queue
     */
    async processQueueBatch() {
        if (this.isProcessing || this.processingQueue.length === 0) return;
        
        this.isProcessing = true;
        
        try {
            const batch = this.processingQueue.shift();
            await this.processBatch(batch);
            
        } catch (error) {
            console.error('[NemoLore Message Summarizer] Batch processing failed:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Process a single batch
     */
    async processBatch(batch) {
        console.log(`[NemoLore Message Summarizer] Processing batch ${batch.id} with ${batch.messages.length} messages`);
        
        try {
            // Group messages for optimal summarization
            const messageGroups = this.groupMessages(batch.messages);
            
            for (const group of messageGroups) {
                const summary = await this.summarizeMessageGroup(group);
                
                if (summary) {
                    // Cache the summary
                    const cacheKey = this.generateCacheKey(group);
                    this.summaryCache.set(cacheKey, {
                        summary: summary,
                        messages: group.map(msg => ({
                            id: msg.id,
                            timestamp: msg.timestamp,
                            hash: this.generateMessageHash(msg)
                        })),
                        created: Date.now(),
                        type: this.detectGroupType(group)
                    });
                    
                    // Emit summary generated event
                    eventSystem.emit(NEMOLORE_EVENTS.SUMMARY_GENERATED, {
                        batchId: batch.id,
                        groupSize: group.length,
                        summary: summary,
                        cacheKey: cacheKey
                    });
                }
            }
            
            // Save updated cache
            await this.saveSummaryCache();
            
        } catch (error) {
            console.error(`[NemoLore Message Summarizer] Failed to process batch ${batch.id}:`, error);
        }
    }

    /**
     * Group messages for optimal summarization
     */
    groupMessages(messages) {
        const groups = [];
        let currentGroup = [];
        let currentLength = 0;
        const maxGroupLength = 2000; // Characters
        const minGroupSize = this.settings.summarization?.minMessages || 3;
        
        for (const message of messages) {
            const messageLength = (message.content || message.mes || '').length;
            
            if (currentLength + messageLength > maxGroupLength && currentGroup.length >= minGroupSize) {
                // Start new group
                groups.push([...currentGroup]);
                currentGroup = [message];
                currentLength = messageLength;
            } else {
                currentGroup.push(message);
                currentLength += messageLength;
            }
        }
        
        // Add final group if it meets minimum size
        if (currentGroup.length >= minGroupSize) {
            groups.push(currentGroup);
        } else if (groups.length > 0) {
            // Merge small final group with last group
            groups[groups.length - 1].push(...currentGroup);
        }
        
        return groups;
    }

    /**
     * Summarize a group of messages
     */
    async summarizeMessageGroup(messageGroup) {
        if (!messageGroup || messageGroup.length === 0) return null;
        
        try {
            // Detect group type and select appropriate template
            const groupType = this.detectGroupType(messageGroup);
            const template = this.summaryTemplates[groupType] || this.summaryTemplates.conversation;
            
            // Prepare messages for summarization
            const formattedMessages = this.formatMessagesForSummarization(messageGroup);
            
            // Create summarization prompt
            const prompt = this.createSummarizationPrompt(template, formattedMessages, groupType);
            
            // Generate summary using AI
            const summary = await this.generateSummaryWithAI(prompt);
            
            if (summary) {
                // Validate and enhance summary
                const validatedSummary = this.validateAndEnhanceSummary(summary, messageGroup);
                return validatedSummary;
            }
            
            return null;
            
        } catch (error) {
            console.error('[NemoLore Message Summarizer] Failed to summarize message group:', error);
            return null;
        }
    }

    /**
     * Detect the type of message group
     */
    detectGroupType(messageGroup) {
        const combinedContent = messageGroup
            .map(msg => (msg.content || msg.mes || '').toLowerCase())
            .join(' ');
        
        // Action indicators
        if (/\b(moves|walks|runs|attacks|casts|performs|does|action)\b/.test(combinedContent)) {
            return 'action';
        }
        
        // Dialogue indicators
        if (/["']|says?|tells?|asks?|replies?|responds?/.test(combinedContent)) {
            return 'dialogue';
        }
        
        // Description indicators
        if (/\b(looks?|appears?|seems?|describes?|detailed?|beautiful)\b/.test(combinedContent)) {
            return 'description';
        }
        
        // Narrative indicators
        if (/\b(then|next|after|before|during|while|when)\b/.test(combinedContent)) {
            return 'narrative';
        }
        
        return 'conversation'; // Default
    }

    /**
     * Format messages for summarization
     */
    formatMessagesForSummarization(messageGroup) {
        return messageGroup.map((msg, index) => {
            const role = msg.role === 'user' ? 'User' : (msg.name || 'Assistant');
            const content = (msg.content || msg.mes || '').substring(0, 1000); // Limit content
            const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
            
            return `[${index + 1}] ${role}${timestamp ? ` (${timestamp})` : ''}: ${content}`;
        }).join('\n\n');
    }

    /**
     * Create summarization prompt
     */
    createSummarizationPrompt(template, formattedMessages, groupType) {
        const maxLength = this.settings.summarization?.maxLength || 200;
        const character = active_character || 'the assistant';
        
        return `${template}

Context: This is a ${groupType} section from a conversation with ${character}.
Target length: ${maxLength} characters or less.
Focus on: Key information, decisions made, important events, and character development.

Messages to summarize:
${formattedMessages}

Summary:`;
    }

    /**
     * Generate summary using AI
     */
    async generateSummaryWithAI(prompt) {
        try {
            let summary = null;
            
            // Try generateQuietPrompt first (preferred)
            if (typeof generateQuietPrompt === 'function') {
                summary = await generateQuietPrompt(prompt, false, false);
            }
            // Fallback to generateRaw
            else if (typeof generateRaw === 'function') {
                summary = await generateRaw(prompt, false, false, '');
            }
            
            if (summary && typeof summary === 'string') {
                return summary.trim();
            }
            
            console.warn('[NemoLore Message Summarizer] No AI generation functions available');
            return null;
            
        } catch (error) {
            console.error('[NemoLore Message Summarizer] AI summary generation failed:', error);
            return null;
        }
    }

    /**
     * Validate and enhance summary
     */
    validateAndEnhanceSummary(summary, messageGroup) {
        if (!summary || typeof summary !== 'string') return null;
        
        let enhancedSummary = summary.trim();
        
        // Remove common AI artifacts
        enhancedSummary = enhancedSummary
            .replace(/^(Here's a summary|Summary:|In summary)/i, '')
            .replace(/^[^\w]*/, '') // Remove leading punctuation
            .trim();
        
        // Ensure minimum length
        if (enhancedSummary.length < this.qualityThresholds.minLength) {
            console.warn('[NemoLore Message Summarizer] Summary too short, skipping');
            return null;
        }
        
        // Ensure maximum length
        const maxLength = this.settings.summarization?.maxLength || 200;
        if (enhancedSummary.length > maxLength) {
            enhancedSummary = enhancedSummary.substring(0, maxLength - 3) + '...';
        }
        
        // Add metadata
        const metadata = {
            messageCount: messageGroup.length,
            originalLength: messageGroup.reduce((sum, msg) => sum + (msg.content || msg.mes || '').length, 0),
            summaryLength: enhancedSummary.length,
            compressionRatio: enhancedSummary.length / Math.max(1, messageGroup.reduce((sum, msg) => sum + (msg.content || msg.mes || '').length, 0)),
            created: Date.now()
        };
        
        return {
            text: enhancedSummary,
            metadata: metadata
        };
    }

    /**
     * Generate cache key for message group
     */
    generateCacheKey(messageGroup) {
        const hashes = messageGroup.map(msg => this.generateMessageHash(msg));
        const combinedHash = this.generateContentHash(hashes.join(''));
        return `summary_${combinedHash}`;
    }

    /**
     * Generate hash for individual message
     */
    generateMessageHash(message) {
        const content = message.content || message.mes || '';
        const id = message.id || message.timestamp || '';
        return this.generateContentHash(`${content}_${id}`);
    }

    /**
     * Generate content hash
     */
    generateContentHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    /**
     * Get summary for message group
     */
    getSummaryForMessages(messages) {
        const cacheKey = this.generateCacheKey(messages);
        const cached = this.summaryCache.get(cacheKey);
        
        if (cached) {
            return cached.summary;
        }
        
        // Queue for summarization if not cached
        this.queueSummarization(messages);
        return null;
    }

    /**
     * Get all cached summaries
     */
    getAllSummaries() {
        return Array.from(this.summaryCache.entries()).map(([key, value]) => ({
            key: key,
            summary: value.summary,
            messageCount: value.messages?.length || 0,
            created: value.created,
            type: value.type
        }));
    }

    /**
     * Show summary viewer (UI integration)
     */
    showSummaryViewer() {
        const summaries = this.getAllSummaries();
        
        if (summaries.length === 0) {
            callPopup('No summaries available yet. Summaries are generated automatically as conversations progress.', 'text');
            return;
        }
        
        const summaryList = summaries
            .sort((a, b) => b.created - a.created)
            .map(s => `• ${s.summary.text || s.summary} (${s.messageCount} messages, ${s.type || 'unknown'} type)`)
            .join('\n\n');
        
        const content = `Recent Summaries:\n\n${summaryList}`;
        
        callPopup(content, 'text');
    }

    /**
     * Save summary cache
     */
    async saveSummaryCache() {
        try {
            const chatId = getCurrentChatId();
            if (chatId) {
                const cacheKey = `nemolore_summaries_${chatId}`;
                const cacheObj = {};
                
                for (const [key, value] of this.summaryCache.entries()) {
                    cacheObj[key] = value;
                }
                
                localStorage.setItem(cacheKey, JSON.stringify(cacheObj));
            }
            
        } catch (error) {
            console.warn('[NemoLore Message Summarizer] Failed to save summary cache:', error);
        }
    }

    /**
     * Clear summary cache
     */
    clearCache() {
        this.summaryCache.clear();
        const chatId = getCurrentChatId();
        if (chatId) {
            const cacheKey = `nemolore_summaries_${chatId}`;
            localStorage.removeItem(cacheKey);
        }
    }

    /**
     * Get statistics
     */
    getStatistics() {
        const summaries = Array.from(this.summaryCache.values());
        
        return {
            totalSummaries: summaries.length,
            queuedBatches: this.processingQueue.length,
            isProcessing: this.isProcessing,
            averageCompressionRatio: summaries.length > 0 
                ? summaries.reduce((sum, s) => sum + (s.metadata?.compressionRatio || 0), 0) / summaries.length
                : 0,
            totalMessagesSummarized: summaries.reduce((sum, s) => sum + (s.metadata?.messageCount || 0), 0),
            cacheSize: this.summaryCache.size
        };
    }

    /**
     * Shutdown the message summarizer
     */
    async shutdown() {
        console.log('[NemoLore Message Summarizer] Shutting down...');
        
        // Clear intervals
        if (this.queueInterval) {
            clearInterval(this.queueInterval);
        }
        
        // Save final cache
        await this.saveSummaryCache();
        
        // Clear processing queue
        this.processingQueue = [];
        this.isProcessing = false;
        
        this.isInitialized = false;
        console.log('[NemoLore Message Summarizer] ✅ Shutdown completed');
    }
}

console.log('[NemoLore Message Summarizer] Module loaded - AI-powered summarization system ready');