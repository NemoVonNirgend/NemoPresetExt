/**
 * Hybrid Auto-Lorebook System - Combined AI Generation + NLP Entity Recognition
 *
 * Features:
 * - AI-powered initial lorebook generation from character data
 * - Real-time entity recognition and discovery from chat messages
 * - Confidence scoring and incremental learning
 * - Automatic entry updates and relationship mapping
 */

import {
    world_names,
    createNewWorldInfo,
    saveWorldInfo,
    createWorldInfoEntry,
    world_info_logic,
    world_info_position,
    world_info,
    characters,
    callPopup,
    this_chid,
    getCurrentChatId,
    chat,
    chat_metadata,
    eventSource,
    event_types,
    saveMetadata
} from './utils/st-compatibility.js';
import { APIManager } from './api-manager.js';

// Import Project Gremlin functions for advanced lorebook generation (Integration Opportunity 2.2)
import { runGremlinPlanningPipeline, applyGremlinEnvironment } from '../prosepolisher/src/projectgremlin.js';

/**
 * Hybrid Auto-Lorebook Manager Class
 * Combines AI generation with real-time NLP entity recognition
 */
export class AutoLorebookManager {
    constructor(settings, state) {
        this.settings = settings;
        this.state = state;
        this.isProcessing = false;
        this.isInitialized = false;
        
        // Entity recognition system
        this.entityDatabase = new Map();
        this.scanHistory = new Set();
        this.scanInterval = null;
        this.scanTimeout = null;
        
        // Enhanced entity patterns with fantasy/sci-fi support
        this.entityPatterns = {
            person: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
            place: /\b(?:in|at|from|to|near|by|within)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
            organization: /\b(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Company|Corporation|Inc|LLC|Organization|Guild|Order|Council|Academy|Institute|Temple|Church))\b/g,
            item: /\b(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Sword|Shield|Ring|Amulet|Staff|Blade|Armor|Weapon|Tool|Artifact|Relic|Book|Scroll|Potion|Elixir))\b/g,
            title: /\b(?:Lord|Lady|Sir|Dame|King|Queen|Prince|Princess|Duke|Duchess|Count|Countess|Baron|Baroness|Captain|General|Admiral|Doctor|Professor)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
            // NEW: Fantasy/sci-fi names with apostrophes (Kael'thas, D'arcy, O'Brien)
            fantasy_apostrophe: /\b[A-Z][a-z]*['''-][A-Z]?[a-z]+(?:['''-][a-z]+)*\b/g,
            // NEW: Hyphenated names (Jean-Claude, Al-Rahman)
            hyphenated: /\b[A-Z][a-z]*-[A-Z]?[a-z]+(?:-[A-Z]?[a-z]+)*\b/g,
            // NEW: Quoted titles (books, ships, etc.)
            quoted_title: /"([A-Z][^"]{2,50})"/g,
            // NEW: Titled names (Dr. Smith, Prof. McGonagall)
            titled_person: /\b(?:Dr|Mr|Mrs|Ms|Miss|Prof|Professor|Sir|Captain|Colonel|General|Admiral)\.\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
        };
        
        this.contextPatterns = {
            description: /(?:is|was|are|were)\s+(.+?)(?:\.|!|\?|$)/g,
            relationship: /(?:friend|enemy|ally|rival|partner|spouse|child|parent|sibling|mentor|student|master|servant)\s+(?:of|to)\s+([^.!?]+)/g,
            location: /(?:lives|works|stays|resides|dwells|rules|governs)\s+(?:in|at|on|over|within)\s+([^.!?]+)/g,
            attribute: /(?:has|had|possesses|owns|wields|carries|knows|learned|mastered)\s+(.+?)(?:\.|!|\?|$)/g,
            action: /(?:fought|defeated|saved|rescued|destroyed|created|built|founded|discovered)\s+(.+?)(?:\.|!|\?|$)/g,
            emotion: /(?:loves|hates|fears|admires|despises|trusts|distrusts)\s+(.+?)(?:\.|!|\?|$)/g
        };
        
        this.confidenceThresholds = {
            person: 0.7,
            place: 0.6,
            organization: 0.8,
            item: 0.5,
            title: 0.9,
            fantasy_apostrophe: 0.75,  // Fantasy names with apostrophes
            hyphenated: 0.7,            // Hyphenated names
            quoted_title: 0.85,         // Quoted titles (books, etc.)
            titled_person: 0.85         // Names with titles (Dr., Prof., etc.)
        };
        
        this.commonWords = new Set([
            'The', 'This', 'That', 'They', 'Them', 'Their', 'There', 'Then', 'Than',
            'When', 'Where', 'What', 'Who', 'Why', 'How', 'Yes', 'No', 'Not',
            'And', 'But', 'Or', 'So', 'If', 'As', 'At', 'By', 'For', 'In',
            'Of', 'On', 'To', 'Up', 'It', 'Is', 'Be', 'Do', 'Go', 'See',
            'All', 'Any', 'Can', 'Had', 'Her', 'Was', 'One', 'Our', 'Out',
            'Day', 'Get', 'Has', 'Him', 'His', 'How', 'Man', 'New', 'Now',
            'Old', 'See', 'Two', 'Way', 'Who', 'Boy', 'Did', 'Its', 'Let',
            'Put', 'Say', 'She', 'Too', 'Use'
        ]);
        
        console.log('[NemoLore Hybrid Auto-Lorebook] Constructor completed with entity recognition system');
    }

    /**
     * Initialize the Hybrid Auto-Lorebook Manager
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('[NemoLore Hybrid Auto-Lorebook] Initializing...');
        
        // Set up real-time entity scanning
        this.setupEntityScanning();
        
        // Set up event listeners for message monitoring
        this.setupEventListeners();
        
        // Load existing entity database from metadata
        await this.loadEntityDatabase();
        
        this.isInitialized = true;
        console.log('[NemoLore Hybrid Auto-Lorebook] ✅ Initialized successfully with entity recognition');
    }

    /**
     * Handle intelligent lorebook setup for new chats
     */
    async handleIntelligentLorebookSetup(chatId) {
        if (!this.settings.enabled || this.isProcessing) return;

        // Ensure initialized
        await this.initialize();
        
        console.log(`[NemoLore Auto-Lorebook] Handling setup for chat: ${chatId}`);

        try {
            if (this.settings.auto_lorebook) {
                await this.createLorebookForChat(chatId);
            }
            if (this.settings.auto_create_lorebook) {
                await this.createIndependentLorebookForCharacter();
            }
            if (this.settings.auto_summarize) {
                await this.checkForChatManagement(chatId);
            }
        } catch (error) {
            console.error('[NemoLore Auto-Lorebook] Error in intelligent setup:', error);
        }
    }

    /**
     * Create lorebook for current chat/character
     */
    async createLorebookFile(chatId) {
        if (!chatId) return null;

        // Guard to prevent creating a duplicate if one is already linked
        if (chat_metadata && chat_metadata.world_info && chat_metadata.world_info.includes('_NemoLore_')) {
            if (world_names.includes(chat_metadata.world_info)) {
                console.log(`[NemoLore] Lorebook file already exists for this chat: ${chat_metadata.world_info}`);
                return chat_metadata.world_info;
            }
        }

        if (this.isProcessing) return null;
        this.isProcessing = true;

        try {
            const character = characters[this_chid];
            if (!character) throw new Error("No active character found.");

            const sanitizedCharName = character.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
            const sanitizedChatId = String(chatId).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);
            let lorebookName = `${sanitizedCharName}_NemoLore_${sanitizedChatId}`;
            let counter = 1;
            while (world_names.includes(lorebookName)) {
                lorebookName = `${sanitizedCharName}_NemoLore_${sanitizedChatId}_${counter++}`;
            }

            console.log(`[NemoLore] Creating new lorebook file: ${lorebookName}`);
            await createNewWorldInfo(lorebookName);
            if (!world_names.includes(lorebookName)) {
                world_names.push(lorebookName);
            }

            // Link the new lorebook to the chat and character
            if (chat_metadata) {
                chat_metadata['world_info'] = lorebookName;
                chat_metadata['nemolore_lorebook'] = lorebookName;
                await saveMetadata();
            }
            if (characters[this_chid]) {
                characters[this_chid].data.world = lorebookName;
            }

            this.state.currentChatLorebook = lorebookName;
            console.log(`[NemoLore] ✅ Successfully created and linked lorebook file: ${lorebookName}`);
            return lorebookName;
        } catch (error) {
            console.error('[NemoLore] Error creating lorebook file:', error);
            return null;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Create independent lorebook for character (NemoLore branded)
     */
    async createIndependentLorebookForCharacter() {
        if (this.isProcessing) return;

        try {
            const activeCharacterId = this_chid;
            const character = characters[activeCharacterId];
            if (!character) return;

            const sanitizedCharName = character.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
            let independentName = `NemoLore_${sanitizedCharName}_World`;
            let counter = 1;
            
            while (world_names.includes(independentName)) {
                independentName = `NemoLore_${sanitizedCharName}_World_${counter}`;
                counter++;
                if (counter > 10) {
                    independentName = `NemoLore_${sanitizedCharName}_${Date.now()}`;
                    break;
                }
            }

            const shouldCreate = await this.showIndependentLorebookPopup(character.name);
            if (!shouldCreate) return;

            await this.generateAndCreateLorebook(character, independentName, true);
            
            console.log(`[NemoLore Auto-Lorebook] ✅ Created independent lorebook: ${independentName}`);

        } catch (error) {
            console.error('[NemoLore Auto-Lorebook] Error creating independent lorebook:', error);
        }
    }

    /**
     * Show lorebook creation confirmation popup
     */
    async showLorebookCreationPopup(characterName) {
        const popupHtml = `
            <div style="padding: 20px; max-width: 500px;">
                <h3 style="color: var(--customThemeColor); margin-bottom: 15px;">
                    🧠 NemoLore Automatic Lorebook Creation
                </h3>
                <p>Would you like NemoLore to automatically create a comprehensive lorebook for <strong>${characterName}</strong>?</p>
                <p style="color: var(--SmartThemeQuoteColor); font-size: 0.9em; margin-top: 15px;">
                    <strong>Benefits:</strong><br>
                    • Enhances roleplay with rich world details<br>
                    • Provides character background and relationships<br>
                    • Includes important locations and context<br>
                    • Automatically integrated with this chat
                </p>
                <div style="margin-top: 20px;">
                    <label style="display: flex; align-items: center; margin-bottom: 10px;">
                        <input type="checkbox" id="nemolore-dont-ask-again" style="margin-right: 8px;">
                        Don't ask again (auto-create for future characters)
                    </label>
                </div>
            </div>
        `;

        return new Promise((resolve) => {
            callPopup(popupHtml, 'confirm').then(result => {
                /** @type {HTMLInputElement} */
                const dontAskAgainCheckbox = document.getElementById('nemolore-dont-ask-again');
                if (dontAskAgainCheckbox && dontAskAgainCheckbox.checked) {
                    this.settings.auto_lorebook_no_prompt = true;
                    this.saveSettings();
                }
                resolve(result);
            });
        });
    }

    /**
     * Show independent lorebook creation popup
     */
    async showIndependentLorebookPopup(characterName) {
        const popupHtml = `
            <div style="padding: 20px; max-width: 500px;">
                <h3 style="color: var(--customThemeColor); margin-bottom: 15px;">
                    🌟 Independent NemoLore Lorebook
                </h3>
                <p>Create a comprehensive, independent lorebook for <strong>${characterName}</strong>?</p>
                <p style="color: var(--SmartThemeQuoteColor); font-size: 0.9em; margin-top: 15px;">
                    This creates a reusable lorebook that can be used across multiple chats with this character.
                </p>
            </div>
        `;

        return new Promise((resolve) => {
            callPopup(popupHtml, 'confirm').then(resolve);
        });
    }

    /**
     * Generate and create the actual lorebook
     */
    async generateAndCreateLorebook(character, lorebookName, isIndependent = false) {
        try {
            console.log(`[NemoLore Auto-Lorebook] Creating new world info: ${lorebookName}`);
            await createNewWorldInfo(lorebookName);
            
            if (!world_names.includes(lorebookName)) {
                world_names.push(lorebookName);
            }
            
            try {
                if (chat_metadata) {
                    chat_metadata['world_info'] = lorebookName;
                    chat_metadata['nemolore_lorebook'] = lorebookName;
                    await saveMetadata();
                    console.log(`[NemoLore Auto-Lorebook] Successfully linked lorebook "${lorebookName}" to chat.`);
                }

                const activeCharacterId = this_chid;
                if (characters[activeCharacterId]) {
                    characters[activeCharacterId].data.world = lorebookName;
                    console.log(`[NemoLore Auto-Lorebook] Successfully linked lorebook "${lorebookName}" to the active character in memory.`);
                }
            } catch (linkError) {
                console.error(`[NemoLore Auto-Lorebook] Failed to link lorebook to chat/character:`, linkError);
            }

            const prompt = this.buildInitialGenerationPrompt(character);
            let responseContent;

            console.log('[NemoLore Auto-Lorebook] Generating lorebook entries...');
            const apiManager = new APIManager(this.settings);
            await apiManager.initialize();

            const response = await apiManager.generateLorebookEntries(prompt, this.settings);
            responseContent = response.content;

            if (!responseContent) {
                throw new Error("Received an empty response from the AI.");
            }

            const lorebookEntries = this.parseGenerationResponse(responseContent);
            if (lorebookEntries.length === 0) {
                console.warn('[NemoLore Auto-Lorebook] No entries were parsed from the AI response. Using fallback.');
                lorebookEntries.push({
                    title: `${character.name} - Background`,
                    keywords: [character.name],
                    description: character.description || 'No detailed background available.'
                });
            }

            let createdCount = 0;
            console.log(`[NemoLore Auto-Lorebook] Starting to create ${lorebookEntries.length} entries in lorebook "${lorebookName}"`);

            for (const entry of lorebookEntries) {
                const formattedEntry = {
                    title: entry.title,
                    keywords: entry.keywords.join(', '),
                    content: entry.description
                };
                const result = await this.createLorebookEntry(lorebookName, formattedEntry);
                if (result) {
                    createdCount++;
                }
            }

            console.log(`[NemoLore Auto-Lorebook] Successfully created ${createdCount}/${lorebookEntries.length} entries`);

            if (world_info[lorebookName]) {
                console.log(`[NemoLore Auto-Lorebook] Attempting to save lorebook "${lorebookName}"...`);
                try {
                    await saveWorldInfo(lorebookName, world_info[lorebookName], true);
                    console.log(`[NemoLore Auto-Lorebook] ✅ Saved lorebook: ${lorebookName}`);
                } catch (saveError) {
                    console.error(`[NemoLore Auto-Lorebook] ❌ Failed to save lorebook:`, saveError);
                }
            }

            this.showSuccessNotification(lorebookName, lorebookEntries.length, isIndependent);

        } catch (error) {
            console.error('[NemoLore Auto-Lorebook] Error generating lorebook:', error);
        }
    }

    /**
     * Build the prompt for initial lorebook generation.
     */
    buildInitialGenerationPrompt(characterData) {
        return `You are an expert worldbuilding assistant. Based on the following character information, create a comprehensive set of lorebook entries that would enhance roleplay sessions.\n\nCharacter Information:\nName: ${characterData.name || 'Unknown'}\nDescription: ${characterData.description || 'No description'}\nPersonality: ${characterData.personality || 'No personality defined'}\nScenario: ${characterData.scenario || 'No scenario defined'}\nFirst Message: ${characterData.first_mes || 'No first message'}\n\nGenerate 8-12 lorebook entries covering:\n1. Important people (friends, family, rivals, mentors)\n2. Significant locations (hometown, workplace, hangouts, districts, regions)\n3. Key items or objects (weapons, heirlooms, technology, artifacts)\n4. Important concepts or lore elements (organizations, customs, phenomena)\n5. Background events or history (conflicts, discoveries, traditions)\n\nFor each entry, provide:\n- A clear, evocative title.\n- Trigger keywords (3-5 relevant keywords including names).\n- A detailed description (2-4 sentences) with rich, specific details.\n\nFormat your response as a single JSON object with a root key "entries", which is an array of entry objects. Each object in the array must have "title", "keywords" (as an array of strings), and "description" fields.\n\nExample:\n{\n  "entries": [\n    {\n      "title": "The Crimson Blade",\n      "keywords": ["Crimson Blade", "magic sword", "heirloom"],\n      "description": "An ancient sword passed down through the character's family. It glows with a faint red light in the presence of danger and is said to contain the spirit of a powerful ancestor."\n    }\n  ]\n}\n\nFocus on elements that would naturally come up in conversation and enhance the roleplay experience with memorable, creative names and rich worldbuilding details.`
    }

    /**
     * Parse the AI's JSON response into structured lorebook entries.
     */
    parseGenerationResponse(response) {
        try {
            // Handle markdown code blocks (```json ... ```)
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            let jsonString = response;

            if (jsonMatch && jsonMatch[1]) {
                jsonString = jsonMatch[1];
            } else {
                // If no markdown, find the JSON object directly
                const firstBrace = response.indexOf('{');
                const lastBrace = response.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                    jsonString = response.substring(firstBrace, lastBrace + 1);
                }
            }
            
            const parsed = JSON.parse(jsonString.trim());
            if (parsed.entries && Array.isArray(parsed.entries)) {
                return parsed.entries;
            }
        } catch (error) {
            console.error(`[NemoLore Auto-Lorebook] Error parsing generation response: ${error.message}`);
            console.log(`[NemoLore Auto-Lorebook] Original response was:`, response);
        }
        return [];
    }

    /**
     * Create a single lorebook entry
     */
    async createLorebookEntry(lorebookName, entry) {
        try {
            if (!world_info[lorebookName]) {
                world_info[lorebookName] = { entries: [], originalData: { entries: {} } };
            }
            
            const newEntry = createWorldInfoEntry(lorebookName, world_info[lorebookName]);

            if (newEntry && typeof newEntry === 'object') {
                newEntry.comment = entry.title;
                newEntry.content = entry.content;
                newEntry.key = Array.isArray(entry.keywords) ? entry.keywords : entry.keywords.split(',').map(k => k.trim());
                newEntry.keysecondary = [];
                newEntry.selectiveLogic = world_info_logic?.AND_ANY || 0;
                newEntry.addMemo = true;
                newEntry.order = 100;
                newEntry.position = world_info_position?.before || 0;
                newEntry.disable = false;
                newEntry.constant = false;

                console.log(`[NemoLore Auto-Lorebook] ✅ Created and added entry: ${entry.title}`);
                return newEntry;
            } else {
                console.warn(`[NemoLore Auto-Lorebook] Failed to create entry object for: ${entry.title}`);
                return null;
            }
        } catch (error) {
            console.error(`[NemoLore Auto-Lorebook] Failed to create entry "${entry.title}":`, error);
            return null;
        }
    }

    /**
     * Show success notification
     */
    showSuccessNotification(lorebookName, entryCount, isIndependent) {
        const message = `
            <div style="padding: 15px;">
                <h4 style="color: var(--customThemeColor); margin-bottom: 10px;">
                    ✅ Lorebook Created Successfully!
                </h4>
                <p><strong>Name:</strong> ${lorebookName}</p>
                <p><strong>Entries:</strong> ${entryCount} entries created</p>
                <p><strong>Type:</strong> ${isIndependent ? 'Independent (reusable)' : 'Chat-specific'}</p>
                <p style="color: var(--SmartThemeQuoteColor); font-size: 0.9em; margin-top: 15px;">
                    The lorebook has been automatically activated for this conversation.
                </p>
            </div>
        `;
        
        callPopup(message, 'text');
    }

    /**
     * Check for chat management (summarization) requirements
     */
    async checkForChatManagement(chatId) {
        console.log(`[NemoLore Auto-Lorebook] Chat management check delegated to ChatManagementManager for: ${chatId}`);
    }

    /**
     * Save settings
     */
    saveSettings() {
        console.log('[NemoLore Auto-Lorebook] Settings saved');
    }

    // ===== HYBRID SYSTEM: ENTITY RECOGNITION & LEARNING METHODS =====

    /**
     * Set up real-time entity scanning system
     */
    setupEntityScanning() {
        const scanEnabled = this.settings.enable_entity_learning !== false;
        
        if (scanEnabled) {
            this.scanInterval = setInterval(() => {
                this.scanRecentMessages();
            }, 30000);
            
            console.log('[NemoLore Hybrid Auto-Lorebook] ✅ Real-time entity scanning enabled');
        } else {
            console.log('[NemoLore Hybrid Auto-Lorebook] Entity scanning disabled in settings');
        }
    }

    /**
     * Set up event listeners for message monitoring
     */
    setupEventListeners() {
        if (!eventSource) return;
        
        const messageHandler = (data) => {
            if (this.settings.enable_entity_learning !== false) {
                this.scheduleMessageScan(data);
            }
        };
        
        if (event_types.MESSAGE_SENT) {
            eventSource.on(event_types.MESSAGE_SENT, messageHandler);
        }
        if (event_types.MESSAGE_RECEIVED) {
            eventSource.on(event_types.MESSAGE_RECEIVED, messageHandler);
        }
        
        console.log('[NemoLore Hybrid Auto-Lorebook] ✅ Event listeners configured');
    }

    /**
     * Load existing entity database from chat metadata
     */
    async loadEntityDatabase() {
        try {
            const chatId = getCurrentChatId();
            if (!chatId || !chat_metadata) return;
            
            const entityData = chat_metadata.nemolore_entities;
            
            if (entityData) {
                if (typeof entityData === 'string') {
                    try {
                        const parsed = JSON.parse(entityData);
                        for (const [key, entity] of Object.entries(parsed)) {
                            this.entityDatabase.set(key, entity);
                        }
                    } catch (parseError) {
                        console.warn('[NemoLore Hybrid Auto-Lorebook] Failed to parse legacy entity data:', parseError);
                    }
                } else if (typeof entityData === 'object') {
                    for (const [key, entity] of Object.entries(entityData)) {
                        this.entityDatabase.set(key, entity);
                    }
                }
                
                console.log(`[NemoLore Hybrid Auto-Lorebook] Loaded ${this.entityDatabase.size} entities from chat metadata`);
            } else {
                const storageKey = `nemolore_entities_${chatId}`;
                const legacyData = localStorage.getItem(storageKey);
                
                if (legacyData) {
                    console.log('[NemoLore Hybrid Auto-Lorebook] Migrating entities from localStorage to chat metadata');
                    const entityData = JSON.parse(legacyData);
                    for (const [key, entity] of Object.entries(entityData)) {
                        this.entityDatabase.set(key, entity);
                    }
                    
                    await this.saveEntityDatabase();
                    localStorage.removeItem(storageKey);
                    console.log(`[NemoLore Hybrid Auto-Lorebook] ✅ Migrated ${this.entityDatabase.size} entities to chat metadata`);
                }
            }
        } catch (error) {
            console.warn('[NemoLore Hybrid Auto-Lorebook] Failed to load entity database:', error);
        }
    }

    /**
     * Save entity database to persistent storage
     */
    async saveEntityDatabase() {
        try {
            const chatId = getCurrentChatId();
            if (!chatId || !chat_metadata) return;
            
            const entityData = {};
            
            for (const [key, entity] of this.entityDatabase) {
                entityData[key] = entity;
            }
            
            chat_metadata.nemolore_entities = entityData;
            
            if (typeof saveMetadata === 'function') {
                await saveMetadata();
                console.log(`[NemoLore Hybrid Auto-Lorebook] ✅ Saved ${this.entityDatabase.size} entities to chat metadata`);
            }
        } catch (error) {
            console.warn('[NemoLore Hybrid Auto-Lorebook] Failed to save entity database:', error);
        }
    }

    /**
     * Schedule message scanning with debounce
     */
    scheduleMessageScan(messageData) {
        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
        }
        
        this.scanTimeout = setTimeout(() => {
            this.scanMessage(messageData);
        }, 5000);
    }

    /**
     * Scan recent messages for new entities
     */
    async scanRecentMessages() {
        if (!chat || chat.length === 0) return;
        
        const scanDepth = this.settings.entity_scan_depth || 10;
        const recentMessages = chat.slice(-scanDepth);
        
        let newEntitiesFound = 0;
        
        for (const message of recentMessages) {
            const messageId = message.id || message.send_date || message.timestamp;
            if (messageId && !this.scanHistory.has(messageId)) {
                const foundEntities = await this.scanMessage(message);
                newEntitiesFound += foundEntities;
                this.scanHistory.add(messageId);
            }
        }
        
        if (newEntitiesFound > 0) {
            console.log(`[NemoLore Hybrid Auto-Lorebook] ✅ Discovered ${newEntitiesFound} new entities`);
            await this.saveEntityDatabase();
        }
    }

    /**
     * Scan individual message for entities
     */
    async scanMessage(message) {
        if (!message || !message.mes) return 0;
        
        const content = message.mes;
        const entities = this.extractEntities(content);
        let processedCount = 0;
        
        for (const entity of entities) {
            const processed = await this.processEntity(entity, content, message);
            if (processed) processedCount++;
        }
        
        return processedCount;
    }

    /**
     * Extract entities from text using pattern matching
     */
    extractEntities(text) {
        const entities = [];
        
        for (const [type, pattern] of Object.entries(this.entityPatterns)) {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(text)) !== null) {
                const entityName = match;
                if (entityName && entityName.length > 2 && !this.isCommonWord(entityName)) {
                    const cleanName = entityName.trim();
                    const confidence = this.calculateConfidence(cleanName, type, text);
                    if (confidence >= this.confidenceThresholds[type]) {
                        entities.push({
                            name: cleanName,
                            type: type,
                            confidence: confidence,
                            context: this.extractContext(cleanName, text),
                            position: match.index,
                            sourceText: text.substring(Math.max(0, match.index - 50), Math.min(text.length, match.index + cleanName.length + 50))
                        });
                    }
                }
            }
        }
        
        return entities.filter(entity => entity.confidence >= this.confidenceThresholds[entity.type]);
    }

    /**
     * Calculate entity confidence score using multiple factors
     */
    calculateConfidence(entityName, type, text) {
        let confidence = 0.5;
        
        if (/^[A-Z][a-z]+/.test(entityName)) {
            confidence += 0.2;
        }
        
        const regex = new RegExp(entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const mentions = (text.match(regex) || []).length;
        if (mentions > 1) {
            confidence += Math.min(0.3, mentions * 0.1);
        }
        
        const contextScore = this.analyzeContextClues(entityName, type, text);
        confidence += contextScore;
        
        if (entityName.includes(' ')) {
            confidence += 0.1;
        }
        
        return Math.min(1.0, confidence);
    }

    /**
     * Analyze context clues around entity for confidence boost - Enhanced version
     */
    analyzeContextClues(entityName, type, text) {
        let score = 0;
        const entityRegex = new RegExp(entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

        let match;
        while ((match = entityRegex.exec(text)) !== null) {
            const start = Math.max(0, match.index - 50);
            const end = Math.min(text.length, match.index + entityName.length + 50);
            const context = text.substring(start, end).toLowerCase();

            switch (type) {
                case 'person':
                    if (/\b(he|she|they|him|her|them|his|hers|their)\b/.test(context)) score += 0.2;
                    if (/\b(said|told|asked|spoke|replied|whispered|shouted|announced)\b/.test(context)) score += 0.2;
                    if (/\b(mr|mrs|ms|dr|sir|lady|lord|master|mistress)\b/.test(context)) score += 0.3;
                    if (/\b(born|died|lived|worked|studied|traveled)\b/.test(context)) score += 0.15;
                    break;

                case 'place':
                    if (/\b(in|at|from|to|near|by|within|outside|inside|through)\b/.test(context)) score += 0.2;
                    if (/\b(city|town|village|kingdom|country|realm|land|region|area)\b/.test(context)) score += 0.3;
                    if (/\b(forest|mountain|castle|palace|temple|fortress|dungeon|tower)\b/.test(context)) score += 0.25;
                    if (/\b(located|situated|found|built|established)\b/.test(context)) score += 0.15;
                    break;

                case 'organization':
                    if (/\b(member|leader|joined|founded|part of|belongs to|works for|serves)\b/.test(context)) score += 0.2;
                    if (/\b(guild|order|company|corporation|academy|institute|temple|church|council)\b/.test(context)) score += 0.3;
                    if (/\b(organization|group|faction|alliance|union|society)\b/.test(context)) score += 0.25;
                    break;

                case 'item':
                    if (/\b(wielded|carried|equipped|owned|found|lost|stolen|forged)\b/.test(context)) score += 0.2;
                    if (/\b(weapon|tool|artifact|relic|treasure|magical|ancient|powerful)\b/.test(context)) score += 0.3;
                    if (/\b(sword|ring|amulet|staff|blade|armor|shield)\b/.test(context)) score += 0.25;
                    break;

                case 'title':
                    if (/\b(rules|governs|leads|commands|serves|appointed|crowned|elected)\b/.test(context)) score += 0.3;
                    if (/\b(king|queen|lord|lady|duke|count|baron|emperor)\b/.test(context)) score += 0.25;
                    break;

                // NEW: Enhanced detection for new entity types
                case 'fantasy_apostrophe':
                    // Fantasy names with apostrophes (e.g., Kael'thas, D'arcy)
                    if (/\b(warrior|mage|knight|priest|ranger|rogue|druid|monk)\b/.test(context)) score += 0.25;
                    if (/\b(elf|elven|orc|dwarf|dwarven|troll|goblin|dragon)\b/.test(context)) score += 0.3;
                    if (/\b(clan|tribe|house|lineage|bloodline|family)\b/.test(context)) score += 0.2;
                    break;

                case 'hyphenated':
                    // Hyphenated names (e.g., Jean-Claude, Al-Rahman)
                    if (/\b(mr|mrs|ms|dr|sir|lady|lord|master)\b/.test(context)) score += 0.3;
                    if (/\b(he|she|they|him|her|said|told)\b/.test(context)) score += 0.2;
                    break;

                case 'quoted_title':
                    // Quoted titles (books, ships, artifacts)
                    if (/\b(book|novel|tome|grimoire|scroll|manuscript)\b/.test(context)) score += 0.3;
                    if (/\b(ship|vessel|boat|craft|frigate|galleon)\b/.test(context)) score += 0.3;
                    if (/\b(titled|called|named|known as)\b/.test(context)) score += 0.2;
                    if (/\b(written|authored|penned|composed)\b/.test(context)) score += 0.25;
                    break;

                case 'titled_person':
                    // Names with professional titles (Dr. Smith, Prof. McGonagall)
                    if (/\b(doctor|professor|captain|general|admiral)\b/.test(context)) score += 0.35;
                    if (/\b(teaches|studied|practiced|researched|commanded)\b/.test(context)) score += 0.2;
                    if (/\b(university|hospital|military|academy)\b/.test(context)) score += 0.25;
                    break;
            }
        }

        return Math.min(0.4, score);
    }

    /**
     * Extract context information for entity
     */
    extractContext(entityName, text) {
        const contexts = [];
        
        for (const [contextType, pattern] of Object.entries(this.contextPatterns)) {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(text)) !== null) {
                const contextText = match;
                if (contextText && contextText.toLowerCase().includes(entityName.toLowerCase())) {
                    contexts.push({
                        type: contextType,
                        text: contextText.trim(),
                        confidence: 0.8,
                        fullMatch: match
                    });
                }
            }
        }
        
        return contexts;
    }

    /**
     * Check if word is too common to be a significant entity
     */
    isCommonWord(word) {
        return this.commonWords.has(word) || word.length < 3;
    }

    /**
     * Process discovered entity - create or update lorebook entry
     */
    async processEntity(entity, sourceText, sourceMessage) {
        try {
            const existingEntity = this.entityDatabase.get(entity.name.toLowerCase());
            
            if (existingEntity) {
                return await this.updateExistingEntity(existingEntity, entity, sourceText);
            } else {
                if (entity.confidence >= 0.8) {
                    return await this.createEntityEntry(entity, sourceText, sourceMessage);
                }
            }
            
            return false;
        } catch (error) {
            console.error('[NemoLore Hybrid Auto-Lorebook] Error processing entity:', error);
            return false;
        }
    }

    /**
     * Create new lorebook entry for discovered entity
     */
    async createEntityEntry(entity, sourceText, sourceMessage) {
        try {
            const lorebookName = this.state.currentChatLorebook || await this.getCurrentLorebookName();
            if (!lorebookName) return false;
            
            const maxEntries = this.settings.max_auto_entries || 100;
            if (this.entityDatabase.size >= maxEntries) {
                return false;
            }
            
            const entryContent = await this.generateEntityEntryContent(entity, sourceText);
            
            const lorebookEntry = {
                title: `${entity.name} - ${entity.type}`,
                keywords: this.generateEntityKeywords(entity),
                content: entryContent
            };
            
            const success = await this.createLorebookEntry(lorebookName, lorebookEntry);
            
            if (success) {
                this.entityDatabase.set(entity.name.toLowerCase(), {
                    name: entity.name,
                    type: entity.type,
                    confidence: entity.confidence,
                    contexts: entity.context || [],
                    mentions: 1,
                    created: Date.now(),
                    lastSeen: Date.now(),
                    lorebookEntry: lorebookEntry.title,
                    sourceMessage: sourceMessage?.id || null
                });
                
                console.log(`[NemoLore Hybrid Auto-Lorebook] ✅ Created entity entry: ${entity.name} (${entity.type})`);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[NemoLore Hybrid Auto-Lorebook] Error creating entity entry:', error);
            return false;
        }
    }

    /**
     * Update existing entity with new information
     */
    async updateExistingEntity(existingEntity, newEntity, sourceText) {
        try {
            existingEntity.mentions = (existingEntity.mentions || 0) + 1;
            
            const totalMentions = existingEntity.mentions;
            existingEntity.confidence = ((existingEntity.confidence * (totalMentions - 1)) + newEntity.confidence) / totalMentions;
            
            if (newEntity.context && newEntity.context.length > 0) {
                existingEntity.contexts = existingEntity.contexts || [];
                for (const context of newEntity.context) {
                    if (!existingEntity.contexts.find(c => c.text === context.text)) {
                        existingEntity.contexts.push(context);
                    }
                }
                
                if (existingEntity.contexts.length > 10) {
                    existingEntity.contexts = existingEntity.contexts.slice(-10);
                }
            }
            
            existingEntity.lastSeen = Date.now();
            
            if (newEntity.confidence > existingEntity.confidence + 0.1) {
                await this.updateEntityLorebookEntry(existingEntity, sourceText);
            }
            
            console.log(`[NemoLore Hybrid Auto-Lorebook] ✅ Updated entity: ${existingEntity.name} (mentions: ${existingEntity.mentions})`);
            return true;
        } catch (error) {
            console.error('[NemoLore Hybrid Auto-Lorebook] Error updating entity:', error);
            return false;
        }
    }

    /**
     * Generate content for entity entry using AI or fallback template
     */
    async generateEntityEntryContent(entity, sourceText) {
        let content = `${entity.name} is a ${entity.type}`;
        
        if (entity.context && entity.context.length > 0) {
            const contextTexts = entity.context
                .filter(ctx => ctx.text && ctx.text.length > 3)
                .map(ctx => ctx.text)
                .slice(0, 3);
                
            if (contextTexts.length > 0) {
                content += `. ${contextTexts.join('. ')}`;
            }
        }
        
        content += ` (Discovered from roleplay conversation with ${entity.confidence.toFixed(2)} confidence)`;
        
        const maxLength = this.settings.entity_entry_length || 200;
        if (content.length > maxLength) {
            content = content.substring(0, maxLength - 3) + '...';
        }
        
        return content;
    }

    /**
     * Generate keywords for entity
     */
    generateEntityKeywords(entity) {
        const keywords = [entity.name];
        
        if (entity.name.includes(' ')) {
            if (entity.type === 'person') {
                keywords.push(...entity.name.split(' '));
            }
            keywords.push(entity.name.split(' ').slice(-1));
        }
        
        keywords.push(entity.name.toLowerCase());
        
        return [...new Set(keywords)]; // Remove duplicates
    }

    /**
     * Update existing lorebook entry with new information
     */
    async updateEntityLorebookEntry(entity, sourceText) {
        console.log(`[NemoLore Hybrid Auto-Lorebook] Considering update for: ${entity.name}`);
    }

    /**
     * Get current lorebook name or create one if needed
     */
    async getCurrentLorebookName() {
        if (this.state.currentChatLorebook && world_names.includes(this.state.currentChatLorebook)) {
            return this.state.currentChatLorebook;
        }

        const activeCharacterId = this_chid;
        const character = characters[activeCharacterId];
        if (!character) return null;
        
        const chatId = getCurrentChatId();
        const entityLorebookName = `${character.name}_Entities_${chatId}`;
        
        try {
            await createNewWorldInfo(entityLorebookName);
            this.state.currentChatLorebook = entityLorebookName;
            return entityLorebookName;
        } catch (error) {
            console.error('[NemoLore Hybrid Auto-Lorebook] Failed to create entity lorebook:', error);
            return null;
        }
    }

    /**
     * Get statistics about discovered entities
     */
    getEntityStatistics() {
        const entities = Array.from(this.entityDatabase.values());
        
        const stats = {
            totalEntities: entities.length,
            byType: {},
            averageConfidence: 0,
            totalMentions: 0,
            recentlyActive: 0
        };
        
        if (entities.length > 0) {
            for (const entity of entities) {
                stats.byType[entity.type] = (stats.byType[entity.type] || 0) + 1;
                stats.totalMentions += entity.mentions || 1;
                stats.averageConfidence += entity.confidence || 0;
                
                if (entity.lastSeen && (Date.now() - entity.lastSeen) < 86400000) {
                    stats.recentlyActive++;
                }
            }
            
            stats.averageConfidence = stats.averageConfidence / entities.length;
        }
        
        return stats;
    }

    /**
     * Cleanup and shutdown entity recognition
     */
    async shutdown() {
        console.log('[NemoLore Hybrid Auto-Lorebook] Shutting down entity recognition...');
        
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        
        if (this.scanTimeout) {
            clearTimeout(this.scanTimeout);
            this.scanTimeout = null;
        }
        
        await this.saveEntityDatabase();
        
        this.isInitialized = false;
        console.log('[NemoLore Hybrid Auto-Lorebook] ✅ Shutdown completed');
    }

    /**
     * Finds or creates the "Core Memories" lorebook entry and appends new content.
     * Now with optional Project Gremlin enhancement for high-quality entries
     */
    async addCoreMemoryToLorebook(summaryData) {
        const CORE_MEMORY_TITLE = 'Core Memories';
        const CORE_MEMORY_KEYWORDS = ['core_memories', 'pivotal_events', 'key_moments'];

        const lorebookName = this.state.currentChatLorebook || await this.getCurrentLorebookName();
        if (!lorebookName) {
            console.error('[NemoLore] Cannot add core memory: No active lorebook.');
            return;
        }

        // Generate enhanced entry content using Gremlin (if enabled) or simple generation
        let newMemoryContent;
        const useGremlin = this.settings.useProjectGremlinForLorebook;

        if (useGremlin) {
            console.log('[NemoLore] 🎭 Generating enhanced core memory entry with Project Gremlin...');
            try {
                const gremlinEntry = await this.generateLorebookEntryWithGremlin(summaryData);
                newMemoryContent = `\n- ${new Date().toLocaleString()}: ${gremlinEntry}`;
            } catch (error) {
                console.error('[NemoLore] Gremlin generation failed, using simple format:', error);
                newMemoryContent = `\n- ${new Date().toLocaleString()}: ${summaryData.text}`;
            }
        } else {
            // Simple format (original behavior)
            newMemoryContent = `\n- ${new Date().toLocaleString()}: ${summaryData.text}`;
        }

        let coreMemoryEntry = null;
        if (world_info[lorebookName] && world_info[lorebookName].entries) {
            coreMemoryEntry = world_info[lorebookName].entries.find(
                entry => entry.comment === CORE_MEMORY_TITLE
            );
        }

        if (coreMemoryEntry) {
            coreMemoryEntry.content += newMemoryContent;
            console.log(`[NemoLore] Appended core memory to existing entry in ${lorebookName}.`);
        } else {
            console.log(`[NemoLore] Creating new "Core Memories" entry in ${lorebookName}.`);
            const entryData = {
                title: CORE_MEMORY_TITLE,
                keywords: CORE_MEMORY_KEYWORDS.join(', '),
                content: `A collection of the most significant moments in the story.${newMemoryContent}`
            };
            await this.createLorebookEntry(lorebookName, entryData);
        }

        await saveWorldInfo(lorebookName, world_info[lorebookName], true);
    }

    /**
     * Generate lorebook entry using Project Gremlin pipeline (Integration Opportunity 2.2)
     * Provides full control over which pipeline stages to use
     *
     * @param {Object} coreMemory - The core memory object to expand
     * @param {Object} options - Pipeline configuration options
     * @returns {Promise<string>} - Generated lorebook entry content
     */
    async generateLorebookEntryWithGremlin(coreMemory, options = {}) {
        try {
            // Check if Project Gremlin is available
            if (typeof runGremlinPlanningPipeline !== 'function') {
                console.log('[NemoLore Auto-Lorebook] Project Gremlin not available, using simple generation');
                return await this.generateSimpleLorebookEntry(coreMemory);
            }

            // Get Gremlin settings from NemoLore settings (with defaults)
            const gremlinSettings = {
                enabled: this.settings.useProjectGremlinForLorebook || false,
                usePapa: this.settings.gremlinUsePapa !== false, // Default true
                useTwins: this.settings.gremlinUseTwins !== false, // Default true
                useMama: this.settings.gremlinUseMama !== false, // Default true
                useWriter: this.settings.gremlinUseWriter !== false, // Default true
                useAuditor: this.settings.gremlinUseAuditor !== false, // Default true
                ...options // Allow override via parameters
            };

            // If Gremlin is disabled, use simple generation
            if (!gremlinSettings.enabled) {
                console.log('[NemoLore Auto-Lorebook] Project Gremlin disabled in settings, using simple generation');
                return await this.generateSimpleLorebookEntry(coreMemory);
            }

            console.log('[NemoLore Auto-Lorebook] 🎭 Using Project Gremlin pipeline for lorebook generation');
            console.log(`[NemoLore Auto-Lorebook] Pipeline stages: Papa=${gremlinSettings.usePapa}, Twins=${gremlinSettings.useTwins}, Mama=${gremlinSettings.useMama}, Writer=${gremlinSettings.useWriter}, Auditor=${gremlinSettings.useAuditor}`);

            // Temporarily enable Gremlin components based on user settings
            const ProsePolisherSettings = typeof extension_settings !== 'undefined' ? extension_settings.ProsePolisher : null;
            if (!ProsePolisherSettings) {
                console.warn('[NemoLore Auto-Lorebook] ProsePolisher settings not found, using simple generation');
                return await this.generateSimpleLorebookEntry(coreMemory);
            }

            // Store original settings to restore later
            const originalSettings = {
                projectGremlinEnabled: ProsePolisherSettings.projectGremlinEnabled,
                gremlinPapaEnabled: ProsePolisherSettings.gremlinPapaEnabled,
                gremlinTwinsEnabled: ProsePolisherSettings.gremlinTwinsEnabled,
                gremlinMamaEnabled: ProsePolisherSettings.gremlinMamaEnabled
            };

            try {
                // Configure Gremlin based on user's NemoLore settings
                ProsePolisherSettings.projectGremlinEnabled = true;
                ProsePolisherSettings.gremlinPapaEnabled = gremlinSettings.usePapa;
                ProsePolisherSettings.gremlinTwinsEnabled = gremlinSettings.useTwins;
                ProsePolisherSettings.gremlinMamaEnabled = gremlinSettings.useMama;

                // Step 1: Inject lorebook generation context
                const lorebookContext = this.buildGremlinLorebookContext(coreMemory);

                if (typeof getContext === 'function') {
                    const context = getContext();
                    if (context && context.setExtensionPrompt) {
                        context.setExtensionPrompt(
                            'nemolore_gremlin_lorebook',
                            lorebookContext,
                            2, // position
                            2, // depth
                            false, // scan
                            0 // role (SYSTEM)
                        );
                    }
                }

                // Step 2: Run Gremlin Planning Pipeline (Papa → Twins → Mama)
                let blueprint;
                try {
                    blueprint = await runGremlinPlanningPipeline();
                } catch (pipelineError) {
                    console.error('[NemoLore Auto-Lorebook] Gremlin pipeline failed:', pipelineError);
                    return await this.generateSimpleLorebookEntry(coreMemory);
                }

                if (!blueprint || blueprint.trim().length === 0) {
                    console.warn('[NemoLore Auto-Lorebook] Empty blueprint from Gremlin, using simple generation');
                    return await this.generateSimpleLorebookEntry(coreMemory);
                }

                console.log(`[NemoLore Auto-Lorebook] ✅ Gremlin blueprint created (${blueprint.length} chars)`);

                // Step 3: Generate final lorebook entry using Writer Gremlin (if enabled)
                let lorebookEntry;
                if (gremlinSettings.useWriter) {
                    lorebookEntry = await this.generateFromBlueprint(blueprint);
                } else {
                    // Use blueprint directly as lorebook content
                    lorebookEntry = blueprint;
                }

                // Step 4: Audit entry using Auditor Gremlin (if enabled)
                let finalEntry;
                if (gremlinSettings.useAuditor && lorebookEntry) {
                    finalEntry = await this.auditLorebookEntry(lorebookEntry);
                } else {
                    finalEntry = lorebookEntry;
                }

                // Clear context injection
                if (typeof getContext === 'function') {
                    const context = getContext();
                    if (context && context.setExtensionPrompt) {
                        context.setExtensionPrompt('nemolore_gremlin_lorebook', '', 0, 0);
                    }
                }

                console.log(`[NemoLore Auto-Lorebook] ✅ Gremlin lorebook entry complete (${finalEntry.length} chars)`);
                return finalEntry;

            } finally {
                // Restore original ProsePolisher settings
                ProsePolisherSettings.projectGremlinEnabled = originalSettings.projectGremlinEnabled;
                ProsePolisherSettings.gremlinPapaEnabled = originalSettings.gremlinPapaEnabled;
                ProsePolisherSettings.gremlinTwinsEnabled = originalSettings.gremlinTwinsEnabled;
                ProsePolisherSettings.gremlinMamaEnabled = originalSettings.gremlinMamaEnabled;
            }

        } catch (error) {
            console.error('[NemoLore Auto-Lorebook] Gremlin integration error:', error);
            // Fallback to simple generation on any error
            return await this.generateSimpleLorebookEntry(coreMemory);
        }
    }

    /**
     * Build context prompt for Gremlin lorebook generation
     * @private
     */
    buildGremlinLorebookContext(coreMemory) {
        return `[LOREBOOK ENTRY GENERATION TASK]

**Objective:** Create a comprehensive, high-quality lorebook entry for a pivotal moment in the story.

**Core Memory to Expand:**
"${coreMemory.text}"

**Type:** ${coreMemory.type || 'conversation'}
**Message Index:** ${coreMemory.messageIndex || 'unknown'}
**Context:** This is a key moment that was flagged as a core memory worth preserving.

**Requirements for Lorebook Entry:**
1. **Format:** 2-4 concise sentences
2. **Content:** Capture the significance and context of this moment
3. **Style:** Past tense, factual, evocative
4. **Details:** Include character names, locations, and emotional/thematic significance
5. **Quality:** Avoid clichés, repetitive phrases, and generic descriptions

**Important Guidelines:**
- Do NOT plan or suggest actions for the user/player character
- Focus on the NPC perspective and world state
- Be specific and memorable
- Ensure consistency with established lore

This entry will be added to the lorebook for this conversation.`;
    }

    /**
     * Generate lorebook entry from Gremlin blueprint using Writer role
     * @private
     */
    async generateFromBlueprint(blueprint) {
        try {
            // Apply Writer Gremlin environment
            if (typeof applyGremlinEnvironment === 'function') {
                await applyGremlinEnvironment('writer');
            }

            const writerPrompt = `Based on this blueprint, create a concise lorebook entry:

**Blueprint:**
${blueprint}

**Requirements:**
- 2-4 sentences maximum
- Focus on facts and context
- Past tense
- Avoid redundancy
- Use active voice
- No clichés or repetitive phrases

**Output only the lorebook entry text, no commentary:**`;

            // Use API manager to generate with Writer settings
            const apiManager = new APIManager(this.settings);
            await apiManager.initialize();

            const response = await apiManager.generateLorebookEntries(writerPrompt, this.settings);
            const content = response.content;

            // Clean up response
            return content
                .replace(/^(Here's the lorebook entry|Lorebook entry:|Entry:)/i, '')
                .replace(/^[^\w]*/, '')
                .trim();

        } catch (error) {
            console.error('[NemoLore Auto-Lorebook] Writer generation failed:', error);
            // Return blueprint as fallback
            return blueprint;
        }
    }

    /**
     * Audit lorebook entry using Auditor Gremlin role
     * @private
     */
    async auditLorebookEntry(entry) {
        try {
            // Apply Auditor Gremlin environment
            if (typeof applyGremlinEnvironment === 'function') {
                await applyGremlinEnvironment('auditor');
            }

            const auditorPrompt = `Review and improve this lorebook entry for quality:

**Entry:**
${entry}

**Check for:**
1. Factual accuracy and consistency
2. Conciseness (2-4 sentences ideal)
3. No repetitive phrases or clichés
4. Clear, engaging writing
5. Past tense usage
6. No planning/suggesting user actions

**Provide ONLY the corrected entry text (no explanations):**`;

            // Use API manager to generate with Auditor settings
            const apiManager = new APIManager(this.settings);
            await apiManager.initialize();

            const response = await apiManager.generateLorebookEntries(auditorPrompt, this.settings);
            const auditedContent = response.content;

            // Clean up response
            return auditedContent
                .replace(/^(Here's|Corrected|Improved|Audited).*?:/i, '')
                .replace(/^[^\w]*/, '')
                .trim();

        } catch (error) {
            console.error('[NemoLore Auto-Lorebook] Auditor review failed:', error);
            // Return original entry as fallback
            return entry;
        }
    }

    /**
     * Simple lorebook entry generation (fallback when Gremlin unavailable/disabled)
     * @private
     */
    async generateSimpleLorebookEntry(coreMemory) {
        try {
            const simplePrompt = `Create a concise lorebook entry (2-4 sentences) for this pivotal moment:

"${coreMemory.text}"

Requirements:
- Past tense
- Include character names and context
- Avoid clichés
- Be specific and memorable

Entry:`;

            const apiManager = new APIManager(this.settings);
            await apiManager.initialize();

            const response = await apiManager.generateLorebookEntries(simplePrompt, this.settings);
            return response.content
                .replace(/^(Entry:|Lorebook entry:)/i, '')
                .trim();

        } catch (error) {
            console.error('[NemoLore Auto-Lorebook] Simple generation failed:', error);
            // Ultimate fallback: use the core memory text directly
            return `${coreMemory.text} (Flagged as a significant moment in the conversation)`;
        }
    }
}

console.log('[NemoLore Hybrid Auto-Lorebook] Module loaded - AI Generation + Real-time Entity Learning + Project Gremlin Integration ready');