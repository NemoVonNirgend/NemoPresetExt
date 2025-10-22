// NEMO-VRM Extension Entry Point for NemoPresetExt
// Wraps the original NEMO-VRM extension to work within NemoPresetExt

export class NemoVRMExtension {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * Load NEMO-VRM CSS dynamically
     */
    loadCSS() {
        const cssPath = 'scripts/extensions/third-party/NemoPresetExt/features/nemovrm/style.css';

        // Check if CSS is already loaded
        if (document.querySelector(`link[href="${cssPath}"]`)) {
            console.log('[NEMO-VRM] CSS already loaded');
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = cssPath;
        document.head.appendChild(link);
        console.log('[NEMO-VRM] CSS loaded successfully');
    }

    /**
     * Initialize the NEMO-VRM extension
     */
    async initialize() {
        console.log('[NEMO-VRM] Initializing NEMO-VRM extension...');

        try {
            // Load CSS first
            this.loadCSS();

            // Import the main index.js which contains all the initialization logic
            await import('./index.js');

            this.isInitialized = true;
            console.log('[NEMO-VRM] ✅ NEMO-VRM initialized successfully');
        } catch (error) {
            console.error('[NEMO-VRM] Failed to initialize NEMO-VRM:', error);
            throw error;
        }
    }
}
