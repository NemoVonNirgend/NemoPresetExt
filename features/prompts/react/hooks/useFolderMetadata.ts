/**
 * Hook for managing folder and prompt metadata (localStorage persistence)
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
    NavigatorMetadata,
    FolderMetadata,
    NavigatorPrompt,
    GridItem
} from '../types/navigator';

const METADATA_KEY = 'nemoPromptNavigatorMetadata';
const FAVORITES_KEY = 'nemo-favorite-prompts';

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function useFolderMetadata(allPrompts: NavigatorPrompt[]) {
    const [metadata, setMetadata] = useState<NavigatorMetadata>({ folders: {}, prompts: {} });
    const [favorites, setFavorites] = useState<string[]>([]);

    // Load metadata from localStorage
    useEffect(() => {
        try {
            const savedMetadata = localStorage.getItem(METADATA_KEY);
            if (savedMetadata) {
                setMetadata(JSON.parse(savedMetadata));
            }
        } catch (error) {
            console.error('[NemoPresetExt] Error loading metadata:', error);
        }

        try {
            const savedFavorites = localStorage.getItem(FAVORITES_KEY);
            if (savedFavorites) {
                setFavorites(JSON.parse(savedFavorites));
            }
        } catch (error) {
            console.error('[NemoPresetExt] Error loading favorites:', error);
        }
    }, []);

    // Ensure all prompts have metadata entries
    useEffect(() => {
        const now = new Date().toISOString();
        let updated = false;

        const newPromptMeta = { ...metadata.prompts };

        allPrompts.forEach(p => {
            if (!newPromptMeta[p.identifier]) {
                newPromptMeta[p.identifier] = { createdAt: now, lastModified: now };
                updated = true;
            }
        });

        if (updated) {
            const newMetadata = { ...metadata, prompts: newPromptMeta };
            setMetadata(newMetadata);
            localStorage.setItem(METADATA_KEY, JSON.stringify(newMetadata));
        }
    }, [allPrompts, metadata]);

    // Save metadata
    const saveMetadata = useCallback((newMetadata: NavigatorMetadata) => {
        setMetadata(newMetadata);
        localStorage.setItem(METADATA_KEY, JSON.stringify(newMetadata));
    }, []);

    // Create folder
    const createFolder = useCallback((name: string, parentId: string): FolderMetadata => {
        const now = new Date().toISOString();
        const newFolder: FolderMetadata = {
            id: generateUUID(),
            name,
            parentId,
            createdAt: now,
            lastModified: now
        };

        const newMetadata = {
            ...metadata,
            folders: { ...metadata.folders, [newFolder.id]: newFolder }
        };
        saveMetadata(newMetadata);

        return newFolder;
    }, [metadata, saveMetadata]);

    // Rename folder
    const renameFolder = useCallback((id: string, newName: string) => {
        if (!metadata.folders[id]) return;

        const now = new Date().toISOString();
        const newMetadata = {
            ...metadata,
            folders: {
                ...metadata.folders,
                [id]: { ...metadata.folders[id], name: newName, lastModified: now }
            }
        };
        saveMetadata(newMetadata);
    }, [metadata, saveMetadata]);

    // Set folder color
    const setFolderColor = useCallback((id: string, color: string) => {
        if (!metadata.folders[id]) return;

        const now = new Date().toISOString();
        const newMetadata = {
            ...metadata,
            folders: {
                ...metadata.folders,
                [id]: { ...metadata.folders[id], color, lastModified: now }
            }
        };
        saveMetadata(newMetadata);
    }, [metadata, saveMetadata]);

    // Delete folder
    const deleteFolder = useCallback((id: string) => {
        const newFolders = { ...metadata.folders };
        delete newFolders[id];

        // Unassign prompts from deleted folder
        const newPrompts = { ...metadata.prompts };
        Object.keys(newPrompts).forEach(promptId => {
            if (newPrompts[promptId].folderId === id) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { folderId: _folderId, ...rest } = newPrompts[promptId];
                newPrompts[promptId] = rest;
            }
        });

        saveMetadata({ folders: newFolders, prompts: newPrompts });
    }, [metadata, saveMetadata]);

    // Move prompt to folder
    const movePromptToFolder = useCallback((promptId: string, folderId: string | null) => {
        const now = new Date().toISOString();
        const currentMeta = metadata.prompts[promptId] || { createdAt: now, lastModified: now };

        const newPromptMeta = folderId
            ? { ...currentMeta, folderId, lastModified: now }
            : { createdAt: currentMeta.createdAt, lastModified: now };

        const newMetadata = {
            ...metadata,
            prompts: { ...metadata.prompts, [promptId]: newPromptMeta }
        };
        saveMetadata(newMetadata);
    }, [metadata, saveMetadata]);

    // Move folder to another folder
    const moveFolderToFolder = useCallback((folderId: string, parentId: string) => {
        if (!metadata.folders[folderId]) return;

        const now = new Date().toISOString();
        const newMetadata = {
            ...metadata,
            folders: {
                ...metadata.folders,
                [folderId]: { ...metadata.folders[folderId], parentId, lastModified: now }
            }
        };
        saveMetadata(newMetadata);
    }, [metadata, saveMetadata]);

    // Toggle favorite
    const toggleFavorite = useCallback((promptId: string) => {
        const newFavorites = favorites.includes(promptId)
            ? favorites.filter(id => id !== promptId)
            : [...favorites, promptId];

        setFavorites(newFavorites);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    }, [favorites]);

    // Check if favorite
    const isFavorite = useCallback((promptId: string): boolean => {
        return favorites.includes(promptId);
    }, [favorites]);

    // Get folders in a parent
    const getFoldersInParent = useCallback((parentId: string): FolderMetadata[] => {
        return Object.values(metadata.folders).filter(f => f.parentId === parentId);
    }, [metadata.folders]);

    // Get prompts in a folder (or root)
    const getPromptsInFolder = useCallback((folderId: string): NavigatorPrompt[] => {
        return allPrompts.filter(p => {
            const meta = metadata.prompts[p.identifier];
            if (folderId === 'root') {
                return !meta?.folderId;
            }
            return meta?.folderId === folderId;
        });
    }, [allPrompts, metadata.prompts]);

    // Build grid items for a folder
    const getGridItems = useCallback((
        folderId: string,
        searchTerm: string,
        filter: 'all' | 'favorites' | 'uncategorized',
        sort: 'name-asc' | 'name-desc'
    ): GridItem[] => {
        let items: GridItem[] = [];

        // Add folders
        getFoldersInParent(folderId).forEach(folder => {
            items.push({
                type: 'folder',
                id: folder.id,
                name: folder.name,
                data: folder
            });
        });

        // Add prompts
        getPromptsInFolder(folderId).forEach(prompt => {
            items.push({
                type: 'prompt',
                id: prompt.identifier,
                name: prompt.name,
                data: prompt
            });
        });

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(item => item.name.toLowerCase().includes(term));
        }

        // Filter by type
        if (filter === 'favorites') {
            items = items.filter(item =>
                item.type === 'prompt' && favorites.includes(item.id)
            );
        } else if (filter === 'uncategorized') {
            items = items.filter(item => {
                if (item.type !== 'prompt') return false;
                return !metadata.prompts[item.id]?.folderId;
            });
        }

        // Sort (folders always first)
        items.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;

            const nameCompare = a.name.localeCompare(b.name);
            return sort === 'name-desc' ? -nameCompare : nameCompare;
        });

        return items;
    }, [getFoldersInParent, getPromptsInFolder, favorites, metadata.prompts]);

    // Get all folder names (for move dialog)
    const allFolderNames = useMemo(() => {
        return Object.values(metadata.folders).map(f => f.name);
    }, [metadata.folders]);

    // Find folder by name
    const findFolderByName = useCallback((name: string): FolderMetadata | undefined => {
        return Object.values(metadata.folders).find(
            f => f.name.toLowerCase() === name.toLowerCase()
        );
    }, [metadata.folders]);

    return {
        metadata,
        favorites,

        // Folder operations
        createFolder,
        renameFolder,
        setFolderColor,
        deleteFolder,
        moveFolderToFolder,

        // Prompt operations
        movePromptToFolder,

        // Favorites
        toggleFavorite,
        isFavorite,

        // Query
        getFoldersInParent,
        getPromptsInFolder,
        getGridItems,
        allFolderNames,
        findFolderByName
    };
}

export type FolderMetadataHook = ReturnType<typeof useFolderMetadata>;
