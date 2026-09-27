import { eventSource, event_types, getRequestHeaders } from '../../../../../../script.js';
import { getContext, extension_settings } from '../../../../../extensions.js';
import { promptManager } from '../../../../../openai.js';
import { RecipeStore } from './store.js';
import { createRecipeRuntime } from './controller.js';

let runtime = null;
let publicApi = null;
const notify = (message, level) => {
    console[level === 'error' ? 'error' : 'info']('[Nemo recipe runtime]', message);
    globalThis.toastr?.[level]?.(message, 'Nemo Engine', { preventDuplicates: true, timeOut: level === 'error' ? 10000 : 5000 });
};

export function initializeRecipeRuntime() {
    if (runtime) return;
    runtime = createRecipeRuntime({
        events: eventSource, types: event_types,
        getManager: () => promptManager, getContext,
        store: new RecipeStore({ headers: getRequestHeaders }), notify,
        autoExtract: () => extension_settings.NemoPresetExt?.enableRecipeRuntime !== false,
    });
    publicApi = Object.freeze({ getStats: runtime.getStats });
    globalThis.NemoRecipeRuntime = publicApi;
    globalThis.nemoRecipeRuntimePreflight = runtime.preflight;
}

export function cleanupRecipeRuntime() {
    runtime?.dispose();
    if (globalThis.nemoRecipeRuntimePreflight === runtime?.preflight) delete globalThis.nemoRecipeRuntimePreflight;
    if (globalThis.NemoRecipeRuntime === publicApi) delete globalThis.NemoRecipeRuntime;
    publicApi = null;
    runtime = null;
}
