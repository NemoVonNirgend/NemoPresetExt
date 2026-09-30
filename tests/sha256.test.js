import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { digest } from '../core/sha256.js';

const reference = text => createHash('sha256').update(text, 'utf8').digest('hex');
async function withCrypto(value, action) {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value });
    try { return await action(); }
    finally {
        if (original) Object.defineProperty(globalThis, 'crypto', original);
        else delete globalThis.crypto;
    }
}

const vectors = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
        '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
        'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1'],
    ['a'.repeat(1000000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
];

test('software SHA-256 matches published short, multiblock and million-a vectors', async () => {
    await withCrypto({}, async () => {
        for (const [text, expected] of vectors) assert.equal(await digest(text), expected);
    });
});

test('native SHA-256 matches the same vectors', async () => {
    await withCrypto(webcrypto, async () => {
        for (const [text, expected] of vectors) assert.equal(await digest(text), expected);
    });
});

test('fallback handles absent crypto, absent subtle and absent/non-callable digest', async () => {
    for (const crypto of [undefined, null, {}, { subtle: null }, { subtle: {} }, { subtle: { digest: true } }]) {
        await withCrypto(crypto, async () => assert.equal(await digest('abc'), vectors[1][1]));
    }
});

test('native digest is preferred and keeps its SubtleCrypto receiver', async () => {
    let calls = 0;
    const subtle = { async digest(algorithm, bytes) {
        assert.equal(this, subtle);
        assert.equal(algorithm, 'SHA-256');
        assert.ok(bytes instanceof Uint8Array);
        calls++;
        return webcrypto.subtle.digest(algorithm, bytes);
    } };
    await withCrypto({ subtle }, async () => assert.equal(await digest('native'), reference('native')));
    assert.equal(calls, 1);
});

test('a present but failing native digest is not silently bypassed', async () => {
    const failure = new Error('native digest failed');
    for (const implementation of [() => { throw failure; }, async () => { throw failure; }]) {
        await withCrypto({ subtle: { digest: implementation } }, async () => {
            await assert.rejects(digest('abc'), error => error === failure);
        });
    }
});

test('UTF-8 checksums preserve Unicode, control characters and lone-surrogate encoding', async () => {
    const samples = ['\u0000\r\n\t', 'Nemo 🧭 日本語 café e\u0301 ⠀', '\ud800', '\udfff', 'a\ud800b\udfffc',
        JSON.stringify({ source: '⟪Nemo⟫\n{{setvar::text::雪🐉}}', empty: '' })];
    for (const crypto of [{}, webcrypto]) await withCrypto(crypto, async () => {
        for (const text of samples) assert.equal(await digest(text), reference(text));
    });
});

test('software padding matches an independent oracle across every short block boundary', async () => {
    await withCrypto({}, async () => {
        for (let size = 0; size <= 320; size++) {
            const text = '0123456789abcdef'.repeat(20).slice(0, size);
            assert.equal(await digest(text), reference(text), `UTF-8 length ${size}`);
        }
    });
});

test('software SHA-256 matches deterministic mixed-UTF-16 corpus', async () => {
    let seed = 0x12345678;
    await withCrypto({}, async () => {
        for (let sample = 0; sample < 100; sample++) {
            let text = '';
            for (let i = 0; i < sample * 19; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                text += String.fromCharCode(seed >>> 16);
            }
            assert.equal(await digest(text), reference(text), `sample ${sample}`);
        }
    });
});

test('large multibyte sidecars produce byte-identical native and software hashes', async () => {
    const text = '雪🐉⠀é'.repeat(300000); // 3.6 MB of UTF-8, not just ASCII.
    const expected = reference(text);
    for (const crypto of [{}, webcrypto]) await withCrypto(crypto, async () => {
        assert.equal(await digest(text), expected);
    });
});

test('large fallback hashes yield to tasks and concurrent calls have isolated state', async () => {
    const samples = ['x'.repeat(600000), 'y'.repeat(800000), '雪'.repeat(300000)];
    await withCrypto({}, async () => {
        let taskRan = false;
        const timer = setTimeout(() => { taskRan = true; }, 0);
        try {
            const actual = await Promise.all(samples.map(text => digest(text)));
            assert.deepEqual(actual, samples.map(reference));
            assert.equal(taskRan, true, 'large imports must let the event loop run');
        } finally { clearTimeout(timer); }
    });
});
