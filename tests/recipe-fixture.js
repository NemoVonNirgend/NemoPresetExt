import { RESOLVER_ID, RESOLVER_SOURCE } from '../features/preset-runtime/recipe-codec.js';

export function fixture() {
    const prompts = [
        { identifier: 'nc-selection-init', content: '{{setvar::NCGenreId::slice_of_life}}' },
        { identifier: 'nc-genre-comedy', content: '{{setvar::NCGenreId::comedy}}' },
        { identifier: 'nemo-init-recipe-index', content: '{{setvar::NG_slice_of_life::ao}}{{setvar::NG_comedy::ac}}' },
        { identifier: 'nemo-recipe-selection-sanitize', content: '{{setvar::NCGenreId::slice_of_life}}' },
        { identifier: 'nemo-init-heading-recipes-slice_of_life', content: '{{// @category Variable-Init }}' },
        { identifier: 'nemo-init-recipes-slice_of_life-01', content:
            '{{#if {{.NCGenreId == slice_of_life}}}}{{// header }}\n{{setvar::NPaoasas::Exact plain recipe.}}\n{{trim}}\n{{#setvar::NPaoasat}}  Exact scoped recipe.  {{/setvar}}{{trim}}{{/if}}' },
        { identifier: 'nemo-init-heading-recipes-comedy', content: '{{// @category Variable-Init }}' },
        { identifier: 'nemo-init-recipes-comedy-01', content:
            '{{#if {{.NCGenreId == comedy}}}}{{setvar::NPacasas::Comic recipe.}}{{trim}}{{/if}}' },
        { identifier: RESOLVER_ID, content: RESOLVER_SOURCE },
        { identifier: 'ordinary', content: '{{// @tooltip Keep me exactly }}Retain my ordinary body.' },
    ].map(p => ({ name: p.identifier, role: 'system', injection_position: 0, marker: false, injection_trigger: [], ...p }));
    return { preset_name: 'Nemo Engine v12 Full', prompts,
        prompt_order: [100000, 100001].map(character_id => ({ character_id, order: prompts.map(p => ({ identifier: p.identifier, enabled: p.identifier !== 'nc-genre-comedy' })) })),
        extensions: { regex_scripts: [{ findRegex: '/test/g', replaceString: '{{match}}' }], otherExtension: { preserve: true } },
        assistant_prefill: '{{getvar::PlanningAssistantPrefill}}', reverse_proxy: 'https://example.invalid',
    };
}

export function memoryServer() {
    const files = new Map();
    const calls = [];
    let mode = '';
    return { files, calls, setMode: value => { mode = value; }, request: async (url, options = {}) => {
        calls.push({ url, options });
        if (mode === 'offline') return new Response('', { status: 503 });
        if (url === '/api/files/upload') {
            const body = JSON.parse(options.body);
            const text = Buffer.from(body.data, 'base64').toString('utf8');
            const path = `user/files/${body.name}`;
            files.set(`/${path}`, mode === 'corrupt-write' ? text + 'X' : text);
            return Response.json({ path: mode === 'bad-path' ? 'https://attacker.invalid/data' : path });
        }
        if (!files.has(url)) return new Response('', { status: 404 });
        return new Response(files.get(url));
    } };
}
