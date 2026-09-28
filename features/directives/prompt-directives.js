/** Public directive API: cached metadata views over the unchanged language rules. */
import * as rules from './prompt-directive-rules.js';
import { promptManager } from '../../../../../openai.js';
import { createDirectiveFacade } from '../prompt-performance/metadata-index.js';

const facade = createDirectiveFacade(rules, () => promptManager?.serviceSettings?.prompts || []);
export const parsePromptDirectives = facade.parsePromptDirectives;
export const clearDirectiveCache = facade.clearDirectiveCache;
export const validatePromptActivation = facade.validatePromptActivation;
export const evaluateMessageTriggers = facade.evaluateMessageTriggers;
export const syncPromptMetadata = facade.sync;
export const getPromptMetadataStats = () => facade.index.diagnostics();
export const DIRECTIVE_DOCUMENTATION = rules.DIRECTIVE_DOCUMENTATION;
export const getCurrentMessageCount = rules.getCurrentMessageCount;

export function getAllPromptsWithState() {
    if (!promptManager) return [];
    const index = facade.sync(true);
    const order = promptManager.getPromptOrderForCharacter(promptManager.activeCharacter) || [];
    const states = new Map(order.map(entry => [entry.identifier, entry.enabled]));
    return [...index.byId.values()].map(prompt => ({
        identifier: prompt.identifier,
        name: prompt.name,
        content: prompt.content,
        enabled: states.has(prompt.identifier) ? Boolean(states.get(prompt.identifier)) : true,
        role: prompt.role,
        system_prompt: prompt.system_prompt,
    }));
}
