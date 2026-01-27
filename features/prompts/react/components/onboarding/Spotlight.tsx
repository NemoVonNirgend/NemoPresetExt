/**
 * Spotlight - Overlay with cutout to highlight elements during tutorials
 */

import React from 'react';

export interface SpotlightProps {
    /** DOMRect of the element to highlight (null = no spotlight) */
    targetRect: DOMRect | null;
    /** Padding around the highlighted element */
    padding?: number;
    /** Border radius of the cutout */
    borderRadius?: number;
    /** Overlay opacity (0-1) */
    overlayOpacity?: number;
    /** Called when overlay is clicked */
    onClick?: () => void;
    /** Whether clicking the spotlight area should also trigger onClick */
    allowSpotlightClick?: boolean;
}

export function Spotlight({
    targetRect,
    padding = 8,
    borderRadius = 8,
    overlayOpacity = 0.7,
    onClick,
    allowSpotlightClick = false,
}: SpotlightProps): JSX.Element {
    // No spotlight - just show overlay
    if (!targetRect) {
        return (
            <div
                style={{
                    ...overlayStyle,
                    backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`,
                }}
                onClick={onClick}
            />
        );
    }

    // Calculate spotlight dimensions with padding
    const spotlightX = targetRect.left - padding;
    const spotlightY = targetRect.top - padding;
    const spotlightWidth = targetRect.width + padding * 2;
    const spotlightHeight = targetRect.height + padding * 2;

    // Create SVG mask for the cutout effect
    const maskId = 'spotlight-mask';

    return (
        <svg
            style={svgStyle}
            onClick={(e) => {
                // Check if click was on the spotlight area
                const rect = {
                    left: spotlightX,
                    right: spotlightX + spotlightWidth,
                    top: spotlightY,
                    bottom: spotlightY + spotlightHeight,
                };

                const isInSpotlight =
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom;

                if (!isInSpotlight || allowSpotlightClick) {
                    onClick?.();
                }
            }}
        >
            <defs>
                <mask id={maskId}>
                    {/* White = visible, Black = hidden */}
                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                    <rect
                        x={spotlightX}
                        y={spotlightY}
                        width={spotlightWidth}
                        height={spotlightHeight}
                        rx={borderRadius}
                        ry={borderRadius}
                        fill="black"
                    />
                </mask>
            </defs>

            {/* Overlay with mask cutout */}
            <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill={`rgba(0, 0, 0, ${overlayOpacity})`}
                mask={`url(#${maskId})`}
            />

            {/* Spotlight border/glow effect */}
            <rect
                x={spotlightX}
                y={spotlightY}
                width={spotlightWidth}
                height={spotlightHeight}
                rx={borderRadius}
                ry={borderRadius}
                fill="none"
                stroke="var(--SmartThemeQuoteColor, #4CAF50)"
                strokeWidth="2"
                style={{
                    filter: 'drop-shadow(0 0 8px var(--SmartThemeQuoteColor, #4CAF50))',
                }}
            />

            {/* Animated pulse ring */}
            <rect
                x={spotlightX}
                y={spotlightY}
                width={spotlightWidth}
                height={spotlightHeight}
                rx={borderRadius}
                ry={borderRadius}
                fill="none"
                stroke="var(--SmartThemeQuoteColor, #4CAF50)"
                strokeWidth="1"
                opacity="0.5"
            >
                <animate
                    attributeName="stroke-width"
                    values="1;4;1"
                    dur="2s"
                    repeatCount="indefinite"
                />
                <animate
                    attributeName="opacity"
                    values="0.5;0.2;0.5"
                    dur="2s"
                    repeatCount="indefinite"
                />
            </rect>
        </svg>
    );
}

// Styles
const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10001,
    cursor: 'pointer',
};

const svgStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 10001,
    cursor: 'pointer',
    pointerEvents: 'auto',
};

export default Spotlight;
