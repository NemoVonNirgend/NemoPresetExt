# Stage 4A/5: Vex source storage foundation

Stage 4/5 is split into **4A/5 (1/2)** and **4B/5 (2/2)**. This delivery contains 4A only. It is not a completed live Vex optimization, and does not advance the whole plan to 4/5 complete.

## What is implemented

`features/vex-library/format.js` recognizes the five known Vex bank IDs alongside the reset/resolver/assembler IDs, snapshots only those banks, and parses inert inline/scoped `setvar` statements. It preserves spelling, literal values, whitespace, Unicode, comments, source order, and UTF-16 offsets. Duplicate variables, unknown namespaces, ambiguous/nested executable values and unsupported data layouts are rejected. It never executes macros or computes a Vex selection.

`features/vex-library/store.js` provides dependency-injected capture, read-back, exact selected-statement retrieval and guarded restoration. The default transport uses the authenticated ST user's `/api/files/upload` and `/files/` paths, matching the existing recipe/cold-source storage approach. Sources and an offset-only manifest use SHA-256-addressed `nemo-vex-source-*.json` files. Reads are same-origin, reject redirects, have finite timeouts, and enforce UTF-8 byte limits while consuming streamed responses. Writes return references only after verification. No files are automatically deleted and no whole-library cache is retained.

Retrieval accepts an explicit list of variable names, validates it against the manifest, reads only banks containing requested fields, and returns their exact original setter strings in source order. **Choosing that list from active Vex selectors is deliberately not implemented here.** Full originals can be restored into a separate export/test copy. Restoration refuses to replace unexpected library edits, and preserves other prompts, bank metadata, ordering and extension fields.

The source is snapshotted before any asynchronous writes so a concurrent edit cannot change the capture halfway through. A failed write/read leaves the supplied preset untouched. Snapshot storage is not permission to evict the running preset; that requires the validated adapter in 4B.

## What does not change yet

- No import, generation, selection, editor, export, tokenizer, cache or DOM hooks are installed.
- `content.js`, existing runtimes, selectors/resolvers, shipped presets and `manifest.json` remain unchanged. The extension runtime version remains **6.0.3** for this dormant foundation.
- Installed Full presets do not automatically unload Vex banks. No reimport is needed to receive this half, and no new compact preset is distributed by it.
- Stage 1 writing recipes, Stage 2 metadata/search and Stage 3 cold prompts remain the active implementation.
- The earlier whole-stage attempt in PR #23 / `perf/stage4-vex-libraries` is preserved as reference, not merged wholesale. Its runtime code still needs review and adaptation for 4B.

## Validation

```sh
node --test tests/vex-library-storage.test.js
node scripts/validate-vex-storage.mjs /path/to/Nemo_Engine_v12_Full.json
node --test tests/*.test.js
```

The standalone verifier uses a temporary filesystem-backed transport, not a live ST server. It verifies every original setter with an independent literal scan, reloads through fresh store instances, restores the full preset exactly from temporary test placeholders, and checks input/export-copy immutability. Only hashes, counts and booleans are reported. It neither prints nor uploads preset prose. The real user preset is not committed as a test fixture.

The current Full source contains five banks, 4,378 assignments, 690,239 UTF-16 code units and 691,454 UTF-8 bytes. All 4,378 statements and the complete JSON round trip passed this verifier; both saved profile orders and extension fields stayed unchanged. Lite and Tavo contain no matching bank layout and are left untouched. This proves source/storage fidelity, **not family-selection parity, native macro-engine behavior, or measured browser speedup**.

## Next: Stage 4B/5

Add the validated runtime boundary: recognize supported control programs, derive the exact required fields without changing selection/family semantics, coordinate with cold prompt hydration and recipe preflight, and connect import/export and synchronous native preparation. Missing/corrupt data, unknown programs and late selection changes must block rather than silently produce a different council. Existing stage composition and live-browser smoke tests belong to that half. Stage 5/5 remains DOM/rendering optimization.
