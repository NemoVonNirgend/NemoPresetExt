# Stage 5B.1/5 (1/3): metadata state and snapshot capture

Stage 5A is already merged in PR #26 (runtime 6.0.5). The remaining 5B work is split into three smaller deliveries: **5B.1 state/read-side snapshots**, **5B.2 mutating controls and consumers**, and **5B.3 actual row virtualization and lifecycle**. This first delivery does not complete Stage 5 or unload any DOM rows. The runtime manifest remains 6.0.5 during this substep; update the extension's main branch and reload to receive it. No preset reimport is needed.

## Live behavior in this substep

`state-snapshots.js` replaces only `takeSnapshot`, `capturePromptStates`, and `checkExistingSnapshot` on the existing Nemo preset manager. On Chat Completion, capture reads the current native prompt order and native toggle permissions, not the rendered toggle buttons. It saves the existing ordered array-of-identifiers format, including a deliberately empty array. A missing or malformed native state reports an error instead of overwriting a good snapshot with a partial DOM selection. Other API modes retain their existing handlers.

The Apply button recognizes an empty snapshot as valid and synchronizes `aria-disabled`. A pending save cannot publish a success message or update the new preset's button after the user switches presets, API modes, or the adapter is disposed. Teardown restores only methods still owned by this adapter, without removing wrappers installed later.

**Applying/restoring a snapshot is still the old path.** Dependency validation, toggling, source hydration, generation, export, settings storage format, and automatic state-restoration enablement are not changed here. In particular, automatic cross-preset restoration is not turned back on. Mutating paths must be adapted and tested in 5B.2 before any rows are removed in 5B.3.

## Pure state model

`state-model.js` copies only identifiers, names, enabled flags and the native toggle-permission result. It never reads a prompt body, hydrates a cold source, or retains source objects/DOM nodes in its return values. Rows and section descriptors are frozen metadata snapshots; each read uses the current active profile rather than a potentially stale view.

The section index accepts the caller's existing divider classifier instead of inventing another set of header rules. It handles main sections, subheaders, orphan subheaders, empty sections and repeated display names by stable identifier. Direct and recursive membership and counts are available without a rendered row list. At this stage the model's count methods are pure helpers, not replacements for the live tray/section counters. Their enabled count represents rows that are both enabled and toggleable; locked/marker rendering differences must be reconciled explicitly at the consumer boundary in 5B.2.

A pure snapshot planner reports the desired changes, unknown saved identifiers and locked rows. It does not apply them. The later action adapter must retain dependency validation, cold-source hydration and race/error handling rather than treating this plan as permission to toggle directly.

## Scope left unchanged

- No rows removed, detached, hidden or recreated by this adapter.
- No new MutationObserver, tokenizer, macro, generation, network or source-storage hook.
- No change to the incremental renderer, native row markup, tray behavior, drag/drop, master toggles or navigation.
- No preset, recipe or Vex prompt source modified.
- The incremental-rendering checkbox still controls rendering only. Read-side snapshot correctness is independent of that performance switch.

## Tests and diagnostics

```sh
node --test tests/prompt-state.test.js tests/prompt-state-runtime.test.js
node --test tests/prompt-state-legacy.test.js
node --test tests/*.test.js
```

The first command runs 38 unit and injected-runtime tests, including missing DOM, cold-source getters that throw on access, two active profiles, invalid/duplicate orders, empty snapshots, permission failures, asynchronous storage, late preset switches and cleanup. The synthetic 764-row case performs 100 snapshot reads without touching prompt bodies. Three repository-contract tests use the actual existing divider and snapshot method implementations and check the intentionally unchanged mutation boundary. No user preset prose is included.

```js
window.NemoPromptRendering?.getStats().snapshots
```

The nested statistics report captures, metadata reads, failures and non-Chat-Completion fallbacks. They are operation counts, not a latency benchmark. The parent renderer's `virtualized` remains `false`. No live ST client or end-to-end performance benchmark is claimed for this substep. Existing Chromium harness results cover the previously merged 5A renderer, not new native-client coverage for this adapter.
