/**
 * React entry point for NemoPresetExt
 * Mounts React components into the DOM with context providers
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AccordionView } from './components/AccordionView';
import { TrayView } from './components/TrayView';
import { NavigatorView } from './components/navigator';
import { NemoProvider } from './context/NemoContext';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { UserSettingsTabs } from './components/settings/UserSettingsTabs';
import { VNDialog } from './components/onboarding/VNDialog';
import { ConflictToast } from './components/directives/ConflictToast';
import { HelpModal } from './components/directives/HelpModal';
import { DirectiveAutocompleteController } from './components/directives/DirectiveAutocompleteController';
import type { ViewMode } from './types/prompts';
import type { DialogStep } from './components/onboarding/VNDialog';
import type { ConflictIssue } from './types/directives';

// Root instances for different mount points
let promptViewRoot: Root | null = null;
let currentMode: ViewMode | null = null;
let mountedContainer: HTMLElement | null = null;

let navigatorRoot: Root | null = null;
let settingsRoot: Root | null = null;
let userSettingsRoot: Root | null = null;
let vnDialogRoot: Root | null = null;
let conflictToastRoot: Root | null = null;
let helpModalRoot: Root | null = null;
let autocompleteRoot: Root | null = null;

/**
 * Mount the React prompt view
 */
export function mountPromptView(
    container: HTMLElement,
    mode: ViewMode,
    options?: {
        getTooltip?: (prompt: { name: string; content: string }) => string | undefined;
        onEditPrompt?: (identifier: string) => void;
    }
): void {
    // Check if old container is still in DOM
    if (mountedContainer && !document.body.contains(mountedContainer)) {
        // Container was removed from DOM - force cleanup
        try {
            if (promptViewRoot) {
                promptViewRoot.unmount();
            }
        } catch (e) {
            console.warn('[NemoPresetExt] Error unmounting orphaned root:', e);
        }
        promptViewRoot = null;
        mountedContainer = null;
        currentMode = null;
    }

    // Unmount existing if different container or mode
    if (promptViewRoot && (mountedContainer !== container || currentMode !== mode)) {
        unmountPromptView();
    }

    if (!promptViewRoot) {
        promptViewRoot = createRoot(container);
        mountedContainer = container;
    }

    currentMode = mode;

    const ViewComponent = mode === 'accordion' ? AccordionView : TrayView;

    promptViewRoot.render(
        <React.StrictMode>
            <NemoProvider>
                <ViewComponent {...options} />
            </NemoProvider>
        </React.StrictMode>
    );

    console.log(`[NemoPresetExt] React ${mode} view mounted`);
}

/**
 * Unmount the React prompt view
 */
export function unmountPromptView(): void {
    if (promptViewRoot) {
        promptViewRoot.unmount();
        promptViewRoot = null;
        currentMode = null;
        mountedContainer = null;
        console.log('[NemoPresetExt] React view unmounted');
    }
}

/**
 * Refresh the current view (re-render with latest data)
 */
export function refreshView(): void {
    if (promptViewRoot && mountedContainer && currentMode) {
        // Force re-render by remounting
        const mode = currentMode;
        unmountPromptView();
        mountPromptView(mountedContainer, mode);
    }
}

/**
 * Check if prompt view is mounted
 */
export function isViewMounted(): boolean {
    return promptViewRoot !== null;
}

/**
 * Mount the settings panel
 */
export function mountSettingsPanel(container: HTMLElement): void {
    if (settingsRoot) {
        settingsRoot.unmount();
    }

    settingsRoot = createRoot(container);

    settingsRoot.render(
        <React.StrictMode>
            <NemoProvider>
                <SettingsPanel />
            </NemoProvider>
        </React.StrictMode>
    );

    console.log('[NemoPresetExt] React Settings panel mounted');
}

/**
 * Unmount the settings panel
 */
export function unmountSettingsPanel(): void {
    if (settingsRoot) {
        settingsRoot.unmount();
        settingsRoot = null;
        console.log('[NemoPresetExt] React Settings panel unmounted');
    }
}

/**
 * Get current view mode
 */
export function getCurrentMode(): ViewMode | null {
    return currentMode;
}

/**
 * Mount the Navigator view in a container
 */
export function mountNavigatorView(
    container: HTMLElement,
    options?: {
        onClose?: () => void;
    }
): void {
    if (navigatorRoot) {
        navigatorRoot.unmount();
    }

    navigatorRoot = createRoot(container);

    navigatorRoot.render(
        <React.StrictMode>
            <NemoProvider>
                <NavigatorView onClose={options?.onClose} />
            </NemoProvider>
        </React.StrictMode>
    );

    console.log('[NemoPresetExt] React Navigator view mounted');
}

/**
 * Unmount the Navigator view
 */
export function unmountNavigatorView(): void {
    if (navigatorRoot) {
        navigatorRoot.unmount();
        navigatorRoot = null;
        console.log('[NemoPresetExt] React Navigator view unmounted');
    }
}

/**
 * Mount the User Settings Tabs
 */
export function mountUserSettingsTabs(container: HTMLElement): void {
    if (userSettingsRoot) {
        userSettingsRoot.unmount();
    }

    userSettingsRoot = createRoot(container);

    userSettingsRoot.render(
        <React.StrictMode>
            <NemoProvider>
                <UserSettingsTabs />
            </NemoProvider>
        </React.StrictMode>
    );

    console.log('[NemoPresetExt] React User Settings Tabs mounted');
}

/**
 * Unmount User Settings Tabs
 */
export function unmountUserSettingsTabs(): void {
    if (userSettingsRoot) {
        userSettingsRoot.unmount();
        userSettingsRoot = null;
    }
}

/**
 * Show a VN Dialog (tutorial/onboarding)
 * Returns a promise that resolves when dialog completes or is dismissed
 */
export function showVNDialog(
    steps: DialogStep[],
    options?: {
        title?: string;
        allowDismiss?: boolean;
    }
): Promise<boolean> {
    return new Promise((resolve) => {
        // Create container for dialog
        const container = document.createElement('div');
        container.id = 'nemo-vn-dialog-root';
        document.body.appendChild(container);

        if (vnDialogRoot) {
            vnDialogRoot.unmount();
        }

        vnDialogRoot = createRoot(container);

        const cleanup = (completed: boolean) => {
            if (vnDialogRoot) {
                vnDialogRoot.unmount();
                vnDialogRoot = null;
            }
            container.remove();
            resolve(completed);
        };

        vnDialogRoot.render(
            <React.StrictMode>
                <NemoProvider>
                    <VNDialog
                        steps={steps}
                        title={options?.title}
                        allowDismiss={options?.allowDismiss}
                        onComplete={() => cleanup(true)}
                        onDismiss={() => cleanup(false)}
                    />
                </NemoProvider>
            </React.StrictMode>
        );
    });
}

/**
 * Show a conflict toast notification
 * Returns a promise with the user's action
 */
export function showConflictToast(
    issues: ConflictIssue[],
    options?: {
        title?: string;
    }
): Promise<{ action: 'resolve' | 'ignore' | 'cancel'; issue?: ConflictIssue }> {
    return new Promise((resolve) => {
        // Create container
        const container = document.createElement('div');
        container.id = 'nemo-conflict-toast-root';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10003;';
        document.body.appendChild(container);

        if (conflictToastRoot) {
            conflictToastRoot.unmount();
        }

        conflictToastRoot = createRoot(container);

        const cleanup = (result: { action: 'resolve' | 'ignore' | 'cancel'; issue?: ConflictIssue }) => {
            if (conflictToastRoot) {
                conflictToastRoot.unmount();
                conflictToastRoot = null;
            }
            container.remove();
            resolve(result);
        };

        conflictToastRoot.render(
            <React.StrictMode>
                <ConflictToast
                    issues={issues}
                    title={options?.title}
                    onResolve={(issue) => cleanup({ action: 'resolve', issue })}
                    onIgnore={() => cleanup({ action: 'ignore' })}
                    onCancel={() => cleanup({ action: 'cancel' })}
                    onDismiss={() => cleanup({ action: 'cancel' })}
                />
            </React.StrictMode>
        );
    });
}

/**
 * Show the directive help modal
 */
export function showDirectiveHelp(): void {
    // Create container
    const container = document.createElement('div');
    container.id = 'nemo-help-modal-root';
    document.body.appendChild(container);

    if (helpModalRoot) {
        helpModalRoot.unmount();
    }

    helpModalRoot = createRoot(container);

    const cleanup = () => {
        if (helpModalRoot) {
            helpModalRoot.unmount();
            helpModalRoot = null;
        }
        container.remove();
    };

    helpModalRoot.render(
        <React.StrictMode>
            <HelpModal isOpen={true} onClose={cleanup} />
        </React.StrictMode>
    );
}

/**
 * Mount the directive autocomplete controller
 * This provides autocomplete suggestions in the prompt editor textarea
 */
export function mountDirectiveAutocomplete(
    textareaSelector: string = '#completion_prompt_manager_popup_entry_form_prompt'
): void {
    // Create container if needed
    let container = document.getElementById('nemo-autocomplete-root');
    if (!container) {
        container = document.createElement('div');
        container.id = 'nemo-autocomplete-root';
        document.body.appendChild(container);
    }

    if (autocompleteRoot) {
        autocompleteRoot.unmount();
    }

    autocompleteRoot = createRoot(container);

    autocompleteRoot.render(
        <React.StrictMode>
            <NemoProvider>
                <DirectiveAutocompleteController textareaSelector={textareaSelector} />
            </NemoProvider>
        </React.StrictMode>
    );

    console.log('[NemoPresetExt] React Directive Autocomplete mounted');
}

/**
 * Unmount the directive autocomplete controller
 */
export function unmountDirectiveAutocomplete(): void {
    if (autocompleteRoot) {
        autocompleteRoot.unmount();
        autocompleteRoot = null;
        const container = document.getElementById('nemo-autocomplete-root');
        if (container) {
            container.remove();
        }
        console.log('[NemoPresetExt] React Directive Autocomplete unmounted');
    }
}

// ============================================================
// View Components
// ============================================================
export { AccordionView } from './components/AccordionView';
export { TrayView } from './components/TrayView';
export { NavigatorView } from './components/navigator';
export { Section } from './components/Section';
export { PromptRow } from './components/PromptRow';
export { ToggleButton } from './components/ToggleButton';
export { ProgressBar } from './components/ProgressBar';

// ============================================================
// Common Components
// ============================================================
export { Toggle, Toast, Modal, Tabs } from './components/common';
export type { ToggleProps, ToggleSize } from './components/common/Toggle';
export type { ToastProps, ToastType, ToastAction } from './components/common/Toast';
export type { ModalProps, ModalSize } from './components/common/Modal';
export type { TabsProps, Tab } from './components/common/Tabs';

// ============================================================
// Settings Components
// ============================================================
export { SettingsPanel, FeatureToggles, RegexSettings } from './components/settings';

// ============================================================
// Directive Components
// ============================================================
export { ConflictToast, HelpModal, AutocompleteDropdown, DirectiveAutocompleteController } from './components/directives';
export type { ConflictToastProps } from './components/directives/ConflictToast';
export type { HelpModalProps } from './components/directives/HelpModal';
export type { AutocompleteDropdownProps, AutocompleteSuggestion } from './components/directives/AutocompleteDropdown';
export type { DirectiveAutocompleteControllerProps } from './components/directives/DirectiveAutocompleteController';

// ============================================================
// Onboarding Components
// ============================================================
export { VNDialog, Spotlight, TutorialProgress } from './components/onboarding';
export type { VNDialogProps, DialogStep } from './components/onboarding/VNDialog';
export type { SpotlightProps } from './components/onboarding/Spotlight';
export type { TutorialProgressProps } from './components/onboarding/TutorialProgress';

// ============================================================
// Context and Providers
// ============================================================
export { NemoProvider, useNemoSettings, useNemoSetting } from './context/NemoContext';
export type { NemoContextValue } from './context/NemoContext';

// ============================================================
// Hooks
// ============================================================
export { usePromptData } from './hooks/usePromptData';
export { useTogglePrompt } from './hooks/useTogglePrompt';
export { useSectionState } from './hooks/useSectionState';
export { useNavigatorState } from './hooks/useNavigatorState';
export { useFolderMetadata } from './hooks/useFolderMetadata';
export { useSTEvent, useSTEvents, useSTEventEmitter, ST_EVENTS, emitNemoEvent, onNemoEvent } from './hooks/useSTEvents';

// ============================================================
// Types
// ============================================================
export type { PromptData, SectionData, ViewMode } from './types/prompts';
export type {
    FolderMetadata,
    PromptMetadata,
    NavigatorMetadata,
    PathPart,
    NavigatorPrompt,
    GridItem,
    SortOption,
    FilterOption,
    NavigatorState,
    ContextMenuAction,
    ArchivedPrompt,
    ArchivedLibrary,
    HeaderInfo
} from './types/navigator';
export type { NemoSettings, DropdownStyle, SettingMetadata, SettingCategory } from './types/settings';
export { DEFAULT_SETTINGS, SETTINGS_METADATA, CATEGORY_LABELS, getSettingsByCategory } from './types/settings';
export type {
    ConflictSeverity,
    ConflictType,
    ConflictIssue,
    DirectiveMetadata,
    DirectiveDefinition,
    DirectiveCategory
} from './types/directives';
export { DIRECTIVE_CATEGORIES } from './types/directives';

// ============================================================
// Utilities
// ============================================================
export { stBridge } from './utils/stBridge';
export {
    getPromptManager,
    getAllPrompts,
    togglePrompt,
    getTokenCounts,
    getExtensionSettings,
    updateExtensionSettings,
    saveSettings,
    onEvent,
    showToast,
    showPopup,
    showConfirm,
    showInput,
    waitForElement,
} from './utils/stBridge';

// ============================================================
// Navigator wrapper for vanilla JS integration
// ============================================================
export { ReactPromptNavigator, createPromptNavigator } from './navigator-wrapper';

// ============================================================
// Cleanup function
// ============================================================
export function unmountAll(): void {
    unmountPromptView();
    unmountNavigatorView();
    unmountSettingsPanel();
    unmountUserSettingsTabs();
    unmountDirectiveAutocomplete();

    // Clean up dynamically created roots
    if (vnDialogRoot) {
        vnDialogRoot.unmount();
        vnDialogRoot = null;
    }
    if (conflictToastRoot) {
        conflictToastRoot.unmount();
        conflictToastRoot = null;
    }
    if (helpModalRoot) {
        helpModalRoot.unmount();
        helpModalRoot = null;
    }

    console.log('[NemoPresetExt] All React components unmounted');
}
