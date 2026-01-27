/**
 * Toast - Toast notification component with action buttons
 */

import React, { useEffect, useState } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
}

export interface ToastProps {
    /** The message to display */
    message: string;
    /** Optional title */
    title?: string;
    /** Toast type for styling */
    type?: ToastType;
    /** Action buttons */
    actions?: ToastAction[];
    /** Called when toast is dismissed */
    onDismiss?: () => void;
    /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
    duration?: number;
    /** Whether to show close button */
    showClose?: boolean;
    /** Additional CSS class */
    className?: string;
}

const TYPE_COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
    info: {
        bg: 'rgba(33, 150, 243, 0.15)',
        border: '#2196F3',
        icon: 'fa-info-circle',
    },
    success: {
        bg: 'rgba(76, 175, 80, 0.15)',
        border: '#4CAF50',
        icon: 'fa-check-circle',
    },
    warning: {
        bg: 'rgba(255, 152, 0, 0.15)',
        border: '#FF9800',
        icon: 'fa-exclamation-triangle',
    },
    error: {
        bg: 'rgba(244, 67, 54, 0.15)',
        border: '#F44336',
        icon: 'fa-times-circle',
    },
};

export function Toast({
    message,
    title,
    type = 'info',
    actions = [],
    onDismiss,
    duration = 5000,
    showClose = true,
    className = '',
}: ToastProps): JSX.Element {
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                handleDismiss();
            }, duration);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [duration]);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(() => {
            setIsVisible(false);
            onDismiss?.();
        }, 200);
    };

    if (!isVisible) return <></>;

    const colors = TYPE_COLORS[type];

    const containerStyle: React.CSSProperties = {
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        maxWidth: '400px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'translateY(-10px)' : 'translateY(0)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
    };

    const iconStyle: React.CSSProperties = {
        color: colors.border,
        fontSize: '18px',
        marginTop: '2px',
    };

    const contentStyle: React.CSSProperties = {
        flex: 1,
        minWidth: 0,
    };

    const titleStyle: React.CSSProperties = {
        color: 'var(--SmartThemeBodyColor, #fff)',
        fontWeight: 600,
        marginBottom: title ? '4px' : 0,
        fontSize: '14px',
    };

    const messageStyle: React.CSSProperties = {
        color: 'var(--SmartThemeBodyColor, #ccc)',
        fontSize: '13px',
        lineHeight: 1.4,
    };

    const actionsStyle: React.CSSProperties = {
        display: 'flex',
        gap: '8px',
        marginTop: '10px',
    };

    const buttonBaseStyle: React.CSSProperties = {
        padding: '6px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        border: 'none',
        transition: 'background-color 0.2s ease',
    };

    const closeStyle: React.CSSProperties = {
        background: 'none',
        border: 'none',
        color: 'var(--SmartThemeBodyColor, #999)',
        cursor: 'pointer',
        padding: '4px',
        fontSize: '14px',
        opacity: 0.7,
    };

    return (
        <div style={containerStyle} className={className} role="alert">
            <i className={`fa-solid ${colors.icon}`} style={iconStyle} />

            <div style={contentStyle}>
                {title && <div style={titleStyle}>{title}</div>}
                <div style={messageStyle}>{message}</div>

                {actions.length > 0 && (
                    <div style={actionsStyle}>
                        {actions.map((action, i) => (
                            <button
                                key={i}
                                onClick={action.onClick}
                                style={{
                                    ...buttonBaseStyle,
                                    backgroundColor: action.variant === 'primary'
                                        ? colors.border
                                        : 'var(--SmartThemeBorderColor, #444)',
                                    color: action.variant === 'primary'
                                        ? '#fff'
                                        : 'var(--SmartThemeBodyColor, #ccc)',
                                }}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {showClose && (
                <button
                    onClick={handleDismiss}
                    style={closeStyle}
                    aria-label="Dismiss"
                >
                    <i className="fa-solid fa-times" />
                </button>
            )}
        </div>
    );
}

export default Toast;
