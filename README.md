# Nemo's SillyTavern Extension Suite

This extension is a comprehensive suite of tools designed to enhance your SillyTavern experience. It includes a variety of features, from prompt management and content generation to UI overhauls and interactive chat elements.

## Table of Contents

- [Features](#features)
- [Core Preset Management](#core-preset-management)
- [Card & Lorebook Emporium](#card--lorebook-emporium)
- [Animated Backgrounds](#animated-backgrounds)
- [Directives Engine](#directives-engine)
- [Ember Universal Renderer](#ember-universal-renderer)
- [NemoLore](#nemolore)
- [ProsePolisher](#prosepolisher)
- [MoodMusic](#moodmusic)
- [NEMO-VRM](#nemovrm)
- [UI Overhauls](#ui-overhauls)
- [NemoNet Reasoning](#nemonet-reasoning)

---

## Features

This extension is a bundle of several powerful modules. Here's a look at what's included:

- **[Core Preset Management](#core-preset-management):** Organize your prompts with collapsible sections and a search bar.
- **[Card & Lorebook Emporium](#card--lorebook-emporium):** A powerful tool for generating character cards and lorebooks.
- **[Animated Backgrounds](#animated-backgrounds):** Use videos, GIFs, and even YouTube videos as your chat background.
- **[Directives Engine](#directives-engine):** Add powerful metadata and rules to your prompts.
- **[Ember Universal Renderer](#ember-universal-renderer):** Render interactive HTML and JavaScript content directly in your chat messages.
- **[NemoLore](#nemolore):** Advanced lorebook and memory management, including automatic summarization and vector search.
- **[ProsePolisher](#prosepolisher):** An AI-powered tool for analyzing and improving your writing.
- **[MoodMusic](#moodmusic):** Connect to Spotify and have the music change based on the mood of your chat.
- **[NEMO-VRM](#nemovrm):** Display and animate 3D character models.
- **[UI Overhauls](#ui-overhauls):** Various improvements to the SillyTavern interface.
- **[NemoNet Reasoning](#nemonet-reasoning):** A Chain of Thought reasoning system for AI models.

---

## Core Preset Management

The original feature of this extension, designed to make managing your prompts easier.

### Collapsible Sections

Organize long lists of prompts by grouping them into collapsible sections.

1.  **Create a Divider:** Name a new prompt (or rename an existing one) to start with one or more equals signs (`=`). For example: `=== My Story Ideas ===`.
2.  **Grouping:** All regular prompts listed after this divider (and before the next one) will be grouped under it.
3.  **Expand/Collapse:** Click the header to show or hide the prompts in that section. The extension will remember which sections you've opened or closed.
4.  **Enabled Count:** Section headers show a count of how many prompts inside them are currently enabled.

### Search Bar

A search bar is added above your prompt list, allowing you to quickly filter prompts and section headers by name.

### Custom Dividers

You can change the characters used for dividers in the extension's settings.

1.  Go to **SillyTavern's main settings** > **Extensions**.
2.  Find the **NemoPreset UI** settings.
3.  Change the **Divider Regex Pattern**. For example, to use hyphens, you could enter `---+`.

---

## Card & Lorebook Emporium

A powerful, integrated tool for generating character cards and lorebooks using AI.

- **AI-Powered Generation:** Use AI to help you create detailed character cards and lorebooks from scratch.
- **Image Generation:** Generate character portraits and other images directly within the Emporium.
- **SillyTavern Integration:** Seamlessly import and export your creations to and from SillyTavern.

To access the Emporium, look for the **"Emporium" button** in the character management screen.

---

## Animated Backgrounds

Bring your chats to life with animated backgrounds.

- **Supported formats:** `.webm`, `.mp4`, `.gif`, and YouTube URLs.
- **Customization:** Control looping, autoplay, and volume from the settings.

To use an animated background, simply set the background in SillyTavern to a supported video file or YouTube URL.

---

## Directives Engine

Embed powerful metadata and rules directly into your prompts using special comments. This allows for complex interactions between prompts. This is a more advanced version of SillyTavern's "World Info" or "Lorebooks".

- **Syntax:** Directives are placed inside `{{// ... }}` comments. For example: `{{// @tooltip My awesome prompt }}`
- **Features:**
    - **Tooltips:** `@tooltip <text>`
    - **Dependencies:** `@requires <prompt_id>`
    - **Conflicts:** `@exclusive-with <prompt_id>` and `@conflicts-with <prompt_id>`
    - **And many more!** Check the `prompt-directives.js` file for a full list of available directives.

---

## Ember Universal Renderer

Render interactive HTML, CSS, and JavaScript content directly within chat messages.

- **Interactive Elements:** Create polls, quizzes, character sheets, and more.
- **Asset Packs:** Bundle your HTML, CSS, and JS into "asset packs" that can be triggered by the AI.
- **AI Integration:** The AI can send code to be rendered, allowing for dynamic and interactive storytelling.

---

## NemoLore

An advanced system for managing lore and memory. This is a feature created by Nemo and is not a standard SillyTavern feature.

- **Automatic Summarization:** Automatically summarize long conversations to save space and maintain context.
- **Automatic Lorebook Generation:** The AI can automatically create lorebook entries based on the conversation.
- **Vector-Based Memory:** Uses a vector database for advanced memory and cross-chat search, allowing the AI to recall information from past conversations.

---

## ProsePolisher

An AI-powered tool for analyzing and improving your writing.

- **Regex and AI:** Uses a combination of regular expressions and AI to identify and suggest improvements to your prose.
- **Project Gremlin:** An AI-driven system for analyzing text and providing detailed feedback.

---

## MoodMusic

Connects to Spotify to play music that matches the mood of your chat.

- **Spotify Integration:** Requires a Spotify Premium account and API credentials.
- **Mood Analysis:** Automatically analyzes the mood of the chat and selects appropriate music.
- **Local File Playback:** Plays audio files (such as .mp3, .ogg, and .wav) from your local SillyTavern data folder.

---

## NEMO-VRM

Display and animate 3D character models in SillyTavern. VRM (Virtual Reality Model) is a standardized file format for 3D avatars.

- **VRM Support:** Supports the `.vrm` file format for 3D models.
- **Animations:** Trigger animations based on chat content and user actions.
- **SillyTavern Integration:** The VRM extension allows you to use 3D models as the visual representation of the AI character you're chatting with.

---

## UI Overhauls

This extension includes several improvements to the SillyTavern interface:

- **Collapsible Settings:** Many of the settings panels are converted into collapsible drawers for a cleaner look.
- **Extensions Tab Overhaul:** The extensions tab is reorganized for better navigation.
- **Nemo Suite Grouping:** All of Nemo's extensions are grouped together in the settings for easy access.

---

## NemoNet Reasoning

A Chain of Thought (CoT) reasoning system for AI models. This is a user-created preset for SillyTavern that uses CoT reasoning.

- **Robust Parsing:** A parser designed to handle complex, nested reasoning steps in AI-generated text.
- **Configurable:** The reasoning process can be configured through the `nemonet-reasoning-config.js` file.
- **Council of Avi:** The NemoEngine preset uses specific prompts and settings, such as the "Council of Avi," to structure the AI's reasoning process.
- **Debugging Tools:** Includes tools for testing and debugging the reasoning parser.
