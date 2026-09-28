# Stage 5B.2A/5: canonical prompt-state mutations

Stage 5B.1 moved read-side snapshot capture onto native ordered state. Stage 5B.2 is now split into two smaller mutation/consumer deliveries. **5B.2A** moves snapshot application/restoration, section counts and section master toggles off rendered prompt rows. **5B.2B** remains responsible for tray membership, Prompt Navigator discovery and prompt movement/reordering. **5B.3** remains the point where closed-section rows may actually be removed.

The runtime manifest remains 6.0.5 during this continuation. Update/reload is sufficient; no preset reimport is required for Stage 5B.2A.

## State action adapter

`state-actions.js` wraps only state-dependent Nemo Prompt Manager consumers. On Chat Completion it reads the active native prompt order through the Stage 5B state model and mutates entries by stable prompt identifier. Other APIs retain the legacy handlers.

Snapshot application and cross-preset restoration no longer enumerate rendered rows or click toggle buttons. Empty saved states remain valid. The pure snapshot planner is re-read between reconciliation passes so dependency changes and automatic conflict resolution cannot leave the adapter working from stale metadata. Locked prompts and cancelled conflict choices stop reconciliation rather than looping or silently forcing a state.

Before enabling a stored cold prompt, the action adapter uses the existing Stage 3 `withBody` boundary. Directive validation therefore sees the original source, not a metadata shell. Existing directive conflict UI remains authoritative for choices that require user input. Supported automatic directive resolution is applied alongside the requested target state and persisted through the native save path.

Each mutation checks native toggle permission, clears the native token-count cache for changed prompts, brackets rendering/saving with the existing Nemo toggle lifecycle, and awaits `saveServiceSettings()`. If that save fails, only changes staged by the adapter are rolled back. Preset/profile changes during asynchronous hydration, conflict UI or save are rejected before the new selection can be mutated.

## Section controls without child rows

Section direct/aggregate counts use `buildSectionIndex()` and the stable identifier on the section header. They no longer count visible toggle buttons or require ordinary prompt rows to be present. The existing divider classifier remains authoritative, including custom divider patterns.

The section master toggle likewise resolves recursive membership from canonical ordered state and applies the requested state by identifier. A section can therefore contain only its header/content shell in DOM and still report counts and toggle its members correctly. This is a prerequisite for Stage 5B.3 virtualization, but this delivery does not remove any rows itself.

## Scope intentionally left for later

- Tray caches, cards, bulk tray operations and tray drag/drop remain the Stage 5B.2B paths.
- Prompt Navigator listing, header discovery and movement remain DOM-based until Stage 5B.2B.
- `movePromptBelowHeader` and other prompt-order movement consumers are unchanged.
- No rows are detached, removed or recreated.
- No new observer, tokenizer, macro, generation, network or source-storage hook is installed.
- Incremental rendering and its opt-out remain independent of these state actions.

## Validation and diagnostics

```sh
node --test tests/prompt-state-actions.test.js tests/prompt-state-runtime.test.js
node --test tests/prompt-state*.test.js
node --test tests/*.test.js
```

The Stage 5B.2A action suite covers DOM-independent snapshot application, deliberately empty snapshots, locked prompts, cold-source hydration before directive validation, cancellation, automatic directive resolution, native-save rollback, stale preset switches, metadata section counts, a section master toggle with no child prompt rows, empty restoration, non-Chat-Completion fallback and reversible teardown.

The repository-wide suite passes **345 tests with zero failures or skips** on the implementation snapshot. JavaScript syntax, relative-import and stylesheet/encoding audits also pass. These are contract/injected-runtime checks, not a live SillyTavern performance benchmark.

```js
window.NemoPromptRendering?.getStats().actions
```

The action statistics report requested mutations, native saves, automatic-resolution mutations, locked/cancelled changes, section reads, master toggles, reconciliation passes and failures. `virtualized` remains `false` until Stage 5B.3.
