import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../features/nemo-start/runtime.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/^export /gm, '');

function setup({ messageId = 0 } = {}) {
    const message = { mes: 'First', swipe_id: 0, swipes: ['First', 'Second'] };
    const chat = messageId === 0 ? [message] : [{ mes: 'Greeting' }, message];
    const context = { chat, chatId: 'chat', characterId: 0, swipe: { isAllowed: () => true } };
    const rows = [];
    const frames = new Map();
    const switches = [];
    const warnings = [];
    let redraws = 0;
    const dialog = { open: true, close() { this.open = false; }, remove() {} };
    const container = {
        querySelector: () => null,
        querySelectorAll: selector => selector.includes('[mesid="0"]')
            ? rows.filter(row => row.getAttribute('mesid') === '0') : rows,
    };
    const row = { parentElement: container, getAttribute: () => String(messageId) };
    rows.push(row);
    context.swipe.to = async (_event, direction, options) => {
        switches.push({ direction, index: options.forceSwipeId, previewOpen: dialog.open });
        assert.equal(options.message, message);
        assert.equal(options.forceMesId, messageId);
        message.swipe_id = options.forceSwipeId;
    };
    const st = { redisplayChat() { redraws++; rows.splice(1); } };
    const api = runInNewContext(source + `
        chatElement = container;
        const original = getRowState(context, row);
        picker = { dialog, row, state: original };
        ({
            check: () => checkGreetingRows(context, original),
            use: () => useSwipe(row, original, original.choices[1]),
            sync: () => syncPicker(context),
        });
    `, {
        st, context, row, container, dialog,
        logger: { warn() {} }, toastr: { warning: text => warnings.push(text) },
        document: { getElementById: () => container },
        SillyTavern: { getContext: () => context },
        requestAnimationFrame(fn) { frames.set(1, fn); return 1; },
        cancelAnimationFrame(id) { frames.delete(id); },
    });
    return {
        api, context, container, st, rows, row, dialog, frames, switches, warnings,
        redraws: () => redraws,
        async flush() {
            for (const [id, run] of frames) { frames.delete(id); await run(); }
        },
    };
}

test('the greeting preview closes before the native swipe starts', async () => {
    const f = setup();
    await f.api.use();
    assert.deepEqual(f.switches, [{ direction: 'right', index: 1, previewOpen: false }]);
    assert.equal(f.context.chat.length, 1);
    assert.equal(f.rows.length, 1);
    assert.equal(f.redraws(), 0);
});

test('blocked swipes keep the picker open and failures after dismissal are visible', async () => {
    const f = setup();
    f.context.swipe.isAllowed = () => false;
    assert.match(await f.api.use(), /idle/);
    assert.equal(f.dialog.open, true);
    f.context.swipe.isAllowed = () => true;
    f.context.swipe.to = async () => { throw new Error('interrupted'); };
    await f.api.use();
    assert.equal(f.dialog.open, false);
    assert.equal(f.warnings.length, 1);
});

test('a native swipe invalidates an open preview', () => {
    const f = setup();
    f.context.chat[0].swipe_id = 1;
    f.api.sync();
    assert.equal(f.dialog.open, false);
});

test('a saved reply still switches through its native message ID', async () => {
    const f = setup({ messageId: 1 });
    await f.api.use();
    assert.deepEqual(f.switches, [{ direction: 'right', index: 1, previewOpen: false }]);
    assert.equal(f.context.chat[0].mes, 'Greeting');
    assert.equal(f.context.chat.length, 2);
    assert.equal(f.redraws(), 0);
});

test('duplicate rendered greetings request one native redraw and preserve the saved chat', async () => {
    const f = setup();
    const saved = structuredClone(f.context.chat);
    f.rows.push({ ...f.row });
    f.api.check();
    assert.match(await f.api.use(), /displayed twice/);
    assert.equal(f.switches.length, 0);
    await f.flush();
    f.api.check();
    assert.equal(f.frames.size, 0);
    assert.equal(f.redraws(), 1);
    assert.equal(f.rows.length, 1);
    assert.deepEqual(f.context.chat, saved);
});

test('a queued redraw rechecks the chat, row IDs, active editor and native swipe state', async () => {
    for (const alter of [
        f => f.rows.pop(),
        f => f.context.chat.push({ mes: 'Second real message' }),
        f => { f.context.chatId = 'another chat'; },
        f => { f.context.chat[0] = structuredClone(f.context.chat[0]); },
        f => { f.rows[1].getAttribute = () => '1'; },
        f => { f.container.querySelector = () => ({}); },
        f => { f.context.swipe.isAllowed = () => false; },
    ]) {
        const f = setup();
        f.rows.push({ ...f.row });
        f.api.check();
        alter(f);
        await f.flush();
        assert.equal(f.redraws(), 0);
    }
});

test('an unsuccessful host redraw does not create a redraw loop', async () => {
    const f = setup();
    f.st.redisplayChat = () => {};
    f.rows.push({ ...f.row });
    f.api.check();
    await f.flush();
    f.api.check();
    assert.equal(f.frames.size, 0);
});
