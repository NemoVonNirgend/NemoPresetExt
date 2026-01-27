/**
 * Progress bar component showing enabled/total ratio
 */

import React from 'react';
import type { SectionCounts } from '../types/prompts';

interface ProgressBarProps {
    counts: SectionCounts;
    showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ counts, showLabel = true }) => {
    const { enabled, total } = counts;
    const percentage = total > 0 ? (enabled / total) * 100 : 0;

    const statusClass =
        enabled === 0 ? 'none' :
        enabled === total ? 'full' :
        'partial';

    return (
        <div className="nemo-progress-wrapper">
            {showLabel && (
                <span className="nemo-progress-label">
                    ({enabled}/{total})
                </span>
            )}
            <div className="nemo-progress-bar">
                <div
                    className={`nemo-progress-fill ${statusClass}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};
