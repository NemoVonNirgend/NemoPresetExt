import React, { useCallback, useRef, useEffect } from 'react';
import { useNemoStore } from '../../store';
import SettingsSidebar from './SettingsSidebar';
import SettingsContent from './SettingsContent';

// Settings categories configuration
export const SETTINGS_CATEGORIES = [
    { id: 'general', label: 'General', icon: 'fa-gear' },
    { id: 'ai', label: 'AI Settings', icon: 'fa-microchip', drawerId: 'ai-config-button' },
    { id: 'connection', label: 'Connection', icon: 'fa-plug', drawerId: 'sys-settings-button' },
    { id: 'formatting', label: 'Formatting', icon: 'fa-code', drawerId: 'advanced-formatting-button' },
    { id: 'world-info', label: 'World Info', icon: 'fa-book', drawerId: 'WI-SP-button' },
    { id: 'user', label: 'User Settings', icon: 'fa-user-gear', drawerId: 'user-settings-button' },
    { id: 'backgrounds', label: 'Backgrounds', icon: 'fa-image', drawerId: 'backgrounds-button' },
    { id: 'extensions', label: 'Extensions', icon: 'fa-puzzle-piece', drawerId: 'extensions-settings-button' },
    { id: 'personas', label: 'Personas', icon: 'fa-id-card', drawerId: 'persona-management-button' },
    { id: 'theme', label: 'Theme', icon: 'fa-palette' }
];

const UnifiedSettings: React.FC = () => {
    const { settingsCategory, closeSettings, setSettingsCategory } = useNemoStore();
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            closeSettings();
        }
    }, [closeSettings]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeSettings();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeSettings]);

    // Focus trap
    useEffect(() => {
        const modal = modalRef.current;
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0] as HTMLElement;
        const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

        firstFocusable?.focus();

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable?.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable?.focus();
                }
            }
        };

        modal.addEventListener('keydown', handleTabKey);
        return () => modal.removeEventListener('keydown', handleTabKey);
    }, []);

    const currentCategory = SETTINGS_CATEGORIES.find(c => c.id === settingsCategory) || SETTINGS_CATEGORIES[0];

    return (
        <div
            className="nemo-settings-overlay nemo-animate-fade-in"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
        >
            <div
                className="nemo-settings-modal nemo-animate-scale-in"
                ref={modalRef}
            >
                <SettingsSidebar
                    categories={SETTINGS_CATEGORIES}
                    activeCategory={settingsCategory}
                    onSelectCategory={setSettingsCategory}
                />

                <div className="nemo-settings-content">
                    <div className="nemo-settings-header">
                        <div className="nemo-settings-title-wrapper">
                            <i className={`fa-solid ${currentCategory.icon}`} />
                            <h2 id="settings-title" className="nemo-settings-title">
                                {currentCategory.label}
                            </h2>
                        </div>

                        <button
                            className="nemo-panel-control close"
                            onClick={closeSettings}
                            aria-label="Close settings"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>

                    <SettingsContent
                        category={settingsCategory}
                        drawerId={currentCategory.drawerId}
                    />
                </div>
            </div>
        </div>
    );
};

export default UnifiedSettings;
