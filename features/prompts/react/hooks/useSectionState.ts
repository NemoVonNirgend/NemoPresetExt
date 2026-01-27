/**
 * Hook for managing section open/closed state with persistence
 */

import { useState, useCallback, useEffect } from 'react';

// Storage key
const STORAGE_KEY = 'nemo_openSectionStates';

/**
 * Load section states from storage
 */
function loadSectionStates(): Record<string, boolean> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

/**
 * Save section states to storage
 */
function saveSectionStates(states: Record<string, boolean>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (error) {
        console.error('Error saving section states:', error);
    }
}

/**
 * Hook for section state management
 */
export function useSectionState() {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(loadSectionStates);

    // Persist on change
    useEffect(() => {
        saveSectionStates(openSections);
    }, [openSections]);

    const isOpen = useCallback((sectionKey: string): boolean => {
        return openSections[sectionKey] ?? false;
    }, [openSections]);

    const toggleSection = useCallback((sectionKey: string) => {
        setOpenSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    }, []);

    const setOpen = useCallback((sectionKey: string, open: boolean) => {
        setOpenSections(prev => ({
            ...prev,
            [sectionKey]: open
        }));
    }, []);

    const openAll = useCallback((sectionKeys: string[]) => {
        setOpenSections(prev => {
            const next = { ...prev };
            for (const key of sectionKeys) {
                next[key] = true;
            }
            return next;
        });
    }, []);

    const closeAll = useCallback((sectionKeys: string[]) => {
        setOpenSections(prev => {
            const next = { ...prev };
            for (const key of sectionKeys) {
                next[key] = false;
            }
            return next;
        });
    }, []);

    return { openSections, isOpen, toggleSection, setOpen, openAll, closeAll };
}
