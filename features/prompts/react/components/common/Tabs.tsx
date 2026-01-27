/**
 * Tabs - Tab navigation component with accessible keyboard navigation
 */

import React, { useCallback, useRef } from 'react';

export interface Tab {
    id: string;
    label: string;
    icon?: string; // Font Awesome icon class
    disabled?: boolean;
    badge?: string | number;
}

export interface TabsProps {
    /** Array of tab definitions */
    tabs: Tab[];
    /** Currently active tab ID */
    activeTab: string;
    /** Called when tab changes */
    onChange: (tabId: string) => void;
    /** Tab bar orientation */
    orientation?: 'horizontal' | 'vertical';
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Whether tabs fill container width */
    fullWidth?: boolean;
    /** Additional CSS class */
    className?: string;
    /** Content to render for active tab */
    children?: React.ReactNode;
}

export function Tabs({
    tabs,
    activeTab,
    onChange,
    orientation = 'horizontal',
    size = 'md',
    fullWidth = false,
    className = '',
    children,
}: TabsProps): JSX.Element {
    const tabListRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = useCallback((e: React.KeyboardEvent, tabIndex: number) => {
        const enabledTabs = tabs.filter(t => !t.disabled);
        const currentIndex = enabledTabs.findIndex(t => t.id === tabs[tabIndex].id);

        let nextIndex: number | null = null;

        if (orientation === 'horizontal') {
            if (e.key === 'ArrowLeft') {
                nextIndex = currentIndex > 0 ? currentIndex - 1 : enabledTabs.length - 1;
            } else if (e.key === 'ArrowRight') {
                nextIndex = currentIndex < enabledTabs.length - 1 ? currentIndex + 1 : 0;
            }
        } else {
            if (e.key === 'ArrowUp') {
                nextIndex = currentIndex > 0 ? currentIndex - 1 : enabledTabs.length - 1;
            } else if (e.key === 'ArrowDown') {
                nextIndex = currentIndex < enabledTabs.length - 1 ? currentIndex + 1 : 0;
            }
        }

        if (e.key === 'Home') {
            nextIndex = 0;
        } else if (e.key === 'End') {
            nextIndex = enabledTabs.length - 1;
        }

        if (nextIndex !== null) {
            e.preventDefault();
            const nextTab = enabledTabs[nextIndex];
            onChange(nextTab.id);

            // Focus the tab
            const tabElement = tabListRef.current?.querySelector(`[data-tab-id="${nextTab.id}"]`) as HTMLElement;
            tabElement?.focus();
        }
    }, [tabs, orientation, onChange]);

    const padding = size === 'sm' ? '8px 12px' : size === 'lg' ? '14px 20px' : '10px 16px';
    const fontSize = size === 'sm' ? '12px' : size === 'lg' ? '16px' : '14px';

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'row' : 'column',
    };

    const tabListStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        borderBottom: orientation === 'horizontal' ? '1px solid var(--SmartThemeBorderColor, #333)' : undefined,
        borderRight: orientation === 'vertical' ? '1px solid var(--SmartThemeBorderColor, #333)' : undefined,
        gap: '2px',
        padding: '0 4px',
        flexWrap: orientation === 'horizontal' ? 'wrap' : undefined,
    };

    const getTabStyle = (tab: Tab, isActive: boolean): React.CSSProperties => ({
        padding,
        fontSize,
        backgroundColor: isActive ? 'var(--SmartThemeBorderColor, #333)' : 'transparent',
        color: isActive
            ? 'var(--SmartThemeBodyColor, #fff)'
            : tab.disabled
                ? 'var(--SmartThemeBodyColor, #666)'
                : 'var(--SmartThemeBodyColor, #aaa)',
        border: 'none',
        borderBottom: orientation === 'horizontal' && isActive
            ? '2px solid var(--SmartThemeQuoteColor, #4CAF50)'
            : '2px solid transparent',
        borderLeft: orientation === 'vertical' && isActive
            ? '2px solid var(--SmartThemeQuoteColor, #4CAF50)'
            : '2px solid transparent',
        cursor: tab.disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background-color 0.2s ease, color 0.2s ease',
        flex: fullWidth && orientation === 'horizontal' ? 1 : undefined,
        justifyContent: fullWidth ? 'center' : undefined,
        borderRadius: '4px 4px 0 0',
        opacity: tab.disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
    });

    const badgeStyle: React.CSSProperties = {
        backgroundColor: 'var(--SmartThemeQuoteColor, #4CAF50)',
        color: '#fff',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '10px',
        fontWeight: 600,
    };

    const panelStyle: React.CSSProperties = {
        flex: 1,
        padding: orientation === 'vertical' ? '0 16px' : '16px 0',
    };

    return (
        <div style={containerStyle} className={className}>
            <div
                ref={tabListRef}
                role="tablist"
                aria-orientation={orientation}
                style={tabListStyle}
            >
                {tabs.map((tab, index) => {
                    const isActive = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`tabpanel-${tab.id}`}
                            aria-disabled={tab.disabled}
                            data-tab-id={tab.id}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => !tab.disabled && onChange(tab.id)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            style={getTabStyle(tab, isActive)}
                        >
                            {tab.icon && <i className={tab.icon} />}
                            <span>{tab.label}</span>
                            {tab.badge !== undefined && (
                                <span style={badgeStyle}>{tab.badge}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {children && (
                <div
                    role="tabpanel"
                    id={`tabpanel-${activeTab}`}
                    aria-labelledby={activeTab}
                    style={panelStyle}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

export default Tabs;
