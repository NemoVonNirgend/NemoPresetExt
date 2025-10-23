/**
 * Lorebook Manager
 * RECOVERY VERSION - Automated lorebook creation and management
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
    console.warn('[NemoLore Lorebook Manager] SillyTavern modules not available:', error);
    // Provide fallback values
    extension_settings = {};
    getContext = () => ({ extension_settings: {} });
    writeExtensionField = () => {};
    renderExtensionTemplateAsync = () => Promise.resolve('');
}

import { eventSystem, NEMOLORE_EVENTS } from '../../core/event-system.js';

/**
 * Automated Lorebook Manager
 * Handles creation, management, and optimization of lorebook entries
 */
export class LorebookManager {
    constructor(settings, vectorManager) {
        this.settings = settings;
        this.vectorManager = vectorManager;
        this.isInitialized = false;
        
        // Lorebook state
        this.entries = new Map();
        this.scanHistory = new Set();
        this.entityDatabase = new Map();
        
        // Entity recognition patterns
        this.entityPatterns = {
            person: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
            place: /\b(?:in|at|from|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
            organization: /\b(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Company|Corporation|Inc|LLC|Organization|Guild|Order|Council)\b/g,
            item: /\b(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Sword|Shield|Ring|Amulet|Staff|Blade|Armor)\b/g
        };
        
        // NLP patterns for context extraction
        this.contextPatterns = {
            description: /(?:is|was|are|were)\s+(.+?)(?:\.|!|\?|$)/g,
            relationship: /(?:friend|enemy|ally|rival|partner|spouse|child|parent)\s+(?:of|to)\s+([^.!?]+)/g,
            location: /(?:lives|works|stays|resides)\s+(?:in|at|on)\s+([^.!?]+)/g,
            attribute: /(?:has|had|possesses|owns)\s+(.+?)(?:\.|!|\?|$)/g
        };
        
        console.log('[NemoLore Lorebook Manager] Constructor completed');
    }

    /**
     * Initialize the lorebook manager
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('[NemoLore Lorebook Manager] Initializing...');
        
        try {
            // Load existing lorebook entries
            await this.loadLorebookEntries();
            
            // Set up entity recognition
            this.setupEntityRecognition();
            
            // Set up automatic scanning
            this.setupAutoScanning();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('[NemoLore Lorebook Manager] ✅ Initialized successfully');
            
        } catch (error) {
            console.error('[NemoLore Lorebook Manager] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load existing lorebook entries
     */
    async loadLorebookEntries() {
        try {
            // Load from chat metadata
            if (chat_metadata && chat_metadata.nemolore_lorebook) {
                const savedEntries = chat_metadata.nemolore_lorebook;
                for (const [key, entry] of Object.entries(savedEntries)) {
                    this.entries.set(key, entry);
                }
            }
            
            // Load from character lorebook if available
            await this.loadCharacterLorebook();
            
            console.log(`[NemoLore Lorebook Manager] Loaded ${this.entries.size} existing entries`);
            
        } catch (error) {
            console.error('[NemoLore Lorebook Manager] Failed to load lorebook entries:', error);
        }
    }

    /**
     * Load character-specific lorebook
     */
    async loadCharacterLorebook() {
        if (!active_character || !characters[active_character]) return;
        
        const character = characters[active_character];
        if (character.data?.extensions?.world) {
            const worldInfo = character.data.extensions.world;
            for (const entry of worldInfo) {
                if (entry.key && entry.content) {
                    const lorebookEntry = {
                        id: `char_${entry.uid || Date.now()}`,
                        name: entry.key[0] || 'Unknown',
                        keys: entry.key || [],
                        content: entry.content,
                        source: 'character',
                        enabled: !entry.disable,
                        priority: entry.order || 0,
                        created: Date.now(),
                        modified: Date.now()
                    };
                    
                    this.entries.set(lorebookEntry.id, lorebookEntry);
                }
            }
        }
    }

    /**
     * Set up entity recognition system
     */
    setupEntityRecognition() {
        // Initialize entity database
        this.entityDatabase = new Map();
        
        // Set up recognition confidence thresholds
        this.confidenceThresholds = {
            person: 0.7,
            place: 0.6,
            organization: 0.8,
            item: 0.5
        };
        
        console.log('[NemoLore Lorebook Manager] Entity recognition system setup completed');
    }

    /**
     * Set up automatic scanning
     */
    setupAutoScanning() {
        this.autoScanEnabled = this.settings.lorebook?.autoCreate !== false;
        this.scanInterval = null;
        
        if (this.autoScanEnabled) {
            // Scan every 30 seconds when auto-create is enabled
            this.scanInterval = setInterval(() => {
                this.scanRecentMessages();
            }, 30000);
        }
        
        console.log('[NemoLore Lorebook Manager] Auto-scanning setup completed');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        eventSystem.on('message:sent', (data) => {
            if (this.autoScanEnabled) {
                this.scheduleMessageScan(data);
            }
        });
        
        eventSystem.on('message:received', (data) => {
            if (this.autoScanEnabled) {
                this.scheduleMessageScan(data);
            }
        });
        
        console.log('[NemoLore Lorebook Manager] Event listeners setup completed');
    }

    /**
     * Schedule message scanning
     */
    scheduleMessageScan(messageData) {
        // Debounce scanning to avoid excessive processing
        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
        }
        
        this.scanTimeout = setTimeout(() => {
            this.scanMessage(messageData);
        }, 5000); // 5 second delay
    }

    /**
     * Scan recent messages for entities
     */
    async scanRecentMessages() {
        if (!chat || chat.length === 0) return;
        
        const recentMessages = chat.slice(-this.settings.lorebook?.scanDepth || -20);
        
        for (const message of recentMessages) {
            const messageId = message.id || message.timestamp;
            if (!this.scanHistory.has(messageId)) {
                await this.scanMessage(message);
                this.scanHistory.add(messageId);
            }
        }
        
        eventSystem.emit(NEMOLORE_EVENTS.LOREBOOK_SCAN_COMPLETE, {
            messagesScanned: recentMessages.length,
            entriesFound: this.entries.size
        });
    }

    /**
     * Scan individual message for entities
     */
    async scanMessage(message) {
        if (!message || !message.mes) return;
        
        const content = message.mes;
        const entities = this.extractEntities(content);
        
        for (const entity of entities) {
            await this.processEntity(entity, content, message);
        }
    }

    /**
     * Extract entities from text using pattern matching
     */
    extractEntities(text) {
        const entities = [];
        
        for (const [type, pattern] of Object.entries(this.entityPatterns)) {
            let match;
            pattern.lastIndex = 0; // Reset regex state
            
            while ((match = pattern.exec(text)) !== null) {
                const entityName = match[1] || match[0];
                const cleanName = entityName.trim();
                
                if (cleanName.length > 2 && !this.isCommonWord(cleanName)) {
                    entities.push({
                        name: cleanName,
                        type: type,
                        confidence: this.calculateConfidence(cleanName, type, text),
                        context: this.extractContext(cleanName, text),
                        position: match.index
                    });
                }
            }
        }
        
        return entities.filter(entity => entity.confidence >= this.confidenceThresholds[entity.type]);
    }

    /**
     * Calculate entity confidence score
     */
    calculateConfidence(entityName, type, text) {
        let confidence = 0.5; // Base confidence
        
        // Capitalization boost
        if (/^[A-Z][a-z]+/.test(entityName)) {
            confidence += 0.2;
        }
        
        // Multiple mentions boost
        const mentions = (text.match(new RegExp(entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
        if (mentions > 1) {
            confidence += Math.min(0.3, mentions * 0.1);
        }
        
        // Context clues boost
        const contextScore = this.analyzeContextClues(entityName, type, text);
        confidence += contextScore;
        
        return Math.min(1.0, confidence);
    }

    /**
     * Analyze context clues around entity
     */
    analyzeContextClues(entityName, type, text) {
        let score = 0;
        const entityRegex = new RegExp(entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        
        // Get surrounding context (50 chars before and after)
        let match;
        while ((match = entityRegex.exec(text)) !== null) {
            const start = Math.max(0, match.index - 50);
            const end = Math.min(text.length, match.index + entityName.length + 50);
            const context = text.substring(start, end).toLowerCase();
            
            // Type-specific context clues
            switch (type) {
                case 'person':
                    if (/\b(he|she|they|him|her|them|said|told|asked)\b/.test(context)) score += 0.2;
                    if (/\b(mr|mrs|ms|dr|sir|lady|lord)\b/.test(context)) score += 0.3;
                    break;
                case 'place':
                    if (/\b(in|at|from|to|near|by|within)\b/.test(context)) score += 0.2;
                    if (/\b(city|town|village|kingdom|country|realm)\b/.test(context)) score += 0.3;
                    break;
                case 'organization':
                    if (/\b(member|leader|joined|founded|part of)\b/.test(context)) score += 0.2;
                    break;
                case 'item':
                    if (/\b(wielded|carried|equipped|owned|found)\b/.test(context)) score += 0.2;
                    break;
            }
        }
        
        return Math.min(0.4, score);
    }

    /**
     * Extract context information for entity
     */
    extractContext(entityName, text) {
        const contexts = [];
        
        for (const [contextType, pattern] of Object.entries(this.contextPatterns)) {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(text)) !== null) {
                const context = match[0];
                if (context.toLowerCase().includes(entityName.toLowerCase())) {
                    contexts.push({
                        type: contextType,
                        text: match[1]?.trim() || context.trim(),
                        confidence: 0.8
                    });
                }
            }
        }
        
        return contexts;
    }

    /**
     * Check if word is too common to be a significant entity
     */
    isCommonWord(word) {
        const commonWords = [
            'The', 'This', 'That', 'They', 'Them', 'Their', 'There', 'Then', 'Than',
            'When', 'Where', 'What', 'Who', 'Why', 'How', 'Yes', 'No', 'Not',
            'And', 'But', 'Or', 'So', 'If', 'As', 'At', 'By', 'For', 'In',
            'Of', 'On', 'To', 'Up', 'It', 'Is', 'Be', 'Do', 'Go', 'See'
        ];
        
        return commonWords.includes(word) || word.length < 3;
    }

    /**
     * Process discovered entity
     */
    async processEntity(entity, sourceText, sourceMessage) {
        const existingEntry = this.findExistingEntry(entity.name);
        
        if (existingEntry) {
            // Update existing entry
            await this.updateLorebookEntry(existingEntry.id, entity, sourceText);
        } else {
            // Create new entry if confidence is high enough
            if (entity.confidence >= 0.8 && this.entries.size < (this.settings.lorebook?.maxEntries || 500)) {
                await this.createLorebookEntry(entity, sourceText, sourceMessage);
            }
        }
    }

    /**
     * Find existing lorebook entry for entity
     */
    findExistingEntry(entityName) {
        for (const [id, entry] of this.entries) {
            if (entry.keys.some(key => key.toLowerCase() === entityName.toLowerCase())) {
                return entry;
            }
        }
        return null;
    }

    /**
     * Create new lorebook entry
     */
    async createLorebookEntry(entity, sourceText, sourceMessage) {
        const entryId = `nemolore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Generate entry content
        const content = await this.generateEntryContent(entity, sourceText);
        
        const entry = {
            id: entryId,
            name: entity.name,
            keys: [entity.name, ...this.generateAlternativeKeys(entity.name)],
            content: content,
            type: entity.type,
            confidence: entity.confidence,
            source: 'auto-generated',
            enabled: true,
            priority: this.calculatePriority(entity),
            created: Date.now(),
            modified: Date.now(),
            sourceMessage: sourceMessage?.id || null,
            mentions: 1,
            contexts: entity.context || []
        };
        
        this.entries.set(entryId, entry);
        await this.saveLorebookEntries();
        
        eventSystem.emit(NEMOLORE_EVENTS.LOREBOOK_ENTRY_CREATED, {
            entry: entry,
            entity: entity
        });
        
        console.log(`[NemoLore Lorebook Manager] ✅ Created entry for: ${entity.name}`);
    }

    /**
     * Generate content for lorebook entry
     */
    async generateEntryContent(entity, sourceText) {
        let content = `${entity.name} is a ${entity.type}`;
        
        // Add context information
        if (entity.context && entity.context.length > 0) {
            const contextTexts = entity.context.map(ctx => ctx.text).filter(text => text.length > 0);
            if (contextTexts.length > 0) {
                content += `. ${contextTexts.join('. ')}`;
            }
        }
        
        // Add source information
        content += ` (Auto-generated from chat content)`;
        
        // Limit content length
        const maxLength = this.settings.lorebook?.entryLength || 300;
        if (content.length > maxLength) {
            content = content.substring(0, maxLength - 3) + '...';
        }
        
        return content;
    }

    /**
     * Generate alternative keys for entity
     */
    generateAlternativeKeys(name) {
        const alternatives = [];
        
        // Add variations
        if (name.includes(' ')) {
            // Add first name only
            alternatives.push(name.split(' ')[0]);
            // Add last name only
            alternatives.push(name.split(' ').slice(-1)[0]);
        }
        
        // Add lowercase version
        if (name !== name.toLowerCase()) {
            alternatives.push(name.toLowerCase());
        }
        
        // Add shortened versions
        if (name.length > 6) {
            alternatives.push(name.substring(0, Math.floor(name.length * 0.7)));
        }
        
        return alternatives.slice(0, 5); // Limit to 5 alternatives
    }

    /**
     * Calculate entry priority
     */
    calculatePriority(entity) {
        let priority = 0;
        
        // Type-based priority
        const typePriorities = { person: 100, place: 80, organization: 60, item: 40 };
        priority += typePriorities[entity.type] || 0;
        
        // Confidence-based priority
        priority += Math.floor(entity.confidence * 50);
        
        // Context richness
        if (entity.context) {
            priority += entity.context.length * 5;
        }
        
        return priority;
    }

    /**
     * Update existing lorebook entry
     */
    async updateLorebookEntry(entryId, entity, sourceText) {
        const entry = this.entries.get(entryId);
        if (!entry) return;
        
        // Increment mentions
        entry.mentions = (entry.mentions || 0) + 1;
        
        // Update confidence (weighted average)
        const totalMentions = entry.mentions;
        entry.confidence = ((entry.confidence * (totalMentions - 1)) + entity.confidence) / totalMentions;
        
        // Add new context information
        if (entity.context) {
            entry.contexts = entry.contexts || [];
            for (const context of entity.context) {
                if (!entry.contexts.find(c => c.text === context.text)) {
                    entry.contexts.push(context);
                }
            }
            
            // Limit contexts to prevent bloat
            if (entry.contexts.length > 10) {
                entry.contexts = entry.contexts.slice(-10);
            }
        }
        
        // Update content if confidence is high
        if (entity.confidence > 0.9) {
            entry.content = await this.generateEntryContent(entity, sourceText);
        }
        
        entry.modified = Date.now();
        
        await this.saveLorebookEntries();
        
        eventSystem.emit(NEMOLORE_EVENTS.LOREBOOK_ENTRY_UPDATED, {
            entry: entry,
            entity: entity
        });
    }

    /**
     * Save lorebook entries to storage
     */
    async saveLorebookEntries() {
        try {
            if (chat_metadata) {
                const entriesObj = {};
                for (const [id, entry] of this.entries) {
                    entriesObj[id] = entry;
                }
                
                chat_metadata.nemolore_lorebook = entriesObj;
                await saveMetadata();
            }
            
        } catch (error) {
            console.error('[NemoLore Lorebook Manager] Failed to save entries:', error);
        }
    }

    /**
     * Get all lorebook entries
     */
    getAllEntries() {
        return Array.from(this.entries.values());
    }

    /**
     * Get entry by ID
     */
    getEntry(entryId) {
        return this.entries.get(entryId);
    }

    /**
     * Search entries by name or keys
     */
    searchEntries(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        
        for (const entry of this.entries.values()) {
            if (entry.name.toLowerCase().includes(lowerQuery) ||
                entry.keys.some(key => key.toLowerCase().includes(lowerQuery)) ||
                entry.content.toLowerCase().includes(lowerQuery)) {
                results.push(entry);
            }
        }
        
        return results.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Delete lorebook entry
     */
    async deleteEntry(entryId) {
        if (this.entries.has(entryId)) {
            this.entries.delete(entryId);
            await this.saveLorebookEntries();
            return true;
        }
        return false;
    }

    /**
     * Get statistics
     */
    getStatistics() {
        const entries = Array.from(this.entries.values());
        
        const stats = {
            totalEntries: entries.length,
            enabledEntries: entries.filter(e => e.enabled).length,
            autoGenerated: entries.filter(e => e.source === 'auto-generated').length,
            fromCharacter: entries.filter(e => e.source === 'character').length,
            averageConfidence: entries.length > 0 
                ? entries.reduce((sum, e) => sum + (e.confidence || 0), 0) / entries.length 
                : 0,
            typeDistribution: {}
        };
        
        // Calculate type distribution
        for (const entry of entries) {
            const type = entry.type || 'unknown';
            stats.typeDistribution[type] = (stats.typeDistribution[type] || 0) + 1;
        }
        
        return stats;
    }

    /**
     * Shutdown the lorebook manager
     */
    async shutdown() {
        console.log('[NemoLore Lorebook Manager] Shutting down...');
        
        // Clear intervals
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
        }
        
        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
        }
        
        // Save final state
        await this.saveLorebookEntries();
        
        this.isInitialized = false;
        console.log('[NemoLore Lorebook Manager] ✅ Shutdown completed');
    }
}

console.log('[NemoLore Lorebook Manager] Module loaded - Automated lorebook creation ready');