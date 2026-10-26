import { getContext, extension_settings } from '../../../../../extensions.js';
import { createReSwipeRuntime } from './controller.js';

let runtime = null;
let previousPreflight = null;

export function initializeReSwipe() {
    if (runtime) return;
    previousPreflight = globalThis.nemoRecipeRuntimePreflight;
    runtime = createReSwipeRuntime({
        previousPreflight,
        getContext,
        getSettings: () => extension_settings.NemoPresetExt,
    });
    globalThis.nemoRecipeRuntimePreflight = runtime.preflight;
}

export function cleanupReSwipe() {
    if (!runtime) return;
    runtime.dispose();
    if (globalThis.nemoRecipeRuntimePreflight === runtime.preflight) {
        if (previousPreflight) globalThis.nemoRecipeRuntimePreflight = previousPreflight;
        else delete globalThis.nemoRecipeRuntimePreflight;
    }
    runtime = null;
    previousPreflight = null;
}
