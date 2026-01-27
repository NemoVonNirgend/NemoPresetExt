/**
 * UserSettingsTabs - Tabbed interface for SillyTavern user settings
 * Hybrid approach: React manages tabs/search, vanilla DOM elements remain functional
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tabs, Tab } from '../common/Tabs';

export interface TabConfig {
    id: string;
    label: string;
    icon: string;
    /** CSS selectors for elements to include in this tab */
    selectors: string[];
    /** Keywords for search relevance */
    keywords: string[];
}

export interface UserSettingsTabsProps {
    /** Container element ID to reorganize */
    containerId?: string;
    /** Tab configurations */
    tabs?: TabConfig[];
    /** Enable search functionality */
    enableSearch?: boolean;
    /** Callback when tab changes */
    onTabChange?: (tabId: string) => void;
}

const DEFAULT_TABS: TabConfig[] = [
    {
        id: 'ui-theme',
        label: 'UI Theme',
        icon: 'fa-solid fa-palette',
        selectors: ['#UI-presets-block', '[name="themeElements"]', '#CustomCSS-block'],
        keywords: ['theme', 'color', 'background', 'css', 'style', 'font', 'blur', 'shadow'],
    },
    {
        id: 'character-handling',
        label: 'Character',
        icon: 'fa-solid fa-user-gear',
        selectors: ['[name="CharacterHandlingToggles"]', '[name="MiscellaneousToggles"]'],
        keywords: ['character', 'avatar', 'persona', 'name', 'description', 'greeting'],
    },
    {
        id: 'chat-messages',
        label: 'Chat',
        icon: 'fa-solid fa-comments',
        selectors: ['#power-user-option-checkboxes'],
        keywords: ['message', 'chat', 'send', 'enter', 'truncate', 'streaming', 'typing'],
    },
];

interface SearchResult {
    element: HTMLElement;
    score: number;
    tabId: string;
    label: string;
}

export function UserSettingsTabs({
    containerId = 'user-settings-block',
    tabs = DEFAULT_TABS,
    enableSearch = true,
    onTabChange,
}: UserSettingsTabsProps): JSX.Element | null {
    const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    const containerRef = useRef<HTMLElement | null>(null);
    const tabContentsRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const originalParentsRef = useRef<Map<HTMLElement, HTMLElement>>(new Map());

    // Initialize: find container and reorganize elements
    useEffect(() => {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`[UserSettingsTabs] Container #${containerId} not found`);
            return;
        }

        containerRef.current = container;

        // Create tab content containers
        tabs.forEach(tab => {
            const tabContent = document.createElement('div');
            tabContent.id = `nemo-react-tab-${tab.id}`;
            tabContent.className = 'nemo-user-settings-tab-content';
            tabContent.style.display = tab.id === activeTab ? 'block' : 'none';
            tabContentsRef.current.set(tab.id, tabContent);
        });

        // Move elements to their tabs
        tabs.forEach(tab => {
            const tabContent = tabContentsRef.current.get(tab.id);
            if (!tabContent) return;

            tab.selectors.forEach(selector => {
                const elements = container.querySelectorAll(selector);
                elements.forEach(el => {
                    const element = el as HTMLElement;
                    // Store original parent for cleanup
                    if (element.parentElement) {
                        originalParentsRef.current.set(element, element.parentElement);
                    }
                    tabContent.appendChild(element);
                });
            });
        });

        // Insert tab contents after existing content
        const contentBlock = container.querySelector('#user-settings-block-content') || container;
        tabs.forEach(tab => {
            const tabContent = tabContentsRef.current.get(tab.id);
            if (tabContent) {
                contentBlock.appendChild(tabContent);
            }
        });

        setIsInitialized(true);

        // Cleanup function to restore original structure
        return () => {
            originalParentsRef.current.forEach((parent, element) => {
                if (parent && element.parentElement !== parent) {
                    parent.appendChild(element);
                }
            });
            tabContentsRef.current.forEach(content => content.remove());
            tabContentsRef.current.clear();
            originalParentsRef.current.clear();
        };
    }, [containerId, tabs]);

    // Handle tab changes
    const handleTabChange = useCallback((tabId: string) => {
        setActiveTab(tabId);
        setSearchTerm('');
        setSearchResults([]);

        // Show/hide tab contents
        tabContentsRef.current.forEach((content, id) => {
            content.style.display = id === tabId ? 'block' : 'none';
        });

        onTabChange?.(tabId);
    }, [onTabChange]);

    // Search functionality
    const performSearch = useCallback((term: string) => {
        if (term.length < 2) {
            setSearchResults([]);
            return;
        }

        const results: SearchResult[] = [];
        const termLower = term.toLowerCase();
        const termWords = termLower.split(/\s+/);

        tabs.forEach(tab => {
            const tabContent = tabContentsRef.current.get(tab.id);
            if (!tabContent) return;

            // Find all searchable elements
            const searchableElements = tabContent.querySelectorAll(
                'input, select, textarea, label, button, .menu_button, [title], [data-i18n]'
            );

            searchableElements.forEach(el => {
                const element = el as HTMLElement;
                const searchText = getSearchableText(element).toLowerCase();

                let score = 0;

                // Exact match
                if (searchText.includes(termLower)) {
                    score += 100;
                }

                // Word matches
                termWords.forEach(word => {
                    if (searchText.includes(word)) {
                        score += 50;
                    }
                });

                // Keyword matches
                tab.keywords.forEach(keyword => {
                    if (keyword.includes(termLower) || termLower.includes(keyword)) {
                        score += 25;
                    }
                });

                if (score > 0) {
                    results.push({
                        element,
                        score: Math.min(score, 100),
                        tabId: tab.id,
                        label: getElementLabel(element),
                    });
                }
            });
        });

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        setSearchResults(results.slice(0, 20)); // Limit to 20 results
    }, [tabs]);

    useEffect(() => {
        performSearch(searchTerm);
    }, [searchTerm, performSearch]);

    // Hide tab contents during search
    useEffect(() => {
        const isSearching = searchTerm.length >= 2;
        tabContentsRef.current.forEach((content) => {
            content.style.display = isSearching ? 'none' : (content.id.includes(activeTab) ? 'block' : 'none');
        });
    }, [searchTerm, activeTab]);

    // Convert tabs to Tab format
    const tabItems: Tab[] = useMemo(() =>
        tabs.map(tab => ({
            id: tab.id,
            label: tab.label,
            icon: tab.icon,
        })),
    [tabs]);

    if (!isInitialized) {
        return (
            <div style={loadingStyle}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
                Loading settings...
            </div>
        );
    }

    const isSearching = searchTerm.length >= 2;

    return (
        <div style={containerStyle}>
            {/* Search Bar */}
            {enableSearch && (
                <div style={searchContainerStyle}>
                    <i className="fa-solid fa-search" style={searchIconStyle} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search settings..."
                        style={searchInputStyle}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} style={clearButtonStyle}>
                            <i className="fa-solid fa-times" />
                        </button>
                    )}
                </div>
            )}

            {/* Tabs (hidden during search) */}
            {!isSearching && (
                <Tabs
                    tabs={tabItems}
                    activeTab={activeTab}
                    onChange={handleTabChange}
                    size="sm"
                    fullWidth
                />
            )}

            {/* Search Results */}
            {isSearching && (
                <div style={searchResultsStyle}>
                    <div style={searchResultsHeaderStyle}>
                        Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </div>
                    {searchResults.length === 0 ? (
                        <div style={noResultsStyle}>
                            No settings found matching "{searchTerm}"
                        </div>
                    ) : (
                        <div style={resultsListStyle}>
                            {searchResults.map((result, i) => (
                                <SearchResultItem
                                    key={i}
                                    result={result}
                                    onNavigate={() => {
                                        setSearchTerm('');
                                        handleTabChange(result.tabId);
                                        // Scroll element into view
                                        setTimeout(() => {
                                            result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            result.element.classList.add('nemo-highlight-flash');
                                            setTimeout(() => result.element.classList.remove('nemo-highlight-flash'), 2000);
                                        }, 100);
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface SearchResultItemProps {
    result: SearchResult;
    onNavigate: () => void;
}

function SearchResultItem({ result, onNavigate }: SearchResultItemProps): JSX.Element {
    return (
        <div style={resultItemStyle} onClick={onNavigate}>
            <div style={resultContentStyle}>
                <span style={resultLabelStyle}>{result.label}</span>
                <span style={resultTabStyle}>{result.tabId.replace(/-/g, ' ')}</span>
            </div>
            <div style={resultScoreStyle}>
                {Math.round(result.score)}%
            </div>
        </div>
    );
}

// Helper functions
function getSearchableText(element: HTMLElement): string {
    const parts: string[] = [];

    // Text content
    if (element.textContent) {
        parts.push(element.textContent);
    }

    // Attributes
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) parts.push(placeholder);

    const title = element.getAttribute('title');
    if (title) parts.push(title);

    const i18n = element.getAttribute('data-i18n');
    if (i18n) parts.push(i18n);

    // Label for
    if (element.tagName === 'INPUT' || element.tagName === 'SELECT') {
        const id = element.id;
        if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label?.textContent) parts.push(label.textContent);
        }
    }

    return parts.join(' ');
}

function getElementLabel(element: HTMLElement): string {
    // Try various sources for a label
    if (element.tagName === 'INPUT' || element.tagName === 'SELECT') {
        const id = element.id;
        if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label?.textContent) return label.textContent.trim();
        }
    }

    const title = element.getAttribute('title');
    if (title) return title;

    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;

    if (element.textContent) {
        const text = element.textContent.trim();
        if (text.length <= 50) return text;
        return text.slice(0, 47) + '...';
    }

    return element.tagName.toLowerCase();
}

// Styles
const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
};

const loadingStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #aaa)',
    padding: '20px',
    textAlign: 'center',
};

const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
};

const searchIconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '12px',
    color: 'var(--SmartThemeBodyColor, #888)',
    pointerEvents: 'none',
};

const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 36px',
    backgroundColor: 'var(--SmartThemeBlurTintColor, #222)',
    border: '1px solid var(--SmartThemeBorderColor, #444)',
    borderRadius: '6px',
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontSize: '14px',
};

const clearButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: '8px',
    background: 'none',
    border: 'none',
    color: 'var(--SmartThemeBodyColor, #888)',
    cursor: 'pointer',
    padding: '4px 8px',
};

const searchResultsStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBlurTintColor, rgba(0,0,0,0.2))',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid var(--SmartThemeBorderColor, #333)',
};

const searchResultsHeaderStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '12px',
    marginBottom: '8px',
};

const noResultsStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    textAlign: 'center',
    padding: '20px',
    fontStyle: 'italic',
};

const resultsListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '300px',
    overflowY: 'auto',
};

const resultItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
};

const resultContentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
};

const resultLabelStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

const resultTabStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '11px',
    textTransform: 'capitalize',
};

const resultScoreStyle: React.CSSProperties = {
    color: 'var(--SmartThemeQuoteColor, #4CAF50)',
    fontSize: '11px',
    fontWeight: 600,
    marginLeft: '12px',
};

export default UserSettingsTabs;
