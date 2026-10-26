# NemoPresetExt

NemoPresetExt is the complete Nemo prompt workstation for SillyTavern. It combines prompt organization, preset and character navigation, reasoning capture, prompt directives, custom dividers, NemoEngine installation, and Nemo Hub in one extension.

**Version:** 6.0.20

**Homepage:** https://github.com/NemoVonNirgend/NemoPresetExt

## Installation

Install `https://github.com/NemoVonNirgend/NemoPresetExt` with SillyTavern's third-party extension installer, then reload. No SillyTavern source modifications are required.

### 6.0.20 Nemo ReSwipe in Nemo Hub

Nemo Hub now includes the optional **Nemo ReSwipe** extension. When generating a new swipe, it sends the rejected response as user-role guidance with editable instructions to approach the reply differently. Install it from the Writing Tools category and reload SillyTavern. It works independently and does not change saved chat messages or preset prompts.

### 6.0.19 Prompt order and virtualization safety

Closed sections can unload their prompt rows to reduce rendering work. Native drag-and-drop now refuses to save an incomplete, duplicated, or stale list of visible rows as the full prompt order. This prevents hidden prompts from being detached while section headers remain at `(0/0)`.

Row unloading also requires a compatible renderer and protected native sorting. If regeneration fails, unloading stops and a complete native redraw restores the list. Extension cleanup awaits native restoration if isolated row rendering cannot recover the missing rows.

Update NemoPresetExt and fully reload SillyTavern. This prevents new loss of prompt-order entries; it does not automatically reattach entries already removed from a saved preset. Restore a backup or reimport the original preset for an already-damaged order. Prompt definitions and intentional detach operations are preserved.

### 6.0.18 Vex macro-engine compatibility

The legacy SillyTavern macro engine cannot evaluate Vex's nested lookups and scoped conditionals. It can leave literal macro fragments in `NVCR1_code`, causing **“native Vex route diverged”** even with intact stored source. Enable **User Settings → Experimental Macro Engine**, then fully reload SillyTavern. Update SillyTavern if that option is missing. Reimporting or deleting stored Vex files is not necessary for this configuration problem.

Nemo now checks the host engine before loading managed Vex source, including cached selections and direct prompt preparation, and gives those recovery instructions early. Incompatible portable imports keep their original source. Portable export remains available with the engine disabled. Genuine routing mismatches still block the request.

### 6.0.17 Runtime loader formatting failsafe

Generated recipe and Vex placeholders are recognized after harmless comment, whitespace, and `{{trim}}` changes. Generation still uses the verified original stored source, and portable export restores that exact source without rewriting the active preset. Changed warning text, executable macros, missing or duplicate resolver slots, missing source files, and checksum failures remain blocking errors. Stored prompt bodies, executable controls, and cold-prompt edit detection retain their existing integrity checks.

Update NemoPresetExt and fully reload SillyTavern. An intact optimized preset does not need to be reimported.

### 6.0.16 Recipe loader compatibility fix

Fixes a false **“The optimized recipe loader was edited”** error during generation and token counting. Comment-removal optimization now preserves recipe/Vex loader markers and cold prompt shells so their runtime checks see the original source. Actual loader edits and missing stored source still trigger the existing checks.

Update NemoPresetExt and fully reload SillyTavern. An intact optimized preset does not need to be reimported.

### 6.0.15 Adaptive Vex and genre indexing

Vex and writing selectors are discovered from the fields they set, and recipe partitions from their genre guards, so renamed prompt IDs and new selector entries can still be indexed. The read-only catalog also follows Nemo-wiki headings, subheadings, and saved prompt order. Vex controls with revised metadata or display prose can retain optimization when their executable structure matches a verified program.

An unfamiliar portable layout now imports with its original prompts and a compatibility warning when it cannot be optimized. Recipes and Vex are assessed independently. Stored-source corruption, missing files, edited loader stubs, and native execution mismatches remain blocking errors. See [adaptive indexing](docs/ADAPTIVE_PRESET_INDEX.md).

### 6.0.14 One-click Nemo Engine v12.1 installation

Open **NemoPresetExt → NemoEngine**, choose **Standard** or **Full**, with ordinary or Braille spaces, then click **Import & Process**. The installer verifies the bundled release, runs the normal preset import processing, saves all 493 embedded regex scripts, and selects the preset. Full editions automatically use the supported recipe and Vex storage processing with the default runtime settings. Completion waits for SillyTavern to apply the preset.

All four compatible portable exports ship with the extension; no separate preset download is needed. Existing presets are preserved: another import gets a numbered copy. The setup wizard checks the selected edition and can reselect its previous import. See [Nemo Engine setup](NEMO_ENGINE_SETUP.md) for edition choices and configuration.

Update NemoPresetExt and fully reload SillyTavern to see the new installer.

### 6.0.13 Nemo Engine v12.1 import compatibility

Supports the current standard and full v12.1 exports with ordinary or Braille spaces. Full imports recognize both inspected Vex assembly programs, their newer selector style blocks, and Braille-spaced recipe guard labels. The bounded Vex compiler now accommodates the 424,400-character assembler. Original v12 runtime catalogs remain readable, and portable exports retain the exact source text and spacing.

Update NemoPresetExt, fully reload SillyTavern, and retry importing the original portable preset if an earlier attempt reported **unsupported or edited nemo-vc-assemble-selected**. Unknown control programs and selectors that modify routing or read stored libraries outside preflight are still rejected.

### 6.0.12 Nemo Plotlight in Nemo Hub

Install **Nemo Plotlight** from **NemoPresetExt → Nemo Hub** to browse and import Plotlight characters, Chat Completion presets, lorebooks, and personas. Its first-launch notice explains how to install the bundled companion helper for published-image previews, ratings/roses, and the persona-download fallback. The helper is installed separately from the browser extension.

Update NemoPresetExt and reload SillyTavern to see the new installer entry.

### 6.0.11 Force the final user role

Enable **NemoPresetExt → Outgoing messages → Force the last outgoing message to user role** to send the final Chat Completion message as `user`, regardless of whether it comes from a preset prompt, lorebook, extension, quick reply, chat history, continuation, or **Start reply with**. The switch defaults to off, persists with extension settings, and applies immediately to subsequent requests in every prompt interface mode.

The override attaches at `CHAT_COMPLETION_SETTINGS_READY` and applies when SillyTavern serializes the outgoing request, after all event listeners finish. This also catches content appended by later extension listeners. Claude's separately transmitted assistant prefill becomes the final user message so the server cannot append it as an assistant turn. Earlier message roles, saved prompts, lorebooks, chat history, and the configured prefill remain unchanged. A trailing native tool result keeps its required protocol entry and is repeated as the final user message to preserve its tool-call pairing. Plain Text Completion APIs have no message-role field.

Update the extension and fully reload SillyTavern once to install the feature. Toggling it afterward requires no reload or preset reimport.

### 6.0.10 Prompt layout and redraw recovery

Prompt sections recover after native redraws even when a settings save is still pending. Deferred organization is replayed after the toggle completes, preserving open sections and trays across toggles within the same preset. Native row styles now respect Nemo's layout in narrow settings panels, including panels inside Chat Completion Tabs. Tray controls share the active theme, the presets menu opens as a dropdown, and Compact / All Compact use a compact layout with correctly sized labels and tooltips.

Update the extension and fully reload SillyTavern. This UI repair does not require reimporting presets.

### 6.0.9 Braille-space lorebook activation

Braille blanks (`U+2800`, `⠀`) now act as ordinary spaces in lorebook scan keywords. `Happy Hapini Village` activates for `Happy⠀Hapini⠀Village`, including mixed spacing. Enabled automatically, this covers primary and secondary keys in global, character, chat and persona lorebooks, recursive scans, injected scan text and inclusion-group scoring. Regex keys also accept Braille blanks wherever their character atoms accept spaces, including `\s`, literal spaces and character classes. Native case sensitivity, single-word boundaries, selective logic, budgets and recursion rules remain in charge. Saved lorebooks and message text are unchanged.

Update the extension and fully reload SillyTavern. Requires the native `WORLDINFO_ENTRIES_LOADED` event. Regex backreferences retain exact captured-character matching.

### 6.0.8 HTTP-origin hashing compatibility fix

Prompt, recipe and Vex storage now share a SHA-256 helper that uses native Web Crypto when available and a JavaScript implementation of the same algorithm otherwise. This fixes imports where `crypto.subtle` is unavailable, including HTTP LAN contexts, without relaxing checksum verification or changing existing sidecar references. Update the extension, fully reload, and retry the original portable preset import. See [hashing behavior and validation](docs/SHA256_STORAGE.md).

### 6.0.7 storage-path compatibility fix

SillyTavern's authenticated Files API stores uploaded extension files under the user's `/user/files/` route. Earlier Nemo performance-storage code incorrectly expected `/files/`, which could stop fresh preset imports after a successful upload with **Unexpected prompt storage location**. Version 6.0.7 writes new recipe, prompt-body and Vex sidecars to the current `/user/files/` route, accepts legacy `/files/` references, and retries the equivalent current/legacy location on a 404. Exact filename validation, same-origin requests, SHA-256 checks and read-back verification remain enforced.

## Prompt workstation

Prompt-related tools are owned by NemoPresetExt:

- Searchable prompt manager with collapsible sections.
- Tray and accordion organization, prompt movement, archives, snapshots, and prompt navigation.
- Preset navigator and local character navigator.
- Improved reasoning capture.
- Prompt directives, dependencies, trigger metadata, validation, and native autocomplete integration.
- Custom divider expressions.

### Interface modes

NemoPresetExt exposes three prompt interface modes:

| Mode | Appearance | Feature profile |
| --- | --- | --- |
| **Classic 3.4** | Compact presentation modeled on NemoPresetExt 3.4.0 | Legacy profile without the category tray and modern progress surfaces |
| **Modern** | Current card-based presentation with larger surfaces and wrapped labels | Full feature set |
| **Classic+** | Compact classic presentation | Full feature set |

New installations default to **Classic 3.4**. Existing standalone NemoPromptTools users migrate to **Modern** so their current presentation is preserved.

## New-install defaults

- `enablePromptManager`: `true`
- `enablePresetNavigator`: `true`
- `enableCharacterNavigator`: `true`
- `enableReasoningCapture`: `true`
- `enableReasoningSection`: `true`
- `enableLorebookManagement`: `false`
- `forceLastUserRole`: `false`
- `promptUiMode`: `classic`
- `enableDirectives`: `true`
- `enableDirectiveAutocomplete`: `true`
- `enableNemoEngineInstaller`: `true`

## Optional compatibility adapters

NemoPresetExt remains fully standalone. Its manifest does not require [Chat Completion Tabs](https://github.com/RivelleDays/SillyTavern-ChatCompletionTabs), [Moonlit Echoes Theme](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme), or any code from either project.

At runtime, NemoPresetExt detects the interface capabilities that are actually active and adapts without calling private third-party APIs:

| Active interface | NemoPresetExt behavior |
| --- | --- |
| Neither Rivelle extension | Nemo renders its complete standalone prompt interface and prompt-side reasoning controls. |
| Chat Completion Tabs | Rivelle's **Prompts** tab hosts Nemo's prompt tools and optional lorebook controls. Native SillyTavern reasoning controls remain authoritative in **Parameters**, preventing duplicate visible selectors. |
| Moonlit Echoes Theme | Nemo keeps its standalone ownership while applying narrowly scoped wrapping, height, and overflow guards to its own prompt controls. |
| Both extensions | Chat Completion Tabs owns the tab layout, Moonlit Echoes owns the visual theme, and Nemo contributes only its prompt workstation surfaces. |
| An extension is disabled or removed | Nemo automatically returns to the capabilities currently available, including its standalone fallback. |

The compatibility layer treats SillyTavern's native reasoning values as canonical and rebinds when the host or a third-party extension replaces a control node. It does not store a competing reasoning-effort value.

The prompt-side lorebook section is optional under **NemoPresetExt → Prompt workstation → Show lorebook management in the prompt panel**. Hiding it removes only Nemo's controls and does not activate, deactivate, or clear any lorebook.

For diagnostics, open the browser console and run:

```js
window.NemoPromptTools?.getCompatibilityState?.()
```

The result reports the detected prompt host, visible reasoning owner, Chat Completion Tabs state, and Moonlit Echoes state.

## Optional extensions

Install these independently from Nemo Hub:

| Extension | Features |
| --- | --- |
| [Nemo UI Overhaul](https://github.com/NemoVonNirgend/NemoUIOverhaul) | Optional backgrounds, settings/connection/extensions/lorebook UI, wide/mobile panels, model selector, and themes. |
| [Nemo Emoji Picker](https://github.com/NemoVonNirgend/NemoEmojiPicker) | Composer emoji picker. |
| [Nemo Image Generation](https://github.com/NemoVonNirgend/NemoImageGeneration) | Pollinations detection and automatic image workflows through SillyTavern providers. |
| [NemoLore](https://github.com/NemoVonNirgend/NemoLore) | Memory, summaries, retrieval, and lore maintenance. |
| [Nemo Guides](https://github.com/NemoVonNirgend/NemoGuides) | Scene assessment, planning, writing, DM notes, rules, and narrative utilities. |
| [Ember](https://github.com/NemoVonNirgend/Ember) | Interactive HTML/JavaScript chat artifacts. |
| [NemoRewrite](https://github.com/NemoVonNirgend/NemoRewrite) | Selection-based rewriting tools. |
| [Nemo ReSwipe](https://github.com/NemoVonNirgend/NemoReSwipe) | Previous rejected swipe as user-role guidance for a different response. |
| [Nemo Plotlight](https://github.com/NemoVonNirgend/NemoPlotlight) | Browse and import public characters, presets, lorebooks, and personas. A bundled companion helper is installed separately for previews, ratings, and the persona-download fallback. |

NemoUIOverhaul and NemoEmojiPicker remain separate because they alter broader SillyTavern presentation or composer behavior rather than the prompt workstation itself.

## Prompt directives

Directive metadata lives inside prompt comments such as `{{// @tooltip Example }}`. The adapter uses SillyTavern's native autocomplete surfaces only while editing directive comments, leaving ordinary macro autocomplete in control elsewhere.

## Custom dividers

Add comma-separated regular expressions under **Custom dividers** and save. The merged prompt manager consumes the divider contract directly.

## NemoEngine

The installer adds or updates the bundled Nemo Engine Chat Completion preset without changing SillyTavern source. Its setup report validates bundled and installed prompt slots. Provider credentials remain owned by SillyTavern.

### Large-preset recipe runtime

Version 6.0.1 adds Stage **1/5** of the large-preset performance work. After updating and reloading the extension, import the portable Nemo Full JSON through the **Chat Completion preset import** button. Supported writing-recipe banks are verified and saved to separate files in the authenticated SillyTavern user's files directory before the compact preset is saved or selected. Runtime preparation loads only the selected recipe shard and retains at most two selected recipe setter strings. Normal export reconstructs the portable preset.

Existing raw Full installations need a one-time reimport. Back up the ST user files directory along with presets, and export portable before disabling the extension or transferring a preset to another installation. Vex externalization is covered by Stage 4 below; DOM virtualization remains Stage 5B/5. See [Recipe runtime usage, safety and validation](docs/RECIPE_RUNTIME.md).

### Metadata and search: Stage 2/5

Version 6.0.2 adds a shared, revision-aware metadata index and worker-based prompt-text search. The active preset search defaults to names, categories, tags, groups, badges and tooltips; check **Search prompt text** to search full bodies in a separate Worker. Text search has a bounded index, stale-result protection, chunked uploads and idle eviction. Browser/worker errors are shown explicitly rather than falling back to a blocking whole-preset scan.

Small simple comment fields have a generation-only fast path. Complex macros remain with ST; stored source and portable exports are not rewritten. Metadata declared later in a prompt is preserved, not truncated to a header limit.

Update and reload to receive Stage 2; it does not require another preset import. See the [five-stage progress and validation tracker](docs/PERFORMANCE_STAGES.md). Diagnostics: `window.NemoPromptPerformance?.getStats()`. Closed-section DOM is not unloaded yet; that is Stage **5B/5**.

### Disabled prompt bodies: Stage 3/5

Version 6.0.3 adds durable ordinary-prompt source packs. Reimport a portable Nemo Full or Lite through the Chat Completion importer after updating/reloading for complete import-time conversion. Eligible disabled prompts keep lightweight metadata shells; enabled prompts and open editors load the original text before use. Disabling an unchanged prompt releases its body without another upload. Edits are verified in server-side storage before eviction; if storage fails, the full edit remains available for native saving.

Native toggles, dependency/generation preflight, the prompt editor, Save Prompt to archive, worker text search, and full/partial portable exports are integrated. Missing required source blocks generation or export rather than silently sending a shell. Text search does not hydrate cold bodies into the active preset. Existing native system/quick fields, markers, initializer libraries and the recipe loader remain outside ordinary-prompt storage; Stage 4 separately handles the supported Vex libraries.

Back up the ST user files directory with presets. Export portable before disabling/uninstalling or moving to another ST server. Clearing browser data does not delete server-side source packs. Diagnostics: `window.NemoColdPrompts?.getStats()`. See [storage behavior, integration boundaries and validation](docs/COLD_PROMPTS.md). Automated tests do not replace the still-pending live ST browser smoke test.

### Vex libraries: Stage 4A/5 and 4B/5

Stage **4A/5 (1/2)** added the inert, verified Vex source store. Version 6.0.4 adds **4B/5 (2/2)**, connecting that same store to import, exact selected-setter loading and portable export. The five library bodies become small stubs only after their original source is verified in authenticated server files. Original selectors, reset, family/route resolver and assembler are retained. A restricted isolated preflight identifies needed fields; native ST executes their original assignments and unchanged control program, with selection and route checks that reject divergence.

Only one prepared route, its required setter strings and a small scalar/offset catalog are cached. Full and partial portable exports restore the original Vex bodies in the export copy, alongside the recipe and cold-prompt restorers. Unsupported program edits, missing/corrupt source and stale selection are explicit errors, not alternate councils.

Update/reload, export your current configuration portable, then reimport Full through the Chat Completion preset importer. Lite and Tavo have no matching Vex library and are unchanged by this stage. This completes implementation through **4/5**, not browser validation: native macro-engine checks and end-to-end timings remain pending. Diagnostics: `window.NemoVexRuntime?.getStats()`. See [Stage 4B runtime scope, usage and validation](docs/VEX_RUNTIME.md).

### Prompt rendering and virtualization: Stage 5/5

Version 6.0.5 added incremental native Prompt Manager rendering: unchanged frames and rows are reused, while changed visual rows are regenerated through SillyTavern's own renderer and handlers. Version **6.0.6** completes Stage 5 by virtualizing ordinary prompt rows inside closed sections. Section headers remain resident; opening a section regenerates only its direct rows through the native renderer, and closing it releases those row nodes instead of retaining detached DOM.

Snapshots, section controls, tray membership, Prompt Navigator discovery, prompt toggles and movement/reordering now use canonical native prompt state rather than assuming every prompt has a live row. Accordion drag/drop is initialized only for materialized sections. Search temporarily materializes matching rows and clearing search restores normal open/closed residency. Disabling **Optimized prompt rendering** restores the complete native row list.

The optimization applies to supported Chat Completion Prompt Managers with at least 64 ordered rows. Unsupported native row contracts or explicit opt-out keep the native rendering path. Source bodies, generation, macros and tokenization behavior are not rewritten by Stage 5.

Update and reload; no additional preset reimport is needed for Stage 5. Diagnostics: `window.NemoPromptRendering?.getStats()`. The repository suite passes 362/362 tests and the injected Chromium boundary harness passes 28 cases, including closed-row eviction, native materialization, partial-residency redraws and cleanup restoration. This completes the **5/5 implementation plan**; live SillyTavern validation and end-to-end timing/memory measurement remain separate pending validation work. See [rendering details](docs/PROMPT_RENDERING.md), [virtualization details](docs/PROMPT_VIRTUALIZATION.md), and the [five-stage tracker](docs/PERFORMANCE_STAGES.md).

## Nemo Hub

Hub installs use SillyTavern's native global extension installer. The first third-party installation may show SillyTavern's standard security confirmation. Reload after installation.

## Migration

Version 6 merges NemoPromptTools back into NemoPresetExt.

- Existing `extension_settings.NemoPromptTools` choices and prompt data are copied into `extension_settings.NemoPresetExt` once.
- The standalone namespace is preserved so downgrades remain reversible.
- Existing standalone users receive the Modern interface mode by default.
- Existing localStorage prompt metadata is migrated into extension settings by the established storage migration.
- The migration does not delete existing browser-stored data; source namespaces and localStorage records remain available for downgrade recovery.
- Legacy global APIs remain available through `window.NemoPromptTools`, `window.NemoPresetManager`, and `window.NemoPromptManager`.

## Troubleshooting

- Confirm the installed folder is named `NemoPresetExt` exactly.
- Reload after changing prompt feature switches. Reasoning-section and lorebook-section visibility changes apply immediately.
- Interface mode changes apply immediately.
- With Chat Completion Tabs active, look for Nemo prompt tools under **Prompts** and the authoritative reasoning controls under **Parameters**.
- Run `window.NemoPromptTools?.getCompatibilityState?.()` in the browser console to inspect the current adapter state.
- During the migration window, update the standalone NemoPromptTools extension so it can detect the merged runtime and safely stand down.
- Use a current SillyTavern build containing `scripts/autocomplete/AutoComplete.js`.
