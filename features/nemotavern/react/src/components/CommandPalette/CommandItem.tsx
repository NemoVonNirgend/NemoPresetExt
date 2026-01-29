import React from 'react';
import type { Command } from '../../store';

interface CommandItemProps {
    command: Command;
    isActive: boolean;
    onClick: () => void;
    onHover: () => void;
}

const CommandItem: React.FC<CommandItemProps> = ({
    command,
    isActive,
    onClick,
    onHover
}) => {
    return (
        <div
            className={`nemo-command-item ${isActive ? 'active' : ''}`}
            onClick={onClick}
            onMouseEnter={onHover}
            role="option"
            aria-selected={isActive}
        >
            {command.icon && (
                <span className="nemo-command-item-icon">
                    <i className={`fa-solid ${command.icon}`} />
                </span>
            )}

            <span className="nemo-command-item-label">{command.label}</span>

            {command.shortcut && (
                <span className="nemo-command-item-shortcut">{command.shortcut}</span>
            )}
        </div>
    );
};

export default CommandItem;
