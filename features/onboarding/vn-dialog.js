import logger from '../../core/logger.js';
import { tutorialManager } from './tutorial-manager.js';

/**
 * Visual Novel Dialog - Creates and manages VN-style tutorial dialogs
 */
export class VNDialog {
    constructor() {
        this.container = null;
        this.isVisible = false;
        this.onNextCallback = null;
        this.onPreviousCallback = null;
        this.onCloseCallback = null;
    }

    /**
     * Create the dialog DOM structure
     */
    createDialog() {
        if (this.container) return;

        // Main container
        this.container = document.createElement('div');
        this.container.className = 'nemo-vn-dialog-overlay';
        this.container.style.display = 'none';

        // Dialog box
        const dialogBox = document.createElement('div');
        dialogBox.className = 'nemo-vn-dialog';

        // Character art container
        const characterContainer = document.createElement('div');
        characterContainer.className = 'nemo-vn-character';

        const characterImg = document.createElement('img');
        characterImg.className = 'nemo-vn-character-img';
        characterImg.alt = 'Vex';
        characterContainer.appendChild(characterImg);

        // Content area
        const contentArea = document.createElement('div');
        contentArea.className = 'nemo-vn-content';

        // Speaker name with close button
        const speakerName = document.createElement('div');
        speakerName.className = 'nemo-vn-speaker';
        speakerName.innerHTML = `
            <span>Vex</span>
            <button class="nemo-vn-close" title="Skip Tutorial">×</button>
        `;
        contentArea.appendChild(speakerName);

        // Close button handler
        speakerName.querySelector('.nemo-vn-close').addEventListener('click', () => this.onSkip());

        // Dialog text
        const dialogText = document.createElement('div');
        dialogText.className = 'nemo-vn-text';
        contentArea.appendChild(dialogText);

        // Highlight box for showing specific UI elements
        const highlightBox = document.createElement('div');
        highlightBox.className = 'nemo-vn-highlight';
        highlightBox.style.display = 'none';
        contentArea.appendChild(highlightBox);

        // Progress indicator
        const progressBar = document.createElement('div');
        progressBar.className = 'nemo-vn-progress';

        const progressFill = document.createElement('div');
        progressFill.className = 'nemo-vn-progress-fill';
        progressBar.appendChild(progressFill);

        const progressText = document.createElement('div');
        progressText.className = 'nemo-vn-progress-text';
        progressBar.appendChild(progressText);

        contentArea.appendChild(progressBar);

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'nemo-vn-buttons';

        // Previous button
        const prevButton = document.createElement('button');
        prevButton.className = 'nemo-vn-button nemo-vn-button-prev';
        prevButton.textContent = '← Previous';
        prevButton.addEventListener('click', () => this.onPrevious());
        buttonContainer.appendChild(prevButton);

        // Skip button
        const skipButton = document.createElement('button');
        skipButton.className = 'nemo-vn-button nemo-vn-button-skip';
        skipButton.textContent = 'Skip Tutorial';
        skipButton.addEventListener('click', () => this.onSkip());
        buttonContainer.appendChild(skipButton);

        // Next button
        const nextButton = document.createElement('button');
        nextButton.className = 'nemo-vn-button nemo-vn-button-next';
        nextButton.textContent = 'Next →';
        nextButton.addEventListener('click', () => this.onNext());
        buttonContainer.appendChild(nextButton);

        contentArea.appendChild(buttonContainer);

        // Assemble dialog
        dialogBox.appendChild(characterContainer);
        dialogBox.appendChild(contentArea);
        this.container.appendChild(dialogBox);

        // Add to body
        document.body.appendChild(this.container);

        // Note: Overlay click removed - users can interact with UI during tutorial

        logger.debug('VN Dialog created');
    }

    /**
     * Show a tutorial step
     * @param {Object} step - Step data from tutorial
     */
    show(step) {
        if (!this.container) {
            this.createDialog();
        }

        // Update character image
        const characterImg = this.container.querySelector('.nemo-vn-character-img');
        if (step.characterImage) {
            characterImg.src = step.characterImage;
            characterImg.style.display = 'block';
        } else {
            // Default Vex image path
            characterImg.src = 'scripts/extensions/third-party/NemoPresetExt/assets/vex-default.png';
            characterImg.style.display = 'block';
        }

        // Update speaker name (preserve close button)
        const speakerName = this.container.querySelector('.nemo-vn-speaker span');
        speakerName.textContent = step.speaker || 'Vex';

        // Update dialog text
        const dialogText = this.container.querySelector('.nemo-vn-text');
        dialogText.innerHTML = step.text || '';

        // Update progress
        const progressFill = this.container.querySelector('.nemo-vn-progress-fill');
        const progressText = this.container.querySelector('.nemo-vn-progress-text');
        if (step.stepNumber && step.totalSteps) {
            const progress = (step.stepNumber / step.totalSteps) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Step ${step.stepNumber} of ${step.totalSteps}`;
        }

        // Handle button states
        const prevButton = this.container.querySelector('.nemo-vn-button-prev');
        const nextButton = this.container.querySelector('.nemo-vn-button-next');

        prevButton.disabled = step.stepNumber === 1;

        if (step.stepNumber === step.totalSteps) {
            nextButton.textContent = 'Complete! ✓';
            nextButton.classList.add('nemo-vn-button-complete');
        } else {
            nextButton.textContent = 'Next →';
            nextButton.classList.remove('nemo-vn-button-complete');
        }

        // Handle highlight (if step targets a specific UI element)
        if (step.highlightSelector) {
            this.highlightElement(step.highlightSelector, step.highlightText);
        } else {
            this.clearHighlight();
        }

        // Handle action buttons (interactive tutorial steps)
        if (step.actionButton) {
            this.addActionButton(step.actionButton);
        }

        // Show dialog
        this.container.style.display = 'flex';
        this.isVisible = true;

        // Trigger any custom step actions
        if (step.onShow) {
            try {
                step.onShow();
            } catch (error) {
                logger.error('Error in step onShow callback:', error);
            }
        }

        logger.debug(`Showing step: ${step.stepNumber}/${step.totalSteps}`);
    }

    /**
     * Hide the dialog
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.isVisible = false;
            this.clearHighlight();
        }
    }

    /**
     * Highlight a UI element
     * @param {string} selector - CSS selector for element to highlight
     * @param {string} text - Optional text to show in highlight box
     */
    highlightElement(selector, text = '') {
        // Clear any existing highlights
        this.clearHighlight();

        const element = document.querySelector(selector);
        if (!element) {
            logger.warn(`Could not find element to highlight: ${selector}`);
            return;
        }

        // Add highlight class to target element
        element.classList.add('nemo-vn-highlighted');

        // Create spotlight effect
        const spotlight = document.createElement('div');
        spotlight.className = 'nemo-vn-spotlight';
        spotlight.dataset.vnSpotlight = 'true';

        const rect = element.getBoundingClientRect();
        spotlight.style.top = `${rect.top - 10}px`;
        spotlight.style.left = `${rect.left - 10}px`;
        spotlight.style.width = `${rect.width + 20}px`;
        spotlight.style.height = `${rect.height + 20}px`;

        document.body.appendChild(spotlight);

        // Show text in highlight box if provided
        if (text) {
            const highlightBox = this.container.querySelector('.nemo-vn-highlight');
            highlightBox.textContent = text;
            highlightBox.style.display = 'block';
        }

        logger.debug(`Highlighted element: ${selector}`);
    }

    /**
     * Clear all highlights
     */
    clearHighlight() {
        // Remove highlight classes
        document.querySelectorAll('.nemo-vn-highlighted').forEach(el => {
            el.classList.remove('nemo-vn-highlighted');
        });

        // Remove spotlights
        document.querySelectorAll('[data-vn-spotlight]').forEach(el => {
            el.remove();
        });

        // Hide highlight box
        if (this.container) {
            const highlightBox = this.container.querySelector('.nemo-vn-highlight');
            if (highlightBox) {
                highlightBox.style.display = 'none';
            }
        }
    }

    /**
     * Add an action button to the current step
     * @param {Object} buttonConfig - Button configuration
     */
    addActionButton(buttonConfig) {
        const buttonContainer = this.container.querySelector('.nemo-vn-buttons');

        // Remove any existing action button
        const existingAction = buttonContainer.querySelector('.nemo-vn-button-action');
        if (existingAction) {
            existingAction.remove();
        }

        // Create new action button
        const actionButton = document.createElement('button');
        actionButton.className = 'nemo-vn-button nemo-vn-button-action';
        actionButton.textContent = buttonConfig.text || 'Try It';
        actionButton.addEventListener('click', () => {
            if (buttonConfig.onClick) {
                buttonConfig.onClick();
            }
        });

        // Insert before the next button
        const nextButton = buttonContainer.querySelector('.nemo-vn-button-next');
        buttonContainer.insertBefore(actionButton, nextButton);
    }

    /**
     * Handle next button click
     */
    onNext() {
        const nextStep = tutorialManager.nextStep();
        if (nextStep) {
            this.show(nextStep);
        } else {
            // Tutorial complete
            this.hide();
            if (this.onCloseCallback) {
                this.onCloseCallback();
            }
            this.showCompletionMessage();
        }
    }

    /**
     * Handle previous button click
     */
    onPrevious() {
        const prevStep = tutorialManager.previousStep();
        if (prevStep) {
            this.show(prevStep);
        }
    }

    /**
     * Handle skip button click
     */
    onSkip() {
        const confirmed = confirm('Are you sure you want to skip this tutorial? You can always restart it from the settings.');
        if (confirmed) {
            tutorialManager.dismissTutorial();
            this.hide();
            if (this.onCloseCallback) {
                this.onCloseCallback();
            }
        }
    }

    /**
     * Show tutorial completion message
     */
    showCompletionMessage() {
        const toast = document.createElement('div');
        toast.className = 'nemo-vn-toast';
        toast.innerHTML = `
            <div class="nemo-vn-toast-content">
                <strong>🎉 Tutorial Complete!</strong>
                <p>Great job! You can review tutorials anytime from the extension settings.</p>
            </div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('nemo-vn-toast-show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('nemo-vn-toast-show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * Destroy the dialog
     */
    destroy() {
        this.clearHighlight();
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        this.isVisible = false;
    }
}

// Export singleton instance
export const vnDialog = new VNDialog();
