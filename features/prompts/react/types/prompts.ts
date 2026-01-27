/**
 * Type definitions for the prompt manager
 */

export interface PromptData {
    identifier: string;
    name: string;
    content: string;
    enabled: boolean;
    role?: string;
    system_prompt?: boolean;
}

export interface DividerInfo {
    isDivider: boolean;
    isSubHeader: boolean;
    cleanName: string;
    originalText: string;
}

export interface SectionData {
    id: string;
    name: string;
    originalText: string;
    isSubSection: boolean;
    headerPrompt: PromptData | null;
    prompts: PromptData[];
    subSections: SectionData[];
}

export interface SectionCounts {
    enabled: number;
    total: number;
}

export interface PromptTooltip {
    text: string;
    source: 'directive' | 'comment' | 'builtin';
}

export type ViewMode = 'accordion' | 'tray' | 'flat';

export interface ViewState {
    mode: ViewMode;
    openSections: Record<string, boolean>;
    activeTray: string | null;
    searchTerm: string;
}

// ST API types (what we get from SillyTavern)
export interface STPromptManager {
    serviceSettings: {
        prompts: STPrompt[];
    };
    activeCharacter: string;
    getPromptOrderEntry: (character: string, identifier: string) => STPromptOrderEntry | null;
    isPromptDisabledForActiveCharacter: (identifier: string) => boolean;
    saveServiceSettings: () => Promise<void>;
    tokenHandler?: {
        getCounts: () => Record<string, number | null>;
    };
}

export interface STPrompt {
    identifier: string;
    name: string;
    content: string;
    role?: string;
    system_prompt?: boolean;
}

export interface STPromptOrderEntry {
    enabled: boolean;
}
