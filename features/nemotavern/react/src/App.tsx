import React, { useEffect } from 'react';
import { useNemoStore } from './store';
import CommandPalette from './components/CommandPalette/CommandPalette';
import UnifiedSettings from './components/UnifiedSettings/UnifiedSettings';
import FloatingPanel from './components/FloatingPanel/FloatingPanel';
import Toolbar from './components/Layout/Toolbar';
import DockZone from './components/FloatingPanel/DockZone';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useEventBridge } from './hooks/useEventBridge';

const App: React.FC = () => {
    const {
        commandPaletteOpen,
        settingsOpen,
        panels,
        dockZones,
        toggleCommandPalette,
        toggleSettings
    } = useNemoStore();

    // Set up keyboard shortcuts
    useKeyboardShortcuts();

    // Set up event bridge for vanilla JS communication
    useEventBridge();

    return (
        <>
            {/* Toolbar */}
            <Toolbar onCommandPalette={toggleCommandPalette} onSettings={toggleSettings} />

            {/* Dock Zones */}
            <DockZone zone="left" panels={dockZones.left} />
            <DockZone zone="right" panels={dockZones.right} />

            {/* Floating Panels */}
            {Array.from(panels.entries()).map(([id, panel]) => (
                <FloatingPanel key={id} id={id} {...panel} />
            ))}

            {/* Command Palette */}
            {commandPaletteOpen && <CommandPalette />}

            {/* Unified Settings */}
            {settingsOpen && <UnifiedSettings />}
        </>
    );
};

export default App;
