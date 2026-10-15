# Nemo Engine Setup

NemoPresetExt 6.0.14 includes four verified Nemo Engine v12.1 releases. Each is bundled with the extension and checked against its release checksum before importing.

| Edition | Controls | Spacing |
| --- | --- | --- |
| Standard (recommended) | Direct Vex and writing controls | Ordinary spaces |
| Standard · Braille spaces | Standard controls and context-conversion rules | Braille spaces |
| Full | Combined Vex Council selection and Genre × Author × Style recipes | Ordinary spaces |
| Full · Braille spaces | Full controls and context-conversion rules | Braille spaces |

## One-click import and processing

1. Update NemoPresetExt and fully reload SillyTavern.
2. Open **Extensions → NemoPresetExt → Nemo Engine Preset Installer**.
3. Choose an edition, then click **Import and process**.
4. Wait for **Setup is ready**. The imported edition is saved and selected in the Chat Completion preset dropdown.

The installer verifies the bundled file, runs the normal preset import processing, saves prompt-body storage, and prepares Vex and writing-recipe storage for Full editions. Processing must finish before the preset is saved or selected. Full editions may take longer on their first import.

Every edition has a separate preset name. **Reimporting replaces the installed copy of that edition.** Save custom edits under another preset name before reinstalling. Installing one edition does not replace a differently named edition.

**Check / repair selected edition** checks its installation and processing receipt, installs it if needed, and selects it. Opening extension settings alone does not import or process anything.

## If installation stops

- Enable automatic prompt-body storage; Full editions also require the Vex and writing-recipe runtimes. Reload SillyTavern after updating the extension.
- If a bundled file is missing, incomplete, or fails its checksum, update the extension and retry. An unknown or changed file is not installed as a verified release.
- If processing or saving fails, the installer shows the error without selecting the failed import. Resolve the error and retry **Import and process**.
- A current browser with gzip decompression support is required. If the installer reports that it cannot unpack presets, update the browser.

## First-use checks

1. Open Advanced Formatting / Prompts and confirm NemoPresetExt prompt section dropdowns are visible.
2. Pick one active option per exclusive section, such as style, genre, language, and tracker profile.
3. Send a short test message and check that the output matches the selected prompt sections.

Provider credentials remain configured in SillyTavern. Enable NemoLore systems and provider-compatible function/tool calling only if you want NemoLore Guides tool calls.

Processed presets use files in the authenticated SillyTavern user's files directory. Back up those files along with your presets. Use the normal preset export to reconstruct a portable JSON before moving to another installation or disabling the extension.
