import React, { useEffect } from 'react';
import { useNemoStore } from '../../store';

interface NemoLayoutProps {
    children: React.ReactNode;
}

const NemoLayout: React.FC<NemoLayoutProps> = ({ children }) => {
    const { activeView, dockZones } = useNemoStore();

    // Calculate main content margins based on docked panels
    const getMainContentStyles = (): React.CSSProperties => {
        const styles: React.CSSProperties = {
            marginTop: 52, // Toolbar height
        };

        if (dockZones.left.length > 0) {
            styles.marginLeft = 'var(--nemo-dock-width)';
        }

        if (dockZones.right.length > 0) {
            styles.marginRight = 'var(--nemo-dock-width)';
        }

        return styles;
    };

    // Apply view mode classes
    useEffect(() => {
        document.body.classList.remove('nemo-view-default', 'nemo-view-compact', 'nemo-view-wide');
        document.body.classList.add(`nemo-view-${activeView}`);

        return () => {
            document.body.classList.remove('nemo-view-default', 'nemo-view-compact', 'nemo-view-wide');
        };
    }, [activeView]);

    return (
        <div className="nemo-layout" style={getMainContentStyles()}>
            {children}
        </div>
    );
};

export default NemoLayout;
