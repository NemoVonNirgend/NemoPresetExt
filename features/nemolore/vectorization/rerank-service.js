/**
 * Reranking Service - Hybrid Scoring for Better Search Results
 * Based on Vectors Enhanced implementation
 */

import { getRequestHeaders } from '../../../../../../../script.js';

/**
 * RerankService - Provides hybrid scoring by combining rerank scores with original scores
 * This improves search relevance by using specialized reranking models
 */
export class RerankService {
    constructor(settings = {}) {
        this.settings = settings;
        this.hybridAlpha = settings.hybridAlpha || 0.5; // Weight for hybrid scoring (0-1)
        this.enabled = settings.rerankEnabled !== false; // Default enabled
        this.endpoint = '/api/vector/rerank';
        this.isInitialized = false;
    }

    /**
     * Initialize the reranking service
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('[NemoLore Rerank Service] Initializing...');

        // Check if reranking API is available
        const available = await this.checkRerankAvailability();
        if (!available) {
            console.warn('[NemoLore Rerank Service] Reranking API not available, will use fallback');
            this.enabled = false;
        }

        this.isInitialized = true;
        console.log(`[NemoLore Rerank Service] ✅ Initialized (enabled: ${this.enabled})`);
    }

    /**
     * Check if reranking API is available
     */
    async checkRerankAvailability() {
        try {
            const response = await fetch('/api/vector/rerank', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    query: 'test',
                    results: []
                })
            });

            // If we get a 404, API doesn't exist
            if (response.status === 404) {
                return false;
            }

            // Any other status means the endpoint exists
            return true;

        } catch (error) {
            console.warn('[NemoLore Rerank Service] Could not check rerank availability:', error);
            return false;
        }
    }

    /**
     * Rerank search results using hybrid scoring
     * @param {string} query - Original search query
     * @param {Array} results - Search results to rerank
     * @param {Object} options - Reranking options
     * @returns {Promise<Array>} Reranked results with hybrid scores
     */
    async rerank(query, results, options = {}) {
        // If disabled or no results, return original
        if (!this.enabled || !results || results.length === 0) {
            return results;
        }

        try {
            const hybridAlpha = options.hybridAlpha ?? this.hybridAlpha;

            // Add index tracking for matching results
            const indexedResults = results.map((result, index) => ({
                ...result,
                _rerank_index: index,
                _original_score: result.score || 0
            }));

            // Call reranking API
            const rerankData = await this.callRerankAPI(query, indexedResults);

            if (!rerankData || !rerankData.results || rerankData.results.length === 0) {
                console.warn('[NemoLore Rerank Service] No rerank data, using original scores');
                return results;
            }

            // Process reranked results with hybrid scoring
            const rerankedResults = this._processRerankResponse(indexedResults, rerankData, hybridAlpha);

            console.log(`[NemoLore Rerank Service] ✅ Reranked ${rerankedResults.length} results (alpha: ${hybridAlpha})`);

            return rerankedResults;

        } catch (error) {
            console.error('[NemoLore Rerank Service] Reranking failed, using original scores:', error);
            return results;
        }
    }

    /**
     * Call the reranking API
     * @private
     */
    async callRerankAPI(query, results) {
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    query: query,
                    results: results.map(r => ({
                        text: r.text || r.content || '',
                        index: r._rerank_index
                    }))
                })
            });

            if (!response.ok) {
                throw new Error(`Rerank API error: ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            console.error('[NemoLore Rerank Service] API call failed:', error);
            return null;
        }
    }

    /**
     * Process rerank response and calculate hybrid scores
     * @private
     */
    _processRerankResponse(indexedResults, rerankData, hybridAlpha) {
        const rerankedResults = indexedResults.map((result, arrayIndex) => {
            let relevanceScore = 0;

            // Try multiple matching methods to find the rerank score
            const rerankedResult =
                // Match by index
                rerankData.results.find(r => r.index === result._rerank_index) ||
                // Match by array position
                rerankData.results[arrayIndex] ||
                // Last resort: use array position if lengths match
                (rerankData.results.length === indexedResults.length ? rerankData.results[arrayIndex] : null);

            if (rerankedResult && typeof rerankedResult.relevance_score === 'number') {
                relevanceScore = rerankedResult.relevance_score;
            }

            // Calculate hybrid score: weighted combination of rerank and original scores
            const originalScore = result._original_score || 0;
            const hybridScore = (relevanceScore * hybridAlpha) + (originalScore * (1 - hybridAlpha));

            // Clean up temporary properties and add scoring metadata
            const cleanResult = { ...result };
            delete cleanResult._rerank_index;
            delete cleanResult._original_score;

            return {
                ...cleanResult,
                score: hybridScore, // Replace score with hybrid score
                hybrid_score: hybridScore,
                rerank_score: relevanceScore,
                original_score: originalScore
            };
        });

        // Sort by hybrid score (descending)
        rerankedResults.sort((a, b) => (b.hybrid_score || 0) - (a.hybrid_score || 0));

        return rerankedResults;
    }

    /**
     * Set hybrid alpha value (weight for reranking vs original score)
     * @param {number} alpha - Value between 0 and 1
     */
    setHybridAlpha(alpha) {
        if (alpha < 0 || alpha > 1) {
            console.warn('[NemoLore Rerank Service] Invalid alpha value, must be 0-1');
            return;
        }
        this.hybridAlpha = alpha;
        console.log(`[NemoLore Rerank Service] Hybrid alpha set to: ${alpha}`);
    }

    /**
     * Enable or disable reranking
     * @param {boolean} enabled - Enable state
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`[NemoLore Rerank Service] Reranking ${enabled ? 'enabled' : 'disabled'}`);
    }
}

console.log('[NemoLore Rerank Service] Module loaded');
