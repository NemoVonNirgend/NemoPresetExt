/**
 * SettingsPanel - Main settings UI container for NemoPresetExt
 * Provides a comprehensive settings interface with feature toggles
 */

import React, { useState } from 'react';
import { useNemoSettings } from '../../context/NemoContext';
import { FeatureToggles } from './FeatureToggles';
import { RegexSettings } from './RegexSettings';
import { Tabs, Tab } from '../common/Tabs';

interface SettingsPanelProps {
    /** Additional CSS class */
    className?: string;
}

const TABS: Tab[] = [
    { id: 'features', label: 'Features', icon: 'fa-solid fa-toggle-on' },
    { id: 'regex', label: 'Divider Patterns', icon: 'fa-solid fa-code' },
    { id: 'about', label: 'About', icon: 'fa-solid fa-info-circle' },
];

export function SettingsPanel({ className = '' }: SettingsPanelProps): JSX.Element {
    const { isLoaded } = useNemoSettings();
    const [activeTab, setActiveTab] = useState('features');

    if (!isLoaded) {
        return (
            <div style={loadingStyle}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
                Loading settings...
            </div>
        );
    }

    return (
        <div className={`nemo-settings-panel ${className}`} style={containerStyle}>
            <div style={headerStyle}>
                <h3 style={titleStyle}>
                    <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '8px' }} />
                    NemoPresetExt Settings
                </h3>
            </div>

            <Tabs
                tabs={TABS}
                activeTab={activeTab}
                onChange={setActiveTab}
                size="sm"
            >
                {activeTab === 'features' && <FeatureToggles />}
                {activeTab === 'regex' && <RegexSettings />}
                {activeTab === 'about' && <AboutSection />}
            </Tabs>
        </div>
    );
}

function AboutSection(): JSX.Element {
    return (
        <div style={aboutStyle}>
            <p style={{ marginBottom: '12px' }}>
                <strong>NemoPresetExt</strong> enhances SillyTavern with improved prompt management,
                visual organization, and advanced features.
            </p>
            <div style={versionStyle}>
                <span>Version 3.4.0</span>
                <a
                    href="https://github.com/your-repo/NemoPresetExt"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                >
                    <i className="fa-brands fa-github" /> GitHub
                </a>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--SmartThemeBodyColor, #888)', marginTop: '12px' }}>
                Some changes may require a page refresh to take effect.
            </p>
        </div>
    );
}

// Styles
const containerStyle: React.CSSProperties = {
    backgroundColor: 'var(--SmartThemeBlurTintColor, #1a1a1a)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
};

const headerStyle: React.CSSProperties = {
    marginBottom: '16px',
};

const titleStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #fff)',
    fontSize: '16px',
    fontWeight: 600,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
};

const loadingStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #aaa)',
    padding: '20px',
    textAlign: 'center',
};

const aboutStyle: React.CSSProperties = {
    color: 'var(--SmartThemeBodyColor, #ccc)',
    fontSize: '14px',
    lineHeight: 1.6,
};

const versionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    color: 'var(--SmartThemeBodyColor, #aaa)',
    fontSize: '13px',
};

const linkStyle: React.CSSProperties = {
    color: 'var(--SmartThemeQuoteColor, #4CAF50)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
};

export default SettingsPanel;
