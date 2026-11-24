import { isFeatureEnabled, NEMO_EXTENSION_NAME } from '../../core/utils.js';
import logger from '../../core/logger.js';
import { showSwipePicker } from './picker.js';

const CHAT_EVENTS = [
    'APP_READY', 'SETTINGS_LOADED', 'EXTENSION_SETTINGS_LOADED', 'CHAT_CHANGED',
];
const MESSAGE_EVENTS = [
    'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_RECEIVED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED',
    'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_SWIPE_DELETED', 'GENERATION_ENDED',
];
const MESSAGE_ROW = '.mes[mesid]';
const TRIGGER = '.nemo-start-trigger';

let unsubscribe = null;
let chatElement = null;
let observer = null;
let picker = null;

function getContext() {
    return globalThis.SillyTavern?.getContext?.();
}

function getSwipeState(context, messageId) {
    const message = context?.chat?.[messageId];
    if (!Array.isArray(message?.swipes) || message.swipes.length < 2) return null;

    const isGreeting = messageId === 0 && context.characterId != null && !context.groupId
        && !message.is_user && !message.is_system;
    const active = Number(message.swipe_id ?? 0);
    const choices = message.swipes.flatMap((text, index) =>
        typeof text === 'string' && (!isGreeting || text.trim()) ? [{ index, text }] : []);
    if (choices.length < 2) return null;

    const canSwitch = messageId === context.chat.length - 1
        && !message.is_user && !message.is_system && !message.extra?.isSmallSys && message.extra?.swipeable !== false
        && Number.isInteger(active) && active >= 0 && active < message.swipes.length
        && typeof context.swipe?.to === 'function' && typeof context.swipe?.isAllowed === 'function';

    return {
        message, messageId, active, choices, isGreeting, canSwitch,
        chatId: context.chatId, characterId: context.characterId, groupId: context.groupId,
    };
}

function isSameMessage(current, original) {
    return current?.message === original.message && current.messageId === original.messageId
        && current.chatId === original.chatId && current.characterId === original.characterId
        && current.groupId === original.groupId;
}

function closePicker() {
    picker?.dialog.close();
    picker?.dialog.remove();
    picker = null;
}

function getRowState(context, row) {
    if (!chatElement || row?.parentElement !== chatElement) return null;
    return getSwipeState(context, Number(row.getAttribute('mesid')));
}

function syncPicker(context) {
    if (!picker) return;
    const current = getRowState(context, picker.row);
    if (!isSameMessage(current, picker.state) || current.canSwitch !== picker.state.canSwitch) closePicker();
}

async function useSwipe(row, original, choice) {
    const context = getContext();
    const current = getRowState(context, row);
    if (!isSameMessage(current, original) || !current.canSwitch
        || current.message.swipes[choice.index] !== choice.text) {
        const label = original.isGreeting ? 'first messages' : 'saved swipes';
        return `The ${label} changed. Reopen the picker to see the latest choices.`;
    }
    if (current.active === choice.index) return '';
    if (!context.swipe.isAllowed()) {
        return 'Switching requires swipes to be enabled and the chat to be idle.';
    }

    try {
        // A saved target and the native guards keep this on the existing-swipe path.
        await context.swipe.to(null, choice.index > current.active ? 'right' : 'left', {
            message: current.message,
            forceMesId: current.messageId,
            forceSwipeId: choice.index,
        });
        if (Number(current.message.swipe_id) === choice.index) return '';
    } catch (error) {
        logger.warn('NemoStart could not switch saved swipes', error);
    }
    return 'SillyTavern could not switch swipes. Finish any message edit and try again.';
}

function openPicker(event) {
    event.stopPropagation();
    if (picker?.dialog.open) return;
    const row = event.currentTarget.closest(MESSAGE_ROW);
    const state = getRowState(getContext(), row);
    if (!state) return;

    const dialog = showSwipePicker(state, state.canSwitch ? choice => useSwipe(row, state, choice) : null);
    picker = { dialog, row, state };
    dialog.addEventListener('close', () => {
        dialog.remove();
        if (picker?.dialog === dialog) picker = null;
    }, { once: true });
}

function syncRow(context, row) {
    if (row?.parentElement !== chatElement) return;
    const rail = row.querySelector(':scope > .swipeRightBlock');
    if (!rail) return;
    const arrow = rail.querySelector(':scope > .swipe_right');
    let opener = rail.querySelector(`:scope > ${TRIGGER}`);
    const state = arrow && getRowState(context, row);
    if (!state) {
        opener?.remove();
        return;
    }

    if (!opener) {
        opener = document.createElement('button');
        opener.type = 'button';
        opener.className = 'menu_button nemo-start-trigger';
        opener.setAttribute('aria-haspopup', 'dialog');
        opener.innerHTML = '<i class="fa-solid fa-list" aria-hidden="true"></i>';
        opener.addEventListener('click', openPicker);
    }
    const label = state.isGreeting ? 'Browse first messages' : 'Browse swipes';
    const buttonText = `${label} (${state.choices.length})`;
    if (opener.title !== buttonText) {
        opener.title = buttonText;
        opener.setAttribute('aria-label', buttonText);
    }
    if (opener.nextElementSibling !== arrow) arrow.before(opener);
}

function detachChat() {
    observer?.disconnect();
    chatElement?.querySelectorAll(TRIGGER).forEach(button => button.remove());
    chatElement = null;
}

export function syncNemoStart() {
    if (!unsubscribe) return;
    const context = getContext();
    const enabled = isFeatureEnabled(context?.extensionSettings?.[NEMO_EXTENSION_NAME], 'enableNemoStart');
    const nextChat = enabled ? document.getElementById('chat') : null;
    if (nextChat !== chatElement) {
        detachChat();
        chatElement = nextChat;
        if (chatElement) observer.observe(chatElement, {
            childList: true, subtree: true, attributeFilter: ['mesid'],
        });
    }

    chatElement?.querySelectorAll(`:scope > ${MESSAGE_ROW}`).forEach(row => syncRow(context, row));
    syncPicker(context);
}

function syncMessage(payload) {
    if (!chatElement) return;
    const context = getContext();
    const lastId = (context?.chat?.length ?? 0) - 1;
    const id = Number(payload?.messageId ?? payload ?? lastId);
    const messageId = Number.isInteger(id) && id >= 0 && id <= lastId ? id : lastId;
    const row = chatElement.querySelector(`:scope > .mes[mesid="${messageId}"]`);
    if (row) syncRow(context, row);
    syncPicker(context);
}

function onChatMutations(records) {
    const rows = new Set();
    let chatChanged = false;
    for (const { target, addedNodes } of records) {
        if (target === chatElement) {
            chatChanged = true;
            for (const node of addedNodes) {
                if (node.matches?.(MESSAGE_ROW)) rows.add(node);
            }
        } else if (target.matches?.(MESSAGE_ROW)) {
            rows.add(target);
        } else if (target.matches?.('.swipes-counter')) {
            // Native commands can update the counter without emitting a message event.
            rows.add(target.closest(MESSAGE_ROW));
        }
    }
    if (!chatChanged && !rows.size) return;

    const context = getContext();
    for (const row of rows) syncRow(context, row);
    syncPicker(context);
}

export function initializeNemoStart() {
    if (unsubscribe) return;
    const context = getContext();
    if (!context?.eventSource || !context.eventTypes || typeof HTMLDialogElement === 'undefined'
        || typeof HTMLDialogElement.prototype.showModal !== 'function') return;

    const { eventSource, eventTypes } = context;
    const subscriptions = [
        ...CHAT_EVENTS.map(name => [eventTypes[name], syncNemoStart]),
        ...MESSAGE_EVENTS.map(name => [eventTypes[name], syncMessage]),
    ].filter(([event]) => event);
    observer = new MutationObserver(onChatMutations);
    unsubscribe = () => {
        for (const [event, handler] of subscriptions) eventSource.removeListener(event, handler);
    };
    for (const [event, handler] of subscriptions) eventSource.on(event, handler);
    syncNemoStart();
}

export function cleanupNemoStart() {
    unsubscribe?.();
    unsubscribe = null;
    detachChat();
    observer = null;
    closePicker();
}
