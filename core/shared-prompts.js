/**
 * Shared Prompt Library - Integration Opportunity 3.2
 * Centralized prompt management for NemoLore and ProsePolisher
 */

/**
 * SharedPromptsManager - Central registry for reusable prompts
 * Used by both NemoLore (summarization) and ProsePolisher (analysis)
 */
class SharedPromptsManager {
    constructor() {
        /** @type {Map<string, Object>} */
        this.prompts = new Map();

        // Initialize default prompts
        this.initializeDefaultPrompts();

        this.isInitialized = false;
    }

    /**
     * Initialize default prompt templates
     */
    initializeDefaultPrompts() {
        // Summarization prompts (used by NemoLore)
        this.registerPrompt('summarization_default', {
            category: 'summarization',
            name: 'Default Summarization',
            description: 'Standard summarization prompt for conversation history',
            template: `You are a summarization assistant. Summarize the given fictional narrative in a single, very short and concise statement of fact.

- Response must be in past tense
- Include character names when possible
- Maximum 200 characters
- Your response must ONLY contain the summary
- If this is a pivotal, extremely important moment, wrap your summary in <CORE_MEMORY> tags

Messages to summarize:
{{messages}}

Summary:`,
            usedBy: ['nemolore'],
            variables: ['messages']
        });

        this.registerPrompt('summarization_narrative', {
            category: 'summarization',
            name: 'Narrative Summarization',
            description: 'Optimized for narrative/story sections',
            template: `Provide a concise summary of this narrative section, highlighting main events and character actions:

{{messages}}

Summary (max 200 chars):`,
            usedBy: ['nemolore'],
            variables: ['messages']
        });

        this.registerPrompt('summarization_dialogue', {
            category: 'summarization',
            name: 'Dialogue Summarization',
            description: 'Optimized for dialogue-heavy sections',
            template: `Summarize this dialogue section, capturing the main points and emotional context:

{{messages}}

Summary (max 200 chars):`,
            usedBy: ['nemolore'],
            variables: ['messages']
        });

        // Quality analysis prompts (used by both systems)
        this.registerPrompt('quality_analysis', {
            category: 'analysis',
            name: 'Quality Analysis',
            description: 'Analyze text for quality issues and repetition',
            template: `Analyze the following text for quality issues, repetitive phrases, and "slop" patterns.

Text:
{{text}}

Provide:
1. Overall quality score (1-10)
2. Detected repetitive phrases
3. Specific improvement recommendations

Format as JSON.`,
            usedBy: ['nemolore', 'prosepolisher'],
            variables: ['text']
        });

        // Lorebook generation prompts (used by NemoLore)
        this.registerPrompt('lorebook_generation', {
            category: 'lorebook',
            name: 'Lorebook Entry Generation',
            description: 'Generate high-quality lorebook entries from core memories',
            template: `Create a comprehensive lorebook entry for the following core memory:

{{core_memory}}

Generate a well-structured entry that:
- Captures the essential information
- Uses clear, concise language
- Avoids repetitive phrases
- Maintains consistency with the narrative

Lorebook entry:`,
            usedBy: ['nemolore'],
            variables: ['core_memory']
        });

        // Pattern detection prompts (used by ProsePolisher)
        this.registerPrompt('pattern_detection', {
            category: 'analysis',
            name: 'Pattern Detection',
            description: 'Identify repetitive patterns in text',
            template: `Identify repetitive patterns in the following text:

{{text}}

Focus on:
- Repeated phrases (2-10 words)
- Overused sentence structures
- Slop phrases

Return as JSON array of patterns with frequency counts.`,
            usedBy: ['prosepolisher'],
            variables: ['text']
        });

        console.log('[Shared Prompts] ✅ Initialized with', this.prompts.size, 'default prompts');
    }

    /**
     * Register a new prompt template
     * @param {string} id - Unique prompt identifier
     * @param {Object} promptData - Prompt configuration
     */
    registerPrompt(id, promptData) {
        if (!id || !promptData.template) {
            console.warn('[Shared Prompts] Invalid prompt registration:', id);
            return false;
        }

        this.prompts.set(id, {
            id,
            category: promptData.category || 'general',
            name: promptData.name || id,
            description: promptData.description || '',
            template: promptData.template,
            usedBy: promptData.usedBy || [],
            variables: promptData.variables || [],
            created: Date.now(),
            modified: Date.now()
        });

        return true;
    }

    /**
     * Get a prompt by ID
     * @param {string} id - Prompt identifier
     * @returns {Object|null} Prompt data or null if not found
     */
    getPrompt(id) {
        return this.prompts.get(id) || null;
    }

    /**
     * Get all prompts for a specific category
     * @param {string} category - Category name
     * @returns {Array<Object>} Array of prompts
     */
    getPromptsByCategory(category) {
        const results = [];
        for (const prompt of this.prompts.values()) {
            if (prompt.category === category) {
                results.push(prompt);
            }
        }
        return results;
    }

    /**
     * Get all prompts used by a specific system
     * @param {string} system - System name ('nemolore' or 'prosepolisher')
     * @returns {Array<Object>} Array of prompts
     */
    getPromptsBySystem(system) {
        const results = [];
        for (const prompt of this.prompts.values()) {
            if (prompt.usedBy.includes(system)) {
                results.push(prompt);
            }
        }
        return results;
    }

    /**
     * Fill a prompt template with variables
     * @param {string} promptId - Prompt identifier
     * @param {Object} variables - Variable values
     * @returns {string} Filled prompt text
     */
    fillPrompt(promptId, variables = {}) {
        const prompt = this.getPrompt(promptId);
        if (!prompt) {
            console.warn('[Shared Prompts] Prompt not found:', promptId);
            return '';
        }

        let filledText = prompt.template;

        // Replace all variables in {{variable}} format
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            filledText = filledText.replace(regex, value || '');
        }

        return filledText;
    }

    /**
     * Update an existing prompt
     * @param {string} id - Prompt identifier
     * @param {Object} updates - Fields to update
     * @returns {boolean} Success status
     */
    updatePrompt(id, updates) {
        const prompt = this.prompts.get(id);
        if (!prompt) {
            console.warn('[Shared Prompts] Cannot update non-existent prompt:', id);
            return false;
        }

        // Update fields
        if (updates.template) prompt.template = updates.template;
        if (updates.name) prompt.name = updates.name;
        if (updates.description) prompt.description = updates.description;
        if (updates.category) prompt.category = updates.category;

        prompt.modified = Date.now();

        console.log('[Shared Prompts] Updated prompt:', id);
        return true;
    }

    /**
     * Delete a prompt
     * @param {string} id - Prompt identifier
     * @returns {boolean} Success status
     */
    deletePrompt(id) {
        const existed = this.prompts.delete(id);
        if (existed) {
            console.log('[Shared Prompts] Deleted prompt:', id);
        }
        return existed;
    }

    /**
     * Get all available categories
     * @returns {Array<string>} Category names
     */
    getCategories() {
        const categories = new Set();
        for (const prompt of this.prompts.values()) {
            categories.add(prompt.category);
        }
        return Array.from(categories);
    }

    /**
     * Search prompts by keyword
     * @param {string} keyword - Search term
     * @returns {Array<Object>} Matching prompts
     */
    searchPrompts(keyword) {
        const results = [];
        const lowerKeyword = keyword.toLowerCase();

        for (const prompt of this.prompts.values()) {
            if (
                prompt.name.toLowerCase().includes(lowerKeyword) ||
                prompt.description.toLowerCase().includes(lowerKeyword) ||
                prompt.template.toLowerCase().includes(lowerKeyword)
            ) {
                results.push(prompt);
            }
        }

        return results;
    }

    /**
     * Export all prompts to JSON
     * @returns {Object} Export data
     */
    export() {
        const promptsArray = Array.from(this.prompts.values());
        return {
            prompts: promptsArray,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Import prompts from JSON
     * @param {Object} data - Import data
     * @returns {number} Number of prompts imported
     */
    import(data) {
        if (!data || !data.prompts || !Array.isArray(data.prompts)) {
            console.warn('[Shared Prompts] Invalid import data');
            return 0;
        }

        let imported = 0;
        for (const promptData of data.prompts) {
            if (promptData.id && promptData.template) {
                this.registerPrompt(promptData.id, promptData);
                imported++;
            }
        }

        console.log(`[Shared Prompts] Imported ${imported} prompts`);
        return imported;
    }

    /**
     * Get statistics about the prompt library
     * @returns {Object} Statistics
     */
    getStats() {
        const stats = {
            totalPrompts: this.prompts.size,
            byCategory: {},
            bySystem: {
                nemolore: 0,
                prosepolisher: 0,
                shared: 0
            }
        };

        // Count by category
        for (const prompt of this.prompts.values()) {
            stats.byCategory[prompt.category] = (stats.byCategory[prompt.category] || 0) + 1;

            // Count by system
            if (prompt.usedBy.includes('nemolore') && prompt.usedBy.includes('prosepolisher')) {
                stats.bySystem.shared++;
            } else if (prompt.usedBy.includes('nemolore')) {
                stats.bySystem.nemolore++;
            } else if (prompt.usedBy.includes('prosepolisher')) {
                stats.bySystem.prosepolisher++;
            }
        }

        return stats;
    }
}

// Create global singleton instance
const sharedPromptsManager = new SharedPromptsManager();

// Make it available globally
if (typeof window !== 'undefined') {
    window.nemoPresetSharedPrompts = sharedPromptsManager;
}

// Export for module use
export default sharedPromptsManager;

console.log('[Shared Prompts] ✅ Module loaded - Ready for integration');
