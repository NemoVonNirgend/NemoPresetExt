import { RobustReasoningParser } from './robust-reasoning-parser.js';

const EXPLICIT_STRATEGIES = new Set([
    'native',
    'varied-closing-tags',
    'deepseek-r1',
    'deepseek-r1-partial',
    'gemini-thoughts',
    'gemini-thinking',
    'partialSuffix',
]);

const STRUCTURED_STRATEGIES = new Set([
    'missingSuffix-nemonet',
    'contentMarkers-nemonet',
    'nemonet-council',
]);

const KNOWN_REASONING_DELIMITERS = Object.freeze([
    { prefix: '<thinking>', suffix: '</thinking>' },
    { prefix: '<think>', suffix: '</think>' },
    { prefix: '<thoughts>', suffix: '</thoughts>' },
    { prefix: '<thought>', suffix: '</thought>' },
    { prefix: '<reasoning>', suffix: '</reasoning>' },
    { prefix: '<reason>', suffix: '</reason>' },
    { prefix: '<reflection>', suffix: '</reflection>' },
    { prefix: '<planning>', suffix: '</planning>' },
    { prefix: '<plan>', suffix: '</plan>' },
    { prefix: '<cot>', suffix: '</cot>' },
    { prefix: '<analysis>', suffix: '</analysis>' },
    { prefix: '<|begin_of_thought|>', suffix: '<|end_of_thought|>' },
    { prefix: '◁think▷', suffix: '◁/think▷' },
    { prefix: '[THINK]', suffix: '[/THINK]' },
]);

const TAGLESS_HINT_PATTERNS = [
    /^\s*Thoughts?:\s*(?:\r?\n|$)/i,
    /^\s*Thinking:\s*(?:\r?\n|$)/i,
    /^\s*\*\*NemoNet[\s:]*(?:Context Scan|World Exploration|Council|Reasoning)/i,
    /^\s*NEMONET WORLD EXPLORATION/i,
    /^\s*<?Begin Council of Vex Thought Process>?/i,
    /^\s*STORY SECTION\s+[1-9]\s*:/i,
];

const NARRATIVE_ACTION_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'’\-]*\s+(?:opened|closed|looked|glanced|turned|stepped|walked|said|whispered|smiled|frowned|nodded|shook|moved|ran|jumped|sat|stood|reached|pulled|pushed|crossed|entered|left|waved)\b/u;
const NARRATIVE_DIALOGUE_PATTERN = /^"[^"\r\n]{1,500}"\s+(?:(?:[\p{L}\p{M}][\p{L}\p{M}'’\-]*)\s+)?(?:said|asked|whispered|replied|murmured|shouted|answered|called)\b/u;
const NARRATIVE_SCENE_PATTERN = /^(?:The\s+)?(?:room|air|rain|wind|silence|light|darkness|door|street|sky|sun|moon|night|day)\s+(?:fell|eased|shifted|moved|settled|rose|opened|closed|darkened|brightened|stirred|hung|pressed|spilled|filtered|stretched|broke)\b/i;

function normalizeDelimiters(delimiters) {
    return Array.isArray(delimiters)
        ? delimiters.filter(item => typeof item?.prefix === 'string' && item.prefix && typeof item?.suffix === 'string' && item.suffix)
        : [];
}

function findStartingDelimiter(text, delimiters = KNOWN_REASONING_DELIMITERS) {
    if (typeof text !== 'string') return null;
    const leadingLength = text.match(/^\s*/)?.[0].length ?? 0;
    const lowerText = text.toLowerCase();
    let found = null;

    for (const delimiter of normalizeDelimiters(delimiters)) {
        if (!lowerText.startsWith(delimiter.prefix.toLowerCase(), leadingLength)) continue;
        if (!found || delimiter.prefix.length > found.prefix.length) {
            found = { ...delimiter, startIndex: leadingLength };
        }
    }
    return found;
}

function hasClosingDelimiter(text, delimiter) {
    const searchStart = delimiter.startIndex + delimiter.prefix.length;
    return text.toLowerCase().indexOf(delimiter.suffix.toLowerCase(), searchStart) !== -1;
}

function looksLikeNarrativeStart(content) {
    const firstLine = content.trimStart().split(/\r?\n/, 1)[0];
    const unwrappedLine = firstLine
        .replace(/^<(?:p|div)\b[^>]*>\s*/i, '')
        .replace(/\s*<\/(?:p|div)>\s*$/i, '')
        .replace(/^\*(?!\s)([^*\r\n]+)\*(?:\s|$)/, '$1')
        .trim();

    return NARRATIVE_ACTION_PATTERN.test(unwrappedLine)
        || NARRATIVE_DIALOGUE_PATTERN.test(unwrappedLine)
        || NARRATIVE_SCENE_PATTERN.test(unwrappedLine);
}

function getFencedCodeRanges(text) {
    const ranges = [];
    const fencePattern = /^[ \t]*(`{3,}|~{3,})[^\r\n]*(?:\r?\n|$)/gm;
    let openFence = null;

    for (const match of text.matchAll(fencePattern)) {
        const marker = match[1];
        if (!openFence) {
            openFence = { start: match.index, marker: marker[0], length: marker.length };
            continue;
        }
        if (marker[0] !== openFence.marker || marker.length < openFence.length) continue;

        ranges.push({ start: openFence.start, end: match.index + match[0].length });
        openFence = null;
    }

    if (openFence) ranges.push({ start: openFence.start, end: text.length });
    return ranges;
}

function isInsideRange(index, ranges) {
    return ranges.some(range => index >= range.start && index < range.end);
}

function findOutsideRanges(lowerText, needle, startIndex, ranges) {
    let index = lowerText.indexOf(needle.toLowerCase(), startIndex);
    while (index !== -1 && isInsideRange(index, ranges)) {
        index = lowerText.indexOf(needle.toLowerCase(), index + needle.length);
    }
    return index;
}

function extractEnclosedReasoningBlocks(text, delimiters = KNOWN_REASONING_DELIMITERS) {
    const source = String(text ?? '');
    const candidates = normalizeDelimiters(delimiters);
    const lowerText = source.toLowerCase();
    const fencedRanges = getFencedCodeRanges(source);
    const blocks = [];
    let cursor = 0;

    while (cursor < source.length) {
        let opening = null;
        for (const delimiter of candidates) {
            const index = findOutsideRanges(lowerText, delimiter.prefix, cursor, fencedRanges);
            if (index === -1) continue;
            if (!opening || index < opening.index || (index === opening.index && delimiter.prefix.length > opening.delimiter.prefix.length)) {
                opening = { delimiter, index };
            }
        }
        if (!opening) break;

        const contentStart = opening.index + opening.delimiter.prefix.length;
        const closingIndex = findOutsideRanges(lowerText, opening.delimiter.suffix, contentStart, fencedRanges);
        if (closingIndex === -1) {
            cursor = contentStart;
            continue;
        }

        const end = closingIndex + opening.delimiter.suffix.length;
        blocks.push({
            start: opening.index,
            end,
            reasoning: source.slice(contentStart, closingIndex).trim(),
        });
        cursor = end;
    }

    if (blocks.length === 0) return { blocks: [], content: source };

    const content = [];
    let contentStart = 0;
    for (const block of blocks) {
        content.push(source.slice(contentStart, block.start));
        contentStart = block.end;
    }
    content.push(source.slice(contentStart));

    return {
        blocks: blocks.filter(block => block.reasoning),
        content: content.join('').trim(),
    };
}

function appendEnclosedBlocks(result, delimiters) {
    const repeated = extractEnclosedReasoningBlocks(result.content, delimiters);
    if (repeated.blocks.length === 0) return result;

    return {
        ...result,
        reasoning: [result.reasoning, ...repeated.blocks.map(block => block.reasoning)]
            .filter(Boolean)
            .join('\n\n'),
        content: repeated.content,
    };
}

export const NemoNetReasoningConfig = Object.freeze({
    prefix: '<think>',
    suffix: '</think>',
    alternativePrefixes: [
        ...KNOWN_REASONING_DELIMITERS.map(({ prefix }) => prefix).filter(prefix => prefix !== '<think>'),
        '<think',
        '<Begin Council of Vex Thought Process>',
        'STORY SECTION 1:',
    ],
    alternativeSuffixes: [
        ...KNOWN_REASONING_DELIMITERS.map(({ suffix }) => suffix).filter(suffix => suffix !== '</think>'),
        '<answer>',
        'NARRATION FOLLOWS',
        '{{newline}}',
    ],
    reasoningMarkers: [
        'NEMONET WORLD EXPLORATION',
        'Council of Vex',
        'NemoAdmin-107',
        'Begin Council of Vex Thought Process',
        'STORY SECTION 1:',
        'STORY SECTION 2:',
        'STORY SECTION 3:',
        'STORY SECTION 4:',
        'STORY SECTION 5:',
        'STORY SECTION 6:',
        'STORY SECTION 7:',
        'NEMO NET AWAKENING',
        'GATHERING THE THREADS',
        'SCENE CALIBRATION',
        'COUNCIL CONVERSATION',
        'RESOLUTION',
        'CRAFTING',
        'Custom CoT',
        'Organic thinking',
        'Exploration 1:',
        'Exploration 2:',
        'Exploration 3:',
        'Exploration 4:',
        'Exploration 5:',
        'Exploration 6:',
        'Exploration 7:',
        'Exploration 8:',
        'Discoveries:',
        '_Specialist:',
        'Plot_Vex:',
        'Romantic_Vex:',
        'Action_Vex:',
        'Mystery_Vex:',
        'Comedy_Vex:',
        'Danger_Vex:',
        'SCENE TYPE AND RATIO:',
        'CHARACTER CAPABILITIES:',
        'CHARACTER VOICE:',
        'FRESHNESS:',
        'FINAL REVIEW:',
        'VITAL:',
        '<knowledge_awareness>',
        '<voice_crafting>',
        '<repetition_ban>',
        '<custom_steps>',
        'END OF THINKING',
        'CLOSING THINKING NOW',
    ],
    narrationMarkers: [
        'NARRATION FOLLOWS',
        '{{newline}}',
        'Narration:',
    ],
    strategyWeights: {
        partialSuffix: 90,
        missingSuffix: 88,
        contentBased: 78,
    },
    debug: false,
});

function noCapture(input, strategy = 'none') {
    return { reasoning: '', content: input, strategy, confidence: 0 };
}

/**
 * Cheaply reject normal chat messages before running the multi-strategy parser.
 *
 * @param {unknown} text
 * @returns {boolean}
 */
export function hasReasoningCandidate(text) {
    if (typeof text !== 'string' || text.length === 0) return false;
    if (findStartingDelimiter(text)) return true;
    return TAGLESS_HINT_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Validate a parser split without guessing based on arbitrary overall lengths.
 * Explicit delimiters may legitimately contain a short thought or answer;
 * tagless and repaired formats must meet a higher structural bar.
 *
 * @param {string} input
 * @param {unknown} result
 * @returns {boolean}
 */
export function isUsableReasoningResult(input, result) {
    if (!result || typeof result !== 'object') return false;

    const reasoning = typeof result.reasoning === 'string' ? result.reasoning.trim() : '';
    const content = typeof result.content === 'string' ? result.content.trim() : '';
    const strategy = String(result.strategy || '');
    const confidence = Number(result.confidence) || 0;

    if (!reasoning || !content || result.content === input) return false;

    if (EXPLICIT_STRATEGIES.has(strategy)) {
        return confidence >= 90;
    }

    if (STRUCTURED_STRATEGIES.has(strategy)) {
        return confidence >= 85 && reasoning.length >= 40 && content.length >= 20;
    }

    return false;
}

/**
 * Native-first parser with conservative NemoNet-only fallbacks.
 */
export class NemoNetReasoningParser extends RobustReasoningParser {
    constructor(config = {}, dependencies = {}) {
        super({ ...NemoNetReasoningConfig, ...config });
        this.getNativeParser = typeof dependencies.getNativeParser === 'function'
            ? dependencies.getNativeParser
            : () => null;
        this.getNativeDelimiters = typeof dependencies.getNativeDelimiters === 'function'
            ? dependencies.getNativeDelimiters
            : () => [];
    }

    getDelimiterCandidates() {
        let nativeDelimiters = [];
        try {
            nativeDelimiters = normalizeDelimiters(this.getNativeDelimiters());
        } catch {
            // A settings lookup failure must not prevent the built-in safe fallback.
        }

        return [
            ...nativeDelimiters,
            { prefix: this.config.prefix, suffix: this.config.suffix },
            ...KNOWN_REASONING_DELIMITERS,
        ];
    }

    isCandidate(text) {
        if (typeof text !== 'string' || text.length === 0) return false;
        if (findStartingDelimiter(text, this.getDelimiterCandidates())) return true;
        return TAGLESS_HINT_PATTERNS.some(pattern => pattern.test(text));
    }

    parse(text) {
        const input = String(text ?? '');
        const delimiters = this.getDelimiterCandidates();
        const startingDelimiter = findStartingDelimiter(input, delimiters);
        const hasTaglessHint = TAGLESS_HINT_PATTERNS.some(pattern => pattern.test(input));
        const lowerInput = input.toLowerCase();
        const hasEmbeddedDelimiter = delimiters.some(({ prefix }) => lowerInput.includes(prefix.toLowerCase()));

        // Tags embedded in prose or fenced examples are content, not private reasoning.
        if (hasEmbeddedDelimiter && !startingDelimiter && !hasTaglessHint) {
            return noCapture(input);
        }

        // The fork's native parser includes an unclosed-block prose heuristic. Only
        // delegate structurally closed blocks; explicit extension boundaries own repair.
        if (startingDelimiter && hasClosingDelimiter(input, startingDelimiter)) {
            try {
                const nativeParse = this.getNativeParser();
                if (typeof nativeParse === 'function') {
                    const native = nativeParse(input, { strict: true });
                    const nativeResult = {
                        reasoning: typeof native?.reasoning === 'string' ? native.reasoning : '',
                        content: typeof native?.content === 'string' ? native.content : input,
                        strategy: 'native',
                        confidence: 100,
                    };
                    if (isUsableReasoningResult(input, nativeResult)) {
                        return appendEnclosedBlocks(nativeResult, delimiters);
                    }
                }
            } catch (error) {
                if (this.debug) {
                    console.warn('NemoNet reasoning: native parser failed; trying conservative fallback.', error);
                }
            }
        }

        const fallback = super.parse(input);
        return isUsableReasoningResult(input, fallback)
            ? appendEnclosedBlocks(fallback, delimiters)
            : noCapture(input);
    }
    /**
     * Only repair an unclosed primary tag when the preset emitted an explicit
     * transition marker. Ordinary sentence boundaries are intentionally ignored.
     */
    strategyMissingSuffix(text) {
        const prefixIndex = text.toLowerCase().indexOf(this.config.prefix.toLowerCase());
        if (prefixIndex === -1) return null;

        const contentStart = prefixIndex + this.config.prefix.length;
        const afterPrefix = text.slice(contentStart);
        const boundaries = [
            /END OF THINKING(?:\s*-\s*CLOSING THINKING NOW)?(?:\s*-\s*NARRATION FOLLOWS)?/i,
            /CLOSING THINKING NOW(?:\s*-\s*NARRATION FOLLOWS)?/i,
            /NARRATION FOLLOWS/i,
            /\{\{newline\}\}/i,
            /Narration:\s*(?:\[[^\]]*\])?/i,
            /(?:Time to write|Okay, plan is set)\.(?=[A-Z][a-z])/,
        ];

        let boundary = null;
        for (const pattern of boundaries) {
            const match = pattern.exec(afterPrefix);
            if (match && (!boundary || match.index < boundary.index)) {
                boundary = match;
            }
        }
        if (!boundary) return null;

        const reasoning = afterPrefix.slice(0, boundary.index).trim();
        const content = `${text.slice(0, prefixIndex)}${afterPrefix.slice(boundary.index + boundary[0].length)}`.trim();
        if (!reasoning || !content) return null;

        return {
            reasoning,
            content,
            strategy: 'missingSuffix-nemonet',
            confidence: this.config.strategyWeights.missingSuffix,
        };
    }

    /**
     * Tagless STORY SECTION blocks require several NemoNet markers and an
     * explicit narration boundary; marker density alone is never enough.
     */
    strategyContentMarkers(text) {
        const lowerText = text.toLowerCase();
        let markerCount = 0;
        let storySectionCount = 0;
        let firstMarkerIndex = -1;

        for (const marker of this.config.reasoningMarkers) {
            const lowerMarker = marker.toLowerCase();
            const index = lowerText.indexOf(lowerMarker);
            if (index === -1) continue;
            markerCount++;
            if (lowerMarker.startsWith('story section')) storySectionCount++;
            if (firstMarkerIndex === -1 || index < firstMarkerIndex) firstMarkerIndex = index;
        }

        if (firstMarkerIndex === -1 || (markerCount < 5 && storySectionCount < 3)) return null;

        let boundary = null;
        for (const marker of this.config.narrationMarkers) {
            const index = lowerText.indexOf(marker.toLowerCase(), firstMarkerIndex);
            if (index !== -1 && (!boundary || index < boundary.index)) {
                boundary = { index, length: marker.length };
            }
        }
        if (!boundary) return null;

        const reasoning = text.slice(firstMarkerIndex, boundary.index).trim();
        const content = `${text.slice(0, firstMarkerIndex)}${text.slice(boundary.index + boundary.length)}`.trim();
        if (!reasoning || !content) return null;

        return {
            reasoning,
            content,
            strategy: 'contentMarkers-nemonet',
            confidence: storySectionCount >= 4
                ? this.config.strategyWeights.contentBased + 10
                : this.config.strategyWeights.contentBased + 7,
        };
    }

    /**
     * A blank paragraph is not enough to expose the remainder of a Council
     * block. Keep scanning until the post-Final-Check text has a strong RP start.
     */
    strategyNemoNetCouncil(text) {
        const hasHeader = /^\s*\*\*NemoNet[\s:]*(?:Context Scan|World Exploration|Council|Reasoning)[\s:]*\*\*/i.test(text);
        if (!hasHeader) return null;

        const recognizedSections = [...text.matchAll(/\*\*((?:Character Knowledge|Scene Energy|Organic Thinking|(?:The )?Council Meets?|Final (?:Gut )?Check)[^*]*)\*\*/gi)];
        const finalChecks = [...text.matchAll(/\*\*Final (?:Gut )?Check[\s:]*\*\*/gi)];
        if (recognizedSections.length < 3 || finalChecks.length === 0) return null;

        const finalCheck = finalChecks.at(-1);
        const afterFinalIndex = finalCheck.index + finalCheck[0].length;
        const afterFinal = text.slice(afterFinalIndex);
        const paragraphBreaks = afterFinal.matchAll(/\r?\n[ \t]*\r?\n/g);

        for (const paragraphBreak of paragraphBreaks) {
            const contentStart = paragraphBreak.index + paragraphBreak[0].length;
            const content = afterFinal.slice(contentStart).trim();
            if (!content || !looksLikeNarrativeStart(content)) continue;

            const reasoningEnd = afterFinalIndex + paragraphBreak.index;
            const reasoning = text.slice(0, reasoningEnd).trim();
            if (!reasoning) return null;

            return {
                reasoning,
                content,
                strategy: 'nemonet-council',
                confidence: 99,
            };
        }

        return null;
    }
}

/**
 * Atomically apply a safe parser result to one assistant message.
 *
 * @param {Record<string, any>} message
 * @param {{parse(text: string): any, isCandidate?(text: string): boolean}} parser
 * @param {(reasoning: string) => string} [normalizeReasoning]
 * @returns {{changed: boolean, reason?: string, result?: any}}
 */
export function captureReasoningFromMessage(message, parser, normalizeReasoning = reasoning => reasoning) {
    if (!message || typeof message !== 'object') return { changed: false, reason: 'invalid-message' };
    if (message.is_user) return { changed: false, reason: 'user-message' };
    if (message.is_system) return { changed: false, reason: 'system-message' };
    if (typeof message.mes !== 'string' || !message.mes || message.mes === '...') {
        return { changed: false, reason: 'empty-message' };
    }
    const existingReasoning = typeof message.extra?.reasoning === 'string'
        ? message.extra.reasoning.trim()
        : '';
    if (existingReasoning) {
        const delimiters = typeof parser?.getDelimiterCandidates === 'function'
            ? parser.getDelimiterCandidates()
            : KNOWN_REASONING_DELIMITERS;
        const repeated = extractEnclosedReasoningBlocks(message.mes, delimiters);
        if (repeated.blocks.length === 0) {
            return { changed: false, reason: 'already-captured' };
        }

        let normalizedReasoning;
        try {
            normalizedReasoning = normalizeReasoning(repeated.blocks.map(block => block.reasoning).join('\n\n'));
        } catch {
            return { changed: false, reason: 'normalizer-error' };
        }
        if (typeof normalizedReasoning !== 'string' || !normalizedReasoning.trim()) {
            return { changed: false, reason: 'normalizer-empty' };
        }

        message.mes = repeated.content;
        message.extra.reasoning = `${existingReasoning}\n\n${normalizedReasoning.trim()}`;
        message.extra.reasoning_type ||= 'parsed';
        return {
            changed: true,
            result: {
                reasoning: normalizedReasoning,
                content: repeated.content,
                strategy: 'repeated-enclosed-blocks',
                confidence: 100,
            },
        };
    }
    const isCandidate = typeof parser?.isCandidate === 'function'
        ? parser.isCandidate(message.mes)
        : hasReasoningCandidate(message.mes);
    if (!isCandidate) return { changed: false, reason: 'no-candidate' };

    const source = message.mes;
    let result;
    try {
        result = parser.parse(source);
    } catch {
        return { changed: false, reason: 'parser-error' };
    }
    if (!isUsableReasoningResult(source, result)) {
        return { changed: false, reason: 'rejected' };
    }

    let normalizedReasoning;
    try {
        normalizedReasoning = normalizeReasoning(result.reasoning);
    } catch {
        return { changed: false, reason: 'normalizer-error' };
    }
    if (typeof normalizedReasoning !== 'string' || !normalizedReasoning.trim()) {
        return { changed: false, reason: 'normalizer-empty' };
    }

    const extra = message.extra && typeof message.extra === 'object' && !Array.isArray(message.extra)
        ? message.extra
        : {};
    message.mes = result.content;
    message.extra = extra;
    message.extra.reasoning = normalizedReasoning;
    message.extra.reasoning_type = 'parsed';

    return { changed: true, result };
}
