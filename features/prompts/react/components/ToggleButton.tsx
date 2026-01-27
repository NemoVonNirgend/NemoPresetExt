/**
 * Toggle button component for enabling/disabling prompts
 */

import React from 'react';

interface ToggleButtonProps {
    enabled: boolean;
    onToggle: () => void;
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
    enabled,
    onToggle,
    size = 'medium',
    disabled = false
}) => {
    const sizeClass = {
        small: 'nemo-toggle-sm',
        medium: 'nemo-toggle-md',
        large: 'nemo-toggle-lg'
    }[size];

    return (
        <button
            className={`nemo-toggle-btn ${enabled ? 'on' : 'off'} ${sizeClass}`}
            onClick={(e) => {
                e.stopPropagation();
                if (!disabled) onToggle();
            }}
            disabled={disabled}
            title={enabled ? 'Click to disable' : 'Click to enable'}
            aria-pressed={enabled}
        >
            <i className={`fa-solid fa-toggle-${enabled ? 'on' : 'off'}`} />
        </button>
    );
};
