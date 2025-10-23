/**
 * NemoLore Memory Manager - Production Ready
 *
 * Uses MessageSummarize's proven patterns for:
 * - Data storage (message.extra.nemolore)
 * - Injection (setExtensionPrompt)
 * - Event handling (edit/swipe/delete)
 *
 * Enhanced with NemoLore innovations:
 * - Paired message summarization
 * - Type-specific detection (conversation/narrative/dialogue/etc)
 * - Core memory detection with lorebook integration
 */

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
    extension_prompt_types,
    active_character,
    generateQuietPrompt,
    substituteParamsExtended,
    generateRaw,
    getMaxContextSize,
    getRequestHeaders,
    main_api
} from '../../../../../../../script.js';

import {
    getStringHash,
    trimToEndSentence
} from '../../../../../../../scripts/utils.js';

import { getContext, extension_settings, saveMetadataDebounced } from '../../../../../../../scripts/extensions.js';

// Import shared event bus for cross-system communication
import eventBus from '../../../core/event-bus.js';

// Import shared prompts library (Integration Opportunity 3.2)
import sharedPromptsManager from '../../../core/shared-prompts.js';

// Import shared n-gram analyzer (Integration Opportunity 3.5)
import sharedNgramAnalyzer from '../../../core/shared-ngrams.js';

const MODULE_NAME = 'nemolore';

/**
 * NemoLore Memory Manager
 * Production implementation based on MessageSummarize patterns
 */
export class MemoryManager {
    constructor(settings, state, apiManager) {
        this.settings = settings;
        this.state = state;
        this.apiManager = apiManager;
        this.isInitialized = false;

        // Default settings (MessageSummarize style)
        this.defaultSettings = {
            // Summarization settings
            enableSummarization: true,
            enablePairedSummarization: true,  // NemoLore enhancement
            summaryMaxLength: 200,
            summaryPrompt: this.getDefaultPrompt(),
            summaryPromptId: 'summarization_default',  // Integration Opportunity 3.2: Use shared prompts
            summaryPrefill: "",
            showPrefill: false,

            // Auto-summarization
            autoSummarize: true,
            autoSummarizeOnEdit: false,
            autoSummarizeOnSwipe: true,
            autoSummarizeOnContinue: false,
            summarizeDelay: 0,  // messages to wait before summarizing

            // Injection settings
            shortTermContextLimit: 10,  // percent of context
            shortTermPosition: extension_prompt_types.IN_PROMPT,
            shortTermDepth: 2,
            shortTermRole: extension_prompt_roles.SYSTEM,

            longTermContextLimit: 10,
            longTermPosition: extension_prompt_types.IN_PROMPT,
            longTermDepth: 2,
            longTermRole: extension_prompt_roles.SYSTEM,

            // NemoLore enhancements
            enableCoreMemories: true,
            enableTypeDetection: true,
            linkSummariesToAI: false
        };

        // Merge with provided settings
        this.settings = { ...this.defaultSettings, ...settings };

        // Type-specific templates (NemoLore enhancement)
        this.summaryTemplates = {
            conversation: "Summarize the following conversation section, focusing on key topics, decisions, and important information:",
            narrative: "Provide a concise summary of this narrative section, highlighting main events and character actions:",
            dialogue: "Summarize this dialogue section, capturing the main points and emotional context:",
            description: "Condense this descriptive text while preserving important details:",
            action: "Summarize this action sequence, focusing on outcomes and consequences:"
        };

        console.log('[NemoLore Memory Manager] Initialized with MessageSummarize patterns + NemoLore enhancements');
    }

    /**
     * Get default summarization prompt (MessageSummarize style with NemoLore enhancements)
     */
    getDefaultPrompt() {
        return `You are a summarization assistant. Summarize the given fictional narrative in a single, very short and concise statement of fact.

- Response must be in past tense
- Include character names when possible
- Maximum 200 characters
- Your response must ONLY contain the summary
- If this is a pivotal, extremely important moment, wrap your summary in <CORE_MEMORY> tags

Messages to summarize:
{{messages}}

Summary:`;
    }

    /**
     * Initialize the memory manager
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('[NemoLore Memory Manager] Initializing with proven MessageSummarize patterns...');

        try {
            // Set up event listeners (MessageSummarize pattern)
            this.setupEventListeners();

            // Set up cross-system event listeners (Integration)
            this.setupCrossSystemListeners();

            // Initialize summary injection
            this.refreshMemoryInjection();

            this.isInitialized = true;
            console.log('[NemoLore Memory Manager] ✅ Initialized successfully');

        } catch (error) {
            console.error('[NemoLore Memory Manager] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners (MessageSummarize pattern)
     */
    setupEventListeners() {
        if (!eventSource || !event_types) {
            console.error('[NemoLore Memory Manager] Event system not available!');
            return;
        }

        // Listen for message events
        eventSource.on(event_types.MESSAGE_SENT, (data) => this.handleMessageSent(data));
        eventSource.on(event_types.MESSAGE_RECEIVED, (data) => this.handleMessageReceived(data));
        eventSource.on(event_types.MESSAGE_EDITED, (data) => this.handleMessageEdited(data));
        eventSource.on(event_types.MESSAGE_SWIPED, (data) => this.handleMessageSwiped(data));
        eventSource.on(event_types.MESSAGE_DELETED, (data) => this.handleMessageDeleted(data));
        eventSource.on(event_types.CHAT_CHANGED, () => {
            this.refreshMemoryInjection();
            // Refresh summary indicators when chat changes
            setTimeout(() => this.refreshAllSummaryIndicators(), 500);
        });

        console.log('[NemoLore Memory Manager] ✅ Event listeners registered (MessageSummarize pattern)');
    }

    /**
     * Set up cross-system event listeners (Integration)
     */
    setupCrossSystemListeners() {
        if (!eventBus) {
            console.warn('[NemoLore Memory Manager] Event bus not available, skipping cross-system listeners');
            return;
        }

        // Track summaries that need regeneration
        this.summariesNeedingRegeneration = new Set();

        // Listen for ProsePolisher high-slop detection (Integration Opportunity 2.1)
        eventBus.on('prosepolisher:high_slop_detected', (data) => {
            console.log(`[NemoLore Memory Manager] 🚨 High slop detected at message ${data.messageIndex} (score: ${data.slopScore})`);

            const context = getContext();
            const message = context.chat[data.messageIndex];

            if (message) {
                // Flag for regeneration
                this.summariesNeedingRegeneration.add(data.messageIndex);

                // Store quality review data
                this.setMemoryData(message, 'qualityReview', {
                    reason: 'high_slop',
                    score: data.slopScore,
                    topPhrases: data.topPhrases,
                    timestamp: Date.now()
                });

                // Show notification to user
                if (typeof toastr !== 'undefined') {
                    toastr.warning(
                        `Message ${data.messageIndex} contains repetitive phrases (score: ${data.slopScore.toFixed(1)}). Consider regenerating.`,
                        'NemoLore Quality Alert',
                        { timeOut: 5000 }
                    );
                }
            }
        });

        // Listen for ProsePolisher pattern detection (Integration Opportunity 1.3)
        eventBus.on('prosepolisher:pattern_detected', (data) => {
            // High-frequency patterns might indicate core memory concepts
            if (data.score > 5.0) {
                console.log(`[NemoLore Memory Manager] 📊 High-frequency pattern detected: "${data.pattern}" (score: ${data.score})`);
                // This could be used for enhanced core memory detection
            }
        });

        console.log('[NemoLore Memory Manager] ✅ Cross-system event listeners registered');
    }

    /**
     * Handle new message sent (MessageSummarize pattern + NemoLore pairing)
     */
    async handleMessageSent(data) {
        if (!this.settings.autoSummarize) return;

        const context = getContext();
        const messageIndex = context.chat.length - 1;

        console.log(`[NemoLore Memory Manager] Message sent at index ${messageIndex}`);

        // NemoLore Enhancement: Paired summarization
        if (this.settings.enablePairedSummarization) {
            await this.processPairedSummarization(messageIndex);
        } else {
            // Standard individual summarization (MessageSummarize pattern)
            await this.summarizeMessage(messageIndex);
        }

        // Refresh injection after summarization
        this.refreshMemoryInjection();
    }

    /**
     * Handle message received
     */
    async handleMessageReceived(data) {
        await this.handleMessageSent(data);  // Same logic as sent
    }

    /**
     * Handle message edited (MessageSummarize pattern)
     */
    async handleMessageEdited(data) {
        if (!this.settings.autoSummarizeOnEdit) return;

        const index = data?.index ?? -1;
        if (index >= 0) {
            console.log(`[NemoLore Memory Manager] Message ${index} edited, re-summarizing...`);
            await this.summarizeMessage(index);
            this.refreshMemoryInjection();
        }
    }

    /**
     * Handle message swiped (MessageSummarize pattern)
     */
    async handleMessageSwiped(data) {
        if (!this.settings.autoSummarizeOnSwipe) return;

        const index = data?.index ?? -1;
        if (index >= 0) {
            console.log(`[NemoLore Memory Manager] Message ${index} swiped, re-summarizing...`);
            await this.summarizeMessage(index);
            this.refreshMemoryInjection();
        }
    }

    /**
     * Handle message deleted (MessageSummarize pattern)
     */
    async handleMessageDeleted(data) {
        console.log('[NemoLore Memory Manager] Message deleted, refreshing injection...');
        this.refreshMemoryInjection();
    }

    /**
     * Process paired summarization (NemoLore Enhancement)
     *
     * Strategy:
     * - Message 0: Summarized alone
     * - Messages 1-2, 3-4, 5-6, etc: Paired together
     */
    async processPairedSummarization(currentIndex) {
        const context = getContext();

        // Special case: First message
        if (currentIndex === 0) {
            console.log('[NemoLore Memory] Processing message 0 individually');
            await this.summarizeMessage(0);
            return;
        }

        // Paired messages: Even indices trigger summarization of pair
        if (currentIndex % 2 === 0 && currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            const prevMessage = context.chat[prevIndex];
            const currentMessage = context.chat[currentIndex];

            if (prevMessage && currentMessage) {
                console.log(`[NemoLore Memory] Processing message pair: ${prevIndex} and ${currentIndex}`);

                // Summarize both messages together
                await this.summarizeMessagePair(prevIndex, currentIndex);
            }
        }
        // Odd indices: Wait for next message to pair
        else {
            console.log(`[NemoLore Memory] Message ${currentIndex} is odd, waiting for pair...`);
        }
    }

    /**
     * Summarize a pair of messages (NemoLore Enhancement)
     */
    async summarizeMessagePair(index1, index2) {
        const context = getContext();
        const message1 = context.chat[index1];
        const message2 = context.chat[index2];

        if (!message1 || !message2) return;

        // Combine messages for summarization
        const combinedContent = [
            { role: message1.is_user ? 'user' : 'assistant', content: message1.mes },
            { role: message2.is_user ? 'user' : 'assistant', content: message2.mes }
        ];

        // Detect type (NemoLore enhancement)
        const messageType = this.detectMessageGroupType(combinedContent);

        // Generate summary
        const summary = await this.generateSummary(combinedContent, messageType);

        if (summary) {
            // Determine which message gets the summary
            const targetIndex = this.settings.linkSummariesToAI && !message2.is_user
                ? index2
                : index1;
            const markerIndex = targetIndex === index2 ? index1 : index2;

            // Store summary on target message (MessageSummarize pattern: message.extra)
            this.setMemoryData(context.chat[targetIndex], 'memory', summary.text);
            this.setMemoryData(context.chat[targetIndex], 'messageHash', this.generateMessageHash(message2.mes));
            this.setMemoryData(context.chat[targetIndex], 'isPaired', true);
            this.setMemoryData(context.chat[targetIndex], 'pairedWith', markerIndex);
            this.setMemoryData(context.chat[targetIndex], 'type', messageType);

            // Store marker on other message
            this.setMemoryData(context.chat[markerIndex], 'memory', `[Paired with message ${targetIndex}]`);
            this.setMemoryData(context.chat[markerIndex], 'isMarker', true);
            this.setMemoryData(context.chat[markerIndex], 'pairedWith', targetIndex);

            // Handle core memory if detected (NemoLore enhancement)
            if (summary.isCoreMemory) {
                await this.handleCoreMemory(summary, targetIndex);
            }

            // Save chat
            await this.saveChat();

            console.log(`[NemoLore Memory] ✅ Paired summary stored on message ${targetIndex} (type: ${messageType})`);

            // Enhanced n-gram analysis (Integration Opportunity 3.5)
            const summaryId = `msg_${targetIndex}_${Date.now()}`;
            const ngramAnalysis = sharedNgramAnalyzer.analyzeSummary(summary.text, summaryId, {
                minN: 2,
                maxN: 10,
                frequencyThreshold: 5.0
            });

            // Emit event for cross-system integration
            eventBus.emit('nemolore:summary_created', {
                messageIndices: [index1, index2],
                summary: summary.text,
                type: messageType,
                isCoreMemory: summary.isCoreMemory,
                quality: this.calculateSummaryQuality(summary.text),
                ngramAnalysis: ngramAnalysis // Integration Opportunity 3.5
            });

            // Add visual summary indicator to the message
            this.addSummaryIndicator(targetIndex, summary.isCoreMemory);
        }
    }

    /**
     * Summarize a single message (MessageSummarize pattern)
     */
    async summarizeMessage(index) {
        const context = getContext();
        const message = context.chat[index];

        if (!message) return;

        // Check if already summarized and unchanged
        const currentHash = this.generateMessageHash(message.mes);
        const storedHash = this.getMemoryData(message, 'messageHash');

        if (storedHash === currentHash && this.getMemoryData(message, 'memory')) {
            console.log(`[NemoLore Memory] Message ${index} unchanged, skipping...`);
            return;
        }

        const messageContent = [
            { role: message.is_user ? 'user' : 'assistant', content: message.mes }
        ];

        const messageType = this.detectMessageGroupType(messageContent);
        const summary = await this.generateSummary(messageContent, messageType);

        if (summary) {
            // Store using MessageSummarize pattern (message.extra)
            this.setMemoryData(message, 'memory', summary.text);
            this.setMemoryData(message, 'messageHash', currentHash);
            this.setMemoryData(message, 'type', messageType);
            this.setMemoryData(message, 'isPaired', false);

            // Handle core memory
            if (summary.isCoreMemory) {
                await this.handleCoreMemory(summary, index);
            }

            await this.saveChat();

            console.log(`[NemoLore Memory] ✅ Summary stored on message ${index} (type: ${messageType})`);

            // Enhanced n-gram analysis (Integration Opportunity 3.5)
            const summaryId = `msg_${index}_${Date.now()}`;
            const ngramAnalysis = sharedNgramAnalyzer.analyzeSummary(summary.text, summaryId, {
                minN: 2,
                maxN: 10,
                frequencyThreshold: 5.0
            });

            // Emit event for cross-system integration
            eventBus.emit('nemolore:summary_created', {
                messageIndices: [index],
                summary: summary.text,
                type: messageType,
                isCoreMemory: summary.isCoreMemory,
                quality: this.calculateSummaryQuality(summary.text),
                ngramAnalysis: ngramAnalysis // Integration Opportunity 3.5
            });

            // Add visual summary indicator to the message
            this.addSummaryIndicator(index, summary.isCoreMemory);
        }
    }

    /**
     * Generate summary using AI (MessageSummarize pattern with NemoLore enhancements)
     */
    async generateSummary(messages, messageType = 'conversation') {
        try {
            // Format messages for prompt
            const formattedMessages = messages.map((msg, i) =>
                `[${i + 1}] ${msg.role === 'user' ? 'User' : 'Character'}: ${msg.content}`
            ).join('\n\n');

            // Build prompt - Integration Opportunity 3.2: Try shared prompts first
            let promptTemplate;

            // First try to use shared prompt if ID is specified
            if (this.settings.summaryPromptId && sharedPromptsManager) {
                const sharedPrompt = sharedPromptsManager.getPrompt(this.settings.summaryPromptId);
                if (sharedPrompt) {
                    promptTemplate = sharedPrompt.template;
                    console.log(`[NemoLore Memory] Using shared prompt: ${sharedPrompt.name}`);
                } else {
                    console.warn(`[NemoLore Memory] Shared prompt not found: ${this.settings.summaryPromptId}, using fallback`);
                    promptTemplate = this.settings.summaryPrompt || this.getDefaultPrompt();
                }
            } else {
                // Fallback to custom prompt or default
                promptTemplate = this.settings.summaryPrompt || this.getDefaultPrompt();
            }

            // Add type-specific template if enabled (NemoLore enhancement)
            if (this.settings.enableTypeDetection && this.summaryTemplates[messageType]) {
                const typeTemplate = this.summaryTemplates[messageType];
                promptTemplate = `${typeTemplate}\n\n${promptTemplate}`;
            }

            // Replace {{messages}} macro (could use sharedPromptsManager.fillPrompt but keeping compatibility)
            const prompt = promptTemplate.replace('{{messages}}', formattedMessages);

            // Generate using ST's generateRaw (MessageSummarize pattern)
            let result = await generateRaw({
                prompt: [{ role: 'system', content: prompt }],
                trimNames: false,
                prefill: this.settings.summaryPrefill || ""
            });

            if (!result) {
                console.warn('[NemoLore Memory] Empty response from AI');
                return null;
            }

            // Trim incomplete sentences (MessageSummarize pattern)
            const ctx = getContext();
            if (ctx?.powerUserSettings?.trim_sentences) {
                result = trimToEndSentence(result);
            }

            // Clean up result
            result = result.trim()
                .replace(/^(Here's a summary|Summary:|In summary)/i, '')
                .replace(/^[^\w]*/, '')
                .trim();

            // Detect core memory (NemoLore enhancement)
            // Method 1: AI-tagged with <CORE_MEMORY>
            const taggedAsCore = /<CORE_MEMORY>/.test(result);
            const cleanSummary = result.replace(/<\/?CORE_MEMORY>/g, '').trim();

            // Method 2: Frequency analysis (Integration with ProsePolisher)
            const frequencyDetection = this.detectCoreMemoryFromFrequency(cleanSummary);

            // Combine detection methods
            const isCoreMemory = taggedAsCore || (frequencyDetection.isCore && frequencyDetection.confidence > 0.6);
            const detectionMethod = taggedAsCore ? 'ai_tag' : (frequencyDetection.isCore ? 'frequency_analysis' : 'none');

            if (frequencyDetection.isCore && !taggedAsCore) {
                console.log(`🌟 [NemoLore Memory] Frequency analysis elevated this to core memory (confidence: ${(frequencyDetection.confidence * 100).toFixed(1)}%)`);
            }

            return {
                text: cleanSummary,
                isCoreMemory: isCoreMemory,
                type: messageType,
                detectionMethod: detectionMethod,
                frequencyData: frequencyDetection.isCore ? frequencyDetection : null
            };

        } catch (error) {
            console.error('[NemoLore Memory] Summary generation failed:', error);
            return null;
        }
    }

    /**
     * Detect message type (NemoLore Enhancement)
     */
    detectMessageGroupType(messages) {
        if (!this.settings.enableTypeDetection) return 'conversation';

        const combinedContent = messages
            .map(msg => msg.content.toLowerCase())
            .join(' ');

        if (/\b(moves|walks|runs|attacks|casts|performs|does|action)\b/.test(combinedContent)) return 'action';
        if (/["']|says?|tells?|asks?|replies?|responds?/.test(combinedContent)) return 'dialogue';
        if (/\b(looks?|appears?|seems?|describes?|detailed?|beautiful)\b/.test(combinedContent)) return 'description';
        if (/\b(then|next|after|before|during|while|when)\b/.test(combinedContent)) return 'narrative';

        return 'conversation';
    }

    /**
     * Handle core memory detection (NemoLore Enhancement)
     */
    async handleCoreMemory(summary, messageIndex) {
        if (!this.settings.enableCoreMemories) return;

        console.log(`🌟 [NemoLore Memory] CORE MEMORY DETECTED at message ${messageIndex}:`, summary.text);

        // Emit event for cross-system integration
        eventBus.emit('nemolore:core_memory_detected', {
            messageIndex: messageIndex,
            summary: summary.text,
            type: summary.type,
            timestamp: Date.now()
        });

        // Integrate with auto-lorebook manager
        const autoLorebookManager = window.nemoLoreWorkflowState?.autoLorebookManager;
        if (autoLorebookManager && typeof autoLorebookManager.addCoreMemoryToLorebook === 'function') {
            await autoLorebookManager.addCoreMemoryToLorebook({
                text: summary.text,
                type: summary.type,
                messageIndex: messageIndex,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Calculate summary quality using ProsePolisher's blacklist (Integration Opportunity 1.2)
     * @param {string} summaryText - The summary to analyze
     * @returns {Object} Quality assessment with score and recommendations
     */
    calculateSummaryQuality(summaryText) {
        if (!summaryText) {
            return { quality: 'unknown', slopScore: 0, needsRegeneration: false };
        }

        let slopScore = 0;
        const detectedPhrases = [];

        // Try to use ProsePolisher's blacklist if available
        const prosePolisherSettings = extension_settings?.ProsePolisher;
        const blacklist = prosePolisherSettings?.blacklist || this.getDefaultBlacklist();

        // Check for slop phrases
        for (const [phrase, weight] of Object.entries(blacklist)) {
            const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            const matches = (summaryText.match(regex) || []).length;

            if (matches > 0) {
                slopScore += matches * weight;
                detectedPhrases.push({ phrase, count: matches, weight });
            }
        }

        // Determine quality level
        let quality = 'excellent';
        let needsRegeneration = false;

        if (slopScore > 15) {
            quality = 'poor';
            needsRegeneration = true;
        } else if (slopScore > 10) {
            quality = 'low';
            needsRegeneration = true;
        } else if (slopScore > 5) {
            quality = 'medium';
        } else if (slopScore > 2) {
            quality = 'good';
        }

        return {
            quality,
            slopScore,
            needsRegeneration,
            detectedPhrases: detectedPhrases.slice(0, 3) // Top 3
        };
    }

    /**
     * Get default blacklist for quality detection
     * @private
     */
    getDefaultBlacklist() {
        return {
            'a small smile': 2,
            'a faint blush': 2,
            "couldn't help but": 3,
            'a sense of': 2,
            'began to': 3,
            'started to': 3,
            'seemed to': 2,
            'appeared to': 2,
            'a wave of': 2,
            'a mix of': 2,
            'a hint of': 2,
            'a flicker of': 2,
            'a surge of': 2,
            'felt a': 2,
            'with a sigh': 2,
            'let out a': 2,
            'as if': 2,
            'as though': 2
        };
    }

    /**
     * Detect core memory using N-gram frequency analysis (Integration Opportunity 1.3)
     * Uses ProsePolisher's frequency data to identify repeated key phrases
     *
     * @param {string} messageText - The message text to analyze
     * @returns {Object} Detection result with detected phrases
     */
    detectCoreMemoryFromFrequency(messageText) {
        if (!messageText || !this.settings.enableFrequencyBasedCoreMemory) {
            return { isCore: false, phrases: [], confidence: 0 };
        }

        // Check if ProsePolisher analyzer is available
        const analyzer = window.prosePolisherState?.prosePolisherAnalyzer;
        if (!analyzer || !analyzer.ngramFrequencies) {
            console.log('[NemoLore Memory] ProsePolisher analyzer not available for frequency detection');
            return { isCore: false, phrases: [], confidence: 0 };
        }

        // Extract n-grams from message text (2-5 word sequences)
        const messageNgrams = this.extractNgrams(messageText, 2, 5);
        const highFrequencyPhrases = [];

        // Check each n-gram against ProsePolisher's frequency data
        for (const ngram of messageNgrams) {
            const freqData = analyzer.ngramFrequencies.get(ngram.toLowerCase());

            if (freqData && freqData.score > 5.0) {
                highFrequencyPhrases.push({
                    phrase: ngram,
                    score: freqData.score,
                    count: freqData.count || 1
                });
            }
        }

        // Sort by score (highest first)
        highFrequencyPhrases.sort((a, b) => b.score - a.score);

        // Determine if this is a core memory based on frequency patterns
        // Criteria: Multiple high-frequency phrases (2+) with good scores
        const isCore = highFrequencyPhrases.length >= 2;

        // Calculate confidence (0-1) based on phrase count and scores
        let confidence = 0;
        if (highFrequencyPhrases.length > 0) {
            const avgScore = highFrequencyPhrases.reduce((sum, p) => sum + p.score, 0) / highFrequencyPhrases.length;
            const phraseCountFactor = Math.min(highFrequencyPhrases.length / 5, 1); // Cap at 5 phrases
            const scoreFactor = Math.min(avgScore / 10, 1); // Cap at score 10
            confidence = (phraseCountFactor * 0.4 + scoreFactor * 0.6);
        }

        if (isCore) {
            console.log(`🌟 [NemoLore Memory] Core memory detected via frequency analysis!`);
            console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
            console.log(`   Key phrases (${highFrequencyPhrases.length}):`,
                highFrequencyPhrases.slice(0, 3).map(p => `"${p.phrase}" (${p.score.toFixed(1)})`).join(', '));
        }

        return {
            isCore,
            phrases: highFrequencyPhrases.slice(0, 5), // Top 5
            confidence,
            method: 'frequency_analysis'
        };
    }

    /**
     * Extract n-grams from text
     * @private
     * @param {string} text - Text to extract n-grams from
     * @param {number} minN - Minimum n-gram size
     * @param {number} maxN - Maximum n-gram size
     * @returns {Array<string>} Array of n-grams
     */
    extractNgrams(text, minN = 2, maxN = 5) {
        if (!text) return [];

        // Clean and tokenize text
        const cleaned = text
            .toLowerCase()
            .replace(/[^\w\s'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const words = cleaned.split(' ').filter(w => w.length > 0);
        const ngrams = new Set();

        // Generate n-grams of different sizes
        for (let n = minN; n <= maxN; n++) {
            for (let i = 0; i <= words.length - n; i++) {
                const ngram = words.slice(i, i + n).join(' ');
                if (ngram.length > 0) {
                    ngrams.add(ngram);
                }
            }
        }

        return Array.from(ngrams);
    }

    /**
     * Get/Set memory data on message (MessageSummarize pattern: message.extra.nemolore)
     */
    getMemoryData(message, key) {
        return message?.extra?.[MODULE_NAME]?.[key];
    }

    setMemoryData(message, key, value) {
        if (!message.extra) message.extra = {};
        if (!message.extra[MODULE_NAME]) message.extra[MODULE_NAME] = {};
        message.extra[MODULE_NAME][key] = value;
    }

    /**
     * Generate message hash for change detection (MessageSummarize pattern)
     */
    generateMessageHash(content) {
        return getStringHash(content || '');
    }

    /**
     * Refresh memory injection (MessageSummarize pattern with setExtensionPrompt)
     */
    refreshMemoryInjection() {
        const context = getContext();
        if (!context || !context.chat) return;

        if (!this.settings.enableSummarization) {
            // Clear injections if disabled
            context.setExtensionPrompt(`${MODULE_NAME}_short`, "", extension_prompt_types.IN_PROMPT, 0);
            context.setExtensionPrompt(`${MODULE_NAME}_long`, "", extension_prompt_types.IN_PROMPT, 0);
            return;
        }

        // Collect summaries (MessageSummarize pattern)
        const shortTermSummaries = [];
        const longTermSummaries = [];

        for (let i = 0; i < context.chat.length; i++) {
            const message = context.chat[i];
            const memory = this.getMemoryData(message, 'memory');
            const isMarker = this.getMemoryData(message, 'isMarker');

            if (!memory || isMarker) continue;

            const isRemembered = this.getMemoryData(message, 'remember');

            if (isRemembered) {
                longTermSummaries.push(`• ${memory}`);
            } else {
                shortTermSummaries.push(`• ${memory}`);
            }
        }

        // Format injections
        const shortInjection = shortTermSummaries.length > 0
            ? `[Recent Events]:\n${shortTermSummaries.slice(-5).join('\n')}\n`
            : "";

        const longInjection = longTermSummaries.length > 0
            ? `[Important Memories]:\n${longTermSummaries.join('\n')}\n`
            : "";

        // Inject using setExtensionPrompt (MessageSummarize pattern)
        context.setExtensionPrompt(
            `${MODULE_NAME}_short`,
            shortInjection,
            this.settings.shortTermPosition,
            this.settings.shortTermDepth,
            false,  // scan
            this.settings.shortTermRole
        );

        context.setExtensionPrompt(
            `${MODULE_NAME}_long`,
            longInjection,
            this.settings.longTermPosition,
            this.settings.longTermDepth,
            false,
            this.settings.longTermRole
        );

        console.log(`[NemoLore Memory] ✅ Injection refreshed (${shortTermSummaries.length} short, ${longTermSummaries.length} long)`);
    }

    /**
     * Get summaries for macro injection (backward compatibility)
     */
    getSummariesForInjection() {
        const context = getContext();
        if (!context || !context.chat) return '';

        const summaries = [];

        for (let i = 0; i < context.chat.length; i++) {
            const message = context.chat[i];
            const memory = this.getMemoryData(message, 'memory');
            const isMarker = this.getMemoryData(message, 'isMarker');

            if (memory && !isMarker) {
                summaries.push(`• ${memory}`);
            }
        }

        if (summaries.length === 0) return '';

        return `**Conversation Summary:**\n${summaries.slice(-5).join('\n')}\n\n`;
    }

    /**
     * Get all summaries for context (dashboard UI support)
     * Returns array of summary objects for display
     */
    getAllSummariesForContext() {
        const context = getContext();
        if (!context || !context.chat) return [];

        const summaries = [];

        for (let i = 0; i < context.chat.length; i++) {
            const message = context.chat[i];
            const memory = this.getMemoryData(message, 'memory');
            const isMarker = this.getMemoryData(message, 'isMarker');
            const isPaired = this.getMemoryData(message, 'isPaired');
            const type = this.getMemoryData(message, 'type');
            const isCoreMemory = this.getMemoryData(message, 'remember');

            if (memory && !isMarker) {
                summaries.push({
                    text: memory,
                    messageIndex: i,
                    created: message.send_date || Date.now(),
                    type: type || 'conversation',
                    isCoreMemory: isCoreMemory || false,
                    messageCount: isPaired ? 2 : 1,
                    metadata: {
                        originalLength: message.mes?.length || 0
                    }
                });
            }
        }

        return summaries;
    }

    /**
     * Get summary count (dashboard stats support)
     */
    getSummaryCount() {
        const context = getContext();
        if (!context || !context.chat) return 0;

        let count = 0;
        for (let i = 0; i < context.chat.length; i++) {
            const message = context.chat[i];
            const memory = this.getMemoryData(message, 'memory');
            const isMarker = this.getMemoryData(message, 'isMarker');

            if (memory && !isMarker) {
                count++;
            }
        }

        return count;
    }

    /**
     * Save chat (MessageSummarize pattern)
     */
    async saveChat() {
        const context = getContext();
        if (context && typeof context.saveChat === 'function') {
            await context.saveChat();
        }
    }

    /**
     * Add visual summary indicator to message
     */
    addSummaryIndicator(messageIndex, isCoreMemory = false) {
        // Wait a bit for DOM to be ready
        setTimeout(() => {
            try {
                const context = getContext();
                if (!context || !context.chat) return;

                const message = context.chat[messageIndex];
                const memory = this.getMemoryData(message, 'memory');

                if (!memory) return;

                // Find the message element
                const messageElement = $(`#chat .mes[mesid="${messageIndex}"]`).get(0);
                if (!messageElement) {
                    console.warn(`[NemoLore Memory] Message element not found for index ${messageIndex}`);
                    return;
                }

                // Don't add if already exists
                if (messageElement.querySelector('.nemolore-summary-indicator')) {
                    return;
                }

                // Create summary indicator badge
                const indicator = document.createElement('div');
                indicator.className = isCoreMemory
                    ? 'nemolore-summary-indicator nemolore-core-memory'
                    : 'nemolore-summary-indicator';

                if (isCoreMemory) {
                    indicator.innerHTML = `
                        <span class="nemolore-summary-badge nemolore-core-badge"
                              title="Core Memory - Click to view summary">
                            ✨ Core Memory
                        </span>
                    `;
                } else {
                    indicator.innerHTML = `
                        <span class="nemolore-summary-badge"
                              title="Message summarized - Click to view">
                            📝 Summarized
                        </span>
                    `;
                }

                // Add click handler to view summary
                indicator.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showSummaryPopup(messageIndex);
                });

                // Insert the indicator in the message header area (top left)
                const messageBlock = messageElement.querySelector('.mes_block');
                if (messageBlock) {
                    // Ensure the message block has position: relative for absolute positioning
                    if (window.getComputedStyle(messageBlock).position === 'static') {
                        messageBlock.style.position = 'relative';
                    }
                    messageBlock.appendChild(indicator);
                } else {
                    // Fallback: add to message element directly
                    if (window.getComputedStyle(messageElement).position === 'static') {
                        messageElement.style.position = 'relative';
                    }
                    messageElement.appendChild(indicator);
                }

                console.log(`[NemoLore Memory] Added summary indicator to message ${messageIndex}`);
            } catch (error) {
                console.error(`[NemoLore Memory] Error adding summary indicator:`, error);
            }
        }, 100);
    }

    /**
     * Show summary in a popup
     */
    showSummaryPopup(messageIndex) {
        const context = getContext();
        if (!context || !context.chat) return;

        const message = context.chat[messageIndex];
        const memory = this.getMemoryData(message, 'memory');
        const type = this.getMemoryData(message, 'type') || 'conversation';
        const isPaired = this.getMemoryData(message, 'isPaired');
        const pairedWith = this.getMemoryData(message, 'pairedWith');
        const isCoreMemory = this.getMemoryData(message, 'remember');

        if (!memory) return;

        const coreMemoryBadge = isCoreMemory ? '<span style="background: gold; color: black; padding: 2px 8px; border-radius: 4px; font-size: 11px;">✨ Core Memory</span>' : '';
        const pairedBadge = isPaired ? '<span style="background: var(--SmartThemeQuoteColor); padding: 2px 8px; border-radius: 4px; font-size: 11px;">🔗 Paired</span>' : '';
        const pairedInfo = isPaired && pairedWith !== undefined ? `<br><small>Paired with message #${pairedWith + 1}</small>` : '';

        const popupHtml = `
            <div style="padding: 20px; max-width: 600px;">
                <h3 style="color: var(--customThemeColor); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                    📝 Message Summary
                    ${coreMemoryBadge}
                    ${pairedBadge}
                </h3>
                <div style="margin-bottom: 15px; color: var(--SmartThemeQuoteColor); font-size: 13px;">
                    <strong>Message #${messageIndex + 1}</strong> • Type: ${type}${pairedInfo}
                </div>
                <div style="background: var(--SmartThemeBlurTintColor); padding: 15px; border-radius: 6px; margin-bottom: 15px;">
                    <strong>Summary:</strong><br>
                    <div style="margin-top: 8px; line-height: 1.5;">${memory}</div>
                </div>
                <div style="background: var(--SmartThemeBlurTintColor); padding: 10px; border-radius: 6px; font-size: 12px;">
                    <strong>Original Message (preview):</strong><br>
                    <div style="margin-top: 5px; max-height: 150px; overflow-y: auto; opacity: 0.8;">
                        ${message.mes.substring(0, 500)}${message.mes.length > 500 ? '...' : ''}
                    </div>
                </div>
            </div>
        `;

        if (typeof callPopup !== 'undefined') {
            callPopup(popupHtml, 'text');
        } else {
            console.log('[NemoLore Memory] Summary:', memory);
        }
    }

    /**
     * Refresh all summary indicators in the current chat
     */
    refreshAllSummaryIndicators() {
        const context = getContext();
        if (!context || !context.chat) return;

        console.log('[NemoLore Memory] Refreshing all summary indicators...');

        for (let i = 0; i < context.chat.length; i++) {
            const message = context.chat[i];
            const memory = this.getMemoryData(message, 'memory');
            const isMarker = this.getMemoryData(message, 'isMarker');
            const isCoreMemory = this.getMemoryData(message, 'remember');

            if (memory && !isMarker) {
                this.addSummaryIndicator(i, isCoreMemory);
            }
        }
    }

    /**
     * Shutdown
     */
    async shutdown() {
        console.log('[NemoLore Memory Manager] Shutting down...');
        this.isInitialized = false;
    }
}

console.log('[NemoLore Memory Manager] Module loaded - MessageSummarize patterns + NemoLore enhancements');
