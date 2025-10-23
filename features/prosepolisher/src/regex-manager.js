import { state } from './state.js';
import { LOG_PREFIX } from './constants.js';
import { ErrorHandler } from './error-handler.js';

/**
 * Manages compiled regex patterns for efficient reuse
 */
class RegexManager {
    constructor() {
        this.compiledRegexCache = new Map();
        this.randomOptionsCache = new Map();
    }

    /**
     * Gets a compiled regex for a rule, using cache if available
     */
    getCompiledRegex(rule) {
        const cacheKey = `${rule.id || rule.scriptName}_${rule.findRegex}`;

        if (!this.compiledRegexCache.has(cacheKey)) {
            try {
                const regex = new RegExp(rule.findRegex, 'gi');
                this.compiledRegexCache.set(cacheKey, regex);
            } catch (e) {
                ErrorHandler.logWarning('getCompiledRegex', `Invalid regex in rule '${rule.scriptName}', skipping`, { error: e.message });
                this.compiledRegexCache.set(cacheKey, null);
            }
        }

        return this.compiledRegexCache.get(cacheKey);
    }

    /**
     * Gets parsed random options for a rule, using cache if available
     */
    getRandomOptions(rule) {
        const cacheKey = `${rule.id || rule.scriptName}_${rule.replaceString}`;

        if (!this.randomOptionsCache.has(cacheKey)) {
            if (rule.replaceString.includes('{{random:')) {
                const optionsMatch = rule.replaceString.match(/\{\{random:([\s\S]+?)\}\}/);
                if (optionsMatch && optionsMatch[1]) {
                    const options = optionsMatch[1].split(',').map(opt => opt.trim());
                    this.randomOptionsCache.set(cacheKey, options);
                } else {
                    this.randomOptionsCache.set(cacheKey, null);
                }
            } else {
                this.randomOptionsCache.set(cacheKey, null);
            }
        }

        return this.randomOptionsCache.get(cacheKey);
    }

    /**
     * Clears the regex cache (call when rules change)
     */
    clearCache() {
        this.compiledRegexCache.clear();
        this.randomOptionsCache.clear();
    }

    /**
     * Applies replacements efficiently using cached regexes
     */
    applyReplacements(text, rules) {
        if (!text) return text;
        let replacedText = text;

        for (const rule of rules) {
            const regex = this.getCompiledRegex(rule);
            if (!regex) continue;

            const randomOptions = this.getRandomOptions(rule);

            if (randomOptions) {
                replacedText = replacedText.replace(regex, (match, ...args) => {
                    const chosenOption = randomOptions[Math.floor(Math.random() * randomOptions.length)];
                    return chosenOption.replace(/\$(\d)/g, (_, groupIndex) => args[parseInt(groupIndex) - 1] || '');
                });
            } else {
                replacedText = replacedText.replace(regex, rule.replaceString);
            }
        }

        return replacedText;
    }

    /**
     * Gets all compiled regexes for the given rules
     */
    getCompiledRegexes(rules) {
        return rules.map(rule => this.getCompiledRegex(rule)).filter(Boolean);
    }
}

// Export singleton instance
export const regexManager = new RegexManager();