import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { fixture, memoryServer } from './recipe-fixture.js';

const workerURL = new URL('../features/preset-runtime/recipe-worker.js', import.meta.url).href;
// Run the actual worker module. Only browser messaging and HTTP are bridged to Node test doubles.
const bridge = `
import { parentPort } from 'node:worker_threads';
const requests = new Map(); let sequence = 0;
globalThis.self = { postMessage: message => parentPort.postMessage(message) };
globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
 const id=++sequence;requests.set(id,{resolve,reject});parentPort.postMessage({type:'http',id,url,options});
});
parentPort.on('message', message => {
 if(message.type==='http-result') {const request=requests.get(message.id);requests.delete(message.id);request.resolve(new Response(message.body,{status:message.status}));}
 else self.onmessage({data:message});
});
await import(${JSON.stringify(workerURL)});
parentPort.postMessage({type:'ready'});
`;

async function run(payload, server) {
    const worker = new Worker(new URL('data:text/javascript,' + encodeURIComponent(bridge)), { type: 'module' });
    const progress = [];
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { void worker.terminate(); reject(new Error('Worker test timeout')); }, 20000);
        worker.on('error', error => { clearTimeout(timer); reject(error); });
        worker.on('message', async message => {
            if (message.type === 'ready') { worker.postMessage(payload); return; }
            if (message.type === 'http') {
                const response = await server.request(message.url, message.options);
                worker.postMessage({ type: 'http-result', id: message.id, status: response.status, body: await response.text() });
                return;
            }
            if (message.type === 'progress') { progress.push(message); return; }
            clearTimeout(timer); await worker.terminate(); resolve({ ...message, progress });
        });
    });
}

const input = preset => ({ operation: 'import', file: new File([JSON.stringify(preset)], 'full.json') });

test('actual worker imports, verifies persistence, and exports a portable round trip', async () => {
    const server = memoryServer(); const original = fixture();
    const result = await run(input(original), server);
    assert.equal(result.type, 'result'); assert.equal(result.stats.recipeCount, 3);
    assert.equal(result.progress.length, 2); assert.equal(server.files.size, 2);
    const output = await run({ operation: 'export', preset: JSON.parse(result.text) }, server);
    assert.equal(output.type, 'result'); assert.deepEqual(JSON.parse(output.text), original);
});

test('actual worker rejects invalid JSON without writing any libraries', async () => {
    const server = memoryServer();
    const result = await run({ operation: 'import', file: new File(['{broken'], 'bad.json') }, server);
    assert.equal(result.type, 'error'); assert.equal(server.calls.length, 0);
});

test('actual worker passes through non-recipe presets without creating state', async () => {
    const server = memoryServer(); const result = await run(input({ prompts: [] }), server);
    assert.equal(result.type, 'passthrough'); assert.equal(server.calls.length, 0);
});

test('actual worker publishes no optimized preset after a failed durable write', async () => {
    const server = memoryServer(); server.setMode('offline');
    const result = await run(input(fixture()), server);
    assert.equal(result.type, 'error'); assert.equal('text' in result, false);
});

test('actual worker refuses incomplete optimized imports on another server', async () => {
    const server = memoryServer(); const result = await run(input(fixture()), server);
    const broken = await run(input(JSON.parse(result.text)), memoryServer());
    assert.equal(broken.type, 'error'); assert.equal('text' in broken, false);
});

test('actual worker checks existing shells and does not optimize twice', async () => {
    const server = memoryServer(); const first = await run(input(fixture()), server);
    const second = await run(input(JSON.parse(first.text)), server);
    assert.equal(second.type, 'result'); assert.equal(second.alreadyOptimized, true);
    assert.deepEqual(JSON.parse(second.text), JSON.parse(first.text));
});

const realPath = process.env.NEMO_FULL_FIXTURE;
test('actual worker handles the entire current Full corpus', { skip: !realPath }, async () => {
    const server = memoryServer();
    const result = await run({ operation: 'import', file: new File([readFileSync(realPath)], 'full.json') }, server);
    assert.equal(result.type, 'result');
    assert.equal(result.stats.recipeCount, 12852);
    assert.equal(result.stats.removedPrompts, 123);
    assert.equal(result.stats.libraries, 17);
    assert.equal(JSON.parse(result.text).prompts.length, 641);
    assert.equal(server.files.size, 17);
});
