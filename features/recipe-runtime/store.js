/** Content-addressed sidecars in the authenticated ST user's files directory. */
import { parseBank, compactPreset, restorePreset, runtimeOf } from './format.js';
const encoder = new TextEncoder();
const HEX = /^[a-f0-9]{64}$/;

export async function digest(text) {
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(text));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export function checkedPath(ref) {
    if (!ref || !HEX.test(ref.sha256 ?? '') || typeof ref.path !== 'string') throw new Error('Invalid Nemo sidecar reference.');
    const expected = `/files/nemo-recipes-${ref.sha256}.json`;
    if (ref.path.replace(/^\/?/, '/') !== expected) throw new Error('Unsafe Nemo sidecar path.');
    return expected;
}

function base64(text) {
    const bytes = encoder.encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
}

export class RecipeStore {
    constructor({ fetchFn = globalThis.fetch.bind(globalThis), headers = () => ({}), timeoutMs = 30000 } = {}) {
        this.fetch = fetchFn;
        this.headers = headers;
        this.timeoutMs = timeoutMs;
    }

    async request(url, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await this.fetch(url, { ...options, signal: controller.signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
            const text = await response.text();
            if (text.length > 4 * 1024 * 1024) throw new Error('Nemo sidecar exceeds the supported size.');
            return { ok: response.ok, status: response.status, text };
        } finally { clearTimeout(timeout); }
    }

    async read(ref) {
        const response = await this.request(checkedPath(ref));
        if (!response.ok) throw new Error(`Nemo sidecar unavailable (${response.status}). Reimport the original portable preset to repair it.`);
        if (await digest(response.text) !== ref.sha256) throw new Error('Nemo sidecar checksum mismatch. Reimport the portable preset.');
        return JSON.parse(response.text);
    }

    async write(value) {
        const text = JSON.stringify(value);
        if (text.length > 4 * 1024 * 1024) throw new Error('Nemo sidecar exceeds the supported size.');
        const sha256 = await digest(text);
        const name = `nemo-recipes-${sha256}.json`;
        const ref = { path: `/files/${name}`, sha256 };
        const existing = await this.request(ref.path);
        if (existing.ok && await digest(existing.text) === sha256) return ref;
        if (!existing.ok && existing.status !== 404) throw new Error(`Cannot check recipe storage (${existing.status}).`);
        const response = await this.request('/api/files/upload', {
            method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data: base64(text) }),
        });
        if (!response.ok) throw new Error(`Could not save recipe sidecar (${response.status}).`);
        const uploaded = JSON.parse(response.text);
        checkedPath({ path: uploaded.path, sha256 });
        await this.read(ref); // Do not discard the portable source until read-back succeeds.
        return ref;
    }

    async extract(preset, plan, progress = () => {}) {
        const shards = [];
        const positions = new Map();
        for (const [i, prompt] of plan.banks.entries()) {
            const ref = await this.write(prompt);
            positions.set(prompt.identifier, i);
            shards.push({ identifier: prompt.identifier, ...ref });
            progress(i + 1, plan.banks.length);
        }
        const keyToShard = Object.fromEntries(Object.entries(plan.keyToBank).map(([key, id]) => [key, positions.get(id)]));
        const manifest = { schema: 1, shards, keyToShard, restore: plan.restore };
        const ref = await this.write(manifest);
        return compactPreset(preset, plan, {
            schema: 1, manifest: ref, recipes: Object.keys(keyToShard).length, partitions: shards.length,
        });
    }

    async manifest(preset) {
        const descriptor = runtimeOf(preset);
        if (descriptor?.schema !== 1) throw new Error('Unsupported Nemo recipe runtime schema.');
        const manifest = await this.read(descriptor.manifest);
        if (manifest?.schema !== 1 || !Array.isArray(manifest.shards) || !manifest.keyToShard || !manifest.restore) throw new Error('Invalid recipe manifest.');
        if (manifest.shards.length !== descriptor.partitions || Object.keys(manifest.keyToShard).length !== descriptor.recipes) throw new Error('Recipe manifest count mismatch.');
        for (const ref of manifest.shards) checkedPath(ref);
        return manifest;
    }

    async selected(manifest, key) {
        const index = Object.prototype.hasOwnProperty.call(manifest.keyToShard, key) ? manifest.keyToShard[key] : -1;
        if (!Number.isInteger(index) || index < 0 || index >= manifest.shards.length) throw new Error(`Recipe ${key} is missing. No fallback recipe was substituted.`);
        const ref = manifest.shards[index];
        const prompt = await this.read(ref);
        if (prompt.identifier !== ref.identifier) throw new Error('Recipe shard identity mismatch.');
        const statement = parseBank(prompt).recipes[key];
        if (!statement) throw new Error(`Recipe ${key} is absent from its shard.`);
        return statement; // Keep this small string, not the entire shard, in the hot cache.
    }

    async restore(preset) {
        const manifest = await this.manifest(preset);
        const banks = [];
        for (const ref of manifest.shards) {
            const prompt = await this.read(ref);
            if (prompt.identifier !== ref.identifier) throw new Error('Recipe shard identity mismatch.');
            parseBank(prompt);
            banks.push(prompt);
        }
        return restorePreset(preset, manifest, banks);
    }
}
