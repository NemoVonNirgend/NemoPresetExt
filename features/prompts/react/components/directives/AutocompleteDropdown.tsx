/**
 * AutocompleteDropdown - Directive autocomplete dropdown with keyboard navigation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface AutocompleteSuggestion {
    /** Display text */
    label: string;
    /** Text to insert */
    value: string;
    /** Description */
    description?: string;
    /** Icon class (FontAwesome) */
    icon?: string;
    /** Category for grouping */
    category?: string;
}

export interface AutocompleteDropdownProps {
    /** Suggestions to show */
    suggestions: AutocompleteSuggestion[];
    /** Called when suggestion is selected */
    onSelect: (suggestion: AutocompleteSuggestion) => void;
    /** Called when dropdown should close */
    onClose: () => void;
    /** Position relative to viewport */
    position: { top: number; left: number };
    /** Maximum height */
    maxHeight?: number;
    /** Filter text to highlight */
    filterText?: string;
}

export function AutocompleteDropdown({
    suggestions,
    onSelect,
    onClose,
    position,
    maxHeight = 300,
    filterText = '',
}: AutocompleteDropdownProps): JSX.Element | null {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<HTMLDivElement>(null);

    // Reset selection when suggestions change
    useEffect(() => {
        setSelectedIndex(0);
    }, [suggestions]);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedRef.current) {
            selectedRef.current.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(i => (i + 1) % suggestions.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(i => (i - 1 + suggestions.length) % suggestions.length);
                break;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                if (suggestions[selectedIndex]) {
                    onSelect(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [suggestions, selectedIndex, onSelect, onClose]);

    // Attach keyboard listener
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    if (suggestions.length === 0) return null;

    // Group suggestions by category
    const grouped = groupByCategory(suggestions);

    return (
        <div
            ref={containerRef}
            style={{
                ...containerStyle,
                top: position.top,
                left: position.left,
                maxHeight,
            }}
        >
            {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                    {category !== 'default' && (
                        <div style={categoryHeaderStyle}>{category}</div>
                    )}
                    {items.map((suggestion) => {
                        const globalIndex = suggestions.indexOf(suggestion);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                            <div
                                key={suggestion.value}
                                ref={isSelected ? selectedRef : null}
                                style={{
                                    ...suggestionStyle,
                                    backgroundColor: isSelected
                                        ? 'var(--SmartThemeQuoteColor, #4CAF50)'
                                        : 'transparent',
                                }}
                                onClick={() => onSelect(suggestion)}
                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                            >
                                {suggestion.icon && (
                                    <i
                                        className={suggestion.icon}
                                        style={{
                                            ...iconStyle,
                                            color: isSelected ? '#fff' : 'var(--SmartThemeQuoteColor, #4CAF50)',
                                        }}
                                    />
                                )}
                                <div style={contentStyle}>
                                    <span style={{
                                        ...labelStyle,
                                        color: isSelected ? '#fff' : 'var(--SmartThemeBodyColor, #fff)',
                                    }}>
                                        {highlightMatch(suggestion.label, filterText)}
                                    </span>
                                    {suggestion.description && (
                                        <span style={{
                                            ...descriptionStyle,
                                            color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--SmartThemeBodyColor, #888)',
                                        }}>
                                            {suggestion.description}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}

            <div style={hintStyle}>
                <span>↑↓ Navigate</span>
                <span>Tab/Enter Select</span>
                <span>Esc Close</span>
            </div>
        </div>
    );
}

function groupByCategory(suggestions: AutocompleteSuggestion[]): Record<string, AutocompleteSuggestion[]> {
    return suggestions.reduce((acc, suggestion) => {
        const category = suggestion.category || 'default';
        if (!acc[category]) acc[category] = [];
        acc[category].push(suggestion);
        return acc;
    }, {} as Record<string, AutocompleteSuggestion[]>);
}

function highlightMatch(text: string, filter: string): React.ReactNode {
    if (!filter) return text;

    const index = text.toLowerCase().indexOf(filter.toLowerCase());
    if (index === -1) return text;

    return (
        <>
            {text.slice(0, index)}
            <strong style={{ color: 'inherit' }}>{text.slice(index, index + filter.length)}</strong>
            {text.slice(index + filter.length)}
        </>
    );
}

// Styles
const containerStyle: React.CSSProperties = {
    position: 'fixed',
    backgroundColor: 'var(--SmartThemeBlurTintColor, #1a1a1a)',
    border: '1px solid var(--SmartThemeBorderColor, #444)',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
    zIndex: 10001,
    overflowY: 'auto',
    minWidth: '250px',
    maxWidth: '400px',
};

const categoryHeaderStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--SmartThemeBodyColor, #888)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderBottom: '1px solid var(--SmartThemeBorderColor, #333)',
};

const suggestionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'background-color 0.1s ease',
};

const iconStyle: React.CSSProperties = {
    fontSize: '14px',
    width: '20px',
    textAlign: 'center',
    flexShrink: 0,
};

const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
};

const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'monospace',
};

const descriptionStyle: React.CSSProperties = {
    fontSize: '11px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

const hintStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    padding: '8px',
    borderTop: '1px solid var(--SmartThemeBorderColor, #333)',
    fontSize: '10px',
    color: 'var(--SmartThemeBodyColor, #666)',
};

export default AutocompleteDropdown;
