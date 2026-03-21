/**
 * TunnelVision Integration
 * When TunnelVision is installed, injects NG tool activity into TV's feed panel
 * instead of showing a separate NG feed widget. Falls back gracefully when TV is absent.
 *
 * TV DOM structure:
 *   .tv-float-trigger      → trigger button (bottom-left)
 *   .tv-float-panel        → panel container
 *     .tv-float-panel-body → where feed items live
 *     .tv-float-panel-tabs → "All" | "Entries" | "Tools" tabs
 */

const LOG_PREFIX = '[NemosGuides:TVIntegration]';

/** Whether TV was detected and integration is active. */
let tvDetected = false;

/** Reference to TV's feed body for injecting items into "All" and "Tools" tabs. */
let tvFeedBody = null;

/** Reference to our dedicated NG tab body inside TV's panel. */
let ngTabBody = null;

/**
 * Check if TunnelVision's activity feed is present in the DOM.
 * @returns {boolean}
 */
export function isTunnelVisionPresent() {
    return !!document.querySelector('.tv-float-panel');
}

/**
 * Initialize TV integration.
 * Call this after the NG activity feed is initialized.
 * If TV is detected, hides the NG trigger and prepares to inject into TV's feed.
 */
export function initTVIntegration() {
    // Check immediately
    if (detectTV()) return;

    // TV's feed might appear later (lazy init when lorebook is enabled)
    // Use a MutationObserver to detect when it appears
    const observer = new MutationObserver(() => {
        if (!tvDetected && detectTV()) {
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: false });

    // Stop observing after 30 seconds to avoid indefinite watching
    setTimeout(() => observer.disconnect(), 30000);
}

/**
 * Try to detect TV's feed and set up integration.
 * @returns {boolean} Whether TV was detected
 */
function detectTV() {
    const panel = document.querySelector('.tv-float-panel');
    if (!panel) return false;

    tvFeedBody = panel.querySelector('.tv-float-panel-body');
    if (!tvFeedBody) return false;

    tvDetected = true;

    // Hide NG's own trigger button — TV's feed will show our items
    const ngTrigger = document.querySelector('.ng-feed-trigger');
    if (ngTrigger) {
        ngTrigger.style.display = 'none';
    }

    // Hide NG's own panel
    const ngPanel = document.querySelector('.ng-feed-panel');
    if (ngPanel) {
        ngPanel.style.display = 'none';
    }

    // Inject "NG" tab into TV's tab bar
    injectNGTab(panel);

    console.log(`${LOG_PREFIX} TunnelVision detected — injecting NG activity into TV feed.`);
    return true;
}

/**
 * Inject the NG tab and its content area into TV's panel.
 * @param {HTMLElement} panel - TV's .tv-float-panel
 */
function injectNGTab(panel) {
    const tabs = panel.querySelector('.tv-float-panel-tabs');
    if (!tabs) return;

    // Don't inject twice
    if (tabs.querySelector('[data-tab="ng"]')) return;

    // Create NG tab button
    const ngTab = document.createElement('button');
    ngTab.className = 'tv-float-tab';
    ngTab.dataset.tab = 'ng';
    ngTab.innerHTML = '<span class="ng-tv-badge" style="margin-right: 2px;">NG</span> Guides';
    tabs.appendChild(ngTab);

    // Create NG content body (hidden by default)
    ngTabBody = document.createElement('div');
    ngTabBody.className = 'tv-float-panel-body ng-tv-tab-body';
    ngTabBody.style.display = 'none';
    ngTabBody.innerHTML = `
        <div class="ng-tv-tab-content">
            <div class="ng-tv-section">
                <div class="ng-tv-section-header">
                    <i class="fa-solid fa-scroll" style="color: #e17055;"></i> Story Rules
                </div>
                <div class="ng-tv-section-body" data-ng-section="rules">
                    <small class="ng-tv-empty">No rules generated yet</small>
                </div>
            </div>
            <div class="ng-tv-section">
                <div class="ng-tv-section-header">
                    <i class="fa-solid fa-magnifying-glass-chart" style="color: #a29bfe;"></i> Scene Trackers
                </div>
                <div class="ng-tv-section-body" data-ng-section="trackers">
                    <small class="ng-tv-empty">No scene data yet</small>
                </div>
            </div>
            <div class="ng-tv-section">
                <div class="ng-tv-section-header">
                    <i class="fa-solid fa-book-open" style="color: #a29bfe;"></i> DM Notes
                </div>
                <div class="ng-tv-section-body" data-ng-section="dm-notes">
                    <small class="ng-tv-empty">No notes yet</small>
                </div>
            </div>
            <div class="ng-tv-section">
                <div class="ng-tv-section-header">
                    <i class="fa-solid fa-spell-check" style="color: #fdcb6e;"></i> Writing Quality
                </div>
                <div class="ng-tv-section-body" data-ng-section="writing">
                    <small class="ng-tv-empty">No analysis yet — runs after 3+ AI messages</small>
                </div>
            </div>
            <div class="ng-tv-section">
                <div class="ng-tv-section-header">
                    <i class="fa-solid fa-timeline" style="color: #6c5ce7;"></i> Tool Activity
                </div>
                <div class="ng-tv-section-body" data-ng-section="activity">
                    <small class="ng-tv-empty">No tool activity yet</small>
                </div>
            </div>
        </div>
    `;

    // Insert after the main feed body
    tvFeedBody.parentNode.insertBefore(ngTabBody, tvFeedBody.nextSibling);

    // Wire up tab switching — intercept clicks on ALL tabs
    tabs.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-tab]');
        if (!tab) return;

        const isNG = tab.dataset.tab === 'ng';

        // Toggle visibility of main TV body vs NG body
        tvFeedBody.style.display = isNG ? 'none' : '';
        ngTabBody.style.display = isNG ? '' : 'none';

        // Update active states on all tabs
        tabs.querySelectorAll('.tv-float-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // If switching to NG, refresh the content
        if (isNG) {
            refreshNGTabContent();
            refreshIntegrationStatus();
        }
    });
}

/**
 * Refresh the content of the NG tab sections.
 * Reads current state from lorebook trackers and analyzer.
 */
async function refreshNGTabContent() {
    if (!ngTabBody) return;

    // Import dynamically to avoid circular deps
    const { getTrackerContent } = await import('./lorebook-manager.js');
    const { getLastAnalysis } = await import('./writing-analyzer.js');

    // Rules
    const rulesSection = ngTabBody.querySelector('[data-ng-section="rules"]');
    if (rulesSection) {
        const rules = await getTrackerContent('rules');
        rulesSection.innerHTML = rules
            ? `<pre class="ng-tv-content">${escapeHtml(rules.substring(0, 1000))}${rules.length > 1000 ? '\n...(truncated)' : ''}</pre>`
            : '<small class="ng-tv-empty">No rules generated yet</small>';
    }

    // Trackers
    const trackersSection = ngTabBody.querySelector('[data-ng-section="trackers"]');
    if (trackersSection) {
        const trackerTypes = ['clothing', 'positions', 'situation', 'thinking'];
        const parts = [];
        for (const type of trackerTypes) {
            const content = await getTrackerContent(type);
            if (content) {
                parts.push(`<div class="ng-tv-tracker"><strong>${type}:</strong> ${escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}</div>`);
            }
        }
        trackersSection.innerHTML = parts.length > 0
            ? parts.join('')
            : '<small class="ng-tv-empty">No scene data yet</small>';
    }

    // DM Notes
    const dmSection = ngTabBody.querySelector('[data-ng-section="dm-notes"]');
    if (dmSection) {
        const notes = await getTrackerContent('dm_notes');
        dmSection.innerHTML = notes
            ? `<pre class="ng-tv-content">${escapeHtml(notes.substring(0, 800))}${notes.length > 800 ? '\n...(truncated)' : ''}</pre>`
            : '<small class="ng-tv-empty">No notes yet</small>';
    }

    // Writing quality
    const writingSection = ngTabBody.querySelector('[data-ng-section="writing"]');
    if (writingSection) {
        const analysis = getLastAnalysis();
        if (analysis && analysis.messagesAnalyzed >= 2) {
            const parts = [];
            if (analysis.repeatedPhrases?.length) parts.push(`<div>Repeated: ${analysis.repeatedPhrases.map(p => `"${escapeHtml(p.phrase)}" (${p.count}x)`).join(', ')}</div>`);
            if (analysis.overusedWords?.length) parts.push(`<div>Overused: ${analysis.overusedWords.map(w => `"${escapeHtml(w.word)}" (${w.count}x)`).join(', ')}</div>`);
            if (analysis.slopResults?.length) parts.push(`<div>Slop: ${analysis.slopResults.map(c => `${c.category} (${c.matches.length})`).join(', ')}</div>`);
            writingSection.innerHTML = parts.length > 0
                ? `<div class="ng-tv-analysis">${parts.join('')}</div>`
                : '<small class="ng-tv-empty">Writing looks clean</small>';
        } else {
            writingSection.innerHTML = '<small class="ng-tv-empty">Need 3+ AI messages to analyze</small>';
        }
    }
}

/**
 * Refresh the integration status section in the NG tab.
 */
async function refreshIntegrationStatus() {
    if (!ngTabBody) return;

    try {
        const { getIntegrationStatus } = await import('./tv-bridge.js');
        const status = await getIntegrationStatus();

        // Find or create integration section
        let section = ngTabBody.querySelector('[data-ng-section="integration"]');
        if (!section) {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'ng-tv-section';
            sectionEl.innerHTML = `
                <div class="ng-tv-section-header">
                    <i class="fa-solid fa-link" style="color: #00cec9;"></i> TV Integration
                </div>
                <div class="ng-tv-section-body" data-ng-section="integration"></div>
            `;
            ngTabBody.querySelector('.ng-tv-tab-content')?.appendChild(sectionEl);
            section = ngTabBody.querySelector('[data-ng-section="integration"]');
        }

        if (!section) return;

        if (!status.available) {
            section.innerHTML = '<small class="ng-tv-empty">TunnelVision bridge not connected</small>';
            return;
        }

        const parts = [];
        parts.push(`<div>Active lorebooks: ${status.activeBooks?.length || 0}</div>`);
        parts.push(`<div>TV trackers: ${status.tvTrackers?.length || 0}</div>`);

        if (status.trackerOverlap?.overlapping?.length > 0) {
            parts.push(`<div style="color: #fdcb6e;">Overlap detected: ${status.trackerOverlap.overlapping.join(', ')}</div>`);
        } else {
            parts.push(`<div style="color: #55efc4;">No tracker overlap — NG and TV complement each other</div>`);
        }

        section.innerHTML = `<div class="ng-tv-analysis">${parts.join('')}</div>`;
    } catch (error) {
        console.warn(`${LOG_PREFIX} Integration status refresh failed:`, error);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Check if TV integration is active.
 * @returns {boolean}
 */
export function isTVIntegrationActive() {
    return tvDetected && !!tvFeedBody;
}

/**
 * Inject an NG feed item into TV's feed panel.
 * Matches TV's item styling so NG items look native.
 * @param {object} item - Feed item data
 * @param {string} item.icon - FontAwesome icon class
 * @param {string} item.verb - Action verb (e.g. "Assessing")
 * @param {string} item.displayName - Tool display name
 * @param {string} item.color - Accent color
 * @param {'running'|'done'|'error'} item.status
 * @param {string} item.summary
 * @param {number} item.timestamp
 * @returns {HTMLElement|null} The created element, or null if TV not active
 */
export function injectIntoTVFeed(item) {
    if (!tvDetected || !tvFeedBody) return null;

    // Remove the "No activity yet" placeholder if present
    const empty = tvFeedBody.querySelector('.tv-float-empty');
    if (empty) empty.style.display = 'none';

    const el = document.createElement('div');
    el.className = 'tv-float-item ng-tv-item';
    el.dataset.source = 'nemos-guides';
    el.dataset.status = item.status;

    const statusIcon = item.status === 'running'
        ? '<i class="fa-solid fa-spinner fa-spin"></i>'
        : item.status === 'done'
            ? '<i class="fa-solid fa-check"></i>'
            : '<i class="fa-solid fa-xmark"></i>';

    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    el.innerHTML = `
        <div class="tv-float-item-icon" style="color: ${item.color}">
            <i class="fa-solid ${item.icon}"></i>
        </div>
        <div class="tv-float-item-body">
            <div class="tv-float-item-header">
                <span class="ng-tv-badge">NG</span>
                <span class="tv-float-item-verb" style="color: ${item.color}">${item.verb}</span>
                <span class="tv-float-item-name">${item.displayName}</span>
                <span class="tv-float-item-status">${statusIcon}</span>
            </div>
            <div class="tv-float-item-summary">${item.summary || ''}</div>
            <div class="tv-float-item-time">${time}</div>
        </div>
    `;

    // Insert at top of TV's main feed body (visible on "All" and "Tools" tabs)
    tvFeedBody.prepend(el);

    // Also add a copy to the NG tab's activity section
    if (ngTabBody) {
        const activitySection = ngTabBody.querySelector('[data-ng-section="activity"]');
        if (activitySection) {
            const empty = activitySection.querySelector('.ng-tv-empty');
            if (empty) empty.style.display = 'none';
            const clone = el.cloneNode(true);
            activitySection.prepend(clone);
        }
    }

    // Add entry animation
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
    });

    return el;
}

/**
 * Update an existing NG item in TV's feed.
 * @param {HTMLElement} el - The element to update
 * @param {object} updates
 * @param {'done'|'error'} updates.status
 * @param {string} [updates.summary]
 */
export function updateTVFeedItem(el, updates) {
    if (!el) return;

    el.dataset.status = updates.status;

    const statusEl = el.querySelector('.tv-float-item-status');
    if (statusEl) {
        statusEl.innerHTML = updates.status === 'done'
            ? '<i class="fa-solid fa-check" style="color: #55efc4"></i>'
            : '<i class="fa-solid fa-xmark" style="color: #ef4444"></i>';
    }

    if (updates.summary) {
        const summaryEl = el.querySelector('.tv-float-item-summary');
        if (summaryEl) summaryEl.textContent = updates.summary;
    }
}
