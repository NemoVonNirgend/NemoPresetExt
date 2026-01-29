import React, { useRef, useEffect } from 'react';
import { moveContentToPanel, returnContentToDrawer } from '../../utils/contentPortal';

interface SettingsContentProps {
    category: string;
    drawerId?: string;
}

const SettingsContent: React.FC<SettingsContentProps> = ({ category, drawerId }) => {
    const contentRef = useRef<HTMLDivElement>(null);

    // Handle drawer content portaling
    useEffect(() => {
        if (drawerId && contentRef.current) {
            // Clear previous content
            contentRef.current.innerHTML = '';

            // Move drawer content to settings panel
            moveContentToPanel(drawerId, contentRef.current);
        }

        return () => {
            if (drawerId) {
                returnContentToDrawer(drawerId);
            }
        };
    }, [drawerId, category]);

    // Render different content based on category
    const renderContent = () => {
        switch (category) {
            case 'general':
                return (
                    <div className="nemo-settings-general">
                        <section className="nemo-settings-section">
                            <h3>Appearance</h3>
                            <p className="nemo-settings-description">
                                Customize the look and feel of your NemoTavern experience.
                            </p>
                            <div className="nemo-settings-option">
                                <label>
                                    <input type="checkbox" defaultChecked />
                                    <span>Enable animations</span>
                                </label>
                            </div>
                            <div className="nemo-settings-option">
                                <label>
                                    <input type="checkbox" defaultChecked />
                                    <span>Show command palette hint</span>
                                </label>
                            </div>
                        </section>

                        <section className="nemo-settings-section">
                            <h3>Quick Access</h3>
                            <p className="nemo-settings-description">
                                Configure the toolbar buttons for quick access to your favorite features.
                            </p>
                        </section>

                        <section className="nemo-settings-section">
                            <h3>Keyboard Shortcuts</h3>
                            <div className="nemo-settings-shortcuts">
                                <div className="nemo-shortcut-row">
                                    <span className="nemo-shortcut-label">Command Palette</span>
                                    <kbd>⌘K</kbd>
                                </div>
                                <div className="nemo-shortcut-row">
                                    <span className="nemo-shortcut-label">Settings</span>
                                    <kbd>⌘,</kbd>
                                </div>
                                <div className="nemo-shortcut-row">
                                    <span className="nemo-shortcut-label">Close Modal</span>
                                    <kbd>Esc</kbd>
                                </div>
                            </div>
                        </section>
                    </div>
                );

            case 'theme':
                return (
                    <div className="nemo-settings-theme">
                        <section className="nemo-settings-section">
                            <h3>Theme Options</h3>
                            <p className="nemo-settings-description">
                                You're currently using the NemoTavern theme with glassmorphism effects.
                            </p>

                            <div className="nemo-settings-option">
                                <label>Background Blur Intensity</label>
                                <input type="range" min="0" max="40" defaultValue="20" />
                            </div>

                            <div className="nemo-settings-option">
                                <label>Accent Color</label>
                                <div className="nemo-color-options">
                                    <button className="nemo-color-swatch active" style={{ background: '#6366f1' }} title="Indigo" />
                                    <button className="nemo-color-swatch" style={{ background: '#8b5cf6' }} title="Purple" />
                                    <button className="nemo-color-swatch" style={{ background: '#ec4899' }} title="Pink" />
                                    <button className="nemo-color-swatch" style={{ background: '#14b8a6' }} title="Teal" />
                                    <button className="nemo-color-swatch" style={{ background: '#f59e0b' }} title="Amber" />
                                </div>
                            </div>
                        </section>
                    </div>
                );

            default:
                // For categories with drawer content, just render the container
                if (drawerId) {
                    return (
                        <div
                            className="nemo-settings-drawer-content"
                            ref={contentRef}
                        />
                    );
                }

                return (
                    <div className="nemo-settings-placeholder">
                        <p>Settings for {category}</p>
                    </div>
                );
        }
    };

    return (
        <div
            className="nemo-settings-body"
            role="tabpanel"
            id={`settings-panel-${category}`}
            aria-labelledby={`settings-tab-${category}`}
        >
            {renderContent()}
        </div>
    );
};

export default SettingsContent;
