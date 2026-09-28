import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('Chromium rendering boundary suite (native-shaped host, not live ST)', { timeout: 60000 }, async t => {
    let browser = process.env.CHROME_BIN;
    if (!browser) for (const path of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']) {
        try { await access(path, constants.X_OK); browser = path; break; } catch { /* No dependency download. */ }
    }
    if (!browser) { t.skip('No installed Chromium; run scripts/validate-prompt-rendering.mjs with CHROME_BIN.'); return; }
    const script = fileURLToPath(new URL('../scripts/validate-prompt-rendering.mjs', import.meta.url));
    const { stdout } = await promisify(execFile)(process.execPath, [script], {
        env: { ...process.env, CHROME_BIN: browser }, timeout: 50000, maxBuffer: 2 * 1024 * 1024,
    });
    const report = JSON.parse(stdout);
    assert.equal(report.tests, 24); assert.equal(report.failed, 0);
    assert.equal(report.liveSillyTavern, false);
    assert.equal(report.measurement.warmRowsGenerated, 0);
    assert.equal(report.measurement.oneToggleRowsGenerated, 1);
});
