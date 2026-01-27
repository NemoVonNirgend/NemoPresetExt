/**
 * Hook for toggling prompt enabled state via ST API
 */

import { useCallback } from 'react';
import { getPromptManager } from '../utils/stBridge';

// Flag to prevent observer interference
declare global {
    interface Window {
        _nemoTogglingPrompt: boolean;
    }
}

/**
 * Toggle a single prompt
 */
async function togglePrompt(identifier: string, enabled: boolean): Promise<boolean> {
    const promptManager = getPromptManager();
    if (!promptManager) return false;

    window._nemoTogglingPrompt = true;

    try {
        const activeCharacter = promptManager.activeCharacter;
        if (!activeCharacter) return false;

        const entry = promptManager.getPromptOrderEntry(activeCharacter, identifier);
        if (!entry) return false;

        // Clear token cache
        if (promptManager.tokenHandler?.getCounts) {
            const counts = promptManager.tokenHandler.getCounts();
            counts[identifier] = null;
        }

        entry.enabled = enabled;
        await promptManager.saveServiceSettings();

        return true;
    } catch (error) {
        console.error('Error toggling prompt:', error);
        return false;
    } finally {
        setTimeout(() => {
            window._nemoTogglingPrompt = false;
        }, 50);
    }
}

/**
 * Toggle multiple prompts (batch operation)
 */
async function toggleMultiple(identifiers: string[], enabled: boolean): Promise<boolean> {
    const promptManager = getPromptManager();
    if (!promptManager) return false;

    window._nemoTogglingPrompt = true;

    try {
        const activeCharacter = promptManager.activeCharacter;
        if (!activeCharacter) return false;

        for (const identifier of identifiers) {
            const entry = promptManager.getPromptOrderEntry(activeCharacter, identifier);
            if (entry) {
                if (promptManager.tokenHandler?.getCounts) {
                    const counts = promptManager.tokenHandler.getCounts();
                    counts[identifier] = null;
                }
                entry.enabled = enabled;
            }
        }

        await promptManager.saveServiceSettings();
        return true;
    } catch (error) {
        console.error('Error batch toggling prompts:', error);
        return false;
    } finally {
        setTimeout(() => {
            window._nemoTogglingPrompt = false;
        }, 50);
    }
}

/**
 * Hook for toggle operations
 */
export function useTogglePrompt() {
    const toggle = useCallback(async (identifier: string, enabled: boolean) => {
        return togglePrompt(identifier, enabled);
    }, []);

    const toggleAll = useCallback(async (identifiers: string[], enabled: boolean) => {
        return toggleMultiple(identifiers, enabled);
    }, []);

    return { toggle, toggleAll };
}

export { togglePrompt, toggleMultiple };
