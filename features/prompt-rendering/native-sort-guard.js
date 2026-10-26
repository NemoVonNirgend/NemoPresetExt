/** A native DOM sort may reorder entries, but must never detach unseen prompts. */
export function isCompletePromptOrder(identifiers, order) {
    if (!Array.isArray(identifiers) || !Array.isArray(order) || identifiers.length !== order.length) return false;
    const expected = new Set(order.map(entry => entry?.identifier));
    return expected.size === order.length && [...expected].every(id => typeof id === 'string' && id.length > 0)
        && new Set(identifiers).size === identifiers.length && identifiers.every(id => expected.has(id));
}

/**
 * Guard jQuery UI's native update callback before it replaces prompt_order from
 * sortable('toArray'). Nemo's own movement adapters already use canonical state.
 * No prompt definitions or order entries are changed by this adapter.
 */
export function installNativeSortGuard({ pm, jquery = () => globalThis.jQuery || globalThis.$,
    notify = () => {}, redraw = () => pm.render?.(false) }) {
    let disposed = false, binding = null;
    const original = pm.makeDraggable;
    const stats = { blocked: 0, allowed: 0 };

    function release() {
        if (binding && binding.instance.options.update === binding.guarded) binding.instance.options.update = binding.original;
        binding = null;
    }

    function protect() {
        if (disposed) return false;
        // Hosts without native sorting have no DOM-to-order callback to guard.
        if (typeof original !== 'function') return true;
        const $ = jquery(), list = pm.listElement;
        if (typeof $ !== 'function' || !list) return false;
        try {
            const sortable = $(list);
            if (typeof sortable.sortable !== 'function') return false;
            const instance = sortable.sortable('instance');
            if (!instance) { release(); return true; } // makeDraggable is wrapped before a future setup.
            if (!instance.options || typeof instance.options.update !== 'function') return false;
            const owner = pm.serviceSettings?.prompts, activeId = pm.activeCharacter?.id;
            if (binding?.instance === instance && instance.options.update === binding.guarded
                && binding.owner === owner && binding.activeId === activeId) return true;
            release();
            const nativeUpdate = instance.options.update;
            const guarded = function (...args) {
                if (disposed) return nativeUpdate.apply(this, args);
                let complete = false;
                try {
                    const order = pm.getPromptOrderForCharacter(pm.activeCharacter);
                    complete = list === pm.listElement && owner === pm.serviceSettings?.prompts
                        && activeId === pm.activeCharacter?.id
                        && isCompletePromptOrder(sortable.sortable('toArray', { attribute: 'data-pm-identifier' }), order);
                } catch { /* An unreadable or stale view must not replace saved order. */ }
                if (!complete) {
                    stats.blocked++;
                    notify(new Error('Blocked native sorting of an incomplete prompt list; saved prompt order was preserved.'));
                    redraw();
                    return;
                }
                stats.allowed++;
                return nativeUpdate.apply(this, args);
            };
            instance.options.update = guarded;
            binding = { instance, original: nativeUpdate, guarded, owner, activeId };
            return true;
        } catch (error) { notify(error); return false; }
    }

    const wrapped = function (...args) {
        const result = original.apply(this, args);
        if (!disposed) protect();
        return result;
    };
    if (typeof original === 'function') pm.makeDraggable = wrapped;
    protect();
    return {
        protect,
        getStats: () => ({ ...stats, attached: !disposed }),
        dispose() {
            if (disposed) return;
            disposed = true;
            release();
            if (pm.makeDraggable === wrapped) pm.makeDraggable = original;
        },
    };
}
