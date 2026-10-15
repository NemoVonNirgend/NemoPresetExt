# Nemo Engine Setup

NemoPresetExt 6.0.14 bundles four compatible Nemo Engine v12.1 portable exports.

## One-click import

1. Update NemoPresetExt and fully reload SillyTavern.
2. Open **Extensions → NemoPresetExt → NemoEngine**.
3. Choose a preset edition and click **Import & Process**.
4. Wait for setup to finish. The imported edition is selected in the Chat Completion preset dropdown.

| Edition | Includes |
| --- | --- |
| Standard — ordinary spaces | Direct Vex, genre, author, and style controls. Recommended starting point. |
| Full — ordinary spaces | Standard systems plus combined Vex selection and Genre × Author × Style recipe libraries. |
| Standard — Braille spaces | Standard edition with Braille blanks in prompt prose and context conversion enabled. |
| Full — Braille spaces | Full edition with Braille blanks in prompts, recipes, and Vex text, plus context conversion. |

The Standard editions have 569 prompt entries. Full editions have 786. Each includes two prompt-order profiles and all 493 embedded regex scripts. The release filenames retain the spelling `[braile space]` for compatibility.

The installer verifies the selected file against its release checksum, runs SillyTavern's normal preset import event, and saves it as a Chat Completion preset. Nemo's prompt-body, recipe, and Vex processing runs through the existing import hooks, respecting runtime opt-outs in extension settings. Full editions need more processing on their first import. Only the chosen edition is read into memory.

Each import creates a fresh copy. If that name exists, the installer appends `(2)`, `(3)`, and so on. Customize and save your existing presets freely; importing a release does not overwrite them. **Run Setup Wizard** checks the selected edition and reselects its previous import when it is already current.

## Before your first generation

1. Confirm the imported preset is selected under **Chat Completion**.
2. Set context size, response budget, sampling, and reasoning controls for your actual model and endpoint. The exported values are not limits supported by every model.
3. Open Advanced Formatting / Prompts and confirm NemoPresetExt's sections are visible.
4. Choose one active option in each exclusive section. Keep initialization and resolver prompts enabled and in order.
5. Check the preset regex scripts, then send a short test message.

For a full section guide, see the [Nemo Engine v12.1 configuration reference](https://github.com/NemoVonNirgend/NemoEngine/blob/main/Nemo%20Engine/README.md).

## Troubleshooting

- **Bundled preset does not match this extension release:** update NemoPresetExt and fully reload SillyTavern. Avoid editing the bundled JSONs; customize the imported copy instead.
- **Import or storage failed:** the installer stops before saving an incomplete preset. Restore access to SillyTavern's user-file storage, then retry. The source export and existing presets are kept.
- **Not ready for Chat Completion imports:** wait for SillyTavern startup to finish and retry. Use a current version with the native preset import event.
- **Setup warnings:** read the individual checks. Optional NemoLore/NemoGuides slots do not enable those extensions automatically.

## Maintainer release updates

The four exact source exports are in `assets/nemo-engine/`. Full exports are stored in numbered UTF-8 parts, which the loader concatenates in order before verifying the original export checksum. Their edition names, part counts, prompt counts, byte sizes, and SHA-256 checksums live in `features/preset-installer/presets.js`. Replace assets and catalog metadata together when publishing a compatible release. Keep the Git attributes that preserve their bytes on Windows.

Run `node --test tests/preset-installer.test.js` and `node scripts/validate-preset-imports.mjs --bundled`. The import audit verifies fresh-runtime reimports and exact portable exports through the production storage hooks, including both prompt-order profiles. It does not exercise a live model or the native SillyTavern macro engine.
