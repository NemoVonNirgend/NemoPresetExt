import { uuidv4 } from '../../../../../utils.js';

function normalizeCandidateType(type) {
    const allowed = new Set(['character', 'relationship', 'location', 'item', 'plot_thread', 'world_lore', 'preference', 'style_preference', 'temporary_state', 'note']);
    const value = String(type || 'note').trim();
    return allowed.has(value) ? value : 'note';
}

function normalizeCandidateScope(scope) {
    const allowed = new Set(['chat', 'character', 'persona', 'global', 'world']);
    const value = String(scope || 'chat').trim();
    return allowed.has(value) ? value : 'chat';
}

export function normalizePreference(input, fallbackNote = '') {
    const allowed = new Set(['style_preference', 'content_preference', 'roleplay_preference', 'boundary', 'format_preference', 'note']);
    const type = String(input.type || 'note').trim();
    const content = String(input.content || fallbackNote || '').trim();

    return {
        id: uuidv4(),
        status: input.status === 'disabled' ? 'disabled' : 'active',
        type: allowed.has(type) ? type : 'note',
        content,
        keywords: Array.isArray(input.keywords) ? input.keywords.map(String).map(x => x.trim()).filter(Boolean) : [],
        priority: Math.max(1, Math.min(5, Number(input.priority) || 3)),
        confidence: Math.max(0, Math.min(1, Number(input.confidence) || 1)),
        source: input.source === 'inferred' ? 'inferred' : 'explicit',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        evidence: input.evidence ? String(input.evidence) : undefined,
        evidenceDetails: input.evidenceDetails ? String(input.evidenceDetails) : undefined,
    };
}

export function buildSummaryPrompt(messages) {
    return [
        {
            role: 'system',
            content: [
                'You extract durable roleplay continuity from a completed SillyTavern turn.',
                'Summarize the exchange as one paired event. Preserve nuance from both user action and assistant response.',
                'Also propose stable semantic memories that might deserve a lorebook entry.',
                'Return only valid JSON matching the requested shape.',
            ].join(' '),
        },
        {
            role: 'user',
            content: [
                'Summarize this completed turn pair for memory compression.',
                '',
                messages,
                '',
                'Return this JSON shape:',
                '{',
                '  "summary": "one concise paired-turn summary",',
                '  "importance": 1,',
                '  "entities": ["name"],',
                '  "candidates": [',
                '    {',
                '      "type": "character|relationship|location|item|plot_thread|world_lore|preference|style_preference|temporary_state|note",',
                '      "subject": "entity or topic",',
                '      "content": "standalone memory suitable for recall",',
                '      "keywords": ["activation", "keys"],',
                '      "confidence": 0.0,',
                '      "importance": 1,',
                '      "scope": "chat|character|persona|global|world"',
                '    }',
                '  ]',
                '}',
            ].join('\n'),
        },
    ];
}

export function extractJsonObject(text) {
    const raw = typeof text === 'string' ? text.trim() : JSON.stringify(text);
    const withoutFence = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    if (withoutFence.startsWith('{')) {
        return JSON.parse(withoutFence);
    }

    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('No JSON object found in memory model response');
    }

    return JSON.parse(withoutFence.slice(start, end + 1));
}

export function extractJsonArray(text) {
    const raw = typeof text === 'string' ? text.trim() : JSON.stringify(text);
    const withoutFence = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    if (withoutFence.startsWith('[')) {
        return JSON.parse(withoutFence);
    }

    const start = withoutFence.indexOf('[');
    const end = withoutFence.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('No JSON array found in memory model response');
    }

    return JSON.parse(withoutFence.slice(start, end + 1));
}

export function parseSummaryResponse(text) {
    const parsed = extractJsonObject(text);
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates.map(candidate => ({
        type: normalizeCandidateType(candidate.type),
        subject: String(candidate.subject || '').trim(),
        content: String(candidate.content || '').trim(),
        keywords: Array.isArray(candidate.keywords) ? candidate.keywords.map(String).map(x => x.trim()).filter(Boolean) : [],
        confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0)),
        importance: Math.max(1, Math.min(5, Number(candidate.importance) || 1)),
        scope: normalizeCandidateScope(candidate.scope),
    })).filter(candidate => candidate.content) : [];

    return {
        summary: String(parsed.summary || '').trim(),
        importance: Math.max(1, Math.min(5, Number(parsed.importance) || 1)),
        entities: Array.isArray(parsed.entities) ? parsed.entities.map(String).filter(Boolean) : [],
        facts: candidates.map(candidate => ({
            type: candidate.type,
            content: candidate.content,
            confidence: candidate.confidence,
        })),
        candidates,
    };
}

export function parsePreferenceResponse(text, fallbackNote) {
    try {
        const parsed = extractJsonObject(text);
        return normalizePreference({
            type: parsed.type,
            content: parsed.content,
            keywords: parsed.keywords,
            priority: parsed.priority,
            confidence: parsed.confidence,
            source: 'explicit',
        }, fallbackNote);
    } catch (error) {
        console.warn('[NemoLore] Preference model response was not valid JSON; using raw note', error);
        return normalizePreference({ content: fallbackNote, source: 'explicit' }, fallbackNote);
    }
}

export function getResponseText(response) {
    if (typeof response === 'string') {
        return response;
    }

    return response?.content ?? response?.text ?? response?.message ?? JSON.stringify(response);
}

export function buildPreferencePrompt(note) {
    return [
        {
            role: 'system',
            content: [
                'You convert explicit user feedback into a durable cross-chat preference for SillyTavern roleplay/writing.',
                'Do not invent preferences beyond the note.',
                'Return only valid JSON.',
            ].join(' '),
        },
        {
            role: 'user',
            content: [
                'User feedback:',
                note,
                '',
                'Return this JSON shape:',
                '{',
                '  "type": "style_preference|content_preference|roleplay_preference|boundary|format_preference|note",',
                '  "content": "clear instruction phrased for future generations",',
                '  "keywords": ["short", "tags"],',
                '  "priority": 1,',
                '  "confidence": 1.0',
                '}',
            ].join('\n'),
        },
    ];
}

export function buildProblemLinePreferencePrompt(selectionInfo, note) {
    return [
        {
            role: 'system',
            content: [
                'You convert user feedback about a selected problem line into a durable cross-chat writing preference.',
                'The selected text is evidence, not necessarily the final rule.',
                'Do not invent preferences beyond the user note.',
                'Return only valid JSON.',
            ].join(' '),
        },
        {
            role: 'user',
            content: [
                'Selected problem text:',
                selectionInfo.selectedText,
                '',
                'Full target message context:',
                selectionInfo.fullText,
                '',
                'User explanation:',
                note,
                '',
                'Return this JSON shape:',
                '{',
                '  "type": "style_preference|content_preference|roleplay_preference|boundary|format_preference|note",',
                '  "content": "clear instruction phrased for future generations",',
                '  "keywords": ["short", "tags"],',
                '  "priority": 1,',
                '  "confidence": 1.0',
                '}',
            ].join('\n'),
        },
    ];
}

export function buildPreferenceReflectionPrompt(evidence, signals, preferences) {
    const activePreferenceText = preferences
        .slice(0, 20)
        .map(item => `- ${item.status}: ${item.content}`)
        .join('\n') || 'None';
    const signalText = signals
        .slice(0, 30)
        .map(signal => {
            const sources = Object.entries(signal.sources || {}).map(([source, count]) => `${source}:${count}`).join(', ') || 'unknown';
            return `- "${signal.phrase || signal.key}" count=${signal.count || 0} score=${Number(signal.score || 0).toFixed(2)} sources=${sources}`;
        })
        .join('\n') || 'None';
    const evidenceText = evidence
        .slice(0, 40)
        .map(item => [
            `Source: ${item.source}`,
            `Signals: ${(item.signals || []).slice(0, 8).map(signal => signal.phrase).filter(Boolean).join(', ') || 'none'}`,
            item.rejectedText ? `Rejected/removed: ${item.rejectedText}` : '',
            item.acceptedText ? `Accepted/kept: ${item.acceptedText}` : '',
        ].filter(Boolean).join('\n'))
        .join('\n\n---\n\n') || 'None';

    return [
        {
            role: 'system',
            content: [
                'You review behavioral evidence from a SillyTavern memory extension.',
                'Your job is to infer only durable user preferences that are strongly supported by repeated swipe, accepted-swipe, or edit evidence.',
                'Be conservative. Do not infer plot facts, character facts, or one-off tastes.',
                'Prefer concrete writing/style instructions over vague advice.',
                'Return only valid JSON.',
            ].join(' '),
        },
        {
            role: 'user',
            content: [
                'Existing preferences:',
                activePreferenceText,
                '',
                'Aggregate evidence signals:',
                signalText,
                '',
                'Recent evidence log:',
                evidenceText,
                '',
                'Return a JSON array of zero to five preference candidates.',
                'Each object must have this shape:',
                '{',
                '  "type": "style_preference|content_preference|roleplay_preference|boundary|format_preference|note",',
                '  "content": "clear instruction for future generations",',
                '  "keywords": ["short", "tags"],',
                '  "priority": 1,',
                '  "confidence": 0.0,',
                '  "evidence": "short evidence label"',
                '}',
            ].join('\n'),
        },
    ];
}

export function buildPreferenceDiscussionPrompt(candidate, userNote, evidence) {
    const evidenceText = evidence
        .slice(0, 12)
        .map(item => [
            `Source: ${item.source}`,
            `Signals: ${(item.signals || []).slice(0, 6).map(signal => signal.phrase).filter(Boolean).join(', ') || 'none'}`,
            item.rejectedText ? `Rejected/removed: ${item.rejectedText}` : '',
            item.acceptedText ? `Accepted/kept: ${item.acceptedText}` : '',
        ].filter(Boolean).join('\n'))
        .join('\n\n---\n\n') || 'No matching log entries found.';

    return [
        {
            role: 'system',
            content: [
                'You help a user review a proposed cross-chat writing preference inferred by NemoLore.',
                'Use the evidence only as context; the user clarification is authoritative.',
                'If the user rejects the inference, return action "delete".',
                'If the user says to remember it or gives a corrected preference, return action "save".',
                'If the user is uncertain but wants to keep it for later review, return action "disable".',
                'Return only valid JSON.',
            ].join(' '),
        },
        {
            role: 'user',
            content: [
                'Proposed preference:',
                candidate.content,
                '',
                'Evidence label:',
                candidate.evidence || 'none',
                '',
                'Evidence details:',
                candidate.evidenceDetails || 'none',
                '',
                'Relevant logged evidence:',
                evidenceText,
                '',
                'User clarification:',
                userNote,
                '',
                'Return this JSON shape:',
                '{',
                '  "action": "save|disable|delete",',
                '  "type": "style_preference|content_preference|roleplay_preference|boundary|format_preference|note",',
                '  "content": "clear instruction for future generations",',
                '  "keywords": ["short", "tags"],',
                '  "priority": 1,',
                '  "confidence": 0.0,',
                '  "reason": "brief reason for the user-facing memory change"',
                '}',
            ].join('\n'),
        },
    ];
}

export function buildLorebookUpdatePrompt(candidate, entry) {
    return [
        {
            role: 'system',
            content: [
                'You update SillyTavern lorebook entries from proposed memory facts.',
                'Preserve useful existing information. Add the new memory only if it is durable and relevant to the entry.',
                'Do not add temporary scene state unless it changes durable characterization, relationships, locations, items, or world lore.',
                'If the new memory conflicts with existing content, keep both only when the conflict is meaningful and explicitly note the uncertainty.',
                'Return only valid JSON.',
            ].join(' '),
        },
        {
            role: 'user',
            content: [
                'Existing lorebook entry:',
                JSON.stringify({
                    title: entry.comment || '',
                    keys: Array.isArray(entry.key) ? entry.key : [],
                    secondaryKeys: Array.isArray(entry.keysecondary) ? entry.keysecondary : [],
                    content: String(entry.content || ''),
                }, null, 2),
                '',
                'Proposed NemoLore memory:',
                JSON.stringify({
                    type: candidate.type,
                    subject: candidate.subject,
                    content: candidate.content,
                    keywords: candidate.keywords,
                    confidence: candidate.confidence,
                    importance: candidate.importance,
                    scope: candidate.scope,
                }, null, 2),
                '',
                'Return this JSON shape:',
                '{',
                '  "action": "update|append|skip",',
                '  "comment": "short entry title/memo",',
                '  "content": "complete revised lorebook entry content",',
                '  "keys": ["primary", "activation", "keys"],',
                '  "secondaryKeys": ["optional", "secondary", "keys"],',
                '  "reason": "brief explanation of the merge decision"',
                '}',
            ].join('\n'),
        },
    ];
}

