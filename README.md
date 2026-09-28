# NemoPresetExt

NemoPresetExt is the complete Nemo prompt workstation for SillyTavern. It combines prompt organization, preset and character navigation, reasoning capture, prompt directives, custom dividers, NemoEngine installation, and Nemo Hub in one extension.

**Version:** 6.0.4

**Homepage:** https://github.com/NemoVonNirgend/NemoPresetExt

## Installation

Install `https://github.com/NemoVonNirgend/NemoPresetExt` with SillyTavern's third-party extension installer, then reload. No SillyTavern source modifications are required.

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

NemoUIOverhaul and NemoEmojiPicker remain separate because they alter broader SillyTavern presentation or composer behavior rather than the prompt workstation itself.

## Prompt directives

Directive metadata lives inside prompt comments such as `{{// @tooltip Example }}`. The adapter uses SillyTavern's native autocomplete surfaces only while editing directive comments, leaving ordinary macro autocomplete in control elsewhere.

## Custom dividers

Add comma-separated regular expressions under **Custom dividers** and save. The merged prompt manager consumes the divider contract directly.

## NemoEngine

The installer adds or updates the bundled Nemo Engine Chat Completion preset without changing SillyTavern source. Its setup report validates bundled and installed prompt slots. Provider credentials remain owned by SillyTavern.

### Large-preset recipe runtime

Version 6.0.1 adds Stage **1/5** of the large-preset performance work. After updating and reloading the extension, import the portable Nemo Full JSON through the **Chat Completion preset import** button. Supported writing-recipe banks are verified and saved to separate files in the authenticated SillyTavern user's files directory before the compact preset is saved or selected. Runtime preparation loads only the selected recipe shard and retains at most two selected recipe setter strings. Normal export reconstructs the portable preset.

Existing raw Full installations need a one-time reimport. Back up the ST user files directory along with presets, and export portable before disabling the extension or transferring a preset to another installation. Vex libraries are handled by Stage 4/5 below; DOM virtualization remains a later stage. See [Recipe runtime usage, safety and validation](docs/RECIPE_RUNTIME.md).

### Metadata and search: Stage 2/5

Version 6.0.2 adds a shared, revision-aware metadata index and worker-based prompt-text search. The active preset search defaults to names, categories, tags, groups, badges and tooltips; check **Search prompt text** to search full bodies in a separate Worker. Text search has a bounded index, stale-result protection, chunked uploads and idle eviction. Browser/worker errors are shown explicitly rather than falling back to a blocking whole-preset scan.

Small simple comment fields have a generation-only fast path. Complex macros remain with ST; stored source and portable exports are not rewritten. Metadata declared later in a prompt is preserved, not truncated to a header limit.

Update and reload to receive Stage 2; it does not require another preset import. See the [five-stage progress and validation tracker](docs/PERFORMANCE_STAGES.md). Diagnostics: `window.NemoPromptPerformance?.getStats()`. Closed-section DOM is not unloaded yet; that is Stage **5/5**.

### Disabled prompt bodies: Stage 3/5

Version 6.0.3 adds durable ordinary-prompt source packs. Reimport a portable Nemo Full or Lite through the Chat Completion importer after updating/reloading for complete import-time conversion. Eligible disabled prompts keep lightweight metadata shells; enabled prompts and open editors load the original text before use. Disabling an unchanged prompt releases its body without another upload. Edits are verified in server-side storage before eviction; if storage fails, the full edit remains available for native saving.

Native toggles, dependency/generation preflight, the prompt editor, Save Prompt to archive, worker text search, and full/partial portable exports are integrated. Missing required source blocks generation or export rather than silently sending a shell. Text search does not hydrate cold bodies into the active preset. Existing native system/quick fields, markers, initializer libraries and the recipe loader remain outside ordinary-prompt storage; Stage 4 separately handles the supported Vex libraries.

Back up the ST user files directory with presets. Export portable before disabling/uninstalling or moving to another ST server. Clearing browser data does not delete server-side source packs. Diagnostics: `window.NemoColdPrompts?.getStats()`. See [storage behavior, integration boundaries and validation](docs/COLD_PROMPTS.md). Automated tests do not replace the still-pending live ST browser smoke test.

### Vex libraries: Stage 4/5

Version 6.0.4 externalizes the five static Vex library blocks in the supported Nemo v12 Full schema. Original data is verified in authenticated ST server files before its prompt bodies become small loader stubs. The original selectors, family/route resolver and assembler remain intact: an isolated dependency preflight finds the required original setters, and ST executes those setters followed by the unchanged native program. Checks against actual native selection/route state block divergence instead of choosing an alternate council.

Only one prepared route and its required setter strings remain cached, alongside a small scalar/dependency index. Source banks are read transiently rather than retained as a settled corpus. Full/partial portable exports restore the original library in the export copy, preserving literal edits and unrelated prompt changes. Unsupported control-program edits or missing/corrupt data produce explicit errors.

Update/reload, export the current configuration portable to preserve edits, and reimport that Full file through the Chat Completion importer. Lite and Tavo contain no matching library and are unchanged by this stage. Back up server-side files with presets; export portable before disabling the runtime or changing installations. Diagnostics: `window.NemoVexRuntime?.getStats()`. See [Vex runtime boundaries, validation and usage](docs/VEX_RUNTIME.md). This completes implementation through **4/5**; DOM/rendering work is **5/5**, and native browser validation remains pending.

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
