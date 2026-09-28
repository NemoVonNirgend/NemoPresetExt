import { BANKS, KEY, HASHES, digest, requireThat, loader, parseBank, runtimeOf, libraryKey } from './format.js';
import { truthy } from './program.js';
const LIMIT = 2 * 1024 * 1024;
export function checkedPath(ref) {
    requireThat(ref && /^[a-f0-9]{64}$/.test(ref.sha256 ?? '') && typeof ref.path === 'string', 'invalid library reference.');
    const path = `/files/nemo-vex-${ref.sha256}.json`;
    requireThat(ref.path.replace(/^\/?/, '/') === path, 'unsafe library path.');
    return path;
}
function base64(text) {
    const bytes = new TextEncoder().encode(text); let result = '';
    for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(result);
}
export class VexStore {
    constructor({ fetchFn = globalThis.fetch.bind(globalThis), headers = () => ({}), timeoutMs = 30000 } = {}) {
        Object.assign(this, { fetchFn, headers, timeoutMs });
    }
    async request(path, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const r = await this.fetchFn(path, { ...options, signal: controller.signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
            const text = await r.text();
            requireThat(text.length <= LIMIT, 'library response exceeds the supported size.');
            return { ok: r.ok, status: r.status, text };
        } finally { clearTimeout(timeout); }
    }
    async read(ref) {
        const r = await this.request(checkedPath(ref));
        requireThat(r.ok, `library unavailable (${r.status}). Reimport the portable Full preset to repair it.`);
        requireThat(await digest(r.text) === ref.sha256, 'library checksum mismatch.');
        return JSON.parse(r.text);
    }
    async write(value) {
        const text = JSON.stringify(value);
        requireThat(text.length <= LIMIT, 'library exceeds the supported size.');
        const sha256 = await digest(text), name = `nemo-vex-${sha256}.json`;
        const ref = { path: `/files/${name}`, sha256 };
        const existing = await this.request(ref.path);
        if (existing.ok && await digest(existing.text) === sha256) return ref;
        requireThat(existing.ok || existing.status === 404, `cannot check storage (${existing.status}).`);
        const r = await this.request('/api/files/upload', { method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name, data: base64(text) }) });
        requireThat(r.ok, `could not write library (${r.status}).`);
        checkedPath({ path: JSON.parse(r.text).path, sha256 });
        await this.read(ref);
        return ref;
    }
    async extract(preset, plan) {
        const refs = [];
        for (const p of plan.banks) refs.push({ identifier: p.identifier, ...await this.write(p) });
        const manifest = { schema: 1, refs, probes: plan.probes, locations: plan.locations, selectors: plan.contract.selectors, hashes: HASHES };
        const ref = await this.write(manifest);
        return {
            ...preset,
            prompts: preset.prompts.map(p => BANKS.includes(p.identifier) ? { ...p, content: loader(p.identifier) } : p),
            extensions: { ...preset.extensions, [KEY]: { schema: 1, manifest: ref, entries: Object.keys(plan.locations).length } },
        };
    }
    async manifest(preset) {
        const descriptor = runtimeOf(preset);
        requireThat(descriptor?.schema === 1, 'unsupported runtime schema.');
        const m = await this.read(descriptor.manifest);
        requireThat(m.schema === 1 && Array.isArray(m.refs) && m.refs.length === BANKS.length && m.locations && m.probes && m.selectors, 'invalid manifest.');
        requireThat(Object.keys(m.locations).length === descriptor.entries && descriptor.entries <= 10000 && descriptor.entries > 0, 'library count mismatch.');
        m.refs.forEach((ref, i) => { checkedPath(ref); requireThat(ref.identifier === BANKS[i], 'library identity mismatch.'); });
        for (const [id, hash] of Object.entries(HASHES)) requireThat(m.hashes?.[id] === hash, 'unsupported Vex program contract.');
        requireThat(Object.keys(m.probes).length === Object.keys(m.locations).length, 'dependency index count mismatch.');
        for (const [key, loc] of Object.entries(m.locations)) {
            requireThat(libraryKey(key), 'unrecognized library namespace.');
            requireThat(Array.isArray(loc) && loc.length === 3 && loc.every(Number.isSafeInteger) && loc[0] >= 0 && loc[0] < BANKS.length && loc[1] >= 0 && loc[2] > loc[1] && loc[2] <= LIMIT, 'invalid library offset.');
            requireThat(Object.hasOwn(m.probes, key) && typeof m.probes[key] === 'string' && m.probes[key].length < 1024, 'invalid dependency probe.');
        }
        return m;
    }
    async selected(manifest, reads) {
        const groups = new Map();
        for (const key of reads) {
            const loc = manifest.locations[key];
            requireThat(loc, `missing selected Vex field ${key}.`);
            if (!groups.has(loc[0])) groups.set(loc[0], new Set());
            groups.get(loc[0]).add(key);
        }
        const bodies = Object.fromEntries(BANKS.map(id => [id, '']));
        let characters = 0;
        for (const [index, keys] of groups) {
            const ref = manifest.refs[index], bank = await this.read(ref);
            requireThat(bank.identifier === ref.identifier, 'library source identity mismatch.');
            const entries = parseBank(bank).filter(e => keys.has(e.name));
            requireThat(entries.length === keys.size, 'selected library entry is absent.');
            for (const e of entries) {
                const loc = manifest.locations[e.name];
                requireThat(e.start === loc[1] && e.end === loc[2], 'library source offset mismatch.');
                const probe = /^(NVCL1_text_|NVCL1_exchange_)/.test(e.name) ? (truthy(e.value) ? 'VEX_TEXT' : '') : e.value;
                requireThat(probe === manifest.probes[e.name], 'library dependency probe mismatch.');
            }
            bodies[bank.identifier] = entries.map(e => e.statement).join('') + '{{trim}}';
            characters += bodies[bank.identifier].length;
        }
        // Only selected original setter strings escape this method. No settled bank cache.
        return { bodies, characters };
    }
    async restore(preset, { partial = false } = {}) {
        const m = await this.manifest(preset), originals = new Map();
        for (const ref of m.refs) {
            if (partial && !preset.prompts.some(p => p.identifier === ref.identifier)) continue;
            const p = await this.read(ref);
            requireThat(p.identifier === ref.identifier, 'export library identity mismatch.');
            parseBank(p); originals.set(p.identifier, p.content);
        }
        const seen = new Set();
        const prompts = preset.prompts.map(p => {
            if (!originals.has(p.identifier)) return p;
            requireThat(p.content === loader(p.identifier), 'library loader edited; restore its original stub before portable export.');
            requireThat(!seen.has(p.identifier), 'duplicate export library slot.'); seen.add(p.identifier);
            return { ...p, content: originals.get(p.identifier) };
        });
        requireThat(partial || seen.size === BANKS.length, 'portable export is missing a Vex library slot.');
        const extensions = { ...preset.extensions }; delete extensions[KEY];
        return { ...preset, prompts, extensions };
    }
}
