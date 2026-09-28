import { eventSource, event_types, getRequestHeaders } from '../../../../../../script.js';
import { getContext, extension_settings } from '../../../../../extensions.js';
import { promptManager } from '../../../../../openai.js';
import { VexStore } from './store.js';
import { createVexRuntime } from './controller.js';

let runtime = null, api = null, previousPreflight = null, combinedPreflight = null;
function notify(message, level) {
    console[level === 'error' ? 'error' : 'info']('[Nemo Vex runtime]', message);
    globalThis.toastr?.[level]?.(message, 'Nemo Engine', { preventDuplicates: true, timeOut: 8000 });
}
export function initializeVexRuntime() {
    if (runtime) return;
    runtime = createVexRuntime({
        events: eventSource, types: event_types, getManager: () => promptManager, getContext,
        store: new VexStore({ headers: getRequestHeaders }), notify,
        // Called after all runtimes are initialized. Cold bodies stay authoritative.
        readBody: p => globalThis.NemoColdPrompts?.readBody(p) ?? Promise.resolve(p.content ?? ''),
        autoExtract: () => extension_settings.NemoPresetExt?.enableVexRuntime !== false,
    });
    const owner = runtime;
    api = Object.freeze({ stage: '4B/5', getStats: owner.getStats });
    globalThis.NemoVexRuntime = api;
    previousPreflight = globalThis.nemoRecipeRuntimePreflight;
    const previous = previousPreflight;
    combinedPreflight = async (...args) => {
        if (await owner.preflight(...args)) await previous?.(...args);
    };
    // The cold runtime installs last, wrapping this: cold -> Vex -> recipes.
    globalThis.nemoRecipeRuntimePreflight = combinedPreflight;
}
export function cleanupVexRuntime() {
    if (!runtime) return;
    runtime.dispose();
    if (globalThis.NemoVexRuntime === api) delete globalThis.NemoVexRuntime;
    if (globalThis.nemoRecipeRuntimePreflight === combinedPreflight) {
        if (previousPreflight) globalThis.nemoRecipeRuntimePreflight = previousPreflight;
        else delete globalThis.nemoRecipeRuntimePreflight;
    }
    runtime = null; api = null; previousPreflight = null; combinedPreflight = null;
}
