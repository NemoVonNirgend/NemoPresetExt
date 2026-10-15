import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { createPresetInstaller } from '../features/preset-installer/controller.js';
import { DEFAULT_PRESET_ID, NEMO_ENGINE_PRESETS, NEMO_ENGINE_VERSION, getNemoEnginePreset, getNemoEngineAssetPaths, loadNemoEnginePreset } from '../features/preset-installer/presets.js';

const stats = { promptCount: 2, regexScriptCount: 1 };
const fixture = () => ({ prompts: [{ identifier: 'core', content: 'source' }], prompt_order: [], extensions: { regex_scripts: [{ scriptName: 'retained' }] } });
const gate = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function harness(overrides = {}) {
    const calls = [], names = new Set(), records = [];
    const dependencies = {
        async loadPreset(entry) { calls.push(['load', entry.id]); return { preset: fixture(), stats }; },
        async processPreset(preset) { calls.push(['process']); preset.extensions.processed = true; },
        async savePreset(body) { calls.push(['save', JSON.parse(body)]); return JSON.parse(body).name; },
        registerPreset(name) { calls.push(['register', name]); names.add(name); },
        async selectPreset(name) { calls.push(['select', name]); },
        getPresetNames: () => [...names],
        recordInstall(result) { calls.push(['record']); records.push(result); },
        ...overrides,
    };
    return { ...createPresetInstaller(dependencies), calls, names, records };
}

test('all four bundled editions match the release fingerprints and retain both profiles and regex scripts', async () => {
    assert.equal(new Set(NEMO_ENGINE_PRESETS.map(entry => entry.id)).size, 4);
    for (const entry of NEMO_ENGINE_PRESETS) {
        const fetchFn = async url => new Response(await readFile(new URL(`../${url}`, import.meta.url)));
        const text = (await Promise.all(getNemoEngineAssetPaths(entry).map(async path =>
            (await fetchFn(path)).text()))).join('');
        const { preset, stats } = await loadNemoEnginePreset(entry, { fetchFn });
        assert.equal(Buffer.byteLength(text), entry.bytes);
        assert.equal(stats.promptCount, entry.promptCount);
        assert.equal(stats.regexScriptCount, 493);
        assert.equal(preset.prompt_order.length, 2);
        assert.equal(entry.version, '12.1');
        assert.equal(preset.prompts.some(p => p.content?.includes('\u2800')), entry.id.includes('braille'));
    }
    assert.equal(getNemoEnginePreset().id, DEFAULT_PRESET_ID);
    assert.throws(() => getNemoEnginePreset('unreleased'), /Unknown Nemo Engine edition/);
});

test('bundled-file tampering and failed reads stop before parsing or installation', async () => {
    await assert.rejects(loadNemoEnginePreset(getNemoEnginePreset(), { fetchFn: async () => new Response('{edited') }), /does not match this extension release/);
    await assert.rejects(loadNemoEnginePreset(getNemoEnginePreset(), { fetchFn: async () => new Response('', { status: 404 }) }), /404/);
});

test('a missing or edited Full asset part fails before accepting an incomplete preset', async () => {
    const entry = getNemoEnginePreset('full');
    const fetchFn = async url => new Response(await readFile(new URL(`../${url}`, import.meta.url)));
    await assert.rejects(loadNemoEnginePreset(entry, { fetchFn: url => url.endsWith('part-02')
        ? new Response('', { status: 404 }) : fetchFn(url) }), /404/);
    await assert.rejects(loadNemoEnginePreset(entry, { fetchFn: url => url.endsWith('part-02')
        ? new Response('edited') : fetchFn(url) }), /does not match this extension release/);
});

test('one click processes before saving, retains regex scripts, then selects and records the chosen edition', async () => {
    const x = harness();
    const result = await x.install({ presetId: 'full-braille' });
    assert.deepEqual(x.calls.map(c => c[0]), ['load', 'process', 'save', 'register', 'select', 'record']);
    const saved = x.calls.find(c => c[0] === 'save')[1];
    assert.equal(saved.apiId, 'openai');
    assert.equal(saved.preset.extensions.processed, true);
    assert.deepEqual(saved.preset.extensions.regex_scripts, fixture().extensions.regex_scripts);
    assert.equal(result.id, 'full-braille');
    assert.equal(result.name, getNemoEnginePreset('full-braille').name);
    assert.equal(result.selected, true);
});

test('reimports preserve customized copies and choose an unused name', async () => {
    const x = harness();
    const original = getNemoEnginePreset().name;
    x.names.add(original); x.names.add(`${original} (2)`);
    assert.equal((await x.install()).name, `${original} (3)`);
    assert.equal((await x.install()).name, `${original} (4)`);
});

test('installation does not report success before async native preset selection completes', async () => {
    const entered = gate(), ready = gate();
    const x = harness({ selectPreset: async () => { entered.resolve(); await ready.promise; } });
    const pending = x.install();
    await entered.promise;
    assert.equal(x.records.length, 0);
    ready.resolve(); await pending;
    assert.equal(x.records.length, 1);
});

test('an import serialization barrier still blocks save when native events swallow the processing error', async () => {
    const x = harness({ processPreset: async preset => {
        Object.defineProperty(preset, 'toJSON', { value() { throw new Error('Vex import stopped'); } });
    } });
    await assert.rejects(x.install(), /Vex import stopped/);
    assert.deepEqual(x.calls.map(c => c[0]), ['load']);
    assert.equal(x.records.length, 0);
});

test('processing and save failures leave existing presets unselected and allow retry', async () => {
    let fail = true;
    const x = harness({ processPreset: async () => { if (fail) throw new Error('storage failed'); } });
    await assert.rejects(x.install(), /storage failed/);
    assert.deepEqual(x.calls.map(c => c[0]), ['load']);
    fail = false; await x.install();
    assert.equal(x.records.length, 1);
    const y = harness({ savePreset: async () => { throw new Error('HTTP 500'); } });
    await assert.rejects(y.install(), /HTTP 500/);
    assert.equal(y.names.size, 0);
    assert.equal(y.records.length, 0);
});

test('double clicks share one transaction; another edition cannot be silently substituted', async () => {
    const ready = gate();
    const x = harness({ loadPreset: async () => { await ready.promise; return { preset: fixture(), stats }; } });
    const first = x.install();
    assert.equal(x.install(), first);
    await assert.rejects(x.install({ presetId: 'full' }), /Another Nemo Engine edition/);
    ready.resolve(); await first;
    assert.equal(x.records.length, 1);
});

test('API callers can save without selecting a new active preset', async () => {
    const x = harness();
    const result = await x.install({ selectAfterInstall: false });
    assert.equal(result.selected, false);
    assert.equal(x.calls.some(c => c[0] === 'select'), false);
});

test('host adapter imports the chosen asset, awaits native selection, and remembers editions separately', async () => {
    const source = (await readFile(new URL('../features/preset-installer/runtime.js', import.meta.url), 'utf8'))
        .replace(/^import .*;$/gm, '').replace(/^export /gm, '');
    const select = { querySelector() { return null; }, appendChild() {} };
    const applied = gate(), entered = gate(), calls = [], settings = { preset_settings_openai: 'Previous' };
    const extensionSettings = {}, names = {}, presets = [], storedBodies = new Map();
    const api = new Script(source + '\n({ installBundledNemoEnginePreset, getNemoEngineSetupReport })').runInNewContext({
        NEMO_ENGINE_VERSION, DEFAULT_PRESET_ID, NEMO_ENGINE_PRESETS, getNemoEnginePreset, createPresetInstaller,
        loadNemoEnginePreset: async (entry, { url }) => {
            calls.push(url);
            const content = ['NemoLoreTimeline', 'NemoLoreRetrievedArchive', 'NemoLorePreferences', 'NemoGuidesInstructions', 'NemoGuidesToolResults'].map(s => `{{getglobalvar::${s}}}`).join('');
            return { preset: { ...fixture(), prompts: [{ identifier: 'core', content }] }, stats };
        },
        eventSource: { async emit(_type, { data }) {
            data.extensions.processed = true;
            const prompt = data.prompts[0], key = storedBodies.size;
            storedBodies.set(key, prompt.content);
            prompt.content = '{{// stored prompt body }}';
            prompt.testBodyKey = key;
        } },
        event_types: { OAI_PRESET_IMPORT_READY: 'import' },
        getRequestHeaders: () => ({}), saveSettingsDebounced() {},
        extension_settings: extensionSettings, oai_settings: settings, openai_setting_names: names, openai_settings: presets,
        getPresetManager: () => ({ async selectPreset(value) {
            entered.resolve(); await applied.promise;
            settings.preset_settings_openai = Object.keys(names).find(name => String(names[name]) === value);
        } }),
        document: { querySelector: () => select, createElement: () => ({}) }, CSS: { escape: v => v },
        structuredClone, logger: {}, getExtensionPath: p => `/extension/${p}`, escapeHtml: v => String(v),
        NemoColdPrompts: { readBody: async prompt => storedBodies.get(prompt.testBodyKey) },
        fetch: async (_url, { body }) => ({ ok: true, json: async () => ({ name: JSON.parse(body).name }) }),
    });
    const pending = api.installBundledNemoEnginePreset({ presetId: 'full' });
    await entered.promise;
    assert.equal(extensionSettings.NemoPresetExt, undefined);
    applied.resolve(); await pending;
    assert.equal((await api.getNemoEngineSetupReport({ presetId: 'full' })).hasErrors, false);
    assert.equal((await api.getNemoEngineSetupReport({ presetId: 'full' })).hasWarnings, false);
    await api.installBundledNemoEnginePreset({ presetId: 'standard', selectAfterInstall: false });
    assert.equal(Object.keys(extensionSettings.NemoPresetExt.nemoEnginePresetInstaller.presets).length, 2);
    assert.equal(settings.preset_settings_openai, getNemoEnginePreset('full').name);
    assert.equal(calls[0], '/extension/assets/nemo-engine/v12.1-full.json');
});
