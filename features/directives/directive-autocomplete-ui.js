/**
 * Nemo Directive Autocomplete UI
 * React-based autocomplete for directive editing
 *
 * @module directive-autocomplete-ui
 */

import logger from '../../core/logger.js';
import { getAutocompleteSuggestions, insertSuggestion } from './directive-autocomplete.js';
import { extension_settings } from '../../../../../extensions.js';
import { NEMO_EXTENSION_NAME } from '../../core/utils.js';

/**
 * Initialize autocomplete for prompt editor
 * Now uses React for proper lifecycle management
 */
export function initDirectiveAutocomplete() {
    // Check if autocomplete is enabled in settings
    const isEnabled = extension_settings[NEMO_EXTENSION_NAME]?.enableDirectiveAutocomplete ?? true;
    if (!isEnabled) {
        logger.info('Directive autocomplete disabled by settings');
        return;
    }

    logger.info('Initializing directive autocomplete UI (React mode)');

    // Expose the autocomplete functions globally for React component to use
    window.NemoDirectiveAutocomplete = {
        getAutocompleteSuggestions,
        insertSuggestion,
    };

    // Wait for React to be ready, then mount the autocomplete controller
    const waitForReact = (attempts = 0) => {
        const maxAttempts = 40; // 20 seconds max wait

        if (window.NemoReactUI?.mountDirectiveAutocomplete) {
            window.NemoReactUI.mountDirectiveAutocomplete();
            logger.info('Directive autocomplete React component mounted');
            return;
        }

        if (attempts < maxAttempts) {
            setTimeout(() => waitForReact(attempts + 1), 500);
        } else {
            logger.error('React UI not available for directive autocomplete after 20 seconds');
        }
    };

    // Start waiting for React
    setTimeout(() => waitForReact(), 300);
}

/**
 * Cleanup autocomplete (called on extension unload)
 */
export function cleanupDirectiveAutocomplete() {
    if (window.NemoReactUI?.unmountDirectiveAutocomplete) {
        window.NemoReactUI.unmountDirectiveAutocomplete();
    }
    delete window.NemoDirectiveAutocomplete;
    logger.info('Directive autocomplete cleaned up');
}
