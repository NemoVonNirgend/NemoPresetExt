import { readOrderedState, snapshotIds } from './state-model.js';

/**
 * Read-side adapter only: no toggles, restores, source writes or generation hooks.
 * Unsupported APIs keep the old handler; unavailable Chat Completion state fails
 * visibly instead of saving an incomplete selection from a partially drawn list.
 */
export function installStateSnapshots({ manager, getManager, getApi, storage,
    document = globalThis.document, report = () => {} }) {
    const originals = new Map();
    const stats = { captures: 0, reads: 0, failures: 0, nativeFallbacks: 0 };
    let disposed = false;
    const api = () => getApi() || 'openai';
    function enabledIds() {
        const result = snapshotIds(readOrderedState(getManager()));
        stats.reads++;
        return result;
    }
    function button(valid) {
        const element = document?.getElementById?.('nemoApplySnapshotBtn');
        if (element) {
            element.disabled = !valid;
            element.setAttribute('aria-disabled', String(!valid));
        }
    }
    function show(receiver, message, level) {
        if (!disposed) receiver.showStatusMessage?.(message, level);
    }
    function failed(receiver, error, message) {
        stats.failures++;
        report(error);
        show(receiver, message, 'error');
    }
    function wrap(name, handler) {
        const original = manager?.[name];
        if (typeof original !== 'function') return;
        const replacement = function (...args) {
            // A later extension may still hold this wrapper after teardown.
            if (disposed) return original.apply(this, args);
            let currentApi;
            try { currentApi = api(); }
            catch (error) { failed(this, error, 'Prompt state is unavailable; no snapshot was saved.'); return; }
            if (currentApi !== 'openai') {
                stats.nativeFallbacks++;
                return original.apply(this, args);
            }
            return handler.call(this, currentApi, ...args);
        };
        originals.set(name, { original, replacement });
        manager[name] = replacement;
    }
    wrap('takeSnapshot', async function (currentApi) {
        try {
            const ids = enabledIds(), owner = getManager()?.serviceSettings?.prompts;
            const saved = await storage.saveSnapshot(currentApi, ids);
            if (saved === false) throw new Error('Snapshot storage refused the write.');
            stats.captures++;
            if (disposed || api() !== currentApi || getManager()?.serviceSettings?.prompts !== owner) return;
            button(true); // An intentionally empty snapshot is still a valid snapshot.
            show(this, `Snapshot created with ${ids.length} active prompt(s).`, 'success');
        } catch (error) { failed(this, error, 'Error creating snapshot; the previous snapshot was not replaced by a DOM fallback.'); }
    });
    wrap('capturePromptStates', async function () {
        try {
            const ids = enabledIds();
            const saved = await storage.savePromptStates(ids);
            if (saved === false) throw new Error('Prompt-state storage refused the write.');
            stats.captures++;
            return ids;
        } catch (error) { failed(this, error, 'Prompt state could not be captured.'); return []; }
    });
    wrap('checkExistingSnapshot', function (currentApi) {
        try {
            const saved = storage.getSnapshot(currentApi);
            button(Array.isArray(saved) && saved.every(id => typeof id === 'string' && id.length > 0));
        } catch (error) { button(false); failed(this, error, 'Saved snapshot could not be read.'); }
    });
    return {
        getStats: () => ({ ...stats, attached: !disposed && originals.size > 0, stage: '5B.1/5', virtualized: false }),
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const [name, pair] of originals) if (manager[name] === pair.replacement) manager[name] = pair.original;
            originals.clear();
        },
    };
}
