import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createGeminiModelsRuntime } from '../features/gemini-models/controller.js';

// A small select fixture with option identity, missing-value behavior and native
// fallback selection after an option is removed. No browser dependencies in CI.
class Element {
    children = [];
    parentElement = null;
    selected = null;
    constructor(tagName) { this.tagName = tagName; }
    get options() { return this.children.flatMap(child => child.tagName === 'option' ? [child] : child.options); }
    get value() {
        if (this.tagName === 'option') return this.optionValue;
        if (this.selected === null) return '';
        return this.options.includes(this.selected) ? this.selected.value : (this.options[0]?.value ?? '');
    }
    set value(value) {
        if (this.tagName === 'option') this.optionValue = value;
        else this.selected = this.options.find(option => option.value === value) ?? null;
    }
    append(child) { child.parentElement = this; this.children.push(child); }
    prepend(child) { child.parentElement = this; this.children.unshift(child); }
    remove() {
        if (!this.parentElement) return;
        const siblings = this.parentElement.children;
        siblings.splice(siblings.indexOf(this), 1);
        this.parentElement = null;
    }
}

function fixture(settings = {}) {
    const selects = new Map();
    const events = new EventEmitter();
    const types = Object.fromEntries(['APP_READY', 'SETTINGS_LOADED', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'CHATCOMPLETION_SOURCE_CHANGED'].map(key => [key, key]));
    const changes = [];
    const observers = [];
    const document = {
        querySelector: selector => selects.get(selector) ?? null,
        createElement: tag => new Element(tag),
    };
    const addOption = (select, value) => {
        const option = document.createElement('option');
        option.value = value;
        select.append(option);
        return option;
    };
    for (const id of ['google', 'vertexai']) {
        const select = document.createElement('select');
        addOption(select, 'gemini-2.5-pro');
        select.value = 'gemini-2.5-pro';
        selects.set(`#model_${id}_select`, select);
    }
    class Observer {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe(select) { this.select = select; this.connected = true; }
        disconnect() { this.connected = false; }
    }
    const start = () => createGeminiModelsRuntime({
        document, getSettings: () => settings, Observer, events, types,
        notifyChange(select) {
            const provider = select === selects.get('#model_google_select') ? 'google' : 'vertexai';
            settings[`${provider}_model`] = select.value;
            changes.push([provider, select.value]);
        },
    });
    return { selects, events, types, changes, observers, settings, addOption, start };
}

const modelIds = ['gemini-4-argon', 'gemini-3.8-flash'];

test('both providers gain both model IDs without changing an existing selection', () => {
    const h = fixture({ google_model: 'gemini-2.5-pro', vertexai_model: 'gemini-2.5-pro' });
    const runtime = h.start();
    for (const select of h.selects.values()) {
        assert.deepEqual(select.options.map(option => option.value).sort(), ['gemini-2.5-pro', ...modelIds].sort());
        assert.equal(select.value, 'gemini-2.5-pro');
    }
    h.events.emit(h.types.APP_READY);
    h.events.emit(h.types.CHATCOMPLETION_SOURCE_CHANGED, 'vertexai');
    assert.equal(h.changes.length, 0);
    for (const select of h.selects.values()) assert.equal(select.options.length, 3);
    runtime.dispose();
});

test('each model restores independently for each provider through the native change path', () => {
    for (const google_model of modelIds) for (const vertexai_model of modelIds) {
        const h = fixture({ google_model, vertexai_model });
        const runtime = h.start();
        assert.equal(h.selects.get('#model_google_select').value, google_model);
        assert.equal(h.selects.get('#model_vertexai_select').value, vertexai_model);
        assert.deepEqual(h.changes, [['google', google_model], ['vertexai', vertexai_model]]);
        h.events.emit(h.types.APP_READY);
        assert.equal(h.changes.length, 2);
        runtime.dispose();
    }
});

test('original settings payload recovers a Vertex model cleared before extensions loaded', () => {
    const h = fixture({ google_model: 'gemini-2.5-pro', vertexai_model: '' });
    const runtime = h.start();
    h.selects.get('#model_vertexai_select').value = '';
    h.events.emit(h.types.SETTINGS_LOADED, { oai_settings: { google_model: 'gemini-4-argon', vertexai_model: 'gemini-3.8-flash' } });
    assert.equal(h.settings.google_model, 'gemini-4-argon');
    assert.equal(h.settings.vertexai_model, 'gemini-3.8-flash');
    runtime.dispose();
});

test('native entries and pre-existing CustomModels entries are retained without duplicate Nemo options', () => {
    const h = fixture({ google_model: 'gemini-4-argon' });
    const existing = [];
    for (const select of h.selects.values()) for (const model of modelIds) existing.push(h.addOption(select, model));
    const runtime = h.start();
    for (const select of h.selects.values()) assert.equal(select.options.length, 3);
    assert.equal(h.selects.get('#model_google_select').value, 'gemini-4-argon');
    runtime.dispose();
    for (const option of existing) assert.ok(option.parentElement);
});

test('CustomModels loading later supersedes only the matching Nemo entry and keeps selection', () => {
    const h = fixture({ google_model: 'gemini-4-argon' });
    const runtime = h.start();
    const select = h.selects.get('#model_google_select');
    const external = h.addOption(select, 'gemini-4-argon');
    h.observers[0].callback();
    assert.equal(select.value, 'gemini-4-argon');
    assert.deepEqual(select.options.filter(option => option.value === 'gemini-4-argon'), [external]);
    const externalFlash = h.addOption(select, 'gemini-3.8-flash');
    h.observers[0].callback();
    assert.equal(select.children.some(child => child.label === 'Nemo Models'), false);
    externalFlash.remove();
    h.observers[0].callback();
    assert.equal(select.options.filter(option => option.value === 'gemini-3.8-flash').length, 1);
    runtime.dispose();
    assert.ok(external.parentElement);
});

test('native list rebuilds restore entries; preset changes and later native choices stay authoritative', () => {
    const h = fixture({ google_model: 'gemini-4-argon' });
    const runtime = h.start();
    const select = h.selects.get('#model_google_select');
    for (const child of [...select.children]) child.remove();
    h.addOption(select, 'gemini-2.5-pro');
    h.observers[0].callback();
    assert.equal(select.value, 'gemini-4-argon');
    h.settings.google_model = 'gemini-3.8-flash';
    select.value = 'gemini-3.8-flash';
    h.events.emit(h.types.OAI_PRESET_CHANGED_AFTER);
    h.settings.google_model = 'gemini-2.5-pro';
    select.value = 'gemini-2.5-pro';
    h.events.emit(h.types.CHATCOMPLETION_SOURCE_CHANGED);
    assert.equal(select.value, 'gemini-2.5-pro');
    runtime.dispose();
});

test('late and replaced selectors bind on host events; cleanup disconnects and supports reinitialization', () => {
    const h = fixture();
    const select = h.selects.get('#model_google_select');
    h.selects.delete('#model_google_select');
    const runtime = h.start();
    h.selects.set('#model_google_select', select);
    h.events.emit(h.types.APP_READY);
    assert.equal(select.options.length, 3);
    const replacement = new Element('select');
    h.addOption(replacement, 'gemini-2.5-pro');
    replacement.value = 'gemini-2.5-pro';
    h.selects.set('#model_google_select', replacement);
    h.events.emit(h.types.CHATCOMPLETION_SOURCE_CHANGED);
    assert.equal(h.observers[1].connected, false);
    assert.equal(replacement.options.length, 3);
    runtime.dispose();
    runtime.dispose();
    assert.ok(h.observers.every(observer => !observer.connected));
    assert.ok(Object.values(h.types).every(type => h.events.listenerCount(type) === 0));
    assert.equal(select.options.length, 1);
    assert.equal(replacement.options.length, 1);
    h.observers[0].callback();
    assert.equal(replacement.options.length, 1);
    const next = h.start();
    assert.equal(replacement.options.length, 3);
    next.dispose();
});
