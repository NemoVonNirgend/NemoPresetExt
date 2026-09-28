/** Dependency-free Chromium/CDP-pipe harness. No network, ST server or model calls. */
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

let binary = process.env.CHROME_BIN;
if (!binary) for (const candidate of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']) {
    try { await access(candidate, constants.X_OK); binary = candidate; break; } catch { /* Try the next installed browser. */ }
}
if (!binary) throw new Error('Install Chromium/Chrome or set CHROME_BIN to run the browser boundary tests.');
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const model = uri(await read('../features/prompt-rendering/model.js'));
const renderer = uri((await read('../features/prompt-rendering/incremental.js')).replace("'./model.js'", JSON.stringify(model)));
const main = uri((await read('./prompt-rendering-browser.mjs')).replace("'../features/prompt-rendering/incremental.js'", JSON.stringify(renderer)));
const directory = await mkdtemp(join(tmpdir(), 'nemo-render-browser-'));
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
            const text = wire.slice(0, end); wire = wire.slice(end + 1);
            if (!text) continue;
            const message = JSON.parse(text), entry = pending.get(message.id);
            if (!entry) continue;
            pending.delete(message.id); clearTimeout(entry.timer);
            if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
        }
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
    await send('Runtime.enable');
    const evaluated = await send('Runtime.evaluate', { expression: `import(${JSON.stringify(main)}).then(() => globalThis.renderingReport)`, awaitPromise: true, returnByValue: true });
    if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.text);
    const report = evaluated.result?.value;
    if (!report || !Number.isInteger(report.tests)) throw new Error('Browser did not produce a test report.');
    // Data-URI stacks contain embedded test source. Keep errors short and useful.
    for (const item of report.results) if (item.error) item.error = item.error.split('\n')[0];
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
