/**
 * DirectiveHelpButton - React component that adds help button to prompt editor
 * Replaces MutationObserver-based DOM watching with React lifecycle
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Extend window type for NemoReactUI
declare global {
    interface Window {
        NemoReactUI?: {
            showDirectiveHelp?: () => void;
            [key: string]: any;
        };
    }
}

export interface DirectiveHelpButtonProps {
    /** Custom label selector to attach to */
    labelSelector?: string;
    /** Custom textarea selector to check for */
    textareaSelector?: string;
}

export function DirectiveHelpButton({
    labelSelector = 'label[for="completion_prompt_manager_popup_entry_form_prompt"]',
    textareaSelector = '#completion_prompt_manager_popup_entry_form_prompt',
}: DirectiveHelpButtonProps): JSX.Element | null {
    const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null);
    const [mountMode, setMountMode] = useState<'label' | 'textarea' | null>(null);

    // Find mount target
    useEffect(() => {
        const findTarget = () => {
            // Don't add if already exists
            if (document.querySelector('.nemo-directive-help, .nemo-directive-help-button')) {
                return;
            }

            // Strategy 1: Find label by for attribute
            let label = document.querySelector(labelSelector) as HTMLElement;

            // Strategy 2: Find by text content in popup
            if (!label) {
                const labels = document.querySelectorAll('label');
                for (const l of labels) {
                    const text = l.textContent?.trim() || '';
                    if (text === 'Prompt' || text.startsWith('Prompt')) {
                        const popup = l.closest('.completion_prompt_manager_popup_entry, .dialogue_popup');
                        if (popup) {
                            label = l as HTMLElement;
                            break;
                        }
                    }
                }
            }

            if (label) {
                setMountTarget(label);
                setMountMode('label');
                return;
            }

            // Strategy 3: Find textarea and mount before it
            const textarea = document.querySelector(textareaSelector) as HTMLElement;
            if (textarea?.parentNode) {
                setMountTarget(textarea.parentNode as HTMLElement);
                setMountMode('textarea');
                return;
            }
        };

        // Check immediately
        findTarget();

        // Poll for it (cleaner than MutationObserver on whole body)
        const interval = setInterval(findTarget, 1000);

        // Stop after 30 seconds
        const timeout = setTimeout(() => clearInterval(interval), 30000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [labelSelector, textareaSelector]);

    // Handle help click
    const handleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (window.NemoReactUI?.showDirectiveHelp) {
            window.NemoReactUI.showDirectiveHelp();
        }
    }, []);

    if (!mountTarget || !mountMode) {
        return null;
    }

    // Render based on mount mode
    if (mountMode === 'label') {
        // Find the span inside label or append to label
        const labelSpan = mountTarget.querySelector('span[data-i18n="Prompt"]');
        const target = labelSpan || mountTarget;

        return createPortal(
            <span className="nemo-directive-help" style={{ marginLeft: '4px' }}>
                <a
                    href="#"
                    className="nemo-help-icon"
                    title="Click for directive syntax help"
                    onClick={handleClick}
                    style={{
                        textDecoration: 'none',
                        cursor: 'pointer',
                    }}
                >
                    ℹ️
                </a>
            </span>,
            target
        );
    }

    if (mountMode === 'textarea') {
        const textarea = mountTarget.querySelector(textareaSelector);
        if (!textarea) return null;

        // Create a wrapper to insert before textarea
        return createPortal(
            <button
                type="button"
                className="nemo-directive-help-button"
                title="Click for directive syntax help"
                onClick={handleClick}
                style={{
                    display: 'block',
                    marginBottom: '8px',
                    padding: '4px 8px',
                    background: 'var(--SmartThemeBlurTintColor, #333)',
                    border: '1px solid var(--SmartThemeBorderColor, #555)',
                    borderRadius: '4px',
                    color: 'var(--SmartThemeBodyColor, #fff)',
                    cursor: 'pointer',
                    fontSize: '12px',
                }}
            >
                ℹ️ Directive Help
            </button>,
            mountTarget
        );
    }

    return null;
}

export default DirectiveHelpButton;
