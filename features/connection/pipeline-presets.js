import { saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';

const NEMO_EXTENSION_NAME = 'NemoPresetExt';

/**
 * Default presets that ship with the extension.
 * Users can create custom presets and modify these.
 */
const DEFAULT_PRESETS = {
    'nemo-stack': {
        id: 'nemo-stack',
        name: 'Nemo Stack (Premium)',
        description: 'Full 6-drafter pipeline with Claude Opus consolidation',
        recall: {
            connectionId: null, // User must configure
            temperature: 0.3,
            max_tokens: 4096,
        },
        analysis: {
            connectionId: null, // Same model as recall typically
            temperature: 0.5,
            max_tokens: 4096,
        },
        drafters: [
            { connectionId: null, label: 'A', temperature: 0.8, max_tokens: 4096 },
            { connectionId: null, label: 'B', temperature: 0.8, max_tokens: 4096 },
            { connectionId: null, label: 'C', temperature: 0.8, max_tokens: 4096 },
            { connectionId: null, label: 'D', temperature: 0.8, max_tokens: 4096 },
            { connectionId: null, label: 'E', temperature: 0.8, max_tokens: 4096 },
            { connectionId: null, label: 'F', temperature: 0.8, max_tokens: 4096 },
        ],
        consolidator: {
            connectionId: null,
            temperature: 1.0,
            max_tokens: 16384,
        },
    },
    'nemo-stack-flash': {
        id: 'nemo-stack-flash',
        name: 'Nemo Stack Flash',
        description: 'Fast 3-drafter pipeline for lower latency',
        recall: {
            connectionId: null,
            temperature: 0.3,
            max_tokens: 4096,
        },
        analysis: {
            connectionId: null,
            temperature: 0.5,
            max_tokens: 4096,
        },
        drafters: [
            { connectionId: null, label: 'A', temperature: 0.8, max_tokens: 4096 },
            { connectionId: null, label: 'B', temperature: 0.8, max_tokens: 4096 },
            { connectionId: null, label: 'C', temperature: 0.8, max_tokens: 4096 },
        ],
        consolidator: {
            connectionId: null,
            temperature: 1.0,
            max_tokens: 16384,
        },
    },
};

export const PipelinePresets = {
    /**
     * Get all presets (defaults + user-created).
     * @returns {Record<string, object>}
     */
    getAll() {
        const userPresets = extension_settings[NEMO_EXTENSION_NAME]?.pipelinePresets || {};
        return { ...DEFAULT_PRESETS, ...userPresets };
    },

    /**
     * Get a specific preset by ID.
     * @param {string} presetId
     * @returns {object|null}
     */
    get(presetId) {
        return this.getAll()[presetId] || null;
    },

    /**
     * Save/update a preset.
     * @param {object} preset - Must have an `id` field
     */
    save(preset) {
        if (!preset?.id) throw new Error('Preset must have an id');
        if (!extension_settings[NEMO_EXTENSION_NAME].pipelinePresets) {
            extension_settings[NEMO_EXTENSION_NAME].pipelinePresets = {};
        }
        extension_settings[NEMO_EXTENSION_NAME].pipelinePresets[preset.id] = preset;
        saveSettingsDebounced();
    },

    /**
     * Delete a user-created preset (cannot delete defaults).
     * @param {string} presetId
     */
    delete(presetId) {
        if (DEFAULT_PRESETS[presetId]) throw new Error('Cannot delete default presets');
        const userPresets = extension_settings[NEMO_EXTENSION_NAME]?.pipelinePresets;
        if (userPresets && userPresets[presetId]) {
            delete userPresets[presetId];
            saveSettingsDebounced();
        }
    },

    /**
     * Get the currently active preset ID.
     * @returns {string|null}
     */
    getActiveId() {
        return extension_settings[NEMO_EXTENSION_NAME]?.activePipelinePreset || null;
    },

    /**
     * Set the active preset.
     * @param {string|null} presetId
     */
    setActive(presetId) {
        extension_settings[NEMO_EXTENSION_NAME].activePipelinePreset = presetId;
        saveSettingsDebounced();
    },

    /**
     * Create a deep clone of a preset for editing.
     * @param {string} presetId
     * @param {string} newId
     * @param {string} newName
     * @returns {object}
     */
    clone(presetId, newId, newName) {
        const source = this.get(presetId);
        if (!source) throw new Error(`Preset not found: ${presetId}`);
        const cloned = JSON.parse(JSON.stringify(source));
        cloned.id = newId;
        cloned.name = newName;
        return cloned;
    },
};
