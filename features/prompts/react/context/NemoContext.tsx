/**
 * NemoContext - Global settings context for NemoPresetExt
 * Provides centralized access to extension settings with auto-save
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { NemoSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const EXTENSION_NAME = 'NemoPresetExt';

/**
 * Context value interface
 */
interface NemoContextValue {
    settings: NemoSettings;
    updateSetting: <K extends keyof NemoSettings>(key: K, value: NemoSettings[K]) => void;
    updateSettings: (updates: Partial<NemoSettings>) => void;
    isLoaded: boolean;
}

/**
 * Create the context
 */
const NemoContext = createContext<NemoContextValue | null>(null);

/**
 * Get settings from SillyTavern's extension_settings
 */
function getExtensionSettings(): Partial<NemoSettings> {
    try {
        // @ts-ignore - extension_settings is a global from SillyTavern
        if (typeof extension_settings !== 'undefined' && extension_settings[EXTENSION_NAME]) {
            return extension_settings[EXTENSION_NAME] as Partial<NemoSettings>;
        }
    } catch (e) {
        console.warn('[NemoContext] Could not access extension_settings:', e);
    }
    return {};
}

/**
 * Merge saved settings with defaults
 */
function loadSettings(): NemoSettings {
    const saved = getExtensionSettings();
    return { ...DEFAULT_SETTINGS, ...saved };
}

/**
 * Save settings to SillyTavern
 */
function saveToST(settings: NemoSettings): void {
    try {
        // @ts-ignore - extension_settings is a global from SillyTavern
        if (typeof extension_settings !== 'undefined') {
            extension_settings[EXTENSION_NAME] = { ...settings };

            // Call SillyTavern's debounced save
            // @ts-ignore - saveSettingsDebounced is a global from SillyTavern
            if (typeof saveSettingsDebounced === 'function') {
                saveSettingsDebounced();
            }
        }
    } catch (e) {
        console.error('[NemoContext] Failed to save settings:', e);
    }
}

/**
 * Provider props
 */
interface NemoProviderProps {
    children: ReactNode;
}

/**
 * NemoProvider - Wrap your app with this to access settings
 */
export function NemoProvider({ children }: NemoProviderProps): JSX.Element {
    const [settings, setSettings] = useState<NemoSettings>(DEFAULT_SETTINGS);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load settings on mount
    useEffect(() => {
        const loaded = loadSettings();
        setSettings(loaded);
        setIsLoaded(true);
    }, []);

    // Update a single setting
    const updateSetting = useCallback(<K extends keyof NemoSettings>(
        key: K,
        value: NemoSettings[K]
    ) => {
        setSettings(prev => {
            const next = { ...prev, [key]: value };
            saveToST(next);
            return next;
        });
    }, []);

    // Update multiple settings at once
    const updateSettings = useCallback((updates: Partial<NemoSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            saveToST(next);
            return next;
        });
    }, []);

    const value: NemoContextValue = {
        settings,
        updateSetting,
        updateSettings,
        isLoaded,
    };

    return (
        <NemoContext.Provider value={value}>
            {children}
        </NemoContext.Provider>
    );
}

/**
 * useNemoSettings - Hook to access settings in components
 */
export function useNemoSettings(): NemoContextValue {
    const context = useContext(NemoContext);
    if (!context) {
        throw new Error('useNemoSettings must be used within a NemoProvider');
    }
    return context;
}

/**
 * useNemoSetting - Hook to access a single setting
 */
export function useNemoSetting<K extends keyof NemoSettings>(
    key: K
): [NemoSettings[K], (value: NemoSettings[K]) => void] {
    const { settings, updateSetting } = useNemoSettings();
    const setValue = useCallback(
        (value: NemoSettings[K]) => updateSetting(key, value),
        [key, updateSetting]
    );
    return [settings[key], setValue];
}

export { NemoContext };
export type { NemoContextValue };
