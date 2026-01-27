/**
 * Empty state component
 */

interface EmptyStateProps {
    searchTerm: string;
}

export function EmptyState({ searchTerm }: EmptyStateProps) {
    return (
        <div className="navigator-empty-state">
            {searchTerm ? (
                <h3>No results for "{searchTerm}"</h3>
            ) : (
                <h3>This folder is empty.</h3>
            )}
        </div>
    );
}
