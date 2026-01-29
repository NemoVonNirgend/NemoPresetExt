import React from 'react';
import { useNemoStore, type DockZone as DockZoneType } from '../../store';

interface DockZoneProps {
    zone: DockZoneType;
    panels: string[];
}

const DockZone: React.FC<DockZoneProps> = ({ zone, panels }) => {
    const { isDragging, activeDockZone } = useNemoStore();

    const isActive = isDragging && activeDockZone === zone;

    if (!isDragging) return null;

    return (
        <div
            className={`nemo-dock-zone ${zone} ${isActive ? 'active' : ''}`}
            data-zone={zone}
        >
            {isActive && (
                <div className="nemo-dock-zone-indicator">
                    <i className="fa-solid fa-arrows-to-dot" />
                    <span>Drop to dock {zone}</span>
                </div>
            )}
        </div>
    );
};

export default DockZone;
