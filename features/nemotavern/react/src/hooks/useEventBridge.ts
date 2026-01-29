import { useEffect } from 'react';
import { useNemoStore } from '../store';

/**
 * Bridge between vanilla JS and React for NemoTavern
 */
export function useEventBridge() {
    const store = useNemoStore();

    useEffect(() => {
        // Handle open panel events from vanilla JS
        const handleOpenPanel = (e: CustomEvent<{ panelId: string }>) => {
            store.openPanel(e.detail.panelId);
        };

        // Handle close panel events
        const handleClosePanel = (e: CustomEvent<{ panelId: string }>) => {
            store.closePanel(e.detail.panelId);
        };

        // Handle toggle command palette
        const handleToggleCommandPalette = () => {
            store.toggleCommandPalette();
        };

        // Handle close command palette
        const handleCloseCommandPalette = () => {
            store.closeCommandPalette();
        };

        // Handle toggle settings
        const handleToggleSettings = () => {
            store.toggleSettings();
        };

        // Register event listeners
        window.addEventListener('nemo:open-panel', handleOpenPanel as EventListener);
        window.addEventListener('nemo:close-panel', handleClosePanel as EventListener);
        window.addEventListener('nemo:toggle-command-palette', handleToggleCommandPalette);
        window.addEventListener('nemo:close-command-palette', handleCloseCommandPalette);
        window.addEventListener('nemo:toggle-settings', handleToggleSettings);

        // Cleanup
        return () => {
            window.removeEventListener('nemo:open-panel', handleOpenPanel as EventListener);
            window.removeEventListener('nemo:close-panel', handleClosePanel as EventListener);
            window.removeEventListener('nemo:toggle-command-palette', handleToggleCommandPalette);
            window.removeEventListener('nemo:close-command-palette', handleCloseCommandPalette);
            window.removeEventListener('nemo:toggle-settings', handleToggleSettings);
        };
    }, [store]);
}

export default useEventBridge;
