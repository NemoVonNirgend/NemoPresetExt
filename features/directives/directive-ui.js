/**
 * Nemo Directive System UI Components
 * Toast notifications and conflict resolution UI
 *
 * @module directive-ui
 */

import logger from '../../core/logger.js';
import { DIRECTIVE_DOCUMENTATION } from './prompt-directives.js';
import { promptManager } from '../../../../../openai.js';

/**
 * Show a conflict resolution toast
 * Uses React component when available, falls back to vanilla JS
 * @param {Array} issues - Array of validation issues
 * @param {string} promptId - ID of the prompt being activated
 * @param {Function} onResolve - Callback when user resolves the conflict
 */
export function showConflictToast(issues, promptId, onResolve) {
    // Try to use React version if available
    if (window.NemoReactUI?.showConflictToast) {
        // Convert issues to React format and handle the promise
        window.NemoReactUI.showConflictToast(issues).then(result => {
            if (result.action === 'resolve') {
                // Handle resolve action - disable conflicting prompts or enable dependencies
                if (result.issue) {
                    if (result.issue.conflictingPrompt) {
                        disablePrompt(result.issue.conflictingPrompt.identifier);
                    }
                    if (result.issue.requiredPrompt) {
                        enablePrompt(result.issue.requiredPrompt.identifier);
                    }
                }
                onResolve(true);
            } else if (result.action === 'ignore') {
                onResolve(true);
            } else {
                onResolve(false);
            }
        }).catch(err => {
            logger.error('React conflict toast error:', err);
            // Fall back to vanilla implementation on error
            showConflictToastVanilla(issues, promptId, onResolve);
        });
        return;
    }

    // Fall back to vanilla implementation
    showConflictToastVanilla(issues, promptId, onResolve);
}

/**
 * Vanilla JS implementation of conflict toast
 * @param {Array} issues - Array of validation issues
 * @param {string} promptId - ID of the prompt being activated
 * @param {Function} onResolve - Callback when user resolves the conflict
 */
function showConflictToastVanilla(issues, promptId, onResolve) {
    // Check if there's already a toast showing for this prompt
    const existingToast = document.querySelector(`.nemo-directive-toast[data-prompt-id="${promptId}"]`);
    if (existingToast) {
        return;
    }

    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    if (errors.length === 0 && warnings.length === 0) {
        onResolve(true);
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'nemo-directive-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('data-prompt-id', promptId); // Track which prompt this toast is for

    let content = '<div class="nemo-toast-header">';
    if (errors.length > 0) {
        content += '<span class="nemo-toast-icon nemo-toast-error">⚠️</span>';
        content += '<span class="nemo-toast-title">Prompt Conflict Detected</span>';
    } else {
        content += '<span class="nemo-toast-icon nemo-toast-warning">⚠</span>';
        content += '<span class="nemo-toast-title">Prompt Warning</span>';
    }
    content += '</div>';

    content += '<div class="nemo-toast-body">';

    // Show errors first
    for (const issue of errors) {
        content += `<div class="nemo-toast-issue nemo-toast-issue-error">`;
        content += `<strong>${getIssueTypeLabel(issue.type)}:</strong> ${escapeHtml(issue.message)}`;
        content += '</div>';
    }

    // Show warnings
    for (const issue of warnings) {
        content += `<div class="nemo-toast-issue nemo-toast-issue-warning">`;
        content += `<strong>${getIssueTypeLabel(issue.type)}:</strong> ${escapeHtml(issue.message)}`;
        content += '</div>';
    }

    content += '</div>';

    // Action buttons
    content += '<div class="nemo-toast-actions">';

    if (errors.length > 0) {
        // For errors, provide resolution options
        const hasExclusive = errors.some(i => i.type === 'exclusive');
        const hasMissingDep = errors.some(i => i.type === 'missing-dependency');
        const hasCategoryLimit = errors.some(i => i.type === 'category-limit');
        const hasGroupExclusive = errors.some(i => i.type === 'mutual-exclusive-group');

        if (hasExclusive || hasCategoryLimit || hasGroupExclusive) {
            // Option to disable conflicting prompts
            content += '<button class="nemo-toast-btn nemo-toast-btn-primary" data-action="disable-conflicts">Disable Conflicting Prompts</button>';
        }

        if (hasMissingDep) {
            const canAutoEnable = errors.some(i => i.type === 'missing-dependency' && i.canAutoEnable);
            if (canAutoEnable) {
                content += '<button class="nemo-toast-btn nemo-toast-btn-primary" data-action="enable-dependencies">Enable Required Prompts</button>';
            }
        }

        content += '<button class="nemo-toast-btn nemo-toast-btn-secondary" data-action="cancel">Cancel</button>';
    } else {
        // For warnings, allow proceeding or canceling
        content += '<button class="nemo-toast-btn nemo-toast-btn-primary" data-action="proceed">Proceed Anyway</button>';
        content += '<button class="nemo-toast-btn nemo-toast-btn-secondary" data-action="cancel">Cancel</button>';
    }

    content += '</div>';

    toast.innerHTML = content;

    // Add event listeners
    toast.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            handleToastAction(action, issues, promptId, toast, onResolve);
        });
    });

    // Add to page
    document.body.appendChild(toast);

    // Auto-remove after timeout for warnings
    if (errors.length === 0) {
        setTimeout(() => {
            if (toast.parentNode) {
                removeToast(toast);
            }
        }, 10000);
    }
}

/**
 * Show a toast notification for message-based triggers
 * @param {Array} triggered - Array of triggered changes
 * @param {number} messageCount - Current message count
 */
export function showMessageTriggerToast(triggered, messageCount) {
    if (!triggered || triggered.length === 0) return;

    // Remove any existing message trigger toast
    const existingToast = document.querySelector('.nemo-message-trigger-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'nemo-directive-toast nemo-message-trigger-toast';
    toast.setAttribute('role', 'status');

    const enabled = triggered.filter(t => t.action === 'enable');
    const disabled = triggered.filter(t => t.action === 'disable');

    let content = '<div class="nemo-toast-header">';
    content += '<span class="nemo-toast-icon">📊</span>';
    content += `<span class="nemo-toast-title">Message Trigger (${messageCount} messages)</span>`;
    content += '<button class="nemo-toast-dismiss" aria-label="Dismiss">&times;</button>';
    content += '</div>';

    content += '<div class="nemo-toast-body">';

    if (enabled.length > 0) {
        content += '<div class="nemo-trigger-section">';
        content += '<strong class="nemo-trigger-enabled">✓ Enabled:</strong>';
        content += '<ul class="nemo-trigger-list">';
        for (const item of enabled) {
            content += `<li title="${escapeHtml(item.reason)}">${escapeHtml(item.name)}</li>`;
        }
        content += '</ul></div>';
    }

    if (disabled.length > 0) {
        content += '<div class="nemo-trigger-section">';
        content += '<strong class="nemo-trigger-disabled">✗ Disabled:</strong>';
        content += '<ul class="nemo-trigger-list">';
        for (const item of disabled) {
            content += `<li title="${escapeHtml(item.reason)}">${escapeHtml(item.name)}</li>`;
        }
        content += '</ul></div>';
    }

    content += '</div>';
    toast.innerHTML = content;

    // Dismiss button handler
    const dismissBtn = toast.querySelector('.nemo-toast-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => removeToast(toast));
    }

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            removeToast(toast);
        }
    }, 5000);
}

/**
 * Handle toast action button clicks
 */
function handleToastAction(action, issues, promptId, toastElement, onResolve) {
    switch (action) {
        case 'disable-conflicts':
            // Disable all conflicting prompts
            const conflictingPrompts = [];
            for (const issue of issues) {
                if (issue.conflictingPrompt) {
                    conflictingPrompts.push(issue.conflictingPrompt);
                }
                if (issue.conflictingPrompts) {
                    conflictingPrompts.push(...issue.conflictingPrompts);
                }
            }

            for (const prompt of conflictingPrompts) {
                disablePrompt(prompt.identifier);
            }

            removeToast(toastElement);
            onResolve(true);
            break;

        case 'enable-dependencies':
            // Enable all required prompts
            const requiredPrompts = issues
                .filter(i => i.type === 'missing-dependency' && i.requiredPrompt)
                .map(i => i.requiredPrompt);

            for (const prompt of requiredPrompts) {
                enablePrompt(prompt.identifier);
            }

            removeToast(toastElement);
            onResolve(true);
            break;

        case 'proceed':
            removeToast(toastElement);
            onResolve(true);
            break;

        case 'cancel':
            removeToast(toastElement);
            onResolve(false);
            break;
    }
}

/**
 * Get user-friendly label for issue type
 */
function getIssueTypeLabel(type) {
    const labels = {
        'exclusive': 'Mutual Exclusion',
        'mutual-exclusive-group': 'Group Exclusion',
        'missing-dependency': 'Missing Requirement',
        'category-limit': 'Category Limit',
        'soft-conflict': 'Potential Conflict',
        'deprecated': 'Deprecated'
    };
    return labels[type] || type;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Remove toast with animation
 */
function removeToast(toastElement) {
    toastElement.classList.add('nemo-toast-removing');
    setTimeout(() => {
        if (toastElement.parentNode) {
            toastElement.parentNode.removeChild(toastElement);
        }
    }, 300);
}

/**
 * Enable a prompt by identifier
 */
function enablePrompt(identifier) {
    if (!promptManager) return;

    try {
        const activeCharacter = promptManager.activeCharacter;
        const prompt = promptManager.getPromptById(identifier);

        if (prompt && activeCharacter) {
            promptManager.handleToggle(prompt, activeCharacter, true);
            logger.info(`Auto-enabled prompt: ${prompt.name}`);
        }
    } catch (error) {
        logger.error('Error enabling prompt:', error);
    }
}

/**
 * Disable a prompt by identifier
 */
function disablePrompt(identifier) {
    if (!promptManager) return;

    try {
        const activeCharacter = promptManager.activeCharacter;
        const prompt = promptManager.getPromptById(identifier);

        if (prompt && activeCharacter) {
            promptManager.handleToggle(prompt, activeCharacter, false);
            logger.info(`Auto-disabled prompt: ${prompt.name}`);
        }
    } catch (error) {
        logger.error('Error disabling prompt:', error);
    }
}

/**
 * Add documentation tooltip to prompt editor
 */
export function addDirectiveDocumentation() {
    // Check if already added anywhere in the document
    if (document.querySelector('.nemo-directive-help')) {
        return;
    }

    // Try multiple strategies to find and add the help icon

    // Strategy 1: Find the label by for attribute
    let promptLabel = document.querySelector('label[for="completion_prompt_manager_popup_entry_form_prompt"]');

    // Strategy 2: Find by text content in prompt editor popup
    if (!promptLabel) {
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
            const text = label.textContent.trim();
            if (text === 'Prompt' || text.startsWith('Prompt')) {
                const popup = label.closest('.completion_prompt_manager_popup_entry, .dialogue_popup');
                if (popup) {
                    promptLabel = label;
                    break;
                }
            }
        }
    }

    // Strategy 3: Find the textarea and create a help button near it
    if (!promptLabel) {
        const textarea = document.querySelector('#completion_prompt_manager_popup_entry_form_prompt');
        if (textarea) {
            // Create a floating help button
            const helpButton = document.createElement('button');
            helpButton.className = 'nemo-directive-help-button';
            helpButton.innerHTML = 'ℹ️ Directive Help';
            helpButton.type = 'button';
            helpButton.title = 'Click for directive syntax help';
            helpButton.addEventListener('click', (e) => {
                e.preventDefault();
                showDirectiveHelp();
            });

            // Insert before the textarea
            textarea.parentNode.insertBefore(helpButton, textarea);
            logger.info('Added directive help button above textarea');
            return;
        }
    }

    if (!promptLabel) {
        logger.warn('Could not find prompt editor label or textarea');
        return;
    }

    // Create help icon
    const helpIcon = document.createElement('span');
    helpIcon.className = 'nemo-directive-help';
    helpIcon.innerHTML = '&nbsp;<a href="#" class="nemo-help-icon" title="Click for directive syntax help">ℹ️</a>';

    const helpLink = helpIcon.querySelector('.nemo-help-icon');
    helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        showDirectiveHelp();
    });

    // Add after the span inside the label, or just append to label
    const labelSpan = promptLabel.querySelector('span[data-i18n="Prompt"]');
    if (labelSpan) {
        labelSpan.after(helpIcon);
    } else {
        promptLabel.appendChild(helpIcon);
    }

    logger.info('Added directive documentation help icon to prompt editor');
}

/**
 * Show directive help modal
 * Uses React component when available, falls back to vanilla JS
 */
function showDirectiveHelp() {
    // Try to use React version if available
    if (window.NemoReactUI?.showDirectiveHelp) {
        window.NemoReactUI.showDirectiveHelp();
        return;
    }

    // Fall back to vanilla implementation
    const modal = document.createElement('div');
    modal.className = 'nemo-directive-modal';
    modal.innerHTML = `
        <div class="nemo-modal-overlay"></div>
        <div class="nemo-modal-content">
            <div class="nemo-modal-header">
                <h3>Prompt Directive Language</h3>
                <button class="nemo-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="nemo-modal-body">
                ${formatDocumentation(DIRECTIVE_DOCUMENTATION)}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeBtn = modal.querySelector('.nemo-modal-close');
    const overlay = modal.querySelector('.nemo-modal-overlay');

    const closeModal = () => {
        modal.classList.add('nemo-modal-removing');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // ESC key to close
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}

/**
 * Format documentation markdown to HTML
 */
function formatDocumentation(markdown) {
    // Simple markdown to HTML conversion
    let html = escapeHtml(markdown);

    // Headers
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
}

/**
 * Initialize directive UI system
 * Now uses React for the help button (via DirectiveAutocompleteController)
 */
export function initDirectiveUI() {
    logger.info('Initializing directive UI system (React mode)');

    // The help button is now rendered by React's DirectiveAutocompleteController
    // which is mounted by directive-autocomplete-ui.js
    // We keep this function for backward compatibility but it's mostly a no-op now

    // Try to add help icon immediately as fallback if React isn't ready
    setTimeout(() => {
        // Only add if React hasn't already added it
        if (!document.querySelector('.nemo-directive-help, .nemo-directive-help-button')) {
            addDirectiveDocumentation();
        }
    }, 2000);

    logger.info('Directive UI system initialized');
}
