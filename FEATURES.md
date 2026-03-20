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

The core feature of NemoPresetExt. Transforms SillyTavern's flat prompt list into an organized, searchable, collapsible interface.

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
| Navigator button | `#nemoPromptNavigatorBtn` | Open preset browser |
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
**Setting:** `enableDirectives` (default: `true`)

A powerful metadata system for prompts using `{{// @directive value }}` syntax inside prompt content.

### Syntax

```
{{// @directive value }}
```

Directives are placed inside prompt content as comment blocks. Multiple directives can be in one block:

```
{{// @tooltip Adds character personality
@tags personality, character, core
@default-enabled
@tokenCost 150
@group Character Setup
}}
```

### Complete Directive Reference

#### Metadata

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@tooltip` | `@tooltip <text>` | Hover text for the prompt |
| `@author` | `@author <name>` | Creator name |
| `@version` | `@version <semver>` | Version (e.g., 2.1.0) |
| `@deprecated` | `@deprecated <suggestion>` | Mark outdated, suggest replacement |
| `@help` | `@help <text>` | Help text shown in UI panel |
| `@documentationUrl` | `@documentationUrl <url>` | Link to full docs |
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
| `@autoEnableWith` | `@autoEnableWith <id>,<id>,...` | Auto-enable together |
| `@suggestEnableWith` | `@suggestEnableWith <id>,<id>,...` | Suggest enabling together |

#### Organization

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@category` | `@category <cat>,<cat>,...` | Categorize for grouping |
| `@max-one-per-category` | `@max-one-per-category <cat>` | Only one active per category |
| `@tags` | `@tags <tag>,<tag>,...` | Searchable tags for filtering |
| `@group` | `@group <name>` | Collapsible group name |
| `@group-description` | `@group-description <text>` | Group description |
| `@mutual-exclusive-group` | `@mutual-exclusive-group <name>` | Auto-disable others in same group |
| `@priority` | `@priority <1-100>` | Load order (higher = first) |
| `@loadOrder` | `@loadOrder <number>` | Execution order |

#### Visibility & Conditionals

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@hidden` | (flag) | Hide from UI (still functions) |
| `@if-enabled` | `@if-enabled <id>,<id>,...` | Show only if listed prompts are enabled |
| `@if-disabled` | `@if-disabled <id>,<id>,...` | Show only if listed prompts are disabled |
| `@if-api` | `@if-api <api>,<api>,...` | Show only for specific APIs |

#### Setup & Defaults

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@default-enabled` | (flag) | Auto-enable on first use |
| `@recommended-for-beginners` | (flag) | Flag for new users |
| `@advanced` | (flag) | Mark as expert-only |

#### Performance

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@tokenCost` | `@tokenCost <number>` | Estimated token usage |
| `@tokenCostWarn` | `@tokenCostWarn <number>` | Warn if exceeds threshold |
| `@performanceImpact` | `@performanceImpact <low\|medium\|high>` | Performance indicator |

#### Visual Customization

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@icon` | `@icon <emoji>` | Prepended to prompt name |
| `@color` | `@color <hex>` | Left border color |
| `@badge` | `@badge <text>` | Badge next to name |
| `@highlight` | (flag) | Visual highlight in list |

#### Quality & Status

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@unstable` | (flag) | May be unreliable |
| `@experimental` | (flag) | New/testing feature |
| `@testedWith` | `@testedWith <model>,...` | Known working models |

#### Model Optimization

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@modelOptimized` | `@modelOptimized <model>,...` | Works best with listed models |
| `@modelIncompatible` | `@modelIncompatible <model>,...` | Doesn't work with listed models |
| `@recommendedApi` | `@recommendedApi <api>,...` | Best API choice |
| `@incompatible-api` | `@incompatible-api <api>,...` | Incompatible APIs |

#### Message-Based Triggers

| Directive | Syntax | Description |
|-----------|--------|-------------|
| `@enableAtMessage` | `@enableAtMessage <N>` | Auto-enable at message count N |
| `@disableAtMessage` | `@disableAtMessage <N>` | Auto-disable at message count N |
| `@messageRange` | `@messageRange {start: N, end: M}` | Active only between N-M messages |
| `@enableAfterMessage` | `@enableAfterMessage <N>` | Enable after N messages (stays on) |
| `@disableAfterMessage` | `@disableAfterMessage <N>` | Disable after N messages (stays off) |

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

Typing `@` in the prompt editor triggers autocomplete suggestions showing directive name, syntax, description, and example.

### Directive Cache

Parsed directives are cached with a 2,000-entry LRU cache and 60-second TTL per entry. Cache is keyed by content hash for performance.

---

## 6. Animated Backgrounds

**Location:** `features/backgrounds/` (3 files)
**Setting:** `enableAnimatedBackgrounds` (default: `true`)

Full-featured background media system supporting video, animated images, and YouTube.

### Supported Formats

| Type | Extensions |
|------|-----------|
| Video | MP4, WebM, AVI, MOV, MKV, OGV |
| Animated Image | GIF, WebP |
| Static Image | JPG, PNG, BMP, TIFF, SVG, ICO |
| Streaming | YouTube URLs |
| Embed | iFrame embeds |

### Capabilities

- **Playlist System** — Queue multiple backgrounds, shuffle/repeat modes.
- **Favorites** — Star backgrounds for quick access.
- **Drag-to-Reorder** — Reorder playlist items.
- **Playback Controls** — Autoplay, loop, mute toggles.
- **Volume Control** — Adjustable volume slider (0-1, default 0.1).
- **YouTube Integration** — Paste YouTube URLs, quality selector (720p/1080p).
- **Particle Effects** — Optional particle overlay.
- **Background Fit** — Cover/contain/stretch options.
- **Preload Optimization** — Preload media for smooth transitions.
- **Thumbnail Fallback** — Show thumbnail while loading.

### Settings

```javascript
{
    enableLoop: true,
    enableAutoplay: true,
    enableMute: true,
    videoVolume: 0.1,
    enablePreload: true,
    fallbackToThumbnail: true,
    youtubeQuality: 'hd720',
    enableParticles: false
}
```

---

## 7. Reasoning Parser

**Location:** `reasoning/robust-reasoning-parser.js`, `reasoning/nemonet-reasoning-config.js`

Universal chain-of-thought reasoning block parser supporting multiple AI models.

### Supported Models

| Model | Format | Tags |
|-------|--------|------|
| Claude | Extended Thinking | `<thinking>...</thinking>` |
| DeepSeek R1 | Think blocks | `<think>...</think>` → `<answer>` |
| OpenAI o1/o3 | Reasoning tokens | Step markers |
| Gemini 2.0+ | Thoughts section | `Thoughts:` prefix |
| NemoNet | Custom CoT | `<think>...</think>` + `NARRATION FOLLOWS` |
| Generic | Various | `<thought>`, `<reasoning>`, etc. |

### Parsing Strategies (by confidence)

1. **Perfect Match** (100) — Both opening + closing tags present
2. **Partial Suffix** (90) — Opening found, closing partial
3. **Missing Suffix** (85) — Opening found, no closing (heuristic end detection)
4. **Content-Based** (75) — No tags, but 150+ reasoning markers detected
5. **Heuristic** (60) — Contextual clues (indentation, formatting)

### NemoNet-Specific Features

- **Council of Vex** — Multi-perspective reasoning with personas (Plot_Vex, Romantic_Vex, Action_Vex, Mystery_Vex, Comedy_Vex, Danger_Vex)
- **7 Story Sections** — NEMO NET AWAKENING → GATHERING THE THREADS → SCENE CALIBRATION → COUNCIL CONVERSATION → RESOLUTION → CRAFTING → Custom CoT
- **8 Exploration Steps** — Sequential discovery phases
- **Special Sections** — Scene type/ratio, character capabilities, character voice, freshness checks, final review

### Parse Output

```javascript
{
    hasReasoning: boolean,
    reasoningBlocks: [{
        content: string,
        startIndex: number,
        endIndex: number,
        confidence: number,    // 0-100
        strategy: string,
        modelDetected: string
    }],
    narration: string,
    modelType: string
}
```

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
- Preserves information while reducing from ~500 lines HTML to ~20-30 lines ASCII
- `htmlTrimmingKeepCount`: Number of recent messages to skip (0 = trim all old messages)
- Applied via `setupAutoTrim()` which watches for new messages

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

**Location:** `features/world-info/world-info-ui.js`
**Setting:** `enableLorebookManagement` (default: `true`)

Enhanced lorebook/world info management interface.

### Capabilities

- **Two-Column Layout** — Left panel for book/folder list, right panel for entry details.
- **Folder System** — Organize entries into folders with color coding.
- **Bulk Selection** — Multi-select entries with Shift/Ctrl click.
- **Clipboard** — Cut/copy/paste entries between books.
- **Entry Presets** — Save and load entry configurations.
- **Drag-and-Drop** — Reorder entries and move between folders.
- **Inline Editing** — Edit entry fields directly in the list view.
- **Active Entry Tracking** — Shows which entries are currently active.

### HTML/CSS

- `features/world-info/world-info-ui.html` — UI template
- `features/world-info/world-info-ui.css` — Specific styles

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
**Setting:** `enableTabOverhauls` (default: `true`)

### Advanced Formatting Tabs (`advanced-formatting-tabs.js`)

Reorganizes advanced formatting options into categorized tabs.
**Setting:** `enableTabOverhauls` (default: `true`)

### Extensions Tab Overhaul (`extensions-tab-overhaul.js`)

Reorganizes the extensions settings panel layout with grouping and collapsible sections.
**Setting:** `nemoEnableExtensionsTabOverhaul` (default: `true`)
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

LRU cache for parsed prompt directives. 2,000 entries max, 60-second TTL, hash-based keys.

### storage-migration.js

One-time migration from localStorage to `extension_settings`. Runs on first initialization.

### shared-names.js / shared-ngrams.js / shared-prompts.js

Prompt name parsing, n-gram analysis for smart matching, and prompt state sharing across modules.

---

## 18. Settings Reference

All settings stored under `extension_settings.NemoPresetExt`:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enablePromptManager` | bool | `true` | Prompt manager enhancements |
| `enablePresetNavigator` | bool | `true` | Preset browser |
| `enableDirectives` | bool | `true` | Directive system |
| `enableAnimatedBackgrounds` | bool | `true` | Background media system |
| `enablePanelToggle` | bool | `true` | Panel toggle controls |
| `enableLorebookManagement` | bool | `true` | World info UI enhancements |
| `enableHTMLTrimming` | bool | `false` | HTML-to-ASCII context compression |
| `htmlTrimmingKeepCount` | number | `0` | Recent messages to skip when trimming |
| `dividerRegexPattern` | string | `''` | Custom divider patterns (comma-separated) |
| `uiTheme` | string | `'none'` | Active theme: none/win98/discord/cyberpunk/nemotavern |
| `enableMobileEnhancements` | bool | `true` | Auto-detect touch devices |
| `enableTabOverhauls` | bool | `true` | Reorganize settings tabs |
| `nemoEnableWidePanels` | bool | `false` | 50% viewport width panels |
| `nemoEnableExtensionsTabOverhaul` | bool | `true` | Extensions panel reorganization |
| `nemoEnablePollinationsInterceptor` | bool | `false` | Pollinations API interceptor |
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
│   │   ├── directive-features.js       # Feature implementation
│   │   ├── directive-features-fixes.js # Reliability fixes
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

`content.js` bootstraps everything in this order:

1. Wait for `#left-nav-panel` DOM element (max 10s)
2. `ensureSettingsNamespace()` — Create settings with defaults
3. `initializeStorage()` + `migrateFromLocalStorage()` — One-time migration
4. `initializeThemes()` — Load theme CSS early
5. `loadAndSetDividerRegex()` — Compile divider patterns
6. `NemoCharacterManager.initialize()` — Character management
7. `NemoSettingsUI.initialize()` — Settings panel (polls for container)
8. `initThemeSelector()` — Theme picker handlers
9. `NemoGlobalUI.initialize()` — Global UI helpers
10. `NemoPromptArchiveUI.initialize()` — Archive panel
11. `UserSettingsTabs` + `AdvancedFormattingTabs` — Tab overhauls (if enabled)
12. `NemoWorldInfoUI.initialize()` — Lorebook UI (if enabled)
13. `animatedBackgrounds.initialize()` — Backgrounds (if enabled)
14. `initializeDirectiveCache()` — Cache (1s delay)
15. `initDirectiveUI()` — Directive toast notifications
16. `initPromptDirectiveHooks()` + `initMessageTriggerHooks()` — Toggle interception
17. `initDirectiveAutocomplete()` — Editor autocomplete
18. `initDirectiveFeatures()` + `initDirectiveFeaturesFixes()` — Directive features
19. `initCategoryTray()` — Tray display mode
20. `initPollinationsInterceptor()` — Pollinations (if enabled)
21. `applyNemoNetReasoning()` — Reasoning parser
22. `initializeHTMLTrimmer()` + `setupAutoTrim()` — HTML trimming
23. `tutorialManager.initialize()` + `tutorialLauncher.initialize()` — Tutorials
24. `ExtensionsTabOverhaul.initialize()` — Extensions panel (if enabled)
25. `initializeMobileEnhancements()` — Touch device detection
26. MutationObserver setup — Watch for DOM changes to reinitialize prompt list
