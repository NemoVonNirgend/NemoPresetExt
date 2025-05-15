---

### Using NemoPresetExt for SillyTavern

NemoPresetExt helps organize your SillyTavern prompts. It makes long lists of prompts easier to manage by grouping them into collapsible sections and adding a search bar.

**How to Create Collapsible Sections:**

To make a section, you need to create a special "divider" prompt.
1.  Name a new prompt (or rename an existing one) so that it starts with one or more equals signs (`=`).
    *   For example: `=== My Story Ideas ===` or `== Character Notes ==`
2.  This prompt will become a clickable section header.
3.  All regular prompts listed *after* this header (and before the next similar header) will be grouped under it.
4.  Click the header to show (expand) or hide (collapse) the prompts inside that section. The extension will remember which sections you've opened or closed.
5.  Section headers will also show a count of how many prompts inside them are currently turned on (enabled).

**Finding Prompts with the Search Bar:**

NemoPresetExt adds a search bar above your list of prompts.
1.  Start typing any part of a prompt's name or a section header's name into the search bar.
2.  The list will automatically filter to show only the prompts and sections that match what you're typing.
3.  If you clear the search bar, all your prompts and sections will be shown again, keeping their open/closed states.

**Changing the Divider Style (Optional):**

By default, section headers are created with equals signs (`=`). If you want to use different characters (like hyphens `---`):
1.  Go to SillyTavern's main settings (the cogwheel icon).
2.  Click on the "Extensions" tab.
3.  Find the "NemoPreset UI" settings.
4.  You'll see an option called "Divider Regex Pattern." The default `=+` means "one or more equals signs." You can change this to something like `---+` if you want to use hyphens for your dividers.
5.  Save the settings. The extension will now look for your new divider style.

This extension is designed to make your prompt list cleaner and easier to navigate.
