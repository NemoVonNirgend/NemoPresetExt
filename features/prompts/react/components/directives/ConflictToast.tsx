/**
 * ConflictToast - Displays directive conflict/validation issues
 */

import React, { useState } from 'react';
import type { ConflictIssue } from '../../types/directives';

export interface ConflictToastProps {
    /** The conflict issues to display */
    issues: ConflictIssue[];
    /** Called when user wants to resolve a conflict */
    onResolve?: (issue: ConflictIssue) => void;
    /** Called when user ignores the conflict */
    onIgnore?: () => void;
    /** Called when user cancels the action */
    onCancel?: () => void;
    /** Called when toast is dismissed */
    onDismiss?: () => void;
    /** Title override */
    title?: string;
}

export function ConflictToast({
    issues,
    onResolve,
    onIgnore,
    onCancel,
    onDismiss,
    title,
}: ConflictToastProps): JSX.Element {
    const [isExpanded, setIsExpanded] = useState(issues.length <= 3);

    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    const hasErrors = errors.length > 0;

    const displayTitle = title || (hasErrors
        ? `${errors.length} Conflict${errors.length > 1 ? 's' : ''} Found`
        : `${warnings.length} Warning${warnings.length > 1 ? 's' : ''}`);

    const headerColor = hasErrors ? '#F44336' : '#FF9800';
    const headerIcon = hasErrors ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={{ ...headerStyle, borderLeftColor: headerColor }}>
                <div style={headerContentStyle}>
                    <i className={`fa-solid ${headerIcon}`} style={{ color: headerColor, marginRight: '10px' }} />
                    <span style={titleStyle}>{displayTitle}</span>
                </div>
                <button onClick={onDismiss} style={closeButtonStyle} aria-label="Close">
                    <i className="fa-solid fa-times" />
                </button>
            </div>

            {/* Issue List */}
            <div style={issueListStyle}>
                {(isExpanded ? issues : issues.slice(0, 3)).map((issue, i) => (
                    <IssueItem
                        key={i}
                        issue={issue}
                        onResolve={onResolve ? () => onResolve(issue) : undefined}
                    />
                ))}

                {!isExpanded && issues.length > 3 && (
                    <button
                        onClick={() => setIsExpanded(true)}
                        style={expandButtonStyle}
                    >
                        Show {issues.length - 3} more...
                    </button>
                )}
            </div>

            {/* Actions */}
            <div style={actionsStyle}>
                {hasErrors ? (
                    <>
                        <button onClick={onCancel} style={cancelButtonStyle}>
                            Cancel Action
                        </button>
                        {onResolve && errors.length === 1 && (
                            <button
                                onClick={() => onResolve(errors[0])}
                                style={resolveButtonStyle}
                            >
                                <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '6px' }} />
                                Auto-Resolve
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <button onClick={onIgnore} style={ignoreButtonStyle}>
                            Ignore Warnings
                        </button>
                        <button onClick={onCancel} style={cancelButtonStyle}>
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

interface IssueItemProps {
    issue: ConflictIssue;
    onResolve?: () => void;
}

function IssueItem({ issue, onResolve }: IssueItemProps): JSX.Element {
    const isError = issue.severity === 'error';
    const icon = getIssueIcon(issue.type);
    const color = isError ? '#F44336' : '#FF9800';

    return (
        <div style={issueItemStyle}>
            <i className={`fa-solid ${icon}`} style={{ color, marginRight: '10px', flexShrink: 0 }} />
            <div style={issueContentStyle}>
                <div style={issueMessageStyle}>
                    {issue.customMessage || issue.message}
                </div>
                <div style={issueDetailsStyle}>
                    <span style={promptTagStyle}>{issue.promptName}</span>
                    {issue.conflictingPromptName && (
                        <>
                            <span style={{ margin: '0 6px' }}>↔</span>
                            <span style={promptTagStyle}>{issue.conflictingPromptName}</span>
                        </>
                    )}
                </div>
            </div>
            {onResolve && isError && (
                <button onClick={onResolve} style={itemResolveStyle} title="Disable conflicting prompt">
                    <i className="fa-solid fa-toggle-off" />
                </button>
            )}
        </div>
    );
}

function getIssueIcon(type: ConflictIssue['type']): string {
    switch (type) {
        case 'exclusive': return 'fa-ban';
        case 'missing-dependency': return 'fa-link-slash';
        case 'category-limit': return 'fa-layer-group';
        case 'mutual-exclusive-group': return 'fa-object-ungroup';
        case 'soft-conflict': return 'fa-triangle-exclamation';
        case 'deprecated': return 'fa-clock-rotate-left';
        default: return 'fa-circle-exclamation';
    }
}

// Styles
const containerStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBlurTintColor, #1a1a1a)',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
    maxWidth: '450px',
    overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderLeft: '4px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
};

const headerContentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
};

const titleStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontWeight: 600,
    fontSize: '14px',
};

const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--SmartThemeBodyColor, #888)',
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: '14px',
};

const issueListStyle: React.CSSProperties = {
    padding: '12px 16px',
    maxHeight: '250px',
    overflowY: 'auto',
};

const issueItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '10px 0',
    borderBottom: '1px solid var(--SmartThemeBorderColor, #333)',
};

const issueContentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
};

const issueMessageStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #ccc)',
    fontSize: '13px',
    marginBottom: '4px',
};

const issueDetailsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '4px',
};

const promptTagStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBorderColor, #333)',
    color: 'var(--SmartThemeBodyColor, #aaa)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
};

const itemResolveStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--SmartThemeBodyColor, #888)',
    cursor: 'pointer',
    padding: '4px 8px',
    marginLeft: '8px',
};

const expandButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--SmartThemeQuoteColor, #4CAF50)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '8px 0',
    width: '100%',
    textAlign: 'left',
};

const actionsStyle: React.CSSProperties = {
    padding: '12px 16px',
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    borderTop: '1px solid var(--SmartThemeBorderColor, #333)',
};

const cancelButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: 'var(--SmartThemeBorderColor, #444)',
    color: 'var(--SmartThemeBodyColor, #ccc)',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
};

const ignoreButtonStyle: React.CSSProperties = {
    ...cancelButtonStyle,
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    color: '#FF9800',
};

const resolveButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: 'var(--SmartThemeQuoteColor, #4CAF50)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
};

export default ConflictToast;
