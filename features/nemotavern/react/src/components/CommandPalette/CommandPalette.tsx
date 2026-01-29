import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNemoStore } from '../../store';
import { filterByFuzzySearch } from '../../utils/fuzzySearch';
import CommandItem from './CommandItem';

const CommandPalette: React.FC = () => {
    const { commands, recentCommands, executeCommand, closeCommandPalette } = useNemoStore();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Filter commands based on query
    const filteredCommands = filterByFuzzySearch(
        commands,
        query,
        (cmd) => `${cmd.label} ${cmd.category}`
    );

    // Sort with recent commands first when no query
    const sortedCommands = query
        ? filteredCommands
        : [
            ...recentCommands
                .map(id => commands.find(c => c.id === id))
                .filter(Boolean),
            ...commands.filter(c => !recentCommands.includes(c.id))
          ].filter((cmd, index, arr) =>
            arr.findIndex(c => c?.id === cmd?.id) === index
          );

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const maxIndex = sortedCommands.length - 1;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev < maxIndex ? prev + 1 : 0));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : maxIndex));
                break;
            case 'Enter':
                e.preventDefault();
                const selectedCommand = sortedCommands[selectedIndex];
                if (selectedCommand) {
                    executeCommand(selectedCommand.id);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeCommandPalette();
                break;
        }
    }, [sortedCommands, selectedIndex, executeCommand, closeCommandPalette]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Scroll selected item into view
    useEffect(() => {
        const list = listRef.current;
        const selectedItem = list?.children[selectedIndex] as HTMLElement;

        if (selectedItem && list) {
            const listRect = list.getBoundingClientRect();
            const itemRect = selectedItem.getBoundingClientRect();

            if (itemRect.bottom > listRect.bottom) {
                selectedItem.scrollIntoView({ block: 'nearest' });
            } else if (itemRect.top < listRect.top) {
                selectedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            closeCommandPalette();
        }
    }, [closeCommandPalette]);

    // Group commands by category
    const groupedCommands = sortedCommands.reduce((acc, cmd) => {
        if (!cmd) return acc;
        const category = cmd.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(cmd);
        return acc;
    }, {} as Record<string, typeof commands>);

    let flatIndex = -1;

    return (
        <div
            className="nemo-command-overlay nemo-animate-fade-in"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette"
        >
            <div className="nemo-command-palette nemo-animate-scale-in">
                <input
                    ref={inputRef}
                    type="text"
                    className="nemo-command-input"
                    placeholder="Type a command..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    aria-label="Search commands"
                    autoComplete="off"
                    spellCheck={false}
                />

                <div className="nemo-command-list" ref={listRef} role="listbox">
                    {query === '' && recentCommands.length > 0 && (
                        <div className="nemo-command-category">
                            <span className="nemo-command-category-label">Recent</span>
                        </div>
                    )}

                    {Object.entries(groupedCommands).map(([category, categoryCommands]) => (
                        <div key={category}>
                            {query !== '' && (
                                <div className="nemo-command-category">
                                    <span className="nemo-command-category-label">{category}</span>
                                </div>
                            )}
                            {categoryCommands.map((cmd) => {
                                if (!cmd) return null;
                                flatIndex++;
                                const currentIndex = flatIndex;
                                return (
                                    <CommandItem
                                        key={cmd.id}
                                        command={cmd}
                                        isActive={currentIndex === selectedIndex}
                                        onClick={() => executeCommand(cmd.id)}
                                        onHover={() => setSelectedIndex(currentIndex)}
                                    />
                                );
                            })}
                        </div>
                    ))}

                    {sortedCommands.length === 0 && (
                        <div className="nemo-command-empty">
                            <span className="nemo-command-empty-text">No commands found</span>
                        </div>
                    )}
                </div>

                <div className="nemo-command-footer">
                    <span className="nemo-command-hint">
                        <kbd>↑↓</kbd> Navigate
                        <kbd>↵</kbd> Select
                        <kbd>Esc</kbd> Close
                    </span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
