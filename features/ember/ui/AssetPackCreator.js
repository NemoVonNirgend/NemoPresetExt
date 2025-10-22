// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - Asset Pack Creator UI
// Visual editor for creating custom asset packs

import { AssetPackAI } from './AssetPackAI.js';

export class AssetPackCreator {
    constructor() {
        this.currentPack = null;
        this.previewContainer = null;
        this.isOpen = false;
        this.aiAssistant = new AssetPackAI(this);
    }

    /**
     * Open the asset pack creator modal
     */
    open(existingPack = null) {
        if (this.isOpen) return;

        this.currentPack = existingPack || this.createDefaultPack();
        this.isOpen = true;

        const modal = this.createModal();
        document.body.appendChild(modal);

        // Focus the pack name input
        setTimeout(() => {
            const nameInput = modal.querySelector('#ember-pack-name');
            if (nameInput) nameInput.focus();
        }, 100);
    }

    /**
     * Close the creator modal
     */
    close() {
        const modal = document.getElementById('ember-pack-creator-modal');
        if (modal) {
            modal.remove();
        }
        this.isOpen = false;
        this.currentPack = null;
    }

    /**
     * Create default pack structure
     */
    createDefaultPack() {
        return {
            id: 'my-asset-pack',
            metadata: {
                name: 'my-asset-pack',
                displayName: 'My Asset Pack',
                version: '1.0.0',
                description: 'A custom asset pack',
                author: 'User',
                tags: []
            },
            stateSchema: {
                variables: {}
            },
            chatInjection: {
                template: '',
                stateUpdateFormat: '[STATE_UPDATE]....[/STATE_UPDATE]',
                instructions: ''
            },
            positioning: {
                type: 'end'
            },
            content: '// Your asset pack code goes here\nlog("Asset pack loaded!");'
        };
    }

    /**
     * Create the main creator modal
     */
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'ember-pack-creator-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(5px);
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--SmartThemeBodyColor, #fff);
            border-radius: 15px;
            width: 90%;
            max-width: 1200px;
            height: 90%;
            max-height: 800px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
            border: 1px solid var(--SmartThemeBorderColor, #ccc);
        `;

        // Header
        const header = this.createHeader();
        content.appendChild(header);

        // AI Assistant (top of main content)
        const aiAssistant = this.aiAssistant.createAssistantUI();
        content.appendChild(aiAssistant);

        // Main content area
        const mainContent = document.createElement('div');
        mainContent.style.cssText = `
            flex: 1;
            display: flex;
            overflow: hidden;
        `;

        // Left panel - Editor
        const leftPanel = this.createLeftPanel();
        mainContent.appendChild(leftPanel);

        // Right panel - Preview
        const rightPanel = this.createRightPanel();
        mainContent.appendChild(rightPanel);

        content.appendChild(mainContent);

        // Footer
        const footer = this.createFooter();
        content.appendChild(footer);

        modal.appendChild(content);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close();
            }
        });

        return modal;
    }

    /**
     * Create header with title and basic info
     */
    createHeader() {
        const header = document.createElement('div');
        header.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        header.innerHTML = `
            <div>
                <h2 style="margin: 0; font-size: 24px;">🔧 Asset Pack Creator</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Create interactive experiences for SillyTavern</p>
            </div>
            <button id="ember-creator-close" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                font-size: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">×</button>
        `;

        header.querySelector('#ember-creator-close').addEventListener('click', () => {
            this.close();
        });

        return header;
    }

    /**
     * Create left panel with editors
     */
    createLeftPanel() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            width: 60%;
            border-right: 1px solid var(--SmartThemeBorderColor, #ccc);
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        // Tab navigation
        const tabs = this.createTabs();
        panel.appendChild(tabs);

        // Tab content
        const tabContent = document.createElement('div');
        tabContent.id = 'ember-tab-content';
        tabContent.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        `;

        // Show basic info tab by default
        tabContent.appendChild(this.createBasicInfoTab());
        panel.appendChild(tabContent);

        return panel;
    }

    /**
     * Create tab navigation
     */
    createTabs() {
        const tabContainer = document.createElement('div');
        tabContainer.style.cssText = `
            display: flex;
            background: var(--SmartThemeQuoteColor, #f5f5f5);
            border-bottom: 1px solid var(--SmartThemeBorderColor, #ccc);
        `;

        const tabs = [
            { id: 'basic', label: '📝 Basic Info', active: true },
            { id: 'variables', label: '📊 Variables' },
            { id: 'ai', label: '🤖 AI Integration' },
            { id: 'code', label: '💻 Code' },
            { id: 'positioning', label: '📍 Positioning' }
        ];

        tabs.forEach(tab => {
            const button = document.createElement('button');
            button.style.cssText = `
                background: ${tab.active ? 'var(--SmartThemeBodyColor, #fff)' : 'transparent'};
                border: none;
                padding: 15px 20px;
                cursor: pointer;
                border-bottom: ${tab.active ? '2px solid #667eea' : 'none'};
                color: var(--SmartThemeEmColor, #333);
                font-weight: ${tab.active ? 'bold' : 'normal'};
            `;

            button.textContent = tab.label;
            button.addEventListener('click', () => this.switchTab(tab.id));

            tabContainer.appendChild(button);
        });

        return tabContainer;
    }

    /**
     * Switch between tabs
     */
    switchTab(tabId) {
        // Update tab buttons
        const tabs = document.querySelectorAll('#ember-pack-creator-modal button');
        tabs.forEach(tab => {
            const isActive = tab.textContent.includes(this.getTabLabel(tabId));
            tab.style.background = isActive ? 'var(--SmartThemeBodyColor, #fff)' : 'transparent';
            tab.style.borderBottom = isActive ? '2px solid #667eea' : 'none';
            tab.style.fontWeight = isActive ? 'bold' : 'normal';
        });

        // Update content
        const content = document.getElementById('ember-tab-content');
        content.innerHTML = '';

        switch (tabId) {
            case 'basic':
                content.appendChild(this.createBasicInfoTab());
                break;
            case 'variables':
                content.appendChild(this.createVariablesTab());
                break;
            case 'ai':
                content.appendChild(this.createAITab());
                break;
            case 'code':
                content.appendChild(this.createCodeTab());
                break;
            case 'positioning':
                content.appendChild(this.createPositioningTab());
                break;
        }
    }

    getTabLabel(tabId) {
        const labels = {
            basic: '📝 Basic Info',
            variables: '📊 Variables',
            ai: '🤖 AI Integration',
            code: '💻 Code',
            positioning: '📍 Positioning'
        };
        return labels[tabId] || '';
    }

    /**
     * Create basic info tab
     */
    createBasicInfoTab() {
        const container = document.createElement('div');

        container.innerHTML = `
            <h3>Basic Information</h3>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Pack ID:</label>
                <input type="text" id="ember-pack-id" value="${this.currentPack.id}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--SmartThemeBorderColor, #ccc);
                    border-radius: 5px;
                    box-sizing: border-box;
                ">
                <small style="color: #666;">Unique identifier (no spaces, lowercase)</small>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Display Name:</label>
                <input type="text" id="ember-pack-display-name" value="${this.currentPack.metadata.displayName}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--SmartThemeBorderColor, #ccc);
                    border-radius: 5px;
                    box-sizing: border-box;
                ">
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description:</label>
                <textarea id="ember-pack-description" style="
                    width: 100%;
                    height: 80px;
                    padding: 10px;
                    border: 1px solid var(--SmartThemeBorderColor, #ccc);
                    border-radius: 5px;
                    box-sizing: border-box;
                    resize: vertical;
                ">${this.currentPack.metadata.description}</textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Version:</label>
                    <input type="text" id="ember-pack-version" value="${this.currentPack.metadata.version}" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid var(--SmartThemeBorderColor, #ccc);
                        border-radius: 5px;
                        box-sizing: border-box;
                    ">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Author:</label>
                    <input type="text" id="ember-pack-author" value="${this.currentPack.metadata.author}" style="
                        width: 100%;
                        padding: 10px;
                        border: 1px solid var(--SmartThemeBorderColor, #ccc);
                        border-radius: 5px;
                        box-sizing: border-box;
                    ">
                </div>
            </div>

            <div style="margin-top: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Tags (comma-separated):</label>
                <input type="text" id="ember-pack-tags" value="${(this.currentPack.metadata.tags || []).join(', ')}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--SmartThemeBorderColor, #ccc);
                    border-radius: 5px;
                    box-sizing: border-box;
                ">
                <small style="color: #666;">e.g., dating, stats, interactive</small>
            </div>
        `;

        // Add event listeners to update pack data
        const inputs = container.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updatePackData());
        });

        return container;
    }

    /**
     * Create variables tab
     */
    createVariablesTab() {
        const container = document.createElement('div');

        container.innerHTML = `
            <h3>State Variables</h3>
            <p style="color: #666; margin-bottom: 20px;">Define variables that persist throughout the conversation and can be updated by AI responses.</p>

            <div id="ember-variables-list" style="margin-bottom: 20px;">
                <!-- Variables will be populated here -->
            </div>

            <button id="ember-add-variable" style="
                background: #667eea;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
            ">+ Add Variable</button>
        `;

        // Populate existing variables
        this.updateVariablesList(container);

        // Add variable button
        container.querySelector('#ember-add-variable').addEventListener('click', () => {
            this.addVariable(container);
        });

        return container;
    }

    /**
     * Create AI integration tab
     */
    createAITab() {
        const container = document.createElement('div');

        container.innerHTML = `
            <h3>AI Integration</h3>
            <p style="color: #666; margin-bottom: 20px;">Configure how the AI interacts with your asset pack's state variables.</p>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Chat Injection Template:</label>
                <textarea id="ember-ai-template" style="
                    width: 100%;
                    height: 200px;
                    padding: 10px;
                    border: 1px solid var(--SmartThemeBorderColor, #ccc);
                    border-radius: 5px;
                    box-sizing: border-box;
                    font-family: monospace;
                    resize: vertical;
                " placeholder="Use {{VariableName}} to inject variable values into the AI's context">${this.currentPack.chatInjection.template}</textarea>
                <small style="color: #666;">This text is injected into the AI's context. Use {{VariableName}} for variable substitution.</small>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">AI Instructions:</label>
                <textarea id="ember-ai-instructions" style="
                    width: 100%;
                    height: 120px;
                    padding: 10px;
                    border: 1px solid var(--SmartThemeBorderColor, #ccc);
                    border-radius: 5px;
                    box-sizing: border-box;
                    resize: vertical;
                " placeholder="Instructions for the AI on how to use the state variables">${this.currentPack.chatInjection.instructions}</textarea>
                <small style="color: #666;">Tell the AI how to interpret and update the state variables.</small>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">State Update Format:</label>
                <input type="text" id="ember-ai-format" value="${this.currentPack.chatInjection.stateUpdateFormat}" style="
                    width: 100%;
                    padding: 10px;
                    border: 1px solid var(--SmartThemeBorderColor, #ccc);
                    border-radius: 5px;
                    box-sizing: border-box;
                ">
                <small style="color: #666;">Format for AI to specify state changes. Use .... as placeholder for content.</small>
            </div>
        `;

        // Add event listeners
        const inputs = container.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updatePackData());
        });

        return container;
    }

    /**
     * Create code editor tab
     */
    createCodeTab() {
        const container = document.createElement('div');

        container.innerHTML = `
            <h3>Asset Pack Code</h3>
            <p style="color: #666; margin-bottom: 20px;">Write the JavaScript code that creates your interactive interface.</p>

            <div style="margin-bottom: 10px;">
                <strong>Available Functions:</strong>
                <ul style="margin: 5px 0; padding-left: 20px; font-size: 14px; color: #666;">
                    <li><code>getState(varName)</code> - Get variable value</li>
                    <li><code>setState(varName, value)</code> - Set variable value</li>
                    <li><code>updateState(updates)</code> - Update multiple variables</li>
                    <li><code>injectPrompt(content)</code> - Send content to AI context</li>
                    <li><code>root</code> - Container element to append your UI to</li>
                    <li><code>log(...args)</code> - Console logging</li>
                </ul>
            </div>

            <textarea id="ember-pack-code" style="
                width: 100%;
                height: 400px;
                padding: 15px;
                border: 1px solid var(--SmartThemeBorderColor, #ccc);
                border-radius: 5px;
                box-sizing: border-box;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.5;
                resize: vertical;
            " placeholder="// Your asset pack code goes here
const container = document.createElement('div');
container.innerHTML = '<h3>Hello from my asset pack!</h3>';
root.appendChild(container);">${this.currentPack.content}</textarea>
        `;

        // Add event listener
        container.querySelector('#ember-pack-code').addEventListener('input', () => {
            this.updatePackData();
        });

        return container;
    }

    /**
     * Create positioning tab
     */
    createPositioningTab() {
        const container = document.createElement('div');

        const positions = [
            { value: 'end', label: 'End of Message', description: 'Appears after the message content' },
            { value: 'top', label: 'Top of Message', description: 'Appears before the message content' },
            { value: 'left', label: 'Left Side', description: 'Positioned to the left of the message' },
            { value: 'right', label: 'Right Side', description: 'Positioned to the right of the message' },
            { value: 'below', label: 'Below Message', description: 'Appears below the entire message block' },
            { value: 'moveable', label: 'Moveable', description: 'Draggable and resizable container' },
            { value: 'sticky', label: 'Sticky', description: 'Fixed position on screen' }
        ];

        container.innerHTML = `
            <h3>Positioning</h3>
            <p style="color: #666; margin-bottom: 20px;">Choose where your asset pack appears in relation to messages.</p>

            <div id="ember-position-options">
                ${positions.map(pos => `
                    <label style="
                        display: block;
                        margin-bottom: 15px;
                        padding: 15px;
                        border: 1px solid var(--SmartThemeBorderColor, #ccc);
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    " class="position-option" data-value="${pos.value}">
                        <input type="radio" name="ember-position" value="${pos.value}"
                               ${this.currentPack.positioning.type === pos.value ? 'checked' : ''}
                               style="margin-right: 10px;">
                        <strong>${pos.label}</strong>
                        <div style="color: #666; margin-top: 5px; font-size: 14px;">${pos.description}</div>
                    </label>
                `).join('')}
            </div>
        `;

        // Add event listeners
        const radioButtons = container.querySelectorAll('input[name="ember-position"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                this.updatePackData();

                // Update visual selection
                container.querySelectorAll('.position-option').forEach(option => {
                    option.style.background = option.dataset.value === radio.value ?
                        'var(--SmartThemeQuoteColor, #f5f5f5)' : 'transparent';
                    option.style.borderColor = option.dataset.value === radio.value ?
                        '#667eea' : 'var(--SmartThemeBorderColor, #ccc)';
                });
            });
        });

        // Set initial visual state
        const selectedOption = container.querySelector(`[data-value="${this.currentPack.positioning.type}"]`);
        if (selectedOption) {
            selectedOption.style.background = 'var(--SmartThemeQuoteColor, #f5f5f5)';
            selectedOption.style.borderColor = '#667eea';
        }

        return container;
    }

    /**
     * Create right panel with preview
     */
    createRightPanel() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            width: 40%;
            display: flex;
            flex-direction: column;
            background: var(--SmartThemeQuoteColor, #f5f5f5);
        `;

        // Preview header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px;
            border-bottom: 1px solid var(--SmartThemeBorderColor, #ccc);
            background: var(--SmartThemeBodyColor, #fff);
        `;

        header.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">Live Preview</h3>
            <button id="ember-refresh-preview" style="
                background: #667eea;
                color: white;
                border: none;
                padding: 8px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            ">🔄 Refresh Preview</button>
        `;

        panel.appendChild(header);

        // Preview container
        this.previewContainer = document.createElement('div');
        this.previewContainer.style.cssText = `
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            background: white;
            margin: 10px;
            border-radius: 8px;
            border: 1px solid var(--SmartThemeBorderColor, #ccc);
        `;

        panel.appendChild(this.previewContainer);

        // Refresh button event
        header.querySelector('#ember-refresh-preview').addEventListener('click', () => {
            this.refreshPreview();
        });

        // Initial preview
        this.refreshPreview();

        return panel;
    }

    /**
     * Create footer with action buttons
     */
    createFooter() {
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 20px;
            border-top: 1px solid var(--SmartThemeBorderColor, #ccc);
            background: var(--SmartThemeQuoteColor, #f5f5f5);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        footer.innerHTML = `
            <div>
                <button id="ember-load-template" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-right: 10px;
                ">📋 Load Template</button>

                <button id="ember-import-pack" style="
                    background: #17a2b8;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">📥 Import Pack</button>
            </div>

            <div>
                <button id="ember-export-pack" style="
                    background: #ffc107;
                    color: #333;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-right: 10px;
                ">📤 Export</button>

                <button id="ember-test-pack" style="
                    background: #6f42c1;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-right: 10px;
                ">🧪 Test</button>

                <button id="ember-save-pack" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                ">💾 Save & Register</button>
            </div>
        `;

        // Add event listeners
        footer.querySelector('#ember-save-pack').addEventListener('click', () => this.savePack());
        footer.querySelector('#ember-export-pack').addEventListener('click', () => this.exportPack());
        footer.querySelector('#ember-test-pack').addEventListener('click', () => this.testPack());
        footer.querySelector('#ember-load-template').addEventListener('click', () => this.loadTemplate());
        footer.querySelector('#ember-import-pack').addEventListener('click', () => this.importPack());

        return footer;
    }

    /**
     * Update pack data from form inputs
     */
    updatePackData() {
        const modal = document.getElementById('ember-pack-creator-modal');
        if (!modal) return;

        // Basic info
        const getId = (id) => modal.querySelector(id);

        if (getId('#ember-pack-id')) {
            this.currentPack.id = getId('#ember-pack-id').value;
            this.currentPack.metadata.name = getId('#ember-pack-id').value;
        }

        if (getId('#ember-pack-display-name')) {
            this.currentPack.metadata.displayName = getId('#ember-pack-display-name').value;
        }

        if (getId('#ember-pack-description')) {
            this.currentPack.metadata.description = getId('#ember-pack-description').value;
        }

        if (getId('#ember-pack-version')) {
            this.currentPack.metadata.version = getId('#ember-pack-version').value;
        }

        if (getId('#ember-pack-author')) {
            this.currentPack.metadata.author = getId('#ember-pack-author').value;
        }

        if (getId('#ember-pack-tags')) {
            const tags = getId('#ember-pack-tags').value.split(',').map(t => t.trim()).filter(t => t);
            this.currentPack.metadata.tags = tags;
        }

        // AI integration
        if (getId('#ember-ai-template')) {
            this.currentPack.chatInjection.template = getId('#ember-ai-template').value;
        }

        if (getId('#ember-ai-instructions')) {
            this.currentPack.chatInjection.instructions = getId('#ember-ai-instructions').value;
        }

        if (getId('#ember-ai-format')) {
            this.currentPack.chatInjection.stateUpdateFormat = getId('#ember-ai-format').value;
        }

        // Code
        if (getId('#ember-pack-code')) {
            this.currentPack.content = getId('#ember-pack-code').value;
        }

        // Positioning
        const positionRadio = modal.querySelector('input[name="ember-position"]:checked');
        if (positionRadio) {
            this.currentPack.positioning.type = positionRadio.value;
        }

        // Variables are updated separately in their own handlers
    }

    /**
     * Update variables list
     */
    updateVariablesList(container) {
        const list = container.querySelector('#ember-variables-list');
        list.innerHTML = '';

        Object.entries(this.currentPack.stateSchema.variables).forEach(([name, def], index) => {
            const varDiv = this.createVariableEditor(name, def, index);
            list.appendChild(varDiv);
        });
    }

    /**
     * Create variable editor
     */
    createVariableEditor(name, def, index) {
        const div = document.createElement('div');
        div.style.cssText = `
            border: 1px solid var(--SmartThemeBorderColor, #ccc);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            background: var(--SmartThemeBodyColor, #fff);
        `;

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h4 style="margin: 0;">Variable ${index + 1}</h4>
                <button class="remove-variable" data-name="${name}" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 25px;
                    height: 25px;
                    cursor: pointer;
                    font-size: 12px;
                ">×</button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Name:</label>
                    <input type="text" class="var-name" value="${name}" data-old-name="${name}" style="
                        width: 100%;
                        padding: 8px;
                        border: 1px solid var(--SmartThemeBorderColor, #ccc);
                        border-radius: 5px;
                        box-sizing: border-box;
                    ">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Type:</label>
                    <select class="var-type" style="
                        width: 100%;
                        padding: 8px;
                        border: 1px solid var(--SmartThemeBorderColor, #ccc);
                        border-radius: 5px;
                        box-sizing: border-box;
                    ">
                        <option value="number" ${def.type === 'number' ? 'selected' : ''}>Number</option>
                        <option value="string" ${def.type === 'string' ? 'selected' : ''}>String</option>
                        <option value="boolean" ${def.type === 'boolean' ? 'selected' : ''}>Boolean</option>
                        <option value="array" ${def.type === 'array' ? 'selected' : ''}>Array</option>
                        <option value="object" ${def.type === 'object' ? 'selected' : ''}>Object</option>
                    </select>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Default Value:</label>
                <input type="text" class="var-default" value="${JSON.stringify(def.default)}" style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--SmartThemeBorderColor, #ccc);
                    border-radius: 5px;
                    box-sizing: border-box;
                ">
                <small style="color: #666;">For arrays/objects, use JSON format</small>
            </div>

            ${def.type === 'number' ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Min:</label>
                        <input type="number" class="var-min" value="${def.min || ''}" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid var(--SmartThemeBorderColor, #ccc);
                            border-radius: 5px;
                            box-sizing: border-box;
                        ">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">Max:</label>
                        <input type="number" class="var-max" value="${def.max || ''}" style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid var(--SmartThemeBorderColor, #ccc);
                            border-radius: 5px;
                            box-sizing: border-box;
                        ">
                    </div>
                </div>
            ` : ''}

            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description:</label>
                <input type="text" class="var-description" value="${def.description || ''}" style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--SmartThemeBorderColor, #ccc);
                    border-radius: 5px;
                    box-sizing: border-box;
                ">
            </div>
        `;

        // Add event listeners
        div.querySelector('.remove-variable').addEventListener('click', (e) => {
            const varName = e.target.dataset.name;
            delete this.currentPack.stateSchema.variables[varName];
            div.remove();
        });

        div.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', () => this.updateVariableFromEditor(div));
        });

        return div;
    }

    /**
     * Add new variable
     */
    addVariable(container) {
        const newName = `Variable${Object.keys(this.currentPack.stateSchema.variables).length + 1}`;
        this.currentPack.stateSchema.variables[newName] = {
            type: 'number',
            default: 0,
            description: ''
        };

        this.updateVariablesList(container);
    }

    /**
     * Update variable from editor
     */
    updateVariableFromEditor(editorDiv) {
        const nameInput = editorDiv.querySelector('.var-name');
        const oldName = nameInput.dataset.oldName;
        const newName = nameInput.value;

        const type = editorDiv.querySelector('.var-type').value;
        const defaultValue = editorDiv.querySelector('.var-default').value;
        const description = editorDiv.querySelector('.var-description').value;

        // Parse default value
        let parsedDefault;
        try {
            parsedDefault = JSON.parse(defaultValue);
        } catch {
            parsedDefault = type === 'number' ? 0 : type === 'boolean' ? false : type === 'array' ? [] : type === 'object' ? {} : '';
        }

        // Create new variable definition
        const varDef = {
            type,
            default: parsedDefault,
            description
        };

        // Add min/max for numbers
        if (type === 'number') {
            const minInput = editorDiv.querySelector('.var-min');
            const maxInput = editorDiv.querySelector('.var-max');

            if (minInput && minInput.value !== '') {
                varDef.min = parseFloat(minInput.value);
            }
            if (maxInput && maxInput.value !== '') {
                varDef.max = parseFloat(maxInput.value);
            }
        }

        // Update variables object
        if (oldName !== newName) {
            delete this.currentPack.stateSchema.variables[oldName];
            nameInput.dataset.oldName = newName;
        }

        this.currentPack.stateSchema.variables[newName] = varDef;
    }

    /**
     * Refresh preview
     */
    refreshPreview() {
        if (!this.previewContainer) return;

        this.previewContainer.innerHTML = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0;">${this.currentPack.metadata.displayName}</h4>
                <p style="margin: 0; color: #666;">${this.currentPack.metadata.description}</p>
                <div style="margin-top: 10px; font-size: 12px; color: #999;">
                    v${this.currentPack.metadata.version} by ${this.currentPack.metadata.author}
                </div>
            </div>

            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h5 style="margin: 0 0 10px 0;">📊 Variables (${Object.keys(this.currentPack.stateSchema.variables).length})</h5>
                ${Object.keys(this.currentPack.stateSchema.variables).length > 0
                    ? Object.entries(this.currentPack.stateSchema.variables).map(([name, def]) =>
                        `<div style="margin: 5px 0; font-size: 14px;">
                            <strong>${name}</strong>: ${def.type}
                            ${def.type === 'number' && (def.min !== undefined || def.max !== undefined)
                                ? ` (${def.min || 0}-${def.max || '∞'})`
                                : ''}
                        </div>`
                    ).join('')
                    : '<div style="color: #666; font-style: italic;">No variables defined</div>'
                }
            </div>

            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h5 style="margin: 0 0 10px 0;">🤖 AI Integration</h5>
                <div style="font-size: 14px;">
                    <div><strong>Position:</strong> ${this.currentPack.positioning.type}</div>
                    <div><strong>Template:</strong> ${this.currentPack.chatInjection.template ? 'Configured' : 'Not configured'}</div>
                    <div><strong>State Updates:</strong> ${this.currentPack.chatInjection.stateUpdateFormat || 'Default'}</div>
                </div>
            </div>

            <div style="background: #f3e5f5; padding: 15px; border-radius: 8px;">
                <h5 style="margin: 0 0 10px 0;">💻 Code</h5>
                <div style="font-size: 14px; color: #666;">
                    ${this.currentPack.content.length} characters
                    ${this.currentPack.content.includes('createElement') ? '• Uses DOM' : ''}
                    ${this.currentPack.content.includes('addEventListener') ? '• Has events' : ''}
                    ${this.currentPack.content.includes('getState') ? '• Reads state' : ''}
                    ${this.currentPack.content.includes('setState') ? '• Updates state' : ''}
                </div>
            </div>
        `;
    }

    /**
     * Save and register pack
     */
    savePack() {
        this.updatePackData();

        try {
            if (window.ember && window.ember.registerAssetPack) {
                window.ember.registerAssetPack(this.currentPack);
                alert(`Asset pack "${this.currentPack.metadata.displayName}" has been registered!\\n\\nUsage: Add [ASSET_PACK:${this.currentPack.id}] to any message to activate it.`);
                this.close();
            } else {
                alert('Ember system not found. Please ensure the extension is loaded.');
            }
        } catch (error) {
            alert(`Failed to register asset pack: ${error.message}`);
        }
    }

    /**
     * Export pack
     */
    exportPack() {
        this.updatePackData();

        const packData = JSON.stringify(this.currentPack, null, 2);
        const blob = new Blob([packData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentPack.id}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Test pack
     */
    testPack() {
        this.updatePackData();

        // Create a test message element
        const testMessage = document.createElement('div');
        testMessage.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #667eea;
            border-radius: 10px;
            padding: 20px;
            z-index: 20000;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
        `;

        testMessage.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;">🧪 Testing: ${this.currentPack.metadata.displayName}</h3>
                <button id="close-test" style="background: #dc3545; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer;">×</button>
            </div>
            <div id="test-container"></div>
        `;

        document.body.appendChild(testMessage);

        // Close test
        testMessage.querySelector('#close-test').addEventListener('click', () => {
            testMessage.remove();
        });

        try {
            // Register and render the pack for testing
            if (window.ember) {
                const testPack = window.ember.registerAssetPack(this.currentPack);
                const testContainer = testMessage.querySelector('#test-container');

                // Create a mock message element structure
                const mockMessage = document.createElement('div');
                mockMessage.className = 'mes_text';
                testContainer.appendChild(mockMessage);

                window.ember.renderAssetPack(this.currentPack.id, 'test', mockMessage, this.currentPack.positioning.type);
            }
        } catch (error) {
            testMessage.querySelector('#test-container').innerHTML = `
                <div style="color: #dc3545; padding: 20px; background: #f8d7da; border-radius: 5px;">
                    <strong>Test Error:</strong><br>
                    ${error.message}
                </div>
            `;
        }
    }

    /**
     * Load template
     */
    loadTemplate() {
        // Simple template selector for now
        const templates = {
            'basic': {
                id: 'basic-pack',
                metadata: {
                    name: 'basic-pack',
                    displayName: 'Basic Pack',
                    description: 'A simple asset pack template',
                    version: '1.0.0',
                    author: 'User'
                },
                stateSchema: { variables: {} },
                chatInjection: { template: '', stateUpdateFormat: '[STATE_UPDATE]....[/STATE_UPDATE]', instructions: '' },
                positioning: { type: 'end' },
                content: '// Basic asset pack\\nconst div = document.createElement("div");\\ndiv.textContent = "Hello from asset pack!";\\nroot.appendChild(div);'
            },
            'counter': {
                id: 'counter-pack',
                metadata: {
                    name: 'counter-pack',
                    displayName: 'Counter Pack',
                    description: 'Simple counter with state tracking',
                    version: '1.0.0',
                    author: 'User'
                },
                stateSchema: {
                    variables: {
                        Counter: {
                            type: 'number',
                            default: 0,
                            min: 0,
                            description: 'Current counter value'
                        }
                    }
                },
                chatInjection: {
                    template: 'Current counter value: {{Counter}}',
                    stateUpdateFormat: '[STATE_UPDATE]....[/STATE_UPDATE]',
                    instructions: 'Update the counter based on user actions'
                },
                positioning: { type: 'end' },
                content: `// Counter pack
const count = getState('Counter') || 0;

const container = document.createElement('div');
container.style.cssText = 'padding: 20px; border: 1px solid #ccc; border-radius: 8px; text-align: center;';

const display = document.createElement('div');
display.style.cssText = 'font-size: 24px; margin-bottom: 15px;';
display.textContent = 'Counter: ' + count;

const btnPlus = document.createElement('button');
btnPlus.textContent = '+';
btnPlus.style.cssText = 'margin: 5px; padding: 10px 15px; font-size: 18px;';
btnPlus.onclick = () => {
    const newCount = count + 1;
    setState('Counter', newCount);
    display.textContent = 'Counter: ' + newCount;
};

const btnMinus = document.createElement('button');
btnMinus.textContent = '-';
btnMinus.style.cssText = 'margin: 5px; padding: 10px 15px; font-size: 18px;';
btnMinus.onclick = () => {
    const newCount = Math.max(0, count - 1);
    setState('Counter', newCount);
    display.textContent = 'Counter: ' + newCount;
};

container.appendChild(display);
container.appendChild(btnMinus);
container.appendChild(btnPlus);
root.appendChild(container);`
            }
        };

        const template = prompt('Select template:\\n1. basic - Basic asset pack\\n2. counter - Counter with state\\n\\nEnter template name:', 'basic');

        if (template && templates[template]) {
            this.currentPack = { ...templates[template] };

            // Refresh all tabs
            this.switchTab('basic');
            alert(`Template "${template}" loaded!`);
        }
    }

    /**
     * Import pack
     */
    importPack() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.js';

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    let packData;

                    if (file.name.endsWith('.json')) {
                        packData = JSON.parse(content);
                    } else {
                        // Try to parse as asset pack format
                        alert('JavaScript import not yet supported. Please use JSON format.');
                        return;
                    }

                    this.currentPack = packData;
                    this.switchTab('basic');
                    alert('Asset pack imported successfully!');
                } catch (error) {
                    alert(`Failed to import pack: ${error.message}`);
                }
            };

            reader.readAsText(file);
        });

        input.click();
    }
}