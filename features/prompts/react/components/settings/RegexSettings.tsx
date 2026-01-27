/**
 * RegexSettings - Divider regex pattern configuration with live preview
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useNemoSettings } from '../../context/NemoContext';
import { getAllPrompts } from '../../utils/stBridge';

interface RegexSettingsProps {
    /** Additional CSS class */
    className?: string;
}

export function RegexSettings({ className = '' }: RegexSettingsProps): JSX.Element {
    const { settings, updateSetting } = useNemoSettings();
    const [inputValue, setInputValue] = useState(settings.dividerRegexPattern || '');
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

    // Get prompts for preview
    const prompts = useMemo(() => getAllPrompts(), []);

    // Test patterns against prompts
    const matchedPrompts = useMemo(() => {
        if (!inputValue.trim()) return [];

        try {
            const patterns = inputValue.split(',').map(p => p.trim()).filter(Boolean);
            const regexes = patterns.map(p => new RegExp(p, 'i'));

            return prompts.filter(prompt =>
                regexes.some(regex => regex.test(prompt.name))
            ).map(p => p.name);
        } catch (e) {
            return [];
        }
    }, [inputValue, prompts]);

    // Validate pattern on change
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        setStatus('idle');

        if (value.trim()) {
            try {
                value.split(',').map(p => p.trim()).filter(Boolean).forEach(p => new RegExp(p));
                setError(null);
            } catch (e) {
                setError(`Invalid regex: ${(e as Error).message}`);
            }
        } else {
            setError(null);
        }
    }, []);

    // Save pattern
    const handleSave = useCallback(() => {
        if (error) return;

        updateSetting('dividerRegexPattern', inputValue.trim());
        setStatus('saved');

        // Trigger reorganization if available
        try {
            // @ts-ignore - NemoPresetManager is a global
            if (window.NemoPresetManager?.organizePrompts) {
                window.NemoPresetManager.organizePrompts();
            }
        } catch (e) {
            console.warn('[RegexSettings] Could not trigger reorganize:', e);
        }

        setTimeout(() => setStatus('idle'), 3000);
    }, [inputValue, error, updateSetting]);

    return (
        <div className={className} style={containerStyle}>
            <div style={descriptionStyle}>
                <p>
                    Configure regex patterns to identify section dividers in your prompts.
                    Multiple patterns can be separated by commas.
                </p>
                <p style={{ fontSize: '12px', color: 'var(--SmartThemeBodyColor, #888)', marginTop: '8px' }}>
                    Example: <code style={codeStyle}>^###\s,^\[SECTION\],^---</code>
                </p>
            </div>

            <div style={inputGroupStyle}>
                <label style={labelStyle}>Divider Pattern(s):</label>
                <div style={inputRowStyle}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder="Enter regex patterns (comma-separated)"
                        style={{
                            ...inputStyle,
                            borderColor: error ? '#F44336' : 'var(--SmartThemeBorderColor, #444)',
                        }}
                    />
                    <button
                        onClick={handleSave}
                        disabled={!!error}
                        style={{
                            ...buttonStyle,
                            opacity: error ? 0.5 : 1,
                            cursor: error ? 'not-allowed' : 'pointer',
                        }}
                    >
                        <i className="fa-solid fa-save" style={{ marginRight: '6px' }} />
                        Save
                    </button>
                </div>

                {error && (
                    <div style={errorStyle}>
                        <i className="fa-solid fa-exclamation-circle" style={{ marginRight: '6px' }} />
                        {error}
                    </div>
                )}

                {status === 'saved' && !error && (
                    <div style={successStyle}>
                        <i className="fa-solid fa-check-circle" style={{ marginRight: '6px' }} />
                        Pattern saved successfully!
                    </div>
                )}
            </div>

            {/* Live Preview */}
            <div style={previewContainerStyle}>
                <h4 style={previewTitleStyle}>
                    <i className="fa-solid fa-eye" style={{ marginRight: '8px' }} />
                    Live Preview ({matchedPrompts.length} matches)
                </h4>

                {matchedPrompts.length > 0 ? (
                    <div style={matchListStyle}>
                        {matchedPrompts.slice(0, 10).map((name, i) => (
                            <div key={i} style={matchItemStyle}>
                                <i className="fa-solid fa-grip-lines" style={{ marginRight: '8px', color: 'var(--SmartThemeQuoteColor, #4CAF50)' }} />
                                {name}
                            </div>
                        ))}
                        {matchedPrompts.length > 10 && (
                            <div style={moreItemsStyle}>
                                ...and {matchedPrompts.length - 10} more
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={noMatchStyle}>
                        {inputValue.trim()
                            ? 'No prompts match the current pattern'
                            : 'Enter a pattern to see matching prompts'}
                    </div>
                )}
            </div>
        </div>
    );
}

// Styles
const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
};

const descriptionStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #ccc)',
    fontSize: '13px',
    lineHeight: 1.5,
};

const codeStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBorderColor, #333)',
    padding: '2px 6px',
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: '12px',
};

const inputGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
};

const labelStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontSize: '13px',
    fontWeight: 500,
};

const inputRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
};

const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 12px',
    backgroundColor: 'var(--SmartThemeBlurTintColor, #222)',
    border: '1px solid var(--SmartThemeBorderColor, #444)',
    borderRadius: '6px',
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontSize: '13px',
    fontFamily: 'monospace',
};

const buttonStyle: React.CSSProperties = {
    padding: '10px 16px',
    backgroundColor: 'var(--SmartThemeQuoteColor, #4CAF50)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
};

const errorStyle: React.CSSProperties = {
    color: '#F44336',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
};

const successStyle: React.CSSProperties = {
    color: '#4CAF50',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
};

const previewContainerStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBlurTintColor, rgba(0,0,0,0.2))',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid var(--SmartThemeBorderColor, #333)',
};

const previewTitleStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontSize: '13px',
    fontWeight: 500,
    margin: '0 0 10px 0',
    display: 'flex',
    alignItems: 'center',
};

const matchListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '200px',
    overflowY: 'auto',
};

const matchItemStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #ccc)',
    fontSize: '12px',
    padding: '6px 8px',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
};

const moreItemsStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '12px',
    fontStyle: 'italic',
    padding: '6px 8px',
};

const noMatchStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '12px',
    fontStyle: 'italic',
    padding: '8px 0',
};

export default RegexSettings;
