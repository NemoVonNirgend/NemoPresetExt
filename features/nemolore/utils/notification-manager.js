/**
 * Notification Manager
 * RECOVERY VERSION - Modern notification system with proper cleanup
 */

/**
 * Modern Notification System for NemoLore
 */
export class NotificationManager {
    constructor() {
        this.notifications = new Map();
        this.isInitialized = false;
        this.notificationQueue = [];
        this.maxNotifications = 5;
        this.defaultTimeout = 5000;
        
        // Notification types
        this.types = {
            INFO: 'info',
            SUCCESS: 'success',
            WARNING: 'warning',
            ERROR: 'error',
            PROGRESS: 'progress'
        };
        
        console.log('[NemoLore Notification Manager] Constructor completed');
    }

    /**
     * Initialize the notification manager
     */
    initialize() {
        if (this.isInitialized) return;
        
        console.log('[NemoLore Notification Manager] Initializing...');
        
        // Create notification container
        this.createNotificationContainer();
        
        // Set up styles
        this.injectStyles();
        
        // Set up cleanup interval
        this.setupCleanupInterval();
        
        this.isInitialized = true;
        console.log('[NemoLore Notification Manager] ✅ Initialized successfully');
    }

    /**
     * Create notification container
     */
    createNotificationContainer() {
        let container = document.getElementById('nemolore-notifications');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'nemolore-notifications';
            container.className = 'nemolore-notification-container';
            document.body.appendChild(container);
        }
        
        this.container = container;
    }

    /**
     * Inject notification styles
     */
    injectStyles() {
        const styleId = 'nemolore-notification-styles';
        
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .nemolore-notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    pointer-events: none;
                    max-width: 400px;
                }
                
                .nemolore-notification {
                    background: var(--SmartThemeBlurTintColor);
                    border: 1px solid var(--SmartThemeBorderColor);
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 10px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    pointer-events: auto;
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    animation: slideInRight 0.3s ease-out;
                    position: relative;
                    overflow: hidden;
                }
                
                .nemolore-notification.removing {
                    animation: slideOutRight 0.3s ease-in;
                }
                
                .nemolore-notification-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 8px;
                }
                
                .nemolore-notification-title {
                    font-weight: 600;
                    font-size: 0.95em;
                    margin: 0;
                    color: var(--text-color);
                }
                
                .nemolore-notification-close {
                    background: none;
                    border: none;
                    color: var(--text-color);
                    cursor: pointer;
                    font-size: 18px;
                    line-height: 1;
                    padding: 0;
                    margin: 0 0 0 10px;
                    opacity: 0.6;
                    transition: opacity 0.2s ease;
                }
                
                .nemolore-notification-close:hover {
                    opacity: 1;
                }
                
                .nemolore-notification-content {
                    color: var(--text-color);
                    font-size: 0.9em;
                    line-height: 1.4;
                    margin-bottom: 12px;
                }
                
                .nemolore-notification-actions {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                }
                
                .nemolore-notification-button {
                    padding: 6px 12px;
                    border: 1px solid var(--SmartThemeBorderColor);
                    background: var(--SmartThemeBlurTintColor);
                    color: var(--text-color);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.85em;
                    transition: all 0.2s ease;
                }
                
                .nemolore-notification-button:hover {
                    background: var(--customThemeColor);
                    border-color: var(--customThemeColor);
                    color: white;
                    transform: translateY(-1px);
                }
                
                .nemolore-notification-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    background: var(--customThemeColor);
                    border-radius: 0 0 8px 0;
                    transition: width 0.1s ease;
                }
                
                /* Type-specific styles */
                .nemolore-notification.info {
                    border-left: 4px solid var(--customThemeColor);
                }
                
                .nemolore-notification.success {
                    border-left: 4px solid var(--okGreen70a);
                }
                
                .nemolore-notification.warning {
                    border-left: 4px solid var(--golden);
                }
                
                .nemolore-notification.error {
                    border-left: 4px solid #e74c3c;
                }
                
                .nemolore-notification.progress {
                    border-left: 4px solid var(--customThemeColor);
                }
                
                /* Animations */
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                
                /* Dark theme adjustments */
                .dark .nemolore-notification {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }
                
                /* Mobile responsive */
                @media (max-width: 480px) {
                    .nemolore-notification-container {
                        top: 10px;
                        left: 10px;
                        right: 10px;
                        max-width: none;
                    }
                    
                    .nemolore-notification {
                        margin-bottom: 8px;
                    }
                    
                    .nemolore-notification-actions {
                        flex-direction: column;
                    }
                    
                    .nemolore-notification-button {
                        width: 100%;
                    }
                }
            `;
            
            document.head.appendChild(style);
        }
    }

    /**
     * Set up cleanup interval
     */
    setupCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredNotifications();
        }, 1000);
    }

    /**
     * Show notification
     */
    show(options) {
        if (!this.isInitialized) {
            this.initialize();
        }
        
        const notification = this.createNotification(options);
        
        // Limit max notifications
        if (this.notifications.size >= this.maxNotifications) {
            this.removeOldestNotification();
        }
        
        this.notifications.set(notification.id, notification);
        this.container.appendChild(notification.element);
        
        // Set up auto-removal
        if (notification.timeout > 0) {
            notification.timeoutId = setTimeout(() => {
                this.remove(notification.id);
            }, notification.timeout);
        }
        
        return notification.id;
    }

    /**
     * Create notification element
     */
    createNotification(options) {
        const id = this.generateId();
        const type = options.type || this.types.INFO;
        const title = options.title || this.getDefaultTitle(type);
        const content = options.content || '';
        const timeout = options.timeout !== undefined ? options.timeout : this.defaultTimeout;
        const actions = options.actions || [];
        const progress = options.progress !== undefined ? options.progress : null;
        
        // Create notification element
        const element = document.createElement('div');
        element.className = `nemolore-notification ${type}`;
        element.setAttribute('data-id', id);
        
        // Create header
        const header = document.createElement('div');
        header.className = 'nemolore-notification-header';
        
        const titleElement = document.createElement('h4');
        titleElement.className = 'nemolore-notification-title';
        titleElement.textContent = title;
        header.appendChild(titleElement);
        
        // Close button
        const closeButton = document.createElement('button');
        closeButton.className = 'nemolore-notification-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => this.remove(id);
        header.appendChild(closeButton);
        
        element.appendChild(header);
        
        // Create content
        if (content) {
            const contentElement = document.createElement('div');
            contentElement.className = 'nemolore-notification-content';
            contentElement.textContent = content;
            element.appendChild(contentElement);
        }
        
        // Create actions
        if (actions.length > 0) {
            const actionsElement = document.createElement('div');
            actionsElement.className = 'nemolore-notification-actions';
            
            for (const action of actions) {
                const button = document.createElement('button');
                button.className = 'nemolore-notification-button';
                button.textContent = action.text;
                button.onclick = () => {
                    if (action.callback) {
                        action.callback();
                    }
                    if (action.autoClose !== false) {
                        this.remove(id);
                    }
                };
                actionsElement.appendChild(button);
            }
            
            element.appendChild(actionsElement);
        }
        
        // Create progress bar
        let progressElement = null;
        if (progress !== null) {
            progressElement = document.createElement('div');
            progressElement.className = 'nemolore-notification-progress';
            progressElement.style.width = `${Math.max(0, Math.min(100, progress))}%`;
            element.appendChild(progressElement);
        }
        
        return {
            id: id,
            element: element,
            type: type,
            title: title,
            content: content,
            timeout: timeout,
            timeoutId: null,
            created: Date.now(),
            progressElement: progressElement
        };
    }

    /**
     * Update notification progress
     */
    updateProgress(notificationId, progress) {
        const notification = this.notifications.get(notificationId);
        if (notification && notification.progressElement) {
            notification.progressElement.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        }
    }

    /**
     * Update notification content
     */
    updateContent(notificationId, newContent) {
        const notification = this.notifications.get(notificationId);
        if (notification) {
            const contentElement = notification.element.querySelector('.nemolore-notification-content');
            if (contentElement) {
                contentElement.textContent = newContent;
            }
        }
    }

    /**
     * Get default title for notification type
     */
    getDefaultTitle(type) {
        const titles = {
            [this.types.INFO]: 'Information',
            [this.types.SUCCESS]: 'Success',
            [this.types.WARNING]: 'Warning',
            [this.types.ERROR]: 'Error',
            [this.types.PROGRESS]: 'Processing...'
        };
        
        return titles[type] || 'Notification';
    }

    /**
     * Remove notification
     */
    remove(notificationId) {
        const notification = this.notifications.get(notificationId);
        if (!notification) return;
        
        // Clear timeout
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
        }
        
        // Add removing class for animation
        notification.element.classList.add('removing');
        
        // Remove after animation
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(notificationId);
        }, 300);
    }

    /**
     * Remove oldest notification
     */
    removeOldestNotification() {
        let oldest = null;
        for (const notification of this.notifications.values()) {
            if (!oldest || notification.created < oldest.created) {
                oldest = notification;
            }
        }
        
        if (oldest) {
            this.remove(oldest.id);
        }
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        const ids = Array.from(this.notifications.keys());
        for (const id of ids) {
            this.remove(id);
        }
    }

    /**
     * Clean up expired notifications
     */
    cleanupExpiredNotifications() {
        // This is handled by individual timeouts, but we can add additional cleanup here if needed
        
        // Remove any orphaned elements
        const elements = this.container.querySelectorAll('.nemolore-notification');
        for (const element of elements) {
            const id = element.getAttribute('data-id');
            if (!this.notifications.has(id)) {
                element.remove();
            }
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Convenience methods for different notification types
     */
    info(title, content, options = {}) {
        return this.show({
            type: this.types.INFO,
            title: title,
            content: content,
            ...options
        });
    }

    success(title, content, options = {}) {
        return this.show({
            type: this.types.SUCCESS,
            title: title,
            content: content,
            ...options
        });
    }

    warning(title, content, options = {}) {
        return this.show({
            type: this.types.WARNING,
            title: title,
            content: content,
            ...options
        });
    }

    error(title, content, options = {}) {
        return this.show({
            type: this.types.ERROR,
            title: title,
            content: content,
            timeout: 8000, // Longer timeout for errors
            ...options
        });
    }

    progress(title, content, initialProgress = 0, options = {}) {
        return this.show({
            type: this.types.PROGRESS,
            title: title,
            content: content,
            progress: initialProgress,
            timeout: 0, // Don't auto-remove progress notifications
            ...options
        });
    }

    /**
     * Show confirmation dialog
     */
    confirm(title, content, onConfirm, onCancel = null) {
        return this.show({
            type: this.types.INFO,
            title: title,
            content: content,
            timeout: 0,
            actions: [
                {
                    text: 'Cancel',
                    callback: () => {
                        if (onCancel) onCancel();
                    }
                },
                {
                    text: 'Confirm',
                    callback: () => {
                        if (onConfirm) onConfirm();
                    }
                }
            ]
        });
    }

    /**
     * Get statistics
     */
    getStatistics() {
        return {
            activeNotifications: this.notifications.size,
            queuedNotifications: this.notificationQueue.length,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Shutdown the notification manager
     */
    shutdown() {
        console.log('[NemoLore Notification Manager] Shutting down...');
        
        // Clear all notifications
        this.clearAll();
        
        // Clear intervals
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        // Remove container
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.isInitialized = false;
        console.log('[NemoLore Notification Manager] ✅ Shutdown completed');
    }
}

// Export singleton instance
export const notificationManager = new NotificationManager();

// Legacy alias for compatibility
export const NotificationSystem = NotificationManager;

console.log('[NemoLore Notification Manager] Module loaded - Modern notification system ready');