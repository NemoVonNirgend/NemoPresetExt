// NemoPresetExt/card-emporium.js
// Injects a button to open Nemo's Card & Lorebook Emporium

import { LOG_PREFIX } from '../../core/utils.js';
import { CardEmporiumUI } from './card-emporium-ui.js';

// --- SINGLETON UI INSTANCE ---
let cardEmporiumUIInstance = null;

// --- INITIALIZATION ---
function injectEmporiumButton() {
    // Find the character search form where we'll inject the button
    const searchForm = document.querySelector('#form_character_search_form');
    if (!searchForm || document.querySelector('#nemo-card-emporium-btn')) return;

    // Create the button
    const emporiumButton = document.createElement('button');
    emporiumButton.id = 'nemo-card-emporium-btn';
    emporiumButton.className = 'menu_button';
    emporiumButton.title = "Nemo's Card & Lorebook Emporium";
    emporiumButton.innerHTML = `<i class="fa-solid fa-shop"></i> Emporium`;

    // Insert after the Browse button if it exists, otherwise prepend
    const browseButton = document.querySelector('#nemo-char-browse-btn');
    if (browseButton && browseButton.nextSibling) {
        searchForm.insertBefore(emporiumButton, browseButton.nextSibling);
    } else {
        searchForm.prepend(emporiumButton);
    }

    // Add click handler
    emporiumButton.addEventListener('click', () => {
        if (!cardEmporiumUIInstance) {
            cardEmporiumUIInstance = new CardEmporiumUI();
        }
        cardEmporiumUIInstance.open();
    });

    console.log(`${LOG_PREFIX} Card Emporium button injected successfully.`);
}

export const NemoCardEmporium = {
    isInitialized: false,

    async initialize() {
        if (this.isInitialized) return;

        const parentBlock = document.getElementById('rm_characters_block');
        if (!parentBlock) {
            // Wait for the character block to be available
            new MutationObserver((_, obs) => {
                if (document.getElementById('rm_characters_block')) {
                    obs.disconnect();
                    this.initialize();
                }
            }).observe(document.body, { childList: true, subtree: true });
            return;
        }

        console.log(`${LOG_PREFIX} Initializing Card Emporium...`);

        injectEmporiumButton();
        this.isInitialized = true;

        console.log(`${LOG_PREFIX} Card Emporium initialized successfully.`);
    },
};
