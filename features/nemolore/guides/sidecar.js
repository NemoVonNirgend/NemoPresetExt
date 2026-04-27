/**
 * Sidecar generation engine.
 * Handles all LLM generation for tools through SillyTavern Connection Manager
 * profiles, with current-API fallback when no profile is selected.
 *
 * Supports per-tool profile routing, activity feed integration,
 * persistent context injection, and chat variable storage.
 */

import { getContext } from '../../../../../../extensions.js';
import { notifyToolStart, notifyToolComplete } from './activity-feed.js';
import { ConnectionPool } from '../../connection/connection-pool.js';
import { getNemoLoreSettings } from '../settings.js';
import { runConnectionPrompt, runProfilePrompt } from '../shared/model-service.js';

const LOG_PREFIX = '[NemoLore:Guides]';

/**
 * Auto-register the current API settings as a connection if needed.
 * Same logic as guides-setup.js but importable from sidecar.
 */
function ensureConnection() {
    const enabled = ConnectionPool.getEnabled();
    if (enabled.length > 0) return enabled[0].id;

    const sourceSelect = document.getElementById('chat_completion_source');
    if (!sourceSelect) return null;

    const source = sourceSelect.value;
    if (!source) return null;

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

    if (!model) {
        const modelDisplay = document.querySelector('.nemo-model-chip-text, #model_display');
        model = modelDisplay?.textContent?.trim() || source;
    }

    if (!model) return null;

    const extras = {};
    if (source === 'custom') {
        const urlInput = document.getElementById('custom_api_url_text')
            || document.getElementById('custom_api_url');
        if (urlInput?.value) extras.customUrl = urlInput.value;
    }
    const reverseProxy = document.getElementById('openai_reverse_proxy');
    if (reverseProxy?.value) extras.reverseProxy = reverseProxy.value;

    const connectionId = `nlg_auto_${source}`;
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

    console.log(`${LOG_PREFIX} Auto-registered connection: ${source}/${model}`);
    return connectionId;
}

function getGuidesSettingsSnapshot() {
    return getNemoLoreSettings()?.guides || {};
}

function resolveSidecarProfileId(toolName, explicitProfileId) {
    const explicit = String(explicitProfileId || '').trim();
    if (explicit) return explicit;

    const toolProfileId = String(getGuidesSettingsSnapshot()?.tools?.[toolName]?.profileId || '').trim();
    if (toolProfileId) return toolProfileId;

    return String(getNemoLoreSettings().memoryProfileId || '').trim();
}

/**
 * Run a sidecar LLM generation using a Connection Manager profile when selected.
 * Falls back to the active chat API route, then STScript /gen if no direct route exists.
 *
 * @param {object} options
 * @param {string} options.prompt - The prompt to send to the model
 * @param {string} [options.profileId] - Optional Connection Manager profile override
 * @param {string} [options.toolName] - Tool name for activity feed tracking
 * @param {object} [options.toolParams] - Tool parameters for activity feed display
 * @param {object} [options.inject] - Optional injection config for the result
 * @param {string} [options.storeAs] - If set, store the result in a chat variable
 * @param {number} [options.maxTokens] - Optional max response length in tokens
 * @param {string[]} [options.extraStorageInfo] - Additional storage locations for activity feed
 * @param {boolean} [options.injectEphemeral=true] - Whether to inject the result ephemerally into prompt context
 * @returns {Promise<string>} The generated text
 */
export async function runSidecarGeneration({ prompt, profileId, toolName, toolParams, inject, storeAs, maxTokens, extraStorageInfo, injectEphemeral = true }) {
    const context = getContext();

    // Notify activity feed that tool is starting
    let feedItemId = null;
    if (toolName) {
        feedItemId = notifyToolStart(toolName, toolParams);
    }

    console.log(`${LOG_PREFIX} Running sidecar generation for ${toolName || 'unknown'}`);

    try {
        let output = '';
        const selectedProfileId = resolveSidecarProfileId(toolName, profileId);

        // Prefer profile calls because they preserve preset and instruct settings.
        if (selectedProfileId) {
            output = await runViaProfile(selectedProfileId, prompt, maxTokens);
        } else {
            const connectionId = ensureConnection();
            if (connectionId) {
                output = await runViaApiRouter(connectionId, prompt, maxTokens);
            } else {
                console.warn(`${LOG_PREFIX} No profile or ApiRouter connection, falling back to /gen`);
                output = await runViaGen(context, prompt, maxTokens);
            }
        }

        if (!output.trim()) {
            console.warn(`${LOG_PREFIX} Sidecar generation returned empty result.`);
            if (feedItemId !== null) {
                notifyToolComplete(feedItemId, true, 'Empty result');
            }
            return '(No content generated)';
        }

        console.log(`${LOG_PREFIX} Sidecar generation complete (${output.length} chars)`);

        // Post-generation actions: inject and/or store result
        await postProcess(context, output, { inject, storeAs, toolName });

        // Inject ephemerally so the AI sees it for its response
        let ephemeralId = '';
        if (injectEphemeral !== false) {
            ephemeralId = `nlg_ephemeral_${toolName || 'sidecar'}`;
        try {
            await context.executeSlashCommandsWithOptions(
                `/inject id=${ephemeralId} position=chat depth=1 role=system ephemeral=true scan=false ${JSON.stringify(`[NLG Tool Result — ${toolName || 'sidecar'}]\n${output}`)}`,
                { showOutput: false, handleExecutionErrors: true },
            );
        } catch (err) {
            console.warn(`${LOG_PREFIX} Could not inject ephemeral result:`, err);
        }
        }

        // Build storage info for activity feed
        const storedIn = [];
        if (extraStorageInfo) storedIn.push(...extraStorageInfo);
        if (storeAs) storedIn.push(`Chat variable: ${storeAs}`);
        if (inject?.id) storedIn.push(`Injection: ${inject.id} (${inject.position || 'chat'}, depth ${inject.depth ?? 1})`);
        if (ephemeralId) storedIn.push(`Ephemeral injection: ${ephemeralId}`);

        if (feedItemId !== null) {
            notifyToolComplete(feedItemId, true, `${output.length} chars generated`, {
                fullResult: output,
                storedIn,
            });
        }

        return output;
    } catch (error) {
        console.error(`${LOG_PREFIX} Sidecar generation failed:`, error);

        if (feedItemId !== null) {
            notifyToolComplete(feedItemId, false, error.message, {
                fullResult: `Error: ${error.message}`,
                storedIn: [],
            });
        }

        return `Error during generation: ${error.message}`;
    }
}

/**
 * Generate via SillyTavern Connection Manager profile.
 */
async function runViaProfile(profileId, prompt, maxTokens) {
    const text = await runProfilePrompt(profileId, prompt, {
        maxTokens: maxTokens || 2000,
        temperature: 0.7,
    });
    return text || '';
}

/**
 * Generate via ApiRouter (direct API call; works during active generation).
 */
async function runViaApiRouter(connectionId, prompt, maxTokens) {
    const result = await runConnectionPrompt(connectionId, prompt, {
        maxTokens: maxTokens || 2000,
        temperature: 0.7,
    });
    return result.text || '';
}

/**
 * Generate via STScript /gen (fallback — only works when no generation is active).
 */
async function runViaGen(context, prompt, maxTokens) {
    if (!context?.executeSlashCommandsWithOptions) {
        throw new Error('SillyTavern context not available for generation.');
    }

    // Build /gen command
    let genCmd = '/gen';
    if (maxTokens) genCmd += ` length=${maxTokens}`;
    genCmd += ` ${JSON.stringify(prompt)}`;

    const result = await context.executeSlashCommandsWithOptions(genCmd, {
        showOutput: false,
        handleExecutionErrors: true,
    });

    if (result?.isError) {
        throw new Error(`STScript failed: ${result.errorMessage}`);
    }

    return result?.pipe || '';
}

/**
 * Post-process a sidecar result: inject into context and/or store as variable.
 */
async function postProcess(context, output, { inject, storeAs, toolName }) {
    if (inject) {
        const id = inject.id || `nlg_${toolName || 'sidecar'}`;
        const position = inject.position || 'chat';
        const depth = inject.depth ?? 1;
        const role = inject.role || 'system';
        const ephemeral = inject.ephemeral !== false;
        const scan = inject.scan || false;

        const injectScript = `/inject id=${id} position=${position} depth=${depth} role=${role} ephemeral=${ephemeral} scan=${scan} ${JSON.stringify(output)}`;

        try {
            await context.executeSlashCommandsWithOptions(injectScript, {
                showOutput: false, handleExecutionErrors: true,
            });
            console.log(`${LOG_PREFIX} Injected result as "${id}" at ${position} depth=${depth}`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to inject result:`, error);
        }
    }

    if (storeAs) {
        const storeScript = `/setvar key=${storeAs} ${JSON.stringify(output)}`;
        try {
            await context.executeSlashCommandsWithOptions(storeScript, {
                showOutput: false, handleExecutionErrors: true,
            });
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to store result:`, error);
        }
    }
}

/**
 * Run an STScript command and return the pipe result.
 */
export async function runSTScript(script) {
    const context = getContext();
    if (!context?.executeSlashCommandsWithOptions) return '';

    try {
        const result = await context.executeSlashCommandsWithOptions(script, {
            showOutput: false, handleExecutionErrors: true,
        });
        return result?.pipe || '';
    } catch (error) {
        console.error(`${LOG_PREFIX} STScript failed:`, error);
        return '';
    }
}

/**
 * Gather recent chat context for tool prompts.
 */
export function gatherContext(messageCount = 10) {
    const context = getContext();
    const charName = context.name2 || 'Character';
    const userName = context.name1 || 'User';
    const chat = context.chat || [];

    const recent = chat.slice(-messageCount);
    const recentMessages = recent
        .filter(msg => !msg.is_system)
        .map(msg => {
            const name = msg.is_user ? userName : charName;
            const text = (msg.mes || '').substring(0, 500);
            return `${name}: ${text}`;
        })
        .join('\n');

    let lastUserMessage = '';
    let lastCharMessage = '';
    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        if (msg.is_system) continue;
        if (msg.is_user && !lastUserMessage) {
            lastUserMessage = msg.mes || '';
        } else if (!msg.is_user && !lastCharMessage) {
            lastCharMessage = msg.mes || '';
        }
        if (lastUserMessage && lastCharMessage) break;
    }

    return { charName, userName, recentMessages, lastUserMessage, lastCharMessage };
}

/**
 * Get/set chat variables.
 */
export async function getChatVar(name) {
    return await runSTScript(`/getvar ${name}`);
}

export async function setChatVar(name, value) {
    await runSTScript(`/setvar key=${name} ${JSON.stringify(value)}`);
}

/**
 * Get the extension's injection settings for a specific tool.
 */
export function getToolInjectionConfig(toolName) {
    const toolSettings = getGuidesSettingsSnapshot()?.tools?.[toolName];

    if (!toolSettings?.injectResult) return null;

    return {
        id: `nlg_${toolName}`,
        position: toolSettings.injectPosition || 'chat',
        depth: toolSettings.injectDepth ?? 1,
        role: toolSettings.injectRole || 'system',
        ephemeral: toolSettings.injectEphemeral !== false,
        scan: toolSettings.injectScan || false,
    };
}
