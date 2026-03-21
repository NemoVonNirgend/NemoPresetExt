/**
 * NemoPresetExt - Connection Pool
 * Manages registered provider+model combinations for the unified API router.
 * Connections are persisted in extension_settings.NemoPresetExt.connectionPool.
 */

import { saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { secret_state } from '../../../../../secrets.js';
import logger from '../../core/logger.js';

const log = logger.module('ConnectionPool');

/**
 * Extension name used for settings storage.
 * @type {string}
 */
const NEMO_EXTENSION_NAME = 'NemoPresetExt';

/**
 * Maps chat_completion_source values to their corresponding secret_state keys.
 * Used to check whether an API key is configured for a given provider.
 * @type {Record<string, string>}
 */
const SOURCE_TO_SECRET_KEY = {
    openai: 'api_key_openai',
    claude: 'api_key_claude',
    openrouter: 'api_key_openrouter',
    ai21: 'api_key_ai21',
    makersuite: 'api_key_makersuite',
    vertexai: 'api_key_vertexai',
    mistralai: 'api_key_mistralai',
    custom: 'api_key_custom',
    cohere: 'api_key_cohere',
    perplexity: 'api_key_perplexity',
    groq: 'api_key_groq',
    electronhub: 'api_key_electronhub',
    chutes: 'api_key_chutes',
    nanogpt: 'api_key_nanogpt',
    deepseek: 'api_key_deepseek',
    aimlapi: 'api_key_aimlapi',
    xai: 'api_key_xai',
    pollinations: 'api_key_pollinations',
    moonshot: 'api_key_moonshot',
    fireworks: 'api_key_fireworks',
    cometapi: 'api_key_cometapi',
    azure_openai: 'api_key_azure_openai',
    zai: 'api_key_zai',
    siliconflow: 'api_key_siliconflow',
};

/**
 * @typedef {Object} ConnectionEntry
 * @property {string} id - User-defined or auto-generated identifier (e.g., 'claude-opus', 'gemini-flash')
 * @property {string} source - chat_completion_source value (e.g., 'claude', 'openrouter', 'makersuite')
 * @property {string} model - Model ID (e.g., 'claude-opus-4-6', 'google/gemini-2.5-flash')
 * @property {string} label - Human-readable display name
 * @property {number} priority - Routing priority, 0 = highest (used by sendToAny)
 * @property {boolean} enabled - Whether this connection is active for routing
 * @property {string[]} tags - Capability tags: 'fast', 'smart', 'vision', 'cheap', 'free', 'reasoning'
 */

/**
 * Connection Pool — registry and persistence layer for provider+model combinations.
 * All mutations auto-persist to extension_settings via save().
 */
export const ConnectionPool = {
    // ─── Registry ───────────────────────────────────────────────────────

    /**
     * Add or update a connection in the pool.
     * If a connection with the same id already exists it is replaced.
     * @param {ConnectionEntry} connection
     */
    register(connection) {
        if (!connection?.id || !connection?.source || !connection?.model) {
            log.error('register: connection must have id, source, and model', connection);
            return;
        }

        const pool = this._getPool();
        const idx = pool.findIndex(c => c.id === connection.id);
        const entry = {
            id: connection.id,
            source: connection.source,
            model: connection.model,
            label: connection.label || connection.id,
            priority: connection.priority ?? 0,
            enabled: connection.enabled !== false,
            tags: Array.isArray(connection.tags) ? connection.tags : [],
            ...(connection.customUrl ? { customUrl: connection.customUrl } : {}),
            ...(connection.reverseProxy ? { reverseProxy: connection.reverseProxy } : {}),
        };

        if (idx >= 0) {
            pool[idx] = entry;
            log.debug(`Updated connection: ${entry.id}`);
        } else {
            pool.push(entry);
            log.debug(`Registered connection: ${entry.id}`);
        }

        this.save();
    },

    /**
     * Remove a connection by id.
     * @param {string} id
     * @returns {boolean} True if a connection was removed
     */
    unregister(id) {
        const pool = this._getPool();
        const idx = pool.findIndex(c => c.id === id);
        if (idx < 0) {
            log.warn(`unregister: connection not found: ${id}`);
            return false;
        }
        pool.splice(idx, 1);
        this.save();
        log.debug(`Unregistered connection: ${id}`);
        return true;
    },

    /**
     * Get a single connection by id.
     * @param {string} id
     * @returns {ConnectionEntry|undefined}
     */
    get(id) {
        return this._getPool().find(c => c.id === id);
    },

    /**
     * Get all registered connections.
     * @returns {ConnectionEntry[]}
     */
    getAll() {
        return [...this._getPool()];
    },

    /**
     * Get only enabled connections.
     * @returns {ConnectionEntry[]}
     */
    getEnabled() {
        return this._getPool().filter(c => c.enabled);
    },

    /**
     * Get connections for a specific provider source.
     * @param {string} source - chat_completion_source value
     * @returns {ConnectionEntry[]}
     */
    getBySource(source) {
        return this._getPool().filter(c => c.source === source);
    },

    /**
     * Get connections that have a specific tag.
     * @param {string} tag
     * @returns {ConnectionEntry[]}
     */
    getByTag(tag) {
        return this._getPool().filter(c => c.tags.includes(tag));
    },

    /**
     * Get connections matching one or more tags.
     * @param {string[]} tags - Tags to match
     * @param {boolean} [matchAll=false] - If true, connection must have ALL tags (AND). Otherwise any tag matches (OR).
     * @returns {ConnectionEntry[]}
     */
    getByTags(tags, matchAll = false) {
        if (!tags || tags.length === 0) return this.getAll();
        return this._getPool().filter(c => {
            if (matchAll) {
                return tags.every(t => c.tags.includes(t));
            }
            return tags.some(t => c.tags.includes(t));
        });
    },

    // ─── Availability ───────────────────────────────────────────────────

    /**
     * Check if an API key exists for this connection's source.
     * @param {string} id - Connection id
     * @returns {Promise<boolean>}
     */
    async checkAvailability(id) {
        const connection = this.get(id);
        if (!connection) return false;

        const secretKey = SOURCE_TO_SECRET_KEY[connection.source];
        if (!secretKey) {
            // Unknown source — assume available (could be a local/proxy backend)
            log.debug(`No secret key mapping for source: ${connection.source}, assuming available`);
            return true;
        }

        return !!secret_state[secretKey];
    },

    /**
     * Get all enabled connections that have API keys configured.
     * @returns {Promise<ConnectionEntry[]>}
     */
    async getAvailable() {
        const enabled = this.getEnabled();
        const checks = await Promise.all(
            enabled.map(async (c) => {
                const available = await this.checkAvailability(c.id);
                return available ? c : null;
            }),
        );
        return checks.filter(Boolean);
    },

    // ─── Persistence ────────────────────────────────────────────────────

    /**
     * Save the current pool to extension_settings and persist.
     */
    save() {
        this._ensureSettings();
        extension_settings[NEMO_EXTENSION_NAME].connectionPool = this._getPool();
        saveSettingsDebounced();
    },

    /**
     * Load the pool from extension_settings (called on init).
     */
    load() {
        this._ensureSettings();
        const stored = extension_settings[NEMO_EXTENSION_NAME].connectionPool;
        if (!Array.isArray(stored)) {
            extension_settings[NEMO_EXTENSION_NAME].connectionPool = [];
        }
        log.info(`Loaded ${this._getPool().length} connection(s) from settings`);
    },

    // ─── Utilities ──────────────────────────────────────────────────────

    /**
     * Generate a clean kebab-case id from source and model strings.
     * @param {string} source - Provider source
     * @param {string} model - Model identifier
     * @returns {string} Generated id (e.g., 'claude-opus-4-6', 'openrouter-gemini-2-5-flash')
     */
    generateId(source, model) {
        const raw = `${source}-${model}`;
        return raw
            .toLowerCase()
            .replace(/[/:]/g, '-')   // slashes and colons to dashes
            .replace(/\./g, '-')     // dots to dashes
            .replace(/[^a-z0-9-]/g, '') // strip non-alphanumeric
            .replace(/-+/g, '-')     // collapse consecutive dashes
            .replace(/^-|-$/g, '');  // trim leading/trailing dashes
    },

    // ─── Internal ───────────────────────────────────────────────────────

    /**
     * Ensure the extension settings namespace and connectionPool array exist.
     * @private
     */
    _ensureSettings() {
        if (!extension_settings[NEMO_EXTENSION_NAME]) {
            extension_settings[NEMO_EXTENSION_NAME] = {};
        }
        if (!Array.isArray(extension_settings[NEMO_EXTENSION_NAME].connectionPool)) {
            extension_settings[NEMO_EXTENSION_NAME].connectionPool = [];
        }
    },

    /**
     * Get a direct reference to the backing array (for in-place mutation).
     * @private
     * @returns {ConnectionEntry[]}
     */
    _getPool() {
        this._ensureSettings();
        return extension_settings[NEMO_EXTENSION_NAME].connectionPool;
    },
};
