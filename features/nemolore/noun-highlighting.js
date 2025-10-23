/**
 * Noun Highlighting System - Intelligent Noun Detection and Interactive Tooltips
 */

const PROPER_NOUN_PATTERNS = [
    /\b[A-Z][a-z]+\s+of\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
    /\b[A-Z][a-z]*[A-Z][a-z]*\b/g,
    /\b[A-Z]{2,}\b/g,
];

class NounDetector {
    constructor(settings) {
        this.settings = settings;
        this.characterNames = new Set();
        this.loadCharacterNames();
    }

    /**
     * Load character names from SillyTavern context
     */
    loadCharacterNames() {
        try {
            // Get current character name
            if (window.characters && window.this_chid !== undefined) {
                const currentChar = window.characters[window.this_chid];
                if (currentChar?.name) {
                    this.characterNames.add(currentChar.name);
                }
            }

            // Get user persona name
            if (window.name1) {
                this.characterNames.add(window.name1);
            }

            // Get names from loaded world info entries
            if (window.world_names && window.world_info) {
                for (const worldName of window.world_names) {
                    const entries = window.world_info[worldName] || [];
                    for (const entry of entries) {
                        if (entry.comment) {
                            this.characterNames.add(entry.comment);
                        }
                    }
                }
            }

            console.log('[NemoLore Noun Detector] Loaded character names:', Array.from(this.characterNames));
        } catch (error) {
            console.warn('[NemoLore Noun Detector] Failed to load character names:', error);
        }
    }

    detectNouns(text) {
        const nouns = new Set();
        const cleanText = text.replace(/[*_`~]/g, '');

        // First, add known character names that appear in the text
        for (const name of this.characterNames) {
            const nameRegex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            if (nameRegex.test(cleanText)) {
                nouns.add(name);
            }
        }

        // Then detect other proper nouns
        for (const pattern of PROPER_NOUN_PATTERNS) {
            const matches = cleanText.match(pattern) || [];
            for (let match of matches) {
                if (this.isValidNoun(match, cleanText)) {
                    nouns.add(match.trim());
                }
            }
        }
        return this.filterCompoundNouns(Array.from(nouns));
    }

    isValidNoun(noun, fullText) {
        // Expanded list of common sentence-starting words to exclude
        const commonWords = [
            'The', 'This', 'That', 'These', 'Those',
            'A', 'An',
            'Is', 'Was', 'Were', 'Are', 'Be', 'Been', 'Being',
            'He', 'She', 'It', 'They', 'We', 'You', 'I',
            'His', 'Her', 'Its', 'Their', 'Our', 'Your', 'My',
            'But', 'And', 'Or', 'So', 'Yet', 'For', 'Nor',
            'If', 'When', 'Where', 'While', 'Since', 'Because',
            'As', 'At', 'By', 'In', 'On', 'To', 'From', 'With'
        ];

        const trimmedNoun = noun.trim();

        // Basic validation
        if (!trimmedNoun || trimmedNoun.length < 3) return false;

        // Exclude common words
        if (commonWords.includes(trimmedNoun)) return false;

        // Check if this is a sentence-starting word (exclude if it appears at sentence start)
        const sentenceStartPattern = new RegExp(`[.!?]\\s+"?${trimmedNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
        const textStartPattern = new RegExp(`^"?${trimmedNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);

        // If word only appears at sentence starts, it's likely a common word, not a proper noun
        if (sentenceStartPattern.test(fullText) || textStartPattern.test(fullText.trim())) {
            // Check if it also appears mid-sentence
            const midSentencePattern = new RegExp(`[^.!?]\\s+${trimmedNoun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            if (!midSentencePattern.test(fullText)) {
                return false; // Only at sentence start, exclude it
            }
        }

        return true;
    }

    /**
     * Filter compound nouns to prevent duplicate highlights
     * - Removes individual words that are part of longer compound nouns
     * - Removes case duplicates (prefers the version with more capitals)
     */
    filterCompoundNouns(nouns) {
        const filtered = [];
        const seenLowercase = new Map(); // Track nouns by lowercase version

        // Sort by length (longest first) to prioritize compound nouns
        const sortedNouns = [...nouns].sort((a, b) => b.length - a.length);

        for (const noun of sortedNouns) {
            const lowerNoun = noun.toLowerCase();

            // Check if we already have this noun in a different case
            if (seenLowercase.has(lowerNoun)) {
                // Keep the version with more capital letters (more specific)
                const existing = seenLowercase.get(lowerNoun);
                const existingCaps = (existing.match(/[A-Z]/g) || []).length;
                const currentCaps = (noun.match(/[A-Z]/g) || []).length;

                if (currentCaps > existingCaps) {
                    // Replace with more capitalized version
                    const index = filtered.indexOf(existing);
                    if (index !== -1) {
                        filtered[index] = noun;
                        seenLowercase.set(lowerNoun, noun);
                    }
                }
                continue;
            }

            // Check if this noun is part of a longer compound noun
            const isPartOfLonger = filtered.some(longer =>
                longer !== noun && longer.includes(noun) && longer.split(/\s+/).includes(noun)
            );

            if (!isPartOfLonger) {
                filtered.push(noun);
                seenLowercase.set(lowerNoun, noun);
            }
        }

        return filtered;
    }

    highlightNounsInElement(element, nouns) {
        if (!this.settings.highlightNouns || !nouns.length || element.hasAttribute('data-nemolore-processed')) {
            return;
        }

        let html = element.innerHTML;
        const sortedNouns = [...nouns].sort((a, b) => b.length - a.length);

        let replacementCount = 0;
        sortedNouns.forEach(noun => {
            const escapedNoun = noun.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b(${escapedNoun})\\b`, 'g');
            const beforeLength = html.length;
            html = html.replace(regex, `<span class="nemolore-highlighted-noun" data-noun="$1">$1</span>`);
            const afterLength = html.length;
            if (afterLength !== beforeLength) {
                replacementCount++;
            }
        });

        element.innerHTML = html;
        element.setAttribute('data-nemolore-processed', 'true');

        if (replacementCount > 0) {
            console.log(`[NemoLore Noun Highlighting] Highlighted ${replacementCount} nouns in element`);
        }
    }
}

class TooltipManager {
    constructor() {
        this.currentTooltip = null;
        this.hideTimeout = null;
        this.currentConfirmPopup = null;
    }

    showTooltip(element, noun) {
        // Cancel any pending hide
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        // If same tooltip, don't recreate
        if (this.currentTooltip && this.currentTooltip.dataset.noun === noun) {
            return;
        }

        this.hideTooltip();
        const rect = element.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'nemolore-tooltip';
        tooltip.dataset.noun = noun; // Track which noun this tooltip is for

        // Try to find lorebook entry first
        const lorebookEntry = this.findLorebookEntry(noun);

        // Try to find relevant summary from memory manager
        const summary = this.findRelevantSummary(noun);

        if (lorebookEntry) {
            // Show lorebook entry
            tooltip.innerHTML = `
                <div class="nemolore-tooltip-title">${lorebookEntry.title}</div>
                <div class="nemolore-tooltip-content">${this.truncateText(lorebookEntry.content)}</div>
                <div class="nemolore-tooltip-action">💡 Click to update or expand entry</div>
            `;
        } else if (summary) {
            // Show summary
            tooltip.innerHTML = `
                <div class="nemolore-tooltip-title">${noun}</div>
                <div class="nemolore-tooltip-content">${summary}</div>
                <div class="nemolore-tooltip-action">💡 Click to create lorebook entry from this summary</div>
            `;
        } else {
            // No entry or summary found
            tooltip.innerHTML = `
                <div class="nemolore-tooltip-title">${noun}</div>
                <div class="nemolore-tooltip-no-entry">No lorebook entry found</div>
                <div class="nemolore-tooltip-action">✨ Click to generate AI-powered entry</div>
            `;
        }

        document.body.appendChild(tooltip);
        this.positionTooltip(tooltip, rect);
        this.currentTooltip = tooltip;

        setTimeout(() => tooltip.classList.add('show'), 10);
    }

    scheduleHide() {
        // Cancel any existing timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }

        // Schedule hide with a small delay to prevent flickering
        this.hideTimeout = setTimeout(() => {
            this.hideTooltip();
        }, 100);
    }

    hideTooltip() {
        // Cancel any pending hide
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }

        if (this.currentTooltip) {
            this.currentTooltip.classList.remove('show');
            const tooltipToRemove = this.currentTooltip;
            setTimeout(() => {
                if (tooltipToRemove && tooltipToRemove.parentNode) {
                    tooltipToRemove.remove();
                }
            }, 200);
            this.currentTooltip = null;
        }
    }

    positionTooltip(tooltip, rect) {
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    }

    findLorebookEntry(noun) {
        const lowerNoun = noun.toLowerCase();
        if (!window.world_names || !window.world_info) return null;

        for (const worldName of window.world_names) {
            const entries = window.world_info[worldName] || [];
            for (const entry of entries) {
                const keys = (entry.key || []).map(k => k.toLowerCase());
                if (entry.comment?.toLowerCase() === lowerNoun || keys.includes(lowerNoun)) {
                    return { title: entry.comment, content: entry.content };
                }
            }
        }
        return null;
    }

    /**
     * Find relevant summary from memory manager that mentions this noun
     */
    findRelevantSummary(noun) {
        try {
            const memoryManager = window.nemoLoreWorkflowState?.memoryManager;
            if (!memoryManager) return null;

            const context = window.getContext?.() || {};
            if (!context.chat) return null;

            const lowerNoun = noun.toLowerCase();

            // Search through chat messages for summaries mentioning this noun
            for (const message of context.chat) {
                const summary = memoryManager.getMemoryData(message, 'memory');
                const isMarker = memoryManager.getMemoryData(message, 'isMarker');

                if (summary && !isMarker && summary.toLowerCase().includes(lowerNoun)) {
                    return summary;
                }
            }

            return null;
        } catch (error) {
            console.warn('[NemoLore Tooltip] Failed to find relevant summary:', error);
            return null;
        }
    }

    truncateText(text, sentences = 2) {
        if (!text) return '';
        const sentenceArray = text.split(/[.!?]+/).filter(s => s.trim());
        if (sentenceArray.length <= sentences) return text;
        return sentenceArray.slice(0, sentences).join('. ') + '...';
    }

    /**
     * Show a custom confirmation popup near the element
     * Returns a promise that resolves to true/false based on user choice
     */
    showConfirmPopup(element, noun, existingEntry = false) {
        return new Promise((resolve) => {
            // Hide any existing popup or tooltip
            this.hideConfirmPopup();
            this.hideTooltip();

            const rect = element.getBoundingClientRect();
            const popup = document.createElement('div');
            popup.className = 'nemolore-confirm-popup';

            const message = existingEntry
                ? `Lorebook entry for <strong>"${noun}"</strong> already exists.`
                : `Generate AI-powered lorebook entry for <strong>"${noun}"</strong>?`;

            const actionText = existingEntry ? 'Regenerate with AI?' : 'This will use AI to create a lorebook entry.';

            popup.innerHTML = `
                <div class="nemolore-confirm-title">${message}</div>
                <div class="nemolore-confirm-subtitle">${actionText}</div>
                <div class="nemolore-confirm-buttons">
                    <button class="nemolore-confirm-btn nemolore-confirm-yes">✨ Generate</button>
                    <button class="nemolore-confirm-btn nemolore-confirm-no">Cancel</button>
                </div>
            `;

            document.body.appendChild(popup);
            this.positionTooltip(popup, rect); // Reuse positioning logic
            this.currentConfirmPopup = popup;

            // Add event listeners to buttons
            const yesBtn = popup.querySelector('.nemolore-confirm-yes');
            const noBtn = popup.querySelector('.nemolore-confirm-no');

            yesBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideConfirmPopup();
                resolve(true);
            });

            noBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideConfirmPopup();
                resolve(false);
            });

            // Show popup with animation
            setTimeout(() => popup.classList.add('show'), 10);

            // Hide on click outside
            const outsideClickHandler = (e) => {
                if (!popup.contains(e.target) && !element.contains(e.target)) {
                    this.hideConfirmPopup();
                    resolve(false);
                    document.removeEventListener('click', outsideClickHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', outsideClickHandler), 100);
        });
    }

    /**
     * Show a status/notification popup
     */
    showStatusPopup(element, message, type = 'info') {
        this.hideConfirmPopup();
        this.hideTooltip();

        const rect = element.getBoundingClientRect();
        const popup = document.createElement('div');
        popup.className = `nemolore-status-popup nemolore-status-${type}`;

        const icon = type === 'loading' ? '🤖' : type === 'success' ? '✅' : '❌';

        popup.innerHTML = `
            <div class="nemolore-status-icon">${icon}</div>
            <div class="nemolore-status-message">${message}</div>
        `;

        document.body.appendChild(popup);
        this.positionTooltip(popup, rect);
        this.currentConfirmPopup = popup;

        setTimeout(() => popup.classList.add('show'), 10);

        // Auto-hide after 3 seconds unless it's loading
        if (type !== 'loading') {
            setTimeout(() => this.hideConfirmPopup(), 3000);
        }
    }

    hideConfirmPopup() {
        if (this.currentConfirmPopup) {
            this.currentConfirmPopup.classList.remove('show');
            const popupToRemove = this.currentConfirmPopup;
            setTimeout(() => {
                if (popupToRemove && popupToRemove.parentNode) {
                    popupToRemove.remove();
                }
            }, 200);
            this.currentConfirmPopup = null;
        }
    }
}

export class NounHighlightingManager {
    constructor(settings, state) {
        this.settings = settings;
        this.state = state;
        this.nounDetector = new NounDetector(settings);
        this.tooltipManager = new TooltipManager();
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;
        this.setupEventListeners();
        this.addStyles();
        this.isInitialized = true;
        console.log('[NemoLore Noun Highlighting] System initialized');
    }

    setupEventListeners() {
        console.log('[NemoLore Noun Highlighting] Setting up event listeners...');

        document.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('nemolore-highlighted-noun')) {
                this.tooltipManager.showTooltip(e.target, e.target.dataset.noun);
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.classList.contains('nemolore-highlighted-noun')) {
                // Use a small delay to prevent flickering when moving between elements
                this.tooltipManager.scheduleHide();
            }
        });

        // Use event delegation with capturing to ensure we catch the click
        document.addEventListener('click', (e) => {
            // Check if the target or any parent has the class (for nested elements)
            const nounElement = e.target.closest('.nemolore-highlighted-noun');
            if (nounElement) {
                console.log('[NemoLore Noun Highlighting] Click detected on noun:', nounElement.dataset.noun);
                // Prevent default and stop propagation to ensure we handle this
                e.preventDefault();
                e.stopPropagation();
                // Immediately hide tooltip when clicking
                this.tooltipManager.hideTooltip();
                this.handleNounClick(nounElement.dataset.noun, nounElement);
            } else {
                // Hide tooltip when clicking anywhere else
                this.tooltipManager.hideTooltip();
                this.tooltipManager.hideConfirmPopup();
            }
        }, true); // Use capture phase

        // Hide tooltip and popups when scrolling
        document.addEventListener('scroll', () => {
            this.tooltipManager.hideTooltip();
            this.tooltipManager.hideConfirmPopup();
        }, true);

        console.log('[NemoLore Noun Highlighting] ✅ Event listeners attached');
    }

    async handleNounClick(noun, element) {
        console.log('[NemoLore Noun Highlighting] handleNounClick called for:', noun);
        try {
            // Get managers
            console.log('[NemoLore Noun Highlighting] Checking for nemoLoreWorkflowState...');
            console.log('[NemoLore Noun Highlighting] window.nemoLoreWorkflowState exists?', !!window.nemoLoreWorkflowState);

            const autoLorebookManager = window.nemoLoreWorkflowState?.autoLorebookManager;
            const memoryManager = window.nemoLoreWorkflowState?.memoryManager;

            console.log('[NemoLore Noun Highlighting] autoLorebookManager exists?', !!autoLorebookManager);
            console.log('[NemoLore Noun Highlighting] memoryManager exists?', !!memoryManager);

            if (!autoLorebookManager) {
                console.error('[NemoLore Noun Highlighting] Auto-Lorebook system not initialized!');
                this.tooltipManager.showStatusPopup(element, 'Auto-Lorebook system not initialized.', 'error');
                return;
            }

            console.log('[NemoLore Noun Highlighting] ✅ Managers loaded, proceeding with lorebook creation...');

            // Check if entry already exists
            const existingEntry = this.tooltipManager.findLorebookEntry(noun);

            // Show custom confirmation popup
            const confirmed = await this.tooltipManager.showConfirmPopup(element, noun, !!existingEntry);
            if (!confirmed) return;

            // Get the current lorebook name from chat metadata or state
            let lorebookName = null;

            // First, try to get from chat metadata
            if (window.chat_metadata?.world_info) {
                lorebookName = window.chat_metadata.world_info;
                console.log('[NemoLore Noun Highlighting] Using lorebook from chat_metadata:', lorebookName);
            }
            // Second, try from state
            else if (autoLorebookManager.state?.currentChatLorebook && window.world_names?.includes(autoLorebookManager.state.currentChatLorebook)) {
                lorebookName = autoLorebookManager.state.currentChatLorebook;
                console.log('[NemoLore Noun Highlighting] Using lorebook from state:', lorebookName);
            }
            // Last resort: try to get or create one
            else {
                lorebookName = await autoLorebookManager.getCurrentLorebookName();
                console.log('[NemoLore Noun Highlighting] Got/created lorebook:', lorebookName);
            }

            if (!lorebookName) {
                this.tooltipManager.showStatusPopup(element, 'Could not get or create lorebook.', 'error');
                return;
            }

            console.log('[NemoLore Noun Highlighting] Using lorebook:', lorebookName);

            // Show loading status
            this.tooltipManager.showStatusPopup(element, `Generating AI-powered entry for "${noun}"...`, 'loading');

            // Gather comprehensive context for AI generation
            const context = window.getContext?.() || {};
            let contextSections = [];

            // Get character information
            const character = window.characters?.[window.this_chid];
            const characterName = character?.name || 'the character';
            const userName = window.name1 || 'the user';

            // 1. Character Card Information
            if (character) {
                contextSections.push(`=== CHARACTER CARD ===
Name: ${character.name}
Description: ${character.description || 'N/A'}
Personality: ${character.personality || 'N/A'}
Scenario: ${character.scenario || 'N/A'}
First Message: ${character.first_mes || 'N/A'}`);
            }

            // 2. Existing Lorebook Entries
            if (window.world_info && lorebookName && window.world_info[lorebookName]) {
                const entries = window.world_info[lorebookName].entries || [];
                if (entries.length > 0) {
                    const lorebookContext = entries
                        .filter(entry => entry.comment && entry.content)
                        .slice(0, 10) // Limit to 10 entries to avoid token overflow
                        .map(entry => `${entry.comment}: ${entry.content}`)
                        .join('\n');

                    if (lorebookContext) {
                        contextSections.push(`=== EXISTING LOREBOOK ===
${lorebookContext}`);
                    }
                }
            }

            // 3. Memory/Summary Context
            const relevantSummary = this.tooltipManager.findRelevantSummary(noun);
            if (relevantSummary) {
                contextSections.push(`=== MEMORY SUMMARY ===
${relevantSummary}`);
            }

            // 4. Recent Chat History (last 20 messages)
            if (context.chat && context.chat.length > 0) {
                const recentMessages = context.chat.slice(-20);
                const chatHistory = recentMessages
                    .map(msg => {
                        const speaker = msg.is_user ? userName : characterName;
                        const cleanedMessage = msg.mes?.replace(/[*_`~]/g, '').trim() || '';
                        return `${speaker}: ${cleanedMessage}`;
                    })
                    .join('\n');

                contextSections.push(`=== RECENT CHAT HISTORY ===
${chatHistory}`);
            }

            // 5. Specific mentions of the noun (highlighted)
            if (context.chat) {
                const mentions = [];
                for (let i = context.chat.length - 1; i >= 0 && mentions.length < 5; i--) {
                    const message = context.chat[i];
                    if (message.mes && message.mes.toLowerCase().includes(noun.toLowerCase())) {
                        const speaker = message.is_user ? userName : characterName;
                        const cleanedMessage = message.mes.replace(/[*_`~]/g, '').trim();
                        mentions.push(`${speaker}: "${cleanedMessage}"`);
                    }
                }
                if (mentions.length > 0) {
                    contextSections.push(`=== SPECIFIC MENTIONS OF "${noun}" ===
${mentions.join('\n')}`);
                }
            }

            const fullContext = contextSections.join('\n\n');

            // Generate AI-powered lorebook entry using APIManager
            const prompt = `You are creating a lorebook entry for a roleplay conversation between ${userName} and ${characterName}.

Based on ALL of the following context, create a concise lorebook entry for "${noun}". The entry should be 2-3 sentences maximum, written in past tense, and capture key information about this entity as it exists in THIS SPECIFIC STORY.

${fullContext}

Write ONLY the lorebook entry content (no labels, prefixes, or commentary):`;

            console.log('[NemoLore Noun Highlighting] Full context length:', fullContext.length);
            console.log('[NemoLore Noun Highlighting] Context sections:', contextSections.length);

            console.log('[NemoLore Noun Highlighting] Prompt for AI:', prompt);

            let generatedContent = '';
            try {
                // Use the APIManager from the workflow state (same as AutoLorebookManager)
                const apiManager = window.nemoLoreWorkflowState?.apiManager;

                if (!apiManager) {
                    console.warn('[NemoLore Noun Highlighting] APIManager not available, using fallback');
                    generatedContent = relevantSummary || `Information about ${noun}. (Add details here)`;
                } else {
                    console.log('[NemoLore Noun Highlighting] Using APIManager for AI generation...');
                    const response = await apiManager.generateLorebookEntries(prompt, autoLorebookManager.settings);
                    // Clean up the response (remove common prefixes)
                    generatedContent = response.content
                        .replace(/^(Entry:|Lorebook entry:|Here's the lorebook entry:)/i, '')
                        .replace(/^[^\w]*/, '')
                        .trim();
                    console.log('[NemoLore Noun Highlighting] AI generation result:', generatedContent);
                    console.log('[NemoLore Noun Highlighting] AI generation length:', generatedContent?.length || 0);
                }
            } catch (error) {
                console.warn('[NemoLore Noun Highlighting] AI generation failed, using template:', error);
                generatedContent = relevantSummary || `Information about ${noun}. (Add details here)`;
            }

            // Fallback to template if AI generation failed
            if (!generatedContent || generatedContent.trim().length === 0) {
                console.log('[NemoLore Noun Highlighting] Using fallback content');
                generatedContent = relevantSummary || `Information about ${noun}. (Add details here)`;
            } else {
                console.log('[NemoLore Noun Highlighting] ✅ Using AI-generated content');
            }

            // Create the entry
            const entry = {
                title: noun,
                keywords: noun,
                content: generatedContent.trim()
            };

            const success = await autoLorebookManager.createLorebookEntry(lorebookName, entry);

            if (success) {
                console.log(`[NemoLore Noun Highlighting] ✅ Created lorebook entry for: ${noun}`);
                const preview = generatedContent.length > 80
                    ? generatedContent.substring(0, 80) + '...'
                    : generatedContent;
                this.tooltipManager.showStatusPopup(
                    element,
                    `Entry created for "${noun}"<br><small>${preview}</small>`,
                    'success'
                );
            } else {
                throw new Error('Failed to create entry');
            }
        } catch (error) {
            console.error('[NemoLore Noun Highlighting] Error creating lorebook entry:', error);
            this.tooltipManager.showStatusPopup(element, `Failed to create entry for "${noun}". Check console.`, 'error');
        }
    }

    processNewMessage(messageElement) {
        if (!this.settings.highlightNouns) return;
        const textContent = messageElement.querySelector('.mes_text');
        if (textContent) {
            const nouns = this.nounDetector.detectNouns(textContent.textContent);
            this.nounDetector.highlightNounsInElement(textContent, nouns);
        }
    }

    refreshChatHighlighting() {
        if (!this.settings.highlightNouns) return;

        // Clear existing highlights first
        this.clearAllHighlighting();

        // Re-process all messages
        document.querySelectorAll('#chat .mes_text').forEach(el => {
            const nouns = this.nounDetector.detectNouns(el.textContent);
            this.nounDetector.highlightNounsInElement(el, nouns);
        });

        console.log('[NemoLore Noun Highlighting] ✅ Chat highlighting refreshed');
    }
    
    clearAllHighlighting() {
        document.querySelectorAll('.nemolore-highlighted-noun').forEach(el => {
            el.outerHTML = el.innerHTML;
        });
        document.querySelectorAll('#chat .mes_text').forEach(el => {
            el.removeAttribute('data-nemolore-processed');
        });
    }

    addStyles() {
        const styleId = 'nemolore-noun-highlighting-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .nemolore-highlighted-noun {
                outline: 2px solid rgba(59, 130, 246, 0.6);
                outline-offset: 2px;
                border-radius: 3px;
                cursor: pointer;
                transition: outline-color 0.2s;
            }
            .nemolore-highlighted-noun:hover {
                outline-color: rgba(59, 130, 246, 1);
                outline-width: 2px;
            }
            .nemolore-tooltip {
                position: absolute;
                z-index: 10000;
                background: #1f2937;
                color: #f3f4f6;
                padding: 12px;
                border-radius: 8px;
                font-size: 0.9em;
                max-width: 350px;
                opacity: 0;
                transition: opacity 0.2s;
                pointer-events: none;
                border: 1px solid rgba(59, 130, 246, 0.5);
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
            }
            .nemolore-tooltip.show { opacity: 1; }
            .nemolore-tooltip-title {
                font-weight: bold;
                color: #60a5fa;
                margin-bottom: 6px;
            }
            .nemolore-tooltip-content {
                color: #d1d5db;
                line-height: 1.4;
            }
            .nemolore-tooltip-no-entry {
                font-style: italic;
                color: #9ca3af;
            }
            .nemolore-tooltip-action {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(59, 130, 246, 0.3);
                color: #60a5fa;
                font-size: 0.85em;
            }

            /* Custom Confirmation Popup */
            .nemolore-confirm-popup {
                position: absolute;
                z-index: 10001;
                background: #1f2937;
                color: #f3f4f6;
                padding: 16px;
                border-radius: 8px;
                font-size: 0.9em;
                max-width: 350px;
                opacity: 0;
                transition: opacity 0.2s, transform 0.2s;
                pointer-events: auto;
                border: 1px solid rgba(59, 130, 246, 0.5);
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
                transform: translateY(-5px);
            }
            .nemolore-confirm-popup.show {
                opacity: 1;
                transform: translateY(0);
            }
            .nemolore-confirm-title {
                font-weight: bold;
                color: #60a5fa;
                margin-bottom: 8px;
                font-size: 1em;
            }
            .nemolore-confirm-subtitle {
                color: #d1d5db;
                margin-bottom: 12px;
                font-size: 0.9em;
            }
            .nemolore-confirm-buttons {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            .nemolore-confirm-btn {
                padding: 6px 14px;
                border-radius: 4px;
                border: none;
                font-size: 0.9em;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: 500;
            }
            .nemolore-confirm-yes {
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
            }
            .nemolore-confirm-yes:hover {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
            }
            .nemolore-confirm-no {
                background: #374151;
                color: #d1d5db;
            }
            .nemolore-confirm-no:hover {
                background: #4b5563;
            }

            /* Status Popup */
            .nemolore-status-popup {
                position: absolute;
                z-index: 10001;
                background: #1f2937;
                color: #f3f4f6;
                padding: 14px 16px;
                border-radius: 8px;
                font-size: 0.9em;
                max-width: 350px;
                opacity: 0;
                transition: opacity 0.2s, transform 0.2s;
                pointer-events: none;
                border: 1px solid rgba(59, 130, 246, 0.5);
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
                transform: translateY(-5px);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .nemolore-status-popup.show {
                opacity: 1;
                transform: translateY(0);
            }
            .nemolore-status-icon {
                font-size: 1.3em;
                flex-shrink: 0;
            }
            .nemolore-status-message {
                color: #d1d5db;
                line-height: 1.4;
                flex: 1;
            }
            .nemolore-status-message small {
                display: block;
                margin-top: 4px;
                font-size: 0.85em;
                color: #9ca3af;
            }
            .nemolore-status-loading {
                border-color: rgba(59, 130, 246, 0.7);
            }
            .nemolore-status-loading .nemolore-status-icon {
                animation: nemolore-pulse 1.5s ease-in-out infinite;
            }
            .nemolore-status-success {
                border-color: rgba(34, 197, 94, 0.5);
            }
            .nemolore-status-error {
                border-color: rgba(239, 68, 68, 0.5);
            }
            @keyframes nemolore-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }
}

console.log('[NemoLore Noun Highlighting] Module loaded');