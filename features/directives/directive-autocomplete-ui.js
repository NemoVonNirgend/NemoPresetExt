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
let autocompleteObserver = null;
let checkInterval = null;
let checkTimeout = null;
let blurTimeout = null;
let dispatchTimeout = null;
let autocompleteInitialized = false;

/**
 * Initialize autocomplete for prompt editor
 */
export function initDirectiveAutocomplete() {
    // Check if autocomplete is enabled in settings
    const isEnabled = extension_settings[NEMO_EXTENSION_NAME]?.enableDirectives === true
        && extension_settings[NEMO_EXTENSION_NAME]?.enableDirectiveAutocomplete === true;
    if (!isEnabled) {
        logger.info('Directive autocomplete disabled by settings');
        return cleanupDirectiveAutocomplete;
    }

    if (autocompleteInitialized) {
        return cleanupDirectiveAutocomplete;
    }
    autocompleteInitialized = true;

    logger.info('Initializing directive autocomplete UI');

    // Wait for prompt editor to be available
    checkInterval = setInterval(() => {
        const textarea = document.querySelector('#completion_prompt_manager_popup_entry_form_prompt');
        if (textarea) {
            attachAutocomplete(textarea);
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }, 1000);

    // Stop checking after 30 seconds
    checkTimeout = setTimeout(() => {
        clearInterval(checkInterval);
        checkInterval = null;
        checkTimeout = null;
    }, 30000);

    // Also listen for dynamic creation
    autocompleteObserver = new MutationObserver(() => {
        const textarea = document.querySelector('#completion_prompt_manager_popup_entry_form_prompt');
        if (textarea && textarea !== activeTextarea) {
            attachAutocomplete(textarea);
        }
    });

    autocompleteObserver.observe(document.body, { childList: true, subtree: true });
    return cleanupDirectiveAutocomplete;
}

/**
 * Attach autocomplete to textarea
 */
function attachAutocomplete(textarea) {
    if (activeTextarea === textarea) {
        return;
    }

    if (activeTextarea) {
        detachAutocomplete(activeTextarea);
    }

    activeTextarea = textarea;

    // Create dropdown if it doesn't exist
    if (!autocompleteDropdown) {
        createDropdown();
    }
    textarea.setAttribute('aria-autocomplete', 'list');
    textarea.setAttribute('aria-controls', 'nemo-directive-autocomplete');
    textarea.setAttribute('aria-expanded', 'false');

    // Add event listeners
    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('keydown', handleKeyDown);
    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('focus', handleFocus);

    logger.info('Attached autocomplete to prompt editor textarea');
}

function detachAutocomplete(textarea) {
    textarea.removeEventListener('input', handleInput);
    textarea.removeEventListener('keydown', handleKeyDown);
    textarea.removeEventListener('blur', handleBlur);
    textarea.removeEventListener('focus', handleFocus);
    textarea.removeAttribute('aria-autocomplete');
    textarea.removeAttribute('aria-controls');
    textarea.removeAttribute('aria-expanded');
    textarea.removeAttribute('aria-activedescendant');
}

/**
 * Create autocomplete dropdown element
 */
function createDropdown() {
    autocompleteDropdown = document.createElement('div');
    autocompleteDropdown.className = 'nemo-autocomplete-dropdown';
    autocompleteDropdown.style.display = 'none';
    autocompleteDropdown.id = 'nemo-directive-autocomplete';
    autocompleteDropdown.setAttribute('role', 'listbox');
    autocompleteDropdown.setAttribute('aria-label', 'Prompt directive suggestions');
    document.body.appendChild(autocompleteDropdown);

    // Click handler for suggestions
    autocompleteDropdown.addEventListener('mousedown', handleDropdownMouseDown);
}

function handleDropdownMouseDown(event) {
    event.preventDefault();
    const item = event.target.closest('.nemo-autocomplete-item');
    if (item) {
        const index = Number.parseInt(item.dataset.index, 10);
        selectSuggestion(index);
    }
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
    clearTimeout(blurTimeout);
    blurTimeout = setTimeout(() => {
        blurTimeout = null;
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

    const rect = textarea.getBoundingClientRect();
    const cursorPos = getCursorCoordinates(textarea);
    const anchorLeft = rect.left + cursorPos.left;
    const anchorTop = rect.top + cursorPos.top + 20;

    // Build dropdown content
    renderSuggestions();
    autocompleteDropdown.style.display = 'block';

    const dropdownRect = autocompleteDropdown.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - dropdownRect.width - 8);
    const left = Math.min(Math.max(8, anchorLeft), maxLeft);
    const aboveTop = rect.top + cursorPos.top - dropdownRect.height - 4;
    const fitsBelow = anchorTop + dropdownRect.height <= window.innerHeight - 8;
    const top = fitsBelow ? anchorTop : Math.max(8, aboveTop);

    autocompleteDropdown.style.left = `${left}px`;
    autocompleteDropdown.style.top = `${top}px`;
    textarea.setAttribute('aria-expanded', 'true');
    textarea.setAttribute('aria-activedescendant', `nemo-directive-option-${selectedIndex}`);
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
    activeTextarea?.setAttribute('aria-expanded', 'false');
    activeTextarea?.removeAttribute('aria-activedescendant');
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
            <div id="nemo-directive-option-${index}" class="nemo-autocomplete-item ${isSelected ? 'selected' : ''}" data-index="${index}" role="option" aria-selected="${isSelected}">
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
    activeTextarea?.setAttribute('aria-activedescendant', `nemo-directive-option-${selectedIndex}`);

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
    clearTimeout(dispatchTimeout);
    dispatchTimeout = setTimeout(() => {
        dispatchTimeout = null;
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
    const computed = window.getComputedStyle(textarea);
    const mirror = document.createElement('div');
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    mirror.style.boxSizing = computed.boxSizing;
    mirror.style.width = `${textarea.offsetWidth}px`;
    mirror.style.font = computed.font;
    mirror.style.letterSpacing = computed.letterSpacing;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.padding = computed.padding;
    mirror.style.border = computed.border;
    mirror.textContent = textarea.value.substring(0, textarea.selectionStart);

    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    mirror.appendChild(marker);

    document.body.appendChild(mirror);

    const coordinates = {
        left: marker.offsetLeft - textarea.scrollLeft,
        top: marker.offsetTop - textarea.scrollTop,
    };

    mirror.remove();

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

export function cleanupDirectiveAutocomplete() {
    autocompleteObserver?.disconnect();
    autocompleteObserver = null;

    clearInterval(checkInterval);
    checkInterval = null;
    clearTimeout(checkTimeout);
    checkTimeout = null;
    clearTimeout(blurTimeout);
    blurTimeout = null;
    clearTimeout(dispatchTimeout);
    dispatchTimeout = null;

    if (activeTextarea) {
        detachAutocomplete(activeTextarea);
        activeTextarea = null;
    }

    autocompleteDropdown?.removeEventListener('mousedown', handleDropdownMouseDown);
    autocompleteDropdown?.remove();
    autocompleteDropdown = null;
    currentSuggestions = [];
    currentResult = null;
    selectedIndex = 0;
    autocompleteInitialized = false;
}
