/**
 * TutorialProgress - Progress bar and step indicators for tutorials
 */

import React from 'react';

export interface TutorialProgressProps {
    /** Current step index (0-based) */
    currentStep: number;
    /** Total number of steps */
    totalSteps: number;
    /** Tutorial title */
    title?: string;
    /** Show step numbers instead of dots */
    showNumbers?: boolean;
    /** Compact mode (just progress bar) */
    compact?: boolean;
}

export function TutorialProgress({
    currentStep,
    totalSteps,
    title,
    showNumbers = false,
    compact = false,
}: TutorialProgressProps): JSX.Element {
    const progress = ((currentStep + 1) / totalSteps) * 100;

    if (compact) {
        return (
            <div style={compactContainerStyle}>
                <div style={progressBarContainerStyle}>
                    <div
                        style={{
                            ...progressBarFillStyle,
                            width: `${progress}%`,
                        }}
                    />
                </div>
                <span style={compactTextStyle}>
                    {currentStep + 1}/{totalSteps}
                </span>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            {/* Title and Progress Text */}
            <div style={headerStyle}>
                {title && <span style={titleStyle}>{title}</span>}
                <span style={progressTextStyle}>
                    Step {currentStep + 1} of {totalSteps}
                </span>
            </div>

            {/* Progress Bar */}
            <div style={progressBarContainerStyle}>
                <div
                    style={{
                        ...progressBarFillStyle,
                        width: `${progress}%`,
                    }}
                />
            </div>

            {/* Step Indicators */}
            <div style={stepsContainerStyle}>
                {Array.from({ length: totalSteps }, (_, i) => (
                    <StepIndicator
                        key={i}
                        stepIndex={i}
                        currentStep={currentStep}
                        showNumber={showNumbers}
                    />
                ))}
            </div>
        </div>
    );
}

interface StepIndicatorProps {
    stepIndex: number;
    currentStep: number;
    showNumber: boolean;
}

function StepIndicator({ stepIndex, currentStep, showNumber }: StepIndicatorProps): JSX.Element {
    const isCompleted = stepIndex < currentStep;
    const isCurrent = stepIndex === currentStep;

    let backgroundColor = 'var(--SmartThemeBorderColor, #444)'; // pending
    let borderColor = 'var(--SmartThemeBorderColor, #444)';
    let textColor = 'var(--SmartThemeBodyColor, #888)';

    if (isCompleted) {
        backgroundColor = 'var(--SmartThemeQuoteColor, #4CAF50)';
        borderColor = 'var(--SmartThemeQuoteColor, #4CAF50)';
        textColor = '#fff';
    } else if (isCurrent) {
        backgroundColor = 'transparent';
        borderColor = 'var(--SmartThemeQuoteColor, #4CAF50)';
        textColor = 'var(--SmartThemeQuoteColor, #4CAF50)';
    }

    return (
        <div style={stepWrapperStyle}>
            <div
                style={{
                    ...stepIndicatorStyle,
                    backgroundColor,
                    borderColor,
                    boxShadow: isCurrent ? '0 0 8px var(--SmartThemeQuoteColor, #4CAF50)' : 'none',
                }}
            >
                {showNumber ? (
                    <span style={{ color: textColor, fontSize: '11px', fontWeight: 600 }}>
                        {stepIndex + 1}
                    </span>
                ) : isCompleted ? (
                    <i className="fa-solid fa-check" style={{ color: textColor, fontSize: '10px' }} />
                ) : (
                    <div
                        style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: isCurrent ? borderColor : 'transparent',
                        }}
                    />
                )}
            </div>

            {/* Connector line */}
            {stepIndex < currentStep && (
                <div style={connectorStyle} />
            )}
        </div>
    );
}

// Styles
const containerStyle: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '12px 12px 0 0',
    borderBottom: '1px solid var(--SmartThemeBorderColor, #333)',
};

const compactContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
};

const titleStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontSize: '13px',
    fontWeight: 600,
};

const progressTextStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '12px',
};

const compactTextStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '11px',
    flexShrink: 0,
};

const progressBarContainerStyle: React.CSSProperties = {
    flex: 1,
    height: '4px',
    backgroundColor: 'var(--SmartThemeBorderColor, #333)',
    borderRadius: '2px',
    overflow: 'hidden',
};

const progressBarFillStyle: React.CSSProperties = {
    height: '100%',
    backgroundColor: 'var(--SmartThemeQuoteColor, #4CAF50)',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
};

const stepsContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
    marginTop: '12px',
};

const stepWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
};

const stepIndicatorStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
};

const connectorStyle: React.CSSProperties = {
    width: '20px',
    height: '2px',
    backgroundColor: 'var(--SmartThemeQuoteColor, #4CAF50)',
    marginLeft: '4px',
};

export default TutorialProgress;
