import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// SillyTavern loads every extension file as an ES module. Many of them import
// ST paths and cannot be imported under Node, so parse them instead. A plain
// `node --check file.js` parses as a script and misses module-only errors such
// as a duplicate `const` in one scope, which stops the whole extension loading.
const root = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['archive', 'lib', 'node_modules', 'tests', '.git', 'dist']);

function sources(dir) {
    return readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return SKIP.has(name) ? [] : sources(path);
        return name.endsWith('.js') ? [path] : [];
    });
}

test('every extension source file parses as an ES module', () => {
    const files = sources(root);
    assert(files.length > 50, 'expected the extension sources');
    const failures = [];
    for (const file of files) {
        try {
            execFileSync(process.execPath, ['--input-type=module', '--check'], {
                input: readFileSync(file), stdio: ['pipe', 'ignore', 'pipe'],
            });
        } catch (error) {
            failures.push(`${relative(root, file)}: ${String(error.stderr).split('\n').find(line => line.includes('Error')) || error.message}`);
        }
    }
    assert.deepEqual(failures, []);
});
