/**
 * Preset Manager for ProsePolisher
 * Handles switching to Card Emporium preset for AI generation calls
 * Modeled after MoodMusic, NemoLore, and Ember preset management systems
 */

const PROSEPOLISHER_PRESET_NAME = 'Card Emporium Default Preset';
const LOG_PREFIX = '[ProsePolisher Preset Manager]';

export class PresetManager {
    constructor() {
        this.$presetDropdown = null;
        this.originalPresetName = null;
        this.presetRestorationRequired = false;
        this.isInitialized = false;
    }

    /**
     * Initialize the preset manager
     */
    initialize() {
        if (this.isInitialized) return;

        console.log(`${LOG_PREFIX} Initializing...`);
        this.findAndStorePresetDropdown();
        this.isInitialized = true;
        console.log(`${LOG_PREFIX} ✅ Initialized successfully`);
    }

    /**
     * Find and store the preset dropdown element
     */
    findAndStorePresetDropdown() {
        const dropdownId = '#settings_preset_openai';
        const $foundDropdown = $(dropdownId);

        if ($foundDropdown.length) {
            this.$presetDropdown = $foundDropdown;
            console.log(`${LOG_PREFIX} Preset dropdown found`);
        } else {
            console.error(`${LOG_PREFIX} Could NOT find preset dropdown: ${dropdownId}`);
        }
    }

    /**
     * Get current preset name from UI
     * @returns {string|null} Current preset name
     */
    getCurrentPresetNameFromUi() {
        if (!this.$presetDropdown || !this.$presetDropdown.length) {
            this.findAndStorePresetDropdown();
        }

        if (!this.$presetDropdown || !this.$presetDropdown.length) {
            console.error(`${LOG_PREFIX} Dropdown invalid. Cannot get preset.`);
            return null;
        }

        return this.$presetDropdown.find('option:selected').text().trim();
    }

    /**
     * Switch to a specific preset
     * @param {string} presetName - Name of the preset to switch to
     * @returns {Promise<boolean>} Success status
     */
    async setPresetViaUi(presetName) {
        if (!this.$presetDropdown || !this.$presetDropdown.length) {
            console.error(`${LOG_PREFIX} Cannot find preset dropdown. Aborting switch.`);
            return false;
        }

        const $targetOption = this.$presetDropdown.find('option').filter(function() {
            return $(this).text().trim() === presetName;
        });

        if ($targetOption.length) {
            const targetValue = $targetOption.val();

            if (this.$presetDropdown.val() === targetValue) {
                console.log(`${LOG_PREFIX} Preset "${presetName}" already selected.`);
                return true;
            }

            this.$presetDropdown.val(targetValue).trigger('change');
            await new Promise(resolve => setTimeout(resolve, 200));

            if (this.$presetDropdown.val() === targetValue) {
                console.log(`${LOG_PREFIX} Switched to preset "${presetName}".`);
                return true;
            } else {
                console.error(`${LOG_PREFIX} Verification failed after setting "${presetName}".`);
                return false;
            }
        } else {
            console.error(`${LOG_PREFIX} Could not find preset: "${presetName}". Available presets:`,
                this.$presetDropdown.find('option').map((i, el) => $(el).text().trim()).get());
            return false;
        }
    }

    /**
     * Switch to ProsePolisher preset before generation
     * @returns {Promise<boolean>} Success status
     */
    async switchToProsePolisherPreset() {
        // Store original preset
        this.originalPresetName = this.getCurrentPresetNameFromUi();

        if (!this.originalPresetName) {
            console.error(`${LOG_PREFIX} Could not determine original preset.`);
            return false;
        }

        console.log(`${LOG_PREFIX} Stored original preset: ${this.originalPresetName}`);

        // Switch to Card Emporium preset
        const switched = await this.setPresetViaUi(PROSEPOLISHER_PRESET_NAME);

        if (switched) {
            this.presetRestorationRequired = true;
            return true;
        }

        console.error(`${LOG_PREFIX} Failed to switch to "${PROSEPOLISHER_PRESET_NAME}".`);
        return false;
    }

    /**
     * Restore original preset after generation
     * @returns {Promise<boolean>} Success status
     */
    async restoreOriginalPreset() {
        if (this.presetRestorationRequired && this.originalPresetName) {
            console.log(`${LOG_PREFIX} Restoring preset: ${this.originalPresetName}`);

            const restored = await this.setPresetViaUi(this.originalPresetName);

            if (!restored) {
                console.error(`${LOG_PREFIX} FAILED TO RESTORE "${this.originalPresetName}".`);
                return false;
            }

            this.presetRestorationRequired = false;
            this.originalPresetName = null;
            return true;

        } else if (this.presetRestorationRequired && !this.originalPresetName) {
            console.error(`${LOG_PREFIX} Restoration required but original preset unknown.`);
            return false;
        }

        return true;
    }

    /**
     * Execute a function with preset switching
     * @param {Function} fn - Async function to execute
     * @returns {Promise<any>} Result of the function
     */
    async executeWithPresetSwitch(fn) {
        const switched = await this.switchToProsePolisherPreset();

        try {
            return await fn();
        } finally {
            if (switched) {
                await this.restoreOriginalPreset();
            }
        }
    }
}

console.log('[ProsePolisher Preset Manager] Module loaded');
