/**
 * Settings type definitions for NemoPresetExt
 */

export type DropdownStyle = 'tray' | 'accordion';

/**
 * All settings for the NemoPresetExt extension
 */
export interface NemoSettings {
    // Core Features
    enablePromptManager: boolean;
    dropdownStyle: DropdownStyle;
    enablePresetNavigator: boolean;

    // Directive System
    enableDirectives: boolean;
    enableDirectiveAutocomplete: boolean;

    // Visual Features
    enableAnimatedBackgrounds: boolean;
    enableMobileEnhancements: boolean;
    nemoEnableWidePanels: boolean;

    // UI Overhauls
    enableTabOverhauls: boolean;
    enableLorebookOverhaul: boolean;
    nemoEnableExtensionsTabOverhaul: boolean;

    // Sections in Prompt Manager
    enableReasoningSection: boolean;
    enableLorebookManagement: boolean;

    // HTML Trimming (Context Reduction)
    enableHTMLTrimming: boolean;
    htmlTrimmingKeepCount: number;

    // Experimental Features
    nemoEnablePollinationsInterceptor: boolean;

    // Regex Configuration
    dividerRegexPattern: string;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: NemoSettings = {
    // Core Features
    enablePromptManager: true,
    dropdownStyle: 'tray',
    enablePresetNavigator: true,

    // Directive System
    enableDirectives: true,
    enableDirectiveAutocomplete: true,

    // Visual Features
    enableAnimatedBackgrounds: true,
    enableMobileEnhancements: true,
    nemoEnableWidePanels: true,

    // UI Overhauls
    enableTabOverhauls: true,
    enableLorebookOverhaul: true,
    nemoEnableExtensionsTabOverhaul: true,

    // Sections
    enableReasoningSection: true,
    enableLorebookManagement: true,

    // HTML Trimming
    enableHTMLTrimming: false,
    htmlTrimmingKeepCount: 4,

    // Experimental
    nemoEnablePollinationsInterceptor: false,

    // Regex
    dividerRegexPattern: '',
};

/**
 * Setting metadata for UI rendering
 */
export interface SettingMetadata {
    key: keyof NemoSettings;
    label: string;
    description: string;
    category: SettingCategory;
    requiresRefresh?: boolean;
}

export type SettingCategory =
    | 'core'
    | 'directives'
    | 'visual'
    | 'ui-overhauls'
    | 'sections'
    | 'performance'
    | 'experimental';

/**
 * Settings grouped by category
 */
export const SETTINGS_METADATA: SettingMetadata[] = [
    // Core
    { key: 'enablePromptManager', label: 'Prompt Manager', description: 'Enable the enhanced prompt manager with sections', category: 'core', requiresRefresh: true },
    { key: 'dropdownStyle', label: 'Dropdown Style', description: 'Choose between tray or accordion view', category: 'core' },
    { key: 'enablePresetNavigator', label: 'Preset Navigator', description: 'Enable the preset browser/navigator', category: 'core', requiresRefresh: true },

    // Directives
    { key: 'enableDirectives', label: 'Directives System', description: 'Enable processing of @directives in prompts', category: 'directives', requiresRefresh: true },
    { key: 'enableDirectiveAutocomplete', label: 'Directive Autocomplete', description: 'Show autocomplete suggestions when typing directives', category: 'directives', requiresRefresh: true },

    // Visual
    { key: 'enableAnimatedBackgrounds', label: 'Animated Backgrounds', description: 'Enable animated background effects', category: 'visual', requiresRefresh: true },
    { key: 'enableMobileEnhancements', label: 'Mobile Enhancements', description: 'Improved touch targets and mobile UI', category: 'visual' },
    { key: 'nemoEnableWidePanels', label: 'Wide Panels', description: 'Make side panels wider (50% screen width)', category: 'visual', requiresRefresh: true },

    // UI Overhauls
    { key: 'enableTabOverhauls', label: 'Tab Overhauls', description: 'Enhanced user settings tabs', category: 'ui-overhauls', requiresRefresh: true },
    { key: 'enableLorebookOverhaul', label: 'Lorebook Overhaul', description: 'Enhanced lorebook/world info UI', category: 'ui-overhauls', requiresRefresh: true },
    { key: 'nemoEnableExtensionsTabOverhaul', label: 'Extensions Tab Overhaul', description: 'Enhanced extensions settings tab', category: 'ui-overhauls', requiresRefresh: true },

    // Sections
    { key: 'enableReasoningSection', label: 'Reasoning Section', description: 'Show reasoning/thinking section in prompt manager', category: 'sections' },
    { key: 'enableLorebookManagement', label: 'Lorebook Management', description: 'Show lorebook management in prompt manager', category: 'sections' },

    // Performance
    { key: 'enableHTMLTrimming', label: 'HTML Trimming', description: 'Auto-trim HTML in old messages to save context', category: 'performance' },
    { key: 'htmlTrimmingKeepCount', label: 'Messages to Keep', description: 'Number of recent messages to preserve HTML in', category: 'performance' },

    // Experimental
    { key: 'nemoEnablePollinationsInterceptor', label: 'Pollinations Interceptor', description: 'Experimental: Regenerate Pollinations AI images', category: 'experimental' },
    { key: 'dividerRegexPattern', label: 'Custom Divider Pattern', description: 'Custom regex patterns for section dividers (comma-separated)', category: 'experimental' },
];

/**
 * Get settings grouped by category
 */
export function getSettingsByCategory(): Record<SettingCategory, SettingMetadata[]> {
    return SETTINGS_METADATA.reduce((acc, setting) => {
        if (!acc[setting.category]) {
            acc[setting.category] = [];
        }
        acc[setting.category].push(setting);
        return acc;
    }, {} as Record<SettingCategory, SettingMetadata[]>);
}

/**
 * Category display names
 */
export const CATEGORY_LABELS: Record<SettingCategory, string> = {
    'core': 'Core Features',
    'directives': 'Directive System',
    'visual': 'Visual & UI',
    'ui-overhauls': 'UI Overhauls',
    'sections': 'Prompt Manager Sections',
    'performance': 'Performance',
    'experimental': 'Experimental'
};
