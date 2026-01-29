/**
 * Simple fuzzy search implementation
 */
export function fuzzySearch(query: string, text: string): { match: boolean; score: number } {
    if (!query) return { match: true, score: 1 };

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match
    if (textLower === queryLower) {
        return { match: true, score: 1 };
    }

    // Starts with
    if (textLower.startsWith(queryLower)) {
        return { match: true, score: 0.9 };
    }

    // Contains
    if (textLower.includes(queryLower)) {
        return { match: true, score: 0.7 };
    }

    // Fuzzy match (all characters in order)
    let queryIndex = 0;
    let matchedChars = 0;
    let consecutiveMatches = 0;
    let maxConsecutive = 0;

    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
        if (textLower[i] === queryLower[queryIndex]) {
            matchedChars++;
            consecutiveMatches++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
            queryIndex++;
        } else {
            consecutiveMatches = 0;
        }
    }

    if (queryIndex === queryLower.length) {
        // All query characters found in order
        const score = (matchedChars / textLower.length) * 0.5 + (maxConsecutive / queryLower.length) * 0.3;
        return { match: true, score: Math.min(0.6, score) };
    }

    return { match: false, score: 0 };
}

/**
 * Filter and sort items by fuzzy search
 */
export function filterByFuzzySearch<T>(
    items: T[],
    query: string,
    getText: (item: T) => string
): T[] {
    if (!query.trim()) return items;

    return items
        .map(item => ({
            item,
            ...fuzzySearch(query, getText(item))
        }))
        .filter(result => result.match)
        .sort((a, b) => b.score - a.score)
        .map(result => result.item);
}

export default fuzzySearch;
