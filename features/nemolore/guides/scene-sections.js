const SECTION_HEADINGS = {
    situation: '(?:Scene\\s+)?Situation(?:\\s*&\\s*Context)?',
    clothing: '(?:Character\\s+)?Clothing(?:\\s*&\\s*Appearance)?',
    positions: '(?:Character\\s+)?Positions(?:\\s*&\\s*Physical\\s+States)?',
    thinking: '(?:Character\\s+)?(?:Thinking|Thoughts)',
};

const ANY_SECTION_HEADING = Object.values(SECTION_HEADINGS).join('|');

const SECTION_PATTERNS = Object.fromEntries(
    Object.entries(SECTION_HEADINGS).map(([key, heading]) => [
        key,
        new RegExp(`##?\\s*${heading}\\s*\\n([\\s\\S]*?)(?=##?\\s*(?:${ANY_SECTION_HEADING})\\s*\\n|$)`, 'i'),
    ]),
);

/**
 * Parse a scene-assessment response into tracker-specific sections.
 *
 * The model is instructed to use markdown headings. When it does not, callers
 * should fall back to the full response rather than dropping useful context.
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseSceneSections(text) {
    const sections = {};
    const source = String(text || '');

    for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
        const match = source.match(pattern);
        if (match && match[1]?.trim()) {
            sections[key] = match[1].trim();
        }
    }

    return sections;
}

export function getSceneSectionOrFallback(sections, aspect, fallback) {
    return String(sections?.[aspect] || fallback || '').trim();
}
