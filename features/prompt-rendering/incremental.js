import { renderState, remember, sameRevision, changedRows, supportsNativeRows } from './model.js';

const ROW = 'li.completion_prompt_manager_prompt';
const NAME = '.completion_prompt_manager_prompt_name';
const SECTION = 'details.nemo-engine-section';

function rowsOf(list) { return [...list.querySelectorAll(ROW)]; }
function completeRows(list, state) {
    const rows = rowsOf(list);
    return rows.length === state.rows.length && rows.every((row, i) => row.dataset.pmIdentifier === state.rows[i].id) ? rows : null;
}
function layoutOf(list) {
    return JSON.stringify(rowsOf(list).map(row => [row.dataset.pmIdentifier,
        row.querySelector(NAME)?.dataset.pmName, row.parentElement?.tagName,
        row.closest(SECTION)?.querySelector('summary > li')?.dataset.pmIdentifier || null]));
}

/** Preserve the translated label and any external controls; refuse unknown header markup. */
export function updateTotal(list, value) {
    const header = list?.parentElement?.querySelector('.completion_prompt_manager_header');
    const cell = header?.lastElementChild;
    if (!cell || cell.childNodes.length !== 2 || cell.firstChild.nodeType !== 1
        || cell.firstChild.tagName !== 'SPAN' || cell.lastChild.nodeType !== 3) return false;
    const text = ` ${value} `;
    if (cell.lastChild.textContent !== text) cell.lastChild.textContent = text;
    return true;
}

/** Native rows and native listeners, with Nemo header decoration carried across a changed row. */
export function replaceRow(oldRow, newRow, nemo) {
    const isHeader = oldRow.classList.contains('nemo-header-item');
    const metadata = Object.entries(oldRow.dataset).filter(([key]) => key.startsWith('nemo'));
    const label = oldRow.querySelector(`${NAME} a`)?.textContent;
    const counters = isHeader ? [...oldRow.querySelectorAll('.nemo-enabled-count, .nemo-section-progress, .nemo-section-master-toggle')] : [];
    const display = oldRow.style.display;
    const selected = nemo.selectedPromptItem === oldRow;
    // Use the existing extension decorator, never a second interpretation of its directives.
    nemo.preparePromptItem?.(newRow);
    if (isHeader) {
        newRow.classList.add('nemo-header-item');
        newRow.draggable = false;
        for (const [key, value] of metadata) newRow.dataset[key] = value;
        const link = newRow.querySelector(`${NAME} a`);
        if (link && label !== undefined) link.textContent = label;
        const name = newRow.querySelector(NAME);
        if (name) for (const node of counters) name.appendChild(node);
    }
    newRow.style.display = display;
    oldRow.replaceWith(newRow);
    if (selected) nemo.selectedPromptItem = newRow;
}

/**
 * Live incremental redraws only. All rows remain present in 5A so existing snapshots,
 * tray logic, movement and bulk controls still see the complete native prompt order.
 */
export function installIncrementalRendering({ pm, nemo, document: doc = globalThis.document,
    enabled = () => true, modeKey = () => 'accordion', minRows = 64,
    compatible = supportsNativeRows,
    requestFrame = cb => requestAnimationFrame(cb), cancelFrame = id => cancelAnimationFrame(id),
    notify = () => {},
}) {
    let disposed = false, previous = null, frame = null, sequence = 0, toggleDepth = 0;
    let organization = null, organizationFrame = null, pendingForce = false, incrementalList = null;
    let retryFrame = null, optionalObserver = null, optionalRoot = null, deferredDrag = false;
    const cleanups = [], originals = [];
    const stats = { fullLists: 0, incrementalLists: 0, unchangedLists: 0, generatedRows: 0,
        reusedRows: 0, replacedRows: 0, reusedFrames: 0, stalePaints: 0,
        organizationsSkipped: 0, organizationRequests: 0, organizationRuns: 0,
        scopedOptionalObservers: 0, fallbacks: 0, dragSetupsSkipped: 0 };
    const originalRows = pm.renderPromptManagerListItems;
    const supported = compatible(originalRows);
    const active = () => !disposed && supported && enabled() && modeKey() === 'accordion'
        && pm.configuration?.prefix === 'completion_' && toggleDepth === 0;
    const busy = () => Boolean(pm.listElement?.querySelector('.sortable-chosen, .sortable-drag, .ui-sortable-helper'));
    function state() { try { return renderState(pm); } catch { return null; } }
    function reset() { sequence++; previous = null; frame = null; organization = null; incrementalList = null; }
    function redraw() {
        if (disposed || retryFrame !== null) return;
        retryFrame = requestFrame(() => { retryFrame = null; if (!disposed) pm.render(false); });
    }
    function wrap(owner, name, factory) {
        if (typeof owner[name] !== 'function') return;
        const original = owner[name], replacement = factory(original);
        owner[name] = replacement;
        originals.push({ owner, name, original, replacement });
    }
    function rememberOrganization() {
        const list = pm.listElement, current = state();
        if (!active() || !list || !current || !completeRows(list, current)) { organization = null; return; }
        organization = { list, owner: current.owner, mode: modeKey(), layout: layoutOf(list) };
    }
    function stableOrganization() {
        const list = pm.listElement;
        return Boolean(organization && organization.list === list
            && organization.owner === pm.serviceSettings?.prompts && organization.mode === modeKey()
            && list.dataset.nemoOrganizing !== 'true' && organization.layout === layoutOf(list));
    }
    function scopeOptionalObserver(container) {
        // Do not watch chat messages or the entire document body for a sidebar drawer.
        const root = doc.getElementById('left-nav-panel');
        if (!root || !root.contains(container) || typeof globalThis.MutationObserver !== 'function') return;
        nemo.observers?.optionalSectionObserver?.disconnect();
        optionalObserver?.disconnect();
        optionalRoot = root;
        optionalObserver = new MutationObserver(mutations => {
            if (disposed) return;
            if (mutations.some(m => [...m.addedNodes].some(node => node.nodeType === 1
                && (node.id === 'nemo-drawer-openai_chat_settings' || node.querySelector?.('#nemo-drawer-openai_chat_settings'))))) {
                nemo.scheduleOptionalSectionSync(pm.listElement || container);
            }
        });
        optionalObserver.observe(root, { childList: true, subtree: true });
        nemo.observers.optionalSectionObserver = optionalObserver;
        stats.scopedOptionalObservers++;
    }

    wrap(pm, 'renderPromptManager', original => async function (...args) {
        if (active() && busy()) { deferredDrag = true; return; }
        const current = state(), list = this.listElement;
        if (active() && !busy() && current && current.rows.length >= minRows && frame
            && frame.owner === current.owner && frame.frame === current.frame && frame.list === list
            && this.containerElement?.contains(list) && updateTotal(list, current.tokens)) {
            stats.reusedFrames++;
            return;
        }
        previous = null; organization = null;
        const result = await original.apply(this, args);
        const after = state();
        frame = current && sameRevision(current, after) && this.containerElement?.contains(this.listElement)
            ? remember(current, this.listElement) : null;
        return result;
    });

    wrap(pm, 'renderPromptManagerListItems', original => async function (...args) {
        if (active() && busy()) { deferredDrag = true; return; }
        const current = state(), list = this.listElement;
        const ticket = ++sequence;
        incrementalList = null;
        async function full() {
            previous = null; organization = null;
            stats.fullLists++;
            const result = await original.apply(pm, args);
            const after = state();
            if (!disposed && ticket === sequence && current && sameRevision(current, after)
                && pm.listElement && completeRows(pm.listElement, current)) {
                previous = remember(current, pm.listElement);
                stats.generatedRows += current.rows.length;
            }
            return result;
        }
        if (!active() || busy() || !current || current.rows.length < minRows
            || !list || !this.containerElement?.contains(list) || previous?.list !== list) return full();
        const changes = changedRows(previous, current), oldRows = completeRows(list, current);
        if (!changes || !oldRows) return full();
        if (!changes.length) {
            stats.unchangedLists++; stats.reusedRows += current.rows.length;
            previous = remember(current, list); incrementalList = list;
            return;
        }
        // A receiver-local detached list: no temporary writes to the actual manager,
        // no async source getters and no full-preset clone.
        const scratch = doc.createElement('ul'), facade = Object.create(this);
        const wanted = new Set(changes.map(row => row.id));
        Object.defineProperties(facade, {
            listElement: { value: scratch, writable: true },
            getPromptsForCharacter: { value: () => changes.map(row => current.byId.get(row.id)) },
            getPromptOrderEntry: { value: (_character, id) => current.entries.get(id) || null },
        });
        try {
            await original.apply(facade, args);
            const after = state(), actualRows = rowsOf(list);
            if (disposed || ticket !== sequence || this.listElement !== list || busy()
                || !sameRevision(current, after) || !completeRows(list, current)
                || oldRows.some((row, i) => row !== actualRows[i])) {
                stats.stalePaints++; redraw(); return;
            }
            const freshRows = rowsOf(scratch);
            if (freshRows.length !== changes.length || freshRows.some((row, i) => row.dataset.pmIdentifier !== changes[i].id)) {
                stats.fallbacks++; return full();
            }
            const fresh = new Map(freshRows.map(row => [row.dataset.pmIdentifier, row]));
            const affected = new Set();
            nemo.pauseListObserver?.();
            try {
                for (const row of oldRows) {
                    if (!wanted.has(row.dataset.pmIdentifier)) continue;
                    let section = row.closest(SECTION);
                    while (section) { affected.add(section); section = section.parentElement?.closest(SECTION); }
                    replaceRow(row, fresh.get(row.dataset.pmIdentifier), nemo);
                }
            } finally { nemo.resumeListObserver?.(); }
            for (const section of affected) nemo.updateSectionCount?.(section);
            previous = remember(current, list); incrementalList = list;
            stats.incrementalLists++; stats.generatedRows += changes.length;
            stats.replacedRows += changes.length; stats.reusedRows += current.rows.length - changes.length;
            if (organization?.list === list) rememberOrganization();
            // Existing search owns query interpretation and worker results.
            if (doc.getElementById('nemoPresetSearchInput')?.value?.trim()) nemo.handlePresetSearch?.();
        } catch (error) {
            if (disposed) return;
            if (ticket !== sequence || current.owner !== pm.serviceSettings?.prompts) { stats.stalePaints++; redraw(); return; }
            previous = null; organization = null; stats.fallbacks++;
            notify(error);
            return full(); // Unknown layout/renderer failures use the unmodified native path.
        }
    });

    // Content edits can change directive badges/tooltips without changing native
    // visual fields. Invalidate at explicit edit APIs instead of reading bodies on
    // every render or forcing a rebuild for every settings-save notification.
    for (const name of ['updatePromptWithPromptEditForm', 'updatePromptByIdentifier', 'updatePrompts', 'setPrompts']) {
        wrap(pm, name, original => function (...args) {
            const result = original.apply(this, args);
            reset();
            return result;
        });
    }

    wrap(pm, 'makeDraggable', original => function (...args) {
        if (active() && busy()) { deferredDrag = true; return; }
        if (active() && incrementalList === this.listElement && this.listElement?.sortable
            && nemo.sortableInstances?.has(this.listElement.sortable)) { stats.dragSetupsSkipped++; return; }
        return original.apply(this, args);
    });

    wrap(nemo, 'organizePrompts', original => function (force = false, ...args) {
        if (!active() || busy()) return original.call(this, force, ...args);
        stats.organizationRequests++;
        if (!force && stableOrganization()) { stats.organizationsSkipped++; return Promise.resolve(); }
        pendingForce ||= Boolean(force);
        if (organizationFrame !== null) return Promise.resolve();
        organizationFrame = requestFrame(() => {
            organizationFrame = null;
            const forced = pendingForce; pendingForce = false;
            if (disposed) return;
            if (!forced && stableOrganization()) { stats.organizationsSkipped++; return; }
            stats.organizationRuns++;
            Promise.resolve(original.call(nemo, forced, ...args)).catch(notify);
        });
        return Promise.resolve();
    });
    wrap(nemo, 'initializeObserver', original => function (container, ...args) {
        const result = original.call(this, container, ...args);
        if (enabled() && !disposed) scopeOptionalObserver(container);
        return result;
    });
    wrap(nemo, 'beginToggle', original => function (...args) { toggleDepth++; return original.apply(this, args); });
    wrap(nemo, 'endToggle', original => function (...args) { try { return original.apply(this, args); } finally { toggleDepth = Math.max(0, toggleDepth - 1); } });

    const onOrganized = () => rememberOrganization();
    const onMode = () => reset();
    const onDragEnd = () => { if (deferredDrag) { deferredDrag = false; redraw(); } };
    for (const type of ['pointerup', 'dragend', 'touchend']) {
        doc.addEventListener(type, onDragEnd, true);
        cleanups.push(() => doc.removeEventListener(type, onDragEnd, true));
    }
    doc.addEventListener('nemo-prompts-organized', onOrganized);
    doc.addEventListener('nemo-dropdown-style-changed', onMode);
    cleanups.push(() => doc.removeEventListener('nemo-prompts-organized', onOrganized),
        () => doc.removeEventListener('nemo-dropdown-style-changed', onMode));
    if (enabled() && nemo.observers?.listObserverContainer) scopeOptionalObserver(nemo.observers.listObserverContainer);

    return {
        reset, redraw,
        getStats: () => ({ stage: '5A/5', supported, active: active(), mode: modeKey(),
            ...stats, optionalObserverScope: optionalRoot?.id || 'native',
            residentRows: pm.listElement ? rowsOf(pm.listElement).length : 0, virtualized: false }),
        dispose() {
            if (disposed) return;
            disposed = true; reset();
            if (organizationFrame !== null) cancelFrame(organizationFrame);
            if (retryFrame !== null) cancelFrame(retryFrame);
            for (const fn of cleanups.reverse()) fn();
            optionalObserver?.disconnect();
            if (nemo.observers?.optionalSectionObserver === optionalObserver) delete nemo.observers.optionalSectionObserver;
            for (const { owner, name, original, replacement } of originals.reverse()) if (owner[name] === replacement) owner[name] = original;
            previous = null; frame = null; organization = null; optionalRoot = null;
        },
    };
}
