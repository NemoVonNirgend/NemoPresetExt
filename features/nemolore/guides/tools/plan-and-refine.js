/**
 * Plan & Refine Tool
 * Consolidated planning pipeline — plan, brainstorm, refine.
 * Modes: "plan", "brainstorm", "refine", or "full" (runs entire pipeline).
 */

import { getContext } from '../../../../../../../extensions.js';
import { runSidecarGeneration, gatherContext, getChatVar, setChatVar, getToolInjectionConfig } from '../sidecar.js';
import { DEFAULT_PROMPTS } from '../prompts.js';
import { getGuidesSettings, getToolSettings } from '../tool-registry.js';
import { getTrackerContent } from '../lorebook-manager.js';
import {
    getNemoStackPresetLabel,
    runNemoStackPipeline,
    validateNemoStackPreset,
} from '../../shared/model-service.js';

export const TOOL_NAME = 'NLG_plan_and_refine';

const VALID_MODES = ['plan', 'brainstorm', 'refine', 'full'];
const NEMOSTACK_CHAT_LIMIT = 40;

export function getDefinition() {
    return {
        name: TOOL_NAME,
        displayName: 'Plan & Refine',
        description: `Plan, brainstorm, and refine your response. Modes:
- "plan": Create a structural blueprint — emotional beats, key actions, dialogue themes, sensory details. Use for pivotal narrative moments.
- "brainstorm": Generate 3-5 creative ideas and angles. Use when you want fresh inspiration or to break predictable patterns.
- "refine": Audit and improve an existing plan for character consistency, lore adherence, and quality. Automatically uses the current plan if none provided.
- "full": Run the complete pipeline (Plan → Brainstorm → Refine) in one call. Best for important scenes where you want maximum quality.`,
        parameters: {
            type: 'object',
            properties: {
                mode: {
                    type: 'string',
                    enum: VALID_MODES,
                    description: 'Pipeline mode: "plan", "brainstorm", "refine", or "full"',
                },
                direction: {
                    type: 'string',
                    description: 'For plan/full mode: what the response should accomplish — emotional goals, plot progression, tone',
                },
                topic: {
                    type: 'string',
                    description: 'For brainstorm mode: specific aspect to brainstorm about',
                },
                plan: {
                    type: 'string',
                    description: 'For refine mode: the plan text to refine. If omitted, uses the most recent plan.',
                },
            },
            required: ['mode'],
        },
        action: execute,
        formatMessage: (params) => {
            const mode = params?.mode || 'plan';
            const labels = { plan: 'Planning response', brainstorm: 'Brainstorming ideas', refine: 'Refining plan', full: 'Running full pipeline' };
            return `${labels[mode] || 'Planning'}...`;
        },
        shouldRegister: () => getToolSettings(TOOL_NAME).enabled,
    };
}

async function execute({ mode = 'plan', direction, topic, plan } = {}) {
    if (!VALID_MODES.includes(mode)) {
        return `Error: Invalid mode "${mode}". Use "plan", "brainstorm", "refine", or "full".`;
    }

    if (mode === 'full') {
        return await runFullPipeline(direction);
    }

    switch (mode) {
        case 'plan': return await runPlan(direction);
        case 'brainstorm': return await runBrainstorm(topic);
        case 'refine': return await runRefine(plan);
    }
}

// ── Individual Modes ──

async function runPlan(direction) {
    const settings = getToolSettings(TOOL_NAME);
    const { recentMessages, lastUserMessage } = gatherContext(10);

    // Pull scene context if available
    const [thinking, situation] = await Promise.all([
        getChatVar('nlg_last_thinking'),
        getChatVar('nlg_last_situation'),
    ]);

    let sceneContext = '';
    if (thinking) sceneContext += `\n[Character thoughts:\n${thinking}]`;
    if (situation) sceneContext += `\n[Scene situation:\n${situation}]`;

    const template = settings.prompt?.plan || DEFAULT_PROMPTS.plan_response;
    const prompt = template
        .replace('{{DIRECTION}}', direction ? `Direction: ${direction}` : '')
        + `\n\n[User's last message: ${lastUserMessage}]`
        + `\n\n[Recent context:\n${recentMessages}]`
        + sceneContext;

    const result = await runSidecarGeneration({
        prompt,
        toolName: TOOL_NAME,
        toolParams: { mode: 'plan', direction },
    });

    await setChatVar('nlg_last_plan', result);
    return `Response plan created.\n\n${result}`;
}

async function runBrainstorm(topic) {
    const settings = getToolSettings(TOOL_NAME);
    const { recentMessages } = gatherContext(8);

    const currentPlan = await getChatVar('nlg_last_plan');
    const planContext = currentPlan
        ? `\n[Current response plan — brainstorm ideas that complement or enhance this:\n${currentPlan}]`
        : '';

    const template = settings.prompt?.brainstorm || DEFAULT_PROMPTS.brainstorm;
    const prompt = template
        .replace('{{TOPIC}}', topic ? `Topic: ${topic}` : '')
        + `\n\n[Recent context:\n${recentMessages}]`
        + planContext;

    const result = await runSidecarGeneration({
        prompt,
        toolName: TOOL_NAME,
        toolParams: { mode: 'brainstorm', topic },
    });

    await setChatVar('nlg_last_brainstorm', result);
    return `Brainstorming complete.\n\n${result}`;
}

async function runRefine(planText) {
    const settings = getToolSettings(TOOL_NAME);
    const { recentMessages } = gatherContext(6);

    if (!planText) {
        planText = await getChatVar('nlg_last_plan');
    }
    if (!planText) {
        return 'Error: No plan available to refine. Use mode "plan" first, or pass the plan text in the "plan" parameter.';
    }

    const brainstormResults = await getChatVar('nlg_last_brainstorm');
    const brainstormNote = brainstormResults
        ? `\n\n[Creative sparks from brainstorming — integrate the best ideas:\n${brainstormResults}]`
        : '';

    const template = settings.prompt?.refine || DEFAULT_PROMPTS.refine_plan;
    const prompt = template
        .replace('{{PLAN}}', planText)
        + brainstormNote
        + `\n\n[Recent context for consistency checking:\n${recentMessages}]`;

    const result = await runSidecarGeneration({
        prompt,
        toolName: TOOL_NAME,
        toolParams: { mode: 'refine' },
    });

    await setChatVar('nlg_last_plan', result);
    return `Plan refined and audited.\n\n${result}`;
}

// ── Full Pipeline ──

async function runFullPipeline(direction) {
    const stackAttempt = await tryRunNemoStackFullPipeline(direction);
    if (stackAttempt?.text) {
        return stackAttempt.text;
    }

    const localResult = await runGuidesFullPipeline(direction);
    if (stackAttempt?.fallbackReason) {
        return `NemoStack unavailable (${stackAttempt.fallbackReason}); used Guides Plan -> Brainstorm -> Refine instead.\n\n${localResult}`;
    }

    return localResult;
}

async function runGuidesFullPipeline(direction) {
    // Step 1: Plan
    const planResult = await runPlan(direction);
    if (planResult.startsWith('Error')) return planResult;

    // Step 2: Brainstorm (informed by the plan)
    const brainstormResult = await runBrainstorm(direction || 'the current scene');
    if (brainstormResult.startsWith('Error')) return brainstormResult;

    // Step 3: Refine (synthesizes plan + brainstorm)
    // runRefine returns a status string, not the plan itself — read the actual plan from the chat var
    const refineStatus = await runRefine(null); // null = auto-pull from chat var
    if (refineStatus.startsWith('Error')) return refineStatus;

    const refinedPlan = await getChatVar('nlg_last_plan');

    // Inject the final refined plan if injection is configured
    await injectPlanningResult(refinedPlan);

    return `Full pipeline complete (Plan → Brainstorm → Refine).\n\n${refinedPlan || ''}`;
}

async function tryRunNemoStackFullPipeline(direction) {
    const selectedPresetId = String(getGuidesSettings()?.planningPipelinePresetId || '').trim();
    if (!selectedPresetId) {
        return null;
    }

    const validation = await validateNemoStackPreset(selectedPresetId);
    if (!validation.configured) {
        const reason = validation.missing?.join('; ') || 'preset is not configured';
        console.warn('[NemoLore:Guides] NemoStack preset unavailable, falling back:', reason);
        return { fallbackReason: reason };
    }

    try {
        const statusLines = [];
        const stackInput = await buildNemoStackInput(direction);
        const result = await runNemoStackPipeline({
            presetId: selectedPresetId,
            ...stackInput,
            onStatus: (stage, message) => statusLines.push(`[${stage}] ${message}`),
        });

        if (!result?.text) {
            return { fallbackReason: result?.error || 'NemoStack returned no draft' };
        }

        await setChatVar('nlg_last_nemostack_draft', result.text);
        await injectPlanningResult(result.text);

        const presetLabel = getNemoStackPresetLabel(selectedPresetId);
        const timings = formatPipelineTimings(result.timings);
        const warning = result.error ? `\nWarning: ${result.error}` : '';

        return {
            text: `NemoStack high-effort draft complete.\nPreset: ${presetLabel}${timings}${warning}\n\nUse this as candidate source material for the next response. Adapt it to the current chat and do not mention NemoStack.\n\n## Draft\n${result.text}`,
        };
    } catch (error) {
        console.warn('[NemoLore:Guides] NemoStack execution failed, falling back:', error);
        return { fallbackReason: error?.message || String(error) };
    }
}

async function buildNemoStackInput(direction) {
    const context = getContext();
    const charName = context?.name2 || 'Character';
    const userName = context?.name1 || 'User';
    const card = getCharacterCardData(context);
    const trackerContext = await buildTrackerContext();

    const systemParts = [
        'You are helping NemoLore Guides prepare a high-effort candidate response for the active roleplay chat. Respect all established character, scenario, and user-agency constraints.',
        direction ? `Current response direction:\n${direction}` : '',
        card ? formatCharacterCard(card, charName, userName) : '',
        trackerContext,
    ].filter(Boolean);

    const messages = buildPipelineMessages(context, charName, userName);
    if (!messages.length) {
        messages.push({ role: 'user', content: direction || 'Continue the current scene.' });
    }

    return {
        systemPrompt: systemParts.join('\n\n'),
        messages,
        userName,
    };
}

function getCharacterCardData(context) {
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
    };
}

function formatCharacterCard(card, charName, userName) {
    return [
        `Character: ${card.name || charName}`,
        `User: ${userName}`,
        card.description ? `Description:\n${card.description}` : '',
        card.personality ? `Personality:\n${card.personality}` : '',
        card.scenario ? `Scenario:\n${card.scenario}` : '',
        card.firstMessage ? `Opening Message:\n${card.firstMessage}` : '',
        card.mesExample ? `Example Messages:\n${card.mesExample}` : '',
        card.creatorNotes ? `Creator Notes:\n${card.creatorNotes}` : '',
        card.systemPrompt ? `Card System Prompt:\n${card.systemPrompt}` : '',
    ].filter(Boolean).join('\n\n');
}

async function buildTrackerContext() {
    const trackers = [
        ['Story Rules', 'rules'],
        ['Narrator', 'narrator'],
        ['DM Notes', 'dm_notes'],
        ['Situation', 'situation'],
        ['Thinking', 'thinking'],
        ['Clothing', 'clothing'],
        ['Positions', 'positions'],
    ];

    const entries = await Promise.all(trackers.map(async ([label, key]) => {
        try {
            const content = await getTrackerContent(key);
            return content ? `[${label}]\n${content}` : '';
        } catch {
            return '';
        }
    }));

    const joined = entries.filter(Boolean).join('\n\n');
    return joined ? `NemoLore current-chat trackers:\n${joined}` : '';
}

function buildPipelineMessages(context, charName, userName) {
    return (context?.chat || [])
        .filter(message => !message.is_system && message.mes)
        .slice(-NEMOSTACK_CHAT_LIMIT)
        .map(message => {
            const name = message.is_user ? userName : charName;
            return {
                role: message.is_user ? 'user' : 'assistant',
                content: `${name}: ${cleanMessageText(message.mes)}`,
            };
        })
        .filter(message => message.content.trim());
}

async function injectPlanningResult(text) {
    const injectConfig = getToolInjectionConfig(TOOL_NAME);
    if (!injectConfig || !text) return;

    const context = getContext();
    try {
        const injectScript = `/inject id=${injectConfig.id} position=${injectConfig.position} depth=${injectConfig.depth} role=${injectConfig.role} ephemeral=${injectConfig.ephemeral} scan=${injectConfig.scan} ${JSON.stringify(text)}`;
        await context.executeSlashCommandsWithOptions(injectScript, {
            showOutput: false,
            handleExecutionErrors: true,
        });
    } catch { /* best effort */ }
}

function cleanMessageText(text) {
    return String(text || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000);
}

function formatPipelineTimings(timings = {}) {
    if (!timings?.total_ms) return '';
    return `\nTimings: recall+analysis ${timings.recall_ms ?? '?'}ms, drafts ${timings.drafts_ms ?? '?'}ms, consolidation ${timings.consolidation_ms ?? '?'}ms, total ${timings.total_ms}ms.`;
}
