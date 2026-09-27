# Nemo v12 performance, stage 1: import-time writing-recipe offload

Status: experimental review branch. Do not describe this as a measured native-ST performance release.
Base: NemoPresetExt main `47a9aeafc315001cd5b06d554923f34bdca5ac76`.
Host API review: SillyTavern release `06bde939fb1e9c4c8d8641d810f0a916b5bce127`.

## Scope

This stage externalizes the **writing-recipe bank only**. Vex libraries, ordinary prompt bodies,
canonical planning, user-role/autonomy controls, regex rules, UI modes, and DOM rendering are not
rewritten. Lite, Tavo, and unrelated non-recipe presets pass through unchanged.

The raw portable file remains the distribution format. With this branch installed, use ST's normal
Chat Completion preset **Import** file picker. The extension captures the file input before ST's
native handler, sends the File to a module Worker, and identifies the known bank grammar by structure,
not filename. JSON parsing, extraction, hashing, and archive upload occur in that worker. Only the
small transformed file is returned to ST's normal importer. Its endpoint/proxy warning and preset
name-overwrite confirmation still run.

Why capture earlier than `OAI_PRESET_IMPORT_READY`? That event comes after native JSON parsing, and
ST's event dispatch is not a reliable cancellable transaction. A rejected listener must not be the
only thing stopping a partially transformed import. On the captured file-input route, failed
validation/storage means the native importer is **not resumed**.

Other programmatic import routes and pre-existing already-saved raw Full presets are not automatically
migrated in this stage. Re-import the portable file through the normal preset picker after installing
the branch. A full file already loaded before the extension starts can still cause the old stall.

## Storage and correctness

* 106 bank prompts and 17 bank-only headings are extracted from the current fixture. Their references
  are removed from both prompt-order profiles. Ordinary definitions, order, and enablement remain.
* 17 immutable per-genre JSON archives are written through ST's authenticated `/api/files/upload`.
  Every archive is read back and verified with SHA-256 before the transformed preset is released.
* Archives keep exact original prompt objects and character-offset indexes into literal recipe values.
  Source comments and whitespace survive portable export. No corpus regeneration or embedded `eval`
  is used. The codec supports both literal `setvar` and the existing literal scoped `#setvar` recipe.
* The saved preset contains archive references, export-layout information, and a tiny resolver marker.
  It does not contain the extracted bodies. Browser cache/IndexedDB is not the authoritative store.
* The original small selectors and index still execute normally. Preflight uses literal selection
  hints only to prefetch candidate partitions; **actual ST variables** determine the exact final key.
  One recipe body is substituted at the existing resolver slot and sent through ordinary preparation.
  No unused recipe `setvar` calls run, and no full recipe corpus enters the model-tokenizer path.
* Current/default candidate partitions are warmed before dry-run counting and supported real-generation
  preflight. Normal memory caching is byte-bounded with current selection pinning during trimming.
  It is a per-genre cache, not one file/request per recipe and not full-library eager loading.

Archive paths are restricted to same-origin ST user-file paths with the expected content-addressed
filename. Redirects, traversal, arbitrary external URLs, corrupt lengths/hashes, and wrong schemas
are rejected. Library files belong in ST server backups alongside the slim preset.

A failed/cancelled import can leave unreferenced immutable archive files. Stage 1 does not garbage
collect or delete them automatically, because another preset may share those hashes.

## Runtime boundaries and failure behavior

The adapter wraps `preparePrompt` only for the known external resolver in an optimized preset. It does
not convert `getPromptById` or any synchronous ST API into an asynchronous API. `tryGenerate` supplies
an async warmup for dry-run counts. The manifest's supported `generate_interceptor` provides an
abortable preflight for actual generation. Unexpected missing partition data during preparation
requests host generation cancellation and raises an error, rather than emitting a silent empty recipe.
The latter host-cancellation path still needs native-ST smoke validation.

Unknown/custom bank instructions, nested executable recipe macros, disabled or reordered data banks,
custom resolver bodies, missing required setup, duplicate IDs, and direct recipe-storage reads in other
preset prompts are refused rather than partially optimized. The source file is never rewritten.
Direct `NP...` reads from external character cards, lorebooks, or third-party scripts are not a supported
interface for the optimized bank. Such custom integrations should retain portable mode.

On the native preset Export button, all archives are verified before the native export handler resumes.
`OAI_PRESET_EXPORT_READY` reconstructs a self-contained portable COPY, retaining native endpoint
redaction and ordinary edits. The live/saved slim preset is not re-expanded. Failed native preflight
blocks that export. A non-native caller that bypasses the button and encounters an export failure
receives an explicitly marked **error document**, not an apparently usable incomplete preset, because
ST may swallow export-event exceptions.

The optimized shell requires the extension and its archive files. Do not distribute it as a portable
preset. Keep the original file for recovery and use the normal preset Export button for sharing.
Prompt-only exports/third-party import-export paths require further integration; use whole-preset
portable export for stage-1 optimized presets.

## Controls and diagnostics

Automatic offload defaults on for structurally supported imports on this experimental branch.
`extension_settings.NemoPresetExt.enableRecipeOffload = false` disables interception of future imports;
it does not remove support required by already-optimized presets. This is a developer switch, not yet
an added settings-panel checkbox.

`window.NemoRecipeRuntime.stats()` reports cached archive byte counts and the most recent import's
counts. These are serialized source bytes, **not** browser heap measurements. The runtime API also
exposes `prepare(preset, generationType)` and `exportPortable(preset)` for integration testing.

Worker/module support, DataTransfer, a secure context for Web Crypto (HTTPS or localhost), and the
reviewed ST variable API are required. This is not a blanket guarantee for every ST version/fork.

## Validation

```
node --test tests/recipe-*.test.js
NEMO_FULL_FIXTURE=/path/to/Nemo_Engine_v12_Full.json node --test tests/recipe-*.test.js
python tests/recipe-browser-smoke.py --preset /path/to/Nemo_Engine_v12_Full.json
```

The optional full-fixture tests compare every recipe against an independent literal-assignment
extractor and deep-compare the complete portable round trip. They do not upload the user's preset
corpus to this repository. The actual worker module is also exercised with Node worker_threads,
bridging browser messaging and HTTP to test doubles. ST lifecycle tests use mocked host contracts.

The Python smoke runner uses Chromium and an ST-contract **test host**, not a full SillyTavern install.
It could not run in the implementation container because Chromium blocked its local URL with
`ERR_BLOCKED_BY_ADMINISTRATOR`. It remains a pending smoke test, not a passed check.

Measured current fixture:

| Measurement | Result |
| --- | ---: |
| Source prompts | 764 |
| Optimized prompts | 641 |
| Exact recipes | 12,852 |
| Genre archives | 17 |
| Original distributed JSON | 28,712,876 bytes |
| Original compact JSON | 28,469,605 bytes |
| Optimized compact JSON | 3,918,970 bytes |
| Optimized pretty JSON | 4,172,176 bytes |
| Existing regex scripts | 631, unchanged |

Both compact sizes use the same serializer. The source and optimized files should not be compared
as a browser-latency benchmark. The current file contains 12,851 inline recipe assignments **plus one
scoped assignment**, which is why the verified total is 12,852.

Native-ST checklist before promotion: import in a populated chat, first count, generation, model change,
all genre/author/style toggles, swipe/continue, rapid preset switches, reload, two browser tabs, missing
archive, canceled import/export, portable export/re-import, and existing UI-mode compatibility. Record
main-thread long tasks, heap, and network sizes before asserting speedups. The inherited complete
extension test suite must run in CI or a full checkout as well.

## Following stages

1. Validate this stage in native ST and externalize Vex static data with its own exact codec.
2. Cold-store ordinary disabled prompt bodies, keeping UI metadata separate and making edit/enable/
   save/export hydration explicit and durable.
3. Optimize metadata/search caches and render only visible/open prompt sections; reduce observer and
   Sortable churn. Comment elision must preserve macro semantics, including seeded positional macros;
   it is not included as an untested global regex replacement here.
