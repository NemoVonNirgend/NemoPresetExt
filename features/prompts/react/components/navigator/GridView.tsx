/**
 * Grid/List view for items
 */
import React, { useRef, useCallback } from 'react';
import type { GridItem as GridItemType, ViewMode } from '../../types/navigator';
import { GridItem } from './GridItem';
import { EmptyState } from './EmptyState';

interface GridViewProps {
    items: GridItemType[];
    viewMode: ViewMode;
    searchTerm: string;
    selectedPromptId: string | null;
    bulkSelection: Set<string>;
    onItemSelect: (item: GridItemType, event: React.MouseEvent) => void;
    onItemDoubleClick: (item: GridItemType) => void;
    onItemContextMenu: (item: GridItemType, event: React.MouseEvent) => void;
    onFavoriteToggle: (id: string) => void;
    isFavorite: (id: string) => boolean;
}

export function GridView({
    items,
    viewMode,
    searchTerm,
    selectedPromptId,
    bulkSelection,
    onItemSelect,
    onItemDoubleClick,
    onItemContextMenu,
    onFavoriteToggle,
    isFavorite
}: GridViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastSelectedRef = useRef<string | null>(null);

    const handleItemClick = useCallback((item: GridItemType, e: React.MouseEvent) => {
        // For shift-click range selection
        if (e.shiftKey && lastSelectedRef.current) {
            const allIds = items.map(i => i.id);
            const startIdx = allIds.indexOf(lastSelectedRef.current);
            const endIdx = allIds.indexOf(item.id);
            if (startIdx !== -1 && endIdx !== -1) {
                // Range is calculated for potential bulk selection
                // Pass the range to parent - handled by onItemSelect
            }
        }

        lastSelectedRef.current = item.id;
        onItemSelect(item, e);
    }, [items, onItemSelect]);

    if (items.length === 0) {
        return <EmptyState searchTerm={searchTerm} />;
    }

    return (
        <div ref={containerRef} className={`navigator-grid-view view-mode-${viewMode}`}>
            {items.map(item => (
                <GridItem
                    key={item.id}
                    item={item}
                    isSelected={item.type === 'prompt' && selectedPromptId === item.id}
                    isBulkSelected={bulkSelection.has(item.id)}
                    isFavorite={item.type === 'prompt' && isFavorite(item.id)}
                    onSelect={() => handleItemClick(item, {} as React.MouseEvent)}
                    onDoubleClick={() => onItemDoubleClick(item)}
                    onContextMenu={(e) => onItemContextMenu(item, e)}
                    onFavoriteToggle={item.type === 'prompt' ? () => onFavoriteToggle(item.id) : undefined}
                />
            ))}
        </div>
    );
}
