/**
 * Modal - Modal dialog component with Portal rendering
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
    /** Whether modal is visible */
    isOpen: boolean;
    /** Called when modal should close */
    onClose: () => void;
    /** Modal title */
    title?: string;
    /** Modal content */
    children: React.ReactNode;
    /** Size variant */
    size?: ModalSize;
    /** Whether clicking overlay closes modal */
    closeOnOverlayClick?: boolean;
    /** Whether pressing Escape closes modal */
    closeOnEscape?: boolean;
    /** Whether to show close button */
    showCloseButton?: boolean;
    /** Footer content */
    footer?: React.ReactNode;
    /** Additional CSS class for modal content */
    className?: string;
}

const SIZE_WIDTHS: Record<ModalSize, string> = {
    sm: '400px',
    md: '560px',
    lg: '720px',
    xl: '900px',
    full: '95vw',
};

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    closeOnOverlayClick = true,
    closeOnEscape = true,
    showCloseButton = true,
    footer,
    className = '',
}: ModalProps): JSX.Element | null {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousFocus = useRef<HTMLElement | null>(null);

    // Handle Escape key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (closeOnEscape && e.key === 'Escape') {
            onClose();
        }
    }, [closeOnEscape, onClose]);

    // Focus management
    useEffect(() => {
        if (isOpen) {
            previousFocus.current = document.activeElement as HTMLElement;
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';

            // Focus the modal
            setTimeout(() => modalRef.current?.focus(), 0);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';

            // Restore focus
            if (previousFocus.current) {
                previousFocus.current.focus();
            }
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
    };

    const modalStyle: React.CSSProperties = {
        backgroundColor: 'var(--SmartThemeBlurTintColor, #1a1a1a)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        width: '100%',
        maxWidth: SIZE_WIDTHS[size],
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        outline: 'none',
        border: '1px solid var(--SmartThemeBorderColor, #333)',
    };

    const headerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--SmartThemeBorderColor, #333)',
        flexShrink: 0,
    };

    const titleStyle: React.CSSProperties = {
        color: 'var(--SmartThemeBodyColor, #fff)',
        fontSize: '18px',
        fontWeight: 600,
        margin: 0,
    };

    const closeButtonStyle: React.CSSProperties = {
        background: 'none',
        border: 'none',
        color: 'var(--SmartThemeBodyColor, #999)',
        cursor: 'pointer',
        padding: '8px',
        fontSize: '16px',
        borderRadius: '4px',
        transition: 'background-color 0.2s ease',
    };

    const contentStyle: React.CSSProperties = {
        padding: '20px',
        overflowY: 'auto',
        flex: 1,
        color: 'var(--SmartThemeBodyColor, #ccc)',
    };

    const footerStyle: React.CSSProperties = {
        padding: '16px 20px',
        borderTop: '1px solid var(--SmartThemeBorderColor, #333)',
        flexShrink: 0,
    };

    const modalContent = (
        <div style={overlayStyle} onClick={handleOverlayClick}>
            <div
                ref={modalRef}
                style={modalStyle}
                className={className}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? 'modal-title' : undefined}
                tabIndex={-1}
            >
                {(title || showCloseButton) && (
                    <div style={headerStyle}>
                        {title && <h2 id="modal-title" style={titleStyle}>{title}</h2>}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                style={closeButtonStyle}
                                aria-label="Close modal"
                            >
                                <i className="fa-solid fa-times" />
                            </button>
                        )}
                    </div>
                )}

                <div style={contentStyle}>
                    {children}
                </div>

                {footer && (
                    <div style={footerStyle}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    // Render in portal
    return createPortal(modalContent, document.body);
}

export default Modal;
