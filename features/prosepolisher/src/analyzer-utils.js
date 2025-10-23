
import { commonWords } from './common_words.js';
import { defaultNames } from './default_names.js';
import { lemmaMap } from './lemmas.js';

// Constants
export const NGRAM_MIN = 3;
export const CANDIDATE_LIMIT_FOR_ANALYSIS = 2000;

// Utility Functions
export function stripMarkup(text) {
    if (!text) return '';
    let cleanText = text;

    cleanText = cleanText.replace(/(?:```|~~~)\w*\s*[\s\S]*?(?:```|~~~)/g, ' ');
    cleanText = cleanText.replace(/<(info_panel|memo|code|pre|script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    cleanText = cleanText.replace(/<[^>]*>/g, ' ');
    cleanText = cleanText.replace(/(?:\*|_|~|`)+(.+?)(?:\*|_|~|`)+/g, '$1');
    cleanText = cleanText.replace(/"(.*?)"/g, ' $1 ');
    cleanText = cleanText.replace(/\((.*?)\)/g, ' $1 ');
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return cleanText;
}

export function generateNgrams(words, n) {
    const ngrams = [];
    if (words.length < n) return ngrams;
    for (let i = 0; i <= words.length - n; i++) {
        ngrams.push(words.slice(i, i + n).join(' '));
    }
    return ngrams;
}

export function cullSubstrings(frequenciesObject) {
    const culledFrequencies = { ...frequenciesObject };
    const sortedPhrases = Object.keys(culledFrequencies).sort((a, b) => b.length - a.length);
    const phrasesToRemove = new Set();
    for (let i = 0; i < sortedPhrases.length; i++) {
        const longerPhrase = sortedPhrases[i];
        if (phrasesToRemove.has(longerPhrase)) continue;
        for (let j = i + 1; j < sortedPhrases.length; j++) {
            const shorterPhrase = sortedPhrases[j];
            if (phrasesToRemove.has(shorterPhrase)) continue;
            if (longerPhrase.includes(shorterPhrase)) {
                phrasesToRemove.add(shorterPhrase);
            }
        }
    }
    phrasesToRemove.forEach(phrase => {
        delete culledFrequencies[phrase];
    });
    return culledFrequencies;
}

export function getEffectiveWhitelist(settings) {
    const userWhitelist = new Set((settings.whitelist || []).map(w => w.toLowerCase()));
    return new Set([...defaultNames, ...commonWords, ...userWhitelist]);
}

export function isPhraseLowQuality(phrase, effectiveWhitelist) {
    const words = phrase.toLowerCase().split(' ');

    if (words.length < NGRAM_MIN) return true;

    const allWhitelisted = words.every(word => effectiveWhitelist.has(word));
    if (allWhitelisted) return true;
    
    return false;
}

export function getBlacklistWeight(phrase, settings) {
    const blacklist = settings.blacklist || {};
    if (Object.keys(blacklist).length === 0) return 0;
    const lowerCasePhrase = phrase.toLowerCase();
    let maxWeight = 0;
    for (const blacklistedTerm in blacklist) {
        if (lowerCasePhrase.includes(blacklistedTerm)) {
            maxWeight = Math.max(maxWeight, blacklist[blacklistedTerm]);
        }
    }
    return maxWeight;
}

export function findAndMergePatterns(frequenciesObjectWithOriginals, settings) { 
    const PATTERN_MIN_COMMON_WORDS = settings.patternMinCommon || 3;
    const phraseScoreMap = {}; 
    for (const data of Object.values(frequenciesObjectWithOriginals)) {
        phraseScoreMap[data.original] = (phraseScoreMap[data.original] || 0) + data.score; 
    }

    const culledFrequencies = cullSubstrings(phraseScoreMap); 
    const candidates = Object.entries(culledFrequencies).sort((a, b) => a[0].localeCompare(b[0])); 
    const mergedPatterns = {};
    const consumedIndices = new Set();

    for (let i = 0; i < candidates.length; i++) {
        if (consumedIndices.has(i)) continue;

        const [phraseA, scoreA] = candidates[i];
        const wordsA = phraseA.split(' ');
        let currentGroup = [{ index: i, phrase: phraseA, score: scoreA }];

        for (let j = i + 1; j < candidates.length; j++) {
            if (consumedIndices.has(j)) continue;
            const [phraseB, scoreB] = candidates[j];
            const wordsB = phraseB.split(' ');
            let commonPrefix = [];
            for (let k = 0; k < Math.min(wordsA.length, wordsB.length); k++) {
                if (wordsA[k] === wordsB[k]) commonPrefix.push(wordsA[k]);
                else break;
            }
            if (commonPrefix.length >= PATTERN_MIN_COMMON_WORDS) {
                currentGroup.push({ index: j, phrase: phraseB, score: scoreB });
            }
        }

        if (currentGroup.length > 1) {
            let totalScore = 0;
            const variations = new Set();
            let commonPrefixString = '';
            const firstWordsInGroup = currentGroup[0].phrase.split(' ');

            if (currentGroup.length > 0) {
                let prefixLength = firstWordsInGroup.length;
                for (let k = 1; k < currentGroup.length; k++) {
                    const otherWords = currentGroup[k].phrase.split(' ');
                    let currentItemPrefixLength = 0;
                    while (currentItemPrefixLength < prefixLength && 
                           currentItemPrefixLength < otherWords.length && 
                           firstWordsInGroup[currentItemPrefixLength] === otherWords[currentItemPrefixLength]) {
                        currentItemPrefixLength++;
                    }
                    prefixLength = currentItemPrefixLength; 
                }
                commonPrefixString = firstWordsInGroup.slice(0, prefixLength).join(' ');
            }
            
            if (commonPrefixString.split(' ').filter(Boolean).length >= PATTERN_MIN_COMMON_WORDS) {
                currentGroup.forEach(item => {
                    totalScore += item.score;
                    consumedIndices.add(item.index);
                    const itemWords = item.phrase.split(' ');
                    const variationPart = itemWords.slice(commonPrefixString.split(' ').length).join(' ').trim();
                    if (variationPart) variations.add(variationPart);
                });

                if (variations.size > 0) { 
                    const pattern = `${commonPrefixString} ${Array.from(variations).join('/')}`;
                    mergedPatterns[pattern] = (mergedPatterns[pattern] || 0) + totalScore; 
                } else if (variations.size === 0 && currentGroup.length > 1) {
                    mergedPatterns[commonPrefixString] = (mergedPatterns[commonPrefixString] || 0) + totalScore;
                }
            }
        }
    }

    const remaining = {};
    for (let i = 0; i < candidates.length; i++) {
        if (!consumedIndices.has(i)) {
            const [phrase, score] = candidates[i];
            let isPartOfMerged = false;
            for (const pattern in mergedPatterns) {
                if (pattern.startsWith(phrase + " ") || pattern === phrase) { 
                    isPartOfMerged = true;
                    break;
                }
            }
            if (!isPartOfMerged) {
                remaining[phrase] = (remaining[phrase] || 0) + score;
            }
        }
    }
    return { merged: mergedPatterns, remaining: remaining };
}
