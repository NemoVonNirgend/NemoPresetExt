import { useCallback, useRef, useEffect } from 'react';
import { useNemoStore, type Position, type DockZone } from '../store';

interface UsePanelDragOptions {
    panelId: string;
    onDragStart?: () => void;
    onDragEnd?: (position: Position) => void;
}

export function usePanelDrag({ panelId, onDragStart, onDragEnd }: UsePanelDragOptions) {
    const { updatePanelPosition, setIsDragging, setActiveDockZone, dockPanel, bringToFront } = useNemoStore();
    const dragRef = useRef<{
        startX: number;
        startY: number;
        startPosX: number;
        startPosY: number;
    } | null>(null);

    const checkDockZone = useCallback((x: number, y: number): DockZone | null => {
        const threshold = 50;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (x < threshold) return 'left';
        if (x > viewportWidth - threshold) return 'right';
        if (y < threshold + 52) return 'top'; // 52px for toolbar
        if (y > viewportHeight - threshold) return 'bottom';

        return null;
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent, currentPosition: Position) => {
        if ((e.target as HTMLElement).closest('.nemo-panel-control')) {
            return; // Don't drag when clicking controls
        }

        e.preventDefault();
        bringToFront(panelId);

        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: currentPosition.x,
            startPosY: currentPosition.y
        };

        setIsDragging(true);
        onDragStart?.();
    }, [panelId, bringToFront, setIsDragging, onDragStart]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragRef.current) return;

        const deltaX = e.clientX - dragRef.current.startX;
        const deltaY = e.clientY - dragRef.current.startY;

        const newPosition = {
            x: dragRef.current.startPosX + deltaX,
            y: dragRef.current.startPosY + deltaY
        };

        updatePanelPosition(panelId, newPosition);

        // Check for dock zones
        const dockZone = checkDockZone(e.clientX, e.clientY);
        setActiveDockZone(dockZone);
    }, [panelId, updatePanelPosition, checkDockZone, setActiveDockZone]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!dragRef.current) return;

        const dockZone = checkDockZone(e.clientX, e.clientY);

        if (dockZone) {
            dockPanel(panelId, dockZone);
        }

        const finalPosition = {
            x: dragRef.current.startPosX + (e.clientX - dragRef.current.startX),
            y: dragRef.current.startPosY + (e.clientY - dragRef.current.startY)
        };

        onDragEnd?.(finalPosition);

        dragRef.current = null;
        setIsDragging(false);
        setActiveDockZone(null);
    }, [panelId, checkDockZone, dockPanel, setIsDragging, setActiveDockZone, onDragEnd]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    return { handleMouseDown };
}

export default usePanelDrag;
