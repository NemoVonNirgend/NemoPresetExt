# Large-preset performance: five-stage tracker

Track implementation as **stage/5**, not as an estimate of equal effort or measured speedup. Automated validation and native browser validation are separate statuses. Changes are implemented and reviewed on stage-specific branches before merging. Stage 4 is now split into two independently testable halves; the overall plan still has five stages.

| Stage | Scope | Implementation | Native ST browser validation |
| --- | --- | --- | --- |
| **1/5** | Import-time writing-recipe extraction, durable server-side source storage, selected-recipe loading, portable export | Shipped in 6.0.1, PR #20 | Pending |
| **2/5** | Shared metadata index, conservative comment views, asynchronous prompt-text search | Shipped in 6.0.2, PR #21 | Pending |
| **3/5** | Durable disabled-prompt body storage; hydrate before enable/edit, preserve edits, safe export | Shipped in 6.0.3, PR #22 | Pending |
| **4A/5 (1/2)** | Inert Vex source parser, durable storage, exact retrieval/restoration tests | Implemented as a dormant foundation; no live hooks | Adapter pending in 4B |
| **4B/5 (2/2)** | Selected-Vex dependency loading, import/export hooks and integration with Stages 1-3 | Next; earlier whole-stage PR #23 remains unmerged | Pending |
| **5/5** | Visible/open-section rendering, targeted row updates, reduced observers and lazy drag/drop | Not started | Not started |

Progress: **3/5 complete, plus the first half of Stage 4**. Next: **4B/5**, not 5/5. Validate the first three stages in ST as well; automated contracts are not a substitute for that smoke test. Eligible disabled ordinary prompts now become metadata shells with durable source references. Vex banks remain resident until the 4B adapter is completed. Closing a section does not yet unload its DOM rows. Stage 4A requires no reimport and leaves the runtime version at 6.0.3.

## Stage 2/5 implementation boundaries

- `features/directives/prompt-directive-rules.js` preserves the existing directive language and validation implementation. The public `prompt-directives.js` module delegates those rules through a metadata-only facade.
- Metadata is extracted once per source revision. WeakMap records and lightweight ID/length indexes let existing string callers reuse the source-owned record without hashing a multi-megabyte string as a Map key. Unowned small editor strings use a bounded compatibility cache.
- Do not truncate metadata at 4/8/16 KiB. Existing directives after ordinary prompt text, inside control scaffolds or at the end still participate. A cold source needs one scan; warm lookups do not rescan its body.
- Default active-preset search covers names, identifiers, categories, tags, groups, badges and tooltips. **Search prompt text** opts into a lazily created module Worker. Upload chunks are at most 65,536 UTF-16 code units, yielding between chunks. Only changed bodies are uploaded. Stale queries cannot publish results.
- The worker retains folded text up to 32 Mi code units and releases its index on preset/UI replacement, closing text search, clearing the query, teardown, or after 60 seconds idle. Failure, timeout or browser/CSP blocking is shown explicitly; only metadata matches are displayed in that case. There is no hidden synchronous whole-body fallback.
- Full-text search here means prompt records in the active preset manager, not Stage 1's external recipe database or the separately saved prompt archive. Those are separate data sources.
- Safe comment elision is generation-only, bounded to small plain-text/comment/trim fields. Stored bodies, metadata, regexes and exports remain unchanged. Nested syntax, variables, custom macros, conditional/scoped control flow, literal brace joins and `pick` are left to ST. This is deliberately not a universal comment-stripping regex.
- No new MutationObserver is added for search controls. The existing prompt-manager UI creation boundary installs them. Broader UI observer and rendering work belongs to **5/5**.

## Stage 3/5 implementation boundaries

- Source bodies are written to SHA-256-addressed files on the authenticated ST server and verified before replacement. Browser cache is not the only source of truth.
- Preserve enabled bodies, pin active editors, hydrate before enable/edit/generation, and evict disabled bodies after verified saves. A failed edit write retains the complete text for normal saving.
- Keep metadata in lightweight shells so existing directive validation remains available without loading the original prose. Do not change native synchronous lookup contracts.
- Await hydration before the Stage 1 recipe preflight reads selector strings. Compose both portable export restorers without inflating the active preset.
- Worker text search reads cold source without hydrating it into ST, and retains only a lightweight reference in its main-thread bookkeeping for cold entries.
- Missing/corrupt required files block generation; missing source blocks portable export. Account for ST swallowing event-handler exceptions.
- Existing system/quick fields, markers, `nemo-init-*` libraries, the recipe slot and oversized records remain native. Vex databases and DOM rows are still Stages 4/5 and 5/5.

See [Stage 3 storage, usage, backup requirements and smoke tests](COLD_PROMPTS.md).

## Stage 4 split: storage first, live adapter second

**4A/5 (1/2)** snapshots only the five Vex source banks, parses literal setters without execution, stores verified immutable sources plus an offset index, retrieves exact requested setters, and restores source into a guarded separate copy. No active-preset replacement, event subscription, ST variable mutation, runtime version bump or new DOM observer occurs. The earlier attempt is kept for reference rather than merged wholesale. See [Stage 4A source-storage scope and tests](VEX_STORAGE.md).

**4B/5 (2/2)** must validate supported reset/resolver/assembler programs, determine the required Vex fields, inject exact original setters at native preparation, and compose import/export with cold prompts and writing recipes. Family collapse, standalone independence and original selection order must survive unchanged. Unsupported source, missing/corrupt files and late state changes must be explicit failures. Source fidelity in 4A is not a substitute for these integration/semantic tests.

## Validation and diagnostics

Run `node --test tests/*.test.js`. The metadata tests include parity against the unchanged rule implementation, source-revision invalidation, bounded caches, worker failures, real worker-thread execution, stale-query rejection, nested section visibility, and non-mutating comment views. Existing Stage 1 regression tests remain in the full suite. Stage 3 adds durable read-back/round-trip tests, missing/corrupt storage guards, edited/empty source preservation, race handling, toggle/editor/archive boundary tests, and combined Stage 1/2/3 integration tests. Stage 4A adds standalone source-parser/storage tests only; live Vex semantics and integration remain in 4B.

For local portable presets:

```sh
node scripts/validate-metadata-preset.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-cold-preset.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-vex-storage.mjs /path/to/Nemo_Engine_v12_Full.json
```

These reports measure source-processing/storage invariants, not ST browser latency or LLM token savings. No preset prose is printed or uploaded by the scripts.

Browser diagnostics:

```js
window.NemoPromptPerformance?.getStats()
window.NemoColdPrompts?.getStats()
```

There is no Stage 4A browser API because the foundation is not connected to the running client. Check Classic 3.4, Modern and Classic+ in a running ST client: metadata/text search, clear, nested categories, edits, preset switches, import/export and a real generation. Record browser timings separately; contract tests are not a substitute for that smoke test.
