"""Chromium smoke tests against a SMALL ST-contract host, not a full ST installation.
Run: python tests/recipe-browser-smoke.py --preset /path/to/Nemo_Engine_v12_Full.json
Requires Python 3.10+, Playwright, and Chromium. Does not contact a model/provider.
"""
import argparse
import base64
import functools
import http.server
import json
import pathlib
import shutil
import tempfile
import threading
import time
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--preset', required=True)
parser.add_argument('--chromium', default=shutil.which('chromium'))
parser.add_argument('--report')
args = parser.parse_args()
source = pathlib.Path(args.preset).resolve()
repo = pathlib.Path(__file__).resolve().parents[1]
original = json.loads(source.read_text())

HOST_SCRIPT = '''
export let main_api = 'openai';
export const event_types = Object.fromEntries(['OAI_PRESET_CHANGED_BEFORE','OAI_PRESET_IMPORT_READY','OAI_PRESET_EXPORT_READY','CHAT_COMPLETION_PROMPT_READY'].map(x=>[x,x]));
const listeners = new Map();
export const eventSource = {
 on(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f)},
 removeListener(k,f){listeners.get(k)?.delete(f)},
 async emit(k,...a){for(const f of listeners.get(k)||[]){try{await f(...a)}catch(e){console.error('ST-style swallowed listener error',e)}}}
};
export function getRequestHeaders(){return {'Content-Type':'application/json','X-CSRF-Token':'smoke-test'}};
'''
HOST_EXTENSIONS = '''
export const extension_settings={NemoPresetExt:{}};
export const state={vars:{},stops:0,errors:[],prepared:[],nativeImports:0,generated:0};
export function getContext(){return {variables:{local:{get:k=>state.vars[k]}},stopGeneration:()=>state.stops++}};
window.toastr={error:m=>state.errors.push(m),info:()=>null,success:()=>{}};
'''
HOST_OPENAI = '''
import {state} from './extensions.js';
export const oai_settings={};
export const openai_settings=[];
export const openai_setting_names={};
export const promptManager={activeCharacter:{id:100001},serviceSettings:oai_settings,
 preparePrompt(p){state.prepared.push(p.content);return {...p,content:p.content.replace(/\\n\\{\\{trim\\}\\}$/, '')}},
 async tryGenerate(){state.generated++;const p=oai_settings.prompts.find(p=>p.identifier==='nc-writing-resolver');return p?this.preparePrompt(p):null}
};
'''
HOST_HTML = '''<!doctype html><meta charset="utf-8"><input type="file" id="openai_preset_import_file"><button id="export_oai_preset">Export</button>
<script type="module">
import {eventSource,event_types} from '/script.js';
import {state,extension_settings} from '/scripts/extensions.js';
import {oai_settings,openai_settings,openai_setting_names,promptManager} from '/scripts/openai.js';
import {initializeRecipeRuntime,recipeGenerationPreflight} from '/scripts/extensions/third-party/NemoPresetExt/features/preset-runtime/runtime.js';
window.host={state,oai_settings,openai_settings,openai_setting_names,promptManager,extension_settings};
async function apply(p){
 openai_settings[0]=p;openai_setting_names.fixture=0;
 await eventSource.emit(event_types.OAI_PRESET_CHANGED_BEFORE,{preset:p});
 Object.assign(oai_settings,p,{preset_settings_openai:'fixture'});
 // This host does not implement the rest of ST's macro engine. Supply a known selected cell.
 state.vars={NCGenreId:'comedy',NCAuthorId:'terry_pratchett',NCStyleId:'light_novel',NG_comedy:'ac',NA_terry_pratchett:'ay',NS_light_novel:'an'};
 await promptManager.tryGenerate();
}
document.querySelector('input').addEventListener('input',async e=>{
 const file=e.target.files[0];if(!file)return;state.nativeImports++;
 const p=JSON.parse(await file.text());
 await eventSource.emit(event_types.OAI_PRESET_IMPORT_READY,{data:p,presetName:'fixture'});
 await fetch('/api/presets/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
 await apply(p);window.importDone=true;
});
document.querySelector('button').addEventListener('click',async()=>{
 const p=structuredClone(openai_settings[0]);delete p.reverse_proxy;
 await eventSource.emit(event_types.OAI_PRESET_EXPORT_READY,p);
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(p)],{type:'application/json'}));a.download='portable.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
});
window.host.generate=async()=>{let aborted=false;await recipeGenerationPreflight([],8000,()=>aborted=true,'normal');return {aborted}};
initializeRecipeRuntime();
let prev=performance.now();window.heartbeatGap=0;setInterval(()=>{const now=performance.now();window.heartbeatGap=Math.max(window.heartbeatGap,now-prev);prev=now},10);
const saved=await fetch('/saved.json');if(saved.ok){await apply(await saved.json());window.restored=true}window.ready=true;
</script>'''

with tempfile.TemporaryDirectory(prefix='nemo-browser-') as directory:
    root = pathlib.Path(directory)
    runtime = root / 'scripts/extensions/third-party/NemoPresetExt/features/preset-runtime'
    runtime.parent.mkdir(parents=True)
    shutil.copytree(repo / 'features/preset-runtime', runtime)
    (root / 'scripts').mkdir(exist_ok=True)
    (root / 'script.js').write_text(HOST_SCRIPT)
    (root / 'scripts/extensions.js').write_text(HOST_EXTENSIONS)
    (root / 'scripts/openai.js').write_text(HOST_OPENAI)
    (root / 'index.html').write_text(HOST_HTML)
    (root / 'user/files').mkdir(parents=True)
    stats = {'upload_count': 0, 'saved_preset_bytes': 0, 'mode': ''}

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_GET(self):
            if stats['mode'] == 'missing' and self.path.startswith('/user/files/'):
                self.send_error(404)
            else:
                super().do_GET()

        def do_POST(self):
            body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
            if self.path == '/api/files/upload':
                if self.headers.get('X-CSRF-Token') != 'smoke-test':
                    self.send_error(403)
                    return
                data = json.loads(body)
                path = root / 'user/files' / pathlib.Path(data['name']).name
                path.write_bytes(base64.b64decode(data['data']))
                stats['upload_count'] += 1
                result = json.dumps({'path': 'user/files/' + path.name}).encode()
            elif self.path == '/api/presets/save':
                (root / 'saved.json').write_bytes(body)
                stats['saved_preset_bytes'] = len(body)
                result = b'{}'
            else:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(result)))
            self.end_headers()
            self.wfile.write(result)

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    report = {'scope': 'Chromium with an ST-contract test host; not native SillyTavern', 'checks': []}
    try:
        with sync_playwright() as browser_api:
            browser = browser_api.chromium.launch(executable_path=args.chromium, headless=True, args=['--no-sandbox'])
            page = browser.new_page(accept_downloads=True)
            page.goto(f'http://localhost:{server.server_port}/')
            page.wait_for_function('window.ready')
            start = time.monotonic()
            page.locator('input').set_input_files(str(source))
            page.wait_for_function('window.importDone || window.host.state.errors.length', timeout=120000)
            errors = page.evaluate('window.host.state.errors')
            assert not errors, errors
            slim = json.loads((root / 'saved.json').read_text())
            assert len(slim['prompts']) == len(original['prompts']) - 123
            assert stats['upload_count'] == 17
            assert 'nemoRecipeRuntime' in slim['extensions']
            assert not any(p['identifier'].startswith('nemo-init-recipes-') for p in slim['prompts'])
            report['checks'].append('Real Worker + DataTransfer intercept native file input before preset save')
            report['import_seconds_test_host'] = time.monotonic() - start
            report['main_thread_max_interval_gap_ms_test_host'] = page.evaluate('window.heartbeatGap')
            prepared = page.evaluate('window.host.state.prepared')
            assert len(prepared) == 1 and len(prepared[0]) < 15000 and '{{setvar::NP' not in prepared[0]
            assert 'Comedy' in prepared[0] and 'Terry Pratchett' in prepared[0] and 'Light Novel' in prepared[0]
            report['checks'].append('Dry-run preparation receives one exact selected recipe, not the bank')
            assert not page.evaluate('window.host.generate()')['aborted']
            report['checks'].append('Real-generation preflight allows verified library state')
            with page.expect_download(timeout=30000) as download_info:
                page.locator('button').click()
            target = root / 'downloaded.json'
            download_info.value.save_as(target)
            exported = json.loads(target.read_text())
            assert exported == original
            report['checks'].append('Native export event rehydrates a complete structurally identical portable preset')
            page.reload()
            page.wait_for_function('window.restored', timeout=30000)
            assert not page.evaluate('window.host.state.errors')
            report['checks'].append('Fresh page reload recovers from server storage, without browser body cache')
            stats['mode'] = 'missing'
            page.reload()
            page.wait_for_function('window.ready', timeout=30000)
            assert page.evaluate('window.host.generate()')['aborted']
            report['checks'].append('Missing libraries abort the supported generation preflight')
            report['original_file_bytes'] = source.stat().st_size
            report['saved_preset_bytes'] = stats['saved_preset_bytes']
            report['uploads'] = stats['upload_count']
            browser.close()
    finally:
        server.shutdown()
    report['passed'] = len(report['checks'])
    output = json.dumps(report, indent=2)
    if args.report:
        pathlib.Path(args.report).write_text(output + '\n')
    print(output)
