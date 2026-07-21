# NemoPresetExt

NemoPresetExt is the core package for Nemo prompt directives, custom divider configuration, NemoEngine installation, and Nemo Hub.

**Version:** 5.0.0

**Homepage:** https://github.com/NemoVonNirgend/NemoPresetExt

## Installation

Install `https://github.com/NemoVonNirgend/NemoPresetExt` with SillyTavern's extension installer, then reload SillyTavern. The extension must be installed globally under `public/scripts/extensions/third-party/NemoPresetExt` for Nemo Hub's global extension paths.

No SillyTavern source modifications are required. This release is tested against the current SillyTavern staging extension contract.

## Core features

- Prompt directives and their runtime validation hooks.
- Directive suggestions rendered through SillyTavern's native autocomplete components.
- Custom prompt-divider patterns, kept at the top of the settings drawer.
- NemoEngine installer and setup workflow.
- Nemo Hub for optional Nemo extensions.

New-install feature defaults:

- `enableDirectives`: `true`
- `enableDirectiveAutocomplete`: `true`
- `enableNemoEngineInstaller`: `false`

Legacy settings keys are retained only for migration compatibility. NemoPresetExt no longer initializes their optional runtimes.

## Optional extensions

Install these from Nemo Hub as needed:

| Extension | Features |
| --- | --- |
| [Nemo Prompt Tools](https://github.com/NemoVonNirgend/NemoPromptTools) | Preset navigator, character navigator, prompt dropdowns and tools, improved reasoning capture. |
| [Nemo UI Overhaul](https://github.com/NemoVonNirgend/NemoUIOverhaul) | Animated backgrounds, settings/connection/extension/lorebook UI, quick lorebook access, wide and mobile navigation, unified reasoning UI, model selector, customization. |
| [Nemo Emoji Picker](https://github.com/NemoVonNirgend/NemoEmojiPicker) | Searchable composer emoji picker. |
| [Nemo Image Generation](https://github.com/NemoVonNirgend/NemoImageGeneration) | Pollinations detection and automatic image generation through SillyTavern providers. |
| [NemoLore](https://github.com/NemoVonNirgend/NemoLore) | Memory, summaries, retrieval, and lore maintenance. |
| [Ember](https://github.com/NemoVonNirgend/Ember) | Interactive HTML/JavaScript chat artifacts. |
| [NemoRewrite](https://github.com/NemoVonNirgend/NemoRewrite) | Selection-based rewriting tools. |

## Prompt directives

Directive metadata lives inside prompt comments such as `{{// @tooltip Example }}`. Enable directives in NemoPresetExt settings. The autocomplete adapter uses SillyTavern's `AutoComplete`, `AutoCompleteNameResult`, and `AutoCompleteOption` surfaces and only activates inside Nemo directive comments, leaving ordinary macro autocomplete under SillyTavern control.

## Custom dividers

Add comma-separated regular expressions under **Custom dividers** and save. Nemo Prompt Tools reads this core setting when it organizes prompt sections, so divider ownership remains in NemoPresetExt even though the prompt browser is optional.

## NemoEngine

Enable the NemoEngine installer only when you want the guided preset installation workflow. Provider credentials remain owned by SillyTavern.

## Nemo Hub

Hub installs use SillyTavern's native global extension installer. The first third-party installation may show SillyTavern's standard security confirmation. Installed extensions require a page reload before their full UI is available.

## Migration from 4.x

- Optional feature settings are preserved but no longer cause bundled runtimes to initialize.
- Install the corresponding standalone extension from Nemo Hub to continue using an extracted feature.
- Custom divider patterns and prompt-directive settings remain in `extension_settings.NemoPresetExt`.
- Nemo Prompt Tools prefers the core divider setting and falls back to its own namespace only for compatibility.
- Existing NemoLore and NemoRewrite data remains untouched for their standalone migrations.

## Troubleshooting

- Confirm the folder name matches the repository name exactly.
- Reload after every install.
- If a Hub install appears to wait indefinitely, complete SillyTavern's third-party extension warning dialog.
- Check the first relevant browser-console error and verify `manifest.json` parses.
- Directive suggestions require a current SillyTavern build with the native autocomplete modules under `scripts/autocomplete/`.
