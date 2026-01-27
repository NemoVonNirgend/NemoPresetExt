// settings-ui.js - React-based settings panel

// Utils imported for potential future use
import logger from '../core/logger.js';

export const NemoSettingsUI = {
    initialized: false,

    initialize: async function() {
        if (this.initialized) {
            logger.debug('NemoSettingsUI: Already initialized');
            return;
        }

        logger.info('NemoSettingsUI: Starting initialization (React mode)...');

        // Wait for both the container and React UI to be available
        const waitForContainerAndReact = (attempts = 0) => {
            const maxAttempts = 40; // 20 seconds max wait
            const container = document.getElementById('extensions_settings');
            const hasExistingSettings = document.querySelector('.nemo-preset-enhancer-settings');

            // Check if React UI is available
            if (!window.NemoReactUI?.mountSettingsPanel) {
                if (attempts < maxAttempts) {
                    setTimeout(() => waitForContainerAndReact(attempts + 1), 500);
                } else {
                    logger.error('NemoSettingsUI: React UI not available after 20 seconds');
                }
                return;
            }

            if (container && !hasExistingSettings) {
                this.mountReactSettings(container);
            } else if (hasExistingSettings) {
                logger.debug('NemoSettingsUI: Settings already exist, skipping');
            } else if (attempts < maxAttempts) {
                setTimeout(() => waitForContainerAndReact(attempts + 1), 500);
            } else {
                logger.error('NemoSettingsUI: Container not found after 20 seconds');
            }
        };

        waitForContainerAndReact();
    },

    mountReactSettings: function(container) {
        try {
            // Create a wrapper div for our settings
            const settingsWrapper = document.createElement('div');
            settingsWrapper.className = 'nemo-preset-enhancer-settings';
            settingsWrapper.innerHTML = `
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>NemoPresetExt Settings</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content" style="display: none;">
                        <div class="nemo-react-settings-container"></div>
                    </div>
                </div>
            `;
            container.appendChild(settingsWrapper);

            // Set up drawer toggle
            const toggle = settingsWrapper.querySelector('.inline-drawer-toggle');
            const content = settingsWrapper.querySelector('.inline-drawer-content');
            const icon = settingsWrapper.querySelector('.inline-drawer-icon');

            toggle.addEventListener('click', () => {
                const isOpen = content.style.display !== 'none';
                content.style.display = isOpen ? 'none' : 'block';
                icon.classList.toggle('down', isOpen);
                icon.classList.toggle('up', !isOpen);
            });

            // Mount React settings panel
            const reactContainer = settingsWrapper.querySelector('.nemo-react-settings-container');
            window.NemoReactUI.mountSettingsPanel(reactContainer);

            this.initialized = true;
            logger.info('NemoSettingsUI: React settings panel mounted successfully');
        } catch (error) {
            logger.error('NemoSettingsUI: Failed to mount React settings', error);
        }
    },

    // Legacy methods for backward compatibility (now handled by React)
    applyMessageTheme: function(themeName) {
        document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim();
        if (themeName && themeName !== 'default') {
            document.body.classList.add(`theme-${themeName}`);
        }
    },

    showRefreshNotification: function() {
        // Use React toast if available, otherwise show basic notification
        if (window.NemoReactUI?.showToast) {
            // React can handle this via toast system
            return;
        }

        const notification = document.createElement('div');
        notification.innerHTML = '<i class="fa-solid fa-refresh"></i> Page refresh required for changes to take effect.';
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: var(--SmartThemeQuoteColor); color: white; padding: 15px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 8px rgba(0,0,0,0.3);';
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 4000);
    }
};
