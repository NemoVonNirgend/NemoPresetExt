import { useEffect } from 'react';
import { useNemoStore } from '../store';

export function useKeyboardShortcuts() {
    const { toggleCommandPalette, closeCommandPalette, closeSettings, settingsOpen, commandPaletteOpen } = useNemoStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + K - Toggle command palette
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                toggleCommandPalette();
            }

            // Escape - Close modals
            if (e.key === 'Escape') {
                if (commandPaletteOpen) {
                    closeCommandPalette();
                } else if (settingsOpen) {
                    closeSettings();
                }
            }

            // Cmd/Ctrl + , - Open settings
            if ((e.metaKey || e.ctrlKey) && e.key === ',') {
                e.preventDefault();
                useNemoStore.getState().openSettings();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleCommandPalette, closeCommandPalette, closeSettings, settingsOpen, commandPaletteOpen]);
}

export default useKeyboardShortcuts;
