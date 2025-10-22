// Simple Fuse.js alternative for fuzzy search
class Fuse {
    constructor(list, options = {}) {
        this.list = list;
        this.options = {
            keys: options.keys || [],
            threshold: options.threshold || 0.6,
            ...options
        };
    }

    search(pattern) {
        if (!pattern) return [];
        
        const results = this.list
            .map((item, index) => {
                const searchText = typeof item === 'string' ? item : 
                    this.options.keys.length > 0 ? 
                        this.options.keys.map(key => item[key]).join(' ') : 
                        JSON.stringify(item);
                
                const score = this.calculateScore(pattern, searchText);
                return { item, score, refIndex: index };
            })
            .filter(result => result.score <= this.options.threshold)
            .sort((a, b) => a.score - b.score);

        return results;
    }

    calculateScore(pattern, text) {
        const patternLower = pattern.toLowerCase();
        const textLower = text.toLowerCase();
        
        // Exact match
        if (textLower === patternLower) return 0;
        
        // Contains match
        if (textLower.includes(patternLower)) return 0.2;
        
        // Starts with match
        if (textLower.startsWith(patternLower)) return 0.1;
        
        // Levenshtein distance based scoring
        const distance = this.levenshteinDistance(patternLower, textLower);
        const maxLength = Math.max(patternLower.length, textLower.length);
        
        return distance / maxLength;
    }

    levenshteinDistance(a, b) {
        const matrix = [];
        
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[b.length][a.length];
    }
}

export default Fuse;