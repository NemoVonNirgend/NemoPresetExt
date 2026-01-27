/**
 * HelpModal - Directive documentation modal with search and categories
 */

import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { Tabs, Tab } from '../common/Tabs';
import type { DirectiveDefinition, DirectiveCategory } from '../../types/directives';
import { DIRECTIVE_CATEGORIES } from '../../types/directives';

export interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Directive definitions for documentation
const DIRECTIVES: DirectiveDefinition[] = [
    // Organization
    { name: '@tags', description: 'Add categorization tags', syntax: '@tags tag1, tag2, tag3', example: '@tags roleplay, character, personality', category: 'organization' },
    { name: '@group', description: 'Assign to a named group', syntax: '@group GroupName', example: '@group Character Prompts', category: 'organization' },
    { name: '@group-description', description: 'Description for the group', syntax: '@group-description text', category: 'organization' },
    { name: '@priority', description: 'Set display/load order (lower = first)', syntax: '@priority number', example: '@priority 10', category: 'organization' },
    { name: '@icon', description: 'FontAwesome icon class', syntax: '@icon fa-icon-name', example: '@icon fa-star', category: 'organization' },
    { name: '@color', description: 'Custom color for the prompt', syntax: '@color #hexcolor', example: '@color #FF5722', category: 'organization' },
    { name: '@badge', description: 'Small badge text', syntax: '@badge text', example: '@badge NEW', category: 'organization' },

    // Conflicts
    { name: '@exclusive-with', description: 'Cannot be enabled with specified prompts (error)', syntax: '@exclusive-with PromptName1, PromptName2', category: 'conflicts' },
    { name: '@exclusive-with-message', description: 'Custom message for exclusive conflict', syntax: '@exclusive-with-message Your message', category: 'conflicts' },
    { name: '@requires', description: 'Required dependencies (error if missing)', syntax: '@requires PromptName1, PromptName2', category: 'conflicts' },
    { name: '@requires-message', description: 'Custom message for missing dependency', syntax: '@requires-message Your message', category: 'conflicts' },
    { name: '@auto-enable-dependencies', description: 'Auto-enable required prompts', syntax: '@auto-enable-dependencies', category: 'conflicts' },
    { name: '@conflicts-with', description: 'Soft conflict (warning only)', syntax: '@conflicts-with PromptName', category: 'conflicts' },
    { name: '@conflicts-message', description: 'Custom warning message', syntax: '@conflicts-message Your message', category: 'conflicts' },
    { name: '@mutual-exclusive-group', description: 'Only one in group can be active', syntax: '@mutual-exclusive-group GroupName', category: 'conflicts' },
    { name: '@deprecated', description: 'Mark as deprecated with optional message', syntax: '@deprecated [message]', example: '@deprecated Use NewPrompt instead', category: 'conflicts' },

    // Visibility
    { name: '@hidden', description: 'Hide from the UI', syntax: '@hidden', category: 'visibility' },
    { name: '@default-enabled', description: 'Enable by default on first load', syntax: '@default-enabled', category: 'visibility' },
    { name: '@if-enabled', description: 'Only show if specified prompts are enabled', syntax: '@if-enabled PromptName1, PromptName2', category: 'visibility' },
    { name: '@if-disabled', description: 'Only show if specified prompts are disabled', syntax: '@if-disabled PromptName', category: 'visibility' },
    { name: '@if-api', description: 'Only show for specific API', syntax: '@if-api openai, claude', category: 'visibility' },

    // Documentation
    { name: '@tooltip', description: 'Hover text description', syntax: '@tooltip Your description here', category: 'documentation' },
    { name: '@help', description: 'Longer help text', syntax: '@help Detailed help text', category: 'documentation' },
    { name: '@documentation-url', description: 'Link to external docs', syntax: '@documentation-url https://...', category: 'documentation' },
    { name: '@example', description: 'Usage example', syntax: '@example Example text here', category: 'documentation' },

    // Performance
    { name: '@token-cost', description: 'Estimated token usage', syntax: '@token-cost number', example: '@token-cost 150', category: 'performance' },
    { name: '@token-cost-warn', description: 'Warning threshold for tokens', syntax: '@token-cost-warn number', category: 'performance' },
    { name: '@performance-impact', description: 'Performance classification', syntax: '@performance-impact low|medium|high', category: 'performance' },
    { name: '@model-optimized', description: 'Optimized for specific models', syntax: '@model-optimized gpt-4, claude-3', category: 'performance' },
    { name: '@model-incompatible', description: 'Not compatible with models', syntax: '@model-incompatible gpt-3.5', category: 'performance' },

    // Triggers
    { name: '@enable-at-message', description: 'Auto-enable at message count', syntax: '@enable-at-message N', example: '@enable-at-message 5', category: 'triggers' },
    { name: '@disable-at-message', description: 'Auto-disable at message count', syntax: '@disable-at-message N', example: '@disable-at-message 10', category: 'triggers' },
    { name: '@message-range', description: 'Active only within message range', syntax: '@message-range start-end', example: '@message-range 5-15', category: 'triggers' },
    { name: '@enable-after-message', description: 'Permanently enable after count', syntax: '@enable-after-message N', category: 'triggers' },
    { name: '@disable-after-message', description: 'Permanently disable after count', syntax: '@disable-after-message N', category: 'triggers' },
];

const CATEGORY_ORDER: DirectiveCategory[] = [
    'organization',
    'conflicts',
    'visibility',
    'documentation',
    'performance',
    'triggers',
];

export function HelpModal({ isOpen, onClose }: HelpModalProps): JSX.Element {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<DirectiveCategory>('organization');

    const filteredDirectives = useMemo(() => {
        if (!searchTerm.trim()) {
            return DIRECTIVES.filter(d => d.category === activeCategory);
        }

        const term = searchTerm.toLowerCase();
        return DIRECTIVES.filter(d =>
            d.name.toLowerCase().includes(term) ||
            d.description.toLowerCase().includes(term)
        );
    }, [searchTerm, activeCategory]);

    const tabs: Tab[] = CATEGORY_ORDER.map(cat => ({
        id: cat,
        label: DIRECTIVE_CATEGORIES[cat].split(' ')[0], // First word only for tab
        disabled: false,
    }));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Directive Reference"
            size="lg"
        >
            <div style={containerStyle}>
                {/* Search */}
                <div style={searchContainerStyle}>
                    <i className="fa-solid fa-search" style={searchIconStyle} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search directives..."
                        style={searchInputStyle}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} style={clearButtonStyle}>
                            <i className="fa-solid fa-times" />
                        </button>
                    )}
                </div>

                {/* Category Tabs (hidden when searching) */}
                {!searchTerm && (
                    <Tabs
                        tabs={tabs}
                        activeTab={activeCategory}
                        onChange={(id) => setActiveCategory(id as DirectiveCategory)}
                        size="sm"
                    />
                )}

                {/* Directive List */}
                <div style={directiveListStyle}>
                    {searchTerm && (
                        <div style={searchResultsStyle}>
                            Found {filteredDirectives.length} directive{filteredDirectives.length !== 1 ? 's' : ''}
                        </div>
                    )}

                    {filteredDirectives.length === 0 ? (
                        <div style={emptyStyle}>
                            No directives found matching "{searchTerm}"
                        </div>
                    ) : (
                        filteredDirectives.map((directive, i) => (
                            <DirectiveItem key={i} directive={directive} />
                        ))
                    )}
                </div>

                {/* Usage Tip */}
                <div style={tipStyle}>
                    <i className="fa-solid fa-lightbulb" style={{ marginRight: '8px', color: '#FFD54F' }} />
                    Add directives in prompt comments: <code style={codeStyle}>{'{{// @directive value }}'}</code>
                </div>
            </div>
        </Modal>
    );
}

interface DirectiveItemProps {
    directive: DirectiveDefinition;
}

function DirectiveItem({ directive }: DirectiveItemProps): JSX.Element {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div style={directiveItemStyle}>
            <div
                style={directiveHeaderStyle}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <code style={directiveNameStyle}>{directive.name}</code>
                <span style={directiveDescStyle}>{directive.description}</span>
                <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`} style={chevronStyle} />
            </div>

            {isExpanded && (
                <div style={directiveDetailsStyle}>
                    <div style={detailRowStyle}>
                        <span style={detailLabelStyle}>Syntax:</span>
                        <code style={syntaxStyle}>{directive.syntax}</code>
                    </div>
                    {directive.example && (
                        <div style={detailRowStyle}>
                            <span style={detailLabelStyle}>Example:</span>
                            <code style={exampleStyle}>{directive.example}</code>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Styles
const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: '400px',
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
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '12px',
    marginBottom: '8px',
};

const directiveListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    maxHeight: '350px',
};

const emptyStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    textAlign: 'center',
    padding: '40px 20px',
    fontStyle: 'italic',
};

const directiveItemStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--SmartThemeBorderColor, #333)',
};

const directiveHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 8px',
    cursor: 'pointer',
};

const directiveNameStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeQuoteColor, #4CAF50)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    flexShrink: 0,
};

const directiveDescStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #ccc)',
    fontSize: '13px',
    flex: 1,
};

const chevronStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '12px',
};

const directiveDetailsStyle: React.CSSProperties = {
    padding: '0 8px 12px 8px',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
};

const detailRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    alignItems: 'flex-start',
};

const detailLabelStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '12px',
    width: '60px',
    flexShrink: 0,
};

const syntaxStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBorderColor, #333)',
    color: 'var(--SmartThemeBodyColor, #fff)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
};

const exampleStyle: React.CSSProperties = {
    ...syntaxStyle,
    color: 'var(--SmartThemeQuoteColor, #81C784)',
};

const tipStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255, 213, 79, 0.1)',
    border: '1px solid rgba(255, 213, 79, 0.3)',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '12px',
    color: 'var(--SmartThemeBodyColor, #ccc)',
    display: 'flex',
    alignItems: 'center',
};

const codeStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBorderColor, #333)',
    padding: '2px 6px',
    borderRadius: '3px',
    fontFamily: 'monospace',
    marginLeft: '4px',
};

export default HelpModal;
