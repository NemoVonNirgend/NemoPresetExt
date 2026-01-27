/**
 * Collapsible section component
 */

import React, { useMemo, useCallback } from 'react';
import type { SectionData, SectionCounts } from '../types/prompts';
import { PromptRow } from './PromptRow';
import { ProgressBar } from './ProgressBar';

interface SectionProps {
    section: SectionData;
    isOpen: boolean;
    onToggleSection: () => void;
    onTogglePrompt: (identifier: string, enabled: boolean) => void;
    onEditPrompt?: (identifier: string) => void;
    getTooltip?: (prompt: { name: string; content: string }) => string | undefined;
    // For sub-sections to get their own state
    getSectionOpen?: (key: string) => boolean;
    onToggleSectionByKey?: (key: string) => void;
}

export const Section: React.FC<SectionProps> = ({
    section,
    isOpen,
    onToggleSection,
    onTogglePrompt,
    onEditPrompt,
    getTooltip,
    getSectionOpen,
    onToggleSectionByKey
}) => {
    // Calculate counts including sub-sections
    const counts = useMemo((): SectionCounts => {
        let enabled = 0;
        let total = 0;

        for (const p of section.prompts) {
            total++;
            if (p.enabled) enabled++;
        }

        for (const sub of section.subSections) {
            for (const p of sub.prompts) {
                total++;
                if (p.enabled) enabled++;
            }
        }

        return { enabled, total };
    }, [section.prompts, section.subSections]);

    const handleSummaryClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        onToggleSection();
    }, [onToggleSection]);

    // Extract emoji from section name if present
    const { emoji, nameText } = useMemo(() => {
        const name = section.name;
        // Check if name starts with an emoji (common emoji patterns)
        const emojiMatch = name.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{200D}]|[\u{FE0F}]|[⚙️⚡✨🎭📜📏👤🔪💀🧊💥🌠⛓️🎨🌍🧩🧪🚫📣🎲🗣️⏳🔄🩸🧠🎒⚔️😱📖🌸🤫💢🦇♠️📚🔥🍭🐦💦🤪📢🎉]+)\s*/u);

        if (emojiMatch) {
            return {
                emoji: emojiMatch[1].trim(),
                nameText: name.substring(emojiMatch[0].length).trim() || name
            };
        }
        return { emoji: null, nameText: name };
    }, [section.name]);

    return (
        <details
            className={`nemo-section ${section.isSubSection ? 'sub-section' : 'main-section'}`}
            open={isOpen}
            data-section-id={section.id}
        >
            <summary onClick={handleSummaryClick}>
                <div className="nemo-section-header">
                    <span className="nemo-section-arrow">▶</span>
                    <span className="nemo-section-name">
                        {emoji && <span className="nemo-section-emoji">{emoji}</span>}
                        <span className="nemo-section-name-text">{nameText}</span>
                    </span>
                    <ProgressBar counts={counts} />
                </div>
            </summary>
            <div className="nemo-section-content">
                {section.prompts.map(prompt => (
                    <PromptRow
                        key={prompt.identifier}
                        prompt={prompt}
                        onToggle={onTogglePrompt}
                        onEdit={onEditPrompt}
                        tooltip={getTooltip?.(prompt)}
                    />
                ))}
                {section.subSections.map(subSection => (
                    <Section
                        key={subSection.id}
                        section={subSection}
                        isOpen={getSectionOpen ? getSectionOpen(subSection.originalText) : isOpen}
                        onToggleSection={onToggleSectionByKey ? () => onToggleSectionByKey(subSection.originalText) : onToggleSection}
                        onTogglePrompt={onTogglePrompt}
                        onEditPrompt={onEditPrompt}
                        getTooltip={getTooltip}
                        getSectionOpen={getSectionOpen}
                        onToggleSectionByKey={onToggleSectionByKey}
                    />
                ))}
            </div>
        </details>
    );
};
