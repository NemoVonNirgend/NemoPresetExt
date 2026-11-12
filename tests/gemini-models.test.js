import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
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

function fixture(settings = {}, { memory = {}, startupSettings = settings } = {}) {
    const selects = new Map();
    const events = new EventEmitter();
    const types = Object.fromEntries(['APP_READY', 'SETTINGS_LOADED', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'CHATCOMPLETION_SOURCE_CHANGED', 'CHATCOMPLETION_MODEL_CHANGED', 'CONNECTION_PROFILE_LOADED'].map(key => [key, key]));
    const changes = [];
    const observers = [];
    const memoryWrites = [];
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
    function notifyChange(select) {
        const provider = select === selects.get('#model_google_select') ? 'google' : 'vertexai';
        settings[`${provider}_model`] = select.value;
        changes.push([provider, select.value]);
        events.emit(types.CHATCOMPLETION_MODEL_CHANGED, select.value);
    }
    const start = () => createGeminiModelsRuntime({
        document, getSettings: () => settings, Observer, events, types, notifyChange,
        getStartupSettings: () => startupSettings,
        getModelMemory: () => memory,
        saveModelMemory(models) {
            for (const key of Object.keys(memory)) delete memory[key];
            Object.assign(memory, models);
            memoryWrites.push(structuredClone(models));
        },
    });
    return { selects, events, types, changes, observers, settings, addOption, start, notifyChange, memory, memoryWrites };
}

const modelIds = ['gemini-4-carbon', 'gemini-4-argon', 'gemini-4-hydrogen', 'gemini-3.8-flash'];

test('both providers gain all managed model IDs without changing an existing selection', () => {
    const h = fixture({ google_model: 'gemini-2.5-pro', vertexai_model: 'gemini-2.5-pro' });
    const runtime = h.start();
    for (const select of h.selects.values()) {
        assert.deepEqual(select.options.map(option => option.value).sort(), ['gemini-2.5-pro', ...modelIds].sort());
        assert.equal(select.value, 'gemini-2.5-pro');
    }
    h.events.emit(h.types.APP_READY);
    h.events.emit(h.types.CHATCOMPLETION_SOURCE_CHANGED, 'vertexai');
    assert.equal(h.changes.length, 0);
    for (const select of h.selects.values()) assert.equal(select.options.length, modelIds.length + 1);
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

test('startup snapshot recovers models cleared before extension load with a payload-free SETTINGS_LOADED event', () => {
    const saved = { google_model: 'gemini-4-carbon', vertexai_model: 'gemini-4-hydrogen' };
    const h = fixture({ google_model: '', vertexai_model: '' }, { startupSettings: saved });
    const runtime = h.start();
    h.events.emit(h.types.SETTINGS_LOADED); // Actual native event has no payload.
    assert.equal(h.settings.google_model, saved.google_model);
    assert.equal(h.settings.vertexai_model, saved.vertexai_model);
    runtime.dispose();
});

test('a complete restart restores both providers from serialized model memory even if native settings were saved blank', () => {
    for (const google_model of modelIds) for (const vertexai_model of modelIds) {
        const initial = fixture({ google_model, vertexai_model });
        const firstRuntime = initial.start();
        const diskMemory = JSON.parse(JSON.stringify(initial.memory));
        assert.deepEqual(diskMemory, { google_model, vertexai_model });
        firstRuntime.dispose();

        const reboot = fixture({ google_model: '', vertexai_model: '' }, { memory: diskMemory });
        const runtime = reboot.start();
        reboot.events.emit(reboot.types.SETTINGS_LOADED);
        reboot.events.emit(reboot.types.APP_READY);
        assert.equal(reboot.settings.google_model, google_model);
        assert.equal(reboot.settings.vertexai_model, vertexai_model);
        assert.equal(reboot.selects.get('#model_google_select').value, google_model);
        assert.equal(reboot.selects.get('#model_vertexai_select').value, vertexai_model);
        assert.equal(reboot.memoryWrites.length, 0, 'restoring unchanged memory should not schedule another save');
        runtime.dispose();
    }
});

test('selecting another model updates persistent memory and switching to a native model releases it across restarts', () => {
    const h = fixture({ google_model: 'gemini-4-argon', vertexai_model: 'gemini-3.8-flash' });
    const runtime = h.start();
    const google = h.selects.get('#model_google_select');
    google.value = 'gemini-3.8-flash';
    h.notifyChange(google);
    assert.deepEqual(h.memory, { google_model: 'gemini-3.8-flash', vertexai_model: 'gemini-3.8-flash' });
    google.value = 'gemini-2.5-pro';
    h.notifyChange(google);
    assert.deepEqual(h.memory, { vertexai_model: 'gemini-3.8-flash' });
    const diskMemory = JSON.parse(JSON.stringify(h.memory));
    runtime.dispose();

    const reboot = fixture({ google_model: '', vertexai_model: '' }, { memory: diskMemory });
    const next = reboot.start();
    reboot.events.emit(reboot.types.SETTINGS_LOADED);
    assert.equal(reboot.settings.google_model, '');
    assert.equal(reboot.settings.vertexai_model, 'gemini-3.8-flash');
    next.dispose();
});

test('non-empty live and startup native choices take precedence over an older remembered managed model', () => {
    for (const live of ['gemini-2.5-pro', '']) {
        const h = fixture({ google_model: live }, {
            memory: { google_model: 'gemini-4-argon' },
            startupSettings: { google_model: 'gemini-2.5-pro' },
        });
        const runtime = h.start();
        assert.equal(h.selects.get('#model_google_select').value, 'gemini-2.5-pro');
        assert.deepEqual(h.memory, {});
        runtime.dispose();
    }
});

test('production runtime saves per-account extension settings and restores them on successive fresh boots', () => {
    const source = readFileSync(new URL('../features/gemini-models/runtime.js', import.meta.url), 'utf8')
        .replace(/^import .*;$/gm, '').replace(/^export /gm, '');
    let disk = {
        oai_settings: { google_model: 'gemini-4-carbon', vertexai_model: 'gemini-4-hydrogen' },
        extension_settings: { NemoPresetExt: { enableReSwipe: true } },
    };
    for (let boot = 0; boot < 3; boot++) {
        // Native settings load before extensions and cannot select unknown IDs.
        const h = fixture({ google_model: disk.oai_settings.google_model, vertexai_model: '' });
        for (const select of h.selects.values()) select.value = 'missing-model';
        const extensions = structuredClone(disk.extension_settings);
        let saves = 0;
        const api = new Script(source + '\n({ initializeGeminiModels, cleanupGeminiModels })').runInNewContext({
            eventSource: h.events, event_types: h.types, oai_settings: h.settings,
            savedSettings: structuredClone(disk), extension_settings: extensions,
            NEMO_EXTENSION_NAME: 'NemoPresetExt', saveSettingsDebounced() { saves++; },
            createGeminiModelsRuntime, MutationObserver: undefined,
            document: {
                querySelector: selector => h.selects.get(selector) ?? null,
                createElement: tag => new Element(tag),
            },
            $: select => ({ trigger: name => { assert.equal(name, 'change'); h.notifyChange(select); } }),
        });
        api.initializeGeminiModels();
        api.initializeGeminiModels();
        h.events.emit(h.types.SETTINGS_LOADED);
        h.events.emit(h.types.APP_READY);
        assert.equal(h.settings.google_model, 'gemini-4-carbon');
        assert.equal(h.settings.vertexai_model, 'gemini-4-hydrogen');
        assert.equal(h.selects.get('#model_google_select').value, 'gemini-4-carbon');
        assert.equal(h.selects.get('#model_vertexai_select').value, 'gemini-4-hydrogen');
        assert.equal(saves, boot === 0 ? 1 : 0, 'only a changed backup schedules a settings save');
        disk = JSON.parse(JSON.stringify({ oai_settings: h.settings, extension_settings: extensions }));
        assert.equal(disk.extension_settings.NemoPresetExt.enableReSwipe, true);
        assert.deepEqual(disk.extension_settings.NemoPresetExt.geminiModels, {
            google_model: 'gemini-4-carbon', vertexai_model: 'gemini-4-hydrogen',
        });
        api.cleanupGeminiModels();
        assert.ok(Object.values(h.types).every(type => h.events.listenerCount(type) === 0));
        // Also cover recovering from a prior save of temporarily blank fields.
        disk.oai_settings.google_model = '';
        disk.oai_settings.vertexai_model = '';
    }
});

test('unsupported or malformed backup values cannot inject arbitrary model entries', () => {
    for (const memory of [null, 'gemini-4-argon', { google_model: 'custom-invalid-model', vertexai_model: {} }]) {
        const h = fixture({}, { memory });
        const runtime = h.start();
        for (const select of h.selects.values()) {
            assert.equal(select.value, 'gemini-2.5-pro');
            assert.equal(select.options.some(option => option.value === 'custom-invalid-model'), false);
        }
        runtime.dispose();
    }
});

test('native entries and pre-existing CustomModels entries are retained without duplicate Nemo options', () => {
    const h = fixture({ google_model: 'gemini-4-argon' });
    const existing = [];
    for (const select of h.selects.values()) for (const model of modelIds) existing.push(h.addOption(select, model));
    const runtime = h.start();
    for (const select of h.selects.values()) assert.equal(select.options.length, modelIds.length + 1);
    assert.equal(h.selects.get('#model_google_select').value, 'gemini-4-argon');
    runtime.dispose();
    for (const option of existing) assert.ok(option.parentElement);
});

test('CustomModels loading later supersedes only the matching Nemo entry and keeps selection', () => {
    const h = fixture({ google_model: 'gemini-4-carbon' });
    const runtime = h.start();
    const select = h.selects.get('#model_google_select');
    const external = h.addOption(select, 'gemini-4-carbon');
    h.observers[0].callback();
    assert.equal(select.value, 'gemini-4-carbon');
    assert.deepEqual(select.options.filter(option => option.value === 'gemini-4-carbon'), [external]);
    assert.equal(select.children.some(child => child.label === 'Nemo Models'), true);
    let externalHydrogen;
    for (const model of modelIds.filter(model => model !== 'gemini-4-carbon')) {
        const option = h.addOption(select, model);
        if (model === 'gemini-4-hydrogen') externalHydrogen = option;
        h.observers[0].callback();
        assert.deepEqual(select.options.filter(entry => entry.value === model), [option]);
        assert.equal(select.value, 'gemini-4-carbon');
    }
    assert.equal(select.children.some(child => child.label === 'Nemo Models'), false);
    externalHydrogen.remove();
    h.observers[0].callback();
    assert.equal(select.options.filter(option => option.value === 'gemini-4-hydrogen').length, 1);
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

test('list rebuild recovers a managed model even when the host saves an empty value before the observer runs', () => {
    for (const provider of ['google', 'vertexai']) for (const model of modelIds) {
        const h = fixture({ [`${provider}_model`]: model });
        const runtime = h.start();
        const select = h.selects.get(`#model_${provider}_select`);

        for (const child of [...select.children]) child.remove();
        h.addOption(select, 'gemini-2.5-pro');
        select.value = model; // Native .val(savedModel) cannot select a missing option.
        h.settings[`${provider}_model`] = select.value;
        assert.equal(h.settings[`${provider}_model`], '');
        for (const observer of h.observers) observer.callback();

        assert.equal(select.value, model);
        assert.equal(h.settings[`${provider}_model`], model);
        runtime.dispose();
    }
});

test('model and profile events repair blank selections without a child-list mutation or a notification loop', () => {
    for (const event of ['CHATCOMPLETION_MODEL_CHANGED', 'CONNECTION_PROFILE_LOADED']) {
        const h = fixture({ google_model: 'gemini-3.8-flash', vertexai_model: 'gemini-4-argon' });
        const runtime = h.start();
        for (const provider of ['google', 'vertexai']) {
            h.selects.get(`#model_${provider}_select`).value = '';
            h.settings[`${provider}_model`] = '';
        }
        h.events.emit(h.types[event], '');

        assert.equal(h.selects.get('#model_google_select').value, 'gemini-3.8-flash');
        assert.equal(h.settings.google_model, 'gemini-3.8-flash');
        assert.equal(h.selects.get('#model_vertexai_select').value, 'gemini-4-argon');
        assert.equal(h.settings.vertexai_model, 'gemini-4-argon');
        assert.equal(h.changes.length, 4, 'each repair should notify the host only once');
        runtime.dispose();
    }
});

test('a later native model choice releases the previous managed selection for that provider', () => {
    const h = fixture({ google_model: 'gemini-4-argon', vertexai_model: 'gemini-3.8-flash' });
    const runtime = h.start();
    const google = h.selects.get('#model_google_select');
    google.value = 'gemini-2.5-pro';
    h.notifyChange(google);
    assert.equal(google.value, 'gemini-2.5-pro');

    google.value = '';
    h.notifyChange(google);
    h.events.emit(h.types.CONNECTION_PROFILE_LOADED, 'Native model profile');
    assert.equal(google.value, '', 'an old Argon selection must not override a later native choice');
    assert.equal(h.settings.google_model, '');
    assert.equal(h.settings.vertexai_model, 'gemini-3.8-flash');
    runtime.dispose();
});

test('late and replaced selectors bind on host events; cleanup disconnects and supports reinitialization', () => {
    const h = fixture();
    const select = h.selects.get('#model_google_select');
    h.selects.delete('#model_google_select');
    const runtime = h.start();
    h.selects.set('#model_google_select', select);
    h.events.emit(h.types.APP_READY);
    assert.equal(select.options.length, modelIds.length + 1);
    const replacement = new Element('select');
    h.addOption(replacement, 'gemini-2.5-pro');
    replacement.value = 'gemini-2.5-pro';
    h.selects.set('#model_google_select', replacement);
    h.events.emit(h.types.CHATCOMPLETION_SOURCE_CHANGED);
    assert.equal(h.observers[1].connected, false);
    assert.equal(replacement.options.length, modelIds.length + 1);
    runtime.dispose();
    runtime.dispose();
    assert.ok(h.observers.every(observer => !observer.connected));
    assert.ok(Object.values(h.types).every(type => h.events.listenerCount(type) === 0));
    assert.equal(select.options.length, 1);
    assert.equal(replacement.options.length, 1);
    h.observers[0].callback();
    assert.equal(replacement.options.length, 1);
    const next = h.start();
    assert.equal(replacement.options.length, modelIds.length + 1);
    next.dispose();
});
