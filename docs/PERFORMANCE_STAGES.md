# Large-preset performance: five-stage tracker

Track implementation as **stage/5**, not as an estimate of equal effort or measured speedup. Automated validation and native browser validation are separate statuses. Changes are implemented and reviewed on stage-specific branches before merging.

| Stage | Scope | Implementation | Native ST browser validation |
| --- | --- | --- | --- |
| **1/5** | Import-time writing-recipe extraction, durable server-side source storage, selected-recipe loading, portable export | Shipped in 6.0.1, PR #20 | Pending |
| **2/5** | Shared metadata index, conservative comment views, asynchronous prompt-text search | Implemented in 6.0.2 | Pending |
| **3/5** | Durable disabled-prompt body storage; hydrate before enable/edit, preserve edits, safe export | Not started | Not started |
| **4/5** | Externalize the remaining Vex static libraries without changing selection/family semantics | Not started | Not started |
| **5/5** | Visible/open-section rendering, targeted row updates, reduced observers and lazy drag/drop | Not started | Not started |

Next: **3/5**, after validating 2/5 in ST. Disabled ordinary prompt bodies are still resident in ST; this release does not claim otherwise. Closing a section does not yet unload its DOM rows. Recipe migration still requires a one-time reimport of a raw Full preset after updating/reloading; Stage 2 itself does not require reimport.

## Stage 2/5 implementation boundaries

- `features/directives/prompt-directive-rules.js` preserves the existing directive language and validation implementation. The public `prompt-directives.js` module delegates those rules through a metadata-only facade.
- Metadata is extracted once per source revision. WeakMap records and lightweight ID/length indexes let existing string callers reuse the source-owned record without hashing a multi-megabyte string as a Map key. Unowned small editor strings use a bounded compatibility cache.
- Do not truncate metadata at 4/8/16 KiB. Existing directives after ordinary prompt text, inside control scaffolds or at the end still participate. A cold source needs one scan; warm lookups do not rescan its body.
- Default active-preset search covers names, identifiers, categories, tags, groups, badges and tooltips. **Search prompt text** opts into a lazily created module Worker. Upload chunks are at most 65,536 UTF-16 code units, yielding between chunks. Only changed bodies are uploaded. Stale queries cannot publish results.
- The worker retains folded text up to 32 Mi code units and releases its index on preset/UI replacement, closing text search, clearing the query, teardown, or after 60 seconds idle. Failure, timeout or browser/CSP blocking is shown explicitly; only metadata matches are displayed in that case. There is no hidden synchronous whole-body fallback.
- Full-text search here means prompt records in the active preset manager, not Stage 1's external recipe database or the separately saved prompt archive. Those are separate data sources.
- Safe comment elision is generation-only, bounded to small plain-text/comment/trim fields. Stored bodies, metadata, regexes and exports remain unchanged. Nested syntax, variables, custom macros, conditional/scoped control flow, literal brace joins and `pick` are left to ST. This is deliberately not a universal comment-stripping regex.
- No new MutationObserver is added for search controls. The existing prompt-manager UI creation boundary installs them. Broader UI observer and rendering work belongs to **5/5**.

## Validation and diagnostics

Run `node --test tests/*.test.js`. The metadata tests include parity against the unchanged rule implementation, source-revision invalidation, bounded caches, worker failures, real worker-thread execution, stale-query rejection, nested section visibility, and non-mutating comment views. Existing Stage 1 regression tests remain in the full suite.

For a local portable preset, run:

```sh
node scripts/validate-metadata-preset.mjs /path/to/Nemo_Engine_v12_Full.json
```

The report measures source-processing work and invariants, not ST browser latency or LLM token savings. No preset prose is printed or uploaded by that script.

Browser diagnostics:

```js
window.NemoPromptPerformance?.getStats()
```

Check Classic 3.4, Modern and Classic+ in a running ST client: metadata search, the text checkbox, clear, nested categories, edits, preset switches, import/export and a real generation. Record browser timings separately; contract tests are not a substitute for that smoke test.
