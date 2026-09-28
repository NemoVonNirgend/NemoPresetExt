# Stage 5B.3/5: closed-section row virtualization

Version 6.0.6 completes the five-stage large-preset performance implementation. Stage 5A reduced repeated native redraw work, and Stages 5B.1 through 5B.2B moved stateful Prompt Manager consumers away from complete DOM residency. Stage 5B.3 is the final residency layer: closed sections no longer keep ordinary prompt rows alive in the DOM.

Update NemoPresetExt and reload SillyTavern. Stage 5B.3 does not require another preset reimport.

## Residency model

Section header rows and `<details>` shells remain materialized so section identity, labels, counters and open state stay available. Ordinary direct prompt rows inside a closed section are removed rather than hidden or retained as detached nodes.

Opening a section asks the existing Stage 5A renderer to generate only the required prompt rows through SillyTavern's original `renderPromptManagerListItems` contract. The virtualization controller decorates those native rows through the existing Nemo Prompt Manager hooks and inserts them in native order. Closing the section removes those row nodes again.

Nested sections follow ancestor visibility. An open child beneath a closed parent does not keep its ordinary rows resident. Top-level prompts outside sections remain resident because they do not have a section shell that can represent them while closed.

For supported presets below the existing 64-row optimization threshold, or when optimized rendering is disabled, full native residency is retained.

## Incremental rendering composition

Intentional missing rows are now valid rendering state. The Stage 5A incremental renderer receives the current residency set and compares only rows that are supposed to exist.

A visual change to a virtualized prompt updates canonical metadata without forcing its row back into the DOM. When that section later opens, the row is generated from current native state. A visual change to a resident prompt still regenerates only that live row.

Structural operations such as reorganization restore the complete native row set first. Legacy structure-building code therefore never infers saved order from a partial DOM. After organization completes, normal virtualization is reapplied.

No prompt body is read, copied or retained by the virtualization layer.

## Search

Metadata search computes matches before touching residency. The virtualization layer temporarily materializes only matching ordinary rows. `applySearchMatches()` can then reveal matched rows and their ancestor section shells normally.

When full prompt-text search completes, newly found identifiers are added to the same temporary residency set. Stale worker results retain the existing request guards.

Clearing search restores the user's normal section-open state and then reconciles residency, removing rows that were materialized only for search.

## Tray and accordion behavior

Stage 5B.2B already made tray membership canonical-state driven, so tray mode does not need ordinary section rows to remain alive. Tray cards are populated from native prompt order and stable section IDs.

Accordion Sortables are initialized only when a section has materialized rows. Closing a section destroys its section-level Sortable before the rows are released. Opening or search-materializing rows dispatches the existing materialization boundary so accordion styling and drag/drop can be attached lazily.

Movement and reorder operations continue to mutate native prompt order, not DOM position.

## Lifecycle and cleanup

Preset and settings events reset the incremental cache and reconcile current residency. A replacement PromptManager drops the obsolete virtualizer without trying to rebuild a no-longer-active preset.

Normal extension cleanup restores every ordinary prompt row through the native row renderer before the virtualization and incremental adapters release method ownership. Cleanup is awaited so later source/runtime teardown does not run against a deliberately partial prompt DOM.

The **Optimized prompt rendering** control disables both incremental reuse and closed-section virtualization. Turning it off restores complete direct section residency.

## Safety boundaries

Stage 5B.3 does not replace or wrap generation, tokenizer, macro, import/export, source-storage or prompt-order APIs. Prompt state remains authoritative in SillyTavern's native service settings.

Unsupported native row-renderer contracts continue to use the native fallback path. Unknown or incomplete state fails open to complete residency rather than inventing rows or order.

The virtualization controller retains identifiers and small residency metadata only. It does not keep detached prompt row trees as a hidden memory cache.

## Validation

```sh
node --test tests/prompt-virtualization.test.js
node --test tests/prompt-rendering*.test.js
node --test tests/*.test.js
node scripts/validate-prompt-rendering.mjs
```

The final Stage 5B.3 branch passes **362/362 repository tests** with zero failures or skips. JavaScript syntax, relative-import, stylesheet/encoding and whitespace audits pass.

The real Chromium injected-host suite contains **28 cases**. The four Stage 5B.3 boundary cases verify:

- closed ordinary rows are physically absent while prompt bodies remain unread;
- opening a section generates only its direct rows through the native renderer, and closing releases them again;
- incremental redraw does not resurrect virtualized rows and still replaces exactly one changed live row;
- virtualization cleanup restores the complete native row list before adapter teardown.

The Chromium host exercises real DOM nodes, listeners and MutationObservers, but it is not a running SillyTavern installation and is not an end-to-end latency or heap benchmark.

## Diagnostics

```js
window.NemoPromptRendering?.getStats()
window.NemoPromptRendering?.getStats().virtualization
```

The virtualization stats include resident and virtualized row counts, tracked sections, materialization/removal counts, search passes, Sortable disposal count and stale materialization protection.

## Remaining validation

The implementation plan is complete at **5/5**. Live SillyTavern validation remains pending in Classic 3.4, Modern and Classic+ across accordion/tray use, search/edit/toggle, snapshots, bulk operations, drag/drop and cross-section movement, preset/profile changes, normal/swipe generation, cold-prompt editing, Vex selection routes, portable/partial export and missing-source recovery.

Record real browser timings and heap/DOM measurements separately from implementation correctness.
