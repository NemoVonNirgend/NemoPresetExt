/**
 * Nemo Directive Advanced Features
 * Implements UI and behavior for all advanced directive features
 *
 * @module directive-features
 */

import logger from '../../core/logger.js';
import { getAllPromptsWithState, parsePromptDirectives } from './prompt-directives.js';
import { promptManager } from '../../../../../openai.js';
import { getContext } from '../../../../../extensions.js';

/**
 * Initialize all directive-based features
 */
export function initDirectiveFeatures() {
    logger.info('Initializing advanced directive features');

    // Apply default-enabled prompts on first use
    applyDefaultEnabled();

    // Setup tag filtering UI
    setupTagFilter();

    // Setup group collapsing
    setupGroupCollapse();

    // Setup token cost tracker
    setupTokenCostTracker();

    // Setup profile system
    setupProfileSystem();

    // Setup help panel
    setupHelpPanel();

    // Apply visual customizations
    applyVisualCustomizations();

    // Setup mutual exclusive groups
    setupMutualExclusiveGroups();

    // Apply conditional visibility
    applyConditionalVisibility();

    logger.info('Advanced directive features initialized');
}

/**
 * Apply default-enabled prompts on first use
 */
function applyDefaultEnabled() {
    try {
        const hasAppliedDefaults = localStorage.getItem('nemo_applied_defaults');
        if (hasAppliedDefaults) {
            return; // Already applied
        }

        const allPrompts = getAllPromptsWithState();
        let appliedCount = 0;

        for (const prompt of allPrompts) {
            if (!prompt.content) continue;

            const directives = parsePromptDirectives(prompt.content);
            if (directives.defaultEnabled && !prompt.enabled) {
                // Enable this prompt
                const promptOrderEntry = promptManager.getPromptOrderEntry(promptManager.activeCharacter, prompt.identifier);
                if (promptOrderEntry) {
                    promptOrderEntry.enabled = true;
                    appliedCount++;
                }
            }
        }

        if (appliedCount > 0) {
            promptManager.render();
            promptManager.saveServiceSettings();
            logger.info(`Applied default-enabled to ${appliedCount} prompts`);
        }

        localStorage.setItem('nemo_applied_defaults', 'true');
    } catch (error) {
        logger.error('Error applying default-enabled prompts:', error);
    }
}

/**
 * Setup tag filtering UI
 */
function setupTagFilter() {
    try {
        // Find the prompt manager container
        const promptContainer = document.querySelector('#completion_prompt_manager_list');
        if (!promptContainer) {
            logger.warn('Prompt container not found, will retry');
            setTimeout(setupTagFilter, 1000);
            return;
        }

        // Check if already setup
        if (document.querySelector('.nemo-tag-filter')) {
            return;
        }

        // Create filter UI
        const filterContainer = document.createElement('div');
        filterContainer.className = 'nemo-tag-filter';
        filterContainer.innerHTML = `
            <input type="text"
                   id="nemo-tag-search"
                   placeholder="🔍 Search prompts by name, tag, or description..."
                   class="nemo-search-input">
            <div class="nemo-tag-list" id="nemo-tag-list"></div>
            <div class="nemo-filter-stats" id="nemo-filter-stats"></div>
        `;

        // Insert before prompt list
        promptContainer.parentNode.insertBefore(filterContainer, promptContainer);

        // Setup search handler
        const searchInput = document.getElementById('nemo-tag-search');
        searchInput.addEventListener('input', handleTagSearch);

        // Build tag list
        updateTagList();

        logger.info('Tag filter UI setup complete');
    } catch (error) {
        logger.error('Error setting up tag filter:', error);
    }
}

/**
 * Handle tag search input
 */
function handleTagSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    const allPrompts = getAllPromptsWithState();
    let visibleCount = 0;
    let totalCount = 0;

    // Get all prompt elements
    const promptElements = document.querySelectorAll('.completion_prompt_manager_prompt[data-pm-identifier]');

    promptElements.forEach(element => {
        const identifier = element.getAttribute('data-pm-identifier');
        const prompt = allPrompts.find(p => p.identifier === identifier);

        if (!prompt) {
            element.style.display = 'none';
            return;
        }

        totalCount++;

        if (!searchTerm) {
            element.style.display = '';
            visibleCount++;
            return;
        }

        // Parse directives
        const directives = parsePromptDirectives(prompt.content || '');

        // Search in name, tags, tooltip, help
        const searchableText = [
            prompt.name,
            ...directives.tags,
            directives.tooltip || '',
            directives.help || '',
            ...directives.categories
        ].join(' ').toLowerCase();

        if (searchableText.includes(searchTerm)) {
            element.style.display = '';
            visibleCount++;
        } else {
            element.style.display = 'none';
        }
    });

    // Update stats
    const statsElement = document.getElementById('nemo-filter-stats');
    if (statsElement) {
        if (searchTerm) {
            statsElement.textContent = `Showing ${visibleCount} of ${totalCount} prompts`;
            statsElement.style.display = 'block';
        } else {
            statsElement.style.display = 'none';
        }
    }
}

/**
 * Update the tag list UI
 */
function updateTagList() {
    try {
        const tagListContainer = document.getElementById('nemo-tag-list');
        if (!tagListContainer) return;

        const allPrompts = getAllPromptsWithState();
        const tagCounts = {};

        // Count tag occurrences
        for (const prompt of allPrompts) {
            if (!prompt.content) continue;
            const directives = parsePromptDirectives(prompt.content);

            for (const tag of directives.tags) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
        }

        // Sort tags by frequency
        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20); // Top 20 tags

        if (sortedTags.length === 0) {
            tagListContainer.style.display = 'none';
            return;
        }

        // Build tag buttons
        tagListContainer.innerHTML = sortedTags.map(([tag, count]) => `
            <button class="nemo-tag-button" data-tag="${escapeHtml(tag)}">
                ${escapeHtml(tag)} <span class="tag-count">${count}</span>
            </button>
        `).join('');

        tagListContainer.style.display = 'flex';

        // Add click handlers
        tagListContainer.querySelectorAll('.nemo-tag-button').forEach(button => {
            button.addEventListener('click', () => {
                const tag = button.getAttribute('data-tag');
                const searchInput = document.getElementById('nemo-tag-search');
                if (searchInput) {
                    searchInput.value = tag;
                    searchInput.dispatchEvent(new Event('input'));
                }
            });
        });
    } catch (error) {
        logger.error('Error updating tag list:', error);
    }
}

/**
 * Setup group collapsing
 */
function setupGroupCollapse() {
    try {
        const allPrompts = getAllPromptsWithState();
        const groups = {};

        // Organize prompts by group
        for (const prompt of allPrompts) {
            if (!prompt.content) continue;
            const directives = parsePromptDirectives(prompt.content);

            if (directives.group) {
                if (!groups[directives.group]) {
                    groups[directives.group] = {
                        name: directives.group,
                        description: directives.groupDescription,
                        prompts: []
                    };
                }
                groups[directives.group].prompts.push(prompt);
            }
        }

        // Apply grouping to UI
        for (const [groupName, groupData] of Object.entries(groups)) {
            applyGroupToUI(groupName, groupData);
        }

        logger.info(`Setup ${Object.keys(groups).length} collapsible groups`);
    } catch (error) {
        logger.error('Error setting up group collapse:', error);
    }
}

/**
 * Apply a group to the UI
 */
function applyGroupToUI(groupName, groupData) {
    try {
        const promptElements = document.querySelectorAll('.completion_prompt_manager_prompt[data-pm-identifier]');
        const groupElements = [];

        // Find all elements in this group
        for (const element of promptElements) {
            const identifier = element.getAttribute('data-pm-identifier');
            if (groupData.prompts.find(p => p.identifier === identifier)) {
                groupElements.push(element);
            }
        }

        if (groupElements.length === 0) return;

        // Create group header
        const groupHeader = document.createElement('div');
        groupHeader.className = 'nemo-group-header';
        groupHeader.innerHTML = `
            <button class="nemo-group-toggle" data-group="${escapeHtml(groupName)}">
                <span class="nemo-group-icon">▼</span>
                <span class="nemo-group-name">${escapeHtml(groupName)}</span>
                <span class="nemo-group-count">(${groupElements.length})</span>
            </button>
            ${groupData.description ? `<div class="nemo-group-description">${escapeHtml(groupData.description)}</div>` : ''}
        `;

        // Insert header before first element
        groupElements[0].parentNode.insertBefore(groupHeader, groupElements[0]);

        // Create group container
        const groupContainer = document.createElement('div');
        groupContainer.className = 'nemo-group-container';
        groupContainer.dataset.group = groupName;

        // Move elements into container
        groupElements.forEach(el => {
            groupContainer.appendChild(el);
        });

        // Insert container after header
        groupHeader.parentNode.insertBefore(groupContainer, groupHeader.nextSibling);

        // Setup toggle handler
        const toggleButton = groupHeader.querySelector('.nemo-group-toggle');
        toggleButton.addEventListener('click', () => {
            const isCollapsed = groupContainer.classList.toggle('collapsed');
            const icon = groupHeader.querySelector('.nemo-group-icon');
            icon.textContent = isCollapsed ? '▶' : '▼';

            // Save state
            localStorage.setItem(`nemo_group_${groupName}`, isCollapsed ? 'collapsed' : 'expanded');
        });

        // Restore saved state
        const savedState = localStorage.getItem(`nemo_group_${groupName}`);
        if (savedState === 'collapsed') {
            groupContainer.classList.add('collapsed');
            groupHeader.querySelector('.nemo-group-icon').textContent = '▶';
        }
    } catch (error) {
        logger.error('Error applying group to UI:', error);
    }
}

/**
 * Setup token cost tracker
 */
function setupTokenCostTracker() {
    try {
        // Find prompt manager
        const promptManagerPopup = document.querySelector('#completion_prompt_manager_popup');
        if (!promptManagerPopup) {
            setTimeout(setupTokenCostTracker, 1000);
            return;
        }

        // Check if already setup
        if (document.querySelector('.nemo-token-tracker')) {
            return;
        }

        // Create tracker UI
        const trackerContainer = document.createElement('div');
        trackerContainer.className = 'nemo-token-tracker';
        trackerContainer.innerHTML = `
            <div class="nemo-token-display">
                <span class="nemo-token-label">Estimated Token Cost:</span>
                <span class="nemo-token-value" id="nemo-token-value">0</span>
                <span class="nemo-token-warn" id="nemo-token-warn"></span>
            </div>
            <div class="nemo-token-bar">
                <div class="nemo-token-fill" id="nemo-token-fill"></div>
            </div>
        `;

        // Insert at top of prompt manager
        const listContainer = promptManagerPopup.querySelector('#completion_prompt_manager_list');
        if (!listContainer) {
            logger.warn('Token cost tracker: list container not found');
            return;
        }

        listContainer.parentNode.insertBefore(trackerContainer, listContainer);

        // Update immediately
        updateTokenCostTracker();

        // Setup observer to update when prompts change
        const observer = new MutationObserver(() => {
            updateTokenCostTracker();
        });

        observer.observe(listContainer, { childList: true, subtree: true, attributes: true });

        logger.info('Token cost tracker setup complete');
    } catch (error) {
        logger.error('Error setting up token cost tracker:', error);
    }
}

/**
 * Update token cost tracker
 */
function updateTokenCostTracker() {
    try {
        const allPrompts = getAllPromptsWithState();
        let totalCost = 0;
        let warnThreshold = null;

        for (const prompt of allPrompts) {
            if (!prompt.enabled || !prompt.content) continue;

            const directives = parsePromptDirectives(prompt.content);
            if (directives.tokenCost) {
                totalCost += directives.tokenCost;
            }
            if (directives.tokenCostWarn && (!warnThreshold || directives.tokenCostWarn < warnThreshold)) {
                warnThreshold = directives.tokenCostWarn;
            }
        }

        // Update display
        const valueElement = document.getElementById('nemo-token-value');
        const warnElement = document.getElementById('nemo-token-warn');
        const fillElement = document.getElementById('nemo-token-fill');

        if (valueElement) {
            valueElement.textContent = totalCost.toLocaleString();
        }

        if (warnElement && warnThreshold) {
            if (totalCost > warnThreshold) {
                warnElement.textContent = `⚠️ Exceeds threshold (${warnThreshold.toLocaleString()})`;
                warnElement.style.display = 'inline';
            } else {
                warnElement.style.display = 'none';
            }
        }

        if (fillElement && warnThreshold) {
            const percentage = Math.min((totalCost / warnThreshold) * 100, 100);
            fillElement.style.width = `${percentage}%`;

            // Color based on percentage
            if (percentage > 100) {
                fillElement.style.background = '#ff4444';
            } else if (percentage > 80) {
                fillElement.style.background = '#ffaa44';
            } else {
                fillElement.style.background = '#44ff88';
            }
        }
    } catch (error) {
        logger.error('Error updating token cost tracker:', error);
    }
}

/**
 * Setup profile system
 */
function setupProfileSystem() {
    try {
        const promptManagerPopup = document.querySelector('#completion_prompt_manager_popup');
        if (!promptManagerPopup) {
            setTimeout(setupProfileSystem, 1000);
            return;
        }

        // Check if already setup
        if (document.querySelector('.nemo-profile-manager')) {
            return;
        }

        // Get all profiles
        const allPrompts = getAllPromptsWithState();
        const profiles = new Set();

        for (const prompt of allPrompts) {
            if (!prompt.content) continue;
            const directives = parsePromptDirectives(prompt.content);
            directives.profiles.forEach(p => profiles.add(p));
        }

        if (profiles.size === 0) {
            return; // No profiles defined
        }

        // Create profile UI
        const profileContainer = document.createElement('div');
        profileContainer.className = 'nemo-profile-manager';
        profileContainer.innerHTML = `
            <div class="nemo-profile-header">
                <span class="nemo-profile-label">Quick Profiles:</span>
            </div>
            <div class="nemo-profile-buttons" id="nemo-profile-buttons"></div>
        `;

        // Insert at top
        const listContainer = promptManagerPopup.querySelector('#completion_prompt_manager_list');
        if (listContainer) {
            listContainer.parentNode.insertBefore(profileContainer, listContainer);
        }

        // Add profile buttons
        const buttonsContainer = profileContainer.querySelector('#nemo-profile-buttons');
        profiles.forEach(profileName => {
            const button = document.createElement('button');
            button.className = 'nemo-profile-button';
            button.textContent = profileName;
            button.addEventListener('click', () => activateProfile(profileName));
            buttonsContainer.appendChild(button);
        });

        logger.info(`Setup profile system with ${profiles.size} profiles`);
    } catch (error) {
        logger.error('Error setting up profile system:', error);
    }
}

/**
 * Activate a profile
 * Only affects prompts that have at least one profile defined.
 * Prompts without any @profile directives are left untouched.
 */
function activateProfile(profileName) {
    try {
        const allPrompts = getAllPromptsWithState();
        let enabledCount = 0;
        let disabledCount = 0;
        let skippedCount = 0;

        for (const prompt of allPrompts) {
            if (!prompt.content) continue;

            const directives = parsePromptDirectives(prompt.content);

            // IMPORTANT: Only affect prompts that have profiles defined
            // Skip prompts that don't participate in the profile system
            if (directives.profiles.length === 0) {
                skippedCount++;
                continue;
            }

            const shouldBeEnabled = directives.profiles.includes(profileName);

            const promptOrderEntry = promptManager.getPromptOrderEntry(promptManager.activeCharacter, prompt.identifier);
            if (!promptOrderEntry) continue;

            if (shouldBeEnabled && !prompt.enabled) {
                promptOrderEntry.enabled = true;
                enabledCount++;
            } else if (!shouldBeEnabled && prompt.enabled) {
                promptOrderEntry.enabled = false;
                disabledCount++;
            }
        }

        if (enabledCount > 0 || disabledCount > 0) {
            promptManager.render();
            promptManager.saveServiceSettings();
            logger.info(`Activated profile "${profileName}": enabled ${enabledCount}, disabled ${disabledCount}, skipped ${skippedCount} (no profile)`);

            // Show toast
            showToast(`Profile "${profileName}" activated`, 'success');
        }
    } catch (error) {
        logger.error('Error activating profile:', error);
    }
}

/**
 * Setup help panel
 */
function setupHelpPanel() {
    try {
        // Create help panel overlay
        const helpPanel = document.createElement('div');
        helpPanel.id = 'nemo-help-panel';
        helpPanel.className = 'nemo-help-panel hidden';
        helpPanel.innerHTML = `
            <div class="nemo-help-content">
                <button class="nemo-help-close">×</button>
                <div class="nemo-help-body" id="nemo-help-body"></div>
            </div>
        `;

        document.body.appendChild(helpPanel);

        // Setup close button
        helpPanel.querySelector('.nemo-help-close').addEventListener('click', () => {
            helpPanel.classList.add('hidden');
        });

        // Close on background click
        helpPanel.addEventListener('click', (e) => {
            if (e.target === helpPanel) {
                helpPanel.classList.add('hidden');
            }
        });

        logger.info('Help panel setup complete');
    } catch (error) {
        logger.error('Error setting up help panel:', error);
    }
}

/**
 * Show help panel for a prompt
 */
export function showHelpPanel(promptId) {
    try {
        const allPrompts = getAllPromptsWithState();
        const prompt = allPrompts.find(p => p.identifier === promptId);

        if (!prompt || !prompt.content) return;

        const directives = parsePromptDirectives(prompt.content);
        const helpPanel = document.getElementById('nemo-help-panel');
        const helpBody = document.getElementById('nemo-help-body');

        if (!helpPanel || !helpBody) return;

        // Build help content
        let html = `<h2>${escapeHtml(prompt.name)}</h2>`;

        if (directives.help) {
            html += `<div class="nemo-help-section"><p>${escapeHtml(directives.help)}</p></div>`;
        }

        if (directives.example) {
            html += `<div class="nemo-help-section">
                <h3>Example:</h3>
                <pre>${escapeHtml(directives.example)}</pre>
            </div>`;
        }

        if (directives.documentationUrl) {
            html += `<div class="nemo-help-section">
                <a href="${escapeHtml(directives.documentationUrl)}" target="_blank" class="nemo-help-link">
                    📚 View Documentation
                </a>
            </div>`;
        }

        if (directives.tags.length > 0) {
            html += `<div class="nemo-help-section">
                <strong>Tags:</strong> ${directives.tags.map(t => `<span class="nemo-help-tag">${escapeHtml(t)}</span>`).join(' ')}
            </div>`;
        }

        if (directives.testedWith.length > 0) {
            html += `<div class="nemo-help-section">
                <strong>Tested with:</strong> ${directives.testedWith.map(t => escapeHtml(t)).join(', ')}
            </div>`;
        }

        helpBody.innerHTML = html;
        helpPanel.classList.remove('hidden');
    } catch (error) {
        logger.error('Error showing help panel:', error);
    }
}

/**
 * Apply visual customizations
 */
function applyVisualCustomizations() {
    try {
        const allPrompts = getAllPromptsWithState();
        const promptElements = document.querySelectorAll('.completion_prompt_manager_prompt[data-pm-identifier]');

        promptElements.forEach(element => {
            const identifier = element.getAttribute('data-pm-identifier');
            const prompt = allPrompts.find(p => p.identifier === identifier);

            if (!prompt || !prompt.content) return;

            const directives = parsePromptDirectives(prompt.content);

            // Apply icon
            if (directives.icon) {
                const nameLink = element.querySelector('.prompt_manager_prompt_name');
                if (nameLink && !nameLink.querySelector('.nemo-prompt-icon')) {
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'nemo-prompt-icon';
                    iconSpan.textContent = directives.icon + ' ';
                    nameLink.prepend(iconSpan);
                }
            }

            // Apply color
            if (directives.color) {
                element.style.borderLeftColor = directives.color;
                element.style.borderLeftWidth = '4px';
                element.style.borderLeftStyle = 'solid';
            }

            // Apply badge
            if (directives.badge) {
                if (!element.querySelector('.nemo-prompt-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'nemo-prompt-badge';
                    badge.textContent = directives.badge;
                    badge.style.background = directives.color || '#4A9EFF';
                    element.querySelector('.prompt_manager_prompt_name')?.appendChild(badge);
                }
            }

            // Apply highlight
            if (directives.highlight) {
                element.classList.add('nemo-highlighted-prompt');
            }

            // Apply advanced/beginner indicators
            if (directives.advanced) {
                element.classList.add('nemo-advanced-prompt');
            }
            if (directives.recommendedForBeginners) {
                element.classList.add('nemo-beginner-prompt');
            }
        });

        logger.info('Visual customizations applied');
    } catch (error) {
        logger.error('Error applying visual customizations:', error);
    }
}

/**
 * Setup mutual exclusive groups
 */
function setupMutualExclusiveGroups() {
    try {
        // This will be handled in the prompt-directive-hooks.js
        // when a prompt is toggled
        logger.info('Mutual exclusive groups ready');
    } catch (error) {
        logger.error('Error setting up mutual exclusive groups:', error);
    }
}

/**
 * Apply conditional visibility
 */
function applyConditionalVisibility() {
    try {
        const allPrompts = getAllPromptsWithState();
        const promptElements = document.querySelectorAll('.completion_prompt_manager_prompt[data-pm-identifier]');

        promptElements.forEach(element => {
            const identifier = element.getAttribute('data-pm-identifier');
            const prompt = allPrompts.find(p => p.identifier === identifier);

            if (!prompt || !prompt.content) return;

            const directives = parsePromptDirectives(prompt.content);

            // Check if-enabled
            let shouldShow = true;

            if (directives.ifEnabled.length > 0) {
                shouldShow = directives.ifEnabled.some(id => {
                    const requiredPrompt = allPrompts.find(p => p.identifier === id);
                    return requiredPrompt && requiredPrompt.enabled;
                });
            }

            // Check if-disabled
            if (shouldShow && directives.ifDisabled.length > 0) {
                shouldShow = directives.ifDisabled.every(id => {
                    const requiredPrompt = allPrompts.find(p => p.identifier === id);
                    return !requiredPrompt || !requiredPrompt.enabled;
                });
            }

            // Check if-api
            if (shouldShow && directives.ifApi.length > 0) {
                const context = getContext();
                const currentApi = context?.mainApi || '';
                shouldShow = directives.ifApi.includes(currentApi.toLowerCase());
            }

            // Check hidden
            if (directives.hidden) {
                shouldShow = false;
            }

            // Apply visibility
            if (shouldShow) {
                element.classList.remove('nemo-conditionally-hidden');
            } else {
                element.classList.add('nemo-conditionally-hidden');
            }
        });

        logger.info('Conditional visibility applied');
    } catch (error) {
        logger.error('Error applying conditional visibility:', error);
    }
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `nemo-toast nemo-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
