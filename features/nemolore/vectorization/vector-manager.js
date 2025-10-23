/**
 * Vector Manager - Enhanced Version with Import Path Fixes
 * RECOVERY VERSION - Enhanced IndexedDB system
 */

// SillyTavern Core Imports - CRITICAL FIX: Changed from ../../../../script.js to ../../../../../script.js
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

// NemoLore Imports
import { RerankService } from './rerank-service.js';

// SillyTavern imports - graceful fallback for missing modules
let selected_group, extension_settings, getContext;

try {
    const groupChatsModule = await import('../../../../../../../scripts/group-chats.js').catch(() => null);
    const extensionsModule = await import('../../../../../../../scripts/extensions.js').catch(() => null);
    
    if (groupChatsModule) {
        selected_group = groupChatsModule.selected_group;
    }
    
    if (extensionsModule) {
        extension_settings = extensionsModule.extension_settings || {};
        getContext = extensionsModule.getContext || (() => ({ extension_settings: {} }));
    }
} catch (error) {
    console.warn('[NemoLore Vector Manager] SillyTavern modules not available:', error);
    // Provide fallback values
    extension_settings = {};
    getContext = () => ({ extension_settings: {} });
}

/**
 * Vector API Helper - Uses SillyTavern's built-in vectorization
 * Instead of client-side Transformers.js, we use ST's server-side API
 */
class VectorAPIHelper {
    /**
     * Insert vectors using ST's native vectorization API
     * @param {Array} items - Items to vectorize [{text, hash, metadata}]
     * @returns {Promise<Object>} Result from ST's vector API
     */
    static async insertVectors(items) {
        try {
            if (!items || items.length === 0) {
                console.warn('[NemoLore Vector API] Insert called with empty items array');
                return { success: false, error: 'No items to insert' };
            }

            console.log(`[NemoLore Vector API] Inserting ${items.length} vectors...`);

            const response = await fetch('/api/vector/insert', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ items })
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                throw new Error(`Vector API error (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            console.log(`[NemoLore Vector API] ✅ Successfully inserted ${items.length} vectors`);
            return result;

        } catch (error) {
            console.error('[NemoLore Vector API] Insert failed:', {
                error: error.message,
                itemCount: items?.length || 0,
                stack: error.stack
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Query vectors using ST's native search API
     * @param {string} query - Search query text
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Search results
     */
    static async queryVectors(query, options = {}) {
        try {
            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                console.warn('[NemoLore Vector API] Query called with empty or invalid query');
                return [];
            }

            const queryOptions = {
                query,
                limit: options.limit || 10,
                threshold: options.threshold || 0.1,
                ...options
            };

            console.log(`[NemoLore Vector API] Querying: "${query.substring(0, 50)}..." (limit: ${queryOptions.limit})`);

            const response = await fetch('/api/vector/query', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(queryOptions)
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                throw new Error(`Vector query error (${response.status}): ${errorText}`);
            }

            const results = await response.json();
            console.log(`[NemoLore Vector API] ✅ Query returned ${results.length || 0} results`);
            return results;

        } catch (error) {
            console.error('[NemoLore Vector API] Query failed:', {
                error: error.message,
                query: query?.substring(0, 100) || 'undefined',
                options: options,
                stack: error.stack
            });
            return [];
        }
    }
}

/**
 * Enhanced Vector Manager with IndexedDB
 */
export class VectorManager {
    constructor(settings, state) {
        this.settings = settings;
        this.state = state;
        this.db = null;
        this.isInitialized = false;

        // Vector storage configuration
        this.config = {
            dbName: 'NemoLoreVectorDB',
            dbVersion: 2,
            storeName: 'vectors',
            maxVectors: 10000,
            cacheSize: 1000
        };

        // LRU Cache for performance
        this.vectorCache = new Map();
        this.cacheOrder = [];

        // Initialize reranking service
        this.rerankService = new RerankService({
            hybridAlpha: settings.rerankHybridAlpha || 0.5,
            rerankEnabled: settings.rerankEnabled !== false
        });

        console.log('[NemoLore Vector Manager] Constructor completed');
    }

    /**
     * Initialize the vector manager
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('[NemoLore Vector Manager] Initializing...');

        try {
            // Initialize IndexedDB
            await this.initializeDatabase();

            // Load existing vectors
            await this.loadVectors();

            // Initialize reranking service
            await this.rerankService.initialize();

            // Set up vector processing
            this.setupVectorProcessing();

            this.isInitialized = true;
            console.log('[NemoLore Vector Manager] ✅ Initialized successfully');

        } catch (error) {
            console.error('[NemoLore Vector Manager] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize IndexedDB database
     */
    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            try {
                console.log(`[NemoLore Vector Manager] Opening IndexedDB: ${this.config.dbName} v${this.config.dbVersion}`);

                const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

                request.onerror = () => {
                    const errorMsg = `Database open failed: ${request.error?.message || 'Unknown error'}`;
                    console.error('[NemoLore Vector Manager]', errorMsg, {
                        dbName: this.config.dbName,
                        version: this.config.dbVersion,
                        error: request.error
                    });
                    reject(new Error(errorMsg));
                };

                request.onsuccess = () => {
                    this.db = request.result;

                    // Set up error handler for the database connection
                    this.db.onerror = (event) => {
                        console.error('[NemoLore Vector Manager] Database error:', event.target.error);
                    };

                    console.log('[NemoLore Vector Manager] ✅ Database initialized successfully');
                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    try {
                        const db = event.target.result;
                        console.log(`[NemoLore Vector Manager] Upgrading database from v${event.oldVersion} to v${event.newVersion}`);

                        // Create vector store if it doesn't exist
                        if (!db.objectStoreNames.contains(this.config.storeName)) {
                            const store = db.createObjectStore(this.config.storeName, {
                                keyPath: 'id',
                                autoIncrement: true
                            });

                            // Create indices including collectionId
                            store.createIndex('chatId', 'chatId', { unique: false });
                            store.createIndex('collectionId', 'collectionId', { unique: false });
                            store.createIndex('timestamp', 'timestamp', { unique: false });
                            store.createIndex('messageId', 'messageId', { unique: false });
                            store.createIndex('hash', 'hash', { unique: true });

                            console.log('[NemoLore Vector Manager] ✅ Object store and indices created');
                        }

                        console.log('[NemoLore Vector Manager] Database schema upgrade completed');

                    } catch (upgradeError) {
                        console.error('[NemoLore Vector Manager] Schema upgrade failed:', upgradeError);
                        reject(upgradeError);
                    }
                };

                request.onblocked = () => {
                    console.warn('[NemoLore Vector Manager] Database upgrade blocked - close other tabs with this app');
                };

            } catch (error) {
                console.error('[NemoLore Vector Manager] Failed to open IndexedDB:', error);
                reject(error);
            }
        });
    }

    /**
     * Load existing vectors into cache
     */
    async loadVectors() {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const store = transaction.objectStore(this.config.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const vectors = request.result;
                console.log(`[NemoLore Vector Manager] Loaded ${vectors.length} vectors from database`);
                
                // Populate cache with most recent vectors
                vectors
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, this.config.cacheSize)
                    .forEach(vector => {
                        this.vectorCache.set(vector.id, vector);
                        this.cacheOrder.push(vector.id);
                    });
            };
            
        } catch (error) {
            console.error('[NemoLore Vector Manager] Failed to load vectors:', error);
        }
    }

    /**
     * Process a message for vectorization
     */
    async processMessage(messageData) {
        if (!this.isInitialized || !this.settings.enabled) return;
        
        try {
            const chatId = getCurrentChatId();
            if (!chatId) return;
            
            // Generate vector for message
            const vector = await this.generateVector(messageData, chatId);
            if (vector) {
                await this.storeVector(vector);
            }
            
        } catch (error) {
            console.error('[NemoLore Vector Manager] Message processing failed:', error);
        }
    }

    /**
     * Generate collectionId following Vectors Enhanced pattern
     * Format: {chatId}_{taskId}
     * @param {string} chatId - Current chat ID
     * @param {string} taskId - Task identifier (default: 'chat')
     * @returns {string} Collection ID
     */
    getCollectionId(chatId, taskId = 'chat') {
        return `${chatId}_${taskId}`;
    }

    /**
     * Generate vector representation of a message
     * @param {Object} messageData - Message data
     * @param {string} chatId - Chat ID
     * @param {string} taskId - Task ID for collection organization
     */
    async generateVector(messageData, chatId, taskId = 'chat') {
        try {
            const content = messageData.content || messageData.mes || '';
            if (!content.trim()) return null;

            // Create vector object with collectionId
            const vector = {
                chatId: chatId,
                collectionId: this.getCollectionId(chatId, taskId),
                messageId: messageData.id || Date.now(),
                content: content,
                role: messageData.role || 'user',
                timestamp: messageData.timestamp || Date.now(),
                hash: this.generateContentHash(content),
                metadata: {
                    character: active_character,
                    length: content.length,
                    wordCount: content.split(/\s+/).length,
                    taskId: taskId
                }
            };

            // Generate embeddings (placeholder for now)
            vector.embedding = await this.generateEmbedding(content);

            return vector;

        } catch (error) {
            console.error('[NemoLore Vector Manager] Vector generation failed:', error);
            return null;
        }
    }

    /**
     * Generate content hash for deduplication
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
     * Generate embedding using SillyTavern's server-side vectorization
     * Note: We don't generate embeddings client-side anymore
     * Instead, we prepare data for ST's /api/vector/insert endpoint
     */
    async generateEmbedding(content) {
        // Embeddings are now generated server-side by SillyTavern
        // We just return a placeholder that indicates the content needs vectorization
        // The actual embedding happens when we call VectorAPIHelper.insertVectors()

        if (typeof content !== 'string' || content.trim().length === 0) {
            console.warn('[NemoLore Vector Manager] Empty content, skipping embedding');
            return null;
        }

        // Return null - embeddings will be generated server-side
        // This method is kept for compatibility but no longer generates embeddings
        return null;
    }

    /**
     * Store vector using SillyTavern's API and local cache
     */
    async storeVector(vector) {
        if (!this.db) {
            console.warn('[NemoLore Vector Manager] Database not initialized, cannot store vector');
            return;
        }

        try {
            // Validate vector data
            if (!vector || !vector.content || !vector.hash) {
                console.warn('[NemoLore Vector Manager] Invalid vector data, skipping storage:', {
                    hasVector: !!vector,
                    hasContent: !!vector?.content,
                    hasHash: !!vector?.hash
                });
                return;
            }

            // Check for duplicates in local cache
            if (await this.vectorExists(vector.hash)) {
                console.log(`[NemoLore Vector Manager] Vector already exists (hash: ${vector.hash}), skipping`);
                return;
            }

            console.log(`[NemoLore Vector Manager] Storing vector for message ${vector.messageId} in collection ${vector.collectionId}`);

            // Send to SillyTavern's vectorization API with collectionId
            const vectorItem = {
                text: vector.content,
                hash: vector.hash,
                collectionId: vector.collectionId, // Add collection organization
                metadata: {
                    chatId: vector.chatId,
                    collectionId: vector.collectionId,
                    messageId: vector.messageId,
                    role: vector.role,
                    timestamp: vector.timestamp,
                    character: vector.metadata?.character,
                    taskId: vector.metadata?.taskId,
                    source: 'nemolore'
                }
            };

            // Insert via ST's API (server-side vectorization)
            const result = await VectorAPIHelper.insertVectors([vectorItem]);

            if (result.success) {
                // Store in local IndexedDB cache for quick access
                const transaction = this.db.transaction([this.config.storeName], 'readwrite');
                const store = transaction.objectStore(this.config.storeName);
                const request = store.add(vector);

                request.onsuccess = () => {
                    const id = request.result;
                    vector.id = id;

                    // Update LRU cache
                    this.updateCache(vector);

                    console.log(`[NemoLore Vector Manager] ✅ Vector stored with ID: ${id} (collection: ${vector.collectionId})`);
                };

                request.onerror = () => {
                    console.error('[NemoLore Vector Manager] Failed to cache vector in IndexedDB:', {
                        error: request.error?.message || 'Unknown error',
                        vectorHash: vector.hash,
                        collectionId: vector.collectionId
                    });
                };
            } else {
                console.error('[NemoLore Vector Manager] Server-side vectorization failed:', {
                    error: result.error,
                    vectorHash: vector.hash,
                    contentLength: vector.content?.length || 0
                });
            }

        } catch (error) {
            console.error('[NemoLore Vector Manager] Vector storage failed:', {
                error: error.message,
                stack: error.stack,
                vectorHash: vector?.hash || 'unknown',
                collectionId: vector?.collectionId || 'unknown'
            });
        }
    }

    /**
     * Check if vector already exists
     */
    async vectorExists(hash) {
        if (!this.db) return false;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const store = transaction.objectStore(this.config.storeName);
            const index = store.index('hash');
            const request = index.get(hash);
            
            request.onsuccess = () => {
                resolve(!!request.result);
            };
            
            request.onerror = () => {
                resolve(false);
            };
        });
    }

    /**
     * Update LRU cache
     */
    updateCache(vector) {
        // Add to cache
        this.vectorCache.set(vector.id, vector);
        this.cacheOrder.push(vector.id);
        
        // Maintain cache size
        while (this.vectorCache.size > this.config.cacheSize) {
            const oldestId = this.cacheOrder.shift();
            this.vectorCache.delete(oldestId);
        }
    }

    /**
     * Search vectors by similarity using SillyTavern's API with optional reranking
     * @param {string} query - Search query text
     * @param {number} limit - Maximum results
     * @param {Object} options - Search options
     * @param {string} options.chatId - Filter by chat ID
     * @param {string} options.taskId - Filter by task ID
     * @param {string} options.collectionId - Filter by specific collection
     * @param {boolean} options.useReranking - Enable reranking (default: true)
     * @param {number} options.hybridAlpha - Reranking weight (default: 0.5)
     */
    async searchVectors(query, limit = 10, options = {}) {
        if (!this.isInitialized) return [];

        try {
            // Build collectionId if chatId and taskId provided
            let collectionId = options.collectionId;
            if (!collectionId && options.chatId) {
                collectionId = this.getCollectionId(options.chatId, options.taskId || 'chat');
            }

            // Use SillyTavern's server-side vector search
            const searchOptions = {
                limit,
                threshold: options.threshold || 0.1,
                ...options
            };

            // Add collectionId to filter results
            if (collectionId) {
                searchOptions.collectionId = collectionId;
            }

            let results = await VectorAPIHelper.queryVectors(query, searchOptions);

            console.log(`[NemoLore Vector Manager] Found ${results.length} results for query: "${query.substring(0, 50)}..." (collection: ${collectionId || 'all'})`);

            // Apply reranking if enabled (default: true)
            const useReranking = options.useReranking !== false;
            if (useReranking && results.length > 0) {
                results = await this.rerankService.rerank(query, results, {
                    hybridAlpha: options.hybridAlpha
                });
                console.log(`[NemoLore Vector Manager] Applied reranking to ${results.length} results`);
            }

            return results;

        } catch (error) {
            console.error('[NemoLore Vector Manager] Vector search failed:', error);
            return [];
        }
    }

    /**
     * Search vectors in cache
     */
    searchInCache(queryVector, limit) {
        const results = [];
        
        for (const [id, vector] of this.vectorCache) {
            if (vector.embedding) {
                const similarity = this.calculateSimilarity(queryVector, vector.embedding);
                results.push({ vector, similarity });
            }
        }
        
        // Sort by similarity and return top results
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(result => result.vector);
    }

    /**
     * Search vectors in database
     */
    async searchInDatabase(queryVector, limit) {
        if (!this.db) return [];
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const store = transaction.objectStore(this.config.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const vectors = request.result;
                const results = [];
                
                vectors.forEach(vector => {
                    if (vector.embedding) {
                        const similarity = this.calculateSimilarity(queryVector, vector.embedding);
                        results.push({ vector, similarity });
                    }
                });
                
                // Sort by similarity and return top results
                const topResults = results
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, limit)
                    .map(result => result.vector);
                
                resolve(topResults);
            };
            
            request.onerror = () => {
                console.error('[NemoLore Vector Manager] Database search failed:', request.error);
                resolve([]);
            };
        });
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    calculateSimilarity(vec1, vec2) {
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

    /**
     * Setup vector processing
     */
    setupVectorProcessing() {
        console.log('[NemoLore Vector Manager] Vector processing setup completed');
    }

    /**
     * Get vectors for a specific chat
     */
    async getVectorsForChat(chatId, limit = 100) {
        if (!this.db) return [];
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const store = transaction.objectStore(this.config.storeName);
            const index = store.index('chatId');
            const request = index.getAll(chatId);
            
            request.onsuccess = () => {
                const vectors = request.result
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, limit);
                resolve(vectors);
            };
            
            request.onerror = () => {
                console.error('[NemoLore Vector Manager] Failed to get vectors for chat:', request.error);
                resolve([]);
            };
        });
    }

    /**
     * Clear all vectors
     */
    async clearAllVectors() {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction([this.config.storeName], 'readwrite');
            const store = transaction.objectStore(this.config.storeName);
            await store.clear();
            
            // Clear cache
            this.vectorCache.clear();
            this.cacheOrder = [];
            
            console.log('[NemoLore Vector Manager] ✅ All vectors cleared');
            
        } catch (error) {
            console.error('[NemoLore Vector Manager] Failed to clear vectors:', error);
        }
    }

    /**
     * Get statistics
     */
    async getStatistics() {
        if (!this.db) return {};
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const store = transaction.objectStore(this.config.storeName);
            const countRequest = store.count();
            
            countRequest.onsuccess = () => {
                resolve({
                    totalVectors: countRequest.result,
                    cachedVectors: this.vectorCache.size,
                    cacheHitRate: 0, // Would need tracking to calculate
                    databaseSize: 0 // Would need additional queries to calculate
                });
            };
            
            countRequest.onerror = () => {
                resolve({});
            };
        });
    }

    /**
     * Get all collections for a chat
     * @param {string} chatId - Chat ID to get collections for
     * @returns {Promise<Array>} Array of collection objects with metadata
     */
    async getCollectionsForChat(chatId) {
        if (!this.db) return [];

        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.config.storeName], 'readonly');
            const store = transaction.objectStore(this.config.storeName);
            const index = store.index('chatId');
            const request = index.getAll(chatId);

            request.onsuccess = () => {
                const vectors = request.result;

                // Group by collectionId and gather stats
                const collections = {};
                vectors.forEach(vector => {
                    const collId = vector.collectionId || 'unknown';
                    if (!collections[collId]) {
                        collections[collId] = {
                            collectionId: collId,
                            chatId: chatId,
                            vectorCount: 0,
                            firstTimestamp: vector.timestamp,
                            lastTimestamp: vector.timestamp,
                            taskId: vector.metadata?.taskId || 'unknown'
                        };
                    }
                    collections[collId].vectorCount++;
                    collections[collId].firstTimestamp = Math.min(collections[collId].firstTimestamp, vector.timestamp);
                    collections[collId].lastTimestamp = Math.max(collections[collId].lastTimestamp, vector.timestamp);
                });

                resolve(Object.values(collections));
            };

            request.onerror = () => {
                console.error('[NemoLore Vector Manager] Failed to get collections:', request.error);
                resolve([]);
            };
        });
    }

    /**
     * Delete a specific collection
     * @param {string} collectionId - Collection ID to delete
     * @returns {Promise<boolean>} Success status
     */
    async deleteCollection(collectionId) {
        if (!this.db) return false;

        try {
            const transaction = this.db.transaction([this.config.storeName], 'readwrite');
            const store = transaction.objectStore(this.config.storeName);
            const index = store.index('collectionId');
            const request = index.openCursor(IDBKeyRange.only(collectionId));

            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`[NemoLore Vector Manager] ✅ Deleted ${deletedCount} vectors from collection: ${collectionId}`);
                }
            };

            return true;

        } catch (error) {
            console.error('[NemoLore Vector Manager] Failed to delete collection:', error);
            return false;
        }
    }

    /**
     * Shutdown and cleanup
     */
    async shutdown() {
        console.log('[NemoLore Vector Manager] Shutting down...');

        // Close database connection
        if (this.db) {
            this.db.close();
            this.db = null;
        }

        // Clear cache
        this.vectorCache.clear();
        this.cacheOrder = [];

        this.isInitialized = false;
        console.log('[NemoLore Vector Manager] ✅ Shutdown completed');
    }
}

console.log('[NemoLore Vector Manager] Module loaded - Enhanced IndexedDB system ready');