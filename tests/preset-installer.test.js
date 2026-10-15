import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { PRESET_VARIANTS, PRESET_VERSION, DEFAULT_VARIANT, presetVariant } from '../features/preset-installer/catalog.js';
import { loadPresetAsset } from '../features/preset-installer/asset-loader.js';
import { createRecipeRuntime } from '../features/recipe-runtime/controller.js';
import { RecipeStore } from '../features/recipe-runtime/store.js';
import { createVexRuntime } from '../features/vex-runtime/controller.js';
import { createColdPromptRuntime } from '../features/cold-prompts/controller.js';
import { PromptBodyStore } from '../features/cold-prompts/store.js';
import { server, Events, TYPES } from './vex-runtime-fixture.mjs';

const source = (await readFile(new URL('../features/preset-installer/runtime.js', import.meta.url), 'utf8'))
    .replace(/^import .*;$/gm, '').replace(/^export /gm, '')
    + '\nglobalThis.installer = { installBundledNemoEnginePreset, loadBundledNemoEnginePreset, getNemoEngineSetupReport, createInstallerCard };';

function harness({ failSave = false, skipProcessing = false, corrupt = false } = {}) {
    const io = server(), events = new Events(), saves = [], state = {}, receipts = { NemoPresetExt: {} };
    const manager = {
        serviceSettings: { prompts: [], prompt_order: [] }, activeCharacter: { id: 100001 },
        getPromptOrderForCharacter() { return this.serviceSettings.prompt_order.find(p => p.character_id === this.activeCharacter.id)?.order ?? []; },
        preparePrompt(prompt) { return { ...prompt }; }, getPromptCollection() { return []; },
        async tryGenerate() {}, async saveServiceSettings() {}, loadPromptIntoEditForm() {},
        import(data) { return data; }, export(data) { return data; },
    };
    const options = { events, types: TYPES, getManager: () => manager,
        getContext: () => ({ mainApi: 'openai', variables: { local: { get: () => '', del() {} } } }) };
    const recipe = createRecipeRuntime({ ...options, store: new RecipeStore({ fetchFn: io.fetchFn }) });
    let cold;
    const vex = createVexRuntime({ ...options, store: io.store, readBody: p => cold.readBody(p) });
    cold = createColdPromptRuntime({ ...options, store: new PromptBodyStore({ fetchFn: io.fetchFn }) });
    const context = createContext({
        PRESET_VARIANTS, PRESET_VERSION, DEFAULT_VARIANT, presetVariant, loadPresetAsset,
        eventSource: skipProcessing ? { emit: async () => {} } : events, event_types: TYPES,
        getRequestHeaders: () => ({}), saveSettingsDebounced() {},
        extension_settings: receipts, oai_settings: state, openai_setting_names: {}, openai_settings: [],
        getExtensionPath: p => p, escapeHtml: String, logger: { error() {}, info() {} },
        NemoColdPrompts: {}, NemoRecipeRuntime: {}, NemoVexRuntime: {},
        document: { querySelector: () => null }, window: {}, structuredClone, Date,
        fetch: async (url, options) => {
            if (url.startsWith('assets/')) {
                const bytes = await readFile(new URL('../' + url.split('?')[0], import.meta.url));
                if (corrupt) bytes[bytes.length - 1] ^= 1;
                return new Response(bytes);
            }
            assert.equal(url, '/api/presets/save');
            const body = JSON.parse(options.body); saves.push(body);
            return failSave ? new Response('failed', { status: 500 }) : Response.json({ name: body.name });
        },
    });
    context.loadPresetAsset = (variant, url) => loadPresetAsset(variant, url, context.fetch);
    new Script(source).runInContext(context);
    return { ...context.installer, context, receipts, state, saves, io, events, manager, recipe, vex, cold,
        dispose() { cold.dispose(); vex.dispose(); recipe.dispose(); } };
}

for (const variant of PRESET_VARIANTS) test(`bundled ${variant.id}: one-click processing, saved profiles and exact export`, async () => {
    const h = harness();
    try {
        const original = (await h.loadBundledNemoEnginePreset(variant.id)).preset;
        const result = await h.installBundledNemoEnginePreset({ variantId: variant.id });
        assert.equal(result.name, variant.name); assert.equal(result.variantId, variant.id);
        assert.equal(h.saves.length, 1); assert.equal(h.saves[0].apiId, 'openai');
        assert(h.saves[0].preset.prompts.some(p => p.nemoPromptBody));
        assert.equal(!!h.saves[0].preset.extensions.nemoVexRuntime, variant.full);
        assert.equal(!!h.saves[0].preset.extensions.nemoRecipeRuntime, variant.full);
        const receipt = h.receipts.NemoPresetExt.nemoEnginePresetInstallations[variant.id];
        assert.equal(receipt.sourceSha256, variant.sha256); assert.equal(receipt.processed, true);
        assert.equal(h.state.preset_settings_openai, variant.name);
        const report = await h.getNemoEngineSetupReport({ variantId: variant.id });
        assert.equal(report.hasWarnings, false); assert.equal(report.verified, true);
        h.manager.serviceSettings = h.saves[0].preset;
        for (const profile of h.manager.serviceSettings.prompt_order) {
            h.manager.activeCharacter.id = profile.character_id;
            await h.cold.ready(); await h.vex.ready(); await h.recipe.ready();
        }
        const portable = structuredClone(h.manager.serviceSettings);
        await h.events.emit(TYPES.OAI_PRESET_EXPORT_READY, portable);
        assert.equal(JSON.stringify(portable), JSON.stringify(original));
    } finally { h.dispose(); }
});

test('all four editions have distinct names and unknown editions fail before download', async () => {
    assert.equal(new Set(PRESET_VARIANTS.map(p => p.name)).size, 4);
    const h = harness();
    try { await assert.rejects(h.installBundledNemoEnginePreset({ variantId: 'unknown' }), /Unknown/); }
    finally { h.dispose(); }
});
test('runtime processing failure swallowed by ST cannot save or mark an installation complete', async () => {
    const h = harness();
    h.events.on(TYPES.OAI_PRESET_IMPORT_READY, ({ data }) => {
        Object.defineProperty(data, 'toJSON', { value() { throw new Error('Storage failed'); } });
    });
    try {
        await assert.rejects(h.installBundledNemoEnginePreset(), /Storage failed/);
        assert.equal(h.saves.length, 0); assert.equal(h.receipts.NemoPresetExt.nemoEnginePresetInstaller, undefined);
    } finally { h.dispose(); }
});
for (const options of [{ skipProcessing: true }, { corrupt: true }]) test(`unprocessed or corrupt source is never saved: ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    try {
        await assert.rejects(h.installBundledNemoEnginePreset()); assert.equal(h.saves.length, 0);
        assert.equal(h.state.preset_settings_openai, undefined);
    } finally { h.dispose(); }
});
test('server save failure leaves preset selection and installation receipt unchanged', async () => {
    const h = harness({ failSave: true });
    const previousPreset = { prompts: [{ content: 'My custom edit' }] };
    const previousReceipt = { name: presetVariant().name, version: 'old' };
    h.context.openai_settings.push(previousPreset);
    h.context.openai_setting_names[presetVariant().name] = 0;
    h.state.preset_settings_openai = presetVariant().name;
    h.receipts.NemoPresetExt.nemoEnginePresetInstaller = previousReceipt;
    try {
        await assert.rejects(h.installBundledNemoEnginePreset(), /Preset save failed/);
        assert.equal(h.state.preset_settings_openai, presetVariant().name);
        assert.equal(h.context.openai_settings[0], previousPreset);
        assert.equal(previousPreset.prompts[0].content, 'My custom edit');
        assert.equal(h.receipts.NemoPresetExt.nemoEnginePresetInstaller, previousReceipt);
    } finally { h.dispose(); }
});
test('disabled or missing processing runtimes fail before saving', async () => {
    const h = harness();
    try {
        h.receipts.NemoPresetExt.enableVexRuntime = false;
        await assert.rejects(h.installBundledNemoEnginePreset({ variantId: 'full' }), /Enable automatic preset storage/);
        h.receipts.NemoPresetExt.enableVexRuntime = true; delete h.context.NemoVexRuntime;
        await assert.rejects(h.installBundledNemoEnginePreset({ variantId: 'full' }), /processing is not ready/);
        assert.equal(h.saves.length, 0);
    } finally { h.dispose(); }
});
test('asset loader rejects wrong source hashes even for valid gzip and equal source size', async () => {
    const bytes = gzipSync('{"changed":true}');
    const variant = { compressedBytes: bytes.length, sourceBytes: 16, sha256: '0'.repeat(64) };
    await assert.rejects(loadPresetAsset(variant, 'asset', async () => new Response(bytes)), /checksum mismatch/);
});

test('concurrent clicks share one import and cannot start a different edition', async () => {
    const h = harness();
    try {
        const first = h.installBundledNemoEnginePreset();
        const second = h.installBundledNemoEnginePreset();
        await assert.rejects(h.installBundledNemoEnginePreset({ variantId: 'full' }), /still being installed/);
        const [a, b] = await Promise.all([first, second]);
        assert.equal(a, b); assert.equal(h.saves.length, 1);
    } finally { h.dispose(); }
});

function installerCard(h) {
    const nodes = new Map();
    const card = { querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector, { dataset: {}, handlers: {}, disabled: false,
            addEventListener(type, handler) { this.handlers[type] = handler; } });
        return nodes.get(selector);
    } };
    h.context.document.createElement = () => card;
    h.createInstallerCard();
    return { select: card.querySelector('.nemo-engine-preset-variant'),
        install: card.querySelector('.nemo-engine-install-button'),
        setup: card.querySelector('.nemo-engine-setup-button'),
        status: card.querySelector('.nemo-engine-installer-status') };
}

for (const failSave of [false, true]) test(`installer click uses the selected edition and restores controls (save failure: ${failSave})`, async () => {
    const h = harness({ failSave });
    try {
        const ui = installerCard(h);
        ui.select.value = 'standard-braille';
        const pending = ui.install.handlers.click();
        assert(ui.select.disabled && ui.install.disabled && ui.setup.disabled);
        await pending;
        assert(!ui.select.disabled && !ui.install.disabled && !ui.setup.disabled);
        assert.equal(h.saves[0].name, presetVariant('standard-braille').name);
        assert.equal(ui.status.dataset.state, failSave ? 'error' : 'success');
        if (!failSave) {
            const restored = installerCard(h);
            assert.equal(restored.select.value, 'standard-braille');
            await restored.setup.handlers.click();
            assert.equal(h.saves.length, 1, 'setup reuses a verified installation');
        }
    } finally { h.dispose(); }
});
