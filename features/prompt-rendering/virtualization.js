import { readConsumerState, sectionIdentifierFromElement } from './state-consumers.js';

const ROW = 'li.completion_prompt_manager_prompt';
const SECTION = 'details.nemo-engine-section';
const CONTENT = '.nemo-section-content';

export function desiredDirectIds(section, {
    mode = 'accordion', searchIds = null, sectionsEnabled = true, virtualizationActive = true,
    ancestorOpen = true,
} = {}) {
    const direct = Array.isArray(section?.directIds) ? section.directIds : [];
    if (!virtualizationActive || !sectionsEnabled) return [...direct];
    if (searchIds) {
        const wanted = searchIds instanceof Set ? searchIds : new Set(searchIds);
        return direct.filter(id => wanted.has(id));
    }
    if (mode === 'tray') return [];
    return section.open && ancestorOpen ? [...direct] : [];
}

/**
 * Stage 5B.3 section residency controller.
 *
 * Only ordinary prompt rows are virtualized. Section header rows/shells stay live,
 * while missing rows are regenerated through ST's original native row renderer.
 * No detached row nodes or prompt bodies are retained.
 */
export function installSectionVirtualization({
    pm, nemo, renderer, document: doc = globalThis.document,
    enabled = () => true, sectionsEnabled = () => true, modeKey = () => 'accordion',
    minRows = 64, notify = () => {},
}) {
    let disposed = false, residentIds = null, virtualized = false, searchIds = null;
    let pass = Promise.resolve(), generation = 0, restoreDepth = 0;
    const sectionListeners = new Map();
    const cleanups = [];
    const stats = {
        passes: 0, rowsRemoved: 0, rowsMaterialized: 0, sectionOpens: 0, sectionCloses: 0,
        searchPasses: 0, staleRenders: 0, sortableDisposals: 0,
    };

    function state() {
        try { return readConsumerState(pm, nemo); }
        catch (error) { notify(error); return null; }
    }
    function list() {
        return pm?.listElement || doc?.querySelector?.('#completion_prompt_manager_list') || null;
    }
    function rowIds(root = list()) {
        return root ? [...root.querySelectorAll(ROW)].map(row => row.dataset.pmIdentifier).filter(Boolean) : [];
    }
    function active(current = state()) {
        return Boolean(!disposed && restoreDepth === 0 && enabled() && sectionsEnabled()
            && current && current.rows.length >= minRows && list());
    }
    function syncResident() {
        residentIds = new Set(rowIds());
        const current = state();
        virtualized = Boolean(active(current) && current && residentIds.size < current.rows.length);
    }
    function sectionId(section) { return sectionIdentifierFromElement(section); }
    function parentOpen(section) {
        let parent = section?.parentElement?.closest?.(SECTION);
        while (parent) {
            if (!parent.open) return false;
            parent = parent.parentElement?.closest?.(SECTION);
        }
        return true;
    }
    function destroySectionDrag(section) {
        const content = section?.querySelector?.(CONTENT);
        if (!content) return;
        for (const key of ['sortable', '_accordionSortable']) {
            const sortable = content[key];
            if (!sortable) continue;
            try { sortable.destroy?.(); } catch {}
            nemo.sortableInstances?.delete?.(sortable);
            try { delete content[key]; } catch { content[key] = null; }
            stats.sortableDisposals++;
        }
    }
    function directRows(section) {
        const content = section?.querySelector?.(CONTENT);
        return content ? [...content.querySelectorAll(`:scope > ${ROW}`)] : [];
    }
    function plan(section, current, forceAll = false) {
        const id = sectionId(section), meta = id ? current?.index?.getSection(id) : null;
        if (!meta) return null;
        const desired = forceAll ? [...meta.directIds] : desiredDirectIds({ ...meta, open: Boolean(section.open) }, {
            mode: modeKey(), searchIds, sectionsEnabled: sectionsEnabled(),
            virtualizationActive: active(current), ancestorOpen: parentOpen(section),
        });
        return { id, meta, desired };
    }
    function decorate(row) {
        nemo.preparePromptItem?.(row);
        row.classList.remove('nemo-tray-hidden-prompt');
        return row;
    }
    async function reconcileSection(section, current, forceAll = false) {
        if (!section?.isConnected) return;
        const content = section.querySelector(CONTENT), planned = plan(section, current, forceAll);
        if (!content || !planned) return;
        const ticket = ++generation, owner = pm.serviceSettings?.prompts;
        const wanted = new Set(planned.desired);
        const existing = new Map(directRows(section)
            .filter(row => row.dataset.pmIdentifier)
            .map(row => [row.dataset.pmIdentifier, row]));
        const missing = planned.desired.filter(id => !existing.has(id));
        let fresh = [];
        if (missing.length) {
            fresh = await renderer.renderRows(missing);
            if (!fresh || fresh.length !== missing.length) throw new Error('Native row renderer could not materialize the requested section rows.');
            if (disposed || ticket !== generation || pm.serviceSettings?.prompts !== owner || !section.isConnected) {
                stats.staleRenders++; return;
            }
        }
        const generated = new Map(fresh.map(row => [row.dataset.pmIdentifier, decorate(row)]));
        const actual = directRows(section);
        const removals = actual.filter(row => !wanted.has(row.dataset.pmIdentifier));

        nemo.pauseListObserver?.();
        try {
            for (const row of removals) {
                if (nemo.selectedPromptItem === row) nemo.selectedPromptItem = null;
                row.remove();
                stats.rowsRemoved++;
            }
            const anchor = content.querySelector(':scope > details.nemo-engine-section');
            for (const id of planned.desired) {
                const row = existing.get(id) || generated.get(id);
                if (!row) continue;
                content.insertBefore(row, anchor);
            }
        } finally {
            nemo.resumeListObserver?.();
        }

        if (!planned.desired.length) destroySectionDrag(section);
        if (fresh.length) {
            stats.rowsMaterialized += fresh.length;
            section.dispatchEvent?.(new CustomEvent('nemo-section-materialized', {
                bubbles: true, detail: { section, identifiers: missing },
            }));
        }
        nemo.updateSectionCount?.(section);
    }
    function attachSections(root) {
        const live = new Set(root?.querySelectorAll?.(SECTION) || []);
        for (const [section, handler] of sectionListeners) {
            if (live.has(section)) continue;
            section.removeEventListener('toggle', handler);
            sectionListeners.delete(section);
        }
        for (const section of live) {
            if (sectionListeners.has(section)) continue;
            const handler = () => {
                if (disposed) return;
                if (section.open) stats.sectionOpens++; else stats.sectionCloses++;
                void queueReconcile();
            };
            section.addEventListener('toggle', handler);
            sectionListeners.set(section, handler);
        }
        return [...live];
    }
    async function reconcile({ forceAll = false } = {}) {
        if (disposed) return;
        const root = list(), current = state();
        if (!root || !current) { residentIds = null; virtualized = false; return; }
        const sections = attachSections(root);
        if (!sections.length) { syncResident(); return; }
        for (const section of sections) await reconcileSection(section, current, forceAll);
        syncResident();
        stats.passes++;
    }
    function queueReconcile(options = {}) {
        pass = pass.catch(() => {}).then(() => reconcile(options)).catch(error => notify(error));
        return pass;
    }
    async function materializeAll() {
        restoreDepth++;
        try { await queueReconcile({ forceAll: true }); }
        finally { restoreDepth = Math.max(0, restoreDepth - 1); syncResident(); }
    }
    function onOrganized() { void queueReconcile(); }
    function onMode() { void queueReconcile(); }
    doc.addEventListener('nemo-prompts-organized', onOrganized);
    doc.addEventListener('nemo-dropdown-style-changed', onMode);
    cleanups.push(() => doc.removeEventListener('nemo-prompts-organized', onOrganized),
        () => doc.removeEventListener('nemo-dropdown-style-changed', onMode));

    const residency = {
        expectedIds(current) {
            if (!residentIds || restoreDepth > 0) return null;
            return new Set(current.rows.filter(row => residentIds.has(row.id)).map(row => row.id));
        },
        afterNativePaint() { return queueReconcile(); },
        beforeOrganization() { return materializeAll(); },
        isVirtualized() { return virtualized; },
    };
    renderer.setResidency(residency);
    void queueReconcile();

    return {
        refresh: queueReconcile,
        async materializeSearch(ids) {
            searchIds = new Set(ids || []);
            stats.searchPasses++;
            await queueReconcile();
        },
        async clearSearch() {
            searchIds = null;
            await queueReconcile();
        },
        async restoreAll() { await materializeAll(); },
        getStats() {
            const current = state(), resident = residentIds?.size ?? rowIds().length;
            return {
                stage: '5B.3/5', active: active(current), mode: modeKey(), virtualized,
                residentRows: resident, totalRows: current?.rows.length ?? 0,
                virtualizedRows: Math.max(0, (current?.rows.length ?? 0) - resident),
                trackedSections: sectionListeners.size, searching: searchIds !== null, ...stats,
            };
        },
        async dispose({ restore = true } = {}) {
            if (disposed) return;
            if (restore) {
                try { await materializeAll(); } catch (error) { notify(error); }
            }
            disposed = true; generation++;
            for (const [section, handler] of sectionListeners) section.removeEventListener('toggle', handler);
            sectionListeners.clear();
            for (const cleanup of cleanups.reverse()) cleanup();
            renderer.setResidency(null);
            residentIds = null; searchIds = null; virtualized = false;
        },
    };
}
