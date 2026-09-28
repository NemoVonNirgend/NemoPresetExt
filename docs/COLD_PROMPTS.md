# Disabled prompt storage: Stage 3/5

Version 6.0.3 adds durable source storage for ordinary prompts in recognized Nemo ST presets. This is separate from Stage 1's writing-recipe database and Stage 4's planned Vex library extraction. It does not virtualize the DOM; that is Stage 5.

## Enable and use

Update NemoPresetExt and reload ST before importing. For the complete import-time conversion, import your portable Nemo Full or Lite through the **Chat Completion preset importer**. Import-time recognition is structural, not based on the filename alone. Tavo/EJS and unrelated presets are not automatically converted. Already active recognized Nemo presets can have disabled bodies moved into storage during the next normal prompt-manager save or dry run; reimport is the predictable way to compact the saved preset collection as well.

The source file you selected is unchanged. Conversion saves and verifies the source bodies before the imported object is replaced. Enabled bodies are loaded before ST applies the selected preset or constructs a generation. Disabled prompts retain their identifiers, labels, role/injection information, and directive/tooltip comments in a small shell.

- Click a native toggle: the stored body loads before the click is replayed through the existing directive validation.
- Dependencies enabled indirectly or by scripts load at the save/generation boundary. A late change that reaches synchronous preparation before loading is blocked, not silently omitted.
- Click Edit: the editor and Save are unavailable while its source is loading. The source is pinned while that editor is open.
- Save and close a disabled prompt: changed text is written and verified before its body is evicted. A failed storage write leaves the full edited text resident and available to ST's normal save.
- Disable an unchanged prompt: reuse its verified reference instead of uploading another copy.
- Search prompt text: the Stage 2 worker reads cold source on demand without replacing the active shell. The worker's existing bounded, temporary search index is still used; metadata-only browsing does not read cold bodies.
- Export: normal full-preset and prompt-list exports restore source in the export copy, not the active preset. The Stage 1 recipe export also remains intact.

Native system prompts, quick-edit fields (`main`, `nsfw`, `jailbreak`), markers, `nemo-init-*` data initializers, the recipe runtime slot, oversized bodies, and oversized metadata shells remain native. The optimization does not promise to unload every string. Generation uses the enabled set; this stage does not attempt a general macro dependency optimizer.

## Storage and backups

Source packs are immutable JSON files named `nemo-prompts-<sha256>.json` in the authenticated ST user's files directory. Requests are same-origin, reject redirects, and validate the exact filename/hash. Each pack is verified by read-back before source removal. Packs normally target 256 Ki UTF-16 code units, with bounded body and response sizes. A temporarily read pack is released after its requested bodies are extracted. The store retains in-flight requests only, not a persistent whole-library RAM cache.

The browser is not the only copy. Clearing browser data does not erase server-side source packs. Back up your ST user files directory together with settings and presets. Normal ST Save/Update semantics still apply to which preset revision is persisted; this feature does not turn unsaved editor text into a saved preset revision.

**Export a portable preset before disabling/uninstalling the extension, transferring it to another installation, or downgrading.** An optimized shell on another server is not portable without its referenced files. Missing or corrupted required files stop loading/generation/export. Reimport a portable original to repair its original source; use backups to recover later edits. There is no claim that reimporting an older original recovers newer edits.

Old immutable packs are not deleted automatically. Garbage collection needs reference tracking across saved presets/backups and is intentionally excluded from this stage. Never delete these files based only on which preset happens to be active.

## Correctness boundaries

The controller serializes work per prompt-array revision, checks source/reference identity after asynchronous reads and writes, and rejects stale editor responses. Switching presets during a pending save does not save the newly selected preset on behalf of the old operation. Exact source strings, including whitespace and Unicode, are retained. No prompt macros execute during storage or hydration, so hydration cannot itself advance counters or roll dice.

ST's event emitter catches listener exceptions. Failed imports and exports therefore receive a non-enumerable serialization barrier as well as an error. Required-body failures are also guarded at synchronous prompt preparation and final request serialization. Throwing in an event handler alone would not be sufficient.

This uses explicit async import/selection/toggle/edit/search/export boundaries. `getPromptById()` is still synchronous. Third-party code that copies `prompt.content` directly may see a shell and needs the async source API instead. Nemo's Save Prompt archive action is adapted; unexpected synchronous `extractPromptData()` calls on a cold prompt are refused rather than saving a shell as source. Optional tray token hints return no count for a cold body and do not tokenize the shell.

Metadata comments are retained, including directives placed late in a prompt. The Stage 2 metadata record is invalidated when a body is hydrated or evicted so it cannot retain the previous full-body revision. This is not a new universal comment stripper.

Automatic conversion can be disabled by setting `extension_settings.NemoPresetExt.enableColdPromptStorage = false` and saving/reloading. This advanced setting is not a new settings-panel control. Existing references still load: disabling conversion must not disable access to already externalized source.

## Diagnostics and validation

```js
window.NemoColdPrompts?.getStats()
// Explicit asynchronous source read for an integration:
await window.NemoColdPrompts.readBody(prompt)
```

Diagnostics report stage 3/5, tracked/cold prompt counts, source characters kept cold, hydration/eviction counts, pinned editors and storage operations. They are not a process-memory measurement or a browser-latency benchmark.

```sh
node --test tests/*.test.js
node scripts/validate-cold-preset.mjs /path/to/Nemo_Engine_v12_Full.json report.json
```

The real-preset validator uses actual temporary filesystem storage behind an HTTP adapter, verifies enabled-source parity for every saved order profile, and checks exact portable JSON equality using a fresh store. It does not print or upload prompt prose. Integration tests use the real Stage 1 controller and the real Stage 2 directive/search implementation. Browser-boundary unit tests use a mock DOM/event harness, not a running ST client.

Native ST browser validation remains pending. Test Classic 3.4, Modern and Classic+: fresh import, reload, both profiles, toggles with auto-enabled dependencies, Edit/Save/Cancel, empty edits, Save Prompt to archive, text search, full and partial export, missing-file failure, and rapid preset switches while a load is pending. Test a real generation before treating the deployment as browser-verified.
