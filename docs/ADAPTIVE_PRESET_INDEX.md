# Adaptive preset indexing

NemoPresetExt 6.0.15 separates discovering a preset's structure from deciding whether its libraries can be optimized. The catalog is read-only: it does not rename prompts, rewrite macros, select different options, or change preset defaults.

The design follows Nemo-wiki's structural approach: scan saved prompt order, recognize `=== Category ===` and `<Subcategory>` headings, and retain original identities. Selector field assignments provide stronger evidence than names or version numbers. Braille blanks count as spacing when inspecting labels; original source remains unchanged. Discovery does not relax the native macro grammar required for optimization.

| Change in a portable preset | Behavior |
| --- | --- |
| Renamed or newly added Vex selector using the supported selection flag | Discovered by its field; normal validation and optimization can proceed. |
| Renamed genre/author/style selector with supported literal assignments | Included in selection replay regardless of its ID. |
| Renamed recipe data partitions with supported genre guards | Indexed by content; original IDs and exact setter statements are retained. |
| Updated Vex control comments or display prose with a verified executable shape | Accepted with a new exact source fingerprint. |
| New routing algorithm, namespace, control IDs, or unsupported syntax | That subsystem stays in native mode, with its original source and a compatibility warning. |
| Vex control or recipe index/guard/resolver cannot be found, or prompt order uses an unfamiliar format | Portable import continues unchanged for that subsystem, using native execution. |
| Missing/corrupt external source, altered stored loader, or native/preflight disagreement | Blocked until the original source can be verified or restored. |

## Import behavior

Recipes and Vex are assessed separately before their own storage writes. If a raw layout is unsupported, no extraction is attempted for that subsystem and no serialization barrier is installed for that compatibility decision. Other compatible subsystems can still optimize normally. If actual storage writes or verification fail, the existing barriers remain in force.

Native mode delegates the original instructions to SillyTavern and may do more work than an optimized import. The indexer does not invent a replacement Vex, genre, or recipe. It cannot guarantee that a new macro dialect unsupported by SillyTavern itself will execute successfully.

Already optimized presets remain dependent on their verified sidecars. This change does not bypass stored-source checks or reinterpret unknown descriptor schemas.

## Structural fingerprints

Vex program-shape fingerprints preserve macro operations, routing constants, variable names, conditions, comparisons, and embedded reads. They ignore comments, non-routing output text, and literal display prose in `Vex*` / `NemoVex*` setters. Source hashes remain exact and are checked against the import catalog. Portable exports restore exact source spelling, whitespace, and settings.

The verified shapes are bounded compatibility adapters, not a general macro interpreter. A real executable change that does not match a verified shape uses native mode during portable import. Extending optimized support still requires testing the new structure and its dependency semantics.

## Diagnostics

`NemoPresetExt.inspectPreset(portablePreset)` returns headings, Vex/genre/author/style entries, recipe partitions, profile counts, and structural issues. Pass the complete portable object; cold placeholders are not the original source.

`NemoRecipeRuntime.getStats().compatibility` and `NemoVexRuntime.getStats().compatibility` report the last assessed import's name, mode, discovered counts, and native-mode reason. The installer setup report shows a warning if its imported edition uses native execution.

## Validation

Run `node --test tests/adaptive-preset-index.test.js` and `node scripts/validate-preset-imports.mjs --bundled`. Coverage includes renamed IDs, future namespaces, heading/profile discovery, compatible control edits, protected index writes, unchanged native fallback, and exact portable round trips. These are offline checks; they do not replace live SillyTavern macro-engine validation.
