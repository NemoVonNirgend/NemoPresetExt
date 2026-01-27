/**
 * Toggle - Reusable toggle switch component
 */

import React from 'react';

export type ToggleSize = 'sm' | 'md' | 'lg';

export interface ToggleProps {
    /** Whether the toggle is on */
    checked: boolean;
    /** Called when toggle state changes */
    onChange: (checked: boolean) => void;
    /** Whether the toggle is disabled */
    disabled?: boolean;
    /** Size variant */
    size?: ToggleSize;
    /** Optional label text */
    label?: string;
    /** Label position */
    labelPosition?: 'left' | 'right';
    /** Optional ID for accessibility */
    id?: string;
    /** Additional CSS class */
    className?: string;
}

const SIZE_STYLES: Record<ToggleSize, { track: React.CSSProperties; thumb: React.CSSProperties; translate: string }> = {
    sm: {
        track: { width: 32, height: 18 },
        thumb: { width: 14, height: 14 },
        translate: '14px',
    },
    md: {
        track: { width: 44, height: 24 },
        thumb: { width: 20, height: 20 },
        translate: '20px',
    },
    lg: {
        track: { width: 56, height: 30 },
        thumb: { width: 26, height: 26 },
        translate: '26px',
    },
};

export function Toggle({
    checked,
    onChange,
    disabled = false,
    size = 'md',
    label,
    labelPosition = 'right',
    id,
    className = '',
}: ToggleProps): JSX.Element {
    const sizeStyle = SIZE_STYLES[size];

    const handleClick = () => {
        if (!disabled) {
            onChange(!checked);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleClick();
        }
    };

    const trackStyle: React.CSSProperties = {
        ...sizeStyle.track,
        backgroundColor: checked ? 'var(--SmartThemeQuoteColor, #4CAF50)' : 'var(--SmartThemeBorderColor, #555)',
        borderRadius: sizeStyle.track.height,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
    };

    const thumbStyle: React.CSSProperties = {
        ...sizeStyle.thumb,
        backgroundColor: 'white',
        borderRadius: '50%',
        position: 'absolute',
        top: '50%',
        left: 2,
        transform: checked
            ? `translateY(-50%) translateX(${sizeStyle.translate})`
            : 'translateY(-50%) translateX(0)',
        transition: 'transform 0.2s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    };

    const containerStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        flexDirection: labelPosition === 'left' ? 'row-reverse' : 'row',
    };

    const labelStyle: React.CSSProperties = {
        color: 'var(--SmartThemeBodyColor, #ccc)',
        fontSize: size === 'sm' ? '12px' : size === 'lg' ? '16px' : '14px',
        userSelect: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
    };

    const toggleElement = (
        <div
            role="switch"
            aria-checked={checked}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            style={trackStyle}
            id={id}
        >
            <div style={thumbStyle} />
        </div>
    );

    if (!label) {
        return <div className={className}>{toggleElement}</div>;
    }

    return (
        <label style={containerStyle} className={className}>
            {toggleElement}
            <span style={labelStyle} onClick={handleClick}>{label}</span>
        </label>
    );
}

export default Toggle;
