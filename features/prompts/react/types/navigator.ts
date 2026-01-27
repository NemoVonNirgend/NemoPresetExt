/**
 * Navigator-specific type definitions
 */

export interface FolderMetadata {
    id: string;
    name: string;
    parentId: string;
    color?: string;
    createdAt: string;
    lastModified: string;
}

export interface PromptMetadata {
    folderId?: string;
    createdAt: string;
    lastModified: string;
}

export interface NavigatorMetadata {
    folders: Record<string, FolderMetadata>;
    prompts: Record<string, PromptMetadata>;
}

export interface PathPart {
    id: string;
    name: string;
}

export interface NavigatorPrompt {
    identifier: string;
    name: string;
    role: string;
}

export interface GridItem {
    type: 'folder' | 'prompt';
    id: string;
    name: string;
    data: FolderMetadata | NavigatorPrompt;
}

export type SortOption = 'name-asc' | 'name-desc';
export type FilterOption = 'all' | 'favorites' | 'uncategorized';
export type ViewMode = 'grid' | 'list';

export interface NavigatorState {
    currentPath: PathPart[];
    selectedPrompt: { identifier: string | null; name: string | null };
    bulkSelection: Set<string>;
    viewMode: ViewMode;
    currentSort: SortOption;
    currentFilter: FilterOption;
    searchTerm: string;
}

export interface ContextMenuAction {
    action: string;
    id: string;
    icon: string;
    label: string;
}

// Archived prompt structure for import/export
export interface ArchivedPrompt {
    name: string;
    role: string;
    content: string;
    identifier: string;
    addedAt: string;
    source: string;
}

export interface ArchivedLibrary {
    prompts: Record<string, ArchivedPrompt>;
    lastModified: string;
}

// Header selection for move-to-header feature
export interface HeaderInfo {
    element: Element;
    section: Element | null;
    name: string;
    identifier: string;
    isInSection: boolean;
}
