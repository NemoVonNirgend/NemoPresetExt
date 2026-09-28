import { eventSource, event_types, saveSettingsDebounced } from '../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../extensions.js';
import { promptManager } from '../../../../../openai.js';
import { NemoPresetManager } from '../prompts/prompt-manager.js';
import storage from '../../core/storage-migration.js';
import { installIncrementalRendering } from './incremental.js';
import { installStateSnapshots } from './state-snapshots.js';

let state = null;
const KEY = 'enableIncrementalPromptRendering';
export function initializePromptRendering() {
    if (state) return;
    const current = { controller: null, pm: null, retry: null, attempts: 0, listeners: [], api: null, uiOriginal: null, uiWrapper: null };
    state = current;
    current.snapshots = installStateSnapshots({ manager: NemoPresetManager, getManager: () => promptManager,
        getApi: () => getContext()?.mainApi, storage,
        report: error => console.warn('[Nemo prompt state]', error) });
    const enabled = () => extension_settings.NemoPresetExt?.enablePromptManager !== false
        && extension_settings.NemoPresetExt?.[KEY] !== false;
    const notify = error => console.warn('[Nemo incremental rendering] Using native rendering:', error);
    function checkbox() {
        const parent = document.getElementById('nemoSearchAndStatusWrapper');
        if (!parent) return;
        let label = parent.querySelector('[data-nemo-incremental-control]');
        if (!label) {
            label = document.createElement('label');
            label.className = 'checkbox_label';
            label.dataset.nemoIncrementalControl = 'true';
            label.title = 'Reuse unchanged prompt rows in accordion/flat view. Tray mode and unsupported renderers keep native rendering. Closed rows are not unloaded in Stage 5A.';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.setAttribute('aria-label', 'Incremental prompt rendering');
            const text = document.createElement('small');
            text.textContent = 'Incremental prompt rendering';
            label.append(input, text);
            input.addEventListener('change', () => {
                extension_settings.NemoPresetExt ??= {};
                extension_settings.NemoPresetExt[KEY] = input.checked;
                saveSettingsDebounced();
                current.controller?.reset();
                current.controller?.redraw();
            });
            parent.appendChild(label);
        }
        label.querySelector('input').checked = enabled();
    }
    if (typeof NemoPresetManager.createSearchAndStatusUI === 'function') {
        current.uiOriginal = NemoPresetManager.createSearchAndStatusUI;
        current.uiWrapper = function (...args) {
            const result = current.uiOriginal.apply(this, args);
            checkbox();
            return result;
        };
        NemoPresetManager.createSearchAndStatusUI = current.uiWrapper;
    }
    function attach() {
        if (state !== current) return;
        if (promptManager && promptManager !== current.pm && typeof promptManager.renderPromptManagerListItems === 'function') {
            current.controller?.dispose();
            current.pm = promptManager;
            current.controller = installIncrementalRendering({ pm: promptManager, nemo: NemoPresetManager,
                enabled, modeKey: () => storage.getDropdownStyle() === 'tray' ? 'tray' : 'accordion', notify });
        }
        checkbox();
    }
    const changed = () => { attach(); current.controller?.reset(); };
    for (const [key, fn] of [['APP_READY', attach], ['OAI_PRESET_CHANGED_AFTER', changed], ['SETTINGS_UPDATED', attach]]) {
        if (event_types[key]) { eventSource.on(event_types[key], fn); current.listeners.push([event_types[key], fn]); }
    }
    function retry() {
        attach();
        if (!current.pm && state === current && current.attempts++ < 100) current.retry = setTimeout(retry, 100);
    }
    retry();
    current.api = Object.freeze({ stage: '5B.1/5', getStats: () => ({
        ...(current.controller?.getStats() || { attached: false }), snapshots: current.snapshots.getStats(),
    }),
        refresh: () => { current.controller?.reset(); current.controller?.redraw(); } });
    globalThis.NemoPromptRendering = current.api;
}
export function cleanupPromptRendering() {
    if (!state) return;
    const current = state; state = null;
    clearTimeout(current.retry);
    for (const [event, fn] of current.listeners) eventSource.removeListener(event, fn);
    current.snapshots?.dispose();
    current.controller?.dispose();
    if (NemoPresetManager.createSearchAndStatusUI === current.uiWrapper) NemoPresetManager.createSearchAndStatusUI = current.uiOriginal;
    document.querySelectorAll('[data-nemo-incremental-control]').forEach(node => node.remove());
    if (globalThis.NemoPromptRendering === current.api) delete globalThis.NemoPromptRendering;
}
