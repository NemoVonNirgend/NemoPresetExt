import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export interface Position {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export interface PanelState {
    id: string;
    title: string;
    icon?: string;
    isOpen: boolean;
    isMinimized: boolean;
    isMaximized: boolean;
    position: Position;
    size: Size;
    dockedTo: DockZone | null;
    zIndex: number;
    contentType: string; // 'drawer' | 'custom'
    drawerId?: string; // Original ST drawer ID if contentType is 'drawer'
}

export type DockZone = 'left' | 'right' | 'top' | 'bottom';

export interface QuickAction {
    id: string;
    label: string;
    icon: string;
    action: () => void;
    shortcut?: string;
}

export interface Command {
    id: string;
    label: string;
    icon?: string;
    category: string;
    shortcut?: string;
    action: () => void;
}

interface NemoStore {
    // Hydration state - components should check this before rendering panel-dependent UI
    _hasHydrated: boolean;

    // Panel State
    panels: Record<string, PanelState>;
    dockZones: {
        left: string[];
        right: string[];
        top: string[];
        bottom: string[];
    };
    nextZIndex: number;

    // Settings
    settingsOpen: boolean;
    settingsCategory: string;

    // Command Palette
    commandPaletteOpen: boolean;
    recentCommands: string[];
    commands: Command[];

    // Layout
    activeView: 'default' | 'compact' | 'wide';
    quickAccessButtons: QuickAction[];

    // Drag state
    isDragging: boolean;
    activeDockZone: DockZone | null;

    // Panel Actions
    openPanel: (id: string, config?: Partial<PanelState>) => void;
    closePanel: (id: string) => void;
    togglePanel: (id: string) => void;
    minimizePanel: (id: string) => void;
    maximizePanel: (id: string) => void;
    restorePanel: (id: string) => void;
    updatePanelPosition: (id: string, position: Position) => void;
    updatePanelSize: (id: string, size: Size) => void;
    dockPanel: (id: string, zone: DockZone) => void;
    floatPanel: (id: string, position: Position) => void;
    bringToFront: (id: string) => void;

    // Settings Actions
    toggleSettings: () => void;
    openSettings: (category?: string) => void;
    closeSettings: () => void;
    setSettingsCategory: (category: string) => void;

    // Command Palette Actions
    toggleCommandPalette: () => void;
    openCommandPalette: () => void;
    closeCommandPalette: () => void;
    executeCommand: (commandId: string) => void;
    addRecentCommand: (commandId: string) => void;
    registerCommand: (command: Command) => void;

    // Layout Actions
    setActiveView: (view: 'default' | 'compact' | 'wide') => void;
    addQuickAccessButton: (action: QuickAction) => void;
    removeQuickAccessButton: (id: string) => void;

    // Drag Actions
    setIsDragging: (isDragging: boolean) => void;
    setActiveDockZone: (zone: DockZone | null) => void;
}

// Default panels configuration
const DEFAULT_PANELS: Record<string, PanelState> = {
    characters: {
        id: 'characters',
        title: 'Characters',
        icon: 'fa-users',
        isOpen: false,
        isMinimized: false,
        isMaximized: false,
        position: { x: 100, y: 100 },
        size: { width: 350, height: 500 },
        dockedTo: null,
        zIndex: 1,
        contentType: 'drawer',
        drawerId: 'rightNavHolder'
    },
    settings: {
        id: 'settings',
        title: 'AI Settings',
        icon: 'fa-microchip',
        isOpen: false,
        isMinimized: false,
        isMaximized: false,
        position: { x: 150, y: 100 },
        size: { width: 400, height: 600 },
        dockedTo: null,
        zIndex: 1,
        contentType: 'drawer',
        drawerId: 'ai-config-button'
    },
    'world-info': {
        id: 'world-info',
        title: 'World Info',
        icon: 'fa-book',
        isOpen: false,
        isMinimized: false,
        isMaximized: false,
        position: { x: 200, y: 100 },
        size: { width: 500, height: 600 },
        dockedTo: null,
        zIndex: 1,
        contentType: 'drawer',
        drawerId: 'WI-SP-button'
    },
    extensions: {
        id: 'extensions',
        title: 'Extensions',
        icon: 'fa-puzzle-piece',
        isOpen: false,
        isMinimized: false,
        isMaximized: false,
        position: { x: 250, y: 100 },
        size: { width: 450, height: 550 },
        dockedTo: null,
        zIndex: 1,
        contentType: 'drawer',
        drawerId: 'extensions-settings-button'
    }
};

// Default commands
const DEFAULT_COMMANDS: Command[] = [
    {
        id: 'open-settings',
        label: 'Open Settings',
        icon: 'fa-gear',
        category: 'General',
        shortcut: '⌘,',
        action: () => useNemoStore.getState().openSettings()
    },
    {
        id: 'open-characters',
        label: 'Character List',
        icon: 'fa-users',
        category: 'Panels',
        action: () => useNemoStore.getState().openPanel('characters')
    },
    {
        id: 'open-world-info',
        label: 'World Info',
        icon: 'fa-book',
        category: 'Panels',
        action: () => useNemoStore.getState().openPanel('world-info')
    },
    {
        id: 'open-extensions',
        label: 'Extensions',
        icon: 'fa-puzzle-piece',
        category: 'Panels',
        action: () => useNemoStore.getState().openPanel('extensions')
    },
    {
        id: 'new-chat',
        label: 'New Chat',
        icon: 'fa-plus',
        category: 'Actions',
        shortcut: '⌘N',
        action: () => {
            document.querySelector<HTMLElement>('#option_start_new_chat')?.click();
        }
    },
    {
        id: 'toggle-left-panel',
        label: 'Toggle Left Panel',
        icon: 'fa-sidebar',
        category: 'Layout',
        action: () => {
            const leftPanel = document.getElementById('left-nav-panel');
            if (leftPanel) {
                leftPanel.classList.toggle('collapsed');
            }
        }
    },
    {
        id: 'toggle-right-panel',
        label: 'Toggle Right Panel',
        icon: 'fa-sidebar-flip',
        category: 'Layout',
        action: () => {
            const rightPanel = document.getElementById('right-nav-panel');
            if (rightPanel) {
                rightPanel.classList.toggle('collapsed');
            }
        }
    }
];

// Default quick access buttons
const DEFAULT_QUICK_ACCESS: QuickAction[] = [
    {
        id: 'new-chat',
        label: 'New Chat',
        icon: 'fa-plus',
        action: () => document.querySelector<HTMLElement>('#option_start_new_chat')?.click()
    },
    {
        id: 'characters',
        label: 'Characters',
        icon: 'fa-users',
        action: () => useNemoStore.getState().openPanel('characters')
    },
    {
        id: 'settings',
        label: 'Settings',
        icon: 'fa-gear',
        action: () => useNemoStore.getState().openSettings()
    }
];

export const useNemoStore = create<NemoStore>()(
    persist(
        (set, get) => ({
            // Hydration flag - starts false, set to true after storage rehydration completes
            _hasHydrated: false,

            // Initial state
            panels: { ...DEFAULT_PANELS },
            dockZones: {
                left: [],
                right: [],
                top: [],
                bottom: []
            },
            nextZIndex: 10,

            settingsOpen: false,
            settingsCategory: 'general',

            commandPaletteOpen: false,
            recentCommands: [],
            commands: DEFAULT_COMMANDS,

            activeView: 'default',
            quickAccessButtons: DEFAULT_QUICK_ACCESS,

            isDragging: false,
            activeDockZone: null,

            // Panel Actions
            openPanel: (id, config) => set(state => {
                const existing = state.panels[id];

                if (existing) {
                    return {
                        panels: {
                            ...state.panels,
                            [id]: {
                                ...existing,
                                ...config,
                                isOpen: true,
                                isMinimized: false,
                                zIndex: state.nextZIndex
                            }
                        },
                        nextZIndex: state.nextZIndex + 1
                    };
                } else if (config) {
                    return {
                        panels: {
                            ...state.panels,
                            [id]: {
                                id,
                                title: config.title || id,
                                isOpen: true,
                                isMinimized: false,
                                isMaximized: false,
                                position: config.position || { x: 100, y: 100 },
                                size: config.size || { width: 400, height: 500 },
                                dockedTo: null,
                                zIndex: state.nextZIndex,
                                contentType: config.contentType || 'custom',
                                ...config
                            } as PanelState
                        },
                        nextZIndex: state.nextZIndex + 1
                    };
                }

                return { nextZIndex: state.nextZIndex + 1 };
            }),

            closePanel: (id) => set(state => {
                const panel = state.panels[id];
                if (!panel) return state;
                return {
                    panels: { ...state.panels, [id]: { ...panel, isOpen: false } }
                };
            }),

            togglePanel: (id) => {
                const panel = get().panels[id];
                if (panel?.isOpen) {
                    get().closePanel(id);
                } else {
                    get().openPanel(id);
                }
            },

            minimizePanel: (id) => set(state => {
                const panel = state.panels[id];
                if (!panel) return state;
                return {
                    panels: { ...state.panels, [id]: { ...panel, isMinimized: true, isMaximized: false } }
                };
            }),

            maximizePanel: (id) => set(state => {
                const panel = state.panels[id];
                if (!panel) return state;
                return {
                    panels: { ...state.panels, [id]: { ...panel, isMaximized: true, isMinimized: false } }
                };
            }),

            restorePanel: (id) => set(state => {
                const panel = state.panels[id];
                if (!panel) return state;
                return {
                    panels: { ...state.panels, [id]: { ...panel, isMaximized: false, isMinimized: false } }
                };
            }),

            updatePanelPosition: (id, position) => set(state => {
                const panel = state.panels[id];
                if (!panel) return state;
                return {
                    panels: { ...state.panels, [id]: { ...panel, position } }
                };
            }),

            updatePanelSize: (id, size) => set(state => {
                const panel = state.panels[id];
                if (!panel) return state;
                return {
                    panels: { ...state.panels, [id]: { ...panel, size } }
                };
            }),

            dockPanel: (id, zone) => set(state => {
                const panel = state.panels[id];
                if (!panel) return state;

                const dockZones = { ...state.dockZones };

                // Remove from current dock zone if any
                if (panel.dockedTo) {
                    dockZones[panel.dockedTo] = dockZones[panel.dockedTo].filter(pId => pId !== id);
                }

                // Add to new dock zone
                dockZones[zone] = [...dockZones[zone], id];

                return {
                    panels: { ...state.panels, [id]: { ...panel, dockedTo: zone } },
                    dockZones
                };
            }),

            floatPanel: (id, position) => set(state => {
                const panel = state.panels[id];
                if (!panel) return state;

                const dockZones = { ...state.dockZones };

                // Remove from dock zone
                if (panel.dockedTo) {
                    dockZones[panel.dockedTo] = dockZones[panel.dockedTo].filter(pId => pId !== id);
                }

                return {
                    panels: { ...state.panels, [id]: { ...panel, dockedTo: null, position } },
                    dockZones
                };
            }),

            bringToFront: (id) => set(state => {
                const panel = state.panels[id];
                if (!panel) return state;
                return {
                    panels: { ...state.panels, [id]: { ...panel, zIndex: state.nextZIndex } },
                    nextZIndex: state.nextZIndex + 1
                };
            }),

            // Settings Actions
            toggleSettings: () => set(state => ({ settingsOpen: !state.settingsOpen })),
            openSettings: (category) => set({ settingsOpen: true, settingsCategory: category || 'general' }),
            closeSettings: () => set({ settingsOpen: false }),
            setSettingsCategory: (category) => set({ settingsCategory: category }),

            // Command Palette Actions
            toggleCommandPalette: () => set(state => ({ commandPaletteOpen: !state.commandPaletteOpen })),
            openCommandPalette: () => set({ commandPaletteOpen: true }),
            closeCommandPalette: () => set({ commandPaletteOpen: false }),

            executeCommand: (commandId) => {
                const command = get().commands.find(c => c.id === commandId);
                if (command) {
                    command.action();
                    get().addRecentCommand(commandId);
                    get().closeCommandPalette();
                }
            },

            addRecentCommand: (commandId) => set(state => {
                const recentCommands = [commandId, ...state.recentCommands.filter(id => id !== commandId)].slice(0, 5);
                return { recentCommands };
            }),

            registerCommand: (command) => set(state => ({
                commands: [...state.commands.filter(c => c.id !== command.id), command]
            })),

            // Layout Actions
            setActiveView: (view) => set({ activeView: view }),

            addQuickAccessButton: (action) => set(state => ({
                quickAccessButtons: [...state.quickAccessButtons.filter(a => a.id !== action.id), action]
            })),

            removeQuickAccessButton: (id) => set(state => ({
                quickAccessButtons: state.quickAccessButtons.filter(a => a.id !== id)
            })),

            // Drag Actions
            setIsDragging: (isDragging) => set({ isDragging }),
            setActiveDockZone: (zone) => set({ activeDockZone: zone })
        }),
        {
            name: 'nemo-tavern-storage',
            version: 1, // Version for migration tracking
            partialize: (state) => ({
                panels: state.panels,
                dockZones: state.dockZones,
                recentCommands: state.recentCommands,
                activeView: state.activeView,
                quickAccessButtons: state.quickAccessButtons
            }),
            // Migration function to handle old Map-based storage or corrupted data
            migrate: (persistedState: unknown, version: number) => {
                const state = persistedState as Record<string, unknown>;

                // Handle upgrade from version 0 (pre-migration) to version 1
                if (version === 0) {
                    // If panels is empty object (serialized Map) or missing, reset to defaults
                    if (!state.panels || Object.keys(state.panels as object).length === 0) {
                        console.log('[NemoTavern] Migrating panel state to v1 format');
                        return {
                            ...state,
                            panels: { ...DEFAULT_PANELS }
                        };
                    }

                    // Validate panel structure - ensure all required fields exist
                    const panels = state.panels as Record<string, unknown>;
                    const migratedPanels: Record<string, PanelState> = {};

                    for (const [id, panel] of Object.entries(panels)) {
                        const p = panel as Partial<PanelState>;
                        // Get defaults for this panel (or generic defaults)
                        const defaultPanel = DEFAULT_PANELS[id];
                        const defaultPosition = defaultPanel?.position || { x: 100, y: 100 };
                        const defaultSize = defaultPanel?.size || { width: 400, height: 500 };

                        // Deep merge for nested objects (position, size)
                        // This ensures partial position/size objects don't lose properties
                        const mergedPosition: Position = {
                            x: (p.position as Partial<Position>)?.x ?? defaultPosition.x,
                            y: (p.position as Partial<Position>)?.y ?? defaultPosition.y
                        };

                        const mergedSize: Size = {
                            width: (p.size as Partial<Size>)?.width ?? defaultSize.width,
                            height: (p.size as Partial<Size>)?.height ?? defaultSize.height
                        };

                        migratedPanels[id] = {
                            id,
                            title: p.title || defaultPanel?.title || id,
                            icon: p.icon || defaultPanel?.icon,
                            isOpen: p.isOpen ?? false,
                            isMinimized: p.isMinimized ?? false,
                            isMaximized: p.isMaximized ?? false,
                            position: mergedPosition,
                            size: mergedSize,
                            dockedTo: p.dockedTo ?? null,
                            zIndex: p.zIndex ?? 1,
                            contentType: p.contentType || defaultPanel?.contentType || 'custom',
                            drawerId: p.drawerId || defaultPanel?.drawerId
                        };
                    }

                    // Add any missing default panels
                    for (const [id, defaultPanel] of Object.entries(DEFAULT_PANELS)) {
                        if (!migratedPanels[id]) {
                            migratedPanels[id] = { ...defaultPanel };
                        }
                    }

                    return {
                        ...state,
                        panels: migratedPanels
                    };
                }

                return state;
            },
            // Handle corrupted or invalid storage gracefully
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    console.error('[NemoTavern] Failed to rehydrate storage:', error);
                    // State will reset to defaults on error
                }
                // Mark hydration as complete - components can now safely render panel-dependent UI
                // This runs after persist middleware has finished loading from storage
                useNemoStore.setState({ _hasHydrated: true });
            }
        }
    )
);

export default useNemoStore;
