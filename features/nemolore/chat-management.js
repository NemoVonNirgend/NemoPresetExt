/**
 * Chat Management System - Intelligent Chat Setup Popups
 */

// NOTE: Core SillyTavern functions are globally available.

import { AutoLorebookManager } from './auto-lorebook.js';
import {
    chat_metadata,
    characters,
    this_chid,
    world_names,
    saveMetadata,
    callPopup,
    getContext,
    saveSettingsDebounced
} from './utils/st-compatibility.js';

export class ChatManagementManager {
    constructor(settings, state, notificationManager, autoLorebookManager) {
        this.settings = settings;
        this.state = state;
        this.notificationManager = notificationManager;
        this.autoLorebookManager = autoLorebookManager;
        this.isPopupActive = false;
        this.METADATA_KEY = 'nemolore_lorebook';
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        console.log('[NemoLore Chat Management] Initializing...');
        this.isInitialized = true;
    }

    async handleIntelligentLorebookSetup(chatId) {
        console.log('[NemoLore Chat Management] handleIntelligentLorebookSetup called with chatId:', chatId);
        console.log('[NemoLore Chat Management] isLorebookCreationInProgress:', this.state.isLorebookCreationInProgress);
        console.log('[NemoLore Chat Management] this_chid:', this_chid);

        // Don't show setup popups if NemoLore is disabled
        if (!this.settings.enabled) {
            console.log('[NemoLore Chat Management] Skipping - NemoLore is disabled');
            return;
        }

        if (this.state.isLorebookCreationInProgress) {
            console.log('[NemoLore Chat Management] Skipping - lorebook creation already in progress');
            return;
        }

        this.state.isLorebookCreationInProgress = true;
        try {
            // Check both NemoLore's key AND SillyTavern's standard key
            const nemoLoreLorebookKey = chat_metadata[this.METADATA_KEY];
            const stLorebookKey = chat_metadata['world_info'];
            const existingChatLorebook = nemoLoreLorebookKey || stLorebookKey;

            const characterLorebook = characters[this_chid]?.data?.world;
            const availableLorebooks = world_names;

            console.log('[NemoLore Chat Management] NemoLore lorebook key:', nemoLoreLorebookKey);
            console.log('[NemoLore Chat Management] ST lorebook key:', stLorebookKey);
            console.log('[NemoLore Chat Management] Existing chat lorebook:', existingChatLorebook);
            console.log('[NemoLore Chat Management] Character lorebook:', characterLorebook);
            console.log('[NemoLore Chat Management] Available lorebooks:', availableLorebooks);
            console.log('[NemoLore Chat Management] chat_metadata exists:', !!chat_metadata);
            console.log('[NemoLore Chat Management] this_chid:', this_chid);

            // Check if a character is actually loaded
            if (typeof this_chid === 'undefined' || this_chid === null) {
                console.log('[NemoLore Chat Management] No character loaded yet, skipping setup');
                this.state.isLorebookCreationInProgress = false;
                return;
            }

            // Determine the flow based on what's available
            if (existingChatLorebook && availableLorebooks.includes(existingChatLorebook)) {
                // Chat already has a lorebook assigned - use it silently
                this.state.currentChatLorebook = existingChatLorebook;
                console.log(`[NemoLore Chat Management] Using existing lorebook: ${existingChatLorebook}`);
                // Don't show popup, just use it
            } else if (characterLorebook && availableLorebooks.includes(characterLorebook)) {
                // Character has a lorebook - attach it to chat
                this.state.currentChatLorebook = characterLorebook;
                console.log(`[NemoLore Chat Management] Attaching character lorebook to chat: ${characterLorebook}`);
                // Attach to chat metadata
                if (chat_metadata) {
                    chat_metadata['world_info'] = characterLorebook;
                    chat_metadata[this.METADATA_KEY] = characterLorebook;
                    if (saveMetadata) await saveMetadata();
                }
            } else {
                // No lorebooks - show the new chat flow
                console.log('[NemoLore Chat Management] Showing new chat flow');
                await this.handleNewChatFlow(chatId);
            }
        } catch (error) {
            console.error(`[NemoLore Chat Management] Error in intelligent setup:`, error);
            // Show error notification to user
            if (this.notificationManager) {
                this.notificationManager.showMessage(`❌ NemoLore setup error: ${error.message}`, 5000);
            }
        } finally {
            this.state.isLorebookCreationInProgress = false;
            console.log('[NemoLore Chat Management] Setup complete, flag reset');
        }
    }

    /**
     * Force reset the creation-in-progress flag if it gets stuck
     */
    resetCreationFlag() {
        console.log('[NemoLore Chat Management] Manually resetting isLorebookCreationInProgress flag');
        this.state.isLorebookCreationInProgress = false;
    }

    async handleCharacterLorebookFlow(characterLorebook, chatId) {
        const characterName = characters[this_chid]?.name || 'Unknown';

        const action = await this.notificationManager.show(
            `🧠 NemoLore Setup\n\n"${characterName}" has lorebook "${characterLorebook}"\n\nHow should NemoLore manage this chat?`,
            [
                { action: 'use-existing', text: '📚 Use character lorebook' },
                { action: 'add-to-existing', text: '🤖 Enhanced auto-management' },
                { action: 'create-new', text: '📝 Create separate NemoLore book' },
                { action: 'summaries-only', text: '💭 Just summaries, no lorebook' }
            ],
            20000
        );

        switch (action) {
            case 'use-existing':
                this.state.currentChatLorebook = characterLorebook;
                if (chat_metadata) {
                    chat_metadata[this.METADATA_KEY] = characterLorebook;
                    if (saveMetadata) await saveMetadata();
                }
                break;
            case 'add-to-existing':
                this.state.currentChatLorebook = characterLorebook;
                if (chat_metadata) {
                    chat_metadata[this.METADATA_KEY] = characterLorebook;
                    if (saveMetadata) await saveMetadata();
                }
                this.settings.auto_summarize = true;
                this.settings.enableAutoLorebook = true;
                this.settings.enableVectorization = true;
                this.saveSettings();
                const currentCharacter = characters[this_chid];
                if (currentCharacter && this.autoLorebookManager) {
                    await this.autoLorebookManager.generateAndCreateLorebook(currentCharacter, characterLorebook, false);
                }
                this.notificationManager.showMessage(`🤖 Enhanced auto-management enabled with "${characterLorebook}"!`, 4000);
                break;
            case 'create-new':
                await this.createNewLorebookFlow(chatId);
                break;
            case 'summaries-only':
                this.state.currentChatLorebook = null;
                break;
            default:
                this.state.currentChatLorebook = characterLorebook;
                break;
        }
        await this.offerSummarySetup();
    }

    async handleNewChatFlow(chatId) {
        // Double-check if NemoLore is still enabled before showing popup
        if (!this.settings.enabled) {
            console.log('[NemoLore Chat Management] Skipping new chat flow - NemoLore disabled');
            return;
        }
        
        const action = await this.notificationManager.show(
            `🧠 NemoLore Setup\n\nNew conversation detected! How would you like NemoLore to assist?`,
            [
                { action: 'create-lorebook', text: '📚 Create lorebook + summaries' },
                { action: 'auto-manage', text: '🤖 Automatic management' },
                { action: 'summaries-only', text: '💭 Just summaries' },
                { action: 'skip-setup', text: '⏭️ Skip for now' }
            ],
            20000
        );

        switch (action) {
            case 'create-lorebook':
                await this.createNewLorebookFlow(chatId);
                break;
            case 'auto-manage':
                this.state.currentChatLorebook = null;
                this.settings.auto_summarize = true;
                this.settings.enableAutoLorebook = true;
                this.settings.enableVectorization = true;
                this.saveSettings();
                this.notificationManager.showMessage('🤖 Automatic management enabled!', 4000);
                break;
            case 'summaries-only':
                this.state.currentChatLorebook = null;
                await this.offerSummarySetup();
                break;
            case 'skip-setup':
            default:
                this.state.currentChatLorebook = null;
                this.notificationManager.showMessage('⏭️ NemoLore setup skipped.', 3000);
                break;
        }
    }

    async createNewLorebookFlow(chatId) {
        // Step 1: Create the empty lorebook file and link it.
        const lorebookName = await this.autoLorebookManager.createLorebookFile(chatId);

        if (lorebookName) {
            this.state.currentChatLorebook = lorebookName;

            // Step 2: Ask the user if they want to populate it.
            const result = await callPopup(`
                <div style="padding: 20px; max-width: 500px;">
                    <h3 style="color: var(--customThemeColor);">📚 Lorebook Created</h3>
                    <p>Lorebook <strong>"${lorebookName}"</strong> is ready. Populate it with AI-generated entries for the current character?</p>
                </div>`, 'confirm');

            if (result) {
                // Step 3: If confirmed, generate and add the entries.
                const currentCharacter = characters[this_chid];
                if (currentCharacter && this.autoLorebookManager) {
                    // The second argument is the lorebook name to populate.
                    await this.autoLorebookManager.generateAndCreateLorebook(currentCharacter, lorebookName, false);
                }
            }
            // Optional: Ask about summaries after the main flow.
            await this.offerSummarySetup();
        } else {
            this.notificationManager.showMessage('❌ Failed to create lorebook file.', 5000);
        }
    }

    async offerLorebookEnhancement(lorebookName) {
        const action = await this.notificationManager.show(
            `📚 Chat Lorebook Found: "${lorebookName}"`,
            [
                { action: 'enhance', text: 'Add new entries' },
                { action: 'summaries', text: 'Just enable summaries' },
                { action: 'skip', text: 'Continue as-is' }
            ],
            15000
        );

        if (action === 'enhance') {
            const currentCharacter = characters[this_chid];
            if (currentCharacter && this.autoLorebookManager) {
                await this.autoLorebookManager.generateAndCreateLorebook(currentCharacter, this.state.currentChatLorebook, false);
            }
        }
        if (action !== 'skip') {
            await this.offerSummarySetup();
        }
    }

    async offerSummarySetup() {
        if (!this.settings.auto_summarize) {
            const action = await this.notificationManager.show(
                `🧠 Enable automatic message summarization to maintain context in long chats?`,
                [
                    { action: 'enable', text: '✅ Yes, enable summaries' },
                    { action: 'decline', text: '❌ No thanks' }
                ],
                15000
            );

            if (action === 'enable') {
                this.settings.auto_summarize = true;
                this.saveSettings();
                this.notificationManager.showMessage('✅ Message summarization enabled!', 3000);
            }
        }
    }

    saveSettings() {
        const context = getContext();
        if (context && context.extension_settings) {
            if (!context.extension_settings.NemoPresetExt) {
                context.extension_settings.NemoPresetExt = {};
            }
            if (!context.extension_settings.NemoPresetExt.nemolore) {
                context.extension_settings.NemoPresetExt.nemolore = {};
            }
            Object.assign(context.extension_settings.NemoPresetExt.nemolore, this.settings);
            saveSettingsDebounced();
        }
    }
}

console.log('[NemoLore Chat Management] Module loaded');
