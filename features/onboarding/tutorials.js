/**
 * Tutorial Definitions - All tutorials with Vex's dialogue
 * Each tutorial has steps with text, highlights, and interactions
 */

export const tutorials = {
    // Welcome Tutorial
    welcome: {
        name: 'Welcome to Nemo\'s Suite',
        description: 'Meet Vex and learn about the extension suite',
        category: 'getting-started',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Hey there, I'm Vex! 👋</h3>
                    <p>Welcome to Nemo's Extension Suite! I'm your guide to all the amazing features packed into this extension.</p>
                    <p>Think of me as your personal assistant - I'll show you everything you need to know to make the most of your SillyTavern experience!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>What's Inside? 🎁</h3>
                    <p>This suite includes <strong>11 powerful features</strong>:</p>
                    <ul>
                        <li><strong>Preset Management</strong> - Organize your prompts like a pro</li>
                        <li><strong>Card Emporium</strong> - Generate characters and lorebooks with AI</li>
                        <li><strong>Animated Backgrounds</strong> - Make your chats come alive</li>
                        <li><strong>Directives</strong> - Add powerful logic to your prompts</li>
                        <li><strong>And 7 more!</strong> - Ember, NemoLore, ProsePolisher, MoodMusic, VRM, and more!</li>
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
                    <h3>Creating Dividers ✂️</h3>
                    <p>To create a collapsible section, start any prompt name with equals signs:</p>
                    <code>=== My Story Prompts ===</code>
                    <p>Any prompts that come after this divider will be grouped under it. Pretty neat, right?</p>
                    <p>The more equals signs you use (like <code>====</code>), the more emphasis it gets!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Organizing Your Prompts 📚</h3>
                    <p>Here's a pro tip: Create multiple sections for different purposes:</p>
                    <ul>
                        <li><code>=== Character Setup ===</code></li>
                        <li><code>=== World Building ===</code></li>
                        <li><code>=== Story Elements ===</code></li>
                    </ul>
                    <p>Prompts will automatically group under their nearest divider!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Search & Filter 🔍</h3>
                    <p>See that search bar above your prompts? That's your best friend for finding things quickly!</p>
                    <p>Just type any part of a prompt name, and I'll filter the list for you. The search works on both prompt names and section headers!</p>
                `,
                highlightSelector: '.nemo-search-bar'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Enabled Counters 🔢</h3>
                    <p>Notice the numbers next to each section? Those show how many prompts are <em>enabled</em> in that section.</p>
                    <p>This makes it super easy to see which groups are active at a glance. No more clicking through everything to check!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Customize Your Dividers 🎨</h3>
                    <p>Want to use different symbols for dividers? You can change the pattern in the extension settings!</p>
                    <p>Try hyphens (<code>---</code>), asterisks (<code>***</code>), or anything you like. I'm flexible! 😊</p>
                `,
                highlightSelector: '#nemoDividerRegexPattern'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>You're All Set! ✅</h3>
                    <p>That's the basics of Preset Management! Here's what to remember:</p>
                    <ul>
                        <li>Use <code>===</code> to create dividers</li>
                        <li>Prompts group under the nearest divider above them</li>
                        <li>Use the search bar to filter quickly</li>
                        <li>Check enabled counters to see what's active</li>
                    </ul>
                    <p>Ready to learn about the next feature?</p>
                `
            }
        ]
    },

    // Card Emporium Tutorial
    cardEmporium: {
        name: 'Card & Lorebook Emporium',
        description: 'Generate characters and lorebooks with AI assistance',
        category: 'creation',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to the Emporium! 🏪</h3>
                    <p>This is where the magic happens! The Card Emporium is your one-stop shop for creating amazing character cards and lorebooks.</p>
                    <p>With AI assistance, you can generate complete characters with backstories, personalities, and even images!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Opening the Emporium 🚪</h3>
                    <p>Look for the <strong>"Emporium"</strong> button in your character management area. It's usually near the character list.</p>
                    <p>Click it, and you'll enter the workshop where we'll build your characters together!</p>
                `,
                highlightSelector: '.nemo-emporium-button'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>AI-Powered Generation 🤖</h3>
                    <p>The Emporium uses your current AI connection to help you create:</p>
                    <ul>
                        <li><strong>Character Cards</strong> - Complete with personality, backstory, and traits</li>
                        <li><strong>Lorebooks</strong> - World info and character knowledge bases</li>
                        <li><strong>Character Images</strong> - Generated portraits for your characters</li>
                    </ul>
                    <p>Just describe what you want, and let the AI do the heavy lifting!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Workflow Tips 💡</h3>
                    <p>Here's my recommended workflow:</p>
                    <ol>
                        <li>Start with a <strong>basic concept</strong> - "A mysterious detective in a cyberpunk city"</li>
                        <li>Let AI generate the <strong>character details</strong></li>
                        <li>Review and <strong>refine</strong> what the AI created</li>
                        <li>Generate an <strong>image</strong> that matches your vision</li>
                        <li><strong>Import</strong> directly into SillyTavern!</li>
                    </ol>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Lorebook Creation 📖</h3>
                    <p>The Emporium can also create comprehensive lorebooks for your worlds!</p>
                    <p>Whether you need:</p>
                    <ul>
                        <li>Character backgrounds and relationships</li>
                        <li>World history and geography</li>
                        <li>Magic systems and technology</li>
                        <li>Locations and organizations</li>
                    </ul>
                    <p>Just tell me what you need, and I'll help you build it!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Ready to Create! 🎨</h3>
                    <p>The Card Emporium is your creative playground. Don't be afraid to experiment!</p>
                    <p>Remember: You can always edit what the AI generates. Think of it as a collaborative process between you, me, and the AI!</p>
                    <p>Ready to explore the next feature?</p>
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
                    <h3>Supported Formats 📹</h3>
                    <p>You can use any of these as your background:</p>
                    <ul>
                        <li><strong>.webm</strong> files - Efficient and high quality</li>
                        <li><strong>.mp4</strong> videos - Universal compatibility</li>
                        <li><strong>.gif</strong> animations - Classic and simple</li>
                        <li><strong>YouTube URLs</strong> - Embed any YouTube video!</li>
                    </ul>
                    <p>Just set them as your background in SillyTavern's UI settings!</p>
                `,
                highlightSelector: '#bg_custom'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Control Options ⚙️</h3>
                    <p>Not just any video player - we've got options! You can control:</p>
                    <ul>
                        <li><strong>Looping</strong> - Repeat forever or play once</li>
                        <li><strong>Autoplay</strong> - Start automatically or wait for click</li>
                        <li><strong>Volume</strong> - From silent to full blast</li>
                        <li><strong>Playback</strong> - Play, pause, or restart anytime</li>
                    </ul>
                    <p>Find these controls in the extension settings!</p>
                `,
                highlightSelector: '.nemo-background-settings'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>YouTube Backgrounds 🎵</h3>
                    <p>Want to use a YouTube video? Just paste the URL as your background!</p>
                    <p>Perfect for:</p>
                    <ul>
                        <li>Ambient music and soundscapes</li>
                        <li>Animated artwork</li>
                        <li>Lofi beats for your RP sessions</li>
                        <li>Anything that sets the mood!</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Performance Tips 🚀</h3>
                    <p>Here are some tips to keep things running smoothly:</p>
                    <ul>
                        <li>Use <strong>.webm</strong> format for best performance</li>
                        <li>Keep video resolution reasonable (1080p is plenty)</li>
                        <li>Lower the volume or mute if you don't need sound</li>
                        <li>Use looping short clips instead of long videos</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>You're a Director Now! 🎥</h3>
                    <p>That's everything you need to know about animated backgrounds!</p>
                    <p>Go ahead and experiment with different videos to find what works best for your stories. The right background can really set the mood!</p>
                    <p>Shall we move on to the next feature?</p>
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
                    <code>{{// @tooltip This is a character setup prompt }}</code>
                    <p>They're invisible to the AI but control how prompts behave!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Common Directives 📝</h3>
                    <p>Here are some directives you'll use all the time:</p>
                    <ul>
                        <li><code>@tooltip</code> - Add helpful descriptions</li>
                        <li><code>@requires</code> - Make one prompt depend on another</li>
                        <li><code>@conflicts-with</code> - Prevent conflicting prompts</li>
                        <li><code>@exclusive-with</code> - Only one can be active</li>
                        <li><code>@priority</code> - Control prompt ordering</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Practical Example 💡</h3>
                    <p>Let's say you have a "Combat System" prompt and a "Pacifist Mode" prompt. You can add:</p>
                    <code>{{// @exclusive-with pacifist_mode }}</code>
                    <p>to the Combat System prompt. Now when you enable Combat System, Pacifist Mode automatically disables!</p>
                    <p>No more conflicting instructions to the AI!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Autocomplete Feature ✨</h3>
                    <p>Don't worry about memorizing all the directives! When you type <code>{{//</code> in a prompt, I'll show you an autocomplete menu with all available directives.</p>
                    <p>Just start typing and select what you need. Easy peasy!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Dependencies & Requirements 🔗</h3>
                    <p>Create smart prompt chains with <code>@requires</code>:</p>
                    <code>{{// @requires character_creation }}</code>
                    <p>This makes sure "character_creation" is enabled before this prompt can work. The extension will automatically enable required prompts for you!</p>
                    <p>Build complex, self-managing prompt systems!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Master of Directives! 🎓</h3>
                    <p>The Directives Engine has even more features, but you now know enough to start building powerful prompt systems!</p>
                    <p>Remember:</p>
                    <ul>
                        <li>Use <code>{{// @directive }}</code> syntax</li>
                        <li>Autocomplete helps you find directives</li>
                        <li>Build dependencies and conflicts</li>
                        <li>Experiment and have fun!</li>
                    </ul>
                `
            }
        ]
    },

    // Ember Renderer Tutorial
    ember: {
        name: 'Ember Universal Renderer',
        description: 'Create interactive HTML content in your chats',
        category: 'advanced',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to Ember! 🔥</h3>
                    <p>Ember is the Universal Renderer - it lets you create <strong>interactive HTML, CSS, and JavaScript</strong> content right in your chat messages!</p>
                    <p>Imagine character sheets, polls, mini-games, and more - all rendered beautifully in your chat!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>What Can You Create? 🎨</h3>
                    <p>With Ember, the possibilities are endless:</p>
                    <ul>
                        <li><strong>Character Sheets</strong> - Interactive stat displays</li>
                        <li><strong>Polls & Quizzes</strong> - Get user input in style</li>
                        <li><strong>Visual Effects</strong> - Animated text and graphics</li>
                        <li><strong>Mini Games</strong> - Simple interactive elements</li>
                        <li><strong>Data Visualization</strong> - Charts and graphs</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>How It Works ⚙️</h3>
                    <p>The AI can send special code blocks that Ember will render:</p>
                    <code>&lt;ember-render&gt;<br>
                    &nbsp;&nbsp;&lt;div class="character-sheet"&gt;<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;Your HTML here<br>
                    &nbsp;&nbsp;&lt;/div&gt;<br>
                    &lt;/ember-render&gt;</code>
                    <p>Ember takes that code and turns it into beautiful, interactive content!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Asset Packs 📦</h3>
                    <p>Create reusable "asset packs" - bundles of HTML, CSS, and JS that the AI can trigger by name!</p>
                    <p>For example, you could create a "character_sheet" asset pack, and the AI just needs to say:</p>
                    <code>{{ember: character_sheet}}</code>
                    <p>And boom! Your custom character sheet appears!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Safety Features 🛡️</h3>
                    <p>Don't worry - Ember has safety features built in:</p>
                    <ul>
                        <li>Sandboxed execution environment</li>
                        <li>Preview before rendering</li>
                        <li>User approval for new asset packs</li>
                        <li>No access to sensitive SillyTavern data</li>
                    </ul>
                    <p>You're always in control!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Getting Started 🚀</h3>
                    <p>To start using Ember:</p>
                    <ol>
                        <li>Make sure it's enabled in extension settings</li>
                        <li>Tell your AI about Ember in your prompts</li>
                        <li>Ask the AI to create something interactive</li>
                        <li>Watch the magic happen!</li>
                    </ol>
                    <p>Or create your own asset packs from the Ember settings panel!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Ember Master! 🔥</h3>
                    <p>You're ready to create amazing interactive experiences!</p>
                    <p>Pro tip: Check out the example asset packs in the settings to see what's possible. Then let your creativity run wild!</p>
                    <p>Ready for the next feature?</p>
                `
            }
        ]
    },

    // NemoLore Tutorial
    nemoLore: {
        name: 'NemoLore - Advanced Memory System',
        description: 'Automatic summarization, lorebook generation, and vector search',
        category: 'advanced',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to NemoLore! 🧠</h3>
                    <p>NemoLore is your AI's advanced memory system. It's like giving your AI a photographic memory that can recall details from any conversation!</p>
                    <p>With automatic summarization, smart lorebook generation, and powerful vector search, your AI will never forget important details.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>What Does NemoLore Do? 💭</h3>
                    <p>NemoLore provides three powerful features:</p>
                    <ul>
                        <li><strong>Auto-Summarization</strong> - Condenses long conversations automatically</li>
                        <li><strong>Lorebook Generation</strong> - AI creates entries based on your chats</li>
                        <li><strong>Vector Search</strong> - Find relevant info across all conversations</li>
                        <li><strong>Cross-Chat Memory</strong> - Remember details from previous chats</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Auto-Summarization 📝</h3>
                    <p>Long conversations eating up your context? NemoLore automatically summarizes older messages to save space while preserving important information!</p>
                    <p>The AI reads your conversation, identifies key points, and creates concise summaries. You get more context space for new messages!</p>
                    <p><strong>Pro tip:</strong> Configure how aggressive the summarization is in the NemoLore settings.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Automatic Lorebook Creation 📖</h3>
                    <p>NemoLore can automatically generate lorebook entries as you chat!</p>
                    <p>When important information comes up - character details, locations, events - the AI can create lorebook entries for you. No more manual lorebook management!</p>
                    <ul>
                        <li>Tracks character relationships</li>
                        <li>Records locations and settings</li>
                        <li>Remembers plot points and events</li>
                        <li>Updates existing entries automatically</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Vector-Based Memory 🔍</h3>
                    <p>This is where NemoLore really shines! It uses vector embeddings to search your chat history semantically.</p>
                    <p>What does that mean? Instead of just keyword matching, it understands <em>meaning</em>. Ask about "that time at the beach" and it'll find it even if those exact words weren't used!</p>
                    <p><strong>Cross-chat search:</strong> Remember details from conversations that happened days, weeks, or months ago!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Setting Up NemoLore ⚙️</h3>
                    <p>To get started with NemoLore:</p>
                    <ol>
                        <li>Make sure it's enabled in extension settings</li>
                        <li>Configure your vector provider (local or API)</li>
                        <li>Set summarization triggers and thresholds</li>
                        <li>Choose which features to enable</li>
                        <li>Start chatting - it works automatically!</li>
                    </ol>
                    <p>Check the NemoLore panel in your extensions for all settings.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>NemoLore Pro Tips! 💡</h3>
                    <p>Get the most out of NemoLore:</p>
                    <ul>
                        <li><strong>Review summaries</strong> - Check what's being summarized occasionally</li>
                        <li><strong>Pin important messages</strong> - Keep key info from being summarized</li>
                        <li><strong>Use vector search</strong> - Ask "What do you remember about X?"</li>
                        <li><strong>Lorebook review</strong> - Check auto-generated entries periodically</li>
                        <li><strong>Adjust thresholds</strong> - Fine-tune when summarization kicks in</li>
                    </ul>
                    <p>NemoLore learns and improves as you use it!</p>
                `
            }
        ]
    },

    // ProsePolisher Tutorial
    prosePolisher: {
        name: 'ProsePolisher - Writing Assistant',
        description: 'AI-powered analysis and improvement of your writing',
        category: 'creation',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Meet ProsePolisher! ✨</h3>
                    <p>ProsePolisher is your personal AI writing coach! It analyzes text and provides detailed feedback to help you improve your prose.</p>
                    <p>Whether you're writing character descriptions, stories, or roleplay responses, ProsePolisher has your back!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>What Can ProsePolisher Do? 📚</h3>
                    <p>ProsePolisher offers powerful writing analysis:</p>
                    <ul>
                        <li><strong>Style Analysis</strong> - Identifies your writing style and patterns</li>
                        <li><strong>Grammar & Flow</strong> - Catches errors and awkward phrasing</li>
                        <li><strong>Show Don't Tell</strong> - Highlights telling instead of showing</li>
                        <li><strong>Cliché Detection</strong> - Finds overused phrases</li>
                        <li><strong>Pacing Analysis</strong> - Checks narrative rhythm</li>
                        <li><strong>Character Voice</strong> - Ensures consistency</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Project Gremlin 👹</h3>
                    <p>ProsePolisher includes "Project Gremlin" - an AI-driven analysis system that gives you incredibly detailed feedback!</p>
                    <p>Think of it as having a professional editor looking over your shoulder. Gremlin identifies:</p>
                    <ul>
                        <li>Weak verbs that could be stronger</li>
                        <li>Passive voice that should be active</li>
                        <li>Repetitive sentence structures</li>
                        <li>Overused words and phrases</li>
                        <li>Areas that need more detail</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Regex + AI Power 🤖</h3>
                    <p>ProsePolisher combines two approaches:</p>
                    <p><strong>Regex Patterns:</strong> Fast, pattern-based detection of common issues. Lightning quick!</p>
                    <p><strong>AI Analysis:</strong> Deep, contextual understanding of your writing. Catches subtle issues regex can't!</p>
                    <p>Together, they provide comprehensive feedback that's both thorough and intelligent.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>How to Use ProsePolisher 🎯</h3>
                    <p>Using ProsePolisher is easy:</p>
                    <ol>
                        <li>Select the text you want to analyze</li>
                        <li>Right-click or use the ProsePolisher button</li>
                        <li>Choose your analysis type (Quick, Standard, Deep)</li>
                        <li>Review the feedback and suggestions</li>
                        <li>Apply improvements to your writing</li>
                    </ol>
                    <p>You can analyze character cards, chat messages, or any text!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Analysis Modes ⚡</h3>
                    <p>ProsePolisher offers different analysis depths:</p>
                    <ul>
                        <li><strong>Quick Scan</strong> - Fast regex check for obvious issues</li>
                        <li><strong>Standard Analysis</strong> - Balanced regex + AI review</li>
                        <li><strong>Deep Dive</strong> - Comprehensive AI analysis with detailed feedback</li>
                        <li><strong>Custom Rules</strong> - Create your own patterns to check</li>
                    </ul>
                    <p>Choose based on your needs and time available!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Improve Your Writing! 📈</h3>
                    <p>ProsePolisher isn't just about finding problems - it's about growth!</p>
                    <p>Key benefits:</p>
                    <ul>
                        <li>Learn from feedback patterns</li>
                        <li>Develop stronger writing habits</li>
                        <li>Catch issues before publishing</li>
                        <li>Maintain consistent quality</li>
                        <li>Speed up the editing process</li>
                    </ul>
                    <p>Over time, you'll internalize the lessons and become a better writer naturally!</p>
                `
            }
        ]
    },

    // MoodMusic Tutorial
    moodMusic: {
        name: 'MoodMusic - Dynamic Soundtracks',
        description: 'Connect to Spotify and play mood-appropriate music',
        category: 'visual',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to MoodMusic! 🎵</h3>
                    <p>MoodMusic brings your roleplay to life with dynamic, mood-appropriate soundtracks!</p>
                    <p>Connect to Spotify or play local audio files, and let the music change automatically based on the scene's mood.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>How MoodMusic Works 🎭</h3>
                    <p>MoodMusic analyzes your conversation and detects the current mood:</p>
                    <ul>
                        <li><strong>Happy/Cheerful</strong> - Upbeat, positive tracks</li>
                        <li><strong>Sad/Melancholy</strong> - Slow, emotional pieces</li>
                        <li><strong>Tense/Suspenseful</strong> - Dramatic, building music</li>
                        <li><strong>Action/Exciting</strong> - High-energy, fast-paced</li>
                        <li><strong>Romantic/Intimate</strong> - Soft, romantic melodies</li>
                        <li><strong>Mysterious/Dark</strong> - Ambient, ominous tones</li>
                    </ul>
                    <p>The music adapts as the scene changes!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Spotify Integration 🎧</h3>
                    <p>Connect your Spotify Premium account for the full experience!</p>
                    <p><strong>Setup requirements:</strong></p>
                    <ul>
                        <li>Spotify Premium account</li>
                        <li>Spotify API credentials (free to create)</li>
                        <li>Device running Spotify (phone, desktop, web player)</li>
                    </ul>
                    <p>Once connected, MoodMusic can control playback, switch tracks, and adjust volume automatically!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Local File Playback 🎼</h3>
                    <p>Don't have Spotify? No problem! MoodMusic can play local audio files too.</p>
                    <p><strong>Supported formats:</strong></p>
                    <ul>
                        <li>.mp3 - Standard MP3 files</li>
                        <li>.ogg - Ogg Vorbis</li>
                        <li>.wav - Uncompressed audio</li>
                        <li>.m4a - AAC audio</li>
                    </ul>
                    <p>Place your music files in SillyTavern's data folder, organized by mood!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Mood Detection ⚙️</h3>
                    <p>MoodMusic uses AI to analyze the chat and determine the current mood.</p>
                    <p>It looks at:</p>
                    <ul>
                        <li>Recent message content</li>
                        <li>Emotional keywords and phrases</li>
                        <li>Narrative pacing and intensity</li>
                        <li>Character actions and dialogue</li>
                    </ul>
                    <p>The system is smart enough to distinguish between "nervous excitement" and "fearful anxiety"!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Creating Playlists 🎨</h3>
                    <p>For the best experience, create mood-specific playlists:</p>
                    <ol>
                        <li><strong>Battle Music</strong> - Epic, intense tracks for combat</li>
                        <li><strong>Exploration</strong> - Ambient, wandering themes</li>
                        <li><strong>Romance</strong> - Soft, intimate music</li>
                        <li><strong>Mystery</strong> - Suspenseful, investigation tracks</li>
                        <li><strong>Celebration</strong> - Joyful, festive songs</li>
                        <li><strong>Dramatic</strong> - Emotional, story-driven pieces</li>
                    </ol>
                    <p>MoodMusic will pick from the appropriate playlist!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Settings & Control 🎛️</h3>
                    <p>Customize your MoodMusic experience:</p>
                    <ul>
                        <li><strong>Transition Style</strong> - Fade, crossfade, or instant</li>
                        <li><strong>Volume Control</strong> - Auto-adjust or manual</li>
                        <li><strong>Mood Sensitivity</strong> - How quickly music changes</li>
                        <li><strong>Manual Override</strong> - Force a specific mood</li>
                        <li><strong>Playlist Priority</strong> - Prefer certain playlists</li>
                    </ul>
                    <p>Find these in the MoodMusic settings panel!</p>
                `
            }
        ]
    },

    // NEMO-VRM Tutorial
    nemoVRM: {
        name: 'NEMO-VRM - 3D Character Models',
        description: 'Display and animate VRM character models in your chats',
        category: 'visual',
        steps: [
            {
                speaker: 'Vex',
                text: `
                    <h3>Welcome to NEMO-VRM! 🎭</h3>
                    <p>NEMO-VRM brings your characters to life with 3D models! Display fully-rigged, animated VRM models that react to your conversations.</p>
                    <p>It's like having your character right there with you in the chat!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>What is VRM? 🤔</h3>
                    <p>VRM (Virtual Reality Model) is a standardized 3D avatar format designed for VR and virtual characters.</p>
                    <p><strong>Why VRM is awesome:</strong></p>
                    <ul>
                        <li>Standardized format - works everywhere</li>
                        <li>Built-in animations and expressions</li>
                        <li>Physics simulation (hair, clothes)</li>
                        <li>Compatible with VRoid Studio and other tools</li>
                        <li>Widely supported in the VTuber community</li>
                    </ul>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Getting VRM Models 📦</h3>
                    <p>There are several ways to get VRM models:</p>
                    <ul>
                        <li><strong>VRoid Studio</strong> - Free tool to create custom models</li>
                        <li><strong>VRoid Hub</strong> - Download community-created models</li>
                        <li><strong>Booth.pm</strong> - Purchase professional models</li>
                        <li><strong>Commission artists</strong> - Get custom models made</li>
                        <li><strong>Convert existing models</strong> - Use UniVRM to convert</li>
                    </ul>
                    <p>VRoid Studio is perfect for beginners - it's free and easy to use!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Loading Your Model 🎪</h3>
                    <p>To use a VRM model in SillyTavern:</p>
                    <ol>
                        <li>Save your .vrm file to SillyTavern's data folder</li>
                        <li>Open the character you want to use it with</li>
                        <li>Go to the NEMO-VRM settings</li>
                        <li>Select your VRM file from the list</li>
                        <li>Adjust position, scale, and lighting</li>
                        <li>Save the character settings</li>
                    </ol>
                    <p>The model will appear in your chat automatically!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Animations & Expressions 😊</h3>
                    <p>NEMO-VRM can trigger animations based on chat content!</p>
                    <p><strong>Expression types:</strong></p>
                    <ul>
                        <li><strong>Happy</strong> - Smiling, cheerful</li>
                        <li><strong>Sad</strong> - Downcast, crying</li>
                        <li><strong>Angry</strong> - Frowning, intense</li>
                        <li><strong>Surprised</strong> - Wide-eyed, gasping</li>
                        <li><strong>Neutral</strong> - Calm, default</li>
                    </ul>
                    <p><strong>Gestures:</strong> Waving, nodding, pointing, and more!</p>
                    <p>The AI can trigger these automatically, or you can use special commands.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Camera & Display Settings 📷</h3>
                    <p>Customize how your VRM model appears:</p>
                    <ul>
                        <li><strong>Position</strong> - Left, right, center, or corner</li>
                        <li><strong>Scale</strong> - Make them larger or smaller</li>
                        <li><strong>Camera Angle</strong> - Face, upper body, full body</li>
                        <li><strong>Background</strong> - Transparent, solid, or custom</li>
                        <li><strong>Lighting</strong> - Adjust brightness and shadows</li>
                        <li><strong>Auto-rotate</strong> - Character follows mouse or stays still</li>
                    </ul>
                    <p>Experiment to find what looks best!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Performance Tips 🚀</h3>
                    <p>Keep NEMO-VRM running smoothly:</p>
                    <ul>
                        <li><strong>Model complexity</strong> - Simpler models = better performance</li>
                        <li><strong>Reduce polygon count</strong> - Optimize in Blender if needed</li>
                        <li><strong>Limit physics</strong> - Too many physics bones slow things down</li>
                        <li><strong>Lower texture resolution</strong> - 1024x1024 is usually plenty</li>
                        <li><strong>Disable when not needed</strong> - Toggle off for text-only chats</li>
                    </ul>
                    <p>Most modern computers can handle VRM models easily, but optimization helps!</p>
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
                    <p>NemoNet is a Chain of Thought (CoT) reasoning system that makes your AI think more deeply and logically!</p>
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
                    AI: <em>[Checking weather... rain likely... umbrella would help...]</em><br>
                    "Yes, bring an umbrella because it's likely to rain today."</p>
                    <p>See the difference? The AI shows its work!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>The Council of Vex 🏛️</h3>
                    <p>NemoNet uses a special technique called "Council of Vex" where multiple perspectives are considered - yes, I'm part of the process!</p>
                    <ul>
                        <li><strong>Logical Analysis</strong> - Facts and reasoning</li>
                        <li><strong>Emotional Intelligence</strong> - Feelings and empathy</li>
                        <li><strong>Creative Thinking</strong> - Novel solutions</li>
                        <li><strong>Practical Wisdom</strong> - Real-world considerations</li>
                    </ul>
                    <p>The AI synthesizes these viewpoints from my council for well-rounded responses!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Reasoning Blocks 📦</h3>
                    <p>NemoNet's reasoning appears in special blocks:</p>
                    <code>&lt;thinking&gt;...reasoning here...&lt;/thinking&gt;</code>
                    <p>These blocks contain:</p>
                    <ul>
                        <li>Step-by-step analysis</li>
                        <li>Consideration of alternatives</li>
                        <li>Weighing pros and cons</li>
                        <li>Connecting to previous context</li>
                        <li>Checking for consistency</li>
                    </ul>
                    <p>You can show or hide these blocks in the settings!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>When to Use CoT Reasoning 🎯</h3>
                    <p>Chain of Thought is especially powerful for:</p>
                    <ul>
                        <li><strong>Complex questions</strong> - Multi-step problems</li>
                        <li><strong>Moral dilemmas</strong> - Ethical considerations</li>
                        <li><strong>Planning</strong> - Strategy and logistics</li>
                        <li><strong>Analysis</strong> - Breaking down information</li>
                        <li><strong>Decision making</strong> - Weighing options</li>
                        <li><strong>Problem solving</strong> - Finding solutions</li>
                    </ul>
                    <p>For simple chit-chat, standard responses are fine!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>NemoNet Preset 📋</h3>
                    <p>The NemoEngine preset (included!) is optimized for reasoning:</p>
                    <ul>
                        <li>Structured thinking blocks</li>
                        <li>Multi-perspective analysis</li>
                        <li>Step-by-step breakdown</li>
                        <li>Self-correction mechanisms</li>
                        <li>Context awareness</li>
                    </ul>
                    <p>Load the "NemoEngine 7.5" preset to use it! It's in your extension folder.</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Debugging Reasoning 🔧</h3>
                    <p>NemoNet includes debugging tools to help understand the reasoning process:</p>
                    <ul>
                        <li><strong>View reasoning blocks</strong> - See the thought process</li>
                        <li><strong>Track decision paths</strong> - How conclusions were reached</li>
                        <li><strong>Identify contradictions</strong> - Catch logical errors</li>
                        <li><strong>Measure depth</strong> - How thoroughly AI thinks</li>
                    </ul>
                    <p>Check the test files in the reasoning/ folder for examples!</p>
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
                    <h3>Right-Click Menus 🖱️</h3>
                    <p>Did you know many elements have right-click context menus?</p>
                    <p>Try right-clicking on:</p>
                    <ul>
                        <li>Prompt sections - Quick actions</li>
                        <li>Character cards - Advanced options</li>
                        <li>Extension panels - Hidden settings</li>
                    </ul>
                    <p>Explore and discover!</p>
                `
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>Export & Backup 💾</h3>
                    <p>Always back up your hard work! You can export:</p>
                    <ul>
                        <li><strong>Prompts</strong> - Save your entire preset structure</li>
                        <li><strong>Characters</strong> - Share with the community</li>
                        <li><strong>Settings</strong> - Transfer to another device</li>
                        <li><strong>Asset Packs</strong> - Bundle custom Ember content</li>
                    </ul>
                    <p>Find export options in each feature's settings!</p>
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
                    </ul>
                    <p>I'm always here to help!</p>
                `,
                highlightSelector: '.nemo-tutorials-button'
            },
            {
                speaker: 'Vex',
                text: `
                    <h3>You're a Power User Now! 💪</h3>
                    <p>With these tips and tricks, you'll be using the extension suite like a pro!</p>
                    <p>Remember: Don't be afraid to experiment and explore. If you break something, you can always reset in the settings!</p>
                    <p>Happy creating! 😊</p>
                `
            }
        ]
    }
};

// Export tutorial IDs for easy reference
export const TUTORIAL_IDS = {
    WELCOME: 'welcome',
    PRESET_MANAGEMENT: 'presetManagement',
    CARD_EMPORIUM: 'cardEmporium',
    ANIMATED_BACKGROUNDS: 'animatedBackgrounds',
    DIRECTIVES: 'directivesEngine',
    EMBER: 'ember',
    NEMO_LORE: 'nemoLore',
    PROSE_POLISHER: 'prosePolisher',
    MOOD_MUSIC: 'moodMusic',
    NEMO_VRM: 'nemoVRM',
    NEMONET_REASONING: 'nemoNetReasoning',
    QUICK_TIPS: 'quickTips'
};
