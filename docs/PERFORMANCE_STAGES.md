# Large-preset performance: five-stage tracker

Track implementation as **stage/5**, not as an estimate of equal effort or measured speedup. Automated validation and native browser validation are separate statuses. Changes are implemented and reviewed on stage-specific branches before merging.

| Stage | Scope | Implementation | Native ST browser validation |
| --- | --- | --- | --- |
| **1/5** | Import-time writing-recipe extraction, durable server-side source storage, selected-recipe loading, portable export | Shipped in 6.0.1, PR #20 | Pending |
| **2/5** | Shared metadata index, conservative comment views, asynchronous prompt-text search | Shipped in 6.0.2, PR #21 | Pending |
| **3/5** | Durable disabled-prompt body storage; hydrate before enable/edit, preserve edits, safe export | Shipped in 6.0.3, PR #22 | Pending |
| **4/5** | Externalize the remaining Vex static libraries without changing selection/family semantics | Implemented in 6.0.4 | Pending |
| **5/5** | Visible/open-section rendering, targeted row updates, reduced observers and lazy drag/drop | Next | Not started |

Next implementation stage: **5/5**. Validate the first four stages in ST as well; automated contracts are not a substitute for that smoke test. Eligible disabled ordinary prompt bodies become metadata shells with durable server-side source references. Five supported Vex library blocks are now externalized; native system/quick fields and other initializer libraries remain native. Closing a section does not yet unload its DOM rows. For complete import-time compaction, export the current configuration portable, then reimport after updating/reloading; the source JSON is unchanged.

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
- Existing system/quick fields, markers, `nemo-init-*` libraries, the recipe slot and oversized records stay outside ordinary-prompt storage. Vex libraries are handled separately by **4/5**; DOM rows remain **5/5**.

See [Stage 3 storage, usage, backup requirements and smoke tests](COLD_PROMPTS.md).

## Stage 4/5 implementation boundaries

- Keep the five Vex library IDs and ordering positions, but replace their bodies with explicit runtime stubs only after durable server storage and read-back succeed.
- Use the exact imported library, never a substitute bundled corpus. Full/partial portable exports restore source in the export copy, not the active preset.
- Keep the original selectors, reset, family/route resolver and assembler. A restricted dependency preflight reads only the fingerprinted Vex program in an isolated dictionary; it neither mutates ST variables nor executes unrelated prompt macros.
- Load only the required original setter statements into native preparation. Verify actual raw selection and native route variables before letting the unchanged assembler proceed.
- Retain one prepared route and a small scalar/dependency index. Source banks are read transiently, not kept as a settled full-corpus cache. Only verified Vex namespace variables are cleared when removing stale data.
- Reject unknown control fingerprints, custom library access, unsupported selector syntax, missing/corrupt storage and stale selection rather than guessing or using a different council.
- Compose with cold prompt hydration and the existing recipe runtime. This stage adds no DOM virtualization or new observers. Lite and Tavo have no matching Vex bank schema and are unchanged by this stage.

See [Stage 4 storage, native boundaries, validation and smoke tests](VEX_RUNTIME.md).

## Validation and diagnostics

Run `node --test tests/*.test.js`. Metadata tests include source-revision invalidation, bounded caches, worker execution, stale-query rejection and comment views. Stage 1 recipe and Stage 3 cold-storage regression tests remain in the full suite. Stage 4 adds literal parsing, dependency selection, verified storage, native-route guards, stale loads, partial exports, namespace isolation, lifecycle cleanup, and combined Stage 1/3/4 integration tests.

For local portable presets:

```sh
node scripts/validate-metadata-preset.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-cold-preset.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-vex-preset.mjs /path/to/Nemo_Engine_v12_Full.json --exhaustive
```

These reports measure source-processing/storage invariants, not ST browser latency or LLM token savings. No preset prose is printed or uploaded by the scripts. The Stage 4 Full validator covers all 38,400 resolved family configurations, 164 same-family selection masks, and 128 independent combinations in isolation and with a council. That is restricted-program parity validation, not execution inside ST's actual macro engine.

Browser diagnostics:

```js
window.NemoPromptPerformance?.getStats()
window.NemoColdPrompts?.getStats()
window.NemoVexRuntime?.getStats()
```

Check Classic 3.4, Modern and Classic+ in a running ST client: metadata/text search, clear, nested categories, edits, preset switches, import/export and a real generation. Also check Vex singles, family collapse, independent add-ons and changes between turns. Record browser timings separately; contract tests are not a substitute for that smoke test.
