/**
 * Toolbar component with search, sort, filter, and view toggle
 */
import { useState, useRef, useEffect } from 'react';
import type { ViewMode, SortOption, FilterOption } from '../../types/navigator';

interface ToolbarProps {
    searchTerm: string;
    onSearchChange: (term: string) => void;
    viewMode: ViewMode;
    onViewModeToggle: () => void;
    currentSort: SortOption;
    onSortChange: (sort: SortOption) => void;
    currentFilter: FilterOption;
    onFilterChange: (filter: FilterOption) => void;
    onNewFolder: () => void;
    onImport: () => void;
    onLoad: () => void;
    loadDisabled: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'name-asc', label: 'Name (A-Z)' },
    { value: 'name-desc', label: 'Name (Z-A)' }
];

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
    { value: 'all', label: 'All Items' },
    { value: 'favorites', label: 'Favorites' },
    { value: 'uncategorized', label: 'Uncategorized' }
];

export function Toolbar({
    searchTerm,
    onSearchChange,
    viewMode,
    onViewModeToggle,
    currentSort,
    onSortChange,
    currentFilter,
    onFilterChange,
    onNewFolder,
    onImport,
    onLoad,
    loadDisabled
}: ToolbarProps) {
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const sortRef = useRef<HTMLButtonElement>(null);
    const filterRef = useRef<HTMLButtonElement>(null);

    // Close menus when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
                setShowSortMenu(false);
            }
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setShowFilterMenu(false);
            }
        }
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="navigator-toolbar">
            <div className="navigator-search">
                <input
                    type="text"
                    className="text_pole"
                    placeholder="Search prompts..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                {searchTerm && (
                    <button
                        className="menu_button"
                        onClick={() => onSearchChange('')}
                        title="Clear search"
                    >
                        <i className="fa-solid fa-times" />
                    </button>
                )}
            </div>

            <div className="navigator-actions">
                <button
                    className="menu_button"
                    onClick={onNewFolder}
                    title="New Folder"
                >
                    <i className="fa-solid fa-folder-plus" />
                </button>

                <button
                    ref={sortRef}
                    className="menu_button"
                    onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                    title="Sort"
                >
                    <i className="fa-solid fa-arrow-down-a-z" />
                </button>
                {showSortMenu && (
                    <div className="navigator-dropdown-menu" style={{ position: 'absolute' }}>
                        {SORT_OPTIONS.map(opt => (
                            <div
                                key={opt.value}
                                className={`dropdown-item ${currentSort === opt.value ? 'active' : ''}`}
                                onClick={() => { onSortChange(opt.value); setShowSortMenu(false); }}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                )}

                <button
                    ref={filterRef}
                    className="menu_button"
                    onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                    title="Filter"
                >
                    <i className="fa-solid fa-filter" />
                </button>
                {showFilterMenu && (
                    <div className="navigator-dropdown-menu" style={{ position: 'absolute' }}>
                        {FILTER_OPTIONS.map(opt => (
                            <div
                                key={opt.value}
                                className={`dropdown-item ${currentFilter === opt.value ? 'active' : ''}`}
                                onClick={() => { onFilterChange(opt.value); setShowFilterMenu(false); }}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                )}

                <button
                    className="menu_button"
                    onClick={onViewModeToggle}
                    title={`Switch to ${viewMode === 'grid' ? 'List' : 'Grid'} View`}
                >
                    <i className={`fa-solid ${viewMode === 'grid' ? 'fa-list' : 'fa-grip'}`} />
                </button>

                <button
                    className="menu_button"
                    onClick={onImport}
                    title="Import from Archive"
                >
                    <i className="fa-solid fa-file-import" />
                </button>

                <button
                    className="menu_button"
                    onClick={onLoad}
                    disabled={loadDisabled}
                    title="Load Selected Prompt"
                >
                    <i className="fa-solid fa-arrow-right" />
                    <span>Load</span>
                </button>
            </div>
        </div>
    );
}
