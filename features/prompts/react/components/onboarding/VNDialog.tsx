/**
 * VNDialog - Visual Novel style dialog for tutorials/onboarding
 * Features character portrait, dialog text, and navigation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Spotlight } from './Spotlight';
import { TutorialProgress } from './TutorialProgress';

export interface DialogStep {
    /** Dialog text to display */
    text: string;
    /** Character name (optional) */
    character?: string;
    /** Character portrait image URL (optional) */
    portrait?: string;
    /** Element selector to spotlight (optional) */
    spotlightSelector?: string;
    /** Action button to show (optional) */
    action?: {
        label: string;
        onClick: () => void | Promise<void>;
    };
    /** Position of the dialog relative to spotlight */
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export interface VNDialogProps {
    /** Array of dialog steps */
    steps: DialogStep[];
    /** Called when dialog completes all steps */
    onComplete?: () => void;
    /** Called when dialog is dismissed */
    onDismiss?: () => void;
    /** Tutorial title for progress bar */
    title?: string;
    /** Whether dialog can be dismissed early */
    allowDismiss?: boolean;
}

export function VNDialog({
    steps,
    onComplete,
    onDismiss,
    title = 'Tutorial',
    allowDismiss = true,
}: VNDialogProps): JSX.Element {
    const [currentStep, setCurrentStep] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

    const step = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;
    const hasSpotlight = !!step?.spotlightSelector;

    // Update spotlight position when step changes
    useEffect(() => {
        if (step?.spotlightSelector) {
            const element = document.querySelector(step.spotlightSelector);
            if (element) {
                setSpotlightRect(element.getBoundingClientRect());
                // Scroll element into view
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                setSpotlightRect(null);
            }
        } else {
            setSpotlightRect(null);
        }
    }, [step?.spotlightSelector, currentStep]);

    const handleNext = useCallback(async () => {
        if (isAnimating) return;

        // Run action if present
        if (step?.action) {
            setIsAnimating(true);
            try {
                await step.action.onClick();
            } catch (e) {
                console.error('[VNDialog] Action failed:', e);
            }
            setIsAnimating(false);
        }

        if (isLastStep) {
            onComplete?.();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    }, [step, isLastStep, isAnimating, onComplete]);

    const handlePrevious = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    }, [currentStep]);

    const handleDismiss = useCallback(() => {
        if (allowDismiss) {
            onDismiss?.();
        }
    }, [allowDismiss, onDismiss]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && allowDismiss) {
                handleDismiss();
            } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrevious();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleNext, handlePrevious, handleDismiss, allowDismiss]);

    // Get dialog position based on spotlight
    const getDialogPosition = (): React.CSSProperties => {
        if (!hasSpotlight || !spotlightRect) {
            return {
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
            };
        }

        const pos = step?.position || 'bottom';
        const margin = 20;

        switch (pos) {
            case 'top':
                return {
                    left: spotlightRect.left + spotlightRect.width / 2,
                    bottom: window.innerHeight - spotlightRect.top + margin,
                    transform: 'translateX(-50%)',
                };
            case 'bottom':
                return {
                    left: spotlightRect.left + spotlightRect.width / 2,
                    top: spotlightRect.bottom + margin,
                    transform: 'translateX(-50%)',
                };
            case 'left':
                return {
                    right: window.innerWidth - spotlightRect.left + margin,
                    top: spotlightRect.top + spotlightRect.height / 2,
                    transform: 'translateY(-50%)',
                };
            case 'right':
                return {
                    left: spotlightRect.right + margin,
                    top: spotlightRect.top + spotlightRect.height / 2,
                    transform: 'translateY(-50%)',
                };
            default:
                return {
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                };
        }
    };

    const content = (
        <>
            {/* Overlay with spotlight cutout */}
            <Spotlight targetRect={spotlightRect} onClick={handleDismiss} />

            {/* Dialog Box */}
            <div style={{ ...dialogContainerStyle, ...getDialogPosition() }}>
                {/* Progress Bar */}
                <TutorialProgress
                    currentStep={currentStep}
                    totalSteps={steps.length}
                    title={title}
                />

                {/* Main Dialog */}
                <div style={dialogStyle}>
                    {/* Character Portrait */}
                    {step?.portrait && (
                        <div style={portraitContainerStyle}>
                            <img
                                src={step.portrait}
                                alt={step.character || 'Character'}
                                style={portraitStyle}
                            />
                        </div>
                    )}

                    {/* Text Content */}
                    <div style={contentStyle}>
                        {step?.character && (
                            <div style={characterNameStyle}>{step.character}</div>
                        )}
                        <div style={textStyle}>{step?.text}</div>
                    </div>
                </div>

                {/* Navigation */}
                <div style={navStyle}>
                    <div style={navLeftStyle}>
                        {allowDismiss && (
                            <button onClick={handleDismiss} style={skipButtonStyle}>
                                Skip Tutorial
                            </button>
                        )}
                    </div>
                    <div style={navRightStyle}>
                        {currentStep > 0 && (
                            <button onClick={handlePrevious} style={navButtonStyle}>
                                <i className="fa-solid fa-chevron-left" style={{ marginRight: '6px' }} />
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            style={primaryButtonStyle}
                            disabled={isAnimating}
                        >
                            {isAnimating ? (
                                <i className="fa-solid fa-spinner fa-spin" />
                            ) : step?.action ? (
                                <>
                                    {step.action.label}
                                    <i className="fa-solid fa-play" style={{ marginLeft: '6px' }} />
                                </>
                            ) : isLastStep ? (
                                <>
                                    Finish
                                    <i className="fa-solid fa-check" style={{ marginLeft: '6px' }} />
                                </>
                            ) : (
                                <>
                                    Next
                                    <i className="fa-solid fa-chevron-right" style={{ marginLeft: '6px' }} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(content, document.body);
}

// Styles
const dialogContainerStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10002,
    maxWidth: '500px',
    width: '90%',
};

const dialogStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBlurTintColor, #1a1a1a)',
    borderRadius: '12px',
    border: '1px solid var(--SmartThemeBorderColor, #444)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    overflow: 'hidden',
};

const portraitContainerStyle: React.CSSProperties = {
    width: '120px',
    flexShrink: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const portraitStyle: React.CSSProperties = {
    width: '100%',
    height: 'auto',
    objectFit: 'cover',
};

const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: '20px',
};

const characterNameStyle: React.CSSProperties = {
    color: 'var(--SmartThemeQuoteColor, #4CAF50)',
    fontWeight: 600,
    fontSize: '14px',
    marginBottom: '8px',
};

const textStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #ccc)',
    fontSize: '14px',
    lineHeight: 1.6,
};

const navStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderTop: '1px solid var(--SmartThemeBorderColor, #333)',
    marginTop: '12px',
    borderRadius: '0 0 12px 12px',
};

const navLeftStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
};

const navRightStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
};

const navButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: 'var(--SmartThemeBorderColor, #444)',
    color: 'var(--SmartThemeBodyColor, #ccc)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
};

const primaryButtonStyle: React.CSSProperties = {
    ...navButtonStyle,
    backgroundColor: 'var(--SmartThemeQuoteColor, #4CAF50)',
    color: '#fff',
};

const skipButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '12px',
    cursor: 'pointer',
    padding: '4px 8px',
};

export default VNDialog;
