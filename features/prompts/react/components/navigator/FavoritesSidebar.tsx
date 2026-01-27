/**
 * Favorites sidebar component
 */
import type { NavigatorPrompt } from '../../types/navigator';

interface FavoritesSidebarProps {
    favorites: string[];
    allPrompts: NavigatorPrompt[];
    selectedPromptId: string | null;
    onSelect: (identifier: string, name: string) => void;
    onDoubleClick: (identifier: string) => void;
    onRemove: (identifier: string) => void;
}

export function FavoritesSidebar({
    favorites,
    allPrompts,
    selectedPromptId,
    onSelect,
    onDoubleClick,
    onRemove
}: FavoritesSidebarProps) {
    const favoritePrompts = favorites
        .map(id => allPrompts.find(p => p.identifier === id))
        .filter((p): p is NavigatorPrompt => p !== undefined);

    return (
        <div className="navigator-favorites-sidebar">
            <h4>Favorites</h4>
            <div className="navigator-favorites-list">
                {favoritePrompts.length === 0 ? (
                    <div className="no-favorites">No favorites yet</div>
                ) : (
                    favoritePrompts.map(prompt => (
                        <div
                            key={prompt.identifier}
                            className={`navigator-favorite-item ${selectedPromptId === prompt.identifier ? 'selected' : ''}`}
                            onClick={() => onSelect(prompt.identifier, prompt.name)}
                            onDoubleClick={() => onDoubleClick(prompt.identifier)}
                        >
                            <div className="favorite-item-icon">
                                <i className="fa-solid fa-file-text" />
                            </div>
                            <div className="favorite-item-name" title={prompt.name}>
                                {prompt.name}
                            </div>
                            <button
                                className="favorite-remove-btn"
                                title="Remove from favorites"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(prompt.identifier);
                                }}
                            >
                                <i className="fa-solid fa-times" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
