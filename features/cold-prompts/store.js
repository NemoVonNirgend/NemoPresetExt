/** Verified, immutable packs in ST's authenticated files directory. No localStorage body copies. */
import { diagnosticLabel, PromptPreparationError } from './diagnostics.js';
import { BODY_KEY, MAX_BODY_CHARS, checkedDescriptor, descriptorOf, isCold, shellFor, matchesShell, portablePrompt } from './format.js';
import { alternateUserFilePath, currentUserFilePath, matchedUserFilePath } from '../../core/user-file-path.js';
import { digest } from '../../core/sha256.js';
const encoder = new TextEncoder();
const MAX_PACK_CHARS = 4 * 1024 * 1024;
export { digest };
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
            if (text.length > MAX_PACK_CHARS) throw new PromptPreparationError('PACK_TOO_LARGE', 'Nemo prompt storage response is too large.');
            return { ok: r.ok, status: r.status, text };
        } catch (error) {
            if (error instanceof PromptPreparationError) throw error;
            if (controller.signal.aborted) throw new PromptPreparationError('STORAGE_TIMEOUT', 'The prompt storage request timed out.');
            throw new PromptPreparationError('STORAGE_NETWORK', 'The prompt storage request failed to connect or finish.');
        } finally { clearTimeout(timer); }
    }
    async pack(ref) {
        checkedDescriptor({ schema: 1, ref, index: 0, characters: 0, shell: '' });
        if (this.pending.has(ref.sha256)) return this.pending.get(ref.sha256);
        const work = (async () => {
            const name = `nemo-prompts-${ref.sha256}.json`;
            const primary = matchedUserFilePath(ref.path, name);
            let r = await this.request(primary);
            if (!r.ok && r.status === 404) {
                const alternate = alternateUserFilePath(primary, name);
                if (alternate) r = await this.request(alternate);
            }
            if (!r.ok) {
                const reason = r.status === 404 ? ' Reimport a portable preset to restore missing files.' : '';
                throw new PromptPreparationError('STORAGE_HTTP', `Prompt storage unavailable (${r.status}).${reason}`, { status: r.status });
            }
            if (await digest(r.text) !== ref.sha256) throw new PromptPreparationError('PACK_CHECKSUM', 'Prompt storage checksum mismatch.');
            let value;
            try { value = JSON.parse(r.text); }
            catch { throw new PromptPreparationError('PACK_INVALID', 'Invalid prompt storage pack.'); }
            if (value?.schema !== 1 || !Array.isArray(value.bodies) || value.bodies.length > 4096 ||
                value.bodies.some(s => typeof s !== 'string' || s.length > MAX_BODY_CHARS)) throw new PromptPreparationError('PACK_INVALID', 'Invalid prompt storage pack.');
            this.stats.reads++;
            return value;
        })();
        this.pending.set(ref.sha256, work);
        try { return await work; } finally { this.pending.delete(ref.sha256); }
    }
    unpack(pack, descriptor) {
        const d = checkedDescriptor(descriptor);
        const content = pack.bodies[d.index];
        if (typeof content !== 'string' || content.length !== d.characters || !matchesShell(content, d)) {
            throw new PromptPreparationError('SOURCE_MISMATCH', 'Prompt body does not match its metadata reference.');
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
            const ref = group[0][1].ref;
            let pack;
            try { pack = await this.pack(ref); }
            catch (error) {
                if (!(error instanceof PromptPreparationError)) throw error;
                throw new PromptPreparationError(error.code, error.message, {
                    ...error.details, pack: ref.sha256.slice(0, 12), requestedFromPack: group.length,
                });
            }
            for (const [p, d] of group) {
                let content;
                try { content = this.unpack(pack, d); }
                catch (error) {
                    if (!(error instanceof PromptPreparationError)) throw error;
                    throw new PromptPreparationError(error.code, error.message, { promptId: diagnosticLabel(p.identifier) });
                }
                await visit(p, content);
            }
        }
    }
    async writePack(bodies) {
        const text = JSON.stringify({ schema: 1, bodies });
        if (text.length > MAX_PACK_CHARS) throw new Error('Prompt pack exceeds storage limit.');
        const sha256 = await digest(text);
        const name = `nemo-prompts-${sha256}.json`;
        let ref = { path: currentUserFilePath(name), sha256 };
        const existing = await this.request(ref.path);
        if (!existing.ok || await digest(existing.text) !== sha256) {
            if (!existing.ok && existing.status !== 404) throw new Error(`Prompt storage check failed (${existing.status}).`);
            const r = await this.request('/api/files/upload', {
                method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, data: base64(text) }),
            });
            if (!r.ok) throw new Error(`Prompt storage write failed (${r.status}).`);
            const path = matchedUserFilePath(JSON.parse(r.text).path, name);
            if (!path) throw new Error('Unexpected prompt storage location.');
            ref = { path, sha256 };
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
