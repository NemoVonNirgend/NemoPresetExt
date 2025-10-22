// NemoPresetExt/card-emporium-ui.js
// Opens Nemo's Card & Lorebook Emporium in a popup

import { callGenericPopup, POPUP_TYPE } from '../../../../../popup.js';
import { LOG_PREFIX } from '../../core/utils.js';
import { cardEmporiumBridge } from './card-emporium-bridge.js';

export class CardEmporiumUI {
    constructor() {
        this.element = null;
        this.isInitialized = false;
        // Use the built static files from the dist folder
        this.appPath = 'scripts/extensions/third-party/NemoPresetExt/nemo\'s-cards-and-lorebook-emporium/dist/index.html';
    }

    async init() {
        if (this.isInitialized) return;

        // Create container with iframe
        this.element = document.createElement('div');
        this.element.id = 'nemo-card-emporium-container';
        this.element.style.width = '100%';
        this.element.style.height = '80vh';
        this.element.style.display = 'flex';
        this.element.style.flexDirection = 'column';
        this.element.style.gap = '10px';

        // Load the static app in an iframe
        const iframe = document.createElement('iframe');
        iframe.src = this.appPath;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '8px';

        // Register iframe with bridge for communication
        iframe.addEventListener('load', () => {
            cardEmporiumBridge.setIframe(iframe);
            console.log(`${LOG_PREFIX} Card Emporium iframe loaded and registered with bridge`);
        });

        this.element.appendChild(iframe);
        this.isInitialized = true;

        console.log(`${LOG_PREFIX} Card Emporium loaded from ${this.appPath}`);
    }

    async open() {
        await this.init();

        callGenericPopup(this.element, POPUP_TYPE.DISPLAY, "Nemo's Card & Lorebook Emporium", {
            wide: true,
            large: true,
            addCloseButton: true,
        });
    }
}
