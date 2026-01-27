/**
 * Hook to read prompt data from SillyTavern's data model
 */

import { useState, useEffect, useCallback } from 'react';
import type { PromptData, SectionData, DividerInfo } from '../types/prompts';
import { onNemoEvent, ST_EVENTS } from './useSTEvents';
import { getPromptManager } from '../utils/stBridge';

// Divider patterns
const BUILT_IN_PATTERNS = ['=+', '\u2b50\u2500+', '\u2501+'];
const DIVIDER_REGEX = new RegExp(`^(${BUILT_IN_PATTERNS.join('|')})`);

/**
 * Parse divider info from prompt name
 */
function parseDividerInfo(name: string): DividerInfo {
    if (!name) {
        return { isDivider: false, isSubHeader: false, cleanName: name, originalText: name };
    }

    // Sub-header pattern: < text >
    const subHeaderMatch = /^<\s*(.+?)\s*>$/.exec(name);
    if (subHeaderMatch) {
        return {
            isDivider: true,
            isSubHeader: true,
            cleanName: subHeaderMatch[1].trim() || 'Sub-Section',
            originalText: name
        };
    }

    // Main header pattern
    const match = DIVIDER_REGEX.exec(name);
    if (match) {
        let cleanName = name.substring(match[0].length).trim();
        const suffixRegex = new RegExp(`\\s*(${match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*$`);
        cleanName = cleanName.replace(suffixRegex, '').trim() || 'Section';
        return {
            isDivider: true,
            isSubHeader: false,
            cleanName,
            originalText: name
        };
    }

    return { isDivider: false, isSubHeader: false, cleanName: name, originalText: name };
}

/**
 * Get all prompts from ST data model
 */
function getAllPrompts(): PromptData[] {
    const promptManager = getPromptManager();
    if (!promptManager?.serviceSettings?.prompts) {
        return [];
    }

    const prompts = promptManager.serviceSettings.prompts;
    const activeCharacter = promptManager.activeCharacter;

    return prompts.map((prompt: any) => {
        let enabled = false;
        try {
            const entry = promptManager.getPromptOrderEntry(activeCharacter, prompt.identifier);
            enabled = entry?.enabled ?? false;
        } catch {
            enabled = !promptManager.isPromptDisabledForActiveCharacter(prompt.identifier);
        }

        return {
            identifier: prompt.identifier,
            name: prompt.name,
            content: prompt.content || '',
            enabled,
            role: prompt.role,
            system_prompt: prompt.system_prompt
        };
    });
}

/**
 * Group prompts into sections
 */
function groupIntoSections(prompts: PromptData[]): SectionData[] {
    const sections: SectionData[] = [];
    let currentSection: SectionData | null = null;
    let currentSubSection: SectionData | null = null;
    const ungroupedPrompts: PromptData[] = [];

    for (const prompt of prompts) {
        const dividerInfo = parseDividerInfo(prompt.name);

        if (dividerInfo.isDivider) {
            if (dividerInfo.isSubHeader) {
                currentSubSection = {
                    id: `sub-${dividerInfo.originalText}`,
                    name: dividerInfo.cleanName,
                    originalText: dividerInfo.originalText,
                    isSubSection: true,
                    headerPrompt: prompt,
                    prompts: [],
                    subSections: []
                };
                if (currentSection) {
                    currentSection.subSections.push(currentSubSection);
                }
            } else {
                currentSection = {
                    id: `section-${dividerInfo.originalText}`,
                    name: dividerInfo.cleanName,
                    originalText: dividerInfo.originalText,
                    isSubSection: false,
                    headerPrompt: prompt,
                    prompts: [],
                    subSections: []
                };
                sections.push(currentSection);
                currentSubSection = null;
            }
        } else {
            if (currentSubSection) {
                currentSubSection.prompts.push(prompt);
            } else if (currentSection) {
                currentSection.prompts.push(prompt);
            } else {
                // Prompts before any section divider
                ungroupedPrompts.push(prompt);
            }
        }
    }

    // If there are ungrouped prompts, create a section for them at the beginning
    if (ungroupedPrompts.length > 0) {
        const ungroupedSection: SectionData = {
            id: 'section-ungrouped',
            name: 'Ungrouped Prompts',
            originalText: 'Ungrouped Prompts',
            isSubSection: false,
            headerPrompt: null,
            prompts: ungroupedPrompts,
            subSections: []
        };
        sections.unshift(ungroupedSection);
    }

    // If no sections at all but there are prompts, show them as "All Prompts"
    if (sections.length === 0 && prompts.length > 0) {
        const allPromptsSection: SectionData = {
            id: 'section-all',
            name: 'All Prompts',
            originalText: 'All Prompts',
            isSubSection: false,
            headerPrompt: null,
            prompts: prompts,
            subSections: []
        };
        sections.push(allPromptsSection);
    }

    return sections;
}

/**
 * Hook to get prompt data and sections
 */
export function usePromptData() {
    const [prompts, setPrompts] = useState<PromptData[]>([]);
    const [sections, setSections] = useState<SectionData[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(() => {
        const allPrompts = getAllPrompts();
        setPrompts(allPrompts);
        setSections(groupIntoSections(allPrompts));
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();

        // Listen for ST events
        const handleSettingsUpdate = () => {
            setTimeout(refresh, 100);
        };

        // @ts-ignore - ST global
        if (typeof eventSource !== 'undefined') {
            // @ts-ignore
            eventSource.on('SETTINGS_UPDATED', handleSettingsUpdate);
            // @ts-ignore
            eventSource.on('OAI_PRESET_CHANGED_AFTER', handleSettingsUpdate);
        }

        // Listen for custom Nemo events (from vanilla JS)
        const cleanupPromptToggled = onNemoEvent(ST_EVENTS.NEMO_PROMPT_TOGGLED, () => {
            setTimeout(refresh, 50);
        });
        const cleanupPromptsRefreshed = onNemoEvent(ST_EVENTS.NEMO_PROMPTS_REFRESHED, () => {
            refresh();
        });

        return () => {
            // @ts-ignore
            if (typeof eventSource !== 'undefined') {
                // @ts-ignore
                eventSource.off('SETTINGS_UPDATED', handleSettingsUpdate);
                // @ts-ignore
                eventSource.off('OAI_PRESET_CHANGED_AFTER', handleSettingsUpdate);
            }
            // Clean up Nemo event listeners
            cleanupPromptToggled();
            cleanupPromptsRefreshed();
        };
    }, [refresh]);

    return { prompts, sections, loading, refresh };
}

export { parseDividerInfo, getAllPrompts, groupIntoSections };
