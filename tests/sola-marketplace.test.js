import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const moduleUrl = new URL('../features/marketplace/marketplace.js', import.meta.url);
const catalog = JSON.parse(readFileSync(new URL('../features/marketplace/recommendations.json', import.meta.url), 'utf8'));
const source = readFileSync(moduleUrl, 'utf8')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '')
    .replaceAll('import.meta.url', JSON.stringify(moduleUrl.href))
    .replace('export const NemoMarketplace', 'const NemoMarketplace');
const solaUrl = 'https://pyrxpia.github.io/sola-hub/';
function harness(fetch) {
    const marketplace = new Script(`${source}\nNemoMarketplace;`).runInNewContext({
        URL, fetch, LOG_PREFIX: 'test', console: { log() {}, warn() {} },
    });
    marketplace._initialized = true;
    return marketplace;
}
function assertSola(items) {
    const entries = items.filter(item => item.url === solaUrl);
    assert.equal(entries.length, 1);
    const entry = entries[0];
    assert.equal(entry.name, 'Sola');
    assert.equal(entry.author, 'Pyrxpia');
    assert.equal(entry.category, 'presets');
    assert.match(entry.description, /V3 Flame/);
    assert.match(entry.description, /Kindling V1/);
}
test('Sola is listed once in the Presets catalog and matching offline fallback', () => {
    const marketplace = harness();
    assertSola(catalog); assertSola(marketplace._data);
    assert.deepEqual(JSON.parse(JSON.stringify(marketplace._data.find(item => item.url === solaUrl))), catalog.find(item => item.url === solaUrl));
});
test('successful catalog load retains one Sola entry after merging local recommendations', async () => {
    const marketplace = harness(async () => ({ ok: true, json: async () => catalog }));
    await marketplace._loadData(); assertSola(marketplace._data);
});
test('an older catalog and a failed fetch both retain Sola', async () => {
    const marketplace = harness(async () => ({ ok: true, json: async () => catalog.filter(item => item.url !== solaUrl) }));
    await marketplace._loadData(); assertSola(marketplace._data);
    const offline = harness(async () => { throw new Error('offline'); });
    await offline._loadData(); assertSola(offline._data);
});
