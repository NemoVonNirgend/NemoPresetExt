/**
 * DirectiveAutocompleteController - React wrapper for directive autocomplete
 * Replaces vanilla JS MutationObserver implementation with proper React lifecycle
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AutocompleteDropdown, type AutocompleteSuggestion } from './AutocompleteDropdown';
import { DirectiveHelpButton } from './DirectiveHelpButton';
import { useNemoSetting } from '../../context/NemoContext';

// Types for autocomplete module functions (loaded dynamically)
interface AutocompleteResult {
    suggestions: VanillaSuggestion[];
    context: string | null;
    replaceStart: number;
    replaceEnd: number;
    searchTerm?: string;
    definition?: any;
}

interface VanillaSuggestion {
    type: string;
    text: string;
    display: string;
    description?: string;
    insertText: string;
    definition?: any;
    promptData?: any;
    macroData?: any;
    variableData?: any;
    valueData?: any;
}

export interface DirectiveAutocompleteControllerProps {
    /** Target textarea selector */
    textareaSelector?: string;
    /** Whether autocomplete is enabled */
    enabled?: boolean;
}

/**
 * Convert vanilla suggestion to React AutocompleteSuggestion
 */
function toReactSuggestion(vanilla: VanillaSuggestion): AutocompleteSuggestion {
    // Map type to icon
    let icon: string;
    switch (vanilla.type) {
        case 'directive':
            icon = 'fa-solid fa-at';
            break;
        case 'macro':
            icon = 'fa-solid fa-code';
            break;
        case 'variable':
            icon = 'fa-solid fa-dollar-sign';
            break;
        case 'value':
            icon = 'fa-solid fa-check';
            break;
        case 'prompt':
        case 'prompt-name':
            icon = 'fa-solid fa-file-lines';
            break;
        default:
            icon = 'fa-solid fa-circle';
    }

    return {
        label: vanilla.display || vanilla.text,
        value: vanilla.insertText,
        description: vanilla.description,
        icon,
        category: vanilla.type,
    };
}

/**
 * Get cursor coordinates in textarea for positioning dropdown
 */
function getCursorCoordinates(textarea: HTMLTextAreaElement): { top: number; left: number } {
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Create a mirror div to measure text
    const mirror = document.createElement('div');
    mirror.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        word-wrap: break-word;
        font: ${window.getComputedStyle(textarea).font};
        width: ${textarea.clientWidth}px;
        padding: ${window.getComputedStyle(textarea).padding};
    `;
    mirror.textContent = text.substring(0, cursorPos);

    document.body.appendChild(mirror);

    const coordinates = {
        left: Math.min(mirror.offsetWidth, textarea.clientWidth - 300), // Prevent overflow
        top: mirror.offsetHeight,
    };

    document.body.removeChild(mirror);

    return coordinates;
}

export function DirectiveAutocompleteController({
    textareaSelector = '#completion_prompt_manager_popup_entry_form_prompt',
    enabled: enabledProp = true,
}: DirectiveAutocompleteControllerProps): JSX.Element | null {
    const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null);
    const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [currentResult, setCurrentResult] = useState<AutocompleteResult | null>(null);
    const [filterText, setFilterText] = useState('');

    const autocompleteEnabled = useNemoSetting('enableDirectiveAutocomplete');
    const isEnabled = enabledProp && (autocompleteEnabled ?? true);

    const checkIntervalRef = useRef<number | null>(null);
    const vanillaSuggestionsRef = useRef<VanillaSuggestion[]>([]);

    // Find textarea and attach listeners
    useEffect(() => {
        if (!isEnabled) return;

        const findTextarea = () => {
            const el = document.querySelector(textareaSelector) as HTMLTextAreaElement;
            if (el && el !== textarea) {
                setTextarea(el);
                if (checkIntervalRef.current) {
                    clearInterval(checkIntervalRef.current);
                    checkIntervalRef.current = null;
                }
            }
        };

        // Check immediately
        findTextarea();

        // Then poll for it (cleaner than MutationObserver on whole body)
        checkIntervalRef.current = window.setInterval(findTextarea, 1000);

        // Cleanup interval after 30 seconds
        const timeoutId = setTimeout(() => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
            }
        }, 30000);

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
            }
            clearTimeout(timeoutId);
        };
    }, [textareaSelector, isEnabled, textarea]);

    // Handle input on textarea
    const handleInput = useCallback(() => {
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const text = textarea.value;

        // Get autocomplete module from window
        const autocompleteModule = (window as any).NemoDirectiveAutocomplete;
        if (!autocompleteModule?.getAutocompleteSuggestions) {
            console.warn('[NemoPresetExt] Directive autocomplete module not loaded');
            return;
        }

        const result = autocompleteModule.getAutocompleteSuggestions(text, cursorPos);

        if (result.suggestions && result.suggestions.length > 0) {
            vanillaSuggestionsRef.current = result.suggestions;
            setSuggestions(result.suggestions.map(toReactSuggestion));
            setCurrentResult(result);
            setFilterText(result.searchTerm || '');

            // Position dropdown
            const rect = textarea.getBoundingClientRect();
            const cursorCoords = getCursorCoordinates(textarea);
            setPosition({
                top: rect.top + cursorCoords.top + 20,
                left: rect.left + cursorCoords.left,
            });
        } else {
            hideDropdown();
        }
    }, [textarea]);

    // Hide dropdown
    const hideDropdown = useCallback(() => {
        setSuggestions([]);
        setCurrentResult(null);
        vanillaSuggestionsRef.current = [];
    }, []);

    // Handle suggestion selection
    const handleSelect = useCallback((suggestion: AutocompleteSuggestion) => {
        if (!textarea || !currentResult) return;

        // Find the original vanilla suggestion
        const vanillaSuggestion = vanillaSuggestionsRef.current.find(
            s => s.insertText === suggestion.value
        );

        if (!vanillaSuggestion) return;

        // Get autocomplete module from window
        const autocompleteModule = (window as any).NemoDirectiveAutocomplete;
        if (!autocompleteModule?.insertSuggestion) return;

        // Insert the suggestion
        autocompleteModule.insertSuggestion(textarea, vanillaSuggestion, currentResult);

        // Hide dropdown
        hideDropdown();

        // Focus back on textarea
        textarea.focus();

        // Trigger refresh after a short delay
        setTimeout(() => {
            if (textarea) {
                const event = new Event('input', { bubbles: true });
                textarea.dispatchEvent(event);
            }
        }, 50);
    }, [textarea, currentResult, hideDropdown]);

    // Attach event listeners to textarea
    useEffect(() => {
        if (!textarea || !isEnabled) return;

        const onInput = () => handleInput();
        const onBlur = () => {
            // Delay to allow click on dropdown
            setTimeout(hideDropdown, 200);
        };

        textarea.addEventListener('input', onInput);
        textarea.addEventListener('blur', onBlur);

        return () => {
            textarea.removeEventListener('input', onInput);
            textarea.removeEventListener('blur', onBlur);
        };
    }, [textarea, isEnabled, handleInput, hideDropdown]);

    // Render help button always (when textarea found), dropdown only when suggestions
    return (
        <>
            {/* Help button - always rendered when enabled */}
            {isEnabled && <DirectiveHelpButton textareaSelector={textareaSelector} />}

            {/* Autocomplete dropdown - only when suggestions */}
            {suggestions.length > 0 && createPortal(
                <AutocompleteDropdown
                    suggestions={suggestions}
                    onSelect={handleSelect}
                    onClose={hideDropdown}
                    position={position}
                    filterText={filterText}
                    maxHeight={300}
                />,
                document.body
            )}
        </>
    );
}

export default DirectiveAutocompleteController;
