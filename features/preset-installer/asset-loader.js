import { digest } from '../../core/sha256.js';

/** Decode and verify the exact portable release; no macros are evaluated here. */
export async function loadPresetAsset(variant, url, fetchFn = globalThis.fetch.bind(globalThis)) {
    if (typeof DecompressionStream !== 'function') {
        throw new Error('This browser cannot unpack bundled presets. Update your browser and retry.');
    }
    const response = await fetchFn(`${url}?sha256=${variant.sha256}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Could not load bundled preset (${response.status}).`);
    const packed = await response.arrayBuffer();
    if (packed.byteLength !== variant.compressedBytes) throw new Error('Bundled preset download is incomplete. Update the extension and retry.');
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader(), chunks = [];
    let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > variant.sourceBytes) throw new Error('Bundled preset has an unexpected size.');
            chunks.push(value);
        }
    } finally { await reader.cancel(); }
    if (length !== variant.sourceBytes) throw new Error('Bundled preset has an unexpected size.');
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (await digest(text) !== variant.sha256) throw new Error('Bundled preset checksum mismatch. Update the extension and retry.');
    return JSON.parse(text);
}
