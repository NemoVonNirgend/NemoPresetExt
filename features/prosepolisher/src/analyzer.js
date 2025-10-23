

import { extension_settings, getContext } from '../../../../../../extensions.js';
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { applyGremlinEnvironment } from './projectgremlin.js';
import { state } from './state.js';
import { executeGen, executeGenRaw } from './api-service.js';
import { prompts } from './prompts.js';
import { lemmaMap } from './lemmas.js';
import {
    stripMarkup,
    generateNgrams,
    getEffectiveWhitelist,
    isPhraseLowQuality,
    getBlacklistWeight,
    findAndMergePatterns,
    NGRAM_MIN,
    CANDIDATE_LIMIT_FOR_ANALYSIS
} from './analyzer-utils.js';

const LOG_PREFIX = `[ProsePolisher:Analyzer]`;

// Constants
const BATCH_SIZE = 15; // Number of final candidates to send to AI for regex generation
const TWINS_PRESCREEN_BATCH_SIZE = 50; // Max number of candidates to send to Twins for pre-screening
const MIN_ALTERNATIVES_PER_RULE = 15;

// --- Analyzer Class ---
export class Analyzer {
    constructor(dependencies = {}) {
        // Use dependency injection pattern for better testability and maintainability
        this.settings = dependencies.settings;
        this.callGenericPopup = dependencies.callGenericPopup;
        this.POPUP_TYPE = dependencies.POPUP_TYPE;
        this.toastr = dependencies.toastr;
        this.saveSettingsDebounced = dependencies.saveSettingsDebounced;
        this.compileActiveRules = dependencies.compileActiveRules;
        this.updateGlobalRegexArrayCallback = dependencies.updateGlobalRegexArrayCallback;
        this.compiledRegexes = dependencies.compiledRegexes;

        this.ngramFrequencies = new Map();
        this.slopCandidates = new Set();
        this.analyzedLeaderboardData = { merged: {}, remaining: {} };
        this.messageCounterForTrigger = 0;
        this.totalAiMessagesProcessed = 0;
        this.isProcessingAiRules = false;
        this.isAnalyzingHistory = false;

        this.effectiveWhitelist = new Set();
        this.updateEffectiveWhitelist();
    }

    updateEffectiveWhitelist() {
        this.effectiveWhitelist = getEffectiveWhitelist(this.settings);
        console.log(`${LOG_PREFIX} Analyzer effective whitelist updated. Size: ${this.effectiveWhitelist.size}`);
    }

    isPhraseWhitelistedLocal(phrase) { // This is used by the UI/manual checks, not primary analysis filter anymore
        const lowerCasePhrase = phrase.toLowerCase();
        const words = lowerCasePhrase.split(/\s+/).filter(w => w);
        for (const word of words) {
            if (this.effectiveWhitelist.has(word)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Analyze summaries from NemoLore (Integration Opportunity 2.2)
     * Processes summary text to track patterns across compressed history
     * @param {string} summaryText - The summary text to analyze
     * @param {Object} metadata - Optional metadata (messageIndex, type, etc.)
     */
    analyzeSummary(summaryText, metadata = {}) {
        if (!this.settings.analyzeNemoLoreSummaries) {
            return; // Feature disabled
        }

        if (!summaryText || !summaryText.trim()) {
            return;
        }

        console.log(`${LOG_PREFIX} Analyzing NemoLore summary${metadata.messageIndex ? ` from message ${metadata.messageIndex}` : ''}...`);

        // Use existing frequency tracking with slight weight adjustment for summaries
        // Summaries are more concentrated/refined, so patterns here are more significant
        const originalTotalMessages = this.totalAiMessagesProcessed;

        // Treat summary as a special "condensed message" for tracking purposes
        this.analyzeAndTrackFrequency(summaryText);

        // Restore original message count (summaries don't count as new messages)
        this.totalAiMessagesProcessed = originalTotalMessages;

        console.log(`${LOG_PREFIX} ✅ NemoLore summary analyzed`);
    }

    analyzeAndTrackFrequency(text) {
        const cleanText = stripMarkup(text);
        if (!cleanText.trim()) return;

        const NGRAM_MAX = this.settings.ngramMax || 10;
        const SLOP_THRESHOLD = this.settings.slopThreshold || 3.0;

        // CRITICAL CHANGE: Split text into sentences first to prevent cross-sentence n-grams.
        const sentences = cleanText.match(/[^.!?]+[.!?]+["]?/g) || [cleanText];

        for (const sentence of sentences) {
            if (!sentence.trim()) continue;

            const isDialogue = /["']/.test(sentence.trim().substring(0, 10));
            const chunkType = isDialogue ? 'dialogue' : 'narration';

            const originalWords = sentence.replace(/[.,!?]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
            const lemmatizedWords = originalWords.map(word => lemmaMap.get(word) || word);

            for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
                if (originalWords.length < n) continue;

                const originalNgrams = generateNgrams(originalWords, n);
                const lemmatizedNgrams = generateNgrams(lemmatizedWords, n);

                for (let i = 0; i < originalNgrams.length; i++) {
                    const originalNgram = originalNgrams[i];
                    const lemmatizedNgram = lemmatizedNgrams[i];

                    if (this.compiledRegexes.some(regex => regex.test(originalNgram.toLowerCase())) || isPhraseLowQuality(originalNgram, this.effectiveWhitelist)) {
                        continue;
                    }

                    const currentData = this.ngramFrequencies.get(lemmatizedNgram) || { count: 0, score: 0, lastSeenMessageIndex: this.totalAiMessagesProcessed, original: originalNgram, contextSentence: sentence };

                    let scoreIncrement = 1.0;
                    
                    scoreIncrement += (n - NGRAM_MIN) * 0.2;
                    const uncommonWordCount = originalNgram.split(' ').reduce((count, word) => count + (this.effectiveWhitelist.has(word) ? 0 : 1), 0);
                    scoreIncrement += uncommonWordCount * 0.5;
                    scoreIncrement += getBlacklistWeight(originalNgram, this.settings);
                    if (chunkType === 'narration') {
                        scoreIncrement *= 1.25;
                    }

                    const newCount = currentData.count + 1;
                    const newScore = currentData.score + scoreIncrement;

                    this.ngramFrequencies.set(lemmatizedNgram, {
                        count: newCount,
                        score: newScore,
                        lastSeenMessageIndex: this.totalAiMessagesProcessed,
                        original: originalNgram, 
                        contextSentence: sentence,
                    });

                    if (newScore >= SLOP_THRESHOLD && currentData.score < SLOP_THRESHOLD) { 
                        this.processNewSlopCandidate(lemmatizedNgram);
                    }
                }
            }
        }
    }

    processNewSlopCandidate(newPhraseLemmatized) { 
        let isSubstring = false;
        const phrasesToRemove = []; 
        for (const existingPhraseLemmatized of this.slopCandidates) {
            if (existingPhraseLemmatized.includes(newPhraseLemmatized)) { 
                isSubstring = true;
                break;
            }
            if (newPhraseLemmatized.includes(existingPhraseLemmatized)) { 
                phrasesToRemove.push(existingPhraseLemmatized);
            }
        }
        if (!isSubstring) {
            phrasesToRemove.forEach(phrase => this.slopCandidates.delete(phrase));
            this.slopCandidates.add(newPhraseLemmatized);
        }
    }
    
    pruneOldNgrams() {
        const PRUNE_AFTER_MESSAGES = this.settings.pruningCycle || 20;
        const SLOP_THRESHOLD = this.settings.slopThreshold || 3.0;
        let prunedCount = 0;
        for (const [ngram, data] of this.ngramFrequencies.entries()) {
            if ((this.totalAiMessagesProcessed - data.lastSeenMessageIndex > PRUNE_AFTER_MESSAGES)) {
                if (data.score < SLOP_THRESHOLD) {
                    this.ngramFrequencies.delete(ngram);
                    this.slopCandidates.delete(ngram); 
                    prunedCount++;
                } else {
                    data.score *= 0.9; 
                }
            }
        }
        if (prunedCount > 0) console.log(`${LOG_PREFIX} Pruned ${prunedCount} old/low-score n-grams.`);
    }

    pruneDuringManualAnalysis() {
        let prunedCount = 0;
        for (const [ngram, data] of this.ngramFrequencies.entries()) {
            if (data.score < 2 && data.count < 2) { 
                this.ngramFrequencies.delete(ngram);
                this.slopCandidates.delete(ngram);
                prunedCount++;
            }
        }
        if (prunedCount > 0) {
            console.log(`${LOG_PREFIX} [Manual Analysis] Pruned ${prunedCount} very low-score n-grams from chunk.`);
        }
    }

    performIntermediateAnalysis() {
        const candidatesWithData = {};
        for (const [phrase, data] of this.ngramFrequencies.entries()) {
            if (data.score > 1) {
                candidatesWithData[phrase] = data;
            }
        }
        const sortedCandidates = Object.entries(candidatesWithData).sort((a, b) => b[1].score - a[1].score);
        const limitedCandidates = Object.fromEntries(sortedCandidates.slice(0, CANDIDATE_LIMIT_FOR_ANALYSIS));

        if (Object.keys(candidatesWithData).length > CANDIDATE_LIMIT_FOR_ANALYSIS) {
            console.log(`${LOG_PREFIX} [Perf] Limited candidates from ${Object.keys(candidatesWithData).length} to ${CANDIDATE_LIMIT_FOR_ANALYSIS} BEFORE heavy processing.`);
        }
        
        const { merged, remaining } = findAndMergePatterns(limitedCandidates, this.settings);
        
        const mergedEntries = Object.entries(merged).sort((a, b) => b[1] - a[1]);
        const allRemainingEntries = Object.entries(remaining).sort((a, b) => b[1] - a[1]);
        
        this.analyzedLeaderboardData = {
            merged: Object.fromEntries(mergedEntries),
            remaining: Object.fromEntries(allRemainingEntries),
        };

        // Save state after analysis
        this.saveAnalyzerState();
    }

    async callTwinsForSlopPreScreening(rawCandidates, compiledRegexes) {
        if (!rawCandidates || rawCandidates.length === 0) return [];

        // The large prompt is now imported and used directly
        const systemPrompt = prompts.callTwinsForSlopPreScreening;
        const userPrompt = `Evaluate the following potential slop phrases/patterns:\n- ${rawCandidates.join('\n- ')}\n\nProvide the JSON array of evaluations now.`;

        try {
            this.toastr.info("Prose Polisher: Twins are pre-screening slop candidates...", "Project Gremlin", { timeOut: 7000 });
            if (!await applyGremlinEnvironment('twins')) {
                throw new Error("Failed to configure environment for Twin Gremlins pre-screening.");
            }

            const rawResponse = await executeGenRaw(`${systemPrompt}\n\n${userPrompt}`);
            if (!rawResponse || !rawResponse.trim()) {
                console.warn(`${LOG_PREFIX} Twins returned an empty response during pre-screening.`);
                return rawCandidates.map(c => ({ candidate: c, enhanced_context: c })); 
            }

            let twinResults = [];
            try {
                const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```|(\[[\s\S]*?\])/s);
                if (jsonMatch) {
                    const jsonString = jsonMatch[1] || jsonMatch[2];
                    const parsedData = JSON.parse(jsonString);
                    twinResults = Array.isArray(parsedData) ? parsedData : [parsedData];
                } else {
                     const parsedData = JSON.parse(rawResponse);
                     twinResults = Array.isArray(parsedData) ? parsedData : [parsedData];
                }
            } catch (e) {
                console.error(`${LOG_PREFIX} Failed to parse JSON from Twins' pre-screening response. Error: ${e.message}. Raw response:`, rawResponse);
                this.toastr.error("Prose Polisher: Twins' pre-screening returned invalid data. See console.");
                return rawCandidates.map(c => ({ candidate: c, enhanced_context: c })); 
            }

            const validCandidates = twinResults.filter(r => r.valid_for_regex && r.candidate && r.enhanced_context).map(r => ({
                candidate: r.candidate,
                enhanced_context: r.enhanced_context,
            }));
            
            const rejectedCount = twinResults.length - validCandidates.length;
            if (rejectedCount > 0) {
                 console.log(`${LOG_PREFIX} Twins rejected ${rejectedCount} slop candidates during pre-screening.`);
            }

            this.toastr.success(`Prose Polisher: Twins pre-screened ${rawCandidates.length} candidates. ${validCandidates.length} approved.`, "Project Gremlin", { timeOut: 4000 });
            return validCandidates;

        } catch (error) {
            console.error(`${LOG_PREFIX} Error during Twins pre-screening:`, error);
            this.toastr.error(`Prose Polisher: Twins pre-screening failed. ${error.message}. Proceeding with raw candidates.`, "Project Gremlin");
            return rawCandidates.map(c => ({ candidate: c, enhanced_context: c })); 
        }
    }

    async generateAndSaveDynamicRulesWithSingleGremlin(candidatesForGeneration, dynamicRulesRef, gremlinRoleForGeneration) {
        if (!state.isAppReady) {
            this.toastr.info("SillyTavern is still loading, please wait to generate rules.");
            return 0;
        }
        
        const roleForGenUpper = gremlinRoleForGeneration.charAt(0).toUpperCase() + gremlinRoleForGeneration.slice(1);
        let addedCount = 0;

        // Get the prompt template from the imported file
        const systemPromptTemplate = prompts.generateAndSaveDynamicRulesWithSingleGremlin;
        // Inject the dynamic value. Using a regex with 'g' flag ensures all instances are replaced.
        const systemPrompt = systemPromptTemplate.replace(/\$\{MIN_ALTERNATIVES_PER_RULE\}/g, MIN_ALTERNATIVES_PER_RULE);

        const formattedCandidates = candidatesForGeneration.map(c => `- ${JSON.stringify(c)}`).join('\n');
        const userPrompt = `Generate the JSON array of regex rules for the following candidates:\n${formattedCandidates}\n\nFollow all instructions precisely.`;
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

        try {
            if (gremlinRoleForGeneration !== 'current') {
                this.toastr.info(`Prose Polisher: Configuring '${roleForGenUpper}' environment for rule generation...`, "Project Gremlin", { timeOut: 7000 });
                if (!await applyGremlinEnvironment(gremlinRoleForGeneration)) {
                    throw new Error(`Failed to configure environment for rule generation using ${roleForGenUpper} Gremlin's settings.`);
                }
                this.toastr.info(`Prose Polisher: Generating regex rules via AI (${roleForGenUpper})...`, "Project Gremlin", { timeOut: 25000 });
            } else {
                this.toastr.info(`Prose Polisher: Generating regex rules via AI (using current connection)...`, "Project Gremlin", { timeOut: 25000 });
            }
            const rawResponse = await executeGenRaw(fullPrompt);

            if (!rawResponse || !rawResponse.trim()) {
                this.toastr.warning(`Prose Polisher: ${roleForGenUpper} returned no data for rule generation.`);
                return 0;
            }

            let newRules = [];
            try {
                const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```|(\[[\s\S]*?\])/s);
                if (jsonMatch) {
                    const jsonString = jsonMatch[1] || jsonMatch[2];
                    const parsedData = JSON.parse(jsonString);
                    newRules = Array.isArray(parsedData) ? parsedData : [parsedData];
                } else {
                     const parsedData = JSON.parse(rawResponse);
                     newRules = Array.isArray(parsedData) ? parsedData : [parsedData];
                }
            } catch (e) {
                console.error(`${LOG_PREFIX} Failed to parse JSON from ${roleForGenUpper}'s response. Error: ${e.message}. Raw response:`, rawResponse);
                this.toastr.error(`Prose Polisher: ${roleForGenUpper}'s rule generation returned invalid data. See console.`);
                return 0;
            }

            for (const rule of newRules) {
                if (rule && rule.scriptName && rule.findRegex && rule.replaceString) {
                    try { new RegExp(rule.findRegex); } catch (e) { console.warn(`${LOG_PREFIX} AI generated an invalid regex for rule '${rule.scriptName}', skipping: ${e.message}`); continue; }
                    
                    let alternativesArray = [];
                    let finalReplaceString = '';

                    // Sanitize first to handle `{ {` cases
                    let processedString = rule.replaceString.replace(/\{\s*\{/g, '{{').replace(/\}\s*\}/g, '}}').replace(/\{\{\s*random:/, '{{random:');

                    const alternativesMatch = processedString.match(/^\{\{random:([\s\S]+?)\}\}$/);

                    if (alternativesMatch && alternativesMatch[1]) {
                        // Case 1: The wrapper exists, parse from it.
                        alternativesArray = alternativesMatch[1].split(',').map(s => s.trim()).filter(s => s);
                        finalReplaceString = processedString;
                    } else {
                        // Case 2: The wrapper is missing. Assume the whole string is the list.
                        const rawAlternatives = processedString.replace(/^"|"$/g, '');
                        alternativesArray = rawAlternatives.split(',').map(s => s.trim()).filter(s => s);
                        finalReplaceString = `{{random:${alternativesArray.join(',')}}}`;
                    }

                    if (alternativesArray.length < MIN_ALTERNATIVES_PER_RULE) {
                        console.warn(`${LOG_PREFIX} AI rule '${rule.scriptName}' has insufficient alternatives (found ${alternativesArray.length}, need ${MIN_ALTERNATIVES_PER_RULE}) or malformed replaceString. Original: "${rule.replaceString}", Skipping.`);
                        continue;
                    }

                    rule.id = `DYN_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    rule.disabled = rule.disabled ?? false;
                    rule.isStatic = false;
                    rule.isNew = true;
                    rule.replaceString = finalReplaceString; // Use the correctly formatted string
                    dynamicRulesRef.push(rule);
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                this.settings.dynamicRules = dynamicRulesRef;
                this.saveSettingsDebounced();
                if (this.updateGlobalRegexArrayCallback) {
                    await this.updateGlobalRegexArrayCallback();
                } else {
                    this.compileActiveRules();
                }
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Error during ${roleForGenUpper}'s dynamic rule generation:`, error);
            this.toastr.error(`Prose Polisher: ${roleForGenUpper}'s rule generation failed. ${error.message}`);
        } finally {
            console.log(`${LOG_PREFIX} Single Gremlin rule generation finished. Added ${addedCount} rules.`);
        }
        return addedCount;
    }

    async generateRulesIterativelyWithTwins(candidatesForGeneration, dynamicRulesRef, numCycles) {
        if (!candidatesForGeneration || candidatesForGeneration.length === 0) return 0;
        let addedCount = 0;
        this.toastr.info(`Prose Polisher: Starting Iterative Twins rule generation (${numCycles} cycle(s))...`, "Project Gremlin");

        for (const candidateData of candidatesForGeneration) {
            let currentFindRegex = null;
            let currentAlternatives = []; 
            let lastValidOutput = {}; 

            try {
                if (!await applyGremlinEnvironment('twins')) {
                    throw new Error("Failed to configure environment for Twin Gremlins (Iterative Regex).");
                }

                for (let cycle = 1; cycle <= numCycles; cycle++) {
                    if (this.isProcessingAiRules === false) { console.warn("Rule processing aborted by user/system."); return addedCount; }

                    this.toastr.info(`Regex Gen: Candidate "${candidateData.candidate.substring(0,20)}..." - Cycle ${cycle}/${numCycles} (Vex)...`, "Project Gremlin", { timeOut: 12000 });
                    let vexPrompt = this.constructTwinIterativePrompt('vex', cycle, numCycles, candidateData, currentFindRegex, currentAlternatives, lastValidOutput.notes_for_vax);
                    let vexRawResponse = await executeGenRaw(vexPrompt);
                    let vexOutput = this.parseTwinResponse(vexRawResponse, 'Vex');
                    lastValidOutput = {...lastValidOutput, ...vexOutput}; 
                    if (vexOutput.findRegex) currentFindRegex = vexOutput.findRegex;
                    if (Array.isArray(vexOutput.alternatives)) currentAlternatives = vexOutput.alternatives;
                    
                    if (this.isProcessingAiRules === false) { console.warn("Rule processing aborted by user/system."); return addedCount; }

                    this.toastr.info(`Regex Gen: Candidate "${candidateData.candidate.substring(0,20)}..." - Cycle ${cycle}/${numCycles} (Vax)...`, "Project Gremlin", { timeOut: 12000 });
                    let vaxPrompt = this.constructTwinIterativePrompt('vax', cycle, numCycles, candidateData, currentFindRegex, currentAlternatives, lastValidOutput.notes_for_vex);
                    let vaxRawResponse = await executeGenRaw(vaxPrompt);
                    let vaxOutput = this.parseTwinResponse(vaxRawResponse, 'Vax');
                    lastValidOutput = {...lastValidOutput, ...vaxOutput};
                    if (vaxOutput.findRegex) currentFindRegex = vaxOutput.findRegex;
                    if (Array.isArray(vaxOutput.alternatives)) currentAlternatives = vaxOutput.alternatives;
                    
                    if (cycle === numCycles) { 
                        if (vaxOutput.scriptName) lastValidOutput.scriptName = vaxOutput.scriptName;
                        if (vaxOutput.replaceString) lastValidOutput.replaceString = vaxOutput.replaceString; // Vax should be creating this in the correct format on final turn
                    }

                    if (this.isProcessingAiRules === false) { console.warn("Rule processing aborted by user/system."); return addedCount; }
                }

                // Validation for final rule from iterative twins
                if (lastValidOutput.scriptName && lastValidOutput.findRegex && lastValidOutput.replaceString) {
                    try { new RegExp(lastValidOutput.findRegex); }
                    catch (e) { console.warn(`${LOG_PREFIX} Iterative Twins produced invalid regex for '${lastValidOutput.scriptName}', skipping: ${e.message}`); continue; }

                    let alternativesArray = [];
                    let finalReplaceString = '';

                    // Sanitize first to handle `{ {` cases
                    let processedString = lastValidOutput.replaceString.replace(/\{\s*\{/g, '{{').replace(/\}\s*\}/g, '}}').replace(/\{\{\s*random:/, '{{random:');
                    const alternativesMatch = processedString.match(/^\{\{random:([\s\S]+?)\}\}$/);

                    if (alternativesMatch && alternativesMatch[1]) {
                        alternativesArray = alternativesMatch[1].split(',').map(s => s.trim()).filter(s => s);
                        finalReplaceString = processedString;
                    } else {
                        const rawAlternatives = processedString.replace(/^"|"$/g, '');
                        alternativesArray = rawAlternatives.split(',').map(s => s.trim()).filter(s => s);
                        finalReplaceString = `{{random:${alternativesArray.join(',')}}}`;
                    }

                    if (alternativesArray.length < MIN_ALTERNATIVES_PER_RULE) {
                        console.warn(`${LOG_PREFIX} Iterative Twins rule '${lastValidOutput.scriptName}' has insufficient alternatives (found ${alternativesArray.length}, need ${MIN_ALTERNATIVES_PER_RULE}) or malformed replaceString. Original: "${lastValidOutput.replaceString}", Skipping.`);
                        continue;
                    }

                    const newRule = {
                        id: `DYN_TWIN_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        scriptName: lastValidOutput.scriptName,
                        findRegex: lastValidOutput.findRegex,
                        replaceString: finalReplaceString,
                        disabled: false,
                        isStatic: false,
                        isNew: true,
                    };
                    dynamicRulesRef.push(newRule);
                    addedCount++;
                    console.log(`${LOG_PREFIX} Iterative Twins successfully generated rule: ${newRule.scriptName}`);
                } else {
                    console.warn(`${LOG_PREFIX} Iterative Twins failed to produce a complete rule for candidate: ${candidateData.candidate}. Final state:`, lastValidOutput);
                }

            } catch (error) {
                console.error(`${LOG_PREFIX} Error during iterative twin generation for candidate ${candidateData.candidate}:`, error);
                this.toastr.error(`Error with iterative regex for ${candidateData.candidate.substring(0,20)}... See console.`);
            }
        } 

        if (addedCount > 0) {
            this.settings.dynamicRules = dynamicRulesRef;
            this.saveSettingsDebounced();
            if (this.updateGlobalRegexArrayCallback) {
                await this.updateGlobalRegexArrayCallback();
            } else {
                this.compileActiveRules();
            }
        }
        this.toastr.success(`Iterative Twins rule generation finished. Added ${addedCount} rules.`, "Project Gremlin");
        return addedCount;
    }

    parseTwinResponse(rawResponse, twinName) {
        if (!rawResponse || !rawResponse.trim()) {
            console.warn(`${LOG_PREFIX} ${twinName} (Iterative Regex) returned empty response.`);
            return {};
        }
        try {
            const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*?\}|\[[\s\S]*?\])/s);
            if (jsonMatch) {
                const jsonString = jsonMatch[1] || jsonMatch[2]; 
                return JSON.parse(jsonString);
            }
            return JSON.parse(rawResponse); 
        } catch (e) {
            console.error(`${LOG_PREFIX} Failed to parse JSON from ${twinName} (Iterative Regex). Error: ${e.message}. Raw:`, rawResponse);
            this.toastr.warning(`${twinName} (Iterative Regex) output unparseable. See console.`);
            return {};
        }
    }
    
    constructTwinIterativePrompt(twinRole, currentCycle, totalCycles, candidateData, currentFindRegex, currentAlternatives, previousTwinNotes = "") {
        const isFinalVaxTurn = twinRole === 'vax' && currentCycle === totalCycles;

        let prompt = `${twinRole === 'vex' ? 'Creative role' : 'Technical role'} for phrase: "${candidateData.candidate}"
Cycle ${currentCycle}/${totalCycles}

${currentFindRegex ? `Current regex: ${currentFindRegex}` : 'No regex yet'}
${currentAlternatives?.length ? `Current alternatives: ${JSON.stringify(currentAlternatives)}` : 'No alternatives yet'}
${previousTwinNotes ? `Partner notes: ${previousTwinNotes}` : ''}

${twinRole === 'vex' ? 
`Task: Create creative alternatives. Return JSON: {"findRegex": "...", "alternatives": [...], "notes_for_vax": "..."}` :
isFinalVaxTurn ? 
`FINAL TURN: Finalize rule with ${MIN_ALTERNATIVES_PER_RULE}+ alternatives. Return JSON: {"scriptName": "...", "findRegex": "...", "replaceString": "{{random:alt1,alt2,...}}"}` :
`Task: Refine regex and alternatives. Return JSON: {"findRegex": "...", "alternatives": [...], "notes_for_vex": "..."}`
}

Return only JSON. If cannot create quality rule, return {}.`;
        return prompt;
    }

    async handleGenerateRulesFromAnalysisClick(dynamicRulesRef, regexNavigatorRef) {
        if (!state.isAppReady) { this.toastr.info("SillyTavern is still loading, please wait."); return; }
        if (this.isProcessingAiRules) { this.toastr.warning("Prose Polisher: AI rule generation is already in progress."); return; }
        
        this.performIntermediateAnalysis();
        
        // --- START: REVISED CANDIDATE GATHERING LOGIC ---
        const candidatesForAi = [];
        const contextMap = new Map();
        for (const data of this.ngramFrequencies.values()) {
            contextMap.set(data.original, data.contextSentence);
        }

        // 1. Process merged patterns
        for (const [pattern, score] of Object.entries(this.analyzedLeaderboardData.merged)) {
            candidatesForAi.push({
                candidate: pattern,
                enhanced_context: pattern, // For patterns, the pattern itself is the best context
                score: score,
            });
        }

        // 2. Process remaining individual phrases
        for (const [phrase, score] of Object.entries(this.analyzedLeaderboardData.remaining)) {
            candidatesForAi.push({
                candidate: phrase,
                enhanced_context: contextMap.get(phrase) || phrase, // Use real sentence context
                score: score,
            });
        }

        // 3. Sort all candidates together by score
        candidatesForAi.sort((a, b) => b.score - a.score);
        
        if (candidatesForAi.length === 0) {
             this.toastr.info("Prose Polisher: No slop candidates or patterns identified. Run analysis or wait for more messages.");
             return;
        }
        // --- END: REVISED CANDIDATE GATHERING LOGIC ---

        const candidatesForPreScreening = candidatesForAi.slice(0, TWINS_PRESCREEN_BATCH_SIZE);
        let validCandidatesForGeneration = [];
        
        if (this.settings.skipTriageCheck) {
            console.log(`${LOG_PREFIX} [Manual Gen] Skip Triage is enabled. Using direct candidates.`);
            validCandidatesForGeneration = candidatesForPreScreening;
        } else {
            const rawCandidatesForTwins = candidatesForPreScreening.map(c => c.candidate);
            validCandidatesForGeneration = await this.callTwinsForSlopPreScreening(rawCandidatesForTwins);
        }

        const batchToProcess = validCandidatesForGeneration.slice(0, BATCH_SIZE);

        if (batchToProcess.length === 0) {
            this.toastr.info("Prose Polisher: AI pre-screening found no valid slop candidates for rule generation.");
            return;
        }
        
        this.isProcessingAiRules = true; 
        let newRulesCount = 0;

        try {
            // *** FIX: Correctly route the generation method ***
            if (this.settings.regexGenerationMethod === 'twins') {
                newRulesCount = await this.generateRulesIterativelyWithTwins(batchToProcess, dynamicRulesRef, this.settings.regexTwinsCycles);
            } 
            else if (this.settings.regexGenerationMethod === 'single') {
                const gremlinRoleForRegexGen = this.settings.regexGeneratorRole || 'writer';
                const roleForGenUpper = gremlinRoleForRegexGen.charAt(0).toUpperCase() + gremlinRoleForRegexGen.slice(1);
                this.toastr.info(`Prose Polisher: Starting AI rule generation for ${batchToProcess.length} candidates (using ${roleForGenUpper} settings)...`);
                newRulesCount = await this.generateAndSaveDynamicRulesWithSingleGremlin(batchToProcess, dynamicRulesRef, gremlinRoleForRegexGen);
            }
            else { // This now correctly handles 'current'
                this.toastr.info(`Prose Polisher: Starting AI rule generation for ${batchToProcess.length} candidates (using current connection)...`);
                newRulesCount = await this.generateAndSaveDynamicRulesWithSingleGremlin(batchToProcess, dynamicRulesRef, 'current');
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Top-level error during rule generation:`, error);
            this.toastr.error("An unexpected error occurred during rule generation. Check console.");
        } finally {
            this.isProcessingAiRules = false; 
        }

        batchToProcess.forEach(processedCandidate => {
            let keyToDelete = null;
            for (const [lemmatizedKey, data] of this.ngramFrequencies.entries()) {
                if (data.original === processedCandidate.candidate) { 
                    keyToDelete = lemmatizedKey;
                    break; 
                }
            }
            if (keyToDelete) {
                this.slopCandidates.delete(keyToDelete);
                if (this.ngramFrequencies.has(keyToDelete)) {
                     this.ngramFrequencies.get(keyToDelete).score = 0; 
                }
            }
        });

        if (newRulesCount > 0) {
            this.toastr.success(`Prose Polisher: AI generated and saved ${newRulesCount} new rule(s) for the batch!`);
            if (regexNavigatorRef) {
                regexNavigatorRef.renderRuleList();
            }
        } else if (batchToProcess.length > 0) {
            this.toastr.info("Prose Polisher: AI rule generation complete for the batch. No new rules were created (or an error occurred).");
        }
        
        this.performIntermediateAnalysis();

        // Save state after AI processing
        this.saveAnalyzerState();

        const remainingCandidateCount = Object.keys(this.analyzedLeaderboardData.merged).length + Object.keys(this.analyzedLeaderboardData.remaining).length;

        if (remainingCandidateCount > 0) {
            this.toastr.info(`Prose Polisher: Approx ${remainingCandidateCount} more unique candidates/patterns remaining. Click "Generate AI Rules" again to process the next batch.`);
        } else if (newRulesCount === 0 && batchToProcess.length > 0) {
             this.toastr.info("Prose Polisher: All identified slop candidates and patterns have been processed or filtered by the AI.");
        } else if (newRulesCount > 0 && remainingCandidateCount === 0) {
             this.toastr.info("Prose Polisher: All identified slop candidates and patterns have been processed.");
        }
    }

    clearFrequencyData() {
        if (!state.isAppReady) { this.toastr.info("SillyTavern is still loading, please wait."); return; }
        this.ngramFrequencies.clear();
        this.slopCandidates.clear();
        this.messageCounterForTrigger = 0;
        this.analyzedLeaderboardData = { merged: {}, remaining: {} };
        this.totalAiMessagesProcessed = 0;
        this.saveAnalyzerState(); // Save the cleared state
        this.toastr.success("Prose Polisher frequency data cleared!");
    }

    /**
     * Save analyzer state to localStorage
     */
    saveAnalyzerState() {
        try {
            const chatId = getCurrentChatId?.() || 'default';
            const storageKey = `prosepolisher_analyzer_${chatId}`;

            // Convert Map to array of entries for JSON serialization
            const ngramArray = Array.from(this.ngramFrequencies.entries());
            const slopArray = Array.from(this.slopCandidates);

            const stateData = {
                ngramFrequencies: ngramArray,
                slopCandidates: slopArray,
                analyzedLeaderboardData: this.analyzedLeaderboardData,
                messageCounterForTrigger: this.messageCounterForTrigger,
                totalAiMessagesProcessed: this.totalAiMessagesProcessed,
                timestamp: Date.now(),
                chatId: chatId
            };

            localStorage.setItem(storageKey, JSON.stringify(stateData));
            console.log(`${LOG_PREFIX} Analyzer state saved (${ngramArray.length} n-grams)`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to save analyzer state:`, error);
        }
    }

    /**
     * Load analyzer state from localStorage
     */
    loadAnalyzerState() {
        try {
            const chatId = getCurrentChatId?.() || 'default';
            const storageKey = `prosepolisher_analyzer_${chatId}`;
            const savedData = localStorage.getItem(storageKey);

            if (savedData) {
                const stateData = JSON.parse(savedData);

                // Restore Map from array of entries
                this.ngramFrequencies = new Map(stateData.ngramFrequencies || []);
                this.slopCandidates = new Set(stateData.slopCandidates || []);
                this.analyzedLeaderboardData = stateData.analyzedLeaderboardData || { merged: {}, remaining: {} };
                this.messageCounterForTrigger = stateData.messageCounterForTrigger || 0;
                this.totalAiMessagesProcessed = stateData.totalAiMessagesProcessed || 0;

                console.log(`${LOG_PREFIX} Loaded analyzer state (${this.ngramFrequencies.size} n-grams)`);
                return true;
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Failed to load analyzer state:`, error);
        }
        return false;
    }

    incrementProcessedMessages() {
         this.totalAiMessagesProcessed++;
         // Auto-save every 5 messages to avoid performance impact
         if (this.totalAiMessagesProcessed % 5 === 0) {
             this.saveAnalyzerState();
         }
    }

    async manualAnalyzeChatHistory() {
        if (!state.isAppReady) {
            this.toastr.info("SillyTavern is still loading, please wait.");
            return;
        }
        if (this.isAnalyzingHistory) {
            this.toastr.warning("Prose Polisher: Chat history analysis is already in progress.");
            return;
        }

        this.isAnalyzingHistory = true;
        this.toastr.info("Prose Polisher: Starting full chat history analysis. This may take a moment...", "Chat Analysis", { timeOut: 5000 });
        console.log(`${LOG_PREFIX} Starting manual chat history analysis.`);

        const context = getContext();
        if (!context || !context.chat) {
            this.toastr.error("Prose Polisher: Could not get chat context for analysis.");
            this.isAnalyzingHistory = false;
            return;
        }
        const chatMessages = context.chat;
        const worker = new Worker('./scripts/extensions/third-party/NemoPresetExt/features/prosepolisher/src/analyzer.worker.js', { type: 'module' });

        // Serialize RegExp objects into strings for the worker, as RegExp objects cannot be cloned.
        const compiledRegexSources = this.compiledRegexes.map(r => r.source);

        worker.postMessage({
            type: 'startAnalysis',
            chatMessages: chatMessages,
            settings: this.settings,
            compiledRegexSources: compiledRegexSources, // Pass serializable sources instead of RegExp objects
        });

        worker.onmessage = (e) => {
            const { type, processed, total, aiAnalyzed, analyzedLeaderboardData, slopCandidates, ngramFrequencies } = e.data;
            if (type === 'progress') {
                this.toastr.info(`Prose Polisher: Analyzing chat history... ${processed}/${total} messages processed.`, "Chat Analysis", { timeOut: 1000 });
                console.log(`${LOG_PREFIX} [Manual Analysis] Processed ${processed}/${total} messages...`);
            } else if (type === 'complete') {
                console.log(`${LOG_PREFIX} Worker complete message received. Data from worker:`, e.data);

                // Fully synchronize the main analyzer's state with the worker's results.
                this.analyzedLeaderboardData = analyzedLeaderboardData;
                this.ngramFrequencies = ngramFrequencies; // Adopt the frequency map from the worker.
                this.slopCandidates = new Set(slopCandidates); // Reconstruct Set from array
                this.isAnalyzingHistory = false;

                // Prime the trigger counter if the analysis found slop, so self-learning can fire on the next message.
                if (slopCandidates && slopCandidates.length > 0) {
                    this.messageCounterForTrigger = this.settings.dynamicTriggerCount;
                    console.log(`${LOG_PREFIX} Manual analysis found slop. Priming trigger counter to ${this.messageCounterForTrigger}.`);
                    this.toastr.info("Prose Polisher: Slop found! Self-learning is armed and will trigger on your next message.", "Chat Analysis Complete");
                } else {
                    this.toastr.success(`Prose Polisher: Chat history analysis complete! Analyzed ${aiAnalyzed} AI messages. No new slop candidates found.`, "Chat Analysis Complete", { timeOut: 7000 });
                }
                
                console.log(`${LOG_PREFIX} Manual chat history analysis complete. Analyzed ${aiAnalyzed} AI messages.`, { analyzedLeaderboardData, slopCandidates });
                worker.terminate(); // Terminate worker after completion
                this.showFrequencyLeaderboard(); // Display results after analysis
            }
        };

        worker.onerror = (error) => {
            console.error(`${LOG_PREFIX} Error during manual chat history analysis in worker:`, error);
            this.toastr.error("Prose Polisher: An error occurred during chat analysis. Check console.", "Chat Analysis Error");
            this.isAnalyzingHistory = false;
            worker.terminate();
        };
    }
}
