/**
 * Preset Manager for NemoLore
 * Handles switching to a dedicated preset for AI generation calls by directly
 * modifying the in-memory connection profile, avoiding disruptive UI triggers.
 */
import { getPresetManager } from '../../../../../../preset-manager.js';
import { getContext } from '../../../../../../extensions.js';

const LOG_PREFIX = '[NemoLore Preset Manager]';
const PRESET_NAME = 'NemoLorePreset';
const PRESET_API_ID = 'openai'; // The API group the preset belongs to

export class PresetManager {
    constructor(settings) {
        this.settings = settings;
        this.presetInstalled = false;
        this.isInitialized = false;
    }

    /**
     * Initialize the preset manager and install the dedicated preset.
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log(`${LOG_PREFIX} Initializing...`);
        await this.installPreset();
        this.isInitialized = true;
        console.log(`${LOG_PREFIX} ✅ Initialized successfully`);
    }

    /**
     * Install the NemoLore preset from the bundled JSON file if it doesn't exist.
     */
    async installPreset() {
        const presetFileName = 'NemoLorePreset.json';
        // Path from public/ root
        const presetPath = `scripts/extensions/third-party/NemoPresetExt/features/nemolore/${presetFileName}`;

        try {
            const response = await fetch(presetPath);
            if (!response.ok) {
                console.error(`${LOG_PREFIX} Failed to fetch ${presetFileName}. Status: ${response.status}`);
                return;
            }
            const presetData = await response.json();

            const presetManager = getPresetManager(PRESET_API_ID);
            if (!presetManager) {
                console.error(`${LOG_PREFIX} Could not get Preset Manager for '${PRESET_API_ID}'`);
                return;
            }

            const existingPreset = presetManager.findPreset(PRESET_NAME);
            if (existingPreset) {
                console.log(`${LOG_PREFIX} Preset "${PRESET_NAME}" already installed.`);
                this.presetInstalled = true;
            } else {
                await presetManager.savePreset(PRESET_NAME, presetData);
                console.log(`${LOG_PREFIX} Preset "${PRESET_NAME}" successfully installed.`);
                this.presetInstalled = true;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error installing preset:`, error);
        }
    }

    /**
     * Execute a function wrapped with preset switching logic.
     * @param {Function} fn - Async function to execute
     * @returns {Promise<any>} Result of the function
     */
    async executeWithPresetSwitch(fn) {
        if (!this.presetInstalled) {
            console.error(`${LOG_PREFIX} Cannot execute: Preset "${PRESET_NAME}" is not installed. Running with default preset.`);
            return await fn();
        }

        const context = getContext();
        const profiles = context.extensionSettings?.connectionManager?.profiles || [];
        const activeProfile = profiles.find(p => p.active);

        if (!activeProfile) {
            console.error(`${LOG_PREFIX} Could not find an active connection profile. Running with default preset.`);
            return await fn();
        }

        const originalPreset = activeProfile.preset;

        if (originalPreset === PRESET_NAME) {
            // No switch needed, just run the function
            return await fn();
        }

        console.log(`${LOG_PREFIX} Temporarily switching from "${originalPreset || '(default)'}" to "${PRESET_NAME}"`);
        activeProfile.preset = PRESET_NAME;

        try {
            // Execute the generation function
            return await fn();
        } finally {
            // Restore the original preset no matter what
            console.log(`${LOG_PREFIX} Restoring original preset "${originalPreset || '(default)'}"`);
            activeProfile.preset = originalPreset;
        }
    }
}