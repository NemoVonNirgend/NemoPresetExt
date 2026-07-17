/**
 * Nemo Directive Autocomplete System
 * Provides intelligent autocomplete for directive syntax in prompt editor
 *
 * @module directive-autocomplete
 */

import { getAllPromptsWithState } from './prompt-directives.js';

/**
 * Directive definitions with autocomplete metadata
 */
const DIRECTIVE_DEFINITIONS = [
    {
        directive: '@tooltip',
        syntax: '@tooltip <description text>',
        description: 'Set hover tooltip for this prompt',
        example: '@tooltip Enable for realistic combat with injuries',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@exclusive-with',
        syntax: '@exclusive-with <prompt-id>, <prompt-id>, ...',
        description: 'Cannot enable with these prompts (hard conflict)',
        example: '@exclusive-with core-pack-alpha, core-pack-omega',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@exclusive-with-message',
        syntax: '@exclusive-with-message <custom error message>',
        description: 'Custom message for exclusive conflicts',
        example: '@exclusive-with-message Only enable ONE core pack!',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@requires',
        syntax: '@requires <prompt-id>, <prompt-id>, ...',
        description: 'Requires these prompts to be enabled',
        example: '@requires core-rules, jailbreak',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@requires-message',
        syntax: '@requires-message <custom error message>',
        description: 'Custom message for missing requirements',
        example: '@requires-message You must enable "Core Rules" first!',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@conflicts-with',
        syntax: '@conflicts-with <prompt-id>, <prompt-id>, ...',
        description: 'Soft conflict - shows warning only',
        example: '@conflicts-with slow-pacing',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@conflicts-message',
        syntax: '@conflicts-message <custom warning message>',
        description: 'Custom message for soft conflicts',
        example: '@conflicts-message May not work well with slow pacing',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@warning',
        syntax: '@warning <warning text>',
        description: 'General warning when enabled',
        example: '@warning Experimental feature! May cause issues.',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@category',
        syntax: '@category <category>, <category>, ...',
        description: 'Assign categories for organization',
        example: '@category NSFW, Fetish',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@max-one-per-category',
        syntax: '@max-one-per-category <category>',
        description: 'Only one prompt per category active',
        example: '@max-one-per-category response-length',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@deprecated',
        syntax: '@deprecated <replacement suggestion>',
        description: 'Mark as outdated with alternative',
        example: '@deprecated Use "New System Prompt v3" instead',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@auto-disable',
        syntax: '@auto-disable <prompt-id>, <prompt-id>, ...',
        description: 'Allow matching conflicts to be disabled during resolution',
        example: '@auto-disable old-system-prompt',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@auto-enable-dependencies',
        syntax: '@auto-enable-dependencies',
        description: 'Auto-enable required prompts',
        example: '@auto-enable-dependencies',
        requiresValue: false
    },
    {
        directive: '@author',
        syntax: '@author <name>',
        description: 'Prompt author name',
        example: '@author NokiaArmour',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@version',
        syntax: '@version <version>',
        description: 'Prompt version number',
        example: '@version 2.1.0',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@incompatible-api',
        syntax: '@incompatible-api <api>, <api>, ...',
        description: 'APIs this doesn\'t work with',
        example: '@incompatible-api claude, openai',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@recommended-with',
        syntax: '@recommended-with <prompt-id>, <prompt-id>, ...',
        description: 'Metadata: prompts that work well together',
        example: '@recommended-with visual-descriptions, detailed-environment',
        requiresValue: true,
        valueType: 'prompt-list'
    },

    // === NEW DIRECTIVES ===

    // Core Organization
    {
        directive: '@tags',
        syntax: '@tags <tag1>, <tag2>, ...',
        description: 'Metadata: searchable prompt tags',
        example: '@tags combat, realism, violence, nsfw',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@group',
        syntax: '@group <group name>',
        description: 'Metadata: prompt group name',
        example: '@group Vex Personalities',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@group-description',
        syntax: '@group-description <description>',
        description: 'Metadata: prompt group description',
        example: '@group-description Choose ONE personality variant',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@mutual-exclusive-group',
        syntax: '@mutual-exclusive-group <group name>',
        description: 'Allow only one active prompt in this group',
        example: '@mutual-exclusive-group response-length',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@priority',
        syntax: '@priority <1-100>',
        description: 'Metadata: priority from 1 to 100',
        example: '@priority 90',
        requiresValue: true,
        valueType: 'number'
    },

    // Visibility & Conditionals
    {
        directive: '@if-enabled',
        syntax: '@if-enabled <prompt-id>, <prompt-id>, ...',
        description: 'Metadata: enabled-prompt condition',
        example: '@if-enabled nsfw-mode, advanced-features',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@if-disabled',
        syntax: '@if-disabled <prompt-id>, <prompt-id>, ...',
        description: 'Metadata: disabled-prompt condition',
        example: '@if-disabled safe-mode',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@if-api',
        syntax: '@if-api <api>, <api>, ...',
        description: 'Metadata: API condition',
        example: '@if-api openai, claude',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@hidden',
        syntax: '@hidden',
        description: 'Metadata: hidden visibility flag',
        example: '@hidden',
        requiresValue: false
    },

    // Setup & Defaults
    {
        directive: '@default-enabled',
        syntax: '@default-enabled',
        description: 'Metadata: requested default state (not applied)',
        example: '@default-enabled',
        requiresValue: false
    },
    {
        directive: '@recommended-for-beginners',
        syntax: '@recommended-for-beginners',
        description: 'Metadata: recommended for beginners',
        example: '@recommended-for-beginners',
        requiresValue: false
    },
    {
        directive: '@advanced',
        syntax: '@advanced',
        description: 'Metadata: advanced-user marker',
        example: '@advanced',
        requiresValue: false
    },

    // Performance & Resources
    {
        directive: '@token-cost',
        syntax: '@token-cost <number>',
        description: 'Metadata: estimated token usage',
        example: '@token-cost 500',
        requiresValue: true,
        valueType: 'number'
    },
    {
        directive: '@token-cost-warn',
        syntax: '@token-cost-warn <number>',
        description: 'Metadata: token warning threshold',
        example: '@token-cost-warn 8000',
        requiresValue: true,
        valueType: 'number'
    },
    {
        directive: '@performance-impact',
        syntax: '@performance-impact <low|medium|high>',
        description: 'Metadata: performance impact',
        example: '@performance-impact medium',
        requiresValue: true,
        valueType: 'text'
    },

    // Help & Documentation
    {
        directive: '@help',
        syntax: '@help <help text>',
        description: 'Metadata: inline help text',
        example: '@help This prompt enables X, Y, Z. Works best with A and B.',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@documentation-url',
        syntax: '@documentation-url <url>',
        description: 'Metadata: external documentation link',
        example: '@documentation-url https://docs.example.com/guide',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@example',
        syntax: '@example <usage example>',
        description: 'Metadata: usage example',
        example: '@example Use with @profile nsfw for best results',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@changelog',
        syntax: '@changelog <version changes>',
        description: 'Version change notes',
        example: '@changelog v2.1: Added support for X, fixed Y',
        requiresValue: true,
        valueType: 'text'
    },

    // Visual Customization
    {
        directive: '@icon',
        syntax: '@icon <emoji>',
        description: 'Custom emoji icon for prompt',
        example: '@icon 🔥',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@color',
        syntax: '@color <hex color>',
        description: 'Custom border color',
        example: '@color #FF6B6B',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@badge',
        syntax: '@badge <text>',
        description: 'Badge text (NEW, BETA, REQUIRED, etc.)',
        example: '@badge NEW',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@highlight',
        syntax: '@highlight',
        description: 'Visual emphasis with glow effect',
        example: '@highlight',
        requiresValue: false
    },

    // Profiles & Presets
    {
        directive: '@profile',
        syntax: '@profile <name>, <name>, ...',
        description: 'Metadata: named profiles',
        example: '@profile sfw, beginner, recommended',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@preset-name',
        syntax: '@preset-name <name>',
        description: 'Metadata: preset identifier',
        example: '@preset-name Nemo Preset v3',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@preset-version',
        syntax: '@preset-version <version>',
        description: 'Metadata: preset version',
        example: '@preset-version 3.2.1',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@requires-preset-version',
        syntax: '@requires-preset-version <version constraint>',
        description: 'Metadata: preset version requirement',
        example: '@requires-preset-version >=3.0.0',
        requiresValue: true,
        valueType: 'text'
    },

    // Quality & Status
    {
        directive: '@unstable',
        syntax: '@unstable <warning message>',
        description: 'Metadata: unstable status',
        example: '@unstable This feature is experimental and may change',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@experimental',
        syntax: '@experimental <beta message>',
        description: 'Metadata: experimental status',
        example: '@experimental Beta feature - please report issues',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@tested-with',
        syntax: '@tested-with <model>, <model>, ...',
        description: 'Metadata: tested model combinations',
        example: '@tested-with gpt-4, claude-3, llama-70b',
        requiresValue: true,
        valueType: 'text-list'
    },

    // Model Optimization
    {
        directive: '@model-optimized',
        syntax: '@model-optimized <model>, <model>, ...',
        description: 'Metadata: optimized models',
        example: '@model-optimized gpt-4, claude-3-opus',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@model-incompatible',
        syntax: '@model-incompatible <model>, <model>, ...',
        description: 'Doesn\'t work with these models',
        example: '@model-incompatible gpt-3.5, gemini-pro',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@recommended-api',
        syntax: '@recommended-api <api>, <api>, ...',
        description: 'Metadata: recommended APIs',
        example: '@recommended-api openai, anthropic',
        requiresValue: true,
        valueType: 'text-list'
    },

    // Smart Behavior
    {
        directive: '@auto-enable-with',
        syntax: '@auto-enable-with <prompt-id>, <prompt-id>, ...',
        description: 'Metadata: requested automatic companions (not applied)',
        example: '@auto-enable-with base-system, core-rules',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@suggest-enable-with',
        syntax: '@suggest-enable-with <prompt-id>, <prompt-id>, ...',
        description: 'Suggest enabling these (don\'t force)',
        example: '@suggest-enable-with visual-descriptions, atmosphere',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@load-order',
        syntax: '@load-order <number>',
        description: 'Metadata: execution-order hint',
        example: '@load-order 100',
        requiresValue: true,
        valueType: 'number'
    },
    {
        directive: '@enable-at-message',
        syntax: '@enable-at-message <message number>',
        description: 'Enable this prompt when the chat reaches a message threshold',
        example: '@enable-at-message 10',
        requiresValue: true,
        valueType: 'number'
    },
    {
        directive: '@disable-at-message',
        syntax: '@disable-at-message <message number>',
        description: 'Disable this prompt when the chat reaches a message threshold',
        example: '@disable-at-message 20',
        requiresValue: true,
        valueType: 'number'
    },
    {
        directive: '@message-range',
        syntax: '@message-range <start>-<end>',
        description: 'Keep this prompt enabled only within a message range',
        example: '@message-range 5-15',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@enable-after-message',
        syntax: '@enable-after-message <message number>',
        description: 'Enable this prompt after a message count',
        example: '@enable-after-message 5',
        requiresValue: true,
        valueType: 'number'
    },
    {
        directive: '@disable-after-message',
        syntax: '@disable-after-message <message number>',
        description: 'Disable this prompt after a message count',
        example: '@disable-after-message 30',
        requiresValue: true,
        valueType: 'number'
    }
];

/**
 * Get autocomplete suggestions based on current input
 * @param {string} text - Current text content
 * @param {number} cursorPos - Cursor position in text
 * @returns {Object} Autocomplete result
 */
export function getAutocompleteSuggestions(text, cursorPos) {
    // Check if we're inside a {{// }} comment block
    const commentContext = getCommentContext(text, cursorPos);

    if (commentContext.inComment) {
        return getDirectiveAutocompleteSuggestions(text, cursorPos, commentContext);
    }

    // SillyTavern owns ordinary macro autocomplete and prompt prose.
    return { suggestions: [], context: null };
}

/**
 * Get directive autocomplete suggestions (inside {{// }} blocks)
 */
function getDirectiveAutocompleteSuggestions(text, cursorPos, commentContext) {
    const lineStart = commentContext.lineStart;
    const lineText = text.substring(lineStart, cursorPos);
    const trimmedLine = lineText.trim();

    // Case 1: Just typed {{// - suggest all directives
    if (trimmedLine === '' || trimmedLine === '{{//' || trimmedLine === '{{// ') {
        return {
            suggestions: DIRECTIVE_DEFINITIONS.map(def => ({
                type: 'directive',
                text: def.directive,
                display: def.syntax,
                description: def.description,
                insertText: def.directive + ' ',
                definition: def
            })),
            context: 'directive-start',
            replaceStart: lineStart,
            replaceEnd: cursorPos
        };
    }

    // Case 3: After directive name, suggest values (CHECK THIS FIRST!)
    const directiveMatch = trimmedLine.match(/^(?:\{\{\/\/\s*)?(@[\w-]+)\s+(.*)$/);
    if (directiveMatch) {
        const directiveName = directiveMatch[1];
        const valueText = directiveMatch[2];
        const leadingWhitespaceLength = lineText.length - lineText.trimStart().length;
        const valueStart = lineStart + leadingWhitespaceLength + trimmedLine.length - valueText.length;

        const definition = DIRECTIVE_DEFINITIONS.find(d => d.directive === directiveName);

        if (definition) {
            if (definition.valueType === 'prompt-list') {
                return getPromptSuggestions(valueText, valueStart, cursorPos, definition);
            }
            if (VALUE_SUGGESTIONS[definition.directive]) {
                return getValueSuggestions(valueText, valueStart, cursorPos, definition);
            }
        }
    }

    // Case 2: Typing a directive name (starts with @) - only if not matched above
    if (trimmedLine.startsWith('{{// @') || trimmedLine.startsWith('@')) {
        const directivePart = trimmedLine.replace(/^\{\{\/\/\s*/, '').trim();
        const directiveWord = directivePart.split(/\s/)[0];

        // Filter directives that match
        const matchingDirectives = DIRECTIVE_DEFINITIONS.filter(def =>
            def.directive.startsWith(directiveWord.toLowerCase())
        );

        if (matchingDirectives.length > 0) {
            const wordStart = lineStart + lineText.lastIndexOf(directiveWord);

            return {
                suggestions: matchingDirectives.map(def => ({
                    type: 'directive',
                    text: def.directive,
                    display: def.syntax,
                    description: def.description,
                    insertText: def.requiresValue ? def.directive + ' ' : def.directive,
                    definition: def
                })),
                context: 'directive-name',
                replaceStart: wordStart,
                replaceEnd: cursorPos
            };
        }
    }

    return { suggestions: [], context: null };
}
/**
 * Get context about whether cursor is in a comment block
 */
function getCommentContext(text, cursorPos) {
    const beforeCursor = text.substring(0, cursorPos);
    const commentStart = beforeCursor.lastIndexOf('{{//');
    const lastClosedComment = beforeCursor.lastIndexOf('}}');

    if (commentStart <= lastClosedComment) {
        return { inComment: false };
    }

    const commentEnd = text.indexOf('}}', cursorPos);
    const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
    let lineEnd = text.indexOf('\n', cursorPos);
    if (lineEnd === -1) lineEnd = text.length;

    return {
        inComment: true,
        lineStart,
        lineEnd,
        commentStart,
        commentEnd: commentEnd === -1 ? null : commentEnd,
    };
}

/**
 * Common value suggestions for specific directives
 */
const VALUE_SUGGESTIONS = {
    '@color': [
        { value: '#FF6B6B', description: 'Red - Danger, important, NSFW', aliases: ['red'] },
        { value: '#4ECDC4', description: 'Cyan - Cool, calm, utility', aliases: ['cyan'] },
        { value: '#45B7D1', description: 'Blue - Info, standard, recommended', aliases: ['blue'] },
        { value: '#FFA07A', description: 'Orange - Warning, experimental', aliases: ['orange'] },
        { value: '#98D8C8', description: 'Mint - Success, safe, SFW', aliases: ['mint', 'green'] },
        { value: '#FFD93D', description: 'Yellow - Attention, beginner-friendly', aliases: ['yellow'] },
        { value: '#A78BFA', description: 'Purple - Advanced, special', aliases: ['purple', 'violet'] },
        { value: '#FB6F92', description: 'Pink - Romance, social, fun', aliases: ['pink'] },
        { value: '#6C757D', description: 'Gray - Neutral, deprecated', aliases: ['gray', 'grey'] },
        { value: '#00D9FF', description: 'Electric Blue - High priority', aliases: ['electric', 'bright-blue'] }
    ],
    '@icon': [
        { value: '🔥', description: 'Fire - Hot, intense, popular', aliases: ['fire', 'hot', 'flame'] },
        { value: '⚠️', description: 'Warning - Caution, experimental', aliases: ['warning', 'caution', 'alert'] },
        { value: '✨', description: 'Sparkles - New, special, enhanced', aliases: ['sparkles', 'new', 'shine', 'star'] },
        { value: '🎯', description: 'Target - Focused, precise', aliases: ['target', 'aim', 'focus'] },
        { value: '🚀', description: 'Rocket - Fast, powerful, advanced', aliases: ['rocket', 'fast', 'speed'] },
        { value: '💎', description: 'Diamond - Premium, quality', aliases: ['diamond', 'gem', 'premium'] },
        { value: '🛡️', description: 'Shield - Protection, safety', aliases: ['shield', 'protect', 'defense'] },
        { value: '⚔️', description: 'Swords - Combat, action', aliases: ['sword', 'swords', 'combat', 'battle'] },
        { value: '🎭', description: 'Theater - Roleplay, personas', aliases: ['theater', 'mask', 'roleplay', 'rp'] },
        { value: '🧠', description: 'Brain - Intelligence, thinking', aliases: ['brain', 'think', 'smart'] },
        { value: '💬', description: 'Speech - Dialogue, conversation', aliases: ['speech', 'talk', 'dialogue', 'chat'] },
        { value: '📚', description: 'Books - Knowledge, documentation', aliases: ['book', 'books', 'docs', 'knowledge'] },
        { value: '🎨', description: 'Art - Creative, visual', aliases: ['art', 'paint', 'creative'] },
        { value: '🔧', description: 'Wrench - Utility, tools', aliases: ['wrench', 'tool', 'utility', 'fix'] },
        { value: '⭐', description: 'Star - Featured, recommended', aliases: ['star', 'featured', 'favorite'] },
        { value: '🎪', description: 'Circus - Fun, entertainment', aliases: ['circus', 'fun', 'party'] },
        { value: '🌙', description: 'Moon - Night, dark themes', aliases: ['moon', 'night', 'dark'] },
        { value: '☀️', description: 'Sun - Day, bright, positive', aliases: ['sun', 'day', 'bright', 'light'] },
        { value: '❤️', description: 'Heart - Love, romance, passion', aliases: ['heart', 'love', 'romance'] },
        { value: '💀', description: 'Skull - Dark, horror, death', aliases: ['skull', 'death', 'horror', 'spooky'] }
    ],
    '@badge': [
        { value: 'NEW', description: 'Recently added feature' },
        { value: 'BETA', description: 'Beta/experimental feature' },
        { value: 'REQUIRED', description: 'Must be enabled' },
        { value: 'RECOMMENDED', description: 'Recommended for most users' },
        { value: 'ADVANCED', description: 'For experienced users' },
        { value: 'DEPRECATED', description: 'Old, use alternative' },
        { value: 'HOT', description: 'Popular, trending' },
        { value: 'UPDATED', description: 'Recently updated' },
        { value: 'EXPERIMENTAL', description: 'Unstable, testing' },
        { value: 'PRO', description: 'Advanced features' },
        { value: 'LITE', description: 'Lightweight version' },
        { value: 'NSFW', description: 'Adult content' },
        { value: 'SFW', description: 'Safe for work' },
        { value: 'LEGACY', description: 'Old version' },
        { value: 'ESSENTIAL', description: 'Core feature' }
    ],
    '@performance-impact': [
        { value: 'low', description: 'Minimal impact on performance' },
        { value: 'medium', description: 'Moderate performance impact' },
        { value: 'high', description: 'Significant performance impact' }
    ],
    '@if-api': [
        { value: 'openai', description: 'OpenAI API (GPT models)' },
        { value: 'claude', description: 'Anthropic Claude API' },
        { value: 'google', description: 'Google Gemini API' },
        { value: 'mistral', description: 'Mistral AI API' },
        { value: 'cohere', description: 'Cohere API' },
        { value: 'textgenerationwebui', description: 'Text Generation WebUI' },
        { value: 'kobold', description: 'KoboldAI API' },
        { value: 'novel', description: 'NovelAI API' },
        { value: 'ooba', description: 'Oobabooga API' }
    ],
    '@recommended-api': [
        { value: 'openai', description: 'OpenAI API (GPT models)' },
        { value: 'claude', description: 'Anthropic Claude API' },
        { value: 'google', description: 'Google Gemini API' },
        { value: 'mistral', description: 'Mistral AI API' }
    ],
    '@model-optimized': [
        { value: 'gpt-4', description: 'OpenAI GPT-4' },
        { value: 'gpt-4-turbo', description: 'OpenAI GPT-4 Turbo' },
        { value: 'gpt-3.5-turbo', description: 'OpenAI GPT-3.5 Turbo' },
        { value: 'claude-3-opus', description: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet', description: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku', description: 'Claude 3 Haiku' },
        { value: 'gemini-pro', description: 'Google Gemini Pro' },
        { value: 'mistral-large', description: 'Mistral Large' },
        { value: 'llama-70b', description: 'Llama 2 70B' }
    ],
    '@profile': [
        { value: 'sfw', description: 'Safe for work content' },
        { value: 'nsfw', description: 'Adult content' },
        { value: 'beginner', description: 'For new users' },
        { value: 'advanced', description: 'For experienced users' },
        { value: 'expert', description: 'For experts only' },
        { value: 'recommended', description: 'Recommended setup' },
        { value: 'minimal', description: 'Minimal configuration' },
        { value: 'maximum', description: 'All features enabled' },
        { value: 'realistic', description: 'Realistic simulation' },
        { value: 'creative', description: 'Creative freedom' },
        { value: 'roleplay', description: 'Roleplay focused' },
        { value: 'storytelling', description: 'Story focused' }
    ],
    '@tags': [
        { value: 'combat', description: 'Combat/fighting related' },
        { value: 'realism', description: 'Realistic simulation' },
        { value: 'nsfw', description: 'Adult content' },
        { value: 'sfw', description: 'Safe content' },
        { value: 'dialogue', description: 'Dialogue focused' },
        { value: 'action', description: 'Action focused' },
        { value: 'romance', description: 'Romance/relationships' },
        { value: 'horror', description: 'Horror/scary content' },
        { value: 'comedy', description: 'Humor/comedy' },
        { value: 'drama', description: 'Dramatic content' },
        { value: 'scifi', description: 'Science fiction' },
        { value: 'fantasy', description: 'Fantasy setting' },
        { value: 'modern', description: 'Modern/contemporary' },
        { value: 'historical', description: 'Historical setting' },
        { value: 'formatting', description: 'Output formatting' },
        { value: 'length', description: 'Response length' },
        { value: 'style', description: 'Writing style' },
        { value: 'quality', description: 'Quality control' }
    ]
};

/**
 * Get predefined value suggestions for directives
 */
function getValueSuggestions(valueText, valueStart, cursorPos, definition) {
    const suggestions = VALUE_SUGGESTIONS[definition.directive];
    if (!suggestions || suggestions.length === 0) {
        return { suggestions: [], context: null };
    }

    // Get the current word being typed (after last comma for list values)
    const lastComma = valueText.lastIndexOf(',');
    const currentWord = lastComma === -1 ? valueText : valueText.substring(lastComma + 1);
    const trimmedWord = currentWord.trim().toLowerCase();

    // Filter and score suggestions for smart sorting
    const scoredSuggestions = suggestions
        .map(s => {
            let score = 0;
            let matches = false;

            if (trimmedWord === '') {
                return { suggestion: s, score: 0, matches: true };
            }

            // Check aliases first (highest priority for exact matches)
            if (s.aliases && Array.isArray(s.aliases)) {
                for (const alias of s.aliases) {
                    const aliasLower = alias.toLowerCase();
                    if (aliasLower === trimmedWord) {
                        score = 1000; // Exact alias match = highest priority
                        matches = true;
                    } else if (aliasLower.startsWith(trimmedWord)) {
                        score = Math.max(score, 500); // Alias starts with = high priority
                        matches = true;
                    } else if (aliasLower.includes(trimmedWord)) {
                        score = Math.max(score, 100); // Alias contains = medium priority
                        matches = true;
                    }
                }
            }

            // Check value
            const valueLower = s.value.toLowerCase();
            if (valueLower === trimmedWord) {
                score = Math.max(score, 900);
                matches = true;
            } else if (valueLower.startsWith(trimmedWord)) {
                score = Math.max(score, 400);
                matches = true;
            } else if (valueLower.includes(trimmedWord)) {
                score = Math.max(score, 50);
                matches = true;
            }

            // Check description (lowest priority)
            const descLower = s.description.toLowerCase();
            if (descLower.includes(trimmedWord)) {
                score = Math.max(score, 10);
                matches = true;
            }

            return { suggestion: s, score, matches };
        })
        .filter(item => item.matches)
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .map(item => item.suggestion);

    if (scoredSuggestions.length === 0) {
        return { suggestions: [], context: null };
    }

    // Calculate replace range
    const wordOffsetInValue = lastComma === -1 ? 0 : lastComma + 1;
    const whitespaceMatch = currentWord.match(/^\s*/);
    const whitespaceLength = whitespaceMatch ? whitespaceMatch[0].length : 0;
    const wordStartInLine = valueStart + wordOffsetInValue + whitespaceLength;

    return {
        suggestions: scoredSuggestions.map(s => ({
            type: 'value',
            text: s.value,
            display: s.value,
            description: s.description,
            insertText: s.value,
            valueData: s
        })),
        context: 'value-suggestion',
        replaceStart: wordStartInLine,
        replaceEnd: cursorPos,
        definition: definition
    };
}

/**
 * Get prompt identifier suggestions
 */
function getPromptSuggestions(valueText, valueStart, cursorPos, definition) {
    // Check if this directive has predefined value suggestions
    if (definition && VALUE_SUGGESTIONS[definition.directive]) {
        return getValueSuggestions(valueText, valueStart, cursorPos, definition);
    }

    const allPrompts = getAllPromptsWithState();

    // Get the current word being typed (after last comma)
    const lastComma = valueText.lastIndexOf(',');
    const currentWord = lastComma === -1 ? valueText : valueText.substring(lastComma + 1);
    const trimmedWord = currentWord.trim().toLowerCase();

    // Don't show suggestions for very short searches
    if (trimmedWord.length === 0) {
        return { suggestions: [], context: null };
    }

    // Filter prompts that match
    const matchingPrompts = allPrompts
        .filter(p => {
            const id = p.identifier.toLowerCase();
            const name = p.name.toLowerCase();

            // Remove emojis and special characters from name for better matching
            const nameNoEmoji = name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
            const nameClean = nameNoEmoji.replace(/[^a-z0-9\s]/gi, '').trim();

            return id.includes(trimmedWord) ||
                   name.includes(trimmedWord) ||
                   nameNoEmoji.includes(trimmedWord) ||
                   nameClean.includes(trimmedWord);
        })
        .slice(0, 20); // Limit to 20 suggestions

    if (matchingPrompts.length === 0) {
        return { suggestions: [], context: null };
    }

    // Find the active comma-separated value within the full textarea content.
    const wordOffsetInValue = lastComma === -1 ? 0 : lastComma + 1;

    // Skip any whitespace at the start of currentWord
    const whitespaceMatch = currentWord.match(/^\s*/);
    const whitespaceLength = whitespaceMatch ? whitespaceMatch[0].length : 0;

    const wordStartInLine = valueStart + wordOffsetInValue + whitespaceLength;

    return {
        suggestions: matchingPrompts.map(p => {
            // Create a clear display showing what will be inserted
            const displayName = p.name.length > 40 ? p.name.substring(0, 37) + '...' : p.name;
            const status = p.enabled ? '✓ ' : '';

            return {
                type: 'prompt',
                text: p.identifier,
                display: `${displayName}`,
                description: `${status}ID: ${p.identifier}`,
                insertText: p.identifier,
                promptData: p
            };
        }),
        context: 'prompt-value',
        replaceStart: wordStartInLine,
        replaceEnd: cursorPos,
        definition: definition
    };
}

/**
 * Insert autocomplete suggestion
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {Object} suggestion - The suggestion to insert
 * @param {Object} autocompleteResult - The full autocomplete result
 */
export function insertSuggestion(textarea, suggestion, autocompleteResult) {
    const text = textarea.value;
    const { replaceStart, replaceEnd } = autocompleteResult;

    // Build the new text
    const before = text.substring(0, replaceStart);
    const after = text.substring(replaceEnd);
    const insert = suggestion.insertText;

    // Handle comment wrapper for directive-start context
    let finalInsert = insert;
    if (autocompleteResult.context === 'directive-start') {
        // Check if {{// is already there
        const beforeTrimmed = before.trimEnd();
        if (!beforeTrimmed.endsWith('{{//')) {
            finalInsert = '{{// ' + insert;
        }
    }

    const newText = before + finalInsert + after;
    const newCursorPos = before.length + finalInsert.length;

    // Update textarea
    textarea.value = newText;
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    // Trigger input event for any listeners
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    return newCursorPos;
}

/**
 * Get directive definition by name
 */
export function getDirectiveDefinition(directiveName) {
    return DIRECTIVE_DEFINITIONS.find(d => d.directive === directiveName);
}

/**
 * Get all directive names for syntax highlighting
 */
export function getAllDirectiveNames() {
    return DIRECTIVE_DEFINITIONS.map(d => d.directive);
}
