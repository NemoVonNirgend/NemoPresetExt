/**
 * NotificationManager - Slide-out Notification System
 * Extracted from original NemoLore for clean chat management prompts
 */

/**
 * Helper function for element matching
 */
function elementMatches(element, selector) {
    if (element.matches) return element.matches(selector);
    if (element.msMatchesSelector) return element.msMatchesSelector(selector);
    if (element.webkitMatchesSelector) return element.webkitMatchesSelector(selector);
    return false;
}

/**
 * NotificationManager Class - Clean slide-out notifications
 */
export class NotificationManager {
    constructor() {
        this.isInitialized = false;
        this.addNotificationStyles();
    }

    /**
     * Initialize the notification system
     */
    initialize() {
        if (this.isInitialized) return;
        
        console.log('[NemoLore NotificationManager] Initializing notification system...');
        this.isInitialized = true;
        console.log('[NemoLore NotificationManager] ✅ Notification system ready');
    }

    /**
     * Show a slide-out notification with buttons
     * @param {string} message - The message to display
     * @param {Array} buttons - Array of button objects with {action, text} properties
     * @param {number} timeout - Auto-dismiss timeout in milliseconds
     * @returns {Promise} Promise that resolves with the button action clicked
     */
    show(message, buttons = [], timeout = 10000) {
        console.log('[NemoLore NotificationManager] show() called with message:', message);
        console.log('[NemoLore NotificationManager] Buttons:', buttons);
        console.log('[NemoLore NotificationManager] Timeout:', timeout);

        return new Promise((resolve) => {
            const notification = document.createElement('div');
            notification.className = 'nemolore-notification';
            notification.innerHTML = `
                <div class="nemolore-notification-content">
                    <p>${message}</p>
                    <div class="nemolore-notification-buttons">
                        ${buttons.map(btn => `<button class="nemolore-btn" data-action="${btn.action}">${btn.text}</button>`).join('')}
                    </div>
                </div>
            `;

            document.body.appendChild(notification);
            console.log('[NemoLore NotificationManager] Notification appended to body');

            // Auto-remove after timeout
            const timeoutId = setTimeout(() => {
                console.log('[NemoLore NotificationManager] Notification timed out after', timeout, 'ms');
                notification.remove();
                resolve('timeout');
            }, timeout);

            // Handle button clicks
            notification.addEventListener('click', (e) => {
                console.log('[NemoLore Notification] Click detected on:', e.target, 'with class:', e.target.className);
                console.log('[NemoLore Notification] Target has data-action:', e.target.hasAttribute('data-action'));
                
                if (elementMatches(e.target, '[data-action]')) {
                    clearTimeout(timeoutId);
                    const action = e.target.getAttribute('data-action');
                    console.log('[NemoLore Notification] Action triggered:', action);
                    notification.remove();
                    resolve(action);
                } else {
                    console.log('[NemoLore Notification] Click on non-button element, checking if click is on button...');
                    // Try to find a button parent
                    const button = e.target.closest('[data-action]');
                    if (button) {
                        clearTimeout(timeoutId);
                        const action = button.getAttribute('data-action');
                        console.log('[NemoLore Notification] Action triggered via parent:', action);
                        notification.remove();
                        resolve(action);
                    }
                }
            });
        });
    }

    /**
     * Show a simple message notification (no buttons)
     * @param {string} message - The message to display
     * @param {number} timeout - Auto-dismiss timeout in milliseconds
     */
    showMessage(message, timeout = 5000) {
        return this.show(message, [], timeout);
    }

    /**
     * Show a confirmation notification (Yes/No buttons)
     * @param {string} message - The message to display
     * @param {number} timeout - Auto-dismiss timeout in milliseconds
     * @returns {Promise<boolean>} Promise that resolves to true for 'yes', false otherwise
     */
    showConfirmation(message, timeout = 15000) {
        return this.show(message, [
            { action: 'yes', text: 'Yes' },
            { action: 'no', text: 'No' }
        ], timeout).then(action => action === 'yes');
    }

    /**
     * Add notification styles to the page
     */
    addNotificationStyles() {
        if (document.getElementById('nemolore-notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'nemolore-notification-styles';
        style.textContent = `
            .nemolore-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                max-width: 400px;
                transform: translateX(100%);
                animation: slideIn 0.3s ease-out forwards;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .nemolore-notification-content {
                padding: 20px;
            }

            .nemolore-notification p {
                margin: 0 0 15px 0;
                font-size: 14px;
                line-height: 1.4;
            }

            .nemolore-notification-buttons {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }

            .nemolore-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
                backdrop-filter: blur(10px);
            }

            .nemolore-btn:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }

            .nemolore-btn:active {
                transform: translateY(0);
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Get status information
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            type: 'NotificationManager'
        };
    }

    /**
     * Cleanup
     */
    shutdown() {
        // Remove any active notifications
        const notifications = document.querySelectorAll('.nemolore-notification');
        notifications.forEach(notification => notification.remove());
        
        this.isInitialized = false;
        console.log('[NemoLore NotificationManager] ✅ Shutdown completed');
    }
}

console.log('[NemoLore NotificationManager] Module loaded - Clean notification system ready');