import { eventSource, event_types } from '../../../../../../script.js';
import { promptManager } from '../../../../../openai.js';
import { NemoPresetManager } from '../prompts/prompt-manager.js';
import { syncPromptMetadata, clearDirectiveCache, getPromptMetadataStats } from '../directives/prompt-directives.js';
import { getPromptMetadataList } from '../../core/directive-cache.js';
import { installCommentView } from './comment-view.js';
import { PromptBodySearch } from './search-client.js';
import { installSearchUI } from './search-ui.js';

let state = null;

export function initializePromptPerformance() {
    if (state) return;
    const runtime = {
        pm: null, restoreComments: () => {}, retry: null, attempts: 0,
        listeners: [], search: new PromptBodySearch(), ui: null, api: null,
    };
    state = runtime;
    runtime.ui = installSearchUI({
        manager: NemoPresetManager,
        getRows: getPromptMetadataList,
        getSources: () => promptManager?.serviceSettings?.prompts || [],
        bodySearch: runtime.search,
    });
    const reconcile = () => {
        if (state !== runtime) return;
        syncPromptMetadata(true);
        if (promptManager && runtime.pm !== promptManager) {
            runtime.restoreComments();
            runtime.pm = promptManager;
            runtime.restoreComments = installCommentView(promptManager);
        }
    };
    const changed = () => { reconcile(); runtime.ui.refresh(); };
    for (const key of ['OAI_PRESET_CHANGED_AFTER', 'SETTINGS_UPDATED', 'CHAT_LOADED']) {
        const event = event_types[key];
        if (!event) continue;
        eventSource.on(event, changed);
        runtime.listeners.push([event, changed]);
    }
    function retry() {
        reconcile();
        if (!runtime.pm && state === runtime && runtime.attempts++ < 100) runtime.retry = setTimeout(retry, 100);
    }
    retry();
    runtime.api = Object.freeze({
        stage: '2/5',
        getStats: () => ({ metadata: getPromptMetadataStats(), search: runtime.search.diagnostics() }),
    });
    window.NemoPromptPerformance = runtime.api;
}

export function cleanupPromptPerformance() {
    if (!state) return;
    const runtime = state;
    state = null;
    clearTimeout(runtime.retry);
    for (const [event, listener] of runtime.listeners) eventSource.removeListener(event, listener);
    runtime.ui?.cleanup();
    runtime.restoreComments();
    clearDirectiveCache();
    if (window.NemoPromptPerformance === runtime.api) delete window.NemoPromptPerformance;
}
