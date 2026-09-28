import test from 'node:test';
import assert from 'node:assert/strict';
import { createVexRuntime } from '../features/vex-runtime/controller.js';
import { harness, TYPES } from './vex-runtime-fixture.mjs';

test('completed UI dry runs release the pass before an unrelated helper request', async () => {
    const h = harness(); await h.import(); h.runtime.dispose();
    h.manager.tryGenerate = function () { h.generate(); return 'native'; };
    const runtime = createVexRuntime({ events: h.events, types: TYPES,
        getManager: () => h.manager, getContext: () => h.context, store: h.io.store,
        validate: h.f.validate, planImport: h.f.planImport });
    try {
        await h.manager.tryGenerate();
        h.manager.getPromptOrderForCharacter().find(e => e.identifier === 'v11-317-vex-cozy-vex').enabled = true;
        const request = { messages: ['unrelated helper'] };
        await h.events.emit(TYPES.CHAT_COMPLETION_SETTINGS_READY, request);
        assert.doesNotThrow(() => JSON.stringify(request));
    } finally { runtime.dispose(); }
});
