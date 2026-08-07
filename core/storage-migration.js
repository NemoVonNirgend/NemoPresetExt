/**
 * Storage Migration System
 * Migrates data from localStorage to extension_settings for server-side persistence
 */

import { extension_settings } from '../../../../extensions.js';
import { applySettingsSchema } from './feature-settings.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { LOG_PREFIX, NEMO_EXTENSION_NAME } from './utils.js';
import logger from './logger.js';

// Old localStorage keys
const OLD_KEYS = {
    SNAPSHOT: 'nemoPromptSnapshotData',
    PROMPT_LIBRARY: 'nemo-prompt-library',
    METADATA: 'nemoNavigatorMetadata',
    SECTIONS_ENABLED: 'nemoSectionsEnabled',
    FAVORITE_PRESETS: 'nemo-favorite-presets',
    FAVORITE_CHARACTERS: 'nemo-favorite-characters',
    PROMPT_STATE: 'nemoPromptToggleState'
};

function getSettingsNamespace() {
    if (!extension_settings[NEMO_EXTENSION_NAME]) {
        extension_settings[NEMO_EXTENSION_NAME] = {};
    }

    return applySettingsSchema(extension_settings[NEMO_EXTENSION_NAME]);
}

function makePromptLibraryId(prefix = 'archive') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeDate(value, fallback) {
    if (!value) {
        return fallback;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function normalizeTags(tags) {
    if (Array.isArray(tags)) {
        return tags.map(tag => String(tag).trim()).filter(Boolean);
    }

    if (typeof tags === 'string') {
        return tags.split(',').map(tag => tag.trim()).filter(Boolean);
    }

    return [];
}

function normalizePromptLibraryPrompt(prompt = {}, fallbackTitle = 'Untitled Prompt') {
    const now = new Date().toISOString();
    const title = String(prompt.title || prompt.name || fallbackTitle || 'Untitled Prompt').trim() || 'Untitled Prompt';
    const dateCreated = normalizeDate(prompt.dateCreated || prompt.addedAt || prompt.createdAt, now);

    return {
        id: String(prompt.id || makePromptLibraryId()),
        title,
        content: typeof prompt.content === 'string' ? prompt.content : '',
        role: typeof prompt.role === 'string' ? prompt.role : '',
        identifier: typeof prompt.identifier === 'string' ? prompt.identifier : '',
        dateCreated,
        dateModified: normalizeDate(prompt.dateModified || prompt.lastModified, dateCreated),
        tags: normalizeTags(prompt.tags),
        folder: String(prompt.folder || 'Default').trim() || 'Default',
        isFavorite: Boolean(prompt.isFavorite),
    };
}

function isLegacyPromptArchiveData(data) {
    return Boolean(
        data &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        data.prompts &&
        typeof data.prompts === 'object' &&
        !Array.isArray(data.prompts)
    );
}

function normalizePromptLibrary(data) {
    if (Array.isArray(data)) {
        return data
            .filter(prompt => prompt && typeof prompt === 'object')
            .map((prompt, index) => normalizePromptLibraryPrompt(prompt, `Prompt ${index + 1}`));
    }

    if (isLegacyPromptArchiveData(data)) {
        return Object.entries(data.prompts)
            .filter(([, prompt]) => prompt && typeof prompt === 'object')
            .map(([name, prompt]) => normalizePromptLibraryPrompt({
                ...prompt,
                title: prompt.title || prompt.name || name,
            }, name));
    }

    return [];
}

function mergePromptLibraries(...libraries) {
    const merged = [];
    const seen = new Set();

    libraries.flat().forEach(prompt => {
        const normalized = normalizePromptLibraryPrompt(prompt);
        const fingerprint = [
            normalized.title,
            normalized.content,
            normalized.identifier,
            normalized.folder,
        ].join('\u0000');

        if (!seen.has(fingerprint)) {
            seen.add(fingerprint);
            merged.push(normalized);
        }
    });

    return merged;
}

function parseLocalStorageJson(key) {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        logger.error(`Failed to parse localStorage key "${key}"`, error);
        return null;
    }
}

function migratePromptLibraryFromLocalStorage() {
    const settings = getSettingsNamespace();
    let library = normalizePromptLibrary(settings.promptLibrary || []);
    let changed = false;

    const promptLibraryData = parseLocalStorageJson(OLD_KEYS.PROMPT_LIBRARY);
    if (promptLibraryData) {
        library = mergePromptLibraries(library, normalizePromptLibrary(promptLibraryData));
        localStorage.removeItem(OLD_KEYS.PROMPT_LIBRARY);
        changed = true;
        logger.debug('Migrated prompt library');
    }

    const legacySnapshotData = parseLocalStorageJson(OLD_KEYS.SNAPSHOT);
    if (isLegacyPromptArchiveData(legacySnapshotData)) {
        library = mergePromptLibraries(library, normalizePromptLibrary(legacySnapshotData));
        localStorage.removeItem(OLD_KEYS.SNAPSHOT);
        changed = true;
        logger.debug('Migrated legacy prompt archive data');
    }

    if (isLegacyPromptArchiveData(settings.promptSnapshots)) {
        library = mergePromptLibraries(library, normalizePromptLibrary(settings.promptSnapshots));
        const remainingSnapshots = { ...settings.promptSnapshots };
        delete remainingSnapshots.prompts;
        delete remainingSnapshots.lastModified;
        settings.promptSnapshots = remainingSnapshots;
        changed = true;
        logger.debug('Recovered prompt archive data from migrated snapshot storage');
    }

    if (changed || settings.promptLibrary !== library) {
        settings.promptLibrary = library;
        if (changed) {
            saveSettingsDebounced();
        }
    }

    return settings.promptLibrary;
}

/**
 * Initialize extension_settings structure
 */
export function initializeStorage() {
    const settings = getSettingsNamespace();

    // Initialize sub-structures with defaults
    settings.promptSnapshots = settings.promptSnapshots || {};
    settings.promptLibrary = normalizePromptLibrary(settings.promptLibrary || []);
    settings.navigatorMetadata = settings.navigatorMetadata || { folders: {}, presets: {} };
    settings.sectionsEnabled = settings.sectionsEnabled !== undefined ? settings.sectionsEnabled : true;
    settings.favoritePresets = settings.favoritePresets || [];
    settings.favoriteCharacters = settings.favoriteCharacters || [];
    settings.promptStates = settings.promptStates || {};
    settings.openSectionStates = settings.openSectionStates || {};

    logger.info('Storage structure initialized');
}

/**
 * Migrate data from localStorage to extension_settings (one-time migration)
 */
export function migrateFromLocalStorage() {
    const settings = getSettingsNamespace();

    // Prompt archive used a separate key and, briefly, the snapshot key. Migrate it
    // even for users who already completed the older one-time migration.
    migratePromptLibraryFromLocalStorage();

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
                const parsedSnapshotData = JSON.parse(snapshotData);
                if (isLegacyPromptArchiveData(parsedSnapshotData)) {
                    settings.promptLibrary = mergePromptLibraries(
                        normalizePromptLibrary(settings.promptLibrary || []),
                        normalizePromptLibrary(parsedSnapshotData)
                    );
                    logger.debug('Migrated legacy prompt archive data');
                } else {
                    settings.promptSnapshots = parsedSnapshotData;
                    logger.debug('Migrated prompt snapshots');
                }
                localStorage.removeItem(OLD_KEYS.SNAPSHOT);
                migratedCount++;
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
    // Prompt archive library
    getPromptLibrary() {
        return migratePromptLibraryFromLocalStorage();
    },

    savePromptLibrary(library) {
        getSettingsNamespace().promptLibrary = normalizePromptLibrary(library);
        saveSettingsDebounced();
    },

    addPromptToLibrary(promptData) {
        const library = this.getPromptLibrary();
        const prompt = normalizePromptLibraryPrompt(promptData);
        library.push(prompt);
        this.savePromptLibrary(library);
        return prompt;
    },

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
    },

    // Dropdown style mode: 'tray' (floating overlay) or 'accordion' (inline expand)
    getDropdownStyle() {
        return extension_settings[NEMO_EXTENSION_NAME]?.dropdownStyle || 'tray';
    },

    setDropdownStyle(style) {
        extension_settings[NEMO_EXTENSION_NAME].dropdownStyle = style;
        saveSettingsDebounced();
    }
};

export default storage;
