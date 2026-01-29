import React from 'react';

interface SettingsCategory {
    id: string;
    label: string;
    icon: string;
    drawerId?: string;
}

interface SettingsSidebarProps {
    categories: SettingsCategory[];
    activeCategory: string;
    onSelectCategory: (categoryId: string) => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
    categories,
    activeCategory,
    onSelectCategory
}) => {
    return (
        <div className="nemo-settings-sidebar">
            <div className="nemo-settings-sidebar-header">
                <h3 className="nemo-settings-sidebar-title">Settings</h3>
            </div>

            <nav className="nemo-settings-nav" role="tablist" aria-label="Settings categories">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        className={`nemo-settings-nav-item ${activeCategory === category.id ? 'active' : ''}`}
                        onClick={() => onSelectCategory(category.id)}
                        role="tab"
                        aria-selected={activeCategory === category.id}
                        aria-controls={`settings-panel-${category.id}`}
                    >
                        <i className={`fa-solid ${category.icon}`} />
                        <span>{category.label}</span>
                    </button>
                ))}
            </nav>

            <div className="nemo-settings-sidebar-footer">
                <span className="nemo-settings-version">NemoTavern v1.0</span>
            </div>
        </div>
    );
};

export default SettingsSidebar;
