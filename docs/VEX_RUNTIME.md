# Stage 4B/5 (2/2): live Vex integration

Version 6.0.4 connects the source-storage foundation merged in PR #24 to import, selected-source preparation and portable export. Together 4A and 4B complete the implementation of Stage 4/5. Stage 5/5 remains DOM/rendering work. Native SillyTavern macro-engine and browser validation are still pending.

## Usage

Update NemoPresetExt and reload. Export the current Full configuration portable to preserve edits, then reimport that file with the Chat Completion preset importer. Supported Vex banks are verified on disk before their bodies are replaced by lightweight loader stubs. Existing raw installations are not destructively migrated at startup. Lite and Tavo have no matching Vex libraries and are not changed by this stage.

Back up the authenticated ST user's files directory alongside presets. The five sources, offset index and runtime catalog use immutable SHA-256-addressed `nemo-vex-source-*.json` files. Clearing browser cache does not remove them. No automated deletion is introduced. Always export portable before disabling/uninstalling the runtime or moving to another ST server. Loader stubs are intentionally not standalone presets.

## Native execution remains authoritative

The original selector, reset, resolver and assembler bodies are not rewritten. The adapter accepts only the fingerprinted v12 control programs and literal selector/library schema. A restricted isolated preflight discovers which original assignments are needed. It does not run JavaScript, call provider APIs, read/write chat variables, execute unrelated macros, roll dice, or generate replacement Vex prose. Scalar maps remain exact; prose fields are represented only by their truth values during dependency discovery.

Stage 4A retrieves the requested exact setter statements. ST then executes those statements in the five original library slots and executes the unchanged resolver and assembler. Actual selection flags and resolved route/edge/family values are checked against the prepared selection. Missing preparation, skipped data slots, native divergence and corrupt/missing files stop the managed generation rather than supplying another council. Final request serialization is blocked on known failures because ST's event emitter catches listener exceptions.

The runtime keeps one prepared route plus a scalar/offset catalog, not the full corpus. Source banks are read transiently. Changes to enabled prompts, selectors, order, generation triggers, body references or preset identity invalidate preparation. Obsolete loads cannot replace a newer route. At native library slots only verified original Vex library keys are cleared, preventing old unused recipe text from carrying into the new selection while leaving unrelated variables alone.

## Composition and exports

Initialization is recipe/performance, Vex, then cold prompt storage. The resulting preflight chain is cold source hydration, Vex preparation, writing-recipe preparation. Cleanup unwinds those wrappers in reverse order and does not overwrite later third-party wrappers.

Full portable export restores the five original Vex bodies in the export copy. The recipe and cold-source exporters then compose with it without inflating the running preset. Partial prompt-list export restores any included bank. Partial library import is rejected; use the complete preset importer so dependency and source contracts can be verified. Unexpected edits to loader stubs are not silently discarded. For library/control editing, export portable first; supported literal data edits are preserved, while unknown control-program edits are refused by the optimized adapter.

`extension_settings.NemoPresetExt.enableVexRuntime = false` opts out of future automatic raw-preset conversion; it does not disable support required by already optimized presets. This setting is not a provider capability or an instruction to the model.

## Validation

```sh
node --test tests/*.test.js
node scripts/validate-vex-storage.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-vex-runtime.mjs /path/to/Nemo_Engine_v12_Full.json --exhaustive
```

The local Full verifier passed 38,988 full-library-versus-selected-library cases, including every one of the 38,400 resolved family configurations, 164 same-family selection masks, and all 128 independent combinations both alone and with a council. It checks the actual imported control fingerprints, selected setter identity, exact portable JSON round trip, export/input immutability, and restoration using fresh filesystem-backed stores. The default saved profiles each select 45 of the 4,378 library assignments: 10,396 setter characters, compared with 690,239 characters in the five original banks.

These figures measure source work and restricted-program parity, not actual ST latency, native macro-engine output or browser memory. The fixture-based controller tests emulate native preparation; they do not run a live ST server. No user preset prose is printed or committed by the verifier.

Diagnostics:

```js
window.NemoVexRuntime?.getStats()
```

Before claiming native validation, test both saved profiles in ST, family singles/masters, cross-family councils, independent add-ons, selector changes between turns, normal/swipe generation, cold selector enabling, full/partial exports, and recovery after missing storage. Check that no stub reaches model-facing context and that the original family/council result is retained. DOM virtualization is not part of this release.
