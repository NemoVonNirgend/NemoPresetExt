import test from 'node:test';
import assert from 'node:assert/strict';
import { installDeferredTokenCounts, isToggleOnlyChange, toggleSignature, STALE_CLASS } from '../features/prompt-rendering/deferred-counts.js';

function classList() {
    const set = new Set();
    return { set, toggle(name, on) { if (on) set.add(name); else set.delete(name); }, contains: name => set.has(name) };
}
class NativeManager {
    constructor(n = 4) {
        this.calls = [];
        this.prompts = Array.from({ length: n }, (_, i) => ({ identifier: `p${i}`, name: `Prompt ${i}`, role: 'system' }));
        this.order = this.prompts.map(p => ({ identifier: p.identifier, enabled: true }));
        this.counts = Object.fromEntries(this.prompts.map(p => [p.identifier, 10]));
        this.serviceSettings = { prompts: this.prompts, openai_max_context: 1000, openai_max_tokens: 100 };
        this.configuration = { prefix: 'completion_', promptOrder: { strategy: 'global' }, warningTokenThreshold: 1, dangerTokenThreshold: 1 };
        this.activeCharacter = { id: 1, name: 'c' }; this.tokenUsage = 40; this.overriddenPrompts = []; this.error = null;
        this.tokenHandler = { getCounts: () => this.counts };
        const listeners = [];
        this.containerElement = { classList: classList(), listeners,
            addEventListener: (_type, fn) => listeners.push(fn),
            removeEventListener: (_type, fn) => listeners.splice(listeners.indexOf(fn), 1) };
    }
    getPromptOrderForCharacter() { return this.order; }
    isPromptDeletionAllowed() { return true; } isPromptEditAllowed() { return true; }
    isPromptToggleAllowed() { return true; } isPromptInspectionAllowed() { return true; }
    // Native ST: render() runs the dry run; render(false) only repaints.
    render(afterTryGenerate = true) { this.calls.push(afterTryGenerate); }
    setChatCompletion() { this.calls.push('counted'); }
    // ST's own toggle button handler: nulls the count, flips, renders.
    nativeToggle(id) {
        this.counts[id] = null;
        const entry = this.order.find(e => e.identifier === id); entry.enabled = !entry.enabled;
        this.render();
    }
}
const stale = pm => pm.containerElement.classList.contains(STALE_CLASS);
const header = { closest: selector => (selector === '.completion_prompt_manager_header' ? {} : null) };

test('a toggle-only change repaints without the dry run and marks counts stale', () => {
    const pm = new NativeManager(), counts = installDeferredTokenCounts({ pm });
    pm.nativeToggle('p1');
    assert.deepEqual(pm.calls, [false]); assert(stale(pm));
    assert.equal(counts.getStats().deferredDryRuns, 1);
    // Several toggles and directive auto-resolution (many prompts at once) are still toggles.
    pm.order[2].enabled = false; pm.order[3].enabled = false; pm.render();
    assert.deepEqual(pm.calls, [false, false]);
    counts.dispose();
});

test('ST counting again (dry run or real generation) clears the stale marker', () => {
    const pm = new NativeManager(), counts = installDeferredTokenCounts({ pm });
    pm.nativeToggle('p1'); assert(stale(pm));
    pm.setChatCompletion({}); assert(!stale(pm));
    counts.dispose();
});

test('edits, structure changes and unchanged redraws keep the native dry run', () => {
    const pm = new NativeManager(), counts = installDeferredTokenCounts({ pm });
    pm.render(); assert.deepEqual(pm.calls, [true], 'unchanged redraw (e.g. new message) recounts');
    pm.prompts[1].role = 'user'; pm.order[1].enabled = false; pm.render();
    assert.deepEqual(pm.calls, [true, true], 'a toggle mixed with an edit recounts');
    [pm.order[0], pm.order[2]] = [pm.order[2], pm.order[0]]; pm.render();
    assert.deepEqual(pm.calls, [true, true, true], 'reorder recounts');
    pm.render(false); assert.deepEqual(pm.calls, [true, true, true, false], 'explicit live repaint is untouched');
    assert(!stale(pm)); counts.dispose();
});

test('opt-out restores per-toggle counting', () => {
    const pm = new NativeManager(); let on = false;
    const counts = installDeferredTokenCounts({ pm, enabled: () => on });
    pm.nativeToggle('p1'); assert.deepEqual(pm.calls, [true]); assert(!stale(pm));
    on = true; pm.nativeToggle('p2'); assert.deepEqual(pm.calls, [true, false]);
    counts.dispose();
});

test('clicking the stale total recounts on demand', () => {
    const pm = new NativeManager(), counts = installDeferredTokenCounts({ pm });
    pm.containerElement.listeners[0]({ target: header }); assert.deepEqual(pm.calls, [], 'fresh total ignores clicks');
    pm.nativeToggle('p1'); pm.containerElement.listeners[0]({ target: header });
    assert.deepEqual(pm.calls, [false, true]);
    counts.dispose();
});

test('dispose restores the native prototype methods and clears the marker', () => {
    const pm = new NativeManager(), counts = installDeferredTokenCounts({ pm });
    pm.nativeToggle('p1'); counts.dispose();
    assert(!Object.prototype.hasOwnProperty.call(pm, 'render'));
    assert(!Object.prototype.hasOwnProperty.call(pm, 'setChatCompletion'));
    assert(!stale(pm)); assert.equal(pm.containerElement.listeners.length, 0);
    pm.nativeToggle('p2'); assert.deepEqual(pm.calls.at(-1), true);
});

test('toggle detection compares visual metadata only, never prompt bodies', () => {
    const pm = new NativeManager();
    for (const p of pm.prompts) Object.defineProperty(p, 'content', { get() { throw new Error('body read'); } });
    const before = toggleSignature(pm); pm.order[0].enabled = false;
    assert.equal(isToggleOnlyChange(before, toggleSignature(pm)), true);
    assert.equal(isToggleOnlyChange(before, before), false);
    assert.equal(isToggleOnlyChange(null, before), false);
});
