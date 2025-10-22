import logger from '../../core/logger.js';
import { tutorialManager } from './tutorial-manager.js';
import { vnDialog } from './vn-dialog.js';
import { tutorials } from './tutorials.js';

/**
 * Tutorial Launcher - Provides UI for browsing and starting tutorials
 */
export class TutorialLauncher {
    constructor() {
        this.menuContainer = null;
    }

    /**
     * Initialize the launcher
     */
    initialize() {
        // Register all tutorials
        Object.entries(tutorials).forEach(([id, tutorial]) => {
            tutorialManager.registerTutorial(id, tutorial);
        });

        // Add tutorial button to settings
        this.addTutorialButton();

        logger.info('Tutorial Launcher initialized');
    }

    /**
     * Add tutorial button to extension settings
     */
    addTutorialButton() {
        // Wait for settings container
        const checkSettings = setInterval(() => {
            const settingsContainer = document.querySelector('.nemo-preset-enhancer-settings');
            if (settingsContainer) {
                clearInterval(checkSettings);

                // Check if button already exists
                if (settingsContainer.querySelector('.nemo-tutorials-button')) {
                    return;
                }

                // Create tutorial section
                const tutorialSection = document.createElement('div');
                tutorialSection.className = 'nemo-settings-section';
                tutorialSection.innerHTML = `
                    <h3>📚 Tutorials & Help</h3>
                    <p>Learn how to use all the features with interactive tutorials guided by Vex!</p>
                    <button class="nemo-tutorials-button menu_button interactable">
                        Open Tutorial Menu
                    </button>
                `;

                // Insert at the top of settings
                settingsContainer.insertBefore(tutorialSection, settingsContainer.firstChild);

                // Add click handler
                const button = tutorialSection.querySelector('.nemo-tutorials-button');
                button.addEventListener('click', () => this.openMenu());

                logger.debug('Tutorial button added to settings');
            }
        }, 500);
    }

    /**
     * Open the tutorial menu
     */
    openMenu() {
        if (this.menuContainer) {
            this.menuContainer.style.display = 'flex';
            return;
        }

        this.createMenu();
    }

    /**
     * Create the tutorial menu UI
     */
    createMenu() {
        // Main container
        this.menuContainer = document.createElement('div');
        this.menuContainer.className = 'nemo-tutorial-menu-overlay';

        // Menu box
        const menuBox = document.createElement('div');
        menuBox.className = 'nemo-tutorial-menu';

        // Header
        const header = document.createElement('div');
        header.className = 'nemo-tutorial-menu-header';
        header.innerHTML = `
            <h2>🎓 Tutorial Menu</h2>
            <p>Choose a tutorial to learn about different features</p>
            <button class="nemo-tutorial-menu-close">&times;</button>
        `;
        menuBox.appendChild(header);

        // Close button handler
        header.querySelector('.nemo-tutorial-menu-close').addEventListener('click', () => {
            this.closeMenu();
        });

        // Categories
        const categories = this.groupTutorialsByCategory();

        // Category tabs
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'nemo-tutorial-menu-tabs';

        Object.keys(categories).forEach((category, index) => {
            const tab = document.createElement('button');
            tab.className = 'nemo-tutorial-menu-tab';
            tab.textContent = this.formatCategoryName(category);
            tab.dataset.category = category;
            if (index === 0) tab.classList.add('active');

            tab.addEventListener('click', () => {
                // Update active tab
                tabsContainer.querySelectorAll('.nemo-tutorial-menu-tab').forEach(t => {
                    t.classList.remove('active');
                });
                tab.classList.add('active');

                // Show corresponding content
                contentContainer.querySelectorAll('.nemo-tutorial-category').forEach(c => {
                    c.style.display = 'none';
                });
                contentContainer.querySelector(`[data-category="${category}"]`).style.display = 'block';
            });

            tabsContainer.appendChild(tab);
        });
        menuBox.appendChild(tabsContainer);

        // Content area
        const contentContainer = document.createElement('div');
        contentContainer.className = 'nemo-tutorial-menu-content';

        Object.entries(categories).forEach(([category, tutorialList], index) => {
            const categorySection = document.createElement('div');
            categorySection.className = 'nemo-tutorial-category';
            categorySection.dataset.category = category;
            categorySection.style.display = index === 0 ? 'block' : 'none';

            tutorialList.forEach(tutorial => {
                const card = this.createTutorialCard(tutorial);
                categorySection.appendChild(card);
            });

            contentContainer.appendChild(categorySection);
        });

        menuBox.appendChild(contentContainer);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'nemo-tutorial-menu-footer';
        footer.innerHTML = `
            <button class="nemo-tutorial-reset-all menu_button interactable">
                Reset All Progress
            </button>
            <button class="nemo-tutorial-menu-close-btn menu_button interactable">
                Close
            </button>
        `;
        menuBox.appendChild(footer);

        // Footer button handlers
        footer.querySelector('.nemo-tutorial-reset-all').addEventListener('click', () => {
            this.resetAllProgress();
        });
        footer.querySelector('.nemo-tutorial-menu-close-btn').addEventListener('click', () => {
            this.closeMenu();
        });

        this.menuContainer.appendChild(menuBox);
        document.body.appendChild(this.menuContainer);

        // Close on overlay click
        this.menuContainer.addEventListener('click', (e) => {
            if (e.target === this.menuContainer) {
                this.closeMenu();
            }
        });
    }

    /**
     * Create a tutorial card
     */
    createTutorialCard(tutorial) {
        const card = document.createElement('div');
        card.className = 'nemo-tutorial-card';

        const isCompleted = tutorialManager.isCompleted(tutorial.id);
        const isDismissed = tutorialManager.isDismissed(tutorial.id);

        if (isCompleted) {
            card.classList.add('completed');
        } else if (isDismissed) {
            card.classList.add('dismissed');
        }

        card.innerHTML = `
            <div class="nemo-tutorial-card-header">
                <h3>${tutorial.name}</h3>
                <div class="nemo-tutorial-card-status">
                    ${isCompleted ? '<span class="status-badge completed">✓ Completed</span>' : ''}
                    ${isDismissed ? '<span class="status-badge dismissed">Skipped</span>' : ''}
                </div>
            </div>
            <p class="nemo-tutorial-card-description">${tutorial.description}</p>
            <div class="nemo-tutorial-card-footer">
                <span class="nemo-tutorial-card-steps">${tutorial.steps.length} steps</span>
                <div class="nemo-tutorial-card-actions">
                    ${isCompleted || isDismissed ? `
                        <button class="nemo-tutorial-card-reset" data-id="${tutorial.id}">
                            Reset
                        </button>
                    ` : ''}
                    <button class="nemo-tutorial-card-start" data-id="${tutorial.id}">
                        ${isCompleted ? 'Review' : 'Start'} →
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        const startButton = card.querySelector('.nemo-tutorial-card-start');
        startButton.addEventListener('click', () => {
            this.startTutorial(tutorial.id);
        });

        const resetButton = card.querySelector('.nemo-tutorial-card-reset');
        if (resetButton) {
            resetButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetTutorial(tutorial.id);
            });
        }

        return card;
    }

    /**
     * Group tutorials by category
     */
    groupTutorialsByCategory() {
        const allTutorials = tutorialManager.getAllTutorials();
        const categories = {};

        allTutorials.forEach(tutorial => {
            const category = tutorial.category || 'general';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(tutorial);
        });

        return categories;
    }

    /**
     * Format category name for display
     */
    formatCategoryName(category) {
        const names = {
            'getting-started': '🚀 Getting Started',
            'core': '⚙️ Core Features',
            'creation': '🎨 Creation Tools',
            'visual': '🎬 Visual Features',
            'advanced': '🔥 Advanced',
            'general': '📚 General'
        };
        return names[category] || category;
    }

    /**
     * Start a tutorial
     */
    startTutorial(tutorialId) {
        this.closeMenu();

        const success = tutorialManager.startTutorial(tutorialId);
        if (success) {
            const step = tutorialManager.getCurrentStep();
            if (step) {
                vnDialog.show(step);
            }
        } else {
            logger.error(`Failed to start tutorial: ${tutorialId}`);
        }
    }

    /**
     * Reset a tutorial
     */
    resetTutorial(tutorialId) {
        const confirmed = confirm('Reset this tutorial? You can start it again from the beginning.');
        if (confirmed) {
            tutorialManager.resetTutorial(tutorialId);
            this.refreshMenu();
            logger.info(`Tutorial reset: ${tutorialId}`);
        }
    }

    /**
     * Reset all tutorial progress
     */
    resetAllProgress() {
        const confirmed = confirm('Reset ALL tutorial progress? This cannot be undone.');
        if (confirmed) {
            const allTutorials = tutorialManager.getAllTutorials();
            allTutorials.forEach(tutorial => {
                tutorialManager.resetTutorial(tutorial.id);
            });
            this.refreshMenu();
            logger.info('All tutorial progress reset');
        }
    }

    /**
     * Refresh the menu display
     */
    refreshMenu() {
        if (this.menuContainer) {
            this.menuContainer.remove();
            this.menuContainer = null;
            this.createMenu();
        }
    }

    /**
     * Close the menu
     */
    closeMenu() {
        if (this.menuContainer) {
            this.menuContainer.style.display = 'none';
        }
    }

    /**
     * Check if welcome tutorial should auto-start
     */
    checkWelcomeTutorial() {
        if (tutorialManager.shouldShowWelcomeTutorial()) {
            // Wait a bit for UI to load
            setTimeout(() => {
                this.startTutorial('welcome');
            }, 2000);
        }
    }
}

// Export singleton instance
export const tutorialLauncher = new TutorialLauncher();
