# Stage 4B/5 (2/2): live Vex integration

Version 6.0.4 connects the source-storage foundation merged in PR #24 to import, selected-source preparation and portable export. Together 4A and 4B complete the implementation of Stage 4/5. Stage 5/5 remains DOM/rendering work. Native SillyTavern macro-engine and browser validation are still pending.

## Usage

Update NemoPresetExt and reload. Export the current Full configuration portable to preserve edits, then reimport that file with the Chat Completion preset importer. Supported Vex banks are verified on disk before their bodies are replaced by lightweight loader stubs. Existing raw installations are not destructively migrated at startup. Lite and Tavo have no matching Vex libraries and are not changed by this stage.

Back up the authenticated ST user's files directory alongside presets. The five sources, offset index and runtime catalog use immutable SHA-256-addressed `nemo-vex-source-*.json` files. Clearing browser cache does not remove them. No automated deletion is introduced. Always export portable before disabling/uninstalling the runtime or moving to another ST server. Loader stubs are intentionally not standalone presets.

## Native execution remains authoritative

Vex requires SillyTavern's **Experimental Macro Engine**. The legacy regex engine accepts simple selector setters but cannot resolve nested map lookups or scoped branches, leaving macro fragments in values such as `NVCR1_code`. Version 6.0.18 checks the host setting and a variable-free nested-conditional probe before managed preparation, including cache hits and direct native slots. Enable the option in User Settings and fully reload; update SillyTavern if the option is absent. Unsupported portable imports retain their full source, and exports remain available regardless of engine compatibility.

The original selector, reset, resolver and assembler bodies are not rewritten. The adapter accepts verified v12/v12.1 control programs, including compatible metadata/display-prose revisions with the same verified executable structure, and the literal selector/library schema. A restricted isolated preflight discovers which original assignments are needed. It does not run JavaScript, call provider APIs, read/write chat variables, execute unrelated macros, roll dice, or generate replacement Vex prose. Scalar maps remain exact; prose fields are represented only by their truth values during dependency discovery.

Version 6.0.13 also recognizes the inspected v12.1 full assembler in ordinary-space and Braille-space editions. Each catalog records the exact accepted control hashes; original v12 catalogs retain their existing schema and fingerprints. The compiler remains bounded at 512 Ki UTF-16 code units, allowing the current 424,400-character assembler. Current selector style appendices may write only `NemoVexAdultStyle`, with display reads of that field, `NemoInterpreterEnabled`, `user`, and `char`, plus conditionals. Dependency discovery reads the leading selection flag; native ST still executes the complete original selector. Recipe guard comparison also accepts Braille-spaced display labels without rewriting the original guard.

Version 6.0.15 discovers selectors from their selection flags even when IDs change. Its additional program-shape fingerprints ignore comments and permitted display prose while retaining routing literals, conditions, variable names, and macro structure. Newly captured catalogs record both the exact source hashes and structural fingerprints; stored source identity must still match on every preparation. Unknown executable structures or bank layouts are left intact during portable import and run natively with a warning. See [adaptive indexing and fallback boundaries](ADAPTIVE_PRESET_INDEX.md).

Stage 4A retrieves the requested exact setter statements. ST then executes those statements in the five original library slots and executes the unchanged resolver and assembler. Actual selection flags and resolved route/edge/family values are checked against the prepared selection. Missing preparation, skipped data slots, native divergence and corrupt/missing files stop the managed generation rather than supplying another council. Final request serialization is blocked on known failures because ST's event emitter catches listener exceptions.

The runtime keeps one prepared route plus a scalar/offset catalog, not the full corpus. Source banks are read transiently. Changes to enabled prompts, selectors, order, generation triggers, body references or preset identity invalidate preparation. Obsolete loads cannot replace a newer route. At native library slots only verified original Vex library keys are cleared, preventing old unused recipe text from carrying into the new selection while leaving unrelated variables alone.

## Composition and exports

Initialization is recipe/performance, Vex, then cold prompt storage. The resulting preflight chain is cold source hydration, Vex preparation, writing-recipe preparation. Cleanup unwinds those wrappers in reverse order and does not overwrite later third-party wrappers.

Full portable export restores the five original Vex bodies in the export copy. The recipe and cold-source exporters then compose with it without inflating the running preset. Partial prompt-list export restores any included bank. Partial library import is rejected; use the complete preset importer so dependency and source contracts can be verified. Unexpected edits to loader stubs are not silently discarded. For library/control editing, export portable first; supported literal data edits are preserved, while unknown control programs use native execution on portable import.

`extension_settings.NemoPresetExt.enableVexRuntime = false` opts out of future automatic raw-preset conversion; it does not disable support required by already optimized presets. This setting is not a provider capability or an instruction to the model.

## Validation

```sh
node --test tests/*.test.js
node scripts/validate-vex-storage.mjs /path/to/Nemo_Engine_v12_Full.json
node scripts/validate-vex-runtime.mjs /path/to/Nemo_Engine_v12_Full.json --exhaustive
node scripts/validate-preset-imports.mjs /path/to/standard.json /path/to/full.json /path/to/standard-braille.json /path/to/full-braille.json
```

The import verifier exercises the production recipe, Vex, and cold-body hooks together, serializes the optimized preset, reimports it with fresh stores, prepares each saved profile, and requires an exact portable round trip. It accepts external preset paths so release verification does not commit prompt prose to this repository. These are offline runtime checks; they do not run SillyTavern's native macro engine or a browser.

The local Full verifier passed 38,988 full-library-versus-selected-library cases, including every one of the 38,400 resolved family configurations, 164 same-family selection masks, and all 128 independent combinations both alone and with a council. It checks the actual imported control fingerprints, selected setter identity, exact portable JSON round trip, export/input immutability, and restoration using fresh filesystem-backed stores. The default saved profiles each select 45 of the 4,378 library assignments: 10,396 setter characters, compared with 690,239 characters in the five original banks.

These figures measure source work and restricted-program parity, not actual ST latency, native macro-engine output or browser memory. The fixture-based controller tests emulate native preparation; they do not run a live ST server. No user preset prose is printed or committed by the verifier.

Diagnostics:

```js
window.NemoVexRuntime?.getStats()
```

Before claiming native validation, test both saved profiles in ST, family singles/masters, cross-family councils, independent add-ons, selector changes between turns, normal/swipe generation, cold selector enabling, full/partial exports, and recovery after missing storage. Check that no stub reaches model-facing context and that the original family/council result is retained. DOM virtualization is not part of this release.
