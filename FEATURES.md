# NemoPresetExt v4.7.0 - Feature Documentation

Comprehensive reference for all features, settings, and capabilities of the NemoPresetExt SillyTavern extension.

---

## Table of Contents

1. [Prompt Manager](#1-prompt-manager)
2. [Preset Navigator](#2-preset-navigator)
3. [Prompt Archive](#3-prompt-archive)
4. [Category Tray](#4-category-tray)
5. [Directive System](#5-directive-system)
6. [Animated Backgrounds](#6-animated-backgrounds)
7. [Reasoning Parser](#7-reasoning-parser)
8. [HTML Trimmer](#8-html-trimmer)
9. [Theme System](#9-theme-system)
10. [NemoTavern React UI](#10-nemotavern-react-ui)
11. [Tutorial System](#11-tutorial-system)
12. [World Info / Lorebook UI](#12-world-info--lorebook-ui)
13. [Character Manager](#13-character-manager)
14. [Panel Toggle](#14-panel-toggle)
15. [Pollinations Interceptor](#15-pollinations-interceptor)
16. [UI Enhancements](#16-ui-enhancements)
17. [Core Modules](#17-core-modules)
18. [Settings Reference](#18-settings-reference)
19. [Folder Structure](#19-folder-structure)

---

## 1. Prompt Manager

**Location:** `features/prompts/prompt-manager.js`
**Setting:** `enablePromptManager` (default: `true`)

The core feature of NemoPresetExt. Transforms SillyTavern's flat prompt list into an organized, searchable, collapsible interface. The default-on `enablePromptManager` bundle includes the search bar, dropdown sections, tray/accordion view controls, prompt folder navigator, archive, snapshots, tooltips, and drag-and-drop behavior.

### Capabilities

- **Collapsible Sections** — Prompt names starting with divider patterns (`=`, `⭐─`, `━`) become section headers. Click to expand/collapse. Section state persists across sessions.
- **Section Status** — Headers display enabled count (e.g., "5/12 enabled").
- **Search & Filter** — Real-time case-insensitive search by prompt name. Clear button to reset.
- **Drag-and-Drop Reordering** — Reorder prompts within and between sections via Sortable.js.
- **Custom Divider Patterns** — Add custom regex patterns via settings (comma-separated). Combined with built-in patterns: `=+`, `⭐─+`, `━+`.
- **Tooltip Extraction** — Hover tooltips from `@tooltip` directive or `{{// note }}` syntax. Lazy-loaded on first hover for performance.
- **Snapshot System** — Save/restore prompt enabled states. Take a snapshot before experimenting, apply to roll back.
- **Display Modes** — Toggle between "Tray" (overlay panels) and "Accordion" (inline collapsible) views.

### UI Elements

| Element | ID/Selector | Purpose |
|---------|-------------|---------|
| Search input | `#nemoPresetSearchInput` | Filter prompts by name |
| Clear button | `#nemoPresetSearchClear` | Reset search |
| Toggle sections | `#nemoToggleSectionsBtn` | Expand/collapse all |
| View mode | `#nemoViewModeBtn` | Switch Tray/Accordion |
| Navigator button | `#nemoPromptNavigatorBtn` | Open prompt folder browser |
| Archive button | `#nemoArchiveNavigatorBtn` | Open archive panel |
| Snapshot save | `#nemoTakeSnapshotBtn` | Save current state |
| Snapshot apply | `#nemoApplySnapshotBtn` | Restore saved state |
| Status bar | `#nemoSnapshotStatus` | Status messages |

### Dependencies

- `core/utils.js`, `core/constants.js`, `core/logger.js`
- `lib/Sortable.min.js` (drag-drop)
- `core/directive-cache.js` (tooltip parsing)

---

## 2. Preset Navigator

**Location:** `features/prompts/prompt-navigator.js`
**Setting:** `enablePresetNavigator` (default: `true`)

A full preset browser with grid view, favorites, and multi-API support.

### Capabilities

- **Grid/List View** — Toggle between card grid and compact list views.
- **Favorites** — Star presets for quick access. Stored in localStorage (`nemo-favorite-presets`).
- **Search** — Filter presets by name.
- **Breadcrumb Navigation** — Navigate synthetic folder hierarchy.
- **Bulk Selection** — Shift+Click for range selection, Ctrl+Click for individual.
- **Sort Options** — By name, date, or type.
- **Multi-API Support** — Works with: OpenAI, NovelAI, KoboldAI, TextGenWebUI, Anthropic, Claude, Google, Scale, Cohere, Mistral, AIX, OpenRouter.

### HTML Template

`features/prompts/prompt-navigator.html` — Loaded via `getExtensionPath()`.

---

## 3. Prompt Archive

**Location:** `features/prompts/prompt-archive.js`, `prompt-archive-ui.js`

Archive and restore prompts that are disabled or unused.

### Capabilities

- **Archive Prompts** — Move disabled prompts to archive storage.
- **Restore Prompts** — Bring archived prompts back to the active list.
- **Export** — Download archive as JSON file for backup.
- **Import** — Load archive from JSON file.
- **Statistics** — View archive size and contents.

---

## 4. Category Tray

**Location:** `features/prompts/category-tray.js`

Alternative UI mode for prompt organization using folder-style trays.

### Capabilities

- **Tray Mode** — Converts sections into clickable folder headers. Click to open a tray panel showing prompts.
- **Per-Section Presets** — Save/load named preset configurations per section. Stored in `extension_settings.NemoPresetExt.promptPresets`.
- **Compact View** — Toggle compact display per section.
- **Cross-Section Drag** — Drag prompts between sections.
- **Context Menu** — Right-click for "Move to section", "Delete", "Duplicate".

### Preset Storage Format

```javascript
{
    name: "My Preset",
    sectionId: "section-123",
    enabledPrompts: ["prompt-1", "prompt-2"],
    createdAt: "2025-01-01T00:00:00Z"
}
```

---

## 5. Directive System

**Location:** `features/directives/` (8 files, ~5,000 lines)
**Settings:** `enableDirectives` (default: `true`), `enableDirectiveAutocomplete` (default: `true`)

A powerful metadata system for prompts using `{{// @directive value }}` syntax inside prompt content.
The supported runtime enforces activation rules and message triggers, displays tray metadata, and provides directive-only autocomplete. Other compatibility fields in the reference are parsed metadata only; they do not change prompt state or visibility.

The older duplicate directive panels remain intentionally disconnected because they conflict with the current prompt dropdown UI.


### Syntax

```
{{// @directive value }}
```

Directives are placed inside prompt content as comment blocks. Multiple directives can be in one block:

```
{{// @tooltip Adds character personality
@tags personality, character, core
@default-enabled
@token-cost 150
@group Character Setup
}}
```

### Parsed Directive Reference

#### Metadata

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@tooltip` | `@tooltip <text>` | Hover text for the prompt |
| `@author` | `@author <name>` | Creator name |
| `@version` | `@version <semver>` | Version (e.g., 2.1.0) |
| `@deprecated` | `@deprecated <suggestion>` | Mark outdated, suggest replacement |
| `@help` | `@help <text>` | Help text shown in UI panel |
| `@documentation-url` | `@documentation-url <url>` | Link to full docs |
| `@example` | `@example <text>` | Usage example |
| `@changelog` | `@changelog <text>` | Version history |

#### Dependencies & Conflicts

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@requires` | `@requires <id>,<id>,...` | Hard dependencies (blocks activation if missing) |
| `@requires-message` | `@requires-message <text>` | Custom error for missing deps |
| `@exclusive-with` | `@exclusive-with <id>,<id>,...` | Mutually exclusive (hard conflict) |
| `@exclusive-with-message` | `@exclusive-with-message <text>` | Custom conflict message |
| `@conflicts-with` | `@conflicts-with <id>,<id>,...` | Soft conflicts (warning only) |
| `@conflicts-message` | `@conflicts-message <text>` | Custom warning message |
| `@auto-disable` | `@auto-disable <id>,<id>,...` | Auto-disable listed prompts when this is enabled |
| `@auto-enable-dependencies` | (flag) | Auto-enable required prompts |
| `@recommended-with` | `@recommended-with <id>,<id>,...` | Prompts that work well together |
| `@auto-enable-with` | `@auto-enable-with <id>,<id>,...` | Parsed compatibility relationship |
| `@suggest-enable-with` | `@suggest-enable-with <id>,<id>,...` | Parsed compatibility suggestion |

#### Organization

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@category` | `@category <cat>,<cat>,...` | Categorize for grouping |
| `@max-one-per-category` | `@max-one-per-category <cat>` | Only one active per category |
| `@tags` | `@tags <tag>,<tag>,...` | Searchable tags for filtering |
| `@group` | `@group <name>` | Collapsible group name |
| `@group-description` | `@group-description <text>` | Group description |
| `@mutual-exclusive-group` | `@mutual-exclusive-group <name>` | Auto-disable others in same group |
| `@priority` | `@priority <1-100>` | Parsed priority metadata (1-100) |
| `@load-order` | `@load-order <number>` | Parsed execution-order metadata |

#### Visibility & Conditionals

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@hidden` | (flag) | Parsed visibility metadata |
| `@if-enabled` | `@if-enabled <id>,<id>,...` | Parsed enabled-condition metadata |
| `@if-disabled` | `@if-disabled <id>,<id>,...` | Parsed disabled-condition metadata |
| `@if-api` | `@if-api <api>,<api>,...` | Parsed API-condition metadata |

#### Setup & Defaults

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@default-enabled` | (flag) | Parsed default-state metadata |
| `@recommended-for-beginners` | (flag) | Flag for new users |
| `@advanced` | (flag) | Mark as expert-only |

#### Performance

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@token-cost` | `@token-cost <number>` | Estimated token usage |
| `@token-cost-warn` | `@token-cost-warn <number>` | Warn if exceeds threshold |
| `@performance-impact` | `@performance-impact <low\|medium\|high>` | Performance indicator |

#### Visual Customization

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@icon` | `@icon <emoji>` | Parsed icon metadata |
| `@color` | `@color <hex>` | Left border color |
| `@badge` | `@badge <text>` | Badge next to name |
| `@highlight` | (flag) | Visual highlight in list |

#### Quality & Status

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@unstable` | (flag) | May be unreliable |
| `@experimental` | (flag) | New/testing feature |
| `@tested-with` | `@tested-with <model>,...` | Known working models |

#### Model Optimization

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@model-optimized` | `@model-optimized <model>,...` | Works best with listed models |
| `@model-incompatible` | `@model-incompatible <model>,...` | Doesn't work with listed models |
| `@recommended-api` | `@recommended-api <api>,...` | Best API choice |
| `@incompatible-api` | `@incompatible-api <api>,...` | Incompatible APIs |

#### Message-Based Triggers

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@enable-at-message` | `@enable-at-message <N>` | Auto-enable at or after message count N |
| `@disable-at-message` | `@disable-at-message <N>` | Auto-disable at or after message count N |
| `@message-range` | `@message-range <start>-<end>` | Active only between N-M messages |
| `@enable-after-message` | `@enable-after-message <N>` | Enable after N messages (stays on) |
| `@disable-after-message` | `@disable-after-message <N>` | Disable after N messages (stays off) |

### Conflict Resolution

When enabling a prompt with conflicts, a toast notification appears with options:
- **"Disable Conflicting Prompts"** — Remove conflicting prompts
- **"Enable Required Prompts"** — Auto-enable dependencies
- **"Proceed Anyway"** — For warnings only
- **"Cancel"** — Abort activation

Issue severity:
- `error` — Blocks activation (exclusive, missing deps, category limit)
- `warning` — Allows proceeding (soft conflicts, deprecated)

### Autocomplete

Typing `{{// @` in the prompt editor triggers directive-only autocomplete suggestions showing directive name, syntax, description, and example.

### Directive Cache

Parsed directives are cached with a bounded 2,000-entry cache and 60-second TTL per entry. Cache is keyed by exact prompt content to avoid collisions.

---

## 6. Animated Backgrounds

**Location:** `features/backgrounds/` (6 files)
**Setting:** `enableAnimatedBackgrounds` (default: `false`)

Opt-in animated-image and YouTube support, plus video uploads when SillyTavern's optional Video Background Loader converter is installed.

### Supported Formats

| Type | Handling |
|------|----------|
| Video upload | Requires Video Background Loader; converted through `globalThis.convertVideoToAnimatedWebp` to animated WebP |
| Animated image | GIF, WebP, and APNG remain on SillyTavern's native path |
| Static image | Delegated to SillyTavern's native upload path |
| YouTube | Validated YouTube and YouTube-nocookie URLs; no converter add-on required |

### Capabilities

- **Native Integration** — Uses current background events without patching private globals.
- **Optional Video Conversion** — Clearly reports whether Video Background Loader is available and leaves upload handling to SillyTavern.
- **Saved YouTube Shortcuts** — Stores pasted links as extension-owned favorites; there is no separate playlist-selection UI.
- **Privacy-Enhanced YouTube** — Uses validated IDs and `youtube-nocookie.com` embeds without the video-converter add-on.
- **Native Organization** — SillyTavern remains authoritative for folders and sort options.
- **Idempotent Lifecycle** — Fully removes listeners, timers, observers, media, controls, styles, and restores native visibility.

### Settings

```javascript
{
    enableLoop: true,
    enableAutoplay: true,
    enableMute: true,
    videoVolume: 0.1,
    enablePreload: true,
    fallbackToThumbnail: false,
    backgroundFitting: 'cover'
}
```

---

## 7. Improved Reasoning Capture

**Location:** `reasoning/reasoning-capture-core.js`, `reasoning/robust-reasoning-parser.js`, `reasoning/nemonet-reasoning-config.js`

**Setting:** `enableReasoningCapture` (default: `true`)

A native-first post-processor for reasoning formats that SillyTavern did not already capture. It stores accepted reasoning in the standard message metadata and leaves rendering, saving, and swipe behavior with SillyTavern.

### Supported formats

| Format | Example |
|--------|---------|
| Configured/native delimiters | SillyTavern's current reasoning prefix and suffix |
| Common alternate delimiters | `<thinking>`, `<thoughts>`, `<reason>`, `<cot>`, special-token, and square-bracket forms |
| DeepSeek answer blocks | `<think>...</think><answer>...</answer>` |
| Sectioned output | `Thoughts:` / `Thinking:` followed by an explicit response header |
| Structured NemoNet | Council/Context Scan blocks with a clear narrative boundary |
| Deterministic repair | Distinctive partial suffixes or explicit NemoNet narration markers |

### Correctness safeguards

- Runs only for assistant messages that begin with a recognized format.
- Treats existing provider/native reasoning as authoritative.
- Requires both non-empty reasoning and non-empty visible content; concise answers are allowed.
- Delegates only structurally closed blocks to native parsing and leaves embedded examples or ambiguous unclosed blocks unchanged.
- Parses canonical message text only, never already-rendered HTML.
- Applies native reasoning regex placement, preserves metadata, and synchronizes accepted changes into the active swipe.
- Uses a cheap candidate gate, so normal and even very large marker-free messages never enter the multi-strategy parser.
- Skips pristine one-message greetings to preserve SillyTavern's greeting macro/swipe semantics.

### Runtime

The feature uses four bounded events: `MESSAGE_RECEIVED`, `MESSAGE_UPDATED`, `MESSAGE_SWIPED`, and `CHAT_CHANGED`. It has no chat-wide DOM observer, polling loop, delayed retry callbacks, or custom reasoning DOM. Cleanup removes the same listener references synchronously.

### Parser result

```javascript
{
    reasoning: string,
    content: string,
    strategy: string,
    confidence: number
}
```

A result is validated before the canonical message changes. Rejected results are atomic no-ops.

---

## 8. HTML Trimmer

**Location:** `reasoning/html-trimmer.js`
**Setting:** `enableHTMLTrimming` (default: `false`), `htmlTrimmingKeepCount` (default: `0`)

Converts HTML-rich old messages to compact ASCII text to reduce context token usage.

### Conversions

| HTML Element | ASCII Output |
|-------------|-------------|
| `<details>` | `┌──┐ ▼ Summary ─ Content ─ └──┘` box |
| Bordered `<div>` | `╔══╗ ║ Content ║ ╚══╝` heavy box |
| `<table>` | ASCII table with column alignment |
| `<ul>` | `• Item` bullet list |
| `<ol>` | `1. Item` numbered list |
| `<h1>` | Text + `═══` underline |
| `<h2>` | Text + `───` underline |
| `<h3>` | Text + `···` underline |

### Behavior

- Width: 40-80 characters, auto-wraps long lines
- Preserves meaningful text while reducing large HTML/CSS payloads
- Effective keep range is 2-20 recent messages (fallback: 4)
- Stores the original message in `extra.nemoHtmlTrimmerOriginal` before replacement
- **Restore Trimmed** writes backed-up originals back to the chat and saves once
- Applied via `setupAutoTrim()`, which watches for new messages

---

## 9. Theme System

**Location:** `ui/theme-manager.js`, `themes/`

Five UI themes with dynamic CSS loading and optional JS enhancements.

### Available Themes

| Theme | CSS File | JS Enhancements | Description |
|-------|----------|----------------|-------------|
| None | — | — | SillyTavern default |
| Windows 98 | `themes/win98-theme.css` | `win98-enhancements.js` | Retro OS with beveled controls |
| Discord | `themes/discord-theme.css` | `discord-enhancements.js` | Chat-app style interface |
| Cyberpunk | `themes/cyberpunk-theme.css` | `cyberpunk-enhancements.js` | Terminal/CLI neon aesthetic |
| NemoTavern | `themes/nemotavern/nemotavern-theme.css` | `nemotavern-enhancements.js` | Modern glassmorphism + React UI |

### Setting

`uiTheme`: `'none'` | `'win98'` | `'discord'` | `'cyberpunk'` | `'nemotavern'`

### Theme Enhancement Pattern

Each theme's JS file provides:
- CSS variable overrides (colors, fonts, spacing)
- Custom DOM element creation
- Animation and hover effects
- Icon customizations
- Responsive/mobile adjustments
- Body class injection for CSS scoping

---

## 10. NemoTavern React UI

**Location:** `features/nemotavern/react/`

Modern React-based UI layer activated by the NemoTavern theme. Built with React + TypeScript + Zustand.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| CommandPalette | `components/CommandPalette/` | Ctrl+K command search & execute |
| FloatingPanel | `components/FloatingPanel/` | Draggable, resizable panels with docking |
| NemoLayout | `components/Layout/` | Main layout with toolbar and dock zones |
| UnifiedSettings | `components/UnifiedSettings/` | Sidebar-navigated settings panel |

### Hooks

- `useEventBridge` — Bridges vanilla JS events to React
- `useKeyboardShortcuts` — Global keyboard command handling
- `usePanelDrag` — Draggable panel logic

### State Management

Zustand store (`src/store/index.ts`) managing:
- Panel positions and visibility
- Settings state
- UI mode (docked/floating)
- Command palette state

### Build

- Entry: `src/index.tsx`
- Build script: `build.js` (esbuild)
- Output: `dist/nemotavern.js` (single bundle)
- Loaded dynamically by `nemotavern-enhancements.js`

---

## 11. Tutorial System

**Location:** `features/onboarding/` (4 files)

Interactive guided tutorials with a visual novel-style dialog character named Vex.

### Components

| File | Purpose |
|------|---------|
| `tutorial-manager.js` | Registry, state tracking, progress persistence |
| `tutorial-launcher.js` | Bootstrap, event triggers, first-time detection |
| `tutorials.js` | Tutorial step definitions with Vex dialogue |
| `vn-dialog.js` | Visual novel dialog box renderer |

### Vex Character

- 4 expressions: default, smiling, talking, thinking
- Portrait assets in `assets/vex-*.png`
- Visual novel-style dialog box with character image + text

### Tutorial Features

- Step-by-step walkthroughs with element highlighting
- Progress tracking and completion persistence
- Dismissal tracking (don't show again)
- Welcome tutorial auto-starts for first-time users
- Each step can highlight specific UI elements

---

## 12. World Info / Lorebook UI

**Location:** `features/world-info/`
**Setting:** `enableLorebookOverhaul` (default: `false`)

Responsive lorebook workspace layered on SillyTavern's supported World Info editor and events.

### Capabilities

- **Two-Column Workspace** — Searchable lorebook sidebar and focused entry workspace.
- **Clear States** — Accessible idle, loading, ready, empty, and error feedback.
- **Folder and Preset Tools** — Organize books and save active-lorebook sets.
- **Bulk Selection and Clipboard** — Shift/Ctrl selection plus cut/copy/duplicate workflows.
- **Native Entry Editing** — Keeps SillyTavern's current entry editor and render targets.
- **Analysis Tools** — Active-entry tracking, multi-book order helper, and an explicitly limited primary-keyword preview.
- **Responsive Accessibility** — Keyboard tabs, focus-visible controls, mobile sidebar, and reduced-motion support.
- **Reversible Lifecycle** — Restores the complete native World Info panel and removes owned observers/listeners.

### Files

- `features/world-info/world-info-ui.js` — Lifecycle and interactions
- `features/world-info/world-info-ui.html` — Accessible workspace template
- `features/world-info/world-info-ui.css` — Scoped responsive styles

---

## 13. Character Manager

**Location:** `features/character-manager/`

Enhanced character selection and organization.

### Capabilities

- **Folder System** — Organize characters into folders with metadata.
- **Grid/List View** — Toggle between card grid and compact list.
- **Favorites** — Star characters for quick access (`nemo-favorite-characters` localStorage key).
- **Search & Filter** — Filter by name, sort by name/date/type.
- **Bulk Selection** — Multi-select with Shift/Ctrl.
- **Breadcrumb Navigation** — Navigate folder hierarchy.

### Files

| File | Purpose |
|------|---------|
| `character-manager.js` | Data management, metadata, singleton UI |
| `character-manager-ui.js` | UI rendering, grid/list views, interactions |
| `character-manager-ui.html` | HTML template |
| `dom-cache.js` | DOM element caching for performance |

---

## 14. Panel Toggle

**Location:** `features/panel-toggle/panel-toggle.js`
**Setting:** `enablePanelToggle` (default: `true`)

Toggle controls for SillyTavern's floating/side panels.

---

## 15. Pollinations Interceptor

**Location:** `features/pollinations-interceptor.js`
**Setting:** `nemoEnablePollinationsInterceptor` (default: `false`, opt-in)

Intercepts Pollinations.ai image generation API calls within SillyTavern for enhanced image handling.

### Capabilities

- `init()` — Initialize the interceptor
- `scan(element)` — Scan an element for Pollinations images
- `interceptAll(element)` — Process all images in an element
- `extractPrompts(html)` — Extract generation prompts without replacing images

Available globally as `window.PollinationsInterceptor` for manual testing.

---

## 16. UI Enhancements

**Location:** `ui/` (6 files)

### Settings UI (`settings-ui.js`)

Main settings panel for NemoPresetExt. Loads `settings.html` into the extensions settings container. Provides toggles for all features, regex pattern input, theme selector.

### Global UI (`global-ui.js`)

- Inline drawer conversion for SillyTavern panels
- Prompt list reorganization
- Nemo Suite grouping in extensions panel

### User Settings Tabs (`user-settings-tabs.js`)

Reorganizes SillyTavern's user settings into tabbed panels for better navigation.
**Setting:** `enableTabOverhauls` (default: `false`)

### Advanced Formatting Tabs (`advanced-formatting-tabs.js`)

Reorganizes advanced formatting options into categorized tabs.
**Setting:** `enableTabOverhauls` (default: `false`)

### Extensions Tab Overhaul (`extensions-tab-overhaul.js`)

Reorganizes the extensions settings panel layout with grouping and collapsible sections.
**Setting:** `nemoEnableExtensionsTabOverhaul` (default: `false`)
Available globally as `window.ExtensionsTabOverhaul`.

### Theme Manager (`theme-manager.js`)

Handles dynamic CSS loading/unloading for themes. Uses centralized `getExtensionPath()` for asset paths.

---

## 17. Core Modules

**Location:** `core/` (9 files)

### utils.js

- `NEMO_EXTENSION_NAME` — Extension name constant
- `getExtensionPath(relativePath)` — Centralized path helper for all asset references
- `ensureSettingsNamespace()` — Initialize default settings
- `waitForElement(selector, callback, timeout)` — DOM polling with RAF
- `showToast(message, type, duration)` — Toast notifications
- `showColorPickerPopup(currentColor, title)` — Color picker dialog
- `LocalStorageAsync` — Non-blocking localStorage wrapper
- Re-exports from SillyTavern: `delay`, `debounce`, `debounceAsync`, `throttle`, `escapeHtml`, `generateUUID`, `getSortableDelay`, `flashHighlight`, `isValidUrl`, `removeFromArray`, `onlyUnique`

### constants.js

Centralized constants: timeouts (debounce 300ms, animations 200ms), DOM selectors for all major UI elements, CSS class names, file validation limits, UI dimensions.

### logger.js

Structured logging with levels: DEBUG, INFO, WARN, ERROR. Timestamps, formatted output, performance tracking via `logger.performance(label, fn)`.

### event-bus.js

Cross-system pub/sub for NemoLore and ProsePolisher communication.

**NemoLore Events:**
- `nemolore:summary_created` — Summary generated
- `nemolore:core_memory_detected` — Important memory found
- `nemolore:lorebook_entry_created` — Auto-created lorebook entry
- `nemolore:summary_regenerated` — Summary updated
- `nemolore:chat_initialized` — Chat loaded

**ProsePolisher Events:**
- `prosepolisher:high_slop_detected` — High slop score detected
- `prosepolisher:pattern_detected` — Writing pattern found
- `prosepolisher:regex_rule_generated` — Auto-generated regex rule
- `prosepolisher:analysis_complete` — Analysis finished

Features: priority-based listener ordering, one-time listeners, event history (100 entries), auto-cleanup.

### directive-cache.js

Prompt-id metadata cache backed by the parser's bounded 2,000-entry, 60-second exact-content cache.

### storage-migration.js

One-time migration from localStorage to `extension_settings`. Runs on first initialization.

### shared-names.js / shared-ngrams.js / shared-prompts.js

Prompt name parsing, n-gram analysis for smart matching, and prompt state sharing across modules.

---

## 18. Settings Reference

All settings stored under `extension_settings.NemoPresetExt`:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enablePromptManager` | bool | `true` | Prompt dropdowns, search/filter, folders, archive, snapshots, and related tools |
| `enablePresetNavigator` | bool | `true` | Preset browser |
| `enableDirectives` | bool | `true` | Prompt validation, metadata, and message triggers |
| `enableAnimatedBackgrounds` | bool | `false` | Background media system |
| `enableCharacterNavigator` | bool | `true` | Character-card browser |
| `enableLorebookManagement` | bool | `false` | World info UI enhancements |
| `enableHTMLTrimming` | bool | `false` | HTML-to-ASCII context compression |
| `htmlTrimmingKeepCount` | number | `0` | Recent messages to skip when trimming |
| `dividerRegexPattern` | string | `''` | Custom divider patterns (comma-separated) |
| `uiTheme` | string | `'none'` | Active theme: none/win98/discord/cyberpunk/nemotavern |
| `enableMobileEnhancements` | bool | `false` | Auto-detect touch devices |
| `enableTabOverhauls` | bool | `false` | Reorganize settings tabs |
| `nemoEnableWidePanels` | bool | `false` | 50% viewport width panels |
| `nemoEnableExtensionsTabOverhaul` | bool | `false` | Extensions panel reorganization |
| `nemoEnablePollinationsInterceptor` | bool | `false` | Pollinations API interceptor |
| `enableReasoningCapture` | bool | `true` | Improved reasoning capture |
| `enableDirectiveAutocomplete` | bool | `true` | Directive-only autocomplete UI |
| `enableConnectionPanelOverhaul` | bool | `false` | Connection panel reorganization |
| `enableLorebookOverhaul` | bool | `false` | Lorebook panel reorganization |
| `enableReasoningSection` | bool | `false` | Prompt-manager reasoning section |
| `enableModelSelector` | bool | `false` | Enhanced model selectors |
| `nemoPollinationsPromptBestPractices` | bool | `false` | Pollinations prompt additions |
| `enableEmojiPicker` | bool | `false` | Emoji picker UI |
| `enableMarketplace` | bool | `false` | Extension marketplace |
| `enablePersonaEnhancements` | bool | `false` | Persona management enhancements |
| `enableNemoLore` | bool | `false` | NemoLore workflows |
| `enableRewrite` | bool | `false` | Rewrite workflows |
| `enableTutorials` | bool | `false` | Tutorial UI |
| `enableNemoEngineInstaller` | bool | `false` | NemoEngine installer |
| `enableItalicDialogueRenderer` | bool | `false` | Italic dialogue renderer |
| `enableApiRouter` | bool | `false` | API router and model pipeline |
| `dropdownStyle` | string | — | Display mode: 'tray' or 'accordion' |

---

## 19. Folder Structure

```
NemoPresetExt/
├── content.js                          # Entry point — bootstraps everything
├── manifest.json                       # Extension metadata (v4.7.0)
├── styles.css                          # Main stylesheet (274KB)
├── settings.html                       # Settings panel template
├── tooltips.json                       # Tooltip definitions
├── global.d.ts                         # TypeScript type definitions
├── README.md                           # User-facing readme
├── FEATURES.md                         # This file
│
├── core/                               # Shared foundation modules
│   ├── constants.js                    # Centralized constants
│   ├── logger.js                       # Structured logging
│   ├── event-bus.js                    # Cross-module pub/sub
│   ├── directive-cache.js              # LRU directive cache
│   ├── storage-migration.js            # Settings migration
│   ├── utils.js                        # Helpers + getExtensionPath()
│   ├── shared-names.js                 # Name parsing utilities
│   ├── shared-ngrams.js                # N-gram analysis
│   └── shared-prompts.js              # Prompt state sharing
│
├── ui/                                 # UI layer modules
│   ├── settings-ui.js                  # Main settings panel
│   ├── global-ui.js                    # Global UI helpers
│   ├── theme-manager.js                # Theme CSS loading
│   ├── user-settings-tabs.js           # Settings tab overhaul
│   ├── advanced-formatting-tabs.js     # Formatting tab overhaul
│   └── extensions-tab-overhaul.js      # Extensions panel overhaul
│
├── features/
│   ├── prompts/                        # Prompt management
│   │   ├── prompt-manager.js           # Core: sections, search, drag-drop
│   │   ├── prompt-navigator.js         # Preset browser
│   │   ├── prompt-navigator.html       # Navigator template
│   │   ├── prompt-archive.js           # Archive logic
│   │   ├── prompt-archive-ui.js        # Archive UI
│   │   ├── prompt-tooltips.js          # Tooltip extraction
│   │   ├── category-tray.js            # Tray display mode
│   │   └── react/dist/prompt-views.js  # React prompt components
│   │
│   ├── directives/                     # Directive system
│   │   ├── prompt-directives.js        # Core parser (70+ directives)
│   │   ├── directive-features.js       # Legacy advanced panel (not initialized)
│   │   ├── directive-features-fixes.js # Legacy duplicate fixes (not initialized)
│   │   ├── directive-autocomplete.js   # Editor autocomplete
│   │   ├── directive-autocomplete-ui.js# Autocomplete UI
│   │   ├── directive-ui.js             # Toast notifications
│   │   ├── prompt-directive-hooks.js   # Toggle interception
│   │   └── sillytavern-macros.js       # Macro reference (100+)
│   │
│   ├── backgrounds/                    # Animated backgrounds
│   │   ├── animated-backgrounds-module.js  # Core module
│   │   ├── animated-backgrounds.js     # Helpers
│   │   ├── animated-backgrounds.css    # Background styles
│   │   └── background-ui-enhancements.js   # UI controls
│   │
│   ├── onboarding/                     # Tutorial system
│   │   ├── tutorial-manager.js         # Registry & state
│   │   ├── tutorial-launcher.js        # Bootstrap & triggers
│   │   ├── tutorials.js               # Tutorial definitions + Vex
│   │   ├── vn-dialog.js               # Visual novel dialog
│   │   ├── tutorial-launcher.css       # Launcher styles
│   │   └── vn-dialog.css              # Dialog styles
│   │
│   ├── world-info/                     # Lorebook enhancements
│   │   ├── world-info-ui.js            # Two-column UI, folders
│   │   ├── world-info-ui.html          # UI template
│   │   └── world-info-ui.css           # Specific styles
│   │
│   ├── character-manager/              # Character management
│   │   ├── character-manager.js        # Data & metadata
│   │   ├── character-manager-ui.js     # Grid/list UI
│   │   ├── character-manager-ui.html   # UI template
│   │   └── dom-cache.js               # DOM caching utility
│   │
│   ├── nemotavern/                     # React-based modern UI
│   │   └── react/                      # React app (TypeScript + Zustand)
│   │       ├── src/                    # Source code
│   │       ├── dist/nemotavern.js      # Compiled bundle
│   │       └── build.js               # Build script
│   │
│   ├── panel-toggle/                   # Panel toggle controls
│   │   └── panel-toggle.js
│   │
│   └── pollinations-interceptor.js     # Image gen API interceptor
│
├── reasoning/                          # Chain-of-thought system
│   ├── reasoning-capture-core.js          # Safe candidate gating
│   ├── robust-reasoning-parser.js      # Universal CoT parser
│   ├── nemonet-reasoning-config.js     # NemoNet-specific config
│   ├── html-trimmer.js                # HTML→ASCII converter
│   ├── test-reasoning-parser.js        # Parser tests
│   └── debug-parse-test.js            # Debug utilities
│
├── themes/                             # UI themes
│   ├── win98-enhancements.js + .css    # Windows 98 retro
│   ├── discord-enhancements.js + .css  # Discord chat style
│   ├── cyberpunk-enhancements.js + .css# Cyberpunk terminal
│   └── nemotavern/                     # Modern glassmorphism
│       ├── nemotavern-enhancements.js
│       └── nemotavern-theme.css
│
├── assets/                             # Static assets
│   ├── vex-*.png                       # Vex character portraits
│   └── *.json                          # Preset configurations
│
├── lib/                                # Third-party libraries
│   ├── Sortable.min.js                 # Drag-drop
│   ├── diff.min.js                     # Text diffing
│   └── diff2html.min.js               # HTML diff visualization
│
└── archive/                            # Deprecated/legacy code
    ├── navigator.js                    # Old preset navigator
    ├── debug-drag-issue.js             # Debug utility
    └── NemoFile.js                     # File utility stub
```

---

## Initialization Order

`content.js` initializes the extension through feature gates rather than starting every bundled module:

1. Wait for the primary SillyTavern navigation DOM.
2. Apply the versioned settings schema, initialize extension storage, and run the one-time localStorage migration.
3. Initialize themes and mount the native Extensions-panel settings UI.
4. Start the approved default-on prompt, preset, character-card, reasoning-capture, and directive features.
5. Start opt-in integrations only when their canonical feature flag is strictly `true`.
6. Start directive UI, validation hooks, message triggers, directive-only autocomplete, and the shared cache as one disposable bundle when `enableDirectives` is enabled.
7. Start the category tray with the prompt-manager bundle; directive metadata and validation still honor the directive master switch.
8. Register settings, viewport, prompt-list, and SillyTavern lifecycle handlers with matching teardown callbacks.

The legacy `directive-features.js` and `directive-features-fixes.js` advanced panels are retained for reference but are not imported or initialized. Their behavior overlaps the current prompt dropdown and would create duplicate observers and controls.

Every delayed initializer, event listener, observer, moved native element, and owned UI surface is released through `cleanupExtension()` so a failed or repeated initialization can recover cleanly.
