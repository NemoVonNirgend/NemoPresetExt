/**
 * Grid item component for folders and prompts
 */
import React from 'react';
import type { GridItem as GridItemType, FolderMetadata } from '../../types/navigator';

interface GridItemProps {
    item: GridItemType;
    isSelected: boolean;
    isBulkSelected: boolean;
    isFavorite: boolean;
    onSelect: () => void;
    onDoubleClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onFavoriteToggle?: () => void;
}

export function GridItem({
    item,
    isSelected,
    isBulkSelected,
    isFavorite,
    onSelect,
    onDoubleClick,
    onContextMenu,
    onFavoriteToggle
}: GridItemProps) {
    const isFolder = item.type === 'folder';
    const folderData = isFolder ? item.data as FolderMetadata : null;
    const lastModified = folderData?.lastModified
        ? new Date(folderData.lastModified).toLocaleDateString()
        : 'N/A';

    const style: React.CSSProperties & { [key: string]: string } = {};
    if (folderData?.color) {
        style['--nemo-folder-color'] = folderData.color;
    }

    const className = [
        'grid-item',
        item.type,
        isSelected ? 'selected' : '',
        isBulkSelected ? 'bulk-selected' : ''
    ].filter(Boolean).join(' ');

    return (
        <div
            className={className}
            style={style}
            data-type={item.type}
            data-id={item.id}
            draggable
            onClick={onSelect}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            <div
                className="item-icon"
                style={folderData?.color ? { color: folderData.color } : undefined}
            >
                <i className={`fa-solid ${isFolder ? 'fa-folder' : 'fa-file-text'}`} />
            </div>

            <div className="item-name" title={`${item.name}\nModified: ${lastModified}`}>
                {item.name}
            </div>

            {!isFolder && onFavoriteToggle && (
                <button
                    className="menu_button nemo-favorite-btn"
                    title="Toggle favorite"
                    onClick={(e) => {
                        e.stopPropagation();
                        onFavoriteToggle();
                    }}
                >
                    <i className={`fa-solid fa-star ${isFavorite ? 'favorite-active' : ''}`} />
                </button>
            )}
        </div>
    );
}
