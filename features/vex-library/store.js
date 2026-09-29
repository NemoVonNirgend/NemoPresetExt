/** Stage 4A/5 source storage only. Not registered with the extension entry point. */
import { BANK_IDS, SCHEMA, MAX_BYTES, MAX_ENTRIES, byteLength, libraryKey, parseBank,
    snapshotLibrary, restoreSources, requireThat } from './format.js';
import { alternateUserFilePath, currentUserFilePath, matchedUserFilePath } from '../../core/user-file-path.js';

const HEX = /^[a-f0-9]{64}$/;
export async function digest(text) {
    const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function checkedPath(ref) {
    requireThat(ref && typeof ref.sha256 === 'string' && HEX.test(ref.sha256)
        && typeof ref.path === 'string', 'invalid source reference.');
    const name = `nemo-vex-source-${ref.sha256}.json`;
    const path = matchedUserFilePath(ref.path, name);
    requireThat(path, 'unsafe source path.');
    return path;
}
function base64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
}
async function boundedText(response) {
    const length = response.headers?.get?.('content-length');
    if (length !== null && length !== undefined) {
        requireThat(/^\d+$/.test(length) && Number(length) <= MAX_BYTES, 'source response exceeds the byte limit.');
    }
    if (!response.body?.getReader) {
        const text = await response.text();
        requireThat(byteLength(text) <= MAX_BYTES, 'source response exceeds the byte limit.');
        return text;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let total = 0, text = '';
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            total += value.byteLength;
            requireThat(total <= MAX_BYTES, 'source response exceeds the byte limit.');
            text += decoder.decode(value, { stream: true });
        }
        return text + decoder.decode();
    } catch (error) {
        try { await reader.cancel(); } catch { /* Preserve the original read error. */ }
        throw error;
    } finally { reader.releaseLock(); }
}

export class VexLibraryStore {
    constructor({ fetchFn = globalThis.fetch?.bind(globalThis), headers = () => ({}), timeoutMs = 30000 } = {}) {
        requireThat(typeof fetchFn === 'function' && typeof headers === 'function', 'invalid storage transport.');
        requireThat(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000, 'invalid request timeout.');
        Object.assign(this, { fetchFn, headers, timeoutMs });
        // No source, manifest or whole-bank cache is retained by this object.
    }
    async request(path, options = {}) {
        const controller = new AbortController();
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('Nemo Vex storage: request timed out.')); }, this.timeoutMs);
        });
        try {
            return await Promise.race([timeout, (async () => {
                const response = await this.fetchFn(path, { ...options, signal: controller.signal,
                    credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
                return { ok: response.ok, status: response.status, text: await boundedText(response) };
            })()]);
        } catch (error) { controller.abort(); throw error; }
        finally { clearTimeout(timer); }
    }
    async read(ref) {
        const name = `nemo-vex-source-${ref.sha256}.json`;
        const primary = checkedPath(ref);
        let response = await this.request(primary);
        if (!response.ok && response.status === 404) {
            const alternate = alternateUserFilePath(primary, name);
            if (alternate) response = await this.request(alternate);
        }
        requireThat(response.ok, `source unavailable (${response.status}). Restore the original portable preset to repair it.`);
        requireThat(await digest(response.text) === ref.sha256, 'source checksum mismatch.');
        return JSON.parse(response.text);
    }
    async write(value) {
        const text = JSON.stringify(value);
        requireThat(typeof text === 'string' && byteLength(text) <= MAX_BYTES, 'source exceeds the byte limit.');
        const sha256 = await digest(text), name = `nemo-vex-source-${sha256}.json`;
        let ref = { path: currentUserFilePath(name), sha256 };
        const existing = await this.request(ref.path);
        if (existing.ok && await digest(existing.text) === sha256) return ref;
        requireThat(existing.ok || existing.status === 404, `cannot check source storage (${existing.status}).`);
        const uploaded = await this.request('/api/files/upload', { method: 'POST',
            headers: { ...this.headers(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data: base64(text) }) });
        requireThat(uploaded.ok, `source write failed (${uploaded.status}).`);
        const path = matchedUserFilePath(JSON.parse(uploaded.text).path, name);
        requireThat(path, 'unsafe source path.');
        ref = { path, sha256 };
        await this.read(ref); // No descriptor is returned before durable read-back succeeds.
        return ref;
    }
    async capture(preset) {
        // Snapshot before the first await: a concurrent editor cannot alter captured source.
        const snapshot = snapshotLibrary(preset), banks = [];
        for (const [index, prompt] of snapshot.banks.entries()) {
            const ref = await this.write({ schema: SCHEMA, kind: 'bank', prompt });
            banks.push({ ...ref, identifier: prompt.identifier, characters: prompt.content.length,
                bytes: byteLength(prompt.content), entries: snapshot.indexes[index] });
        }
        const manifest = await this.write({ schema: SCHEMA, kind: 'manifest', banks, entryCount: snapshot.entryCount });
        return { schema: SCHEMA, manifest, bankCount: banks.length, entryCount: snapshot.entryCount };
    }
    async manifest(descriptor) {
        requireThat(descriptor?.schema === SCHEMA && descriptor.bankCount === BANK_IDS.length
            && Number.isSafeInteger(descriptor.entryCount) && descriptor.entryCount > 0
            && descriptor.entryCount <= MAX_ENTRIES, 'invalid library descriptor.');
        const manifest = await this.read(descriptor.manifest);
        requireThat(manifest?.schema === SCHEMA && manifest.kind === 'manifest'
            && Array.isArray(manifest.banks) && manifest.banks.length === BANK_IDS.length
            && manifest.entryCount === descriptor.entryCount, 'invalid library manifest.');
        const names = new Set();
        manifest.banks.forEach((bank, index) => {
            checkedPath(bank);
            requireThat(bank.identifier === BANK_IDS[index] && Number.isSafeInteger(bank.characters)
                && bank.characters > 0 && bank.characters <= MAX_BYTES && Number.isSafeInteger(bank.bytes)
                && bank.bytes >= bank.characters && bank.bytes <= MAX_BYTES && Array.isArray(bank.entries)
                && bank.entries.length > 0 && bank.entries.length <= MAX_ENTRIES, 'invalid bank index.');
            let previousEnd = 0;
            for (const entry of bank.entries) {
                requireThat(libraryKey(entry?.name) && !names.has(entry.name) && Number.isSafeInteger(entry.start)
                    && Number.isSafeInteger(entry.end) && entry.start >= previousEnd && entry.end > entry.start
                    && entry.end <= bank.characters, 'invalid or overlapping source offsets.');
                names.add(entry.name); previousEnd = entry.end;
            }
        });
        requireThat(names.size === descriptor.entryCount, 'library entry count mismatch.');
        return manifest;
    }
    async bank(ref) {
        const stored = await this.read(ref);
        requireThat(stored?.schema === SCHEMA && stored.kind === 'bank'
            && stored.prompt?.identifier === ref.identifier, 'source bank identity mismatch.');
        const prompt = stored.prompt, entries = parseBank(prompt);
        requireThat(prompt.content.length === ref.characters && byteLength(prompt.content) === ref.bytes
            && entries.length === ref.entries.length, 'source bank length/count mismatch.');
        entries.forEach((entry, i) => {
            const indexed = ref.entries[i];
            requireThat(entry.name === indexed.name && entry.start === indexed.start && entry.end === indexed.end,
                'source index does not match the original setters.');
        });
        return { prompt, entries };
    }
    async originals(descriptor) {
        const manifest = await this.manifest(descriptor), result = [];
        for (const ref of manifest.banks) result.push((await this.bank(ref)).prompt);
        return result;
    }
    async selected(descriptor, names) {
        requireThat(Array.isArray(names) || names instanceof Set, 'selected names must be an array or Set.');
        const wanted = new Set(names);
        requireThat(wanted.size <= MAX_ENTRIES && [...wanted].every(libraryKey), 'invalid selected library names.');
        const manifest = await this.manifest(descriptor);
        const known = new Set(manifest.banks.flatMap(bank => bank.entries.map(entry => entry.name)));
        requireThat([...wanted].every(name => known.has(name)), 'selected field is missing; no fallback was substituted.');
        const result = [];
        for (const ref of manifest.banks) {
            if (!ref.entries.some(entry => wanted.has(entry.name))) continue;
            const { entries } = await this.bank(ref);
            // Only selected exact statements escape. Caller owns this small result.
            result.push({ identifier: ref.identifier, statements: entries.filter(entry => wanted.has(entry.name))
                .map(({ name, statement }) => ({ name, statement })) });
        }
        return result;
    }
    async restore(preset, descriptor, options) {
        return restoreSources(preset, await this.originals(descriptor), options);
    }
}
