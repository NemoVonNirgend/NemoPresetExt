/**
 * NemoPresetExt - Model Favorites & Recent Models Persistence
 *
 * Stores favorites and recently-used models per provider in extension_settings.
 */

import { saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';

const NEMO_EXTENSION_NAME = 'NemoPresetExt';
const MAX_RECENT = 5;

function getSettings() {
    const settings = extension_settings[NEMO_EXTENSION_NAME];
    if (!settings) return null;
    if (!settings.modelFavorites) settings.modelFavorites = {};
    if (!settings.recentModels) settings.recentModels = {};
    return settings;
}

/**
 * Get favorite model IDs for a provider source.
 * @param {string} source - Provider key (e.g. 'openai', 'claude')
 * @returns {string[]}
 */
export function getFavorites(source) {
    const settings = getSettings();
    if (!settings) return [];
    return settings.modelFavorites[source] || [];
}

/**
 * Toggle a model as favorite for a provider.
 * @param {string} source - Provider key
 * @param {string} modelId - Model identifier
 * @returns {boolean} New favorite state
 */
export function toggleFavorite(source, modelId) {
    const settings = getSettings();
    if (!settings) return false;

    if (!settings.modelFavorites[source]) {
        settings.modelFavorites[source] = [];
    }

    const idx = settings.modelFavorites[source].indexOf(modelId);
    if (idx === -1) {
        settings.modelFavorites[source].push(modelId);
        saveSettingsDebounced();
        return true;
    } else {
        settings.modelFavorites[source].splice(idx, 1);
        saveSettingsDebounced();
        return false;
    }
}

/**
 * Check if a model is favorited.
 * @param {string} source - Provider key
 * @param {string} modelId - Model identifier
 * @returns {boolean}
 */
export function isFavorite(source, modelId) {
    return getFavorites(source).includes(modelId);
}

/**
 * Get recently used models for a provider.
 * @param {string} source - Provider key
 * @returns {string[]}
 */
export function getRecent(source) {
    const settings = getSettings();
    if (!settings) return [];
    return settings.recentModels[source] || [];
}

/**
 * Push a model to the recent list (FIFO, max 5).
 * @param {string} source - Provider key
 * @param {string} modelId - Model identifier
 */
export function pushRecent(source, modelId) {
    const settings = getSettings();
    if (!settings || !modelId) return;

    if (!settings.recentModels[source]) {
        settings.recentModels[source] = [];
    }

    const list = settings.recentModels[source];
    // Remove if already present (move to front)
    const idx = list.indexOf(modelId);
    if (idx !== -1) list.splice(idx, 1);

    // Add to front
    list.unshift(modelId);

    // Trim to max
    if (list.length > MAX_RECENT) {
        list.length = MAX_RECENT;
    }

    saveSettingsDebounced();
}
