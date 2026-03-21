/**
 * Sidecar generation engine.
 * Handles all LLM generation for tools via STScript commands.
 * Supports per-tool preset switching, activity feed integration,
 * persistent context injection, and chat variable storage.
 *
 * STScript capabilities used:
 *   /gen         - Generate text with a prompt
 *   /inject      - Inject tool results as persistent/ephemeral context
 *   /setvar      - Store per-chat variables (persist across turns)
 *   /getvar      - Retrieve per-chat variables
 *   /messages    - Get chat messages for context
 *   /preset      - Switch presets before generation
 *   {{char}}, {{user}}, {{lastMessage}}, etc. - Macros auto-resolved by STScript
 */

import { getContext, extension_settings } from '../../../../../extensions.js';
import { notifyToolStart, notifyToolComplete } from './activity-feed.js';
import { EXTENSION_NAME } from './tool-registry.js';

const LOG_PREFIX = '[NemosGuides]';

/**
 * Mutex for preset-switching generations.
 * Serializes concurrent sidecar calls that switch presets to prevent
 * one call restoring the preset while another is mid-generation.
 */
let presetLock = Promise.resolve();

/**
 * Run a sidecar LLM generation using STScript.
 * @param {object} options
 * @param {string} options.prompt - The prompt to send to the model (macros like {{char}} are auto-resolved)
 * @param {string} [options.preset] - Optional preset name to switch to before generation
 * @param {string} [options.toolName] - Tool name for activity feed tracking
 * @param {object} [options.toolParams] - Tool parameters for activity feed display
 * @param {object} [options.inject] - Optional injection config for the result
 * @param {string} [options.inject.id] - Injection ID (for persistent injections)
 * @param {string} [options.inject.position] - Injection position: 'chat', 'before', 'after'
 * @param {number} [options.inject.depth] - Injection depth (default: 1)
 * @param {string} [options.inject.role] - Injection role: 'system', 'user', 'assistant'
 * @param {boolean} [options.inject.ephemeral] - Remove after next generation (default: true)
 * @param {boolean} [options.inject.scan] - Include in World Info scans (default: false)
 * @param {string} [options.storeAs] - If set, store the result in a chat variable with this name
 * @param {number} [options.maxTokens] - Optional max response length in tokens
 * @param {string[]} [options.extraStorageInfo] - Additional storage locations to show in activity feed details
 * @returns {Promise<string>} The generated text
 */
export async function runSidecarGeneration({ prompt, preset, toolName, toolParams, inject, storeAs, maxTokens, extraStorageInfo }) {
    const context = getContext();

    if (!context?.executeSlashCommandsWithOptions) {
        throw new Error(`${LOG_PREFIX} SillyTavern context not available for generation.`);
    }

    // Notify activity feed that tool is starting
    let feedItemId = null;
    if (toolName) {
        feedItemId = notifyToolStart(toolName, toolParams);
    }

    // Build /gen command with options (done outside the lock — no preset I/O needed here)
    const commands = [];

    // Build /gen command with options
    let genCmd = '/gen';
    if (maxTokens) {
        genCmd += ` length=${maxTokens}`;
    }
    // Use JSON.stringify to safely escape the prompt
    genCmd += ` ${JSON.stringify(prompt)}`;
    commands.push(genCmd);

    const genScript = commands.join(' | ');

    console.log(`${LOG_PREFIX} Running sidecar generation${preset ? ` with preset "${preset}"` : ''}`);

    // If a preset switch is needed, serialize via presetLock to prevent concurrent
    // calls from clobbering each other's preset save/restore cycle.
    const runGeneration = async () => {
        // If a preset is configured, save the current preset name so we can restore it after generation.
        // This prevents conflicts with TunnelVision or other extensions that also switch presets.
        let savedPreset = null;
        if (preset) {
            try {
                const presetResult = await context.executeSlashCommandsWithOptions('/preset', {
                    showOutput: false,
                    handleExecutionErrors: true,
                });
                savedPreset = presetResult?.pipe?.trim() || null;
            } catch { /* best effort — if we can't read it, we skip restore */ }

            // Switch to tool-specific preset
            await context.executeSlashCommandsWithOptions(`/preset "${preset}"`, {
                showOutput: false,
                handleExecutionErrors: true,
            });
        }

        try {
            const result = await context.executeSlashCommandsWithOptions(genScript, {
                showOutput: false,
                handleExecutionErrors: true,
            });

            if (result?.isError) {
                throw new Error(`STScript execution failed: ${result.errorMessage}`);
            }

            const output = result?.pipe || '';

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

            // Always inject the full result ephemerally so the AI sees it for its response,
            // even if the tool returns only a brief summary to keep chat clean.
            const ephemeralId = `ng_ephemeral_${toolName || 'sidecar'}`;
            try {
                await context.executeSlashCommandsWithOptions(
                    `/inject id=${ephemeralId} position=chat depth=1 role=system ephemeral=true scan=false ${JSON.stringify(`[NG Tool Result — ${toolName || 'sidecar'}]\n${output}`)}`,
                    { showOutput: false, handleExecutionErrors: true },
                );
                console.log(`${LOG_PREFIX} Injected result ephemerally as "${ephemeralId}"`);
            } catch (err) {
                console.warn(`${LOG_PREFIX} Could not inject ephemeral result:`, err);
            }

            // Build storage info for the activity feed details
            const storedIn = [];
            if (extraStorageInfo) storedIn.push(...extraStorageInfo);
            if (storeAs) storedIn.push(`Chat variable: ${storeAs}`);
            if (inject?.id) storedIn.push(`Injection: ${inject.id} (${inject.position || 'chat'}, depth ${inject.depth ?? 1})`);
            storedIn.push(`Ephemeral injection: ng_ephemeral_${toolName || 'sidecar'}`);

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
        } finally {
            // Restore the original preset if we switched away from it.
            // This prevents conflicts with TunnelVision or other extensions.
            if (savedPreset && preset) {
                try {
                    await context.executeSlashCommandsWithOptions(`/preset "${savedPreset}"`, {
                        showOutput: false,
                        handleExecutionErrors: true,
                    });
                    console.log(`${LOG_PREFIX} Restored preset to "${savedPreset}"`);
                } catch {
                    console.warn(`${LOG_PREFIX} Could not restore preset "${savedPreset}"`);
                }
            }
        }
    };

    if (preset) {
        // Serialize preset-switching generations to avoid race conditions
        const result = presetLock.then(runGeneration);
        presetLock = result.then(() => {}, () => {});
        return result;
    }

    return runGeneration();
}

/**
 * Post-process a sidecar result: inject into context and/or store as variable.
 * @param {object} context - SillyTavern context
 * @param {string} output - Generated text
 * @param {object} options
 */
async function postProcess(context, output, { inject, storeAs, toolName }) {
    // Inject the result into the chat context if configured
    if (inject) {
        const id = inject.id || `ng_${toolName || 'sidecar'}`;
        const position = inject.position || 'chat';
        const depth = inject.depth ?? 1;
        const role = inject.role || 'system';
        const ephemeral = inject.ephemeral !== false; // default true
        const scan = inject.scan || false;

        const injectScript = `/inject id=${id} position=${position} depth=${depth} role=${role} ephemeral=${ephemeral} scan=${scan} ${JSON.stringify(output)}`;

        try {
            await context.executeSlashCommandsWithOptions(injectScript, {
                showOutput: false,
                handleExecutionErrors: true,
            });
            console.log(`${LOG_PREFIX} Injected result as "${id}" at ${position} depth=${depth}`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to inject result:`, error);
        }
    }

    // Store the result in a chat variable if configured
    if (storeAs) {
        const storeScript = `/setvar key=${storeAs} ${JSON.stringify(output)}`;
        try {
            await context.executeSlashCommandsWithOptions(storeScript, {
                showOutput: false,
                handleExecutionErrors: true,
            });
            console.log(`${LOG_PREFIX} Stored result in variable "${storeAs}"`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to store result:`, error);
        }
    }
}

/**
 * Run an STScript command and return the pipe result.
 * Useful for fetching chat data, variables, etc.
 * @param {string} script - STScript to execute
 * @returns {Promise<string>} The pipe result
 */
export async function runSTScript(script) {
    const context = getContext();
    if (!context?.executeSlashCommandsWithOptions) {
        return '';
    }

    try {
        const result = await context.executeSlashCommandsWithOptions(script, {
            showOutput: false,
            handleExecutionErrors: true,
        });
        return result?.pipe || '';
    } catch (error) {
        console.error(`${LOG_PREFIX} STScript failed:`, error);
        return '';
    }
}

/**
 * Gather recent chat context for tool prompts.
 * @param {number} [messageCount=10] - Number of recent messages to include
 * @returns {{ charName: string, userName: string, recentMessages: string, lastUserMessage: string, lastCharMessage: string }}
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

    // Find last user and char messages
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
 * Get the value of a chat variable.
 * @param {string} name - Variable name
 * @returns {Promise<string>} Variable value
 */
export async function getChatVar(name) {
    return await runSTScript(`/getvar ${name}`);
}

/**
 * Set a chat variable.
 * @param {string} name - Variable name
 * @param {string} value - Variable value
 */
export async function setChatVar(name, value) {
    await runSTScript(`/setvar key=${name} ${JSON.stringify(value)}`);
}

/**
 * Get the extension's injection settings for a specific tool.
 * Returns the inject config if the tool has injection enabled in settings.
 * @param {string} toolName
 * @returns {object|null} Injection config or null
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
