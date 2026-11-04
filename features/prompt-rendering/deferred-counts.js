import { renderState } from './model.js';

/**
 * Lag-free prompt toggles: defer SillyTavern's token-count dry run.
 *
 * `PromptManager.render()` first runs `tryGenerate()`, a dry run that builds and
 * tokenizes the whole prompt, only to refresh token numbers. Generation never
 * reads the panel: it assembles prompts from the saved order at send time, and
 * ST repaints the panel with fresh counts after every real generation, on new
 * messages and on edits. So when the only change since the last redraw is
 * prompts being switched on/off, paint the UI immediately with `render(false)`
 * and mark the token figures stale until ST's next count.
 *
 * One rule covers every caller (ST's own toggle button, Nemo trays, section
 * toggles, snapshots, directive auto-resolution) without knowing who called.
 * Any other change (edit, role, injection, order, preset, chat) or an
 * unchanged redraw still gets the native dry run.
 */
export const STALE_CLASS = 'nemo-token-counts-stale';
// renderState row key fields that a toggle may change: enabled, tokens, and the
// token-derived chat-history warning inputs.
const ENABLED = 7, VOLATILE = new Set([7, 8, 11]);

export function toggleSignature(pm) {
    let state;
    try { state = renderState(pm); } catch { return null; }
    if (!state) return null;
    const rows = new Map();
    for (const row of state.rows) {
        let key;
        try { key = JSON.parse(row.key); } catch { return null; }
        rows.set(row.id, { enabled: key[ENABLED], stable: JSON.stringify(key.filter((_, i) => !VOLATILE.has(i))) });
    }
    return { owner: state.owner, context: state.context, topology: state.topology, frame: state.frame, rows };
}

/** True only when at least one prompt changed on/off state and nothing else visible changed. */
export function isToggleOnlyChange(before, after) {
    if (!before || !after || before.owner !== after.owner || before.context !== after.context
        || before.topology !== after.topology || before.frame !== after.frame
        || before.rows.size !== after.rows.size) return false;
    let toggled = false;
    for (const [id, row] of after.rows) {
        const old = before.rows.get(id);
        if (!old || old.stable !== row.stable) return false;
        if (old.enabled !== row.enabled) toggled = true;
    }
    return toggled;
}

export function installDeferredTokenCounts({ pm, enabled = () => true, notify = () => {} }) {
    let disposed = false, baseline = toggleSignature(pm);
    const stats = { deferredDryRuns: 0, nativeDryRuns: 0, refreshes: 0 };
    const originals = [];
    const container = () => pm.containerElement || null;

    function setStale(value) {
        container()?.classList?.toggle(STALE_CLASS, value);
    }
    function wrap(name, factory) {
        if (typeof pm[name] !== 'function') return;
        const own = Object.prototype.hasOwnProperty.call(pm, name);
        const original = pm[name], replacement = factory(original);
        pm[name] = replacement;
        originals.push({ name, original, replacement, own });
    }

    wrap('render', original => function (afterTryGenerate = true, ...args) {
        if (disposed || afterTryGenerate === false || !enabled()) {
            if (!disposed) baseline = toggleSignature(this);
            return original.call(this, afterTryGenerate, ...args);
        }
        let current = null, defer = false;
        try {
            current = toggleSignature(this);
            defer = isToggleOnlyChange(baseline, current);
        } catch (error) { notify(error); }
        baseline = current;
        if (!defer) {
            stats.nativeDryRuns++;
            return original.call(this, afterTryGenerate, ...args);
        }
        stats.deferredDryRuns++;
        setStale(true);
        return original.call(this, false, ...args);
    });
    // Called by ST once counts are fresh: after a dry run and after a real generation.
    wrap('setChatCompletion', original => function (...args) {
        const result = original.apply(this, args);
        if (!disposed) setStale(false);
        return result;
    });

    // Clicking the stale total recounts on demand.
    const host = container();
    const onClick = event => {
        if (disposed || !host?.classList?.contains(STALE_CLASS)) return;
        if (!event.target?.closest?.('.completion_prompt_manager_header')) return;
        stats.refreshes++;
        baseline = null;
        pm.render();
    };
    host?.addEventListener?.('click', onClick);

    return {
        isStale: () => Boolean(container()?.classList?.contains(STALE_CLASS)),
        getStats: () => ({ ...stats, stale: Boolean(container()?.classList?.contains(STALE_CLASS)) }),
        dispose() {
            if (disposed) return;
            disposed = true;
            host?.removeEventListener?.('click', onClick);
            setStale(false);
            for (const { name, original, replacement, own } of originals.reverse()) {
                if (pm[name] !== replacement) continue; // A later wrapper owns it now.
                if (own) pm[name] = original; else delete pm[name];
            }
            baseline = null;
        },
    };
}
