// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - Enhanced Asset Pack Class
// Supports stateful interactive experiences with AI integration

export class AssetPack {
    // Static position tracker for all asset packs
    static activePositions = new Map(); // messageId -> Array of {position, bounds, packId}
    static positionOffsets = {
        end: { x: 0, y: 0 },
        left: { x: -220, y: 0 },
        right: { x: 220, y: 0 },
        sticky: { x: 20, y: 20 },
        moveable: { x: 0, y: 0 }
    };

    constructor(packData) {
        this.id = packData.id || packData.metadata?.name;
        this.metadata = packData.metadata || {};
        this.content = packData.content || '';
        this.htmlContent = packData.htmlContent || '';
        this.cssContent = packData.cssContent || '';
        this.assets = packData.assets || {};

        // Enhanced features
        this.stateSchema = packData.stateSchema || {};
        this.aiIntegration = packData.aiIntegration || {};
        this.positioning = packData.positioning || { type: 'end' };
        this.chatInjection = packData.chatInjection || {};

        // Runtime state
        this.currentState = {};
        this.stateHistory = [];
        this.activeInstances = new Map();
        this.eventListeners = new Map();

        this.initializeState();
    }

    /**
     * Initialize pack state from schema
     */
    initializeState() {
        this.currentState = {};

        // Initialize variables from schema
        for (const [varName, varDef] of Object.entries(this.stateSchema.variables || {})) {
            this.currentState[varName] = this.coerceValue(varDef.default, varDef.type);
        }

        console.log(`[AssetPack ${this.id}] Initialized state:`, this.currentState);
    }

    /**
     * Create and render pack instance in specified position
     */
    async render(messageId, messageElement, position = null) {
        const targetPosition = position || this.positioning.type;
        const instanceId = `${this.id}_${messageId}_${Date.now()}`;

        // Create container based on position
        const container = this.createPositionedContainer(targetPosition, messageElement);
        container.setAttribute('data-pack-id', this.id);
        container.setAttribute('data-instance-id', instanceId);
        container.setAttribute('data-message-id', messageId);

        // Register position occupation for collision detection
        this.registerPosition(messageId, targetPosition, container.getBoundingClientRect());

        // Create execution context
        const context = this.createExecutionContext(instanceId, container, messageElement);

        // Execute pack code
        const instance = await this.execute(context);

        // Store instance
        this.activeInstances.set(instanceId, {
            container,
            context,
            instance,
            messageId,
            position: targetPosition,
            createdAt: Date.now()
        });

        console.log(`[AssetPack ${this.id}] Rendered instance ${instanceId} at position: ${targetPosition}`);
        return instanceId;
    }

    /**
     * Create positioned container based on position type
     */
    createPositionedContainer(position, messageElement) {
        const container = document.createElement('div');
        container.className = `ember-asset-pack-container ember-position-${position}`;

        // Calculate smart positioning to avoid collisions
        const smartPosition = this.calculateSmartPosition(position, messageElement);

        // Base container styles - minimal interference with content
        container.style.cssText = `
            position: relative;
            margin: 10px 0;
            padding: 5px;
            border: 2px dashed rgba(0,255,0,0.3);
            border-radius: 4px;
            background: rgba(0,255,0,0.05);
            overflow: visible;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            min-height: 60px;
            display: block;
        `;

        // Apply smart positioning adjustments
        if (smartPosition.adjustments) {
            container.style.cssText += smartPosition.adjustments;
        }

        // Add a debug label
        container.innerHTML = `<small style="color: #666; font-size: 10px; opacity: 0.7;">Asset Pack Container: ${this.id} (${position}${smartPosition.offset ? ` +${smartPosition.offset}` : ''})</small>`;

        switch (position) {
            case 'end':
                // Default position - after message content
                this.insertAtEnd(container, messageElement);
                break;

            case 'top':
                // Before message content
                container.style.marginBottom = '15px';
                this.insertAtTop(container, messageElement);
                break;

            case 'left':
                // Left side of message
                container.style.cssText += `
                    position: absolute;
                    left: -220px;
                    top: 0;
                    width: 200px;
                    margin: 0;
                `;
                this.insertAtSide(container, messageElement, 'left');
                break;

            case 'right':
                // Right side of message
                container.style.cssText += `
                    position: absolute;
                    right: -220px;
                    top: 0;
                    width: 200px;
                    margin: 0;
                `;
                this.insertAtSide(container, messageElement, 'right');
                break;

            case 'below':
                // Below the entire message block
                container.style.marginTop = '15px';
                this.insertBelow(container, messageElement);
                break;

            case 'moveable':
                // Draggable/resizable container
                this.makeMoveable(container);
                this.insertAtEnd(container, messageElement);
                break;

            case 'sticky':
                // Sticky to viewport
                container.style.cssText += `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 300px;
                    z-index: 1000;
                    max-height: 400px;
                `;
                document.body.appendChild(container);
                break;

            default:
                this.insertAtEnd(container, messageElement);
        }

        return container;
    }

    /**
     * Calculate smart positioning to avoid collisions
     */
    calculateSmartPosition(position, messageElement) {
        const messageId = this.getMessageId(messageElement);
        const existingPositions = AssetPack.activePositions.get(messageId) || [];

        // Count existing packs at this position type
        const samePositionCount = existingPositions.filter(p => p.position === position).length;

        let adjustments = '';
        let offset = '';

        switch (position) {
            case 'end':
                if (samePositionCount > 0) {
                    // Stack vertically with spacing
                    adjustments = `margin-top: ${20 + (samePositionCount * 10)}px;`;
                    offset = `v${samePositionCount}`;
                }
                break;

            case 'left':
                if (samePositionCount > 0) {
                    // Stack further left or move down
                    const extraLeft = samePositionCount * 250;
                    const extraDown = samePositionCount * 20;
                    adjustments = `left: ${-220 - extraLeft}px; top: ${extraDown}px;`;
                    offset = `l${samePositionCount}`;
                }
                break;

            case 'right':
                if (samePositionCount > 0) {
                    // Stack further right or move down
                    const extraRight = samePositionCount * 250;
                    const extraDown = samePositionCount * 20;
                    adjustments = `right: ${-220 - extraRight}px; top: ${extraDown}px;`;
                    offset = `r${samePositionCount}`;
                }
                break;

            case 'sticky':
                if (samePositionCount > 0) {
                    // Stack sticky windows in a cascade pattern
                    const cascadeX = samePositionCount * 30;
                    const cascadeY = samePositionCount * 30;
                    adjustments = `top: ${20 + cascadeY}px; right: ${20 + cascadeX}px;`;
                    offset = `s${samePositionCount}`;
                }
                break;

            case 'below':
                if (samePositionCount > 0) {
                    // Stack further below with larger spacing
                    adjustments = `margin-top: ${25 + (samePositionCount * 15)}px;`;
                    offset = `b${samePositionCount}`;
                }
                break;

            case 'top':
                if (samePositionCount > 0) {
                    // Stack above with spacing
                    adjustments = `margin-bottom: ${25 + (samePositionCount * 15)}px;`;
                    offset = `t${samePositionCount}`;
                }
                break;

            case 'moveable':
                if (samePositionCount > 0) {
                    // Offset moveable containers in a grid pattern
                    const gridX = (samePositionCount % 3) * 20;
                    const gridY = Math.floor(samePositionCount / 3) * 20;
                    adjustments = `transform: translate(${gridX}px, ${gridY}px);`;
                    offset = `m${samePositionCount}`;
                }
                break;
        }

        return { adjustments, offset };
    }

    /**
     * Get message ID from message element
     */
    getMessageId(messageElement) {
        const mesBlock = messageElement.closest('.mes');
        return mesBlock?.getAttribute('mesid') || mesBlock?.id || 'unknown';
    }

    /**
     * Register position occupation for collision detection
     */
    registerPosition(messageId, position, bounds) {
        if (!AssetPack.activePositions.has(messageId)) {
            AssetPack.activePositions.set(messageId, []);
        }

        AssetPack.activePositions.get(messageId).push({
            position,
            bounds,
            packId: this.id,
            timestamp: Date.now()
        });

        console.log(`[AssetPack ${this.id}] Registered position ${position} for message ${messageId}`);
    }

    /**
     * Unregister position when pack is removed
     */
    unregisterPosition(messageId) {
        const positions = AssetPack.activePositions.get(messageId);
        if (positions) {
            const filtered = positions.filter(p => p.packId !== this.id);
            if (filtered.length === 0) {
                AssetPack.activePositions.delete(messageId);
            } else {
                AssetPack.activePositions.set(messageId, filtered);
            }
        }

        console.log(`[AssetPack ${this.id}] Unregistered position for message ${messageId}`);
    }

    /**
     * Insert container at different positions
     */
    insertAtEnd(container, messageElement) {
        const mesText = messageElement.closest('.mes')?.querySelector('.mes_text') || messageElement;
        mesText.appendChild(container);
    }

    insertAtTop(container, messageElement) {
        const mesText = messageElement.closest('.mes')?.querySelector('.mes_text') || messageElement;
        mesText.insertBefore(container, mesText.firstChild);
    }

    insertAtSide(container, messageElement, side) {
        const mesBlock = messageElement.closest('.mes');
        if (mesBlock) {
            // Ensure message has relative positioning for absolute positioning to work
            mesBlock.style.position = 'relative';
            mesBlock.appendChild(container);
        } else {
            this.insertAtEnd(container, messageElement);
        }
    }

    insertBelow(container, messageElement) {
        const mesBlock = messageElement.closest('.mes');
        if (mesBlock && mesBlock.parentNode) {
            mesBlock.parentNode.insertBefore(container, mesBlock.nextSibling);
        } else {
            this.insertAtEnd(container, messageElement);
        }
    }

    /**
     * Make container moveable and resizable
     */
    makeMoveable(container) {
        container.style.cssText += `
            cursor: move;
            resize: both;
            min-width: 200px;
            min-height: 100px;
        `;

        // Add drag functionality
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        const header = document.createElement('div');
        header.style.cssText = `
            background: var(--SmartThemeQuoteColor, #f0f0f0);
            margin: -15px -15px 10px -15px;
            padding: 8px 15px;
            cursor: move;
            user-select: none;
            border-radius: 8px 8px 0 0;
            border-bottom: 1px solid var(--SmartThemeBorderColor, #ccc);
        `;
        header.innerHTML = `
            <span style="font-weight: bold;">${this.metadata.displayName || this.id}</span>
            <button style="float: right; background: none; border: none; cursor: pointer;" onclick="this.closest('.ember-asset-pack-container').remove()">×</button>
        `;

        // Create event handlers
        const mouseDownHandler = (e) => {
            isDragging = true;
            const rect = container.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            e.preventDefault();
        };

        const mouseMoveHandler = (e) => {
            if (isDragging) {
                container.style.position = 'fixed';
                container.style.left = (e.clientX - dragOffset.x) + 'px';
                container.style.top = (e.clientY - dragOffset.y) + 'px';
                container.style.zIndex = '1000';
            }
        };

        const mouseUpHandler = () => {
            isDragging = false;
        };

        // Add event listeners
        header.addEventListener('mousedown', mouseDownHandler);
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        // Store event listeners for cleanup
        const instance = this.activeInstances.get(instanceId);
        if (instance) {
            instance.domEventListeners = [
                { element: header, event: 'mousedown', handler: mouseDownHandler },
                { element: document, event: 'mousemove', handler: mouseMoveHandler },
                { element: document, event: 'mouseup', handler: mouseUpHandler }
            ];
        }

        container.insertBefore(header, container.firstChild);
    }

    /**
     * Create execution context for pack instance
     */
    createExecutionContext(instanceId, container, messageElement) {
        const context = {
            // Pack info
            packId: this.id,
            instanceId,
            metadata: this.metadata,

            // DOM access
            root: container,
            messageElement,
            document: container.ownerDocument,

            // State management
            getState: (varName) => this.getStateVariable(varName),
            setState: (varName, value) => this.setStateVariable(varName, value),
            updateState: (updates) => this.updateState(updates),
            getStateHistory: () => [...this.stateHistory],

            // AI integration
            injectPrompt: (content) => this.injectChatPrompt(content),
            parseAIResponse: (response) => this.parseAIResponse(response),
            getCurrentPrompt: () => this.generateCurrentPrompt(),

            // Event system
            on: (event, callback) => this.addEventListener(instanceId, event, callback),
            emit: (event, data) => this.emitEvent(instanceId, event, data),

            // Utility functions
            log: (...args) => console.log(`[${this.id}:${instanceId}]`, ...args),
            error: (...args) => console.error(`[${this.id}:${instanceId}]`, ...args)
        };

        return context;
    }

    /**
     * Execute pack code in sandboxed environment
     */
    async execute(context) {
        const sandboxGlobals = {
            // Standard globals
            console: {
                log: context.log,
                error: context.error,
                warn: (...args) => console.warn(`[${this.id}]`, ...args),
                info: (...args) => console.info(`[${this.id}]`, ...args)
            },
            setTimeout,
            setInterval,
            clearTimeout,
            clearInterval,

            // Pack context
            ...context,

            // Additional safe APIs
            fetch: this.createSecureFetch(),
            JSON,
            Math,
            Date
        };

        const sandbox = `
            (function(${Object.keys(sandboxGlobals).join(', ')}) {
                "use strict";

                ${this.content}

                // Return pack instance
                return (typeof exports !== 'undefined') ? exports : {};
            })
        `;

        try {
            console.log(`[AssetPack ${this.id}] Executing content, container:`, context.root);
            const executor = eval(sandbox);
            const result = await executor(...Object.values(sandboxGlobals));

            // Debug: Check if container has content after execution
            console.log(`[AssetPack ${this.id}] Post-execution container children:`, context.root.children.length);
            console.log(`[AssetPack ${this.id}] Container innerHTML length:`, context.root.innerHTML.length);

            return result;
        } catch (error) {
            console.error(`[AssetPack ${this.id}] Execution error:`, error);
            console.error(`[AssetPack ${this.id}] Sandbox code:`, sandbox);
            throw error;
        }
    }

    /**
     * State management methods
     */
    getStateVariable(varName) {
        return this.currentState[varName];
    }

    setStateVariable(varName, value) {
        const varDef = this.stateSchema.variables?.[varName];
        if (!varDef) {
            console.warn(`[AssetPack ${this.id}] Unknown state variable: ${varName}`);
            return false;
        }

        const oldValue = this.currentState[varName];
        const newValue = this.coerceValue(value, varDef.type);

        // Apply constraints
        if (varDef.min !== undefined && newValue < varDef.min) {
            newValue = varDef.min;
        }
        if (varDef.max !== undefined && newValue > varDef.max) {
            newValue = varDef.max;
        }

        this.currentState[varName] = newValue;

        // Record state change
        this.stateHistory.push({
            timestamp: Date.now(),
            variable: varName,
            oldValue,
            newValue,
            source: 'manual'
        });

        this.emitEvent('all', 'stateChanged', { varName, oldValue, newValue });
        return true;
    }

    updateState(updates) {
        const changes = {};

        for (const [varName, change] of Object.entries(updates)) {
            const oldValue = this.currentState[varName];

            if (typeof change === 'string' && (change.startsWith('+') || change.startsWith('-'))) {
                // Relative change (e.g., "+5", "-2")
                const delta = parseFloat(change);
                const newValue = (oldValue || 0) + delta;
                this.setStateVariable(varName, newValue);
                changes[varName] = { oldValue, newValue, delta };
            } else if (Array.isArray(oldValue) && typeof change === 'string' && change.startsWith('+')) {
                // Array addition (e.g., "+chocolate")
                const item = change.slice(1);
                if (!oldValue.includes(item)) {
                    this.setStateVariable(varName, [...oldValue, item]);
                    changes[varName] = { oldValue, newValue: this.currentState[varName], added: item };
                }
            } else if (Array.isArray(oldValue) && typeof change === 'string' && change.startsWith('-')) {
                // Array removal (e.g., "-spiders")
                const item = change.slice(1);
                const newValue = oldValue.filter(i => i !== item);
                this.setStateVariable(varName, newValue);
                changes[varName] = { oldValue, newValue, removed: item };
            } else {
                // Direct assignment
                this.setStateVariable(varName, change);
                changes[varName] = { oldValue, newValue: this.currentState[varName] };
            }
        }

        return changes;
    }

    /**
     * AI Integration methods
     */
    generateCurrentPrompt() {
        if (!this.chatInjection.template) return '';

        let prompt = this.chatInjection.template;

        // Replace variables in template
        for (const [varName, value] of Object.entries(this.currentState)) {
            const placeholder = new RegExp(`{{${varName}}}`, 'g');

            if (Array.isArray(value)) {
                prompt = prompt.replace(placeholder, value.join(', '));
            } else {
                prompt = prompt.replace(placeholder, String(value));
            }
        }

        return prompt;
    }

    parseAIResponse(response) {
        if (!this.chatInjection.stateUpdateFormat) return {};

        const format = this.chatInjection.stateUpdateFormat;
        const startTag = format.split('....')[0];
        const endTag = format.split('....')[1];

        const startIndex = response.indexOf(startTag);
        if (startIndex === -1) return {};

        const endIndex = response.indexOf(endTag, startIndex);
        if (endIndex === -1) return {};

        const updateSection = response.slice(startIndex + startTag.length, endIndex).trim();
        const updates = {};

        // Parse state update lines
        const lines = updateSection.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Match patterns like "VarAffection: +5" or "LikeArray: +chocolate"
            const match = trimmed.match(/^(\w+):\s*([+-]?\w+)(?:\s|$)/);
            if (match) {
                const [, varName, change] = match;
                updates[varName] = change;
            }
        }

        if (Object.keys(updates).length > 0) {
            console.log(`[AssetPack ${this.id}] Parsed AI state updates:`, updates);
            const changes = this.updateState(updates);

            // Update state history with AI source
            for (const change of Object.values(changes)) {
                this.stateHistory[this.stateHistory.length - 1].source = 'ai';
            }
        }

        return updates;
    }

    /**
     * Remove STATE_UPDATE tags from text after parsing
     */
    removeStateUpdateTags(text) {
        if (!this.chatInjection.stateUpdateFormat) return text;

        const format = this.chatInjection.stateUpdateFormat;
        const startTag = format.split('....')[0];
        const endTag = format.split('....')[1];

        // Create regex pattern to match the entire STATE_UPDATE block
        const escapedStart = startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedEnd = endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Pattern matches: [STATE_UPDATE] ... [/STATE_UPDATE] including newlines
        const pattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, 'gi');

        const cleanedText = text.replace(pattern, '').trim();

        // Clean up extra whitespace that might be left behind
        const finalText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

        if (cleanedText !== text) {
            console.log(`[AssetPack ${this.id}] Removed STATE_UPDATE tags from text`);
        }

        return finalText;
    }

    /**
     * Static method to clean STATE_UPDATE tags with common formats
     */
    static removeAllStateUpdateTags(text) {
        // Common STATE_UPDATE formats
        const commonFormats = [
            '[STATE_UPDATE]....[/STATE_UPDATE]',
            '[ASSET_UPDATE]....[/ASSET_UPDATE]',
            '[PACK_UPDATE]....[/PACK_UPDATE]',
            '[UPDATE]....[/UPDATE]'
        ];

        let cleanedText = text;

        for (const format of commonFormats) {
            const [startTag, endTag] = format.split('....');
            const escapedStart = startTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedEnd = endTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Pattern matches the entire block including newlines
            const pattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, 'gi');
            cleanedText = cleanedText.replace(pattern, '');
        }

        // Clean up extra whitespace
        cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

        return cleanedText;
    }

    injectChatPrompt(content) {
        // Inject content into SillyTavern's context
        if (window.SillyTavern?.SlashCommands) {
            const command = `/inject id="${this.id}_prompt" depth=0 content="${content.replace(/"/g, '\\"')}"`;

            try {
                window.SillyTavern.SlashCommands.executeCommand(command);
                console.log(`[AssetPack ${this.id}] Injected prompt:`, content);
            } catch (error) {
                console.error(`[AssetPack ${this.id}] Failed to inject prompt:`, error);
            }
        }
    }

    /**
     * Event system
     */
    addEventListener(instanceId, event, callback) {
        const key = `${instanceId}:${event}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, new Set());
        }
        this.eventListeners.get(key).add(callback);
    }

    emitEvent(instanceId, event, data) {
        const key = `${instanceId}:${event}`;
        const listeners = this.eventListeners.get(key);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[AssetPack ${this.id}] Event callback error:`, error);
                }
            }
        }

        // Also emit to 'all' listeners
        const allKey = `all:${event}`;
        const allListeners = this.eventListeners.get(allKey);
        if (allListeners) {
            for (const callback of allListeners) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[AssetPack ${this.id}] Event callback error:`, error);
                }
            }
        }
    }

    /**
     * Utility methods
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
                return typeof value === 'object' && value !== null ? value : {};
            default:
                return value;
        }
    }

    createSecureFetch() {
        return async (url, options = {}) => {
            if (!url.startsWith('https://')) {
                throw new Error(`[${this.id}] Only HTTPS URLs are allowed`);
            }

            const secureOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    'X-Ember-Pack': this.id
                }
            };

            return fetch(url, secureOptions);
        };
    }

    /**
     * Cleanup pack instance
     */
    cleanup(instanceId) {
        const instance = this.activeInstances.get(instanceId);
        if (instance) {
            // Unregister position occupation
            this.unregisterPosition(instance.messageId);

            // Remove DOM event listeners
            if (instance.domEventListeners) {
                for (const listener of instance.domEventListeners) {
                    listener.element.removeEventListener(listener.event, listener.handler);
                }
            }

            // Remove DOM element
            if (instance.container && instance.container.parentNode) {
                instance.container.parentNode.removeChild(instance.container);
            }

            // Remove custom event listeners
            for (const key of this.eventListeners.keys()) {
                if (key.startsWith(`${instanceId}:`)) {
                    this.eventListeners.delete(key);
                }
            }

            this.activeInstances.delete(instanceId);
            console.log(`[AssetPack ${this.id}] Cleaned up instance: ${instanceId}`);
        }
    }

    /**
     * Get pack info for serialization
     */
    toJSON() {
        return {
            id: this.id,
            metadata: this.metadata,
            content: this.content,
            htmlContent: this.htmlContent,
            cssContent: this.cssContent,
            assets: this.assets,
            stateSchema: this.stateSchema,
            aiIntegration: this.aiIntegration,
            positioning: this.positioning,
            chatInjection: this.chatInjection
        };
    }
}