/**
 * Nemo Prompt Directive Hooks
 * Intercepts prompt toggle events to validate directives
 *
 * @module prompt-directive-hooks
 */

import logger from '../../core/logger.js';
import { validatePromptActivation, getAllPromptsWithState, parsePromptDirectives, evaluateMessageTriggers, getCurrentMessageCount } from './prompt-directives.js';
import { showConflictToast, showMessageTriggerToast } from './directive-ui.js';
import { promptManager } from '../../../../../openai.js';
import { eventSource, event_types } from '../../../../../../script.js';

// Track which prompts are currently being validated (prevents double popups)
const validatingPrompts = new Set();
let hooksInitialized = false;

/**
 * Initialize directive validation hooks
 */
export function initPromptDirectiveHooks() {
    if (hooksInitialized) {
        logger.warn('Directive hooks already initialized, skipping');
        return;
    }

    logger.info('Initializing prompt directive hooks');

    // Hook into prompt toggle clicks
    interceptPromptToggles();

    hooksInitialized = true;
    logger.info('Prompt directive hooks initialized');
}

/**
 * Intercept prompt toggle events
 */
function interceptPromptToggles() {
    // IMPORTANT: Remove any existing listener first to prevent duplicates
    document.removeEventListener('click', handlePromptToggleClick, true);

    // Use event delegation to catch all prompt toggle clicks
    document.addEventListener('click', handlePromptToggleClick, true);
    logger.info('Registered click event listener for directive validation');
}

/**
 * Handle click events on prompt toggles
 */
function handlePromptToggleClick(event) {
    // Check if it's actually a toggle action (not edit button, etc.)
    const toggleAction = event.target.closest('.prompt-manager-toggle-action');

    if (!toggleAction) {
        return; // Not a toggle action, ignore
    }

    // Find the parent prompt element
    const promptElement = toggleAction.closest('.completion_prompt_manager_prompt[data-pm-identifier]');

    if (!promptElement) {
        return;
    }

    const identifier = promptElement.getAttribute('data-pm-identifier');
    if (!identifier) {
        return;
    }

    // Check if this specific prompt is already being validated
    if (validatingPrompts.has(identifier)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
    }

    // Determine if we're enabling or disabling
    const isCurrentlyEnabled = !promptManager?.isPromptDisabledForActiveCharacter(identifier);

    // Only validate when enabling a prompt
    if (isCurrentlyEnabled) {
        return;
    }

    // Prevent the default toggle action - we'll handle it manually
    event.preventDefault();
    event.stopPropagation();

    // Mark this prompt as being validated
    validatingPrompts.add(identifier);

    // Validate the activation and toggle if allowed
    validateAndToggle(identifier, promptElement);
}

/**
 * Validate prompt activation and show conflict UI if needed
 */
function validateAndToggle(promptId, toggleElement) {
    try {
        const allPrompts = getAllPromptsWithState();
        const issues = validatePromptActivation(promptId, allPrompts);

        if (issues.length === 0) {
            // No issues, proceed with toggle
            performToggle(promptId, true);
            // Remove from validating set after a short delay
            setTimeout(() => {
                validatingPrompts.delete(promptId);
            }, 300);
            return;
        }

        // Check if we have errors or just warnings
        const hasErrors = issues.some(i => i.severity === 'error');

        if (!hasErrors) {
            // Just warnings, show toast but allow proceeding
            showConflictToast(issues, promptId, (proceed) => {
                if (proceed) {
                    performToggle(promptId, true);
                }
                // Remove from validating set
                validatingPrompts.delete(promptId);
            });
            return;
        }

        // Has errors, check if we can auto-resolve
        const canAutoResolve = checkAutoResolution(issues, allPrompts, promptId);

        if (canAutoResolve) {
            // Auto-resolve and enable
            performAutoResolution(issues, allPrompts, promptId);
            performToggle(promptId, true);
            // Remove from validating set
            setTimeout(() => {
                validatingPrompts.delete(promptId);
            }, 300);
        } else {
            // Show conflict toast for manual resolution
            showConflictToast(issues, promptId, (proceed) => {
                if (proceed) {
                    performToggle(promptId, true);
                }
                // Remove from validating set
                validatingPrompts.delete(promptId);
            });
        }
    } catch (error) {
        logger.error('Error validating prompt activation:', error);
        // On error, allow the toggle to proceed
        performToggle(promptId, true);
        // Remove from validating set on error
        validatingPrompts.delete(promptId);
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
        if (issue.type === 'exclusive' || issue.type === 'category-limit' || issue.type === 'mutual-exclusive-group') {
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
        if (issue.type === 'exclusive' || issue.type === 'category-limit' || issue.type === 'mutual-exclusive-group') {
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
    if (!promptManager) {
        logger.warn('Prompt manager not available');
        return;
    }

    try {
        const prompt = promptManager.getPromptById(identifier);
        const activeCharacter = promptManager.activeCharacter;

        if (!prompt) {
            logger.warn(`Prompt not found: ${identifier}`);
            return;
        }

        // Get the prompt order entry
        const promptOrderEntry = promptManager.getPromptOrderEntry(activeCharacter, identifier);

        if (!promptOrderEntry) {
            logger.warn(`Prompt order entry not found: ${identifier}`);
            return;
        }

        // Set the enabled state
        promptOrderEntry.enabled = enable;

        // Clear token cache for this prompt
        if (promptManager.tokenHandler && promptManager.tokenHandler.getCounts) {
            const counts = promptManager.tokenHandler.getCounts();
            counts[identifier] = null;
        }

        // Re-render the prompt manager UI
        promptManager.render();

        // Save settings
        promptManager.saveServiceSettings();

        logger.debug(`Toggled prompt ${identifier} to ${enable ? 'enabled' : 'disabled'}`);
    } catch (error) {
        logger.error('Error performing toggle:', error);
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

// Track last processed message count to avoid repeated triggers
let lastProcessedMessageCount = -1;
let messageTriggerHooksInitialized = false;

/**
 * Initialize message-based trigger hooks
 * Listens for message events and evaluates triggers
 */
export function initMessageTriggerHooks() {
    if (messageTriggerHooksInitialized) {
        logger.warn('Message trigger hooks already initialized');
        return;
    }

    logger.info('Initializing message trigger hooks');

    // Listen for messages being sent/received
    eventSource.on(event_types.MESSAGE_SENT, () => {
        setTimeout(checkMessageTriggers, 100); // Small delay to ensure chat is updated
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        setTimeout(checkMessageTriggers, 100);
    });

    // Also check on chat changed (new chat loaded)
    eventSource.on(event_types.CHAT_CHANGED, () => {
        lastProcessedMessageCount = -1; // Reset when chat changes
        setTimeout(checkMessageTriggers, 200);
    });

    // Check on generation started (for pre-generation triggers)
    eventSource.on(event_types.GENERATION_STARTED, () => {
        checkMessageTriggers();
    });

    messageTriggerHooksInitialized = true;
    logger.info('Message trigger hooks initialized');
}

/**
 * Check and apply message-based triggers
 */
export async function checkMessageTriggers() {
    try {
        const messageCount = getCurrentMessageCount();

        // Skip if we've already processed this message count
        if (messageCount === lastProcessedMessageCount) {
            return;
        }

        const allPrompts = getAllPromptsWithState();
        if (!allPrompts.length) {
            return;
        }

        const triggerResult = evaluateMessageTriggers(messageCount, allPrompts);

        // Check if any changes need to be made
        if (triggerResult.toEnable.length === 0 && triggerResult.toDisable.length === 0) {
            lastProcessedMessageCount = messageCount;
            return;
        }

        logger.info(`Message triggers at count ${messageCount}:`, triggerResult.triggered);

        // Apply enables
        for (const identifier of triggerResult.toEnable) {
            performToggle(identifier, true);
            logger.info(`Auto-enabled prompt via message trigger: ${identifier}`);
        }

        // Apply disables
        for (const identifier of triggerResult.toDisable) {
            performToggle(identifier, false);
            logger.info(`Auto-disabled prompt via message trigger: ${identifier}`);
        }

        // Show notification toast if changes were made
        if (triggerResult.triggered.length > 0) {
            showMessageTriggerToast(triggerResult.triggered, messageCount);
        }

        lastProcessedMessageCount = messageCount;

    } catch (error) {
        logger.error('Error checking message triggers:', error);
    }
}

/**
 * Manually trigger a check (for UI buttons or testing)
 */
export function forceCheckMessageTriggers() {
    lastProcessedMessageCount = -1;
    return checkMessageTriggers();
}
