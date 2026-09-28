# Vex libraries: Stage 4/5

Version 6.0.4 adds import-time externalization for the supported Nemo v12 Full Vex library schema. The five data slots retain their identifiers and prompt-order positions, but their large bodies are replaced by small, explicit runtime stubs. Selectors, the state reset, the original family/route resolver, the original assembler, all other prompts and regex scripts remain unchanged.

## Usage and persistence

Update and reload NemoPresetExt. Export the current configuration as a portable Full preset to preserve edits, then reimport through the **Chat Completion preset importer**. Existing installations are not destructively migrated during startup. Lite and Tavo have no matching Vex database and are not changed by this stage.

The source is saved as immutable SHA-256-addressed `nemo-vex-*.json` files in the authenticated ST user's files directory, with read-back verification before replacing any imported body. These files contain the original user-imported data, not a substitute bundled library. Back up the user files directory alongside presets. Browser-cache deletion does not erase server files. Old packs are retained rather than automatically deleted.

Portable full exports restore the original five bodies in the export copy only. Prompt-list export restores any included library slots. Partial library imports are rejected: use the complete preset importer so dependencies and storage can be verified. Export portable before disabling the extension or moving to another server. An optimized stub is deliberately not a self-contained prompt.

## Native behavior remains authoritative

The extension does not replace family collapse, interview selection, independent Vex behavior, or narrative/planning output. A restricted dependency preflight compiles the fingerprinted original Vex program and discovers the library fields it reads. It uses an isolated variable dictionary, exact scalar lookup values, and truth-value placeholders for literal prose. It never evaluates JavaScript, accesses chat variables, executes unrelated prompt macros, rolls dice, increments story counters, or supplies its own generated prose to the model.

Before native prompt preparation, only the required original setter statements are loaded. ST executes those setters in the original data slots, followed by the unchanged resolver and assembler. A check against actual native raw-selection flags and resolved route/edge variables blocks preparation if the prediction disagrees. ST remains responsible for macro whitespace, selected text, variable side effects, and token accounting.

The supported program fingerprints are intentionally narrow. Changed control programs, custom library consumers/writers, unsupported selector syntax, missing slots, invalid execution order, ambiguous data or nested executable library values are rejected instead of guessed. Literal profile/exchange edits are retained exactly. Export portable before editing library or control-flow bodies. `extension_settings.NemoPresetExt.enableVexRuntime = false` disables automatic conversion of raw imports, not the runtime needed by already-converted presets.

## Runtime and cache boundaries

- Keep one prepared selection, its selected setter strings, and a small scalar/dependency index. Control compilation is transient when readiness changes; full profile/exchange banks are not retained after loading.
- Load the source banks containing requested fields transiently, then discard the unselected text. A selection change may therefore read multiple banks from the local ST server; this is not a claim of one HTTP request per field or of no transient full-bank allocation.
- Clear stale values belonging to the verified library in the original data slots, then install the selected values. Unrelated user variables are not deleted.
- Coalesce equivalent pending requests; reject a stale load, preset switch, loader edit or late selection change rather than using an old council.
- Missing/corrupt required storage blocks generation and portable export. Serialization guards account for ST's event emitter swallowing callback errors.
- Stage 3 hydrates enabled source before Vex readiness. Real-generation preflight runs cold prompts, Vex libraries, then writing recipes. Full export restorers compose without inflating the active preset.
- Stage 2 searches the active prompt records, not hidden Vex sidecars. Portable export is the source-editing path for the external library.
- No DOM virtualization, new observer, tokenizer replacement, or CoT change is included here. Those interface changes belong to Stage 5/5.

## Validation

```sh
node --test tests/*.test.js
node scripts/validate-vex-preset.mjs /path/to/Nemo_Engine_v12_Full.json --exhaustive
```

The offline validator checks all 38,400 resolved family configurations in the current Full source, all 128 independent-selection combinations in isolation and with a council, all 164 same-family selection masks, reversed input order and representative ambient state. It compares the original literal-library execution with dependency-filtered execution and verifies byte-identical original setters, enabled-profile selection, fresh filesystem-store recovery, exact portable JSON restoration, and unchanged input. It prints statistics only, never preset prose.

This is a restricted-program/contract validation, **not execution inside ST's actual macro engine** and not a browser latency or memory benchmark. Native browser validation remains pending. The runtime's native route checks provide an additional guard; they do not substitute for smoke testing.

Diagnostics:

```js
window.NemoVexRuntime?.getStats()
```

Smoke test Full in a running ST client: no selected Vex; a single member; two members from one family; a multi-family council; an independent Vex alone/alongside that council; changed selection; cold selector enable/edit; swipe/continue; reload; portable export/reimport; and missing/corrupt sidecar failure. Verify final output and scratchpad/CoT behavior independently of performance measurements.
