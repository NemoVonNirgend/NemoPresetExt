# NemoPresetExt

NemoPresetExt is the complete Nemo prompt workstation for SillyTavern. It combines prompt organization, preset and character navigation, reasoning capture, prompt directives, custom dividers, NemoEngine installation, and Nemo Hub in one extension.

**Version:** 6.0.0

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
