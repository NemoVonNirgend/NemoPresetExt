/**
 * Core Settings Manager
 * RECOVERY VERSION - Centralized settings management
 */

import {
    saveSettingsDebounced,
    chat,
    chat_metadata,
    this_chid,
    getCurrentChatId,
    saveMetadata,
    callPopup,
    eventSource,
    event_types,
    saveChatConditional,
    characters,
    extension_prompt_roles,
    active_character,
    generateQuietPrompt,
    substituteParamsExtended,
    generateRaw,
    getMaxContextSize,
    getRequestHeaders,
    main_api
} from '../../../../../../../script.js';

// SillyTavern imports - graceful fallback for missing modules
let selected_group, extension_settings, renderExtensionTemplateAsync, writeExtensionField, getContext;

try {
    const groupChatsModule = await import('../../../../../../../scripts/group-chats.js').catch(() => null);
    const extensionsModule = await import('../../../../../../../scripts/extensions.js').catch(() => null);
    
    if (groupChatsModule) {
        selected_group = groupChatsModule.selected_group;
    }
    
    if (extensionsModule) {
        extension_settings = extensionsModule.extension_settings || {};
        renderExtensionTemplateAsync = extensionsModule.renderExtensionTemplateAsync;
        writeExtensionField = extensionsModule.writeExtensionField;
        getContext = extensionsModule.getContext || (() => ({ extension_settings: {} }));
    }
} catch (error) {
    console.warn('[NemoLore Core Settings] SillyTavern modules not available:', error);
    // Provide fallback values
    extension_settings = {};
    getContext = () => ({ extension_settings: {} });
    writeExtensionField = () => {};
    renderExtensionTemplateAsync = () => Promise.resolve('');
}

/**
 * Centralized Settings Manager for NemoLore
 */
export class SettingsManager {
    constructor() {
        this.extensionName = 'NemoLore';
        this.defaultSettings = this.getDefaultSettings();
        this.settings = {};
        this.isInitialized = false;
        this.lastSaveTime = null;
        
        // Settings validation rules
        this.validationRules = {
            enabled: 'boolean',
            autoSummarization: 'boolean',
            contextInterception: 'boolean',
            maxContextSize: { type: 'number', min: 1000, max: 100000 },
            summaryLength: { type: 'number', min: 50, max: 1000 }
        };
        
        console.log('[NemoLore Settings Manager] Constructor completed');
    }

    /**
     * Get default settings configuration
     */
    getDefaultSettings() {
        return {
            // Core Settings
            enabled: true,
            autoSummarization: true,
            contextInterception: true,
            debugMode: false,
            
            // Context Management
            maxContextSize: 4000,
            maxMessages: 50,
            compressionRatio: 0.3,
            enableAutoHiding: true,
            
            // Summarization Settings
            summarization: {
                enabled: true,
                minMessages: 5,
                maxLength: 200,
                preserveImportant: true,
                useAI: true,
                provider: 'default'
            },
            
            // Vectorization Settings
            vectorization: {
                enabled: true,
                maxVectors: 10000,
                cacheSize: 1000,
                embeddingModel: 'default',
                indexType: 'cosine'
            },
            
            // Search Settings
            search: {
                algorithms: {
                    bm25: { enabled: true, weight: 0.3 },
                    cosine: { enabled: true, weight: 0.25 },
                    semantic: { enabled: true, weight: 0.25 },
                    temporal: { enabled: true, weight: 0.1 },
                    contextual: { enabled: true, weight: 0.1 }
                },
                fusionMethod: 'hybrid',
                resultLimit: 10,
                minScore: 0.1
            },
            
            // Lorebook Settings
            lorebook: {
                enabled: true,
                autoCreate: true,
                minOccurrences: 3,
                maxEntries: 500,
                entryLength: 300,
                scanDepth: 50
            },

            // Noun Highlighting Settings
            highlightNouns: true,
            
            // Performance Settings
            performance: {
                monitoringEnabled: true,
                autoOptimization: true,
                maxProcessingTime: 5000,
                batchSize: 100,
                cacheTimeout: 300000 // 5 minutes
            },
            
            // UI Settings
            ui: {
                showNotifications: true,
                animationsEnabled: true,
                compactMode: false,
                dashboardEnabled: true
            },
            
            // Advanced Settings
            advanced: {
                experimentalFeatures: false,
                customPrompts: {},
                apiSettings: {},
                hookSettings: {},
                generation_preset: 'CardEmporiumPreset'
            }
        };
    }

    /**
     * Initialize the settings manager
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('[NemoLore Settings Manager] Initializing...');
        
        try {
            // Load settings from all sources
            await this.loadSettings();
            
            // Validate and migrate if necessary
            await this.validateAndMigrate();
            
            // Set up auto-save
            this.setupAutoSave();
            
            // Set up event listeners
            this.setupEventListeners();

            // Populate dynamic UI elements
            this.populatePresetDropdown();
            
            this.isInitialized = true;
            console.log('[NemoLore Settings Manager] ✅ Initialized successfully');
            
        } catch (error) {
            console.error('[NemoLore Settings Manager] ❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load settings from all available sources
     */
    async loadSettings() {
        this.settings = JSON.parse(JSON.stringify(this.defaultSettings));

        try {
            // Load from extension_settings - try both NemoPresetExt.nemolore and NemoLore for backward compatibility
            if (extension_settings) {
                // Primary location: NemoPresetExt.nemolore (used by dashboard)
                if (extension_settings.NemoPresetExt && extension_settings.NemoPresetExt.nemolore) {
                    this.mergeSettings(extension_settings.NemoPresetExt.nemolore);
                    console.log('[NemoLore Settings Manager] Loaded settings from extension_settings.NemoPresetExt.nemolore');
                }
                // Fallback: old location for backward compatibility
                else if (extension_settings[this.extensionName]) {
                    this.mergeSettings(extension_settings[this.extensionName]);
                    console.log('[NemoLore Settings Manager] Loaded settings from extension_settings.NemoLore (legacy)');
                }
            }

            // Load from localStorage backup
            const localSettings = this.loadFromLocalStorage();
            if (localSettings) {
                this.mergeSettings(localSettings);
            }

            // Load chat-specific settings
            const chatSettings = this.loadChatSpecificSettings();
            if (chatSettings) {
                this.mergeSettings(chatSettings);
            }

            console.log('[NemoLore Settings Manager] Settings loaded successfully');

        } catch (error) {
            console.error('[NemoLore Settings Manager] Failed to load settings:', error);
            this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
        }
    }

    /**
     * Merge settings objects deeply
     */
    mergeSettings(newSettings) {
        this.deepMerge(this.settings, newSettings);
    }

    /**
     * Deep merge utility function
     */
    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    /**
     * Load settings from localStorage
     */
    loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(`${this.extensionName}_settings`);
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.warn('[NemoLore Settings Manager] Failed to load from localStorage:', error);
            return null;
        }
    }

    /**
     * Load chat-specific settings
     */
    loadChatSpecificSettings() {
        try {
            const chatId = getCurrentChatId();
            if (chat_metadata && chat_metadata[`${this.extensionName}_chat_settings`]) {
                return chat_metadata[`${this.extensionName}_chat_settings`];
            }
            return null;
        } catch (error) {
            console.warn('[NemoLore Settings Manager] Failed to load chat settings:', error);
            return null;
        }
    }

    /**
     * Validate and migrate settings
     */
    async validateAndMigrate() {
        // Check version and migrate if needed
        const currentVersion = this.settings.version || '1.0.0';
        const targetVersion = '2.0.0';
        
        if (currentVersion !== targetVersion) {
            await this.migrateSettings(currentVersion, targetVersion);
        }
        
        // Validate settings structure
        this.validateSettings();
        
        // Set current version
        this.settings.version = targetVersion;
    }

    /**
     * Migrate settings between versions
     */
    async migrateSettings(fromVersion, toVersion) {
        console.log(`[NemoLore Settings Manager] Migrating settings from ${fromVersion} to ${toVersion}`);
        
        // Migration logic based on version
        if (fromVersion === '1.0.0' && toVersion === '2.0.0') {
            await this.migrateFrom1To2();
        }
        
        console.log('[NemoLore Settings Manager] ✅ Settings migration completed');
    }

    /**
     * Migrate from version 1.0.0 to 2.0.0
     */
    async migrateFrom1To2() {
        // This migration logic is no longer needed as the settings structure has been updated.
    }

    /**
     * Validate settings structure and values
     */
    validateSettings() {
        // Ensure all required keys exist
        for (const [key, defaultValue] of Object.entries(this.defaultSettings)) {
            if (this.settings[key] === undefined) {
                this.settings[key] = JSON.parse(JSON.stringify(defaultValue));
            }
        }
        
        // Validate specific values
        this.validateNumberRange('maxContextSize', 1000, 100000);
        this.validateNumberRange('summarization.maxLength', 50, 1000);
        this.validateNumberRange('summarization.minMessages', 1, 50);
        this.validateNumberRange('vectorization.maxVectors', 1000, 100000);
        this.validateNumberRange('vectorization.cacheSize', 100, 10000);
    }

    /**
     * Validate number is within range
     */
    validateNumberRange(path, min, max) {
        const value = this.getNestedValue(path);
        if (typeof value === 'number') {
            const clampedValue = Math.max(min, Math.min(max, value));
            if (clampedValue !== value) {
                this.setNestedValue(path, clampedValue);
                console.warn(`[NemoLore Settings Manager] Clamped ${path} from ${value} to ${clampedValue}`);
            }
        }
    }

    /**
     * Get nested value using dot notation
     */
    getNestedValue(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.settings);
    }

    /**
     * Set nested value using dot notation
     */
    setNestedValue(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.settings);
        target[lastKey] = value;
    }

    /**
     * Set up auto-save functionality
     */
    setupAutoSave() {
        this.saveDebounceTimeout = null;
        this.autoSaveEnabled = true;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for extension settings changes
        if (typeof eventSource !== 'undefined' && eventSource) {
            eventSource.on('extension_settings_changed', (data) => {
                if (data.extensionName === this.extensionName) {
                    this.handleExternalSettingsChange(data);
                }
            });
        }
    }

    /**
     * Handle external settings changes
     */
    handleExternalSettingsChange(data) {
        console.log('[NemoLore Settings Manager] External settings change detected');
        // Reload settings to stay in sync
        this.loadSettings();
    }

    /**
     * Get current settings
     */
    getSettings() {
        return JSON.parse(JSON.stringify(this.settings));
    }

    /**
     * Get specific setting value
     */
    get(path, defaultValue = undefined) {
        const value = this.getNestedValue(path);
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Set specific setting value
     */
    set(path, value) {
        this.setNestedValue(path, value);
        
        if (this.autoSaveEnabled) {
            this.debouncedSave();
        }
    }

    /**
     * Update multiple settings at once
     */
    updateSettings(newSettings) {
        this.mergeSettings(newSettings);
        
        if (this.autoSaveEnabled) {
            this.debouncedSave();
        }
    }

    /**
     * Debounced save to prevent excessive saves
     */
    debouncedSave() {
        if (this.saveDebounceTimeout) {
            clearTimeout(this.saveDebounceTimeout);
        }
        
        this.saveDebounceTimeout = setTimeout(() => {
            this.save();
        }, 500);
    }

    /**
     * Save settings to all storage locations
     */
    async save() {
        try {
            // Save to extension_settings - use NemoPresetExt.nemolore namespace to match dashboard
            if (extension_settings) {
                if (!extension_settings.NemoPresetExt) {
                    extension_settings.NemoPresetExt = {};
                }
                extension_settings.NemoPresetExt.nemolore = JSON.parse(JSON.stringify(this.settings));
                await saveSettingsDebounced();
                console.log('[NemoLore Settings Manager] Saved to extension_settings.NemoPresetExt.nemolore');
            }

            // Save to localStorage backup
            this.saveToLocalStorage();

            // Save chat-specific settings if applicable
            await this.saveChatSpecificSettings();

            this.lastSaveTime = new Date();
            console.log('[NemoLore Settings Manager] ✅ Settings saved successfully');

        } catch (error) {
            console.error('[NemoLore Settings Manager] ❌ Failed to save settings:', error);
        }
    }

    /**
     * Save to localStorage as backup
     */
    saveToLocalStorage() {
        try {
            localStorage.setItem(`${this.extensionName}_settings`, JSON.stringify(this.settings));
        } catch (error) {
            console.warn('[NemoLore Settings Manager] Failed to save to localStorage:', error);
        }
    }

    /**
     * Save chat-specific settings
     */
    async saveChatSpecificSettings() {
        try {
            if (chat_metadata) {
                // Only save chat-specific settings, not global ones
                const chatSpecificSettings = {
                    // Add any chat-specific settings here
                };
                
                if (Object.keys(chatSpecificSettings).length > 0) {
                    chat_metadata[`${this.extensionName}_chat_settings`] = chatSpecificSettings;
                    await saveMetadata();
                }
            }
        } catch (error) {
            console.warn('[NemoLore Settings Manager] Failed to save chat settings:', error);
        }
    }

    /**
     * Export settings to JSON
     */
    exportSettings() {
        const exportData = {
            version: this.settings.version,
            timestamp: Date.now(),
            settings: this.settings
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import settings from JSON
     */
    async importSettings(jsonData) {
        try {
            const importData = JSON.parse(jsonData);
            
            if (importData.settings) {
                // Validate imported settings
                const tempSettings = JSON.parse(JSON.stringify(this.defaultSettings));
                this.deepMerge(tempSettings, importData.settings);
                
                // Apply imported settings
                this.settings = tempSettings;
                this.validateSettings();
                
                // Save the imported settings
                await this.save();
                
                console.log('[NemoLore Settings Manager] ✅ Settings imported successfully');
                return true;
            } else {
                throw new Error('Invalid settings format');
            }
            
        } catch (error) {
            console.error('[NemoLore Settings Manager] ❌ Failed to import settings:', error);
            return false;
        }
    }

    /**
     * Reset settings to defaults
     */
    async resetToDefaults() {
        this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
        await this.save();
        console.log('[NemoLore Settings Manager] ✅ Settings reset to defaults');
    }

    /**
     * Get settings schema for UI generation
     */
    getSettingsSchema() {
        return {
            core: {
                title: 'Core Settings',
                settings: {
                    enabled: { type: 'boolean', label: 'Enable NemoLore', default: true },
                    autoSummarization: { type: 'boolean', label: 'Auto Summarization', default: true },
                    contextInterception: { type: 'boolean', label: 'Context Interception', default: true },
                    debugMode: { type: 'boolean', label: 'Debug Mode', default: false }
                }
            },
            summarization: {
                title: 'Summarization',
                settings: {
                    enabled: { type: 'boolean', label: 'Enable Summaries', default: true },
                    minMessages: { type: 'number', label: 'Min Messages', min: 1, max: 50, default: 5 },
                    maxLength: { type: 'number', label: 'Max Length', min: 50, max: 1000, default: 200 },
                    preserveImportant: { type: 'boolean', label: 'Preserve Important', default: true }
                }
            },
            vectorization: {
                title: 'Vectorization',
                settings: {
                    enabled: { type: 'boolean', label: 'Enable Vectorization', default: true },
                    maxVectors: { type: 'number', label: 'Max Vectors', min: 1000, max: 100000, default: 10000 },
                    cacheSize: { type: 'number', label: 'Cache Size', min: 100, max: 10000, default: 1000 }
                }
            }
        };
    }

    /**
     * Get current system status
     */
    getSystemStatus() {
        return {
            initialized: this.isInitialized,
            version: this.settings.version || '2.0.0',
            settingsValid: this.validateSettings(),
            lastSaved: this.lastSaveTime || null,
            autoSaveEnabled: this.autoSaveEnabled
        };
    }

    /**
     * Shutdown the settings manager
     */
    async shutdown() {
        console.log('[NemoLore Settings Manager] Shutting down...');
        
        // Save any pending changes
        if (this.saveDebounceTimeout) {
            clearTimeout(this.saveDebounceTimeout);
            await this.save();
        }
        
        this.isInitialized = false;
        console.log('[NemoLore Settings Manager] ✅ Shutdown completed');
    }

    /**
     * Populate the preset dropdown with available presets
     */
    populatePresetDropdown() {
        const $dropdown = $('#nemolore_generationPreset');
        if (!$dropdown.length) return;

        const presets = $('#settings_preset_openai option').map((i, el) => $(el).text().trim()).get();
        presets.forEach(preset => {
            $dropdown.append(`<option value="${preset}">${preset}</option>`);
        });

        $dropdown.val(this.settings.generation_preset);
    }
}

// Export singleton instance
export const settingsManager = new SettingsManager();

console.log('[NemoLore Settings Manager] Module loaded - Centralized settings management ready');