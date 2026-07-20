# NemoPresetExt

NemoPresetExt is a modular workflow and interface extension for SillyTavern. It adds focused prompt, preset, character, reasoning, lorebook, writing, model, media, and onboarding tools while keeping the new-user experience intentionally small.

**Version:** 4.7.0

**Author:** @NemoVonNirgend

**Homepage:** https://github.com/NemoVonNirgend/NemoPresetExt

## What starts enabled

A new installation enables only six feature groups:

| Feature | Default | Where to use it |
| --- | --- | --- |
| Prompt Dropdowns & Tools | **On** | Advanced Formatting > Prompt Manager |
| Preset Navigator | **On** | **Browse...** beside a supported preset selector |
| Character Card Navigator | **On** | **Browse** in the character drawer |
| Improved Reasoning Capture | **On** | Runs automatically on generated reasoning blocks |
| Prompt Directives | **On** | Add `{{// @directive value }}` comments to prompts |
| Directive Autocomplete | **On** | Type `{{// @` in the prompt editor |

Everything else—including every broad UI overhaul—is off for new users. This keeps SillyTavern's native layout intact until a user deliberately opts in.

Existing installations keep explicit choices and the historical behavior inferred from their pre-schema settings. The migration does not overwrite a setting the user already chose.

## Quick start

1. Install the extension from its GitHub URL with SillyTavern's extension installer, or place this folder at `public/scripts/extensions/third-party/NemoPresetExt`.
2. Refresh SillyTavern.
3. Open **Extensions > NemoPreset UI Extensions** to review feature toggles.
4. Enable only the optional tools you want, then refresh when the setting says **Requires refresh**.

The settings card always mounts in SillyTavern's native Extensions settings area. The optional **Extensions Tab Overhaul** only changes how extensions are browsed; it is not required to configure NemoPresetExt.

## Feature guide

### Prompt Dropdowns & Tools

Default: **On** (`enablePromptManager`)

This is the core prompt-management bundle. It adds:

- prompt name/content search, filtering, and tooltips;
- collapsible sections with enabled/total counts and per-section enable-all;
- tray-overlay and inline-accordion section views;
- drag-and-drop prompt and section ordering;
- prompt folders, cross-section moves, and a category tray;
- prompt archive browsing and restoration;
- snapshots for saving and reapplying prompt enabled states;
- quick controls for expanding sections and changing views.

To create a section, name a prompt like `=== Character Rules ===`. A name such as `< Dialogue >` becomes a sub-header. Built-in divider styles include equals-sign and line-style headings; additional comma-separated regular-expression patterns can be saved under **Customization Options > Custom Divider Patterns**.

Choose **Tray Overlay** to open a floating section panel or **Accordion List** to expand prompts in place. The default palette follows SillyTavern theme variables; **Nemo Blue** is available as an alternative. Search and the other prompt tools remain part of this always-on bundle regardless of dropdown style.

### Preset Navigator

Default: **On** (`enablePresetNavigator`)

The navigator adds **Browse...** beside supported API preset selectors. Its browser provides search, quick-look, import, grid/list views, sorting, filters, favorites, nested/color folders, custom images, drag-and-drop organization, and bulk metadata actions. Selecting a preset still goes through SillyTavern's preset control; NemoPresetExt stores only its organization metadata separately.

Use it by opening the connection/API settings, clicking **Browse...**, then single-clicking to select or double-clicking to apply a preset. Supported selector families include Chat Completion, NovelAI, Kobold, Text Completion, Anthropic/Claude, Google, Scale, Cohere, Mistral, AIX, and OpenRouter where those controls exist in the installed SillyTavern build.

### Character Card Navigator

Default: **On** (`enableCharacterNavigator`)

The character drawer gains a **Browse** button. The browser supports name/tag search, grid/list views, sorting, favorites, nested folders, uncategorized filtering, drag-and-drop and bulk organization, and opening an installed character or group.

Folders and favorites organize the locally installed character list; they do not move or rewrite the underlying character-card files. Character navigation metadata is stored locally in the browser.

### Prompt Directives

Default: **On** (`enableDirectives`)

Directives are comments embedded in prompt text. They can describe a prompt, validate relationships between prompts, or change prompt state at configured message counts. Directive comments are metadata and are not intended to be sent as prompt content.

```text
{{// @tooltip Controls the character's personality }}

{{//
@requires CharacterDefinition
@conflicts-with AlternatePersonality
@category Character
@badge CORE
}}
```

The supported runtime includes:

- display metadata such as `@tooltip`, `@badge`, `@color`, and `@highlight`;
- validation such as `@requires`, `@exclusive-with`, `@conflicts-with`, category limits, mutual-exclusion groups, warnings, and deprecation notices;
- explicit resolution with `@auto-enable-dependencies` and `@auto-disable`;
- message triggers such as `@enable-at-message`, `@disable-at-message`, `@message-range`, `@enable-after-message`, and `@disable-after-message`.

When a hard relationship is violated, NemoPresetExt offers the applicable action and saves changes through SillyTavern's current PromptManager API. SillyTavern remains the source of truth for whether a prompt is enabled.

Some compatibility fields are parsed as metadata but do not mutate state in the supported runtime. In particular, `@default-enabled`, conditional-visibility fields, and load-order hints should not be treated as automation. See [FEATURES.md](FEATURES.md#5-directive-system) for the parsed directive reference.

### Directive Autocomplete

Default: **On** (`enableDirectiveAutocomplete`)

Autocomplete is intentionally limited to directive comments so it does not replace SillyTavern's normal macro suggestions. Type `{{// @` in a prompt editor; use the arrow keys to navigate, Enter or Tab to insert, and Escape to close. Multiline directive comments can suggest directive names, prompt identifiers, and known values on each directive line.

This setting depends on **Prompt Directives**. Turning off the master directive setting also prevents directive autocomplete from starting.

### Improved Reasoning Capture

Default: **On** (`enableReasoningCapture`)

Reasoning capture first defers to SillyTavern's strict native parser, then applies conservative fallbacks when native parsing cannot recognize the output. It handles reasoning blocks that begin the message, common tag variants, DeepSeek-style answer separation, explicit unclosed-block boundaries, and structured NemoNet/Council output.

Captured reasoning is stored in the message's native reasoning metadata, synchronized into the active swipe, and rendered through SillyTavern's own UI. Existing provider reasoning is never overwritten. Tags embedded in normal prose or code examples stay visible, and an ambiguous or empty split leaves the message untouched.

Detailed parser setup and format examples are in [reasoning/README.md](reasoning/README.md) and [reasoning/docs/REASONING_SETUP.md](reasoning/docs/REASONING_SETUP.md).

### Unified Reasoning Section

Default: Off (`enableReasoningSection`)

This adds a consolidated reasoning drawer beside the prompt manager. It mirrors SillyTavern's reasoning controls—auto-parse, visibility, adding prior reasoning to prompts, maximum additions, request-model-reasoning, effort, template, prefix, suffix, and separator—so they can be managed in one place. It reorganizes existing controls; it is separate from the default-on reasoning parser.

Enable it, then use the **Reasoning** drawer under Advanced Formatting. It updates without requiring a separate reasoning backend.

### Quick Lorebook Access

Default: Off (`enableLorebookManagement`)

This adds a **Lorebook Management** drawer near the prompt manager. It mirrors SillyTavern's global World Info selector so active lorebooks can be added or removed without leaving Advanced Formatting. Changes stay synchronized with the native selector.

This is a compact access panel, not the full lorebook editor and not the same feature as the Lorebook UI Overhaul.

### Lorebook UI Overhaul

Default: Off (`enableLorebookOverhaul`)

The overhaul replaces the visible World Info workspace with a responsive, searchable two-column layout while continuing to use SillyTavern's current World Info APIs. It provides:

- a searchable lorebook sidebar and explicit loading, empty, ready, and error states;
- native entry editing plus multi-selection and bulk actions;
- entry presets, folders, and drag-and-drop organization;
- active-entry inspection and a multi-book order helper;
- a clearly scoped primary-keyword preview;
- keyboard navigation, focus-visible controls, dialog semantics, and a mobile sidebar.

The keyword preview is an inspection aid, not a complete reimplementation of SillyTavern's activation engine; constant entries, secondary/selective keys, probability, groups, recursion, and vectors remain outside that preview. Disabling or unloading the extension restores the native World Info panel and its listeners.

### HTML Trimmer

Default: Off (`enableHTMLTrimming`)

HTML Trimmer reduces old-message context size by replacing substantial HTML/CSS payloads with compact readable content. Before changing a message, it stores the original in extension-owned chat metadata so **Restore Trimmed** can put it back.

Enable **Auto-Trim Old HTML**, choose how many recent messages to keep untouched (2–20; an unset value behaves as 4), and use **Trim Now** or **Restore Trimmed** for manual control. Trimming runs after chat updates and skips recent or insignificant markup.

Because this changes stored chat message text, keep backups for important chats even though the extension maintains its own restoration metadata.

### NemoLore

Default: Off (`enableNemoLore`)

The older NemoLore runtime formerly bundled with NemoPresetExt is retired and no longer initializes. Install the maintained standalone NemoLore repository from the Nemo Extension Hub. Existing bundled local data is preserved while a versioned migration/export path is developed.

The retired source contained long-horizon memory, archive retrieval, preference learning, and optional model tools. These capabilities are being evaluated separately rather than running a second memory engine alongside standalone NemoLore. Its historical settings included:

- timeline compression and a configurable live-message window;
- a raw archive plus optional SillyTavern vector-storage retrieval;
- background memory jobs and selectable connection profiles;
- cross-chat preference evidence, review, acceptance, rejection, and a core-pack global variable;
- lorebook proposals and promotion workflows;
- optional NemoLore Guides tools for rules, scene assessment, planning, prose checks, DM notes, prompt advice, and custom tools;
- native tool-call, stealth-tool, or silent preflight workflows for compatible models.

Standalone NemoLore owns current memory behavior. Retired bundled data is not deleted when its old feature flag is disabled.

### Nemo Rewrite

Default: Off (`enableRewrite`)

Selecting text in a rendered chat message opens a floating menu with **Rewrite**, **Shorten**, **Expand**, **Custom**, and **Delete** actions. AI-assisted actions use the active SillyTavern backend, can stream into the selected span, can apply SillyTavern AI-output regex scripts, and support fixed or selection-aware token budgets. Recent rewrites have an undo path.

Optional edit notes can be kept locally and, when NemoLore is loaded, offered as preference evidence. The runtime can pause itself if the separate standalone rewrite extension is detected, avoiding two selection menus.

AI rewrite actions send the selected text and configured rewrite prompt to the active model and may incur normal provider usage costs.

### Italic Dialogue Rendering

Default: Off (`enableItalicDialogueRenderer`)

This formatter turns italic quoted dialogue such as `*"Hello there"*` into a dedicated styled dialogue span while preserving nested bold text. It updates rendered messages after chat events, deliberately skips fenced and inline code, and leaves the underlying message source intact.

Enable it and refresh; existing visible messages are re-rendered from their stored message text.

### Animated Backgrounds

Default: Off (`enableAnimatedBackgrounds`)

This adds video/YouTube background conveniences without taking ownership of SillyTavern's normal image-background library.

- GIF, WebP, APNG, and ordinary images continue through the native background workflow.
- YouTube links use a privacy-enhanced embed with mute, loop, autoplay, and fitting controls.
- Source video uploads require the separate **Video Background Loader** add-on. That add-on supplies SillyTavern's conversion hook, and the selected video is saved as animated WebP rather than as its original container.
- Saved YouTube shortcuts belong to NemoPresetExt; native background folders and sorting remain owned by SillyTavern.

Enable the feature and refresh, then open the background panel. Paste a YouTube URL into the added URL control, or use SillyTavern's native upload control after installing Video Background Loader.

### Pollinations Image Interceptor

Default: Off (`nemoEnablePollinationsInterceptor`)

The interceptor detects `image.pollinations.ai/prompt/...` URLs in messages, extracts the encoded scene prompt, and regenerates the image with the image-generation backend already configured in SillyTavern. It queues work, retries transient failures, supports click-to-regenerate, saves the generated file, and updates the displayed message image.

Choose an optional style preset and keep SillyTavern's own image prompt prefix/suffix. This feature uses the configured SD, DALL-E, Horde, NovelAI, or other supported image backend rather than treating the Pollinations URL as the final asset; normal backend costs and content policies apply.

#### Image Prompt Consistency Boost

Default: Off (`nemoPollinationsPromptBestPractices`)

When the interceptor is enabled, this option inserts editable positive guidance for composition, anatomy, character consistency, lighting, and finish before the cleaned scene prompt. It also appends editable negative artifact guidance after SillyTavern's negative prompt. **Reset Image Guidance** restores the bundled phrases.

This setting has no independent effect while the Pollinations interceptor is off.

### Connection Panel Organization

Default: Off (`enableConnectionPanelOverhaul`)

This experimental layout groups context, instruct, response, model, API, sampling, and prompt controls into clearer drawers, groups Nemo-suite extensions, and animates the Stop control while generation is active. It only reorganizes the existing connection panel and leaves SillyTavern's native layout untouched when disabled. Enable it and refresh.

### Enhanced Model Selector

Default: Off (`enableModelSelector`)

This replaces supported provider/model selects with provider tabs and searchable model cards. It adds cross-provider search, favorites, recent/quick-switch chips, a matching Text Completion selector, a Nemo Stack pipeline panel, and a way to revert to the native selectors. The original SillyTavern selects are hidden rather than deleted and are restored when the feature is torn down.

Enable it and refresh after your provider lists and credentials are configured in SillyTavern.

### API Router and Model Pipeline

Default: Off (`enableApiRouter`)

This is an advanced integration foundation. It loads a persistent connection pool, a request router, pipeline presets, and the multi-stage model pipeline used by Nemo Stack tooling. A pipeline can assign different provider/model connections to recall, analysis, parallel drafting, and consolidation stages without mutating the globally selected model for each routed request.

Enabling the flag exposes `NemoConnectionPool`, `NemoApiRouter`, `NemoModelPipeline`, and `NemoPipelinePresets` for compatible UI and integrations. It does **not** silently route ordinary SillyTavern generations or make every provider interchangeable. Configure and test saved connections before using a pipeline; each stage can make a billable model request.

### NemoEngine Installer

Default: Off (`enableNemoEngineInstaller`)

The settings panel gains an installer for the bundled **Nemo Engine 9.3.1** Chat Completion preset. **Install / Update** validates the bundled JSON, saves or updates the preset through SillyTavern, and can select it. **Run Setup Wizard** checks the installed preset, active selection, and NemoLore/NemoGuides core-pack variable slots. The guide button opens the bundled setup walkthrough.

The installer never runs merely because its feature flag is on; the user must click an install or setup action. Updating an identically named preset intentionally changes that preset, so export a copy first if you customized it.

### Nemo Marketplace

Default: Off (`enableMarketplace`)

A store button opens a searchable, category-filtered catalog of curated extensions, presets, lorebooks, characters, tools, themes, guides, and community links. Its Prompt Library view can fetch version-pinned Nemo Engine, NemoNet, and Atelier prompt files from GitHub and import normalized prompts into SillyTavern's PromptManager. An imported prompt with an existing identifier is updated rather than duplicated.

Opening external recommendations or loading the Prompt Library requires internet access. Review third-party projects and imported prompt text before using them.

### Persona UI Enhancements

Default: Off (`enablePersonaEnhancements`)

This keeps SillyTavern's existing Persona Management drawer but reorganizes its action buttons into edit, management, and destructive groups. It also improves connection buttons and the temporary-persona banner, adds a persona count, and makes global persona settings collapsible. The original element order is restored on teardown.

### Emoji Picker

Default: Off (`enableEmojiPicker`)

An emoji button appears beside the message composer. The picker supports search, categories, favorites, recent emoji, skin-tone selection, keyboard focus, and lazy rendering for the large emoji list. Clicking an emoji inserts it into the current message draft. Favorites, recents, and picker preferences are saved in extension settings.

### Settings Tab Overhauls

Default: Off (`enableTabOverhauls`)

This reorganizes **User Settings** and **Advanced Formatting** into tabs to reduce scrolling. It moves native settings controls into grouped views rather than cloning their behavior, and restores the original layout during teardown. Enable it and refresh.

### Extensions Tab Overhaul

Default: Off (`nemoEnableExtensionsTabOverhaul`)

This adds search, a two-column categorized browser, collapsible groups, custom folders with right-click moves, and specialized layouts for Image Generation, Quick Replies, Regex, TTS, Vectors, and Summary. It does not control where NemoPresetExt's own settings are mounted. Enable it and refresh; leaving it off preserves SillyTavern's native Extensions UI.

### Wide Navigation Panels

Default: Off (`nemoEnableWidePanels`)

Left and right navigation panels expand to approximately half of the viewport for large-screen workflows. The extension automatically avoids the wide layout on small/mobile viewports. This setting can update live.

### Mobile UI Enhancements

Default: Off (`enableMobileEnhancements`)

On coarse-pointer/touch devices, this applies larger touch targets, more readable spacing, and mobile-specific layout adjustments. Pointer capability is monitored so the class can be removed when the device no longer matches. Enable it and refresh.

### Tutorials and Welcome Guide

Default: Off (`enableTutorials`)

The optional visual-novel-style tutorial system uses Vex to present guided walkthroughs, highlighted controls, progress tracking, replay, and skip controls. When—and only when—the tutorial feature is enabled, the launcher may offer the first-run welcome guide and the tutorial browser.

The welcome guide does not auto-start on a default new installation because the entire tutorial runtime is opt-in.

## Appearance and behavior options

These are settings rather than independent feature flags:

- **Section Dropdown Style:** **Tray Overlay** (default) or **Accordion List**; updates live.
- **Section Dropdown Theme:** **SillyTavern Theme** (default) or **Nemo Blue**; updates live and exposes `--nemo-dropdown-*` CSS variables.
- **UI Theme Overhaul:** **None** (default), Windows 98, Discord, Cyberpunk, or NemoTavern. These are cosmetic whole-interface themes, are suppressed on mobile-width displays, and require a refresh. NemoTavern also provides its glass layout, floating panels, unified settings surface, and `Ctrl/Cmd+K` command palette.
- **Message Theme:** Default plus Cheerful, Divine, Fantasy, Royal, Steampunk, Solarpunk, Goth, Pastel, Passionate, Horror, Melancholy, Romance, Cyberpunk, and two dyslexia-friendly variants.
- **Custom Divider Patterns:** adds comma-separated regular-expression patterns to the prompt section detector.
- **Pollinations Style and Guidance:** chooses an image style layer and editable positive/negative prompt guidance for intercepted images.

A small compatibility adjustment is always active for custom OpenAI-compatible endpoints: NemoPresetExt makes SillyTavern's Top K control available for that source and omits zero-valued penalty fields that some endpoints reject. It does not alter non-custom Chat Completion requests.

## Complete settings reference

The table below is the canonical new-install state. Most feature toggles should be followed by a page refresh; live controls are called out in the feature guide.

| Setting key | New install | Feature |
| --- | --- | --- |
| `enablePromptManager` | **On** | Prompt Dropdowns & Tools |
| `enablePresetNavigator` | **On** | Preset Navigator |
| `enableCharacterNavigator` | **On** | Character Card Navigator |
| `enableReasoningCapture` | **On** | Improved Reasoning Capture |
| `enableDirectives` | **On** | Prompt Directives |
| `enableDirectiveAutocomplete` | **On** | Directive Autocomplete |
| `enableAnimatedBackgrounds` | Off | Animated Backgrounds |
| `enableTabOverhauls` | Off | Settings Tab Overhauls |
| `enableConnectionPanelOverhaul` | Off | Connection Panel Organization |
| `nemoEnableExtensionsTabOverhaul` | Off | Extensions Tab Overhaul |
| `enableLorebookOverhaul` | Off | Lorebook UI Overhaul |
| `enableReasoningSection` | Off | Unified Reasoning Section |
| `enableLorebookManagement` | Off | Quick Lorebook Access |
| `enableHTMLTrimming` | Off | HTML Trimmer |
| `nemoEnableWidePanels` | Off | Wide Navigation Panels |
| `enableMobileEnhancements` | Off | Mobile UI Enhancements |
| `enableModelSelector` | Off | Enhanced Model Selector |
| `nemoEnablePollinationsInterceptor` | Off | Pollinations Image Interceptor |
| `nemoPollinationsPromptBestPractices` | Off | Image Prompt Consistency Boost |
| `enableEmojiPicker` | Off | Emoji Picker |
| `enableMarketplace` | Off | Nemo Marketplace |
| `enablePersonaEnhancements` | Off | Persona UI Enhancements |
| `enableNemoLore` | Off | NemoLore |
| `enableRewrite` | Off | Nemo Rewrite |
| `enableTutorials` | Off | Tutorials and Welcome Guide |
| `enableNemoEngineInstaller` | Off | NemoEngine Installer |
| `enableItalicDialogueRenderer` | Off | Italic Dialogue Rendering |
| `enableApiRouter` | Off | API Router and Model Pipeline |

The source of truth for these values is [`core/feature-settings.js`](core/feature-settings.js). Boolean gates require the literal value `true`; truthy strings or numbers do not activate a feature.

## Storage, network, and model effects

- Preset and character folders/favorites are extension organization metadata; they do not move the underlying files.
- Prompt snapshots, emoji preferences, connection pools, and most UI choices are saved with extension settings or local browser storage.
- HTML Trimmer writes restorable backups into chat metadata before trimming.
- NemoLore uses local feature storage and can write to SillyTavern vector storage and configured core-pack variables when those options are enabled.
- Marketplace prompt loading contacts GitHub; YouTube backgrounds contact YouTube; external recommendation links open their respective sites.
- Rewrite, NemoLore model work, API pipelines, and intercepted image generation call the backends configured in SillyTavern and may incur provider costs.

## Updating

When installed through SillyTavern's extension manager, use its update action and refresh the page. For a manual install, replace the extension files with the new release while preserving the folder name, then refresh. Extension settings are schema-migrated without overwriting explicit choices.

Do not copy a new release over a partially modified working tree unless you have backed up those changes.

## Troubleshooting

### A toggle appears to do nothing

Refresh the page after changing it. Many modules attach to SillyTavern controls only during startup. Also confirm the master dependency is enabled—for example, directive autocomplete needs Prompt Directives, and image prompt guidance needs the Pollinations interceptor.

### The settings card is missing or malformed

Look under SillyTavern's native Extensions settings area; the Extensions Tab Overhaul is not required. Confirm the extension is enabled, the folder is named `NemoPresetExt`, and `manifest.json`, `content.js`, `settings.html`, and `styles.css` are at the folder root. Then check the browser console for the first NemoPresetExt error.

### Browse buttons are missing

Open the relevant native panel at least once and wait for its controls to render. The preset navigator only attaches to supported preset selectors; the character navigator attaches to the installed-character drawer. Refresh after changing either feature flag.

### Reasoning is not separated

Enable SillyTavern's reasoning auto-parse controls, verify the configured prefix/suffix, and keep narrative outside `<think>...</think>`. See the reasoning setup guide linked above for model-specific examples.

### A video background will not upload

Install and enable Video Background Loader. NemoPresetExt supplies YouTube playback, but source-video conversion is deliberately delegated to that add-on and SillyTavern's native upload flow.

### NemoLore tools or retrieval do not run

Configure a usable memory/preflight connection profile. Vector retrieval also needs vector-storage support, while native Guides tool calls need a tool-capable backend. Use NemoLore's status, queue, inspector, and setup checks before enabling automatic workflows.

## More documentation

- [FEATURES.md](FEATURES.md) — implementation-oriented feature and settings reference
- [NEMO_ENGINE_SETUP.md](NEMO_ENGINE_SETUP.md) — bundled Nemo Engine setup guide
- [reasoning/README.md](reasoning/README.md) — reasoning parser overview
- [reasoning/docs/REASONING_SETUP.md](reasoning/docs/REASONING_SETUP.md) — reasoning configuration and examples
- [features/nemolore/docs/ARCHITECTURE.md](features/nemolore/docs/ARCHITECTURE.md) — NemoLore architecture

## Support

Use the [GitHub repository](https://github.com/NemoVonNirgend/NemoPresetExt) for issues, feature requests, and contributions. When reporting a problem, include the NemoPresetExt version, SillyTavern branch/version, enabled feature flags, the first relevant browser-console error, and reproduction steps.

## License

This extension is provided as-is for use with SillyTavern. See the repository for the current license information.
