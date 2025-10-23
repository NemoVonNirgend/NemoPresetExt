/**
 * Historical Message Cleanup System
 * Removes HTML/CSS from older messages (2+ messages back) while preserving text content
 * Integrates with ProsePolisher regex system
 */

export class HistoricalCleanup {
    constructor() {
        this.minMessageAge = 2; // Only process messages 2+ positions back
        this.isEnabled = true;
        this.debugMode = false;
    }

    /**
     * Initialize the historical cleanup system
     */
    async initialize() {
        if (this.debugMode) {
            console.log('[HistoricalCleanup] Initializing...');
        }

        // Wait for ProsePolisher to be ready
        await this.waitForProsePolisher();

        if (this.debugMode) {
            console.log('[HistoricalCleanup] Ready');
        }
    }

    /**
     * Wait for ProsePolisher to be available
     */
    async waitForProsePolisher() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (window.ProsePolisher && window.ProsePolisher.regexManager) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                console.warn('[HistoricalCleanup] ProsePolisher not found, continuing anyway');
                resolve();
            }, 10000);
        });
    }

    /**
     * Process chat messages to clean up HTML/CSS from historical messages
     * @param {Array} messages - Array of chat messages
     * @returns {Array} - Processed messages
     */
    processMessages(messages) {
        if (!this.isEnabled || !messages || messages.length === 0) {
            return messages;
        }

        const processedMessages = [...messages];
        const currentIndex = messages.length - 1;

        // Process messages that are 2+ positions back from current
        for (let i = 0; i < currentIndex - this.minMessageAge + 1; i++) {
            if (processedMessages[i] && processedMessages[i].mes) {
                processedMessages[i].mes = this.cleanupMessage(processedMessages[i].mes);
            }
        }

        return processedMessages;
    }

    /**
     * Clean up a single message by removing HTML/CSS while preserving text
     * @param {string} content - Message content
     * @returns {string} - Cleaned content
     */
    cleanupMessage(content) {
        if (!content || typeof content !== 'string') {
            return content;
        }

        let cleaned = content;

        // Apply HTML/CSS cleanup regex patterns
        const cleanupPatterns = this.getCleanupPatterns();

        for (const pattern of cleanupPatterns) {
            try {
                cleaned = cleaned.replace(pattern.regex, pattern.replacement);
            } catch (error) {
                if (this.debugMode) {
                    console.error('[HistoricalCleanup] Error applying pattern:', pattern.name, error);
                }
            }
        }

        // Post-processing: clean up excessive whitespace
        cleaned = this.normalizeWhitespace(cleaned);

        return cleaned;
    }

    /**
     * Get regex patterns for cleanup from ProsePolisher
     * @returns {Array} - Array of {regex, replacement, name} objects
     */
    getCleanupPatterns() {
        const patterns = [];

        // Try to get patterns from ProsePolisher
        if (window.ProsePolisher && window.ProsePolisher.regexManager) {
            const regexManager = window.ProsePolisher.regexManager;
            const ruleIds = [
                'STATIC_052', // HTML tags with content preservation
                'STATIC_053', // Inline style attributes
                'STATIC_054', // CSS style blocks
                'STATIC_055', // Script tags and content
                'STATIC_056', // HTML comments
                'STATIC_057', // Class and ID attributes
                'STATIC_058', // Data attributes
                'STATIC_059', // Orphaned closing tags
                'STATIC_060', // Self-closing tags
                'STATIC_061'  // HTML entities (preserve common ones)
            ];

            for (const ruleId of ruleIds) {
                const rule = regexManager.getRule(ruleId);
                if (rule && rule.pattern) {
                    patterns.push({
                        regex: new RegExp(rule.pattern, rule.flags || 'gi'),
                        replacement: rule.replacement || '',
                        name: ruleId
                    });
                }
            }
        }

        // Fallback patterns if ProsePolisher isn't available
        if (patterns.length === 0) {
            patterns.push(
                {
                    regex: /<style\b[^>]*>[\s\S]*?<\/style>/gi,
                    replacement: '',
                    name: 'CSS_BLOCKS'
                },
                {
                    regex: /<script\b[^>]*>[\s\S]*?<\/script>/gi,
                    replacement: '',
                    name: 'SCRIPT_BLOCKS'
                },
                {
                    regex: /<!--[\s\S]*?-->/g,
                    replacement: '',
                    name: 'HTML_COMMENTS'
                },
                {
                    regex: /<([a-z][a-z0-9]*)\b[^>]*>([\s\S]*?)<\/\1>/gi,
                    replacement: '$2',
                    name: 'HTML_TAGS'
                },
                {
                    regex: /\s+style\s*=\s*["'][^"']*["']/gi,
                    replacement: '',
                    name: 'INLINE_STYLES'
                },
                {
                    regex: /\s+class\s*=\s*["'][^"']*["']/gi,
                    replacement: '',
                    name: 'CLASS_ATTRS'
                },
                {
                    regex: /<[^>]+>/g,
                    replacement: '',
                    name: 'REMAINING_TAGS'
                }
            );
        }

        return patterns;
    }

    /**
     * Normalize whitespace in cleaned content
     * @param {string} text - Text to normalize
     * @returns {string} - Normalized text
     */
    normalizeWhitespace(text) {
        return text
            .replace(/[ \t]+/g, ' ')           // Multiple spaces/tabs to single space
            .replace(/\n{3,}/g, '\n\n')        // Max 2 consecutive newlines
            .replace(/^\s+/gm, '')             // Trim line starts
            .replace(/\s+$/gm, '')             // Trim line ends
            .trim();                           // Trim overall
    }

    /**
     * Check if a message should be processed based on its position
     * @param {number} messageIndex - Index of the message
     * @param {number} totalMessages - Total number of messages
     * @returns {boolean} - True if should be processed
     */
    shouldProcessMessage(messageIndex, totalMessages) {
        const currentIndex = totalMessages - 1;
        const messagesFromCurrent = currentIndex - messageIndex;
        return messagesFromCurrent >= this.minMessageAge;
    }

    /**
     * Enable or disable the cleanup system
     * @param {boolean} enabled - Whether to enable
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (this.debugMode) {
            console.log(`[HistoricalCleanup] ${enabled ? 'Enabled' : 'Disabled'}`);
        }
    }

    /**
     * Set the minimum message age for processing
     * @param {number} age - Minimum age in message positions
     */
    setMinMessageAge(age) {
        this.minMessageAge = Math.max(0, age);
        if (this.debugMode) {
            console.log(`[HistoricalCleanup] Min message age set to ${this.minMessageAge}`);
        }
    }

    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether to enable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }

    /**
     * Test the cleanup on sample content
     * @param {string} content - Content to test
     * @returns {Object} - Before and after results
     */
    testCleanup(content) {
        const before = content;
        const after = this.cleanupMessage(content);
        const patterns = this.getCleanupPatterns();

        return {
            before,
            after,
            patternsUsed: patterns.length,
            lengthBefore: before.length,
            lengthAfter: after.length,
            reduction: ((before.length - after.length) / before.length * 100).toFixed(2) + '%'
        };
    }
}

// Create global instance
window.HistoricalCleanup = new HistoricalCleanup();

// Export for module usage
export default HistoricalCleanup;