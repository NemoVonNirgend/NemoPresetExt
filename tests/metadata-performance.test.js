import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { directiveProjection, PromptMetadataIndex, createDirectiveFacade } from '../features/prompt-performance/metadata-index.js';
import { safeCommentView, installCommentView } from '../features/prompt-performance/comment-view.js';
import { BodySearchIndex, metadataMatches } from '../features/prompt-performance/search-engine.js';
import { PromptBodySearch } from '../features/prompt-performance/search-client.js';

const parseStub = text => ({ tooltip: text, tags: [], categories: [] });
const prompt = (id, content) => ({ identifier: id, name: id, content, role: 'system' });

function ruleParser() {
    const source = readFileSync(new URL('../features/directives/prompt-directive-rules.js', import.meta.url), 'utf8')
        .replace(/^import\s+.*?;\r?$/gm, '').replace(/^export\s+/gm, '');
    return new Script(`(()=>{${source}\nreturn {parsePromptDirectives,clearDirectiveCache,validatePromptActivation,evaluateMessageTriggers};})()`)
        .runInNewContext({ logger: {debug(){}, error(){}, warn(){}}, promptManager:null, getContext:()=>({}) });
}

// Real language parity runs in repository CI. No extracted user's prose is bundled.
test('public facade preserves the original directive language and issue object identities', () => {
    const rules = ruleParser();
    const sources = [
        prompt('a', '{{// @category world }}\nbody\n{{// @exclusive-with b\n@warning Watch\n@enable-at-message 2 }}'),
        prompt('b', 'text with no directives'),
        prompt('c', '{{// @message-range 1-10 }}'),
    ];
    sources[1].enabled = true;
    const facade = createDirectiveFacade(rules, () => sources);
    for (const source of sources) {
        assert.deepEqual(facade.parsePromptDirectives(source), rules.parsePromptDirectives(source.content));
    }
    const expected = rules.validatePromptActivation('a', sources);
    const actual = facade.validatePromptActivation('a', sources);
    assert.equal(JSON.stringify(actual), JSON.stringify(expected));
    assert.equal(actual[0].currentPrompt, sources[0]);
    assert.equal(actual[0].conflictingPrompt, sources[1]);
    assert.equal(JSON.stringify(facade.evaluateMessageTriggers(3, sources)), JSON.stringify(rules.evaluateMessageTriggers(3, sources)));
});

test('directives anywhere in the source survive projection, including late metadata', () => {
    const text = '{{// ordinary comment }}' + 'X'.repeat(100000) + '\n{{// @requires a\n@tags one, two }}';
    assert.equal(directiveProjection(text), '{{// @requires a\n@tags one, two }}');
    assert.equal(directiveProjection('plain text'), ' ');
    assert.equal(directiveProjection(''), '');
});

test('metadata views contain no prompt body and changing a name does not rescan its body', () => {
    const index = new PromptMetadataIndex(parseStub);
    const p = prompt('a', 'Z'.repeat(500000) + '{{// @tooltip hello }}');
    index.bind([p]);
    const view = index.view(p, true);
    assert.equal('content' in view, false);
    const chars = index.diagnostics().scannedChars;
    p.name = 'Renamed';
    assert.equal(index.view(p).name, 'Renamed');
    assert.equal(index.diagnostics().scannedChars, chars);
});

test('registered legacy string calls reuse metadata without full-body string keys', () => {
    const index = new PromptMetadataIndex(parseStub);
    const p = prompt('a', 'X'.repeat(1000000));
    index.bind([p]);
    const expected = index.get(p);
    for (let i = 0; i < 100; i++) assert.equal(index.get(p.content), expected);
    assert.equal(index.diagnostics().scans, 1);
    assert.equal(index.loose.size, 0);
    assert.deepEqual([...index.byLength.keys()], [1000000]);
});

test('equal-length edits invalidate only the changed source, including empty bodies', () => {
    const index = new PromptMetadataIndex(parseStub);
    const a = prompt('a', '{{// @tooltip one }}');
    const b = prompt('b', '{{// @tooltip two }}');
    index.bind([a,b]);
    const oldB = index.get(b);
    index.get(a);
    a.content = '{{// @tooltip six }}';
    assert.match(index.get(a.content).projection, /six/);
    assert.equal(index.get(b), oldB);
    a.content = '';
    assert.equal(index.get(a).projection, '');
});

test('same IDs in a different preset do not reuse old metadata', () => {
    const index = new PromptMetadataIndex(parseStub);
    const a = prompt('same','{{// @tooltip old }}');
    const b = prompt('same','{{// @tooltip new }}');
    index.bind([a]); index.get(a);
    index.bind([b]);
    assert.equal(index.byId.get('same'), b);
    assert.match(index.get(b).projection, /new/);
    index.bind([]);
    assert.equal(index.byLength.size, 0);
});

test('loose cache is bounded and giant unowned strings are never retained', () => {
    const index = new PromptMetadataIndex(parseStub, { maxLooseChars: 40, maxLooseEntryChars: 30 });
    for (let i = 0; i < 30; i++) index.get('hello' + i);
    index.get('X'.repeat(100000));
    assert.ok(index.looseChars <= 40);
    assert.ok([...index.loose.keys()].every(key => key.length <= 30));
    index.clear();
    assert.equal(index.loose.size, 0);
});

test('metadata search matches category/tag/tooltip but never reads content', () => {
    const row = { identifier:'a', name:'Test', categories:['Mythic'], tags:['cozy'], tooltip:'Warm', get content(){ throw Error('body read'); } };
    for (const query of ['mythic','COZY','warm','test']) assert.ok(metadataMatches([row],query).has('a'));
    assert.equal(metadataMatches([row],'absent').size,0);
});

for (const text of [
    'before{{// note }}after', '{{// @hidden }}\n{{trim}}', '{{// a }}{{// b }}',
    'hello\n{{// ordinary }}\nworld',
]) test(`safe comment elision preserves simple native comment/trim output: ${JSON.stringify(text)}`, () => {
    const native = s => s.replace(/\{\{\/\/[^{}]*\}\}/g,'').replace(/\n*\{\{trim\}\}\n*/g,'');
    assert.equal(native(safeCommentView(text)), native(text));
});

for (const text of [
    '{{// note }}{{pick::a::b}}', '{{// note }}{{getvar::x}}', '{{// note }}{{setvar::x::1}}',
    '{{// nested {{char}} }}', '{{// note }}{{#if x}}yes{{/if}}', '\\{{// literal }}',
    '{{// unterminated', '{'+'{{// note }}'+'{user}}', '{{// note }}'+ 'X'.repeat(16385),
]) test(`unsafe or large comment field stays exact (${text.slice(0,45)})`, () => assert.equal(safeCommentView(text), text));

test('comment wrapper preserves source, arguments, receiver and later wrappers', () => {
    const calls=[];
    const original=function(p, value){calls.push([this,p,value]); return p.content;};
    const manager={preparePrompt:original};
    const p=prompt('a','{{// note }}text');
    const dispose=installCommentView(manager);
    const wrapper=manager.preparePrompt;
    assert.equal(manager.preparePrompt(p, 'original'),'text');
    assert.equal(p.content,'{{// note }}text');
    assert.equal(calls[0][0], manager);
    assert.equal(calls[0][2], 'original');
    const later=function(...args){return wrapper.apply(this,args);};
    manager.preparePrompt=later;
    dispose();
    assert.equal(manager.preparePrompt,later);
    assert.equal(manager.preparePrompt(p),p.content);
});

function put(index,id,parts) {
    index.handle({type:'begin',id});
    for(const text of parts) index.handle({type:'chunk',id,text});
    index.handle({type:'commit',id});
}
test('body index matches across upload boundaries and folds Unicode off-thread', () => {
    const index=new BodySearchIndex();
    put(index,'a',['Hel','lo İS','TANBUL']);
    assert.deepEqual(index.handle({type:'search',query:'hello'}),['a']);
    assert.deepEqual(index.handle({type:'search',query:'i\u0307stanbul'}),['a']);
    put(index,'a',['goodbye']);
    assert.deepEqual(index.handle({type:'search',query:'hello'}),[]);
    index.handle({type:'remove',id:'a'});
    assert.equal(index.totalChars,0);
});
test('worker limits reject oversized index explicitly without corrupting the old document', () => {
    const index=new BodySearchIndex(8);
    put(index,'a',['old']);
    index.handle({type:'begin',id:'a'});
    assert.throws(()=>index.handle({type:'chunk',id:'a',text:'X'.repeat(9)}),/limit/);
    assert.deepEqual(index.handle({type:'search',query:'old'}),['a']);
});

function workerMock() {
    const index=new BodySearchIndex();
    return {
        stopped:false,
        postMessage(data) { queueMicrotask(()=> {
            if(this.stopped)return;
            try { this.onmessage({data:{request:data.request,result:index.handle(data)}}); }
            catch(error){this.onmessage({data:{request:data.request,error:error.message}});}
        }); },
        terminate(){this.stopped=true;},
    };
}
function client(options={}) { return new PromptBodySearch({createWorker:workerMock, yieldTask:()=>Promise.resolve(), ...options}); }

test('worker is lazy, unchanged bodies are not re-uploaded, edits and deletions invalidate', async () => {
    const c=client();
    try {
        assert.equal(c.worker,null);
        const p=prompt('a','alpha');
        assert.ok((await c.search('alpha',[p])).has('a'));
        const uploaded=c.stats.uploadedChars;
        await c.search('none',[p]);
        assert.equal(c.stats.uploadedChars,uploaded);
        p.content='bravo';
        assert.ok((await c.search('bravo',[p])).has('a'));
        assert.equal((await c.search('bravo',[])).size,0);
    } finally {c.dispose();}
});
test('latest query wins and close releases all pending requests and cache references', async () => {
    const c=client();
    const a=c.search('first',[prompt('a','first')]);
    const b=c.search('second',[prompt('b','second')]);
    assert.equal(await a,null);
    assert.ok((await b).has('b'));
    c.dispose();
    assert.equal(c.pending.size,0); assert.equal(c.loaded.size,0); assert.equal(c.worker,null);
});
test('worker construction failure is reported rather than scanning bodies on the UI thread', async () => {
    const c=client({createWorker:()=>{throw Error('blocked');}});
    await assert.rejects(c.search('x',[prompt('a','body')]),/blocked/);
    c.dispose();
});
test('worker runtime failure is reported rather than leaving searching status forever', async () => {
    const c=client({createWorker:()=>({postMessage(){queueMicrotask(()=>this.onerror());}, terminate(){}})});
    await assert.rejects(c.search('x',[prompt('a','body')]),/worker failed/);
    c.dispose();
});
test('worker timeout rejects and frees the active index', async () => {
    const c=client({timeoutMs:5,createWorker:()=>({postMessage(){},terminate(){}})});
    await assert.rejects(c.search('x',[prompt('a','body')]),/timed out/);
    assert.equal(c.worker,null);
});
test('upload chunks are bounded and permit UI yields', async () => {
    let maximum=0,yields=0;
    const c=client({createWorker:()=>{const w=workerMock();const post=w.postMessage;w.postMessage=function(d){maximum=Math.max(maximum,d.text?.length||0);post.call(this,d);};return w;},yieldTask:async()=>{yields++;}});
    try {await c.search('end',[prompt('a','X'.repeat(200000)+'end')]); assert.ok(maximum<=65536); assert.ok(yields>=4);}
    finally {c.dispose();}
});

test('browser worker module executes through a real worker thread', async () => {
    const { Worker } = await import('node:worker_threads');
    const moduleUrl = new URL('../features/prompt-performance/search-worker.js', import.meta.url).href;
    const createWorker = () => {
        const worker = new Worker(`
            const { parentPort } = require('node:worker_threads');
            globalThis.self = { postMessage: data => parentPort.postMessage(data) };
            import(${JSON.stringify(moduleUrl)}).then(() => {
                parentPort.on('message', data => self.onmessage({ data }));
            });
        `, { eval: true });
        const adapter = { postMessage: data => worker.postMessage(data), terminate: () => worker.terminate() };
        worker.on('message', data => adapter.onmessage?.({ data }));
        worker.on('error', error => adapter.onerror?.(error));
        return adapter;
    };
    const c = client({createWorker});
    try {
        assert.deepEqual([...(await c.search('boundary', [prompt('a', 'X'.repeat(65533)+'boundary')]))], ['a']);
        assert.deepEqual([...(await c.search('new', [prompt('a', 'new')]))], ['a']);
    } finally { c.dispose(); }
});

test('search results reveal every nested parent section', async () => {
    const { applySearchMatches } = await import('../features/prompt-performance/search-ui.js');
    const outerHeader={style:{}},innerHeader={style:{}};
    const outer={style:{},open:false,querySelector:()=>outerHeader,parentElement:{closest:()=>null}};
    const inner={style:{},open:false,querySelector:()=>innerHeader,parentElement:{closest:()=>outer}};
    const match={style:{},dataset:{pmIdentifier:'a'},closest:()=>inner};
    const other={style:{},dataset:{pmIdentifier:'b'},closest:()=>outer};
    const container={contains:()=>true,querySelectorAll:s=>s.startsWith('li')?[match,other]:[outer,inner]};
    applySearchMatches(container,new Set(['a']));
    assert.equal(other.style.display,'none');
    assert.equal(match.style.display,'');
    assert.equal(outer.open,true);assert.equal(inner.open,true);
    assert.equal(outerHeader.style.display,'');assert.equal(innerHeader.style.display,'');
});

test('search UI does not read bodies by default and ignores stale async results', async () => {
    const { installSearchUI } = await import('../features/prompt-performance/search-ui.js');
    const input={value:'alpha',setAttribute(){}};
    const checkbox={checked:false};const progress={textContent:''};
    const fields={nemoPresetSearchInput:input,nemoSearchBodiesLabel:{},nemoSearchBodies:checkbox,nemoSearchProgress:progress};
    const a={style:{},dataset:{pmIdentifier:'a'},closest:()=>null};
    const b={style:{},dataset:{pmIdentifier:'b'},closest:()=>null};
    const container={querySelectorAll:s=>s.startsWith('li')?[a,b]:[],contains:()=>true};
    const root={getElementById:id=>fields[id],querySelector:()=>container};
    let reads=0,clears=0;const pending=[];
    const manager={handlePresetSearch(){clears++;},createSearchAndStatusUI(){}};
    const original=manager.handlePresetSearch;
    const bodies={cancel(){},dispose(){},search(){return new Promise(resolve=>pending.push(resolve));}};
    const ui=installSearchUI({manager,root,getRows:()=>[{identifier:'a',name:'alpha'},{identifier:'b',name:'beta'}],getSources:()=>{reads++;return[];},bodySearch:bodies});
    manager.handlePresetSearch();
    assert.equal(reads,0);assert.equal(b.style.display,'none');
    checkbox.checked=true;manager.handlePresetSearch();
    input.value='beta';manager.handlePresetSearch();
    pending[0](new Set(['a']));await Promise.resolve();
    assert.equal(a.style.display,'none');
    pending[1](new Set(['b']));await Promise.resolve();
    assert.match(progress.textContent,/metadata and prompt text/);
    input.value='';manager.handlePresetSearch();assert.equal(clears,1);
    ui.cleanup();assert.equal(manager.handlePresetSearch,original);
});

test('a changed-length body updates its metadata before any settings event', () => {
    const index=new PromptMetadataIndex(parseStub);
    const p=prompt('a','{{// @tooltip short }}');
    index.bind([p]);index.get(p);
    p.content='X'.repeat(200000)+'{{// @tooltip changed length }}';
    assert.match(index.get(p.content).projection,/changed length/);
    const scans=index.stats.scans;
    index.get(p.content);
    assert.equal(index.stats.scans,scans);
    assert.equal(index.loose.size,0);
});

test('search controls are created once per UI and removed on teardown', async () => {
    const { installSearchUI }=await import('../features/prompt-performance/search-ui.js');
    const nodes=[];
    const make=()=>{const n={listeners:{},append(){},setAttribute(){},addEventListener(k,f){this.listeners[k]=f;},remove(){this.removed=true;},insertAdjacentElement(){},style:{}};nodes.push(n);return n;};
    const input=make();input.id='nemoPresetSearchInput';input.value='';input.parentElement=make();
    const root={getElementById:id=>nodes.find(n=>n.id===id&&!n.removed),createElement:make,createTextNode:text=>({text}),querySelector:()=>({})};
    const manager={handlePresetSearch(){},createSearchAndStatusUI(){}};
    const c={dispose(){},cancel(){}};
    const ui=installSearchUI({manager,root,getRows:()=>[],getSources:()=>[],bodySearch:c});
    assert.ok(root.getElementById('nemoSearchBodies'));
    assert.equal(typeof root.getElementById('nemoSearchBodies').listeners.change,'function');
    manager.handlePresetSearch();
    assert.equal(nodes.filter(n=>n.id==='nemoSearchBodiesLabel'&&!n.removed).length,1);
    ui.cleanup();
    assert.equal(root.getElementById('nemoSearchBodiesLabel'),undefined);
    assert.equal(root.getElementById('nemoSearchProgress'),undefined);
});

test('performance runtime initialization and cleanup are idempotent with no new observers', () => {
    const raw=readFileSync(new URL('../features/prompt-performance/runtime.js',import.meta.url),'utf8');
    assert.doesNotMatch(raw,/MutationObserver/);
    const source=raw.replace(/^import\s+.*?;\r?$/gm,'').replace(/^export\s+/gm,'');
    const listeners=new Map();let restored=0,cleaned=0,binds=0;
    const eventSource={on(e,f){listeners.set(e,f);},removeListener(e){listeners.delete(e);}};
    const window={};
    const api=new Script(`(()=>{${source}\nreturn {initializePromptPerformance,cleanupPromptPerformance};})()`).runInNewContext({
        eventSource,event_types:{OAI_PRESET_CHANGED_AFTER:'preset',SETTINGS_UPDATED:'settings',CHAT_LOADED:'chat'},
        promptManager:{},NemoPresetManager:{},syncPromptMetadata(){binds++;},clearDirectiveCache(){},getPromptMetadataStats:()=>({}),
        getPromptMetadataList:()=>[],installCommentView:()=>()=>{restored++;},
        PromptBodySearch:class{diagnostics(){return{};}},installSearchUI:()=>({refresh(){},cleanup(){cleaned++;}}),
        window,setTimeout,clearTimeout,
    });
    api.initializePromptPerformance();api.initializePromptPerformance();
    assert.equal(listeners.size,3);assert.equal(window.NemoPromptPerformance.stage,'2/5');
    listeners.get('settings')();assert.ok(binds>=2);
    api.cleanupPromptPerformance();api.cleanupPromptPerformance();
    assert.equal(listeners.size,0);assert.equal(restored,1);assert.equal(cleaned,1);
    assert.equal(window.NemoPromptPerformance,undefined);
});
