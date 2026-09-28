# Stage 5B.2B/5: state-based Prompt Manager consumers

Stage 5B.2A moved snapshot application/restoration and section controls onto canonical prompt state. Stage 5B.2B finishes the consumer migration required before row virtualization: tray membership and bulk actions, Prompt Navigator discovery, and prompt movement/reordering no longer require the complete prompt list to be rendered.

The runtime manifest remains 6.0.5 during this continuation. Update/reload is sufficient; no preset reimport is required for Stage 5B.2B.

## Canonical consumer state

`state-consumers.js` reads the active native prompt order through the existing Stage 5B metadata model and builds section membership with the legacy divider classifier. It copies identifiers, names, roles and enabled state only; it does not read prompt bodies.

Section operations use stable header prompt identifiers rather than display names. Repeated section names therefore remain distinct, and tray cache identity no longer depends on visible label text.

Top-level membership is derived from ordered rows that are neither section headers nor members of a section. Parent trays retain sub-section divider markers for presentation while ordinary membership remains canonical.

## Tray behavior

Tray conversion may still decorate or hide materialized rows, but those rows are no longer the source of membership. Opening a tray refreshes its records from canonical state, so a section shell with zero ordinary child rows can still populate cards correctly.

Single-card toggles, toggle-all and saved tray presets route through the Stage 5B.2A action adapter. This preserves toggle permissions, cold-source hydration, directive handling, native save/rollback and stale-preset guards.

Tray reorder, cross-section movement and top-level movement mutate native prompt order by stable identifier and await the native save boundary. Top-level movement now changes the native order rather than only updating tray cache state.

Accordion drag/drop uses direct-section operations so same-section reorder persists and nested sub-section membership is not accidentally flattened. Cross-section accordion moves likewise target canonical direct membership.

## Prompt Navigator and header movement

Prompt Navigator listing now comes from native ordered state rather than `querySelectorAll()` over prompt rows. Header discovery uses the section model, so closed or later-virtualized sections remain discoverable.

Navigator movement and the legacy Prompt Manager “move below header” action mutate native prompt order directly. Destination/source rows do not need to exist. UI reorganization follows the native-state mutation rather than being used as the mutation itself.

## Follow-on completion in 5B.3

Version 6.0.6 completes the follow-on work that 5B.2B intentionally left open: closed-section rows are virtualized, search temporarily materializes matching rows, incremental rendering recognizes intentional partial residency, accordion drag/drop follows materialized sections, and cleanup restores complete native rows before releasing ownership. See [PROMPT_VIRTUALIZATION.md](PROMPT_VIRTUALIZATION.md).

5B.2B itself still adds no generation, tokenizer, macro, network or source-storage hook.

## Validation

```sh
node --test tests/prompt-state-consumers.test.js
node --test tests/prompt-state*.test.js
node --test tests/*.test.js
```

The focused consumer suite covers canonical section/top-level membership, Navigator/header discovery, operation without rendered child rows, top-level/cross-section/header moves, recursive and direct-section reorder, duplicate-safe stable identifiers and native-save rollback.

The repository-wide Stage 5B.2B implementation snapshot passes **356/356 tests** with zero failures or skips. JavaScript syntax, relative-import, stylesheet/encoding and whitespace audits pass. This remains contract/injected-runtime validation rather than a live SillyTavern benchmark.

Stage 5B.3 is complete in version 6.0.6; the five-stage implementation plan is finished.
