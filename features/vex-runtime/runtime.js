import { eventSource, event_types, getRequestHeaders } from '../../../../../../script.js';
import { getContext, extension_settings } from '../../../../../extensions.js';
import { promptManager } from '../../../../../openai.js';
import { createVexRuntime } from './controller.js';
import { VexStore } from './store.js';
let runtime = null, api = null, previousPreflight = null, combinedPreflight = null;
export function initializeVexRuntime() {
    if (runtime) return;
    runtime = createVexRuntime({
        events: eventSource, types: event_types, getManager: () => promptManager, getContext,
        store: new VexStore({ headers: getRequestHeaders }),
        readBody: prompt => globalThis.NemoColdPrompts?.readBody(prompt) ?? Promise.resolve(prompt.content ?? ''),
        autoExtract: () => extension_settings.NemoPresetExt?.enableVexRuntime !== false,
        notify(message, level) {
            console[level === 'error' ? 'error' : 'info']('[Nemo Vex runtime]', message);
            globalThis.toastr?.[level]?.(message, 'Nemo Engine', { preventDuplicates: true, timeOut: 10000 });
        },
    });
    const owner = runtime;
    previousPreflight = globalThis.nemoRecipeRuntimePreflight;
    const previous = previousPreflight;
    combinedPreflight = async (...args) => { if (await owner.preflight(...args)) await previous?.(...args); };
    globalThis.nemoRecipeRuntimePreflight = combinedPreflight;
    api = Object.freeze({ stage: '4/5', getStats: runtime.getStats });
    globalThis.NemoVexRuntime = api;
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
