/**
 * UIManager - Handles Summary Viewer and Export Functions
 * Extracted from original NemoLore for UI interaction handling
 */

// SillyTavern imports - will be loaded dynamically
let getCurrentChatId, getContext, callPopup;

/**
 * Initialize SillyTavern imports dynamically
 */
async function initializeSillyTavernImports() {
    try {
        const scriptModule = await import('../../../../../../script.js').catch(() => null);
        
        if (scriptModule) {
            getCurrentChatId = scriptModule.getCurrentChatId || (() => 'default');
            getContext = scriptModule.getContext || (() => ({ chat: [] }));
            callPopup = scriptModule.callPopup;
        }
        
        console.log('[NemoLore UIManager] SillyTavern imports initialized');
        return true;
    } catch (error) {
        console.warn('[NemoLore UIManager] Failed to initialize SillyTavern imports:', error);
        // Provide fallback values
        getCurrentChatId = () => 'default';
        getContext = () => ({ chat: [] });
        callPopup = (content) => Promise.resolve(true);
        return false;
    }
}

/**
 * UIManager Class - Handles UI interactions like summary viewer
 */
export class UIManager {
    constructor(settings, state, memoryManager = null) {
        this.settings = settings;
        this.state = state;
        this.memoryManager = memoryManager;
        this.dashboardManager = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the UI Manager
     */
    async initialize() {
        if (this.isInitialized) return;

        console.log('[NemoLore UIManager] Initializing UI Manager...');
        await initializeSillyTavernImports();
        this.isInitialized = true;
        console.log('[NemoLore UIManager] ✅ UI Manager initialized');
    }

    /**
     * Set the dashboard manager reference
     */
    setDashboardManager(dashboardManager) {
        this.dashboardManager = dashboardManager;
        console.log('[NemoLore UIManager] Dashboard manager set');
    }

    /**
     * Add top bar button for NemoLore dashboard using SillyTavern's drawer pattern
     */
    addTopBarButton() {
        console.log('[NemoLore UIManager] Adding top bar button...');

        const tryAddButton = () => {
            // Check if button already exists
            if (document.getElementById('nemolore-button')) {
                console.log('[NemoLore UIManager] Top bar button already exists');
                return true;
            }

            // Find the extensions settings button to insert after it
            const extensionsButton = document.getElementById('extensions-settings-button');
            if (!extensionsButton) {
                console.warn('[NemoLore UIManager] Extensions settings button not found');
                return false;
            }

            // Create drawer structure matching SillyTavern's pattern
            const drawerHtml = `
                <div id="nemolore-button" class="drawer">
                    <div class="drawer-toggle drawer-header">
                        <div class="drawer-icon fa-solid fa-chart-line fa-fw closedIcon" title="NemoLore Dashboard"></div>
                    </div>
                    <div id="nemolore-drawer-content" class="drawer-content closedDrawer" style="display: none;">
                        <!-- Dashboard will be shown here or as overlay -->
                    </div>
                </div>
            `;

            // Insert after extensions button
            $(extensionsButton).after(drawerHtml);

            // Attach click handler using the SillyTavern pattern
            const self = this;
            $('#nemolore-button .drawer-toggle').on('click', function() {
                if (self.dashboardManager) {
                    self.dashboardManager.toggleDashboard();
                } else if (window.nemoloreDashboardManager) {
                    window.nemoloreDashboardManager.toggleDashboard();
                } else {
                    console.warn('[NemoLore UIManager] Dashboard manager not available');
                }
            });

            console.log('[NemoLore UIManager] ✅ Top bar button added successfully');
            return true;
        };

        // Try multiple times with increasing delays
        const retryDelays = [0, 500, 1000, 2000, 3000];
        let retryIndex = 0;

        const attemptAdd = () => {
            if (tryAddButton()) return;

            retryIndex++;
            if (retryIndex < retryDelays.length) {
                console.log(`[NemoLore UIManager] Retrying button add in ${retryDelays[retryIndex]}ms (attempt ${retryIndex + 1}/${retryDelays.length})`);
                setTimeout(attemptAdd, retryDelays[retryIndex]);
            } else {
                console.error('[NemoLore UIManager] Failed to add top bar button after all retries');
            }
        };

        attemptAdd();
    }

    /**
     * Show summary viewer popup - extracted from original NemoLore
     */
    showSummaryViewer() {
        const chatId = getCurrentChatId();
        if (!chatId) {
            this.showError('No active chat found');
            return;
        }

        const summariesInOrder = [];
        const context = getContext();
        if (!context || !context.chat) {
            this.showError('Cannot access chat context');
            return;
        }

        // Get summaries from memory manager using new getAllSummariesForContext method
        let allSummaries = [];
        if (this.memoryManager && this.memoryManager.getAllSummariesForContext) {
            allSummaries = this.memoryManager.getAllSummariesForContext();
        }

        // Convert to display format
        allSummaries.forEach((summaryData, index) => {
            if (summaryData && summaryData.text) {
                summariesInOrder.push({
                    messageIndex: `Group ${index + 1}`,
                    speaker: summaryData.type || 'Conversation',
                    summary: summaryData.text,
                    timestamp: summaryData.created ? new Date(summaryData.created).toLocaleString() : 'Unknown',
                    isCoreMemory: summaryData.isCoreMemory || false,
                    isPaired: summaryData.messageCount > 1,
                    pairedIndices: summaryData.messageCount ? [`${summaryData.messageCount} messages`] : ['1 message'],
                    originalLength: summaryData.metadata?.originalLength || 'Unknown'
                });
            }
        });

        if (summariesInOrder.length === 0) {
            this.showInfo('No summaries available yet. Summaries are generated automatically as conversations progress.');
            return;
        }

        // Create summary display HTML
        const summaryCount = summariesInOrder.length;
        const coreMemoryCount = summariesInOrder.filter(s => s.isCoreMemory).length;
        const pairedCount = summariesInOrder.filter(s => s.isPaired).length;

        let summaryHtml = `
            <div style="max-width: 800px; max-height: 600px; overflow-y: auto; padding: 20px;">
                <h2 style="color: var(--customThemeColor); margin-bottom: 20px;">
                    📚 NemoLore Chat Summaries
                </h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; text-align: center;">
                    <div style="background: var(--SmartThemeQuoteColor); padding: 10px; border-radius: 8px;">
                        <strong>${summaryCount}</strong><br>
                        <small>Total Summaries</small>
                    </div>
                    <div style="background: var(--customThemeColor); padding: 10px; border-radius: 8px;">
                        <strong>${coreMemoryCount}</strong><br>
                        <small>Core Memories</small>
                    </div>
                    <div style="background: var(--SmartThemeBlurTintColor); padding: 10px; border-radius: 8px;">
                        <strong>${pairedCount}</strong><br>
                        <small>Paired Messages</small>
                    </div>
                </div>
                <div style="border: 1px solid var(--SmartThemeBorderColor); border-radius: 10px; padding: 15px;">
        `;

        summariesInOrder.forEach((summary, index) => {
            const memoryIcon = summary.isCoreMemory ? '🌟' : '📝';
            const pairedIcon = summary.isPaired ? '🔗' : '';
            const pairedText = summary.isPaired ? `(Messages ${summary.pairedIndices.join(', ')})` : `(Message ${summary.messageIndex})`;
            
            summaryHtml += `
                <div style="border-bottom: 1px solid var(--SmartThemeBorderColor); padding: 15px 0; ${index === summariesInOrder.length - 1 ? 'border-bottom: none;' : ''}">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 18px;">${memoryIcon}</span>
                        <strong style="color: var(--customThemeColor);">${summary.speaker}</strong>
                        <span style="font-size: 12px;">${pairedIcon}</span>
                        <span style="color: var(--SmartThemeQuoteColor); font-size: 12px;">${pairedText}</span>
                        <span style="color: var(--SmartThemeQuoteColor); font-size: 12px; margin-left: auto;">${summary.timestamp}</span>
                    </div>
                    <div style="background: var(--SmartThemeBlurTintColor); padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.4;">
                        ${summary.summary}
                    </div>
                    <div style="margin-top: 8px; font-size: 11px; color: var(--SmartThemeQuoteColor);">
                        Original length: ${summary.originalLength} characters
                    </div>
                </div>
            `;
        });

        summaryHtml += `
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <p style="color: var(--SmartThemeQuoteColor); font-size: 13px;">
                        💡 Use the <strong>{{NemoLore}}</strong> or <strong>{{nemolore_summaries}}</strong> macro in your prompts to inject these summaries automatically.
                    </p>
                </div>
            </div>
        `;

        callPopup(summaryHtml, 'text');
    }

    /**
     * Export summaries to JSON - extracted from original NemoLore
     */
    exportSummariesToJSON() {
        const chatId = getCurrentChatId();
        if (!chatId) {
            this.showError('No active chat found');
            return;
        }

        const context = getContext();
        if (!context || !context.chat) {
            this.showError('Cannot access chat context');
            return;
        }

        const exportData = {
            chatId: chatId,
            exportedAt: new Date().toISOString(),
            totalMessages: context.chat.length,
            summaryCount: 0,
            summaries: []
        };

        // Get summaries from memory manager using the new method
        if (this.memoryManager && this.memoryManager.getAllSummariesForContext) {
            const allSummaries = this.memoryManager.getAllSummariesForContext();
            exportData.summaryCount = allSummaries.length;

            // Convert to export format
            allSummaries.forEach(summaryData => {
                const messageIndex = summaryData.messageIndex;
                const messageInfo = context.chat[messageIndex];
                if (messageInfo) {
                    const isUser = messageInfo.is_user === true || messageInfo.is_system === false;

                    exportData.summaries.push({
                        messageIndex: messageIndex,
                        speaker: isUser ? 'User' : 'Character',
                        summary: summaryData.text,
                        timestamp: summaryData.created,
                        isCoreMemory: summaryData.isCoreMemory || false,
                        isPaired: summaryData.messageCount > 1,
                        type: summaryData.type,
                        originalMessage: messageInfo.mes,
                        originalLength: messageInfo.mes.length
                    });
                }
            });
        }

        if (exportData.summaries.length === 0) {
            this.showInfo('No summaries available to export yet.');
            return;
        }

        // Create and trigger download
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `nemolore_summaries_${chatId}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showSuccess(`✅ Exported ${exportData.summaries.length} summaries to JSON file!`);
    }

    /**
     * Run system check
     */
    runSystemCheck() {
        const results = {
            memoryManager: this.memoryManager ? '✅ Available' : '❌ Not available',
            chatContext: getContext() ? '✅ Accessible' : '❌ Not accessible',
            chatId: getCurrentChatId() ? '✅ Available' : '❌ Not available',
            summaryCount: 0
        };

        if (this.memoryManager && this.memoryManager.getSummaryCount) {
            results.summaryCount = this.memoryManager.getSummaryCount();
        }

        const systemHtml = `
            <div style="padding: 20px; max-width: 500px;">
                <h3 style="color: var(--customThemeColor); margin-bottom: 15px;">
                    🔧 NemoLore System Check
                </h3>
                <div style="font-family: monospace; line-height: 1.6;">
                    <strong>Core Components:</strong><br>
                    Memory Manager: ${results.memoryManager}<br>
                    Chat Context: ${results.chatContext}<br>
                    Chat ID: ${results.chatId}<br>
                    Summary Count: ${results.summaryCount}<br>
                </div>
                <div style="margin-top: 15px; padding: 10px; background: var(--SmartThemeBlurTintColor); border-radius: 6px;">
                    <small><strong>Status:</strong> ${Object.values(results).every(r => r.includes('✅')) ? 'All systems operational' : 'Some issues detected'}</small>
                </div>
            </div>
        `;

        callPopup(systemHtml, 'text');
    }

    /**
     * Helper methods for notifications
     */
    showError(message) {
        if (typeof toastr !== 'undefined') {
            toastr.error(message, 'NemoLore');
        } else {
            console.error(`[NemoLore UIManager] ${message}`);
            callPopup(`<div style="padding: 15px; color: red;">${message}</div>`, 'text');
        }
    }

    showInfo(message) {
        if (typeof toastr !== 'undefined') {
            toastr.info(message, 'NemoLore');
        } else {
            console.info(`[NemoLore UIManager] ${message}`);
            callPopup(`<div style="padding: 15px;">${message}</div>`, 'text');
        }
    }

    showSuccess(message) {
        if (typeof toastr !== 'undefined') {
            toastr.success(message, 'NemoLore');
        } else {
            console.info(`[NemoLore UIManager] ${message}`);
            callPopup(`<div style="padding: 15px; color: green;">${message}</div>`, 'text');
        }
    }

    /**
     * Get status information
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            hasMemoryManager: !!this.memoryManager,
            type: 'UIManager'
        };
    }

    /**
     * Cleanup
     */
    shutdown() {
        this.isInitialized = false;
        console.log('[NemoLore UIManager] ✅ Shutdown completed');
    }
}

console.log('[NemoLore UIManager] Module loaded - UI interaction system ready');