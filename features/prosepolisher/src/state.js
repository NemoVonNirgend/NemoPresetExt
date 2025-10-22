import { ErrorHandler } from './error-handler.js';

/**
 * @typedef {object} Rule
 * @property {string} id
 * @property {string} scriptName
 * @property {string} findRegex
 * @property {string} replaceString
 * @property {boolean} disabled
 * @property {boolean} isStatic
 * @property {boolean} [isNew]
 */

class AppState {
    constructor() {
        // Core Application State
        this.isAppReady = false;
        this.readyQueue = [];

        /** @type {Rule[]} */
        this.staticRules = [];
        /** @type {Rule[]} */
        this.dynamicRules = [];

        // UI & Navigator State
        this.regexNavigator = null;
        this.uiManager = null;

        // Analyzer State
        this.prosePolisherAnalyzer = null;
        this.processedMessageIds = new Set();

        // Project Gremlin State
        this.isPipelineRunning = false;
    }

    /**
     * Queues a task to be run once the application is ready.
     * If the app is already ready, the task is executed immediately.
     * @param {Function} task The function to execute.
     */
    queueReadyTask(task) {
        if (this.isAppReady) {
            ErrorHandler.safeCall(task);
        } else {
            this.readyQueue.push(task);
        }
    }

    /**
     * Executes all queued tasks. This should be called once the app is ready.
     */
    async runReadyQueue() {
        if (this.isAppReady) return;
        this.isAppReady = true;
        window.isAppReady = true; // For compatibility with existing code that might use the global
        console.log(`[ProsePolisher:State] App is ready. Running ${this.readyQueue.length} queued tasks.`);
        while (this.readyQueue.length > 0) {
            const task = this.readyQueue.shift();
            await ErrorHandler.withErrorHandling('readyQueue', task, { showUser: false });
        }
        console.log('[ProsePolisher:State] Ready queue finished.');
    }

    /**
     * Gets all active (not disabled) rules.
     * @param {object} settings - The extension settings for ProsePolisher.
     * @returns {Rule[]}
     */
    getActiveRules(settings) {
        const rules = [];
        if (settings.isStaticEnabled) {
            rules.push(...this.staticRules.filter(r => !r.disabled));
        }
        if (settings.isDynamicEnabled) {
            rules.push(...this.dynamicRules.filter(r => !r.disabled));
        }
        return rules;
    }
}

export const state = new AppState();