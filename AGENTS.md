# Agent Guide for NemoPresetExt

## Project Context
**NemoPresetExt** is a specialized extension for **SillyTavern** (a frontend for LLMs). It enhances prompt management, UI organization, and adds features like "NemoNet" reasoning parsing and animated backgrounds.

## Codebase Structure
- **Root**: Contains `manifest.json` (extension config), `content.js` (entry point), and `styles.css`.
- **`core/`**: Fundamental logic, utilities, and event bus.
- **`features/`**: Modular features (directives, backgrounds, onboarding, prompts).
- **`ui/`**: UI component logic (settings tabs, theme manager).
- **`reasoning/`**: The "NemoNet" reasoning parser logic and documentation.
- **`themes/`**: CSS and JS for specific themes (Win98, Discord, Cyberpunk).
- **`lib/`**: Third-party libraries (Sortable, Diff2Html).
- **`archive/`**: Deprecated code. **Do not use or reference files in this folder unless migrating.**

## Development Workflow
- **No Build Step**: This project uses raw ES Modules. You edit the `.js` files directly.
- **Testing**:
  - Changes require reloading SillyTavern (F5/Refresh).
  - No automated test runner is visible in the root (manual testing primarily).
  - `reasoning/test-reasoning-parser.js` exists for the reasoning feature.
- **Environment**: Runs in the browser context of SillyTavern.

## Key Conventions & Patterns
1.  **Globals**: The extension relies on SillyTavern's global objects:
    - `extension_settings`: For storing user preferences.
    - `callGenericPopup`: For UI modals.
    - Imports from SillyTavern core often look like `../../../../utils.js`. **Do not change these paths** without verifying the relative distance to the SillyTavern root.

2.  **Logging**:
    - Use `LOG_PREFIX` (from `core/utils.js`) for all console logs: `console.log(\`\${LOG_PREFIX} Message\`)`.
    - Prefixed usually as `[NemoPresetExt]`.

3.  **DOM Manipulation**:
    - The UI is dynamic. Use `waitForElement` (from `core/utils.js`) when targeting elements that might not exist yet.
    - `requestIdleCallback` is used for non-blocking operations (like saving to localStorage).

4.  **Settings**:
    - Settings arenamespaced under `NemoPresetExt` in `extension_settings`.
    - Use `ensureSettingsNamespace()` to initialize defaults.

5.  **Reasoning Parser**:
    - Logic resides in `reasoning/`.
    - Config is in `reasoning/nemonet-reasoning-config.js`.

## Common Tasks
- **Adding a new feature**:
    1. Create logic in `features/<feature_name>/`.
    2. Register it in `content.js` or the relevant manager.
    3. Add settings toggle in `core/utils.js` (defaults) and `ui/settings-ui.js` (UI).
- **Styling**:
    - Use `styles.css` for global styles.
    - Theme-specific styles go in `themes/`.

## Gotchas
- **Relative Imports**: Be extremely careful with relative paths when moving files. The directory structure is deep.
- **Manifest**: `manifest.json` controls the file loading order (`loading_order: 1000`).
- **Archive**: Ignore `archive/` folder. It contains legacy code.
