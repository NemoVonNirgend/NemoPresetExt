# Large-preset performance: five-stage tracker

Track implementation as **stage/5**, not as equal effort or measured speedup. Automated tests and native browser validation are separate statuses. Stage 4 was split into two independently tested deliveries; both halves are now implemented.

| Stage | Scope | Implementation | Native ST browser validation |
| --- | --- | --- | --- |
| **1/5** | Import-time writing-recipe extraction, durable server storage, selected loading, portable export | Shipped in 6.0.1, PR #20 | Pending |
| **2/5** | Shared metadata index, conservative comment views, asynchronous prompt-text search | Shipped in 6.0.2, PR #21 | Pending |
| **3/5** | Durable disabled-prompt bodies, hydration before enable/edit, preserved edits and exports | Shipped in 6.0.3, PR #22 | Pending |
| **4A/5 (1/2)** | Inert Vex source parser, verified storage, exact retrieval/restoration | Merged in PR #24 | Covered by 4B adapter; native testing pending |
| **4B/5 (2/2)** | Selected Vex loading, native preparation and import/export composition | Implemented in 6.0.4 | Pending |
| **5/5** | Open/visible-section rendering, targeted rows, fewer observers and lazy drag/drop | Next | Not started |

Progress: **4/5 implementation stages complete**, with native ST validation still pending. The next implementation stage is **5/5**. Closing a section does not yet unload its DOM rows. Export your current configuration portable before reimporting Full after update/reload to activate Vex compaction without losing edits.

## Stage 2/5 boundaries

The shared metadata facade preserves the original directive language, including metadata later in a prompt. Source revisions invalidate cached projections; source-object/ID indexes replace large prompt-body keys. Default search is metadata-only, with an explicit worker-based prompt-text search, bounded 65,536-code-unit uploads, a 32 Mi-code-unit index, stale result protection and idle cleanup. Worker failures are explicit, without a synchronous full-preset fallback. External recipe files and the separate saved archive are not silently indexed. Generation-only comment views are conservative; nested macros, variables, scoped control flow and source-sensitive operations remain native. Stored source and exports are unchanged. No additional observer was introduced.

## Stage 3/5 boundaries

Ordinary eligible prompt bodies are saved to verified SHA-256-addressed ST server files, not solely browser cache. Enabled prompts and editors are hydrated before use. Disabled bodies are evicted after verified saves; failed writes keep the full edit resident. Lightweight metadata shells preserve directive validation. Native synchronous lookup contracts remain synchronous. Cold hydration precedes recipe and Vex preflight, while portable exports restore sources in a separate copy. Worker search can read cold bodies without hydrating the active preset. Missing/corrupt required source blocks generation/export. System/quick fields, markers, initializer libraries and oversized records remain outside ordinary-prompt storage. See [cold-source usage and tests](COLD_PROMPTS.md).

## Stage 4A/5 and 4B/5

The Stage 4A source layer remains inert: it owns literal parsing, verified source capture, exact explicitly requested setters, and guarded copy restoration. It does not itself register events or compute a Vex selection. See [the original storage foundation](VEX_STORAGE.md).

Stage 4B connects that same layer to the client. Supported reset/resolver/assembler bodies are fingerprinted; selectors and original control programs are preserved. Isolated dependency discovery identifies required original assignments without touching chat variables or unrelated macros. Native preparation executes those assignments at the original bank slots, followed by the original resolver/assembler, with raw selection, route and completion guards. One prepared route and a bounded scalar/offset catalog are retained, not whole source banks. Late selection changes and unsupported programs fail explicitly. Full/partial export restores source alongside Stages 1 and 3. Runtime initialization and cleanup maintain reverse wrapper ownership.

This is the split implementation replacing the older unmerged whole-stage PR #23, not a wholesale merge of that attempt. Literal data edits remain exact; unknown control-program edits are refused by the optimized adapter. Lite/Tavo have no matching Vex library. See [runtime usage, backup requirements and validation](VEX_RUNTIME.md).

## Validation and diagnostics

```sh
node --test tests/*.test.js
node scripts/validate-metadata-preset.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-cold-preset.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-vex-storage.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-vex-runtime.mjs /path/to/Nemo_Engine_v12_Full.json --exhaustive
```

Stage 4B adds controller/storage boundary tests and combined recipe/cold/Vex integration tests. The real Full verifier passed 38,988 restricted-program parity cases: all 38,400 family configurations, all 164 family masks, 128 independent combinations alone and with a council, reversed selection order and ambient state. Both saved profiles retain exact selected setters. Exact portable JSON round trip, fresh filesystem-backed restoration, and source/export-copy immutability pass. These are not native macro-engine execution or measured ST latency. User preset prose is neither printed nor committed.

```js
window.NemoPromptPerformance?.getStats()
window.NemoColdPrompts?.getStats()
window.NemoVexRuntime?.getStats()
```

Native checks remain required in Classic 3.4, Modern and Classic+: search/edit/toggle, preset changes, normal/swipe generation, family singles/masters/councils, independent Vexes, portable/partial export and missing-source recovery. Record browser timings separately. Stage 5 must preserve source order, enable state, drag/drop and edit behavior while reducing DOM work.
