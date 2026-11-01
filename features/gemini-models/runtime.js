import { eventSource, event_types } from '../../../../../../script.js';
import { oai_settings } from '../../../../../openai.js';
import { createGeminiModelsRuntime } from './controller.js';

let runtime = null;

export function initializeGeminiModels() {
    if (runtime) return;
    runtime = createGeminiModelsRuntime({
        document,
        getSettings: () => oai_settings,
        // Use the host's jQuery change path, including normal model persistence.
        notifyChange: select => $(select).trigger('change'),
        Observer: globalThis.MutationObserver,
        events: eventSource,
        types: event_types,
    });
}

export function cleanupGeminiModels() {
    runtime?.dispose();
    runtime = null;
}
