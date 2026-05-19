import {
    addCopyToCodeBlocks,
    chat,
    eventSource,
    event_types,
    messageFormatting,
} from '../../../../../../script.js';

const SOURCE_HASH_ATTR = 'nemoItalicDialogueSourceHash';
const CODE_SEGMENT_REGEX = /(```[\s\S]*?```|~~~[\s\S]*?~~~|``[\s\S]*?``|`[\s\S]*?`)/g;

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char]));
}

function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
}

function renderNestedBold(content) {
    let html = '';
    let cursor = 0;

    while (cursor < content.length) {
        const open = content.indexOf('*', cursor);
        if (open === -1) {
            html += escapeHtml(content.slice(cursor));
            break;
        }

        const isDouble = content[open + 1] === '*';
        const marker = isDouble ? '**' : '*';
        const close = content.indexOf(marker, open + marker.length);
        if (close === -1) {
            html += escapeHtml(content.slice(cursor));
            break;
        }

        const inner = content.slice(open + marker.length, close);
        if (!inner.trim()) {
            html += escapeHtml(content.slice(cursor, open + marker.length));
            cursor = open + marker.length;
            continue;
        }

        html += escapeHtml(content.slice(cursor, open));
        html += `<strong>${escapeHtml(inner)}</strong>`;
        cursor = close + marker.length;
    }

    return html;
}

function renderItalicDialogue(content) {
    return `<span class="nemo-italic-dialogue">&quot;${renderNestedBold(content)}&quot;</span>`;
}

function transformItalicDialogueLine(line) {
    const complete = line.replace(/\*"([^"]*?)"\*/g, (_, content) => renderItalicDialogue(content));
    return complete.replace(/\*"([^"]*)$/g, (_, content) => renderItalicDialogue(content));
}

export function transformItalicDialogueSyntax(text) {
    if (!text || !text.includes('*"')) {
        return text;
    }

    return text
        .split(CODE_SEGMENT_REGEX)
        .map((segment, index) => {
            if (index % 2 === 1) {
                return segment;
            }
            return segment
                .split(/(\r?\n)/)
                .map(part => (part === '\n' || part === '\r\n') ? part : transformItalicDialogueLine(part))
                .join('');
        })
        .join('');
}

function renderMessage(messageId) {
    const numericId = Number(messageId);
    if (!Number.isInteger(numericId) || numericId < 0) {
        return;
    }

    const message = chat[numericId];
    const messageElement = document.querySelector(`.mes[mesid="${numericId}"]`);
    const textElement = messageElement?.querySelector('.mes_text');
    if (!message || !textElement) {
        return;
    }

    const source = String(message.extra?.display_text ?? message.mes ?? '');
    const transformed = transformItalicDialogueSyntax(source);
    if (transformed === source) {
        return;
    }

    const sourceHash = hashString(source);
    if (textElement.dataset[SOURCE_HASH_ATTR] === sourceHash) {
        return;
    }

    textElement.innerHTML = messageFormatting(
        transformed,
        message.name,
        message.is_system,
        message.is_user,
        numericId,
        {},
        false,
    );
    textElement.dataset[SOURCE_HASH_ATTR] = sourceHash;
    addCopyToCodeBlocks(messageElement);
}

function renderAllVisibleMessages() {
    document.querySelectorAll('.mes[mesid]').forEach(element => {
        renderMessage(element.getAttribute('mesid'));
    });
}

function queueRenderMessage(messageId) {
    requestAnimationFrame(() => renderMessage(messageId));
}

function queueRenderAll() {
    requestAnimationFrame(renderAllVisibleMessages);
}

export function initItalicDialogueRenderer(cleanups = []) {
    const renderedHandler = messageId => queueRenderMessage(messageId);
    const updatedHandler = messageId => queueRenderMessage(messageId);
    const refreshHandler = () => queueRenderAll();

    eventSource.on(event_types.USER_MESSAGE_RENDERED, renderedHandler);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, renderedHandler);
    eventSource.on(event_types.MESSAGE_UPDATED, updatedHandler);
    eventSource.on(event_types.MESSAGE_EDITED, updatedHandler);
    eventSource.on(event_types.MESSAGE_SWIPED, updatedHandler);
    eventSource.on(event_types.MORE_MESSAGES_LOADED, refreshHandler);
    eventSource.on(event_types.CHAT_CHANGED, refreshHandler);
    eventSource.on(event_types.CHAT_LOADED, refreshHandler);

    cleanups.push(() => {
        eventSource.removeListener(event_types.USER_MESSAGE_RENDERED, renderedHandler);
        eventSource.removeListener(event_types.CHARACTER_MESSAGE_RENDERED, renderedHandler);
        eventSource.removeListener(event_types.MESSAGE_UPDATED, updatedHandler);
        eventSource.removeListener(event_types.MESSAGE_EDITED, updatedHandler);
        eventSource.removeListener(event_types.MESSAGE_SWIPED, updatedHandler);
        eventSource.removeListener(event_types.MORE_MESSAGES_LOADED, refreshHandler);
        eventSource.removeListener(event_types.CHAT_CHANGED, refreshHandler);
        eventSource.removeListener(event_types.CHAT_LOADED, refreshHandler);
    });

    queueRenderAll();
}
