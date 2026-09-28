import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PromptMetadataIndex, directiveProjection } from '../features/prompt-performance/metadata-index.js';
import { safeCommentView } from '../features/prompt-performance/comment-view.js';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/validate-metadata-preset.mjs PRESET.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
assert.ok(Array.isArray(data.prompts), 'Preset has no prompts array');
const digest = () => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const before = digest();
function directiveLines(text) {
    return [...String(text).matchAll(/\{\{\/\/([\s\S]*?)\}\}/g)]
        .flatMap(match => match[1].split(/\r?\n/).map(line=>line.trim()).filter(line=>line.startsWith('@')));
}
const index = new PromptMetadataIndex(text => ({ lines: directiveLines(text) }));
index.bind(data.prompts);
const started = performance.now();
let changedComments = 0;
let elidedChars = 0;
for (const prompt of data.prompts) {
    const text = prompt.content || '';
    assert.deepEqual(directiveLines(directiveProjection(text)), directiveLines(text), `Directive projection changed ${prompt.identifier}`);
    assert.deepEqual(index.get(prompt).directives.lines, directiveLines(text));
    const view = safeCommentView(text);
    if (view !== text) {
        changedComments++;
        elidedChars += text.length - view.length;
        const nativeSimple = input => input.replace(/\{\{\/\/[^{}]*\}\}/g, '').replace(/\n*\{\{trim\}\}\n*/g, '');
        assert.equal(nativeSimple(view), nativeSimple(text), `Comment view changed ${prompt.identifier}`);
    }
}
const coldMs = performance.now() - started;
const cold = index.diagnostics();
const warmStart = performance.now();
for (let pass = 0; pass < 100; pass++) {
    for (const prompt of data.prompts) index.get(prompt.content || '');
}
const after = index.diagnostics();
assert.equal(after.scans, cold.scans, 'Warm metadata reads rescanned a source');
assert.equal(digest(), before, 'Validation mutated the preset');
console.log(JSON.stringify({
    stage:'2/5', file:file.split(/[\\/]/).pop(), prompts:data.prompts.length,
    directiveParity:true, presetUnchanged:true, coldScannedChars:cold.scannedChars,
    warmPasses:100, warmAdditionalScans:after.scans-cold.scans,
    warmAdditionalScannedChars:after.scannedChars-cold.scannedChars,
    eligibleCommentFields:changedComments, commentCharsElidedInGenerationViews:elidedChars,
    coldValidationMs:Number(coldMs.toFixed(2)), warmLookupMs:Number((performance.now()-warmStart).toFixed(2)),
    liveSTBrowserTest:false,
},null,2));
