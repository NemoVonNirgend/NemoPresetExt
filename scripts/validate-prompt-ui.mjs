/** Dependency-free Chromium/CDP suite: actual Nemo CSS and tray markup + pinned native host excerpts.
 * CHROME_BIN selects an installed browser. NEMO_UI_SCREENSHOT optionally saves the final fixture.
 * NEMO_UI_STYLES optionally selects a flattened CSS snapshot for before/after reproduction.
 */
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

let binary = process.env.CHROME_BIN;
if (!binary) for (const candidate of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']) {
    try { await access(candidate, constants.X_OK); binary = candidate; break; } catch { /* Try the next installed browser. */ }
}
if (!binary) throw new Error('Install Chromium/Chrome or set CHROME_BIN to run the prompt UI tests.');
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const source = await read('../features/prompts/category-tray.js');
function between(start, end) {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    if (from < 0 || to < 0) throw new Error(`Tray fixture extraction needs updating: ${start}`);
    return source.slice(from, to);
}
// Extract markup and compact/dropdown handlers from production source; never duplicate its classes.
const trayBody = between("const tray = document.createElement('div');\n    tray.className = `nemo-category-tray", '    // Apply validated colors');
const compactBody = between('function getSavedCompactSections()', '/**\n * Save a preset');
const controlBody = between('    // Compact view toggle handler', '    // Save preset handler');
let nemoCSS = await read('../styles.css');
for (const match of [...nemoCSS.matchAll(/@import url\(['"]([^'"]+)['"]\);/g)]) {
    nemoCSS = nemoCSS.replace(match[0], await read(`../${match[1]}`));
}
if (process.env.NEMO_UI_STYLES) nemoCSS = await readFile(process.env.NEMO_UI_STYLES, 'utf8');
const fixtures = {
    nativeCSS: await read('../tests/fixtures/prompt-ui/native-host.css'),
    rowHTML: await read('../tests/fixtures/prompt-ui/native-prompt-row.html'),
    nemoCSS, trayBody, compactBody, controlBody,
};
const main = 'data:text/javascript;base64,' + Buffer.from(await read('./prompt-ui-browser.mjs')).toString('base64');
const directory = await mkdtemp(join(tmpdir(), 'nemo-ui-browser-'));
let child, session, nextId = 0, wire = '', stderr = '';
const pending = new Map();
function fail(error) {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
}
function send(method, params = {}, sessionId = session) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 35000);
        pending.set(id, { resolve, reject, timer });
        child.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0', error => {
            if (error) { clearTimeout(timer); pending.delete(id); reject(error); }
        });
    });
}
try {
    child = spawn(binary, ['--headless', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox',
        '--disable-background-networking', '--disable-extensions', '--remote-debugging-pipe', `--user-data-dir=${directory}`],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    child.on('error', fail);
    child.on('exit', code => fail(new Error(`Chromium exited ${code}. ${stderr}`)));
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
    child.stdio[4].on('data', chunk => {
        wire += chunk.toString();
        let end;
        while ((end = wire.indexOf('\0')) >= 0) {
            const payload = wire.slice(0, end); wire = wire.slice(end + 1);
            if (!payload) continue;
            const message = JSON.parse(payload), entry = pending.get(message.id);
            if (!entry) continue;
            pending.delete(message.id); clearTimeout(entry.timer);
            if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
        }
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
    const evaluated = await send('Runtime.evaluate', {
        expression: `globalThis.promptUiFixtures = ${JSON.stringify(fixtures)}; import(${JSON.stringify(main)}).then(() => globalThis.promptUiReport)`,
        awaitPromise: true, returnByValue: true,
    });
    if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
    const report = evaluated.result?.value;
    if (!report || !Number.isInteger(report.tests)) throw new Error('Browser did not produce a UI test report.');
    for (const item of report.results) if (item.error) item.error = item.error.split('\n')[0];
    if (process.env.NEMO_UI_SCREENSHOT) {
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        await writeFile(process.env.NEMO_UI_SCREENSHOT, Buffer.from(shot.data, 'base64'));
    }
    console.log(JSON.stringify(report, null, 2));
    if (report.failed) process.exitCode = 1;
} finally {
    fail(new Error('Browser harness closed.'));
    if (child && child.exitCode === null) {
        child.kill('SIGTERM');
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
        if (child.exitCode === null) child.kill('SIGKILL');
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
