import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Mount NemoTavern React app
function mount() {
    const container = document.getElementById('nemo-root');
    if (!container) {
        console.error('[NemoTavern React] Mount point #nemo-root not found');
        return;
    }

    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    console.log('[NemoTavern React] App mounted');

    // Handle cleanup
    window.addEventListener('nemo:cleanup', () => {
        root.unmount();
        console.log('[NemoTavern React] App unmounted');
    });
}

// Mount when ready
if (document.getElementById('nemo-root')) {
    mount();
} else {
    // Wait for mount point to be created
    const observer = new MutationObserver((mutations, obs) => {
        if (document.getElementById('nemo-root')) {
            obs.disconnect();
            mount();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

export { mount };
