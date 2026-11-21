import * as st from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { power_user } from '../../../../../power-user.js';
import { isFeatureEnabled, NEMO_EXTENSION_NAME } from '../../core/utils.js';
import logger from '../../core/logger.js';
import { attachHistoryScroll } from './controller.js';

const MAX_PAGE_SIZE = 20;
const LIFECYCLE_EVENTS = ['SETTINGS_LOADED', 'EXTENSION_SETTINGS_LOADED', 'APP_READY', 'CHAT_CHANGED'];
let initialized = false;
let scroller = null;
let detach = null;

export function syncChatHistoryScrolling() {
    if (!initialized) return;
    const enabled = isFeatureEnabled(extension_settings[NEMO_EXTENSION_NAME], 'enableInfiniteChatScrolling');
    const next = enabled && typeof st.showMoreMessages === 'function' ? document.getElementById('chat') : null;
    if (scroller === next) return;

    detach?.();
    scroller = next;
    detach = scroller ? attachHistoryScroll({
        scroller,
        showMoreMessages: st.showMoreMessages,
        pageSize: () => Math.min(power_user.chat_truncation, MAX_PAGE_SIZE),
        onError: error => logger.warn('Could not load older messages on scroll', error),
    }) : null;
}

export function initializeChatHistoryScrolling() {
    if (initialized) return;
    initialized = true;
    for (const name of LIFECYCLE_EVENTS) {
        if (st.event_types[name]) st.eventSource.on(st.event_types[name], syncChatHistoryScrolling);
    }
    syncChatHistoryScrolling();
}

export function cleanupChatHistoryScrolling() {
    if (!initialized) return;
    initialized = false;
    for (const name of LIFECYCLE_EVENTS) {
        if (st.event_types[name]) st.eventSource.removeListener(st.event_types[name], syncChatHistoryScrolling);
    }
    detach?.();
    scroller = null;
    detach = null;
}
