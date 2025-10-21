/**
 * SillyTavern Integration Module
 * Provides seamless communication between Card Emporium and SillyTavern
 */

export interface ConnectionProfile {
    id: string;
    name: string;
    api: string;
    active: boolean;
}

export interface SillyTavernContext {
    hasCharacter: boolean;
    characterName: string;
    userName: string;
    apiType: string;
    profiles?: ConnectionProfile[];
    activeProfileId?: string | null;
}

export class SillyTavernIntegration {
    private isEmbedded: boolean = false;
    private messageId: number = 0;
    private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
    private activeProfileId: string | null = null;
    private profiles: ConnectionProfile[] = [];

    constructor() {
        this.isEmbedded = window.self !== window.top;
        this.setupMessageListener();

        if (this.isEmbedded) {
            this.notifyReady();
        }
    }

    /**
     * Check if running inside SillyTavern
     */
    isInSillyTavern(): boolean {
        return this.isEmbedded;
    }

    /**
     * Setup message listener
     */
    private setupMessageListener() {
        window.addEventListener('message', (event) => {
            // Security check
            if (event.origin !== window.location.origin) {
                return;
            }

            const { type, data, requestId } = event.data;

            console.log('[Emporium] Received message from SillyTavern:', type, data);

            // Handle responses to our requests
            if (requestId && this.pendingRequests.has(requestId)) {
                const { resolve } = this.pendingRequests.get(requestId)!;
                resolve(data);
                this.pendingRequests.delete(requestId);
                return;
            }

            // Handle incoming messages
            this.handleMessage(type, data);
        });
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(type: string, data: any) {
        switch (type) {
            case 'SILLYTAVERN_CONTEXT':
                this.handleContextUpdate(data);
                break;
            case 'IMPORT_SUCCESS':
                this.handleImportSuccess(data);
                break;
            case 'IMPORT_ERROR':
                this.handleImportError(data);
                break;
            case 'CHARACTER_LIST':
                // Handled by promise resolution
                break;
            case 'API_SETTINGS':
                // Handled by promise resolution
                break;
            case 'API_KEYS':
                // Handled by promise resolution
                break;
            case 'GENERATE_TEXT_RESPONSE':
                // Handled by promise resolution
                break;
            case 'GENERATE_WITH_HISTORY_RESPONSE':
                // Handled by promise resolution
                break;
            case 'GENERATE_IMAGE_RESPONSE':
                // Handled by promise resolution
                break;
            case 'PROFILE_CHANGED':
                // Handled by promise resolution
                break;
        }
    }

    /**
     * Send message to SillyTavern
     */
    private sendMessage(type: string, data: any = {}, needsResponse: boolean = false): Promise<any> | void {
        if (!this.isEmbedded) {
            console.log('[Emporium] Not embedded in SillyTavern, skipping message');
            return needsResponse ? Promise.resolve(null) : undefined;
        }

        const requestId = needsResponse ? ++this.messageId : undefined;

        window.parent.postMessage(
            { type, data, requestId },
            window.location.origin
        );

        if (needsResponse) {
            return new Promise((resolve, reject) => {
                this.pendingRequests.set(requestId!, { resolve, reject });

                // Timeout after 3 minutes (some models are slow)
                setTimeout(() => {
                    if (this.pendingRequests.has(requestId!)) {
                        this.pendingRequests.delete(requestId!);
                        reject(new Error('Request timeout - generation took longer than 3 minutes'));
                    }
                }, 180000);
            });
        }
    }

    /**
     * Notify SillyTavern that the emporium is ready
     */
    private notifyReady() {
        console.log('[Emporium] Notifying SillyTavern that emporium is ready');
        this.sendMessage('EMPORIUM_READY');
    }

    /**
     * Import character into SillyTavern
     */
    async importCharacter(characterData: any): Promise<void> {
        console.log('[Emporium] Requesting character import:', characterData.name);

        if (!this.isEmbedded) {
            // Fallback: Download as file
            this.downloadCharacter(characterData);
            return;
        }

        this.sendMessage('IMPORT_CHARACTER', characterData);
    }

    /**
     * Import lorebook into SillyTavern
     */
    async importLorebook(lorebookData: any): Promise<void> {
        console.log('[Emporium] Requesting lorebook import:', lorebookData.name);

        if (!this.isEmbedded) {
            // Fallback: Download as file
            this.downloadLorebook(lorebookData);
            return;
        }

        this.sendMessage('IMPORT_LOREBOOK', lorebookData);
    }

    /**
     * Get list of characters from SillyTavern
     */
    async getCharacterList(): Promise<any[]> {
        if (!this.isEmbedded) {
            return [];
        }

        const response = await this.sendMessage('GET_CHARACTER_LIST', {}, true);
        return response?.characters || [];
    }

    /**
     * Get current API settings from SillyTavern
     */
    async getApiSettings(): Promise<any> {
        if (!this.isEmbedded) {
            return null;
        }

        return await this.sendMessage('GET_CURRENT_API_SETTINGS', {}, true);
    }

    /**
     * Check if API keys are available in SillyTavern
     */
    async checkApiKeys(): Promise<any> {
        if (!this.isEmbedded) {
            return { hasKeys: false };
        }

        return await this.sendMessage('GET_API_KEYS', {}, true);
    }

    /**
     * Generate text using SillyTavern's API
     */
    async generateText(prompt: string, options: {
        maxTokens?: number;
        temperature?: number;
        systemPrompt?: string;
        stream?: boolean;
        profileId?: string;
    } = {}): Promise<string> {
        if (!this.isEmbedded) {
            throw new Error('Text generation only available in SillyTavern');
        }

        const response = await this.sendMessage('GENERATE_TEXT', {
            prompt,
            profileId: options.profileId || this.activeProfileId,
            ...options
        }, true);

        if (!response.success) {
            throw new Error(response.error || 'Generation failed');
        }

        return response.text;
    }

    /**
     * Generate text using conversation history (multi-turn chat)
     */
    async generateWithHistory(messages: Array<{role: string; content: string}>, options: {
        maxTokens?: number;
        temperature?: number;
        profileId?: string;
    } = {}): Promise<string> {
        if (!this.isEmbedded) {
            throw new Error('Text generation only available in SillyTavern');
        }

        const response = await this.sendMessage('GENERATE_WITH_HISTORY', {
            messages,
            profileId: options.profileId || this.activeProfileId,
            ...options
        }, true);

        if (!response.success) {
            throw new Error(response.error || 'Generation failed');
        }

        return response.text;
    }

    /**
     * Generate image using SillyTavern's Stable Diffusion API
     */
    async generateImage(prompt: string, options: {
        negativePrompt?: string;
        width?: number;
        height?: number;
    } = {}): Promise<string> {
        if (!this.isEmbedded) {
            throw new Error('Image generation only available in SillyTavern');
        }

        const response = await this.sendMessage('GENERATE_IMAGE', {
            prompt,
            ...options
        }, true);

        if (!response.success) {
            throw new Error(response.error || 'Image generation failed');
        }

        return response.image;
    }

    /**
     * Get active connection profile ID
     */
    getActiveProfileId(): string | null {
        return this.activeProfileId;
    }

    /**
     * Get all connection profiles
     */
    getProfiles(): ConnectionProfile[] {
        return this.profiles;
    }

    /**
     * Set active connection profile
     */
    async setActiveProfile(profileId: string): Promise<void> {
        if (!this.isEmbedded) {
            console.warn('[Emporium] Not embedded, cannot change profile');
            return;
        }

        const response = await this.sendMessage('SET_ACTIVE_PROFILE', { profileId }, true);

        if (response.success) {
            // Update local state
            this.profiles = response.profiles || [];
            this.activeProfileId = response.activeProfileId;
            console.log('[Emporium] Profile changed successfully to:', profileId);
        } else {
            throw new Error(response.error || 'Failed to change profile');
        }
    }

    /**
     * Handle context update from SillyTavern
     */
    private handleContextUpdate(context: SillyTavernContext) {
        console.log('[Emporium] Received SillyTavern context:', context);

        // Store profiles
        if (context.profiles) {
            this.profiles = context.profiles;
        }
        if (context.activeProfileId) {
            this.activeProfileId = context.activeProfileId;
        }

        // Store context for later use
        (window as any).__SILLYTAVERN_CONTEXT = context;

        // Notify React components
        window.dispatchEvent(new CustomEvent('st-context-update', { detail: context }));
    }

    /**
     * Handle import success
     */
    private handleImportSuccess(data: any) {
        console.log('[Emporium] Import successful:', data);
        // Could trigger a toast notification in the React app
        window.dispatchEvent(new CustomEvent('st-import-success', { detail: data }));
    }

    /**
     * Handle import error
     */
    private handleImportError(data: any) {
        console.error('[Emporium] Import error:', data);
        window.dispatchEvent(new CustomEvent('st-import-error', { detail: data }));
    }

    /**
     * Fallback: Download character as PNG file
     */
    private downloadCharacter(characterData: any) {
        const a = document.createElement('a');
        const filename = `${characterData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;

        // Use the character image
        a.href = characterData.image || characterData.data?.avatar;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        console.log('[Emporium] Downloaded character:', filename);
    }

    /**
     * Fallback: Download lorebook as JSON file
     */
    private downloadLorebook(lorebookData: any) {
        const json = JSON.stringify(lorebookData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `${lorebookData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;

        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[Emporium] Downloaded lorebook:', filename);
    }
}

// Export singleton instance
export const sillyTavernIntegration = new SillyTavernIntegration();

// Make it globally available
(window as any).sillyTavernIntegration = sillyTavernIntegration;
