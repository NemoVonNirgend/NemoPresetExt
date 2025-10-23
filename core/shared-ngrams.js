/**
 * Shared N-gram Analysis - Integration Opportunity 3.5
 * Enhanced pattern detection across NemoLore and ProsePolisher
 */

/**
 * SharedNgramAnalyzer - Advanced n-gram analysis for cross-system insights
 * Coordinates between NemoLore summaries and ProsePolisher frequency data
 */
class SharedNgramAnalyzer {
    constructor() {
        /** @type {Map<string, Object>} */
        this.crossSystemPatterns = new Map();

        /** @type {Map<string, Set<string>>} */
        this.summaryPhrases = new Map(); // Maps summary IDs to phrase sets

        this.isInitialized = false;

        console.log('[Shared N-grams] Analyzer created');
    }

    /**
     * Initialize the analyzer
     */
    initialize() {
        if (this.isInitialized) return;

        console.log('[Shared N-grams] Initializing enhanced n-gram analyzer...');

        this.isInitialized = true;
        console.log('[Shared N-grams] ✅ Initialized successfully');
    }

    /**
     * Extract n-grams from text
     * @param {string} text - Text to analyze
     * @param {number} minN - Minimum n-gram size (default: 2)
     * @param {number} maxN - Maximum n-gram size (default: 10)
     * @returns {Array<string>} Array of n-grams
     */
    extractNgrams(text, minN = 2, maxN = 10) {
        if (!text) return [];

        // Clean and tokenize
        const cleaned = text
            .toLowerCase()
            .replace(/[^\w\s'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const words = cleaned.split(' ').filter(w => w.length > 0);
        const ngrams = [];

        // Generate n-grams of different sizes
        for (let n = minN; n <= Math.min(maxN, words.length); n++) {
            for (let i = 0; i <= words.length - n; i++) {
                const ngram = words.slice(i, i + n).join(' ');
                if (ngram.length > 0) {
                    ngrams.push(ngram);
                }
            }
        }

        return ngrams;
    }

    /**
     * Analyze a summary in context of ProsePolisher frequency data
     * @param {string} summaryText - The summary text to analyze
     * @param {string} summaryId - Unique identifier for this summary
     * @param {Object} options - Analysis options
     * @returns {Object} Analysis results
     */
    analyzeSummary(summaryText, summaryId, options = {}) {
        if (!summaryText) {
            return {
                phrases: [],
                highFrequency: [],
                patterns: [],
                quality: 'unknown'
            };
        }

        const minN = options.minN || 2;
        const maxN = options.maxN || 10;
        const frequencyThreshold = options.frequencyThreshold || 5.0;

        // Extract n-grams from summary
        const ngrams = this.extractNgrams(summaryText, minN, maxN);

        // Store summary phrases for future cross-reference
        this.summaryPhrases.set(summaryId, new Set(ngrams));

        // Get ProsePolisher frequency data if available
        const analyzer = window.prosePolisherState?.prosePolisherAnalyzer;
        const highFrequencyPhrases = [];
        const allPhrases = [];

        if (analyzer && analyzer.ngramFrequencies) {
            for (const ngram of ngrams) {
                const freqData = analyzer.ngramFrequencies.get(ngram.toLowerCase());

                if (freqData) {
                    const phraseData = {
                        phrase: ngram,
                        score: freqData.score || 0,
                        count: freqData.count || 1,
                        positions: freqData.positions || []
                    };

                    allPhrases.push(phraseData);

                    if (freqData.score >= frequencyThreshold) {
                        highFrequencyPhrases.push(phraseData);
                    }
                }
            }
        }

        // Sort by score
        highFrequencyPhrases.sort((a, b) => b.score - a.score);
        allPhrases.sort((a, b) => b.score - a.score);

        // Detect patterns
        const patterns = this.detectPatterns(highFrequencyPhrases);

        // Calculate quality based on phrase repetition
        const quality = this.calculateSummaryQuality(allPhrases);

        // Store cross-system pattern data
        if (highFrequencyPhrases.length > 0) {
            for (const phrase of highFrequencyPhrases) {
                this.recordCrossSystemPattern(phrase.phrase, summaryId, phrase.score);
            }
        }

        return {
            phrases: allPhrases.slice(0, 10), // Top 10
            highFrequency: highFrequencyPhrases,
            patterns: patterns,
            quality: quality,
            summaryId: summaryId
        };
    }

    /**
     * Detect patterns in high-frequency phrases
     * @private
     * @param {Array<Object>} phrases - High-frequency phrases with scores
     * @returns {Array<Object>} Detected patterns
     */
    detectPatterns(phrases) {
        if (phrases.length === 0) return [];

        const patterns = [];

        // Pattern 1: Repeated Character Names
        const names = phrases.filter(p => {
            const words = p.phrase.split(' ');
            return words.length === 1 && words[0].length > 0 && /^[A-Z]/.test(p.phrase);
        });

        if (names.length > 0) {
            patterns.push({
                type: 'character_names',
                description: 'Recurring character names',
                phrases: names.map(n => n.phrase),
                avgScore: names.reduce((sum, n) => sum + n.score, 0) / names.length
            });
        }

        // Pattern 2: Repeated Actions
        const actions = phrases.filter(p =>
            /\b(walked|ran|looked|said|took|gave|went|came|saw)\b/.test(p.phrase)
        );

        if (actions.length > 0) {
            patterns.push({
                type: 'repeated_actions',
                description: 'Repeated action phrases',
                phrases: actions.map(a => a.phrase).slice(0, 5),
                avgScore: actions.reduce((sum, a) => sum + a.score, 0) / actions.length
            });
        }

        // Pattern 3: Relationship Phrases
        const relationships = phrases.filter(p =>
            /\b(with|and|between|to)\b/.test(p.phrase) && p.phrase.split(' ').length >= 3
        );

        if (relationships.length > 0) {
            patterns.push({
                type: 'relationships',
                description: 'Character relationship phrases',
                phrases: relationships.map(r => r.phrase).slice(0, 5),
                avgScore: relationships.reduce((sum, r) => sum + r.score, 0) / relationships.length
            });
        }

        // Pattern 4: Location References
        const locations = phrases.filter(p =>
            /\b(in|at|on|the|room|place|house|city|town|forest|castle)\b/.test(p.phrase)
        );

        if (locations.length > 0) {
            patterns.push({
                type: 'locations',
                description: 'Recurring location references',
                phrases: locations.map(l => l.phrase).slice(0, 5),
                avgScore: locations.reduce((sum, l) => sum + l.score, 0) / locations.length
            });
        }

        return patterns;
    }

    /**
     * Calculate summary quality based on phrase analysis
     * @private
     * @param {Array<Object>} phrases - All phrases with scores
     * @returns {string} Quality rating
     */
    calculateSummaryQuality(phrases) {
        if (phrases.length === 0) return 'unknown';

        // Calculate average score
        const avgScore = phrases.reduce((sum, p) => sum + p.score, 0) / phrases.length;

        // Count high-repetition phrases
        const highRepCount = phrases.filter(p => p.score > 8.0).length;

        // Determine quality
        if (highRepCount >= 3 || avgScore > 10) {
            return 'poor'; // Too repetitive
        } else if (highRepCount >= 2 || avgScore > 7) {
            return 'medium'; // Some repetition
        } else if (avgScore > 4) {
            return 'good'; // Acceptable
        } else {
            return 'excellent'; // Low repetition
        }
    }

    /**
     * Record a pattern that appears in both systems
     * @private
     * @param {string} phrase - The phrase
     * @param {string} summaryId - Summary ID where phrase appears
     * @param {number} score - Frequency score from ProsePolisher
     */
    recordCrossSystemPattern(phrase, summaryId, score) {
        if (!this.crossSystemPatterns.has(phrase)) {
            this.crossSystemPatterns.set(phrase, {
                phrase: phrase,
                summaries: new Set(),
                maxScore: 0,
                firstSeen: Date.now(),
                lastSeen: Date.now()
            });
        }

        const pattern = this.crossSystemPatterns.get(phrase);
        pattern.summaries.add(summaryId);
        pattern.maxScore = Math.max(pattern.maxScore, score);
        pattern.lastSeen = Date.now();
    }

    /**
     * Get all cross-system patterns
     * @param {Object} options - Filter options
     * @returns {Array<Object>} Cross-system patterns
     */
    getCrossSystemPatterns(options = {}) {
        const minSummaries = options.minSummaries || 2;
        const minScore = options.minScore || 5.0;

        const patterns = [];

        for (const pattern of this.crossSystemPatterns.values()) {
            if (pattern.summaries.size >= minSummaries && pattern.maxScore >= minScore) {
                patterns.push({
                    phrase: pattern.phrase,
                    summaryCount: pattern.summaries.size,
                    maxScore: pattern.maxScore,
                    firstSeen: pattern.firstSeen,
                    lastSeen: pattern.lastSeen,
                    timespan: pattern.lastSeen - pattern.firstSeen
                });
            }
        }

        // Sort by a combination of summary count and score
        patterns.sort((a, b) => {
            const aWeight = a.summaryCount * a.maxScore;
            const bWeight = b.summaryCount * b.maxScore;
            return bWeight - aWeight;
        });

        return patterns;
    }

    /**
     * Get patterns specific to a summary
     * @param {string} summaryId - Summary identifier
     * @returns {Array<string>} Phrases in this summary
     */
    getSummaryPhrases(summaryId) {
        const phrases = this.summaryPhrases.get(summaryId);
        return phrases ? Array.from(phrases) : [];
    }

    /**
     * Find summaries containing a specific phrase
     * @param {string} phrase - Phrase to search for
     * @returns {Array<string>} Summary IDs containing this phrase
     */
    findSummariesWithPhrase(phrase) {
        const summaries = [];

        for (const [summaryId, phrases] of this.summaryPhrases.entries()) {
            if (phrases.has(phrase.toLowerCase())) {
                summaries.push(summaryId);
            }
        }

        return summaries;
    }

    /**
     * Get statistics about n-gram analysis
     * @returns {Object} Statistics
     */
    getStats() {
        const stats = {
            totalSummaries: this.summaryPhrases.size,
            totalCrossSystemPatterns: this.crossSystemPatterns.size,
            byPattern: {}
        };

        // Count patterns by frequency
        const patternFrequencies = {};

        for (const pattern of this.crossSystemPatterns.values()) {
            const frequency = pattern.summaries.size;
            patternFrequencies[frequency] = (patternFrequencies[frequency] || 0) + 1;
        }

        stats.byPattern = patternFrequencies;

        return stats;
    }

    /**
     * Clear all stored data
     */
    clear() {
        this.crossSystemPatterns.clear();
        this.summaryPhrases.clear();
        console.log('[Shared N-grams] Data cleared');
    }

    /**
     * Export data for persistence
     * @returns {Object} Export data
     */
    export() {
        const patterns = Array.from(this.crossSystemPatterns.values()).map(p => ({
            phrase: p.phrase,
            summaries: Array.from(p.summaries),
            maxScore: p.maxScore,
            firstSeen: p.firstSeen,
            lastSeen: p.lastSeen
        }));

        const summaries = Array.from(this.summaryPhrases.entries()).map(([id, phrases]) => ({
            id: id,
            phrases: Array.from(phrases)
        }));

        return {
            patterns: patterns,
            summaries: summaries,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Import data from export
     * @param {Object} data - Import data
     * @returns {boolean} Success status
     */
    import(data) {
        if (!data || !data.patterns || !data.summaries) {
            console.warn('[Shared N-grams] Invalid import data');
            return false;
        }

        try {
            // Import patterns
            for (const p of data.patterns) {
                this.crossSystemPatterns.set(p.phrase, {
                    phrase: p.phrase,
                    summaries: new Set(p.summaries),
                    maxScore: p.maxScore,
                    firstSeen: p.firstSeen,
                    lastSeen: p.lastSeen
                });
            }

            // Import summary phrases
            for (const s of data.summaries) {
                this.summaryPhrases.set(s.id, new Set(s.phrases));
            }

            console.log(`[Shared N-grams] Imported ${data.patterns.length} patterns and ${data.summaries.length} summaries`);
            return true;

        } catch (error) {
            console.error('[Shared N-grams] Import failed:', error);
            return false;
        }
    }
}

// Create global singleton instance
const sharedNgramAnalyzer = new SharedNgramAnalyzer();

// Make it available globally
if (typeof window !== 'undefined') {
    window.nemoPresetSharedNgrams = sharedNgramAnalyzer;
}

// Export for module use
export default sharedNgramAnalyzer;

console.log('[Shared N-grams] ✅ Module loaded - Ready for enhanced analysis');
