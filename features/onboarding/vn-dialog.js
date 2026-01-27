/**
 * Visual Novel Dialog - VN-style tutorial dialogs
 * Now uses React VNDialog component when available
 */

import logger from '../../core/logger.js';
import { tutorialManager } from './tutorial-manager.js';

/**
 * VNDialog wrapper that uses React when available
 */
export class VNDialog {
    constructor() {
        this.useReact = false;
        this.currentSteps = [];
        this.currentStepIndex = 0;
    }

    /**
     * Show a dialog step
     * @param {Object} step - Step configuration
     */
    async show(step) {
        // Try React version first
        if (window.NemoReactUI?.showVNDialog) {
            this.useReact = true;
            return this.showReact(step);
        }

        // Fall back to vanilla
        return this.showVanilla(step);
    }

    /**
     * Show using React VNDialog
     */
    async showReact(_step) {
        const tutorial = tutorialManager.getCurrentTutorial();
        if (!tutorial) {
            logger.warn('No active tutorial for VN dialog');
            return;
        }

        // Convert step to React format
        const steps = tutorial.steps.map((s, index) => ({
            id: `step-${index}`,
            speaker: s.speaker || 'Vex',
            text: s.text,
            characterImage: this.getCharacterImage(s.emotion || 'neutral'),
            highlight: s.highlight,
            progress: {
                current: index + 1,
                total: tutorial.steps.length,
            },
        }));

        try {
            const completed = await window.NemoReactUI.showVNDialog(steps, {
                title: tutorial.name,
                allowDismiss: true,
            });

            if (completed) {
                tutorialManager.completeTutorial(tutorial.id);
            } else {
                tutorialManager.dismissTutorial(tutorial.id);
            }
        } catch (error) {
            logger.error('Error showing React VN dialog:', error);
        }
    }

    /**
     * Get character image path based on emotion
     */
    getCharacterImage(emotion) {
        const basePath = 'scripts/extensions/third-party/NemoPresetExt/images/vex';
        const emotions = {
            neutral: 'vex-neutral.png',
            happy: 'vex-happy.png',
            thinking: 'vex-thinking.png',
            excited: 'vex-excited.png',
            worried: 'vex-worried.png',
            confident: 'vex-confident.png',
        };
        return `${basePath}/${emotions[emotion] || emotions.neutral}`;
    }

    /**
     * Vanilla fallback implementation
     */
    showVanilla(step) {
        logger.warn('React VNDialog not available, using fallback');

        // Simple alert-based fallback
        const text = step.text || 'Tutorial step';
        const speaker = step.speaker || 'Vex';

        alert(`[${speaker}]\n\n${text}`);

        // Move to next step
        tutorialManager.nextStep();
        const nextStep = tutorialManager.getCurrentStep();
        if (nextStep) {
            this.show(nextStep);
        }
    }

    /**
     * Hide the dialog
     */
    hide() {
        // React handles its own cleanup
        logger.debug('VNDialog hide called');
    }
}

// Export singleton
export const vnDialog = new VNDialog();
