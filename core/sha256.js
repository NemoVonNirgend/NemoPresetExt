/** SHA-256 of UTF-8 text for content-addressed storage, including HTTP LAN hosts. */
const encoder = new TextEncoder();
const ROUND = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const YIELD_BYTES = 256 * 1024;
const rotate = (word, bits) => (word >>> bits) | (word << (32 - bits));

/** FIPS 180-4 SHA-256. Only the final one/two blocks need a padded copy. */
async function softwareDigest(bytes) {
    // Per-call scratch space: concurrent hashes may interleave at the yield below.
    const state = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    const words = new Uint32Array(64);
    function block(data, offset) {
        for (let i = 0; i < 16; i++) {
            const j = offset + i * 4;
            words[i] = (data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | data[j + 3];
        }
        for (let i = 16; i < 64; i++) {
            const a = words[i - 15], b = words[i - 2];
            const s0 = rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3);
            const s1 = rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10);
            words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = state;
        for (let i = 0; i < 64; i++) {
            const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
            const choice = (e & f) ^ (~e & g);
            const t1 = (h + s1 + choice + ROUND[i] + words[i]) >>> 0;
            const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (s0 + majority) >>> 0;
            h = g; g = f; f = e; e = (d + t1) >>> 0;
            d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        state[0] = (state[0] + a) >>> 0; state[1] = (state[1] + b) >>> 0;
        state[2] = (state[2] + c) >>> 0; state[3] = (state[3] + d) >>> 0;
        state[4] = (state[4] + e) >>> 0; state[5] = (state[5] + f) >>> 0;
        state[6] = (state[6] + g) >>> 0; state[7] = (state[7] + h) >>> 0;
    }

    const fullLength = bytes.length - (bytes.length % 64);
    for (let offset = 0; offset < fullLength; offset += 64) {
        if (offset > 0 && offset % YIELD_BYTES === 0) {
            // A task yield, not just a microtask, keeps large imports responsive.
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        block(bytes, offset);
    }
    const remaining = bytes.length - fullLength;
    const tail = new Uint8Array(remaining < 56 ? 64 : 128);
    tail.set(bytes.subarray(fullLength));
    tail[remaining] = 0x80;
    const view = new DataView(tail.buffer);
    // Big-endian 64-bit bit length without truncating it to a single JS bitwise word.
    view.setUint32(tail.length - 8, Math.floor(bytes.length / 0x20000000), false);
    view.setUint32(tail.length - 4, (bytes.length * 8) >>> 0, false);
    for (let offset = 0; offset < tail.length; offset += 64) block(tail, offset);
    return Array.from(state, word => word.toString(16).padStart(8, '0')).join('');
}

/** Return the same lowercase 64-character SHA-256 in secure and insecure contexts. */
export async function digest(text) {
    const bytes = encoder.encode(text);
    const subtle = globalThis.crypto?.subtle;
    if (typeof subtle?.digest === 'function') {
        // Keep the native receiver; actual digest failures must still reach the caller.
        const hash = await subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    }
    // HTTP LAN origins commonly expose crypto but omit its secure-context-only subtle API.
    // This is still SHA-256, never a skipped checksum or a weaker substitute.
    return softwareDigest(bytes);
}
