// NemoPresetExt/character-manager.js

import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { getContext } from '../../../extensions.js';
import { LOG_PREFIX, generateUUID } from './utils.js';
import { CharacterManagerUI } from './character-manager-ui.js';

// --- SINGLETON UI INSTANCE ---
let characterManagerUIInstance = null;

// --- CONSTANTS ---
export const NEMO_CHAR_METADATA_KEY = 'nemoCharacterMetadata_v1';
const SELECTORS = {
    parentBlock: '#rm_characters_block',
    characterListContainer: '#rm_print_characters_block',
    characterListFixedTop: '#charListFixedTop',
    anyItem: '.character_select, .group_select',
    nemoHeader: '.nemo-character-navigator-header',
    nemoFolderContainer: '.nemo-char-folder-container',
};

// --- DATA MANAGEMENT ---
export function loadCharacterMetadata() {
    try {
        const stored = localStorage.getItem(NEMO_CHAR_METADATA_KEY);
        if (stored) {
            const metadata = JSON.parse(stored);
            metadata.folders = metadata.folders || {};
            metadata.characters = metadata.characters || {};
            return metadata;
        }
    } catch (ex) {
        console.error(`${LOG_PREFIX} Failed to load character metadata.`, ex);
    }
    // Return a default structure if nothing is stored or parsing fails
    return { folders: {}, characters: {} };
}

export function saveCharacterMetadata(metadata) {
    localStorage.setItem(NEMO_CHAR_METADATA_KEY, JSON.stringify(metadata));
}

export function updateMetadataTimestamp(metadata, id, type) {
    const item = (type === 'folder') ? metadata.folders[id] : metadata.characters[id];
    if (item) {
        item.lastModified = new Date().toISOString();
    }
}

// --- INITIALIZATION & EVENT HANDLING ---
function injectHeaderUI() {
    const searchForm = document.querySelector('#form_character_search_form');
    if (!searchForm || document.querySelector('#nemo-char-browse-btn')) return;

    const browseButton = document.createElement('button');
    browseButton.id = 'nemo-char-browse-btn';
    browseButton.className = 'menu_button';
    browseButton.title = 'Browse Characters';
    browseButton.innerHTML = `<i class="fa-solid fa-folder-open"></i> Browse`;

    searchForm.prepend(browseButton);

    browseButton.addEventListener('click', () => {
        if (!characterManagerUIInstance) {
            characterManagerUIInstance = new CharacterManagerUI();
        }
        characterManagerUIInstance.open();
    });
}

// Legacy event listeners removed. All UI is in CharacterManagerUI.
function setupEventListeners() {
    // Intentionally left blank
}

export const NemoCharacterManager = {
    isInitialized: false,
    observer: null,

    async initialize() {
        if (this.isInitialized) return;

        const parentBlock = document.getElementById(SELECTORS.parentBlock.substring(1));
        if (!parentBlock) {
            new MutationObserver((_, obs) => {
                if (document.getElementById(SELECTORS.parentBlock.substring(1))) {
                    obs.disconnect();
                    this.initialize();
                }
            }).observe(document.body, { childList: true, subtree: true });
            return;
        }

        console.log(`${LOG_PREFIX} Initializing Character Manager (v5 - Navigator Only)...`);
        
        injectHeaderUI();
        // All event listeners and rendering logic have been moved to the UI class.
        // This manager's only job is to inject the "Browse" button.
        this.isInitialized = true;

        console.log(`${LOG_PREFIX} Character Manager initialized successfully.`);
    },
};