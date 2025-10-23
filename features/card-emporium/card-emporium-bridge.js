// NemoPresetExt/card-emporium-bridge.js
// Bridge for communication between Card Emporium iframe and SillyTavern

import { LOG_PREFIX } from '../../core/utils.js';
import { getContext } from '../../../../../extensions.js';
import { callGenericPopup, Popup } from '../../../../../popup.js';
import { generateQuietPrompt, generateRaw } from '../../../../../../script.js';
import { getPresetManager } from '../../../../../preset-manager.js';
import { eventSource, event_types } from '../../../../../events.js';

const PRESET_NAME = 'CardEmporiumPreset';
const PRESET_API_ID = 'openai';

/**
 * Bridge for bidirectional communication with Card Emporium
 */
export class CardEmporiumBridge {
    constructor() {
        this.iframe = null;
        this.messageHandlers = new Map();
        this.pendingMessages = [];
        this.presetInstalled = false;
        this.csrfToken = null;
        this.setupMessageListener();
        this.installPreset();
        this.fetchCSRFToken();
    }

    /**
     * Fetch CSRF token from server
     */
    async fetchCSRFToken() {
        try {
            const response = await fetch('/csrf-token');
            const data = await response.json();
            this.csrfToken = data.token;
            console.log(`${LOG_PREFIX} CSRF token obtained`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to fetch CSRF token:`, error);
        }
    }

    /**
     * Register the iframe element
     */
    setIframe(iframe) {
        this.iframe = iframe;
        console.log(`${LOG_PREFIX} Card Emporium Bridge: iframe registered`);

        // Send any pending messages that were queued before iframe was ready
        if (this.pendingMessages.length > 0) {
            console.log(`${LOG_PREFIX} Sending ${this.pendingMessages.length} pending messages`);
            this.pendingMessages.forEach(({ type, data }) => {
                this.sendMessage(type, data);
            });
            this.pendingMessages = [];
        }
    }

    /**
     * Setup message listener for iframe communication
     */
    setupMessageListener() {
        window.addEventListener('message', async (event) => {
            // Security check - only accept messages from same origin
            if (event.origin !== window.location.origin) {
                return;
            }

            const { type, data, requestId } = event.data;

            console.log(`${LOG_PREFIX} Card Emporium Bridge received message:`, type, data, requestId ? `(requestId: ${requestId})` : '');

            // Handle different message types
            switch (type) {
                case 'EMPORIUM_READY':
                    await this.handleEmporiumReady();
                    break;
                case 'IMPORT_CHARACTER':
                    await this.handleImportCharacter(data);
                    break;
                case 'IMPORT_LOREBOOK':
                    await this.handleImportLorebook(data);
                    break;
                case 'GET_CHARACTER_LIST':
                    await this.handleGetCharacterList(requestId);
                    break;
                case 'GET_CURRENT_API_SETTINGS':
                    await this.handleGetApiSettings(requestId);
                    break;
                case 'GET_API_KEYS':
                    await this.handleGetApiKeys(requestId);
                    break;
                case 'GENERATE_TEXT':
                    await this.handleGenerateText(data, requestId);
                    break;
                case 'GENERATE_WITH_HISTORY':
                    await this.handleGenerateWithHistory(data, requestId);
                    break;
                case 'GENERATE_IMAGE':
                    await this.handleGenerateImage(data, requestId);
                    break;
                case 'GET_CONNECTION_PROFILES':
                    await this.handleGetConnectionProfiles(requestId);
                    break;
                case 'SET_ACTIVE_PROFILE':
                    await this.handleSetActiveProfile(data, requestId);
                    break;
                default:
                    console.log(`${LOG_PREFIX} Unknown message type:`, type);
            }
        });

        console.log(`${LOG_PREFIX} Card Emporium Bridge: message listener setup complete`);
    }

    /**
     * Send message to the iframe
     */
    sendMessage(type, data = {}, requestId = undefined) {
        if (!this.iframe || !this.iframe.contentWindow) {
            console.warn(`${LOG_PREFIX} Iframe not ready yet, queueing message:`, type);
            this.pendingMessages.push({ type, data, requestId });
            return;
        }

        const message = { type, data };
        if (requestId !== undefined) {
            message.requestId = requestId;
        }

        this.iframe.contentWindow.postMessage(
            message,
            window.location.origin
        );

        console.log(`${LOG_PREFIX} Sent message to Card Emporium:`, type, requestId ? `(requestId: ${requestId})` : '');
    }

    /**
     * Handle emporium ready event
     */
    async handleEmporiumReady() {
        console.log(`${LOG_PREFIX} Card Emporium is ready`);

        // Send current context to the emporium
        const context = getContext();

        // Get connection profiles
        const profiles = context.extensionSettings?.connectionManager?.profiles || [];
        const activeProfile = profiles.find(p => p.active) || profiles[0];

        this.sendMessage('SILLYTAVERN_CONTEXT', {
            hasCharacter: !!context.characterId,
            characterName: context.name1,
            userName: context.name2,
            apiType: context.main_api,
            profiles: profiles.map(p => ({
                id: p.id,
                name: p.name,
                api: p.api,
                active: p.active || false
            })),
            activeProfileId: activeProfile?.id || null
        });
    }

    /**
     * Handle character import request
     */
    async handleImportCharacter(characterData) {
        try {
            console.log(`${LOG_PREFIX} Importing character:`, characterData.name);

            // Ensure we have a CSRF token
            if (!this.csrfToken) {
                await this.fetchCSRFToken();
            }

            // Convert the character card to PNG format with embedded JSON
            const blob = await this.createCharacterCardFile(characterData);

            // Create FormData for upload
            const formData = new FormData();
            const filename = `${characterData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
            formData.append('avatar', blob, filename);

            // Upload to SillyTavern with CSRF token
            const response = await fetch('/api/characters/import', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': this.csrfToken
                },
                body: formData,
                cache: 'no-cache'
            });

            if (response.ok) {
                const result = await response.json();

                // Refresh character list in SillyTavern
                const context = getContext();
                await context.getCharacters();

                // Get the newly imported character
                const importedChar = context.characters.find(char =>
                    char.name === characterData.name ||
                    char.avatar === filename
                );

                // Emit event to notify SillyTavern UI that a character was added
                // This ensures the character navigator updates properly
                await eventSource.emit(event_types.CHARACTER_EDITED, importedChar?.avatar);

                // If character has a lorebook name in metadata, link it
                if (importedChar && characterData.lorebookName) {
                    console.log(`${LOG_PREFIX} Linking lorebook "${characterData.lorebookName}" to character`);

                    // 1. Link to character's world info
                    if (!importedChar.data) importedChar.data = {};
                    if (!importedChar.data.extensions) importedChar.data.extensions = {};

                    importedChar.data.extensions.world = characterData.lorebookName;

                    // Save the character with updated lorebook link
                    await fetch('/api/characters/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            avatar: importedChar.avatar,
                            character: importedChar
                        })
                    });

                    // 2. Link to chat metadata (like NemoLore does)
                    try {
                        const { METADATA_KEY, chat_metadata, saveMetadata } = await import('/scripts/world-info.js')
                            .catch(() => ({ METADATA_KEY: 'world_info', chat_metadata: {}, saveMetadata: null }));

                        if (chat_metadata && METADATA_KEY) {
                            chat_metadata[METADATA_KEY] = characterData.lorebookName;
                            if (saveMetadata) {
                                await saveMetadata();
                                console.log(`${LOG_PREFIX} Linked lorebook to chat metadata`);
                            }
                        }
                    } catch (metadataError) {
                        console.warn(`${LOG_PREFIX} Could not link to chat metadata:`, metadataError);
                    }

                    console.log(`${LOG_PREFIX} Lorebook linking complete`);
                }

                // Show success notification
                await callGenericPopup(
                    `<div style="padding: 20px; max-width: 500px;">
                        <h3 style="color: var(--customThemeColor); margin-bottom: 15px;">
                            ✅ Character Imported Successfully!
                        </h3>
                        <p><strong>Character:</strong> ${characterData.name}</p>
                        ${characterData.lorebookName ?
                            `<p><strong>Lorebook:</strong> ${characterData.lorebookName} <span style="color: var(--SmartThemeQuoteColor);">(linked)</span></p>` :
                            '<p><em>No lorebook</em></p>'
                        }
                        <p style="color: var(--SmartThemeQuoteColor); font-size: 0.9em; margin-top: 15px;">
                            ${characterData.lorebookName ?
                                'The character and lorebook are now available and linked. The lorebook will automatically activate when you chat with this character!' :
                                'The character is now available in your character list and ready to use!'
                            }
                        </p>
                    </div>`,
                    'TEXT',
                    '',
                    { okButton: 'Start Chatting!' }
                );

                // Notify emporium of success with character details
                this.sendMessage('IMPORT_SUCCESS', {
                    type: 'character',
                    name: characterData.name,
                    characterId: importedChar?.avatar || null
                });

                console.log(`${LOG_PREFIX} Character imported successfully:`, result);
            } else {
                throw new Error(`Import failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error importing character:`, error);

            await callGenericPopup(
                `❌ Failed to import character: ${error.message}`,
                'TEXT',
                'Import Error'
            );

            this.sendMessage('IMPORT_ERROR', {
                type: 'character',
                error: error.message
            });
        }
    }

    /**
     * Handle lorebook import request
     */
    async handleImportLorebook(lorebookData) {
        try {
            console.log(`${LOG_PREFIX} Importing lorebook:`, lorebookData.name);

            const context = getContext();

            // Ensure unique lorebook name
            const world_names = context.world_names || [];
            let lorebookName = lorebookData.name;
            let counter = 1;

            while (world_names.includes(lorebookName)) {
                console.log(`${LOG_PREFIX} Lorebook "${lorebookName}" already exists, trying variant...`);
                lorebookName = `${lorebookData.name}_${counter}`;
                counter++;
                if (counter > 10) {
                    lorebookName = `${lorebookData.name}_${Date.now()}`;
                    break;
                }
            }

            if (lorebookName !== lorebookData.name) {
                console.log(`${LOG_PREFIX} Using unique name: ${lorebookName}`);
                lorebookData.name = lorebookName;
            }

            // Format lorebook for SillyTavern compatibility
            const formattedLorebook = this.formatLorebookForSillyTavern(lorebookData);

            // Create lorebook JSON file
            const lorebookJson = JSON.stringify(formattedLorebook, null, 2);
            const blob = new Blob([lorebookJson], { type: 'application/json' });

            // Ensure we have a CSRF token
            if (!this.csrfToken) {
                await this.fetchCSRFToken();
            }

            // Create FormData for upload
            const formData = new FormData();
            const filename = `${lorebookName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
            formData.append('file', blob, filename);

            // Upload to SillyTavern with CSRF token
            const response = await fetch('/api/worldinfo/import', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': this.csrfToken
                },
                body: formData,
                cache: 'no-cache'
            });

            if (response.ok) {
                const result = await response.json();

                // Reload world info list to include the new lorebook
                await context.loadWorldInfoList?.();

                // Show success notification
                await callGenericPopup(
                    `<div style="padding: 20px; max-width: 500px;">
                        <h3 style="color: var(--customThemeColor); margin-bottom: 15px;">
                            ✅ Lorebook Imported Successfully!
                        </h3>
                        <p><strong>Name:</strong> ${lorebookName}</p>
                        <p><strong>Entries:</strong> ${Object.keys(formattedLorebook.entries || {}).length} entries</p>
                        <p style="color: var(--SmartThemeQuoteColor); font-size: 0.9em; margin-top: 15px;">
                            The lorebook is now available in your world info list.
                        </p>
                    </div>`,
                    'TEXT',
                    '',
                    { okButton: 'Great!' }
                );

                this.sendMessage('IMPORT_SUCCESS', {
                    type: 'lorebook',
                    name: lorebookName,
                    filename: filename
                });

                console.log(`${LOG_PREFIX} Lorebook imported successfully:`, result);

                // Return the final lorebook name for linking
                return lorebookName;
            } else {
                throw new Error(`Import failed: ${response.statusText}`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error importing lorebook:`, error);

            await callGenericPopup(
                `❌ Failed to import lorebook: ${error.message}`,
                'TEXT',
                'Import Error'
            );

            this.sendMessage('IMPORT_ERROR', {
                type: 'lorebook',
                error: error.message
            });

            return null;
        }
    }

    /**
     * Handle get character list request
     */
    async handleGetCharacterList(requestId) {
        try {
            const context = getContext();
            await context.getCharacters();

            const characterList = context.characters.map(char => ({
                name: char.name,
                avatar: char.avatar,
                // Provide full avatar URL for the iframe to load images
                avatarUrl: char.avatar ? `/characters/${encodeURIComponent(char.avatar)}` : null,
                description: char.description
            }));

            this.sendMessage('CHARACTER_LIST', { characters: characterList }, requestId);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting character list:`, error);
            this.sendMessage('ERROR', { message: error.message }, requestId);
        }
    }

    /**
     * Handle get API settings request
     */
    async handleGetApiSettings(requestId) {
        try {
            const context = getContext();

            this.sendMessage('API_SETTINGS', {
                apiType: context.main_api,
                model: context.getCurrentChatDetails?.()?.model || 'unknown'
            }, requestId);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting API settings:`, error);
            this.sendMessage('ERROR', { message: error.message }, requestId);
        }
    }

    /**
     * Handle get connection profiles request
     */
    async handleGetConnectionProfiles(requestId) {
        try {
            const context = getContext();
            const profiles = context.extensionSettings?.connectionManager?.profiles || [];
            const activeProfile = profiles.find(p => p.active) || profiles[0];

            this.sendMessage('CONNECTION_PROFILES', {
                profiles: profiles.map(p => ({
                    id: p.id,
                    name: p.name,
                    api: p.api,
                    active: p.active || false
                })),
                activeProfileId: activeProfile?.id || null
            }, requestId);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting connection profiles:`, error);
            this.sendMessage('ERROR', { message: error.message }, requestId);
        }
    }

    /**
     * Handle get API keys request (deprecated - use connection profiles instead)
     */
    async handleGetApiKeys(requestId) {
        try {
            const context = getContext();

            // Get the current API type and available keys
            const apiKeys = {
                hasKeys: true,
                apiType: context.main_api,
                // Don't send actual keys for security, just indicate they exist
                geminiAvailable: !!context.main_api,
                novelaiAvailable: false, // ST doesn't typically have NovelAI for images
                deepseekAvailable: false // Not typically configured
            };

            this.sendMessage('API_KEYS', apiKeys, requestId);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting API keys:`, error);
            this.sendMessage('ERROR', { message: error.message }, requestId);
        }
    }

    /**
     * Handle text generation request using SillyTavern's Connection Manager
     */
    async handleGenerateText(data, requestId) {
        try {
            const { prompt, maxTokens = 500, temperature = 0.9, systemPrompt, profileId } = data;

            console.log(`${LOG_PREFIX} Generating text via SillyTavern ConnectionManager...`);

            const context = getContext();

            // Use provided profileId or get the active one
            let activeProfileId = profileId;
            if (!activeProfileId) {
                const profiles = context.extensionSettings?.connectionManager?.profiles || [];
                const activeProfile = profiles.find(p => p.active);
                if (activeProfile) {
                    activeProfileId = activeProfile.id;
                } else if (profiles.length > 0) {
                    activeProfileId = profiles[0].id;
                } else {
                    throw new Error('No connection profile available. Please configure a connection profile in SillyTavern settings.');
                }
            }

            console.log(`${LOG_PREFIX} Using profile ID:`, activeProfileId);

            // Build messages array
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });

            // Use ConnectionManagerRequestService - same as World Info Recommender
            const response = await context.ConnectionManagerRequestService.sendRequest(
                activeProfileId,
                messages,
                maxTokens
            );

            console.log(`${LOG_PREFIX} Generation successful, response length: ${response?.content?.length || 0}`);

            this.sendMessage('GENERATE_TEXT_RESPONSE', {
                text: response.content || '',
                success: true
            }, requestId);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error generating text:`, error);

            // Provide helpful error messages
            let errorMessage = error.message || 'Unknown error occurred';

            if (error.message && error.message.includes('No connection profile')) {
                errorMessage = 'No connection profile available. Please:\n' +
                              '1. Go to SillyTavern settings\n' +
                              '2. Set up a connection profile\n' +
                              '3. Make sure it\'s configured correctly';
            } else if (error.message && error.message.includes('502') || error.message.includes('Bad Gateway')) {
                errorMessage = 'API connection failed. Please:\n' +
                              '1. Check if your AI API is running\n' +
                              '2. Test the selected profile in regular chat\n' +
                              '3. Try a different connection profile from the dropdown above';
            } else if (error.message && error.message.includes('API key')) {
                errorMessage = 'API key error. Please check your connection profile settings.';
            }

            this.sendMessage('GENERATE_TEXT_RESPONSE', {
                text: '',
                success: false,
                error: errorMessage
            }, requestId);
        }
    }

    /**
     * Handle generation with conversation history
     */
    async handleGenerateWithHistory(data, requestId) {
        try {
            const { messages, maxTokens = 2000, temperature = 0.9, profileId } = data;

            console.log(`${LOG_PREFIX} Generating with conversation history (${messages.length} messages)...`);

            const context = getContext();

            // Use provided profileId or get the active one
            let activeProfileId = profileId;
            if (!activeProfileId) {
                const profiles = context.extensionSettings?.connectionManager?.profiles || [];
                const activeProfile = profiles.find(p => p.active);
                if (activeProfile) {
                    activeProfileId = activeProfile.id;
                } else if (profiles.length > 0) {
                    activeProfileId = profiles[0].id;
                } else {
                    throw new Error('No connection profile available. Please configure a connection profile in SillyTavern settings.');
                }
            }

            console.log(`${LOG_PREFIX} Using profile ID:`, activeProfileId);
            console.log(`${LOG_PREFIX} Messages:`, JSON.stringify(messages, null, 2));

            // Get the profile to temporarily modify its preset
            const profile = context.extensionSettings?.connectionManager?.profiles?.find(p => p.id === activeProfileId);
            if (!profile) {
                throw new Error(`Profile not found: ${activeProfileId}`);
            }

            const presetName = this.getPresetName();
            console.log(`${LOG_PREFIX} Using Card Emporium preset: ${presetName || 'profile default'}`);

            // Temporarily swap preset if we have our own
            const originalPreset = profile.preset;
            if (presetName) {
                profile.preset = presetName;
            }

            try {
                // Use ConnectionManagerRequestService - it handles model selection, API routing, etc.
                const response = await context.ConnectionManagerRequestService.sendRequest(
                    activeProfileId,
                    messages,
                    maxTokens
                );

                console.log(`${LOG_PREFIX} Generation successful, response length: ${response?.content?.length || 0}`);

                this.sendMessage('GENERATE_WITH_HISTORY_RESPONSE', {
                    text: response.content || '',
                    success: true
                }, requestId);
            } finally {
                // Restore original preset
                if (presetName) {
                    profile.preset = originalPreset;
                }
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error generating with history:`, error);

            let errorMessage = error.message || 'Unknown error occurred';

            if (error.message && error.message.includes('No connection profile')) {
                errorMessage = 'No connection profile available. Please configure a connection profile in SillyTavern settings.';
            } else if (error.message && (error.message.includes('502') || error.message.includes('Bad Gateway'))) {
                errorMessage = 'API connection failed. Please check your AI API and try a different connection profile.';
            } else if (error.message && (error.message.includes('ECONNREFUSED') || error.message.includes('connect ECONNREFUSED'))) {
                errorMessage = 'Cannot connect to API endpoint. Please check:\n1. Is the API server running?\n2. Is the connection profile URL correct?\n3. Does the selected connection profile work in regular chat?';
            } else if (error.message && (error.message.includes('invalid model') || error.message.includes('model ID'))) {
                errorMessage = 'Invalid model selected in connection profile. Please:\n1. Go to Connection Manager settings\n2. Update the model name in the selected profile\n3. Make sure it matches a model supported by your API';
            }

            this.sendMessage('GENERATE_WITH_HISTORY_RESPONSE', {
                text: '',
                success: false,
                error: errorMessage
            }, requestId);
        }
    }

    /**
     * Handle image generation request using SillyTavern's API
     */
    async handleGenerateImage(data, requestId) {
        try {
            const { prompt, negativePrompt, width = 512, height = 768 } = data;

            console.log(`${LOG_PREFIX} Generating image via SillyTavern Image Generation extension...`);
            console.log(`${LOG_PREFIX} Prompt:`, prompt);

            const context = getContext();
            const sdSettings = context.extensionSettings?.sd || {};
            const sdSource = sdSettings.source;

            console.log(`${LOG_PREFIX} Using image source: ${sdSource}`);
            console.log(`${LOG_PREFIX} SD Settings:`, JSON.stringify(sdSettings, null, 2));

            let endpoint, payload, resultImageField;

            // Handle different image generation sources
            if (sdSource === 'google') {
                // Google AI (Gemini) image generation
                endpoint = '/api/google/generate-image';

                // Helper function to get closest aspect ratio for Google
                const getClosestAspectRatio = (width, height) => {
                    const ratio = width / height;
                    const ratios = {
                        '1:1': 1,
                        '3:4': 0.75,
                        '4:3': 1.33,
                        '9:16': 0.5625,
                        '16:9': 1.78
                    };

                    let closest = '1:1';
                    let minDiff = Math.abs(ratio - 1);

                    for (const [key, value] of Object.entries(ratios)) {
                        const diff = Math.abs(ratio - value);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closest = key;
                        }
                    }

                    return closest;
                };

                payload = {
                    prompt: prompt,
                    aspect_ratio: getClosestAspectRatio(width, height),
                    negative_prompt: negativePrompt || '',
                    model: sdSettings.model,
                    enhance: sdSettings.google_enhance,
                    api: sdSettings.google_api || 'makersuite',
                    seed: sdSettings.seed >= 0 ? sdSettings.seed : undefined,
                };
                resultImageField = 'image';

            } else if (sdSource === 'auto' || sdSource === 'vlad' || sdSource === 'drawthings') {
                // Stable Diffusion WebUI sources
                endpoint = '/api/sd/generate';

                let url, auth;
                if (sdSource === 'vlad') {
                    url = sdSettings.vlad_url;
                    auth = sdSettings.vlad_auth;
                } else if (sdSource === 'auto') {
                    url = sdSettings.auto_url;
                    auth = sdSettings.auto_auth;
                } else if (sdSource === 'drawthings') {
                    url = sdSettings.drawthings_url;
                    auth = sdSettings.drawthings_auth;
                }

                if (!url) {
                    throw new Error(`${sdSource} URL not configured. Please set it up in Image Generation settings.`);
                }

                payload = {
                    url: url,
                    auth: auth,
                    prompt: prompt,
                    negative_prompt: negativePrompt || '',
                    sampler_name: sdSettings.sampler || 'DPM++ 2M Karras',
                    scheduler: sdSettings.scheduler,
                    steps: sdSettings.steps || 30,
                    cfg_scale: sdSettings.scale || 7,
                    width: width,
                    height: height,
                    restore_faces: !!sdSettings.restore_faces,
                    enable_hr: false,
                    seed: sdSettings.seed >= 0 ? sdSettings.seed : undefined,
                    override_settings: {
                        CLIP_stop_at_last_layers: sdSettings.clip_skip || 2,
                    },
                    override_settings_restore_afterwards: true,
                    save_images: true,
                    send_images: true,
                    do_not_save_grid: false,
                    do_not_save_samples: false,
                };
                resultImageField = 'images';

            } else {
                throw new Error(`Image source "${sdSource}" not supported. Please configure Image Generation in SillyTavern settings.`);
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status} ${response.statusText}`;
                try {
                    const errorText = await response.text();
                    // Check if it's JSON error
                    try {
                        const errorJson = JSON.parse(errorText);
                        errorMessage = errorJson.error || errorJson.message || errorMessage;
                    } catch {
                        // Not JSON - check if it's HTML (error page)
                        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
                            errorMessage = `Server error (${response.status}). Check your Image Generation settings - API may not be configured.`;
                        } else {
                            // Use first 200 chars of error text
                            errorMessage = errorText.substring(0, 200);
                        }
                    }
                } catch {
                    // Error reading response text
                }
                throw new Error(`Image generation failed: ${errorMessage}`);
            }

            const result = await response.json();

            // Extract image based on source
            let imageData;
            if (resultImageField === 'images') {
                imageData = result.images?.[0] || '';
            } else {
                imageData = result.image || '';
            }

            this.sendMessage('GENERATE_IMAGE_RESPONSE', {
                image: imageData,
                success: true
            }, requestId);

        } catch (error) {
            console.error(`${LOG_PREFIX} Error generating image:`, error);

            // Provide helpful error message based on the error
            let errorMessage = error.message;
            if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                errorMessage = 'Authentication failed. Please check your Image Generation settings in SillyTavern:\n' +
                    '1. Go to Extensions > Image Generation\n' +
                    '2. Configure your API credentials (Google AI Studio key or Stable Diffusion URL)\n' +
                    '3. Make sure the selected source is properly set up';
            } else if (errorMessage.includes('500')) {
                errorMessage = 'Server error. The image generation API may not be configured correctly in SillyTavern. ' +
                    'Check Extensions > Image Generation settings.';
            } else if (errorMessage.includes('not supported')) {
                errorMessage = errorMessage + '\n\nSupported sources: Google AI (google), Stable Diffusion WebUI (auto/vlad/drawthings)';
            }

            this.sendMessage('GENERATE_IMAGE_RESPONSE', {
                image: '',
                success: false,
                error: errorMessage
            }, requestId);
        }
    }

    /**
     * Format lorebook for SillyTavern compatibility
     * Converts various lorebook formats to SillyTavern's expected structure
     */
    formatLorebookForSillyTavern(lorebookData) {
        const formatted = {
            name: lorebookData.name,
            entries: {}
        };

        // Handle both array and object formats
        const entriesArray = Array.isArray(lorebookData.entries) ?
            lorebookData.entries :
            (lorebookData.entries ? Object.values(lorebookData.entries) : []);

        // Convert entries to SillyTavern format
        entriesArray.forEach((entry, index) => {
            const uid = entry.uid || (Date.now() + index);
            formatted.entries[uid] = {
                uid: uid,
                comment: entry.comment || entry.title || '',
                content: entry.content || entry.description || '',
                key: Array.isArray(entry.key) ? entry.key :
                     (Array.isArray(entry.keywords) ? entry.keywords :
                     (typeof entry.keywords === 'string' ? entry.keywords.split(',').map(k => k.trim()) :
                     [])),
                keysecondary: entry.keysecondary || [],
                selectiveLogic: entry.selectiveLogic !== undefined ? entry.selectiveLogic : 0,
                addMemo: entry.addMemo !== undefined ? entry.addMemo : true,
                order: entry.order !== undefined ? entry.order : 100,
                position: entry.position !== undefined ? entry.position : 0,
                disable: entry.disable || false,
                constant: entry.constant || false,
                depth: entry.depth !== undefined ? entry.depth : 4,
                probability: entry.probability !== undefined ? entry.probability : 100
            };
        });

        console.log(`${LOG_PREFIX} Formatted ${entriesArray.length} lorebook entries`);
        return formatted;
    }

    /**
     * Create a character card PNG file with embedded JSON
     */
    async createCharacterCardFile(characterData) {
        // Get the character image (base64)
        const imageData = characterData.image || characterData.data?.avatar;

        if (!imageData) {
            throw new Error('No character image provided');
        }

        // Create a canvas to embed the JSON in the PNG
        const img = new Image();
        img.src = imageData;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Convert canvas to blob with embedded metadata
        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });

        // Embed character JSON in PNG tEXt chunk
        // SillyTavern expects the character data in a 'chara' tEXt chunk
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Prepare character JSON for embedding
        // Use characterData.data if available (the CharacterData object), otherwise use characterData itself
        const characterJson = JSON.stringify(characterData.data || characterData);
        const base64Json = btoa(unescape(encodeURIComponent(characterJson)));

        // Embed the base64-encoded JSON in PNG tEXt chunk
        const pngWithMetadata = this.embedTextChunk(uint8Array, 'chara', base64Json);

        return new Blob([pngWithMetadata], { type: 'image/png' });
    }

    /**
     * Embed a tEXt chunk in a PNG file
     * Reference: PNG specification for tEXt chunks
     */
    embedTextChunk(pngData, keyword, text) {
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

        // Find IEND chunk (marks end of PNG)
        const iendIndex = this.findIENDChunk(pngData);

        if (iendIndex === -1) {
            console.error(`${LOG_PREFIX} Could not find IEND chunk in PNG`);
            return pngData; // Return original if can't find IEND
        }

        // Create tEXt chunk
        const textChunk = this.createTextChunk(keyword, text);

        // Insert tEXt chunk before IEND
        const result = new Uint8Array(pngData.length + textChunk.length);
        result.set(pngData.slice(0, iendIndex), 0);
        result.set(textChunk, iendIndex);
        result.set(pngData.slice(iendIndex), iendIndex + textChunk.length);

        return result;
    }

    /**
     * Find the IEND chunk position in PNG data
     */
    findIENDChunk(data) {
        // IEND chunk type is 0x49454E44
        for (let i = 0; i < data.length - 12; i++) {
            if (data[i] === 0x49 && data[i + 1] === 0x45 &&
                data[i + 2] === 0x4E && data[i + 3] === 0x44) {
                // Found "IEND", back up 4 bytes to get length field
                return i - 4;
            }
        }
        return -1;
    }

    /**
     * Create a PNG tEXt chunk with keyword and text
     */
    createTextChunk(keyword, text) {
        // tEXt chunk format:
        // - 4 bytes: length (of data, not including length and CRC fields)
        // - 4 bytes: chunk type ("tEXt")
        // - N bytes: keyword (Latin-1 string) + null separator + text (Latin-1 string)
        // - 4 bytes: CRC32 checksum

        const keywordBytes = new TextEncoder().encode(keyword);
        const textBytes = new TextEncoder().encode(text);

        const dataLength = keywordBytes.length + 1 + textBytes.length; // +1 for null separator
        const chunk = new Uint8Array(12 + dataLength);

        // Length (4 bytes, big-endian)
        const dataView = new DataView(chunk.buffer);
        dataView.setUint32(0, dataLength, false); // false = big-endian

        // Chunk type: "tEXt" (4 bytes)
        chunk[4] = 0x74; // 't'
        chunk[5] = 0x45; // 'E'
        chunk[6] = 0x58; // 'X'
        chunk[7] = 0x74; // 't'

        // Keyword + null separator + text
        chunk.set(keywordBytes, 8);
        chunk[8 + keywordBytes.length] = 0; // null separator
        chunk.set(textBytes, 8 + keywordBytes.length + 1);

        // CRC32 (4 bytes)
        // CRC is calculated over chunk type and data (not length field)
        const crc = this.crc32(chunk.slice(4, 8 + dataLength));
        dataView.setUint32(8 + dataLength, crc, false);

        return chunk;
    }

    /**
     * Calculate CRC32 checksum (PNG uses this for chunk integrity)
     */
    crc32(data) {
        // CRC32 table (standard PNG CRC table)
        if (!this.crcTable) {
            this.crcTable = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let crc = i;
                for (let j = 0; j < 8; j++) {
                    crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
                }
                this.crcTable[i] = crc;
            }
        }

        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
            crc = this.crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0; // >>> 0 converts to unsigned 32-bit int
    }

    /**
     * Handle setting active profile
     */
    async handleSetActiveProfile(data, requestId) {
        try {
            const { profileId } = data;
            console.log(`${LOG_PREFIX} Setting active profile:`, profileId);

            const context = getContext();
            const profiles = context.extensionSettings?.connectionManager?.profiles || [];

            // Deactivate all profiles
            profiles.forEach(p => p.active = false);

            // Activate the selected profile
            const targetProfile = profiles.find(p => p.id === profileId);
            if (targetProfile) {
                targetProfile.active = true;

                // Save settings
                if (typeof context.saveSettingsDebounced === 'function') {
                    context.saveSettingsDebounced();
                }

                console.log(`${LOG_PREFIX} Active profile set to:`, targetProfile.name);

                // Send confirmation back with updated profiles
                this.sendMessage('PROFILE_CHANGED', {
                    success: true,
                    profiles: profiles.map(p => ({
                        id: p.id,
                        name: p.name,
                        api: p.api,
                        active: p.active || false
                    })),
                    activeProfileId: profileId
                }, requestId);
            } else {
                throw new Error(`Profile not found: ${profileId}`);
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error setting active profile:`, error);
            this.sendMessage('PROFILE_CHANGED', {
                success: false,
                error: error.message
            }, requestId);
        }
    }

    /**
     * Install the Card Emporium preset if it doesn't exist
     */
    async installPreset() {
        const presetFileName = 'CardEmporiumPreset.json';
        const presetPath = `scripts/extensions/third-party/NemoPresetExt/${presetFileName}`;

        try {
            const response = await fetch(presetPath);

            if (!response.ok) {
                console.error(`${LOG_PREFIX} Failed to fetch ${presetFileName}. Status: ${response.status}`);
                return;
            }

            const presetData = await response.json();

            // Validate structure
            if (!presetData || typeof presetData !== 'object' ||
                !Array.isArray(presetData.prompts) || presetData.prompts.length === 0) {
                console.error(`${LOG_PREFIX} Invalid preset structure in ${presetFileName}`);
                return;
            }

            const presetManager = getPresetManager(PRESET_API_ID);

            if (!presetManager) {
                console.error(`${LOG_PREFIX} Could not get Preset Manager for '${PRESET_API_ID}'`);
                return;
            }

            // Check if preset already exists
            const existingPreset = presetManager.findPreset(PRESET_NAME);

            if (existingPreset !== undefined && existingPreset !== null) {
                console.log(`${LOG_PREFIX} Preset "${PRESET_NAME}" already installed`);
                this.presetInstalled = true;
            } else {
                // Save the preset
                await presetManager.savePreset(PRESET_NAME, presetData);
                console.log(`${LOG_PREFIX} Preset "${PRESET_NAME}" successfully installed`);
                this.presetInstalled = true;
            }

        } catch (error) {
            console.error(`${LOG_PREFIX} Error installing preset:`, error);
        }
    }

    /**
     * Get the preset name to use for Card Emporium generations
     */
    getPresetName() {
        return this.presetInstalled ? PRESET_NAME : null;
    }
}

// Create singleton instance
export const cardEmporiumBridge = new CardEmporiumBridge();
