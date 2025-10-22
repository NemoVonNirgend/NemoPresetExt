## Table of Contents
- [Key Features](#key-features)
- [How It Works: The Three Pillars](#how-it-works-the-three-pillars)
- [Usage Guide](#usage-guide)
  - [Initial Setup](#initial-setup)
  - [The Settings Panel](#the-settings-panel)
  - [The Regex Navigator](#the-regex-navigator)
  - [AI Rule Generation in Action](#ai-rule-generation-in-action)
- [For Power Users](#for-power-users)
  - [Manually Adding Static Rules](#manually-adding-static-rules)
  - [Understanding the AI Prompt](#understanding-the-ai-prompt)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [Contributing](#contributing)
- [License](#license)

---

## Key Features

*   **✒️ Curated Static Rules:** Comes pre-loaded with over 30 high-quality rules to fix the most common writing clichés, such as repetitive blushing, hitched breaths, pounding hearts, and more.
*   **🧠 Smart Learning:** When enabled, the extension actively listens to AI messages, identifies *new* repetitive phrases unique to your current model or character, and uses an LLM to automatically generate new, creative text fixes to replace them.
*   **🎛️ Full Regex Navigator:** A dedicated UI to view, enable/disable, edit, and create your own static or dynamic rules without ever touching a JSON file.
*   **📊 On-Demand Chat Analysis:** Analyze your entire chat history with a single click to instantly populate frequency data and identify repetitive phrases for AI text fix generation.
*   **Capitalization Correction:** Automatically capitalizes the beginning of sentences in AI responses, ensuring that replacements fit seamlessly and grammatically.
*   **💡 Intelligent Pattern Detection:** The frequency analysis is smart. It groups similar phrases (e.g., "a flicker of doubt crossed his eyes" and "a flicker of anger crossed his face") into a single, more powerful pattern.
*   **✅ Seamless Integration:** Fixes are applied globally and instantly, altering both the displayed chat and the context sent in the next prompt, preventing the AI from repeating the same phrases.

---

## How It Works: The Three Pillars

Prose Polisher operates on three core principles to provide a comprehensive solution.

1.  **Static Correction (The Foundation):**
    The `regex_rules.json` file contains a list of hand-crafted rules that target common, universally acknowledged writing crutches. When "Quick Fixes" is on, these rules are always active, instantly replacing phrases like *"His cheeks flushed red"* with more engaging alternatives like *"as warmth spread across his cheeks"*.

2.  **Dynamic Learning (The Smart Assistant):**
    This is the AI-powered core. When "Enable Dynamic AI Learning" is active:
    *   The extension analyzes every incoming AI message for repetitive phrases (n-grams).
    *   When a phrase is repeated more than a set number of times (`SLOP_THRESHOLD`, default 3), it's flagged as a "slop candidate".
    *   After a certain number of further messages (`dynamicTriggerCount`), the extension sends these candidates to an LLM.
    *   The AI is prompted to act as a regex expert, creating new `findRegex` and `replaceString` rules for the provided slop.
    *   These new rules are automatically saved and activated, teaching Prose Polisher how to fix the specific bad habits of your current AI model.

3.  **User Control (The Cockpit):**
    You are the final arbiter of style. The **Regex Navigator** and settings panel give you total control. You can disable rules you don't like, edit AI-generated rules to better suit your taste, or create entirely new ones from scratch. You can also manually trigger the analysis and rule generation process at any time.

---

## Usage Guide

### Initial Setup

After installation, navigate to the Extensions settings panel. You will find the "Prose Polisher (Regex + AI)" section.

*   **Enable Static Regex Fixes:** It's highly recommended to keep this checked. This activates the foundational set of rules.
*   **Enable Dynamic AI Learning:** Check this if you want the extension to learn and adapt to your AI's writing style. This is the most powerful feature of the extension.

**Note:** ProsePolisher automatically uses the "Card Emporium Default Preset" when generating AI rules for consistent, high-quality results. Your current preset will be restored after each generation.

### The Settings Panel

*   **Auto-Rule Gen Trigger:** This number determines how many AI messages to wait *after* a slop candidate has been identified before sending it to the AI for rule generation. A lower number means faster rule creation; a higher number means it will batch more candidates together.
*   **Open Regex Navigator:** Opens the main UI for managing all your rules.
*   **Clear Frequency Data:** Resets all tracked phrase counts. Use this if you switch models or characters and want to start fresh.
*   **Analyze Chat History:** A powerful tool. Click this to have Prose Polisher read your *entire* current chat history and build a list of all repetitive phrases. This is the fastest way to find slop.
*   **View Frequency Data:** Opens a popup showing a live leaderboard of the most-repeated phrases and detected patterns in your chat.
*   **Generate AI Rules from Analysis:** After running an analysis or letting the extension run for a while, click this to *manually* trigger the AI rule generation process for all currently identified slop candidates.

### The Regex Navigator

This is your command center for all rules.

*   **Static vs. Dynamic:** Rules are clearly marked. Static rules (from the base file) cannot be deleted or have their content edited, but they can be disabled. Dynamic rules (created by you or the AI) are fully editable.
*   **Enable/Disable:** Click the toggle icon on the right to quickly turn any rule on or off.
*   **Edit/View:** Click anywhere else on a rule to open the editor.
*   **Create:** Click the "New Dynamic Rule" button to create a custom rule from scratch.
*   **New Rule Highlighting:** Newly AI-generated rules will have a pulsing glow, making them easy to spot.

### AI Rule Generation in Action

1.  Enable both Static and Dynamic modes.
2.  Chat with your character as you normally would.
3.  As the AI repeats itself, Prose Polisher silently counts the phrases in the background.
4.  Once a phrase is identified as slop, you can either:
    *   Wait for the trigger count to be met, and let the AI generate a rule automatically.
    *   Click "Generate AI Rules from Analysis" to force the process immediately.
5.  A toast notification will inform you that the AI is working.
6.  Once complete, a success message will appear, and the new rules will be visible (and active!) in the Regex Navigator.

---

## For Power Users

### Manually Adding Static Rules

If you have a set of regex fixes you always want to use, you can add them to the core ruleset.

1.  Navigate to `/public/scripts/extensions/third-party/ProsePolisher/`.
2.  Open `regex_rules.json` in a text editor.
3.  Add your new rule object to the JSON array, following the existing format. A valid rule requires an `id`, `scriptName`, `findRegex`, and `replaceString`.
    ```json
    {
        "id": "STATIC_999",
        "scriptName": "Slopfix - My Custom Fix",
        "findRegex": "\\b([Hh]e|[Ss]he) let out a breath (?:[Hh]e|[Ss]he) didn't know (?:[Hh]e|[Ss]he) was holding\\b",
        "replaceString": "{{random:$1 exhaled sharply,A sigh escaped $1 lips,with a sudden release of breath}}",
        "disabled": false,
        "isStatic": true
    }
    ```
4.  Restart SillyTavern for the new static rules to be loaded.

### Understanding the AI Prompt

Curious how the dynamic rules are made? The extension uses a detailed system prompt to instruct the LLM. You can find the full prompt in `content.js` inside the `generateAndSaveDynamicRules` function. This allows you to see the exact instructions the AI follows and even modify them if you wish to experiment.

---

## Troubleshooting & FAQ

*   **Q: The AI-generated rules aren't very good!**
    *   **A:** The quality of the generated rules depends heavily on the LLM used for generation (`deepseek-reasoning` by default). You can edit or delete any bad rule via the Regex Navigator. You can also try editing the system prompt in `content.js` to give the AI better instructions.

*   **Q: The extension isn't doing anything.**
    *   **A:** Make sure you have enabled the toggles in the settings panel. If using dynamic mode, remember that it takes several repetitions of a phrase before a rule is even considered for creation. Try using the "Analyze Chat History" button to kickstart the process.

*   **Q: I see `(PP)` rules in the main Regex settings, but I can't edit them there.**
    *   **A:** This is intentional. Prose Polisher's rules are hidden from the standard Regex Processor UI to avoid clutter and confusion. **Always** use the **Prose Polisher Regex Navigator** to manage its rules.

---

## Contributing

Feedback, bug reports, and pull requests are welcome!

1.  **Suggestions & Bug Reports:** Please open an issue on the GitHub repository, providing as much detail as possible.
2.  **New Static Rules:** If you have a high-quality regex for a common cliché, feel free to open a pull request to add it to the `regex_rules.json` file for everyone to use.

---
