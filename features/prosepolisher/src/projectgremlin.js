import { extension_settings, getContext } from '../../../../../../extensions.js';
import { state } from './state.js';
import { executeGen, executeGenRaw } from './api-service.js';
import { GREMLIN_ROLES } from './constants.js';

export function selectChaosOption() {
    const settings = extension_settings.ProsePolisher;
    const options = settings.gremlinWriterChaosOptions || [];
    if (options.length === 0) return null;

    const totalWeight = options.reduce((sum, opt) => sum + (opt.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const option of options) {
        random -= (opt.weight || 1);
        if (random <= 0) {
            return option;
        }
    }
    return options[options.length - 1]; // Fallback
}

// This map correctly translates the API key from the UI dropdown to the parameters
// that SillyTavern's /api slash command expects, including source for chat completion APIs.
const CONNECT_API_MAP = {
    // Chat Completion APIs - use 'openai' API with specific source
    openai: { selected: 'openai', source: 'openai' },
    claude: { selected: 'openai', source: 'claude' },
    openrouter: { selected: 'openai', source: 'openrouter' },
    mistralai: { selected: 'openai', source: 'mistralai' },
    deepseek: { selected: 'openai', source: 'deepseek' },
    cohere: { selected: 'openai', source: 'cohere' },
    groq: { selected: 'openai', source: 'groq' },
    xai: { selected: 'openai', source: 'xai' },
    perplexity: { selected: 'openai', source: 'perplexity' },
    '01ai': { selected: 'openai', source: '01ai' },
    aimlapi: { selected: 'openai', source: 'aimlapi' },
    pollinations: { selected: 'openai', source: 'pollinations' },
    ai21: { selected: 'openai', source: 'ai21' },
    custom: { selected: 'openai', source: 'custom' },
    moonshot: { selected: 'openai', source: 'moonshot' },
    fireworks: { selected: 'openai', source: 'fireworks' },
    cometapi: { selected: 'openai', source: 'cometapi' },
    azure_openai: { selected: 'openai', source: 'azure_openai' },
    electronhub: { selected: 'openai', source: 'electronhub' },
    nanogpt: { selected: 'openai', source: 'nanogpt' },

    // Google APIs (both use openai API with google sources)
    makersuite: { selected: 'openai', source: 'makersuite' },
    vertexai: { selected: 'openai', source: 'vertexai' },

    // Text Generation APIs - use textgenerationwebui API
    textgenerationwebui: { selected: 'textgenerationwebui' },
    koboldcpp: { selected: 'koboldcpp' },
    llamacpp: { selected: 'llamacpp' },
    ollama: { selected: 'ollama' },
    vllm: { selected: 'vllm' },

    // Other APIs
    scale: { selected: 'scale' },
    windowai: { selected: 'windowai' },
};


// --- DEFAULT GREMLIN PROMPT CONSTANTS (Exported for use in content.js UI) ---
export const DEFAULT_PAPA_INSTRUCTIONS = `Create a response blueprint for the character's next turn.\n\nInclude:\n- Emotional tone/mood\n- Key actions to advance plot  \n- Dialogue themes\n- Scene atmosphere\n\nRules:\n- Stay consistent with character personality\n- Don't control or plan for {{user}}\n- Show emotions through actions, not statements\n- Avoid repeating previous content\n\nReturn only the blueprint text.`;

export const DEFAULT_TWINS_VEX_INSTRUCTIONS_BASE = `Suggest creative character depth ideas:\n- Internal thoughts/feelings\n- Emotional reactions\n- Body language details\n- Dialogue concepts\n\nBe creative and avoid repeating previous suggestions.`;

export const DEFAULT_TWINS_VAX_INSTRUCTIONS_BASE = `Suggest plot and action ideas:\n- Impactful character actions\n- Environmental interactions\n- Plot twists or developments\n- Scene pacing changes\n\nBe imaginative and avoid repeating previous suggestions.`;

export const DEFAULT_MAMA_INSTRUCTIONS = `Combine Papa's blueprint with the Twins' suggestions into a final blueprint.\n\nTasks:\n1.  **Review**: Examine Papa's blueprint and all of the Twins' ideas.\n2.  **Integrate**: Thoughtfully incorporate relevant and adaptable ideas from the Twins into the blueprint.\n    -   **Adapt & Refine**: Modify good but non-compliant ideas. For example, if a Twin suggests "{{user}} feels scared," translate that into the NPC *observing signs of fear* or *creating a frightening atmosphere*.\n    -   **Discard**: Remove redundant, contradictory, or unhelpful suggestions.\n\n### PHASE 2: CRITICAL AUDIT & RULE ENFORCEMENT\nRigorously audit the synthesized blueprint to ensure it **STRICTLY** adheres to all roleplaying principles.\n1.  **Consistency**:\n    -   Cross-reference the blueprint against the chat history.\n    -   **CORRECT ANY AND ALL CONTRADICTIONS** with established lore, character personalities, or plot points.\n2.  **Core Principles**:\n    -   **NPC Autonomy**: NPCs must act based on their own goals and personalities.\n    -   **Proactive Plot Development**: The blueprint should enable the NPC to drive the story forward.\n    -   **"Show, Don't Tell"**: Instructions must guide the writer to *demonstrate* emotions and intentions through action and description.\n    -   **USER AUTONOMY (ABSOLUTE & CRITICAL)**:\n        -   The final blueprint **MUST NOT** contain **ANY** plans, suggestions, or dictations for the \`{{user}}\` character's actions, dialogue, thoughts, or feelings.\n        -   **AGGRESSIVELY REMOVE OR REPHRASE** any language that implies control over the user.\n    -   **No Echoing**: Do not restate or summarize the user's input. Focus on the *consequences* and the character's reaction.\n    -   **Repetition Elimination**: Remove any repetitive phrases or ideas.\n\n### PHASE 3: FINAL POLISH\n1.  **Refine Language**: Ensure the blueprint is precise, evocative, and clear.\n2.  **Structure for Readability**: Organize the final blueprint in a logical, easy-to-follow format.\n\n### OUTPUT REQUIREMENTS\n-   **ONLY PROVIDE THE FINAL, FULLY COMPLIANT, AND POLISHED BLUEPRINT TEXT.**\n-   Do not include any OOC commentary, explanations, or any text other than the blueprint itself.\n\n### SOURCE MATERIALS\n**Papa Gremlin's Source Blueprint ({{BLUEPRINT_SOURCE}}):**\n{{BLUEPRINT}}\n\n**Twins' Creative Sparks (Vex & Vax):**\n{{TWIN_DELIBERATIONS}}`;

async function applyGremlinSettings(settings, role) {
    if (!state.isAppReady) {
        console.warn(`[ProjectGremlin] applyGremlinSettings called for ${role} before app ready.`);
        return false;
    }

    const { preset, api: apiNameSetting, model: modelName, customUrl, source } = settings;
    const commands = [];

    if (preset && preset !== 'Default') {
        commands.push(`/preset "${preset}"`);
    }

    if (apiNameSetting) {
        const apiNameKey = apiNameSetting.toLowerCase();
        const apiConfig = CONNECT_API_MAP[apiNameKey];

        if (apiConfig) {
            let apiCommand = `/api ${apiConfig.selected}`;

            if (apiConfig.source) {
                apiCommand += ` source=${apiConfig.source}`;
            }

            if (apiConfig.source === 'custom' && customUrl) {
                apiCommand += ` url=${customUrl}`;
            }

            commands.push(apiCommand);

            if (modelName) {
                let modelCommand = `/model "${modelName}"`;
                if (source) {
                    modelCommand += ` source_field=${source}`;
                }
                commands.push(modelCommand);
            }
        } else {
            console.error(`[ProjectGremlin] Unknown API mapping for "${apiNameSetting}" for role ${role}.`);
            window.toastr.error(`[ProjectGremlin] Unknown API mapping for ${role}: "${apiNameSetting}"`, "Project Gremlin");
            return false;
        }
    }

    if (commands.length === 0) {
        console.log(`[ProjectGremlin] No settings to apply for ${role}, using current environment.`);
        return true;
    }

    const script = commands.join(' | ');
    console.log(`[ProjectGremlin] Executing environment setup for ${role}: ${script}`);
    try {
        const result = await getContext().executeSlashCommandsWithOptions(script, {
            showOutput: false,
            handleExecutionErrors: true,
        });
        if (result && result.isError) {
            throw new Error(`STScript execution failed for ${role}: ${result.errorMessage}`);
        }
    } catch (err) {
        console.error(`[ProjectGremlin] Failed to execute setup script for ${role}: "${script.substring(0, 100)}..."`, err);
        window.toastr.error(`Failed to execute script for ${role}. Details: ${err.message}`, "Project Gremlin Setup Failed");
        return false;
    }
    return true;
}

async function applyGremlinConnectionProfile(profileName, role) {
    if (!state.isAppReady) {
        console.warn(`[ProjectGremlin] applyGremlinConnectionProfile called for ${role} before app ready.`);
        return false;
    }

    // Validate connection manager is available
    if (!extension_settings.connectionManager) {
        console.warn(`[ProjectGremlin] Connection Manager extension not available for ${role}. Falling back to current settings.`);
        window.toastr.warning(`Connection Manager not available for ${role}. Using current environment.`, "Project Gremlin");
        return true; // Continue with current settings
    }

    const connectionProfiles = extension_settings.connectionManager.profiles || {};
    const profile = connectionProfiles[profileName];

    if (!profile) {
        console.error(`[ProjectGremlin] Connection profile "${profileName}" not found for role ${role}.`);
        window.toastr.warning(`Connection profile "${profileName}" not found for ${role}. Using current environment.`, "Project Gremlin");
        return true; // Continue with current settings instead of failing
    }

    // Validate profile has necessary settings
    if (!profile.api_type && !profile.chat_completion_source) {
        console.warn(`[ProjectGremlin] Connection profile "${profileName}" appears incomplete for ${role}. Using current environment.`);
        window.toastr.warning(`Connection profile "${profileName}" appears incomplete for ${role}. Using current environment.`, "Project Gremlin");
        return true; // Continue with current settings
    }

    try {
        console.log(`[ProjectGremlin] Applying connection profile "${profileName}" for ${role}...`);

        // Execute the profile activation using SillyTavern's connection manager command
        const profileCommand = `/cm activate "${profileName}"`;
        const result = await getContext().executeSlashCommandsWithOptions(profileCommand, {
            showOutput: false,
            handleExecutionErrors: true,
        });

        if (result && result.isError) {
            console.warn(`[ProjectGremlin] Profile activation failed for ${role}: ${result.errorMessage}. Using current environment.`);
            window.toastr.warning(`Profile activation failed for ${role}. Using current environment.`, "Project Gremlin");
            return true; // Continue with current settings
        }

        console.log(`[ProjectGremlin] Successfully applied connection profile "${profileName}" for ${role}.`);
        return true;
    } catch (err) {
        console.warn(`[ProjectGremlin] Failed to apply connection profile "${profileName}" for ${role}:`, err);
        window.toastr.warning(`Failed to apply connection profile "${profileName}" for ${role}. Using current environment.`, "Project Gremlin");
        return true; // Continue with current settings instead of failing
    }
}

export async function applyGremlinEnvironment(role) {
    const settings = extension_settings.ProsePolisher;
    const roleUpper = role.charAt(0).toUpperCase() + role.slice(1);
    const profile = settings[`gremlin${roleUpper}Profile`];

    if (profile) {
        // Use connection profile
        return await applyGremlinConnectionProfile(profile, role);
    } else {
        // Use manual settings
        const roleSettings = {
            preset: settings[`gremlin${roleUpper}Preset`],
            api: settings[`gremlin${roleUpper}Api`],
            model: settings[`gremlin${roleUpper}Model`],
            customUrl: settings[`gremlin${roleUpper}CustomUrl`],
            source: settings[`gremlin${roleUpper}Source`]
        };
        return await applyGremlinSettings(roleSettings, role);
    }
}

export async function applyGremlinWriterChaosOption(chaosOption) {
    if (chaosOption.profile) {
        // Use connection profile for chaos option
        return await applyGremlinConnectionProfile(chaosOption.profile, 'Writer (Chaos)');
    } else {
        // Use manual settings for chaos option
        return await applyGremlinSettings(chaosOption, 'Writer (Chaos)');
    }
}


/**
 * Runs the planning stages of the pipeline (Papa, Twins, Mama).
 * Assumes the user's latest message is already in context.chat.
 * @returns {Promise<string|null>} The final blueprint string, or null on failure.
 */
export async function runGremlinPlanningPipeline() {
    if (!state.isAppReady) {
        console.warn(`[ProjectGremlin] runGremlinPlanningPipeline called before app ready.`);
        throw new Error("SillyTavern not ready to run Gremlin planning pipeline.");
    }

    console.log('[ProjectGremlin] The Gremlin planning process is starting...');
    const settings = extension_settings.ProsePolisher;

    // Check if ProsePolisher is enabled at all
    if (!settings.enabled) {
        console.log('[ProjectGremlin] ProsePolisher is disabled, skipping pipeline');
        return;
    }

    if (!settings.projectGremlinEnabled) {
        return;
    }

    // --- 1. Papa Gremlin (The Architect) ---
    const papaInstructionSetting = settings.gremlinPapaInstructions;
    let blueprintInstruction = (papaInstructionSetting && papaInstructionSetting.trim() !== '') ? papaInstructionSetting : DEFAULT_PAPA_INSTRUCTIONS;
    let blueprint = blueprintInstruction; // Initial blueprint is the full instruction for Papa if he's disabled.
    let blueprintSource = 'Base Instructions';

    if (settings.gremlinPapaEnabled) {
        window.toastr.info("Gremlin Pipeline: Step 1 - Papa Gremlin is drafting...", "Project Gremlin", { timeOut: 7000 });
        if (!await applyGremlinEnvironment('papa')) {
            throw new Error("Failed to configure environment for Papa Gremlin.");
        }
        console.log('[ProjectGremlin] Flushing injections before Papa Gremlin drafting...');
        await getContext().executeSlashCommandsWithOptions('/flushinject', { showOutput: false, handleExecutionErrors: true });
        const papaResult = await executeGenRaw(blueprintInstruction);
        if (!papaResult.trim()) throw new Error("Papa Gremlin failed to produce a blueprint.");
        blueprint = papaResult;
        blueprintSource = "Papa's Blueprint";
        console.log('[ProjectGremlin] Papa Gremlin\'s Blueprint:', blueprint.substring(0,100) + "...");
    } else {
        console.log('[ProjectGremlin] Papa Gremlin disabled, using base instructions as blueprint.');
    }

    // --- 2. Twin Gremlins (The Refiners) ---
    let twinDeliberations = '';
    if (settings.gremlinTwinsEnabled) {
        window.toastr.info("Gremlin Pipeline: Step 2 - The Twins are unleashing creative chaos...", "Project Gremlin", { timeOut: 15000 });
        if (!await applyGremlinEnvironment('twins')) {
            console.error('[ProjectGremlin] Failed to apply environment for Twin Gremlins.');
            window.toastr.warning("Failed to configure environment for Twin Gremlins. Skipping creative ideation.", "Project Gremlin");
        } else {
            const vexInstructionBaseSetting = settings.gremlinTwinsVexInstructionsBase;
            const vexPromptBase = (vexInstructionBaseSetting && vexInstructionBaseSetting.trim() !== '') ? vexInstructionBaseSetting : DEFAULT_TWINS_VEX_INSTRUCTIONS_BASE;

            const vaxInstructionBaseSetting = settings.gremlinTwinsVaxInstructionsBase;
            const vaxPromptBase = (vaxInstructionBaseSetting && vaxInstructionBaseSetting.trim() !== '') ? vaxInstructionBaseSetting : DEFAULT_TWINS_VAX_INSTRUCTIONS_BASE;

            const numTwinIterations = settings.gremlinTwinsIterations || 3;

            for (let i = 1; i <= numTwinIterations * 2; i++) {
                const isVexTurn = i % 2 !== 0;
                const currentTwin = isVexTurn ? 'Vex' : 'Vax';
                window.toastr.info(`Gremlin Pipeline: Twin Brainstorm ${i}/${numTwinIterations * 2} - ${currentTwin} is dreaming...`, "Project Gremlin", { timeOut: 5000, preventDuplicates: true });
                // The surrounding OOC instructions for the twins remain fixed.
                const twinPreamble = `**Papa's Current Blueprint (${blueprintSource}):**\n${blueprint}\n---\n**Previous Twin Ideas (if any):**\n${twinDeliberations || 'None.'}\n---\n**Your Task (as the imaginative ${currentTwin}):**\n[OOC: ${isVexTurn ? vexPromptBase : vaxPromptBase} Get inspired! Provide a concise note (1-2 sentences) with a fresh, creative idea or concept. Don't hold back! ONLY provide the idea text, no other commentary.]`;
                const twinNote = await executeGenRaw(twinPreamble);
                if (twinNote && twinNote.trim()) {
                    twinDeliberations += `**${currentTwin}'s Creative Spark ${Math.ceil(i/2)}/${numTwinIterations}:** ${twinNote}\n\n`;
                }
            }
            console.log('[ProjectGremlin] Full Twin Creative Deliberations:', twinDeliberations.substring(0,100) + "...");
        }
    } else {
         console.log('[ProjectGremlin] Twin Gremlins (Creative Ideation) disabled.');
    }

    // --- 3. Mama Gremlin (The Supervisor) ---
    let finalBlueprintForWriter;
    if (settings.gremlinMamaEnabled) {
        window.toastr.info("Gremlin Pipeline: Step 3 - Mama Gremlin is synthesizing and auditing...", "Project Gremlin", { timeOut: 7000 });
        if (!await applyGremlinEnvironment('mama')) {
            console.error('[ProjectGremlin] Failed to apply environment for Mama Gremlin.');
            window.toastr.warning("Failed to configure environment for Mama Gremlin. Using combined blueprint.", "Project Gremlin");
            finalBlueprintForWriter = `**Source Blueprint (${blueprintSource}):**\n${blueprint}\n\n**Twins' Creative Sparks (if any):**\n${twinDeliberations || 'None.'}`;
        } else {
            const mamaInstructionTemplateSetting = settings.gremlinMamaInstructions;
            let mamaPromptTemplate = (mamaInstructionTemplateSetting && mamaInstructionTemplateSetting.trim() !== '') ? mamaInstructionTemplateSetting : DEFAULT_MAMA_INSTRUCTIONS;

            // Replace placeholders in the chosen Mama prompt template
            const mamaPrompt = mamaPromptTemplate
                .replace(/\{\{BLUEPRINT_SOURCE\}\}/g, blueprintSource) // Note: using global regex for placeholders
                .replace(/\{\{BLUEPRINT\}\}/g, blueprint)
                .replace(/\{\{TWIN_DELIBERATIONS\}\}/g, twinDeliberations || 'None.');

            const mamaResult = await executeGenRaw(mamaPrompt);
            if (!mamaResult.trim()) {
                 console.warn('[ProjectGremlin] Mama Gremlin failed to produce a final blueprint. Using combined blueprint.');
                 window.toastr.warning("Mama Gremlin failed to produce a final blueprint. Using combined blueprint.", "Project Gremlin");
                 finalBlueprintForWriter = `**Source Blueprint (${blueprintSource}):**\n${blueprint}\n\n**Twins' Creative Sparks (if any):**\n${twinDeliberations || 'None.'}`;
            } else {
                finalBlueprintForWriter = mamaResult;
            }
        }
        console.log('[ProjectGremlin] Mama Gremlin\'s Final Blueprint:', finalBlueprintForWriter.substring(0,100) + "...");
    } else {
        console.log('[ProjectGremlin] Mama Gremlin disabled. Using combined blueprint.');
        finalBlueprintForWriter = `**Source Blueprint (${blueprintSource}):**\n${blueprint}\n\n**Twins' Creative Sparks (if any):**\n${twinDeliberations || 'None.'}`;
        console.log('[ProjectGremlin] Combined blueprint (Mama disabled):', finalBlueprintForWriter.substring(0,100) + "...");
    }

    return finalBlueprintForWriter;
}
