/**
 * API Manager - Independent API System for NemoLore
 * Handles custom API connections for summarization and lorebook generation
 */

import { PresetManager } from './utils/preset-manager.js';

// Centralized API Provider configurations
const API_PROVIDERS = {
    openai: {
        name: 'OpenAI',
        endpoints: {
            models: 'https://api.openai.com/v1/models',
            completions: 'https://api.openai.com/v1/chat/completions'
        }
    },
    gemini: {
        name: 'Google Gemini',
        endpoints: {
            models: 'https://generativelanguage.googleapis.com/v1beta/models',
            completions: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
        }
    },
    claude: {
        name: 'Anthropic Claude',
        // Claude doesn't have a public models endpoint, so we use a static list.
        // These are the recommended models as of mid-2024.
        staticModels: [
            { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
            { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
        ],
        endpoints: {
            completions: 'https://api.anthropic.com/v1/messages'
        }
    },
    openrouter: {
        name: 'OpenRouter',
        endpoints: {
            models: 'https://openrouter.ai/api/v1/models',
            completions: 'https://openrouter.ai/api/v1/chat/completions'
        }
    }
};

export class APIManager {
    constructor(settings) {
        this.modelCache = new Map();
        this.presetManager = new PresetManager(settings);
    }

    /**
     * Initialize the API Manager
     */
    async initialize() {
        await this.presetManager.initialize();
        console.log('[NemoLore API Manager] ✅ Initialized with preset management');
    }

    /**
     * Fetches the list of available models for a given provider.
     * Handles caching to avoid redundant API calls.
     * @param {string} provider - The API provider (e.g., 'openai', 'openrouter').
     * @param {object} settings - The current extension settings, containing API keys.
     * @param {boolean} force - If true, bypasses the cache and fetches fresh data.
     * @returns {Promise<Array<{id: string, name: string}>>} A list of models.
     */
    async getModels(provider, settings, force = false) {
        const providerConfig = API_PROVIDERS[provider];
        if (!providerConfig) throw new Error(`Unknown provider: ${provider}`);

        if (!force && this.modelCache.has(provider)) {
            return this.modelCache.get(provider);
        }

        // Handle providers with static model lists (like Claude)
        if (providerConfig.staticModels) {
            this.modelCache.set(provider, providerConfig.staticModels);
            return providerConfig.staticModels;
        }

        const endpoint = providerConfig.endpoints.models;
        const apiKey = settings.async_api_key;
        if (!apiKey) throw new Error('API Key is required to fetch models.');

        let headers = { 'Content-Type': 'application/json' };
        if (provider === 'openai' || provider === 'openrouter') {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const url = provider === 'gemini' ? `${endpoint}?key=${apiKey}` : endpoint;

        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            const data = await response.json();
            
            let models = [];
            // Normalize the response from different providers into a standard format
            if (provider === 'openai' || provider === 'openrouter') {
                models = data.data.map(m => ({ id: m.id, name: m.id })).sort((a, b) => a.name.localeCompare(b.name));
            } else if (provider === 'gemini') {
                models = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent')).map(m => ({ id: m.name.replace('models/', ''), name: m.displayName })).sort((a, b) => a.name.localeCompare(b.name));
            }

            this.modelCache.set(provider, models);
            return models;
        } catch (error) {
            console.error(`[NemoLore API] Failed to fetch models for ${provider}:`, error);
            throw error;
        }
    }

    /**
     * Tests the connection to the specified API provider.
     * @param {object} settings - The current extension settings.
     * @returns {Promise<{success: boolean, message?: string, modelCount?: number}>} The result of the connection test.
     */
    async testConnection(settings) {
        const { async_api_provider: provider } = settings;
        try {
            const models = await this.getModels(provider, settings, true); // Force refresh on test
            if (models && models.length > 0) {
                return { success: true, modelCount: models.length };
            }
            return { success: false, message: 'No models found.' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Generates a summary using the configured API.
     * @param {string} prompt - The prompt for the API.
     * @param {object} settings - The current extension settings.
     * @returns {Promise<{content: string, usage: object|null}>} The generated content and usage data.
     */
    async generateSummary(prompt, settings) {
        const {
            enable_async_api,
            async_api_provider,
            async_api_key,
            async_api_model,
            async_api_endpoint
        } = settings;

        if (enable_async_api && async_api_provider && async_api_key && async_api_model) {
            try {
                return await this.makeApiRequest(prompt, settings);
            } catch (error) {
                console.error(`[NemoLore API] Independent API request failed: ${error}. Falling back to default.`);
                // Fallback on error
            }
        }

        // Fallback to SillyTavern's default generation WITH preset switching
        const { generateQuietPrompt } = await import('../../../../../../script.js');

        return await this.presetManager.executeWithPresetSwitch(async () => {
            const content = await generateQuietPrompt(prompt, { quiet: true });
            return { content, usage: null };
        });
    }

    /**
     * Generates lorebook entries using the configured API.
     * @param {string} prompt - The prompt for the API.
     * @param {object} settings - The current extension settings.
     * @returns {Promise<{content: string, usage: object|null}>} The generated content and usage data.
     */
    async generateLorebookEntries(prompt, settings) {
        const {
            enable_async_api,
            async_api_provider,
            async_api_key,
            async_api_model,
            async_api_endpoint
        } = settings;

        if (enable_async_api && async_api_provider && async_api_key && async_api_model) {
            try {
                return await this.makeApiRequest(prompt, settings);
            } catch (error) {
                console.error(`[NemoLore API] Independent API for lorebook failed: ${error}. Falling back.`);
            }
        }

        // Fallback to SillyTavern's default generation WITH preset switching
        const { generateQuietPrompt } = await import('../../../../../../script.js');

        return await this.presetManager.executeWithPresetSwitch(async () => {
            const content = await generateQuietPrompt(prompt, { quiet: true });
            return { content, usage: null };
        });
    }

    /**
     * Builds the prompt for lorebook generation.
     * @param {string} characterInfo - The character information to be used.
     * @returns {string} The constructed prompt.
     */
    buildLorebookPrompt(characterInfo) {
        return `You are an expert worldbuilding assistant. Based on the following character information, create a comprehensive set of lorebook entries that would enhance roleplay sessions.

Character Information:
${characterInfo}

Create lorebook entries that cover:
1. Character background and history
2. Key relationships and connections  
3. Important locations in their world
4. Significant events in their past
5. Cultural context and world details
6. Any special abilities, items, or knowledge they possess

Format each entry as:
Title: [Entry title]
Keywords: [comma-separated keywords for triggering]
Content: [detailed description]

Please provide 5-8 comprehensive lorebook entries:`;
    }

    /**
     * Makes the actual API request to the selected provider.
     * @private
     */
    async makeApiRequest(prompt, settings) {
        const {
            async_api_provider: provider,
            async_api_key: apiKey,
            async_api_model: model,
            async_api_endpoint: customEndpoint
        } = settings;

        const providerConfig = API_PROVIDERS[provider];
        const endpoint = customEndpoint || providerConfig.endpoints.completions;

        let headers = { 'Content-Type': 'application/json' };
        let body = {};
        let url = endpoint;

        switch (provider) {
            case 'openai':
            case 'openrouter':
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = { model, messages: [{ role: 'user', content: prompt }], max_tokens: 2048 };
                if (provider === 'openrouter') {
                    headers['HTTP-Referer'] = window.location.origin;
                    headers['X-Title'] = 'SillyTavern (NemoLore)';
                }
                break;
            case 'gemini':
                url = `${endpoint.replace('{model}', model)}?key=${apiKey}`;
                body = { contents: [{ parts: [{ text: prompt }] }] };
                break;
            case 'claude':
                headers['x-api-key'] = apiKey;
                headers['anthropic-version'] = '2023-06-01';
                body = { model, messages: [{ role: 'user', content: prompt }], max_tokens: 2048 };
                break;
            default:
                throw new Error(`Unsupported provider for makeApiRequest: ${provider}`);
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        // Normalize response data
        let content = '';
        if (provider === 'openai' || provider === 'openrouter') {
            content = data.choices[0].message.content;
        } else if (provider === 'gemini') {
            content = data.candidates[0].content.parts[0].text;
        } else if (provider === 'claude') {
            content = data.content[0].text;
        }

        return { content, usage: data.usage || null };
    }
}

console.log('[NemoLore API Manager] Module loaded - Independent API system ready');
