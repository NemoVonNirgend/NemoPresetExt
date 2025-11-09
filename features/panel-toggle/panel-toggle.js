/**
 * Panel Toggle Feature
 * Toggles the left and right nav panels to 50% width based on settings
 */

import { LOG_PREFIX } from '../../core/utils.js';
import { extension_settings } from '../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../script.js';

class PanelToggle {
    constructor() {
        this.isEnabled = false;
        this.settingsCheckbox = null;
    }

    /**
     * Apply or remove the 50% width CSS to panels
     */
    applyPanelStyles() {
        const leftPanel = document.getElementById('left-nav-panel');
        const rightPanel = document.getElementById('right-nav-panel');

        if (this.isEnabled) {
            // Apply 50% width styles
            if (leftPanel) {
                leftPanel.style.width = '50vw';
                leftPanel.style.left = '0';
            }
            if (rightPanel) {
                rightPanel.style.width = '50vw';
                rightPanel.style.right = '0';
                rightPanel.style.left = 'auto';
            }
            console.log(`${LOG_PREFIX} Panel width: Enabled (50% width)`);
        } else {
            // Remove 50% width styles (revert to default)
            if (leftPanel) {
                leftPanel.style.width = '';
                leftPanel.style.left = '';
            }
            if (rightPanel) {
                rightPanel.style.width = '';
                rightPanel.style.right = '';
                rightPanel.style.left = '';
            }
            console.log(`${LOG_PREFIX} Panel width: Disabled (default width)`);
        }
    }

    /**
     * Set the enabled state and apply styles
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.applyPanelStyles();
    }

    /**
     * Attach event listener to the settings checkbox
     */
    attachSettingsListener() {
        const checkbox = document.getElementById('nemoEnablePanelWidth');
        if (!checkbox) {
            console.warn(`${LOG_PREFIX} Panel width settings checkbox not found`);
            return false;
        }

        this.settingsCheckbox = checkbox;

        // Set initial state from extension settings
        const initialState = extension_settings.NemoPresetExt?.nemoEnablePanelWidth ?? false;
        checkbox.checked = initialState;
        this.setEnabled(initialState);

        // Add change event listener
        checkbox.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            
            // Update extension settings
            if (!extension_settings.NemoPresetExt) {
                extension_settings.NemoPresetExt = {};
            }
            extension_settings.NemoPresetExt.nemoEnablePanelWidth = enabled;
            saveSettingsDebounced();

            // Apply the change immediately
            this.setEnabled(enabled);
            
            console.log(`${LOG_PREFIX} Panel width setting changed to: ${enabled}`);
        });

        console.log(`${LOG_PREFIX} Panel width settings listener attached`);
        return true;
    }

    /**
     * Initialize the panel toggle feature
     */
    initialize() {
        console.log(`${LOG_PREFIX} Initializing Panel Width Toggle feature...`);

        // Wait for settings UI to be available
        const initWhenReady = () => {
            const attached = this.attachSettingsListener();
            
            if (!attached) {
                // Retry after a delay if settings not ready
                console.log(`${LOG_PREFIX} Retrying panel width settings attachment...`);
                setTimeout(() => this.attachSettingsListener(), 1000);
            } else {
                console.log(`${LOG_PREFIX} Panel Width Toggle initialized successfully`);
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initWhenReady);
        } else {
            // Settings UI might not be loaded yet, so retry with delays
            setTimeout(initWhenReady, 500);
        }
    }
}

// Create and export the panel toggle instance
export const panelToggle = new PanelToggle();