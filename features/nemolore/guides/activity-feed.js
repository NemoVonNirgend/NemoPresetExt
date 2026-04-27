/**
 * NemoLore Guides Activity Feed
 * Floating widget that shows real-time tool call activity with animations.
 * Fades in when a tool is invoked, drops down and fades when it completes.
 */

import { eventSource, event_types } from '/script.js';
import { getToolDisplayName, isGuidesToolName } from './tool-registry.js';
import { initTVIntegration, isTVIntegrationActive, injectIntoTVFeed, updateTVFeedItem } from './tv-integration.js';

const LOG_PREFIX = '[NemoLore:Guides:Feed]';
const MAX_FEED_ITEMS = 30;
const COMPLETED_DISPLAY_MS = 8000;

/** Tool display config — icon, color, verb. */
const TOOL_DISPLAY = {
    NLG_rule_setup:       { icon: 'fa-scroll',                  verb: 'Setting Rules', color: '#e17055' },
    NLG_scene_assessment: { icon: 'fa-magnifying-glass-chart',  verb: 'Assessing',     color: '#a29bfe' },
    NLG_plan_and_refine:  { icon: 'fa-compass-drafting',        verb: 'Planning',      color: '#6c5ce7' },
    NLG_polish_prose:     { icon: 'fa-feather-pointed',         verb: 'Polishing',     color: '#55efc4' },
    NLG_writing_check:    { icon: 'fa-spell-check',              verb: 'Checking',      color: '#fdcb6e' },
    NLG_dm_notes:         { icon: 'fa-book-open',                verb: 'Noting',        color: '#a29bfe' },
    NLG_roll_dice:        { icon: 'fa-dice-d20',                 verb: 'Rolling',       color: '#fab1a0' },
};

/**
 * @typedef {Object} FeedItem
 * @property {number} id
 * @property {string} toolName
 * @property {string} displayName
 * @property {string} icon
 * @property {string} verb
 * @property {string} color
 * @property {'running'|'done'|'error'} status
 * @property {string} [summary]
 * @property {number} timestamp
 * @property {HTMLElement} [element]
 */

/** @type {FeedItem[]} */
let feedItems = [];
let nextId = 0;
let feedInitialized = false;

/** @type {HTMLElement|null} */
let triggerEl = null;
/** @type {HTMLElement|null} */
let panelEl = null;
/** @type {HTMLElement|null} */
let panelBody = null;
/** @type {HTMLElement|null} */
let badgeEl = null;

let activeCount = 0;

// ── Initialization ──

/**
 * Initialize the activity feed — create floating widget and bind events.
 */
export function initActivityFeed() {
    if (feedInitialized) return;
    feedInitialized = true;

    createTriggerButton();
    createPanel();

    // Check for TunnelVision and integrate if present
    initTVIntegration();

    // Listen for tool call completions
    if (event_types.TOOL_CALLS_PERFORMED) {
        eventSource.on(event_types.TOOL_CALLS_PERFORMED, onToolCallsPerformed);
    }

    // Clear feed on chat change
    if (event_types.CHAT_CHANGED) {
        eventSource.on(event_types.CHAT_CHANGED, () => {
            clearFeed();
            document.querySelectorAll('.nlg-feed-details').forEach(el => el.remove());
        });
    }

    console.log(`${LOG_PREFIX} Activity feed initialized.`);
}

// ── Event Handlers ──

/**
 * Handle completed tool calls.
 * @param {import('../../../tool-calling.js').ToolInvocation[]} invocations
 */
function onToolCallsPerformed(invocations) {
    if (!Array.isArray(invocations)) return;

    for (const inv of invocations) {
        if (!inv?.name || !isGuidesToolName(inv.name)) continue;

        const display = TOOL_DISPLAY[inv.name] || {
            icon: 'fa-gear',
            verb: 'Invoked',
            color: '#b2bec3',
        };

        const item = {
            id: nextId++,
            toolName: inv.name,
            displayName: getToolDisplayName(inv.name) || inv.displayName || inv.name,
            icon: display.icon,
            verb: display.verb,
            color: display.color,
            status: inv.result?.startsWith?.('Error') ? 'error' : 'done',
            summary: formatSummary(inv),
            timestamp: Date.now(),
        };

        addFeedItem(item);
    }
}

/**
 * Format a brief summary from tool invocation result.
 * @param {object} inv
 * @returns {string}
 */
function formatSummary(inv) {
    const result = inv.result || '';
    if (result.startsWith('Error')) return result.substring(0, 100);
    const len = result.length;
    if (len === 0) return 'No output';
    return `${len} chars generated`;
}

// ── Feed Management ──

function addFeedItem(item) {
    feedItems.unshift(item);
    if (feedItems.length > MAX_FEED_ITEMS) {
        const removed = feedItems.pop();
        removed?.element?.remove();
    }

    updateBadge();
    renderItem(item);

    // Auto-show panel briefly when tool completes
    if (panelEl && !panelEl.classList.contains('nlg-feed-open')) {
        showPanel();
    }

    // Auto-fade completed items after delay
    setTimeout(() => {
        fadeOutItem(item);
    }, COMPLETED_DISPLAY_MS);
}

function clearFeed() {
    feedItems = [];
    activeCount = 0;
    if (panelBody) panelBody.innerHTML = '';
    updateBadge();
}

// ── Rendering ──

function renderItem(item) {
    if (!panelBody) return;

    const el = document.createElement('div');
    el.className = 'nlg-feed-item nlg-feed-enter';
    el.dataset.id = String(item.id);
    el.dataset.status = item.status;
    el.style.setProperty('--tool-color', item.color);

    el.innerHTML = `
        <div class="nlg-feed-item-icon">
            <i class="fa-solid ${item.icon}" style="color: ${item.color}"></i>
        </div>
        <div class="nlg-feed-item-content">
            <div class="nlg-feed-item-header">
                <span class="nlg-feed-item-verb" style="color: ${item.color}">${item.verb}</span>
                <span class="nlg-feed-item-name">${item.displayName}</span>
                <span class="nlg-feed-item-status nlg-status-${item.status}">
                    ${item.status === 'done' ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>'}
                </span>
            </div>
            <div class="nlg-feed-item-summary">${item.summary || ''}</div>
            <div class="nlg-feed-item-time">${formatTime(item.timestamp)}</div>
        </div>
    `;

    item.element = el;
    panelBody.prepend(el);

    // Trigger enter animation on next frame
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.classList.remove('nlg-feed-enter');
            el.classList.add('nlg-feed-visible');
        });
    });
}

function fadeOutItem(item) {
    if (!item.element) return;
    const el = item.element;
    el.classList.remove('nlg-feed-visible');
    el.classList.add('nlg-feed-exit');

    el.addEventListener('animationend', () => {
        el.classList.remove('nlg-feed-exit');
        el.classList.add('nlg-feed-faded');
    }, { once: true });
}

function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateBadge() {
    if (!badgeEl) return;
    const count = feedItems.filter(i => i.status === 'done' && !i.element?.classList.contains('nlg-feed-faded')).length;
    badgeEl.textContent = String(count);
    badgeEl.style.display = count > 0 ? '' : 'none';
}

// ── UI Construction ──

function createTriggerButton() {
    triggerEl = document.createElement('div');
    triggerEl.id = 'nlg-feed-trigger';
    triggerEl.className = 'nlg-feed-trigger';
    triggerEl.title = 'NemoLore Guides - Activity Feed';
    triggerEl.innerHTML = `
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span class="nlg-feed-badge" style="display:none">0</span>
    `;

    badgeEl = triggerEl.querySelector('.nlg-feed-badge');

    triggerEl.addEventListener('click', () => {
        if (panelEl?.classList.contains('nlg-feed-open')) {
            hidePanel();
        } else {
            showPanel();
        }
    });

    document.body.appendChild(triggerEl);
}

function createPanel() {
    panelEl = document.createElement('div');
    panelEl.id = 'nlg-feed-panel';
    panelEl.className = 'nlg-feed-panel';

    panelEl.innerHTML = `
        <div class="nlg-feed-panel-header">
            <span class="nlg-feed-panel-title">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                Guides Activity
            </span>
            <div class="nlg-feed-panel-actions">
                <span class="nlg-feed-clear" title="Clear feed">
                    <i class="fa-solid fa-trash-can"></i>
                </span>
                <span class="nlg-feed-close" title="Close">
                    <i class="fa-solid fa-xmark"></i>
                </span>
            </div>
        </div>
        <div class="nlg-feed-panel-body"></div>
        <div class="nlg-feed-panel-empty">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
            <span>No tool activity yet</span>
        </div>
    `;

    panelBody = panelEl.querySelector('.nlg-feed-panel-body');

    panelEl.querySelector('.nlg-feed-close').addEventListener('click', hidePanel);
    panelEl.querySelector('.nlg-feed-clear').addEventListener('click', () => {
        clearFeed();
    });

    document.body.appendChild(panelEl);
}

function showPanel() {
    panelEl?.classList.add('nlg-feed-open');
    triggerEl?.classList.add('nlg-feed-active');
}

function hidePanel() {
    panelEl?.classList.remove('nlg-feed-open');
    triggerEl?.classList.remove('nlg-feed-active');
}

/**
 * Notify the feed that an NLG tool has started running.
 * Called from sidecar.js before generation begins.
 * @param {string} toolName
 * @param {object} [params]
 * @returns {number} feedItemId — pass to notifyToolComplete when done
 */
export function notifyToolStart(toolName, params = {}) {
    const display = TOOL_DISPLAY[toolName] || {
        icon: 'fa-gear',
        verb: 'Running',
        color: '#b2bec3',
    };

    const item = {
        id: nextId++,
        toolName,
        displayName: getToolDisplayName(toolName) || toolName,
        icon: display.icon,
        verb: display.verb,
        color: display.color,
        status: 'running',
        summary: params?.focus || params?.direction || params?.topic || 'Working...',
        timestamp: Date.now(),
    };

    activeCount++;

    // If TunnelVision is active, inject into TV's feed instead
    if (isTVIntegrationActive()) {
        const tvEl = injectIntoTVFeed(item);
        item.tvElement = tvEl;
    }

    addFeedItemRunning(item);
    return item.id;
}

/**
 * Notify the feed that an NLG tool has finished.
 * @param {number} feedItemId
 * @param {boolean} success
 * @param {string} [resultSummary]
 * @param {object} [details] - Full result details for the expandable view
 * @param {string} [details.fullResult] - The complete generated text
 * @param {string[]} [details.storedIn] - Where the result was saved (e.g. "lorebook: [NLG] Clothing", "variable: nlg_last_clothing")
 */
export function notifyToolComplete(feedItemId, success, resultSummary, details) {
    const item = feedItems.find(i => i.id === feedItemId);
    if (!item) return;

    activeCount = Math.max(0, activeCount - 1);
    item.status = success ? 'done' : 'error';
    item.summary = resultSummary || item.summary;
    item.details = details || null;

    if (item.element) {
        item.element.dataset.status = item.status;
        const statusEl = item.element.querySelector('.nlg-feed-item-status');
        if (statusEl) {
            statusEl.className = `nlg-feed-item-status nlg-status-${item.status}`;
            statusEl.innerHTML = success
                ? '<i class="fa-solid fa-check"></i>'
                : '<i class="fa-solid fa-xmark"></i>';
        }
        const summaryEl = item.element.querySelector('.nlg-feed-item-summary');
        if (summaryEl) {
            summaryEl.textContent = item.summary;
        }

        // Mark as clickable if we have details
        if (details?.fullResult) {
            item.element.classList.add('nlg-feed-clickable');
            item.element.title = 'Click to view full result';
        }

        // Trigger completion animation
        item.element.classList.add('nlg-feed-complete');
    }

    // Update TV feed item if integrated
    if (item.tvElement) {
        updateTVFeedItem(item.tvElement, {
            status: item.status,
            summary: item.summary,
        });
    }

    updateBadge();

    // Auto-fade after delay
    setTimeout(() => {
        fadeOutItem(item);
    }, COMPLETED_DISPLAY_MS);
}

/**
 * Show a details popup for a feed item.
 * @param {FeedItem} item
 */
function showDetails(item) {
    if (!item?.details?.fullResult) return;

    // Remove any existing details panel
    const existing = document.querySelector('.nlg-feed-details');
    if (existing) existing.remove();

    const detailsEl = document.createElement('div');
    detailsEl.className = 'nlg-feed-details';

    let storedInHtml = '';
    if (item.details.storedIn && item.details.storedIn.length > 0) {
        storedInHtml = `
            <div class="nlg-feed-details-storage">
                <div class="nlg-feed-details-label">Stored in:</div>
                ${item.details.storedIn.map(s => `<div class="nlg-feed-details-storage-item"><i class="fa-solid fa-database"></i> ${escapeHtml(s)}</div>`).join('')}
            </div>`;
    }

    detailsEl.innerHTML = `
        <div class="nlg-feed-details-header">
            <span style="color: ${item.color}"><i class="fa-solid ${item.icon}"></i> ${item.displayName}</span>
            <span class="nlg-feed-details-close" title="Close"><i class="fa-solid fa-xmark"></i></span>
        </div>
        <div class="nlg-feed-details-meta">
            <span>${item.verb} at ${formatTime(item.timestamp)}</span>
            <span class="nlg-status-${item.status}">${item.status === 'done' ? 'Completed' : 'Error'}</span>
        </div>
        ${storedInHtml}
        <div class="nlg-feed-details-label">Full Result:</div>
        <div class="nlg-feed-details-content">${escapeHtml(item.details.fullResult)}</div>
    `;

    detailsEl.querySelector('.nlg-feed-details-close').addEventListener('click', () => {
        detailsEl.remove();
    });

    document.body.appendChild(detailsEl);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addFeedItemRunning(item) {
    feedItems.unshift(item);
    if (feedItems.length > MAX_FEED_ITEMS) {
        const removed = feedItems.pop();
        removed?.element?.remove();
    }

    updateBadge();
    renderRunningItem(item);

    // Auto-show panel
    if (panelEl && !panelEl.classList.contains('nlg-feed-open')) {
        showPanel();
    }
}

function renderRunningItem(item) {
    if (!panelBody) return;

    const el = document.createElement('div');
    el.className = 'nlg-feed-item nlg-feed-enter';
    el.dataset.id = String(item.id);
    el.dataset.status = 'running';
    el.style.setProperty('--tool-color', item.color);

    el.innerHTML = `
        <div class="nlg-feed-item-icon">
            <i class="fa-solid ${item.icon}" style="color: ${item.color}"></i>
        </div>
        <div class="nlg-feed-item-content">
            <div class="nlg-feed-item-header">
                <span class="nlg-feed-item-verb" style="color: ${item.color}">${item.verb}</span>
                <span class="nlg-feed-item-name">${item.displayName}</span>
                <span class="nlg-feed-item-status nlg-status-running">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                </span>
            </div>
            <div class="nlg-feed-item-summary">${item.summary || 'Working...'}</div>
            <div class="nlg-feed-item-time">${formatTime(item.timestamp)}</div>
        </div>
    `;

    item.element = el;

    // Click to show details when completed
    el.addEventListener('click', () => {
        if (item.details?.fullResult) {
            showDetails(item);
        }
    });

    panelBody.prepend(el);

    // Trigger enter animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.classList.remove('nlg-feed-enter');
            el.classList.add('nlg-feed-visible');
        });
    });
}
