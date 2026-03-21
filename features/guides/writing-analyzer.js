/**
 * Writing Analyzer
 * Lightweight client-side analysis of AI writing quality.
 * Scans recent chat for repetitive phrases, overused words, problematic
 * sentence structures, and common "slop" patterns.
 *
 * Outputs AI-facing warnings injected into the system instruction.
 * Optionally integrates with ProsePolisher if installed.
 *
 * Unlike PP's regex-replacement approach, this feeds issues back to the AI
 * as awareness — letting it naturally adjust its writing.
 */

import { getContext, extension_settings } from '../../../../../extensions.js';
import { EXTENSION_NAME } from './tool-registry.js';
import { scanForSlop } from './slop-patterns.js';

const LOG_PREFIX = '[NemosGuides:Analyzer]';

// ── Configuration ──

/** Minimum n-gram size to track. */
const NGRAM_MIN = 3;
/** Maximum n-gram size to track. */
const NGRAM_MAX = 7;
/** Minimum occurrences before flagging a phrase. */
const PHRASE_THRESHOLD = 2;
/** Minimum word occurrences (in AI messages only) before flagging. */
const WORD_THRESHOLD = 5;
/** How many recent messages to analyze. */
const ANALYSIS_WINDOW = 30;
/** Max warnings to inject (prevent prompt bloat). */
const MAX_WARNINGS = 12;

// ── Common Words Whitelist (not flagged as repetitive) ──

const COMMON_WORDS = new Set([
    // Articles, prepositions, conjunctions, pronouns
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
    'dare', 'ought', 'used', 'it', 'its', 'he', 'she', 'they', 'them',
    'their', 'his', 'her', 'my', 'your', 'our', 'this', 'that', 'these',
    'those', 'i', 'you', 'we', 'me', 'him', 'us', 'not', 'no', 'nor',
    'if', 'then', 'than', 'too', 'very', 'just', 'about', 'up', 'out',
    'so', 'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'only', 'own', 'same', 'also', 'back', 'after',
    'before', 'into', 'through', 'during', 'over', 'between', 'under',
    'again', 'there', 'here', 'once', 'said', 'says', 'like', 'still',
    'even', 'well', 'way', 'while', 'down', 'now', 'long', 'make',
    'thing', 'see', 'look', 'come', 'think', 'know', 'take', 'get',
    'go', 'say', 'went', 'made', 'got', 'came', 'took', 'thought',
]);

// ── Problematic Patterns ──

/** Negative propositionals and weak constructions. */
const WEAK_PATTERNS = [
    { regex: /\bcouldn'?t help but\b/gi, label: "couldn't help but" },
    { regex: /\bwasn'?t unlike\b/gi, label: "wasn't unlike" },
    { regex: /\bnot without\b/gi, label: 'not without (double negative)' },
    { regex: /\bnot un\w+/gi, label: 'not un- (double negative)' },
    { regex: /\bseemed to (be|have|feel|think|know)\b/gi, label: 'seemed to (hedging)' },
    { regex: /\bbegan to\b/gi, label: 'began to (filter verb)' },
    { regex: /\bstarted to\b/gi, label: 'started to (filter verb)' },
    { regex: /\btried to\b/gi, label: 'tried to (filter verb)' },
    { regex: /\bmanaged to\b/gi, label: 'managed to (filter verb)' },
    { regex: /\ba sense of\b/gi, label: 'a sense of (telling not showing)' },
    { regex: /\bfor some reason\b/gi, label: 'for some reason (vague)' },
    { regex: /\bsomehow\b/gi, label: 'somehow (vague)' },
    { regex: /\bsuddenly\b/gi, label: 'suddenly (overused adverb)' },
];

/** Sentence opener patterns to detect structural repetition. */
const OPENER_PATTERNS = [
    { regex: /^(she|he|they)\s+\w+ed\b/i, label: 'pronoun + past tense verb' },
    { regex: /^(she|he|they)\s+(was|were)\b/i, label: 'pronoun + was/were' },
    { regex: /^(the|a|an)\s+\w+\s+(of|in|on)\b/i, label: 'article + noun + preposition' },
    { regex: /^(with|as|when|while)\s/i, label: 'subordinate clause opener' },
    { regex: /^(it was|there was|there were)\b/i, label: 'existential opener (it was/there was)' },
];

// ── Analysis State ──

/**
 * @typedef {Object} AnalysisResult
 * @property {Array<{phrase: string, count: number}>} repeatedPhrases
 * @property {Array<{word: string, count: number}>} overusedWords
 * @property {Array<{pattern: string, count: number}>} weakPatterns
 * @property {Array<{pattern: string, percentage: number}>} structuralIssues
 * @property {number} messagesAnalyzed
 */

/** Cached analysis result — refreshed when message count changes. */
let lastAnalysis = null;

/** Message count at the time of the last analysis run. */
let lastAnalyzedMessageCount = -1;

// ── Core Analysis ──

/**
 * Strip HTML/markdown from text for clean analysis.
 * @param {string} text
 * @returns {string}
 */
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/```[\s\S]*?```/g, ' ')          // code blocks
        .replace(/<[^>]*>/g, ' ')                   // HTML tags
        .replace(/[*_~`]+(.+?)[*_~`]+/g, '$1')     // markdown emphasis
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Generate n-grams from a word array.
 * @param {string[]} words
 * @param {number} n
 * @returns {string[]}
 */
function getNgrams(words, n) {
    const ngrams = [];
    for (let i = 0; i <= words.length - n; i++) {
        ngrams.push(words.slice(i, i + n).join(' '));
    }
    return ngrams;
}

/**
 * Analyze recent AI messages for writing quality issues.
 * @param {number} [windowSize] - How many recent messages to scan
 * @returns {AnalysisResult}
 */
export function analyzeChat(windowSize = ANALYSIS_WINDOW) {
    const context = getContext();
    const chat = context?.chat || [];
    const charName = (context?.name2 || 'character').toLowerCase();
    const userName = (context?.name1 || 'user').toLowerCase();

    // Get recent AI messages only
    const aiMessages = chat
        .slice(-windowSize)
        .filter(m => !m.is_user && !m.is_system)
        .map(m => cleanText(m.mes || ''));

    if (aiMessages.length < 2) {
        return { repeatedPhrases: [], overusedWords: [], weakPatterns: [], structuralIssues: [], messagesAnalyzed: 0 };
    }

    const allText = aiMessages.join(' ');
    const sentences = allText.match(/[^.!?]+[.!?]+/g) || [allText];

    // 1. N-gram phrase frequency
    const phraseFreq = new Map();
    for (const sentence of sentences) {
        const words = sentence.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/).filter(Boolean);
        for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
            for (const ngram of getNgrams(words, n)) {
                // Skip if all words are common
                const ngramWords = ngram.split(' ');
                if (ngramWords.every(w => COMMON_WORDS.has(w))) continue;
                // Skip if contains character/user name (expected repetition)
                if (ngram.includes(charName) || ngram.includes(userName)) continue;

                phraseFreq.set(ngram, (phraseFreq.get(ngram) || 0) + 1);
            }
        }
    }

    // Cull substrings — prefer longer phrases
    const repeatedPhrases = [];
    const sortedPhrases = [...phraseFreq.entries()]
        .filter(([, count]) => count >= PHRASE_THRESHOLD)
        .sort((a, b) => b[1] - a[1]);

    const usedPhrases = new Set();
    for (const [phrase, count] of sortedPhrases) {
        // Skip if this phrase is a substring of an already-added longer phrase
        let isSubstring = false;
        for (const used of usedPhrases) {
            if (used.includes(phrase)) { isSubstring = true; break; }
        }
        if (isSubstring) continue;

        repeatedPhrases.push({ phrase, count });
        usedPhrases.add(phrase);

        if (repeatedPhrases.length >= 8) break;
    }

    // 2. Individual word frequency (AI messages only, non-common words)
    const wordFreq = new Map();
    for (const msg of aiMessages) {
        const words = msg.toLowerCase().replace(/[.,!?;:'"()]/g, '').split(/\s+/).filter(Boolean);
        for (const word of words) {
            if (COMMON_WORDS.has(word)) continue;
            if (word === charName || word === userName) continue;
            if (word.length < 4) continue;
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
        }
    }

    const overusedWords = [...wordFreq.entries()]
        .filter(([, count]) => count >= WORD_THRESHOLD)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([word, count]) => ({ word, count }));

    // 3. Weak pattern detection
    const weakPatternCounts = [];
    for (const pattern of WEAK_PATTERNS) {
        const matches = allText.match(pattern.regex);
        if (matches && matches.length >= 2) {
            weakPatternCounts.push({ pattern: pattern.label, count: matches.length });
        }
    }

    // 4. Sentence structure repetition
    const openerCounts = new Map();
    let totalSentences = 0;
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed || trimmed.split(/\s+/).length < 3) continue;
        totalSentences++;

        for (const opener of OPENER_PATTERNS) {
            if (opener.regex.test(trimmed)) {
                openerCounts.set(opener.label, (openerCounts.get(opener.label) || 0) + 1);
                break; // Only count the first matching pattern per sentence
            }
        }
    }

    const structuralIssues = [];
    if (totalSentences >= 5) {
        for (const [pattern, count] of openerCounts) {
            const pct = (count / totalSentences) * 100;
            if (pct >= 30) { // 30%+ of sentences start the same way
                structuralIssues.push({ pattern, percentage: Math.round(pct) });
            }
        }
    }

    // 5. Slop pattern detection (Atelier-inspired comprehensive scan)
    const slopResults = scanForSlop(allText);

    lastAnalysis = {
        repeatedPhrases,
        overusedWords,
        weakPatterns: weakPatternCounts,
        structuralIssues,
        slopResults,
        messagesAnalyzed: aiMessages.length,
    };

    return lastAnalysis;
}

// ── ProsePolisher Integration ──

/**
 * Try to read ProsePolisher's analyzer data if the extension is installed.
 * @returns {Array<{phrase: string, score: number}>|null}
 */
function getProsePolisherData() {
    try {
        const ppSettings = extension_settings?.ProsePolisher;
        if (!ppSettings) return null;

        // PP stores its dynamic rules and slop candidates
        // We can read its blacklist for known bad patterns
        const blacklist = ppSettings.blacklist;
        if (!blacklist || typeof blacklist !== 'object') return null;

        return Object.entries(blacklist).map(([phrase, weight]) => ({
            phrase,
            score: weight,
        }));
    } catch {
        return null;
    }
}

// ── Output Generation ──

/**
 * Build the AI-facing warning message from analysis results.
 * Injected into the system instruction on each generation.
 * @returns {string} Warning text, or empty string if no issues
 */
export function buildWritingWarnings() {
    const settings = extension_settings[EXTENSION_NAME];
    if (!settings?.enabled || settings?.writingAnalysis === false) return '';

    const context = getContext();
    const currentMessageCount = context?.chat?.length ?? 0;

    if (lastAnalysis !== null && currentMessageCount === lastAnalyzedMessageCount) {
        // Message count unchanged — skip re-analysis, fall through to format cached result
    } else {
        lastAnalyzedMessageCount = currentMessageCount;
        analyzeChat(); // updates lastAnalysis via side-effect
    }

    const analysis = lastAnalysis;
    if (!analysis || analysis.messagesAnalyzed < 3) return '';

    const warnings = [];

    // Repeated phrases
    if (analysis.repeatedPhrases.length > 0) {
        const phrases = analysis.repeatedPhrases
            .slice(0, 5)
            .map(p => `"${p.phrase}" (${p.count}x)`)
            .join(', ');
        warnings.push(`Overused phrases — avoid or find alternatives: ${phrases}`);
    }

    // Overused words
    if (analysis.overusedWords.length > 0) {
        const words = analysis.overusedWords
            .slice(0, 4)
            .map(w => `"${w.word}" (${w.count}x)`)
            .join(', ');
        warnings.push(`Overused words — vary your vocabulary: ${words}`);
    }

    // Weak patterns
    if (analysis.weakPatterns.length > 0) {
        const patterns = analysis.weakPatterns
            .slice(0, 4)
            .map(p => `"${p.pattern}" (${p.count}x)`)
            .join(', ');
        warnings.push(`Weak constructions detected — rewrite more directly: ${patterns}`);
    }

    // Structural issues
    if (analysis.structuralIssues.length > 0) {
        const issues = analysis.structuralIssues
            .map(s => `${s.percentage}% of sentences start with "${s.pattern}"`)
            .join('; ');
        warnings.push(`Repetitive sentence structure: ${issues}. Vary your sentence openings.`);
    }

    // Slop pattern detection (Atelier-inspired)
    if (analysis.slopResults && analysis.slopResults.length > 0) {
        // Group by category, pick the worst offenders
        for (const cat of analysis.slopResults) {
            const topMatches = cat.matches
                .sort((a, b) => b.count - a.count)
                .slice(0, 3)
                .map(m => `"${m.label}" (${m.count}x)`)
                .join(', ');
            warnings.push(`${cat.category}: ${topMatches} — avoid these clichés.`);
        }
    }

    // ProsePolisher blacklist integration
    const ppData = getProsePolisherData();
    if (ppData && ppData.length > 0) {
        const ppPhrases = ppData
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
            .map(p => `"${p.phrase}"`)
            .join(', ');
        warnings.push(`ProsePolisher blacklist: ${ppPhrases} — do not use these.`);
    }

    if (warnings.length === 0) return '';

    const header = `\n[NG WRITING QUALITY — Analysis of last ${analysis.messagesAnalyzed} AI messages:`;
    const body = warnings.slice(0, MAX_WARNINGS).map(w => `- ${w}`).join('\n');
    return `${header}\n${body}\nWrite with fresh, varied language. Show, don't tell.]`;
}

/**
 * Get the last analysis result (for the writing check tool).
 * @returns {AnalysisResult|null}
 */
export function getLastAnalysis() {
    return lastAnalysis;
}

/**
 * Format analysis as a detailed report (for the tool call).
 * @returns {string}
 */
export function formatAnalysisReport() {
    const analysis = analyzeChat();
    if (!analysis || analysis.messagesAnalyzed < 2) {
        return 'Not enough messages to analyze (need at least 2 AI messages).';
    }

    const sections = [];
    sections.push(`## Writing Quality Report (${analysis.messagesAnalyzed} AI messages analyzed)\n`);

    if (analysis.repeatedPhrases.length > 0) {
        sections.push('### Repeated Phrases');
        for (const p of analysis.repeatedPhrases) {
            sections.push(`- "${p.phrase}" — used ${p.count} times`);
        }
    } else {
        sections.push('### Repeated Phrases\nNo significant phrase repetition detected.');
    }

    if (analysis.overusedWords.length > 0) {
        sections.push('\n### Overused Words');
        for (const w of analysis.overusedWords) {
            sections.push(`- "${w.word}" — ${w.count} occurrences`);
        }
    }

    if (analysis.weakPatterns.length > 0) {
        sections.push('\n### Weak Constructions');
        for (const p of analysis.weakPatterns) {
            sections.push(`- "${p.pattern}" — ${p.count} occurrences`);
        }
    } else {
        sections.push('\n### Weak Constructions\nNo significant weak patterns detected.');
    }

    if (analysis.structuralIssues.length > 0) {
        sections.push('\n### Sentence Structure Issues');
        for (const s of analysis.structuralIssues) {
            sections.push(`- ${s.percentage}% of sentences start with "${s.pattern}"`);
        }
    } else {
        sections.push('\n### Sentence Structure\nGood variety in sentence openings.');
    }

    if (analysis.slopResults && analysis.slopResults.length > 0) {
        sections.push('\n### Slop Pattern Detection');
        for (const cat of analysis.slopResults) {
            sections.push(`\n**${cat.category}:**`);
            for (const m of cat.matches) {
                const sev = m.severity === 'high' ? ' [!]' : '';
                sections.push(`- "${m.label}" — ${m.count} occurrence${m.count > 1 ? 's' : ''}${sev}`);
            }
        }
    } else {
        sections.push('\n### Slop Pattern Detection\nNo known slop patterns detected. Clean writing.');
    }

    const ppData = getProsePolisherData();
    if (ppData && ppData.length > 0) {
        sections.push('\n### ProsePolisher Blacklist');
        for (const p of ppData.slice(0, 8)) {
            sections.push(`- "${p.phrase}" (weight: ${p.score})`);
        }
    }

    return sections.join('\n');
}
