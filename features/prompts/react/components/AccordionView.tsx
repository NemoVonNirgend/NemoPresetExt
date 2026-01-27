/**
 * Main Accordion View component
 * Data-driven accordion that reads from ST's data model
 */

import React, { useCallback } from 'react';
import { usePromptData } from '../hooks/usePromptData';
import { useTogglePrompt } from '../hooks/useTogglePrompt';
import { useSectionState } from '../hooks/useSectionState';
import { Section } from './Section';

interface AccordionViewProps {
    getTooltip?: (prompt: { name: string; content: string }) => string | undefined;
    onEditPrompt?: (identifier: string) => void;
    onSwitchView?: (mode: 'accordion' | 'tray') => void;
    currentView?: 'accordion' | 'tray';
}

export const AccordionView: React.FC<AccordionViewProps> = ({
    getTooltip,
    onEditPrompt,
    onSwitchView,
    currentView = 'accordion'
}) => {
    const { sections, loading, refresh } = usePromptData();
    const { toggle } = useTogglePrompt();
    const { isOpen, toggleSection, openAll, closeAll } = useSectionState();

    const handleTogglePrompt = useCallback(async (identifier: string, enabled: boolean) => {
        await toggle(identifier, enabled);
        // Refresh to get updated state
        setTimeout(refresh, 50);
    }, [toggle, refresh]);

    const handleEditPrompt = useCallback((identifier: string) => {
        if (onEditPrompt) {
            onEditPrompt(identifier);
        } else {
            // Default: find ST's element and click it
            const stElement = document.querySelector(
                `li[data-pm-identifier="${identifier}"] .prompt-manager-inspect-action`
            ) as HTMLElement;
            stElement?.click();
        }
    }, [onEditPrompt]);

    const handleExpandAll = useCallback(() => {
        const allKeys = sections.flatMap(s => [
            s.originalText,
            ...s.subSections.map(sub => sub.originalText)
        ]);
        openAll(allKeys);
    }, [sections, openAll]);

    const handleCollapseAll = useCallback(() => {
        const allKeys = sections.flatMap(s => [
            s.originalText,
            ...s.subSections.map(sub => sub.originalText)
        ]);
        closeAll(allKeys);
    }, [sections, closeAll]);

    const handleSwitchToTray = useCallback(() => {
        if (onSwitchView) {
            onSwitchView('tray');
        }
    }, [onSwitchView]);

    if (loading) {
        return <div className="nemo-accordion-loading">Loading prompts...</div>;
    }

    if (sections.length === 0) {
        return <div className="nemo-accordion-empty">No sections found</div>;
    }

    return (
        <div className="nemo-accordion-view">
            <div className="nemo-accordion-toolbar">
                <div className="nemo-accordion-toolbar-left">
                    <button
                        className="nemo-toolbar-btn"
                        onClick={handleExpandAll}
                        title="Expand all sections"
                    >
                        <i className="fa-solid fa-angles-down"></i>
                    </button>
                    <button
                        className="nemo-toolbar-btn"
                        onClick={handleCollapseAll}
                        title="Collapse all sections"
                    >
                        <i className="fa-solid fa-angles-up"></i>
                    </button>
                </div>
                {onSwitchView && (
                    <div className="nemo-accordion-toolbar-right">
                        <button
                            className="nemo-toolbar-btn nemo-view-switch-btn"
                            onClick={handleSwitchToTray}
                            title="Switch to tray view"
                        >
                            <i className="fa-solid fa-grip"></i>
                        </button>
                    </div>
                )}
            </div>
            {sections.map(section => (
                <Section
                    key={section.id}
                    section={section}
                    isOpen={isOpen(section.originalText)}
                    onToggleSection={() => toggleSection(section.originalText)}
                    onTogglePrompt={handleTogglePrompt}
                    onEditPrompt={handleEditPrompt}
                    getTooltip={getTooltip}
                    getSectionOpen={isOpen}
                    onToggleSectionByKey={toggleSection}
                />
            ))}
        </div>
    );
};
