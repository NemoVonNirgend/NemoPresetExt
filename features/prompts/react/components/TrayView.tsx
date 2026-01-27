/**
 * Tray/Panel View component
 * Shows sections as folders that open trays with prompt cards
 */

import React, { useState, useCallback, useMemo } from 'react';
import { usePromptData } from '../hooks/usePromptData';
import { useTogglePrompt } from '../hooks/useTogglePrompt';
import { ProgressBar } from './ProgressBar';
import { ToggleButton } from './ToggleButton';
import type { SectionData, PromptData, SectionCounts } from '../types/prompts';

interface TrayViewProps {
    getTooltip?: (prompt: { name: string; content: string }) => string | undefined;
    onSwitchView?: (mode: 'accordion' | 'tray') => void;
    currentView?: 'accordion' | 'tray';
}

// Prompt card in tray
const PromptCard: React.FC<{
    prompt: PromptData;
    onToggle: (id: string, enabled: boolean) => void;
    tooltip?: string;
}> = ({ prompt, onToggle, tooltip }) => {
    return (
        <div
            className={`nemo-tray-card ${prompt.enabled ? 'enabled' : ''}`}
            data-identifier={prompt.identifier}
            title={tooltip}
        >
            <ToggleButton
                enabled={prompt.enabled}
                onToggle={() => onToggle(prompt.identifier, !prompt.enabled)}
                size="small"
            />
            <span className="nemo-tray-card-name">{prompt.name}</span>
            {prompt.enabled && <span className="nemo-tray-card-check">&#10003;</span>}
        </div>
    );
};

// Section folder
const SectionFolder: React.FC<{
    section: SectionData;
    isActive: boolean;
    onOpen: () => void;
    counts: SectionCounts;
}> = ({ section, isActive, onOpen, counts }) => {
    return (
        <div
            className={`nemo-tray-folder ${isActive ? 'active' : ''}`}
            onClick={onOpen}
        >
            <span className="nemo-tray-folder-icon">&#128193;</span>
            <span className="nemo-tray-folder-name">{section.name}</span>
            <ProgressBar counts={counts} />
        </div>
    );
};

// Tray popup
const TrayPopup: React.FC<{
    section: SectionData;
    onClose: () => void;
    onToggle: (id: string, enabled: boolean) => void;
    onToggleAll: (ids: string[], enabled: boolean) => void;
    getTooltip?: (prompt: { name: string; content: string }) => string | undefined;
}> = ({ section, onClose, onToggle, onToggleAll, getTooltip }) => {
    // Get all prompts including sub-sections
    const allPrompts = useMemo(() => {
        const prompts = [...section.prompts];
        for (const sub of section.subSections) {
            prompts.push(...sub.prompts);
        }
        return prompts;
    }, [section]);

    const enabledCount = allPrompts.filter(p => p.enabled).length;
    const allEnabled = enabledCount === allPrompts.length;

    const handleToggleAll = () => {
        const ids = allPrompts.map(p => p.identifier);
        onToggleAll(ids, !allEnabled);
    };

    return (
        <div className="nemo-tray-popup">
            <div className="nemo-tray-header">
                <span className="nemo-tray-title">{section.name}</span>
                <div className="nemo-tray-actions">
                    <button
                        className="nemo-tray-toggle-all"
                        onClick={handleToggleAll}
                        title={allEnabled ? 'Disable all' : 'Enable all'}
                    >
                        {allEnabled ? '\u25FB None' : '\u2611 All'}
                    </button>
                    <button className="nemo-tray-close" onClick={onClose}>&#10005;</button>
                </div>
            </div>
            <div className="nemo-tray-content">
                {section.prompts.map(prompt => (
                    <PromptCard
                        key={prompt.identifier}
                        prompt={prompt}
                        onToggle={onToggle}
                        tooltip={getTooltip?.(prompt)}
                    />
                ))}
                {section.subSections.map(sub => (
                    <div key={sub.id} className="nemo-tray-subsection">
                        <div className="nemo-tray-subsection-header">{sub.name}</div>
                        {sub.prompts.map(prompt => (
                            <PromptCard
                                key={prompt.identifier}
                                prompt={prompt}
                                onToggle={onToggle}
                                tooltip={getTooltip?.(prompt)}
                            />
                        ))}
                    </div>
                ))}
            </div>
            <div className="nemo-tray-footer">
                <span className="nemo-tray-count">
                    {enabledCount} of {allPrompts.length} enabled
                </span>
            </div>
        </div>
    );
};

export const TrayView: React.FC<TrayViewProps> = ({
    getTooltip,
    onSwitchView,
    currentView = 'tray'
}) => {
    const { sections, loading, refresh } = usePromptData();
    const { toggle, toggleAll } = useTogglePrompt();
    const [activeTray, setActiveTray] = useState<string | null>(null);

    const handleSwitchToAccordion = useCallback(() => {
        if (onSwitchView) {
            onSwitchView('accordion');
        }
    }, [onSwitchView]);

    const handleToggle = useCallback(async (id: string, enabled: boolean) => {
        await toggle(id, enabled);
        setTimeout(refresh, 50);
    }, [toggle, refresh]);

    const handleToggleAll = useCallback(async (ids: string[], enabled: boolean) => {
        await toggleAll(ids, enabled);
        setTimeout(refresh, 50);
    }, [toggleAll, refresh]);

    const getSectionCounts = useCallback((section: SectionData): SectionCounts => {
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
    }, []);

    const activeSection = sections.find(s => s.id === activeTray);

    if (loading) {
        return <div className="nemo-tray-loading">Loading prompts...</div>;
    }

    if (sections.length === 0) {
        return (
            <div className="nemo-tray-view nemo-tray-empty">
                <div className="nemo-tray-message">
                    <p>No prompts found.</p>
                    <p style={{ fontSize: '0.85em', opacity: 0.7 }}>
                        Make sure you have prompts configured in your preset.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="nemo-tray-view">
            {onSwitchView && (
                <div className="nemo-accordion-toolbar">
                    <div className="nemo-accordion-toolbar-left">
                        {/* Tray view doesn't need expand/collapse */}
                    </div>
                    <div className="nemo-accordion-toolbar-right">
                        <button
                            className="nemo-toolbar-btn nemo-view-switch-btn"
                            onClick={handleSwitchToAccordion}
                            title="Switch to accordion view"
                        >
                            <i className="fa-solid fa-bars"></i>
                        </button>
                    </div>
                </div>
            )}
            <div className="nemo-tray-folders">
                {sections.map(section => (
                    <SectionFolder
                        key={section.id}
                        section={section}
                        isActive={activeTray === section.id}
                        onOpen={() => setActiveTray(activeTray === section.id ? null : section.id)}
                        counts={getSectionCounts(section)}
                    />
                ))}
            </div>
            {activeSection && (
                <TrayPopup
                    section={activeSection}
                    onClose={() => setActiveTray(null)}
                    onToggle={handleToggle}
                    onToggleAll={handleToggleAll}
                    getTooltip={getTooltip}
                />
            )}
        </div>
    );
};
