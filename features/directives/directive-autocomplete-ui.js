/**
 * Directive suggestions implemented on SillyTavern's native autocomplete UI.
 * The adapter activates only inside Nemo directive comments, so ordinary macro
 * autocomplete remains owned by SillyTavern.
 */
import { AutoComplete } from '../../../../../autocomplete/AutoComplete.js';
import { AutoCompleteNameResult } from '../../../../../autocomplete/AutoCompleteNameResult.js';
import { AutoCompleteOption } from '../../../../../autocomplete/AutoCompleteOption.js';
import { extension_settings } from '../../../../../extensions.js';
import logger from '../../core/logger.js';
import { NEMO_EXTENSION_NAME } from '../../core/utils.js';
import { getAutocompleteSuggestions } from './directive-autocomplete.js';

const EDITOR_SELECTOR = '#completion_prompt_manager_popup_entry_form_prompt';
const instances = new Map();
let observer = null;
let enabled = false;

function resolveResult(textarea, text = textarea.value, index = textarea.selectionStart) {
    const result = getAutocompleteSuggestions(text, index);
    if (!result.suggestions?.length) return null;

    let start = result.replaceStart;
    if (result.context === 'directive-start') {
        const commentStart = text.lastIndexOf('{{//', index);
        if (commentStart >= 0) {
            start = commentStart + 4;
            while (text[start] === ' ' || text[start] === '\t') start++;
        }
    }

    return { ...result, nativeStart: start };
}

function makeNativeResult(textarea, text, index) {
    const result = resolveResult(textarea, text, index);
    if (!result) return new AutoCompleteNameResult('', index, []);

    const name = text.slice(result.nativeStart, result.replaceEnd);
    const options = result.suggestions.map(suggestion => {
        const option = new AutoCompleteOption(
            suggestion.insertText,
            suggestion.type === 'directive' ? '@' : ' ',
            'Nemo directive',
        );
        option.sortPriority = 40;
        return option;
    });
    return new AutoCompleteNameResult(name, result.nativeStart, options, false);
}

function attach(textarea) {
    if (instances.has(textarea)) return;
    const autocomplete = new AutoComplete(
        textarea,
        () => enabled && Boolean(resolveResult(textarea, autocomplete.text, textarea.selectionStart)),
        (text, index) => Promise.resolve(makeNativeResult(textarea, text, index)),
        true,
    );
    autocomplete.domWrap.dataset.nemoDirectiveAutocomplete = 'true';
    autocomplete.detailsWrap.dataset.nemoDirectiveAutocomplete = 'true';
    instances.set(textarea, autocomplete);
}

function attachAvailableEditors(root = document) {
    root.querySelectorAll(EDITOR_SELECTOR).forEach(attach);
}

export function initDirectiveAutocomplete() {
    enabled = extension_settings[NEMO_EXTENSION_NAME]?.enableDirectives === true
        && extension_settings[NEMO_EXTENSION_NAME]?.enableDirectiveAutocomplete === true;
    if (!enabled) return cleanupDirectiveAutocomplete;

    attachAvailableEditors();
    if (!observer) {
        observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof Element)) continue;
                    if (node.matches(EDITOR_SELECTOR)) attach(node);
                    attachAvailableEditors(node);
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    logger.info('Directive suggestions integrated with SillyTavern autocomplete');
    return cleanupDirectiveAutocomplete;
}

export function cleanupDirectiveAutocomplete() {
    enabled = false;
    observer?.disconnect();
    observer = null;
    for (const [textarea, autocomplete] of instances) {
        autocomplete.hide();
        if (!textarea.isConnected) instances.delete(textarea);
    }
}
