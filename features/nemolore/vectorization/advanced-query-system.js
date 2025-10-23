/**
 * Advanced Query System - Multi-Algorithm Search
 * RECOVERY VERSION - Based on conversation history (542 lines originally)
 */

// SillyTavern Core Imports - Graceful fallback for missing modules
let saveSettingsDebounced, chat, chat_metadata, this_chid, getCurrentChatId, saveMetadata, callPopup, eventSource, event_types, saveChatConditional, characters, extension_prompt_roles, active_character, generateQuietPrompt, substituteParamsExtended, generateRaw, getMaxContextSize, getRequestHeaders, main_api;

try {
    // These imports may fail if the modules don't exist - fallback gracefully
    const scriptModule = await import('../../../../../../../script.js').catch(() => null);
    
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
    console.warn('[NemoLore Advanced Query System] SillyTavern script module not available:', error);
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

// SillyTavern imports - these modules may not be available in all contexts
// Using try-catch pattern for graceful fallback
let selected_group, extension_settings, getContext;

try {
    // These imports may fail if the modules don't exist
    const groupChatsModule = await import('../../../../../../../scripts/group-chats.js').catch(() => null);
    const extensionsModule = await import('../../../../../../../scripts/extensions.js').catch(() => null);
    
    if (groupChatsModule) {
        selected_group = groupChatsModule.selected_group;
    }
    
    if (extensionsModule) {
        extension_settings = extensionsModule.extension_settings;
        getContext = extensionsModule.getContext;
    }
} catch (error) {
    console.warn('[NemoLore Advanced Query System] Some SillyTavern modules not available:', error);
}

/**
 * Advanced Query System with Multi-Algorithm Search
 */
export class AdvancedQuerySystem {
    constructor(vectorManager, settings) {
        this.vectorManager = vectorManager;
        this.settings = settings;
        this.isInitialized = false;
        
        // Search algorithms configuration
        this.algorithms = {
            bm25: { weight: 0.3, enabled: true },
            cosine: { weight: 0.25, enabled: true },
            semantic: { weight: 0.25, enabled: true },
            temporal: { weight: 0.1, enabled: true },
            contextual: { weight: 0.1, enabled: true }
        };
        
        // Fusion methods
        this.fusionMethods = {
            rrf: true,  // Reciprocal Rank Fusion
            weightedSum: true,
            hybrid: true
        };
        
        console.log('[NemoLore Advanced Query System] Constructor completed');
    }

    /**
     * Initialize the query system
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('[NemoLore Advanced Query System] Initializing...');
        
        try {
            // Initialize search algorithms
            await this.initializeSearchAlgorithms();
            
            // Set up query processing pipeline
            this.setupQueryProcessing();
            
            // Initialize fusion algorithms
            this.setupFusionAlgorithms();
            
            this.isInitialized = true;
            console.log('[NemoLore Advanced Query System] ✅ Initialized successfully');
            
        } catch (error) {
            console.error('[NemoLore Advanced Query System] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize search algorithms
     */
    async initializeSearchAlgorithms() {
        // Set up BM25 algorithm
        this.bm25 = new BM25Algorithm();
        
        // Set up cosine similarity
        this.cosine = new CosineAlgorithm();
        
        // Set up semantic search
        this.semantic = new SemanticAlgorithm();
        
        // Set up temporal scoring
        this.temporal = new TemporalAlgorithm();
        
        // Set up contextual relevance
        this.contextual = new ContextualAlgorithm();
        
        console.log('[NemoLore Advanced Query System] Search algorithms initialized');
    }

    /**
     * Set up query processing pipeline
     */
    setupQueryProcessing() {
        this.queryProcessor = new QueryProcessor();
        console.log('[NemoLore Advanced Query System] Query processing pipeline setup completed');
    }

    /**
     * Set up fusion algorithms
     */
    setupFusionAlgorithms() {
        this.fusionEngine = new FusionEngine(this.fusionMethods);
        console.log('[NemoLore Advanced Query System] Fusion algorithms setup completed');
    }

    /**
     * Perform advanced search using SillyTavern's vector API
     * Note: ST's API already handles similarity search server-side
     * The multi-algorithm fusion is simplified to use ST's built-in search
     */
    async searchAdvanced(query, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Advanced Query System not initialized');
        }

        try {
            const searchOptions = {
                limit: options.limit || 10,
                chatId: options.chatId || getCurrentChatId(),
                threshold: options.threshold || 0.1,
                timeRange: options.timeRange
            };

            console.log(`[NemoLore Advanced Query System] Searching with query: "${query.substring(0, 50)}..."`);

            // Use vector manager's search (which uses ST's API)
            const results = await this.vectorManager.searchVectors(query, searchOptions.limit, searchOptions);

            // Apply time range filter if specified
            let filteredResults = results;
            if (searchOptions.timeRange) {
                const now = Date.now();
                const cutoff = now - (searchOptions.timeRange * 24 * 60 * 60 * 1000);
                filteredResults = results.filter(r => r.metadata?.timestamp > cutoff);
            }

            console.log(`[NemoLore Advanced Query System] Found ${filteredResults.length} results`);

            return filteredResults;

        } catch (error) {
            console.error('[NemoLore Advanced Query System] Search failed:', error);
            return [];
        }
    }

    /**
     * Get relevant vectors for search
     */
    async getRelevantVectors(options) {
        const vectors = [];
        
        if (options.chatId) {
            const chatVectors = await this.vectorManager.getVectorsForChat(options.chatId);
            vectors.push(...chatVectors);
        }
        
        // Apply time range filter if specified
        if (options.timeRange) {
            const now = Date.now();
            const cutoff = now - (options.timeRange * 24 * 60 * 60 * 1000); // days to milliseconds
            return vectors.filter(v => v.timestamp > cutoff);
        }
        
        return vectors;
    }

    /**
     * Run multiple search algorithms
     */
    async runSearchAlgorithms(processedQuery, vectors, options) {
        const results = {};
        
        for (const algorithm of options.algorithms) {
            if (!this.algorithms[algorithm]?.enabled) continue;
            
            try {
                switch (algorithm) {
                    case 'bm25':
                        results.bm25 = await this.bm25.search(processedQuery, vectors);
                        break;
                    case 'cosine':
                        results.cosine = await this.cosine.search(processedQuery, vectors);
                        break;
                    case 'semantic':
                        results.semantic = await this.semantic.search(processedQuery, vectors);
                        break;
                    case 'temporal':
                        results.temporal = await this.temporal.search(processedQuery, vectors);
                        break;
                    case 'contextual':
                        results.contextual = await this.contextual.search(processedQuery, vectors);
                        break;
                }
            } catch (error) {
                console.error(`[NemoLore Advanced Query System] ${algorithm} search failed:`, error);
            }
        }
        
        return results;
    }

    /**
     * Post-process results
     */
    postProcessResults(results, options) {
        // Remove duplicates
        const seen = new Set();
        const uniqueResults = results.filter(result => {
            const key = result.vector?.id || result.vector?.hash;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
        // Apply additional filters
        return uniqueResults
            .filter(result => result.score > 0.1) // Minimum relevance threshold
            .sort((a, b) => b.score - a.score);
    }

    /**
     * Shutdown the query system
     */
    async shutdown() {
        console.log('[NemoLore Advanced Query System] Shutting down...');
        this.isInitialized = false;
        console.log('[NemoLore Advanced Query System] ✅ Shutdown completed');
    }
}

/**
 * BM25 Algorithm Implementation
 */
class BM25Algorithm {
    constructor() {
        this.k1 = 1.2;
        this.b = 0.75;
    }

    async search(query, vectors) {
        // Placeholder BM25 implementation
        const results = [];
        const queryTerms = query.terms || [];
        
        for (const vector of vectors) {
            const score = this.calculateBM25Score(queryTerms, vector);
            if (score > 0) {
                results.push({ vector, score, algorithm: 'bm25' });
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }

    calculateBM25Score(queryTerms, vector) {
        // Simplified BM25 calculation
        const content = (vector.content || '').toLowerCase();
        const contentLength = content.split(/\s+/).length;
        const avgLength = 100; // Assumed average document length
        
        let score = 0;
        for (const term of queryTerms) {
            const tf = (content.match(new RegExp(term.toLowerCase(), 'g')) || []).length;
            if (tf > 0) {
                const idf = Math.log(1000 / (tf + 1)); // Simplified IDF
                const termScore = (idf * tf * (this.k1 + 1)) / 
                                (tf + this.k1 * (1 - this.b + this.b * (contentLength / avgLength)));
                score += termScore;
            }
        }
        
        return score;
    }
}

/**
 * Cosine Similarity Algorithm
 */
class CosineAlgorithm {
    async search(query, vectors) {
        const results = [];
        const queryVector = query.embedding || [];
        
        for (const vector of vectors) {
            if (vector.embedding) {
                const score = this.calculateCosineSimilarity(queryVector, vector.embedding);
                if (score > 0) {
                    results.push({ vector, score, algorithm: 'cosine' });
                }
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }

    calculateCosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
        
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            magnitude1 += vec1[i] * vec1[i];
            magnitude2 += vec2[i] * vec2[i];
        }
        
        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);
        
        if (magnitude1 === 0 || magnitude2 === 0) return 0;
        
        return dotProduct / (magnitude1 * magnitude2);
    }
}

/**
 * Semantic Search Algorithm
 */
class SemanticAlgorithm {
    async search(query, vectors) {
        // Placeholder semantic search
        const results = [];
        const queryText = query.text || '';
        
        for (const vector of vectors) {
            const score = this.calculateSemanticSimilarity(queryText, vector.content || '');
            if (score > 0) {
                results.push({ vector, score, algorithm: 'semantic' });
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }

    calculateSemanticSimilarity(query, content) {
        // Simplified semantic similarity based on word overlap and context
        const queryWords = query.toLowerCase().split(/\s+/);
        const contentWords = content.toLowerCase().split(/\s+/);
        
        const querySet = new Set(queryWords);
        const contentSet = new Set(contentWords);
        
        const intersection = new Set([...querySet].filter(word => contentSet.has(word)));
        const union = new Set([...querySet, ...contentSet]);
        
        return intersection.size / union.size; // Jaccard similarity as approximation
    }
}

/**
 * Temporal Relevance Algorithm
 */
class TemporalAlgorithm {
    async search(query, vectors) {
        const results = [];
        const currentTime = Date.now();
        
        for (const vector of vectors) {
            const score = this.calculateTemporalScore(vector.timestamp, currentTime);
            if (score > 0) {
                results.push({ vector, score, algorithm: 'temporal' });
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }

    calculateTemporalScore(timestamp, currentTime) {
        const ageInDays = (currentTime - timestamp) / (1000 * 60 * 60 * 24);
        
        // Exponential decay: more recent content gets higher scores
        return Math.exp(-ageInDays / 30); // Half-life of 30 days
    }
}

/**
 * Contextual Relevance Algorithm
 */
class ContextualAlgorithm {
    async search(query, vectors) {
        const results = [];
        const currentChatId = getCurrentChatId();
        
        for (const vector of vectors) {
            const score = this.calculateContextualScore(vector, currentChatId);
            if (score > 0) {
                results.push({ vector, score, algorithm: 'contextual' });
            }
        }
        
        return results.sort((a, b) => b.score - a.score);
    }

    calculateContextualScore(vector, currentChatId) {
        let score = 0;
        
        // Same chat bonus
        if (vector.chatId === currentChatId) {
            score += 0.5;
        }
        
        // Same character bonus
        if (vector.metadata?.character === this.getCurrentCharacter()) {
            score += 0.3;
        }
        
        // Content length bonus (longer content often more valuable)
        const contentLength = (vector.content || '').length;
        if (contentLength > 100) {
            score += Math.min(0.2, contentLength / 1000);
        }
        
        return score;
    }

    getCurrentCharacter() {
        // Placeholder - would need to get actual current character
        return 'default';
    }
}

/**
 * Query Processor
 */
class QueryProcessor {
    async process(query) {
        const processedQuery = {
            text: query,
            terms: this.extractTerms(query),
            embedding: await this.generateEmbedding(query),
            intent: this.detectIntent(query)
        };
        
        return processedQuery;
    }

    extractTerms(query) {
        return query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(term => term.length > 2);
    }

    async generateEmbedding(query) {
        // Placeholder embedding generation
        const words = query.split(/\s+/);
        const embedding = new Array(100).fill(0);
        
        for (let i = 0; i < Math.min(words.length, 100); i++) {
            embedding[i] = Math.random();
        }
        
        return embedding;
    }

    detectIntent(query) {
        const lowercaseQuery = query.toLowerCase();
        
        if (lowercaseQuery.includes('what') || lowercaseQuery.includes('how')) {
            return 'question';
        } else if (lowercaseQuery.includes('find') || lowercaseQuery.includes('search')) {
            return 'search';
        } else {
            return 'general';
        }
    }
}

/**
 * Fusion Engine for combining multiple search results
 */
class FusionEngine {
    constructor(fusionMethods) {
        this.fusionMethods = fusionMethods;
    }

    async fuse(algorithmResults, options) {
        switch (options.fusionMethod) {
            case 'rrf':
                return this.reciprocalRankFusion(algorithmResults);
            case 'weightedSum':
                return this.weightedSumFusion(algorithmResults, options);
            case 'hybrid':
                return this.hybridFusion(algorithmResults, options);
            default:
                return this.reciprocalRankFusion(algorithmResults);
        }
    }

    reciprocalRankFusion(algorithmResults) {
        const k = 60; // RRF parameter
        const scoreMap = new Map();
        
        for (const [algorithm, results] of Object.entries(algorithmResults)) {
            results.forEach((result, rank) => {
                const vectorId = result.vector?.id || result.vector?.hash;
                if (vectorId) {
                    const rrfScore = 1 / (k + rank + 1);
                    const currentScore = scoreMap.get(vectorId) || { score: 0, vector: result.vector };
                    currentScore.score += rrfScore;
                    scoreMap.set(vectorId, currentScore);
                }
            });
        }
        
        return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
    }

    weightedSumFusion(algorithmResults, options) {
        const scoreMap = new Map();
        
        for (const [algorithm, results] of Object.entries(algorithmResults)) {
            const weight = options.algorithms?.[algorithm]?.weight || 1;
            
            results.forEach(result => {
                const vectorId = result.vector?.id || result.vector?.hash;
                if (vectorId) {
                    const weightedScore = result.score * weight;
                    const currentScore = scoreMap.get(vectorId) || { score: 0, vector: result.vector };
                    currentScore.score += weightedScore;
                    scoreMap.set(vectorId, currentScore);
                }
            });
        }
        
        return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
    }

    hybridFusion(algorithmResults, options) {
        // Combine RRF and weighted sum
        const rrfResults = this.reciprocalRankFusion(algorithmResults);
        const weightedResults = this.weightedSumFusion(algorithmResults, options);
        
        const finalScoreMap = new Map();
        
        // Combine both approaches with equal weight
        rrfResults.forEach(result => {
            const vectorId = result.vector?.id || result.vector?.hash;
            if (vectorId) {
                finalScoreMap.set(vectorId, { 
                    score: result.score * 0.5, 
                    vector: result.vector 
                });
            }
        });
        
        weightedResults.forEach(result => {
            const vectorId = result.vector?.id || result.vector?.hash;
            if (vectorId) {
                const current = finalScoreMap.get(vectorId) || { score: 0, vector: result.vector };
                current.score += result.score * 0.5;
                finalScoreMap.set(vectorId, current);
            }
        });
        
        return Array.from(finalScoreMap.values()).sort((a, b) => b.score - a.score);
    }
}

console.log('[NemoLore Advanced Query System] Module loaded - Multi-algorithm search system ready');