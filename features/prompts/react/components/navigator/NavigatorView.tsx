/**
 * Main Navigator View component - file browser for prompts
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { GridItem as GridItemType, NavigatorPrompt } from '../../types/navigator';
import type { ContextMenuItem } from './ContextMenu';
import { useNavigatorState } from '../../hooks/useNavigatorState';
import { useFolderMetadata } from '../../hooks/useFolderMetadata';
import { Breadcrumbs } from './Breadcrumbs';
import { Toolbar } from './Toolbar';
import { GridView } from './GridView';
import { FavoritesSidebar } from './FavoritesSidebar';
import { ContextMenu } from './ContextMenu';

// Debounce utility
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    let timeout: ReturnType<typeof setTimeout>;
    return ((...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    }) as T;
}

// SillyTavern popup API
declare const callGenericPopup: (content: any, type: string, title?: string, options?: any) => Promise<any>;
declare const POPUP_TYPE: { INPUT: string; CONFIRM: string; DISPLAY: string };

// Import safe prompt manager accessor
import { getPromptManager } from '../../utils/stBridge';

interface NavigatorViewProps {
    onClose?: () => void;
}

export function NavigatorView({ onClose }: NavigatorViewProps) {
    const [allPrompts, setAllPrompts] = useState<NavigatorPrompt[]>([]);
    const [contextMenu, setContextMenu] = useState<{
        items: ContextMenuItem[];
        position: { x: number; y: number };
    } | null>(null);

    const state = useNavigatorState();
    const folders = useFolderMetadata(allPrompts);

    // Fetch prompts from ST's DOM
    const fetchPrompts = useCallback(() => {
        const container = document.querySelector('#completion_prompt_manager_list');
        if (!container) return;

        const promptItems = container.querySelectorAll('li.completion_prompt_manager_prompt');
        const prompts: NavigatorPrompt[] = [];

        promptItems.forEach((item) => {
            const nameLink = item.querySelector('span.completion_prompt_manager_prompt_name a');
            const promptName = nameLink ? nameLink.textContent?.trim() || '' : '';
            const identifier = (item as HTMLElement).dataset.pmIdentifier || '';
            const role = (item as HTMLElement).dataset.pmRole || '';

            if (promptName && identifier) {
                prompts.push({ identifier, name: promptName, role });
            }
        });

        setAllPrompts(prompts);
    }, []);

    // Load prompts on mount
    useEffect(() => {
        fetchPrompts();
    }, [fetchPrompts]);

    // Get grid items for current view
    const gridItems = useMemo(() => {
        return folders.getGridItems(
            state.currentFolderId,
            state.searchTerm,
            state.currentFilter,
            state.currentSort
        );
    }, [folders, state.currentFolderId, state.searchTerm, state.currentFilter, state.currentSort]);

    // Debounced search
    const debouncedSearch = useMemo(
        () => debounce((term: string) => state.updateSearch(term), 250),
        [state]
    );

    // Handle item selection
    const handleItemSelect = useCallback((item: GridItemType, e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey) {
            state.toggleBulkSelect(item.id);
        } else if (e.shiftKey) {
            // Range selection handled in GridView
        } else {
            state.clearSelection();
            if (item.type === 'folder') {
                state.navigateToFolder({ id: item.id, name: item.name });
            } else {
                state.selectPrompt(item.id, item.name);
            }
        }
    }, [state]);

    // Handle double-click
    const handleItemDoubleClick = useCallback((item: GridItemType) => {
        if (item.type === 'prompt') {
            state.selectPrompt(item.id, item.name);
            loadSelectedPrompt(item.id);
        }
    }, [state]);

    // Load selected prompt
    const loadSelectedPrompt = useCallback((identifier?: string) => {
        const id = identifier || state.selectedPrompt.identifier;
        if (!id) return;

        const promptEl = document.querySelector(`li[data-pm-identifier="${id}"]`);
        if (promptEl) {
            const inspectLink = promptEl.querySelector('a.prompt-manager-inspect-action');
            if (inspectLink) {
                (inspectLink as HTMLElement).click();
                onClose?.();
            }
        }
    }, [state.selectedPrompt.identifier, onClose]);

    // Handle context menu
    const handleContextMenu = useCallback((item: GridItemType, e: React.MouseEvent) => {
        e.preventDefault();

        let items: ContextMenuItem[] = [];

        if (item.type === 'folder') {
            items = [
                { action: 'rename_folder', id: item.id, icon: 'fa-i-cursor', label: 'Rename' },
                { action: 'set_folder_color', id: item.id, icon: 'fa-palette', label: 'Set Color' },
                { action: 'delete_folder', id: item.id, icon: 'fa-trash-can', label: 'Delete' }
            ];
        } else {
            const isFav = folders.isFavorite(item.id);
            items = [
                {
                    action: isFav ? 'unfavorite' : 'favorite',
                    id: item.id,
                    icon: isFav ? 'fa-star-half-stroke' : 'fa-star',
                    label: isFav ? 'Remove from Favorites' : 'Add to Favorites'
                },
                { action: 'add_to_archive', id: item.id, icon: 'fa-archive', label: 'Add to Archive' },
                { action: 'move_to_header', id: item.id, icon: 'fa-arrow-up', label: 'Move to Header' },
                { action: 'add_to_folder', id: item.id, icon: 'fa-folder-plus', label: 'Move to Folder...' }
            ];
        }

        setContextMenu({
            items,
            position: { x: e.clientX, y: e.clientY }
        });
    }, [folders]);

    // Handle context menu action
    const handleContextAction = useCallback(async (action: string, id: string) => {
        switch (action) {
            case 'favorite':
            case 'unfavorite':
                folders.toggleFavorite(id);
                break;

            case 'rename_folder': {
                const folder = folders.metadata.folders[id];
                if (!folder) return;
                const newName = await callGenericPopup('Enter new folder name:', POPUP_TYPE.INPUT, folder.name);
                if (newName && newName.trim() && newName !== folder.name) {
                    folders.renameFolder(id, newName.trim());
                }
                break;
            }

            case 'set_folder_color': {
                try {
                    const { showColorPickerPopup } = await import('../../../../../utils.js' as any);
                    const folder = folders.metadata.folders[id];
                    if (!folder) return;
                    const color = await showColorPickerPopup(folder.color || '', 'Select Folder Color');
                    if (color !== null) {
                        folders.setFolderColor(id, color);
                    }
                } catch (error) {
                    console.error('[NemoPresetExt] Error loading color picker:', error);
                }
                break;
            }

            case 'delete_folder': {
                const folder = folders.metadata.folders[id];
                if (!folder) return;
                const confirmed = await callGenericPopup(
                    `Delete "${folder.name}"? Prompts inside will become unassigned.`,
                    POPUP_TYPE.CONFIRM
                );
                if (confirmed) {
                    folders.deleteFolder(id);
                }
                break;
            }

            case 'add_to_folder': {
                const folderNames = folders.allFolderNames.join(', ');
                if (!folderNames) {
                    callGenericPopup('No folders created yet. Create a folder first.', 'info');
                    return;
                }
                const targetName = await callGenericPopup(
                    `Enter folder name to move to:\n(${folderNames})`,
                    POPUP_TYPE.INPUT
                );
                const targetFolder = folders.findFolderByName(targetName);
                if (targetFolder) {
                    folders.movePromptToFolder(id, targetFolder.id);
                } else if (targetName) {
                    callGenericPopup(`Folder "${targetName}" not found.`, 'error');
                }
                break;
            }

            case 'add_to_archive': {
                const prompt = allPrompts.find(p => p.identifier === id);
                if (!prompt) {
                    callGenericPopup('Prompt not found', 'error');
                    return;
                }

                const pm = getPromptManager();
                if (pm?.serviceSettings?.prompts) {
                    const promptData = pm.serviceSettings.prompts.find(
                        (p: any) => p.identifier === id
                    );
                    if (!promptData) {
                        callGenericPopup('Prompt data not found', 'error');
                        return;
                    }

                    const existingLibrary = JSON.parse(
                        localStorage.getItem('nemoPromptSnapshotData') || '{}'
                    );
                    const library = existingLibrary.prompts || {};

                    let promptKey = prompt.name;
                    let counter = 1;
                    while (library[promptKey]) {
                        promptKey = `${prompt.name} (${counter})`;
                        counter++;
                    }

                    library[promptKey] = {
                        name: prompt.name,
                        role: prompt.role || 'user',
                        content: promptData.content || '',
                        identifier: prompt.identifier,
                        addedAt: new Date().toISOString(),
                        source: 'prompt-navigator'
                    };

                    localStorage.setItem('nemoPromptSnapshotData', JSON.stringify({
                        ...existingLibrary,
                        prompts: library,
                        lastModified: new Date().toISOString()
                    }));

                    callGenericPopup(`Prompt "${prompt.name}" added to archive successfully!`, 'success');
                }
                break;
            }

            case 'move_to_header':
                // This would require the header selection dialog
                callGenericPopup('Move to header feature requires additional UI implementation.', 'info');
                break;
        }
    }, [folders, allPrompts]);

    // Create new folder
    const handleNewFolder = useCallback(async () => {
        const name = await callGenericPopup('New Folder Name:', POPUP_TYPE.INPUT, 'New Folder');
        if (name && name.trim()) {
            folders.createFolder(name.trim(), state.currentFolderId);
        }
    }, [folders, state.currentFolderId]);

    // Show import dialog
    const handleImport = useCallback(async () => {
        const libraryData = localStorage.getItem('nemoPromptSnapshotData');
        if (!libraryData) {
            callGenericPopup('No archived prompts found to import', 'info');
            return;
        }

        const library = JSON.parse(libraryData);
        const prompts = library.prompts || {};
        const promptNames = Object.keys(prompts);

        if (promptNames.length === 0) {
            callGenericPopup('No archived prompts found to import', 'info');
            return;
        }

        callGenericPopup(
            `Found ${promptNames.length} archived prompts. Import functionality requires additional UI implementation.`,
            'info'
        );
    }, []);

    return (
        <div className="nemo-prompt-navigator-content-wrapper">
            <Breadcrumbs
                path={state.currentPath}
                onNavigate={state.navigateToBreadcrumb}
            />

            <Toolbar
                searchTerm={state.searchTerm}
                onSearchChange={debouncedSearch}
                viewMode={state.viewMode}
                onViewModeToggle={state.toggleViewMode}
                currentSort={state.currentSort}
                onSortChange={state.updateSort}
                currentFilter={state.currentFilter}
                onFilterChange={state.updateFilter}
                onNewFolder={handleNewFolder}
                onImport={handleImport}
                onLoad={() => loadSelectedPrompt()}
                loadDisabled={!state.selectedPrompt.identifier}
            />

            <div className="navigator-content">
                <GridView
                    items={gridItems}
                    viewMode={state.viewMode}
                    searchTerm={state.searchTerm}
                    selectedPromptId={state.selectedPrompt.identifier}
                    bulkSelection={state.bulkSelection}
                    onItemSelect={handleItemSelect}
                    onItemDoubleClick={handleItemDoubleClick}
                    onItemContextMenu={handleContextMenu}
                    onFavoriteToggle={folders.toggleFavorite}
                    isFavorite={folders.isFavorite}
                />

                <FavoritesSidebar
                    favorites={folders.favorites}
                    allPrompts={allPrompts}
                    selectedPromptId={state.selectedPrompt.identifier}
                    onSelect={state.selectPrompt}
                    onDoubleClick={loadSelectedPrompt}
                    onRemove={folders.toggleFavorite}
                />
            </div>

            {contextMenu && (
                <ContextMenu
                    items={contextMenu.items}
                    position={contextMenu.position}
                    onAction={handleContextAction}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}
