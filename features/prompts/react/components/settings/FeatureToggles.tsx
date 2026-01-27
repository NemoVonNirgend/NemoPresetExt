/**
 * FeatureToggles - Grid of feature toggle switches grouped by category
 */

import React, { useState } from 'react';
import { useNemoSettings } from '../../context/NemoContext';
import { Toggle } from '../common/Toggle';
import {
    NemoSettings,
    SettingMetadata,
    SettingCategory,
    DropdownStyle,
    getSettingsByCategory,
    CATEGORY_LABELS
} from '../../types/settings';

interface FeatureTogglesProps {
    /** Additional CSS class */
    className?: string;
}

// Settings that require a refresh notification
const REFRESH_REQUIRED_SETTINGS: Set<keyof NemoSettings> = new Set([
    'enablePromptManager',
    'dropdownStyle',
    'enablePresetNavigator',
    'enableDirectives',
    'enableDirectiveAutocomplete',
    'enableAnimatedBackgrounds',
    'enableTabOverhauls',
    'enableLorebookOverhaul',
    'nemoEnableExtensionsTabOverhaul',
    'nemoEnableWidePanels',
]);

export function FeatureToggles({ className = '' }: FeatureTogglesProps): JSX.Element {
    const { settings, updateSetting } = useNemoSettings();
    const [showRefreshNotice, setShowRefreshNotice] = useState(false);

    const settingsByCategory = getSettingsByCategory();

    const handleSettingChange = (key: keyof NemoSettings, value: NemoSettings[keyof NemoSettings]) => {
        updateSetting(key, value);

        if (REFRESH_REQUIRED_SETTINGS.has(key)) {
            setShowRefreshNotice(true);
        }
    };

    // Order categories
    const categoryOrder: SettingCategory[] = [
        'core',
        'directives',
        'visual',
        'ui-overhauls',
        'sections',
        'performance',
        'experimental',
    ];

    return (
        <div className={className} style={containerStyle}>
            {showRefreshNotice && (
                <div style={noticeStyle}>
                    <i className="fa-solid fa-info-circle" style={{ marginRight: '8px' }} />
                    Some changes require a page refresh to take effect.
                    <button
                        onClick={() => window.location.reload()}
                        style={refreshButtonStyle}
                    >
                        Refresh Now
                    </button>
                </div>
            )}

            {categoryOrder.map(category => {
                const categorySettings = settingsByCategory[category];
                if (!categorySettings || categorySettings.length === 0) return null;

                return (
                    <div key={category} style={categoryStyle}>
                        <h4 style={categoryTitleStyle}>
                            {CATEGORY_LABELS[category]}
                        </h4>
                        <div style={gridStyle}>
                            {categorySettings.map(setting => (
                                <SettingControl
                                    key={setting.key}
                                    setting={setting}
                                    value={settings[setting.key]}
                                    onChange={(value) => handleSettingChange(setting.key, value)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

interface SettingControlProps {
    setting: SettingMetadata;
    value: NemoSettings[keyof NemoSettings];
    onChange: (value: NemoSettings[keyof NemoSettings]) => void;
}

// Dropdown style options
const DROPDOWN_STYLE_OPTIONS: { value: DropdownStyle; label: string }[] = [
    { value: 'tray', label: 'Tray View' },
    { value: 'accordion', label: 'Accordion View' },
];

function SettingControl({ setting, value, onChange }: SettingControlProps): JSX.Element {
    // Handle dropdown style setting
    if (setting.key === 'dropdownStyle') {
        return (
            <div style={toggleItemStyle}>
                <div style={toggleInfoStyle}>
                    <span style={toggleLabelStyle}>{setting.label}</span>
                    <span style={toggleDescStyle}>{setting.description}</span>
                </div>
                <select
                    value={value as DropdownStyle}
                    onChange={(e) => onChange(e.target.value as DropdownStyle)}
                    style={selectStyle}
                >
                    {DROPDOWN_STYLE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    // Handle number settings
    if (setting.key === 'htmlTrimmingKeepCount') {
        return (
            <div style={toggleItemStyle}>
                <div style={toggleInfoStyle}>
                    <span style={toggleLabelStyle}>{setting.label}</span>
                    <span style={toggleDescStyle}>{setting.description}</span>
                </div>
                <input
                    type="number"
                    value={value as number}
                    onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
                    min={0}
                    max={50}
                    style={numberInputStyle}
                />
            </div>
        );
    }

    // Handle string settings (like regex pattern)
    if (setting.key === 'dividerRegexPattern') {
        return (
            <div style={{ ...toggleItemStyle, flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={toggleInfoStyle}>
                    <span style={toggleLabelStyle}>{setting.label}</span>
                    <span style={toggleDescStyle}>{setting.description}</span>
                </div>
                <input
                    type="text"
                    value={value as string}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Custom regex pattern..."
                    style={textInputStyle}
                />
            </div>
        );
    }

    // Handle boolean settings (default)
    if (typeof value === 'boolean') {
        return (
            <div style={toggleItemStyle}>
                <div style={toggleInfoStyle}>
                    <span style={toggleLabelStyle}>{setting.label}</span>
                    <span style={toggleDescStyle}>{setting.description}</span>
                </div>
                <Toggle
                    checked={value}
                    onChange={(checked) => onChange(checked)}
                    size="sm"
                />
            </div>
        );
    }

    // Fallback for unknown types
    return <></>;
}

// Styles
const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
};

const noticeStyle: React.CSSProperties = {
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    border: '1px solid #2196F3',
    borderRadius: '6px',
    padding: '10px 14px',
    color: 'var(--SmartThemeBodyColor, #ccc)',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
};

const refreshButtonStyle: React.CSSProperties = {
    marginLeft: 'auto',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
};

const categoryStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
};

const categoryTitleStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontSize: '13px',
    fontWeight: 600,
    margin: 0,
    paddingBottom: '6px',
    borderBottom: '1px solid var(--SmartThemeBorderColor, #333)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
};

const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '10px',
};

const toggleItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 12px',
    backgroundColor: 'var(--SmartThemeBlurTintColor, rgba(0,0,0,0.2))',
    borderRadius: '6px',
    border: '1px solid var(--SmartThemeBorderColor, #333)',
};

const toggleInfoStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
};

const toggleLabelStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontSize: '13px',
    fontWeight: 500,
};

const toggleDescStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #888)',
    fontSize: '11px',
    lineHeight: 1.3,
};

const selectStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBlurTintColor, rgba(0,0,0,0.3))',
    color: 'var(--SmartThemeBodyColor, #fff)',
    border: '1px solid var(--SmartThemeBorderColor, #444)',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '12px',
    cursor: 'pointer',
    minWidth: '120px',
};

const numberInputStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBlurTintColor, rgba(0,0,0,0.3))',
    color: 'var(--SmartThemeBodyColor, #fff)',
    border: '1px solid var(--SmartThemeBorderColor, #444)',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '12px',
    width: '70px',
    textAlign: 'center',
};

const textInputStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBlurTintColor, rgba(0,0,0,0.3))',
    color: 'var(--SmartThemeBodyColor, #fff)',
    border: '1px solid var(--SmartThemeBorderColor, #444)',
    borderRadius: '4px',
    padding: '8px 10px',
    fontSize: '12px',
    width: '100%',
    marginTop: '8px',
};

export default FeatureToggles;
