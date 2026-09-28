# Large-preset performance: five-stage tracker

Track implementation as **stage/5**, not as equal effort or measured speedup. Automated tests and native browser validation are separate statuses. Stages 4 and 5 are split into two independently testable deliveries; the overall plan still has five stages.

| Stage | Scope | Implementation | Native ST browser validation |
| --- | --- | --- | --- |
| **1/5** | Import-time writing-recipe extraction, durable server storage, selected loading, portable export | Shipped in 6.0.1, PR #20 | Pending |
| **2/5** | Shared metadata index, conservative comment views, asynchronous prompt-text search | Shipped in 6.0.2, PR #21 | Pending |
| **3/5** | Durable disabled-prompt bodies, hydration before enable/edit, preserved edits and exports | Shipped in 6.0.3, PR #22 | Pending |
| **4A/5 (1/2)** | Inert Vex source parser, verified storage, exact retrieval/restoration | Merged in PR #24 | Covered by 4B adapter; native testing pending |
| **4B/5 (2/2)** | Selected Vex loading, native preparation and import/export composition | Shipped in 6.0.4, PR #25 | Pending |
| **5A/5 (1/2)** | Incremental native row/frame rendering, coalesced organization and scoped observer | Implemented in 6.0.5; real Chromium harness passes | Live ST pending |
| **5B/5 (2/2)** | Closed-section row virtualization; adapt snapshots, trays, movement, bulk controls and lazy section drag/drop | Next | Not started |

Progress: **4/5 complete plus the first half of Stage 5**. Next: **5B/5**, not a completed 5/5 release. Closing a section still does not unload its DOM rows. Stage 5A requires update/reload only, not preset reimport. To activate earlier source-compaction stages, export the current configuration portable before reimporting after update/reload. Native ST validation remains pending independently of implementation progress.

## Stage 2/5 boundaries

The shared metadata facade preserves the original directive language, including metadata later in a prompt. Source revisions invalidate cached projections; source-object/ID indexes replace large prompt-body keys. Default search is metadata-only, with an explicit worker-based prompt-text search, bounded 65,536-code-unit uploads, a 32 Mi-code-unit index, stale result protection and idle cleanup. Worker failures are explicit, without a synchronous full-preset fallback. External recipe files and the separate saved archive are not silently indexed. Generation-only comment views are conservative; nested macros, variables, scoped control flow and source-sensitive operations remain native. Stored source and exports are unchanged. No additional observer was introduced.

## Stage 3/5 boundaries

Ordinary eligible prompt bodies are saved to verified SHA-256-addressed ST server files, not solely browser cache. Enabled prompts and editors are hydrated before use. Disabled bodies are evicted after verified saves; failed writes keep the full edit resident. Lightweight metadata shells preserve directive validation. Native synchronous lookup contracts remain synchronous. Cold hydration precedes recipe and Vex preflight, while portable exports restore sources in a separate copy. Worker search can read cold bodies without hydrating the active preset. Missing/corrupt required source blocks generation/export. System/quick fields, markers, initializer libraries and oversized records remain outside ordinary-prompt storage. See [cold-source usage and tests](COLD_PROMPTS.md).

## Stage 4A/5 and 4B/5

The Stage 4A source layer remains inert: it owns literal parsing, verified source capture, exact explicitly requested setters, and guarded copy restoration. It does not itself register events or compute a Vex selection. See [the original storage foundation](VEX_STORAGE.md).

Stage 4B connects that same layer to the client. Supported reset/resolver/assembler bodies are fingerprinted; selectors and original control programs are preserved. Isolated dependency discovery identifies required original assignments without touching chat variables or unrelated macros. Native preparation executes those assignments at the original bank slots, followed by the original resolver/assembler, with raw selection, route and completion guards. One prepared route and a bounded scalar/offset catalog are retained, not whole source banks. Late selection changes and unsupported programs fail explicitly. Full/partial export restores source alongside Stages 1 and 3. Runtime initialization and cleanup maintain reverse wrapper ownership.

This is the split implementation replacing the older unmerged whole-stage PR #23, not a wholesale merge of that attempt. Literal data edits remain exact; unknown control-program edits are refused by the optimized adapter. Lite/Tavo have no matching Vex library. See [runtime usage, backup requirements and validation](VEX_RUNTIME.md).

## Stage 5A/5 and 5B/5

The current DOM code uses all prompt rows for snapshots, master toggles, tray membership, navigation and drag/drop ordering. Removing rows without adapting those consumers could lose state or truncate prompt order. **5A** therefore reduces repeated rendering first while leaving the complete row list intact. It reuses unchanged native frames and rows, generates only changed rows with the original native renderer, scopes the optional observer to the sidebar, coalesces organization calls, and avoids replacing an active drag. A checkbox allows immediate native fallback. Tray and unsupported layouts remain native.

**5B** will implement actual closed-section row removal and restore-on-open, together with state-based snapshot/bulk/movement logic and lazy section drag/drop. This remains unfinished. See [5A behavior, boundaries, diagnostics and browser tests](PROMPT_RENDERING.md).

## Validation and diagnostics

```sh
node --test tests/*.test.js
node scripts/validate-metadata-preset.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-cold-preset.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-vex-storage.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-vex-runtime.mjs /path/to/Nemo_Engine_v12_Full.json --exhaustive
node scripts/validate-prompt-rendering.mjs
```

Stage 4B's recorded Full verifier passed 38,988 restricted-program parity cases: all 38,400 family configurations, all 164 family masks, 128 independent combinations alone and with a council, reversed selection order and ambient state. Both saved profiles retain exact selected setters, with exact portable JSON round trip and fresh filesystem-backed restoration. This is not native macro-engine execution. User preset prose is neither printed nor committed.

Stage 5A adds 25 Node unit/wiring tests and a Node wrapper for 24 real Chromium boundary cases. The synthetic 764-row harness checks zero row creation across 25 unchanged redraws and one row for one toggle, retaining every ordered row. The browser host is injected and native-shaped, not a running ST installation; no end-to-end latency or memory claim is made.

```js
window.NemoPromptPerformance?.getStats()
window.NemoColdPrompts?.getStats()
window.NemoVexRuntime?.getStats()
window.NemoPromptRendering?.getStats()
```

Native checks remain required in Classic 3.4, Modern and Classic+: search/edit/toggle, preset changes, normal/swipe generation, family singles/masters/councils, independent Vexes, portable/partial export, missing-source recovery, snapshots and drag/drop. Record browser timings separately. A passing Chromium harness does not replace those full-client checks.
