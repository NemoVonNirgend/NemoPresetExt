/**
 * Storage Migration System
 * Migrates data from localStorage to extension_settings for server-side persistence
 */

import { extension_settings } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { LOG_PREFIX, NEMO_EXTENSION_NAME } from './utils.js';
import logger from './logger.js';

// Old localStorage keys
const OLD_KEYS = {
    SNAPSHOT: 'nemoPromptSnapshotData',
    METADATA: 'nemoNavigatorMetadata',
    SECTIONS_ENABLED: 'nemoSectionsEnabled',
    FAVORITE_PRESETS: 'nemo-favorite-presets',
    FAVORITE_CHARACTERS: 'nemo-favorite-characters',
    PROMPT_STATE: 'nemoPromptToggleState'
};

/**
 * Initialize extension_settings structure
 */
export function initializeStorage() {
    if (!extension_settings[NEMO_EXTENSION_NAME]) {
        extension_settings[NEMO_EXTENSION_NAME] = {};
    }

    const settings = extension_settings[NEMO_EXTENSION_NAME];

    // Initialize sub-structures with defaults
    settings.promptSnapshots = settings.promptSnapshots || {};
    settings.navigatorMetadata = settings.navigatorMetadata || { folders: {}, presets: {} };
    settings.sectionsEnabled = settings.sectionsEnabled !== undefined ? settings.sectionsEnabled : true;
    settings.favoritePresets = settings.favoritePresets || [];
    settings.favoriteCharacters = settings.favoriteCharacters || [];
    settings.promptStates = settings.promptStates || {};
    settings.openSectionStates = settings.openSectionStates || {};

    // Feature toggles
    settings.enableTabOverhauls = settings.enableTabOverhauls !== false;
    settings.enableLorebookOverhaul = settings.enableLorebookOverhaul !== false;
    settings.enableAnimatedBackgrounds = settings.enableAnimatedBackgrounds !== false;
    settings.nemoEnableExtensionsTabOverhaul = settings.nemoEnableExtensionsTabOverhaul !== false;
    settings.enableReasoningSection = settings.enableReasoningSection !== false;
    settings.enableLorebookManagement = settings.enableLorebookManagement !== false;

    logger.info('Storage structure initialized');
}

/**
 * Migrate data from localStorage to extension_settings (one-time migration)
 */
export function migrateFromLocalStorage() {
    const settings = extension_settings[NEMO_EXTENSION_NAME];

    // Skip if already migrated
    if (settings._migrated) {
        logger.debug('Storage already migrated');
        return;
    }

    logger.info('Starting localStorage migration...');
    let migratedCount = 0;

    try {
        // Migrate snapshots
        const snapshotData = localStorage.getItem(OLD_KEYS.SNAPSHOT);
        if (snapshotData) {
            try {
                settings.promptSnapshots = JSON.parse(snapshotData);
                localStorage.removeItem(OLD_KEYS.SNAPSHOT);
                migratedCount++;
                logger.debug('Migrated prompt snapshots');
            } catch (e) {
                logger.error('Failed to migrate snapshot data', e);
            }
        }

        // Migrate metadata
        const metadataData = localStorage.getItem(OLD_KEYS.METADATA);
        if (metadataData) {
            try {
                settings.navigatorMetadata = JSON.parse(metadataData);
                localStorage.removeItem(OLD_KEYS.METADATA);
                migratedCount++;
                logger.debug('Migrated navigator metadata');
            } catch (e) {
                logger.error('Failed to migrate metadata', e);
            }
        }

        // Migrate sections enabled
        const sectionsEnabled = localStorage.getItem(OLD_KEYS.SECTIONS_ENABLED);
        if (sectionsEnabled !== null) {
            settings.sectionsEnabled = sectionsEnabled !== 'false';
            localStorage.removeItem(OLD_KEYS.SECTIONS_ENABLED);
            migratedCount++;
            logger.debug('Migrated sections enabled setting');
        }

        // Migrate favorite presets
        const favoritePresets = localStorage.getItem(OLD_KEYS.FAVORITE_PRESETS);
        if (favoritePresets) {
            try {
                settings.favoritePresets = JSON.parse(favoritePresets);
                localStorage.removeItem(OLD_KEYS.FAVORITE_PRESETS);
                migratedCount++;
                logger.debug('Migrated favorite presets');
            } catch (e) {
                logger.error('Failed to migrate favorite presets', e);
            }
        }

        // Migrate favorite characters
        const favoriteCharacters = localStorage.getItem(OLD_KEYS.FAVORITE_CHARACTERS);
        if (favoriteCharacters) {
            try {
                settings.favoriteCharacters = JSON.parse(favoriteCharacters);
                localStorage.removeItem(OLD_KEYS.FAVORITE_CHARACTERS);
                migratedCount++;
                logger.debug('Migrated favorite characters');
            } catch (e) {
                logger.error('Failed to migrate favorite characters', e);
            }
        }

        // Migrate prompt states
        const promptStates = localStorage.getItem(OLD_KEYS.PROMPT_STATE);
        if (promptStates) {
            try {
                const statesArray = JSON.parse(promptStates);
                settings.promptStates.current = statesArray;
                localStorage.removeItem(OLD_KEYS.PROMPT_STATE);
                migratedCount++;
                logger.debug('Migrated prompt states');
            } catch (e) {
                logger.error('Failed to migrate prompt states', e);
            }
        }

        // Mark as migrated
        settings._migrated = true;
        settings._migrationDate = new Date().toISOString();
        settings._migratedItemsCount = migratedCount;

        saveSettingsDebounced();
        logger.info(`Successfully migrated ${migratedCount} items from localStorage to extension_settings`);

    } catch (error) {
        logger.error('Critical error during migration', error);
    }
}

/**
 * Storage accessor functions (replace LocalStorageAsync usage)
 */
export const storage = {
    // Snapshots
    getSnapshot(api = 'openai') {
        return extension_settings[NEMO_EXTENSION_NAME]?.promptSnapshots?.[api] || null;
    },

    saveSnapshot(api = 'openai', data) {
        if (!extension_settings[NEMO_EXTENSION_NAME].promptSnapshots) {
            extension_settings[NEMO_EXTENSION_NAME].promptSnapshots = {};
        }
        extension_settings[NEMO_EXTENSION_NAME].promptSnapshots[api] = data;
        saveSettingsDebounced();
    },

    // Navigator metadata
    getMetadata() {
        return extension_settings[NEMO_EXTENSION_NAME]?.navigatorMetadata || { folders: {}, presets: {} };
    },

    saveMetadata(metadata) {
        extension_settings[NEMO_EXTENSION_NAME].navigatorMetadata = metadata;
        saveSettingsDebounced();
    },

    // Sections enabled
    getSectionsEnabled() {
        return extension_settings[NEMO_EXTENSION_NAME]?.sectionsEnabled !== false;
    },

    setSectionsEnabled(enabled) {
        extension_settings[NEMO_EXTENSION_NAME].sectionsEnabled = enabled;
        saveSettingsDebounced();
    },

    // Favorite presets
    getFavoritePresets() {
        return extension_settings[NEMO_EXTENSION_NAME]?.favoritePresets || [];
    },

    saveFavoritePresets(favorites) {
        extension_settings[NEMO_EXTENSION_NAME].favoritePresets = favorites;
        saveSettingsDebounced();
    },

    toggleFavoritePreset(presetName) {
        const favorites = this.getFavoritePresets();
        const index = favorites.indexOf(presetName);

        if (index === -1) {
            favorites.push(presetName);
        } else {
            favorites.splice(index, 1);
        }

        this.saveFavoritePresets(favorites);
        return index === -1; // Return true if added, false if removed
    },

    // Favorite characters
    getFavoriteCharacters() {
        return extension_settings[NEMO_EXTENSION_NAME]?.favoriteCharacters || [];
    },

    saveFavoriteCharacters(favorites) {
        extension_settings[NEMO_EXTENSION_NAME].favoriteCharacters = favorites;
        saveSettingsDebounced();
    },

    toggleFavoriteCharacter(characterName) {
        const favorites = this.getFavoriteCharacters();
        const index = favorites.indexOf(characterName);

        if (index === -1) {
            favorites.push(characterName);
        } else {
            favorites.splice(index, 1);
        }

        this.saveFavoriteCharacters(favorites);
        return index === -1;
    },

    // Prompt states
    getPromptStates() {
        return extension_settings[NEMO_EXTENSION_NAME]?.promptStates?.current || [];
    },

    savePromptStates(states) {
        if (!extension_settings[NEMO_EXTENSION_NAME].promptStates) {
            extension_settings[NEMO_EXTENSION_NAME].promptStates = {};
        }
        extension_settings[NEMO_EXTENSION_NAME].promptStates.current = states;
        saveSettingsDebounced();
    },

    // Open section states
    getOpenSectionStates() {
        return extension_settings[NEMO_EXTENSION_NAME]?.openSectionStates || {};
    },

    saveOpenSectionStates(states) {
        extension_settings[NEMO_EXTENSION_NAME].openSectionStates = states;
        saveSettingsDebounced();
    }
};

export default storage;