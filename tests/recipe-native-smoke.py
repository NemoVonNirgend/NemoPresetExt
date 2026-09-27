"""Recipe acceptance in a disposable native SillyTavern checkout. No provider calls.
Requires a .nemo-ci-host sentinel, installed ST dependencies, Playwright and Chromium.
Never point --st at an existing user installation. All chat/data files are temporary.
"""
import argparse
import json
import pathlib
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--st', required=True)
parser.add_argument('--preset', required=True)
parser.add_argument('--report', required=True)
args = parser.parse_args()
st = pathlib.Path(args.st).resolve()
repo = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path(args.preset).resolve()
report_path = pathlib.Path(args.report).resolve()
report_path.parent.mkdir(parents=True, exist_ok=True)
if not (st / '.nemo-ci-host').is_file():
    raise SystemExit('Refusing a non-disposable ST checkout: .nemo-ci-host is required.')
extension = st / 'public/scripts/extensions/third-party/NemoPresetExt'
# copytree refuses to overwrite an existing extension.
shutil.copytree(repo, extension, ignore=shutil.ignore_patterns('.git', 'node_modules', 'native-host'))
original = json.loads(source.read_text(encoding='utf-8'))
report = {'scope': 'Native SillyTavern import, macro/context, tokenizer, export, reload and abort-preflight acceptance', 'checks': []}
errors = []
with tempfile.TemporaryDirectory(prefix='nemo-native-data-') as data_dir:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    url = f'http://127.0.0.1:{port}'
    log = report_path.with_suffix('.server.log').open('w')
    process = subprocess.Popen(['node', 'server.js', '--port', str(port), '--dataRoot', data_dir,
                                '--browserLaunchEnabled', 'false'], cwd=st, stdout=log, stderr=subprocess.STDOUT)
    try:
        for _ in range(120):
            if process.poll() is not None:
                raise RuntimeError('Native ST exited during startup; inspect the server log.')
            try:
                with urllib.request.urlopen(url, timeout=1) as response:
                    if response.status == 200:
                        break
            except (urllib.error.URLError, TimeoutError):
                time.sleep(1)
        else:
            raise RuntimeError('Native ST startup timed out.')
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
            page = browser.new_page(accept_downloads=True)
            page.on('pageerror', lambda error: errors.append(str(error)))
            tokenizer_requests = []
            page.on('request', lambda request: tokenizer_requests.append(request.post_data or '')
                    if '/api/tokenizers/' in request.url else None)
            # A provider request during this suite is a test failure, never a real network call.
            provider_requests = []
            page.route('**/api/backends/chat-completions/generate',
                       lambda route: (provider_requests.append(route.request.url), route.abort()))
            page.goto(url, wait_until='domcontentloaded')
            page.wait_for_function('window.SillyTavern?.getContext && window.NemoRecipeRuntime', timeout=60000)
            page.select_option('#main_api', 'openai')
            await_ready = "async () => (await import('/scripts/openai.js')).promptManager !== null"
            page.wait_for_function(await_ready)
            # Use the native character API with only synthetic test content.
            page.evaluate("""async () => {
                const ctx = SillyTavern.getContext();
                const form = new FormData(); form.set('ch_name', 'Nemo Recipe QA');
                form.set('description', 'A synthetic character for the recipe acceptance test.');
                form.set('first_mes', 'Ready for the test.');
                const headers = ctx.getRequestHeaders(); delete headers['Content-Type'];
                const r = await fetch('/api/characters/create', {method:'POST', headers, body:form});
                if (!r.ok) throw new Error('Character setup failed: ' + r.status + ' ' + await r.text());
                await ctx.getCharacters();
                const next = SillyTavern.getContext();
                const id = next.characters.findIndex(c => c.name === 'Nemo Recipe QA');
                if (id < 0) throw new Error('Synthetic character was not listed.');
                await next.selectCharacterById(id);
            }""")
            page.wait_for_function("SillyTavern.getContext().characterId !== undefined")
            page.locator('#openai_preset_import_file').set_input_files(str(source))
            page.wait_for_function("""async () => {
                const {oai_settings} = await import('/scripts/openai.js');
                return oai_settings.extensions?.nemoRecipeRuntime?.schema === 'nemo-recipes/1';
            }""", timeout=120000)
            info = page.evaluate("""async () => {
                const {oai_settings, promptManager} = await import('/scripts/openai.js');
                await NemoRecipeRuntime.prepare(oai_settings);
                const prepared = promptManager.getPromptCollection('normal').get('nc-writing-resolver');
                await promptManager.tryGenerate();
                return {content:prepared.content, manifest:oai_settings.extensions.nemoRecipeRuntime,
                    ids:oai_settings.prompts.map(p=>p.identifier), counts:promptManager.tokenHandler.getCounts(),
                    stats:NemoRecipeRuntime.stats(), error:promptManager.error};
            }""")
            assert not any(x.startswith('nemo-init-recipes-') for x in info['ids'])
            assert info['content'].startswith('Recipe NPacasas: comedy.'), info['content'][:300]
            assert '{{setvar::NP' not in info['content']
            assert info['counts'].get('nc-writing-resolver', 0) > 0, info
            assert not info['error'], info['error']
            assert tokenizer_requests and max(map(len, tokenizer_requests)) < 100000
            report['checks'].append('Native file input stores a slim preset before prompt application')
            report['checks'].append('Native selectors/macros and PromptManager resolve the exact selected recipe')
            report['checks'].append('Native dry-run tokenizer counts selected content, not the recipe bank')
            report['runtime_stats'] = info['stats']
            report['largest_tokenizer_request_characters'] = max(map(len, tokenizer_requests))
            with page.expect_download(timeout=120000) as download:
                page.locator('#export_oai_preset').click()
                page.locator('.popup-button-ok:visible').last.click(timeout=60000)
            target = pathlib.Path(data_dir) / 'portable.json'
            download.value.save_as(target)
            exported = json.loads(target.read_text(encoding='utf-8'))
            assert exported['prompts'] == original['prompts']
            assert exported['prompt_order'] == original['prompt_order']
            assert 'nemoRecipeRuntime' not in exported.get('extensions', {})
            report['checks'].append('Native whole-preset export restores every original prompt and both order profiles')
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function('window.NemoRecipeRuntime', timeout=60000)
            recovered = page.evaluate("""async () => {
                const {oai_settings,promptManager} = await import('/scripts/openai.js');
                await NemoRecipeRuntime.prepare(oai_settings);
                return promptManager.getPromptCollection('normal').get('nc-writing-resolver').content;
            }""")
            assert recovered == info['content']
            report['checks'].append('Reload restores selected recipes from ST user-file storage')
            # Delete a test-only archive on this disposable server and reload to clear hot memory.
            path = info['manifest']['libraries']['comedy']['path']
            page.evaluate("""async path => {
                const r=await fetch('/api/files/delete',{method:'POST',headers:SillyTavern.getContext().getRequestHeaders(),body:JSON.stringify({path})});
                if(!r.ok) throw new Error('Unable to remove test archive');
            }""", path)
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function('window.NemoPresetExtRecipePreflight', timeout=60000)
            aborted = page.evaluate("""async () => {let stopped=false;
                await NemoPresetExtRecipePreflight([],8000,()=>stopped=true,'normal');return stopped;}
            """)
            assert aborted
            report['checks'].append('Missing server archive aborts the registered native generation preflight')
            assert not provider_requests, provider_requests
            report['checks'].append('No model/provider generation request was made')
            report['page_errors'] = errors
            browser.close()
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill(); process.wait()
        log.close()
        report['passed'] = len(report['checks'])
        report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
