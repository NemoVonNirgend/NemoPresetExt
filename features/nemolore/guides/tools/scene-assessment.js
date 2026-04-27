/**
 * Scene Assessment Tool
 * Consolidated current-scene analysis: thinking, clothing, positions, situation.
 * The model picks which aspects it needs via the `aspects` parameter.
 *
 * All aspects are written to current-chat lorebook tracker entries that stay in
 * context until refreshed or the chat changes. Durable cross-chat memory remains
 * owned by NemoLore core; Guides only maintains the live scene scratchpad.
 */

import { runSidecarGeneration, gatherContext, setChatVar, getToolInjectionConfig } from '../sidecar.js';
import { DEFAULT_PROMPTS } from '../prompts.js';
import { getToolSettings } from '../tool-registry.js';
import { updateTracker, getTrackerContent } from '../lorebook-manager.js';
import { getSceneSectionOrFallback, parseSceneSections } from '../scene-sections.js';

export const TOOL_NAME = 'NLG_scene_assessment';

const VALID_ASPECTS = ['thinking', 'clothing', 'positions', 'situation'];

/** Aspects that get current-chat lorebook tracker entries. */
const TRACKED_ASPECTS = [...VALID_ASPECTS];

const ASPECT_LABELS = {
    thinking: 'Character Thoughts',
    clothing: 'Character Clothing & Appearance',
    positions: 'Character Positions & Physical States',
    situation: 'Scene Situation & Context',
};

export function getDefinition() {
    return {
        name: TOOL_NAME,
        displayName: 'Scene Assessment',
        description: `Analyze the current scene across one or more aspects. Available aspects:
- "thinking": What characters are thinking - internal monologue, hidden motivations, unspoken reactions. Saved as a current-chat tracker.
- "clothing": What characters are wearing - outfits, appearance details. Saved as a current-chat tracker.
- "positions": Physical positions, postures, spatial relationships. Saved as a current-chat tracker.
- "situation": Full scene summary - location, setting, characters present, recent events, atmosphere. Saved as a current-chat tracker.
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

    // Gather previous state for continuity from the live scene trackers.
    const prevState = {};
    for (const aspect of requestedAspects) {
        if (TRACKED_ASPECTS.includes(aspect)) {
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
        extraStorageInfo.push(`Chat variable: nlg_last_${aspect}`);
        if (TRACKED_ASPECTS.includes(aspect)) {
            extraStorageInfo.push(`Lorebook: [NLG] ${aspect.charAt(0).toUpperCase() + aspect.slice(1)}`);
        }
    }

    const result = await runSidecarGeneration({
        prompt: combinedPrompt,
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
 * Persist assessment results to the live tracker lorebook and chat variables.
 */
async function persistResults(requestedAspects, result) {
    const persistPromises = [];
    const parsedSections = parseSceneSections(result);

    for (const aspect of requestedAspects) {
        const aspectResult = getSceneSectionOrFallback(parsedSections, aspect, result);

        // Always store in chat variable for cross-tool reference (plan-and-refine reads these)
        persistPromises.push(setChatVar(`nlg_last_${aspect}`, aspectResult));

        // Trackers stay in context for the current chat until the next update.
        if (TRACKED_ASPECTS.includes(aspect)) {
            persistPromises.push(
                updateTracker(aspect, aspectResult).then(success => {
                    if (!success) {
                        console.warn(`[NemoLore:Guides] Could not write ${aspect} to lorebook tracker. Falling back to chat variable only.`);
                    }
                }),
            );
        }
    }

    await Promise.allSettled(persistPromises);
}
