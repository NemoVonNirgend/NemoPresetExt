/**
 * Plan & Refine Tool
 * Consolidated planning pipeline — plan, brainstorm, refine.
 * Modes: "plan", "brainstorm", "refine", or "full" (runs entire pipeline).
 */

import { runSidecarGeneration, gatherContext, getChatVar, setChatVar, getToolInjectionConfig } from '../sidecar.js';
import { DEFAULT_PROMPTS } from '../prompts.js';
import { getToolSettings } from '../tool-registry.js';

export const TOOL_NAME = 'NG_plan_and_refine';

const VALID_MODES = ['plan', 'brainstorm', 'refine', 'full'];

export function getDefinition() {
    const settings = getToolSettings(TOOL_NAME);
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
        stealth: settings.stealth,
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
        getChatVar('ng_last_thinking'),
        getChatVar('ng_last_situation'),
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
        preset: settings.preset || undefined,
        toolName: TOOL_NAME,
        toolParams: { mode: 'plan', direction },
    });

    await setChatVar('ng_last_plan', result);
    return `Response plan created.\n\n${result}`;
}

async function runBrainstorm(topic) {
    const settings = getToolSettings(TOOL_NAME);
    const { recentMessages } = gatherContext(8);

    const currentPlan = await getChatVar('ng_last_plan');
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
        preset: settings.preset || undefined,
        toolName: TOOL_NAME,
        toolParams: { mode: 'brainstorm', topic },
    });

    await setChatVar('ng_last_brainstorm', result);
    return `Brainstorming complete.\n\n${result}`;
}

async function runRefine(planText) {
    const settings = getToolSettings(TOOL_NAME);
    const { recentMessages } = gatherContext(6);

    if (!planText) {
        planText = await getChatVar('ng_last_plan');
    }
    if (!planText) {
        return 'Error: No plan available to refine. Use mode "plan" first, or pass the plan text in the "plan" parameter.';
    }

    const brainstormResults = await getChatVar('ng_last_brainstorm');
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
        preset: settings.preset || undefined,
        toolName: TOOL_NAME,
        toolParams: { mode: 'refine' },
    });

    await setChatVar('ng_last_plan', result);
    return `Plan refined and audited.\n\n${result}`;
}

// ── Full Pipeline ──

async function runFullPipeline(direction) {
    const settings = getToolSettings(TOOL_NAME);

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

    const refinedPlan = await getChatVar('ng_last_plan');

    // Inject the final refined plan if injection is configured
    const injectConfig = getToolInjectionConfig(TOOL_NAME);
    if (injectConfig && refinedPlan) {
        const { getContext } = await import('../../../../../extensions.js');
        const context = getContext();
        try {
            const injectScript = `/inject id=${injectConfig.id} position=${injectConfig.position} depth=${injectConfig.depth} role=${injectConfig.role} ephemeral=${injectConfig.ephemeral} scan=${injectConfig.scan} ${JSON.stringify(refinedPlan)}`;
            await context.executeSlashCommandsWithOptions(injectScript, {
                showOutput: false,
                handleExecutionErrors: true,
            });
        } catch { /* best effort */ }
    }

    return `Full pipeline complete (Plan → Brainstorm → Refine).\n\n${refinedPlan || ''}`;
}
