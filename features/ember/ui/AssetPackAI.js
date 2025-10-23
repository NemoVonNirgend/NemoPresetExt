// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - AI Assistant for Asset Pack Creation
// Helps users design asset packs using AI assistance

import { PresetManager } from '../utils/preset-manager.js';

export class AssetPackAI {
    constructor(creator) {
        this.creator = creator;
        this.isProcessing = false;
        this.conversationHistory = [];
        this.presetManager = new PresetManager();
        this.presetManager.initialize();
    }

    /**
     * Generate comprehensive AI prompt for asset pack creation
     */
    generateSystemPrompt() {
        return `You are an expert Asset Pack Designer for the Ember 2.0 system in SillyTavern. Your job is to help users create interactive asset packs that enhance chat experiences with persistent state and AI integration.

## ASSET PACK SYSTEM OVERVIEW

Asset packs are interactive JavaScript components that:
- Display custom UI elements in chat messages
- Track state variables that persist across the conversation
- Integrate with AI responses to automatically update state
- Support various positioning options (end, top, left, right, below, moveable, sticky)
- Run in secure sandboxed environments

## ASSET PACK STRUCTURE

### 1. METADATA
- **id**: Unique identifier (lowercase, no spaces, e.g., "dating-sim")
- **displayName**: Human-readable name (e.g., "Dating Simulator")
- **description**: Brief description of functionality
- **version**: Version number (e.g., "1.0.0")
- **author**: Creator name
- **tags**: Array of descriptive tags (e.g., ["dating", "stats", "interactive"])

### 2. STATE VARIABLES (stateSchema.variables)
Define persistent variables that track throughout the conversation:

**Variable Types:**
- **number**: Numeric values (support min/max constraints)
- **string**: Text values
- **boolean**: True/false values
- **array**: Lists of items
- **object**: Complex data structures

**Variable Definition:**
\`\`\`json
{
  "VariableName": {
    "type": "number",
    "default": 50,
    "min": 0,
    "max": 100,
    "description": "What this variable represents"
  }
}
\`\`\`

### 3. AI INTEGRATION (chatInjection)
**template**: Text injected into AI context with variable substitution using {{VariableName}}
**stateUpdateFormat**: Format for AI to specify state changes (default: "[STATE_UPDATE]....[/STATE_UPDATE]")
**instructions**: Guidelines for AI on how to use and update variables

**AI State Update Format:**
\`\`\`
[STATE_UPDATE]
VarAffection: +5 (relative change: add 5)
VarTrust: -2 (relative change: subtract 2)
LikeArray: +chocolate (add "chocolate" to array)
DislikeArray: -spiders (remove "spiders" from array)
RelationshipStatus: dating (direct assignment)
[/STATE_UPDATE]
\`\`\`

### 4. POSITIONING
- **end**: After message content (default)
- **top**: Before message content
- **left**: Left side panel
- **right**: Right side panel
- **below**: Below entire message
- **moveable**: Draggable/resizable
- **sticky**: Fixed screen position

### 5. JAVASCRIPT CODE (content)
**Available Functions:**
- \`getState(varName)\` - Get current variable value
- \`setState(varName, value)\` - Set variable value
- \`updateState({VarName: "+5", ArrayName: "+item"})\` - Update multiple variables
- \`injectPrompt(content)\` - Send content to AI context
- \`getCurrentPrompt()\` - Get current chat injection prompt
- \`on(event, callback)\` - Listen for events
- \`emit(event, data)\` - Emit events
- \`root\` - Container element to append UI to
- \`log(...args)\` - Console logging

**Code Structure:**
1. Get current state values
2. Create HTML elements and styling
3. Add event listeners for interactions
4. Update state when user interacts
5. Inject prompts to communicate with AI
6. Append elements to root container

## COMMON ASSET PACK TYPES

### 1. STAT TRACKERS
- Dating sims (affection, trust, relationship status)
- RPG stats (health, mana, experience, level)
- Business sims (money, reputation, resources)
- Social networks (friend counts, influence)

### 2. INVENTORY SYSTEMS
- Item collections with quantities
- Equipment with stats and bonuses
- Resource management
- Trading interfaces

### 3. PROGRESS TRACKERS
- Quest progress with stages
- Skill development trees
- Achievement systems
- Timeline/calendar tracking

### 4. INTERACTIVE INTERFACES
- Control panels with buttons
- Forms for data input
- Calculators and tools
- Games and mini-games

## DESIGN PRINCIPLES

1. **State-Driven**: Design around what data needs to persist
2. **AI-Friendly**: Make it easy for AI to understand and update state
3. **User-Focused**: Create intuitive interfaces that enhance the experience
4. **Visual Feedback**: Show state changes clearly
5. **Responsive Design**: Work on different screen sizes

## YOUR TASK

When a user describes what they want to create:

1. **Analyze** their request to understand the core functionality
2. **Design** appropriate state variables for their use case
3. **Create** AI integration that makes sense for the scenario
4. **Write** JavaScript code that implements the interface
5. **Suggest** appropriate positioning and styling
6. **Provide** complete, working asset pack configuration

Always ask clarifying questions if the request is unclear. Provide complete, functional code that follows best practices. Explain your design decisions and how the AI integration will work.

## RESPONSE FORMAT

Provide your response as a JSON object that can be directly loaded into the Asset Pack Creator:

\`\`\`json
{
  "id": "unique-pack-id",
  "metadata": {
    "name": "unique-pack-id",
    "displayName": "Human Readable Name",
    "version": "1.0.0",
    "description": "Brief description",
    "author": "User",
    "tags": ["tag1", "tag2"]
  },
  "stateSchema": {
    "variables": {
      "VariableName": {
        "type": "number",
        "default": 0,
        "min": 0,
        "max": 100,
        "description": "Description"
      }
    }
  },
  "chatInjection": {
    "template": "Current state: {{VariableName}}...",
    "stateUpdateFormat": "[STATE_UPDATE]....[/STATE_UPDATE]",
    "instructions": "Instructions for AI..."
  },
  "positioning": {
    "type": "end"
  },
  "content": "// JavaScript code here..."
}
\`\`\`

Remember: Always provide complete, working solutions that the user can immediately test and use.`;
    }

    /**
     * Create AI assistant UI
     */
    createAssistantUI() {
        const container = document.createElement('div');
        container.id = 'ember-ai-assistant';
        container.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 15px;
            margin-bottom: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        `;

        container.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="font-size: 24px; margin-right: 12px;">🤖</div>
                <h3 style="margin: 0; font-size: 20px;">AI Asset Pack Assistant</h3>
                <button id="ember-ai-toggle" style="
                    margin-left: auto;
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 12px;
                ">Hide</button>
            </div>

            <div id="ember-ai-content">
                <div style="margin-bottom: 15px;">
                    <p style="margin: 0 0 10px 0; opacity: 0.9; font-size: 14px;">
                        Describe what kind of asset pack you want to create, and I'll help you design it!
                    </p>
                    <div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
                        <button class="ai-example-btn" data-example="dating-sim">Dating Sim</button>
                        <button class="ai-example-btn" data-example="rpg-stats">RPG Stats</button>
                        <button class="ai-example-btn" data-example="inventory">Inventory System</button>
                        <button class="ai-example-btn" data-example="business-sim">Business Sim</button>
                        <button class="ai-example-btn" data-example="counter">Simple Counter</button>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <textarea id="ember-ai-input" placeholder="Example: I want to create a dating sim that tracks affection, trust, and a list of the character's interests. It should have buttons for giving compliments and gifts." style="
                        flex: 1;
                        padding: 12px;
                        border: none;
                        border-radius: 8px;
                        background: rgba(255,255,255,0.9);
                        color: #333;
                        resize: vertical;
                        min-height: 80px;
                        font-family: inherit;
                    "></textarea>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button id="ember-ai-generate" style="
                            background: #28a745;
                            color: white;
                            border: none;
                            padding: 12px 20px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: bold;
                            white-space: nowrap;
                        ">✨ Generate</button>
                        <button id="ember-ai-refine" style="
                            background: #ffc107;
                            color: #333;
                            border: none;
                            padding: 12px 20px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: bold;
                            white-space: nowrap;
                        ">🔧 Refine</button>
                    </div>
                </div>

                <div id="ember-ai-conversation" style="
                    background: rgba(0,0,0,0.2);
                    border-radius: 8px;
                    padding: 15px;
                    max-height: 300px;
                    overflow-y: auto;
                    margin-bottom: 15px;
                    display: none;
                ">
                    <!-- Conversation will appear here -->
                </div>

                <div id="ember-ai-loading" style="
                    text-align: center;
                    padding: 20px;
                    display: none;
                ">
                    <div style="display: inline-flex; align-items: center; gap: 10px;">
                        <div class="ember-spinner"></div>
                        <span>AI is designing your asset pack...</span>
                    </div>
                </div>

                <div id="ember-ai-error" style="
                    background: rgba(220, 53, 69, 0.2);
                    border: 1px solid rgba(220, 53, 69, 0.5);
                    border-radius: 8px;
                    padding: 15px;
                    display: none;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 18px;">⚠️</span>
                        <div>
                            <strong>AI Assistant Error</strong>
                            <div id="ember-ai-error-message" style="font-size: 14px; opacity: 0.9; margin-top: 5px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add CSS for spinner and button styles
        const style = document.createElement('style');
        style.textContent = `
            .ember-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: ember-spin 1s ease-in-out infinite;
            }

            @keyframes ember-spin {
                to { transform: rotate(360deg); }
            }

            .ai-example-btn {
                background: rgba(255,255,255,0.2);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                padding: 6px 12px;
                border-radius: 15px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            }

            .ai-example-btn:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-1px);
            }

            #ember-ai-conversation::-webkit-scrollbar {
                width: 8px;
            }

            #ember-ai-conversation::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
            }

            #ember-ai-conversation::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.3);
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);

        // Bind events
        this.bindAssistantEvents(container);

        return container;
    }

    /**
     * Bind events for AI assistant
     */
    bindAssistantEvents(container) {
        // Toggle visibility
        const toggleBtn = container.querySelector('#ember-ai-toggle');
        const content = container.querySelector('#ember-ai-content');

        toggleBtn.addEventListener('click', () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
        });

        // Example buttons
        container.querySelectorAll('.ai-example-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const example = btn.dataset.example;
                const input = container.querySelector('#ember-ai-input');
                input.value = this.getExamplePrompt(example);
                input.focus();
            });
        });

        // Generate button
        container.querySelector('#ember-ai-generate').addEventListener('click', () => {
            this.generateAssetPack();
        });

        // Refine button
        container.querySelector('#ember-ai-refine').addEventListener('click', () => {
            this.refineAssetPack();
        });

        // Enter key in textarea
        container.querySelector('#ember-ai-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.generateAssetPack();
            }
        });
    }

    /**
     * Get example prompts
     */
    getExamplePrompt(type) {
        const examples = {
            'dating-sim': 'I want to create a dating sim that tracks affection, trust, and desire levels from 0-100. It should also track lists of things the character likes and dislikes. Include buttons for giving compliments, gifts, asking on dates, and having deep conversations. The AI should update these stats based on our interactions.',

            'rpg-stats': 'Create an RPG character sheet that tracks health, mana, experience points, and level. Include strength, dexterity, and intelligence stats. Add buttons for resting (restore health/mana) and training (gain experience). The AI should update stats based on combat and story events.',

            'inventory': 'Build an inventory system that tracks items with quantities. Include categories like weapons, armor, consumables, and misc items. Add buttons for using items and organizing inventory. The AI should add/remove items based on story events and purchases.',

            'business-sim': 'Design a business simulation tracking money, reputation, and resources. Include employee count and customer satisfaction. Add buttons for hiring, marketing campaigns, and making investments. The AI should update these based on business decisions and events.',

            'counter': 'Create a simple counter that starts at 0. Include buttons to increment, decrement, and reset. The AI should reference the counter value in conversations and update it based on relevant events.'
        };

        return examples[type] || '';
    }

    /**
     * Generate asset pack using AI
     */
    async generateAssetPack() {
        const input = document.querySelector('#ember-ai-input');
        const userRequest = input.value.trim();

        if (!userRequest) {
            this.showError('Please describe what kind of asset pack you want to create.');
            return;
        }

        this.setLoading(true);
        this.hideError();

        try {
            // Check if SillyTavern's AI API is available
            if (!this.isAIAvailable()) {
                throw new Error('AI API not available. Please ensure SillyTavern is properly configured.');
            }

            // Add to conversation history
            this.addToConversation('user', userRequest);

            // Create AI prompt
            const prompt = this.buildAIPrompt(userRequest, 'generate');

            // Call AI
            const response = await this.callAI(prompt);

            // Parse and apply response
            await this.processAIResponse(response, 'generate');

            // Add AI response to conversation
            this.addToConversation('assistant', 'Generated asset pack configuration');

        } catch (error) {
            console.error('[AI Assistant] Generate error:', error);
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Refine existing asset pack
     */
    async refineAssetPack() {
        const input = document.querySelector('#ember-ai-input');
        const refinementRequest = input.value.trim();

        if (!refinementRequest) {
            this.showError('Please describe what you\'d like to change or improve.');
            return;
        }

        if (!this.creator.currentPack) {
            this.showError('No asset pack to refine. Please generate one first.');
            return;
        }

        this.setLoading(true);
        this.hideError();

        try {
            // Add to conversation history
            this.addToConversation('user', `Refine: ${refinementRequest}`);

            // Create refinement prompt
            const prompt = this.buildAIPrompt(refinementRequest, 'refine');

            // Call AI
            const response = await this.callAI(prompt);

            // Parse and apply response
            await this.processAIResponse(response, 'refine');

            // Add AI response to conversation
            this.addToConversation('assistant', 'Refined asset pack configuration');

        } catch (error) {
            console.error('[AI Assistant] Refine error:', error);
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Build AI prompt
     */
    buildAIPrompt(userRequest, mode) {
        let prompt = this.generateSystemPrompt() + '\n\n';

        if (mode === 'generate') {
            prompt += `USER REQUEST: ${userRequest}\n\n`;
            prompt += 'Please create a complete asset pack configuration based on this request. ';
            prompt += 'Respond with a JSON object that contains all the necessary configuration.';
        } else if (mode === 'refine') {
            prompt += `CURRENT ASSET PACK CONFIGURATION:\n${JSON.stringify(this.creator.currentPack, null, 2)}\n\n`;
            prompt += `REFINEMENT REQUEST: ${userRequest}\n\n`;
            prompt += 'Please modify the existing asset pack configuration based on the refinement request. ';
            prompt += 'Respond with the complete updated JSON configuration.';
        }

        return prompt;
    }

    /**
     * Check if AI is available
     */
    isAIAvailable() {
        // Check for SillyTavern's AI generation capabilities
        return window.SillyTavern &&
               (window.SillyTavern.Generate || window.generateQuietPrompt || window.sendSystemMessage);
    }

    /**
     * Call AI API
     */
    async callAI(prompt) {
        // Try different SillyTavern AI interfaces in order of preference

        // Method 1: Direct API call using SillyTavern's internal functions
        if (window.Generate && typeof window.Generate === 'function') {
            try {
                // Create a temporary system message for generation
                const tempMessage = {
                    role: 'system',
                    content: prompt,
                    temp: true
                };

                const response = await window.Generate('normal', false, false, tempMessage);
                return response;
            } catch (error) {
                console.warn('[AI Assistant] Method 1 failed:', error);
            }
        }

        // Method 2: Use quiet prompt if available (with preset switching)
        if (window.generateQuietPrompt && typeof window.generateQuietPrompt === 'function') {
            try {
                return await this.presetManager.executeWithPresetSwitch(async () => {
                    return await window.generateQuietPrompt(prompt);
                });
            } catch (error) {
                console.warn('[AI Assistant] Method 2 failed:', error);
            }
        }

        // Method 3: Use SillyTavern context manipulation
        if (window.SillyTavern?.getContext && window.SillyTavern?.Generate) {
            try {
                const context = window.SillyTavern.getContext();

                // Create a temporary chat entry
                const tempEntry = {
                    name: 'System',
                    is_user: false,
                    is_system: true,
                    mes: prompt,
                    force_avatar: false,
                    extra: { type: 'asset_pack_ai' }
                };

                // Temporarily add to chat
                context.chat.push(tempEntry);

                // Generate response
                const response = await window.SillyTavern.Generate('normal');

                // Remove the temporary entry
                context.chat.pop();

                return response;
            } catch (error) {
                console.warn('[AI Assistant] Method 3 failed:', error);
            }
        }

        // Method 4: Try direct fetch to SillyTavern's API endpoints
        if (window.api_server && window.main_api) {
            try {
                const response = await fetch('/api/v1/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        prompt: prompt,
                        max_new_tokens: 2000,
                        temperature: 0.7,
                        top_p: 0.9,
                        typical_p: 1,
                        repetition_penalty: 1.1,
                        encoder_repetition_penalty: 1,
                        top_k: 0,
                        min_length: 0,
                        no_repeat_ngram_size: 0,
                        num_beams: 1,
                        penalty_alpha: 0,
                        length_penalty: 1,
                        early_stopping: false,
                        seed: -1,
                        add_bos_token: true,
                        truncation_length: 4096,
                        ban_eos_token: false,
                        skip_special_tokens: true,
                        stopping_strings: []
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.results?.[0]?.text || data.response || '';
                }
            } catch (error) {
                console.warn('[AI Assistant] Method 4 failed:', error);
            }
        }

        // Fallback: Provide helpful error or simulated response
        console.warn('[AI Assistant] All AI methods failed, using fallback');
        return this.getSimulatedResponse(prompt);
    }

    /**
     * Get simulated AI response for testing
     */
    getSimulatedResponse(prompt) {
        // This is a fallback for when AI isn't available
        // Provides realistic examples based on common requests

        const lowerPrompt = prompt.toLowerCase();

        if (lowerPrompt.includes('dating sim') || lowerPrompt.includes('relationship') || lowerPrompt.includes('affection')) {
            return this.getDatingSimTemplate();
        } else if (lowerPrompt.includes('rpg') || lowerPrompt.includes('character sheet') || lowerPrompt.includes('health') || lowerPrompt.includes('mana')) {
            return this.getRPGTemplate();
        } else if (lowerPrompt.includes('inventory') || lowerPrompt.includes('items') || lowerPrompt.includes('equipment')) {
            return this.getInventoryTemplate();
        } else if (lowerPrompt.includes('business') || lowerPrompt.includes('money') || lowerPrompt.includes('company')) {
            return this.getBusinessTemplate();
        } else if (lowerPrompt.includes('counter') || lowerPrompt.includes('simple')) {
            return this.getCounterTemplate();
        } else {
            return this.getGenericTemplate();
        }
    }

    getDatingSimTemplate() {
        return JSON.stringify({
            "id": "ai-dating-sim",
            "metadata": {
                "name": "ai-dating-sim",
                "displayName": "AI Dating Simulator",
                "version": "1.0.0",
                "description": "Track relationship stats with interactive dating simulation",
                "author": "AI Assistant",
                "tags": ["dating", "relationship", "stats", "interactive"]
            },
            "stateSchema": {
                "variables": {
                    "Affection": {
                        "type": "number",
                        "default": 50,
                        "min": 0,
                        "max": 100,
                        "description": "Romantic affection level"
                    },
                    "Trust": {
                        "type": "number",
                        "default": 30,
                        "min": 0,
                        "max": 100,
                        "description": "Trust level in the relationship"
                    },
                    "Interests": {
                        "type": "array",
                        "default": [],
                        "description": "List of character's interests"
                    },
                    "RelationshipStatus": {
                        "type": "string",
                        "default": "acquaintance",
                        "description": "Current relationship stage"
                    }
                }
            },
            "chatInjection": {
                "template": "Relationship Status with {{CharacterName || 'Character'}}:\\n- Affection: {{Affection}}/100\\n- Trust: {{Trust}}/100\\n- Status: {{RelationshipStatus}}\\n- Known Interests: {{Interests}}\\n\\n[Update these stats based on our interactions using the STATE_UPDATE format]",
                "stateUpdateFormat": "[STATE_UPDATE]....[/STATE_UPDATE]",
                "instructions": "Update affection and trust based on interactions. Positive interactions increase affection (+5 to +15), trust-building conversations increase trust (+3 to +10). Add discovered interests to the Interests array. Update RelationshipStatus when milestones are reached (friend at 60+ affection, close_friend at 80+ affection + 70+ trust, dating at 90+ both)."
            },
            "positioning": {
                "type": "end"
            },
            "content": "const affection = getState('Affection') || 50;\\nconst trust = getState('Trust') || 30;\\nconst interests = getState('Interests') || [];\\nconst status = getState('RelationshipStatus') || 'acquaintance';\\n\\nconst container = document.createElement('div');\\ncontainer.style.cssText = 'padding: 20px; background: linear-gradient(135deg, #ff6b9d, #c44569); border-radius: 15px; color: white; box-shadow: 0 8px 32px rgba(0,0,0,0.2);';\\n\\nfunction createStatBar(label, value, icon, color) {\\n    return \\`\\n        <div style=\\\"margin: 10px 0;\\\">\\n            <div style=\\\"display: flex; justify-content: space-between; margin-bottom: 5px;\\\">\\n                <span>\\${icon} \\${label}</span>\\n                <span>\\${value}/100</span>\\n            </div>\\n            <div style=\\\"background: rgba(0,0,0,0.2); border-radius: 10px; padding: 2px;\\\">\\n                <div style=\\\"background: \\${color}; height: 8px; border-radius: 8px; width: \\${value}%; transition: width 0.5s ease;\\\"></div>\\n            </div>\\n        </div>\\n    \\`;\\n}\\n\\ncontainer.innerHTML = \\`\\n    <h3 style=\\\"margin: 0 0 15px 0; text-align: center;\\\">💖 Dating Sim Stats</h3>\\n    \\${createStatBar('Affection', affection, '❤️', '#ff4757')}\\n    \\${createStatBar('Trust', trust, '🤝', '#2ed573')}\\n    <div style=\\\"margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;\\\">\\n        <strong>Status:</strong> \\${status}\\n    </div>\\n    <div style=\\\"margin: 15px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;\\\">\\n        <strong>Interests:</strong> \\${interests.length > 0 ? interests.join(', ') : 'None discovered yet'}\\n    </div>\\n    <div style=\\\"display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;\\\">\\n        <button onclick=\\\"updateState({Affection: '+5'}); injectPrompt('I gave a compliment, which should increase affection.');\\\" style=\\\"padding: 10px; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 5px; cursor: pointer;\\\">💕 Compliment</button>\\n        <button onclick=\\\"updateState({Affection: '+8', Trust: '+3'}); injectPrompt('I gave a thoughtful gift, which should increase affection and trust.');\\\" style=\\\"padding: 10px; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 5px; cursor: pointer;\\\">🎁 Give Gift</button>\\n    </div>\\n\\`;\\n\\nroot.appendChild(container);"
        }, null, 2);
    }

    getRPGTemplate() {
        return JSON.stringify({
            "id": "ai-rpg-stats",
            "metadata": {
                "name": "ai-rpg-stats",
                "displayName": "RPG Character Sheet",
                "version": "1.0.0",
                "description": "Track RPG character statistics and attributes",
                "author": "AI Assistant",
                "tags": ["rpg", "stats", "character", "gaming"]
            },
            "stateSchema": {
                "variables": {
                    "Health": {
                        "type": "number",
                        "default": 100,
                        "min": 0,
                        "max": 100,
                        "description": "Current health points"
                    },
                    "Mana": {
                        "type": "number",
                        "default": 50,
                        "min": 0,
                        "max": 100,
                        "description": "Current mana points"
                    },
                    "Experience": {
                        "type": "number",
                        "default": 0,
                        "min": 0,
                        "description": "Experience points gained"
                    },
                    "Level": {
                        "type": "number",
                        "default": 1,
                        "min": 1,
                        "description": "Character level"
                    }
                }
            },
            "chatInjection": {
                "template": "Character Stats:\\n- Level: {{Level}}\\n- Health: {{Health}}/100\\n- Mana: {{Mana}}/100\\n- Experience: {{Experience}} XP\\n\\n[Update stats based on combat and story events using STATE_UPDATE format]",
                "stateUpdateFormat": "[STATE_UPDATE]....[/STATE_UPDATE]",
                "instructions": "Update stats based on events: combat reduces health (-10 to -30), spell casting reduces mana (-5 to -20), victories give experience (+50 to +200), level up when experience reaches level*100."
            },
            "positioning": {
                "type": "right"
            },
            "content": "const health = getState('Health') || 100;\\nconst mana = getState('Mana') || 50;\\nconst exp = getState('Experience') || 0;\\nconst level = getState('Level') || 1;\\n\\nconst container = document.createElement('div');\\ncontainer.style.cssText = 'padding: 15px; background: linear-gradient(135deg, #2c3e50, #3498db); border-radius: 10px; color: white; font-family: monospace;';\\n\\ncontainer.innerHTML = \\`\\n    <h3 style=\\\"margin: 0 0 15px 0; text-align: center;\\\">⚔️ Character Sheet</h3>\\n    <div style=\\\"margin: 10px 0;\\\">Level: \\${level}</div>\\n    <div style=\\\"margin: 10px 0;\\\">\\n        <div>❤️ Health: \\${health}/100</div>\\n        <div style=\\\"background: rgba(0,0,0,0.3); border-radius: 5px; padding: 2px; margin: 2px 0;\\\">\\n            <div style=\\\"background: #e74c3c; height: 6px; border-radius: 3px; width: \\${health}%;\\\"></div>\\n        </div>\\n    </div>\\n    <div style=\\\"margin: 10px 0;\\\">\\n        <div>💙 Mana: \\${mana}/100</div>\\n        <div style=\\\"background: rgba(0,0,0,0.3); border-radius: 5px; padding: 2px; margin: 2px 0;\\\">\\n            <div style=\\\"background: #3498db; height: 6px; border-radius: 3px; width: \\${mana}%;\\\"></div>\\n        </div>\\n    </div>\\n    <div style=\\\"margin: 10px 0;\\\">EXP: \\${exp}/${level * 100}</div>\\n    <button onclick=\\\"updateState({Health: Math.min(100, health + 30), Mana: Math.min(100, mana + 20)}); injectPrompt('I rested and recovered health and mana.');\\\" style=\\\"width: 100%; padding: 8px; background: #27ae60; border: none; color: white; border-radius: 5px; cursor: pointer; margin: 5px 0;\\\">🛌 Rest</button>\\n\\`;\\n\\nroot.appendChild(container);"
        }, null, 2);
    }

    getInventoryTemplate() {
        return JSON.stringify({
            "id": "ai-inventory",
            "metadata": {
                "name": "ai-inventory",
                "displayName": "Inventory System",
                "version": "1.0.0",
                "description": "Track items, equipment, and resources",
                "author": "AI Assistant",
                "tags": ["inventory", "items", "equipment", "rpg"]
            },
            "stateSchema": {
                "variables": {
                    "Items": {
                        "type": "array",
                        "default": ["Sword", "Health Potion", "Magic Ring"],
                        "description": "List of inventory items"
                    },
                    "Gold": {
                        "type": "number",
                        "default": 100,
                        "min": 0,
                        "description": "Amount of gold coins"
                    },
                    "EquippedWeapon": {
                        "type": "string",
                        "default": "Sword",
                        "description": "Currently equipped weapon"
                    }
                }
            },
            "chatInjection": {
                "template": "Inventory Status:\\n- Gold: {{Gold}} coins\\n- Equipped: {{EquippedWeapon}}\\n- Items: {{Items}}\\n\\n[Update inventory based on story events, purchases, and loot using STATE_UPDATE format]",
                "stateUpdateFormat": "[STATE_UPDATE]....[/STATE_UPDATE]",
                "instructions": "Add items with Items: +ItemName, remove with Items: -ItemName, update gold with Gold: +amount or Gold: -amount, change equipped items with EquippedWeapon: NewWeapon."
            },
            "positioning": {
                "type": "end"
            },
            "content": "const items = getState('Items') || [];\\nconst gold = getState('Gold') || 100;\\nconst equipped = getState('EquippedWeapon') || 'None';\\n\\nconst container = document.createElement('div');\\ncontainer.style.cssText = 'padding: 15px; background: linear-gradient(135deg, #8e44ad, #3498db); border-radius: 10px; color: white;';\\n\\ncontainer.innerHTML = \\`\\n    <h3 style=\\\"margin: 0 0 15px 0;\\\">🎒 Inventory</h3>\\n    <div style=\\\"background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px; margin: 10px 0;\\\">\\n        <strong>💰 Gold:</strong> \\${gold} coins\\n    </div>\\n    <div style=\\\"background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px; margin: 10px 0;\\\">\\n        <strong>⚔️ Equipped:</strong> \\${equipped}\\n    </div>\\n    <div style=\\\"background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px; margin: 10px 0;\\\">\\n        <strong>📦 Items (\\${items.length}):</strong>\\n        <div style=\\\"margin-top: 5px;\\\">\\n            \\${items.length > 0 ? items.map(item => \\`<span style=\\\"display: inline-block; background: rgba(255,255,255,0.2); padding: 2px 8px; margin: 2px; border-radius: 10px; font-size: 12px;\\\">\\${item}</span>\\`).join('') : 'Empty'}\\n        </div>\\n    </div>\\n\\`;\\n\\nroot.appendChild(container);"
        }, null, 2);
    }

    getBusinessTemplate() {
        return JSON.stringify({
            "id": "ai-business-sim",
            "metadata": {
                "name": "ai-business-sim",
                "displayName": "Business Simulator",
                "version": "1.0.0",
                "description": "Track business metrics and resources",
                "author": "AI Assistant",
                "tags": ["business", "simulation", "money", "management"]
            },
            "stateSchema": {
                "variables": {
                    "Money": {
                        "type": "number",
                        "default": 10000,
                        "min": 0,
                        "description": "Available funds"
                    },
                    "Reputation": {
                        "type": "number",
                        "default": 50,
                        "min": 0,
                        "max": 100,
                        "description": "Business reputation"
                    },
                    "Employees": {
                        "type": "number",
                        "default": 5,
                        "min": 0,
                        "description": "Number of employees"
                    }
                }
            },
            "chatInjection": {
                "template": "Business Status:\\n- Funds: ${{Money}}\\n- Reputation: {{Reputation}}/100\\n- Employees: {{Employees}}\\n\\n[Update business metrics based on decisions and events using STATE_UPDATE format]",
                "stateUpdateFormat": "[STATE_UPDATE]....[/STATE_UPDATE]",
                "instructions": "Update money based on profits/losses, reputation based on decisions and customer satisfaction, employees based on hiring/firing decisions."
            },
            "positioning": {
                "type": "end"
            },
            "content": "const money = getState('Money') || 10000;\\nconst reputation = getState('Reputation') || 50;\\nconst employees = getState('Employees') || 5;\\n\\nconst container = document.createElement('div');\\ncontainer.style.cssText = 'padding: 15px; background: linear-gradient(135deg, #27ae60, #2980b9); border-radius: 10px; color: white;';\\n\\ncontainer.innerHTML = \\`\\n    <h3 style=\\\"margin: 0 0 15px 0;\\\">🏢 Business Dashboard</h3>\\n    <div style=\\\"display: grid; grid-template-columns: 1fr 1fr; gap: 10px;\\\">\\n        <div style=\\\"background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;\\\">\\n            <div>💰 Funds</div>\\n            <div style=\\\"font-size: 18px; font-weight: bold;\\\">$\\${money.toLocaleString()}</div>\\n        </div>\\n        <div style=\\\"background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;\\\">\\n            <div>⭐ Reputation</div>\\n            <div style=\\\"font-size: 18px; font-weight: bold;\\\">\\${reputation}/100</div>\\n        </div>\\n        <div style=\\\"background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;\\\">\\n            <div>👥 Employees</div>\\n            <div style=\\\"font-size: 18px; font-weight: bold;\\\">\\${employees}</div>\\n        </div>\\n        <div style=\\\"background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;\\\">\\n            <div>📊 Monthly Cost</div>\\n            <div style=\\\"font-size: 18px; font-weight: bold;\\\">$\\${(employees * 3000).toLocaleString()}</div>\\n        </div>\\n    </div>\\n\\`;\\n\\nroot.appendChild(container);"
        }, null, 2);
    }

    getCounterTemplate() {
        return JSON.stringify({
            "id": "ai-counter",
            "metadata": {
                "name": "ai-counter",
                "displayName": "Simple Counter",
                "version": "1.0.0",
                "description": "A basic counter with increment/decrement functionality",
                "author": "AI Assistant",
                "tags": ["counter", "simple", "basic"]
            },
            "stateSchema": {
                "variables": {
                    "Count": {
                        "type": "number",
                        "default": 0,
                        "description": "Current counter value"
                    }
                }
            },
            "chatInjection": {
                "template": "Counter Value: {{Count}}",
                "stateUpdateFormat": "[STATE_UPDATE]....[/STATE_UPDATE]",
                "instructions": "Update the counter based on relevant events in our conversation."
            },
            "positioning": {
                "type": "end"
            },
            "content": "const count = getState('Count') || 0;\\n\\nconst container = document.createElement('div');\\ncontainer.style.cssText = 'padding: 20px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 10px; color: white; text-align: center;';\\n\\ncontainer.innerHTML = \\`\\n    <h3 style=\\\"margin: 0 0 20px 0;\\\">🔢 Counter</h3>\\n    <div style=\\\"font-size: 36px; font-weight: bold; margin: 20px 0;\\\">\\${count}</div>\\n    <div style=\\\"display: flex; gap: 10px; justify-content: center;\\\">\\n        <button onclick=\\\"updateState({Count: \\${count - 1}}); injectPrompt('Counter decreased to \\${count - 1}');\\\" style=\\\"padding: 10px 20px; background: #e74c3c; border: none; color: white; border-radius: 5px; cursor: pointer; font-size: 18px;\\\">−</button>\\n        <button onclick=\\\"updateState({Count: 0}); injectPrompt('Counter reset to 0');\\\" style=\\\"padding: 10px 20px; background: #95a5a6; border: none; color: white; border-radius: 5px; cursor: pointer;\\\">Reset</button>\\n        <button onclick=\\\"updateState({Count: \\${count + 1}}); injectPrompt('Counter increased to \\${count + 1}');\\\" style=\\\"padding: 10px 20px; background: #27ae60; border: none; color: white; border-radius: 5px; cursor: pointer; font-size: 18px;\\\">+</button>\\n    </div>\\n\\`;\\n\\nroot.appendChild(container);"
        }, null, 2);
    }

    getGenericTemplate() {
        return JSON.stringify({
            "id": "ai-generic-pack",
            "metadata": {
                "name": "ai-generic-pack",
                "displayName": "Custom Asset Pack",
                "version": "1.0.0",
                "description": "A customizable asset pack template",
                "author": "AI Assistant",
                "tags": ["custom", "template", "basic"]
            },
            "stateSchema": {
                "variables": {
                    "Value": {
                        "type": "number",
                        "default": 0,
                        "description": "A numeric value"
                    },
                    "Status": {
                        "type": "string",
                        "default": "active",
                        "description": "Current status"
                    }
                }
            },
            "chatInjection": {
                "template": "Current State: Value={{Value}}, Status={{Status}}",
                "stateUpdateFormat": "[STATE_UPDATE]....[/STATE_UPDATE]",
                "instructions": "Update the state variables based on relevant events and interactions."
            },
            "positioning": {
                "type": "end"
            },
            "content": "const value = getState('Value') || 0;\\nconst status = getState('Status') || 'active';\\n\\nconst container = document.createElement('div');\\ncontainer.style.cssText = 'padding: 20px; background: linear-gradient(135deg, #74b9ff, #6c5ce7); border-radius: 10px; color: white;';\\n\\ncontainer.innerHTML = \\`\\n    <h3 style=\\\"margin: 0 0 15px 0;\\\">🎛️ Custom Asset Pack</h3>\\n    <div style=\\\"margin: 10px 0;\\\">Value: \\${value}</div>\\n    <div style=\\\"margin: 10px 0;\\\">Status: \\${status}</div>\\n    <button onclick=\\\"updateState({Value: value + 1}); injectPrompt('Value increased');\\\" style=\\\"padding: 8px 15px; background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 5px; cursor: pointer; margin: 5px;\\\">Increase</button>\\n\\`;\\n\\nroot.appendChild(container);"
        }, null, 2);
    }

    /**
     * Process AI response
     */
    async processAIResponse(response, mode) {
        try {
            // Try to extract JSON from response
            let jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (!jsonMatch) {
                jsonMatch = response.match(/\{[\s\S]*\}/);
            }

            if (!jsonMatch) {
                throw new Error('No valid JSON configuration found in AI response');
            }

            const configText = jsonMatch[1] || jsonMatch[0];
            const config = JSON.parse(configText);

            // Validate configuration
            this.validateConfig(config);

            // Update creator with new configuration
            this.creator.currentPack = config;

            // Refresh UI
            this.creator.switchTab('basic');
            this.creator.refreshPreview();

            // Show success message
            const conversation = document.querySelector('#ember-ai-conversation');
            conversation.style.display = 'block';

            // Clear input
            document.querySelector('#ember-ai-input').value = '';

        } catch (error) {
            throw new Error(`Failed to parse AI response: ${error.message}`);
        }
    }

    /**
     * Validate AI-generated configuration
     */
    validateConfig(config) {
        if (!config.id) throw new Error('Missing pack ID');
        if (!config.metadata) throw new Error('Missing metadata');
        if (!config.metadata.name) throw new Error('Missing pack name');
        if (!config.stateSchema) config.stateSchema = { variables: {} };
        if (!config.chatInjection) config.chatInjection = { template: '', stateUpdateFormat: '[STATE_UPDATE]....[/STATE_UPDATE]', instructions: '' };
        if (!config.positioning) config.positioning = { type: 'end' };
        if (!config.content) config.content = '// AI generated code\nlog("Asset pack loaded!");';
    }

    /**
     * Add message to conversation
     */
    addToConversation(role, message) {
        this.conversationHistory.push({ role, message, timestamp: Date.now() });

        const conversation = document.querySelector('#ember-ai-conversation');
        if (!conversation) return;

        conversation.style.display = 'block';

        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            margin-bottom: 10px;
            padding: 10px;
            border-radius: 8px;
            background: ${role === 'user' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'};
            border-left: 3px solid ${role === 'user' ? '#28a745' : '#17a2b8'};
        `;

        messageDiv.innerHTML = `
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 5px;">
                ${role === 'user' ? '👤 You' : '🤖 AI Assistant'} • ${new Date().toLocaleTimeString()}
            </div>
            <div style="font-size: 14px;">${this.escapeHtml(message)}</div>
        `;

        conversation.appendChild(messageDiv);
        conversation.scrollTop = conversation.scrollHeight;
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        this.isProcessing = isLoading;

        const loading = document.querySelector('#ember-ai-loading');
        const generateBtn = document.querySelector('#ember-ai-generate');
        const refineBtn = document.querySelector('#ember-ai-refine');

        if (loading) loading.style.display = isLoading ? 'block' : 'none';
        if (generateBtn) generateBtn.disabled = isLoading;
        if (refineBtn) refineBtn.disabled = isLoading;
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorDiv = document.querySelector('#ember-ai-error');
        const errorMessage = document.querySelector('#ember-ai-error-message');

        if (errorDiv && errorMessage) {
            errorMessage.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorDiv = document.querySelector('#ember-ai-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    /**
     * Utility function to escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clear conversation history
     */
    clearConversation() {
        this.conversationHistory = [];
        const conversation = document.querySelector('#ember-ai-conversation');
        if (conversation) {
            conversation.innerHTML = '';
            conversation.style.display = 'none';
        }
    }
}