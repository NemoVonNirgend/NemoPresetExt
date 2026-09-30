# SHA-256 storage compatibility (6.0.8)

The prompt-body, recipe and Vex source stores now share `core/sha256.js`. The previous helpers called `crypto.subtle.digest` unconditionally. Browsers can expose `crypto` without `subtle`, particularly on HTTP LAN origins, producing `Cannot read properties of undefined (reading 'digest')` before the first storage upload.

The shared helper prefers native Web Crypto and otherwise computes the same SHA-256 over the same TextEncoder UTF-8 bytes. The software implementation follows FIPS 180-4 SHA-256, keeps scratch state local to each call, pads only the final blocks, and yields to the task queue every 256 KiB while processing large inputs. It adds no runtime dependency, remote hashing request, global crypto shim or source cache.

The old store-level `digest` exports remain aliases of the shared helper, so Vex runtime consumers and existing tests retain their import paths. Hash spelling, filenames, schemas, Unicode encoding, current/legacy path validation and read-back checks are unchanged. Existing sidecars require no migration. A present native implementation that throws still propagates its error. Corrupt sidecars still fail checksum verification; the fallback never skips validation. This compatibility change does not encrypt HTTP traffic.

## Validation performed

All three original stores reproduced the reported missing-subtle error before any fetch was made. The seven locally retrieved store/format/path source files were checked against their GitHub blob hashes before applying the patch.

`node --test tests/sha256.test.js tests/storage-sha256.test.js`: 26 tests passed. Coverage includes published SHA-256 vectors, the million-a vector, independent Node SHA-256 comparison, short padding boundaries, deterministic mixed UTF-16 input, lone surrogates, 3.6 MB Unicode input, task yielding, concurrent hashes, missing crypto/subtle/digest, native receiver binding and native error propagation. Storage coverage includes all three stores, native/software interoperability, deduplication, current/legacy paths, corruption on reads and upload read-back, cold prompt portable restore, recipe extraction/selection/restore and Vex capture/selection/restore.

An offline Chromium 144 smoke test also passed in a genuine insecure `about:blank` context with `isSecureContext === false` and `crypto.subtle` absent, without overriding the crypto API. It exercised the actual modules with data-URL imports and an in-memory fetch fixture: known/large Unicode hashes, all three storage round trips, portable cold-prompt restoration, deduplication and corrupted-file rejection.

Actual HTTP navigation was blocked by the test environment (`net::ERR_BLOCKED_BY_ADMINISTRATOR`), so this is not a full SillyTavern UI or live HTTP backend acceptance test. The full repository suite is separate from the 26 targeted tests above.

## User-side smoke check

Update the extension to 6.0.8, fully reload SillyTavern on the affected address, and reimport the original portable preset. Verify an enabled stored prompt loads before generation, a disabled prompt can be opened, and a portable export retains its source text. No preset rewrite or storage deletion is required for this fix.
