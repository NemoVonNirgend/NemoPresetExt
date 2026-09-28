import { eventSource, event_types, getRequestHeaders } from '../../../../../../script.js';
import { getContext, extension_settings } from '../../../../../extensions.js';
import { promptManager } from '../../../../../openai.js';
import { NemoPresetManager } from '../prompts/prompt-manager.js';
import { syncPromptMetadata } from '../directives/prompt-directives.js';
import { PromptBodyStore } from './store.js';
import { createColdPromptRuntime } from './controller.js';
import { isCold, BODY_KEY } from './format.js';

let runtime = null, api = null, clickHandler = null, archiveOriginal = null, archiveWrapper = null;
let recipePreflight = null, combinedPreflight = null, extractOriginal = null, extractWrapper = null;
const pendingClicks = new WeakSet();
function notify(message, level) {
    console[level === 'error' ? 'error' : 'info']('[Nemo prompt storage]', message);
    globalThis.toastr?.[level]?.(message, 'Nemo Engine', { preventDuplicates: true, timeOut: 8000 });
}
function editorLoading(loading, label = '') {
    const prefix = promptManager?.configuration?.prefix ?? 'completion_';
    for (const suffix of ['save', 'reset']) {
        const button = document.getElementById(`${prefix}prompt_manager_popup_entry_form_${suffix}`);
        if (button) {
            button.disabled = loading;
            button.setAttribute('aria-disabled', String(loading));
            button.style.pointerEvents = loading ? 'none' : '';
        }
    }
    const field = document.getElementById(`${prefix}prompt_manager_popup_entry_form_prompt`);
    if (field) {
        field.disabled = loading;
        field.setAttribute('aria-busy', String(loading));
        if (loading) { field.value = ''; field.placeholder = label.startsWith('Load failed:') ? label : `Loading ${label}…`; }
    }
}
export function initializeColdPrompts() {
    if (runtime) return;
    runtime = createColdPromptRuntime({
        events: eventSource, types: event_types, getManager: () => promptManager, getContext,
        store: new PromptBodyStore({ headers: getRequestHeaders }), notify, editorLoading,
        autoStore: () => extension_settings.NemoPresetExt?.enableColdPromptStorage !== false,
        sourceChanged(prompt) {
            const index = syncPromptMetadata();
            index.records.delete(prompt); // Release the previous full-body revision immediately.
        },
    });
    const owner = runtime;
    // Native toggles are replayed only after loading. Directive validation still
    // runs on the replay, including exclusivity and auto-enabled dependencies.
    clickHandler = event => {
        const button = event.target.closest?.('.prompt-manager-toggle-action');
        const row = button?.closest('[data-pm-identifier]');
        if (!row || !runtime) return;
        const prompt = promptManager.getPromptById(row.dataset.pmIdentifier);
        if (!prompt || !isCold(prompt)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (pendingClicks.has(button)) return;
        pendingClicks.add(button);
        const array = promptManager.serviceSettings.prompts;
        void owner.withBody(prompt, () => {
            if (runtime === owner && button.isConnected && promptManager.serviceSettings.prompts === array) button.click();
        }).catch(error => notify(error.message, 'error')).finally(() => pendingClicks.delete(button));
    };
    document.addEventListener('click', clickHandler, true);
    // The archive's Save Prompt action reads a source synchronously. Hydrate before
    // opening that dialog; leave its normal copy/save behavior unchanged.
    archiveOriginal = NemoPresetManager.showSavePromptDialog;
    if (typeof archiveOriginal === 'function') {
        const original = archiveOriginal;
        archiveWrapper = function (...args) {
            const id = this.selectedPromptItem?.dataset?.pmIdentifier;
            const prompt = promptManager?.getPromptById(id);
            if (!prompt?.[BODY_KEY]) return original.apply(this, args);
            const item = this.selectedPromptItem;
            return owner.withBody(prompt, () => {
                if (runtime === owner && this.selectedPromptItem === item) return original.apply(this, args);
            }).catch(error => notify(error.message, 'error'));
        };
        NemoPresetManager.showSavePromptDialog = archiveWrapper;
    }
    extractOriginal = NemoPresetManager.extractPromptData;
    if (typeof extractOriginal === 'function') {
        const original = extractOriginal;
        extractWrapper = function (element, ...args) {
            const p = promptManager?.getPromptById(element?.dataset?.pmIdentifier);
            if (p && isCold(p)) {
                const error = new Error('Load this stored prompt before copying it. Use Edit or Save Prompt.');
                notify(error.message, 'error'); throw error;
            }
            return original.call(this, element, ...args);
        };
        NemoPresetManager.extractPromptData = extractWrapper;
    }
    api = Object.freeze({ stage: '3/5', getStats: owner.getStats, readBody: owner.readBody, ready: owner.ready });
    globalThis.NemoColdPrompts = api;
    recipePreflight = globalThis.nemoRecipeRuntimePreflight;
    const previous = recipePreflight;
    combinedPreflight = async (...args) => {
        if (await owner.preflight(...args)) await previous?.(...args);
    };
    globalThis.nemoRecipeRuntimePreflight = combinedPreflight;
}
export function cleanupColdPrompts() {
    if (!runtime) return;
    document.removeEventListener('click', clickHandler, true);
    if (NemoPresetManager.showSavePromptDialog === archiveWrapper) NemoPresetManager.showSavePromptDialog = archiveOriginal;
    if (NemoPresetManager.extractPromptData === extractWrapper) NemoPresetManager.extractPromptData = extractOriginal;
    extractOriginal = null; extractWrapper = null;
    runtime.dispose();
    if (globalThis.NemoColdPrompts === api) delete globalThis.NemoColdPrompts;
    if (globalThis.nemoRecipeRuntimePreflight === combinedPreflight) {
        if (recipePreflight) globalThis.nemoRecipeRuntimePreflight = recipePreflight;
        else delete globalThis.nemoRecipeRuntimePreflight;
    }
    recipePreflight = null; combinedPreflight = null;
    runtime = null; api = null; clickHandler = null; archiveOriginal = null; archiveWrapper = null;
}
