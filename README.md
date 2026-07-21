# NemoPresetExt

NemoPresetExt is the small core package for Nemo prompt directives, custom divider configuration, NemoEngine installation, and Nemo Hub.

**Version:** 5.1.0

**Homepage:** https://github.com/NemoVonNirgend/NemoPresetExt

## Installation

Install `https://github.com/NemoVonNirgend/NemoPresetExt` with SillyTavern's third-party extension installer, then reload. No SillyTavern source modifications are required.

## Core features

- Prompt directives and runtime validation hooks.
- Directive suggestions through SillyTavern's native autocomplete components.
- Custom prompt-divider patterns at the top of the settings drawer.
- NemoEngine preset installer and setup report.
- Nemo Hub for optional Nemo extensions.

New-install defaults:

- `enableDirectives`: `true`
- `enableDirectiveAutocomplete`: `true`
- `enableNemoEngineInstaller`: `true`

## Optional extensions

Install these independently from Nemo Hub:

| Extension | Features |
| --- | --- |
| [Nemo Prompt Tools](https://github.com/NemoVonNirgend/NemoPromptTools) | Preset and character navigation, prompt dropdowns/tools, improved reasoning capture. |
| [Nemo UI Overhaul](https://github.com/NemoVonNirgend/NemoUIOverhaul) | Backgrounds, settings/connection/extensions/lorebook UI, wide/mobile panels, model selector, and themes. |
| [Nemo Emoji Picker](https://github.com/NemoVonNirgend/NemoEmojiPicker) | Composer emoji picker. |
| [Nemo Image Generation](https://github.com/NemoVonNirgend/NemoImageGeneration) | Pollinations detection and automatic image workflows through SillyTavern providers. |
| [NemoLore](https://github.com/NemoVonNirgend/NemoLore) | Memory, summaries, retrieval, and lore maintenance. |
| [Ember](https://github.com/NemoVonNirgend/Ember) | Interactive HTML/JavaScript chat artifacts. |
| [NemoRewrite](https://github.com/NemoVonNirgend/NemoRewrite) | Selection-based rewriting tools. |

Every extracted package owns its settings namespace and native Extensions drawer. Compatible 4.x choices migrate on first launch.

## Prompt directives

Directive metadata lives inside prompt comments such as `{{// @tooltip Example }}`. The adapter uses SillyTavern's `AutoComplete`, `AutoCompleteNameResult`, and `AutoCompleteOption` surfaces only while editing directive comments, leaving ordinary native macro autocomplete in control everywhere else.

## Custom dividers

Add comma-separated regular expressions under **Custom dividers** and save. Nemo Prompt Tools consumes the core divider contract when installed.

## NemoEngine

The installer adds or updates the bundled Nemo Engine Chat Completion preset without changing SillyTavern source. Its setup report validates the bundled and installed prompt slots. Provider credentials remain owned by SillyTavern. The **Open Setup Guide** action opens `NEMO_ENGINE_SETUP.md` from this extension.

## Nemo Hub

Hub installs use SillyTavern's native global extension installer. The first third-party installation may show SillyTavern's standard security confirmation. Reload after installation.

## Migration from 4.x and 5.0

- Optional source and runtime ownership moved out of NemoPresetExt in 5.1.
- Legacy keys already stored in `extension_settings.NemoPresetExt` remain untouched so standalone packages can migrate them.
- Removing bundled code does not delete existing browser-stored data, localforage records, chats, presets, or extension settings.
- Custom divider patterns and prompt-directive settings remain in `extension_settings.NemoPresetExt`.

## Troubleshooting

- Confirm the installed folder is named `NemoPresetExt` exactly.
- Reload after every Hub install or feature-gate change.
- Complete SillyTavern's third-party extension warning if an install appears paused.
- Use a current SillyTavern build containing `scripts/autocomplete/AutoComplete.js`.
- If settings do not persist, check the `/api/settings/save` response in the browser network panel.
