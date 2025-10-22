// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - Asset Pack System Core
// Inspired by RisuAI's plugin system

export class AssetPackSystem {
    constructor() {
        this.packs = new Map();
        this.packInstances = new Map();
        this.packStates = new Map();
        this.apiRegistry = new Map();
        this.hooks = {
            beforeRender: new Set(),
            afterRender: new Set(),
            beforeContextInject: new Set(),
            afterContextInject: new Set(),
            beforeGenerate: new Set(),
            afterGenerate: new Set()
        };
    }

    /**
     * Parse asset pack metadata from JavaScript comments
     */
    parsePackMetadata(packContent) {
        const lines = packContent.split('\n');
        const metadata = {
            name: '',
            displayName: '',
            version: '1.0.0',
            description: '',
            author: '',
            args: {},
            exports: [],
            aiInstructions: '',
            contextFields: [],
            hooks: []
        };

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('//@name ')) {
                metadata.name = trimmed.slice(8).trim();
            } else if (trimmed.startsWith('//@display-name ')) {
                metadata.displayName = trimmed.slice(16).trim();
            } else if (trimmed.startsWith('//@version ')) {
                metadata.version = trimmed.slice(11).trim();
            } else if (trimmed.startsWith('//@description ')) {
                metadata.description = trimmed.slice(15).trim();
            } else if (trimmed.startsWith('//@author ')) {
                metadata.author = trimmed.slice(10).trim();
            } else if (trimmed.startsWith('//@arg ')) {
                const parts = trimmed.slice(7).split(' ');
                if (parts.length >= 3) {
                    const [name, type, ...defaultParts] = parts;
                    metadata.args[name] = {
                        type: type,
                        default: defaultParts.join(' ') || (type === 'number' ? 0 : '')
                    };
                }
            } else if (trimmed.startsWith('//@export ')) {
                metadata.exports.push(trimmed.slice(10).trim());
            } else if (trimmed.startsWith('//@ai-instructions ')) {
                metadata.aiInstructions = trimmed.slice(19).trim();
            } else if (trimmed.startsWith('//@context-field ')) {
                const parts = trimmed.slice(17).split(' ');
                if (parts.length >= 2) {
                    metadata.contextFields.push({
                        name: parts[0],
                        type: parts[1],
                        description: parts.slice(2).join(' ')
                    });
                }
            } else if (trimmed.startsWith('//@hook ')) {
                metadata.hooks.push(trimmed.slice(8).trim());
            }
        }

        return metadata;
    }

    /**
     * Register an asset pack
     */
    async registerPack(packData) {
        const metadata = this.parsePackMetadata(packData.content);

        if (!metadata.name) {
            throw new Error('Asset pack must have a name defined with //@name');
        }

        const pack = {
            id: metadata.name,
            metadata,
            content: packData.content,
            htmlContent: packData.htmlContent || '',
            cssContent: packData.cssContent || '',
            assets: packData.assets || {},
            registeredAt: Date.now()
        };

        this.packs.set(pack.id, pack);

        // Initialize pack state
        const state = {};
        for (const [argName, argDef] of Object.entries(metadata.args)) {
            state[argName] = this.coerceValue(argDef.default, argDef.type);
        }
        this.packStates.set(pack.id, state);

        console.log(`[Ember Asset Pack] Registered pack: ${pack.id}`);
        return pack;
    }

    /**
     * Load and execute an asset pack
     */
    async loadPack(packId, targetElement, args = {}) {
        const pack = this.packs.get(packId);
        if (!pack) {
            throw new Error(`Asset pack ${packId} not found`);
        }

        // Merge args with defaults
        const state = { ...this.packStates.get(packId), ...args };
        this.packStates.set(packId, state);

        // Create execution context
        const context = this.createPackContext(pack, state, targetElement);

        // Execute pack in sandbox
        const instance = await this.executePack(pack, context);
        this.packInstances.set(`${packId}_${Date.now()}`, instance);

        return instance;
    }

    /**
     * Create execution context for a pack
     */
    createPackContext(pack, state, targetElement) {
        const context = {
            // Pack info
            packId: pack.id,
            metadata: pack.metadata,

            // DOM access
            root: targetElement,
            document: targetElement.ownerDocument,

            // State management
            getArg: (name) => state[name],
            setArg: (name, value) => {
                if (pack.metadata.args[name]) {
                    state[name] = this.coerceValue(value, pack.metadata.args[name].type);
                }
            },

            // AI integration
            ember: {
                inject: (options) => this.injectContext(pack.id, options),
                generate: (prompt) => this.triggerGeneration(pack.id, prompt),
                getContextField: (name) => this.getContextField(pack.id, name),
                setContextField: (name, value) => this.setContextField(pack.id, name, value)
            },

            // Hooks
            addHook: (hookName, callback) => this.addHook(hookName, callback),
            removeHook: (hookName, callback) => this.removeHook(hookName, callback),

            // Asset access
            getAsset: (path) => pack.assets[path],

            // Utility functions
            log: (...args) => console.log(`[${pack.id}]`, ...args),
            error: (...args) => console.error(`[${pack.id}]`, ...args)
        };

        return context;
    }

    /**
     * Execute asset pack code in a controlled environment
     */
    async executePack(pack, context) {
        const sandboxGlobals = {
            console: {
                log: context.log,
                error: context.error,
                warn: (...args) => console.warn(`[${pack.id}]`, ...args),
                info: (...args) => console.info(`[${pack.id}]`, ...args)
            },
            setTimeout,
            setInterval,
            clearTimeout,
            clearInterval,
            fetch: this.createSecureFetch(pack.id),
            // Expose pack context
            ...context
        };

        // Create isolated execution environment
        const sandbox = `
            (function(${Object.keys(sandboxGlobals).join(', ')}) {
                "use strict";

                ${pack.content}

                // Return exports if any
                return (typeof exports !== 'undefined') ? exports : {};
            })
        `;

        try {
            const executor = eval(sandbox);
            const result = await executor(...Object.values(sandboxGlobals));

            return {
                packId: pack.id,
                context,
                exports: result,
                createdAt: Date.now()
            };
        } catch (error) {
            console.error(`[Ember Asset Pack] Error executing pack ${pack.id}:`, error);
            throw error;
        }
    }

    /**
     * Create secure fetch function for packs
     */
    createSecureFetch(packId) {
        return async (url, options = {}) => {
            // Add security restrictions
            if (!url.startsWith('https://')) {
                throw new Error(`[${packId}] Only HTTPS URLs are allowed`);
            }

            // Add pack identification headers
            const secureOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    'X-Ember-Pack': packId
                }
            };

            console.log(`[${packId}] Fetching: ${url}`);
            return fetch(url, secureOptions);
        };
    }

    /**
     * Context injection with AI integration
     */
    async injectContext(packId, options) {
        const pack = this.packs.get(packId);
        if (!pack) return;

        // Run before hooks
        for (const hook of this.hooks.beforeContextInject) {
            await hook(packId, options);
        }

        // Inject context via SillyTavern's system
        if (window.SillyTavern?.SlashCommands) {
            const injectionData = {
                id: options.id || `${packId}_context`,
                depth: options.depth || 0,
                content: options.content,
                ephemeral: options.ephemeral || false
            };

            const command = `/inject id="${injectionData.id}" depth=${injectionData.depth} content="${injectionData.content.replace(/"/g, '\\"')}"${injectionData.ephemeral ? ' ephemeral=true' : ''}`;

            try {
                await window.SillyTavern.SlashCommands.executeCommand(command);
                console.log(`[${packId}] Context injected:`, injectionData);
            } catch (error) {
                console.error(`[${packId}] Context injection failed:`, error);
            }
        }

        // Run after hooks
        for (const hook of this.hooks.afterContextInject) {
            await hook(packId, options);
        }
    }

    /**
     * Trigger AI generation
     */
    async triggerGeneration(packId, prompt) {
        const pack = this.packs.get(packId);
        if (!pack) return;

        // Run before hooks
        for (const hook of this.hooks.beforeGenerate) {
            await hook(packId, prompt);
        }

        if (prompt && window.SillyTavern?.sendMessageAsUser && window.SillyTavern?.Generate) {
            try {
                await window.SillyTavern.sendMessageAsUser(prompt);
                await window.SillyTavern.Generate('normal');
                console.log(`[${packId}] Generation triggered with prompt:`, prompt);
            } catch (error) {
                console.error(`[${packId}] Generation failed:`, error);
            }
        }

        // Run after hooks
        for (const hook of this.hooks.afterGenerate) {
            await hook(packId, prompt);
        }
    }

    /**
     * Get context field value
     */
    getContextField(packId, fieldName) {
        const pack = this.packs.get(packId);
        if (!pack) return null;

        const field = pack.metadata.contextFields.find(f => f.name === fieldName);
        if (!field) return null;

        // Get from pack state
        const state = this.packStates.get(packId);
        return state[`context_${fieldName}`];
    }

    /**
     * Set context field value
     */
    setContextField(packId, fieldName, value) {
        const pack = this.packs.get(packId);
        if (!pack) return;

        const field = pack.metadata.contextFields.find(f => f.name === fieldName);
        if (!field) return;

        // Store in pack state
        const state = this.packStates.get(packId);
        state[`context_${fieldName}`] = this.coerceValue(value, field.type);
        this.packStates.set(packId, state);
    }

    /**
     * Add hook callback
     */
    addHook(hookName, callback) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].add(callback);
        }
    }

    /**
     * Remove hook callback
     */
    removeHook(hookName, callback) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].delete(callback);
        }
    }

    /**
     * Utility to coerce values to specific types
     */
    coerceValue(value, type) {
        switch (type) {
            case 'number':
            case 'int':
                return Number(value) || 0;
            case 'string':
                return String(value);
            case 'boolean':
                return Boolean(value);
            case 'array':
                return Array.isArray(value) ? value : [];
            case 'object':
                return typeof value === 'object' ? value : {};
            default:
                return value;
        }
    }

    /**
     * Get all registered packs
     */
    getPacks() {
        return Array.from(this.packs.values());
    }

    /**
     * Get pack by ID
     */
    getPack(packId) {
        return this.packs.get(packId);
    }

    /**
     * Unload pack and cleanup
     */
    unloadPack(packId) {
        this.packs.delete(packId);
        this.packStates.delete(packId);

        // Cleanup instances
        for (const [instanceId, instance] of this.packInstances) {
            if (instance.packId === packId) {
                this.packInstances.delete(instanceId);
            }
        }

        console.log(`[Ember Asset Pack] Unloaded pack: ${packId}`);
    }
}