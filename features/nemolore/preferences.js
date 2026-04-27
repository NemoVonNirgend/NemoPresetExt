import { chat, getCurrentChatId } from '../../../../../../script.js';
import { Popup } from '../../../../../popup.js';
import { getStringHash } from '../../../../../utils.js';
import {
    NGRAM_MAX,
    NGRAM_MIN,
    PREFERENCE_COMMON_WORDS,
    PREFERENCE_LEMMA_MAP,
    PREFERENCE_SIGNAL_LIMIT,
    SINGLE_WORD_SIGNAL_MIN_LENGTH,
} from './constants.js';
import { getNemoLoreSettings as settings } from './settings.js';
import {
    getPreferences,
    setPreferences,
    getPreferenceSignals,
    setPreferenceSignals,
    getPreferenceEvidenceLog,
    setPreferenceEvidenceLog,
    getPreferenceIgnoredSignals,
    setPreferenceIgnoredSignals,
} from './storage.js';
import {
    normalizePreference,
    getResponseText,
    parsePreferenceResponse,
    buildPreferencePrompt,
    buildProblemLinePreferencePrompt,
    buildPreferenceReflectionPrompt,
    buildPreferenceDiscussionPrompt,
    extractJsonArray,
    extractJsonObject,
} from './prompts.js';
import { runProfileRequest } from './shared/model-service.js';

const lastSwipeState = new Map();
const lastMessageTextState = new Map();
const comparedSwipeChoices = new Map();
let problemLineMenu = null;
let lastProblemLineSelection = null;

export async function rememberPreferenceNoteCore(hooks) {
    const note = String($('#nemo_lore_teach_input').val() || '').trim();
    if (!note) {
        return;
    }

    const preference = await createPreferenceFromNote(note);
    if (!preference.content) {
        toastr.warning('Could not create a preference from that note.', 'NemoLore');
        return;
    }

    const preferences = await getPreferences();
    preferences.push(preference);
    await setPreferences(preferences);
    $('#nemo_lore_teach_input').val('');
    await hooks.renderPreferences();
    await hooks.updatePreferencesPrompt();
    toastr.success('Preference remembered.', 'NemoLore');
}

export async function observeRejectedSwipeCore(messageId, hooks) {
    const cfg = settings();
    if (!cfg.inferenceEnabled) {
        rememberSwipeState(messageId);
        rememberMessageTextState(messageId);
        return;
    }

    const message = chat[messageId];
    if (!message || message.is_user || message.is_system || !Array.isArray(message.swipes)) {
        rememberSwipeState(messageId);
        rememberMessageTextState(messageId);
        return;
    }

    const previous = lastSwipeState.get(messageId);
    const currentSwipeId = Number(message.swipe_id || 0);
    const currentText = getPreferenceAnalysisText(message.swipes[currentSwipeId] || message.mes || '');

    if (!previous || previous.swipeId === currentSwipeId || !previous.text || previous.text === currentText) {
        rememberSwipeState(messageId);
        return;
    }

    await recordPreferenceObservation({
        source: 'swipe',
        messageId,
        rejectedText: previous.text,
        acceptedText: currentText,
        signals: extractPreferenceSignalPhrases(previous.text),
    }, hooks);
    rememberSwipeState(messageId);
    rememberMessageTextState(messageId);
}

export async function observeContinuedSwipeChoiceCore(userMessageId, hooks) {
    const cfg = settings();
    if (!cfg.inferenceEnabled) {
        return;
    }

    const assistantMessageId = findPreviousAssistantMessageId(Number.isInteger(userMessageId) ? userMessageId : chat.length - 1);
    if (assistantMessageId === -1) {
        return;
    }

    const message = chat[assistantMessageId];
    if (!message || !Array.isArray(message.swipes) || message.swipes.length < 2) {
        return;
    }

    const selectedSwipeId = Number(message.swipe_id || 0);
    const acceptedText = getPreferenceAnalysisText(message.swipes[selectedSwipeId] || message.mes || '');
    if (!acceptedText.trim()) {
        return;
    }

    const comparableSwipes = message.swipes.map(swipe => getPreferenceAnalysisText(swipe));
    const signature = `${selectedSwipeId}:${getStringHash(comparableSwipes.join('\n---swipe---\n'))}`;
    if (comparedSwipeChoices.get(assistantMessageId) === signature) {
        return;
    }

    const rejectedSignals = [];
    for (let index = 0; index < message.swipes.length; index++) {
        if (index === selectedSwipeId) {
            continue;
        }

        const rejectedText = comparableSwipes[index] || '';
        if (!rejectedText.trim() || rejectedText === acceptedText) {
            continue;
        }

        rejectedSignals.push(...getRemovedPreferenceSignals(rejectedText, acceptedText).map(signal => ({
            ...signal,
            score: signal.score + 0.5,
        })));
    }

    if (rejectedSignals.length) {
        await recordPreferenceObservation({
            source: 'swipe_choice',
            messageId: assistantMessageId,
            acceptedText,
            rejectedText: comparableSwipes
                .filter((_, index) => index !== selectedSwipeId)
                .map(text => String(text || '').trim())
                .filter(Boolean)
                .join('\n--- alternate swipe ---\n'),
            signals: rejectedSignals,
        }, hooks);
    }

    comparedSwipeChoices.set(assistantMessageId, signature);
    rememberSwipeState(assistantMessageId);
    rememberMessageTextState(assistantMessageId);
}

export function rememberVisibleAssistantStateCore() {
    for (let index = 0; index < chat.length; index++) {
        const message = chat[index];
        if (!message || message.is_user || message.is_system) {
            continue;
        }

        rememberSwipeState(index);
        rememberMessageTextState(index);
    }
}

export async function observeEditedMessageCore(messageId, hooks) {
    const cfg = settings();
    if (!cfg.inferenceEnabled) {
        rememberMessageTextState(messageId);
        return;
    }

    const message = chat[messageId];
    if (!message || message.is_user || message.is_system) {
        rememberMessageTextState(messageId);
        return;
    }

    const previousText = lastMessageTextState.get(messageId);
    const currentText = getAssistantMessageText(messageId);
    if (!previousText || previousText === currentText) {
        rememberMessageTextState(messageId);
        return;
    }

    const removedSignals = getRemovedPreferenceSignals(previousText, currentText);
    if (removedSignals.length) {
        await recordPreferenceObservation({
            source: 'edit',
            messageId,
            rejectedText: previousText,
            acceptedText: currentText,
            signals: removedSignals,
        }, hooks);
    }

    rememberMessageTextState(messageId);
    rememberSwipeState(messageId);
}

function findPreviousAssistantMessageId(fromMessageId) {
    for (let index = Math.min(fromMessageId - 1, chat.length - 1); index >= 0; index--) {
        const message = chat[index];
        if (message && !message.is_user && !message.is_system) {
            return index;
        }
    }

    return -1;
}

function rememberSwipeState(messageId) {
    const message = chat[messageId];
    if (!message || !Array.isArray(message.swipes)) {
        return;
    }

    const swipeId = Number(message.swipe_id || 0);
    lastSwipeState.set(messageId, {
        swipeId,
        text: getPreferenceAnalysisText(message.swipes[swipeId] || message.mes || ''),
    });
}

function rememberMessageTextState(messageId) {
    const message = chat[messageId];
    if (!message || message.is_user || message.is_system) {
        return;
    }

    lastMessageTextState.set(messageId, getAssistantMessageText(messageId));
}

function getAssistantMessageText(messageId) {
    const message = chat[messageId];
    if (!message) {
        return '';
    }

    const swipeId = Number(message.swipe_id || 0);
    if (Array.isArray(message.swipes) && message.swipes[swipeId]) {
        return getPreferenceAnalysisText(message.swipes[swipeId]);
    }

    return getPreferenceAnalysisText(message.mes || '');
}

function getRemovedPreferenceSignals(previousText, currentText) {
    const currentKeys = new Set(extractPreferenceSignalPhrases(currentText).map(signal => signal.key));
    return extractPreferenceSignalPhrases(previousText)
        .filter(signal => !currentKeys.has(signal.key))
        .map(signal => ({
            ...signal,
            score: signal.score + 0.75,
        }));
}

async function recordPreferenceObservation(observation, hooks) {
    const signals = Array.isArray(observation.signals) ? observation.signals : [];
    if (!signals.length) {
        return;
    }

    await appendPreferenceEvidenceLog({
        source: observation.source || 'unknown',
        chatId: getCurrentChatId() || '',
        messageId: Number.isInteger(observation.messageId) ? observation.messageId : undefined,
        signals: signals.slice(0, 20).map(signal => ({
            key: signal.key || signal.phrase,
            phrase: signal.phrase,
            score: Number(signal.score || 1),
            context: signal.context || '',
        })),
        rejectedText: summarizeEvidenceText(observation.rejectedText),
        acceptedText: summarizeEvidenceText(observation.acceptedText),
        createdAt: Date.now(),
    });

    await recordPreferenceSignals(signals, observation.source || 'unknown', hooks);
    await hooks.renderPreferenceEvidence();
}

export async function recordProblemLineSelectionCore(selectionInfo, hooks) {
    const note = await Popup.show.input(
        'Report Problem Line',
        [
            'Tell NemoLore what is wrong with this selected text.',
            '',
            selectionInfo.selectedText,
            '',
            'This becomes reviewable evidence. You can say what to avoid, what to prefer, or why the line failed.',
        ].join('\n'),
        '',
        {
            rows: 6,
            wider: true,
            placeholder: 'Example: This phrase feels too purple/prose-heavy. Avoid this kind of metaphor in narration.',
        },
    );
    if (note === null || note === undefined) {
        return;
    }

    const signals = extractPreferenceSignalPhrases(selectionInfo.selectedText);
    await recordPreferenceObservation({
        source: 'selected_problem',
        messageId: selectionInfo.messageId,
        rejectedText: selectionInfo.selectedText,
        acceptedText: note ? `User note: ${note}` : '',
        signals: signals.length ? signals : [{
            key: summarizeEvidenceText(selectionInfo.selectedText).toLowerCase(),
            phrase: summarizeEvidenceText(selectionInfo.selectedText),
            score: 1,
            context: selectionInfo.fullText,
        }],
    }, hooks);

    if (String(note || '').trim()) {
        const preference = await createPreferenceFromProblemLine(selectionInfo, note);
        const preferences = await getPreferences();
        preferences.push(preference);
        await setPreferences(preferences);
        await hooks.renderPreferences();
        notifyPreferenceCandidates(1, 'Problem line created');
    } else {
        toastr.info('Problem line logged as preference evidence.', 'NemoLore');
    }
}

export async function recordRewriteNotePreferenceCore(entry, hooks) {
    const note = getPreferenceAnalysisText(entry?.note || '');
    if (!note) {
        return false;
    }

    const action = String(entry?.action || 'Rewrite').trim() || 'Rewrite';
    const selectedText = getPreferenceAnalysisText(entry?.selectedText || '');
    const resultText = getPreferenceAnalysisText(entry?.resultText || '');
    const noteContext = `User note for ${action}: ${note}`;
    const signals = [
        ...extractPreferenceSignalPhrases(note).map(signal => ({
            ...signal,
            score: Number(signal.score || 1) + 1,
            context: noteContext,
        })),
        ...extractPreferenceSignalPhrases(selectedText).map(signal => ({
            ...signal,
            score: Number(signal.score || 1) + 0.5,
            context: signal.context || summarizeEvidenceText(selectedText),
        })),
    ];

    if (!signals.length) {
        const fallback = summarizeEvidenceText(note);
        if (!fallback) return false;
        signals.push({
            key: fallback.toLowerCase(),
            phrase: fallback,
            score: 2,
            context: noteContext,
        });
    }

    const messageId = Number(entry?.messageId);
    const sourceAction = action.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'rewrite';
    await recordPreferenceObservation({
        source: `rewrite_note_${sourceAction}`,
        messageId: Number.isInteger(messageId) ? messageId : undefined,
        rejectedText: selectedText,
        acceptedText: [resultText, noteContext].filter(Boolean).join('\n\n'),
        signals,
    }, hooks);
    return true;
}

async function createPreferenceFromProblemLine(selectionInfo, note) {
    const cfg = settings();
    const fallback = normalizePreference({
        status: 'disabled',
        type: 'style_preference',
        content: `Review this user feedback for future writing: ${note}`,
        keywords: inferPreferenceKeywords(`${selectionInfo.selectedText} ${note}`),
        priority: 2,
        confidence: 0.75,
        source: 'inferred',
        evidence: summarizeEvidenceText(selectionInfo.selectedText),
        evidenceDetails: 'Created from a user-selected problem line.',
    }, note);

    if (!cfg.memoryProfileId) {
        return fallback;
    }

    try {
        const response = await runProfileRequest(
            cfg.memoryProfileId,
            buildProblemLinePreferencePrompt(selectionInfo, note),
            Math.min(384, Math.max(256, cfg.maxSummaryTokens)),
        );
        const parsed = parsePreferenceResponse(getResponseText(response), note);
        parsed.status = 'disabled';
        parsed.source = 'inferred';
        parsed.evidence = summarizeEvidenceText(selectionInfo.selectedText);
        parsed.evidenceDetails = 'Created from a user-selected problem line.';
        return parsed;
    } catch (error) {
        console.warn('[NemoLore] Problem line preference normalization failed', error);
        return fallback;
    }
}

async function appendPreferenceEvidenceLog(record) {
    const log = await getPreferenceEvidenceLog();
    log.unshift({
        ...record,
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    });
    await setPreferenceEvidenceLog(log.slice(0, 200));
}

function summarizeEvidenceText(text) {
    return getPreferenceAnalysisText(text).replace(/\s+/g, ' ').trim().slice(0, 600);
}

async function recordPreferenceSignals(phrases, source, hooks) {
    const signals = await getPreferenceSignals();
    const ignored = await getPreferenceIgnoredSignals();
    for (const phrase of phrases) {
        const key = phrase.key || phrase.phrase;
        if (getSignalSuppressionKeys(key).some(suppressionKey => ignored[suppressionKey])) {
            continue;
        }

        const item = signals[key] || { count: 0, score: 0, phrase: phrase.phrase, key, lastSeen: 0, sources: {}, examples: [] };
        item.count += 1;
        item.score = Number(item.score || 0) + Number(phrase.score || 1);
        item.phrase = chooseBetterSignalPhrase(item.phrase, phrase.phrase);
        item.lastSeen = Date.now();
        item.sources = item.sources || {};
        item.sources[source] = (Number(item.sources[source]) || 0) + 1;
        item.examples = Array.isArray(item.examples) ? item.examples : [];
        if (phrase.context && !item.examples.includes(phrase.context)) {
            item.examples.unshift(phrase.context);
            item.examples = item.examples.slice(0, 3);
        }
        signals[key] = item;
    }
    await setPreferenceSignals(signals);
    await hooks.renderPreferenceSignals();
    await createInferredPreferencesFromSignals(signals, hooks);
}

function extractPreferenceSignalPhrases(text) {
    const clean = stripPreferenceSignalText(text);
    const signals = new Map();
    const sentences = clean.match(/[^.!?]+[.!?]?/g) || [clean];

    for (const sentence of sentences) {
        const words = tokenizePreferenceSignal(sentence);
        if (!words.length) {
            continue;
        }

        for (const word of words) {
            if (isDistinctiveSingleWordSignal(word)) {
                addPreferenceSignal(signals, [word], sentence);
            }
        }

        for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
            for (let i = 0; i <= words.length - n; i++) {
                addPreferenceSignal(signals, words.slice(i, i + n), sentence);
            }
        }
    }

    return cullPreferenceSignals([...signals.values()])
        .sort((a, b) => b.score - a.score || b.phrase.length - a.phrase.length)
        .slice(0, PREFERENCE_SIGNAL_LIMIT);
}

function stripPreferenceSignalText(text) {
    return stripReasoningBlocks(text)
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[*_~`"Ã¢â‚¬Å“Ã¢â‚¬ÂÃ¢â‚¬ËœÃ¢â‚¬â„¢()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getPreferenceAnalysisText(text) {
    return stripReasoningBlocks(text).trim();
}

function stripReasoningBlocks(text) {
    return String(text || '')
        .replace(/<\s*(think|cot)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
        .replace(/<\s*(think|cot)\b[^>]*>[\s\S]*$/gi, ' ')
        .replace(/<\s*\/\s*(think|cot)\s*>/gi, ' ');
}

function tokenizePreferenceSignal(text) {
    return String(text || '').toLowerCase().match(/[a-z][a-z'-]{1,}/g) || [];
}

function normalizePreferenceSignalWords(words) {
    return words.map(word => PREFERENCE_LEMMA_MAP.get(word) || word);
}

export function getSignalSuppressionKeys(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) {
        return [];
    }

    const normalized = normalizePreferenceSignalWords(tokenizePreferenceSignal(raw)).join(' ');
    return [...new Set([raw, normalized].filter(Boolean))];
}

function addPreferenceSignal(signals, words, context) {
    if (isLowQualitySignalPhrase(words)) {
        return;
    }

    const normalized = normalizePreferenceSignalWords(words);
    const key = normalized.join(' ');
    const phrase = words.join(' ');
    const score = scorePreferenceSignalPhrase(words);
    const existing = signals.get(key);
    if (!existing || score > existing.score || phrase.length > existing.phrase.length) {
        signals.set(key, {
            key,
            phrase,
            score,
            context: String(context || '').trim().slice(0, 220),
        });
    }
}

function isDistinctiveSingleWordSignal(word) {
    return word.length >= SINGLE_WORD_SIGNAL_MIN_LENGTH
        && !PREFERENCE_COMMON_WORDS.has(word)
        && !/^(?:[a-z])\1{3,}$/.test(word);
}

function isLowQualitySignalPhrase(words) {
    if (!Array.isArray(words) || !words.length) {
        return true;
    }

    if (words.length === 1) {
        return !isDistinctiveSingleWordSignal(words[0]);
    }

    const uncommonCount = words.filter(word => !PREFERENCE_COMMON_WORDS.has(word)).length;
    const allShort = words.every(word => word.length <= 3);
    const repeated = new Set(words).size === 1;
    const phrase = words.join(' ');

    return uncommonCount === 0 || allShort || repeated || phrase.length < 8;
}

function scorePreferenceSignalPhrase(words) {
    const uncommonCount = words.filter(word => !PREFERENCE_COMMON_WORDS.has(word)).length;
    const lengthBonus = Math.max(0, words.length - NGRAM_MIN) * 0.2;
    const uncommonBonus = uncommonCount * 0.45;
    const singleWordPenalty = words.length === 1 ? -0.2 : 0;
    return Math.max(0.4, 1 + lengthBonus + uncommonBonus + singleWordPenalty);
}

function cullPreferenceSignals(signals) {
    const sorted = signals.slice().sort((a, b) => b.phrase.length - a.phrase.length);
    const removed = new Set();

    for (let i = 0; i < sorted.length; i++) {
        const larger = sorted[i];
        if (removed.has(larger.key)) {
            continue;
        }

        for (let j = i + 1; j < sorted.length; j++) {
            const smaller = sorted[j];
            if (removed.has(smaller.key)) {
                continue;
            }

            if (larger.key.includes(smaller.key) && larger.score >= smaller.score) {
                removed.add(smaller.key);
            }
        }
    }

    return sorted.filter(signal => !removed.has(signal.key));
}

function chooseBetterSignalPhrase(current, next) {
    const currentValue = String(current || '');
    const nextValue = String(next || '');
    return nextValue.length > currentValue.length ? nextValue : currentValue || nextValue;
}

async function createInferredPreferencesFromSignals(signals, hooks) {
    const cfg = settings();
    const preferences = await getPreferences();
    const existingEvidence = new Set(preferences.map(item => item.evidence).filter(Boolean));
    const ignored = await getPreferenceIgnoredSignals();
    let changed = false;
    const newIds = [];

    for (const signal of Object.values(signals)) {
        const phrase = signal.phrase || signal.key;
        if (!phrase || getSignalSuppressionKeys(signal.key || phrase).some(key => ignored[key]) || signal.count < cfg.inferenceThreshold || existingEvidence.has(phrase) || existingEvidence.has(signal.key)) {
            continue;
        }

        const sourceCounts = signal.sources || {};
        const evidenceDetails = `Seen ${signal.count} times (${Object.entries(sourceCounts).map(([source, count]) => `${source}: ${count}`).join(', ') || 'source unknown'}).`;
        const isSingleWord = !phrase.includes(' ');
        const preference = normalizePreference({
            status: 'disabled',
            type: 'style_preference',
            content: isSingleWord
                ? `Consider avoiding repeated use of the word "${phrase}" unless it is clearly intentional.`
                : `Consider avoiding repeated use of the phrase "${phrase}" unless it is clearly intentional.`,
            keywords: phrase.split(/\s+/),
            priority: 2,
            confidence: Math.min(0.9, 0.35 + signal.count * 0.1 + Number(signal.score || 0) * 0.02),
            source: 'inferred',
            evidence: phrase,
            evidenceDetails,
        });
        preferences.push(preference);
        newIds.push(preference.id);
        changed = true;
    }

    if (changed) {
        await setPreferences(preferences);
        await hooks.renderPreferences();
        await hooks.renderPreferenceSignals();
        notifyPreferenceCandidates(newIds.length);
    }
}

export async function reflectOnPreferenceEvidenceCore(hooks) {
    const cfg = settings();
    if (!cfg.memoryProfileId) {
        toastr.warning('Select a memory model profile before running preference reflection.', 'NemoLore');
        return;
    }

    const evidence = await getPreferenceEvidenceLog();
    const signalMap = await getPreferenceSignals();
    const signalList = Object.values(signalMap)
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    if (!evidence.length && !signalList.length) {
        toastr.info('No preference evidence has been logged yet.', 'NemoLore');
        return;
    }

    toastr.info('Reflecting on preference evidence...', 'NemoLore');
    const preferences = await getPreferences();

    try {
        const response = await runProfileRequest(
            cfg.memoryProfileId,
            buildPreferenceReflectionPrompt(evidence, signalList, preferences),
            Math.min(768, Math.max(384, cfg.maxSummaryTokens)),
        );
        const reflected = parsePreferenceReflectionResponse(getResponseText(response));
        const existingContents = new Set(preferences.map(item => item.content.toLowerCase()));
        const existingEvidence = new Set(preferences.map(item => item.evidence).filter(Boolean));
        let added = 0;

        for (const item of reflected) {
            if (!item.content || existingContents.has(item.content.toLowerCase()) || existingEvidence.has(item.evidence)) {
                continue;
            }

            const preference = normalizePreference({
                ...item,
                status: 'disabled',
                source: 'inferred',
                evidenceDetails: 'Generated by reflection over logged swipe/edit evidence.',
            });
            preferences.push(preference);
            existingContents.add(item.content.toLowerCase());
            if (item.evidence) {
                existingEvidence.add(item.evidence);
            }
            added += 1;
        }

        if (added > 0) {
            await setPreferences(preferences);
            await hooks.renderPreferences();
            notifyPreferenceCandidates(added, 'Reflection created');
        } else {
            toastr.info('Reflection did not find any new durable preference candidates.', 'NemoLore');
        }
    } catch (error) {
        console.warn('[NemoLore] Preference reflection failed', error);
        toastr.error(`Preference reflection failed: ${error.message}`, 'NemoLore');
    }
}

function parsePreferenceReflectionResponse(text) {
    const parsed = extractJsonArray(text);
    if (!Array.isArray(parsed)) {
        return [];
    }

    return parsed.slice(0, 5).map(item => ({
        type: item.type,
        content: String(item.content || '').trim(),
        keywords: Array.isArray(item.keywords) ? item.keywords.map(String).map(x => x.trim()).filter(Boolean) : inferPreferenceKeywords(item.content || ''),
        priority: Math.max(1, Math.min(5, Number(item.priority) || 2)),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
        evidence: String(item.evidence || 'reflection').trim(),
    })).filter(item => item.content);
}

export async function createPreferenceFromSignalCore(key, hooks) {
    const signals = await getPreferenceSignals();
    const signal = signals[key];
    if (!signal) {
        return;
    }

    const preferences = await getPreferences();
    const phrase = signal.phrase || signal.key;
    const existingEvidence = new Set(preferences.map(item => item.evidence).filter(Boolean).flatMap(getSignalSuppressionKeys));
    if (getSignalSuppressionKeys(signal.key || phrase).some(value => existingEvidence.has(value))) {
        toastr.info('A preference candidate already exists for that signal.', 'NemoLore');
        return null;
    }

    const isSingleWord = !String(phrase).includes(' ');
    const sources = Object.entries(signal.sources || {}).map(([source, count]) => `${source}: ${count}`).join(', ') || 'source unknown';
    const preference = normalizePreference({
        status: 'disabled',
        type: 'style_preference',
        content: isSingleWord
            ? `Consider avoiding repeated use of the word "${phrase}" unless it is clearly intentional.`
            : `Consider avoiding repeated use of the phrase "${phrase}" unless it is clearly intentional.`,
        keywords: String(phrase).split(/\s+/),
        priority: 2,
        confidence: Math.min(0.9, 0.35 + Number(signal.count || 0) * 0.1 + Number(signal.score || 0) * 0.02),
        source: 'inferred',
        evidence: phrase,
        evidenceDetails: `Created manually from signal leaderboard. Seen ${signal.count || 0} times (${sources}).`,
    });
    preferences.push(preference);
    await setPreferences(preferences);
    await hooks.renderPreferences();
    await hooks.renderPreferenceSignals();
    notifyPreferenceCandidates(1);
    return preference.id;
}

export async function discussPreferenceSignalCore(key, hooks) {
    const id = await createPreferenceFromSignalCore(key, hooks);
    if (id) {
        await discussPreferenceCandidateCore(id, hooks);
    }
}

export async function ignorePreferenceSignalCore(key, hooks) {
    const ignored = await getPreferenceIgnoredSignals();
    const signals = await getPreferenceSignals();
    for (const suppressionKey of getSignalSuppressionKeys(key)) {
        ignored[suppressionKey] = { key: suppressionKey, ignoredAt: Date.now() };
        delete signals[suppressionKey];
    }
    await setPreferenceIgnoredSignals(ignored);
    await setPreferenceSignals(signals);
    await hooks.renderPreferenceSignals();
    toastr.info('Signal ignored.', 'NemoLore');
}

export async function ignoreEvidenceSignalsCore(id, hooks) {
    const evidence = await getPreferenceEvidenceLog();
    const item = evidence.find(record => record.id === id);
    if (!item) {
        return;
    }

    const keys = [...new Set((item.signals || []).flatMap(signal => getSignalSuppressionKeys(signal.key || signal.phrase)))];
    const ignored = await getPreferenceIgnoredSignals();
    const signals = await getPreferenceSignals();
    for (const key of keys) {
        ignored[key] = { key, ignoredAt: Date.now() };
        delete signals[key];
    }
    await setPreferenceIgnoredSignals(ignored);
    await setPreferenceSignals(signals);
    await hooks.renderPreferenceSignals();
    toastr.info(`Ignored ${keys.length} signal${keys.length === 1 ? '' : 's'} from evidence item.`, 'NemoLore');
}

export async function deletePreferenceEvidenceCore(id, hooks) {
    const evidence = await getPreferenceEvidenceLog();
    await setPreferenceEvidenceLog(evidence.filter(record => record.id !== id));
    await hooks.renderPreferenceEvidence();
}

export async function clearPreferenceEvidenceCore(hooks) {
    await setPreferenceEvidenceLog([]);
    await hooks.renderPreferenceEvidence();
    toastr.info('Preference evidence log cleared.', 'NemoLore');
}

export async function clearIgnoredPreferenceSignalsCore(hooks) {
    await setPreferenceIgnoredSignals({});
    await hooks.renderPreferenceSignals();
    toastr.info('Ignored preference signals cleared.', 'NemoLore');
}

function notifyPreferenceCandidates(count, prefix = 'NemoLore found') {
    const label = `${prefix} ${count} preference candidate${count === 1 ? '' : 's'} for review. Click to inspect.`;
    toastr.info(label, 'NemoLore', {
        timeOut: 12000,
        extendedTimeOut: 12000,
        onclick: () => {
            const container = document.getElementById('nemo_lore_preference_review_queue')
                || document.getElementById('nemo_lore_preferences');
            if (container) {
                container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
    });
}

export function isPreferenceReviewCandidate(item) {
    return !!item
        && item.status === 'disabled'
        && item.source === 'inferred'
        && item.reviewDecision !== 'rejected'
        && String(item.content || '').trim().length > 0;
}

export async function acceptPreferenceCandidateCore(id, hooks) {
    const preferences = await getPreferences();
    const item = preferences.find(preference => preference.id === id);
    if (!item) {
        return;
    }

    item.status = 'active';
    item.reviewDecision = 'accepted';
    item.reviewedAt = Date.now();
    item.updatedAt = Date.now();
    await setPreferences(preferences);
    await hooks.renderPreferences();
    await hooks.updatePreferencesPrompt();
    toastr.success('Preference candidate accepted and exposed to the core pack.', 'NemoLore');
}

export async function rejectPreferenceCandidateCore(id, hooks) {
    const preferences = await getPreferences();
    const item = preferences.find(preference => preference.id === id);
    if (!item) {
        return;
    }

    if (item.source === 'inferred') {
        await suppressPreferenceEvidence(item);
    }

    await setPreferences(preferences.filter(preference => preference.id !== id));
    await hooks.renderPreferences();
    await hooks.renderPreferenceSignals();
    await hooks.updatePreferencesPrompt();
    toastr.info('Preference candidate rejected and its source signal was suppressed.', 'NemoLore');
}

export async function discussPreferenceCandidateCore(id, hooks) {
    const preferences = await getPreferences();
    const item = preferences.find(preference => preference.id === id);
    if (!item) {
        return;
    }

    const prompt = [
        'NemoLore thinks it noticed this preference:',
        '',
        item.content,
        '',
        item.evidence ? `Evidence: ${item.evidence}` : '',
        item.evidenceDetails || '',
        '',
        'Tell NemoLore what this means. You can confirm it, correct it, add nuance, or say it guessed wrong.',
    ].filter(Boolean).join('\n');
    const clarification = await Popup.show.input('Discuss Preference Candidate', prompt, '', {
        rows: 6,
        wider: true,
        placeholder: 'Example: Yes, remember that I dislike that word, especially in narration.',
    });

    if (clarification === null || clarification === undefined) {
        return;
    }

    await applyPreferenceDiscussionCore(item.id, clarification, hooks);
}

export async function applyPreferenceDiscussionCore(id, clarification, hooks) {
    const preferences = await getPreferences();
    const item = preferences.find(preference => preference.id === id);
    if (!item) {
        return;
    }

    const text = String(clarification || '').trim();
    if (!text) {
        return;
    }

    const cfg = settings();
    if (!cfg.memoryProfileId) {
        item.content = text;
        item.keywords = inferPreferenceKeywords(text);
        item.status = 'active';
        item.source = 'explicit';
        item.updatedAt = Date.now();
        await setPreferences(preferences);
        await hooks.renderPreferences();
        await hooks.updatePreferencesPrompt();
        toastr.success('Preference updated from your clarification.', 'NemoLore');
        return;
    }

    try {
        const evidence = await getEvidenceForPreference(item);
        const response = await runProfileRequest(
            cfg.memoryProfileId,
            buildPreferenceDiscussionPrompt(item, text, evidence),
            Math.min(384, Math.max(256, cfg.maxSummaryTokens)),
        );
        const result = parsePreferenceDiscussionResponse(getResponseText(response), text);

        if (result.action === 'delete') {
            await suppressPreferenceEvidence(item);
            await setPreferences(preferences.filter(preference => preference.id !== id));
            await hooks.renderPreferences();
            await hooks.renderPreferenceSignals();
            await hooks.updatePreferencesPrompt();
            toastr.info('Preference candidate removed.', 'NemoLore');
            return;
        }

        item.status = result.action === 'disable' ? 'disabled' : 'active';
        item.type = result.type;
        item.content = result.content;
        item.keywords = result.keywords;
        item.priority = result.priority;
        item.confidence = result.confidence;
        item.source = 'explicit';
        item.evidenceDetails = result.reason ? `Discussed with user: ${result.reason}` : item.evidenceDetails;
        item.updatedAt = Date.now();
        await setPreferences(preferences);
        await hooks.renderPreferences();
        await hooks.updatePreferencesPrompt();
        toastr.success(item.status === 'active' ? 'Preference remembered.' : 'Preference kept disabled for review.', 'NemoLore');
    } catch (error) {
        console.warn('[NemoLore] Preference discussion failed', error);
        item.content = text;
        item.keywords = inferPreferenceKeywords(text);
        item.status = 'active';
        item.source = 'explicit';
        item.updatedAt = Date.now();
        await setPreferences(preferences);
        await hooks.renderPreferences();
        await hooks.updatePreferencesPrompt();
        toastr.warning('The memory model discussion failed, so NemoLore saved your clarification directly.', 'NemoLore');
    }
}

async function getEvidenceForPreference(item) {
    const evidence = await getPreferenceEvidenceLog();
    const key = String(item.evidence || '').toLowerCase();
    if (!key) {
        return evidence.slice(0, 12);
    }

    const matching = evidence.filter(record => {
        const signals = Array.isArray(record.signals) ? record.signals : [];
        return signals.some(signal => String(signal.phrase || signal.key || '').toLowerCase() === key)
            || String(record.rejectedText || '').toLowerCase().includes(key)
            || String(record.acceptedText || '').toLowerCase().includes(key);
    });

    return (matching.length ? matching : evidence).slice(0, 12);
}

function parsePreferenceDiscussionResponse(text, fallbackNote) {
    const parsed = extractJsonObject(text);
    const action = ['save', 'disable', 'delete'].includes(parsed.action) ? parsed.action : 'save';
    if (action === 'delete') {
        return { action };
    }

    const normalized = normalizePreference({
        type: parsed.type,
        content: parsed.content || fallbackNote,
        keywords: parsed.keywords,
        priority: parsed.priority,
        confidence: parsed.confidence,
        source: 'explicit',
    }, fallbackNote);

    return {
        action,
        type: normalized.type,
        content: normalized.content,
        keywords: normalized.keywords,
        priority: normalized.priority,
        confidence: normalized.confidence,
        reason: String(parsed.reason || '').trim(),
    };
}

async function createPreferenceFromNote(note) {
    const cfg = settings();
    if (!cfg.memoryProfileId) {
        return normalizePreference({ content: note, keywords: inferPreferenceKeywords(note), source: 'explicit' }, note);
    }

    try {
        const response = await runProfileRequest(
            cfg.memoryProfileId,
            buildPreferencePrompt(note),
            Math.min(256, cfg.maxSummaryTokens),
        );
        return parsePreferenceResponse(getResponseText(response), note);
    } catch (error) {
        console.warn('[NemoLore] Preference normalization failed; saving raw note', error);
        return normalizePreference({ content: note, keywords: inferPreferenceKeywords(note), source: 'explicit' }, note);
    }
}

function inferPreferenceKeywords(note) {
    return [...new Set(String(note).toLowerCase().match(/[a-z0-9'-]{4,}/g) || [])].slice(0, 8);
}

export async function editPreferenceCore(id, hooks) {
    const preferences = await getPreferences();
    const item = preferences.find(preference => preference.id === id);
    if (!item) {
        return;
    }

    const content = await Popup.show.input('Edit preference', 'Write the preference as an instruction for future chats.', item.content || '', { rows: 6 });
    if (content === null || content === undefined) {
        return;
    }

    const keywords = await Popup.show.input('Edit preference keywords', 'Comma-separated tags for organization/search.', (item.keywords || []).join(', '));
    if (keywords === null || keywords === undefined) {
        return;
    }

    item.content = String(content).trim();
    item.keywords = String(keywords).split(',').map(x => x.trim()).filter(Boolean);
    item.updatedAt = Date.now();
    await setPreferences(preferences);
    await hooks.renderPreferences();
    await hooks.updatePreferencesPrompt();
}

export async function togglePreferenceCore(id, hooks) {
    const preferences = await getPreferences();
    const item = preferences.find(preference => preference.id === id);
    if (!item) {
        return;
    }

    item.status = item.status === 'active' ? 'disabled' : 'active';
    item.updatedAt = Date.now();
    await setPreferences(preferences);
    await hooks.renderPreferences();
    await hooks.updatePreferencesPrompt();
}

export async function deletePreferenceCore(id, hooks) {
    const preferences = await getPreferences();
    const item = preferences.find(preference => preference.id === id);
    if (item && item.source === 'inferred') {
        await suppressPreferenceEvidence(item);
    }

    const next = preferences.filter(preference => preference.id !== id);
    await setPreferences(next);
    await hooks.renderPreferences();
    await hooks.renderPreferenceSignals();
    await hooks.updatePreferencesPrompt();
}

async function suppressPreferenceEvidence(item) {
    const keys = getSignalSuppressionKeys(item.evidence);
    if (!keys.length) {
        return;
    }

    const ignored = await getPreferenceIgnoredSignals();
    const signals = await getPreferenceSignals();
    for (const key of keys) {
        ignored[key] = { key, ignoredAt: Date.now(), reason: 'candidate_deleted' };
        delete signals[key];
    }
    await setPreferenceIgnoredSignals(ignored);
    await setPreferenceSignals(signals);
}

export function initProblemLineSelectionMenuCore(hooks) {
    document.addEventListener('selectionchange', () => {
        setTimeout(() => updateProblemLineSelectionMenu(hooks), 50);
    });
    document.addEventListener('mousedown', event => {
        if (problemLineMenu && !problemLineMenu.contains(event.target)) {
            removeProblemLineMenuCore();
        }
    });
    document.addEventListener('touchstart', event => {
        if (problemLineMenu && !problemLineMenu.contains(event.target)) {
            removeProblemLineMenuCore();
        }
    });
    const chatElement = document.getElementById('chat');
    if (chatElement) {
        chatElement.addEventListener('scroll', removeProblemLineMenuCore);
    }
}

function updateProblemLineSelectionMenu(hooks) {
    const cfg = settings();
    if (!cfg.enabled || !cfg.inferenceEnabled || !cfg.selectionProblemMenu) {
        removeProblemLineMenuCore();
        return;
    }

    const selectionInfo = getProblemLineSelectionInfo();
    if (!selectionInfo) {
        removeProblemLineMenuCore();
        return;
    }

    lastProblemLineSelection = selectionInfo;
    showProblemLineMenu(selectionInfo.rect, hooks);
}

function getProblemLineSelectionInfo() {
    const selection = window.getSelection();
    const selectedText = String(selection?.toString() || '').trim();
    if (!selection || !selectedText || selection.rangeCount === 0) {
        return null;
    }

    const range = selection.getRangeAt(0);
    const startMesText = findClosestElement(range.startContainer, '.mes_text');
    const endMesText = findClosestElement(range.endContainer, '.mes_text');
    if (!startMesText || startMesText !== endMesText) {
        return null;
    }

    const messageDiv = startMesText.closest('.mes');
    const messageId = Number(messageDiv?.getAttribute('mesid'));
    const message = Number.isInteger(messageId) ? chat[messageId] : null;
    if (!message || message.is_user || message.is_system) {
        return null;
    }

    return {
        messageId,
        selectedText,
        fullText: getAssistantMessageText(messageId),
        rect: range.getBoundingClientRect(),
    };
}

function findClosestElement(node, selector) {
    let current = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    while (current) {
        if (current.matches?.(selector)) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

function showProblemLineMenu(rect, hooks) {
    if (!problemLineMenu) {
        problemLineMenu = document.createElement('div');
        problemLineMenu.className = 'nemo-lore-selection-menu';
        const button = document.createElement('button');
        button.className = 'menu_button';
        button.type = 'button';
        button.textContent = 'Report Problem Line';
        button.addEventListener('mousedown', event => {
            event.preventDefault();
            event.stopPropagation();
        });
        button.addEventListener('click', async event => {
            event.preventDefault();
            event.stopPropagation();
            const selectionInfo = lastProblemLineSelection;
            removeProblemLineMenuCore();
            window.getSelection()?.removeAllRanges();
            if (selectionInfo) {
                await recordProblemLineSelectionCore(selectionInfo, hooks);
            }
        });
        problemLineMenu.appendChild(button);
        document.body.appendChild(problemLineMenu);
    }

    const menuRect = problemLineMenu.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - menuRect.width - 8);
    const top = rect.bottom + menuRect.height + 8 > window.innerHeight
        ? Math.max(8, rect.top - menuRect.height - 8)
        : rect.bottom + 8;
    problemLineMenu.style.left = `${left}px`;
    problemLineMenu.style.top = `${top}px`;
}

export function removeProblemLineMenuCore() {
    if (problemLineMenu) {
        problemLineMenu.remove();
        problemLineMenu = null;
    }
}

