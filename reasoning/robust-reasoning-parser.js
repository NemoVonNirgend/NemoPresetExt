/**
 * Robust Reasoning Parser for SillyTavern
 *
 * Multi-strategy parser that reliably captures reasoning blocks even when:
 * - Closing tags are missing
 * - Opening tags are incomplete
 * - Content is malformed
 * - Reasoning appears mid-stream
 *
 * Designed specifically for complex CoT prompts like NemoNet
 */

export class RobustReasoningParser {
    constructor(config = {}) {
        this.config = {
            // Primary patterns
            prefix: config.prefix || '<think>',
            suffix: config.suffix || '</think>',

            // Fallback patterns
            alternativePrefixes: config.alternativePrefixes || ['<think', '<thought>', '<thinking>'],
            alternativeSuffixes: config.alternativeSuffixes || ['</think', '</thought>', '</thinking>'],

            // Content markers that indicate reasoning
            reasoningMarkers: config.reasoningMarkers || [
                'NEMONET WORLD EXPLORATION',
                'Council of Vex',
                'NemoAdmin-107',
                'STORY SECTION',
                'Exploration',
                'GATHERING THE THREADS',
                'SCENE CALIBRATION',
                'COUNCIL CONVERSATION',
                'RESOLUTION',
                'CRAFTING',
                'Custom CoT',
                'FINAL REVIEW',
                'END OF THINKING',
                'CLOSING THINKING NOW'
            ],

            // Narration markers that indicate reasoning has ended
            narrationMarkers: config.narrationMarkers || [
                'Narration:',
                'NARRATION FOLLOWS',
                '{{newline}}'
            ],

            // Strategy weights (higher = more trusted)
            strategyWeights: {
                perfectMatch: 100,
                partialSuffix: 80,
                missingSuffix: 70,
                contentBased: 60,
                heuristic: 50
            }
        };

        this.debug = config.debug || false;
    }

    /**
     * Main parsing function with cascading strategies
     * Returns: { reasoning: string, content: string, strategy: string, confidence: number }
     */
    parse(text) {
        const strategies = [
            this.strategyPerfectMatch.bind(this),
            this.strategyPartialSuffix.bind(this),
            this.strategyMissingSuffix.bind(this),
            this.strategyContentMarkers.bind(this),
            this.strategyHeuristic.bind(this)
        ];

        for (const strategy of strategies) {
            const result = strategy(text);
            if (result && result.reasoning) {
                if (this.debug) {
                    console.log('RobustReasoningParser: Success with', result.strategy,
                                'Confidence:', result.confidence);
                }
                return result;
            }
        }

        // No reasoning found
        return {
            reasoning: '',
            content: text,
            strategy: 'none',
            confidence: 0
        };
    }

    /**
     * Strategy 1: Perfect Match (prefix + suffix both present)
     */
    strategyPerfectMatch(text) {
        const { prefix, suffix } = this.config;

        // Try exact match first
        const exactRegex = new RegExp(
            `${this.escapeRegex(prefix)}(.*?)${this.escapeRegex(suffix)}`,
            's'
        );

        const match = text.match(exactRegex);
        if (match) {
            const reasoning = match[1].trim();
            const beforeReasoning = text.substring(0, match.index);
            const afterReasoning = text.substring(match.index + match[0].length);
            const content = (beforeReasoning + afterReasoning).trim();

            return {
                reasoning,
                content,
                strategy: 'perfectMatch',
                confidence: this.config.strategyWeights.perfectMatch
            };
        }

        // Try alternative prefixes/suffixes
        for (const altPrefix of this.config.alternativePrefixes) {
            for (const altSuffix of this.config.alternativeSuffixes) {
                const altRegex = new RegExp(
                    `${this.escapeRegex(altPrefix)}(.*?)${this.escapeRegex(altSuffix)}`,
                    's'
                );
                const altMatch = text.match(altRegex);
                if (altMatch) {
                    const reasoning = altMatch[1].trim();
                    const beforeReasoning = text.substring(0, altMatch.index);
                    const afterReasoning = text.substring(altMatch.index + altMatch[0].length);
                    const content = (beforeReasoning + afterReasoning).trim();

                    return {
                        reasoning,
                        content,
                        strategy: 'perfectMatch-alternative',
                        confidence: this.config.strategyWeights.perfectMatch - 5
                    };
                }
            }
        }

        return null;
    }

    /**
     * Strategy 2: Partial Suffix (has prefix, suffix is incomplete)
     */
    strategyPartialSuffix(text) {
        const { prefix, suffix } = this.config;

        const prefixIndex = text.indexOf(prefix);
        if (prefixIndex === -1) return null;

        // Look for partial suffix (e.g., "</thin" instead of "</think>")
        const partialSuffixes = this.generatePartialSuffixes(suffix);

        for (const partial of partialSuffixes) {
            const partialIndex = text.indexOf(partial, prefixIndex + prefix.length);
            if (partialIndex !== -1) {
                const reasoning = text.substring(
                    prefixIndex + prefix.length,
                    partialIndex
                ).trim();

                const content = (
                    text.substring(0, prefixIndex) +
                    text.substring(partialIndex + partial.length)
                ).trim();

                return {
                    reasoning,
                    content,
                    strategy: 'partialSuffix',
                    confidence: this.config.strategyWeights.partialSuffix
                };
            }
        }

        return null;
    }

    /**
     * Strategy 3: Missing Suffix (has prefix but no suffix)
     * Uses content markers and narration markers to find the end
     */
    strategyMissingSuffix(text) {
        const { prefix } = this.config;

        const prefixIndex = text.indexOf(prefix);
        if (prefixIndex === -1) return null;

        let endIndex = -1;

        // Method 1: Look for narration markers
        const textAfterPrefix = text.substring(prefixIndex + prefix.length);
        for (const marker of this.config.narrationMarkers) {
            const markerIndex = textAfterPrefix.indexOf(marker);
            if (markerIndex !== -1) {
                endIndex = prefixIndex + prefix.length + markerIndex;
                break;
            }
        }

        // Method 2: Look for "END OF THINKING" or similar
        if (endIndex === -1) {
            const endThinkingRegex = /END OF THINKING.*?(?:\n|$)/i;
            const endMatch = textAfterPrefix.match(endThinkingRegex);
            if (endMatch) {
                endIndex = prefixIndex + prefix.length + endMatch.index + endMatch[0].length;
            }
        }

        // Method 3: Look for double newline followed by non-reasoning content
        if (endIndex === -1) {
            const doubleNewlineRegex = /\n\n+(?![A-Z_\s]*:|\*|♢|◆|═)/;
            const doubleNewlineMatch = textAfterPrefix.match(doubleNewlineRegex);
            if (doubleNewlineMatch) {
                endIndex = prefixIndex + prefix.length + doubleNewlineMatch.index;
            }
        }

        // Method 4: Use the entire remaining text
        if (endIndex === -1) {
            endIndex = text.length;
        }

        const reasoning = text.substring(prefixIndex + prefix.length, endIndex).trim();
        const content = (text.substring(0, prefixIndex) + text.substring(endIndex)).trim();

        return {
            reasoning,
            content,
            strategy: 'missingSuffix',
            confidence: this.config.strategyWeights.missingSuffix
        };
    }

    /**
     * Strategy 4: Content-Based Detection
     * Identifies reasoning by looking for specific content markers
     */
    strategyContentMarkers(text) {
        // Check if text contains multiple reasoning markers
        let markerCount = 0;
        let firstMarkerIndex = -1;

        for (const marker of this.config.reasoningMarkers) {
            if (text.includes(marker)) {
                markerCount++;
                const index = text.indexOf(marker);
                if (firstMarkerIndex === -1 || index < firstMarkerIndex) {
                    firstMarkerIndex = index;
                }
            }
        }

        // Need at least 3 markers to be confident this is reasoning
        if (markerCount < 3) return null;

        // Find the end using narration markers
        let endIndex = -1;
        for (const marker of this.config.narrationMarkers) {
            const markerIndex = text.indexOf(marker);
            if (markerIndex !== -1 && markerIndex > firstMarkerIndex) {
                endIndex = markerIndex;
                break;
            }
        }

        if (endIndex === -1) {
            // Fallback: use the entire text as reasoning
            return {
                reasoning: text.trim(),
                content: '',
                strategy: 'contentMarkers-full',
                confidence: this.config.strategyWeights.contentBased - 10
            };
        }

        const reasoning = text.substring(firstMarkerIndex, endIndex).trim();
        const content = (text.substring(0, firstMarkerIndex) + text.substring(endIndex)).trim();

        return {
            reasoning,
            content,
            strategy: 'contentMarkers',
            confidence: this.config.strategyWeights.contentBased
        };
    }

    /**
     * Strategy 5: Heuristic Detection
     * Last resort: Use structural patterns to guess where reasoning ends
     */
    strategyHeuristic(text) {
        // Look for CoT-like structure:
        // - Multiple sections with headers (═══, ---, etc.)
        // - Bullet points and lists
        // - Meta-commentary (brackets, parentheses)
        // - Then transition to narrative prose

        const hasStructure = this.detectStructuredThinking(text);
        if (!hasStructure) return null;

        // Try to find the transition point
        const lines = text.split('\n');
        let transitionIndex = -1;

        for (let i = 0; i < lines.length - 1; i++) {
            const currentLine = lines[i];
            const nextLine = lines[i + 1];

            // Look for transition from structured to narrative
            if (this.isStructuredLine(currentLine) && this.isNarrativeLine(nextLine)) {
                transitionIndex = i;
                break;
            }
        }

        if (transitionIndex === -1) {
            // No clear transition found
            return null;
        }

        const reasoning = lines.slice(0, transitionIndex + 1).join('\n').trim();
        const content = lines.slice(transitionIndex + 1).join('\n').trim();

        return {
            reasoning,
            content,
            strategy: 'heuristic',
            confidence: this.config.strategyWeights.heuristic
        };
    }

    // Helper Methods

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    generatePartialSuffixes(suffix) {
        const partials = [];
        // Generate all substrings from length 2 to length-1
        for (let i = 2; i < suffix.length; i++) {
            partials.push(suffix.substring(0, i));
        }
        return partials.reverse(); // Try longer matches first
    }

    detectStructuredThinking(text) {
        const structureMarkers = [
            /═{3,}/,  // Box drawing
            /─{3,}/,  // Horizontal lines
            /^[♢◆●○]\s/m,  // Bullet points
            /^\d+\./m,  // Numbered lists
            /^[A-Z_\s]+:/m,  // Section headers
            /\[.*?\]/,  // Bracketed notes
        ];

        let markerCount = 0;
        for (const marker of structureMarkers) {
            if (marker.test(text)) markerCount++;
        }

        return markerCount >= 2;
    }

    isStructuredLine(line) {
        const patterns = [
            /^[♢◆●○]\s/,  // Bullet
            /^[A-Z_\s]+:/,  // Header
            /═{3,}|─{3,}/,  // Lines
            /^\d+\./,  // Numbered
            /^\s*-\s/,  // Dash bullet
            /^\[.*?\]/,  // Brackets
            /^<.*?>/,  // Tags
        ];

        return patterns.some(p => p.test(line.trim()));
    }

    isNarrativeLine(line) {
        const trimmed = line.trim();

        // Must be prose-like (starts with capital, has multiple words, ends with punctuation)
        if (!/^[A-Z]/.test(trimmed)) return false;
        if (trimmed.split(/\s+/).length < 3) return false;
        if (!/[.!?"\)]$/.test(trimmed)) return false;

        // Should NOT have structural markers
        if (this.isStructuredLine(line)) return false;

        return true;
    }
}

/**
 * Integration with existing SillyTavern reasoning system
 */
export function enhanceReasoningParsing() {
    // Get the existing parseReasoningFromString function
    const originalParse = window.SillyTavern?.parseReasoningFromString;

    if (!originalParse) {
        console.warn('RobustReasoningParser: Could not find original parseReasoningFromString');
        return;
    }

    // Create parser instance with current settings
    const parser = new RobustReasoningParser({
        prefix: window.power_user?.reasoning?.prefix || '<think>',
        suffix: window.power_user?.reasoning?.suffix || '</think>',
        debug: false
    });

    // Replace the parsing function
    window.SillyTavern.parseReasoningFromString = function(str, options = {}) {
        // Try original method first (for backward compatibility)
        const originalResult = originalParse(str, options);

        if (originalResult && originalResult.reasoning) {
            return originalResult;
        }

        // Fall back to robust parser
        const robustResult = parser.parse(str);

        if (robustResult.confidence > 50) {
            return {
                reasoning: robustResult.reasoning,
                content: robustResult.content
            };
        }

        // No reasoning found
        return null;
    };

    console.log('RobustReasoningParser: Enhanced reasoning parsing enabled');
}

/**
 * Auto-initialization when loaded
 */
if (typeof window !== 'undefined') {
    // Wait for SillyTavern to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(enhanceReasoningParsing, 1000);
        });
    } else {
        setTimeout(enhanceReasoningParsing, 1000);
    }
}
