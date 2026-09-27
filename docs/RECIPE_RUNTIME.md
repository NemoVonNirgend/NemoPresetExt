# Stage 1: import-time Nemo recipe storage

NemoPresetExt 6.0.1 automatically externalizes the writing-recipe partitions in supported portable Nemo Full presets. It does not remove Vex libraries, change ordinary prompts, cold-store disabled prompts, virtualize the UI, or alter token budgets. Those are separate stages.

## Using it

Update/reload the extension first, then import the portable Full JSON using **Chat Completion preset import**. The filename is not used as proof of compatibility. Known selector, index, guard, resolver and partition syntax are validated. Lite, Tavo and unrelated presets with no compatible recipe corpus pass through untouched.

Conversion happens in the awaited `OAI_PRESET_IMPORT_READY` hook, before the native preset save, preset-cache insertion and selection. SillyTavern still reads and JSON-parses the original file before that event. This stage does not move that initial parse off the main thread. Already-installed portable presets are not silently migrated on startup: reimport once after updating the extension.

The extension stores exact source partitions as content-addressed JSON files under the current ST user's **files** directory, plus a small index/restoration manifest. It verifies every write by reading it back and checking SHA-256 before replacing the import object. Only a small manifest reference stays in `extensions.nemoRecipeRuntime`. This is durable server storage, not an IndexedDB-only cache; clearing browser storage does not delete these files. Include the ST user files directory in backups. Do not manually delete `nemo-recipes-*.json` while optimized presets reference them.

When a preset is loaded or a generation/dry run begins, the runtime computes a read-only selection from the known literal selector syntax. It fetches the manifest and the **one shard containing the selected recipe**, not every genre. It retains at most two selected setter strings, not the shard bodies. At the original resolver position, the live ST variables are checked, and ST executes the exact selected original setter followed by the exact original resolver. Scoped `#setvar` setters are preserved. No counters, dice or ordinary CoT prompts are evaluated twice by the preflight.

Normal preset export rehydrates the exact source partitions into the export copy. Prompt-list export is also rehydrated when it includes the recipe resolver. Unrelated prompt edits, additions, regexes and order changes are retained. The active optimized preset is not inflated during export. Use a portable full export for sharing or moving to another ST installation.

## Safety and compatibility

- Required sidecars must be available before generation. A missing/corrupt file produces an error and blocks the runtime's generation path; a different recipe is never silently substituted.
- Native ST catches exceptions from event listeners. Import/export failures therefore install a non-enumerable serialization barrier on the failed temporary object, so the subsequent native JSON serialization cannot save or download a broken preset. The original local JSON file is unchanged.
- Failed conversion can leave unreferenced immutable sidecars, but does not delete source data or rewrite an installed preset. Automatic garbage collection is intentionally deferred until reference tracking exists.
- Only same-origin generated `files/nemo-recipes-<sha256>.json` references are accepted. Every file is checksum-verified. The runtime never evaluates JavaScript from a preset.
- The compiler accepts the supported inert recipe grammar and canonical selection guard, not arbitrary ST programs. Unsupported dynamic selectors, executable macros inside recipe values, altered resolver logic, missing/disabled partitions and unknown recipe consumers are refused rather than guessed at.
- After optimization, ordinary prompt editing still works normally. To change library recipes or resolver logic, export portable, edit that file and reimport. This first stage does not provide a separate recipe editor.
- Use the Chat Completion importer for portable Full files. The partial prompt-list importer is prevented from bypassing the extraction path with raw recipe banks.
- Export/reimport the portable version **before disabling/uninstalling this extension**. An optimized preset depends on its runtime. Without the extension there is no code able to enforce a generation guard; the loader contains an explicit dependency notice instead of quietly pretending to be a complete preset.
- Setting `extension_settings.NemoPresetExt.enableRecipeRuntime = false` disables automatic conversion of future imports. It does not remove runtime support for already optimized presets.

No global tokenizer override is installed. ST still counts the fully resolved model-facing message normally. Generic comment elision is deliberately deferred: the first stage preserves native macro semantics rather than assuming every apparent comment can be removed safely.

## Validation

Run `node --test tests/recipe-runtime.test.js` for the isolated API-contract tests. Run:

```sh
node scripts/validate-recipe-preset.mjs /path/to/Nemo_Engine_v12_Full.json
```

for exhaustive verification against a real local preset. The second command checks every recipe statement, both profile selections, source restoration from a fresh disk-backed store, exact JSON round-trip equality and unchanged unrelated prompt/regex data. It does not upload the preset to GitHub.

The public diagnostic surface is `NemoRecipeRuntime.getStats()`: import count, materializations, cache hits, cached recipe count and cached character count. These are operational counters, not measurements of browser heap use or model token savings.

### Next stages

1. Extend validated externalization to Vex static data.
2. Add durable cold storage and editor hydration for disabled ordinary prompts.
3. Consolidate structured metadata caching and indexed/worker content search.
4. Virtualize closed/hidden sections and reduce observer/Sortable rebuild work.

These are not implemented by Stage 1.
