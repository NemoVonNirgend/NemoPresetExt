import React, { useRef, useEffect } from 'react';
import { useNemoStore, type PanelState } from '../../store';
import { usePanelDrag } from '../../hooks/usePanelDrag';
import { moveContentToPanel, returnContentToDrawer } from '../../utils/contentPortal';
import PanelHeader from './PanelHeader';

interface FloatingPanelProps extends PanelState {}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
    id,
    title,
    icon,
    isOpen,
    isMinimized,
    isMaximized,
    position,
    size,
    dockedTo,
    zIndex,
    contentType,
    drawerId
}) => {
    const { closePanel, minimizePanel, maximizePanel, restorePanel, bringToFront } = useNemoStore();
    const bodyRef = useRef<HTMLDivElement>(null);
    const { handleMouseDown } = usePanelDrag({ panelId: id });

    // Handle drawer content portaling
    useEffect(() => {
        if (isOpen && contentType === 'drawer' && drawerId && bodyRef.current) {
            moveContentToPanel(drawerId, bodyRef.current);
        }

        return () => {
            if (contentType === 'drawer' && drawerId) {
                returnContentToDrawer(drawerId);
            }
        };
    }, [isOpen, contentType, drawerId]);

    if (!isOpen) return null;

    // Calculate styles based on docked state
    const getStyles = (): React.CSSProperties => {
        if (isMaximized) {
            return {
                position: 'fixed',
                top: 60, // Below toolbar
                left: 0,
                right: 0,
                bottom: 0,
                width: 'auto',
                height: 'auto',
                zIndex,
                borderRadius: 0
            };
        }

        if (dockedTo) {
            const dockStyles: Record<string, React.CSSProperties> = {
                left: {
                    position: 'fixed',
                    top: 60,
                    left: 0,
                    bottom: 0,
                    width: 'var(--nemo-dock-width)',
                    height: 'auto',
                    borderRadius: '0 var(--nemo-panel-radius) var(--nemo-panel-radius) 0'
                },
                right: {
                    position: 'fixed',
                    top: 60,
                    right: 0,
                    bottom: 0,
                    width: 'var(--nemo-dock-width)',
                    height: 'auto',
                    borderRadius: 'var(--nemo-panel-radius) 0 0 var(--nemo-panel-radius)'
                },
                top: {
                    position: 'fixed',
                    top: 60,
                    left: 'var(--nemo-dock-width)',
                    right: 'var(--nemo-dock-width)',
                    height: '200px',
                    width: 'auto',
                    borderRadius: '0 0 var(--nemo-panel-radius) var(--nemo-panel-radius)'
                },
                bottom: {
                    position: 'fixed',
                    bottom: 0,
                    left: 'var(--nemo-dock-width)',
                    right: 'var(--nemo-dock-width)',
                    height: '200px',
                    width: 'auto',
                    borderRadius: 'var(--nemo-panel-radius) var(--nemo-panel-radius) 0 0'
                }
            };
            return { ...dockStyles[dockedTo], zIndex };
        }

        return {
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: size.width,
            height: isMinimized ? 'auto' : size.height,
            zIndex
        };
    };

    const handleHeaderMouseDown = (e: React.MouseEvent) => {
        if (!isMaximized && !dockedTo) {
            handleMouseDown(e, position);
        }
    };

    return (
        <div
            className={`nemo-floating-panel nemo-animate-scale-in ${isMinimized ? 'minimized' : ''}`}
            style={getStyles()}
            onClick={() => bringToFront(id)}
        >
            <PanelHeader
                title={title}
                icon={icon}
                isMinimized={isMinimized}
                isMaximized={isMaximized}
                isDocked={!!dockedTo}
                onMouseDown={handleHeaderMouseDown}
                onMinimize={() => isMinimized ? restorePanel(id) : minimizePanel(id)}
                onMaximize={() => isMaximized ? restorePanel(id) : maximizePanel(id)}
                onClose={() => closePanel(id)}
            />

            {!isMinimized && (
                <div className="nemo-panel-body" ref={bodyRef}>
                    {contentType === 'custom' && (
                        <div className="nemo-panel-placeholder">
                            <p>Panel content for: {id}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FloatingPanel;
