/**
 * Hook for managing Navigator state
 */
import { useState, useCallback, useMemo } from 'react';
import type {
    PathPart,
    ViewMode,
    SortOption,
    FilterOption
} from '../types/navigator';

const INITIAL_PATH: PathPart[] = [{ id: 'root', name: 'Home' }];

export function useNavigatorState() {
    const [currentPath, setCurrentPath] = useState<PathPart[]>(INITIAL_PATH);
    const [selectedPrompt, setSelectedPrompt] = useState<{ identifier: string | null; name: string | null }>({
        identifier: null,
        name: null
    });
    const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [currentSort, setCurrentSort] = useState<SortOption>('name-asc');
    const [currentFilter, setCurrentFilter] = useState<FilterOption>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Current folder ID
    const currentFolderId = useMemo(() => {
        return currentPath[currentPath.length - 1].id;
    }, [currentPath]);

    // Navigate into a folder
    const navigateToFolder = useCallback((folder: PathPart) => {
        setCurrentPath(prev => [...prev, folder]);
        setBulkSelection(new Set());
    }, []);

    // Navigate to a specific breadcrumb level
    const navigateToBreadcrumb = useCallback((index: number) => {
        setCurrentPath(prev => prev.slice(0, index + 1));
        setBulkSelection(new Set());
    }, []);

    // Reset to root
    const navigateToRoot = useCallback(() => {
        setCurrentPath(INITIAL_PATH);
        setBulkSelection(new Set());
    }, []);

    // Select a prompt
    const selectPrompt = useCallback((identifier: string, name: string) => {
        setSelectedPrompt({ identifier, name });
        setBulkSelection(new Set());
    }, []);

    // Clear selection
    const clearSelection = useCallback(() => {
        setSelectedPrompt({ identifier: null, name: null });
        setBulkSelection(new Set());
    }, []);

    // Toggle bulk selection
    const toggleBulkSelect = useCallback((id: string) => {
        setBulkSelection(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // Range select (for shift-click)
    const rangeSelect = useCallback((ids: string[]) => {
        setBulkSelection(prev => {
            const next = new Set(prev);
            ids.forEach(id => next.add(id));
            return next;
        });
    }, []);

    // Toggle view mode
    const toggleViewMode = useCallback(() => {
        setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
    }, []);

    // Update sort
    const updateSort = useCallback((sort: SortOption) => {
        setCurrentSort(sort);
    }, []);

    // Update filter
    const updateFilter = useCallback((filter: FilterOption) => {
        setCurrentFilter(filter);
    }, []);

    // Update search
    const updateSearch = useCallback((term: string) => {
        setSearchTerm(term);
    }, []);

    // Reset all state
    const reset = useCallback(() => {
        setCurrentPath(INITIAL_PATH);
        setSelectedPrompt({ identifier: null, name: null });
        setBulkSelection(new Set());
        setSearchTerm('');
    }, []);

    return {
        // State
        currentPath,
        currentFolderId,
        selectedPrompt,
        bulkSelection,
        viewMode,
        currentSort,
        currentFilter,
        searchTerm,

        // Navigation
        navigateToFolder,
        navigateToBreadcrumb,
        navigateToRoot,

        // Selection
        selectPrompt,
        clearSelection,
        toggleBulkSelect,
        rangeSelect,

        // View
        toggleViewMode,
        updateSort,
        updateFilter,
        updateSearch,

        // Reset
        reset
    };
}

export type NavigatorStateHook = ReturnType<typeof useNavigatorState>;
