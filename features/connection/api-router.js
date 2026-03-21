/**
 * NemoPresetExt - API Router
 * Sends requests to specific provider+model combinations WITHOUT mutating global oai_settings.
 * Routes through SillyTavern's /api/backends/chat-completions/generate endpoint directly.
 */

import { getRequestHeaders } from '../../../../../../script.js';
import { ConnectionPool } from './connection-pool.js';
import logger from '../../core/logger.js';

const log = logger.module('ApiRouter');

/**
 * Build the request body for a specific connection.
 * Adds provider-specific fields as needed (e.g., claude_model for Claude).
 *
 * @param {import('./connection-pool.js').ConnectionEntry} connection
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} [params={}]
 * @param {number} [params.max_tokens=300]
 * @param {number} [params.temperature=0.7]
 * @param {Object} [params.bodyOverrides] - Arbitrary fields merged into the body
 * @returns {Object} Request body ready for JSON.stringify
 */
function buildRequestBody(connection, messages, params = {}) {
    const body = {
        chat_completion_source: connection.source,
        model: connection.model,
        messages: messages,
        max_tokens: params.max_tokens || 300,
        temperature: params.temperature ?? 0.7,
        stream: false, // Router always uses non-streaming for simplicity
        // Provider-specific fields
        ...(connection.source === 'claude' ? { claude_model: connection.model } : {}),
        ...(connection.source === 'custom' && connection.customUrl ? { custom_url: connection.customUrl } : {}),
        ...(connection.reverseProxy ? { reverse_proxy: connection.reverseProxy } : {}),
    };
    return { ...body, ...params.bodyOverrides };
}

/**
 * Extract the generated text from a provider response.
 * Handles the common response shapes returned by SillyTavern's backend proxy.
 *
 * @param {*} data - Parsed JSON response
 * @returns {string} Extracted text
 */
function extractResponseText(data) {
    // OpenAI-compatible format
    if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
    }
    // Claude format
    if (data?.content?.[0]?.text) {
        return data.content[0].text;
    }
    // Plain string
    if (typeof data === 'string') {
        return data;
    }
    // Fallback — serialize so callers always get a string
    return JSON.stringify(data);
}

/**
 * @typedef {Object} RouterResult
 * @property {string} text - Generated text (empty string on error)
 * @property {string} connectionId - Connection id used for the request
 * @property {string} model - Model identifier
 * @property {string} [error] - Error message if the request failed
 */

/**
 * @typedef {Object} SequentialStep
 * @property {string} connectionId - Connection id to use for this step
 * @property {string} [systemPrompt] - Optional system prompt prepended to messages
 * @property {function(string, Array): Array} [transformInput] - Transform the output for the next step's input
 */

/**
 * @typedef {Object} SequentialResult
 * @property {string} text - Final generated text
 * @property {RouterResult[]} steps - Results from each step in order
 */

/**
 * API Router — dispatches requests to registered connections via direct fetch.
 * Never mutates global oai_settings; all routing is done through request body params.
 */
export const ApiRouter = {
    /**
     * Send a request to a specific connection.
     * @param {string} connectionId
     * @param {Array<{role: string, content: string}>} messages
     * @param {Object} [params={}]
     * @param {number} [params.max_tokens]
     * @param {number} [params.temperature]
     * @param {Object} [params.bodyOverrides]
     * @returns {Promise<RouterResult>}
     */
    async send(connectionId, messages, params = {}) {
        const connection = ConnectionPool.get(connectionId);
        if (!connection) {
            throw new Error(`Connection not found: ${connectionId}`);
        }
        if (!connection.enabled) {
            throw new Error(`Connection disabled: ${connectionId}`);
        }

        const body = buildRequestBody(connection, messages, params);
        log.debug(`Sending to ${connectionId} (${connection.source}/${connection.model})`);

        try {
            const response = await fetch('/api/backends/chat-completions/generate', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                log.warn(`HTTP ${response.status} from ${connectionId}: ${errorText}`);
                return {
                    text: '',
                    connectionId,
                    model: connection.model,
                    error: `HTTP ${response.status}: ${errorText}`,
                };
            }

            const data = await response.json();
            const text = extractResponseText(data);
            log.debug(`Received ${text.length} chars from ${connectionId}`);
            return { text, connectionId, model: connection.model };
        } catch (err) {
            log.error(`Request failed for ${connectionId}`, err);
            return {
                text: '',
                connectionId,
                model: connection.model,
                error: err.message,
            };
        }
    },

    /**
     * Send the same request to multiple connections in parallel.
     * Returns an array of results (including errors for failed ones).
     * @param {string[]} connectionIds
     * @param {Array<{role: string, content: string}>} messages
     * @param {Object} [params={}]
     * @returns {Promise<RouterResult[]>}
     */
    async sendParallel(connectionIds, messages, params = {}) {
        log.debug(`Sending parallel request to ${connectionIds.length} connection(s)`);
        const promises = connectionIds.map(id => this.send(id, messages, params));
        const results = await Promise.allSettled(promises);
        return results.map((result, i) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            return {
                text: '',
                connectionId: connectionIds[i],
                model: '',
                error: result.reason?.message || 'Unknown error',
            };
        });
    },

    /**
     * Chain requests sequentially: the output of each step feeds into the next.
     * Stops on the first error.
     * @param {SequentialStep[]} steps
     * @param {Array<{role: string, content: string}>} initialMessages
     * @param {Object} [params={}]
     * @returns {Promise<SequentialResult>}
     */
    async sendSequential(steps, initialMessages, params = {}) {
        log.debug(`Starting sequential chain with ${steps.length} step(s)`);
        let currentMessages = [...initialMessages];
        const stepResults = [];

        for (const step of steps) {
            const msgs = step.systemPrompt
                ? [{ role: 'system', content: step.systemPrompt }, ...currentMessages]
                : currentMessages;

            const result = await this.send(step.connectionId, msgs, params);
            stepResults.push(result);

            if (result.error) {
                log.warn(`Sequential chain stopped at step ${stepResults.length}: ${result.error}`);
                break;
            }

            // Transform output for the next step
            if (step.transformInput) {
                currentMessages = step.transformInput(result.text, currentMessages);
            } else {
                currentMessages = [{ role: 'assistant', content: result.text }];
            }
        }

        return {
            text: stepResults[stepResults.length - 1]?.text || '',
            steps: stepResults,
        };
    },

    /**
     * Send to the best available connection matching optional filters.
     * Picks by priority (lowest number first), tries each until one succeeds.
     * @param {Array<{role: string, content: string}>} messages
     * @param {Object} [params={}]
     * @param {Object} [filter={}]
     * @param {string[]} [filter.tags] - At least one tag must match (OR)
     * @param {string} [filter.source] - Must match this provider source
     * @param {string[]} [filter.excludeIds] - Connection ids to skip
     * @returns {Promise<RouterResult>}
     */
    async sendToAny(messages, params = {}, filter = {}) {
        let connections = ConnectionPool.getEnabled();

        if (filter.tags) {
            connections = connections.filter(c => filter.tags.some(t => c.tags.includes(t)));
        }
        if (filter.source) {
            connections = connections.filter(c => c.source === filter.source);
        }
        if (filter.excludeIds) {
            connections = connections.filter(c => !filter.excludeIds.includes(c.id));
        }

        // Sort by priority (ascending — 0 is highest)
        connections.sort((a, b) => a.priority - b.priority);

        if (connections.length === 0) {
            throw new Error('No available connections matching filter');
        }

        log.debug(`sendToAny: trying ${connections.length} connection(s) in priority order`);

        // Try connections in priority order until one succeeds
        for (const conn of connections) {
            const result = await this.send(conn.id, messages, params);
            if (!result.error) {
                return result;
            }
            log.debug(`sendToAny: ${conn.id} failed, trying next...`);
        }

        throw new Error('All connections failed');
    },
};
