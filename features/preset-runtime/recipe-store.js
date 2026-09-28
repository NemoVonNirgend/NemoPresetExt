import { SCHEMA, validateLibrary } from './recipe-codec.js';

export const MAX_LIBRARY_BYTES = 8 * 1024 * 1024;
const encoder = new TextEncoder();

export async function sha256(text) {
    if (!globalThis.crypto?.subtle) throw new Error('Nemo optimization needs a secure browser context (HTTPS or localhost).');
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateReference(ref) {
    if (!ref || !/^[a-f0-9]{64}$/.test(ref.sha256) || !Number.isSafeInteger(ref.bytes)
        || ref.bytes <= 0 || ref.bytes > MAX_LIBRARY_BYTES || !Number.isSafeInteger(ref.count) || ref.count < 1) {
        throw new Error('Invalid Nemo library reference.');
    }
    // Never fetch a URL from a preset outside the authenticated ST user-files namespace.
    const expected = `nemo-recipes-v1-${ref.sha256}.json`;
    if (![ `user/files/${expected}`, `/user/files/${expected}`, `files/${expected}`, `/files/${expected}` ].includes(ref.path)) {
        throw new Error('Untrusted Nemo library path.');
    }
    return ref.path.startsWith('/') ? ref.path : `/${ref.path}`;
}

function base64(text) {
    const bytes = encoder.encode(text);
    const parts = [];
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    }
    return btoa(parts.join(''));
}

export class RecipeStore {
    constructor({ request = globalThis.fetch?.bind(globalThis), headers = () => ({}), maxCachedBytes = 4 * 1024 * 1024 } = {}) {
        this.request = request;
        this.headers = headers;
        this.maxCachedBytes = maxCachedBytes;
        this.cache = new Map();
        this.pending = new Map();
        this.epoch = 0;
    }

    async readText(ref, { signal } = {}) {
        const path = validateReference(ref);
        const controller = new AbortController();
        const cancel = () => controller.abort(signal?.reason);
        if (signal?.aborted) cancel();
        else signal?.addEventListener('abort', cancel, { once: true });
        const timer = setTimeout(() => controller.abort(new Error('Nemo library read timed out.')), 30000);
        let reader;
        try {
            const response = await this.request(path, {
                credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal,
            });
            if (!response.ok) throw new Error(`Missing Nemo recipe library (${response.status}); re-import the original Full preset.`);
            let text;
            if (response.body?.getReader) {
                reader = response.body.getReader();
                const chunks = [];
                let length = 0;
                while (true) {
                    controller.signal.throwIfAborted();
                    const { done, value } = await reader.read();
                    if (done) break;
                    length += value.byteLength;
                    if (length > ref.bytes) throw new Error('Nemo library exceeds its declared byte limit.');
                    chunks.push(value);
                }
                const bytes = new Uint8Array(length);
                let offset = 0;
                for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
                text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            } else {
                text = await response.text();
            }
            if (encoder.encode(text).length !== ref.bytes || await sha256(text) !== ref.sha256) {
                throw new Error('Nemo library failed its integrity check; the optimized preset has not been activated.');
            }
            return text;
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
            if (reader) { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        }
    }

    async persist(library, { signal } = {}) {
        if (library?.schema !== SCHEMA) throw new Error('Wrong library schema.');
        const text = JSON.stringify(library);
        const bytes = encoder.encode(text).length;
        if (bytes > MAX_LIBRARY_BYTES) throw new Error('Recipe partition is too large for this runtime schema.');
        const hash = await sha256(text);
        const name = `nemo-recipes-v1-${hash}.json`;
        const response = await this.request('/api/files/upload', {
            method: 'POST', credentials: 'same-origin', redirect: 'error', signal,
            headers: { ...this.headers(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data: base64(text) }),
        });
        if (!response.ok) throw new Error(`Could not persist Nemo library (${response.status}). The preset was not changed.`);
        const result = await response.json();
        const ref = { path: result.path, sha256: hash, bytes, count: library.entries.length };
        await this.readText(ref, { signal }); // Read-after-write verification before releasing the import.
        return ref;
    }

    async load(ref, genre, { signal, cache = true } = {}) {
        const path = validateReference(ref);
        const key = ref.sha256;
        const existing = cache && this.cache.get(key);
        if (existing) {
            if (existing.value.library.genre !== genre || existing.value.index.size !== ref.count || existing.bytes !== ref.bytes) {
                throw new Error('Cached library metadata mismatch.');
            }
            this.cache.delete(key);
            this.cache.set(key, existing);
            return existing.value;
        }
        const pendingKey = JSON.stringify([key, genre, ref.bytes, ref.count]);
        if (cache && this.pending.has(pendingKey)) return this.pending.get(pendingKey);
        const epoch = this.epoch;
        const task = (async () => {
            const text = await this.readText({ ...ref, path }, { signal });
            const value = validateLibrary(JSON.parse(text), genre);
            if (value.index.size !== ref.count) throw new Error('Nemo library entry count mismatch.');
            if (cache && epoch === this.epoch) this.cache.set(key, { value, bytes: ref.bytes });
            return value;
        })();
        if (cache) this.pending.set(pendingKey, task);
        try { return await task; }
        finally { if (cache && this.pending.get(pendingKey) === task) this.pending.delete(pendingKey); }
    }

    get(ref, genre) {
        if (!ref) return undefined;
        validateReference(ref);
        const entry = this.cache.get(ref.sha256);
        if (entry && (entry.bytes !== ref.bytes || entry.value.index.size !== ref.count
            || (genre !== undefined && entry.value.library.genre !== genre))) {
            throw new Error('Cached library metadata mismatch.');
        }
        return entry?.value;
    }

    /** Keep current selections pinned; bound all other cached partitions by byte size. */
    trim(pinned = new Set()) {
        let bytes = [...this.cache.values()].reduce((sum, item) => sum + item.bytes, 0);
        for (const [key, item] of this.cache) {
            if (bytes <= this.maxCachedBytes) break;
            if (pinned.has(key)) continue;
            this.cache.delete(key);
            bytes -= item.bytes;
        }
    }

    clear() { this.epoch++; this.cache.clear(); this.pending.clear(); }
    stats() {
        return { cachedLibraries: this.cache.size, cachedBytes: [...this.cache.values()].reduce((sum, x) => sum + x.bytes, 0) };
    }
}
