import { eventSource, event_types, settings as savedSettings, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { oai_settings } from '../../../../../openai.js';
import { NEMO_EXTENSION_NAME } from '../../core/utils.js';
import { createResponseTokensRuntime } from './controller.js';

let runtime = null;

export function initializeResponseTokens() {
    if (runtime) return;
    runtime = createResponseTokensRuntime({
        events: eventSource,
        types: event_types,
        getSettings: () => oai_settings,
        getStartupSettings: () => savedSettings?.oai_settings ?? savedSettings,
        getMemory: () => extension_settings[NEMO_EXTENSION_NAME]?.responseTokens,
        getDisplayedTokens: () => Number($('#openai_max_tokens').val()),
        saveMemory(value) {
            const settings = extension_settings[NEMO_EXTENSION_NAME] ||= {};
            settings.responseTokens = value;
            saveSettingsDebounced();
        },
        writeTokens(value) {
            oai_settings.openai_max_tokens = value;
            $('#openai_max_tokens').val(value).trigger('input', { source: 'nemo-response-tokens' });
            saveSettingsDebounced();
        },
        subscribeInput(handler) {
            const events = 'input.nemoResponseTokens change.nemoResponseTokens';
            const selector = '#openai_max_tokens';
            const listener = (event, data) => handler(event.target.value, {
                source: data?.source,
                user: event.originalEvent?.isTrusted === true,
            });
            $(document).on(events, selector, listener);
            return () => $(document).off(events, selector, listener);
        },
    });
}

export function cleanupResponseTokens() {
    runtime?.dispose();
    runtime = null;
}
