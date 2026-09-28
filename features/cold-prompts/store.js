/** Verified, immutable packs in ST's authenticated files directory. No localStorage body copies. */
import { BODY_KEY, MAX_BODY_CHARS, checkedDescriptor, descriptorOf, isCold, shellFor, portablePrompt } from './format.js';
const encoder = new TextEncoder();
const MAX_PACK_CHARS = 4 * 1024 * 1024;
export async function digest(text) {
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(text));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
function base64(text) {
    const bytes = encoder.encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
}
export class PromptBodyStore {
    constructor({ fetchFn = globalThis.fetch.bind(globalThis), headers = () => ({}), timeoutMs = 30000, packChars = 262144 } = {}) {
        Object.assign(this, { fetchFn, headers, timeoutMs, packChars });
        this.pending = new Map(); // In-flight reads only; settled packs are released.
        this.stats = { reads: 0, writes: 0 };
    }
    async request(url, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const r = await this.fetchFn(url, { ...options, signal: controller.signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
            const text = await r.text();
            if (text.length > MAX_PACK_CHARS) throw new Error('Nemo prompt storage response is too large.');
            return { ok: r.ok, status: r.status, text };
        } finally { clearTimeout(timer); }
    }
    async pack(ref) {
        checkedDescriptor({ schema: 1, ref, index: 0, characters: 0, shell: '' });
        if (this.pending.has(ref.sha256)) return this.pending.get(ref.sha256);
        const work = (async () => {
            const r = await this.request(ref.path);
            if (!r.ok) throw new Error(`Prompt storage unavailable (${r.status}). Reimport a portable preset to repair it.`);
            if (await digest(r.text) !== ref.sha256) throw new Error('Prompt storage checksum mismatch.');
            const value = JSON.parse(r.text);
            if (value?.schema !== 1 || !Array.isArray(value.bodies) || value.bodies.length > 4096 ||
                value.bodies.some(s => typeof s !== 'string' || s.length > MAX_BODY_CHARS)) throw new Error('Invalid prompt storage pack.');
            this.stats.reads++;
            return value;
        })();
        this.pending.set(ref.sha256, work);
        try { return await work; } finally { this.pending.delete(ref.sha256); }
    }
    unpack(pack, descriptor) {
        const d = checkedDescriptor(descriptor);
        const content = pack.bodies[d.index];
        if (typeof content !== 'string' || content.length !== d.characters || shellFor(content) !== d.shell) {
            throw new Error('Prompt body does not match its metadata reference.');
        }
        return content;
    }
    async read(descriptor) {
        const d = checkedDescriptor(descriptor);
        return this.unpack(await this.pack(d.ref), d);
    }
    async readMany(prompts, visit) {
        const groups = new Map();
        for (const p of prompts) {
            const d = checkedDescriptor(descriptorOf(p));
            if (!groups.has(d.ref.sha256)) groups.set(d.ref.sha256, []);
            groups.get(d.ref.sha256).push([p, d]);
        }
        for (const group of groups.values()) {
            const pack = await this.pack(group[0][1].ref);
            for (const [p, d] of group) await visit(p, this.unpack(pack, d));
        }
    }
    async writePack(bodies) {
        const text = JSON.stringify({ schema: 1, bodies });
        if (text.length > MAX_PACK_CHARS) throw new Error('Prompt pack exceeds storage limit.');
        const sha256 = await digest(text);
        const name = `nemo-prompts-${sha256}.json`;
        const ref = { path: `/files/${name}`, sha256 };
        const existing = await this.request(ref.path);
        if (!existing.ok || await digest(existing.text) !== sha256) {
            if (!existing.ok && existing.status !== 404) throw new Error(`Prompt storage check failed (${existing.status}).`);
            const r = await this.request('/api/files/upload', {
                method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, data: base64(text) }),
            });
            if (!r.ok) throw new Error(`Prompt storage write failed (${r.status}).`);
            const path = JSON.parse(r.text).path;
            if (typeof path !== 'string' || path.replace(/^\/?/, '/') !== ref.path) throw new Error('Unexpected prompt storage location.');
            this.stats.writes++;
            const verified = await this.pack(ref);
            if (JSON.stringify(verified) !== text) throw new Error('Prompt read-back verification failed.');
        }
        return ref;
    }
    async writeMany(records) {
        const result = new Map();
        let batch = [], size = 0;
        const flush = async () => {
            if (!batch.length) return;
            const ref = await this.writePack(batch.map(r => r.content));
            batch.forEach((record, index) => result.set(record.prompt, {
                schema: 1, ref, index, characters: record.content.length, shell: shellFor(record.content),
            }));
            batch = []; size = 0;
        };
        for (const record of records) {
            if (typeof record.content !== 'string' || record.content.length > MAX_BODY_CHARS) throw new Error('Unsupported prompt body.');
            if (batch.length && (size + record.content.length > this.packChars || batch.length >= 128)) await flush();
            batch.push(record); size += record.content.length;
        }
        await flush();
        return result;
    }
    async restorePrompts(prompts) {
        const restored = new Map();
        await this.readMany(prompts.filter(isCold), (p, content) => restored.set(p, content));
        return prompts.map(p => descriptorOf(p) ? portablePrompt(p, restored.has(p) ? restored.get(p) : p.content) : { ...p });
    }
    diagnostics() { return { ...this.stats, pendingPacks: this.pending.size, residentPackCache: 0 }; }
}
