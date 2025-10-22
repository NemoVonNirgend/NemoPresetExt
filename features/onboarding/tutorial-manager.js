import { extension_settings } from '../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../script.js';
import logger from '../../core/logger.js';

/**
 * Tutorial Manager - Handles tutorial state, progress, and coordination
 */
export class TutorialManager {
    constructor() {
        this.currentTutorial = null;
        this.tutorialRegistry = new Map();
        this.initialized = false;
    }

    /**
     * Initialize the tutorial system
     */
    initialize() {
        if (this.initialized) return;

        // Ensure settings namespace exists
        if (!extension_settings.NemoPresetExt) {
            extension_settings.NemoPresetExt = {};
        }
        if (!extension_settings.NemoPresetExt.tutorials) {
            extension_settings.NemoPresetExt.tutorials = {
                completed: [],
                dismissed: [],
                showOnStartup: true,
                currentProgress: {}
            };
        }

        this.initialized = true;
        logger.info('Tutorial Manager initialized');
    }

    /**
     * Register a tutorial
     * @param {string} id - Unique tutorial ID
     * @param {Object} tutorial - Tutorial definition
     */
    registerTutorial(id, tutorial) {
        if (!tutorial.steps || !Array.isArray(tutorial.steps)) {
            logger.error(`Tutorial ${id} must have a steps array`);
            return;
        }

        this.tutorialRegistry.set(id, {
            id,
            name: tutorial.name || id,
            description: tutorial.description || '',
            category: tutorial.category || 'general',
            steps: tutorial.steps,
            onComplete: tutorial.onComplete || null,
            requirements: tutorial.requirements || null
        });

        logger.debug(`Registered tutorial: ${id}`);
    }

    /**
     * Start a tutorial
     * @param {string} tutorialId - ID of tutorial to start
     * @returns {boolean} - Success status
     */
    startTutorial(tutorialId) {
        const tutorial = this.tutorialRegistry.get(tutorialId);
        if (!tutorial) {
            logger.error(`Tutorial not found: ${tutorialId}`);
            return false;
        }

        // Check if tutorial was already completed
        const tutorialSettings = extension_settings.NemoPresetExt.tutorials;
        if (tutorialSettings.completed.includes(tutorialId)) {
            logger.info(`Tutorial ${tutorialId} already completed, restarting...`);
        }

        // Check requirements
        if (tutorial.requirements && !tutorial.requirements()) {
            logger.warn(`Requirements not met for tutorial: ${tutorialId}`);
            return false;
        }

        this.currentTutorial = {
            ...tutorial,
            currentStep: 0,
            startedAt: Date.now()
        };

        // Save progress
        tutorialSettings.currentProgress[tutorialId] = {
            step: 0,
            startedAt: this.currentTutorial.startedAt
        };
        saveSettingsDebounced();

        logger.info(`Started tutorial: ${tutorialId}`);
        return true;
    }

    /**
     * Get the current step in the active tutorial
     * @returns {Object|null} - Current step data
     */
    getCurrentStep() {
        if (!this.currentTutorial) return null;

        const stepIndex = this.currentTutorial.currentStep;
        if (stepIndex >= this.currentTutorial.steps.length) {
            return null;
        }

        return {
            ...this.currentTutorial.steps[stepIndex],
            stepNumber: stepIndex + 1,
            totalSteps: this.currentTutorial.steps.length,
            tutorialId: this.currentTutorial.id,
            tutorialName: this.currentTutorial.name
        };
    }

    /**
     * Advance to the next step
     * @returns {Object|null} - Next step data, or null if tutorial complete
     */
    nextStep() {
        if (!this.currentTutorial) return null;

        this.currentTutorial.currentStep++;

        const tutorialSettings = extension_settings.NemoPresetExt.tutorials;
        const tutorialId = this.currentTutorial.id;

        // Check if tutorial is complete
        if (this.currentTutorial.currentStep >= this.currentTutorial.steps.length) {
            this.completeTutorial();
            return null;
        }

        // Save progress
        tutorialSettings.currentProgress[tutorialId].step = this.currentTutorial.currentStep;
        saveSettingsDebounced();

        return this.getCurrentStep();
    }

    /**
     * Go back to the previous step
     * @returns {Object|null} - Previous step data
     */
    previousStep() {
        if (!this.currentTutorial || this.currentTutorial.currentStep === 0) {
            return null;
        }

        this.currentTutorial.currentStep--;

        const tutorialSettings = extension_settings.NemoPresetExt.tutorials;
        const tutorialId = this.currentTutorial.id;
        tutorialSettings.currentProgress[tutorialId].step = this.currentTutorial.currentStep;
        saveSettingsDebounced();

        return this.getCurrentStep();
    }

    /**
     * Complete the current tutorial
     */
    completeTutorial() {
        if (!this.currentTutorial) return;

        const tutorialId = this.currentTutorial.id;
        const tutorialSettings = extension_settings.NemoPresetExt.tutorials;

        // Mark as completed
        if (!tutorialSettings.completed.includes(tutorialId)) {
            tutorialSettings.completed.push(tutorialId);
        }

        // Clear current progress
        delete tutorialSettings.currentProgress[tutorialId];
        saveSettingsDebounced();

        // Call completion callback if exists
        if (this.currentTutorial.onComplete) {
            try {
                this.currentTutorial.onComplete();
            } catch (error) {
                logger.error(`Error in tutorial completion callback: ${error}`);
            }
        }

        logger.info(`Completed tutorial: ${tutorialId}`);
        this.currentTutorial = null;
    }

    /**
     * Dismiss/skip the current tutorial
     */
    dismissTutorial() {
        if (!this.currentTutorial) return;

        const tutorialId = this.currentTutorial.id;
        const tutorialSettings = extension_settings.NemoPresetExt.tutorials;

        // Mark as dismissed
        if (!tutorialSettings.dismissed.includes(tutorialId)) {
            tutorialSettings.dismissed.push(tutorialId);
        }

        // Clear current progress
        delete tutorialSettings.currentProgress[tutorialId];
        saveSettingsDebounced();

        logger.info(`Dismissed tutorial: ${tutorialId}`);
        this.currentTutorial = null;
    }

    /**
     * Check if a tutorial has been completed
     * @param {string} tutorialId - Tutorial ID to check
     * @returns {boolean}
     */
    isCompleted(tutorialId) {
        const tutorialSettings = extension_settings.NemoPresetExt.tutorials;
        return tutorialSettings.completed.includes(tutorialId);
    }

    /**
     * Check if a tutorial has been dismissed
     * @param {string} tutorialId - Tutorial ID to check
     * @returns {boolean}
     */
    isDismissed(tutorialId) {
        const tutorialSettings = extension_settings.NemoPresetExt.tutorials;
        return tutorialSettings.dismissed.includes(tutorialId);
    }

    /**
     * Reset a tutorial (remove completion/dismissal status)
     * @param {string} tutorialId - Tutorial ID to reset
     */
    resetTutorial(tutorialId) {
        const tutorialSettings = extension_settings.NemoPresetExt.tutorials;

        // Remove from completed
        const completedIndex = tutorialSettings.completed.indexOf(tutorialId);
        if (completedIndex > -1) {
            tutorialSettings.completed.splice(completedIndex, 1);
        }

        // Remove from dismissed
        const dismissedIndex = tutorialSettings.dismissed.indexOf(tutorialId);
        if (dismissedIndex > -1) {
            tutorialSettings.dismissed.splice(dismissedIndex, 1);
        }

        // Clear progress
        delete tutorialSettings.currentProgress[tutorialId];

        saveSettingsDebounced();
        logger.info(`Reset tutorial: ${tutorialId}`);
    }

    /**
     * Get all available tutorials
     * @returns {Array} - Array of tutorial info
     */
    getAllTutorials() {
        return Array.from(this.tutorialRegistry.values()).map(tutorial => ({
            id: tutorial.id,
            name: tutorial.name,
            description: tutorial.description,
            category: tutorial.category,
            steps: tutorial.steps,
            completed: this.isCompleted(tutorial.id),
            dismissed: this.isDismissed(tutorial.id)
        }));
    }

    /**
     * Get tutorials by category
     * @param {string} category - Category name
     * @returns {Array} - Filtered tutorials
     */
    getTutorialsByCategory(category) {
        return this.getAllTutorials().filter(t => t.category === category);
    }

    /**
     * Check if user should see the welcome tutorial
     * @returns {boolean}
     */
    shouldShowWelcomeTutorial() {
        const tutorialSettings = extension_settings.NemoPresetExt.tutorials;
        return tutorialSettings.showOnStartup &&
               !this.isCompleted('welcome') &&
               !this.isDismissed('welcome');
    }

    /**
     * Disable welcome tutorial on startup
     */
    disableWelcomeOnStartup() {
        extension_settings.NemoPresetExt.tutorials.showOnStartup = false;
        saveSettingsDebounced();
    }
}

// Export singleton instance
export const tutorialManager = new TutorialManager();
