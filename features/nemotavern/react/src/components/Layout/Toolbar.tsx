import React from 'react';
import { useNemoStore } from '../../store';

interface ToolbarProps {
    onCommandPalette: () => void;
    onSettings: () => void;
}

// Helper to toggle SillyTavern drawers
const toggleDrawer = (drawerId: string) => {
    const drawer = document.getElementById(drawerId);
    if (!drawer) {
        console.warn('[NemoTavern] Drawer not found:', drawerId);
        return;
    }

    // Find the .drawer-toggle element (this is what ST's click handler expects)
    const drawerToggle = drawer.querySelector('.drawer-toggle') as HTMLElement;
    if (drawerToggle) {
        // Create and dispatch a synthetic click event
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        drawerToggle.dispatchEvent(clickEvent);
        return;
    }

    // Fallback: try clicking the drawer-icon directly
    const drawerIcon = drawer.querySelector('.drawer-icon') as HTMLElement;
    if (drawerIcon) {
        drawerIcon.click();
        return;
    }

    console.warn('[NemoTavern] No drawer-toggle or drawer-icon found in:', drawerId);
};

const Toolbar: React.FC<ToolbarProps> = ({ onCommandPalette, onSettings }) => {
    const { quickAccessButtons } = useNemoStore();

    return (
        <div className="nemo-toolbar">
            {/* Logo/Brand */}
            <div className="nemo-toolbar-brand">
                <span className="nemo-toolbar-logo">NT</span>
                <span className="nemo-toolbar-name">NemoTavern</span>
            </div>

            {/* Quick Access Buttons */}
            <div className="nemo-toolbar-actions">
                <button
                    className="nemo-toolbar-button"
                    onClick={() => document.querySelector<HTMLElement>('#option_start_new_chat')?.click()}
                    title="New Chat"
                    aria-label="New Chat"
                >
                    <i className="fa-solid fa-plus" />
                    <span className="nemo-toolbar-button-label">New Chat</span>
                </button>
            </div>

            {/* Spacer */}
            <div className="nemo-toolbar-spacer" />

            {/* Command Palette Trigger */}
            <button
                className="nemo-toolbar-search"
                onClick={onCommandPalette}
                aria-label="Open command palette"
            >
                <i className="fa-solid fa-search" />
                <span>Search commands...</span>
                <kbd>⌘K</kbd>
            </button>

            {/* Settings Button - opens unified settings */}
            <button
                className="nemo-toolbar-button"
                onClick={onSettings}
                title="Settings"
                aria-label="Open settings"
            >
                <i className="fa-solid fa-gear" />
            </button>

            {/* Panel Toggles - directly click ST drawers */}
            <div className="nemo-toolbar-panel-toggles">
                <button
                    className="nemo-toolbar-button"
                    onClick={() => toggleDrawer('rightNavHolder')}
                    title="Characters"
                    aria-label="Open characters"
                >
                    <i className="fa-solid fa-users" />
                </button>

                <button
                    className="nemo-toolbar-button"
                    onClick={() => toggleDrawer('extensions-settings-button')}
                    title="Extensions"
                    aria-label="Open extensions"
                >
                    <i className="fa-solid fa-puzzle-piece" />
                </button>
            </div>
        </div>
    );
};

export default Toolbar;
