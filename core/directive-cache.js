/**
 * Directive Metadata Cache
 * Parses and caches directive metadata for all prompts to avoid repeated parsing.
 * This significantly improves performance by parsing content once and reusing.
 *
 * @module directive-cache
 */

import logger from './logger.js';
import { parsePromptDirectives } from '../features/directives/prompt-directives.js';
import { promptManager } from '../../../../openai.js';

// Cache storage
let directiveMetadataCache = new Map();
let cacheInitialized = false;
let cacheVersion = 0;

/**
 * Initialize the directive cache by parsing all prompts once
 * Call this on startup and when prompts are modified
 */
export function initializeDirectiveCache() {
    if (!promptManager?.serviceSettings?.prompts) {
        logger.debug('Directive cache: promptManager not ready, skipping initialization');
        return;
    }

    const startTime = performance.now();
    const prompts = promptManager.serviceSettings.prompts;

    directiveMetadataCache.clear();

    for (const prompt of prompts) {
        if (!prompt.identifier || !prompt.content) continue;

        try {
            const directives = parsePromptDirectives(prompt.content);

            // Store only the metadata we need for UI, not the full content
            directiveMetadataCache.set(prompt.identifier, {
                tooltip: directives.tooltip || null,
                badge: directives.badge || null,
                color: directives.color || null,
                highlight: directives.highlight || false,
                icon: directives.icon || null,
                categories: directives.categories || [],
                tags: directives.tags || [],
                group: directives.group || null,
                deprecated: directives.deprecated || null,
                warning: directives.warning || null,
                advanced: directives.advanced || false,
                recommendedForBeginners: directives.recommendedForBeginners || false,
                // Store directive-based dependencies for validation
                requires: directives.requires || [],
                exclusiveWith: directives.exclusiveWith || [],
                conflictsWith: directives.conflictsWith || [],
                autoDisable: directives.autoDisable || [],
            });
        } catch (e) {
            logger.warn(`Failed to parse directives for prompt ${prompt.identifier}:`, e);
        }
    }

    cacheVersion++;
    cacheInitialized = true;

    const elapsed = performance.now() - startTime;
    logger.info(`Directive cache initialized: ${directiveMetadataCache.size} prompts cached in ${elapsed.toFixed(2)}ms`);
}

/**
 * Get cached directive metadata for a prompt
 * @param {string} identifier - The prompt identifier
 * @returns {Object|null} Cached directives or null if not found
 */
export function getCachedDirectives(identifier) {
    if (!cacheInitialized) {
        initializeDirectiveCache();
    }
    return directiveMetadataCache.get(identifier) || null;
}

/**
 * Get all cached directive metadata
 * @returns {Map} The full cache map
 */
export function getAllCachedDirectives() {
    if (!cacheInitialized) {
        initializeDirectiveCache();
    }
    return directiveMetadataCache;
}

/**
 * Invalidate cache for a specific prompt (call when prompt is edited)
 * @param {string} identifier - The prompt identifier
 */
export function invalidateCacheForPrompt(identifier) {
    if (!promptManager?.serviceSettings?.prompts) return;

    const prompt = promptManager.serviceSettings.prompts.find(p => p.identifier === identifier);
    if (prompt?.content) {
        try {
            const directives = parsePromptDirectives(prompt.content);
            directiveMetadataCache.set(identifier, {
                tooltip: directives.tooltip || null,
                badge: directives.badge || null,
                color: directives.color || null,
                highlight: directives.highlight || false,
                icon: directives.icon || null,
                categories: directives.categories || [],
                tags: directives.tags || [],
                group: directives.group || null,
                deprecated: directives.deprecated || null,
                warning: directives.warning || null,
                advanced: directives.advanced || false,
                recommendedForBeginners: directives.recommendedForBeginners || false,
                requires: directives.requires || [],
                exclusiveWith: directives.exclusiveWith || [],
                conflictsWith: directives.conflictsWith || [],
                autoDisable: directives.autoDisable || [],
            });
            cacheVersion++;
            logger.debug(`Directive cache updated for prompt: ${identifier}`);
        } catch (e) {
            logger.warn(`Failed to update cache for prompt ${identifier}:`, e);
        }
    }
}

/**
 * Clear the entire cache (call when preset changes)
 */
export function clearDirectiveCache() {
    directiveMetadataCache.clear();
    cacheInitialized = false;
    cacheVersion++;
    logger.debug('Directive cache cleared');
}

/**
 * Get prompt metadata without full content (lightweight)
 * Uses cached directives instead of re-parsing
 * @returns {Array} Array of prompt metadata objects
 */
export function getPromptMetadataList() {
    if (!promptManager?.serviceSettings?.prompts) return [];

    if (!cacheInitialized) {
        initializeDirectiveCache();
    }

    const prompts = promptManager.serviceSettings.prompts;
    const activeCharacter = promptManager.activeCharacter;

    return prompts.map(prompt => {
        const cachedDirectives = directiveMetadataCache.get(prompt.identifier) || {};

        // Get enabled state
        let isEnabled = false;
        try {
            const promptOrderEntry = promptManager.getPromptOrderEntry(activeCharacter, prompt.identifier);
            isEnabled = promptOrderEntry?.enabled || false;
        } catch (e) {
            isEnabled = !promptManager.isPromptDisabledForActiveCharacter(prompt.identifier);
        }

        return {
            identifier: prompt.identifier,
            name: prompt.name,
            isEnabled,
            // Include cached directive metadata
            tooltip: cachedDirectives.tooltip,
            badge: cachedDirectives.badge,
            color: cachedDirectives.color,
            highlight: cachedDirectives.highlight,
            categories: cachedDirectives.categories,
            tags: cachedDirectives.tags,
            group: cachedDirectives.group,
            // Note: No full content included - fetch on demand if needed
        };
    });
}

/**
 * Get full prompt content on demand (for editing/preview)
 * @param {string} identifier - The prompt identifier
 * @returns {string|null} The prompt content or null
 */
export function getPromptContentOnDemand(identifier) {
    if (!promptManager?.serviceSettings?.prompts) return null;

    const prompt = promptManager.serviceSettings.prompts.find(p => p.identifier === identifier);
    return prompt?.content || null;
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
    return {
        size: directiveMetadataCache.size,
        initialized: cacheInitialized,
        version: cacheVersion
    };
}
