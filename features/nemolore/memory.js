import {
    chat,
    getCurrentChatId,
    getRequestHeaders,
} from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { hideChatMessageRange } from '../../../../../chats.js';
import { textgen_types, textgenerationwebui_settings } from '../../../../../textgen-settings.js';
import { oai_settings } from '../../../../../openai.js';
import { getStringHash, uuidv4 } from '../../../../../utils.js';
import {
    PROMPT_TAG,
    RETRIEVAL_PROMPT_TAG,
} from './constants.js';
import { getNemoLoreSettings as settings } from './settings.js';
import {
    getArchiveCollectionId,
} from './keys.js';
import {
    getArchive,
    getInbox,
    getTimeline,
    setArchive,
    setInbox,
    setTimeline,
} from './storage.js';
import {
    buildSummaryPrompt,
    getResponseText,
    parseSummaryResponse,
} from './prompts.js';
import { runProfileRequest } from './shared/model-service.js';
import { applyPromptBlock, clearPromptBlock } from './shared/prompt-service.js';

const queue = [];
let isProcessing = false;

function getMessageText(messageId) {
    const message = chat[messageId];
    if (!message || message.is_system || !message.mes) {
        return '';
    }

    const role = message.is_user ? 'User' : (message.name || 'Assistant');
    return `${role}: ${message.mes}`.trim();
}

function getRawMessageText(messageId) {
    const message = chat[messageId];
    if (!message || !message.mes) {
        return '';
    }

    const role = message.is_user ? 'User' : (message.name || 'Assistant');
    return `${role}: ${message.mes}`.trim();
}

function isSummarizableMessage(messageId) {
    const message = chat[messageId];
    return !!message && !message.is_system && !!String(message.mes || '').trim();
}

export function getMemoryQueue() {
    return queue;
}

export function isMemoryProcessing() {
    return isProcessing;
}

export async function hasSummaryForMessages(chatId, sourceMessageIds) {
    const timeline = await getTimeline(chatId);
    const sourceKey = sourceMessageIds.join(',');
    return timeline.some(item => item.sourceMessageIds.join(',') === sourceKey);
}

export async function hasArchiveForMessages(chatId, sourceMessageIds) {
    const archive = await getArchive(chatId);
    const sourceKey = sourceMessageIds.join(',');
    return archive.some(item => item.sourceMessageIds.join(',') === sourceKey);
}

export async function enqueueCompletedTurns(onStatusChange = () => {}) {
    const cfg = settings();
    if (!cfg.enabled) {
        return;
    }

    const chatId = getCurrentChatId();
    if (!chatId) {
        return;
    }

    const protectedStart = Math.max(0, chat.length - cfg.liveWindowMessages);
    for (let i = 0; i < protectedStart - 1; i++) {
        const first = chat[i];
        const second = chat[i + 1];

        if (!first || !second || !first.is_user || second.is_user) {
            continue;
        }

        const sourceMessageIds = [i, i + 1];
        if (!sourceMessageIds.every(isSummarizableMessage)) {
            continue;
        }

        const alreadyQueued = queue.some(job => job.chatId === chatId && job.sourceMessageIds.join(',') === sourceMessageIds.join(','));
        if (alreadyQueued || await hasSummaryForMessages(chatId, sourceMessageIds)) {
            continue;
        }

        queue.push({
            id: uuidv4(),
            chatId,
            sourceMessageIds,
            status: 'queued',
            attempts: 0,
            createdAt: Date.now(),
        });
    }

    onStatusChange();
}

async function processJob(job, hooks) {
    const cfg = settings();
    if (!cfg.memoryProfileId) {
        throw new Error('No memory model profile selected');
    }

    job.status = 'running';
    job.attempts += 1;
    hooks.onStatusChange();

    const response = await runProfileRequest(
        cfg.memoryProfileId,
        buildSummaryPrompt(job.sourceMessageIds.map(getMessageText).join('\n\n')),
        cfg.maxSummaryTokens,
    );

    const extracted = parseSummaryResponse(getResponseText(response));
    if (!extracted.summary) {
        throw new Error('Memory model returned an empty summary');
    }

    const summary = {
        id: uuidv4(),
        chatId: job.chatId,
        sourceMessageIds: job.sourceMessageIds,
        summary: extracted.summary,
        importance: extracted.importance,
        entities: extracted.entities,
        facts: extracted.facts,
        createdAt: Date.now(),
    };

    const timeline = await getTimeline(job.chatId);
    timeline.push(summary);
    timeline.sort((a, b) => a.sourceMessageIds[0] - b.sourceMessageIds[0]);
    await setTimeline(job.chatId, timeline);
    await archiveSummarizedTurn(job.chatId, summary, hooks);

    if (extracted.candidates.length) {
        const inbox = await getInbox(job.chatId);
        for (const candidate of extracted.candidates) {
            inbox.push({
                id: uuidv4(),
                chatId: job.chatId,
                sourceMessageIds: job.sourceMessageIds,
                status: 'pending',
                ...candidate,
                createdAt: Date.now(),
            });
        }
        await setInbox(job.chatId, inbox);
    }

    job.status = 'complete';
    await maybeHideSummarizedSources(job.chatId);
    await updateTimelinePrompt();
}

async function archiveSummarizedTurn(chatId, summary, hooks) {
    if (await hasArchiveForMessages(chatId, summary.sourceMessageIds)) {
        return;
    }

    const archive = await getArchive(chatId);
    const rawText = summary.sourceMessageIds.map(getRawMessageText).filter(Boolean).join('\n\n');
    const item = {
        id: uuidv4(),
        chatId,
        sourceMessageIds: summary.sourceMessageIds,
        rawText,
        summary: summary.summary,
        entities: summary.entities,
        importance: summary.importance,
        createdAt: Date.now(),
        vectorHash: getStringHash(`${summary.sourceMessageIds.join(',')}\n${rawText}`),
        vectorized: false,
    };

    archive.push(item);
    archive.sort((a, b) => a.sourceMessageIds[0] - b.sourceMessageIds[0]);
    await setArchive(chatId, archive);

    if (settings().vectorEnabled) {
        try {
            await vectorizeArchiveItems(chatId, [item], hooks);
        } catch (error) {
            console.warn('[NemoLore] Archive vectorization failed after summary; continuing without vector index', error);
        }
    }
}

function getVectorSource() {
    return String(extension_settings.vectors?.source || 'transformers');
}

function getVectorsRequestBody(args = {}) {
    const vectorSettings = extension_settings.vectors || {};
    const source = getVectorSource();
    const body = { ...args };

    switch (source) {
        case 'extras':
            body.extrasUrl = extension_settings.apiUrl;
            body.extrasKey = extension_settings.apiKey;
            break;
        case 'electronhub':
            body.model = vectorSettings.electronhub_model;
            break;
        case 'openrouter':
            body.model = vectorSettings.openrouter_model;
            break;
        case 'togetherai':
            body.model = vectorSettings.togetherai_model;
            break;
        case 'openai':
            body.model = vectorSettings.openai_model;
            break;
        case 'cohere':
            body.model = vectorSettings.cohere_model;
            break;
        case 'ollama':
            body.model = vectorSettings.ollama_model;
            body.apiUrl = vectorSettings.use_alt_endpoint ? vectorSettings.alt_endpoint_url : textgenerationwebui_settings.server_urls[textgen_types.OLLAMA];
            body.keep = !!vectorSettings.ollama_keep;
            break;
        case 'llamacpp':
            body.apiUrl = vectorSettings.use_alt_endpoint ? vectorSettings.alt_endpoint_url : textgenerationwebui_settings.server_urls[textgen_types.LLAMACPP];
            break;
        case 'vllm':
            body.apiUrl = vectorSettings.use_alt_endpoint ? vectorSettings.alt_endpoint_url : textgenerationwebui_settings.server_urls[textgen_types.VLLM];
            body.model = vectorSettings.vllm_model;
            break;
        case 'palm':
            body.model = vectorSettings.google_model;
            body.api = 'makersuite';
            break;
        case 'vertexai':
            body.model = vectorSettings.google_model;
            body.api = 'vertexai';
            body.vertexai_auth_mode = oai_settings.vertexai_auth_mode;
            body.vertexai_region = oai_settings.vertexai_region;
            body.vertexai_express_project_id = oai_settings.vertexai_express_project_id;
            break;
        case 'chutes':
            body.model = vectorSettings.chutes_model;
            break;
        case 'nanogpt':
            body.model = vectorSettings.nanogpt_model;
            break;
        case 'siliconflow':
            body.model = vectorSettings.siliconflow_model;
            body.siliconflow_endpoint = oai_settings.siliconflow_endpoint;
            break;
        case 'workers_ai':
            body.model = vectorSettings.workers_ai_model || '@cf/baai/bge-m3';
            body.workers_ai_account_id = oai_settings.workers_ai_account_id;
            break;
        default:
            break;
    }

    return body;
}

function buildArchiveVectorText(item) {
    return [
        `Summary: ${item.summary}`,
        item.entities?.length ? `Entities: ${item.entities.join(', ')}` : '',
        'Raw turn:',
        item.rawText,
    ].filter(Boolean).join('\n');
}

export async function vectorizeArchiveItems(chatId = getCurrentChatId(), items = null, hooks = {}) {
    const cfg = settings();
    if (!cfg.vectorEnabled || !chatId) {
        return;
    }

    const source = getVectorSource();
    if (source === 'webllm' || source === 'koboldcpp') {
        toastr.warning('NemoLore archive vectorization does not support WebLLM or KoboldCpp embeddings yet.');
        return;
    }

    const archive = await getArchive(chatId);
    const targets = (items || archive).filter(item => item.rawText && !item.vectorized);
    if (!targets.length) {
        return;
    }

    const collectionId = getArchiveCollectionId(chatId);
    const vectorItems = targets.map(item => {
        item.vectorHash = item.vectorHash || getStringHash(`${item.sourceMessageIds.join(',')}\n${item.rawText}`);
        return {
            hash: item.vectorHash,
            text: buildArchiveVectorText(item),
            index: item.sourceMessageIds[0],
        };
    });

    const response = await fetch('/api/vector/insert', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            ...getVectorsRequestBody(),
            collectionId,
            items: vectorItems,
            source,
        }),
    });

    if (!response.ok) {
        const message = `Archive vectorization failed for ${targets.length} item(s).`;
        for (const item of targets) {
            item.vectorError = message;
        }
        await setArchive(chatId, archive);
        throw new Error(message);
    }

    for (const item of targets) {
        item.vectorized = true;
        delete item.vectorError;
    }

    await setArchive(chatId, archive);
    await hooks.onRenderArchive?.();
    await hooks.onRenderInspector?.();
}

export async function queryArchiveVectors(queryText, topK = settings().retrievalCount) {
    const cfg = settings();
    const chatId = getCurrentChatId();
    if (!cfg.vectorEnabled || !chatId || !queryText.trim()) {
        return [];
    }

    const source = getVectorSource();
    if (source === 'webllm' || source === 'koboldcpp') {
        return [];
    }

    await vectorizeArchiveItems(chatId);

    const response = await fetch('/api/vector/query', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            ...getVectorsRequestBody(),
            collectionId: getArchiveCollectionId(chatId),
            searchText: queryText,
            topK,
            source,
            threshold: cfg.vectorThreshold,
        }),
    });

    if (!response.ok) {
        throw new Error('Archive vector query failed');
    }

    const result = await response.json();
    const hashes = (result.metadata || []).map(item => Number(item.hash));
    const archive = await getArchive(chatId);
    const byHash = new Map(archive.map(item => [Number(item.vectorHash), item]));

    return hashes.map(hash => byHash.get(hash)).filter(Boolean);
}

export async function processQueue(hooks) {
    const cfg = settings();
    if (isProcessing || !cfg.enabled) {
        return;
    }

    isProcessing = true;
    try {
        let job;
        while ((job = queue.find(item => item.status === 'queued'))) {
            try {
                await processJob(job, hooks);
            } catch (error) {
                job.status = 'failed';
                job.error = error instanceof Error ? error.message : String(error);
                console.warn('[NemoLore] Memory job failed', job, error);
            } finally {
                hooks.onStatusChange();
                hooks.onInspectorRefresh?.();
                hooks.onInboxRefresh?.();
                hooks.onArchiveRefresh?.();
            }
        }
    } finally {
        isProcessing = false;
        hooks.onStatusChange();
    }
}

export async function maybeHideSummarizedSources(chatId) {
    const cfg = settings();
    if (!cfg.autoHideSummarized || cfg.hideAfterMessages <= 0 || chatId !== getCurrentChatId()) {
        return;
    }

    const hideBefore = Math.max(0, chat.length - cfg.hideAfterMessages);
    const timeline = await getTimeline(chatId);

    for (const item of timeline) {
        const lastSourceId = Math.max(...item.sourceMessageIds);
        if (lastSourceId >= hideBefore) {
            continue;
        }

        const [start, end] = [Math.min(...item.sourceMessageIds), lastSourceId];
        const shouldHide = item.sourceMessageIds.every(id => chat[id] && !chat[id].is_system);
        if (shouldHide) {
            await hideChatMessageRange(start, end, false);
        }
    }
}

export async function updateTimelinePrompt() {
    const cfg = settings();
    if (!cfg.enabled) {
        clearPromptBlock(PROMPT_TAG, { position: 'in_prompt', depth: cfg.injectionDepth });
        return;
    }

    const timeline = await getTimeline();
    const visibleSummaries = timeline
        .filter(item => Math.max(...item.sourceMessageIds) < Math.max(0, chat.length - cfg.liveWindowMessages))
        .slice(-24);

    const summaries = visibleSummaries.map(item => `- ${item.summary}`).join('\n');
    const prompt = summaries ? cfg.template.replace('{{summaries}}', summaries) : '';

    applyPromptBlock(PROMPT_TAG, prompt, { position: 'in_prompt', depth: cfg.injectionDepth });
}

export function getCurrentRetrievalQuery() {
    return chat
        .filter(message => !message.is_system && message.mes)
        .slice(-4)
        .map(message => `${message.is_user ? 'User' : message.name || 'Assistant'}: ${message.mes}`)
        .join('\n\n');
}

export async function updateRetrievedArchivePrompt() {
    const cfg = settings();
    if (!cfg.enabled || !cfg.vectorEnabled) {
        clearPromptBlock(RETRIEVAL_PROMPT_TAG, { position: 'in_prompt', depth: cfg.retrievalDepth });
        return;
    }

    try {
        const queryText = getCurrentRetrievalQuery();
        const items = await queryArchiveVectors(queryText, cfg.retrievalCount);
        const snippets = items.map(item => `- ${item.summary}\n  Detail: ${item.rawText}`).join('\n');
        const prompt = snippets ? cfg.retrievalTemplate.replace('{{snippets}}', snippets) : '';
        applyPromptBlock(RETRIEVAL_PROMPT_TAG, prompt, { position: 'in_prompt', depth: cfg.retrievalDepth });
    } catch (error) {
        console.warn('[NemoLore] Archive vector retrieval failed', error);
        clearPromptBlock(RETRIEVAL_PROMPT_TAG, { position: 'in_prompt', depth: cfg.retrievalDepth });
    }
}

