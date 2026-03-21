/**
 * Sidecar generation engine.
 * Handles all LLM generation for tools via ApiRouter (direct API calls)
 * with fallback to STScript /gen when no connections are available.
 *
 * Supports per-tool preset switching, activity feed integration,
 * persistent context injection, and chat variable storage.
 */

import { getContext, extension_settings } from '../../../../../extensions.js';
import { notifyToolStart, notifyToolComplete } from './activity-feed.js';
import { EXTENSION_NAME } from './tool-registry.js';
import { ApiRouter } from '../connection/api-router.js';
import { ConnectionPool } from '../connection/connection-pool.js';

const LOG_PREFIX = '[NemosGuides]';

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

    console.log(`${LOG_PREFIX} Auto-registered connection: ${source}/${model}`);
    return connectionId;
}

/**
 * Run a sidecar LLM generation using ApiRouter (direct API call).
 * Falls back to STScript /gen if no connections available.
 *
 * @param {object} options
 * @param {string} options.prompt - The prompt to send to the model
 * @param {string} [options.preset] - Optional preset name (ignored for ApiRouter, used for /gen fallback)
 * @param {string} [options.toolName] - Tool name for activity feed tracking
 * @param {object} [options.toolParams] - Tool parameters for activity feed display
 * @param {object} [options.inject] - Optional injection config for the result
 * @param {string} [options.storeAs] - If set, store the result in a chat variable
 * @param {number} [options.maxTokens] - Optional max response length in tokens
 * @param {string[]} [options.extraStorageInfo] - Additional storage locations for activity feed
 * @returns {Promise<string>} The generated text
 */
export async function runSidecarGeneration({ prompt, preset, toolName, toolParams, inject, storeAs, maxTokens, extraStorageInfo }) {
    const context = getContext();

    // Notify activity feed that tool is starting
    let feedItemId = null;
    if (toolName) {
        feedItemId = notifyToolStart(toolName, toolParams);
    }

    console.log(`${LOG_PREFIX} Running sidecar generation for ${toolName || 'unknown'}`);

    try {
        let output = '';

        // Try ApiRouter first (direct API call — works during active generation)
        const connectionId = ensureConnection();
        if (connectionId) {
            output = await runViaApiRouter(connectionId, prompt, maxTokens);
        } else {
            // Fallback to /gen (only works when no generation is active)
            console.warn(`${LOG_PREFIX} No ApiRouter connections, falling back to /gen`);
            output = await runViaGen(context, prompt, preset, maxTokens);
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
        const ephemeralId = `ng_ephemeral_${toolName || 'sidecar'}`;
        try {
            await context.executeSlashCommandsWithOptions(
                `/inject id=${ephemeralId} position=chat depth=1 role=system ephemeral=true scan=false ${JSON.stringify(`[NG Tool Result — ${toolName || 'sidecar'}]\n${output}`)}`,
                { showOutput: false, handleExecutionErrors: true },
            );
        } catch (err) {
            console.warn(`${LOG_PREFIX} Could not inject ephemeral result:`, err);
        }

        // Build storage info for activity feed
        const storedIn = [];
        if (extraStorageInfo) storedIn.push(...extraStorageInfo);
        if (storeAs) storedIn.push(`Chat variable: ${storeAs}`);
        if (inject?.id) storedIn.push(`Injection: ${inject.id} (${inject.position || 'chat'}, depth ${inject.depth ?? 1})`);
        storedIn.push(`Ephemeral injection: ${ephemeralId}`);

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
 * Generate via ApiRouter (direct API call — works during active generation).
 */
async function runViaApiRouter(connectionId, prompt, maxTokens) {
    const messages = [
        { role: 'system', content: 'You are a helpful creative writing assistant. Follow the instructions precisely.' },
        { role: 'user', content: prompt },
    ];

    const result = await ApiRouter.send(connectionId, messages, {
        max_tokens: maxTokens || 2000,
        temperature: 0.7,
    });

    if (result.error) {
        throw new Error(`ApiRouter: ${result.error}`);
    }

    return result.text || '';
}

/**
 * Generate via STScript /gen (fallback — only works when no generation is active).
 */
async function runViaGen(context, prompt, preset, maxTokens) {
    if (!context?.executeSlashCommandsWithOptions) {
        throw new Error('SillyTavern context not available for generation.');
    }

    // Build /gen command
    let genCmd = '/gen';
    if (maxTokens) genCmd += ` length=${maxTokens}`;
    genCmd += ` ${JSON.stringify(prompt)}`;

    // Handle preset switching
    let savedPreset = null;
    if (preset) {
        try {
            const presetResult = await context.executeSlashCommandsWithOptions('/preset', {
                showOutput: false, handleExecutionErrors: true,
            });
            savedPreset = presetResult?.pipe?.trim() || null;
        } catch { /* best effort */ }

        await context.executeSlashCommandsWithOptions(`/preset "${preset}"`, {
            showOutput: false, handleExecutionErrors: true,
        });
    }

    try {
        const result = await context.executeSlashCommandsWithOptions(genCmd, {
            showOutput: false, handleExecutionErrors: true,
        });

        if (result?.isError) {
            throw new Error(`STScript failed: ${result.errorMessage}`);
        }

        return result?.pipe || '';
    } finally {
        if (savedPreset && preset) {
            try {
                await context.executeSlashCommandsWithOptions(`/preset "${savedPreset}"`, {
                    showOutput: false, handleExecutionErrors: true,
                });
            } catch { /* best effort */ }
        }
    }
}

/**
 * Post-process a sidecar result: inject into context and/or store as variable.
 */
async function postProcess(context, output, { inject, storeAs, toolName }) {
    if (inject) {
        const id = inject.id || `ng_${toolName || 'sidecar'}`;
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
    const settings = extension_settings[EXTENSION_NAME];
    const toolSettings = settings?.tools?.[toolName];

    if (!toolSettings?.injectResult) return null;

    return {
        id: `ng_${toolName}`,
        position: toolSettings.injectPosition || 'chat',
        depth: toolSettings.injectDepth ?? 1,
        role: toolSettings.injectRole || 'system',
        ephemeral: toolSettings.injectEphemeral !== false,
        scan: toolSettings.injectScan || false,
    };
}
