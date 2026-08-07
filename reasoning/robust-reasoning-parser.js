/**
 * Conservative fallback reasoning parser for SillyTavern
 *
 * Multi-strategy parser that reliably captures reasoning blocks even when:
 * - Closing tags are missing
 * - Opening tags are incomplete
 * - Content is malformed
 *
 * Supports common structured reasoning formats:
 * - NemoNet (Council of Vex CoT)
 * - Claude (Extended Thinking with <thinking> tags)
 * - DeepSeek R1 (<think>/<answer> format)
 * - OpenAI o1/o3 (reasoning tokens and CoT markers)
 * - Gemini 2.0+ (Thoughts: section format)
 * - Generic CoT formats
 */

export class RobustReasoningParser {
    constructor(config = {}) {
        this.config = {
            // Primary patterns
            prefix: config.prefix || '<think>',
            suffix: config.suffix || '</think>',

            // Fallback patterns - supports all major AI models
            alternativePrefixes: config.alternativePrefixes || [
                '<think',          // DeepSeek R1, partial tags
                '<thought>',       // Generic CoT
                '<thinking>',      // Claude Extended Thinking
                '<reasoning>',     // Generic reasoning tags
                '<reflection>',    // Reflective thinking
                '<analysis>',      // Analysis blocks
                'Thoughts:',       // Gemini 2.0+ format
                'Thinking:',       // Alternative Gemini format
                'Reasoning:',      // OpenAI o1/o3 style markers
                'Chain of Thought:', // Explicit CoT
            ],
            alternativeSuffixes: config.alternativeSuffixes || [
                '</thought>',      // Generic CoT
                '</thinking>',     // Claude Extended Thinking
                '</reasoning>',    // Generic reasoning tags
                '</reflection>',   // Reflective thinking
                '</analysis>',     // Analysis blocks
                '<answer>',        // DeepSeek R1 answer tag signals end of thinking
                '\n\nResponse:',   // Gemini format
                '\n\nAnswer:',     // Common transition marker
            ],

            // Content markers that indicate reasoning - UNIVERSAL support for all AI models
            reasoningMarkers: config.reasoningMarkers || [
                // === NemoNet markers ===
                'NEMONET WORLD EXPLORATION',
                'Council of Vex',
                'NemoAdmin-107',
                'STORY SECTION',
                'Exploration',
                'GATHERING THE THREADS',
                'SCENE CALIBRATION',
                'COUNCIL CONVERSATION',
                'RESOLUTION',
                'CRAFTING',
                'Custom CoT',
                'FINAL REVIEW',
                'END OF THINKING',
                'CLOSING THINKING NOW',

                // === Claude markers ===
                'Let me think through this',
                'Let me analyze',
                'Let me consider',
                'My thinking process:',
                'Step-by-step analysis:',
                'Breaking this down:',
                'Thought process:',

                // === DeepSeek R1 markers ===
                'Let\'s approach this step by step',
                'First, I need to',
                'Let me break this down',
                'To solve this, I should',

                // === OpenAI o1/o3 markers ===
                'Reasoning through this',
                'Chain of thought:',
                'Step 1:',
                'Step 2:',
                'Step 3:',
                'Let\'s think step by step',
                'Breaking down the problem:',

                // === Gemini 2.0 markers ===
                'Identify the question\'s scope',
                'Recognize the different perspectives',
                'Brainstorm key concepts',
                'Structure the answer',
                'Refine and Elaborate',
                'Consider adding nuance',
                'Review and edit',

                // === Generic CoT markers ===
                'Analysis:',
                'Reasoning:',
                'Thought:',
                'Reflection:',
                'Consider:',
                'Therefore,',
                'In other words,',
                'This means that',
                'Let me verify',
                'Double-checking:',

                // === Scientific Method variants ===
                'HYPOTHESIS:',
                'OBSERVATIONS:',
                'DATA ANALYSIS:',
                'CONCLUSION:',
                'EXPERIMENT:',
                'METHOD:',
                'RESULTS:',
                'VERIFICATION:',

                // === Directive/Command variants ===
                '>> ANALYZE',
                '>> RETRIEVE',
                '>> CROSS-CHECK',
                '>> GENERATE',
                '>> VALIDATE',
                '>> OUTPUT',
                '=> ACTION:',
                '=> RESULT:',

                // === Checklist variants ===
                '[✓]',
                '[✗]',
                '[X]',
                '[ ]',
                '☑',
                '☐',
                'NEXT:',
                'TODO:',
                'PENDING:',
                'COMPLETE:',

                // === Conversational/Stream variants ===
                'Okay so',
                'Let me think',
                'Alright,',
                'Hmm,',
                'Wait,',
                'Oh right,',
                'I should',
                'Maybe I can',
                'Need to',

                // === Code/Programming style variants ===
                'def ',
                'function ',
                'if ',
                'else:',
                'return ',
                '// ',
                '/* ',
                'var ',
                'const ',

                // === Hierarchical/Nested variants ===
                '[Analysis Phase]',
                '[Synthesis]',
                '[Planning]',
                '[Execution]',
                '[Review]',
                '## ',
                '### ',
                '#### ',

                // === Structured CoT formats (custom prompts) ===
                'INTERNAL PROCESSING',
                'IMMEDIATE CONTEXT SCAN:',
                'ORGANIC DELIBERATION',
                'QUICK COUNCIL CHECK',
                'ANTI-SLOP VERIFICATION',
                'FINAL PULSE CHECK:',
                'What feels most ALIVE',
                'What would these characters ACTUALLY',
                'Does this feel REAL?',
                'Does this MOVE FORWARD?',
                'Does this honor BOUNDARIES?',
                '!VITAL!',
                'OOC Directives:',
                'Active Scene:',
                'Knowledge Boundaries:',

                // === Lucid Loom v2.8 markers ===
                'Weave Planning Phase',
                'Internal Thinking Protocol',
                'I, Lumia',
                'Anointed Goddess of the Lucid Loom',
                '### Step 1:',
                '### Step 2:',
                '### Step 3:',
                '### Step 4:',
                '### Step 5:',
                '### Step 6:',
                '### Step 7:',
                '### Step 8:',
                '### Step 9:',
                '### Step 10:',
                '### Step 11:',
                'Recall Last Moment',
                'Recall Character',
                'Objective Tracking',
                'Omniscience Checker',
                'Narrative Guidance',
                'Response Planner',
                'Anatomy Limits',
                'Environment Consistency',
                'Utility Inclusions',
                'Narrative Style Adherence',
                'Sanity Checking',
                'thinking blocks separate the threads',
                'I will present the tapestry',
                'denoting my completion of the weave',
                'BunnyMo',
                'Sovereign Hand mode',
            ],

            // Narration markers that indicate reasoning has ended - UNIVERSAL
            narrationMarkers: config.narrationMarkers || [
                // === NemoNet markers ===
                'Narration:',
                'NARRATION FOLLOWS',
                '{{newline}}',

                // === DeepSeek R1 markers ===
                '<answer>',
                '</think>',

                // === Gemini markers ===
                '\n\nResponse:',
                '\n\nThoughts:',  // May appear after initial thoughts

                // === Claude markers ===
                '\n\nHere\'s my response:',
                '\n\nMy answer:',
                '\n\nIn summary:',

                // === Generic markers ===
                '\n\nAnswer:',
                '\n\nSolution:',
                '\n\nConclusion:',
                '\n\nOutput:',
                '\n\nResult:',
                '---\n',  // Horizontal separator
                '!VITAL! Output',  // Custom CoT end marker

                // === Regex patterns for narrative prose ===
                /^[A-Z][a-z]+ (looked|glanced|turned|stepped|walked|said|whispered|smiled|frowned|nodded|shook|moved|ran|jumped|sat|stood)/m,
                /^The (room|air|moment|silence|world|sky|sun|moon|night|day|light|darkness|man|woman|person|child|figure)/m,
                /^"[A-Z]/m,  // Start of dialogue
                /^\*[A-Z]/m,  // Roleplay action format
            ],

            // Strategy weights (higher = more trusted)
            strategyWeights: {
                partialSuffix: 80,
                missingSuffix: 70,
                contentBased: 60,
                ...(config.strategyWeights ?? {}),
            }
        };

        this.debug = config.debug || false;
    }

    /**
     * Main parsing function with cascading strategies
     * Returns: { reasoning: string, content: string, strategy: string, confidence: number }
     */
    parse(text) {
        const strategies = [
            // Explicit formats are deterministic and take priority.
            this.strategyDeepSeekR1.bind(this),
            this.strategyVariedClosingTags.bind(this),
            this.strategyGeminiThoughts.bind(this),
            this.strategyPartialSuffix.bind(this),

            // Repaired and tagless formats must provide structural boundaries.
            this.strategyContentMarkers.bind(this),
            this.strategyMissingSuffix.bind(this),
            this.strategyNemoNetCouncil.bind(this),
        ];

        for (const strategy of strategies) {
            const result = strategy(text);
            if (result && result.reasoning) {
                // CRITICAL VALIDATION: Message content must not be empty
                // AI always produces both reasoning AND narrative, so if content is empty,
                // this strategy extracted incorrectly and we should try the next one
                const contentWithoutWhitespace = result.content.trim();
                if (!contentWithoutWhitespace) {
                    if (this.debug) {
                        console.warn(`RobustReasoningParser: Strategy ${result.strategy} left content empty, trying next strategy`);
                    }
                    continue; // Skip this strategy, try the next one
                }

                // Normalize accidental wrapper residue without guessing at content boundaries
                const cleanedReasoning = this.cleanReasoning(result.reasoning);

                if (this.debug) {
                    console.log('RobustReasoningParser: Success with', result.strategy,
                                'Confidence:', result.confidence);
                    if (cleanedReasoning !== result.reasoning) {
                        console.log(`RobustReasoningParser: Cleaned reasoning (removed ${result.reasoning.length - cleanedReasoning.length} chars)`);
                    }
                }

                return {
                    reasoning: cleanedReasoning,
                    content: result.content,
                    strategy: result.strategy,
                    confidence: result.confidence
                };
            }
        }

        // No reasoning found
        return {
            reasoning: '',
            content: text,
            strategy: 'none',
            confidence: 0
        };
    }

    /**
     * PRIORITY STRATEGY 0: NemoNet Council of Vex Format
     * Detects the custom NemoNet reasoning format that uses structured sections:
     * - NemoNet: Context Scan
     * - Character Knowledge: [Character]
     * - Council Meets:
     * - Scene Energy:
     * - Grounding Characters:
     * - Invented Tool:
     * - Freshness Check:
     * - Final Gut Check:
     * This format doesn't use tags, so we detect it by structural markers
     */
    strategyNemoNetCouncil(text) {
        // Look for NemoNet-specific markers (flexible pattern matching)
        const hasNemoNetHeader = /\*\*NemoNet[\s:]*(?:Context Scan|World Exploration|Council|Reasoning)[\s:]*\*\*/i.test(text);
        const hasCouncilMeets = /\*\*(?:The )?Council Meets?[\s:]*\*\*/i.test(text);
        const hasCharacterKnowledge = /\*\*Character Knowledge[\s:]*\*\*/i.test(text);
        const hasSceneEnergy = /\*\*Scene Energy[\s:]*\*\*/i.test(text);
        const hasOrganicThinking = /\*\*Organic Thinking[\s:]*\*\*/i.test(text);
        const hasFinalGutCheck = /\*\*Final (?:Gut )?Check[\s:]*\*\*/i.test(text);

        // Need at least the header and one other key section
        if (!hasNemoNetHeader) return null;

        // Count how many NemoNet-specific markers we have
        let markerCount = 0;
        if (hasCouncilMeets) markerCount++;
        if (hasCharacterKnowledge) markerCount++;
        if (hasSceneEnergy) markerCount++;
        if (hasOrganicThinking) markerCount++;
        if (hasFinalGutCheck) markerCount++;

        // Need at least 2 markers to confidently identify NemoNet format
        if (markerCount < 2) return null;

        // Find where the reasoning ends - look for narrative prose start
        // NemoNet format typically ends with "Final Gut Check:" followed by conclusion,
        // then the narrative starts (usually with sensory description or scene-setting)

        // Find where reasoning ends - look for the last NemoNet section before narrative starts
        let reasoningEnd = -1;

        // Strategy 1: Find all ** bold section headers and their positions
        const allSections = [...text.matchAll(/\*\*([^*]+)\*\*/g)];

        // Common NemoNet section names
        const nemonetSections = [
            'NemoNet Context Scan',
            'NemoNet',
            'Character Knowledge',
            'Keep Them Grounded',
            'Scene Energy',
            'The Council Meets',
            'Council Meets',
            'Organic Thinking',
            'Custom Settings',
            'HTML Planning',
            'Cutaway Planning',
            'Freshness Check',
            'Final Gut Check',
            'Final Check'
        ];

        // Find the last NemoNet section
        let lastNemoNetSection = null;
        for (let i = allSections.length - 1; i >= 0; i--) {
            const sectionName = allSections[i][1].trim();
            const isNemoNetSection = nemonetSections.some(ns =>
                sectionName.toLowerCase().includes(ns.toLowerCase())
            );

            if (isNemoNetSection) {
                lastNemoNetSection = allSections[i];
                break;
            }
        }

        // Strategy 2: After finding last section, look for the end of its content
        if (lastNemoNetSection) {
            const sectionStart = lastNemoNetSection.index + lastNemoNetSection[0].length;
            const afterSection = text.substring(sectionStart);

            // Look for where narrative starts - typically after section content ends
            // Pattern: section content, then blank line(s), then narrative paragraph
            const narrativeStartMatch = afterSection.match(/\n\s*\n\s*([A-Z])/);

            if (narrativeStartMatch) {
                reasoningEnd = sectionStart + narrativeStartMatch.index;
            }
        }

        // Strategy 3: If still no end found, look for common narrative starters
        if (reasoningEnd === -1) {
            const narrativeStartPatterns = [
                /\n\n(?:A |The |Rain |Wind |Silence |Light |Darkness |[A-Z][a-z]+\s+(?:stood|walked|looked|turned|moved|sat|ran))/,
                /\n\n<(?:p|div)>(?:A |The |Rain |Wind )/i,
            ];

            for (const pattern of narrativeStartPatterns) {
                const match = text.match(pattern);
                if (match) {
                    reasoningEnd = match.index;
                    break;
                }
            }
        }

        if (reasoningEnd === -1) {
            // No clear end found - this might not be the right format
            return null;
        }

        const reasoning = text.substring(0, reasoningEnd).trim();
        const content = text.substring(reasoningEnd).trim();


        if (this.debug) {
            console.log('RobustReasoningParser: ✅ NEMONET COUNCIL FORMAT DETECTED');
            console.log(`  Reasoning ends at position ${reasoningEnd}`);
            console.log(`  Reasoning length: ${reasoning.length} chars`);
            console.log(`  Content length: ${content.length} chars`);
        }

        return {
            reasoning,
            content,
            strategy: 'nemonet-council',
            confidence: 99 // Very high confidence - this is a very specific format
        };
    }

    /**
     * PRIORITY STRATEGY 2: Varied Closing Tags
     * Systematically checks ALL closing tag variants before moving to complex strategies
     * Supports: </think>, </thought>, </cot>, </thinking>, </reasoning>, etc.
     */
    strategyVariedClosingTags(text) {
        // Look for any opening tag (from all variants)
        const allPrefixes = [this.config.prefix, ...this.config.alternativePrefixes];
        const lowerText = text.toLowerCase();
        let prefixMatch = null;
        let prefixIndex = -1;

        for (const prefix of allPrefixes) {
            const idx = lowerText.indexOf(prefix.toLowerCase());
            if (idx !== -1 && (prefixIndex === -1 || idx < prefixIndex || (idx === prefixIndex && prefix.length > (prefixMatch?.length ?? 0)))) {
                prefixIndex = idx;
                prefixMatch = prefix;
            }
        }

        if (prefixIndex === -1) return null;

        // Now systematically check for ALL possible closing tags
        const allSuffixes = [
            this.config.suffix,
            ...this.config.alternativeSuffixes,
            // Additional common variants
            '</cot>',
            '</CoT>',
            '</chain-of-thought>',
            '</internal>',
            '</scratchpad>',
            '</planning>',
            '</meta>',
        ];

        let closestSuffixIndex = -1;
        let closestSuffix = null;

        for (const suffix of allSuffixes) {
            const idx = lowerText.indexOf(suffix.toLowerCase(), prefixIndex + prefixMatch.length);
            if (idx !== -1 && (closestSuffixIndex === -1 || idx < closestSuffixIndex || (idx === closestSuffixIndex && suffix.length > (closestSuffix?.length ?? 0)))) {
                closestSuffixIndex = idx;
                closestSuffix = suffix;
            }
        }

        if (closestSuffixIndex !== -1) {
            // Found a closing tag!
            const reasoning = text.substring(prefixIndex + prefixMatch.length, closestSuffixIndex).trim();
            const beforeReasoning = text.substring(0, prefixIndex);
            const afterReasoning = text.substring(closestSuffixIndex + closestSuffix.length);
            const content = (beforeReasoning + afterReasoning).trim();

            if (this.debug) {
                console.log('RobustReasoningParser: ✅ CLOSING TAG FOUND');
                console.log(`  Opening: ${prefixMatch}`);
                console.log(`  Closing: ${closestSuffix}`);
            }

            return {
                reasoning,
                content,
                strategy: 'varied-closing-tags',
                confidence: 95 // High confidence - we have both tags
            };
        }

        return null;
    }

    /**
     * Strategy 0a: Gemini "Thoughts:" Format
     * Detects Gemini 2.0+ thinking mode output with "Thoughts:" section
     */
    strategyGeminiThoughts(text) {
        // Look for "Thoughts:" followed by content, then "Response:" or similar
        const thoughtsPattern = /^Thoughts?:[ \t]*\r?\n([\s\S]*?)(?:\r?\n[ \t]*\r?\n(?:Response|Answer|Output|Result):|$)/i;
        const match = text.match(thoughtsPattern);

        if (match) {
            const reasoning = match[1].trim();
            const content = text.replace(match[0], '').trim();

            return {
                reasoning,
                content,
                strategy: 'gemini-thoughts',
                confidence: 95
            };
        }

        // Alternative: "Thinking:" header
        const thinkingPattern = /^Thinking:[ \t]*\r?\n([\s\S]*?)(?:\r?\n[ \t]*\r?\n(?:Response|Answer|Output|Result):|$)/i;
        const thinkingMatch = text.match(thinkingPattern);

        if (thinkingMatch) {
            const reasoning = thinkingMatch[1].trim();
            const content = text.replace(thinkingMatch[0], '').trim();

            return {
                reasoning,
                content,
                strategy: 'gemini-thinking',
                confidence: 95
            };
        }

        return null;
    }

    /**
     * Strategy 0b: DeepSeek R1 Format
     * Detects <think>...</think> followed by <answer>...</answer>
     */
    strategyDeepSeekR1(text) {
        // Look for <think> and <answer> tags
        const deepseekPattern = /<think>([\s\S]*?)<\/think>\s*<answer>([\s\S]*?)<\/answer>/i;
        const match = text.match(deepseekPattern);

        if (match) {
            const reasoning = match[1].trim();
            const answer = match[2].trim();

            // Content is everything before <think> + the answer + everything after </answer>
            const beforeThink = text.substring(0, match.index);
            const afterAnswer = text.substring(match.index + match[0].length);
            const content = (beforeThink + answer + afterAnswer).trim();

            return {
                reasoning,
                content,
                strategy: 'deepseek-r1',
                confidence: 98
            };
        }

        // Alternative: Only <think> tag present, <answer> tag signals end
        const thinkAnswerPattern = /<think>([\s\S]*?)<answer>([\s\S]*?)(?:<\/answer>|$)/i;
        const partialMatch = text.match(thinkAnswerPattern);

        if (partialMatch) {
            const reasoning = partialMatch[1].trim();
            const answer = partialMatch[2].trim();

            const beforeThink = text.substring(0, partialMatch.index);
            const afterAnswer = text.substring(partialMatch.index + partialMatch[0].length);
            const content = (beforeThink + answer + afterAnswer).trim();

            return {
                reasoning,
                content,
                strategy: 'deepseek-r1-partial',
                confidence: 90
            };
        }

        return null;
    }

    /**
     * Strategy: Partial Suffix (has prefix, suffix is incomplete)
     */
    strategyPartialSuffix(text) {
        const { prefix, suffix } = this.config;

        const lowerText = text.toLowerCase();
        const prefixIndex = lowerText.indexOf(prefix.toLowerCase());
        if (prefixIndex === -1) return null;

        // Look for partial suffix (e.g., "</thin" instead of "</think>")
        const partialSuffixes = this.generatePartialSuffixes(suffix);

        for (const partial of partialSuffixes) {
            const partialIndex = lowerText.indexOf(partial.toLowerCase(), prefixIndex + prefix.length);
            if (partialIndex !== -1) {
                const reasoning = text.substring(
                    prefixIndex + prefix.length,
                    partialIndex
                ).trim();

                const afterPartial = partialIndex + partial.length;
                const nextCharacter = text[afterPartial];
                const hasSafeBoundary = nextCharacter === undefined
                    || nextCharacter === '>'
                    || /[\s\p{Lu}"'*<]/u.test(nextCharacter);
                if (!hasSafeBoundary) continue;

                const suffixEnd = nextCharacter === '>' ? afterPartial + 1 : afterPartial;
                const content = (
                    text.substring(0, prefixIndex) +
                    text.substring(suffixEnd)
                ).trim();

                return {
                    reasoning,
                    content,
                    strategy: 'partialSuffix',
                    confidence: this.config.strategyWeights.partialSuffix
                };
            }
        }

        return null;
    }

    /**
     * Strategy 3: Missing Suffix (has prefix but no suffix)
     * Uses content markers and narration markers to find the end
     */
    strategyMissingSuffix(text) {
        const { prefix } = this.config;

        const prefixIndex = text.indexOf(prefix);
        if (prefixIndex === -1) return null;

        let endIndex = -1;

        // Method 1: Look for narration markers
        const textAfterPrefix = text.substring(prefixIndex + prefix.length);
        for (const marker of this.config.narrationMarkers) {
            const markerIndex = textAfterPrefix.indexOf(marker);
            if (markerIndex !== -1) {
                endIndex = prefixIndex + prefix.length + markerIndex;
                break;
            }
        }

        // Method 2: Look for "END OF THINKING" or similar
        if (endIndex === -1) {
            const endThinkingRegex = /END OF THINKING.*?(?:\n|$)/i;
            const endMatch = textAfterPrefix.match(endThinkingRegex);
            if (endMatch) {
                endIndex = prefixIndex + prefix.length + endMatch.index + endMatch[0].length;
            }
        }

        // Method 3: Look for double newline followed by non-reasoning content
        if (endIndex === -1) {
            const doubleNewlineRegex = /\n\n+(?![A-Z_\s]*:|\*|♢|◆|═)/;
            const doubleNewlineMatch = textAfterPrefix.match(doubleNewlineRegex);
            if (doubleNewlineMatch) {
                endIndex = prefixIndex + prefix.length + doubleNewlineMatch.index;
            }
        }

        // Method 4: Use the entire remaining text
        if (endIndex === -1) {
            endIndex = text.length;
        }

        const reasoning = text.substring(prefixIndex + prefix.length, endIndex).trim();
        const content = (text.substring(0, prefixIndex) + text.substring(endIndex)).trim();

        return {
            reasoning,
            content,
            strategy: 'missingSuffix',
            confidence: this.config.strategyWeights.missingSuffix
        };
    }

    /**
     * Strategy 4: Content-Based Detection
     * Identifies reasoning by looking for specific content markers
     * Enhanced to detect structural patterns in variant CoT formats
     */
    strategyContentMarkers(text) {
        // Check if text contains multiple reasoning markers
        let markerCount = 0;
        let firstMarkerIndex = -1;
        const foundMarkers = [];

        for (const marker of this.config.reasoningMarkers) {
            if (text.includes(marker)) {
                markerCount++;
                foundMarkers.push(marker);
                const index = text.indexOf(marker);
                if (firstMarkerIndex === -1 || index < firstMarkerIndex) {
                    firstMarkerIndex = index;
                }
            }
        }

        // Boost confidence if we detect specific structural patterns
        let structuralBoost = 0;

        // Pattern 1: Numbered or bullet lists (checklist/step variants)
        const listPattern = /^[\s]*[-•●○▪▫◦⦿⦾*]\s+/gm;
        const checkboxPattern = /\[(✓|✗|X| )\]/g;
        const listMatches = text.match(listPattern);
        const checkboxMatches = text.match(checkboxPattern);

        if (listMatches && listMatches.length >= 3) {
            structuralBoost += 1;
            markerCount += 2; // Lists are strong reasoning indicators
        }
        if (checkboxMatches && checkboxMatches.length >= 2) {
            structuralBoost += 1;
            markerCount += 2; // Checklists are very strong indicators
        }

        // Pattern 2: Directive markers (command/scientific variants)
        const directivePattern = /(>>|=>|#|\/\/)\s*[A-Z]+/g;
        const directiveMatches = text.match(directivePattern);
        if (directiveMatches && directiveMatches.length >= 2) {
            structuralBoost += 1;
            markerCount += 1;
        }

        // Pattern 3: Question-driven analysis
        const questionPattern = /^[\s]*(?:What|How|Why|When|Where|Who|Should|Can|Will|Does)[^?]+\?[\s]*$/gm;
        const questionMatches = text.match(questionPattern);
        if (questionMatches && questionMatches.length >= 2) {
            structuralBoost += 1;
            markerCount += 1;
        }

        // Pattern 4: Hierarchical headers (markdown-style)
        const headerPattern = /^[\s]*#{1,4}\s+[A-Z]/gm;
        const headerMatches = text.match(headerPattern);
        if (headerMatches && headerMatches.length >= 2) {
            structuralBoost += 1;
            markerCount += 1;
        }

        // Pattern 5: Code-style reasoning (if/else, function definitions)
        const codePattern = /\b(def|function|if|else|return|var|const|let)\s/g;
        const codeMatches = text.match(codePattern);
        if (codeMatches && codeMatches.length >= 3) {
            structuralBoost += 1;
            markerCount += 2; // Code-style is distinctive
        }

        if (this.debug && structuralBoost > 0) {
            console.log(`RobustReasoningParser: Structural patterns detected (+${structuralBoost} boost)`);
            console.log(`  Lists: ${listMatches?.length || 0}, Checkboxes: ${checkboxMatches?.length || 0}`);
            console.log(`  Directives: ${directiveMatches?.length || 0}, Questions: ${questionMatches?.length || 0}`);
            console.log(`  Headers: ${headerMatches?.length || 0}, Code: ${codeMatches?.length || 0}`);
        }

        // Need at least 3 markers to be confident this is reasoning
        // (or 2 markers + structural boost)
        if (markerCount < 3 && (markerCount < 2 || structuralBoost === 0)) return null;

        // Find the end using narration markers
        let endIndex = -1;
        for (const marker of this.config.narrationMarkers) {
            const markerIndex = text.indexOf(marker);
            if (markerIndex !== -1 && markerIndex > firstMarkerIndex) {
                endIndex = markerIndex;
                break;
            }
        }

        // Calculate confidence boost from structural patterns
        const confidenceBoost = Math.min(structuralBoost * 5, 15); // Max +15 boost
        const baseConfidence = this.config.strategyWeights.contentBased;

        if (endIndex === -1) {
            // Fallback: use the entire text as reasoning
            return {
                reasoning: text.trim(),
                content: '',
                strategy: 'contentMarkers-full',
                confidence: baseConfidence - 10 + confidenceBoost
            };
        }

        const reasoning = text.substring(firstMarkerIndex, endIndex).trim();
        const content = (text.substring(0, firstMarkerIndex) + text.substring(endIndex)).trim();

        return {
            reasoning,
            content,
            strategy: 'contentMarkers',
            confidence: baseConfidence + confidenceBoost,
            structuralBoost // For debugging
        };
    }

    /**
     * Return only distinctive malformed closing-tag prefixes. Very short
     * fragments such as "</" would collide with ordinary HTML in reasoning.
     */
    generatePartialSuffixes(suffix) {
        const partials = [];
        const minimumLength = Math.max(5, Math.ceil(suffix.length * 0.6));
        for (let i = minimumLength; i < suffix.length; i++) {
            partials.push(suffix.substring(0, i));
        }
        return partials.reverse();
    }
    /**
     * Clean reasoning text - removes any narration/output that leaked into reasoning
     * This is a post-processing step after initial extraction
     */
    cleanReasoning(reasoning) {
        if (typeof reasoning !== 'string') return reasoning;

        // Extraction strategies own the content boundary. Cleanup may remove only
        // accidental outer wrappers; guessing at prose or HTML would lose data.
        return reasoning
            .replace(/^\s*<(?:think(?:ing)?|thought|reasoning|reflection|analysis)>\s*/i, '')
            .replace(/\s*<\/(?:think(?:ing)?|thought|reasoning|reflection|analysis)>\s*$/i, '')
            .trim();
    }
}
