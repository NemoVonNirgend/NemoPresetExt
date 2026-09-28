/** Real Chromium DOM tests with an injected native-shaped host, not a live ST client. */
import { installIncrementalRendering } from '../features/prompt-rendering/incremental.js';
import { installSectionVirtualization } from '../features/prompt-rendering/virtualization.js';
const results = [];
const assert = (value, message = 'assertion failed') => { if (!value) throw new Error(message); };
const eq = (a, b, message = '') => assert(JSON.stringify(a) === JSON.stringify(b), message || `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
const settle = async () => { await tick(); await tick(); await tick(); };
async function test(name, fn) {
    try { await fn(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
function harness({ n = 120, unsafe = false, virtualize = false } = {}) {
    let mode = 'accordion', enabled = true, generated = 0, nativeFrames = 0, organizations = 0, inspected = null, edited = null;
    let sourceReads = 0, optionalSyncs = 0, gate = null, gateStarted = false, nativeDrags = 0;
    const panel = document.createElement('div'); panel.id = 'left-nav-panel';
    const host = document.createElement('div'); panel.appendChild(host); document.body.appendChild(panel);
    const input = document.createElement('input'); input.id = 'nemoPresetSearchInput'; panel.appendChild(input);
    const sources = [];
    for (let i = 0; i < n; i++) {
        const p = { identifier: `p${i}`, name: i % 20 === 0 ? `=== Group ${i} ===` : `Prompt ${i}`, role: 'system', system_prompt: false, marker: false };
        Object.defineProperty(p, 'content', { get() { sourceReads++; throw new Error('body read'); } });
        sources.push(p);
    }
    const order = sources.map(p => ({ identifier: p.identifier, enabled: true })), counts = {};
    const pm = {
        serviceSettings: { prompts: sources, prompt_order: [{ character_id: 100000, order }], openai_max_context: 10000, openai_max_tokens: 1000 },
        configuration: { prefix: 'completion_', promptOrder: { strategy: 'global' }, warningTokenThreshold: 1500, dangerTokenThreshold: 500 },
        activeCharacter: { id: 100000 }, tokenUsage: 100, tokenHandler: { getCounts: () => counts }, overriddenPrompts: [], error: null,
        containerElement: host, listElement: null, redrawRequests: 0,
        getPromptOrderForCharacter() { return order; },
        getPromptsForCharacter() { return order.map(e => sources.find(p => p.identifier === e.identifier)); },
        getPromptOrderEntry(_c, id) { return order.find(e => e.identifier === id); },
        isPromptDeletionAllowed: () => true, isPromptEditAllowed: p => !p.marker,
        isPromptToggleAllowed: () => true, isPromptInspectionAllowed: () => true,
        render() { this.redrawRequests++; }, makeDraggable() { nativeDrags++; },
        updatePromptWithPromptEditForm() { return 'saved-original-edit'; },
        async renderPromptManager() {
            nativeFrames++;
            host.replaceChildren();
            const range = document.createElement('div'); range.className = 'range-block';
            const header = document.createElement('div'); header.className = 'completion_prompt_manager_header';
            const title = document.createElement('div'); title.textContent = 'Prompts';
            const cell = document.createElement('div'), label = document.createElement('span'); label.textContent = 'Total Tokens:';
            cell.append(label, document.createTextNode(` ${this.tokenUsage} `)); header.append(title, cell);
            const footer = document.createElement('select'); footer.id = 'completion_prompt_manager_footer_append_prompt';
            for (const p of sources) footer.append(new Option(p.name, p.identifier));
            const list = document.createElement('ul'); list.id = 'completion_prompt_manager_list';
            range.append(header, footer, list); host.append(range); this.listElement = list;
        },
        async renderPromptManagerListItems() {
            // promptManagerListHeader: native method contract marker.
            const list = this.listElement;
            if (gate && list !== pm.listElement) { gateStarted = true; await gate; }
            list.replaceChildren();
            for (const p of this.getPromptsForCharacter(this.activeCharacter)) {
                const entry = this.getPromptOrderEntry(this.activeCharacter, p.identifier);
                generated++;
                const row = document.createElement('li'); row.className = 'completion_prompt_manager_prompt'; row.dataset.pmIdentifier = p.identifier;
                row.classList.toggle('completion_prompt_manager_prompt_disabled', !entry.enabled);
                const name = document.createElement('span'); name.className = 'completion_prompt_manager_prompt_name'; name.dataset.pmName = p.name;
                const link = document.createElement('a'); link.className = 'prompt-manager-inspect-action'; link.textContent = p.name;
                link.addEventListener('click', () => { inspected = p.identifier; }); name.append(link);
                const role = document.createElement('small'); role.dataset.role = p.role; role.textContent = p.role; name.append(role);
                const controls = document.createElement('span'); controls.className = 'prompt_manager_prompt_controls';
                for (const action of ['toggle', ...(this.isPromptEditAllowed(p) ? ['edit'] : []), 'detach']) {
                    const control = document.createElement('span'); control.className = `prompt-manager-${action}-action`;
                    if (action === 'toggle') control.classList.add(entry.enabled ? 'fa-toggle-on' : 'fa-toggle-off');
                    control.addEventListener('click', () => {
                        if (action === 'toggle') entry.enabled = !entry.enabled;
                        if (action === 'edit') edited = p.identifier;
                        if (action === 'detach') order.splice(order.indexOf(entry), 1);
                    }); controls.append(control);
                }
                const token = document.createElement('span'); token.className = 'prompt_manager_prompt_tokens'; token.textContent = String(counts[p.identifier] || '-');
                row.append(name, controls, token); list.append(row);
            }
        },
    };
    const nemo = {
        observers: {}, searchCalls: 0, selectedPromptItem: null, sortableInstances: new Set(),
        getDividerInfo(item) {
            const raw = item?.dataset?.nemoOriginalText
                || item?.querySelector?.('.completion_prompt_manager_prompt_name a')?.textContent
                || item?.querySelector?.()?.textContent || '';
            const main = /^===\s*(.*?)\s*===$/.exec(raw);
            return main ? { isDivider: true, isSubHeader: false, name: main[1].trim(), originalText: raw }
                : { isDivider: false, isSubHeader: false, name: raw, originalText: raw };
        },
        preparePromptItem(row) { row.dataset.nemoDecorated = 'true'; row.draggable = true; },
        updateSectionCount(section) {
            const span = section.querySelector('.nemo-enabled-count');
            if (span) span.textContent = `${section.querySelectorAll('.fa-toggle-on').length}`;
        },
        handlePresetSearch() { this.searchCalls++; },
        pauseListObserver() { this.observers.listObserver?.disconnect(); },
        resumeListObserver() { if (this.observers.listObserver) this.observers.listObserver.observe(pm.listElement, { childList: true, subtree: true }); },
        scheduleOptionalSectionSync() { optionalSyncs++; },
        initializeObserver(container) {
            this.observers.listObserver?.disconnect(); this.observers.optionalSectionObserver?.disconnect();
            this.observers.listObserver = new MutationObserver(() => {});
            this.observers.listObserverContainer = container;
            this.observers.listObserver.observe(container, { childList: true, subtree: true });
            this.observers.optionalSectionObserver = new MutationObserver(mutations => {
                if (mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && n.id === 'nemo-drawer-openai_chat_settings'))) optionalSyncs++;
            });
            this.observers.optionalSectionObserver.observe(document.body, { childList: true, subtree: true });
        },
        beginToggle() { this.pauseListObserver(); }, endToggle() { this.resumeListObserver(); },
        async organizePrompts() {
            organizations++;
            const list = pm.listElement; list.dataset.nemoOrganizing = 'true';
            requestAnimationFrame(() => {
                const rows = [...list.querySelectorAll('li.completion_prompt_manager_prompt')];
                list.replaceChildren(); let content = list;
                for (const row of rows) {
                    this.preparePromptItem(row);
                    const raw = row.querySelector('.completion_prompt_manager_prompt_name').dataset.pmName;
                    if (raw.startsWith('===')) {
                        const details = document.createElement('details'); details.className = 'nemo-engine-section';
                        const summary = document.createElement('summary');
                        row.classList.add('nemo-header-item'); row.dataset.nemoOriginalText = raw; row.draggable = false;
                        row.querySelector('a').textContent = raw.replace(/=/g, '').trim();
                        const count = document.createElement('span'); count.className = 'nemo-enabled-count';
                        const progress = document.createElement('span'); progress.className = 'nemo-section-progress';
                        row.querySelector('.completion_prompt_manager_prompt_name').append(count, progress);
                        summary.append(row); content = document.createElement('div'); content.className = 'nemo-section-content';
                        details.append(summary, content); list.append(details);
                    } else content.append(row);
                }
                list.querySelectorAll('details').forEach(s => this.updateSectionCount(s));
                delete list.dataset.nemoOrganizing;
                document.dispatchEvent(new Event('nemo-prompts-organized'));
            });
        },
    };
    const originals = { frame: pm.renderPromptManager, rows: pm.renderPromptManagerListItems, organize: nemo.organizePrompts };
    const runtime = installIncrementalRendering({ pm, nemo, minRows: 0,
        enabled: () => enabled, modeKey: () => mode,
        ...(unsafe ? { compatible: () => false } : {}) });
    const virtualizer = virtualize && !unsafe ? installSectionVirtualization({
        pm, nemo, renderer: runtime, minRows: 0,
        enabled: () => enabled, sectionsEnabled: () => true, modeKey: () => mode,
        notify: error => { throw error; },
    }) : null;
    const h = {
        pm, nemo, sources, order, counts, host, panel, input, runtime, virtualizer, originals,
        get generated() { return generated; }, get nativeFrames() { return nativeFrames; }, get organizations() { return organizations; },
        get optionalSyncs() { return optionalSyncs; }, get sourceReads() { return sourceReads; }, get inspected() { return inspected; }, get edited() { return edited; },
        get nativeDrags() { return nativeDrags; }, get gateStarted() { return gateStarted; },
        mode(value) { mode = value; document.dispatchEvent(new Event('nemo-dropdown-style-changed')); },
        enable(value) { enabled = value; runtime.reset(); },
        delay(value) { gate = value; },
        row(id) { return [...pm.listElement.querySelectorAll('li')].find(r => r.dataset.pmIdentifier === id); },
        async paint() { await pm.renderPromptManager(); await pm.renderPromptManagerListItems(); },
        async start() { await this.paint(); await nemo.organizePrompts(true); await settle(); return this; },
        async dispose() {
            await virtualizer?.dispose({ restore: true });
            runtime.dispose();
            for (const observer of Object.values(nemo.observers)) observer?.disconnect?.();
            panel.remove();
        },
    };
    return h;
}
async function using(fn, options) { const h = await harness(options).start(); try { await fn(h); } finally { await h.dispose(); } }

await test('unchanged redraw retains frame, row identity, section state and footer selection', () => using(async h => {
    const list = h.pm.listElement, row = h.row('p1'), section = row.closest('details'); section.open = true;
    const footer = h.host.querySelector('select'); footer.selectedIndex = 5;
    const count = h.generated; await h.paint();
    assert(h.pm.listElement === list); assert(h.row('p1') === row); assert(section.open); assert(h.host.querySelector('select') === footer);
    eq(footer.selectedIndex, 5); eq(h.generated, count); eq(h.nativeFrames, 1);
}));
await test('one toggle renders one native row and keeps every other row', () => using(async h => {
    const saved = [...h.pm.listElement.querySelectorAll('li')], old = h.row('p1'), generated = h.generated;
    h.order[1].enabled = false; h.pm.tokenUsage = 99; await h.paint();
    eq(h.generated - generated, 1); assert(h.row('p1') !== old);
    assert(h.row('p1').querySelector('.fa-toggle-off')); assert(h.row('p2') === saved[2]);
    eq(h.pm.listElement.querySelectorAll('li').length, 120);
    assert(h.host.querySelector('.completion_prompt_manager_header').textContent.includes('99'));
    eq(h.sourceReads, 0);
}));
await test('native changed-row edit, inspect and toggle listeners remain active', () => using(async h => {
    h.sources[1].role = 'assistant'; await h.paint();
    h.row('p1').querySelector('.prompt-manager-edit-action').click(); eq(h.edited, 'p1');
    h.row('p1').querySelector('a').click(); eq(h.inspected, 'p1');
    h.row('p1').querySelector('.prompt-manager-toggle-action').click(); eq(h.order[1].enabled, false);
    eq(h.row('p1').querySelector('small').dataset.role, 'assistant');
}));
await test('changed headers preserve short labels, metadata, counters and collapsed sections', () => using(async h => {
    const old = h.row('p0'), section = old.closest('details'), counter = old.querySelector('.nemo-enabled-count');
    h.counts.p0 = 4; await h.paint(); const row = h.row('p0');
    assert(row.closest('details') === section); assert(!section.open); assert(row.classList.contains('nemo-header-item'));
    eq(row.querySelector('a').textContent, 'Group 0'); eq(row.dataset.nemoOriginalText, '=== Group 0 ===');
    assert(row.querySelector('.nemo-enabled-count') === counter); assert(!row.draggable);
}));
await test('selected context-menu row is rebound after native replacement', () => using(async h => {
    h.nemo.selectedPromptItem = h.row('p1'); h.counts.p1 = 7; await h.paint();
    assert(h.nemo.selectedPromptItem === h.row('p1')); assert(h.nemo.selectedPromptItem.isConnected);
}));
await test('search-hidden row stays hidden and current search is refreshed', () => using(async h => {
    h.input.value = 'something'; h.row('p1').style.display = 'none'; h.counts.p1 = 5; await h.paint();
    eq(h.row('p1').style.display, 'none'); eq(h.nemo.searchCalls, 1);
}));
await test('permission changes use the native control layout', () => using(async h => {
    h.sources[1].marker = true; await h.paint(); assert(!h.row('p1').querySelector('.prompt-manager-edit-action'));
    h.sources[1].marker = false; await h.paint(); assert(h.row('p1').querySelector('.prompt-manager-edit-action'));
}));
await test('rename uses full native layout and preserves all ordered rows', () => using(async h => {
    const generated = h.generated; h.sources[1].name = '<New & "name">'; await h.paint();
    eq(h.generated - generated, 120); eq(h.row('p1').querySelector('a').textContent, '<New & "name">');
    eq(h.pm.listElement.querySelectorAll('li').length, h.order.length);
}));
await test('reorder never infers a truncated order from a partial row list', () => using(async h => {
    [h.order[1], h.order[2]] = [h.order[2], h.order[1]];
    await h.paint();
    eq([...h.pm.listElement.querySelectorAll('li')].map(r => r.dataset.pmIdentifier), h.order.map(e => e.identifier));
}));
await test('append and remove use full native rows without losing disabled entries', () => using(async h => {
    h.sources.push({ identifier: 'new', name: 'New', role: 'user' }); h.order.push({ identifier: 'new', enabled: false });
    await h.paint(); assert(h.row('new').querySelector('.fa-toggle-off'));
    h.order.splice(4, 1); await h.paint(); eq(h.pm.listElement.querySelectorAll('li').length, h.order.length);
    assert(!h.row('p4'));
}));
await test('missing rendered row falls back rather than treating it as deleted data', () => using(async h => {
    h.row('p4').remove(); await h.paint(); assert(h.row('p4')); eq(h.order.length, 120);
}));
await test('tray mode delegates to native rendering and leaving it resets the cache', () => using(async h => {
    h.mode('tray'); const n = h.generated; await h.paint(); eq(h.generated - n, 120); assert(!h.runtime.getStats().active);
    h.mode('accordion'); await h.paint(); await h.nemo.organizePrompts(true); await settle();
    const warm = h.generated; await h.paint(); eq(h.generated, warm);
}));
await test('opt-out retains native rendering and does not change prompt settings', () => using(async h => {
    const order = JSON.stringify(h.order); h.enable(false); const n = h.generated; await h.paint();
    eq(h.generated - n, 120); eq(JSON.stringify(h.order), order);
}));
await test('unsupported renderer uses native fallback only', () => using(async h => {
    const n = h.generated; await h.paint(); eq(h.generated - n, 120); assert(!h.runtime.getStats().supported);
}, { unsafe: true }));
await test('unchanged organization is skipped and forced requests coalesce', () => using(async h => {
    const n = h.organizations;
    h.nemo.organizePrompts(); h.nemo.organizePrompts(); await settle(); eq(h.organizations, n);
    h.nemo.organizePrompts(true); h.nemo.organizePrompts(true); h.nemo.organizePrompts(true); await settle();
    eq(h.organizations, n + 1);
}));
await test('unknown header markup falls back rather than removing third-party controls', () => using(async h => {
    h.host.querySelector('.completion_prompt_manager_header').lastElementChild.append(document.createElement('button'));
    const n = h.nativeFrames; await h.paint(); eq(h.nativeFrames, n + 1);
}));
await test('active dragging defers redraw and native drag reinitialization until release', () => using(async h => {
    const row = h.row('p1'), n = h.generated; row.classList.add('sortable-chosen'); h.counts.p1 = 9;
    await h.paint(); h.pm.makeDraggable(); eq(h.generated, n); eq(h.nativeDrags, 0); assert(h.row('p1') === row);
    row.classList.remove('sortable-chosen'); document.dispatchEvent(new Event('pointerup')); await settle();
    eq(h.pm.redrawRequests, 1); await h.paint(); eq(h.generated - n, 1);
}));
await test('async stale renderer result cannot overwrite newer metadata', () => using(async h => {
    let release; h.delay(new Promise(resolve => { release = resolve; })); h.counts.p1 = 8;
    const work = h.paint(); while (!h.gateStarted) await tick();
    h.sources[1].role = 'user'; h.delay(null); release(); await work; await settle();
    eq(h.runtime.getStats().stalePaints, 1); await h.paint(); eq(h.row('p1').querySelector('small').dataset.role, 'user');
}));
await test('native partial-render failure uses the complete native path safely', () => using(async h => {
    let reject; h.delay(new Promise((_resolve, fail) => { reject = fail; })); h.counts.p1 = 8;
    const work = h.paint(); while (!h.gateStarted) await tick(); h.delay(null); reject(new Error('template failure')); await work;
    eq(h.runtime.getStats().fallbacks, 1); eq(h.pm.listElement.querySelectorAll('li').length, 120);
}));
await test('sidebar observer ignores chat DOM and still detects its drawer', () => using(async h => {
    h.nemo.initializeObserver(h.pm.listElement);
    const outside = document.createElement('div'); outside.id = 'nemo-drawer-openai_chat_settings'; document.body.append(outside); await settle();
    eq(h.optionalSyncs, 0); outside.remove();
    const inside = document.createElement('div'); inside.id = 'nemo-drawer-openai_chat_settings'; h.panel.append(inside); await settle();
    eq(h.optionalSyncs, 1); eq(h.runtime.getStats().optionalObserverScope, 'left-nav-panel');
}));
await test('cleanup restores only owned methods and cancels scheduled redraws', () => using(async h => {
    const wrapped = h.pm.renderPromptManagerListItems;
    const later = function (...args) { return wrapped.apply(this, args); }; h.pm.renderPromptManagerListItems = later;
    h.runtime.redraw(); h.runtime.dispose(); await settle();
    assert(h.pm.renderPromptManagerListItems === later); assert(h.pm.renderPromptManager === h.originals.frame);
    assert(h.nemo.organizePrompts === h.originals.organize); eq(h.pm.redrawRequests, 0);
}));
await test('warm redraw does not install a competing native sorter over the existing Nemo sorter', () => using(async h => {
    const sorter = {}; h.pm.listElement.sortable = sorter; h.nemo.sortableInstances = new Set([sorter]);
    await h.paint(); h.pm.makeDraggable(); eq(h.nativeDrags, 0); eq(h.runtime.getStats().dragSetupsSkipped, 1);
    h.sources[1].name = 'new name'; await h.paint(); h.pm.makeDraggable(); eq(h.nativeDrags, 1);
}));
await test('native edit boundary invalidates stale metadata once without reading prompt bodies', () => using(async h => {
    const before = h.generated;
    eq(h.pm.updatePromptWithPromptEditForm(h.sources[1]), 'saved-original-edit');
    await h.paint(); eq(h.generated - before, 120);
    const warm = h.generated; await h.paint(); eq(h.generated, warm); eq(h.sourceReads, 0);
}));
await test('virtualization removes closed ordinary rows without retaining prompt bodies', () => using(async h => {
    const resident = h.pm.listElement.querySelectorAll('li.completion_prompt_manager_prompt').length;
    eq(resident, 6); assert(h.virtualizer.getStats().virtualized); eq(h.virtualizer.getStats().virtualizedRows, 114);
    eq(h.sourceReads, 0);
}, { virtualize: true }));

await test('opening a virtual section regenerates only its direct native rows and closing evicts them again', () => using(async h => {
    const section = h.pm.listElement.querySelector('details.nemo-engine-section');
    const before = h.generated; section.open = true; await settle();
    eq(h.generated - before, 19);
    eq(section.querySelectorAll(':scope > .nemo-section-content > li.completion_prompt_manager_prompt').length, 19);
    const row = h.row('p1'); row.querySelector('a').click(); eq(h.inspected, 'p1');
    section.open = false; await settle();
    eq(section.querySelectorAll(':scope > .nemo-section-content > li.completion_prompt_manager_prompt').length, 0);
    eq(h.pm.listElement.querySelectorAll('li.completion_prompt_manager_prompt').length, 6);
}, { virtualize: true }));

await test('incremental redraw respects intentional row absence and only repaints live changes', () => using(async h => {
    const start = h.generated;
    h.order[25].enabled = false; await h.paint();
    eq(h.generated, start); assert(!h.row('p25'));
    const section = h.pm.listElement.querySelector('details.nemo-engine-section');
    section.open = true; await settle();
    const afterOpen = h.generated;
    h.order[1].enabled = false; await h.paint();
    eq(h.generated, afterOpen + 1); assert(h.row('p1').querySelector('.fa-toggle-off'));
    eq(h.sourceReads, 0);
}, { virtualize: true }));

await test('virtualization cleanup restores the complete native row list before adapter teardown', async () => {
    const h = await harness({ virtualize: true }).start();
    try {
        eq(h.pm.listElement.querySelectorAll('li.completion_prompt_manager_prompt').length, 6);
        await h.virtualizer.dispose({ restore: true });
        eq(h.pm.listElement.querySelectorAll('li.completion_prompt_manager_prompt').length, 120);
        assert(!h.runtime.getStats().virtualized);
    } finally {
        h.runtime.dispose();
        for (const observer of Object.values(h.nemo.observers)) observer?.disconnect?.();
        h.panel.remove();
    }
});

await test('all 764 rows survive closed sections; repeated redraws generate none, a toggle generates one', () => using(async h => {
    const total = h.generated;
    for (let i = 0; i < 25; i++) await h.paint();
    eq(h.generated, total); eq(h.pm.listElement.querySelectorAll('li').length, 764);
    h.order[251].enabled = false; await h.paint(); eq(h.generated, total + 1);
    assert(h.runtime.getStats().virtualized === false); eq(h.sourceReads, 0);
    globalThis.renderingMeasurement = { rows: 764, warmRedraws: 25, warmRowsGenerated: 0, oneToggleRowsGenerated: 1 };
}, { n: 764 }));

const report = { stage: '5B.3/5', browserHarness: true, liveSillyTavern: false,
    tests: results.length, passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length, measurement: globalThis.renderingMeasurement, results };
document.body.replaceChildren();
const pre = document.createElement('pre'); pre.id = 'result'; pre.textContent = JSON.stringify(report); document.body.append(pre);
globalThis.renderingReport = report;
