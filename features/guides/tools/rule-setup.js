/**
 * Rule Setup
 * Reads the character card, greeting, and all available context on a fresh chat,
 * then generates a genre-appropriate supporting system prompt ("story rules").
 * Stored as a persistent lorebook entry that stays active for the entire conversation.
 *
 * Can be triggered:
 *   - Automatically on first message of a new chat
 *   - Manually via the NG_rule_setup tool call
 *   - Via the settings panel "Generate Rules" button
 */

import { getContext } from '../../../../../../extensions.js';
import { runSidecarGeneration, gatherContext } from '../sidecar.js';
import { DEFAULT_PROMPTS } from '../prompts.js';
import { getToolSettings } from '../tool-registry.js';
import { updateTracker, getTrackerContent } from '../lorebook-manager.js';
import { getTVWorldContext } from '../tv-bridge.js';

export const TOOL_NAME = 'NG_rule_setup';

export function getDefinition() {
    const settings = getToolSettings(TOOL_NAME);
    return {
        name: TOOL_NAME,
        displayName: 'Rule Setup',
        description: `Analyze the character card, scenario, and opening context to generate a supporting system prompt with story rules tailored to the genre, tone, and setting. This creates persistent narrative guidelines that help maintain consistency throughout the conversation. Use this at the start of a new chat, or when the story's direction has shifted significantly and the rules need updating.`,
        parameters: {
            type: 'object',
            properties: {
                focus: {
                    type: 'string',
                    description: 'Optional: specific genre, tone, or thematic focus to emphasize in the rules',
                },
                refresh: {
                    type: 'boolean',
                    description: 'If true, regenerate rules even if they already exist for this chat',
                },
            },
            required: [],
        },
        action: execute,
        formatMessage: (params) => `Setting up story rules${params?.focus ? ` (focus: ${params.focus})` : ''}...`,
        shouldRegister: () => getToolSettings(TOOL_NAME).enabled,
        stealth: settings.stealth,
    };
}

/**
 * Extract character card data from the current context.
 * @returns {object} Character info
 */
function getCharacterCardData() {
    const context = getContext();

    if (!context?.characters || context.characterId === undefined) {
        return null;
    }

    const char = context.characters[context.characterId];
    if (!char) return null;

    return {
        name: char.name || context.name2 || 'Character',
        description: char.description || '',
        personality: char.personality || '',
        scenario: char.scenario || '',
        firstMessage: char.first_mes || '',
        mesExample: char.mes_example || '',
        creatorNotes: char.data?.creator_notes || '',
        systemPrompt: char.data?.system_prompt || '',
        tags: char.tags || [],
    };
}

async function execute({ focus, refresh } = {}) {
    const settings = getToolSettings(TOOL_NAME);

    // Check if rules already exist for this chat (skip if not refreshing)
    if (!refresh) {
        const existing = await getTrackerContent('rules');
        if (existing && existing.length > 50) {
            return `Story rules are already established for this chat. Use refresh=true to regenerate them.\n\nCurrent rules:\n${existing}`;
        }
    }

    // Gather all available context
    const cardData = getCharacterCardData();
    const { recentMessages, charName, userName } = gatherContext(10);

    // Build comprehensive context for rule generation
    let contextBlock = '';

    if (cardData) {
        contextBlock += `\n## Character Card: ${cardData.name}`;
        if (cardData.description) contextBlock += `\n### Description\n${cardData.description}`;
        if (cardData.personality) contextBlock += `\n### Personality\n${cardData.personality}`;
        if (cardData.scenario) contextBlock += `\n### Scenario\n${cardData.scenario}`;
        if (cardData.firstMessage) contextBlock += `\n### Opening Message\n${cardData.firstMessage.substring(0, 1000)}`;
        if (cardData.mesExample) contextBlock += `\n### Example Messages\n${cardData.mesExample.substring(0, 500)}`;
        if (cardData.creatorNotes) contextBlock += `\n### Creator Notes\n${cardData.creatorNotes.substring(0, 500)}`;
        if (cardData.systemPrompt) contextBlock += `\n### Card System Prompt\n${cardData.systemPrompt.substring(0, 500)}`;
    }

    if (recentMessages) {
        contextBlock += `\n\n## Recent Messages\n${recentMessages}`;
    }

    // Pull world context from TunnelVision's lorebooks if available
    try {
        const tvContext = await getTVWorldContext();
        if (tvContext) {
            contextBlock += `\n\n${tvContext}`;
        }
    } catch { /* TV not available */ }

    const template = settings.prompt || DEFAULT_PROMPTS.rule_setup;
    const prompt = template
        .replace('{{CONTEXT}}', contextBlock)
        .replace('{{FOCUS}}', focus ? `\nSpecific focus requested: ${focus}` : '')
        .replace('{{CHAR_NAME}}', charName)
        .replace('{{USER_NAME}}', userName);

    const result = await runSidecarGeneration({
        prompt,
        preset: settings.preset || undefined,
        toolName: TOOL_NAME,
        toolParams: { focus },
    });

    // Extract narrator personality section if present, save it separately
    const narratorMatch = result.match(/♢ Narrator Personality[\s\S]*?(?=♢ [A-Z]|$)/);
    if (narratorMatch) {
        const narratorContent = narratorMatch[0].trim();
        await updateTracker('narrator', narratorContent);
        console.log('[NemosGuides] Saved narrator personality to separate tracker.');
    }

    // Store full rules as persistent lorebook entry
    const success = await updateTracker('rules', result);
    if (!success) {
        console.warn('[NemosGuides] Could not write rules to lorebook tracker.');
    }

    // Return full content so it's visible in the tool call result
    return `Story rules generated and saved.\n\n${result}`;
}

/**
 * Auto-generate rules for a fresh chat.
 * Called from index.js on new chat detection.
 * @returns {Promise<void>}
 */
export async function autoGenerateRules() {
    const settings = getToolSettings(TOOL_NAME);
    if (!settings.enabled) return;

    console.log('[NemosGuides] Auto-generating story rules for fresh chat...');
    await execute({ refresh: true });
}
