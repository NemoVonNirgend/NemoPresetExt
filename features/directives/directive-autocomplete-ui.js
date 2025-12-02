/**
 * Nemo Directive Autocomplete UI
 * Interactive autocomplete dropdown for directive editing
 *
 * @module directive-autocomplete-ui
 */

import logger from '../../core/logger.js';
import { getAutocompleteSuggestions, insertSuggestion } from './directive-autocomplete.js';
import { extension_settings } from '../../../../../extensions.js';
import { NEMO_EXTENSION_NAME } from '../../core/utils.js';

let activeTextarea = null;
let autocompleteDropdown = null;
let currentSuggestions = [];
let currentResult = null;
let selectedIndex = 0;

/**
 * Initialize autocomplete for prompt editor
 */
export function initDirectiveAutocomplete() {
    // Check if autocomplete is enabled in settings
    const isEnabled = extension_settings[NEMO_EXTENSION_NAME]?.enableDirectiveAutocomplete ?? true;
    if (!isEnabled) {
        logger.info('Directive autocomplete disabled by settings');
        return;
    }

    logger.info('Initializing directive autocomplete UI');

    // Wait for prompt editor to be available
    const checkInterval = setInterval(() => {
        const textarea = document.querySelector('#completion_prompt_manager_popup_entry_form_prompt');
        if (textarea) {
            attachAutocomplete(textarea);
            clearInterval(checkInterval);
        }
    }, 1000);

    // Stop checking after 30 seconds
    setTimeout(() => clearInterval(checkInterval), 30000);

    // Also listen for dynamic creation
    const observer = new MutationObserver(() => {
        const textarea = document.querySelector('#completion_prompt_manager_popup_entry_form_prompt');
        if (textarea && textarea !== activeTextarea) {
            attachAutocomplete(textarea);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Attach autocomplete to textarea
 */
function attachAutocomplete(textarea) {
    if (activeTextarea === textarea) {
        return;
    }

    activeTextarea = textarea;

    // Create dropdown if it doesn't exist
    if (!autocompleteDropdown) {
        createDropdown();
    }

    // Add event listeners
    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('keydown', handleKeyDown);
    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('focus', handleFocus);

    logger.info('Attached autocomplete to prompt editor textarea');
}

/**
 * Create autocomplete dropdown element
 */
function createDropdown() {
    autocompleteDropdown = document.createElement('div');
    autocompleteDropdown.className = 'nemo-autocomplete-dropdown';
    autocompleteDropdown.style.display = 'none';
    document.body.appendChild(autocompleteDropdown);

    // Click handler for suggestions
    autocompleteDropdown.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent blur on textarea
        const item = e.target.closest('.nemo-autocomplete-item');
        if (item) {
            const index = parseInt(item.dataset.index);
            selectSuggestion(index);
        }
    });
}

/**
 * Handle input event
 */
function handleInput(e) {
    const textarea = e.target;
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    // Get suggestions
    const result = getAutocompleteSuggestions(text, cursorPos);

    if (result.suggestions && result.suggestions.length > 0) {
        currentSuggestions = result.suggestions;
        currentResult = result;
        selectedIndex = 0;
        showDropdown(textarea);
    } else {
        hideDropdown();
    }
}

/**
 * Handle keydown events
 */
function handleKeyDown(e) {
    if (!autocompleteDropdown || autocompleteDropdown.style.display === 'none') {
        return;
    }

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % currentSuggestions.length;
            updateDropdownSelection();
            break;

        case 'ArrowUp':
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
            updateDropdownSelection();
            break;

        case 'Tab':
        case 'Enter':
            e.preventDefault();
            selectSuggestion(selectedIndex);
            break;

        case 'Escape':
            e.preventDefault();
            hideDropdown();
            break;
    }
}

/**
 * Handle blur event
 */
function handleBlur(e) {
    // Delay hiding to allow click on dropdown
    setTimeout(() => {
        hideDropdown();
    }, 200);
}

/**
 * Handle focus event
 */
function handleFocus(e) {
    // Don't trigger autocomplete on focus - only when user types
    // This prevents showing all prompts immediately when clicking in the editor
}

/**
 * Show autocomplete dropdown
 */
function showDropdown(textarea) {
    if (!autocompleteDropdown) return;

    // Position dropdown
    const rect = textarea.getBoundingClientRect();
    const cursorPos = getCursorCoordinates(textarea);

    autocompleteDropdown.style.left = `${rect.left + cursorPos.left}px`;
    autocompleteDropdown.style.top = `${rect.top + cursorPos.top + 20}px`;

    // Build dropdown content
    renderSuggestions();

    autocompleteDropdown.style.display = 'block';
}

/**
 * Hide autocomplete dropdown
 */
function hideDropdown() {
    if (autocompleteDropdown) {
        autocompleteDropdown.style.display = 'none';
    }
    currentSuggestions = [];
    currentResult = null;
}

/**
 * Render suggestions in dropdown
 */
function renderSuggestions() {
    if (!autocompleteDropdown) return;

    let html = '';

    currentSuggestions.forEach((suggestion, index) => {
        const isSelected = index === selectedIndex;

        // Determine icon based on suggestion type
        let iconClass, icon;
        if (suggestion.type === 'directive') {
            iconClass = 'nemo-ac-icon-directive';
            icon = '@';
        } else if (suggestion.type === 'macro') {
            iconClass = 'nemo-ac-icon-macro';
            icon = '{{}}';
        } else if (suggestion.type === 'variable') {
            iconClass = 'nemo-ac-icon-variable';
            icon = '$';
        } else if (suggestion.type === 'value') {
            iconClass = 'nemo-ac-icon-value';
            icon = '✓';
        } else {
            iconClass = 'nemo-ac-icon-prompt';
            icon = '📄';
        }

        html += `
            <div class="nemo-autocomplete-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                <div class="nemo-ac-item-header">
                    <span class="nemo-ac-icon ${iconClass}">${icon}</span>
                    <span class="nemo-ac-text">${escapeHtml(suggestion.display || suggestion.text)}</span>
                </div>
                ${suggestion.description ? `<div class="nemo-ac-description">${escapeHtml(suggestion.description)}</div>` : ''}
            </div>
        `;
    });

    // Add footer hint
    html += `
        <div class="nemo-ac-footer">
            <kbd>↑</kbd><kbd>↓</kbd> Navigate · <kbd>Tab</kbd>/<kbd>Enter</kbd> Select · <kbd>Esc</kbd> Close
        </div>
    `;

    autocompleteDropdown.innerHTML = html;

    // Scroll selected item into view within the dropdown (not the page)
    const selectedItem = autocompleteDropdown.querySelector('.selected');
    if (selectedItem) {
        // Get positions relative to dropdown
        const dropdownRect = autocompleteDropdown.getBoundingClientRect();
        const itemRect = selectedItem.getBoundingClientRect();

        // Only scroll the dropdown container, not the page
        const itemTop = itemRect.top - dropdownRect.top;
        const itemBottom = itemRect.bottom - dropdownRect.top;

        // Scroll dropdown if item is out of view
        if (itemTop < 0) {
            autocompleteDropdown.scrollTop += itemTop;
        } else if (itemBottom > autocompleteDropdown.clientHeight) {
            autocompleteDropdown.scrollTop += itemBottom - autocompleteDropdown.clientHeight;
        }
    }
}

/**
 * Update dropdown selection
 */
function updateDropdownSelection() {
    renderSuggestions();
}

/**
 * Select a suggestion
 */
function selectSuggestion(index) {
    if (!currentSuggestions[index] || !activeTextarea || !currentResult) {
        return;
    }

    const suggestion = currentSuggestions[index];

    // Insert the suggestion
    insertSuggestion(activeTextarea, suggestion, currentResult);

    // Hide dropdown
    hideDropdown();

    // Focus back on textarea
    activeTextarea.focus();

    // Trigger input event to refresh autocomplete
    setTimeout(() => {
        if (activeTextarea) {
            const event = new Event('input', { bubbles: true });
            activeTextarea.dispatchEvent(event);
        }
    }, 50);
}

/**
 * Get cursor coordinates in textarea
 */
function getCursorCoordinates(textarea) {
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Create a mirror div to measure text
    const mirror = document.createElement('div');
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.font = window.getComputedStyle(textarea).font;
    mirror.style.width = textarea.clientWidth + 'px';
    mirror.style.padding = window.getComputedStyle(textarea).padding;
    mirror.textContent = text.substring(0, cursorPos);

    document.body.appendChild(mirror);

    const coordinates = {
        left: mirror.offsetWidth,
        top: mirror.offsetHeight
    };

    document.body.removeChild(mirror);

    return coordinates;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
