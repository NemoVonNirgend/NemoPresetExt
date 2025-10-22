/**
 * Cross-Chat Manager
 * RECOVERY VERSION - Task references across different chats (431 lines originally)
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
} from '../../../../../../../script.js';

// SillyTavern imports - graceful fallback for missing modules
let selected_group, extension_settings, renderExtensionTemplateAsync, writeExtensionField, getContext;

try {
    const groupChatsModule = await import('../../../../../../../scripts/group-chats.js').catch(() => null);
    const extensionsModule = await import('../../../../../../../scripts/extensions.js').catch(() => null);
    
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
    console.warn('[NemoLore Cross-Chat Manager] SillyTavern modules not available:', error);
    // Provide fallback values
    extension_settings = {};
    getContext = () => ({ extension_settings: {} });
    writeExtensionField = () => {};
    renderExtensionTemplateAsync = () => Promise.resolve('');
}

import { eventSystem, NEMOLORE_EVENTS } from '../core/event-system.js';

/**
 * Cross-Chat Reference Manager
 * Handles task references and connections across different chat sessions
 */
export class CrossChatManager {
    constructor(settings, state) {
        this.settings = settings;
        this.state = state;
        this.isInitialized = false;
        
        // Cross-chat reference database
        this.references = new Map();
        this.chatConnections = new Map();
        this.taskNetwork = new Map();
        
        // Reference types
        this.referenceTypes = {
            CONTINUATION: 'continuation',
            CALLBACK: 'callback',
            RELATED: 'related',
            FOLLOW_UP: 'follow_up',
            BRANCHED: 'branched'
        };
        
        // Circular reference detection
        this.visitedNodes = new Set();
        this.recursionDepth = 0;
        this.maxRecursionDepth = 10;
        
        console.log('[NemoLore Cross-Chat Manager] Constructor completed');
    }

    /**
     * Initialize the cross-chat manager
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('[NemoLore Cross-Chat Manager] Initializing...');
        
        try {
            // Load existing references
            await this.loadCrossChatReferences();
            
            // Set up reference tracking
            this.setupReferenceTracking();
            
            // Set up network analysis
            this.setupNetworkAnalysis();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('[NemoLore Cross-Chat Manager] ✅ Initialized successfully');
            
        } catch (error) {
            console.error('[NemoLore Cross-Chat Manager] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load existing cross-chat references
     */
    async loadCrossChatReferences() {
        try {
            // Load from global storage (localStorage for cross-chat persistence)
            const storedReferences = localStorage.getItem('nemolore_cross_chat_references');
            if (storedReferences) {
                const parsed = JSON.parse(storedReferences);
                for (const [key, value] of Object.entries(parsed)) {
                    this.references.set(key, value);
                }
            }
            
            // Load chat connections
            const storedConnections = localStorage.getItem('nemolore_chat_connections');
            if (storedConnections) {
                const parsed = JSON.parse(storedConnections);
                for (const [key, value] of Object.entries(parsed)) {
                    this.chatConnections.set(key, value);
                }
            }
            
            console.log(`[NemoLore Cross-Chat Manager] Loaded ${this.references.size} references and ${this.chatConnections.size} connections`);
            
        } catch (error) {
            console.error('[NemoLore Cross-Chat Manager] Failed to load cross-chat references:', error);
        }
    }

    /**
     * Set up reference tracking
     */
    setupReferenceTracking() {
        // Track message patterns that suggest cross-chat references
        this.referencePatterns = {
            continuation: /\b(continue|continuing|resumed|picking up|where we left off)\b/i,
            callback: /\b(remember|recall|mentioned|discussed|talked about|said earlier)\b/i,
            related: /\b(similar to|like before|as we did|related to)\b/i,
            follow_up: /\b(following up|follow-up|next step|next phase)\b/i,
            branched: /\b(alternative|different approach|what if|instead)\b/i
        };
        
        console.log('[NemoLore Cross-Chat Manager] Reference tracking setup completed');
    }

    /**
     * Set up network analysis
     */
    setupNetworkAnalysis() {
        // Initialize network analysis algorithms
        this.networkAnalyzer = new NetworkAnalyzer();
        
        console.log('[NemoLore Cross-Chat Manager] Network analysis setup completed');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        eventSystem.on('chat:changed', (data) => {
            this.onChatChanged(data);
        });
        
        eventSystem.on('message:sent', (data) => {
            this.analyzeMessageForReferences(data);
        });
        
        console.log('[NemoLore Cross-Chat Manager] Event listeners setup completed');
    }

    /**
     * Handle chat change events
     */
    async onChatChanged(data) {
        const newChatId = getCurrentChatId();
        if (!newChatId) return;
        
        // Update current chat context
        this.currentChatId = newChatId;
        
        // Check for existing references to this chat
        await this.checkIncomingReferences(newChatId);
        
        // Update chat metadata
        await this.updateChatMetadata(newChatId);
    }

    /**
     * Analyze message for cross-chat references
     */
    async analyzeMessageForReferences(messageData) {
        if (!messageData || !messageData.content) return;
        
        const content = messageData.content.toLowerCase();
        const chatId = getCurrentChatId();
        
        // Detect reference patterns
        const detectedReferences = this.detectReferences(content);
        
        if (detectedReferences.length > 0) {
            await this.processDetectedReferences(messageData, detectedReferences, chatId);
        }
    }

    /**
     * Detect reference patterns in content
     */
    detectReferences(content) {
        const references = [];
        
        for (const [type, pattern] of Object.entries(this.referencePatterns)) {
            if (pattern.test(content)) {
                references.push({
                    type: this.referenceTypes[type.toUpperCase()],
                    confidence: this.calculateReferenceConfidence(content, pattern),
                    context: this.extractReferenceContext(content, pattern)
                });
            }
        }
        
        return references.filter(ref => ref.confidence > 0.6);
    }

    /**
     * Calculate reference confidence
     */
    calculateReferenceConfidence(content, pattern) {
        let confidence = 0.7; // Base confidence
        
        // Multiple pattern matches increase confidence
        const matches = content.match(pattern) || [];
        confidence += Math.min(0.2, matches.length * 0.05);
        
        // Specific indicators increase confidence
        const strongIndicators = [
            'previous chat', 'last conversation', 'earlier session',
            'other chat', 'different conversation', 'before'
        ];
        
        for (const indicator of strongIndicators) {
            if (content.includes(indicator)) {
                confidence += 0.1;
            }
        }
        
        // Character mentions might indicate cross-chat references
        if (content.includes(active_character) && content.includes('said') || content.includes('mentioned')) {
            confidence += 0.1;
        }
        
        return Math.min(1.0, confidence);
    }

    /**
     * Extract reference context
     */
    extractReferenceContext(content, pattern) {
        const match = pattern.exec(content);
        if (!match) return '';
        
        // Get surrounding context (100 characters before and after)
        const matchIndex = match.index;
        const start = Math.max(0, matchIndex - 100);
        const end = Math.min(content.length, matchIndex + match[0].length + 100);
        
        return content.substring(start, end).trim();
    }

    /**
     * Process detected references using user-assisted flow
     */
    async processDetectedReferences(messageData, references, chatId) {
        // Since we can't get a list of all chats, we can't auto-find targets.
        // Instead, we log the potential reference and provide a UI for the user to link it manually.
        
        for (const reference of references) {
            console.log(`[NemoLore] Detected potential cross-chat reference of type '${reference.type}' in chat ${chatId}. Manual linking would be required.`);
            
            // Store the context of the reference in the current chat's metadata.
            if (!chat_metadata.nemolore_potential_links) {
                chat_metadata.nemolore_potential_links = [];
            }
            chat_metadata.nemolore_potential_links.push({
                message: messageData.content,
                context: reference.context,
                type: reference.type,
                timestamp: Date.now()
            });
            await saveMetadata();

            // Use the notification manager to inform the user.
            // This assumes notificationManager is available globally or passed in.
            if (window.notificationManager) { // A plausible way to access it
                 window.notificationManager.info(
                    'Cross-Chat Reference Detected',
                    `NemoLore noticed you might be referencing another conversation. You can manage these links in the dashboard.`
                );
            }
        }
    }

    /**
     * Show user notification for cross-chat reference detection
     */
    async showUserNotification(reference, chatId, messageData) {
        // This function is deprecated in the refactored version
        // User notifications are now handled through chat metadata
        console.log('[NemoLore Cross-Chat Manager] User notification requested but using refactored approach');
    }

    /**
     * Open chat selection UI for user to choose target chat
     */
    async openChatSelectionUI(reference, chatId, messageData) {
        // This function is deprecated in the refactored version
        // Chat selection is now handled through dashboard UI
        console.log('[NemoLore Cross-Chat Manager] Chat selection UI requested but using refactored approach');
        return null;
    }

    /**
     * Get available chats (deprecated - no longer used in refactored approach)
     */
    async getAvailableChats() {
        // This function is deprecated in the refactored version
        // Chat listing is now handled through dashboard UI
        console.log('[NemoLore Cross-Chat Manager] Available chats requested but using refactored approach');
        return [];
    }

    /**
     * Calculate relevance between reference and chat (deprecated)
     */
    async calculateChatRelevance(reference, chatInfo) {
        // This function is deprecated in the refactored version
        console.log('[NemoLore Cross-Chat Manager] Chat relevance calculation requested but using refactored approach');
        return 0;
    }

    /**
     * Calculate content similarity (deprecated)
     */
    calculateContentSimilarity(text1, text2) {
        // This function is deprecated in the refactored version
        console.log('[NemoLore Cross-Chat Manager] Content similarity calculation requested but using refactored approach');
        return 0;
    }

    /**
     * Create cross-chat reference
     */
    async createCrossChatReference(referenceData) {
        const referenceId = this.generateReferenceId();
        
        const reference = {
            id: referenceId,
            sourceChat: referenceData.sourceChat,
            targetChats: referenceData.targetChats,
            type: referenceData.reference.type,
            confidence: referenceData.reference.confidence,
            context: referenceData.reference.context,
            sourceMessage: {
                id: referenceData.sourceMessage.id,
                content: referenceData.sourceMessage.content,
                timestamp: referenceData.sourceMessage.timestamp
            },
            created: referenceData.timestamp,
            accessed: 0,
            lastAccessed: null
        };
        
        this.references.set(referenceId, reference);
        
        // Update chat connections
        await this.updateChatConnections(reference);
        
        // Save to storage
        await this.saveCrossChatReferences();
        
        eventSystem.emit(NEMOLORE_EVENTS.CROSS_CHAT_REFERENCE_CREATED, {
            reference: reference
        });
        
        console.log(`[NemoLore Cross-Chat Manager] ✅ Created cross-chat reference: ${referenceId}`);
    }

    /**
     * Update chat connections network
     */
    async updateChatConnections(reference) {
        const sourceId = reference.sourceChat;
        
        // Update connections from source to all targets
        for (const target of reference.targetChats) {
            const connectionKey = `${sourceId}->${target.chatId}`;
            
            if (!this.chatConnections.has(connectionKey)) {
                this.chatConnections.set(connectionKey, {
                    source: sourceId,
                    target: target.chatId,
                    references: [],
                    strength: 0,
                    lastUpdated: Date.now()
                });
            }
            
            const connection = this.chatConnections.get(connectionKey);
            connection.references.push(reference.id);
            connection.strength = this.calculateConnectionStrength(connection);
            connection.lastUpdated = Date.now();
        }
    }

    /**
     * Calculate connection strength between chats
     */
    calculateConnectionStrength(connection) {
        let strength = 0;
        
        // Number of references
        strength += connection.references.length * 0.2;
        
        // Recency of references
        const recentRefs = connection.references.filter(refId => {
            const ref = this.references.get(refId);
            const age = Date.now() - (ref?.created || 0);
            return age < (7 * 24 * 60 * 60 * 1000); // Within 7 days
        });
        strength += recentRefs.length * 0.3;
        
        // Average confidence of references
        const confidences = connection.references
            .map(refId => this.references.get(refId)?.confidence || 0)
            .filter(conf => conf > 0);
        
        if (confidences.length > 0) {
            const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
            strength += avgConfidence * 0.5;
        }
        
        return Math.min(1.0, strength);
    }

    /**
     * Check for incoming references to current chat
     */
    async checkIncomingReferences(chatId) {
        const incomingRefs = [];
        
        for (const [refId, reference] of this.references.entries()) {
            const isTarget = reference.targetChats.some(target => target.chatId === chatId);
            if (isTarget) {
                incomingRefs.push(reference);
            }
        }
        
        if (incomingRefs.length > 0) {
            console.log(`[NemoLore Cross-Chat Manager] Found ${incomingRefs.length} incoming references to chat ${chatId}`);
            
            eventSystem.emit(NEMOLORE_EVENTS.CROSS_CHAT_REFERENCES_FOUND, {
                chatId: chatId,
                references: incomingRefs
            });
        }
        
        return incomingRefs;
    }

    /**
     * Get references for a specific chat
     */
    getReferencesForChat(chatId) {
        const chatReferences = {
            outgoing: [], // References from this chat to others
            incoming: []  // References from other chats to this one
        };
        
        for (const [refId, reference] of this.references.entries()) {
            // Check outgoing references
            if (reference.sourceChat === chatId) {
                chatReferences.outgoing.push(reference);
            }
            
            // Check incoming references
            const isTarget = reference.targetChats.some(target => target.chatId === chatId);
            if (isTarget) {
                chatReferences.incoming.push(reference);
            }
        }
        
        return chatReferences;
    }

    /**
     * Find related chats
     */
    findRelatedChats(chatId, maxResults = 10) {
        const connections = new Map();
        
        // Get all connections involving this chat
        for (const [connectionKey, connection] of this.chatConnections.entries()) {
            if (connection.source === chatId) {
                connections.set(connection.target, connection.strength);
            } else if (connection.target === chatId) {
                connections.set(connection.source, connection.strength);
            }
        }
        
        // Sort by strength and return top results
        return Array.from(connections.entries())
            .sort(([,strengthA], [,strengthB]) => strengthB - strengthA)
            .slice(0, maxResults)
            .map(([relatedChatId, strength]) => ({
                chatId: relatedChatId,
                strength: strength,
                references: this.getConnectionReferences(chatId, relatedChatId)
            }));
    }

    /**
     * Get references between two specific chats
     */
    getConnectionReferences(chatId1, chatId2) {
        const connectionRefs = [];
        
        for (const [refId, reference] of this.references.entries()) {
            const involvesChats = 
                (reference.sourceChat === chatId1 && 
                 reference.targetChats.some(target => target.chatId === chatId2)) ||
                (reference.sourceChat === chatId2 && 
                 reference.targetChats.some(target => target.chatId === chatId1));
            
            if (involvesChats) {
                connectionRefs.push(reference);
            }
        }
        
        return connectionRefs;
    }

    /**
     * Detect circular references
     */
    detectCircularReferences(startChatId, visitedPath = []) {
        if (visitedPath.includes(startChatId)) {
            return visitedPath.concat([startChatId]); // Return the circular path
        }
        
        if (visitedPath.length > this.maxRecursionDepth) {
            return null; // Prevent infinite recursion
        }
        
        const newPath = visitedPath.concat([startChatId]);
        
        // Get all chats this chat references
        const outgoingRefs = this.getReferencesForChat(startChatId).outgoing;
        
        for (const reference of outgoingRefs) {
            for (const target of reference.targetChats) {
                const circularPath = this.detectCircularReferences(target.chatId, newPath);
                if (circularPath) {
                    return circularPath;
                }
            }
        }
        
        return null;
    }

    /**
     * Generate reference ID
     */
    generateReferenceId() {
        return `crossref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update chat metadata
     */
    async updateChatMetadata(chatId) {
        if (!chat_metadata) return;
        
        const references = this.getReferencesForChat(chatId);
        const relatedChats = this.findRelatedChats(chatId, 5);
        
        chat_metadata.nemolore_cross_chat = {
            outgoingReferences: references.outgoing.length,
            incomingReferences: references.incoming.length,
            relatedChats: relatedChats.length,
            lastUpdated: Date.now()
        };
        
        await saveMetadata();
    }

    /**
     * Save cross-chat references
     */
    async saveCrossChatReferences() {
        try {
            // Save references
            const referencesObj = {};
            for (const [key, value] of this.references.entries()) {
                referencesObj[key] = value;
            }
            localStorage.setItem('nemolore_cross_chat_references', JSON.stringify(referencesObj));
            
            // Save connections
            const connectionsObj = {};
            for (const [key, value] of this.chatConnections.entries()) {
                connectionsObj[key] = value;
            }
            localStorage.setItem('nemolore_chat_connections', JSON.stringify(connectionsObj));
            
        } catch (error) {
            console.error('[NemoLore Cross-Chat Manager] Failed to save cross-chat references:', error);
        }
    }

    /**
     * Get statistics
     */
    getStatistics() {
        const stats = {
            totalReferences: this.references.size,
            totalConnections: this.chatConnections.size,
            referencesByType: {},
            strongConnections: 0,
            averageConnectionStrength: 0
        };
        
        // Count references by type
        for (const reference of this.references.values()) {
            const type = reference.type || 'unknown';
            stats.referencesByType[type] = (stats.referencesByType[type] || 0) + 1;
        }
        
        // Calculate connection statistics
        let totalStrength = 0;
        for (const connection of this.chatConnections.values()) {
            totalStrength += connection.strength;
            if (connection.strength > 0.7) {
                stats.strongConnections++;
            }
        }
        
        if (this.chatConnections.size > 0) {
            stats.averageConnectionStrength = totalStrength / this.chatConnections.size;
        }
        
        return stats;
    }

    /**
     * Shutdown the cross-chat manager
     */
    async shutdown() {
        console.log('[NemoLore Cross-Chat Manager] Shutting down...');
        
        // Save final state
        await this.saveCrossChatReferences();
        
        // Clear data
        this.references.clear();
        this.chatConnections.clear();
        this.taskNetwork.clear();
        
        this.isInitialized = false;
        console.log('[NemoLore Cross-Chat Manager] ✅ Shutdown completed');
    }
}

/**
 * Network Analyzer for chat connections
 */
class NetworkAnalyzer {
    constructor() {
        this.algorithms = {
            centrality: this.calculateCentrality.bind(this),
            clustering: this.calculateClustering.bind(this),
            pathfinding: this.findShortestPath.bind(this)
        };
    }

    /**
     * Calculate centrality measures
     */
    calculateCentrality(connections) {
        const centrality = new Map();
        
        // Degree centrality (number of connections)
        for (const [key, connection] of connections) {
            const source = connection.source;
            const target = connection.target;
            
            centrality.set(source, (centrality.get(source) || 0) + 1);
            centrality.set(target, (centrality.get(target) || 0) + 1);
        }
        
        return centrality;
    }

    /**
     * Calculate clustering coefficient
     */
    calculateClustering(connections) {
        // Simplified clustering calculation
        const clustering = new Map();
        
        // This would implement actual clustering algorithm
        // For now, return placeholder
        return clustering;
    }

    /**
     * Find shortest path between chats
     */
    findShortestPath(connections, startChat, endChat) {
        // Simplified pathfinding using BFS
        const queue = [[startChat]];
        const visited = new Set();
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (current === endChat) {
                return path;
            }
            
            if (visited.has(current)) {
                continue;
            }
            
            visited.add(current);
            
            // Find neighbors
            for (const [key, connection] of connections) {
                let neighbor = null;
                if (connection.source === current) {
                    neighbor = connection.target;
                } else if (connection.target === current) {
                    neighbor = connection.source;
                }
                
                if (neighbor && !visited.has(neighbor)) {
                    queue.push([...path, neighbor]);
                }
            }
        }
        
        return null; // No path found
    }
}

console.log('[NemoLore Cross-Chat Manager] Module loaded - Cross-chat task references ready');