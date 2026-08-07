/**
 * NemoNet reasoning capture integration.
 *
 * SillyTavern owns parsing, rendering, persistence, and streaming reasoning. This
 * adapter adds conservative NemoNet/tagless fallbacks and commits accepted
 * captures through SillyTavern's message lifecycle.
 */

import {
    chat,
    eventSource,
    event_types,
    saveChatDebounced,
    syncMesToSwipe,
    updateMessageBlock,
} from '../../../../../script.js';
import * as reasoningModule from '../../../../reasoning.js';
import { getRegexedString, regex_placement } from '../../../../extensions/regex/engine.js';
import {
    NemoNetReasoningConfig,
    NemoNetReasoningParser,
    captureReasoningFromMessage,
} from './reasoning-capture-core.js';

export { NemoNetReasoningConfig, NemoNetReasoningParser };

let reasoningRuntime = null;

function normalizeMessageId(value) {
    const messageId = Number(value);
    return Number.isInteger(messageId) && messageId >= 0 ? messageId : null;
}

function isMessageRendered(messageId) {
    return typeof document !== 'undefined'
        && document.querySelector(`.mes[mesid="${messageId}"]`) !== null;
}

/**
 * Parse and atomically persist one canonical assistant message.
 *
 * @param {number|string} rawMessageId
 * @param {NemoNetReasoningParser} [parser]
 * @returns {boolean} Whether the message changed.
 */
export function processReasoningMessage(rawMessageId, parser = reasoningRuntime?.parser) {
    const messageId = normalizeMessageId(rawMessageId);
    if (messageId === null || !parser) return false;

    // SillyTavern deliberately keeps pristine greeting swipe text untouched so
    // greeting macros can resolve again. Parsing it would desynchronize text/extra.
    if (messageId === 0 && chat.length === 1) return false;

    const message = chat[messageId];
    const capture = captureReasoningFromMessage(
        message,
        parser,
        reasoning => getRegexedString(reasoning, regex_placement.REASONING),
    );
    if (!capture.changed) return false;

    // Keep the active swipe, canonical chat record, and saved chat in agreement.
    syncMesToSwipe(messageId);
    saveChatDebounced();

    // MESSAGE_RECEIVED fires before rendering; later lifecycle events may already
    // have a block that needs a normal SillyTavern re-render.
    if (isMessageRendered(messageId)) {
        updateMessageBlock(messageId, message);
    }

    return true;
}

function processLatestAssistant(parser) {
    for (let messageId = chat.length - 1; messageId >= 0; messageId--) {
        const message = chat[messageId];
        if (!message || message.is_user || message.is_system) continue;
        return processReasoningMessage(messageId, parser);
    }
    return false;
}

/**
 * Install bounded SillyTavern event hooks for the optional capture feature.
 * Repeated calls are idempotent.
 *
 * @returns {() => void} Cleanup function.
 */
export function applyNemoNetReasoning() {
    if (reasoningRuntime) return cleanupNemoNetReasoning;

    const parser = new NemoNetReasoningParser({}, {
        getNativeParser: () => reasoningModule.parseReasoningFromString,
        getNativeDelimiters: () => typeof reasoningModule.getReasoningCandidates === 'function'
            ? reasoningModule.getReasoningCandidates()
            : [],
    });
    const handlers = [
        [event_types.MESSAGE_RECEIVED, messageId => processReasoningMessage(messageId, parser)],
        [event_types.MESSAGE_UPDATED, messageId => processReasoningMessage(messageId, parser)],
        [event_types.MESSAGE_SWIPED, messageId => processReasoningMessage(messageId, parser)],
        [event_types.CHARACTER_MESSAGE_RENDERED, messageId => processReasoningMessage(messageId, parser)],
        [event_types.GENERATION_ENDED, () => processLatestAssistant(parser)],
        [event_types.GENERATION_STOPPED, () => processLatestAssistant(parser)],
        [event_types.CHAT_CHANGED, () => processLatestAssistant(parser)],
    ];

    reasoningRuntime = { parser, handlers };
    for (const [eventType, handler] of handlers) {
        eventSource.on(eventType, handler);
    }

    if (typeof window !== 'undefined') {
        window.nemoNetReasoningParser = parser;
        window.nemoNetProcessLastMessage = () => processLatestAssistant(parser);
    }

    // Catch the current chat when the feature is enabled after messages rendered.
    processLatestAssistant(parser);
    return cleanupNemoNetReasoning;
}

/** Remove every listener and debug handle installed by this feature. */
export function cleanupNemoNetReasoning() {
    const runtime = reasoningRuntime;
    if (!runtime) return;

    for (const [eventType, handler] of runtime.handlers) {
        eventSource.removeListener(eventType, handler);
    }

    if (typeof window !== 'undefined') {
        if (window.nemoNetReasoningParser === runtime.parser) {
            delete window.nemoNetReasoningParser;
        }
        delete window.nemoNetProcessLastMessage;
    }

    reasoningRuntime = null;
}
