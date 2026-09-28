/** Shared metadata index. No startup rescan, timed expiry, or full-body Map keys. */
import { promptManager } from '../../../../openai.js';
import {
    clearDirectiveCache as clearParsedDirectives,
    syncPromptMetadata,
    getPromptMetadataStats,
} from '../features/directives/prompt-directives.js';

let cacheVersion = 0;
let initialized = false;

export function initializeDirectiveCache() {
    if (!promptManager?.serviceSettings?.prompts) return;
    syncPromptMetadata(true);
    initialized = true;
    cacheVersion++;
}

export function getCachedDirectives(identifier) {
    const index = syncPromptMetadata();
    const prompt = index.byId.get(identifier);
    return prompt ? index.get(prompt).directives : null;
}

export function getAllCachedDirectives() {
    const index = syncPromptMetadata(true);
    return new Map([...index.byId].map(([id, prompt]) => [id, index.get(prompt).directives]));
}

export function invalidateCacheForPrompt(identifier) {
    const index = syncPromptMetadata(true);
    const prompt = index.byId.get(identifier);
    if (prompt) index.records.delete(prompt);
    cacheVersion++;
}

export function clearDirectiveCache() {
    clearParsedDirectives();
    initialized = false;
    cacheVersion++;
}

export function getPromptMetadataList() {
    if (!promptManager?.serviceSettings?.prompts) return [];
    const index = syncPromptMetadata(true);
    const order = promptManager.getPromptOrderForCharacter(promptManager.activeCharacter) || [];
    const states = new Map(order.map(entry => [entry.identifier, Boolean(entry.enabled)]));
    return [...index.byId.values()].map(prompt => index.view(prompt, states.get(prompt.identifier) || false));
}

export function getPromptContentOnDemand(identifier) {
    return syncPromptMetadata().byId.get(identifier)?.content || null;
}

export function getCacheStats() {
    const stats = getPromptMetadataStats();
    return { size: stats.indexedPrompts, initialized, version: cacheVersion, ...stats };
}
