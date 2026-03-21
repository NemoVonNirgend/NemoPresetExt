/**
 * Guides Setup — Parallel initialization for fresh chats.
 * Uses ApiRouter to run Rule Setup, Scene Assessment, and DM Notes
 * simultaneously via the ConnectionPool, instead of sequential tool calls.
 *
 * This runs BEFORE the main generation on the first message, so the AI
 * sees all trackers already populated and can write its response normally.
 */

import { getContext } from '../../../../../extensions.js';
import { ApiRouter } from '../connection/api-router.js';
import { ConnectionPool } from '../connection/connection-pool.js';
import { DEFAULT_PROMPTS } from './prompts.js';
import { updateTracker } from './lorebook-manager.js';
import { getToolSettings } from './tool-registry.js';
import { notifyToolStart, notifyToolComplete } from './activity-feed.js';

const LOG_PREFIX = '[NemosGuides:Setup]';

/**
 * Get character card data for prompt building.
 */
function getCharacterCardData() {
    const context = getContext();
    if (!context?.characters || context.characterId === undefined) return null;

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
    };
}

/**
 * Build context block from character card + recent messages.
 */
function buildContextBlock() {
    const context = getContext();
    const cardData = getCharacterCardData();
    const charName = context.name2 || 'Character';
    const userName = context.name1 || 'User';
    const chat = context.chat || [];

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

    // Recent messages
    const recent = chat.slice(-10);
    const recentMessages = recent
        .filter(msg => !msg.is_system)
        .map(msg => {
            const name = msg.is_user ? userName : charName;
            const text = (msg.mes || '').substring(0, 500);
            return `${name}: ${text}`;
        })
        .join('\n');

    if (recentMessages) {
        contextBlock += `\n\n## Recent Messages\n${recentMessages}`;
    }

    return { contextBlock, charName, userName };
}

/**
 * Auto-register the current API settings as a connection.
 * Reads from ST's DOM selectors to detect the active provider, model, and URLs.
 */
function autoRegisterCurrentApi() {
    const sourceSelect = document.getElementById('chat_completion_source');
    if (!sourceSelect) return null;

    const source = sourceSelect.value;
    if (!source) return null;

    // Find the current model from the model selector for this source
    let model = '';
    const modelSelectors = {
        openai: '#model_openai_select',
        claude: '#model_claude_select',
        openrouter: '#model_openrouter_select',
        makersuite: '#model_google_select',
        ai21: '#model_ai21_select',
        mistralai: '#model_mistralai_select',
        cohere: '#model_cohere_select',
        perplexity: '#model_perplexity_select',
        groq: '#model_groq_select',
        deepseek: '#model_deepseek_select',
        xai: '#model_xai_select',
        custom: '#custom_model_id',
    };

    const selectorId = modelSelectors[source];
    if (selectorId) {
        const modelSelect = document.querySelector(selectorId);
        model = modelSelect?.value || '';
    }

    // Fallback: try the generic model display
    if (!model) {
        const modelDisplay = document.querySelector('.nemo-model-chip-text, #model_display');
        model = modelDisplay?.textContent?.trim() || source;
    }

    if (!model) return null;

    // Gather provider-specific URLs from the DOM
    const extras = {};

    // Custom source URL
    if (source === 'custom') {
        const urlInput = document.getElementById('custom_api_url_text')
            || document.getElementById('custom_api_url');
        if (urlInput?.value) extras.customUrl = urlInput.value;
    }

    // Reverse proxy (used by OpenAI, Claude, OpenRouter when proxied)
    const reverseProxy = document.getElementById('openai_reverse_proxy');
    if (reverseProxy?.value) extras.reverseProxy = reverseProxy.value;

    const connectionId = `ng_auto_${source}`;
    ConnectionPool.register({
        id: connectionId,
        source,
        model,
        label: `${model} (auto-detected)`,
        priority: 5,
        enabled: true,
        tags: ['auto', 'smart'],
        ...extras,
    });

    console.log(`${LOG_PREFIX} Auto-registered connection: ${source}/${model}`, extras);
    return connectionId;
}

/**
 * Find a usable connection for sidecar generation.
 * Always auto-registers from current API settings to stay in sync
 * with whatever the user has selected.
 */
function getConnectionId(toolName) {
    // Always auto-register from current DOM state to pick up API/model changes
    return autoRegisterCurrentApi();
}

/**
 * Build messages array for ApiRouter from a prompt string.
 */
function buildMessages(systemPrompt, userPrompt) {
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
}

/**
 * Run the parallel fresh-chat setup.
 * Fires Rule Setup, Scene Assessment (all), and DM Notes init simultaneously.
 * Results are written to lorebook trackers before the main generation.
 *
 * @returns {Promise<boolean>} True if setup completed (even partially)
 */
export async function runFreshChatSetup() {
    console.log(`${LOG_PREFIX} Starting parallel fresh-chat setup...`);

    const connectionId = getConnectionId('NG_rule_setup');
    if (!connectionId) {
        console.warn(`${LOG_PREFIX} No connections available in pool. Falling back to tool calls.`);
        return false;
    }

    const { contextBlock, charName, userName } = buildContextBlock();

    // Build prompts for all three tasks
    const ruleSettings = getToolSettings('NG_rule_setup');
    const rulePrompt = (ruleSettings.prompt || DEFAULT_PROMPTS.rule_setup)
        .replace('{{CONTEXT}}', contextBlock)
        .replace('{{FOCUS}}', '')
        .replace('{{CHAR_NAME}}', charName)
        .replace('{{USER_NAME}}', userName);

    const scenePrompt = `${DEFAULT_PROMPTS.scene_situation.replace('{{FOCUS}}', '')}\n\nAlso assess:\n- Character clothing and appearance\n- Character positions and physical states\n- What characters are thinking\n\nProvide all four aspects in labeled sections:\n## Situation\n## Clothing\n## Positions\n## Thinking\n\nContext:\n${contextBlock}`;

    const dmInitPrompt = `[OOC: Initialize a narrative scratchpad for this story. Based on the opening scene and character card, create initial entries for:\n\n♢ Plot Threads\nList 2-3 potential storylines suggested by the opening.\n\n♢ Off-Screen Events\nWhat might NPCs or the world be doing outside the current scene?\n\n♢ Character Arcs\nWhat development trajectories are suggested for the main characters?\n\n♢ Foreshadowing Seeds\nAny narrative seeds that could pay off later.\n\n♢ Session Notes\nKey initial facts established.\n\n♢ Narrative Direction\nWhere the story might naturally head from here.\n\nContext:\n${contextBlock}]`;

    // Notify activity feed
    const ruleFeedId = notifyToolStart('NG_rule_setup', { mode: 'parallel-setup' });
    const sceneFeedId = notifyToolStart('NG_scene_assessment', { aspects: ['all'], mode: 'parallel-setup' });
    const dmFeedId = notifyToolStart('NG_dm_notes', { action: 'init', mode: 'parallel-setup' });

    const apiParams = { max_tokens: 2000, temperature: 0.7 };

    try {
        // Fire all three in parallel
        const [ruleResult, sceneResult, dmResult] = await Promise.allSettled([
            ApiRouter.send(connectionId, buildMessages(
                'You are a story architect. Analyze the source material and produce a system prompt governing this story.',
                rulePrompt,
            ), apiParams),
            ApiRouter.send(connectionId, buildMessages(
                'You are a scene analyst. Assess the current scene state accurately and concisely.',
                scenePrompt,
            ), { ...apiParams, max_tokens: 1000 }),
            ApiRouter.send(connectionId, buildMessages(
                'You are a narrative planner. Initialize story tracking notes based on the opening scene.',
                dmInitPrompt,
            ), { ...apiParams, max_tokens: 1000 }),
        ]);

        // Process Rule Setup result
        if (ruleResult.status === 'fulfilled' && ruleResult.value.text) {
            const ruleText = ruleResult.value.text;
            await updateTracker('rules', ruleText);

            // Extract narrator personality if present
            const narratorMatch = ruleText.match(/♢ Narrator Personality[\s\S]*?(?=♢ [A-Z]|$)/);
            if (narratorMatch) {
                await updateTracker('narrator', narratorMatch[0].trim());
            }

            notifyToolComplete(ruleFeedId, true, `${ruleText.length} chars`, { fullResult: ruleText, storedIn: ['Lorebook: rules', 'Lorebook: narrator'] });
            console.log(`${LOG_PREFIX} Rule Setup complete (${ruleText.length} chars)`);
        } else {
            const err = ruleResult.status === 'rejected' ? ruleResult.reason?.message : ruleResult.value?.error;
            notifyToolComplete(ruleFeedId, false, err || 'Failed');
            console.error(`${LOG_PREFIX} Rule Setup failed:`, err);
        }

        // Process Scene Assessment result
        if (sceneResult.status === 'fulfilled' && sceneResult.value.text) {
            const sceneText = sceneResult.value.text;

            // Parse sections and write to individual trackers
            const sections = parseSceneSections(sceneText);
            const writes = [];
            if (sections.situation) writes.push(updateTracker('situation', sections.situation));
            if (sections.clothing) writes.push(updateTracker('clothing', sections.clothing));
            if (sections.positions) writes.push(updateTracker('positions', sections.positions));
            if (sections.thinking) writes.push(updateTracker('thinking', sections.thinking));

            // If no sections parsed, write the whole thing as situation
            if (writes.length === 0) {
                writes.push(updateTracker('situation', sceneText));
            }

            await Promise.all(writes);

            notifyToolComplete(sceneFeedId, true, `${sceneText.length} chars`, {
                fullResult: sceneText,
                storedIn: ['Lorebook: situation', 'Lorebook: clothing', 'Lorebook: positions', 'Lorebook: thinking'],
            });
            console.log(`${LOG_PREFIX} Scene Assessment complete (${sceneText.length} chars, ${writes.length} trackers)`);
        } else {
            const err = sceneResult.status === 'rejected' ? sceneResult.reason?.message : sceneResult.value?.error;
            notifyToolComplete(sceneFeedId, false, err || 'Failed');
            console.error(`${LOG_PREFIX} Scene Assessment failed:`, err);
        }

        // Process DM Notes result
        if (dmResult.status === 'fulfilled' && dmResult.value.text) {
            const dmText = dmResult.value.text;
            await updateTracker('dm_notes', dmText);

            notifyToolComplete(dmFeedId, true, `${dmText.length} chars`, { fullResult: dmText, storedIn: ['Lorebook: dm_notes'] });
            console.log(`${LOG_PREFIX} DM Notes init complete (${dmText.length} chars)`);
        } else {
            const err = dmResult.status === 'rejected' ? dmResult.reason?.message : dmResult.value?.error;
            notifyToolComplete(dmFeedId, false, err || 'Failed');
            console.error(`${LOG_PREFIX} DM Notes init failed:`, err);
        }

        console.log(`${LOG_PREFIX} Parallel fresh-chat setup complete.`);
        return true;
    } catch (error) {
        console.error(`${LOG_PREFIX} Parallel setup failed:`, error);
        notifyToolComplete(ruleFeedId, false, error.message);
        notifyToolComplete(sceneFeedId, false, error.message);
        notifyToolComplete(dmFeedId, false, error.message);
        return false;
    }
}

/**
 * Parse scene assessment output into individual tracker sections.
 */
function parseSceneSections(text) {
    const sections = {};
    const patterns = {
        situation: /##?\s*Situation\s*\n([\s\S]*?)(?=##?\s*(?:Clothing|Positions|Thinking)|$)/i,
        clothing: /##?\s*Clothing\s*\n([\s\S]*?)(?=##?\s*(?:Situation|Positions|Thinking)|$)/i,
        positions: /##?\s*Positions\s*\n([\s\S]*?)(?=##?\s*(?:Situation|Clothing|Thinking)|$)/i,
        thinking: /##?\s*Thinking\s*\n([\s\S]*?)(?=##?\s*(?:Situation|Clothing|Positions)|$)/i,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
        const match = text.match(pattern);
        if (match && match[1]?.trim()) {
            sections[key] = match[1].trim();
        }
    }

    return sections;
}
