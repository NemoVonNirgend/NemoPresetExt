/**
 * Nemo Prompt Directive System
 * Allows preset makers to embed rules, dependencies, and metadata in prompt comments
 *
 * @module prompt-directives
 */

import logger from '../../core/logger.js';
import { promptManager } from '../../../../../openai.js';

/**
 * Parse all directives from a prompt's content
 * @param {string} content - The prompt content
 * @returns {Object} Parsed directives
 */
export function parsePromptDirectives(content) {
    if (!content) return getEmptyDirectives();

    const directives = getEmptyDirectives();

    // Extract all {{// ... }} blocks
    const commentRegex = /\{\{\/\/(.*?)\}\}/g;
    let match;

    while ((match = commentRegex.exec(content)) !== null) {
        const comment = match[1].trim();
        parseDirectiveLine(comment, directives);
    }

    return directives;
}

/**
 * Get empty directives object
 * @returns {Object}
 */
function getEmptyDirectives() {
    return {
        // Existing directives
        tooltip: null,
        exclusiveWith: [],
        exclusiveWithMessage: null,
        requires: [],
        requiresMessage: null,
        conflictsWith: [],
        conflictsMessage: null,
        warning: null,
        categories: [],
        maxOnePerCategory: null,
        deprecated: null,
        autoDisable: [],
        autoEnableDependencies: false,
        author: null,
        version: null,
        incompatibleApis: [],
        recommendedWith: [],

        // Core Organization
        tags: [],
        group: null,
        groupDescription: null,
        mutualExclusiveGroup: null,
        priority: null,

        // Visibility & Conditionals
        ifEnabled: [],
        ifDisabled: [],
        ifApi: [],
        hidden: false,

        // Setup & Defaults
        defaultEnabled: false,
        recommendedForBeginners: false,
        advanced: false,

        // Performance & Resources
        tokenCost: null,
        tokenCostWarn: null,
        performanceImpact: null,

        // Help & Documentation
        help: null,
        documentationUrl: null,
        example: null,
        changelog: null,

        // Visual Customization
        icon: null,
        color: null,
        badge: null,
        highlight: false,

        // Profiles & Presets
        profiles: [],
        presetName: null,
        presetVersion: null,
        requiresPresetVersion: null,

        // Quality & Status
        unstable: null,
        experimental: null,
        testedWith: [],

        // Model Optimization
        modelOptimized: [],
        modelIncompatible: [],
        recommendedApi: [],

        // Smart Behavior
        autoEnableWith: [],
        suggestEnableWith: [],
        loadOrder: null
    };
}

/**
 * Parse a single directive line
 * @param {string} line - The directive line
 * @param {Object} directives - Directives object to populate
 */
function parseDirectiveLine(line, directives) {
    // @tooltip - Hover text description
    if (line.startsWith('@tooltip ')) {
        directives.tooltip = line.substring(9).trim();
    }
    // @exclusive-with - Mutually exclusive prompts
    else if (line.startsWith('@exclusive-with ')) {
        const ids = line.substring(16).split(',').map(id => id.trim());
        directives.exclusiveWith.push(...ids);
    }
    // @exclusive-with-message - Custom conflict message
    else if (line.startsWith('@exclusive-with-message ')) {
        directives.exclusiveWithMessage = line.substring(24).trim();
    }
    // @requires - Required dependencies
    else if (line.startsWith('@requires ')) {
        const ids = line.substring(10).split(',').map(id => id.trim());
        directives.requires.push(...ids);
    }
    // @requires-message - Custom dependency message
    else if (line.startsWith('@requires-message ')) {
        directives.requiresMessage = line.substring(18).trim();
    }
    // @conflicts-with - Soft conflicts (warning only)
    else if (line.startsWith('@conflicts-with ')) {
        const ids = line.substring(16).split(',').map(id => id.trim());
        directives.conflictsWith.push(...ids);
    }
    // @conflicts-message - Custom conflict warning message
    else if (line.startsWith('@conflicts-message ')) {
        directives.conflictsMessage = line.substring(19).trim();
    }
    // @warning - General warning when enabled
    else if (line.startsWith('@warning ')) {
        directives.warning = line.substring(9).trim();
    }
    // @category - Group prompts
    else if (line.startsWith('@category ')) {
        const cats = line.substring(10).split(',').map(c => c.trim());
        directives.categories.push(...cats);
    }
    // @max-one-per-category - Only one prompt per category
    else if (line.startsWith('@max-one-per-category ')) {
        directives.maxOnePerCategory = line.substring(22).trim();
    }
    // @deprecated - Mark as outdated
    else if (line.startsWith('@deprecated ')) {
        directives.deprecated = line.substring(12).trim();
    }
    // @auto-disable - Auto-disable other prompts when this is enabled
    else if (line.startsWith('@auto-disable ')) {
        const ids = line.substring(14).split(',').map(id => id.trim());
        directives.autoDisable.push(...ids);
    }
    // @auto-enable-dependencies - Auto-enable required prompts
    else if (line.startsWith('@auto-enable-dependencies')) {
        directives.autoEnableDependencies = true;
    }
    // @author - Prompt author
    else if (line.startsWith('@author ')) {
        directives.author = line.substring(8).trim();
    }
    // @version - Prompt version
    else if (line.startsWith('@version ')) {
        directives.version = line.substring(9).trim();
    }
    // @incompatible-api - APIs this doesn't work with
    else if (line.startsWith('@incompatible-api ')) {
        const apis = line.substring(18).split(',').map(api => api.trim().toLowerCase());
        directives.incompatibleApis.push(...apis);
    }
    // @recommended-with - Prompts that work well together
    else if (line.startsWith('@recommended-with ')) {
        const ids = line.substring(18).split(',').map(id => id.trim());
        directives.recommendedWith.push(...ids);
    }

    // === NEW DIRECTIVES ===

    // Core Organization
    else if (line.startsWith('@tags ')) {
        const tags = line.substring(6).split(',').map(t => t.trim());
        directives.tags.push(...tags);
    }
    else if (line.startsWith('@group ')) {
        directives.group = line.substring(7).trim();
    }
    else if (line.startsWith('@group-description ')) {
        directives.groupDescription = line.substring(19).trim();
    }
    else if (line.startsWith('@mutual-exclusive-group ')) {
        directives.mutualExclusiveGroup = line.substring(24).trim();
    }
    else if (line.startsWith('@priority ')) {
        directives.priority = parseInt(line.substring(10).trim());
    }

    // Visibility & Conditionals
    else if (line.startsWith('@if-enabled ')) {
        const ids = line.substring(12).split(',').map(id => id.trim());
        directives.ifEnabled.push(...ids);
    }
    else if (line.startsWith('@if-disabled ')) {
        const ids = line.substring(13).split(',').map(id => id.trim());
        directives.ifDisabled.push(...ids);
    }
    else if (line.startsWith('@if-api ')) {
        const apis = line.substring(8).split(',').map(api => api.trim().toLowerCase());
        directives.ifApi.push(...apis);
    }
    else if (line.startsWith('@hidden')) {
        directives.hidden = true;
    }

    // Setup & Defaults
    else if (line.startsWith('@default-enabled')) {
        directives.defaultEnabled = true;
    }
    else if (line.startsWith('@recommended-for-beginners')) {
        directives.recommendedForBeginners = true;
    }
    else if (line.startsWith('@advanced')) {
        directives.advanced = true;
    }

    // Performance & Resources
    else if (line.startsWith('@token-cost ')) {
        directives.tokenCost = parseInt(line.substring(12).trim());
    }
    else if (line.startsWith('@token-cost-warn ')) {
        directives.tokenCostWarn = parseInt(line.substring(17).trim());
    }
    else if (line.startsWith('@performance-impact ')) {
        directives.performanceImpact = line.substring(20).trim().toLowerCase();
    }

    // Help & Documentation
    else if (line.startsWith('@help ')) {
        directives.help = line.substring(6).trim();
    }
    else if (line.startsWith('@documentation-url ')) {
        directives.documentationUrl = line.substring(19).trim();
    }
    else if (line.startsWith('@example ')) {
        directives.example = line.substring(9).trim();
    }
    else if (line.startsWith('@changelog ')) {
        directives.changelog = line.substring(11).trim();
    }

    // Visual Customization
    else if (line.startsWith('@icon ')) {
        directives.icon = line.substring(6).trim();
    }
    else if (line.startsWith('@color ')) {
        directives.color = line.substring(7).trim();
    }
    else if (line.startsWith('@badge ')) {
        directives.badge = line.substring(7).trim();
    }
    else if (line.startsWith('@highlight')) {
        directives.highlight = true;
    }

    // Profiles & Presets
    else if (line.startsWith('@profile ')) {
        const profiles = line.substring(9).split(',').map(p => p.trim());
        directives.profiles.push(...profiles);
    }
    else if (line.startsWith('@preset-name ')) {
        directives.presetName = line.substring(13).trim();
    }
    else if (line.startsWith('@preset-version ')) {
        directives.presetVersion = line.substring(16).trim();
    }
    else if (line.startsWith('@requires-preset-version ')) {
        directives.requiresPresetVersion = line.substring(25).trim();
    }

    // Quality & Status
    else if (line.startsWith('@unstable ')) {
        directives.unstable = line.substring(10).trim();
    }
    else if (line.startsWith('@experimental ')) {
        directives.experimental = line.substring(14).trim();
    }
    else if (line.startsWith('@tested-with ')) {
        const items = line.substring(13).split(',').map(i => i.trim());
        directives.testedWith.push(...items);
    }

    // Model Optimization
    else if (line.startsWith('@model-optimized ')) {
        const models = line.substring(17).split(',').map(m => m.trim());
        directives.modelOptimized.push(...models);
    }
    else if (line.startsWith('@model-incompatible ')) {
        const models = line.substring(20).split(',').map(m => m.trim());
        directives.modelIncompatible.push(...models);
    }
    else if (line.startsWith('@recommended-api ')) {
        const apis = line.substring(17).split(',').map(api => api.trim().toLowerCase());
        directives.recommendedApi.push(...apis);
    }

    // Smart Behavior
    else if (line.startsWith('@auto-enable-with ')) {
        const ids = line.substring(18).split(',').map(id => id.trim());
        directives.autoEnableWith.push(...ids);
    }
    else if (line.startsWith('@suggest-enable-with ')) {
        const ids = line.substring(21).split(',').map(id => id.trim());
        directives.suggestEnableWith.push(...ids);
    }
    else if (line.startsWith('@load-order ')) {
        directives.loadOrder = parseInt(line.substring(12).trim());
    }
}

/**
 * Validate a prompt activation and return any issues
 * @param {string} promptId - ID of prompt being enabled
 * @param {Array} allPrompts - All prompts with their states
 * @returns {Array} Array of validation issues
 */
export function validatePromptActivation(promptId, allPrompts) {
    const prompt = allPrompts.find(p => p.identifier === promptId);
    if (!prompt || !prompt.content) return [];

    const directives = parsePromptDirectives(prompt.content);
    const issues = [];

    // Check exclusive-with (hard conflict - cannot enable both)
    for (const exclusiveId of directives.exclusiveWith) {
        const conflictingPrompt = allPrompts.find(p => p.identifier === exclusiveId && p.enabled);
        if (conflictingPrompt) {
            issues.push({
                type: 'exclusive',
                severity: 'error',
                message: directives.exclusiveWithMessage ||
                         `Cannot enable both "${prompt.name}" and "${conflictingPrompt.name}". These prompts are mutually exclusive.`,
                conflictingPrompt: conflictingPrompt,
                currentPrompt: prompt,
                directive: 'exclusive-with'
            });
        }
    }

    // REVERSE CHECK: Check if any enabled prompts have this prompt in their exclusive-with
    for (const otherPrompt of allPrompts) {
        if (!otherPrompt.enabled || otherPrompt.identifier === promptId || !otherPrompt.content) continue;

        const otherDirectives = parsePromptDirectives(otherPrompt.content);

        if (otherDirectives.exclusiveWith.includes(promptId)) {
            issues.push({
                type: 'exclusive',
                severity: 'error',
                message: otherDirectives.exclusiveWithMessage ||
                         `Cannot enable both "${prompt.name}" and "${otherPrompt.name}". "${otherPrompt.name}" conflicts with this prompt.`,
                conflictingPrompt: otherPrompt,
                currentPrompt: prompt,
                directive: 'exclusive-with'
            });
        }
    }

    // Check requires (missing dependencies)
    for (const requiredId of directives.requires) {
        const requiredPrompt = allPrompts.find(p => p.identifier === requiredId);
        if (!requiredPrompt || !requiredPrompt.enabled) {
            issues.push({
                type: 'missing-dependency',
                severity: 'error',
                message: directives.requiresMessage ||
                         `"${prompt.name}" requires "${requiredPrompt?.name || requiredId}" to be enabled.`,
                requiredPrompt: requiredPrompt,
                currentPrompt: prompt,
                canAutoEnable: directives.autoEnableDependencies,
                directive: 'requires'
            });
        }
    }

    // Check max-one-per-category
    if (directives.maxOnePerCategory) {
        const sameCategory = allPrompts.filter(p => {
            if (!p.enabled || p.identifier === promptId || !p.content) return false;
            const pDirectives = parsePromptDirectives(p.content);
            return pDirectives.categories.includes(directives.maxOnePerCategory);
        });

        if (sameCategory.length > 0) {
            issues.push({
                type: 'category-limit',
                severity: 'error',
                message: `Only one prompt from category "${directives.maxOnePerCategory}" can be active. Already active: ${sameCategory.map(p => `"${p.name}"`).join(', ')}`,
                conflictingPrompts: sameCategory,
                currentPrompt: prompt,
                category: directives.maxOnePerCategory,
                directive: 'max-one-per-category'
            });
        }
    }

    // Check conflicts-with (soft conflict - warning only)
    for (const conflictId of directives.conflictsWith) {
        const conflictingPrompt = allPrompts.find(p => p.identifier === conflictId && p.enabled);
        if (conflictingPrompt) {
            issues.push({
                type: 'soft-conflict',
                severity: 'warning',
                message: directives.conflictsMessage ||
                         `"${prompt.name}" may conflict with "${conflictingPrompt.name}". Consider disabling one.`,
                conflictingPrompt: conflictingPrompt,
                currentPrompt: prompt,
                directive: 'conflicts-with'
            });
        }
    }

    // REVERSE CHECK: Check if any enabled prompts have this prompt in their conflicts-with
    for (const otherPrompt of allPrompts) {
        if (!otherPrompt.enabled || otherPrompt.identifier === promptId || !otherPrompt.content) continue;

        const otherDirectives = parsePromptDirectives(otherPrompt.content);

        if (otherDirectives.conflictsWith.includes(promptId)) {
            issues.push({
                type: 'soft-conflict',
                severity: 'warning',
                message: otherDirectives.conflictsMessage ||
                         `"${prompt.name}" may conflict with "${otherPrompt.name}". "${otherPrompt.name}" suggests disabling one.`,
                conflictingPrompt: otherPrompt,
                currentPrompt: prompt,
                directive: 'conflicts-with'
            });
        }
    }

    // Check for deprecated
    if (directives.deprecated) {
        issues.push({
            type: 'deprecated',
            severity: 'warning',
            message: `"${prompt.name}" is deprecated. ${directives.deprecated}`,
            currentPrompt: prompt,
            directive: 'deprecated'
        });
    }

    return issues;
}

/**
 * Get all prompts with their enabled state
 * @returns {Array} Array of prompts
 */
export function getAllPromptsWithState() {
    if (!promptManager) return [];

    try {
        const prompts = promptManager.serviceSettings?.prompts || [];

        return prompts.map(prompt => ({
            identifier: prompt.identifier,
            name: prompt.name,
            content: prompt.content,
            enabled: !promptManager.isPromptDisabledForActiveCharacter(prompt.identifier),
            role: prompt.role,
            system_prompt: prompt.system_prompt
        }));
    } catch (error) {
        logger.error('Error getting prompts with state:', error);
        return [];
    }
}

/**
 * Documentation for the directive system
 */
export const DIRECTIVE_DOCUMENTATION = `
# Nemo Prompt Directive Language

Add special comments to your prompts to define rules, dependencies, and behaviors.

## Basic Syntax
All directives are placed inside \\{\\{// ... }} comments at the start of your prompt:

\\{\\{// @directive-name value }}
Your prompt content here...

## Available Directives

### @tooltip <text>
Set the tooltip that appears when hovering over the prompt name.

**Example:**
\\{\\{// @tooltip Enable for realistic combat with injuries and lasting damage. }}

---

### @exclusive-with <id1, id2, ...>
This prompt cannot be enabled if any of the listed prompts are enabled.

**Example:**
\\{\\{// @exclusive-with core-pack-alpha, core-pack-omega }}

---

### @exclusive-with-message <message>
Custom error message shown when exclusive conflict is detected.

**Example:**
\\{\\{// @exclusive-with core-pack-alpha, core-pack-omega }}
\\{\\{// @exclusive-with-message Only enable ONE core pack! They will conflict. }}

---

### @requires <id1, id2, ...>
This prompt requires other prompts to be enabled first.

**Example:**
\\{\\{// @requires core-rules, jailbreak }}

---

### @requires-message <message>
Custom error message shown when required dependency is missing.

**Example:**
\\{\\{// @requires core-rules }}
\\{\\{// @requires-message You must enable "Core Rules" first! }}

---

### @conflicts-with <id1, id2, ...>
Soft conflict - shows a warning but doesn't prevent activation.

**Example:**
\\{\\{// @conflicts-with slow-pacing }}

---

### @conflicts-message <message>
Custom warning message for soft conflicts.

**Example:**
\\{\\{// @conflicts-with slow-pacing }}
\\{\\{// @conflicts-message May not work well with slow pacing prompts. }}

---

### @warning <text>
Show a warning whenever this prompt is enabled.

**Example:**
\\{\\{// @warning Experimental feature! May cause unexpected behavior. }}

---

### @category <cat1, cat2, ...>
Assign categories to this prompt for organization.

**Example:**
\\{\\{// @category NSFW, Fetish }}

---

### @max-one-per-category <category>
Only one prompt from this category can be active at a time.

**Example:**
\\{\\{// @category response-length }}
\\{\\{// @max-one-per-category response-length }}

---

### @deprecated <message>
Mark this prompt as outdated and suggest alternatives.

**Example:**
\\{\\{// @deprecated Use "New System Prompt v3" instead. }}

---

### @auto-disable <id1, id2, ...>
Automatically disable listed prompts when this one is enabled.

**Example:**
\\{\\{// @auto-disable old-system-prompt }}

---

### @auto-enable-dependencies
Automatically enable required prompts instead of showing error.

**Example:**
\\{\\{// @requires core-rules }}
\\{\\{// @auto-enable-dependencies }}

---

### @author <name>
Document who created this prompt.

**Example:**
\\{\\{// @author NokiaArmour }}

---

### @version <version>
Track the version of this prompt.

**Example:**
\\{\\{// @version 2.1.0 }}

---

### @incompatible-api <api1, api2, ...>
Warn if used with specific APIs.

**Example:**
\\{\\{// @incompatible-api claude, openai }}

---

### @recommended-with <id1, id2, ...>
Suggest prompts that work well together.

**Example:**
\\{\\{// @recommended-with visual-descriptions, detailed-environment }}

---

## Complete Example

\\{\\{// @tooltip Master realism toggle for grounded, believable stories }}
\\{\\{// @category realism }}
\\{\\{// @conflicts-with pure-wish-fulfillment }}
\\{\\{// @conflicts-message Realism conflicts with wish fulfillment mode }}
\\{\\{// @author NemoPreset }}
\\{\\{// @version 1.0.0 }}
Enable realistic consequences, physics, and social dynamics.
Characters face real challenges and limitations.

---

## Tips

- Use multiple directives together for complex rules
- Directives can appear anywhere in \\{\\{// }} comments
- Comments are stripped before sending to AI
- Test your directives by toggling prompts
- Use clear, helpful messages for users

---

## Finding Prompt IDs

To use directives like @exclusive-with, you need the prompt's identifier.

**How to find it:**
1. Open the prompt in the editor
2. Look at the browser's developer console
3. The ID appears in logs when editing

Or check the prompt's data-pm-identifier attribute in the HTML.
`;
