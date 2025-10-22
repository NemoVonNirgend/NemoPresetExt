/**
 * Shared Names Manager - Integration Opportunity 1.1
 * Combines ProsePolisher's comprehensive name database with NemoLore's noun highlighting
 */

// Import ProsePolisher's default names
import { defaultNames } from '../features/prosepolisher/src/default_names.js';

/**
 * SharedNamesManager - Central registry for character/entity names
 * Used by both NemoLore (noun highlighting) and ProsePolisher (whitelist)
 */
class SharedNamesManager {
    constructor() {
        /** @type {Set<string>} */
        this.defaultNames = new Set();

        /** @type {Set<string>} */
        this.extractedNames = new Set();

        /** @type {Set<string>} */
        this.userDefinedNames = new Set();

        this.isInitialized = false;
    }

    /**
     * Initialize the shared names manager
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('[Shared Names] Initializing with ProsePolisher name database...');

        // Load ProsePolisher's comprehensive name database (1000+ names)
        if (defaultNames && defaultNames.size > 0) {
            this.defaultNames = new Set(defaultNames);
            console.log(`[Shared Names] ✅ Loaded ${this.defaultNames.size} default names from ProsePolisher`);
        } else {
            console.warn('[Shared Names] ProsePolisher defaultNames not available, using fallback');
            this.loadFallbackNames();
        }

        // Extract names from current chat
        await this.extractNamesFromChat();

        this.isInitialized = true;
        console.log('[Shared Names] ✅ Initialization complete');
    }

    /**
     * Load fallback names if ProsePolisher not available
     * @private
     */
    loadFallbackNames() {
        const fallbackNames = [
            'john', 'mary', 'james', 'sarah', 'michael', 'emma', 'david', 'olivia',
            'alice', 'bob', 'charlie', 'diana', 'eve', 'frank', 'grace', 'henry'
        ];

        for (const name of fallbackNames) {
            this.defaultNames.add(name.toLowerCase());
        }

        console.log(`[Shared Names] Loaded ${fallbackNames.length} fallback names`);
    }

    /**
     * Extract character names from current chat
     */
    async extractNamesFromChat() {
        try {
            // Try to get character name from SillyTavern
            if (typeof window !== 'undefined' && window.getContext) {
                const context = window.getContext();

                // Add active character name
                if (context?.name2) {
                    this.extractedNames.add(context.name2.toLowerCase());
                }

                // Add user name
                if (context?.name1) {
                    this.extractedNames.add(context.name1.toLowerCase());
                }

                // Extract names from chat messages using capitalization heuristics
                if (context?.chat && Array.isArray(context.chat)) {
                    for (const message of context.chat) {
                        if (message.mes) {
                            this.extractCapitalizedWords(message.mes);
                        }
                    }
                }

                console.log(`[Shared Names] ✅ Extracted ${this.extractedNames.size} names from chat`);
            }
        } catch (error) {
            console.warn('[Shared Names] Failed to extract names from chat:', error);
        }
    }

    /**
     * Extract capitalized words (potential names) from text
     * @private
     */
    extractCapitalizedWords(text) {
        // Match capitalized words (2-20 characters, not at start of sentence)
        const regex = /(?<!\.\s)(?<!\?  )\b([A-Z][a-z]{1,19})\b/g;
        const matches = text.match(regex);

        if (matches) {
            for (const match of matches) {
                const normalized = match.toLowerCase();

                // Skip common words
                if (this.isCommonWord(normalized)) {
                    continue;
                }

                this.extractedNames.add(normalized);
            }
        }
    }

    /**
     * Check if word is a common English word (not a name)
     * @private
     */
    isCommonWord(word) {
        const commonWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
            'i', 'he', 'she', 'it', 'they', 'we', 'you', 'me', 'him', 'her', 'them',
            'his', 'hers', 'its', 'their', 'our', 'your', 'this', 'that', 'these', 'those'
        ]);

        return commonWords.has(word.toLowerCase());
    }

    /**
     * Check if a word is a known name
     * @param {string} word - Word to check
     * @returns {boolean} True if word is a known name
     */
    isName(word) {
        const normalized = word.toLowerCase();

        return (
            this.defaultNames.has(normalized) ||
            this.extractedNames.has(normalized) ||
            this.userDefinedNames.has(normalized)
        );
    }

    /**
     * Add a user-defined name
     * @param {string} name - Name to add
     */
    addName(name) {
        if (!name || typeof name !== 'string') return;

        this.userDefinedNames.add(name.toLowerCase());
        console.log(`[Shared Names] Added user-defined name: ${name}`);
    }

    /**
     * Remove a user-defined name
     * @param {string} name - Name to remove
     */
    removeName(name) {
        if (!name) return;

        this.userDefinedNames.delete(name.toLowerCase());
        console.log(`[Shared Names] Removed user-defined name: ${name}`);
    }

    /**
     * Get all known names (combined from all sources)
     * @returns {Set<string>} Set of all known names
     */
    getAllNames() {
        const allNames = new Set();

        // Combine all sources
        for (const name of this.defaultNames) allNames.add(name);
        for (const name of this.extractedNames) allNames.add(name);
        for (const name of this.userDefinedNames) allNames.add(name);

        return allNames;
    }

    /**
     * Get whitelist for ProsePolisher (all names should be whitelisted)
     * @returns {Array<string>} Array of names for whitelist
     */
    getProsePolisherWhitelist() {
        return Array.from(this.getAllNames());
    }

    /**
     * Get excluded words for NemoLore noun highlighting
     * @returns {Set<string>} Set of names to exclude from highlighting
     */
    getNemoLoreExclusions() {
        return this.getAllNames();
    }

    /**
     * Refresh extracted names from current chat
     */
    async refresh() {
        this.extractedNames.clear();
        await this.extractNamesFromChat();
        console.log('[Shared Names] ✅ Refreshed name database');
    }

    /**
     * Get statistics about the name database
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            defaultNames: this.defaultNames.size,
            extractedNames: this.extractedNames.size,
            userDefinedNames: this.userDefinedNames.size,
            totalNames: this.getAllNames().size
        };
    }

    /**
     * Export all names to JSON
     * @returns {Object} Export data
     */
    export() {
        return {
            defaultNames: Array.from(this.defaultNames),
            extractedNames: Array.from(this.extractedNames),
            userDefinedNames: Array.from(this.userDefinedNames),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import names from JSON
     * @param {Object} data - Import data
     */
    import(data) {
        if (!data) return;

        if (data.userDefinedNames && Array.isArray(data.userDefinedNames)) {
            this.userDefinedNames = new Set(data.userDefinedNames.map(n => n.toLowerCase()));
            console.log(`[Shared Names] Imported ${this.userDefinedNames.size} user-defined names`);
        }
    }
}

// Create global singleton instance
const sharedNamesManager = new SharedNamesManager();

// Make it available globally
if (typeof window !== 'undefined') {
    window.nemoPresetSharedNames = sharedNamesManager;
}

// Export for module use
export default sharedNamesManager;

console.log('[Shared Names] ✅ Module loaded - Ready for integration');
