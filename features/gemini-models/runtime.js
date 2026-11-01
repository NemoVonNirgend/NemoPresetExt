import { eventSource, event_types, settings as savedSettings, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { oai_settings } from '../../../../../openai.js';
import { NEMO_EXTENSION_NAME } from '../../core/utils.js';
import { createGeminiModelsRuntime } from './controller.js';

let runtime = null;

export function initializeGeminiModels() {
    if (runtime) return;
    runtime = createGeminiModelsRuntime({
        document,
        getSettings: () => oai_settings,
        getStartupSettings: () => savedSettings?.oai_settings ?? savedSettings,
        getModelMemory: () => extension_settings[NEMO_EXTENSION_NAME]?.geminiModels,
        saveModelMemory(models) {
            const settings = extension_settings[NEMO_EXTENSION_NAME] ||= {};
            settings.geminiModels = models;
            saveSettingsDebounced();
        },
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
