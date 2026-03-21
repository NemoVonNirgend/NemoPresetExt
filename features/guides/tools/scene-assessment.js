/**
 * Scene Assessment Tool
 * Consolidated scene analysis — thinking, clothing, positions, situation.
 * The model picks which aspects it needs via the `aspects` parameter.
 *
 * Stateful aspects (clothing, positions) are written to lorebook tracker entries
 * that persist as constant (always-on) injections until updated. This means the
 * AI only needs to call the tool when something changes — the current state is
 * always in context.
 */

import { runSidecarGeneration, gatherContext, setChatVar, getToolInjectionConfig } from '../sidecar.js';
import { DEFAULT_PROMPTS } from '../prompts.js';
import { getToolSettings } from '../tool-registry.js';
import { updateTracker, getTrackerContent } from '../lorebook-manager.js';

export const TOOL_NAME = 'NG_scene_assessment';

const VALID_ASPECTS = ['thinking', 'clothing', 'positions', 'situation'];

/** Aspects that get persistent lorebook tracker entries. */
const PERSISTENT_ASPECTS = ['clothing', 'positions'];

const ASPECT_LABELS = {
    thinking: 'Character Thoughts',
    clothing: 'Character Clothing & Appearance',
    positions: 'Character Positions & Physical States',
    situation: 'Scene Situation & Context',
};

export function getDefinition() {
    const settings = getToolSettings(TOOL_NAME);
    return {
        name: TOOL_NAME,
        displayName: 'Scene Assessment',
        description: `Analyze the current scene across one or more aspects. Available aspects:
- "thinking": What characters are thinking — internal monologue, hidden motivations, unspoken reactions. Use for emotionally complex moments.
- "clothing": What characters are wearing — outfits, appearance details. Use when appearance changes or is plot-relevant. This is saved as a persistent lorebook entry that stays in context until you update it.
- "positions": Physical positions, postures, spatial relationships. Use for action scenes, intimate moments, movement. This is saved as a persistent lorebook entry that stays in context until you update it.
- "situation": Full scene summary — location, setting, characters present, recent events, atmosphere. Use when the scene is complex or after time skips.
- "all": Run all four aspects for a comprehensive assessment.
You can request multiple aspects at once (e.g. ["thinking", "positions"]).`,
        parameters: {
            type: 'object',
            properties: {
                aspects: {
                    type: 'array',
                    items: { type: 'string', enum: [...VALID_ASPECTS, 'all'] },
                    description: 'Which aspects to assess: "thinking", "clothing", "positions", "situation", or "all"',
                },
                focus: {
                    type: 'string',
                    description: 'Optional: specific character or detail to focus on across all requested aspects',
                },
            },
            required: ['aspects'],
        },
        action: execute,
        formatMessage: (params) => {
            const aspects = params?.aspects || ['all'];
            return `Assessing scene: ${aspects.join(', ')}${params?.focus ? ` (focus: ${params.focus})` : ''}...`;
        },
        shouldRegister: () => getToolSettings(TOOL_NAME).enabled,
        stealth: settings.stealth,
    };
}

async function execute({ aspects = ['all'], focus } = {}) {
    const settings = getToolSettings(TOOL_NAME);

    // Resolve "all" to all aspects
    const requestedAspects = aspects.includes('all') ? [...VALID_ASPECTS] : aspects.filter(a => VALID_ASPECTS.includes(a));

    if (requestedAspects.length === 0) {
        return 'Error: No valid aspects requested. Use "thinking", "clothing", "positions", "situation", or "all".';
    }

    // Use larger context for situation, smaller for focused aspects
    const contextSize = requestedAspects.includes('situation') ? 15 : 8;
    const { recentMessages } = gatherContext(contextSize);

    // Gather previous state for continuity — check lorebook trackers first, fall back to chat vars
    const prevState = {};
    for (const aspect of requestedAspects) {
        if (PERSISTENT_ASPECTS.includes(aspect)) {
            prevState[aspect] = await getTrackerContent(aspect);
        }
    }

    // Build a combined prompt from all requested aspects
    const sections = [];
    for (const aspect of requestedAspects) {
        const template = settings.prompt?.[aspect] || DEFAULT_PROMPTS[`scene_${aspect}`] || DEFAULT_PROMPTS[aspect];
        if (!template) continue;

        let sectionPrompt = template.replace('{{FOCUS}}', focus ? `Focus on: ${focus}` : '');

        // Add continuity context for stateful aspects
        if (prevState[aspect]) {
            sectionPrompt += `\n[Previous ${aspect} state — update only what has changed:\n${prevState[aspect]}]`;
        }

        sections.push(`## ${ASPECT_LABELS[aspect]}\n${sectionPrompt}`);
    }

    const combinedPrompt = sections.join('\n\n---\n\n')
        + `\n\n[Recent context for reference:\n${recentMessages}]`;

    // Build storage info for activity feed
    const extraStorageInfo = [];
    for (const aspect of requestedAspects) {
        extraStorageInfo.push(`Chat variable: ng_last_${aspect}`);
        if (PERSISTENT_ASPECTS.includes(aspect)) {
            extraStorageInfo.push(`Lorebook: [NG] ${aspect.charAt(0).toUpperCase() + aspect.slice(1)}`);
        }
    }

    const result = await runSidecarGeneration({
        prompt: combinedPrompt,
        preset: settings.preset || undefined,
        toolName: TOOL_NAME,
        toolParams: { aspects: requestedAspects, focus },
        inject: getToolInjectionConfig(TOOL_NAME),
        extraStorageInfo,
    });

    // Post-generation: persist results
    await persistResults(requestedAspects, result);

    // Return full content so it's visible in the tool call result
    const aspectLabels = requestedAspects.map(a => ASPECT_LABELS[a] || a).join(', ');
    return `Scene assessment complete (${aspectLabels}).\n\n${result}`;
}

/**
 * Persist assessment results — write persistent aspects to lorebook tracker entries,
 * and all aspects to chat variables for cross-tool reference.
 */
async function persistResults(requestedAspects, result) {
    const persistPromises = [];

    for (const aspect of requestedAspects) {
        // Known limitation: when multiple aspects are assessed in one call, `result` is the
        // combined AI output for all aspects. Each aspect's tracker and chat variable receives
        // the full combined text rather than only its section. Splitting by section headers is
        // fragile (AI output formatting is inconsistent), so this is left as-is for now and
        // will be improved in a future version.
        // Always store in chat variable for cross-tool reference (plan-and-refine reads these)
        persistPromises.push(setChatVar(`ng_last_${aspect}`, result));

        // For persistent aspects, write to lorebook tracker entries
        // These stay in context as constant entries until the next update
        if (PERSISTENT_ASPECTS.includes(aspect)) {
            persistPromises.push(
                updateTracker(aspect, result).then(success => {
                    if (!success) {
                        console.warn(`[NemosGuides] Could not write ${aspect} to lorebook tracker. Falling back to chat variable only.`);
                    }
                }),
            );
        }
    }

    await Promise.allSettled(persistPromises);
}
