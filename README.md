# NemoPresetExt - Core Features

A powerful SillyTavern extension focused on enhancing your prompt management, UI organization, and workflow. This is the core features version that provides essential tools for power users without the experimental features.

**Version:** 4.6.3-mid-patch
**Author:** @NemoVonNirgend
**Homepage:** https://github.com/NemoVonNirgend/NemoPresetExt

## Table of Contents

- [Features Overview](#features-overview)
- [Core Preset Management](#core-preset-management)
- [Preset Navigator](#preset-navigator)
- [Directives Engine](#directives-engine)
- [Animated Backgrounds](#animated-backgrounds)
- [UI Overhauls](#ui-overhauls)
- [NemoNet Reasoning](#nemonet-reasoning)
- [HTML Trimmer](#html-trimmer)
- [Tutorial System](#tutorial-system)
- [Installation](#installation)

---

## Features Overview

This extension bundle includes the following production-ready features:

- **[Core Preset Management](#core-preset-management):** Organize prompts with collapsible sections, search, and drag-and-drop
- **[Preset Navigator](#preset-navigator):** Browse and manage API presets with an enhanced interface
- **[Directives Engine](#directives-engine):** Add powerful metadata, dependencies, and rules to prompts
- **[Animated Backgrounds](#animated-backgrounds):** Support for video backgrounds (WebM, MP4) and YouTube URLs
- **[UI Overhauls](#ui-overhauls):** Enhanced tabs, panels, and settings organization
- **[NemoNet Reasoning](#nemonet-reasoning):** Robust Chain of Thought (CoT) reasoning parser
- **[HTML Trimmer](#html-trimmer):** Automatically reduce context usage by trimming old HTML messages
- **[Tutorial System](#tutorial-system):** Interactive tutorials with Vex, your guide to all features

**Note:** This version does NOT include NemoLore, ProsePolisher, Ember, Card Emporium, MoodMusic, or NEMO-VRM. These features may be available in other versions or as separate extensions

---

## Core Preset Management

The foundational feature that started it all - powerful tools for organizing and managing your prompts.

### Collapsible Sections

Organize long lists of prompts by grouping them into collapsible sections:

1. **Create a Divider:** Name a prompt starting with equals signs (`=`). Example: `=== My Story Ideas ===`
2. **Grouping:** All regular prompts after this divider (and before the next one) will be grouped under it
3. **Expand/Collapse:** Click the header to show/hide prompts. The extension remembers your preferences
4. **Enabled Count:** Section headers display how many prompts are currently enabled (e.g., "5/12 enabled")

### Search & Filter

A powerful search bar above your prompt list:
- Instantly filter prompts and section headers by name
- Case-insensitive searching
- Highlights matching text
- Works across all sections

### Drag-and-Drop Reordering

Reorganize your prompts with intuitive drag-and-drop:
- Click and drag any prompt to a new position
- Reorder sections by dragging dividers
- Visual feedback while dragging
- Changes save automatically

### Prompt Archive

Access archived or disabled prompts:
- View all archived prompts in one place
- Restore archived prompts when needed
- Keep your active prompt list clean

### Custom Dividers

Customize the divider pattern in extension settings:
1. Go to **SillyTavern Settings** > **Extensions** > **NemoPreset UI**
2. Change the **Divider Regex Pattern**
3. Examples: `---+` for hyphens, `\*\*\*+` for asterisks
4. Click **Save** to apply changes

---

## Preset Navigator

An enhanced interface for browsing and managing API presets across all supported providers.

### Features

- **Browse Button:** Adds a "Browse..." button next to preset dropdowns
- **Visual Preset Browser:** See all your presets at a glance with a modern UI
- **Quick Search:** Filter presets by name instantly
- **Preview:** View preset details before switching
- **Multi-API Support:** Works with OpenAI, Anthropic, Google, Mistral, OpenRouter, and more

### Supported APIs

The Preset Navigator enhances the following API providers:
- OpenAI
- Anthropic (Claude)
- Google (Gemini)
- Novel AI
- Kobold
- Text Generation WebUI
- Scale
- Cohere
- Mistral
- AIX
- OpenRouter

### Usage

1. Navigate to your API settings
2. Look for the preset dropdown
3. Click the **"Browse..."** button next to it
4. Browse, search, and select presets visually

---

## Animated Backgrounds

Enhance your chat experience with dynamic video backgrounds and YouTube integration.

### Supported Formats

- **Video Files:** `.webm`, `.mp4` (high performance, recommended)
- **GIF Files:** `.gif` (also supported)
- **YouTube URLs:** Direct YouTube video links with embedded player

### Features

- **Seamless Playback:** Smooth looping without interruption
- **Autoplay Control:** Enable/disable automatic playback
- **Volume Control:** Adjust background video audio levels
- **Performance Optimized:** Efficient rendering without impacting chat performance
- **Background UI Enhancements:** Enhanced controls in the background settings panel

### Usage

1. Enable **Animated Backgrounds** in extension settings (requires refresh)
2. Go to SillyTavern's background settings
3. Select or upload a video file, or paste a YouTube URL
4. Customize playback settings (loop, autoplay, volume)
5. Enjoy your dynamic background!

### Pro Tips

- Use `.webm` format for best performance and file size
- Keep videos under 1080p for optimal performance
- Lower volume or mute if you prefer silent backgrounds
- YouTube videos require an internet connection

---

## Directives Engine

A powerful metadata and rules system embedded directly in your prompts using special comment syntax. Think of it as logic and automation for your prompt system.

### Syntax

Directives use the comment syntax: `{{// @directive arguments }}`

Example: `{{// @tooltip This prompt handles character emotions }}`

### Available Directives

#### Display & Documentation
- **`@tooltip <text>`** - Adds hover tooltip to explain what the prompt does
- **`@category <name>`** - Organize prompts into logical categories
- **`@description <text>`** - Longer description for prompt documentation

#### Dependencies & Conflicts
- **`@requires <prompt_name>`** - Auto-enable required prompts when this one is enabled
- **`@conflicts-with <prompt_name>`** - Auto-disable conflicting prompts
- **`@exclusive-with <prompt_name>`** - Only one prompt in the group can be active

#### Conditional Logic
- **`@enabled-if <condition>`** - Only enable prompt if condition is met
- **`@disabled-if <condition>`** - Disable prompt if condition is met
- **`@api <api_name>`** - Only show prompt for specific API providers (e.g., `@api anthropic`)

#### Automation & Triggers
- **`@trigger <event>`** - Automatically enable/disable based on events
- **`@priority <number>`** - Control prompt ordering/priority
- **`@scope <scope_name>`** - Limit prompt to specific contexts (e.g., character, global)

### Autocomplete Support

The extension includes intelligent autocomplete:
- Type `{{//` in a prompt to trigger directive suggestions
- Tab-complete directive names
- See inline examples and syntax hints
- Alias support for common directive patterns

### Example Usage

```
{{// @tooltip Handles the character's personality traits }}
{{// @requires CharacterDefinition }}
{{// @conflicts-with AlternativePersonality }}
{{// @category Character }}
{{// @api anthropic }}

Your prompt content goes here...
```

### Use Cases

- **Preset Packages:** Bundle related prompts with automatic dependency management
- **API-Specific Prompts:** Show different prompts for Claude vs GPT
- **Smart Presets:** Create presets that adapt based on context
- **Documentation:** Self-documenting prompts for sharing with others

---

## UI Overhauls

Comprehensive visual and organizational improvements to the SillyTavern interface.

### Extensions Tab Overhaul

A completely redesigned extensions panel with better organization:

- **Category Grouping:** Extensions organized into logical categories
- **Search Functionality:** Quickly find any extension by name
- **Visual Hierarchy:** Clean, modern layout with better spacing
- **Collapsible Sections:** Expand/collapse categories to reduce clutter
- **Enable/Disable:** Toggle on/off in extension settings (requires refresh)

### User Settings Tabs

Transform the User Settings panel into a tabbed interface:

- **Organized Tabs:** Settings grouped into logical categories
- **Easier Navigation:** Jump directly to the section you need
- **Less Scrolling:** Tabbed layout reduces page length
- **Visual Consistency:** Matches SillyTavern's design language
- **Toggle:** Enable/disable in extension settings (requires refresh)

### Advanced Formatting Tabs

Enhanced Advanced Formatting panel with tab organization:

- **Prompt Categories:** Prompts organized into tabs
- **Context Template Tabs:** Easier access to template settings
- **Improved Workflow:** Less scrolling, faster access
- **Clean Interface:** Professional, organized appearance
- **Toggle:** Enable/disable in extension settings (requires refresh)

### Lorebook UI Overhaul

Enhanced World Info/Lorebook interface:

- **Better Organization:** Improved layout for managing entries
- **Visual Improvements:** Cleaner, more intuitive design
- **Enhanced Controls:** Better entry management tools
- **Quick Access:** Streamlined workflow for lorebook editing
- **Toggle:** Enable/disable in extension settings (requires refresh)

### Wide Navigation Panels

Expand side panels to 50% viewport width:

- **More Space:** Side panels take up 50% of screen width instead of default
- **Better Readability:** More room for content and settings
- **Less Scrolling:** See more at once
- **Toggle:** Enable/disable anytime (instant effect)
- **Default:** Enabled by default, can be turned off in settings

### Quick Lorebook Access

Manage active lorebooks directly from the prompt manager:

- **Inline Controls:** Toggle lorebooks without leaving the prompt manager
- **Visual Indicators:** See which lorebooks are active at a glance
- **Quick Toggle:** One-click enable/disable for lorebooks
- **Context Aware:** Shows relevant lorebooks for current character

### Unified Reasoning Section

Consolidate reasoning controls in the prompt manager:

- **One Place:** All reasoning-related prompts in a dedicated section
- **Better Organization:** Chain of Thought (CoT) prompts grouped together
- **Easy Access:** Find and manage reasoning prompts quickly
- **Toggle:** Enable/disable in extension settings

---

## NemoNet Reasoning

A robust Chain of Thought (CoT) reasoning parser designed to handle complex, nested thinking patterns in AI responses.

### What It Does

NemoNet Reasoning parses and formats AI-generated reasoning steps, making the AI's thought process:
- **Visible:** See how the AI arrives at conclusions
- **Structured:** Organized into clear, readable sections
- **Collapsible:** Hide/show reasoning to reduce clutter
- **Preserved:** Reasoning is maintained but can be hidden from context window

### Features

- **Robust Parsing:** Handles complex, nested reasoning structures
- **Multiple Format Support:** Works with various CoT prompt styles
- **Automatic Detection:** Recognizes reasoning blocks automatically
- **Visual Formatting:** Clean, organized display of thought processes
- **Context Optimization:** Option to exclude reasoning from AI context
- **Debugging Tools:** Built-in testing and validation tools

### Compatible Reasoning Formats

The parser handles various CoT structures:
- Standard thinking tags (`<think>`, `<reasoning>`)
- Nested reasoning levels
- Council/committee reasoning (multi-perspective)
- Step-by-step problem solving
- Custom reasoning formats

### Configuration

The reasoning system is configurable via `nemonet-reasoning-config.js`:
- Adjust parsing rules
- Customize display format
- Enable/disable features
- Fine-tune detection patterns

### Use Cases

- **Problem Solving:** See how AI breaks down complex problems
- **Decision Making:** Understand AI's reasoning for choices
- **Learning:** Study how AI approaches different tasks
- **Debugging:** Identify errors in AI reasoning
- **Transparency:** Make AI behavior more interpretable

### Example

```
User: Solve this math problem...

AI: <think>
Let me break this down step by step:
1. First, identify the variables...
2. Then, apply the formula...
3. Finally, calculate the result...
</think>

Based on my reasoning, the answer is...
```

The reasoning parser will format the thinking section beautifully and allow you to collapse it.

---

## HTML Trimmer

Automatically reduce context usage by converting complex HTML/CSS in old messages to simple text dropdowns.

### The Problem

Interactive HTML content (like formatted tables, styled text, or embedded components) can consume significant context space. As conversations grow longer, this can:
- Reduce available tokens for the AI
- Slow down response times
- Increase API costs
- Cause context overflow

### The Solution

HTML Trimmer automatically processes old messages and converts verbose HTML/CSS into compact, collapsible text summaries:
- **Selective Trimming:** Only affects old messages, keeps recent ones intact
- **Readable Output:** Maintains content in a simple dropdown format
- **Context Savings:** Can reduce message size by 70-90%
- **Non-Destructive:** Original content preserved in collapsed state

### Features

- **Auto-Trim:** Automatically trim old HTML when enabled
- **Configurable Threshold:** Set how many recent messages to keep untouched (default: 4)
- **Manual Trim:** Trigger trimming on-demand with "Trim Now" button
- **Smart Detection:** Only processes messages with significant HTML/CSS
- **Status Feedback:** See how many messages were trimmed and tokens saved

### Configuration

1. Go to **Extensions** > **NemoPreset UI** > **Feature Toggles**
2. Enable **Auto-Trim Old HTML**
3. Set **Keep last N messages untouched** (default: 4)
4. Use **Trim Now** button for manual trimming

### Usage Tips

- Keep threshold at 4-6 for best balance of context and usability
- Run manual trim before important conversations
- Great for long roleplays with lots of formatted content
- Compatible with all HTML-generating extensions

---

## Tutorial System

An interactive tutorial system featuring Vex, your friendly guide to all extension features.

### Meet Vex

Vex is your personal assistant for learning NemoPresetExt:
- **Friendly Guide:** Casual, helpful personality
- **Visual Novel Style:** Engaging dialogue-based tutorials
- **Step-by-Step:** Clear instructions with highlighted elements
- **Always Available:** Restart tutorials anytime

### Available Tutorials

The tutorial system includes comprehensive guides for all features:

1. **Welcome Tutorial** - Introduction to the extension suite
2. **Preset Management** - Learn collapsible sections and organization
3. **Preset Navigator** - Browse and manage API presets visually
4. **Animated Backgrounds** - Set up video and YouTube backgrounds
5. **Directives Engine** - Master prompt metadata and rules
6. **UI Overhauls** - Navigate the enhanced interface
7. **NemoNet Reasoning** - Understand Chain of Thought parsing
8. **HTML Trimmer** - Optimize context usage automatically
9. **NemoEngine 7.6 Setup Guide** - Complete step-by-step configuration walkthrough (25 detailed steps)
10. **Quick Tips** - Keyboard shortcuts and hidden features

### Features

- **Interactive Highlights:** UI elements highlighted during tutorials
- **Progress Tracking:** Resume where you left off
- **Skip Anytime:** Skip tutorials you don't need
- **Restart Capability:** Replay any tutorial
- **First-Time Auto-Start:** Welcome tutorial on first use

### Accessing Tutorials

1. **First Time:** Welcome tutorial auto-starts on installation
2. **Tutorial Menu:** Access from extension settings
3. **Restart:** Click "Restart Tutorials" in settings
4. **Skip:** Click "Skip" during any tutorial

### Tutorial Launcher

The tutorial launcher provides:
- **Tutorial Browser:** See all available tutorials
- **Category Filter:** Browse by topic (Getting Started, Core, UI, etc.)
- **Progress Indicators:** See which tutorials you've completed
- **Quick Launch:** Start any tutorial with one click

---

## Installation

### Requirements

- **SillyTavern:** Version 1.11.0 or higher recommended
- **Browser:** Modern browser with JavaScript enabled
- **Storage:** Minimal disk space required

### Installation Steps

1. **Download the Extension**
   - Clone or download this repository
   - Or use SillyTavern's built-in extension installer

2. **Install to SillyTavern**
   ```
   SillyTavern/
   └── public/
       └── scripts/
           └── extensions/
               └── third-party/
                   └── NemoPresetExt/  ← Place files here
   ```

3. **Enable the Extension**
   - Open SillyTavern
   - Go to **Extensions** tab
   - Find **NemoPresetExt** in the list
   - Toggle it **ON**

4. **Refresh the Page**
   - Refresh SillyTavern (F5 or Ctrl+R)
   - The extension will initialize automatically

5. **Configure Settings**
   - Go to **Extensions** > **NemoPreset UI**
   - Enable/disable features as desired
   - Customize divider patterns, themes, etc.

### First-Time Setup

On first use:
1. Vex's welcome tutorial will auto-start
2. Follow the tutorial or skip if you prefer
3. Configure your preferred features in settings
4. Create your first dividers in the prompt manager

### Updating

To update the extension:
1. Backup your settings (optional but recommended)
2. Download the latest version
3. Replace old files with new ones
4. Refresh SillyTavern
5. Settings will be preserved automatically

### Troubleshooting

**Extension not loading?**
- Check browser console for errors (F12)
- Ensure files are in correct directory
- Verify extension is enabled in Extensions tab
- Try refreshing the page

**Features not working?**
- Some features require a page refresh to enable
- Check extension settings for toggles
- Ensure your SillyTavern version is up to date

**Need help?**
- Check the GitHub repository for issues
- Visit the SillyTavern Discord
- Review tutorial system for feature guidance

---

## Credits

**Author:** @NemoVonNirgend
**Homepage:** https://github.com/NemoVonNirgend/NemoPresetExt
**Version:** 4.6.3-mid-patch

### Acknowledgments

Thanks to:
- SillyTavern community for feedback and testing
- Contributors who helped improve the extension
- Users who create and share amazing presets

---

## License

This extension is provided as-is for use with SillyTavern. See the repository for license details.

---

## Support

For issues, feature requests, or contributions:
- **GitHub:** https://github.com/NemoVonNirgend/NemoPresetExt
- **Discord:** SillyTavern community server

Enjoy your enhanced SillyTavern experience! 🎉
