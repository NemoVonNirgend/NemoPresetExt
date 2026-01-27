/**
 * Breadcrumbs component for folder navigation
 */
import React from 'react';
import type { PathPart } from '../../types/navigator';

interface BreadcrumbsProps {
    path: PathPart[];
    onNavigate: (index: number) => void;
}

export function Breadcrumbs({ path, onNavigate }: BreadcrumbsProps) {
    return (
        <div className="navigator-breadcrumbs">
            {path.map((part, index) => (
                <React.Fragment key={part.id}>
                    <span
                        className={index < path.length - 1 ? 'link' : ''}
                        onClick={() => index < path.length - 1 && onNavigate(index)}
                    >
                        {part.name}
                    </span>
                    {index < path.length - 1 && <span className="separator"> / </span>}
                </React.Fragment>
            ))}
        </div>
    );
}
