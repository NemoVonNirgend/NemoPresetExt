# Stage 4A/5: Vex source storage foundation

Stage 4/5 was split into **4A/5 (1/2)** and **4B/5 (2/2)**. This document describes the storage foundation merged in PR #24. It was delivered dormant with runtime version 6.0.3. **Stage 4B now connects it through a separate runtime adapter in 6.0.4.** See [live integration and usage](VEX_RUNTIME.md). The source layer itself remains inert.

## What the source layer implements

`features/vex-library/format.js` recognizes the five known Vex bank IDs alongside the reset/resolver/assembler IDs, snapshots only those banks, and parses inert inline/scoped `setvar` statements. It preserves spelling, literal values, whitespace, Unicode, comments, source order, and UTF-16 offsets. Duplicate variables, unknown namespaces, ambiguous/nested executable values and unsupported data layouts are rejected. It never executes macros or computes a Vex selection.

`features/vex-library/store.js` provides dependency-injected capture, read-back, exact selected-statement retrieval and guarded restoration. The default transport uses the authenticated ST user's `/api/files/upload` endpoint and current `/user/files/` route, matching the recipe/cold-source storage approach. Legacy `/files/` references remain readable for compatibility. Sources and an offset-only manifest use SHA-256-addressed `nemo-vex-source-*.json` files. Reads are same-origin, reject redirects, have finite timeouts, and enforce UTF-8 byte limits while consuming streamed responses. Writes return references only after verification. No files are automatically deleted and no whole-library cache is retained.

Retrieval accepts an explicit list of variable names, validates it against the manifest, reads only banks containing requested fields, and returns their exact original setter strings in source order. Choosing that list belongs to the Stage 4B adapter, not this storage module. Full originals can be restored into a separate export/test copy. Restoration refuses to replace unexpected library edits, and preserves other prompts, bank metadata, ordering and extension fields.

The source is snapshotted before asynchronous writes so a concurrent edit cannot change the capture halfway through. A failed write/read leaves the supplied preset untouched. Snapshot storage alone is not permission to evict the running preset; the validated adapter owns that operation.

## Delivery boundary

PR #24 made no changes to `content.js`, `manifest.json`, existing runtimes, selectors/resolvers, shipped presets or DOM. Its 45 standalone tests exercise the source layer directly. Stage 4B adds the client integration separately and updates only the former dormant-entrypoint assertion to check that storage remains behind the adapter. The source parser/store and the rest of the storage tests are preserved.

The earlier whole-stage PR #23 / `perf/stage4-vex-libraries` remains historical reference, not a wholesale merged implementation.

## Storage validation

```sh
node --test tests/vex-library-storage.test.js
node scripts/validate-vex-storage.mjs /path/to/Nemo_Engine_v12_Full.json
node --test tests/*.test.js
```

The standalone verifier uses a temporary filesystem-backed transport, not a live ST server. It verifies every original setter with an independent literal scan, reloads through fresh store instances, restores the full preset exactly from temporary placeholders, and checks input/export-copy immutability. Only hashes, counts and booleans are reported. It neither prints nor uploads preset prose. The real user preset is not committed as a fixture.

The tested Full source has five banks, 4,378 assignments, 690,239 UTF-16 code units and 691,454 UTF-8 bytes. All statements and the complete JSON round trip passed this verifier; both saved profile orders and extension fields stayed unchanged. Lite and Tavo contain no matching bank layout. This establishes storage fidelity, not native ST family-selection semantics or measured browser speedup. Stage 4B's additional parity/integration evidence is documented separately.
