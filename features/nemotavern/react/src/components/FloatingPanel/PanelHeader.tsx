import React from 'react';

interface PanelHeaderProps {
    title: string;
    icon?: string;
    isMinimized: boolean;
    isMaximized: boolean;
    isDocked: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onMinimize: () => void;
    onMaximize: () => void;
    onClose: () => void;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({
    title,
    icon,
    isMinimized,
    isMaximized,
    isDocked,
    onMouseDown,
    onMinimize,
    onMaximize,
    onClose
}) => {
    return (
        <div
            className="nemo-panel-header"
            onMouseDown={onMouseDown}
        >
            {icon && (
                <span className="nemo-panel-icon">
                    <i className={`fa-solid ${icon}`} />
                </span>
            )}

            <span className="nemo-panel-title">{title}</span>

            <div className="nemo-panel-controls">
                <button
                    className="nemo-panel-control minimize"
                    onClick={(e) => { e.stopPropagation(); onMinimize(); }}
                    title={isMinimized ? 'Restore' : 'Minimize'}
                    aria-label={isMinimized ? 'Restore panel' : 'Minimize panel'}
                >
                    <i className={`fa-solid ${isMinimized ? 'fa-window-restore' : 'fa-minus'}`} />
                </button>

                <button
                    className="nemo-panel-control maximize"
                    onClick={(e) => { e.stopPropagation(); onMaximize(); }}
                    title={isMaximized ? 'Restore' : 'Maximize'}
                    aria-label={isMaximized ? 'Restore panel' : 'Maximize panel'}
                >
                    <i className={`fa-solid ${isMaximized ? 'fa-window-restore' : 'fa-expand'}`} />
                </button>

                <button
                    className="nemo-panel-control close"
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    title="Close"
                    aria-label="Close panel"
                >
                    <i className="fa-solid fa-xmark" />
                </button>
            </div>
        </div>
    );
};

export default PanelHeader;
