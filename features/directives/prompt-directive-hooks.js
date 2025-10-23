/**
 * Nemo Prompt Directive Hooks
 * Intercepts prompt toggle events to validate directives
 *
 * @module prompt-directive-hooks
 */

import logger from '../../core/logger.js';
import { validatePromptActivation, getAllPromptsWithState, parsePromptDirectives } from './prompt-directives.js';
import { showConflictToast } from './directive-ui.js';
import { promptManager } from '../../../../../openai.js';

/**
 * Initialize directive validation hooks
 */
export function initPromptDirectiveHooks() {
    logger.info('Initializing prompt directive hooks');

    // Hook into prompt toggle clicks
    interceptPromptToggles();

    logger.info('Prompt directive hooks initialized');
}

/**
 * Intercept prompt toggle events
 */
function interceptPromptToggles() {
    // Use event delegation to catch all prompt toggle clicks
    document.addEventListener('click', handlePromptToggleClick, true);
}

/**
 * Handle click events on prompt toggles
 */
function handlePromptToggleClick(event) {
    // Check if it's actually a toggle action (not edit button, etc.)
    const toggleAction = event.target.closest('.prompt-manager-toggle-action');

    if (!toggleAction) {
        return;
    }

    console.log('[Directive Hooks] Toggle action clicked');

    // Find the parent prompt element
    const promptElement = toggleAction.closest('.completion_prompt_manager_prompt[data-pm-identifier]');

    if (!promptElement) {
        console.log('[Directive Hooks] No prompt element found');
        return;
    }

    const identifier = promptElement.getAttribute('data-pm-identifier');
    if (!identifier) {
        console.log('[Directive Hooks] No identifier found');
        return;
    }

    console.log('[Directive Hooks] Toggle for prompt:', identifier);

    // Determine if we're enabling or disabling
    const isCurrentlyEnabled = !promptManager?.isPromptDisabledForActiveCharacter(identifier);

    console.log('[Directive Hooks] Currently enabled:', isCurrentlyEnabled);

    // Only validate when enabling a prompt
    if (isCurrentlyEnabled) {
        console.log('[Directive Hooks] Prompt is currently enabled, allowing disable');
        return;
    }

    console.log('[Directive Hooks] Intercepting toggle, will validate first');

    // Prevent the default toggle action - we'll handle it manually
    event.preventDefault();
    event.stopPropagation();

    // Validate the activation and toggle if allowed
    validateAndToggle(identifier, promptElement);
}

/**
 * Validate prompt activation and show conflict UI if needed
 */
function validateAndToggle(promptId, toggleElement) {
    console.log('[Validate] Starting validation for:', promptId);

    try {
        const allPrompts = getAllPromptsWithState();
        console.log('[Validate] Got', allPrompts.length, 'prompts');

        const issues = validatePromptActivation(promptId, allPrompts);
        console.log('[Validate] Found', issues.length, 'issues');

        if (issues.length === 0) {
            console.log('[Validate] No issues, performing toggle');
            console.log('[Validate] About to call performToggle with:', promptId, true);
            console.log('[Validate] performToggle function exists:', typeof performToggle);
            // No issues, proceed with toggle
            performToggle(promptId, true);
            console.log('[Validate] performToggle call completed');
            return;
        }

        console.log('[Validate] Issues:', issues);

        // Check if we have errors or just warnings
        const hasErrors = issues.some(i => i.severity === 'error');
        console.log('[Validate] Has errors:', hasErrors);

        if (!hasErrors) {
            console.log('[Validate] Only warnings, showing toast');
            // Just warnings, show toast but allow proceeding
            showConflictToast(issues, promptId, (proceed) => {
                console.log('[Validate] User chose:', proceed);
                if (proceed) {
                    performToggle(promptId, true);
                }
            });
            return;
        }

        // Has errors, check if we can auto-resolve
        const canAutoResolve = checkAutoResolution(issues, allPrompts, promptId);
        console.log('[Validate] Can auto-resolve:', canAutoResolve);

        if (canAutoResolve) {
            console.log('[Validate] Auto-resolving');
            // Auto-resolve and enable
            performAutoResolution(issues, allPrompts, promptId);
            performToggle(promptId, true);
        } else {
            console.log('[Validate] Showing conflict toast');
            // Show conflict toast for manual resolution
            showConflictToast(issues, promptId, (proceed) => {
                console.log('[Validate] User chose:', proceed);
                if (proceed) {
                    performToggle(promptId, true);
                }
            });
        }
    } catch (error) {
        logger.error('Error validating prompt activation:', error);
        console.error('[Validate] Error:', error);
        // On error, allow the toggle to proceed
        performToggle(promptId, true);
    }
}

/**
 * Check if issues can be auto-resolved
 */
function checkAutoResolution(issues, allPrompts, promptId) {
    const prompt = allPrompts.find(p => p.identifier === promptId);
    if (!prompt || !prompt.content) return false;

    const directives = parsePromptDirectives(prompt.content);

    // Can auto-resolve if:
    // 1. Has auto-disable directives that match exclusive conflicts
    // 2. Has auto-enable-dependencies and all required prompts exist

    let canResolve = true;

    for (const issue of issues) {
        if (issue.type === 'exclusive' || issue.type === 'category-limit') {
            // Check if we have auto-disable for these prompts
            const conflictingIds = [];
            if (issue.conflictingPrompt) conflictingIds.push(issue.conflictingPrompt.identifier);
            if (issue.conflictingPrompts) conflictingIds.push(...issue.conflictingPrompts.map(p => p.identifier));

            const hasAutoDisable = conflictingIds.every(id => directives.autoDisable.includes(id));
            if (!hasAutoDisable) {
                canResolve = false;
                break;
            }
        }

        if (issue.type === 'missing-dependency') {
            if (!directives.autoEnableDependencies) {
                canResolve = false;
                break;
            }
            if (!issue.requiredPrompt) {
                canResolve = false;
                break;
            }
        }
    }

    return canResolve;
}

/**
 * Perform auto-resolution of conflicts
 */
function performAutoResolution(issues, allPrompts, promptId) {
    const prompt = allPrompts.find(p => p.identifier === promptId);
    if (!prompt || !prompt.content) return;

    const directives = parsePromptDirectives(prompt.content);

    for (const issue of issues) {
        if (issue.type === 'exclusive' || issue.type === 'category-limit') {
            // Auto-disable conflicting prompts
            if (issue.conflictingPrompt) {
                performToggle(issue.conflictingPrompt.identifier, false);
                logger.info(`Auto-disabled conflicting prompt: ${issue.conflictingPrompt.name}`);
            }
            if (issue.conflictingPrompts) {
                for (const p of issue.conflictingPrompts) {
                    performToggle(p.identifier, false);
                    logger.info(`Auto-disabled conflicting prompt: ${p.name}`);
                }
            }
        }

        if (issue.type === 'missing-dependency' && directives.autoEnableDependencies) {
            // Auto-enable required prompts
            if (issue.requiredPrompt) {
                performToggle(issue.requiredPrompt.identifier, true);
                logger.info(`Auto-enabled required prompt: ${issue.requiredPrompt.name}`);
            }
        }
    }
}

/**
 * Perform the actual toggle operation
 */
function performToggle(identifier, enable) {
    console.log('[PerformToggle] Called for:', identifier, 'enable:', enable);

    if (!promptManager) {
        logger.warn('Prompt manager not available');
        console.log('[PerformToggle] No prompt manager!');
        return;
    }

    try {
        const prompt = promptManager.getPromptById(identifier);
        const activeCharacter = promptManager.activeCharacter;

        console.log('[PerformToggle] Found prompt:', prompt?.name);
        console.log('[PerformToggle] Active character:', activeCharacter);

        if (!prompt) {
            logger.warn(`Prompt not found: ${identifier}`);
            console.log('[PerformToggle] Prompt not found!');
            return;
        }

        // Get the prompt order entry
        const promptOrderEntry = promptManager.getPromptOrderEntry(activeCharacter, identifier);

        if (!promptOrderEntry) {
            logger.warn(`Prompt order entry not found: ${identifier}`);
            console.log('[PerformToggle] Prompt order entry not found!');
            return;
        }

        console.log('[PerformToggle] Current enabled state:', promptOrderEntry.enabled);
        console.log('[PerformToggle] Setting to:', enable);

        // Set the enabled state
        promptOrderEntry.enabled = enable;

        // Clear token cache for this prompt
        if (promptManager.tokenHandler && promptManager.tokenHandler.getCounts) {
            const counts = promptManager.tokenHandler.getCounts();
            counts[identifier] = null;
        }

        // Re-render the prompt manager UI
        console.log('[PerformToggle] Calling render');
        promptManager.render();

        // Save settings
        console.log('[PerformToggle] Saving settings');
        promptManager.saveServiceSettings();

        console.log('[PerformToggle] Toggle complete');

        logger.debug(`Toggled prompt ${identifier} to ${enable ? 'enabled' : 'disabled'}`);
    } catch (error) {
        logger.error('Error performing toggle:', error);
        console.error('[PerformToggle] Error:', error);
    }
}

/**
 * Update the toggle UI element
 */
function updateToggleUI(identifier, enabled) {
    const toggleElement = document.querySelector(`[data-pm-identifier="${identifier}"]`);
    if (!toggleElement) return;

    // Find checkbox or toggle button
    const checkbox = toggleElement.querySelector('.prompt_manager_prompt_checkbox');
    if (checkbox) {
        checkbox.checked = enabled;
    }

    // Update visual state
    if (enabled) {
        toggleElement.classList.add('prompt-enabled');
        toggleElement.classList.remove('prompt-disabled');
    } else {
        toggleElement.classList.add('prompt-disabled');
        toggleElement.classList.remove('prompt-enabled');
    }
}
