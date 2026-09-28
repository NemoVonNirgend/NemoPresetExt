import { eventSource, event_types, getRequestHeaders, main_api } from '../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../extensions.js';
import { promptManager, oai_settings, openai_settings, openai_setting_names } from '../../../../../openai.js';
import { getManifest, SCHEMA, RESOLVER_ID, RUNTIME_SOURCE, selectedGenres, restorePortable } from './recipe-codec.js';
import { RecipeStore } from './recipe-store.js';

const store = new RecipeStore({ headers: getRequestHeaders });
const patches = [];
const workers = new Map();
const bypassInputs = new WeakSet();
const bypassClicks = new WeakSet();
const exportArchives = new Map();
let initialized = false;
let importRevision = 0;
let lastImport = null;
let managerPoll = null;
let fatal = null;
let dryRuns = 0;

function report(error) {
    const message = error?.message ?? String(error);
    console.error('[Nemo recipe runtime]', message);
    globalThis.toastr?.error(message, 'Nemo recipe runtime');
}

function librarySignature(manifest) { return JSON.stringify(manifest?.libraries ?? {}); }
function activeId() { return promptManager?.activeCharacter?.id ?? 100001; }

function patch(object, key, makeWrapper) {
    if (!object || typeof object[key] !== 'function' || patches.some(p => p.object === object && p.key === key)) return;
    const original = object[key];
    const wrapper = makeWrapper(original);
    object[key] = wrapper;
    patches.push({ object, key, original, wrapper });
}

function runWorker(payload, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./recipe-worker.js', import.meta.url), { type: 'module' });
        const cleanup = () => { clearTimeout(timer); workers.delete(worker); worker.terminate(); };
        const fail = error => { cleanup(); reject(error); };
        const timer = setTimeout(() => fail(new Error('Recipe import/export timed out; the source preset was not changed.')), 300000);
        workers.set(worker, fail);
        worker.onerror = event => fail(new Error(event.message || 'Recipe worker failed.'));
        worker.onmessage = ({ data }) => {
            if (data.type === 'progress') { onProgress(data.message); return; }
            if (data.type === 'error') { fail(new Error(data.message)); return; }
            cleanup(); resolve(data);
        };
        try { worker.postMessage({ ...payload, headers: getRequestHeaders() }); }
        catch (error) { fail(error); }
    });
}

/** The only async loading boundary required for a generation; never replay selectors/macros. */
export async function prepareRecipeRuntime(preset, type = 'normal') {
    const manifest = getManifest(preset);
    if (!manifest) return;
    if (manifest.schema !== SCHEMA) throw new Error('Unsupported optimized Nemo preset. Re-import its portable version.');
    const needed = selectedGenres(preset, activeId(), type);
    const pinned = new Set();
    for (const genre of needed) {
        const ref = manifest.libraries[genre];
        await store.load(ref, genre);
        pinned.add(ref.sha256);
    }
    store.trim(pinned);
}

function wireManager() {
    if (!promptManager) return;
    patch(promptManager, 'preparePrompt', original => function (prompt, originalContent = null) {
        const manifest = getManifest(this.serviceSettings);
        if (!manifest || prompt?.identifier !== RESOLVER_ID) return original.call(this, prompt, originalContent);
        try {
            if (manifest.schema !== SCHEMA || prompt.content !== RUNTIME_SOURCE) {
                throw new Error('Nemo external resolver was modified or is incompatible; restore the portable preset.');
            }
            const variables = getContext().variables?.local;
            if (!variables?.get) throw new Error('This ST version does not expose the variable API required by Nemo.');
            const genre = String(variables.get('NCGenreId') ?? '');
            const ref = manifest.libraries[genre];
            const data = store.get(ref, genre);
            if (!data) throw new Error(`Recipe partition ${genre || '(unset)'} is not ready. Retry after selecting a genre; do not send an incomplete prompt.`);
            const key = 'NP' + String(variables.get(`NG_${genre}`) ?? '')
                + String(variables.get(`NA_${variables.get('NCAuthorId')}`) ?? '')
                + String(variables.get(`NS_${variables.get('NCStyleId')}`) ?? '');
            // An explicit empty recipe is valid; a missing record is not.
            if (!data.index.has(key)) throw new Error(`Selected recipe ${key} is missing; restore the portable preset instead of sending an incomplete prompt.`);
            return original.call(this, { ...prompt, content: data.get(key) + '\n{{trim}}' }, originalContent);
        } catch (error) {
            fatal = error;
            if (dryRuns === 0) getContext().stopGeneration?.();
            throw error;
        }
    });
    patch(promptManager, 'tryGenerate', original => async function (...args) {
        const preset = this.serviceSettings;
        const manifest = getManifest(preset);
        if (!manifest) return original.apply(this, args);
        try {
            await prepareRecipeRuntime(preset);
            if (getManifest(this.serviceSettings) !== manifest) return; // Stale dry run after a preset switch.
            dryRuns++;
            try { return await original.apply(this, args); }
            finally { dryRuns--; }
        } catch (error) {
            this.error = error.message;
            console.warn('[Nemo recipe runtime] Dry-run count unavailable:', error.message);
        }
    });
}

async function beforePresetChange({ preset }) {
    fatal = null;
    wireManager();
    // ST's event bus is not a cancellable transaction. A load failure must also be checked
    // by the generation interceptor, not merely thrown from this listener.
    try { await prepareRecipeRuntime(preset); }
    catch (error) { report(error); }
}

export async function recipeGenerationPreflight(_chat, _contextSize, abort, type) {
    fatal = null;
    if (main_api !== 'openai' || !getManifest(oai_settings)) return;
    wireManager();
    const manifest = getManifest(oai_settings);
    try {
        await prepareRecipeRuntime(oai_settings, type);
        if (getManifest(oai_settings) !== manifest) throw new Error('The preset changed during recipe preparation. Send again with the selected preset.');
    } catch (error) { fatal = error; abort(true); report(error); }
}

function guardPreparedPrompt({ dryRun = false } = {}) {
    // Use this build's flag, not the count of other in-flight UI dry runs.
    if (fatal && !dryRun && main_api === 'openai' && getManifest(oai_settings)) getContext().stopGeneration?.();
}

/** Capture the native file INPUT before ST's async input handler reads or parses it. */
function onImportInput(event) {
    const input = event.target;
    if (input?.id !== 'openai_preset_import_file') return;
    if (bypassInputs.has(input)) { bypassInputs.delete(input); return; }
    if (extension_settings.NemoPresetExt?.enableRecipeOffload === false) return;
    const file = input.files?.[0];
    if (!file) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const revision = ++importRevision;
    const toast = globalThis.toastr?.info('Checking preset for externalizable Nemo recipes…', 'Nemo import', { timeOut: 0, extendedTimeOut: 0 });
    void (async () => {
        try {
            if (typeof Worker !== 'function' || typeof DataTransfer !== 'function') {
                throw new Error('Automatic Nemo offloading requires Worker and DataTransfer support. Disable recipe offloading to use native import.');
            }
            const result = await runWorker({ operation: 'import', file }, message => {
                toast?.find?.('.toast-message')?.text?.(message);
            });
            if (!initialized || revision !== importRevision) return;
            const accepted = result.type === 'passthrough' ? file : new File([result.text], file.name, { type: 'application/json' });
            const transfer = new DataTransfer();
            transfer.items.add(accepted);
            input.files = transfer.files;
            lastImport = result.stats ?? null;
            bypassInputs.add(input);
            // Native confirmation for endpoint/proxy fields, overwrite checks, save, and selection stay intact.
            input.dispatchEvent(new Event('input', { bubbles: true }));
            if (result.stats) globalThis.toastr?.success(`Offloaded ${result.stats.recipeCount.toLocaleString()} recipes before ST import.`, 'Nemo');
        } catch (error) {
            if (revision === importRevision) { input.value = ''; report(error); }
        } finally { if (toast) globalThis.toastr?.clear(toast); }
    })();
}

async function loadExportArchives(preset) {
    const manifest = getManifest(preset);
    if (manifest?.schema !== SCHEMA) throw new Error('Unsupported Nemo export schema.');
    const signature = librarySignature(manifest);
    const existing = exportArchives.get(signature);
    if (existing) return existing.libraries;
    const libraries = new Map();
    for (const [genre, ref] of Object.entries(manifest.libraries)) {
        libraries.set(genre, await store.load(ref, genre, { cache: false }));
    }
    restorePortable(preset, libraries); // Validate the whole export before allowing native download to start.
    const timer = setTimeout(() => exportArchives.delete(signature), 10 * 60 * 1000);
    exportArchives.set(signature, { libraries, timer });
    return libraries;
}

function savedPreset() {
    const index = openai_setting_names?.[oai_settings.preset_settings_openai];
    return index === undefined ? null : openai_settings?.[index];
}

/** Native export prompts still perform connection redaction; only recipe data is restored afterward. */
function onExportClick(event) {
    const button = event.target?.closest?.('#export_oai_preset');
    if (!button) return;
    if (bypassClicks.has(button)) { bypassClicks.delete(button); return; }
    const preset = savedPreset();
    if (!getManifest(preset)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void loadExportArchives(preset).then(() => {
        if (!initialized || savedPreset() !== preset) return;
        bypassClicks.add(button);
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }).catch(report);
}

async function onExportReady(preset) {
    if (!getManifest(preset)) return;
    const signature = librarySignature(getManifest(preset));
    try {
        const libraries = await loadExportArchives(preset);
        const portable = restorePortable(preset, libraries);
        // Keep the native exporter's redacted connection fields; portable is based on this exact copy.
        Object.assign(preset, portable);
    } catch (error) {
        // ST swallows listener exceptions. Never silently download an apparently portable broken shell.
        for (const key of Object.keys(preset)) delete preset[key];
        preset.nemoExportError = error.message;
        preset.recovery = 'Export failed. Re-import the original portable Nemo Full preset and retry. This is not a preset.';
        report(error);
    } finally {
        const cached = exportArchives.get(signature);
        if (cached) clearTimeout(cached.timer);
        exportArchives.delete(signature);
    }
}

export function initializeRecipeRuntime() {
    if (initialized) return cleanupRecipeRuntime;
    initialized = true;
    document.addEventListener('input', onImportInput, true);
    document.addEventListener('click', onExportClick, true);
    eventSource.on(event_types.OAI_PRESET_CHANGED_BEFORE, beforePresetChange);
    eventSource.on(event_types.OAI_PRESET_EXPORT_READY, onExportReady);
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, guardPreparedPrompt);
    wireManager();
    // PM may not exist yet during extension initialization. Stop polling as soon as it does.
    managerPoll = setInterval(() => { wireManager(); if (promptManager) { clearInterval(managerPoll); managerPoll = null; } }, 250);
    globalThis.NemoPresetExtRecipePreflight = recipeGenerationPreflight;
    globalThis.NemoRecipeRuntime = Object.freeze({
        stats: () => ({ ...store.stats(), lastImport }),
        prepare: prepareRecipeRuntime,
        exportPortable: preset => runWorker({ operation: 'export', preset }),
    });
    return cleanupRecipeRuntime;
}

export function cleanupRecipeRuntime() {
    if (!initialized) return;
    initialized = false;
    importRevision++;
    clearInterval(managerPoll); managerPoll = null;
    document.removeEventListener('input', onImportInput, true);
    document.removeEventListener('click', onExportClick, true);
    eventSource.removeListener(event_types.OAI_PRESET_CHANGED_BEFORE, beforePresetChange);
    eventSource.removeListener(event_types.OAI_PRESET_EXPORT_READY, onExportReady);
    eventSource.removeListener(event_types.CHAT_COMPLETION_PROMPT_READY, guardPreparedPrompt);
    for (const fail of [...workers.values()]) fail(new Error('Nemo runtime was unloaded.'));
    for (const { object, key, original, wrapper } of patches.splice(0).reverse()) {
        if (object[key] === wrapper) object[key] = original;
    }
    for (const entry of exportArchives.values()) clearTimeout(entry.timer);
    exportArchives.clear(); store.clear(); fatal = null;
    if (globalThis.NemoPresetExtRecipePreflight === recipeGenerationPreflight) delete globalThis.NemoPresetExtRecipePreflight;
    delete globalThis.NemoRecipeRuntime;
}
