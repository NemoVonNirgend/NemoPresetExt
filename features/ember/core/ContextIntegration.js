// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - Context Integration System

export class ContextIntegration {
    constructor() {
        this.contextFields = new Map();
        this.injectionHistory = [];
        this.generationTriggers = new Set();
        this.aiInstructions = new Map();
        this.hooks = {
            beforeInject: new Set(),
            afterInject: new Set(),
            beforeGenerate: new Set(),
            afterGenerate: new Set(),
            contextUpdate: new Set()
        };
    }

    /**
     * Register AI instructions for a pack
     */
    registerAiInstructions(packId, instructions) {
        this.aiInstructions.set(packId, instructions);
        console.log(`[Ember Context] Registered AI instructions for pack: ${packId}`);
    }

    /**
     * Inject context into the conversation
     */
    async injectContext(packId, options) {
        const injection = {
            id: options.id || `${packId}_${Date.now()}`,
            packId: packId,
            depth: options.depth || 0,
            content: options.content,
            ephemeral: options.ephemeral || false,
            timestamp: Date.now(),
            metadata: options.metadata || {}
        };

        console.log(`[Ember Context] Injecting context from ${packId}:`, injection);

        // Run before hooks
        for (const hook of this.hooks.beforeInject) {
            try {
                await hook(injection);
            } catch (error) {
                console.error('[Ember Context] Before inject hook failed:', error);
            }
        }

        // Execute injection via SillyTavern
        const success = await this.executeInjection(injection);

        if (success) {
            this.injectionHistory.push(injection);

            // Run after hooks
            for (const hook of this.hooks.afterInject) {
                try {
                    await hook(injection);
                } catch (error) {
                    console.error('[Ember Context] After inject hook failed:', error);
                }
            }
        }

        return success;
    }

    /**
     * Execute the actual context injection
     */
    async executeInjection(injection) {
        try {
            // Use SillyTavern's slash command system
            if (window.SillyTavern?.SlashCommands) {
                const command = this.buildInjectCommand(injection);
                await window.SillyTavern.SlashCommands.executeCommand(command);
                console.log(`[Ember Context] Successfully injected: ${injection.id}`);
                return true;
            } else {
                console.error('[Ember Context] SillyTavern SlashCommands not available');
                return false;
            }
        } catch (error) {
            console.error('[Ember Context] Injection failed:', error);
            return false;
        }
    }

    /**
     * Build injection slash command
     */
    buildInjectCommand(injection) {
        let command = `/inject id="${injection.id.replace(/"/g, '\\"')}" depth=${injection.depth} content="${injection.content.replace(/"/g, '\\"')}"`;

        if (injection.ephemeral) {
            command += ' ephemeral=true';
        }

        return command;
    }

    /**
     * Trigger AI generation
     */
    async triggerGeneration(packId, prompt, options = {}) {
        const trigger = {
            packId: packId,
            prompt: prompt,
            timestamp: Date.now(),
            options: options
        };

        console.log(`[Ember Context] Triggering generation from ${packId}:`, prompt);

        // Run before hooks
        for (const hook of this.hooks.beforeGenerate) {
            try {
                await hook(trigger);
            } catch (error) {
                console.error('[Ember Context] Before generate hook failed:', error);
            }
        }

        // Execute generation
        const success = await this.executeGeneration(trigger);

        if (success) {
            this.generationTriggers.add(trigger);

            // Run after hooks
            for (const hook of this.hooks.afterGenerate) {
                try {
                    await hook(trigger);
                } catch (error) {
                    console.error('[Ember Context] After generate hook failed:', error);
                }
            }
        }

        return success;
    }

    /**
     * Execute AI generation
     */
    async executeGeneration(trigger) {
        try {
            // Send user message and trigger generation
            if (window.SillyTavern?.sendMessageAsUser && window.SillyTavern?.Generate) {
                if (trigger.prompt) {
                    await window.SillyTavern.sendMessageAsUser(trigger.prompt);
                }
                await window.SillyTavern.Generate('normal');
                console.log(`[Ember Context] Successfully triggered generation from ${trigger.packId}`);
                return true;
            } else {
                console.error('[Ember Context] SillyTavern generation functions not available');
                return false;
            }
        } catch (error) {
            console.error('[Ember Context] Generation failed:', error);
            return false;
        }
    }

    /**
     * Register context field for a pack
     */
    registerContextField(packId, fieldName, fieldType, description, value = null) {
        const fieldKey = `${packId}:${fieldName}`;
        const field = {
            packId: packId,
            name: fieldName,
            type: fieldType,
            description: description,
            value: value,
            lastUpdated: Date.now()
        };

        this.contextFields.set(fieldKey, field);
        console.log(`[Ember Context] Registered context field: ${fieldKey}`);

        // Trigger context update hooks
        for (const hook of this.hooks.contextUpdate) {
            try {
                hook('register', field);
            } catch (error) {
                console.error('[Ember Context] Context update hook failed:', error);
            }
        }
    }

    /**
     * Set context field value
     */
    setContextField(packId, fieldName, value) {
        const fieldKey = `${packId}:${fieldName}`;
        const field = this.contextFields.get(fieldKey);

        if (!field) {
            console.warn(`[Ember Context] Context field not found: ${fieldKey}`);
            return false;
        }

        const oldValue = field.value;
        field.value = this.coerceValue(value, field.type);
        field.lastUpdated = Date.now();

        console.log(`[Ember Context] Updated context field ${fieldKey}: ${oldValue} -> ${field.value}`);

        // Trigger context update hooks
        for (const hook of this.hooks.contextUpdate) {
            try {
                hook('update', field, oldValue);
            } catch (error) {
                console.error('[Ember Context] Context update hook failed:', error);
            }
        }

        return true;
    }

    /**
     * Get context field value
     */
    getContextField(packId, fieldName) {
        const fieldKey = `${packId}:${fieldName}`;
        const field = this.contextFields.get(fieldKey);
        return field ? field.value : null;
    }

    /**
     * Get all context fields for a pack
     */
    getPackContextFields(packId) {
        const fields = {};
        for (const [key, field] of this.contextFields) {
            if (field.packId === packId) {
                fields[field.name] = field.value;
            }
        }
        return fields;
    }

    /**
     * Create AI-readable context summary
     */
    generateContextSummary(packId = null) {
        let summary = '';

        if (packId) {
            // Summary for specific pack
            const aiInstructions = this.aiInstructions.get(packId);
            if (aiInstructions) {
                summary += `## ${packId} Instructions\n${aiInstructions}\n\n`;
            }

            const fields = this.getPackContextFields(packId);
            if (Object.keys(fields).length > 0) {
                summary += `## ${packId} Context\n`;
                for (const [name, value] of Object.entries(fields)) {
                    summary += `- ${name}: ${value}\n`;
                }
                summary += '\n';
            }
        } else {
            // Summary for all packs
            summary += '# Ember Asset Pack Context\n\n';

            for (const [packId, instructions] of this.aiInstructions) {
                summary += `## ${packId}\n${instructions}\n\n`;

                const fields = this.getPackContextFields(packId);
                if (Object.keys(fields).length > 0) {
                    summary += `### Current State\n`;
                    for (const [name, value] of Object.entries(fields)) {
                        summary += `- ${name}: ${value}\n`;
                    }
                    summary += '\n';
                }
            }
        }

        return summary;
    }

    /**
     * Auto-inject context summary when needed
     */
    async autoInjectContextSummary(packId) {
        const summary = this.generateContextSummary(packId);
        if (!summary.trim()) return false;

        return await this.injectContext('system', {
            id: `${packId}_context_summary`,
            content: summary,
            depth: 1,
            ephemeral: true,
            metadata: { type: 'context_summary', packId }
        });
    }

    /**
     * Register pack context fields from metadata
     */
    registerPackContext(pack) {
        const { metadata } = pack;

        // Register AI instructions
        if (metadata.aiInstructions) {
            this.registerAiInstructions(pack.id, metadata.aiInstructions);
        }

        // Register context fields
        if (metadata.contextFields) {
            for (const field of metadata.contextFields) {
                this.registerContextField(
                    pack.id,
                    field.name,
                    field.type,
                    field.description
                );
            }
        }

        console.log(`[Ember Context] Registered context for pack: ${pack.id}`);
    }

    /**
     * Clean up context for unloaded pack
     */
    cleanupPackContext(packId) {
        // Remove AI instructions
        this.aiInstructions.delete(packId);

        // Remove context fields
        for (const [key, field] of this.contextFields) {
            if (field.packId === packId) {
                this.contextFields.delete(key);
            }
        }

        // Clean injection history
        this.injectionHistory = this.injectionHistory.filter(
            injection => injection.packId !== packId
        );

        console.log(`[Ember Context] Cleaned up context for pack: ${packId}`);
    }

    /**
     * Add hook callback
     */
    addHook(hookName, callback) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].add(callback);
            console.log(`[Ember Context] Added ${hookName} hook`);
        }
    }

    /**
     * Remove hook callback
     */
    removeHook(hookName, callback) {
        if (this.hooks[hookName]) {
            this.hooks[hookName].delete(callback);
            console.log(`[Ember Context] Removed ${hookName} hook`);
        }
    }

    /**
     * Coerce value to specific type
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
                return Array.isArray(value) ? value : [value];
            case 'object':
                return typeof value === 'object' ? value : {};
            default:
                return value;
        }
    }

    /**
     * Get injection history
     */
    getInjectionHistory(packId = null) {
        if (packId) {
            return this.injectionHistory.filter(injection => injection.packId === packId);
        }
        return [...this.injectionHistory];
    }

    /**
     * Clear injection history
     */
    clearInjectionHistory(packId = null) {
        if (packId) {
            this.injectionHistory = this.injectionHistory.filter(
                injection => injection.packId !== packId
            );
        } else {
            this.injectionHistory = [];
        }
        console.log(`[Ember Context] Cleared injection history${packId ? ` for ${packId}` : ''}`);
    }

    /**
     * Monitor for specific trigger phrases in AI responses
     */
    setupResponseMonitoring() {
        // This would integrate with SillyTavern's message system
        // to automatically trigger pack actions based on AI responses
        if (window.SillyTavern?.eventSource) {
            window.SillyTavern.eventSource.on('CHARACTER_MESSAGE_RENDERED', (messageId) => {
                this.analyzeMessageForTriggers(messageId);
            });
        }
    }

    /**
     * Analyze message for trigger phrases
     */
    async analyzeMessageForTriggers(messageId) {
        // Get message content
        const messageData = window.SillyTavern?.getContext?.()?.chat?.[messageId];
        if (!messageData) return;

        const content = messageData.mes.toLowerCase();

        // Check for pack-specific triggers
        for (const [packId, instructions] of this.aiInstructions) {
            // Simple keyword matching - could be enhanced with NLP
            if (content.includes(packId.toLowerCase()) ||
                content.includes('update') ||
                content.includes('status')) {

                // Auto-inject current context
                await this.autoInjectContextSummary(packId);
                break;
            }
        }
    }
}