/**
 * Prompt Advisor
 * Scans the preset's prompt list and uses a sidecar generation to recommend
 * which prompts might be worth enabling or disabling for the current character/scenario.
 *
 * Reads prompt data directly from the DOM (prompt manager list).
 * Sends names + status to the AI for analysis.
 * Shows recommendations via toastr notifications.
 */

import { getContext, extension_settings } from '../../../../../extensions.js';
import { runSidecarGeneration } from './sidecar.js';
import { EXTENSION_NAME } from './tool-registry.js';

const LOG_PREFIX = '[NemosGuides:PromptAdvisor]';

/**
 * Escape HTML special characters to prevent XSS when inserting LLM output into toastr HTML.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Scan all prompts from the prompt manager DOM.
 * @returns {{ name: string, id: string, enabled: boolean, section: string }[]}
 */
function scanPrompts() {
    const items = document.querySelectorAll('#completion_prompt_manager_list [data-pm-identifier]');
    const prompts = [];

    for (const el of items) {
        const id = el.dataset.pmIdentifier;
        const nameEl = el.querySelector('.completion_prompt_manager_prompt_name');
        const rawName = nameEl?.dataset?.pmName || nameEl?.textContent?.trim() || '';
        const toggleEl = el.querySelector('.prompt-manager-toggle-action');
        const enabled = toggleEl?.classList?.contains('fa-toggle-on') || false;
        const isDivider = el.dataset.nemoIsDivider === 'true';
        const section = el.dataset.nemoSectionName || '';

        // Clean the name
        const name = rawName.replace(/\n\s+/g, ' ').replace(/\s{2,}/g, ' ').trim();

        // Skip dividers/section headers and system markers
        if (isDivider) continue;
        if (!name || name.startsWith('===')) continue;

        prompts.push({ name, id, enabled, section });
    }

    return prompts;
}

/**
 * Get character context for the advisor.
 * @returns {{ charName: string, charDescription: string, scenario: string }}
 */
function getCharacterContext() {
    const context = getContext();
    if (!context?.characters || context.characterId === undefined) {
        return { charName: '', charDescription: '', scenario: '' };
    }

    const char = context.characters[context.characterId];
    if (!char) return { charName: '', charDescription: '', scenario: '' };

    return {
        charName: char.name || context.name2 || '',
        charDescription: (char.description || '').substring(0, 500),
        scenario: (char.scenario || '').substring(0, 300),
    };
}

/**
 * Build the analysis prompt for the sidecar.
 */
function buildAnalysisPrompt(charName, charDescription, scenario, enabled, disabled) {
    return `[OOC: You are a creative director for a roleplay preset. Think like a showrunner deciding the tone and rules for a TV series — not a code linter checking for violations.

## Your Mindset
You are making TASTE decisions, not technical ones. Ask yourself:
- What KIND of story is this? (Genre, tone, intensity, mood)
- What does this character NEED from the system to shine?
- What prompts would enhance the EXPERIENCE vs. what would fight against it?

## Best Practices — DO NOT recommend:
- Anti-slop/writing quality prompts — those are handled by Nemo's Guides writing analyzer automatically. Skip anything that looks like a banned-words list, anti-repetition filter, or quality enforcer.
- Core system prompts — don't touch foundational prompts (variable init, settings, databank, chat history, world info markers). These are infrastructure.
- Prompts that are clearly for a different character variant — if there are personality variants (e.g. "Brooding Vex", "Bubbly Vex"), only recommend the one that matches the current scenario.

## Best Practices — DO recommend:
- Genre/tone prompts that match the story: "This is dark fantasy — enable the grimdark/horror tone prompt"
- Author/writing style prompts that fit: "This noir character would benefit from the hard-boiled writing style"
- Stakes/intensity prompts that match: "This is slice-of-life — disable the high-stakes drama prompt, it'll create tension where none should exist"
- Perspective/POV prompts: "This first-person character card would work better with the 1st person perspective prompt"
- Content prompts that match the scenario: "This romance scenario should have the romance prompt enabled"
- Disabling prompts that fight the tone: "You have both 'cozy' and 'high tension' enabled — pick one, they'll pull in opposite directions"

## Current Character
Name: ${charName || '(none selected)'}
Description: ${charDescription || '(no description)'}
Scenario: ${scenario || '(no scenario)'}

## Currently ENABLED Prompts (${enabled.length}):
${enabled.map(p => `- "${p.name}"${p.section ? ` [${p.section}]` : ''}`).join('\n')}

## Currently DISABLED Prompts (${disabled.length}):
${disabled.map(p => `- "${p.name}"${p.section ? ` [${p.section}]` : ''}`).join('\n')}

## Your Task
Make 2-5 creative direction recommendations. Each should feel like advice from someone who understands storytelling, not someone running a checklist. Focus on:
1. Disabled prompts that would genuinely enhance THIS story (genre, tone, style, stakes, perspective)
2. Enabled prompts that are fighting against the tone or are redundant for this scenario
3. Combinations that conflict (two enabled prompts pulling in opposite directions)

Format your response as JSON:
{
  "recommend_enable": [
    { "name": "exact prompt name from the list", "reason": "one sentence — why this serves the story" }
  ],
  "recommend_disable": [
    { "name": "exact prompt name from the list", "reason": "one sentence — why this fights the story" }
  ],
  "conflicts": [
    "description of any tone/style conflicts between enabled prompts"
  ]
}

ONLY output the JSON. No commentary, no markdown fences.]`;
}

/**
 * Run the prompt advisor analysis.
 * Convenience wrapper — calls runAndStoreAdvice.
 * @returns {Promise<void>}
 */
export async function runPromptAdvisor() {
    return await runAndStoreAdvice();
}

/**
 * Display recommendations as toastr notifications.
 * @param {{ recommend_enable: Array, recommend_disable: Array, conflicts: Array }} advice
 */
function displayRecommendations(advice) {
    let hasRecommendations = false;

    // Recommendations to enable
    if (advice.recommend_enable?.length > 0) {
        hasRecommendations = true;
        for (const rec of advice.recommend_enable) {
            toastr.success(
                `<strong>Consider enabling:</strong> "${escapeHtml(rec.name)}"<br><small>${escapeHtml(rec.reason)}</small>`,
                "Nemo's Guides — Prompt Advisor",
                { timeOut: 15000, escapeHtml: false, closeButton: true },
            );
        }
    }

    // Recommendations to disable
    if (advice.recommend_disable?.length > 0) {
        hasRecommendations = true;
        for (const rec of advice.recommend_disable) {
            toastr.warning(
                `<strong>Consider disabling:</strong> "${escapeHtml(rec.name)}"<br><small>${escapeHtml(rec.reason)}</small>`,
                "Nemo's Guides — Prompt Advisor",
                { timeOut: 15000, escapeHtml: false, closeButton: true },
            );
        }
    }

    // Conflicts
    if (advice.conflicts?.length > 0) {
        for (const conflict of advice.conflicts) {
            if (conflict && conflict.trim()) {
                toastr.error(
                    `<strong>Potential conflict:</strong><br><small>${escapeHtml(conflict)}</small>`,
                    "Nemo's Guides — Prompt Advisor",
                    { timeOut: 20000, escapeHtml: false, closeButton: true },
                );
            }
        }
    }

    if (!hasRecommendations) {
        toastr.info('Your prompt setup looks good for this character! No changes recommended.', "Nemo's Guides — Prompt Advisor", { timeOut: 8000 });
    }

    // Show the "Apply All" button if there are actionable recommendations
    if (hasRecommendations) {
        const applyBtn = document.getElementById('ng_apply_recommendations');
        if (applyBtn) applyBtn.style.display = '';
    }

    console.log(`${LOG_PREFIX} Prompt advisor complete:`, advice);
}

/** Store last advice for "Apply All" */
let lastAdvice = null;

/**
 * Reset advisor state — clear stored advice and hide the Apply All button.
 * Call on chat change to avoid stale recommendations carrying over.
 */
export function resetAdvisorState() {
    lastAdvice = null;
    const applyBtn = document.getElementById('ng_apply_recommendations');
    if (applyBtn) applyBtn.style.display = 'none';
}

/**
 * Run the advisor and store results for potential "Apply All".
 * @returns {Promise<void>}
 */
export async function runAndStoreAdvice() {
    const settings = extension_settings[EXTENSION_NAME];
    if (!settings?.enabled) return;

    console.log(`${LOG_PREFIX} Starting prompt analysis...`);
    toastr.info('Analyzing your prompt setup...', "Nemo's Guides", { timeOut: 3000 });

    const prompts = scanPrompts();
    if (prompts.length === 0) {
        toastr.warning('No prompts found in the prompt manager.', "Nemo's Guides");
        return;
    }

    const { charName, charDescription, scenario } = getCharacterContext();
    const enabled = prompts.filter(p => p.enabled);
    const disabled = prompts.filter(p => !p.enabled);

    const analysisPrompt = buildAnalysisPrompt(charName, charDescription, scenario, enabled, disabled);

    try {
        const result = await runSidecarGeneration({
            prompt: analysisPrompt,
            preset: settings.tools?.NG_rule_setup?.preset || undefined,
            toolName: 'NG_prompt_advisor',
            toolParams: { promptCount: prompts.length },
        });

        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            toastr.warning('Prompt advisor returned an unparseable response.', "Nemo's Guides");
            return;
        }

        lastAdvice = JSON.parse(jsonMatch[0]);
        displayRecommendations(lastAdvice);
    } catch (error) {
        console.error(`${LOG_PREFIX} Prompt advisor failed:`, error);
        toastr.error('Prompt advisor analysis failed.', "Nemo's Guides");
    }
}

/**
 * Apply all stored recommendations — toggle prompts by clicking their DOM toggles.
 * @returns {Promise<void>}
 */
export async function applyAllRecommendations() {
    if (!lastAdvice) {
        toastr.warning('No recommendations to apply. Run the advisor first.', "Nemo's Guides");
        return;
    }

    const prompts = scanPrompts();
    let applied = 0;

    // Enable recommended prompts
    if (lastAdvice.recommend_enable?.length > 0) {
        for (const rec of lastAdvice.recommend_enable) {
            const prompt = prompts.find(p => p.name === rec.name && !p.enabled);
            if (prompt) {
                const toggled = togglePromptById(prompt.id, true);
                if (toggled) {
                    applied++;
                    console.log(`${LOG_PREFIX} Enabled: "${rec.name}"`);
                }
            }
        }
    }

    // Disable recommended prompts
    if (lastAdvice.recommend_disable?.length > 0) {
        for (const rec of lastAdvice.recommend_disable) {
            const prompt = prompts.find(p => p.name === rec.name && p.enabled);
            if (prompt) {
                const toggled = togglePromptById(prompt.id, false);
                if (toggled) {
                    applied++;
                    console.log(`${LOG_PREFIX} Disabled: "${rec.name}"`);
                }
            }
        }
    }

    if (applied > 0) {
        toastr.success(`Applied ${applied} recommendation${applied > 1 ? 's' : ''}. Check your prompt list to verify.`, "Nemo's Guides — Prompt Advisor", { timeOut: 8000 });
        // Hide the apply button
        const applyBtn = document.getElementById('ng_apply_recommendations');
        if (applyBtn) applyBtn.style.display = 'none';
    } else {
        toastr.info('No changes were needed — prompts may have already been toggled.', "Nemo's Guides");
    }

    lastAdvice = null;
}

/**
 * Toggle a prompt's enabled state by clicking its toggle in the DOM.
 * @param {string} id - The data-pm-identifier value
 * @param {boolean} enable - Whether to enable (true) or disable (false)
 * @returns {boolean} Whether the toggle was clicked
 */
function togglePromptById(id, enable) {
    const el = document.querySelector(`[data-pm-identifier="${id}"]`);
    if (!el) return false;

    const toggle = el.querySelector('.prompt-manager-toggle-action');
    if (!toggle) return false;

    const isCurrentlyOn = toggle.classList.contains('fa-toggle-on');

    // Only click if state needs to change
    if (enable && !isCurrentlyOn) {
        toggle.click();
        return true;
    }
    if (!enable && isCurrentlyOn) {
        toggle.click();
        return true;
    }

    return false;
}

/**
 * Initialize the prompt advisor — add button to settings and optionally auto-run on chat change.
 */
export function initPromptAdvisor() {
    // Listen for chat changes to optionally auto-advise
    // (controlled by settings — off by default since it costs an API call)
}
