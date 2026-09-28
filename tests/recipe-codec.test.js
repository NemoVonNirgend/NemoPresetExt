import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fixture } from './recipe-fixture.js';
import { planOffload, finishOffload, restorePortable, validateLibrary, indexBank, selectedGenres, RUNTIME_SOURCE, RUNTIME_KEY } from '../features/preset-runtime/recipe-codec.js';

function compile(preset = fixture()) {
    const plan = planOffload(preset);
    const refs = Object.fromEntries([...plan.libraries].map(([g]) => [g, { sha256: g }]));
    return { plan, slim: finishOffload(plan, refs), libraries: new Map([...plan.libraries].map(([g, lib]) => [g, validateLibrary(lib, g)])) };
}

test('offload removes data before ST save without mutating the imported object', () => {
    const original = fixture(); const copy = structuredClone(original);
    const { plan, slim } = compile(original);
    assert.deepEqual(original, copy);
    assert.equal(plan.recipeCount, 3);
    assert.equal(plan.removed.size, 4);
    assert.equal(slim.prompts.length, original.prompts.length - 4);
    assert.equal(slim.prompts.find(p => p.identifier === 'nc-writing-resolver').content, RUNTIME_SOURCE);
    assert.equal(slim.prompts.find(p => p.identifier === 'ordinary').content, copy.prompts.at(-1).content);
    assert.deepEqual(slim.extensions.regex_scripts, original.extensions.regex_scripts);
    assert.equal(JSON.stringify(slim).includes('Exact plain recipe.'), false);
    for (const order of slim.prompt_order) for (const row of order.order) assert.ok(!plan.removed.has(row.identifier));
});

test('portable round trip preserves every prompt, field, and both order profiles', () => {
    const original = fixture(); const { slim, libraries } = compile(original);
    assert.deepEqual(restorePortable(slim, libraries), original);
});

test('portable export preserves ordinary edits, new ordinary prompts, and connection redaction', () => {
    const { slim, libraries } = compile();
    slim.prompts.find(p => p.identifier === 'ordinary').content = 'Edited by the user.';
    slim.prompts.push({ identifier: 'new', content: 'New user prompt.' });
    slim.prompt_order[1].order.at(-1).enabled = false;
    delete slim.reverse_proxy;
    const exported = restorePortable(slim, libraries);
    assert.equal(exported.prompts.find(p => p.identifier === 'ordinary').content, 'Edited by the user.');
    assert.equal(exported.prompts.at(-1).identifier, 'new');
    assert.equal(exported.prompt_order[1].order.at(-1).enabled, false);
    assert.equal('reverse_proxy' in exported, false);
    assert.equal(RUNTIME_KEY in exported.extensions, false);
});

test('inline and scoped bodies are byte-for-byte identical including whitespace', () => {
    const { libraries } = compile(); const lib = libraries.get('slice_of_life');
    assert.equal(lib.get('NPaoasas'), 'Exact plain recipe.');
    assert.equal(lib.get('NPaoasat'), '  Exact scoped recipe.  ');
    assert.equal(lib.get('NPaoasau'), '');
});

test('renaming a Full file does not defeat structural recognition', () => {
    const p = fixture(); p.preset_name = 'User-customized file name';
    assert.equal(planOffload(p).recipeCount, 3);
});

test('non-recipe editions are unchanged and optimization is idempotent', () => {
    assert.equal(planOffload({ prompts: [] }), null);
    assert.equal(planOffload({ prompts: [{ identifier: 'tavo', content: '<% setvar("x", "y"); %>' }] }), null);
    assert.equal(planOffload(compile().slim), null);
});

for (const [name, mutate] of [
    ['duplicate prompts', p => p.prompts.push(p.prompts[0])],
    ['duplicate profiles', p => p.prompt_order.push(p.prompt_order[0])],
    ['missing signature', p => p.prompts.splice(2, 1)],
    ['edited resolver', p => p.prompts.find(x => x.identifier === 'nc-writing-resolver').content += ' Changed'],
    ['executable heading', p => p.prompts[4].content = '{{setvar::X::Y}}'],
    ['nonliteral bank instruction', p => p.prompts[5].content = p.prompts[5].content.replace('{{trim}}', '{{setvar::OTHER::no}}')],
    ['nested recipe macro', p => p.prompts[5].content = p.prompts[5].content.replace('Exact plain recipe.', '{{incvar::sideEffect}}')],
    ['unrecognized guard', p => p.prompts[5].content = p.prompts[5].content.replace('== slice_of_life', '== romance')],
    ['disabled bank', p => p.prompt_order[0].order[5].enabled = false],
    ['disabled setup', p => p.prompt_order[0].order[0].enabled = false],
    ['duplicate order', p => p.prompt_order[0].order.push(p.prompt_order[0].order[0])],
    ['missing order bank', p => p.prompt_order[0].order.splice(5, 1)],
    ['direct external NP reader', p => p.prompts.at(-1).content = '{{getvar::NPaoasas}}'],
    ['custom injection trigger', p => p.prompts[5].injection_trigger = ['swipe']],
]) test(`refuses ${name} without altering source`, () => {
    const preset = fixture(); mutate(preset); const before = JSON.stringify(preset);
    assert.throws(() => planOffload(preset));
    assert.equal(JSON.stringify(preset), before);
});

test('cannot finish before every library has a durable reference', () => {
    const plan = planOffload(fixture());
    assert.throws(() => finishOffload(plan, {}), /not saved/);
});

test('selection prefetch includes fallback, respects enabled flags and trigger types', () => {
    const { slim } = compile();
    assert.deepEqual([...selectedGenres(slim)], ['slice_of_life']);
    slim.prompt_order[1].order.find(p => p.identifier === 'nc-genre-comedy').enabled = true;
    assert.deepEqual([...selectedGenres(slim)], ['slice_of_life', 'comedy']);
    slim.prompts.find(p => p.identifier === 'nc-genre-comedy').injection_trigger = ['swipe'];
    assert.deepEqual([...selectedGenres(slim, 100001, 'normal')], ['slice_of_life']);
    assert.deepEqual([...selectedGenres(slim, 100001, 'swipe')], ['slice_of_life', 'comedy']);
});

test('portable restore refuses missing archive, duplicate IDs, missing anchors, and modified resolver', () => {
    const { slim, libraries } = compile();
    assert.throws(() => restorePortable(slim, new Map()), /missing/);
    const duplicate = structuredClone(slim);
    duplicate.prompts.push({ identifier: 'nemo-init-recipes-comedy-01', content: '' });
    assert.throws(() => restorePortable(duplicate, libraries), /duplicate/);
    const changed = structuredClone(slim); changed.prompts.find(p => p.identifier === 'nc-writing-resolver').content = 'changed';
    assert.throws(() => restorePortable(changed, libraries), /edited/);
    const noAnchor = structuredClone(slim); noAnchor.prompt_order[0].order = noAnchor.prompt_order[0].order.filter(p => p.identifier !== 'nc-writing-resolver');
    assert.throws(() => restorePortable(noAnchor, libraries), /anchor/);
});

test('library range validation rejects invalid offsets and wrong genres', () => {
    const { plan } = compile(); const lib = structuredClone(plan.libraries.get('comedy'));
    assert.throws(() => validateLibrary(lib, 'romance'));
    lib.entries[0][2] = -1;
    assert.throws(() => validateLibrary(lib, 'comedy'));
});

// Optional real-preset regression. CI needs no distribution of the user's prompt corpus.
const realPath = process.env.NEMO_FULL_FIXTURE;
test('real Full fixture: every recipe and complete portable round trip', { skip: !realPath }, () => {
    const original = JSON.parse(readFileSync(realPath, 'utf8'));
    const { plan, slim, libraries } = compile(original);
    let checked = 0;
    for (const lib of libraries.values()) for (const source of lib.library.prompts) {
        if (!source.identifier.startsWith('nemo-init-recipes-')) continue;
        // Independent extraction oracle supports both actual stored assignment forms.
        const regex = /\{\{setvar::(NP[a-z]{6})::([\s\S]*?)\}\}|\{\{#setvar::(NP[a-z]{6})\}\}([\s\S]*?)\{\{\/setvar\}\}/g;
        for (const m of source.content.matchAll(regex)) { assert.equal(lib.get(m[1] ?? m[3]), m[2] ?? m[4]); checked++; }
    }
    assert.equal(checked, plan.recipeCount);
    assert.equal(checked, 12852);
    assert.equal(plan.removed.size, 123);
    assert.deepEqual(restorePortable(slim, libraries), original);
    const sourceIds = new Set(original.prompts.map(p => p.identifier));
    for (const order of slim.prompt_order) for (const entry of order.order) assert.ok(sourceIds.has(entry.identifier));
});

test('disabled or non-triggered recipe resolvers need no archive hydration', () => {
    const { slim } = compile();
    slim.prompt_order[1].order.find(p => p.identifier === 'nc-writing-resolver').enabled = false;
    assert.equal(selectedGenres(slim).size, 0);
    slim.prompt_order[1].order.find(p => p.identifier === 'nc-writing-resolver').enabled = true;
    slim.prompts.find(p => p.identifier === 'nc-writing-resolver').injection_trigger = ['swipe'];
    assert.equal(selectedGenres(slim, 100001, 'normal').size, 0);
    assert.equal(selectedGenres(slim, 100001, 'swipe').size, 1);
});
