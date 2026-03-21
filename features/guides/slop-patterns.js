/**
 * Slop Pattern Database
 * Comprehensive pattern detection for AI writing quality issues.
 * Organized by category from the Atelier anti-slop taxonomy.
 *
 * Each pattern has:
 *   - regex: Pattern to match (case-insensitive)
 *   - label: Short description for the AI warning
 *   - category: Which section it belongs to
 *   - severity: 'high' (flag on first occurrence) or 'low' (flag when repeated)
 */

// ── Category 1: Quippy, Deflective & Sloppy Writing ──

export const QUIP_PATTERNS = [
    // Tension-deflecting quips
    { regex: /\bso\.{3}\s*that just happened/gi, label: 'tension-deflecting quip', severity: 'high' },
    { regex: /\bwell\.\s*that's not ideal/gi, label: 'tension-deflecting quip', severity: 'high' },
    { regex: /\bon a scale of one to ten/gi, label: 'tension-deflecting quip', severity: 'high' },
    { regex: /\bany other day,?\s*i'?d be impressed/gi, label: 'tension-deflecting quip', severity: 'high' },

    // Sarcastic narration
    { regex: /\bbecause apparently\b/gi, label: 'sarcastic narration crutch', severity: 'low' },
    { regex: /\bspoiler alert:/gi, label: 'sarcastic narration crutch', severity: 'high' },
    { regex: /\bfun fact:/gi, label: 'sarcastic narration crutch', severity: 'high' },
    { regex: /\bguess how that turned out/gi, label: 'sarcastic narration crutch', severity: 'high' },
    { regex: /\bplot twist:/gi, label: 'sarcastic narration crutch', severity: 'high' },
    { regex: /\bbecause the universe has a sense of humor/gi, label: 'sarcastic narration crutch', severity: 'high' },
    { regex: /\bnot my finest moment/gi, label: 'sarcastic narration crutch', severity: 'low' },
    { regex: /\bzero out of ten/gi, label: 'sarcastic narration crutch', severity: 'high' },

    // Bathos
    { regex: /\bthe fate of .+ was at stake\. also/gi, label: 'bathos as default rhythm', severity: 'high' },

    // Lampshading
    { regex: /\bi know this sounds like a bad movie/gi, label: 'lampshading', severity: 'high' },
    { regex: /\bbecause of course it was/gi, label: 'lampshading', severity: 'low' },
    { regex: /\bbecause that'?s just my luck/gi, label: 'lampshading', severity: 'low' },
    { regex: /\bif this were a movie/gi, label: 'lampshading', severity: 'high' },
    { regex: /\bcliché,?\s*i know/gi, label: 'lampshading', severity: 'high' },
    { regex: /\bwhat could possibly go wrong/gi, label: 'lampshading', severity: 'high' },

    // Snark tags
    { regex: /\bshe was not,?\s*in fact,?\s*fine/gi, label: 'snark tag / editorial annotation', severity: 'high' },
    { regex: /\bso that was going well/gi, label: 'snark tag / editorial annotation', severity: 'high' },
    { regex: /\bwonderful\.\s*fantastic\.\s*truly/gi, label: 'snark tag / editorial annotation', severity: 'high' },
    { regex: /\bthree words\.?\s*never good/gi, label: 'snark tag', severity: 'high' },

    // Parenthetical asides as voice crutch
    { regex: /\((?:not that [a-z]+ (?:noticed|cared)|[a-z]+ (?:wasn't|didn't|wasn't))\)/gi, label: 'parenthetical aside as voice crutch', severity: 'low' },
];

// ── Category 2: Physical & Physiological Clichés ──

export const BODY_PATTERNS = [
    // Blood metaphors
    { regex: /\bblood (?:ran|turned|went) cold\b/gi, label: 'blood-as-substance metaphor', severity: 'high' },
    { regex: /\bblood (?:turned to|like) (?:ice|lead|stone|fire)\b/gi, label: 'blood-as-substance metaphor', severity: 'high' },
    { regex: /\bblood (?:singing|boiling|freezing)\b/gi, label: 'blood-as-substance metaphor', severity: 'high' },

    // Electricity/magnetism between people
    { regex: /\b(?:electricity|electric(?:al)?\s+(?:jolt|charge|current)) between (?:them|us)\b/gi, label: 'intangible force between people', severity: 'high' },
    { regex: /\bsparks (?:flew|flying|between)\b/gi, label: 'intangible force between people', severity: 'high' },
    { regex: /\bchemistry was (?:undeniable|palpable)\b/gi, label: 'intangible force between people', severity: 'high' },
    { regex: /\btension thick enough to cut\b/gi, label: 'intangible force between people', severity: 'high' },
    { regex: /\b(?:air|space) (?:between them |)(?:felt |was |grew )(?:charged|magnetic|heavy|thick|electric)\b/gi, label: 'intangible force between people', severity: 'high' },

    // Eyes as emotion readout
    { regex: /\beyes? (?:darkened|blazed|flashed|burned|glittered|hardened|softened|smoldered)\b/gi, label: 'eyes as emotion readout', severity: 'high' },
    { regex: /\beyes? (?:burning|boring) into\b/gi, label: 'eyes as emotion readout', severity: 'high' },
    { regex: /\bgaze (?:hardened|softened|darkened|sharpened|bore into)\b/gi, label: 'eyes as emotion readout', severity: 'high' },
    { regex: /\beyes? (?:that |which )?glittered dangerously\b/gi, label: 'eyes as emotion readout', severity: 'high' },

    // Heart/pulse drama
    { regex: /\bheart (?:hammered|slammed|pounded|thundered|lurched|stuttered|skipped|leapt)\b/gi, label: 'heart as drama amplifier', severity: 'high' },
    { regex: /\bpulse (?:spiked|raced|thundered|roared|quickened)\b/gi, label: 'heart as drama amplifier', severity: 'low' },
    { regex: /\bheart skipped a beat\b/gi, label: 'heart as drama amplifier', severity: 'high' },

    // Stock visceral reactions
    { regex: /\bshivers? (?:down|up|along) (?:her|his|their|my|the) spine\b/gi, label: 'stock visceral reaction', severity: 'high' },
    { regex: /\bbutterflies in (?:her|his|their|my) stomach\b/gi, label: 'stock visceral reaction', severity: 'high' },
    { regex: /\b(?:a pit|pit) in (?:her|his|their|my) stomach\b/gi, label: 'stock visceral reaction', severity: 'high' },
    { regex: /\bstomach (?:dropped|sank|lurched|churned|knotted)\b/gi, label: 'stock visceral reaction', severity: 'high' },
    { regex: /\btime (?:stood still|stopped|seemed to (?:slow|stop))\b/gi, label: 'stock visceral reaction', severity: 'high' },
    { regex: /\bfire in (?:her|his|their|my) veins\b/gi, label: 'stock visceral reaction', severity: 'high' },
    { regex: /\bbreath (?:hitched|hitching|caught|catching)\b/gi, label: 'stock visceral reaction (breath hitching)', severity: 'high' },
    { regex: /\bthroat (?:tight(?:ened|ening)?|constricted)\b/gi, label: 'stock visceral reaction', severity: 'low' },
    { regex: /\bknuckles? (?:whitened|whitening|white-knuckled|turning white)\b/gi, label: 'stock visceral reaction (knuckles whitening)', severity: 'high' },
    { regex: /\bjaw (?:clenched|clenching|tightened|set)\b/gi, label: 'stock visceral reaction (jaw clenching)', severity: 'low' },
    { regex: /\bhands? (?:balled|clenched|curled) into fists?\b/gi, label: 'stock visceral reaction', severity: 'low' },
    { regex: /\bfurrowed (?:her|his|their) brow\b/gi, label: 'stock visceral reaction', severity: 'low' },
    { regex: /\b(?:face|cheeks) (?:burning|flaming|flushed|flushing)\b/gi, label: 'stock visceral reaction', severity: 'low' },
    { regex: /\bpupils? (?:blown wide|dilated)\b/gi, label: 'stock visceral reaction', severity: 'high' },
    { regex: /\breleased a breath (?:she|he|they|i) didn'?t know (?:she|he|they|i) (?:was|were|had been) holding\b/gi, label: 'stock visceral reaction (breath they didn\'t know they were holding)', severity: 'high' },
    { regex: /\ba wave of \w+ washed over\b/gi, label: 'stock visceral reaction (wave of emotion)', severity: 'high' },

    // Body-part autonomy
    { regex: /\b(?:her|his|their|my) hand found its way\b/gi, label: 'body-part autonomy', severity: 'high' },
    { regex: /\b(?:her|his|their|my) eyes? (?:traveled|roamed|wandered)\b/gi, label: 'body-part autonomy', severity: 'high' },
    { regex: /\bfeet carried (?:her|him|them|me)\b/gi, label: 'body-part autonomy', severity: 'high' },

    // Physical state announcements
    { regex: /\bi'?m aware of (?:his|her|their) proximity\b/gi, label: 'physical state announcement', severity: 'high' },
    { regex: /\bi can feel (?:the heat|my pulse|his|her)\b/gi, label: 'physical state announcement', severity: 'low' },

    // Standalone simile fragment
    { regex: /^like a (?:blow|knife|punch|slap|kick) (?:to|in) (?:the|her|his|my)\b/gim, label: 'standalone simile fragment', severity: 'high' },
];

// ── Category 3: Voice & Dialogue Clichés ──

export const VOICE_PATTERNS = [
    // Animal sounds for voice
    { regex: /\b(?:she|he|they|i) (?:purred|growled|hissed|barked|snarled|rumbled)\b/gi, label: 'animal sound as speech verb', severity: 'high' },
    { regex: /\ba low (?:rumble|growl) in (?:her|his|their) (?:chest|throat)\b/gi, label: 'animal sound for voice', severity: 'high' },

    // Voice-as-material
    { regex: /\bvoice (?:dripping|laced|thick|heavy) with\b/gi, label: 'voice-as-material metaphor', severity: 'high' },
    { regex: /\bwords? (?:dripping|laced) with\b/gi, label: 'voice-as-material metaphor', severity: 'high' },
    { regex: /\bwords? like (?:honey|ice|poison|stones|knives|velvet|silk)\b/gi, label: 'voice-as-material metaphor', severity: 'high' },

    // "Barely a [sound]"
    { regex: /\bbarely a (?:whisper|breath|sound|murmur)\b/gi, label: '"barely a [sound]" construction', severity: 'low' },
    { regex: /\bbarely audible\b/gi, label: '"barely a [sound]" construction', severity: 'low' },

    // Tone-labeling
    { regex: /\b(?:the word|her tone|his tone|her voice|his voice) was (?:sharp|cold|careful|flat|warm|desperate)\b/gi, label: 'tone-labeling (tell not show)', severity: 'low' },
];

// ── Category 4: Action & Movement Clichés ──

export const ACTION_PATTERNS = [
    // Generic movement modifiers
    { regex: /\bslow(?:ly)?,?\s*deliberate(?:ly)?\b/gi, label: 'generic movement modifier', severity: 'low' },
    { regex: /\bfluid and precise\b/gi, label: 'generic movement modifier', severity: 'high' },
    { regex: /\bin one (?:fluid|smooth) motion\b/gi, label: 'generic movement modifier', severity: 'high' },
    { regex: /\bwith deliberate slowness\b/gi, label: 'generic movement modifier', severity: 'high' },

    // Time-suspension
    { regex: /\ba (?:beat|moment|long moment) passed\b/gi, label: 'time-suspension cliché', severity: 'low' },
    { regex: /\bin (?:this|that) moment\b/gi, label: 'time-suspension cliché', severity: 'low' },
    { regex: /\bpregnant pause\b/gi, label: 'time-suspension cliché', severity: 'high' },
    { regex: /\bthe silence stretched\b/gi, label: 'time-suspension cliché', severity: 'high' },
    { regex: /\bfleeting moment\b/gi, label: 'time-suspension cliché', severity: 'high' },
    { regex: /\bin the blink of an eye\b/gi, label: 'time-suspension cliché', severity: 'high' },
    { regex: /\bin a heartbeat\b/gi, label: 'time-suspension cliché', severity: 'low' },

    // Stock intensity
    { regex: /\blet .+ hang in the air\b/gi, label: 'stock intensity move', severity: 'high' },
    { regex: /\bwithout (?:missing a beat|breaking stride|hesitation)\b/gi, label: 'stock intensity move', severity: 'low' },
    { regex: /\bcircling like a (?:predator|shark|wolf)\b/gi, label: 'stock intensity move', severity: 'high' },

    // Animal/predator expressions
    { regex: /\b(?:predatory|wolfish|feral|shark-like) (?:grin|smile|smirk)\b/gi, label: 'animal/predator expression', severity: 'high' },
];

// ── Category 5: Narrative & Structural Clichés ──

export const NARRATIVE_PATTERNS = [
    // Dialogue subtext explanation
    { regex: /\bit was(?:n'?t| not) a (?:question|request)\b/gi, label: 'dialogue subtext explanation', severity: 'high' },
    { regex: /\bmore statement than question\b/gi, label: 'dialogue subtext explanation', severity: 'high' },

    // Silence as communication
    { regex: /\bsilence (?:spoke volumes|said everything|was (?:deafening|answer enough))\b/gi, label: 'silence as communication', severity: 'high' },
    { regex: /\b(?:the question|the words?) hung (?:in the air|between them)\b/gi, label: 'silence as communication', severity: 'high' },

    // Authorial intrusion
    { regex: /\blittle did (?:she|he|they|i) know\b/gi, label: 'authorial intrusion', severity: 'high' },
    { regex: /\bunbeknownst to (?:him|her|them|me)\b/gi, label: 'authorial intrusion', severity: 'high' },
    { regex: /\bwhat (?:she|he|they|i) didn'?t (?:realize|know) was\b/gi, label: 'authorial intrusion', severity: 'high' },

    // Involuntary emotion output
    { regex: /\ba (?:laugh|sound|groan|whimper|sob|gasp|moan) (?:escapes?|slips?|leaves?) (?:me|him|her|them|my|his|her|their)\b/gi, label: 'involuntary emotion output', severity: 'high' },

    // Repetition-as-intensity
    { regex: /\breally (?:look|see|hear|listen|feel)\b/gi, label: 'repetition-as-intensity ("really [verb]")', severity: 'low' },

    // Em-dash restart pattern (multiple in one message)
    { regex: /—[""]?\s*(?:she|he|they|i)\s+(?:swallowed|paused|stopped|looked away|took a breath)/gi, label: 'em-dash restart-after-swallow pattern', severity: 'low' },
];

// ── Category 6: Overwrought Language ──

export const OVERWROUGHT_PATTERNS = [
    // Poeticizing blood
    { regex: /\b(?:crimson|ruby|scarlet) (?:beads?|drops?|droplets?|rivulets?)\b/gi, label: 'poeticizing blood', severity: 'high' },

    // Hyperbolic adverb intensifiers
    { regex: /\b(?:impossibly|inhumanly|ridiculously|insanely|unfairly|unreasonably|uncannily) (?:\w+)\b/gi, label: 'hyperbolic adverb intensifier', severity: 'low' },

    // Stock sensory clichés
    { regex: /\bthe smell of ozone\b/gi, label: 'stock sensory cliché (ozone)', severity: 'high' },
    { regex: /\btaste of (?:copper|iron)\b/gi, label: 'stock sensory cliché', severity: 'low' },
    { regex: /\bmetallic taste\b/gi, label: 'stock sensory cliché', severity: 'low' },

    // Authenticity modifiers
    { regex: /\ba (?:real|genuine|true) (?:smile|laugh|grin|fear|anger|concern|surprise)\b/gi, label: 'authenticity modifier (certifying emotion as "real")', severity: 'high' },

    // Buzzword metaphors
    { regex: /\btapestry of (?:emotions?|feelings?|experiences?)\b/gi, label: 'buzzword metaphor', severity: 'high' },
    { regex: /\bbeacon of hope\b/gi, label: 'buzzword metaphor', severity: 'high' },
    { regex: /\brealm of possibilit(?:y|ies)\b/gi, label: 'buzzword metaphor', severity: 'high' },
    { regex: /\btestament to (?:her|his|their)\b/gi, label: 'buzzword metaphor', severity: 'high' },
    { regex: /\bnavigate (?:this|their|our) relationship\b/gi, label: 'buzzword metaphor', severity: 'high' },
    { regex: /\bunpack (?:those|these|the) feelings?\b/gi, label: 'buzzword metaphor', severity: 'high' },
    { regex: /\bdelve into\b/gi, label: 'buzzword metaphor', severity: 'low' },
];

// ── All patterns combined ──

export const ALL_SLOP_PATTERNS = [
    ...QUIP_PATTERNS,
    ...BODY_PATTERNS,
    ...VOICE_PATTERNS,
    ...ACTION_PATTERNS,
    ...NARRATIVE_PATTERNS,
    ...OVERWROUGHT_PATTERNS,
];

/**
 * Scan text for slop patterns and return matches grouped by category.
 * @param {string} text - Text to analyze
 * @returns {{ category: string, matches: Array<{ label: string, count: number, severity: string }> }[]}
 */
export function scanForSlop(text) {
    if (!text) return [];

    const categories = [
        { name: 'Quippy & Deflective Writing', patterns: QUIP_PATTERNS },
        { name: 'Physical & Body Clichés', patterns: BODY_PATTERNS },
        { name: 'Voice & Dialogue Clichés', patterns: VOICE_PATTERNS },
        { name: 'Action & Movement Clichés', patterns: ACTION_PATTERNS },
        { name: 'Narrative & Structural Clichés', patterns: NARRATIVE_PATTERNS },
        { name: 'Overwrought Language', patterns: OVERWROUGHT_PATTERNS },
    ];

    const results = [];

    for (const cat of categories) {
        const matches = [];
        const seenLabels = new Map();

        for (const pattern of cat.patterns) {
            const found = text.match(pattern.regex);
            if (!found) continue;

            const count = found.length;
            // For 'low' severity, only flag if repeated
            if (pattern.severity === 'low' && count < 2) continue;

            const existing = seenLabels.get(pattern.label);
            if (existing) {
                existing.count += count;
            } else {
                const entry = { label: pattern.label, count, severity: pattern.severity };
                seenLabels.set(pattern.label, entry);
                matches.push(entry);
            }
        }

        if (matches.length > 0) {
            results.push({ category: cat.name, matches });
        }
    }

    return results;
}
