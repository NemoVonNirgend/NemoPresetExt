import { getCurrentChatId } from '../../../../../../script.js';
import {
    createWorldInfoEntry,
    loadWorldInfo,
    saveWorldInfo,
} from '../../../../../world-info.js';
import { Popup } from '../../../../../popup.js';
import { getNemoLoreSettings as settings } from './settings.js';
import { getInbox, setInbox } from './storage.js';
import {
    buildLorebookUpdatePrompt,
    extractJsonObject,
    getResponseText,
} from './prompts.js';
import { runProfileRequest } from './shared/model-service.js';

export async function editNemoLoreCandidate(id, { renderInbox }) {
    const chatId = getCurrentChatId();
    const inbox = await getInbox(chatId);
    const item = inbox.find(candidate => candidate.id === id);
    if (!item) {
        return;
    }

    const edited = await openNemoLoreCandidateEditor(item);
    if (!edited) {
        return;
    }

    Object.assign(item, edited);
    await setInbox(chatId, inbox);
    await renderInbox();
}

export async function openNemoLoreCandidateEditor(item) {
    const subject = await Popup.show.input('Edit memory subject', 'Name the entity, relationship, or topic.', item.subject || '');
    if (subject === null || subject === undefined) {
        return null;
    }

    const content = await Popup.show.input('Edit memory content', 'Write this as a standalone memory.', item.content || '', { rows: 8 });
    if (content === null || content === undefined) {
        return null;
    }

    const keywords = await Popup.show.input('Edit memory keywords', 'Comma-separated World Info activation keys.', (item.keywords || []).join(', '));
    if (keywords === null || keywords === undefined) {
        return null;
    }

    return {
        subject: String(subject).trim(),
        content: String(content).trim(),
        keywords: String(keywords).split(',').map(x => x.trim()).filter(Boolean),
    };
}

export async function updateNemoLoreCandidateStatus(id, status, { renderInbox }) {
    const chatId = getCurrentChatId();
    const inbox = await getInbox(chatId);
    const item = inbox.find(candidate => candidate.id === id);
    if (!item) {
        return;
    }

    item.status = status;
    await setInbox(chatId, inbox);
    await renderInbox();
}

export async function createNemoLoreWorldInfoEntry(id, { renderInbox }) {
    const cfg = settings();
    const chatId = getCurrentChatId();
    const inbox = await getInbox(chatId);
    const item = inbox.find(candidate => candidate.id === id);

    if (!item) {
        return;
    }

    if (!cfg.managedWorld) {
        toastr.warning('Select a managed lorebook before promoting a memory.');
        return;
    }

    const data = await loadWorldInfo(cfg.managedWorld);
    if (!data?.entries) {
        toastr.error('Could not load the selected lorebook.');
        return;
    }

    const entry = createWorldInfoEntry(cfg.managedWorld, data);
    if (!entry) {
        toastr.error('Could not create a lorebook entry.');
        return;
    }

    entry.comment = item.subject || item.type;
    entry.content = item.content;
    entry.key = item.keywords.length ? item.keywords : [item.subject].filter(Boolean);
    entry.addMemo = true;

    await saveWorldInfo(cfg.managedWorld, data, true);
    item.status = 'promoted';
    item.world = cfg.managedWorld;
    item.worldEntryUid = entry.uid;
    await setInbox(chatId, inbox);
    await renderInbox();
    toastr.success('Memory promoted to lorebook entry.', 'NemoLore');
}

export async function appendNemoLoreCandidateToWorldInfoEntry(id, uid, { renderInbox }) {
    const cfg = settings();
    const chatId = getCurrentChatId();
    const inbox = await getInbox(chatId);
    const item = inbox.find(candidate => candidate.id === id);

    if (!item) {
        return;
    }

    if (!cfg.managedWorld) {
        toastr.warning('Select a managed lorebook before promoting a memory.');
        return;
    }

    const data = await loadWorldInfo(cfg.managedWorld);
    const entry = data?.entries?.[uid];
    if (!entry) {
        toastr.error('Could not find the matched lorebook entry.');
        return;
    }

    const addition = formatNemoLoreCandidateAppendText(item);
    if (!String(entry.content || '').includes(item.content)) {
        entry.content = [String(entry.content || '').trim(), addition].filter(Boolean).join('\n\n');
    }

    const existingKeys = new Set(Array.isArray(entry.key) ? entry.key : []);
    for (const key of item.keywords) {
        existingKeys.add(key);
    }
    if (item.subject) {
        existingKeys.add(item.subject);
    }
    entry.key = [...existingKeys].filter(Boolean);
    entry.addMemo = true;

    await saveWorldInfo(cfg.managedWorld, data, true);
    item.status = 'promoted';
    item.world = cfg.managedWorld;
    item.worldEntryUid = entry.uid;
    await setInbox(chatId, inbox);
    await renderInbox();
    toastr.success('Memory appended to lorebook entry.', 'NemoLore');
}

export async function proposeNemoLoreWorldInfoUpdate(id, uid, { renderInbox }) {
    const cfg = settings();
    const chatId = getCurrentChatId();
    const inbox = await getInbox(chatId);
    const item = inbox.find(candidate => candidate.id === id);

    if (!item) {
        return;
    }

    if (!cfg.managedWorld) {
        toastr.warning('Select a managed lorebook before updating a memory.');
        return;
    }

    if (!cfg.memoryProfileId) {
        toastr.warning('Select a memory model profile before proposing a lorebook update.', 'NemoLore');
        return;
    }

    const data = await loadWorldInfo(cfg.managedWorld);
    const entry = data?.entries?.[uid];
    if (!entry) {
        toastr.error('Could not find the matched lorebook entry.');
        return;
    }

    toastr.info('Drafting lorebook update...', 'NemoLore');
    try {
        const response = await runProfileRequest(
            cfg.memoryProfileId,
            buildLorebookUpdatePrompt(item, entry),
            Math.min(768, Math.max(384, cfg.maxSummaryTokens)),
        );

        const proposal = parseNemoLoreUpdateResponse(getResponseText(response), item, entry);
        if (proposal.action === 'skip') {
            toastr.info('Model recommended skipping this lorebook update.', 'NemoLore');
            return;
        }

        const reviewed = await reviewNemoLoreUpdateProposal(proposal, entry);
        if (!reviewed) {
            return;
        }

        applyNemoLoreUpdate(entry, reviewed);
        await saveWorldInfo(cfg.managedWorld, data, true);
        item.status = 'promoted';
        item.world = cfg.managedWorld;
        item.worldEntryUid = entry.uid;
        await setInbox(chatId, inbox);
        await renderInbox();
        toastr.success('Lorebook entry updated from reviewed proposal.', 'NemoLore');
    } catch (error) {
        console.warn('[NemoLore] Lorebook update proposal failed', error);
        toastr.error('Failed to draft lorebook update.', 'NemoLore');
    }
}

export function parseNemoLoreUpdateResponse(text, candidate, entry) {
    const parsed = extractJsonObject(text);
    return {
        action: ['update', 'append', 'skip'].includes(parsed.action) ? parsed.action : 'skip',
        comment: String(parsed.comment || entry.comment || candidate.subject || '').trim(),
        content: String(parsed.content || '').trim(),
        keys: normalizeNemoLoreKeys(parsed.keys, Array.isArray(entry.key) ? entry.key : [], candidate),
        secondaryKeys: normalizeNemoLoreKeys(parsed.secondaryKeys, Array.isArray(entry.keysecondary) ? entry.keysecondary : []),
        reason: String(parsed.reason || '').trim(),
    };
}

export function normalizeNemoLoreKeys(value, fallback = [], candidate = null) {
    const keys = Array.isArray(value)
        ? value.map(String).map(x => x.trim()).filter(Boolean)
        : String(value || '').split(',').map(x => x.trim()).filter(Boolean);

    const result = keys.length ? keys : [...fallback];
    if (candidate?.subject && !result.includes(candidate.subject)) {
        result.unshift(candidate.subject);
    }
    for (const keyword of candidate?.keywords || []) {
        if (!result.includes(keyword)) {
            result.push(keyword);
        }
    }
    return [...new Set(result)];
}

export async function reviewNemoLoreUpdateProposal(proposal, entry) {
    const content = await Popup.show.input(
        'Review Lorebook Update',
        [
            `Action: ${proposal.action}`,
            proposal.reason ? `Reason: ${proposal.reason}` : '',
            '',
            'Edit the full entry content before saving:',
        ].filter(Boolean).join('\n'),
        proposal.content || String(entry.content || ''),
        { rows: 18, wider: true },
    );
    if (content === null || content === undefined) {
        return null;
    }

    const keys = await Popup.show.input(
        'Review Primary Keys',
        'Comma-separated primary activation keys.',
        (proposal.keys || []).join(', '),
    );
    if (keys === null || keys === undefined) {
        return null;
    }

    const secondaryKeys = await Popup.show.input(
        'Review Secondary Keys',
        'Comma-separated secondary activation keys.',
        (proposal.secondaryKeys || []).join(', '),
    );
    if (secondaryKeys === null || secondaryKeys === undefined) {
        return null;
    }

    const comment = await Popup.show.input(
        'Review Entry Title',
        'Optional lorebook entry title/comment.',
        proposal.comment || entry.comment || '',
    );
    if (comment === null || comment === undefined) {
        return null;
    }

    return {
        ...proposal,
        content: String(content).trim(),
        keys: splitNemoLoreKeyInput(keys),
        secondaryKeys: splitNemoLoreKeyInput(secondaryKeys),
        comment: String(comment).trim(),
    };
}

export function splitNemoLoreKeyInput(value) {
    return String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

export function applyNemoLoreUpdate(entry, update) {
    entry.content = update.content;
    entry.key = update.keys;
    entry.keysecondary = update.secondaryKeys;
    entry.comment = update.comment || entry.comment;
    entry.addMemo = true;
}

export function formatNemoLoreCandidateAppendText(item) {
    const label = item.type === 'note' ? 'NemoLore memory' : `NemoLore ${item.type.replaceAll('_', ' ')} memory`;
    return `${label}: ${item.content}`;
}

export async function findNemoLoreWorldInfoMatches(item) {
    const cfg = settings();
    if (!cfg.managedWorld) {
        return [];
    }

    const data = await loadWorldInfo(cfg.managedWorld);
    if (!data?.entries) {
        return [];
    }

    const terms = getNemoLoreCandidateMatchTerms(item);
    if (!terms.length) {
        return [];
    }

    return Object.values(data.entries)
        .map(entry => ({ entry, score: scoreNemoLoreWorldInfoEntry(entry, terms) }))
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}

export function getNemoLoreCandidateMatchTerms(item) {
    return [item.subject, ...(item.keywords || [])]
        .map(term => String(term || '').trim().toLowerCase())
        .filter(term => term.length >= 2);
}

export function scoreNemoLoreWorldInfoEntry(entry, terms) {
    const keyText = Array.isArray(entry.key) ? entry.key.join('\n').toLowerCase() : '';
    const comment = String(entry.comment || '').toLowerCase();
    const content = String(entry.content || '').toLowerCase();
    let score = 0;

    for (const term of terms) {
        if (comment === term) {
            score += 8;
        } else if (comment.includes(term)) {
            score += 5;
        }

        if (keyText.split('\n').includes(term)) {
            score += 6;
        } else if (keyText.includes(term)) {
            score += 3;
        }

        if (content.includes(term)) {
            score += 1;
        }
    }

    return score;
}

export function formatNemoLoreWorldInfoEntryLabel(entry) {
    return entry.comment || (Array.isArray(entry.key) ? entry.key.join(', ') : '') || `Entry ${entry.uid}`;
}

