/**
 * Tutorial Definitions - All tutorials with Vex's dialogue
 * Each tutorial has steps with text, highlights, and interactions
 *
 * This is the CORE version - only includes tutorials for features present in this build
 */

export const tutorials = {
    // Welcome Tutorial
    welcome: {
        name: 'Welcome to NemoPresetExt',
        description: 'Meet Vex and learn about the core extension features',
        category: 'getting-started',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Hey there, I'm Vex! 👋</h3>
                    <p>Welcome to NemoPresetExt! I'm your guide to all the powerful features in this extension.</p>
                    <p>Think of me as your personal assistant - I'll show you everything you need to know to make the most of your SillyTavern experience!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>What's Inside? 🎁</h3>
                    <p>This extension includes <strong>8 powerful core features</strong>:</p>
                    <ul>
                        <li><strong>Preset Management</strong> - Organize your prompts like a pro</li>
                        <li><strong>Preset Navigator</strong> - Browse and manage API presets visually</li>
                        <li><strong>Directives Engine</strong> - Add powerful logic to your prompts</li>
                        <li><strong>Animated Backgrounds</strong> - Video and YouTube background support</li>
                        <li><strong>UI Overhauls</strong> - Enhanced tabs, panels, and organization</li>
                        <li><strong>NemoNet Reasoning</strong> - Chain of Thought reasoning parser</li>
                        <li><strong>HTML Trimmer</strong> - Reduce context usage automatically</li>
                        <li><strong>Tutorial System</strong> - Interactive guides (that's me!)</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>How This Works 📚</h3>
                    <p>I'll guide you through each feature with step-by-step tutorials. You can:</p>
                    <ul>
                        <li>Navigate with <strong>Next</strong> and <strong>Previous</strong> buttons</li>
                        <li><strong>Skip</strong> any tutorial if you're already familiar</li>
                        <li>Restart tutorials anytime from the extension settings</li>
                        <li>I'll highlight UI elements and show you exactly where to click!</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Let's Get Started! 🚀</h3>
                    <p>Ready to dive in? You can either:</p>
                    <ul>
                        <li>Continue to learn about <strong>Preset Management</strong></li>
                        <li>Visit the <strong>Tutorials Menu</strong> to pick any feature</li>
                        <li>Skip for now and explore on your own</li>
                    </ul>
                    <p>The choice is yours! I'll be here whenever you need me. 😊</p>
                `
            }
        ]
    },

    // Preset Management Tutorial
    presetManagement: {
        name: 'Preset Management Basics',
        description: 'Learn to organize prompts with collapsible sections',
        category: 'core',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to Preset Management! 📋</h3>
                    <p>This is the original feature that started it all! Let me show you how to organize your prompts like a master.</p>
                    <p>With collapsible sections, you can group related prompts together and keep your workspace clean and organized.</p>
                `,
                highlightSelector: '#completion_prompt_manager_list',
                highlightText: 'This is your prompt list!'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 1: Opening the Prompt Manager 🚪</h3>
                    <p>First, let's make sure you know where to find your prompts:</p>
                    <ol>
                        <li>Open the <strong>left navigation panel</strong> (click the menu icon or press the shortcut)</li>
                        <li>Look for the <strong>"Advanced Formatting"</strong> section</li>
                        <li>Click on <strong>"Prompts"</strong> or <strong>"Completion Prompts"</strong></li>
                        <li>You'll see your list of prompts appear!</li>
                    </ol>
                    <p>This is where all the magic happens!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 2: Creating Your First Divider ✂️</h3>
                    <p>Let's create a collapsible section! Here's exactly how:</p>
                    <ol>
                        <li>Click the <strong>"+ New Prompt"</strong> button at the top</li>
                        <li>In the prompt name field, type: <code>=== My Story Prompts ===</code></li>
                        <li>You can leave the content empty or add a note</li>
                        <li>Click <strong>"Save"</strong></li>
                    </ol>
                    <p>Ta-da! You just created a divider! Notice how it looks different from regular prompts?</p>
                    <p><strong>Pro tip:</strong> Use more equals signs (like <code>====</code>) for bigger headers!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 3: Adding Prompts to Your Section 📝</h3>
                    <p>Now let's add some prompts under that divider:</p>
                    <ol>
                        <li>Create a new prompt (make sure it's <strong>after</strong> your divider in the list)</li>
                        <li>Give it a normal name like "Character Personality"</li>
                        <li>Add your prompt content</li>
                        <li>Save it</li>
                    </ol>
                    <p>The prompt will automatically appear <strong>under</strong> the divider section!</p>
                    <p>Any prompts between two dividers belong to the first divider's section.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 4: Collapsing and Expanding Sections 🎯</h3>
                    <p>Here's where it gets cool:</p>
                    <ol>
                        <li>Click on your divider header (the one that says "=== My Story Prompts ===")</li>
                        <li>Watch as all the prompts under it collapse and hide!</li>
                        <li>Click the header again to expand them back</li>
                    </ol>
                    <p>Notice the <strong>enabled counter</strong> on the right? It shows "2/5 enabled" (or similar) - that's how many prompts in that section are currently active!</p>
                    <p>The extension remembers which sections you've collapsed, so they stay that way even after refreshing!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 5: Using the Search Bar 🔍</h3>
                    <p>With lots of prompts, finding things can be tough. That's where search comes in!</p>
                    <ol>
                        <li>Look at the top of your prompt list for the <strong>search bar</strong></li>
                        <li>Type part of a prompt name, like "character"</li>
                        <li>Watch as the list filters to show only matching prompts!</li>
                        <li>Clear the search to see everything again</li>
                    </ol>
                    <p>The search works on both prompt names <strong>and</strong> section divider names, so you can filter entire sections!</p>
                `,
                highlightSelector: '.nemo-search-bar'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 6: Drag and Drop Reordering 🔄</h3>
                    <p>Want to rearrange your prompts? Easy!</p>
                    <ol>
                        <li>Click and <strong>hold</strong> on any prompt</li>
                        <li>Drag it up or down the list</li>
                        <li>You'll see a visual indicator showing where it'll drop</li>
                        <li>Release to drop it in the new position</li>
                    </ol>
                    <p>You can also drag entire dividers to move whole sections at once!</p>
                    <p><strong>Note:</strong> Changes save automatically - no need to click save!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 7: Organizing Multiple Sections 📚</h3>
                    <p>Here's a pro workflow for organizing complex presets:</p>
                    <ol>
                        <li>Create multiple dividers for different purposes:<br>
                            <code>=== Character Setup ===</code><br>
                            <code>=== World Building ===</code><br>
                            <code>=== Story Elements ===</code><br>
                            <code>=== Style Guidelines ===</code>
                        </li>
                        <li>Move existing prompts under the appropriate sections</li>
                        <li>Collapse sections you're not currently working on</li>
                        <li>Use the search to quickly find specific prompts</li>
                    </ol>
                    <p>This keeps even huge preset collections manageable!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 8: Custom Divider Patterns 🎨</h3>
                    <p>Want to use different symbols? You can customize the divider pattern!</p>
                    <ol>
                        <li>Go to <strong>Extensions</strong> in SillyTavern's settings</li>
                        <li>Find <strong>"NemoPreset UI Extensions"</strong></li>
                        <li>Look for <strong>"Divider Regex Pattern"</strong></li>
                        <li>Try entering: <code>---+</code> (for hyphens) or <code>\\*\\*\\*+</code> (for asterisks)</li>
                        <li>Click <strong>"Save"</strong></li>
                    </ol>
                    <p>Now prompts starting with <code>--- My Section ---</code> will become dividers too!</p>
                `,
                highlightSelector: '#nemoDividerRegexPattern'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>You're All Set! ✅</h3>
                    <p>Congratulations! You now know how to:</p>
                    <ul>
                        <li>✓ Create dividers with <code>===</code></li>
                        <li>✓ Group prompts into collapsible sections</li>
                        <li>✓ Expand and collapse sections</li>
                        <li>✓ Use the search bar to filter prompts</li>
                        <li>✓ Drag and drop to reorder</li>
                        <li>✓ Check enabled counters at a glance</li>
                        <li>✓ Customize divider patterns</li>
                    </ul>
                    <p>Ready to learn about the Preset Navigator next?</p>
                `
            }
        ]
    },

    // Preset Navigator Tutorial
    presetNavigator: {
        name: 'Preset Navigator',
        description: 'Browse and manage API presets with ease',
        category: 'core',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to Preset Navigator! 🧭</h3>
                    <p>Tired of scrolling through dropdown menus to find your presets? The Preset Navigator makes browsing and selecting API presets a breeze!</p>
                    <p>It works with all major API providers - OpenAI, Anthropic, Google, and more!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 1: Finding the Browse Button 🔍</h3>
                    <p>Here's how to access the Preset Navigator:</p>
                    <ol>
                        <li>Go to your <strong>API settings</strong> (click the plug icon in the top bar)</li>
                        <li>Select your API provider (like "Chat Completion (OpenAI)" or "Claude")</li>
                        <li>Look for the preset dropdown menu</li>
                        <li>Next to it, you'll see a <strong>"Browse..."</strong> button</li>
                    </ol>
                    <p>That's your gateway to the navigator!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 2: Opening the Navigator 🚀</h3>
                    <p>Let's open it up and see what's inside:</p>
                    <ol>
                        <li>Click the <strong>"Browse..."</strong> button</li>
                        <li>A beautiful visual browser will pop up</li>
                        <li>You'll see all your presets displayed as cards</li>
                        <li>Each card shows the preset name and details</li>
                    </ol>
                    <p>Much better than a plain dropdown, right?</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 3: Browsing Presets 👀</h3>
                    <p>Now you can explore your presets visually:</p>
                    <ul>
                        <li><strong>Scroll</strong> through the list to see all available presets</li>
                        <li><strong>Hover</strong> over a preset to see more details</li>
                        <li><strong>Current preset</strong> will be highlighted</li>
                        <li><strong>Preview details</strong> before switching</li>
                    </ul>
                    <p>Everything is organized and easy to find!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 4: Using Quick Search 🔎</h3>
                    <p>Got lots of presets? Use the search feature:</p>
                    <ol>
                        <li>Look for the <strong>search box</strong> at the top of the navigator</li>
                        <li>Type part of a preset name, like "creative"</li>
                        <li>The list filters instantly to show only matches</li>
                        <li>Clear the search to see all presets again</li>
                    </ol>
                    <p>Finding the right preset has never been faster!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 5: Selecting a Preset ✨</h3>
                    <p>Ready to switch to a different preset? Simple:</p>
                    <ol>
                        <li>Browse or search for the preset you want</li>
                        <li>Click on the preset card</li>
                        <li>The preset will be loaded immediately</li>
                        <li>The navigator will close automatically</li>
                    </ol>
                    <p>Your new preset is now active and ready to use!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 6: Multi-API Support 🌐</h3>
                    <p>The Preset Navigator works with these API providers:</p>
                    <ul>
                        <li><strong>OpenAI</strong> - GPT models</li>
                        <li><strong>Anthropic (Claude)</strong> - Claude models</li>
                        <li><strong>Google</strong> - Gemini and PaLM</li>
                        <li><strong>Mistral</strong> - Mistral models</li>
                        <li><strong>OpenRouter</strong> - Multi-model access</li>
                        <li><strong>And more!</strong> - Kobold, NovelAI, Text Gen WebUI, etc.</li>
                    </ul>
                    <p>Every API you use gets the same great browsing experience!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Navigator Master! 🎓</h3>
                    <p>You're now a Preset Navigator pro! Remember:</p>
                    <ul>
                        <li>✓ Click "Browse..." next to any preset dropdown</li>
                        <li>✓ Visual browsing beats dropdown menus</li>
                        <li>✓ Use search for quick filtering</li>
                        <li>✓ Preview before selecting</li>
                        <li>✓ Works with all major APIs</li>
                    </ul>
                    <p>Ready to learn about Directives next?</p>
                `
            }
        ]
    },

    // Animated Backgrounds Tutorial
    animatedBackgrounds: {
        name: 'Animated Backgrounds',
        description: 'Add life to your chats with videos and animations',
        category: 'visual',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Let's Make Things Move! 🎬</h3>
                    <p>Static backgrounds are so yesterday! Let me show you how to add animated backgrounds to your chats.</p>
                    <p>We support videos, GIFs, and even YouTube URLs!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 1: Enable Animated Backgrounds ⚙️</h3>
                    <p>First, we need to make sure the feature is turned on:</p>
                    <ol>
                        <li>Go to <strong>Extensions</strong> in SillyTavern's settings</li>
                        <li>Find <strong>"NemoPreset UI Extensions"</strong></li>
                        <li>Look for <strong>"Animated Backgrounds"</strong> toggle</li>
                        <li>Make sure it's <strong>enabled</strong> (checkbox checked)</li>
                        <li><strong>Refresh the page</strong> (F5) for changes to take effect</li>
                    </ol>
                    <p>Now you're ready to use animated backgrounds!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 2: Accessing Background Settings 🖼️</h3>
                    <p>Let's navigate to SillyTavern's background settings:</p>
                    <ol>
                        <li>Click the <strong>gear icon</strong> in the top right (or left nav panel)</li>
                        <li>Go to <strong>"User Settings"</strong></li>
                        <li>Scroll down to find the <strong>"Background"</strong> section</li>
                        <li>You'll see options for custom backgrounds</li>
                    </ol>
                    <p>This is where you'll set up your animated backgrounds!</p>
                `,
                highlightSelector: '#bg_custom'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 3: Adding a Video Background 🎥</h3>
                    <p>Let's add a video file as your background:</p>
                    <ol>
                        <li>Click <strong>"Browse"</strong> or <strong>"Upload"</strong> in the background section</li>
                        <li>Select a video file from your computer (.webm, .mp4, or .gif)</li>
                        <li>Wait for the file to upload</li>
                        <li>The video will automatically start playing as your background!</li>
                    </ol>
                    <p><strong>Recommended:</strong> Use .webm format for best performance and quality!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 4: Using YouTube Backgrounds 📺</h3>
                    <p>Want to use a YouTube video? Even easier:</p>
                    <ol>
                        <li>Go to YouTube and find the video you want</li>
                        <li>Copy the video URL (like: https://youtube.com/watch?v=...)</li>
                        <li>In the background settings, paste the URL</li>
                        <li>Hit enter or click apply</li>
                    </ol>
                    <p>Perfect for lofi beats, ambient soundscapes, or animated artwork!</p>
                    <p><strong>Note:</strong> Requires an internet connection to play.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 5: Controlling Playback 🎮</h3>
                    <p>Customize how your background plays:</p>
                    <ol>
                        <li>Go to <strong>Extensions</strong> > <strong>"NemoPreset UI"</strong></li>
                        <li>Find the <strong>"Animated Background Settings"</strong> section</li>
                        <li>Adjust these controls:
                            <ul>
                                <li><strong>Loop</strong> - Repeat forever or play once</li>
                                <li><strong>Autoplay</strong> - Start automatically or wait for click</li>
                                <li><strong>Volume</strong> - Adjust sound level (0-100)</li>
                            </ul>
                        </li>
                        <li>Changes apply immediately!</li>
                    </ol>
                `,
                highlightSelector: '.nemo-background-settings'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 6: Performance Optimization 🚀</h3>
                    <p>Keep your backgrounds smooth with these tips:</p>
                    <ul>
                        <li><strong>File Format:</strong> Use .webm for best size/quality ratio</li>
                        <li><strong>Resolution:</strong> 1080p is perfect - higher can lag</li>
                        <li><strong>File Size:</strong> Keep videos under 50MB if possible</li>
                        <li><strong>Length:</strong> Short loops (10-30 seconds) work best</li>
                        <li><strong>Volume:</strong> Lower or mute if you don't need sound</li>
                    </ul>
                    <p>These tips ensure smooth chatting with beautiful backgrounds!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>You're a Director Now! 🎥</h3>
                    <p>That's everything about animated backgrounds! You now know:</p>
                    <ul>
                        <li>✓ How to enable the feature</li>
                        <li>✓ Uploading video files (.webm, .mp4, .gif)</li>
                        <li>✓ Using YouTube URLs as backgrounds</li>
                        <li>✓ Controlling playback (loop, autoplay, volume)</li>
                        <li>✓ Optimizing for performance</li>
                    </ul>
                    <p>Experiment with different videos to find what sets the perfect mood for your stories!</p>
                `
            }
        ]
    },

    // Directives Engine Tutorial
    directivesEngine: {
        name: 'Directives Engine',
        description: 'Add powerful logic and metadata to your prompts',
        category: 'advanced',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Time to Get Advanced! 🎯</h3>
                    <p>The Directives Engine is one of the most powerful features in the suite. It lets you add logic, conditions, and metadata directly into your prompts!</p>
                    <p>Think of directives as superpowers for your prompts.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>What Are Directives? 🤔</h3>
                    <p>Directives are special comments you add to your prompts using this syntax:</p>
                    <code>{{// @directive_name value }}</code>
                    <p>For example:</p>
                    <code>{{// @tooltip This prompt handles character emotions }}</code>
                    <p>They're <strong>invisible to the AI</strong> but control how prompts behave in SillyTavern!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 1: Your First Directive ✨</h3>
                    <p>Let's add a simple tooltip directive:</p>
                    <ol>
                        <li>Open any prompt in the prompt manager</li>
                        <li>At the very <strong>top</strong> of the prompt content, add:<br>
                            <code>{{// @tooltip This is my test prompt }}</code>
                        </li>
                        <li>Save the prompt</li>
                        <li>Now <strong>hover</strong> over the prompt name in the list</li>
                        <li>You'll see a tooltip appear with your description!</li>
                    </ol>
                    <p>See how easy that was?</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 2: Using the Autocomplete 💡</h3>
                    <p>Don't memorize directives - use autocomplete instead!</p>
                    <ol>
                        <li>Open a prompt for editing</li>
                        <li>Type <code>{{//</code> at the start of a line</li>
                        <li>Wait a moment and an <strong>autocomplete menu</strong> appears!</li>
                        <li>Browse the available directives</li>
                        <li>Click one or use arrow keys + Enter to select</li>
                        <li>The directive is inserted with example syntax!</li>
                    </ol>
                    <p>The autocomplete shows you exactly what each directive does!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 3: Dependencies with @requires 🔗</h3>
                    <p>Make prompts depend on each other automatically:</p>
                    <ol>
                        <li>Create a prompt called "CharacterBase"</li>
                        <li>Create another prompt called "CharacterEmotions"</li>
                        <li>In "CharacterEmotions", add at the top:<br>
                            <code>{{// @requires CharacterBase }}</code>
                        </li>
                        <li>Save both prompts</li>
                        <li>Now when you <strong>enable</strong> "CharacterEmotions"...</li>
                        <li>"CharacterBase" will automatically enable too!</li>
                    </ol>
                    <p>No more forgetting to enable required prompts!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 4: Conflicts with @exclusive-with ⚔️</h3>
                    <p>Prevent conflicting prompts from being active together:</p>
                    <ol>
                        <li>Create a prompt called "CombatMode"</li>
                        <li>Create another called "PacifistMode"</li>
                        <li>In "CombatMode", add:<br>
                            <code>{{// @exclusive-with PacifistMode }}</code>
                        </li>
                        <li>Save both prompts</li>
                        <li>Enable "CombatMode" first</li>
                        <li>Now try enabling "PacifistMode"...</li>
                        <li>"CombatMode" automatically disables!</li>
                    </ol>
                    <p>Only one can be active at a time - perfect for mutually exclusive modes!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 5: API-Specific Prompts 🌐</h3>
                    <p>Show prompts only for specific API providers:</p>
                    <ol>
                        <li>Create a prompt with Claude-specific features</li>
                        <li>Add this directive:<br>
                            <code>{{// @api anthropic }}</code>
                        </li>
                        <li>Save the prompt</li>
                        <li>Switch to a different API (like OpenAI)</li>
                        <li>The prompt will be <strong>hidden</strong> automatically!</li>
                        <li>Switch back to Claude - it reappears!</li>
                    </ol>
                    <p>Other options: <code>@api openai</code>, <code>@api google</code>, etc.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 6: Categories for Organization 📁</h3>
                    <p>Group prompts logically with categories:</p>
                    <ol>
                        <li>Add to multiple related prompts:<br>
                            <code>{{// @category Character }}</code>
                        </li>
                        <li>Add to others:<br>
                            <code>{{// @category WorldBuilding }}</code>
                        </li>
                        <li>Save all the prompts</li>
                        <li>(Feature in development: Filter by category in the UI)</li>
                    </ol>
                    <p>Great for documentation and sharing preset packages!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 7: Priority Control 🎯</h3>
                    <p>Control the order prompts are processed:</p>
                    <ol>
                        <li>Add to a prompt that should go first:<br>
                            <code>{{// @priority 100 }}</code>
                        </li>
                        <li>Add to a prompt that should go last:<br>
                            <code>{{// @priority -100 }}</code>
                        </li>
                        <li>Higher numbers = processed earlier</li>
                        <li>Lower numbers = processed later</li>
                    </ol>
                    <p>Useful for ensuring setup prompts run before content prompts!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>All Available Directives 📝</h3>
                    <p>Here's your complete directive toolkit:</p>
                    <ul>
                        <li><code>@tooltip</code> - Hover descriptions</li>
                        <li><code>@category</code> - Organize into groups</li>
                        <li><code>@description</code> - Longer documentation</li>
                        <li><code>@requires</code> - Auto-enable dependencies</li>
                        <li><code>@conflicts-with</code> - Warn about conflicts</li>
                        <li><code>@exclusive-with</code> - Auto-disable conflicts</li>
                        <li><code>@priority</code> - Control ordering</li>
                        <li><code>@api</code> - API-specific visibility</li>
                        <li><code>@scope</code> - Limit to contexts (global/character)</li>
                    </ul>
                    <p>Use autocomplete to explore them all!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Master of Directives! 🎓</h3>
                    <p>Congratulations! You now know:</p>
                    <ul>
                        <li>✓ Directive syntax <code>{{// @directive }}</code></li>
                        <li>✓ Using autocomplete to discover directives</li>
                        <li>✓ Creating dependencies with @requires</li>
                        <li>✓ Preventing conflicts with @exclusive-with</li>
                        <li>✓ API-specific prompts with @api</li>
                        <li>✓ All available directives</li>
                    </ul>
                    <p>Start building smart, self-managing prompt systems!</p>
                `
            }
        ]
    },

    // UI Overhauls Tutorial
    uiOverhauls: {
        name: 'UI Overhauls & Enhancements',
        description: 'Navigate the enhanced SillyTavern interface',
        category: 'interface',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to the UI Overhauls! 🎨</h3>
                    <p>NemoPresetExt includes several UI improvements that make SillyTavern cleaner, more organized, and easier to use!</p>
                    <p>Let me show you all the enhancements you can enable.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Extensions Tab Overhaul 📂</h3>
                    <p>The Extensions tab gets a complete makeover:</p>
                    <ul>
                        <li><strong>Category Grouping</strong> - Extensions organized by type</li>
                        <li><strong>Search Bar</strong> - Find extensions instantly</li>
                        <li><strong>Visual Hierarchy</strong> - Cleaner, modern layout</li>
                        <li><strong>Collapsible Categories</strong> - Reduce clutter</li>
                    </ul>
                    <p>To enable: Extensions > NemoPreset UI > "Extensions Tab Overhaul" toggle</p>
                    <p><strong>Refresh required</strong> after enabling!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>User Settings Tabs 🗂️</h3>
                    <p>Transform the User Settings panel into organized tabs:</p>
                    <ul>
                        <li><strong>Tabbed Layout</strong> - Settings grouped logically</li>
                        <li><strong>Easy Navigation</strong> - Jump directly to what you need</li>
                        <li><strong>Less Scrolling</strong> - Everything categorized</li>
                    </ul>
                    <p>To enable: Extensions > NemoPreset UI > "Settings Tab Overhauls" toggle</p>
                    <p>Makes navigating settings so much easier!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Advanced Formatting Tabs 📋</h3>
                    <p>The Advanced Formatting panel gets tabs too:</p>
                    <ul>
                        <li><strong>Prompt Categories</strong> - Organized by type</li>
                        <li><strong>Template Tabs</strong> - Quick access to context templates</li>
                        <li><strong>Improved Workflow</strong> - Less hunting, more editing</li>
                    </ul>
                    <p>Same toggle as User Settings - they work together!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Wide Navigation Panels 📏</h3>
                    <p>Give yourself more working space:</p>
                    <ul>
                        <li><strong>50% Width</strong> - Side panels take half the screen</li>
                        <li><strong>More Readable</strong> - See more content at once</li>
                        <li><strong>Less Scrolling</strong> - Especially helpful on wide monitors</li>
                        <li><strong>Instant Toggle</strong> - No refresh needed!</li>
                    </ul>
                    <p>To toggle: Extensions > NemoPreset UI > "Wide Navigation Panels"</p>
                    <p><strong>Default:</strong> Enabled - try it both ways to see what you prefer!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Lorebook UI Overhaul 📖</h3>
                    <p>Enhanced World Info interface:</p>
                    <ul>
                        <li><strong>Better Layout</strong> - Improved entry organization</li>
                        <li><strong>Visual Improvements</strong> - Cleaner, more intuitive</li>
                        <li><strong>Enhanced Controls</strong> - Easier entry management</li>
                    </ul>
                    <p>To enable: Extensions > NemoPreset UI > "Lorebook UI Overhaul" toggle</p>
                    <p><strong>Refresh required</strong> after enabling!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Quick Lorebook Access 🚀</h3>
                    <p>Manage lorebooks right from the prompt manager:</p>
                    <ul>
                        <li><strong>Inline Controls</strong> - Toggle lorebooks without leaving</li>
                        <li><strong>Visual Indicators</strong> - See which are active</li>
                        <li><strong>One-Click Toggle</strong> - Enable/disable instantly</li>
                        <li><strong>Context Aware</strong> - Shows relevant lorebooks</li>
                    </ul>
                    <p>To enable: Extensions > NemoPreset UI > "Quick Lorebook Access" toggle</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Unified Reasoning Section 🧠</h3>
                    <p>All reasoning-related prompts in one place:</p>
                    <ul>
                        <li><strong>Dedicated Section</strong> - CoT prompts grouped together</li>
                        <li><strong>Better Organization</strong> - Find reasoning prompts easily</li>
                        <li><strong>Quick Access</strong> - Toggle reasoning features</li>
                    </ul>
                    <p>To enable: Extensions > NemoPreset UI > "Unified Reasoning Section" toggle</p>
                    <p>Perfect if you use NemoNet or other reasoning systems!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Customization Tips 💡</h3>
                    <p>Here's my recommended setup process:</p>
                    <ol>
                        <li>Start with <strong>Wide Panels enabled</strong> (default)</li>
                        <li>Enable <strong>Extensions Tab Overhaul</strong> for better navigation</li>
                        <li>Enable <strong>Settings Tab Overhauls</strong> for easier config</li>
                        <li>Try <strong>Lorebook UI Overhaul</strong> if you use lorebooks</li>
                        <li><strong>Refresh</strong> to see changes</li>
                        <li>Adjust any toggles based on preference</li>
                    </ol>
                    <p>Mix and match to create your perfect workspace!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>UI Master! 🎨</h3>
                    <p>You now know all the UI enhancements available:</p>
                    <ul>
                        <li>✓ Extensions Tab Overhaul (categories + search)</li>
                        <li>✓ Settings Tab Overhauls (organized tabs)</li>
                        <li>✓ Wide Navigation Panels (50% width)</li>
                        <li>✓ Lorebook UI Overhaul (enhanced interface)</li>
                        <li>✓ Quick Lorebook Access (inline controls)</li>
                        <li>✓ Unified Reasoning Section (CoT grouping)</li>
                    </ul>
                    <p>Customize your interface to work exactly how you want!</p>
                `
            }
        ]
    },

    // NemoNet Reasoning Tutorial
    nemoNetReasoning: {
        name: 'NemoNet Reasoning - Chain of Thought',
        description: 'Advanced reasoning system for deeper AI responses',
        category: 'advanced',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to NemoNet Reasoning! 🧠</h3>
                    <p>NemoNet is a Chain of Thought (CoT) reasoning parser that makes your AI think more deeply and logically!</p>
                    <p>Instead of jumping straight to responses, the AI shows its reasoning process, leading to more thoughtful and accurate answers.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>What is Chain of Thought? 🤔</h3>
                    <p>Chain of Thought reasoning means the AI "thinks out loud" before responding.</p>
                    <p><strong>Normal response:</strong><br>
                    User: "Should I bring an umbrella?"<br>
                    AI: "Yes, bring an umbrella."</p>
                    <p><strong>CoT response:</strong><br>
                    AI: <em>&lt;thinking&gt;Checking weather forecast... rain likely at 70%... umbrella would help...&lt;/thinking&gt;</em><br>
                    "Yes, bring an umbrella because there's a 70% chance of rain today."</p>
                    <p>See the difference? The AI shows its work!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>How NemoNet Works ⚙️</h3>
                    <p>NemoNet doesn't generate reasoning - it <strong>parses and formats</strong> it beautifully!</p>
                    <ol>
                        <li>Your AI generates reasoning in special tags (like <code>&lt;think&gt;</code>)</li>
                        <li>NemoNet detects these reasoning blocks</li>
                        <li>It formats them into clean, collapsible sections</li>
                        <li>You can show/hide reasoning to reduce clutter</li>
                        <li>Optionally exclude reasoning from AI context</li>
                    </ol>
                    <p>It makes CoT responses readable and manageable!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Supported Reasoning Formats 📝</h3>
                    <p>NemoNet recognizes many CoT formats:</p>
                    <ul>
                        <li><code>&lt;think&gt;...&lt;/think&gt;</code> - Standard thinking tags</li>
                        <li><code>&lt;reasoning&gt;...&lt;/reasoning&gt;</code> - Explicit reasoning</li>
                        <li><code>&lt;analysis&gt;...&lt;/analysis&gt;</code> - Analysis blocks</li>
                        <li><strong>Nested reasoning</strong> - Multi-level thought processes</li>
                        <li><strong>Council formats</strong> - Multiple perspectives</li>
                        <li><strong>Step-by-step</strong> - Numbered reasoning steps</li>
                    </ul>
                    <p>Works with most common CoT prompt styles!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 1: Setting Up CoT Prompts 📋</h3>
                    <p>To use NemoNet, you need prompts that trigger reasoning:</p>
                    <ol>
                        <li>Open your <strong>System Prompt</strong> or <strong>Main Prompt</strong></li>
                        <li>Add instructions like:<br>
                            <em>"Before responding, think through the problem in &lt;think&gt; tags."</em>
                        </li>
                        <li>Or use pre-made CoT presets (if available)</li>
                        <li>Save your prompt</li>
                    </ol>
                    <p>The AI will now generate reasoning blocks that NemoNet can format!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 2: Viewing Formatted Reasoning 👀</h3>
                    <p>Once the AI generates reasoning:</p>
                    <ol>
                        <li>NemoNet automatically detects the reasoning tags</li>
                        <li>The reasoning appears in a <strong>special formatted block</strong></li>
                        <li>You'll see a <strong>collapse/expand button</strong></li>
                        <li>Click it to hide/show the reasoning</li>
                        <li>The actual response appears below</li>
                    </ol>
                    <p>Clean, organized, and easy to read!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 3: Configuration Options ⚙️</h3>
                    <p>Customize NemoNet's behavior:</p>
                    <ul>
                        <li><strong>Show by Default</strong> - Reasoning expanded or collapsed?</li>
                        <li><strong>Context Inclusion</strong> - Include reasoning in AI context?</li>
                        <li><strong>Visual Style</strong> - How reasoning blocks look</li>
                        <li><strong>Detection Patterns</strong> - Which tags to recognize</li>
                    </ul>
                    <p>Configuration is in <code>nemonet-reasoning-config.js</code></p>
                    <p>(Advanced users only - works great out of the box!)</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>When to Use CoT Reasoning 🎯</h3>
                    <p>Chain of Thought is especially powerful for:</p>
                    <ul>
                        <li><strong>Complex questions</strong> - Multi-step problems</li>
                        <li><strong>Math & logic</strong> - Step-by-step calculations</li>
                        <li><strong>Planning</strong> - Strategy and logistics</li>
                        <li><strong>Analysis</strong> - Breaking down information</li>
                        <li><strong>Decision making</strong> - Weighing options</li>
                        <li><strong>Debugging</strong> - Understanding AI's thought process</li>
                    </ul>
                    <p>For simple chit-chat, standard responses are fine!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Benefits of NemoNet 🌟</h3>
                    <p>Why use NemoNet's reasoning parser?</p>
                    <ul>
                        <li><strong>Transparency</strong> - See how AI reaches conclusions</li>
                        <li><strong>Accuracy</strong> - CoT reduces errors and hallucinations</li>
                        <li><strong>Learning</strong> - Understand AI's problem-solving</li>
                        <li><strong>Debugging</strong> - Catch logical errors</li>
                        <li><strong>Context Control</strong> - Optionally hide reasoning from context</li>
                        <li><strong>Readability</strong> - Clean formatting vs raw tags</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Reasoning Expert! 🎓</h3>
                    <p>You're now ready to use NemoNet Reasoning:</p>
                    <ul>
                        <li>✓ Understand Chain of Thought reasoning</li>
                        <li>✓ Know what NemoNet does (parsing & formatting)</li>
                        <li>✓ Supported reasoning tag formats</li>
                        <li>✓ How to set up CoT prompts</li>
                        <li>✓ View and collapse reasoning blocks</li>
                        <li>✓ When to use CoT vs standard responses</li>
                    </ul>
                    <p>Make your AI think deeper and more logically!</p>
                `
            }
        ]
    },

    // HTML Trimmer Tutorial
    htmlTrimmer: {
        name: 'HTML Trimmer - Context Optimization',
        description: 'Reduce context usage by trimming old HTML',
        category: 'optimization',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to HTML Trimmer! ✂️</h3>
                    <p>Long conversations with lots of formatted HTML can eat up your context window fast!</p>
                    <p>HTML Trimmer automatically converts complex HTML in old messages to simple, compact dropdowns - saving tons of tokens!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>The Problem 😰</h3>
                    <p>HTML content in messages takes up a lot of space:</p>
                    <ul>
                        <li><strong>Formatted tables</strong> - Lots of tags and styling</li>
                        <li><strong>Styled text</strong> - CSS and inline styles</li>
                        <li><strong>Complex layouts</strong> - Divs, spans, classes</li>
                        <li><strong>Interactive elements</strong> - Buttons, forms</li>
                    </ul>
                    <p>A message that looks small can use 500-1000+ tokens!</p>
                    <p>As your conversation grows, this can:</p>
                    <ul>
                        <li>Reduce available tokens for the AI</li>
                        <li>Slow down responses</li>
                        <li>Increase API costs</li>
                        <li>Cause context overflow errors</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>The Solution 💡</h3>
                    <p>HTML Trimmer solves this by:</p>
                    <ol>
                        <li><strong>Detecting</strong> old messages with heavy HTML</li>
                        <li><strong>Converting</strong> them to simple text dropdowns</li>
                        <li><strong>Preserving</strong> the content (still readable!)</li>
                        <li><strong>Saving</strong> 70-90% of the token usage!</li>
                    </ol>
                    <p>Recent messages stay untouched, so the AI has full context where it matters!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 1: Enable Auto-Trim ⚙️</h3>
                    <p>Let's turn on automatic HTML trimming:</p>
                    <ol>
                        <li>Go to <strong>Extensions</strong> > <strong>NemoPreset UI</strong></li>
                        <li>Find <strong>"Auto-Trim Old HTML"</strong> toggle</li>
                        <li><strong>Enable it</strong> (check the box)</li>
                        <li>The feature is now active!</li>
                    </ol>
                    <p>From now on, old HTML will be trimmed automatically when you load a chat!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 2: Configure the Threshold 🎚️</h3>
                    <p>Control how many recent messages to keep untouched:</p>
                    <ol>
                        <li>In the same settings area, find <strong>"Keep last N messages untouched"</strong></li>
                        <li>Default is <strong>4 messages</strong></li>
                        <li>Increase for more context (e.g., 6-8 for important convos)</li>
                        <li>Decrease for maximum trimming (e.g., 2-3 for token savings)</li>
                    </ol>
                    <p><strong>Recommended:</strong> Keep 4-6 for the best balance!</p>
                    <p>The last N messages always keep their full HTML intact.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Step 3: Manual Trimming 🔧</h3>
                    <p>Want to trim right now? Use the manual button:</p>
                    <ol>
                        <li>Open a chat with lots of messages</li>
                        <li>Go to <strong>Extensions</strong> > <strong>NemoPreset UI</strong></li>
                        <li>Click the <strong>"Trim Now"</strong> button</li>
                        <li>Wait a moment for processing</li>
                        <li>You'll see a status message showing results!</li>
                    </ol>
                    <p>Example: "Trimmed 15 messages, saved ~3,500 tokens!"</p>
                    <p>Great before starting important conversations!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>What Gets Trimmed? 🎯</h3>
                    <p>HTML Trimmer is smart about what it processes:</p>
                    <ul>
                        <li><strong>✓ Targets:</strong> Messages with significant HTML/CSS</li>
                        <li><strong>✓ Converts:</strong> Complex formatting to simple dropdowns</li>
                        <li><strong>✗ Ignores:</strong> Plain text messages (no change)</li>
                        <li><strong>✗ Ignores:</strong> Messages within your threshold</li>
                        <li><strong>✗ Preserves:</strong> All content (just reformatted)</li>
                    </ul>
                    <p>Only messages that benefit from trimming get processed!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Before & After Example 📊</h3>
                    <p><strong>Before trimming:</strong></p>
                    <code style="display:block;margin:10px 0;padding:10px;background:#2a2a2a;">
                    &lt;div class="fancy-box"&gt;<br>
                    &nbsp;&nbsp;&lt;style&gt;.fancy-box{border:2px solid...}&lt;/style&gt;<br>
                    &nbsp;&nbsp;&lt;h2&gt;Character Stats&lt;/h2&gt;<br>
                    &nbsp;&nbsp;&lt;table&gt;...lots of rows...&lt;/table&gt;<br>
                    &lt;/div&gt;<br>
                    <em>(~800 tokens)</em>
                    </code>
                    <p><strong>After trimming:</strong></p>
                    <code style="display:block;margin:10px 0;padding:10px;background:#2a2a2a;">
                    &lt;details&gt;<br>
                    &nbsp;&nbsp;&lt;summary&gt;Character Stats&lt;/summary&gt;<br>
                    &nbsp;&nbsp;[Plain text version]<br>
                    &lt;/details&gt;<br>
                    <em>(~150 tokens - 81% savings!)</em>
                    </code>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Best Practices 💎</h3>
                    <p>Get the most out of HTML Trimmer:</p>
                    <ul>
                        <li><strong>Keep threshold at 4-6</strong> - Best balance of context and savings</li>
                        <li><strong>Run manual trim</strong> before important conversations</li>
                        <li><strong>Great for long RPs</strong> - Especially with formatted content</li>
                        <li><strong>Compatible with everything</strong> - Works with all extensions</li>
                        <li><strong>Monitor savings</strong> - Check the status message after trimming</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Context Optimizer! 🎓</h3>
                    <p>You're now an HTML Trimmer expert:</p>
                    <ul>
                        <li>✓ Understand the context problem</li>
                        <li>✓ How trimming saves tokens (70-90%)</li>
                        <li>✓ Enable auto-trim feature</li>
                        <li>✓ Configure message threshold (keep last N)</li>
                        <li>✓ Use manual "Trim Now" button</li>
                        <li>✓ Best practices for optimization</li>
                    </ul>
                    <p>Keep those conversations going longer with more context available!</p>
                `
            }
        ]
    },

    // Quick Tips Tutorial
    quickTips: {
        name: 'Quick Tips & Tricks',
        description: 'Handy shortcuts and hidden features',
        category: 'getting-started',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Let's Speed Things Up! ⚡</h3>
                    <p>I've got some quick tips and hidden features that'll make your life easier!</p>
                    <p>These are the little things that make a big difference in your daily workflow.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Keyboard Shortcuts ⌨️</h3>
                    <p>Save time with these shortcuts:</p>
                    <ul>
                        <li><code>Ctrl+F</code> - Quick search in prompt manager</li>
                        <li><code>Ctrl+S</code> - Save current prompt (in editor)</li>
                        <li><code>Esc</code> - Close dialogs and popups</li>
                        <li><code>Ctrl+/</code> - Toggle directive autocomplete</li>
                    </ul>
                    <p>Learn these, and you'll be blazing fast!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Search Power Tips 🔍</h3>
                    <p>Master the search bars:</p>
                    <ul>
                        <li><strong>Prompt search</strong> - Searches both names and dividers</li>
                        <li><strong>Case insensitive</strong> - Type lowercase, matches everything</li>
                        <li><strong>Partial matching</strong> - "char" finds "character" and "chart"</li>
                        <li><strong>Clear with Esc</strong> - Quick way to reset the search</li>
                    </ul>
                    <p>Find anything in seconds!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Organization Strategies 📚</h3>
                    <p>Pro tips for organizing your prompts:</p>
                    <ul>
                        <li><strong>Use hierarchies</strong> - Main sections, then subsections</li>
                        <li><strong>Naming conventions</strong> - Prefix related prompts (e.g., "Style: Descriptive")</li>
                        <li><strong>Collapse what you don't need</strong> - Keep workspace clean</li>
                        <li><strong>Use @category directives</strong> - For documentation</li>
                        <li><strong>Test presets</strong> section - Keep experiments separate</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Settings Management 💾</h3>
                    <p>Your settings are precious - back them up!</p>
                    <ul>
                        <li><strong>Automatic saving</strong> - Most changes save instantly</li>
                        <li><strong>Stored in extension_settings</strong> - Persists across sessions</li>
                        <li><strong>Backup SillyTavern data folder</strong> - Includes all settings</li>
                        <li><strong>Export prompts</strong> - Share preset packages with others</li>
                    </ul>
                    <p>Never lose your hard work!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Feature Toggle Tips 🔀</h3>
                    <p>Customize exactly what you want enabled:</p>
                    <ul>
                        <li><strong>Start minimal</strong> - Enable features as you need them</li>
                        <li><strong>Most require refresh</strong> - After toggling, refresh the page</li>
                        <li><strong>Mix and match</strong> - Every combination works</li>
                        <li><strong>Check settings</strong> - Each feature may have its own options</li>
                        <li><strong>Disable what you don't use</strong> - Reduces clutter</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Performance Tips 🚀</h3>
                    <p>Keep things running smoothly:</p>
                    <ul>
                        <li><strong>Video backgrounds</strong> - Use .webm, keep under 1080p</li>
                        <li><strong>HTML Trimmer</strong> - Enable for long conversations</li>
                        <li><strong>Collapse sections</strong> - Reduces DOM complexity</li>
                        <li><strong>Regular trimming</strong> - Run "Trim Now" occasionally</li>
                        <li><strong>Disable unused features</strong> - Lighter = faster</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Tutorial Menu 📚</h3>
                    <p>You can always come back to any tutorial!</p>
                    <p>Find the <strong>"Tutorials"</strong> button in the extension settings. From there you can:</p>
                    <ul>
                        <li>Review completed tutorials</li>
                        <li>Start new tutorials</li>
                        <li>Reset your progress</li>
                        <li>Skip around as needed</li>
                    </ul>
                    <p>I'm always here to help!</p>
                `,
                highlightSelector: '.nemo-tutorials-button'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>You're a Power User Now! 💪</h3>
                    <p>With these tips and tricks, you'll be using NemoPresetExt like a pro!</p>
                    <p>Key takeaways:</p>
                    <ul>
                        <li>✓ Use keyboard shortcuts to save time</li>
                        <li>✓ Organize with sections and naming conventions</li>
                        <li>✓ Back up your settings regularly</li>
                        <li>✓ Toggle only the features you need</li>
                        <li>✓ Optimize for performance</li>
                    </ul>
                    <p>Remember: Don't be afraid to experiment! Happy creating! 😊</p>
                `
            }
        ]
    }
};

// Export tutorial IDs for easy reference
export const TUTORIAL_IDS = {
    WELCOME: 'welcome',
    PRESET_MANAGEMENT: 'presetManagement',
    PRESET_NAVIGATOR: 'presetNavigator',
    ANIMATED_BACKGROUNDS: 'animatedBackgrounds',
    DIRECTIVES: 'directivesEngine',
    UI_OVERHAULS: 'uiOverhauls',
    NEMONET_REASONING: 'nemoNetReasoning',
    HTML_TRIMMER: 'htmlTrimmer',
    QUICK_TIPS: 'quickTips'
};
