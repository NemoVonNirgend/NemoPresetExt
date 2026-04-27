# Nemo Engine Setup

This extension bundles the latest Nemo Engine preset as `assets/nemo-engine-latest.json`.

## One-click install

1. Open SillyTavern extension settings.
2. Open `NemoPresetExt`.
3. Click `Install / Update Nemo Engine 9.3.1`.
4. Confirm `Nemo Engine 9.3.1` is selected in the Chat Completion preset dropdown.

The installer uses SillyTavern's normal `/api/presets/save` endpoint with `apiId: "openai"`, so the preset is saved exactly like a manual Chat Completion preset import.

## First-use checks

1. Open Advanced Formatting / Prompts.
2. Confirm NemoPresetExt prompt section dropdowns are visible.
3. Pick one active option per exclusive section, such as style, genre, language, and tracker profile.
4. Send a short test message and verify the output matches the selected prompt sections.

## NemoLore and Guides

The bundled preset keeps function calling and tool reasoning disabled by default. Normal preset use does not require them.

Enable NemoLore systems and provider-compatible function/tool calling only if you want NemoLore Guides tool calls.
