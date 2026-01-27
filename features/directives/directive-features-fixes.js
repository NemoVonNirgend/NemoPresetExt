/**
 * Directive Features Fixes
 * Patches for broken/missing directive features
 *
 * @module directive-features-fixes
 */

import logger from '../../core/logger.js';
import { getAllPromptsWithState, parsePromptDirectives } from './prompt-directives.js';
import { promptManager } from '../../../../../openai.js';

// Store observer references for cleanup
const observers = {
    visualCustomizations: null,
    tokenCostTracker: null,
    conditionalVisibility: null,
};

/**
 * Initialize all fixes for directive features
 */
export function initDirectiveFeaturesFixes() {
    logger.info('Applying directive feature fixes...');

    // Fix 1: Ensure visual customizations run after prompt manager renders
    fixVisualCustomizations();

    // Fix 2: Fix advanced feature initialization with proper retry limits
    fixAdvancedFeatureInit();

    // Fix 3: Ensure conditional visibility works
    fixConditionalVisibility();

    logger.info('Directive feature fixes applied');
}

/**
 * Cleanup all observers (called on extension unload)
 */
export function cleanupDirectiveFeaturesFixes() {
    Object.values(observers).forEach(observer => {
        if (observer) {
            observer.disconnect();
        }
    });
    observers.visualCustomizations = null;
    observers.tokenCostTracker = null;
    observers.conditionalVisibility = null;
    logger.info('Directive features observers cleaned up');
}

/**
 * Fix visual customizations to run reliably
 */
function fixVisualCustomizations() {
    let isApplying = false;
    let applyTimeout = null;

    const debouncedApply = () => {
        if (isApplying) return;
        if (applyTimeout) clearTimeout(applyTimeout);

        applyTimeout = setTimeout(() => {
            isApplying = true;
            applyVisualCustomizations();
            isApplying = false;
        }, 100);
    };

    // Wait for the prompt list container to exist before observing
    const waitForContainer = (attempts = 0) => {
        const listContainer = document.querySelector('#completion_prompt_manager_list');
        if (listContainer) {
            // Disconnect previous observer if any
            if (observers.visualCustomizations) {
                observers.visualCustomizations.disconnect();
            }

            // Create targeted observer on the prompt list only
            observers.visualCustomizations = new MutationObserver((mutations) => {
                const needsReapply = mutations.some(m => {
                    if (m.type === 'childList' && m.addedNodes.length > 0) {
                        return Array.from(m.addedNodes).some(node =>
                            node.classList?.contains('completion_prompt_manager_prompt') ||
                            node.querySelector?.('.completion_prompt_manager_prompt')
                        );
                    }
                    if (m.type === 'attributes' && m.target.classList?.contains('completion_prompt_manager_prompt')) {
                        return true;
                    }
                    return false;
                });

                if (needsReapply) {
                    debouncedApply();
                }
            });

            // Watch only the prompt list container (not entire body)
            observers.visualCustomizations.observe(listContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });

            // Apply immediately
            applyVisualCustomizations();
            logger.debug('Visual customizations observer attached to prompt list');
        } else if (attempts < 20) {
            setTimeout(() => waitForContainer(attempts + 1), 500);
        }
    };

    waitForContainer();

    // Also listen for React events to reapply customizations
    window.addEventListener('NEMO_PROMPTS_REFRESHED', debouncedApply);
}

/**
 * Apply visual customizations from directives
 */
function applyVisualCustomizations() {
    try {
        // Get prompts directly from promptManager
        if (!promptManager || !promptManager.serviceSettings) {
            console.warn('[Visual Customizations] promptManager not ready');
            return;
        }

        const allPrompts = promptManager.serviceSettings.prompts || [];
        const promptElements = document.querySelectorAll('.completion_prompt_manager_prompt[data-pm-identifier]');

        logger.debug(`Applying visual customizations to ${promptElements.length} prompts`);

        promptElements.forEach(element => {
            const identifier = element.getAttribute('data-pm-identifier');
            const prompt = allPrompts.find(p => p.identifier === identifier);

            if (!prompt || !prompt.content) {
                return;
            }

            const directives = parsePromptDirectives(prompt.content);

            // Apply icon - prepend to the link text itself
            if (directives.icon) {
                const nameLink = element.querySelector('.completion_prompt_manager_prompt_name a');
                if (nameLink && !nameLink.querySelector('.nemo-prompt-icon')) {
                    // Check if icon is already in the text
                    const currentText = nameLink.textContent || nameLink.innerText;
                    if (!currentText.includes(directives.icon)) {
                        const iconSpan = document.createElement('span');
                        iconSpan.className = 'nemo-prompt-icon';
                        iconSpan.textContent = directives.icon + ' ';
                        iconSpan.style.marginRight = '4px';
                        iconSpan.style.display = 'inline';
                        nameLink.prepend(iconSpan);
                    }
                }
            }

            // Apply color as left border using CSS custom property
            if (directives.color) {
                element.style.setProperty('--nemo-prompt-color', directives.color);
                element.classList.add('nemo-has-color');
                element.dataset.nemoColorApplied = 'true';

                // Also set border directly as fallback (works more reliably)
                element.style.borderLeft = `4px solid ${directives.color}`;
                element.style.paddingLeft = '8px';
            }

            // Apply badge
            if (directives.badge) {
                const nameContainer = element.querySelector('.completion_prompt_manager_prompt_name');
                if (nameContainer && !nameContainer.querySelector('.nemo-prompt-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'nemo-prompt-badge';
                    badge.textContent = directives.badge;
                    badge.style.cssText = `
                        display: inline-block;
                        margin-left: 8px;
                        padding: 2px 8px;
                        background: ${directives.color || '#4A9EFF'};
                        color: white;
                        border-radius: 3px;
                        font-size: 10px;
                        font-weight: bold;
                        text-transform: uppercase;
                    `;
                    nameContainer.appendChild(badge);
                }
            }

            // Apply highlight class
            if (directives.highlight) {
                element.classList.add('nemo-highlighted-prompt');
            }

            // Apply advanced/beginner indicators
            if (directives.advanced) {
                element.classList.add('nemo-advanced-prompt');
                // Add tooltip if not present
                if (!element.title) {
                    element.title = 'Advanced feature - requires experience';
                }
            }
            if (directives.recommendedForBeginners) {
                element.classList.add('nemo-beginner-prompt');
                if (!element.title) {
                    element.title = 'Recommended for beginners';
                }
            }
        });

    } catch (error) {
        logger.error('Error applying visual customizations:', error);
    }
}

/**
 * Fix advanced feature initialization with retry limits
 */
function fixAdvancedFeatureInit() {
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 1000;

    /**
     * Initialize with retry logic
     */
    function initWithRetry(initFn, name, retryCount = 0) {
        try {
            const result = initFn();
            if (result === false && retryCount < MAX_RETRIES) {
                logger.debug(`${name} not ready, retry ${retryCount + 1}/${MAX_RETRIES}`);
                setTimeout(() => initWithRetry(initFn, name, retryCount + 1), RETRY_DELAY);
            } else if (result === false) {
                logger.warn(`${name} failed to initialize after ${MAX_RETRIES} retries`);
            }
        } catch (error) {
            logger.error(`Error initializing ${name}:`, error);
        }
    }

    // Tag filter setup
    initWithRetry(setupTagFilterFixed, 'Tag Filter');

    // Token cost tracker
    initWithRetry(setupTokenCostTrackerFixed, 'Token Cost Tracker');

    // Profile system
    initWithRetry(setupProfileSystemFixed, 'Profile System');

    // Group collapse
    initWithRetry(setupGroupCollapseFixed, 'Group Collapse');
}

/**
 * Fixed tag filter setup
 */
function setupTagFilterFixed() {
    // Check if already setup
    if (document.querySelector('.nemo-tag-filter')) {
        return true;
    }

    // Find the prompt manager list - use the actual selector from the HTML
    const promptList = document.querySelector('#completion_prompt_manager_list');
    if (!promptList) {
        return false; // Signal retry needed
    }

    // Create filter UI
    const filterContainer = document.createElement('div');
    filterContainer.className = 'nemo-tag-filter';
    filterContainer.innerHTML = `
        <input type="text"
               id="nemo-tag-search"
               placeholder="🔍 Search prompts by name, tag, or description..."
               class="nemo-search-input text_pole">
        <div class="nemo-tag-list" id="nemo-tag-list"></div>
        <div class="nemo-filter-stats" id="nemo-filter-stats"></div>
    `;

    // Insert before prompt list
    promptList.parentNode.insertBefore(filterContainer, promptList);

    // Setup search handler
    const searchInput = document.getElementById('nemo-tag-search');
    searchInput.addEventListener('input', handleTagSearchFixed);

    // Build tag list
    updateTagListFixed();

    logger.info('Tag filter UI setup complete');
    return true; // Success
}

/**
 * Fixed tag search handler
 */
function handleTagSearchFixed(event) {
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

        // Search in name, tags, tooltip, help, categories
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
 * Fixed tag list updater
 */
function updateTagListFixed() {
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
            <button class="nemo-tag-button menu_button interactable" data-tag="${escapeHtml(tag)}">
                ${escapeHtml(tag)} <span class="tag-count">(${count})</span>
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
 * Fixed token cost tracker setup
 */
function setupTokenCostTrackerFixed() {
    // Check if already setup
    if (document.querySelector('.nemo-token-tracker')) {
        return true;
    }

    // Find the prompt manager container
    const promptManager = document.querySelector('#completion_prompt_manager');
    if (!promptManager) {
        return false; // Retry needed
    }

    const listContainer = document.querySelector('#completion_prompt_manager_list');
    if (!listContainer) {
        return false;
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

    // Insert before prompt list
    listContainer.parentNode.insertBefore(trackerContainer, listContainer);

    // Update immediately
    updateTokenCostTrackerFixed();

    // Disconnect previous observer if any
    if (observers.tokenCostTracker) {
        observers.tokenCostTracker.disconnect();
    }

    // Setup debounced observer to update when prompts change
    let updateTimeout = null;
    observers.tokenCostTracker = new MutationObserver(() => {
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => updateTokenCostTrackerFixed(), 200);
    });
    observers.tokenCostTracker.observe(listContainer, { childList: true, subtree: false, attributes: false });

    // Also listen for React events
    window.addEventListener('NEMO_PROMPT_TOGGLED', () => {
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => updateTokenCostTrackerFixed(), 200);
    });

    logger.info('Token cost tracker setup complete');
    return true;
}

/**
 * Fixed token cost tracker updater
 */
function updateTokenCostTrackerFixed() {
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
                warnElement.style.color = '#ff4444';
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
 * Fixed profile system setup
 */
function setupProfileSystemFixed() {
    // Check if already setup
    if (document.querySelector('.nemo-profile-manager')) {
        return true;
    }

    // Get all profiles from prompts
    const allPrompts = getAllPromptsWithState();
    const profiles = new Set();

    for (const prompt of allPrompts) {
        if (!prompt.content) continue;
        const directives = parsePromptDirectives(prompt.content);
        directives.profiles.forEach(p => profiles.add(p));
    }

    if (profiles.size === 0) {
        logger.debug('No profiles defined in prompts');
        return true; // Not an error, just no profiles
    }

    const promptManager = document.querySelector('#completion_prompt_manager');
    const listContainer = document.querySelector('#completion_prompt_manager_list');

    if (!promptManager || !listContainer) {
        return false; // Retry needed
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

    // Insert before prompt list
    listContainer.parentNode.insertBefore(profileContainer, listContainer);

    // Add profile buttons
    const buttonsContainer = profileContainer.querySelector('#nemo-profile-buttons');
    profiles.forEach(profileName => {
        const button = document.createElement('button');
        button.className = 'nemo-profile-button menu_button interactable';
        button.textContent = profileName;
        button.addEventListener('click', () => activateProfileFixed(profileName));
        buttonsContainer.appendChild(button);
    });

    logger.info(`Setup profile system with ${profiles.size} profiles`);
    return true;
}

/**
 * Fixed profile activator
 */
function activateProfileFixed(profileName) {
    try {
        const allPrompts = getAllPromptsWithState();
        let enabledCount = 0;
        let disabledCount = 0;

        for (const prompt of allPrompts) {
            if (!prompt.content) continue;

            const directives = parsePromptDirectives(prompt.content);
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
            logger.info(`Activated profile "${profileName}": enabled ${enabledCount}, disabled ${disabledCount}`);

            // Show success message
            showToastFixed(`Profile "${profileName}" activated`, 'success');
        }
    } catch (error) {
        logger.error('Error activating profile:', error);
        showToastFixed(`Error activating profile: ${error.message}`, 'error');
    }
}

/**
 * Fixed group collapse setup
 */
function setupGroupCollapseFixed() {
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

        if (Object.keys(groups).length === 0) {
            logger.debug('No groups defined');
            return true;
        }

        // Apply grouping to UI
        for (const [groupName, groupData] of Object.entries(groups)) {
            applyGroupToUIFixed(groupName, groupData);
        }

        logger.info(`Setup ${Object.keys(groups).length} collapsible groups`);
        return true;
    } catch (error) {
        logger.error('Error setting up group collapse:', error);
        return true; // Don't retry on error
    }
}

/**
 * Fixed group UI applicator
 */
function applyGroupToUIFixed(groupName, groupData) {
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

        // Check if header already exists
        const existingHeader = groupElements[0].previousElementSibling;
        if (existingHeader?.classList.contains('nemo-group-header')) {
            return; // Already applied
        }

        // Create group header
        const groupHeader = document.createElement('div');
        groupHeader.className = 'nemo-group-header';
        groupHeader.style.cssText = `
            padding: 10px;
            background: rgba(74, 158, 255, 0.1);
            border: 1px solid rgba(74, 158, 255, 0.3);
            border-radius: 4px;
            margin: 10px 0;
            cursor: pointer;
            user-select: none;
        `;
        groupHeader.innerHTML = `
            <button class="nemo-group-toggle menu_button interactable" data-group="${escapeHtml(groupName)}">
                <span class="nemo-group-icon">▼</span>
                <span class="nemo-group-name">${escapeHtml(groupName)}</span>
                <span class="nemo-group-count">(${groupElements.length})</span>
            </button>
            ${groupData.description ? `<div class="nemo-group-description" style="margin-top: 8px; font-size: 12px; opacity: 0.8;">${escapeHtml(groupData.description)}</div>` : ''}
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
            groupContainer.style.display = isCollapsed ? 'none' : '';
            const icon = groupHeader.querySelector('.nemo-group-icon');
            icon.textContent = isCollapsed ? '▶' : '▼';

            // Save state
            localStorage.setItem(`nemo_group_${groupName}`, isCollapsed ? 'collapsed' : 'expanded');
        });

        // Restore saved state
        const savedState = localStorage.getItem(`nemo_group_${groupName}`);
        if (savedState === 'collapsed') {
            groupContainer.classList.add('collapsed');
            groupContainer.style.display = 'none';
            groupHeader.querySelector('.nemo-group-icon').textContent = '▶';
        }
    } catch (error) {
        logger.error('Error applying group to UI:', error);
    }
}

/**
 * Fix conditional visibility
 */
function fixConditionalVisibility() {
    let isApplying = false;
    let applyTimeout = null;

    const debouncedApply = () => {
        if (isApplying) return;
        if (applyTimeout) clearTimeout(applyTimeout);

        applyTimeout = setTimeout(() => {
            isApplying = true;
            applyConditionalVisibilityFixed();
            isApplying = false;
        }, 150);
    };

    // Run once on init
    applyConditionalVisibilityFixed();

    // Wait for container and setup observer
    const waitForContainer = (attempts = 0) => {
        const listContainer = document.querySelector('#completion_prompt_manager_list');
        if (listContainer) {
            // Disconnect previous observer if any
            if (observers.conditionalVisibility) {
                observers.conditionalVisibility.disconnect();
            }

            observers.conditionalVisibility = new MutationObserver(() => {
                debouncedApply();
            });
            observers.conditionalVisibility.observe(listContainer, { childList: true, subtree: false, attributes: false });
        } else if (attempts < 20) {
            setTimeout(() => waitForContainer(attempts + 1), 500);
        }
    };

    waitForContainer();

    // Also listen for React events
    window.addEventListener('NEMO_PROMPT_TOGGLED', debouncedApply);
    window.addEventListener('NEMO_PROMPTS_REFRESHED', debouncedApply);
}

/**
 * Fixed conditional visibility applicator
 */
function applyConditionalVisibilityFixed() {
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
                const currentApi = promptManager?.main_api || '';
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

    } catch (error) {
        logger.error('Error applying conditional visibility:', error);
    }
}

/**
 * Show a toast notification
 */
function showToastFixed(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `nemo-toast nemo-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#44ff88' : type === 'error' ? '#ff4444' : '#4A9EFF'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
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
