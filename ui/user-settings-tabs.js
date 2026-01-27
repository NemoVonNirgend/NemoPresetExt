/**
 * User Settings Tabs - Tabbed interface for SillyTavern user settings
 * Now uses React for rendering (via mountUserSettingsTabs)
 */

import logger from '../core/logger.js';

export const UserSettingsTabs = {
    initialized: false,
    reactMounted: false,

    initialize: function() {
        if (this.initialized) return;

        logger.info('UserSettingsTabs: Starting initialization (React mode)...');

        // Wait for React UI to be available
        const waitForReact = (attempts = 0) => {
            const maxAttempts = 40; // 20 seconds max wait

            if (window.NemoReactUI?.mountUserSettingsTabs) {
                this.mountReactTabs();
                return;
            }

            if (attempts < maxAttempts) {
                setTimeout(() => waitForReact(attempts + 1), 500);
            } else {
                logger.error('UserSettingsTabs: React UI not available after 20 seconds');
            }
        };

        waitForReact();
    },

    mountReactTabs: function() {
        if (this.reactMounted) return;

        // Wait for the user settings container
        const waitForContainer = (attempts = 0) => {
            const maxAttempts = 40;
            const userSettingsBlock = document.getElementById('user-settings-block');

            if (userSettingsBlock) {
                // Check if already has React tabs
                if (userSettingsBlock.querySelector('.nemo-react-user-tabs')) {
                    logger.debug('UserSettingsTabs: React tabs already mounted');
                    this.initialized = true;
                    this.reactMounted = true;
                    return;
                }

                // Create container for React
                const reactContainer = document.createElement('div');
                reactContainer.className = 'nemo-react-user-tabs';

                // Insert at the beginning of user settings
                const content = userSettingsBlock.querySelector('#user-settings-block-content');
                if (content) {
                    content.parentNode.insertBefore(reactContainer, content);
                } else {
                    userSettingsBlock.prepend(reactContainer);
                }

                // Mount React component
                window.NemoReactUI.mountUserSettingsTabs(reactContainer);

                this.initialized = true;
                this.reactMounted = true;
                logger.info('UserSettingsTabs: React tabs mounted successfully');
            } else if (attempts < maxAttempts) {
                setTimeout(() => waitForContainer(attempts + 1), 500);
            } else {
                logger.error('UserSettingsTabs: user-settings-block not found after 20 seconds');
            }
        };

        waitForContainer();
    },

    cleanup: function() {
        if (window.NemoReactUI?.unmountUserSettingsTabs) {
            window.NemoReactUI.unmountUserSettingsTabs();
        }
        this.reactMounted = false;
        this.initialized = false;
        logger.info('UserSettingsTabs: Cleaned up');
    }
};
