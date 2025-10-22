/**
 * Nemo Directive Autocomplete System
 * Provides intelligent autocomplete for directive syntax in prompt editor
 *
 * @module directive-autocomplete
 */

import logger from '../../core/logger.js';
import { getAllPromptsWithState } from './prompt-directives.js';
import { SILLYTAVERN_MACROS } from './sillytavern-macros.js';
import { chat_metadata } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';

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
        description: 'Auto-disable these prompts when enabled',
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
        description: 'Prompts that work well together',
        example: '@recommended-with visual-descriptions, detailed-environment',
        requiresValue: true,
        valueType: 'prompt-list'
    },

    // === NEW DIRECTIVES ===

    // Core Organization
    {
        directive: '@tags',
        syntax: '@tags <tag1>, <tag2>, ...',
        description: 'Searchable tags for filtering prompts',
        example: '@tags combat, realism, violence, nsfw',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@group',
        syntax: '@group <group name>',
        description: 'Group prompts into collapsible sections',
        example: '@group Vex Personalities',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@group-description',
        syntax: '@group-description <description>',
        description: 'Description text for the group',
        example: '@group-description Choose ONE personality variant',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@mutual-exclusive-group',
        syntax: '@mutual-exclusive-group <group name>',
        description: 'Auto-disable others in group when enabled',
        example: '@mutual-exclusive-group response-length',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@priority',
        syntax: '@priority <1-100>',
        description: 'Control load order (higher = first)',
        example: '@priority 90',
        requiresValue: true,
        valueType: 'number'
    },

    // Visibility & Conditionals
    {
        directive: '@if-enabled',
        syntax: '@if-enabled <prompt-id>, <prompt-id>, ...',
        description: 'Show only if these prompts are enabled',
        example: '@if-enabled nsfw-mode, advanced-features',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@if-disabled',
        syntax: '@if-disabled <prompt-id>, <prompt-id>, ...',
        description: 'Show only if these prompts are disabled',
        example: '@if-disabled safe-mode',
        requiresValue: true,
        valueType: 'prompt-list'
    },
    {
        directive: '@if-api',
        syntax: '@if-api <api>, <api>, ...',
        description: 'Show only for specific APIs',
        example: '@if-api openai, claude',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@hidden',
        syntax: '@hidden',
        description: 'Hide from UI entirely (still functions)',
        example: '@hidden',
        requiresValue: false
    },

    // Setup & Defaults
    {
        directive: '@default-enabled',
        syntax: '@default-enabled',
        description: 'Auto-enable on first use',
        example: '@default-enabled',
        requiresValue: false
    },
    {
        directive: '@recommended-for-beginners',
        syntax: '@recommended-for-beginners',
        description: 'Highlight for new users',
        example: '@recommended-for-beginners',
        requiresValue: false
    },
    {
        directive: '@advanced',
        syntax: '@advanced',
        description: 'Mark as expert-only',
        example: '@advanced',
        requiresValue: false
    },

    // Performance & Resources
    {
        directive: '@token-cost',
        syntax: '@token-cost <number>',
        description: 'Estimated token usage',
        example: '@token-cost 500',
        requiresValue: true,
        valueType: 'number'
    },
    {
        directive: '@token-cost-warn',
        syntax: '@token-cost-warn <number>',
        description: 'Warning threshold for total tokens',
        example: '@token-cost-warn 8000',
        requiresValue: true,
        valueType: 'number'
    },
    {
        directive: '@performance-impact',
        syntax: '@performance-impact <low|medium|high>',
        description: 'Performance impact indicator',
        example: '@performance-impact medium',
        requiresValue: true,
        valueType: 'text'
    },

    // Help & Documentation
    {
        directive: '@help',
        syntax: '@help <help text>',
        description: 'Inline help text (rich format)',
        example: '@help This prompt enables X, Y, Z. Works best with A and B.',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@documentation-url',
        syntax: '@documentation-url <url>',
        description: 'External documentation link',
        example: '@documentation-url https://docs.example.com/guide',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@example',
        syntax: '@example <usage example>',
        description: 'Usage example code or text',
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
        description: 'Belongs to named profile(s)',
        example: '@profile sfw, beginner, recommended',
        requiresValue: true,
        valueType: 'text-list'
    },
    {
        directive: '@preset-name',
        syntax: '@preset-name <name>',
        description: 'Full preset identifier',
        example: '@preset-name Nemo Preset v3',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@preset-version',
        syntax: '@preset-version <version>',
        description: 'Preset version number',
        example: '@preset-version 3.2.1',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@requires-preset-version',
        syntax: '@requires-preset-version <version constraint>',
        description: 'Version compatibility check',
        example: '@requires-preset-version >=3.0.0',
        requiresValue: true,
        valueType: 'text'
    },

    // Quality & Status
    {
        directive: '@unstable',
        syntax: '@unstable <warning message>',
        description: 'Experimental/unstable warning',
        example: '@unstable This feature is experimental and may change',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@experimental',
        syntax: '@experimental <beta message>',
        description: 'Beta feature warning',
        example: '@experimental Beta feature - please report issues',
        requiresValue: true,
        valueType: 'text'
    },
    {
        directive: '@tested-with',
        syntax: '@tested-with <model>, <model>, ...',
        description: 'Known working combinations',
        example: '@tested-with gpt-4, claude-3, llama-70b',
        requiresValue: true,
        valueType: 'text-list'
    },

    // Model Optimization
    {
        directive: '@model-optimized',
        syntax: '@model-optimized <model>, <model>, ...',
        description: 'Best for specific models',
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
        description: 'Best API for this prompt',
        example: '@recommended-api openai, anthropic',
        requiresValue: true,
        valueType: 'text-list'
    },

    // Smart Behavior
    {
        directive: '@auto-enable-with',
        syntax: '@auto-enable-with <prompt-id>, <prompt-id>, ...',
        description: 'Auto-enable these when this is enabled',
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
        description: 'Execution order hint',
        example: '@load-order 100',
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
    console.log('[Autocomplete] Called with cursor at:', cursorPos);
    console.log('[Autocomplete] Text around cursor:', text.substring(Math.max(0, cursorPos - 30), cursorPos + 10));

    // Check if we're inside a {{// }} comment block
    const commentContext = getCommentContext(text, cursorPos);
    console.log('[Autocomplete] Comment context:', commentContext);

    if (commentContext.inComment) {
        console.log('[Autocomplete] Inside comment, calling directive suggestions');
        return getDirectiveAutocompleteSuggestions(text, cursorPos, commentContext);
    }

    console.log('[Autocomplete] Not in comment, calling prompt name search');
    // Not in a comment - check for general prompt name search
    return getPromptNameSearchSuggestions(text, cursorPos);
}

/**
 * Get directive autocomplete suggestions (inside {{// }} blocks)
 */
function getDirectiveAutocompleteSuggestions(text, cursorPos, commentContext) {
    const lineStart = commentContext.lineStart;
    const lineText = text.substring(lineStart, cursorPos);
    const trimmedLine = lineText.trim();

    console.log('[Directive AC] lineStart:', lineStart, 'cursorPos:', cursorPos);
    console.log('[Directive AC] lineText:', lineText);
    console.log('[Directive AC] trimmedLine:', trimmedLine);

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
    const directiveMatch = trimmedLine.match(/^\{\{\/\/\s*(@[\w-]+)\s+(.*)$/);
    if (directiveMatch) {
        const directiveName = directiveMatch[1];
        const valueText = directiveMatch[2];

        console.log('[Directive AC] Matched directive:', directiveName, 'valueText:', valueText);

        const definition = DIRECTIVE_DEFINITIONS.find(d => d.directive === directiveName);

        if (definition && definition.valueType === 'prompt-list') {
            console.log('[Directive AC] Found definition, calling getPromptSuggestions');
            // Suggest prompt identifiers
            const result = getPromptSuggestions(valueText, lineStart, cursorPos, definition);
            console.log('[Directive AC] Got suggestions:', result.suggestions?.length || 0);
            return result;
        } else {
            console.log('[Directive AC] No definition or wrong valueType:', definition?.valueType);
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
 * Get prompt name search suggestions (outside directive blocks)
 * Shows SillyTavern macros when typing {{ or prompts for other searches
 */
function getPromptNameSearchSuggestions(text, cursorPos) {
    // Find the current word being typed
    const beforeCursor = text.substring(0, cursorPos);
    const afterCursor = text.substring(cursorPos);

    // Find word boundaries (spaces, newlines, or start/end of text)
    const wordStart = Math.max(
        beforeCursor.lastIndexOf(' ') + 1,
        beforeCursor.lastIndexOf('\n') + 1,
        0
    );

    const wordEndInAfter = afterCursor.search(/[\s\n]/);
    const wordEnd = wordEndInAfter === -1 ? text.length : cursorPos + wordEndInAfter;

    const currentWord = text.substring(wordStart, wordEnd).trim();

    // Check if typing a macro (starts with {{)
    if (currentWord.startsWith('{{')) {
        return getMacroSuggestions(currentWord, wordStart, wordEnd);
    }

    // Only show prompt suggestions if typing at least 2 characters
    if (currentWord.length < 2) {
        return { suggestions: [], context: null };
    }

    // Don't show if we're typing a directive
    if (currentWord.startsWith('@')) {
        return { suggestions: [], context: null };
    }

    // Search for prompts
    const allPrompts = getAllPromptsWithState();
    const searchTerm = currentWord.toLowerCase();

    const matchingPrompts = allPrompts
        .filter(p => {
            const name = p.name.toLowerCase();
            const identifier = p.identifier.toLowerCase();

            // Remove emojis from name for matching
            const nameNoEmoji = name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();

            return name.includes(searchTerm) ||
                   identifier.includes(searchTerm) ||
                   nameNoEmoji.includes(searchTerm);
        })
        .slice(0, 15); // Limit to 15 suggestions

    if (matchingPrompts.length === 0) {
        return { suggestions: [], context: null };
    }

    return {
        suggestions: matchingPrompts.map(p => ({
            type: 'prompt-name',
            text: p.name,
            display: p.name,
            description: `ID: ${p.identifier} ${p.enabled ? '✓ Enabled' : ''}`,
            insertText: p.name,
            promptData: p
        })),
        context: 'prompt-name-search',
        replaceStart: wordStart,
        replaceEnd: wordEnd,
        searchTerm: currentWord
    };
}

/**
 * Get SillyTavern macro suggestions
 */
function getMacroSuggestions(currentWord, wordStart, wordEnd) {
    // Check if this is a variable macro with :: syntax
    // Examples: {{getvar::, {{setvar::, {{getglobalvar::
    const variableMacroMatch = currentWord.match(/^\{\{(getvar|setvar|addvar|incvar|decvar|getglobalvar|setglobalvar|addglobalvar|incglobalvar|decglobalvar)::(.*)/);

    if (variableMacroMatch) {
        const macroName = variableMacroMatch[1];
        const partialVarName = variableMacroMatch[2].toLowerCase();

        console.log('[Macro AC] Variable macro detected:', macroName, 'partial:', partialVarName);

        return getVariableSuggestions(macroName, partialVarName, wordStart, wordEnd);
    }

    // Regular macro search
    const searchTerm = currentWord.substring(2).toLowerCase(); // Remove {{ prefix

    // Filter macros that match
    const matchingMacros = SILLYTAVERN_MACROS.filter(m => {
        const macroText = m.macro.toLowerCase();
        return macroText.includes('{{' + searchTerm);
    }).slice(0, 20); // Limit to 20 suggestions

    if (matchingMacros.length === 0) {
        return { suggestions: [], context: null };
    }

    return {
        suggestions: matchingMacros.map(m => ({
            type: 'macro',
            text: m.macro,
            display: m.macro,
            description: `${m.category}: ${m.description}`,
            insertText: m.macro,
            macroData: m
        })),
        context: 'macro-search',
        replaceStart: wordStart,
        replaceEnd: wordEnd,
        searchTerm: currentWord
    };
}

/**
 * Get variable name suggestions for variable macros
 */
function getVariableSuggestions(macroName, partialVarName, wordStart, wordEnd) {
    const isLocal = macroName.startsWith('get') || macroName.startsWith('set') || macroName.startsWith('add') || macroName.startsWith('inc') || macroName.startsWith('dec');
    const isGlobal = macroName.includes('global');

    const variables = [];

    // Get local variables
    if (isLocal && !isGlobal) {
        try {
            if (chat_metadata?.variables) {
                const localVars = Object.keys(chat_metadata.variables);
                console.log('[Variable AC] Found', localVars.length, 'local variables');
                localVars.forEach(varName => {
                    variables.push({
                        name: varName,
                        type: 'local',
                        value: chat_metadata.variables[varName]
                    });
                });
            }
        } catch (error) {
            console.log('[Variable AC] Error getting local variables:', error);
        }
    }

    // Get global variables
    if (isGlobal) {
        try {
            if (extension_settings?.variables?.global) {
                const globalVars = Object.keys(extension_settings.variables.global);
                console.log('[Variable AC] Found', globalVars.length, 'global variables');
                globalVars.forEach(varName => {
                    variables.push({
                        name: varName,
                        type: 'global',
                        value: extension_settings.variables.global[varName]
                    });
                });
            }
        } catch (error) {
            console.log('[Variable AC] Error getting global variables:', error);
        }
    }

    // Filter by partial name
    const matchingVars = variables.filter(v =>
        v.name.toLowerCase().includes(partialVarName)
    ).slice(0, 20);

    console.log('[Variable AC] Matching variables:', matchingVars.length);

    if (matchingVars.length === 0) {
        return { suggestions: [], context: null };
    }

    return {
        suggestions: matchingVars.map(v => {
            const valuePreview = String(v.value).length > 30
                ? String(v.value).substring(0, 30) + '...'
                : String(v.value);

            return {
                type: 'variable',
                text: v.name,
                display: v.name,
                description: `${v.type} variable: ${valuePreview}`,
                insertText: `{{${macroName}::${v.name}}}`,
                variableData: v
            };
        }),
        context: 'variable-search',
        replaceStart: wordStart,
        replaceEnd: wordEnd,
        searchTerm: partialVarName
    };
}

/**
 * Get context about whether cursor is in a comment block
 */
function getCommentContext(text, cursorPos) {
    // Find the line containing the cursor
    let lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
    let lineEnd = text.indexOf('\n', cursorPos);
    if (lineEnd === -1) lineEnd = text.length;

    const lineText = text.substring(lineStart, lineEnd);

    // Check if line contains {{//
    const commentStart = lineText.indexOf('{{//');
    const commentEnd = lineText.indexOf('}}');

    if (commentStart !== -1) {
        const cursorInLine = cursorPos - lineStart;

        // Check if cursor is between {{// and }} (or end of line if no }})
        if (cursorInLine >= commentStart) {
            if (commentEnd === -1 || cursorInLine <= commentEnd) {
                return {
                    inComment: true,
                    lineStart: lineStart + commentStart,
                    lineEnd: commentEnd === -1 ? lineEnd : lineStart + commentEnd,
                    commentStart: lineStart + commentStart,
                    commentEnd: commentEnd === -1 ? null : lineStart + commentEnd
                };
            }
        }
    }

    return { inComment: false };
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
function getValueSuggestions(valueText, lineStart, cursorPos, definition) {
    const suggestions = VALUE_SUGGESTIONS[definition.directive];
    if (!suggestions || suggestions.length === 0) {
        return { suggestions: [], context: null };
    }

    // Get the current word being typed (after last comma for list values)
    const lastComma = valueText.lastIndexOf(',');
    const currentWord = lastComma === -1 ? valueText : valueText.substring(lastComma + 1);
    const trimmedWord = currentWord.trim().toLowerCase();

    console.log('[Value Suggestions] Directive:', definition.directive, 'Search:', trimmedWord);

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
    const directiveLength = definition.directive.length;
    const valueStartOffset = 5 + directiveLength + 1; // "{{// " + directive + " "
    const wordOffsetInValue = lastComma === -1 ? 0 : lastComma + 1;
    const whitespaceMatch = currentWord.match(/^\s*/);
    const whitespaceLength = whitespaceMatch ? whitespaceMatch[0].length : 0;
    const wordStartInLine = lineStart + valueStartOffset + wordOffsetInValue + whitespaceLength;

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
function getPromptSuggestions(valueText, lineStart, cursorPos, definition) {
    // Check if this directive has predefined value suggestions
    if (definition && VALUE_SUGGESTIONS[definition.directive]) {
        return getValueSuggestions(valueText, lineStart, cursorPos, definition);
    }

    const allPrompts = getAllPromptsWithState();
    console.log('[Prompt Suggestions] All prompts count:', allPrompts.length);

    // Get the current word being typed (after last comma)
    const lastComma = valueText.lastIndexOf(',');
    const currentWord = lastComma === -1 ? valueText : valueText.substring(lastComma + 1);
    const trimmedWord = currentWord.trim().toLowerCase();

    console.log('[Prompt Suggestions] Searching for:', trimmedWord);

    // Don't show suggestions for very short searches
    if (trimmedWord.length === 0) {
        console.log('[Prompt Suggestions] Empty search term');
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

            const matches = id.includes(trimmedWord) ||
                   name.includes(trimmedWord) ||
                   nameNoEmoji.includes(trimmedWord) ||
                   nameClean.includes(trimmedWord);

            if (matches) {
                console.log('[Prompt Suggestions] Match found:', p.name, '(', p.identifier, ')');
            }

            return matches;
        })
        .slice(0, 20); // Limit to 20 suggestions

    console.log('[Prompt Suggestions] Total matches:', matchingPrompts.length);

    if (matchingPrompts.length === 0) {
        return { suggestions: [], context: null };
    }

    // Calculate replace range
    // We need to find where the current word starts in the full text
    // lineStart is the position of {{//, valueText is everything after the directive name
    // We need to find the offset of the directive name first

    // Example: "{{// @conflicts-with NSFW"
    // lineStart = position of {{//
    // We need to find where "NSFW" starts from lineStart

    // Find the length of "{{// @conflicts-with " to get the start of valueText
    const directiveLength = definition ? definition.directive.length : 0;
    const valueStartOffset = 5 + directiveLength + 1; // "{{// " + directive + " "

    // Now find where the current word starts within valueText
    const wordOffsetInValue = lastComma === -1 ? 0 : lastComma + 1;

    // Skip any whitespace at the start of currentWord
    const whitespaceMatch = currentWord.match(/^\s*/);
    const whitespaceLength = whitespaceMatch ? whitespaceMatch[0].length : 0;

    const wordStartInLine = lineStart + valueStartOffset + wordOffsetInValue + whitespaceLength;

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
