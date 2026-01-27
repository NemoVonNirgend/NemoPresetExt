/**
 * Single prompt row component
 */

import React, { useCallback, useMemo } from 'react';
import type { PromptData } from '../types/prompts';
import { ToggleButton } from './ToggleButton';
import { getTokenCounts } from '../utils/stBridge';

interface PromptRowProps {
    prompt: PromptData;
    onToggle: (identifier: string, enabled: boolean) => void;
    onEdit?: (identifier: string) => void;
    tooltip?: string;
    showTokens?: boolean;
}

export const PromptRow: React.FC<PromptRowProps> = ({
    prompt,
    onToggle,
    onEdit,
    tooltip,
    showTokens = true
}) => {
    const handleToggle = useCallback(() => {
        onToggle(prompt.identifier, !prompt.enabled);
    }, [prompt.identifier, prompt.enabled, onToggle]);

    const handleNameClick = useCallback(() => {
        if (onEdit) {
            onEdit(prompt.identifier);
        }
    }, [prompt.identifier, onEdit]);

    // Get token count for this prompt
    const tokenCount = useMemo(() => {
        if (!showTokens) return null;
        const counts = getTokenCounts();
        return counts[prompt.identifier] ?? null;
    }, [prompt.identifier, showTokens]);

    // Format token count
    const tokenDisplay = useMemo(() => {
        if (tokenCount === null || tokenCount === undefined) return null;
        if (tokenCount >= 1000) {
            return `${(tokenCount / 1000).toFixed(1)}k`;
        }
        return tokenCount.toString();
    }, [tokenCount]);

    return (
        <div
            className={`nemo-prompt-row ${prompt.enabled ? 'enabled' : 'disabled'}`}
            data-identifier={prompt.identifier}
        >
            <ToggleButton enabled={prompt.enabled} onToggle={handleToggle} size="small" />
            <span
                className={`nemo-prompt-name ${tooltip ? 'has-tooltip' : ''}`}
                onClick={handleNameClick}
                title={tooltip}
            >
                {prompt.name}
            </span>
            {tokenDisplay && (
                <span className="nemo-prompt-tokens">{tokenDisplay}</span>
            )}
            {onEdit && (
                <button
                    className="nemo-prompt-edit-btn"
                    onClick={handleNameClick}
                    title="Edit prompt"
                >
                    <i className="fa-solid fa-pen-to-square"></i>
                </button>
            )}
        </div>
    );
};
