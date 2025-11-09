/**
 * NemoNet-specific Reasoning Configuration
 *
 * Custom configuration for the robust reasoning parser
 * tailored to NemoNet's Council of Vex CoT format
 */

import { RobustReasoningParser } from './robust-reasoning-parser.js';
import { getContext } from '../../../../extensions.js';
import { updateReasoningUI } from '../../../../reasoning.js';

// These will be imported from script.js
let eventSource, messageFormatting, addCopyToCodeBlocks;

export const NemoNetReasoningConfig = {
    // Primary tags
    prefix: '<think>',
    suffix: '</think>',

    // Alternative tags the model might use
    alternativePrefixes: [
        '<think',
        '<thinking>',
        '<thought>',
        '<Begin Council of Vex Thought Process>',
        'STORY SECTION 1:' // Sometimes model might skip the tag
    ],

    alternativeSuffixes: [
        '</think',
        '</thinking>',
        '</thought>',
        'NARRATION FOLLOWS',
        '{{newline}}'
    ],

    // NemoNet-specific markers that indicate reasoning content
    reasoningMarkers: [
        // Core structure
        'NEMONET WORLD EXPLORATION',
        'Council of Vex',
        'NemoAdmin-107',
        'Begin Council of Vex Thought Process',

        // Story sections
        'STORY SECTION 1:',
        'STORY SECTION 2:',
        'STORY SECTION 3:',
        'STORY SECTION 4:',
        'STORY SECTION 5:',
        'STORY SECTION 6:',
        'STORY SECTION 7:',

        // Section names
        'NEMO NET AWAKENING',
        'GATHERING THE THREADS',
        'SCENE CALIBRATION',
        'COUNCIL CONVERSATION',
        'RESOLUTION',
        'CRAFTING',
        'Custom CoT',
        'Organic thinking',

        // Exploration steps
        'Exploration 1:',
        'Exploration 2:',
        'Exploration 3:',
        'Exploration 4:',
        'Exploration 5:',
        'Exploration 6:',
        'Exploration 7:',
        'Exploration 8:',
        'Discoveries:',

        // Council personas
        '_Specialist:',
        'Plot_Vex:',
        'Romantic_Vex:',
        'Action_Vex:',
        'Mystery_Vex:',
        'Comedy_Vex:',
        'Danger_Vex:',

        // Special sections
        'SCENE TYPE AND RATIO:',
        'CHARACTER CAPABILITIES:',
        'CHARACTER VOICE:',
        'FRESHNESS:',
        'FINAL REVIEW:',
        'VITAL:',

        // XML-like tags
        '<knowledge_awareness>',
        '<voice_crafting>',
        '<repetition_ban>',
        '<custom_steps>',

        // Decorative borders
        '═══════════════════════════════════════════════════════════════',
        '════════════════════════════',

        // End markers
        'END OF THINKING',
        'CLOSING THINKING NOW',
        'END OF THINKING - CLOSING THINKING NOW',
    ],

    // Markers that indicate reasoning has ended and narration begins
    narrationMarkers: [
        'Narration:',
        'NARRATION FOLLOWS',
        '{{newline}}',
        '</think>{{newline}}',

        // Sometimes the model outputs the separator
        '═══════════════════════════════════════════════════════════════\nEND OF THINKING',

        // Common narrative starters after thinking
        /^[A-Z][a-z]+ (looked|glanced|turned|stepped|walked|said|whispered|smiled|frowned)/m,
        /^The (room|air|moment|silence)/m,
    ],

    // Strategy weights (adjust based on testing)
    strategyWeights: {
        perfectMatch: 100,
        partialSuffix: 90,  // Higher for NemoNet since it often forgets closing tag
        missingSuffix: 85,  // Higher confidence for missing suffix
        contentBased: 75,   // NemoNet has very distinct markers
        heuristic: 60
    },

    // Enable debug logging
    debug: false
};

/**
 * Specialized parser for NemoNet CoT
 */
export class NemoNetReasoningParser extends RobustReasoningParser {
    constructor(config = {}) {
        super({ ...NemoNetReasoningConfig, ...config });
    }

    /**
     * Override: Enhanced missing suffix detection for NemoNet
     */
    strategyMissingSuffix(text) {
        const { prefix } = this.config;

        const prefixIndex = text.indexOf(prefix);
        if (prefixIndex === -1) return null;

        let endIndex = -1;
        const textAfterPrefix = text.substring(prefixIndex + prefix.length);

        // Priority 1: Look for explicit end markers
        const endMarkers = [
            'END OF THINKING - CLOSING THINKING NOW - NARRATION FOLLOWS',
            'END OF THINKING',
            'CLOSING THINKING NOW',
        ];

        for (const marker of endMarkers) {
            const markerIndex = textAfterPrefix.indexOf(marker);
            if (markerIndex !== -1) {
                // Include the marker in the reasoning, then skip past the decorative line
                const fullMarkerMatch = textAfterPrefix.substring(markerIndex).match(
                    new RegExp(this.escapeRegex(marker) + '\\s*\\n═+\\s*\\n')
                );

                if (fullMarkerMatch) {
                    endIndex = prefixIndex + prefix.length + markerIndex + fullMarkerMatch[0].length;
                } else {
                    endIndex = prefixIndex + prefix.length + markerIndex + marker.length;
                }
                break;
            }
        }

        // Priority 2: Look for {{newline}} marker
        if (endIndex === -1) {
            const newlineMarkerIndex = textAfterPrefix.indexOf('{{newline}}');
            if (newlineMarkerIndex !== -1) {
                endIndex = prefixIndex + prefix.length + newlineMarkerIndex + '{{newline}}'.length;
            }
        }

        // Priority 3: Look for "Narration:" followed by actual narrative content
        if (endIndex === -1) {
            const narrationMatch = textAfterPrefix.match(/Narration:\s*\[.*?\]\s*\n/);
            if (narrationMatch) {
                endIndex = prefixIndex + prefix.length + narrationMatch.index + narrationMatch[0].length;
            }
        }

        // Priority 4: Detect transition from structured CoT to prose
        if (endIndex === -1) {
            const lines = textAfterPrefix.split('\n');

            for (let i = 0; i < lines.length - 2; i++) {
                const currentLine = lines[i].trim();
                const nextLine = lines[i + 1].trim();
                const lineAfterNext = lines[i + 2].trim();

                // Look for pattern: [structured content] -> [empty/border] -> [prose]
                if (this.isNemoNetStructuredLine(currentLine)) {
                    if (this.isNemoNetBorderLine(nextLine) || nextLine === '') {
                        if (this.isNarrativeLine(lineAfterNext)) {
                            // Found transition
                            const positionInText = textAfterPrefix.split('\n').slice(0, i + 1).join('\n').length;
                            endIndex = prefixIndex + prefix.length + positionInText;
                            break;
                        }
                    }
                }
            }
        }

        // Priority 5: Use entire text if no clear end found
        if (endIndex === -1) {
            // But try to exclude obvious narrative at the very end
            const lastParagraphMatch = textAfterPrefix.match(/\n\n([A-Z][^.!?]*[.!?](\s+[A-Z][^.!?]*[.!?])+)$/);
            if (lastParagraphMatch) {
                endIndex = prefixIndex + prefix.length + lastParagraphMatch.index;
            } else {
                endIndex = text.length;
            }
        }

        const reasoning = text.substring(prefixIndex + prefix.length, endIndex).trim();
        const content = (text.substring(0, prefixIndex) + text.substring(endIndex)).trim();

        return {
            reasoning,
            content,
            strategy: 'missingSuffix-nemonet',
            confidence: this.config.strategyWeights.missingSuffix
        };
    }

    /**
     * Check if a line is NemoNet structured content
     */
    isNemoNetStructuredLine(line) {
        const patterns = [
            /^(Exploration|STORY SECTION|Discovery|VITAL|Priority|◆|♢)/,
            /^[A-Z_\s]+:/,  // Section headers
            /^\d+\./,  // Numbered items
            /^-\s+/,  // Bullet points
            /_Vex:/,  // Vex personas
            /^<[a-z_]+>/,  // XML-like tags
        ];

        return patterns.some(p => p.test(line));
    }

    /**
     * Check if a line is a NemoNet border/decoration
     */
    isNemoNetBorderLine(line) {
        return /^[═─]+$/.test(line) || /^[║╔╗╚╝]+/.test(line);
    }

    /**
     * Override: Enhanced content marker detection
     */
    strategyContentMarkers(text) {
        // Count NemoNet-specific markers
        let markerCount = 0;
        let firstMarkerIndex = -1;
        let storySectionCount = 0;

        for (const marker of this.config.reasoningMarkers) {
            const index = typeof marker === 'string' ? text.indexOf(marker) : -1;

            if (index !== -1) {
                markerCount++;

                if (marker.includes('STORY SECTION')) {
                    storySectionCount++;
                }

                if (firstMarkerIndex === -1 || index < firstMarkerIndex) {
                    firstMarkerIndex = index;
                }
            } else if (marker instanceof RegExp && marker.test(text)) {
                markerCount++;
            }
        }

        // NemoNet typically has 7 story sections
        const hasCompleteCoT = storySectionCount >= 4;

        // Need at least 5 markers OR 3+ story sections
        if (markerCount < 5 && !hasCompleteCoT) return null;

        // Find the end
        let endIndex = -1;

        // Look for end markers
        for (const marker of this.config.narrationMarkers) {
            if (typeof marker === 'string') {
                const markerIndex = text.indexOf(marker);
                if (markerIndex !== -1 && markerIndex > firstMarkerIndex) {
                    endIndex = markerIndex;
                    break;
                }
            } else if (marker instanceof RegExp) {
                const match = text.substring(firstMarkerIndex).match(marker);
                if (match) {
                    endIndex = firstMarkerIndex + match.index;
                    break;
                }
            }
        }

        if (endIndex === -1) {
            endIndex = text.length;
        }

        const reasoning = text.substring(firstMarkerIndex, endIndex).trim();
        const content = (text.substring(0, firstMarkerIndex) + text.substring(endIndex)).trim();

        const confidence = hasCompleteCoT
            ? this.config.strategyWeights.contentBased + 10
            : this.config.strategyWeights.contentBased;

        return {
            reasoning,
            content,
            strategy: 'contentMarkers-nemonet',
            confidence
        };
    }
}

/**
 * Apply NemoNet reasoning parser as a post-processing hook
 */
export function applyNemoNetReasoning() {
    const parser = new NemoNetReasoningParser();

    // Store parser globally for access
    window.nemoNetReasoningParser = parser;

    // Expose manual trigger for testing
    window.nemoNetProcessLastMessage = function() {
        const chat = getContext().chat;
        console.log('Debug: chat variable:', typeof chat, 'length:', chat?.length);
        const lastMessageId = chat?.length - 1;
        if (lastMessageId >= 0) {
            console.log('Manually processing last message:', lastMessageId);
            processMessageReasoning(lastMessageId, parser);
        } else {
            console.log('No messages in chat (chat length:', chat?.length, ')');
        }
    };

    // Hook into message events to process reasoning
    if (typeof window !== 'undefined') {
        // Import eventSource and chat from the main script
        import('/script.js').then(scriptModule => {
            // Assign to module-level variables
            eventSource = scriptModule.eventSource;
            messageFormatting = scriptModule.messageFormatting;
            addCopyToCodeBlocks = scriptModule.addCopyToCodeBlocks;

            if (!eventSource) {
                console.error('NemoNet: Failed to import eventSource from script.js');
                return;
            }

            console.log('NemoNet: eventSource imported, registering hooks...');
            console.log('NemoNet: chat length:', getContext().chat?.length);
            console.log('NemoNet: eventSource type:', typeof eventSource, 'has .on?', typeof eventSource?.on);

            // Hook MESSAGE_RECEIVED - process BEFORE rendering
            const messageReceivedHandler = (messageId, type) => {
                console.log('NemoNet: 📨 MESSAGE_RECEIVED event fired for message', messageId, 'type:', type);
                // Process immediately BEFORE SillyTavern renders (no delay)
                const chat = getContext().chat;
                const message = chat?.[messageId];

                if (message && message.mes && message.mes.includes('<think>')) {
                    console.log('NemoNet: Pre-processing message BEFORE render');
                    const result = parser.parse(message.mes);

                    if (result.confidence >= 65 && result.reasoning.length > 50) {
                        // Update data IMMEDIATELY before render
                        message.mes = result.content;
                        if (!message.extra) message.extra = {};
                        message.extra.reasoning = result.reasoning;
                        message.extra.reasoning_type = 'parsed';
                        console.log('NemoNet: ✅ Pre-render data update complete');
                    }
                }
            };

            eventSource.on('MESSAGE_RECEIVED', messageReceivedHandler);
            console.log('NemoNet: Registered MESSAGE_RECEIVED handler');

            // Hook GENERATION_ENDED for streaming responses
            eventSource.on('GENERATION_ENDED', () => {
                console.log('NemoNet: ⏹️ GENERATION_ENDED event fired');
                setTimeout(() => {
                    const chat = getContext().chat;
                    const lastMessageId = chat?.length - 1;
                    console.log('NemoNet: GENERATION_ENDED - Processing last message:', lastMessageId);
                    if (lastMessageId >= 0) {
                        forceProcessMessage(lastMessageId, parser);
                    }
                }, 500);
            });

            // Hook character_message_rendered - this fires AFTER ST finishes rendering
            eventSource.on('character_message_rendered', (messageId) => {
                console.log('NemoNet: 📝 character_message_rendered fired for message', messageId);
                setTimeout(() => {
                    forceProcessMessage(messageId, parser);
                }, 100);
            });

            console.log('NemoNet Reasoning Parser: ✅ Active (works independently of prefix/suffix settings)');
            console.log('NemoNet Reasoning Parser: ✅ Post-processing hooks registered');
            console.log('NemoNet: Registered events:', ['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_RECEIVED', 'GENERATION_ENDED']);

            // BACKUP: Also use MutationObserver to catch new messages
            setupMessageObserver(parser);

            // NEW: Reprocess latest message on page load
            setTimeout(() => {
                reprocessLatestMessage(parser);
            }, 2000); // Wait 2 seconds for page to fully load
        }).catch(err => {
            console.error('NemoNet: Error importing eventSource:', err);
            // Even if import fails, setup observer
            setupMessageObserver(parser);
        });
    }
}

/**
 * Setup MutationObserver to watch for new messages
 */
function setupMessageObserver(parser) {
    console.log('NemoNet: Setting up MutationObserver for message detection...');

    let lastProcessedMessageId = -1;

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // Check for new message elements
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1 && node.classList?.contains('mes')) {
                    const mesId = node.getAttribute('mesid');
                    const numericMesId = parseInt(mesId);

                    // Only process if it's a new message we haven't seen
                    if (mesId !== null && numericMesId > lastProcessedMessageId) {
                        lastProcessedMessageId = numericMesId;
                        console.log('NemoNet: 🔍 New message detected via observer:', mesId);

                        // CRITICAL FIX: Process data IMMEDIATELY before DOM is fully rendered
                        // Don't wait - update the message data right now
                        const chat = getContext().chat;
                        const message = chat?.[numericMesId];

                        if (message && message.mes && message.mes.includes('<think>')) {
                            console.log('NemoNet: ⚡ IMMEDIATE pre-render processing');
                            const result = parser.parse(message.mes);

                            if (result.confidence >= 65 && result.reasoning.length > 50) {
                                // Store the parsed data for later use
                                window._nemoNetParsedData = window._nemoNetParsedData || {};
                                window._nemoNetParsedData[numericMesId] = {
                                    reasoning: result.reasoning,
                                    content: result.content
                                };

                                // Update message data NOW
                                message.mes = result.content;
                                if (!message.extra) message.extra = {};
                                message.extra.reasoning = result.reasoning;
                                message.extra.reasoning_type = 'parsed';
                                console.log('NemoNet: ⚡ Pre-render update complete, forcing re-render...');

                                // Save immediately
                                getContext().saveChat();

                                // CRITICAL: Force the DOM element to re-render with new data
                                // Wait just a tiny bit for the initial render to complete
                                setTimeout(() => {
                                    const mesText = node.querySelector('.mes_text');
                                    if (mesText) {
                                        console.log('NemoNet: 🔄 Forcing message re-render');
                                        // Clear and re-render
                                        const context = getContext();
                                        if (typeof messageFormatting === 'function') {
                                            mesText.innerHTML = messageFormatting(
                                                message.mes,
                                                context.name2,
                                                message.isSystem || false,
                                                message.isUser || false,
                                                numericMesId
                                            );
                                            if (typeof addCopyToCodeBlocks === 'function') {
                                                addCopyToCodeBlocks(mesText);
                                            }
                                            console.log('NemoNet: 🔄 Message re-rendered successfully');
                                        }

                                        // Create reasoning box
                                        updateReasoningDOM(numericMesId, result.reasoning);
                                    }
                                }, 10);
                            }
                        }

                        // THEN wait for render and do DOM updates as backup
                        setTimeout(() => {
                            const mesText = node.querySelector('.mes_text');
                            if (mesText && mesText.innerHTML) {
                                console.log('NemoNet: Message DOM is ready, doing backup DOM update...');
                                processMessageReasoning(numericMesId, parser);
                            } else {
                                console.log('NemoNet: .mes_text not ready yet, waiting longer...');
                                setTimeout(() => processMessageReasoning(numericMesId, parser), 300);
                            }
                        }, 200);
                    }
                }
            }
        }
    });

    // Observe the chat container
    const chatContainer = document.getElementById('chat');
    if (chatContainer) {
        observer.observe(chatContainer, {
            childList: true,
            subtree: true
        });
        console.log('NemoNet: ✅ MutationObserver active on #chat');
    } else {
        console.log('NemoNet: ⚠️ #chat not found, retrying in 1s...');
        setTimeout(() => setupMessageObserver(parser), 1000);
    }
}

/**
 * Force process a message - used after ST has finished rendering
 * This is MORE aggressive than processMessageReasoning
 */
function forceProcessMessage(messageId, parser) {
    const chat = getContext().chat;
    const message = chat?.[messageId];

    if (!message || !message.mes) {
        console.log('NemoNet: Force process - message not found:', messageId);
        return;
    }

    console.log('NemoNet: 💪 FORCE processing message', messageId);

    // Check if message has <think> tags in the CURRENT displayed content
    const messageElement = document.querySelector(`[mesid="${messageId}"]`);
    const mesText = messageElement?.querySelector('.mes_text');

    if (mesText) {
        const displayedText = mesText.textContent || '';
        console.log('NemoNet: Displayed text length:', displayedText.length);
        console.log('NemoNet: Contains think tags in display?', displayedText.includes('STORY SECTION'));

        // If the displayed text contains reasoning markers, we need to fix it
        if (displayedText.includes('STORY SECTION') || displayedText.includes('NEMONET') || displayedText.includes('Council of Vex')) {
            console.log('NemoNet: ⚠️ Reasoning detected in displayed message! Fixing...');

            // Re-parse the ORIGINAL message data (which should still have <think> tags)
            const originalMes = message.mes;

            // If message.mes doesn't have tags anymore, check if it's in message text
            let textToParse = originalMes;
            if (!originalMes.includes('<think>') && mesText.innerHTML.includes('<think>')) {
                console.log('NemoNet: Getting text from innerHTML instead');
                // Extract text from innerHTML
                textToParse = mesText.innerHTML;
            }

            if (textToParse.includes('<think>')) {
                const result = parser.parse(textToParse);

                if (result.confidence >= 65 && result.reasoning.length > 50) {
                    console.log(`NemoNet: 💪 FORCE extracted reasoning (${result.reasoning.length} chars)`);
                    console.log(`NemoNet: Content length after extraction: ${result.content.length} chars`);

                    // CRITICAL SAFETY CHECK: Ensure content is not empty
                    if (!result.content || result.content.trim().length < 100) {
                        console.error(`NemoNet: ❌ FORCE PROCESSING ABORTED - Content is empty or too short!`);
                        console.error(`NemoNet: This means the AI put EVERYTHING inside <think> tags, including the narrative.`);
                        console.error(`NemoNet: The parser extracted ${result.reasoning.length} chars as reasoning, but left only ${result.content?.length || 0} chars for content.`);
                        console.error(`NemoNet: This is likely an AI output formatting error. The narrative should be OUTSIDE <think> tags.`);

                        // Show preview of what was extracted
                        console.warn(`NemoNet: Reasoning preview (first 300 chars): "${result.reasoning.substring(0, 300)}..."`);
                        console.warn(`NemoNet: Content returned: "${result.content}"`);

                        // ATTEMPT RECOVERY: Try to extract narrative from the reasoning that was extracted
                        console.log('NemoNet: 🔧 Attempting RECOVERY - Extracting narrative from reasoning...');
                        const recovered = recoverNarrativeFromReasoning(result.reasoning);

                        if (recovered && recovered.content && recovered.content.length > 100) {
                            console.log(`NemoNet: ✅ RECOVERY SUCCESSFUL! Extracted ${recovered.content.length} chars of narrative from reasoning`);

                            // Update message data with recovered content
                            message.mes = recovered.content;
                            if (!message.extra) message.extra = {};
                            message.extra.reasoning = recovered.reasoning;
                            message.extra.reasoning_type = 'parsed-recovered';

                            // Update message text DOM
                            updateMessageDOM(messageId, message);

                            // Update reasoning UI
                            console.log('NemoNet: Calling updateReasoningUI to show recovered reasoning box...');
                            updateReasoningUI(messageId);

                            // Save
                            getContext().saveChat();

                            console.log('NemoNet: 💪 RECOVERY processing complete!');
                            return;
                        } else {
                            console.error('NemoNet: ❌ RECOVERY FAILED - Could not extract narrative from reasoning');
                            console.error('NemoNet: Leaving message as-is to prevent data loss');
                            // Don't update - this would delete the narrative
                            return;
                        }
                    }

                    // Update message data
                    message.mes = result.content;
                    if (!message.extra) message.extra = {};
                    message.extra.reasoning = result.reasoning;
                    message.extra.reasoning_type = 'parsed';

                    // Update message text DOM
                    updateMessageDOM(messageId, message);

                    // CRITICAL: Use SillyTavern's own function to update reasoning UI
                    console.log('NemoNet: Calling updateReasoningUI to show reasoning box...');
                    updateReasoningUI(messageId);

                    // Save
                    getContext().saveChat();

                    console.log('NemoNet: 💪 FORCE processing complete!');
                    return;
                }
            }
        }
    }

    console.log('NemoNet: Force process - no reasoning found or already clean');
}

/**
 * Process message to extract reasoning
 */
function processMessageReasoning(messageId, parser) {
    // Get the message from chat array using getContext()
    const chat = getContext().chat;
    console.log('NemoNet: Looking for message', messageId, 'in chat of length', chat?.length);
    const message = chat?.[messageId];
    if (!message) {
        console.log('NemoNet: Message not found:', messageId, 'chat exists:', !!chat);
        return;
    }

    // Always process the latest message (for swipes)
    const isLatestMessage = messageId === chat.length - 1;

    // Skip if already has reasoning extracted or if message is too short (unless it's the latest message)
    if (!isLatestMessage && (message.extra?.reasoning || !message.mes || message.mes.length < 50)) {
        console.log('NemoNet: Skipping message', messageId, '- Already has reasoning or too short');
        return;
    }

    // Skip if message is too short
    if (message.mes.length < 50) {
        return;
    }

    // Skip if message doesn't contain <think> tags (quick pre-check)
    if (!message.mes.includes('<think>')) {
        console.log('NemoNet: Skipping message', messageId, '- No <think> tag found');
        return;
    }

    // Try to parse reasoning from the message content
    const result = parser.parse(message.mes);

    // Log the parse result for debugging
    console.log(`NemoNet: Parse result - Strategy: ${result.strategy}, Confidence: ${result.confidence}, Reasoning: ${result.reasoning.length} chars, Content: ${result.content.length} chars`);

    // CRITICAL DEBUG: Log first 200 chars of reasoning and content
    console.log(`NemoNet: Reasoning preview: "${result.reasoning.substring(0, 200)}..."`);
    console.log(`NemoNet: Content preview: "${result.content.substring(0, 200)}..."`);

    // If we found reasoning with decent confidence, extract it (lowered to 65%)
    if (result.confidence >= 65 && result.reasoning.length > 50) {
        console.log(`NemoNet Reasoning Parser: ✅ Captured reasoning using ${result.strategy} (confidence: ${result.confidence})`);
        console.log(`NemoNet: Reasoning length: ${result.reasoning.length}, Content length: ${result.content.length}`);

        // CRITICAL FIX: Check if content is empty or too short
        if (!result.content || result.content.trim().length < 100) {
            console.error(`NemoNet: ❌ ERROR: Content is empty or too short! This means the parser didn't separate reasoning from narrative properly.`);
            console.error(`NemoNet: Content length: ${result.content.length}, Content: "${result.content.substring(0, 500)}"`);
            console.error(`NemoNet: This is a parser bug - skipping update to prevent data loss.`);
            return; // Don't update if we'd lose the narrative
        }

        // Update the message data
        message.mes = result.content;

        // Add reasoning to extra
        if (!message.extra) message.extra = {};
        message.extra.reasoning = result.reasoning;
        message.extra.reasoning_type = 'parsed';

        console.log('NemoNet: ✅ Message data updated - forcing multiple DOM updates...');

        // Save chat first so data is persisted
        getContext().saveChat();

        // CRITICAL: Update DOM multiple times to catch different render stages
        // Immediate update (might be too early but worth trying)
        setTimeout(() => {
            console.log('NemoNet: DOM update attempt 1 (immediate)');
            updateMessageDOM(messageId, message);
            updateReasoningDOM(messageId, result.reasoning);
        }, 0);

        // Second update after 100ms
        setTimeout(() => {
            console.log('NemoNet: DOM update attempt 2 (100ms)');
            updateMessageDOM(messageId, message);
            updateReasoningDOM(messageId, result.reasoning);
        }, 100);

        // Third update after 300ms
        setTimeout(() => {
            console.log('NemoNet: DOM update attempt 3 (300ms)');
            updateMessageDOM(messageId, message);
            updateReasoningDOM(messageId, result.reasoning);
        }, 300);

        // Fourth update after 600ms - catches late ST re-renders
        setTimeout(() => {
            console.log('NemoNet: DOM update attempt 4 (600ms)');
            updateReasoningDOM(messageId, result.reasoning);
        }, 600);

        // Final update after 1000ms - ensures visibility after all ST operations
        setTimeout(() => {
            console.log('NemoNet: DOM update attempt 5 (1000ms - final)');
            updateReasoningDOM(messageId, result.reasoning);
            console.log('NemoNet: ✅ All DOM updates complete');
        }, 1000);
    } else {
        console.log(`NemoNet: No reasoning detected (confidence: ${result.confidence})`);
    }
}

/**
 * Force immediate DOM update for message (pattern from rewrite extension)
 * This updates the displayed message to remove reasoning from visible content
 */
function updateMessageDOM(messageId, messageData) {
    console.log(`NemoNet: updateMessageDOM called for message ${messageId}`);

    const messageElement = document.querySelector(`[mesid="${messageId}"]`);
    if (!messageElement) {
        console.error('NemoNet: ❌ Message element not found for DOM update:', messageId);
        console.log('NemoNet: Available message IDs:', Array.from(document.querySelectorAll('[mesid]')).map(el => el.getAttribute('mesid')));
        return;
    }

    // Find the message text element
    const mesText = messageElement.querySelector('.mes_text');
    if (!mesText) {
        console.error('NemoNet: ❌ .mes_text not found in message', messageId);
        console.log('NemoNet: Message element children:', messageElement.children);
        return;
    }

    console.log('NemoNet: Found .mes_text element, current length:', mesText.innerHTML.length);
    console.log('NemoNet: New content length:', messageData.mes.length);

    // Use SillyTavern's messageFormatting to properly format the content
    // This is the CRITICAL pattern from rewrite extension (see rewrite/index.js:448)
    if (typeof messageFormatting === 'function') {
        try {
            const context = getContext();
            console.log('NemoNet: Formatting message with name2:', context.name2);

            const formattedMessage = messageFormatting(
                messageData.mes,
                context.name2,  // Character name from context (CRITICAL!)
                messageData.isSystem || false,
                messageData.isUser || false,
                messageId
            );

            console.log('NemoNet: Formatted message length:', formattedMessage.length);
            mesText.innerHTML = formattedMessage;

            // Apply code block formatting if available
            if (typeof addCopyToCodeBlocks === 'function') {
                addCopyToCodeBlocks(mesText);
            }

            console.log('NemoNet: ✅ DOM updated with formatted message (reasoning removed from display)');
        } catch (error) {
            console.error('NemoNet: ❌ Error during messageFormatting:', error);
            // Fallback on error
            mesText.textContent = messageData.mes;
        }
    } else {
        // Fallback: direct text update
        console.warn('NemoNet: ⚠️ messageFormatting not available, using fallback');
        mesText.textContent = messageData.mes;
    }
}

/**
 * Manually update the DOM to show reasoning block
 */
function updateReasoningDOM(messageId, reasoningText) {
    console.log(`NemoNet: updateReasoningDOM called for message ${messageId}, reasoning length: ${reasoningText.length}`);

    // Find the message element
    const messageElement = document.querySelector(`[mesid="${messageId}"]`);
    if (!messageElement) {
        console.error('NemoNet: ❌ Message element not found for reasoning update:', messageId);
        return;
    }

    // Check if reasoning block already exists
    let reasoningDetails = messageElement.querySelector('.mes_reasoning_details');
    let isNewBlock = false;

    if (!reasoningDetails) {
        isNewBlock = true;
        // Create reasoning block
        reasoningDetails = document.createElement('details');
        reasoningDetails.className = 'mes_reasoning_details';

        const summary = document.createElement('summary');
        summary.className = 'mes_reasoning_summary';

        const headerBlock = document.createElement('div');
        headerBlock.className = 'mes_reasoning_header_block';

        const headerTitle = document.createElement('span');
        headerTitle.className = 'mes_reasoning_header_title';
        headerTitle.textContent = 'Thought for some time';

        const arrow = document.createElement('div');
        arrow.className = 'mes_reasoning_arrow';

        headerBlock.appendChild(headerTitle);
        headerBlock.appendChild(arrow);
        summary.appendChild(headerBlock);

        const reasoningContent = document.createElement('div');
        reasoningContent.className = 'mes_reasoning';

        reasoningDetails.appendChild(summary);
        reasoningDetails.appendChild(reasoningContent);

        // Insert at the beginning of the message block
        const mesBlock = messageElement.querySelector('.mes_block');
        if (mesBlock) {
            mesBlock.insertBefore(reasoningDetails, mesBlock.firstChild);
        }
    }

    // Update the reasoning content
    const reasoningContent = reasoningDetails.querySelector('.mes_reasoning');
    if (reasoningContent) {
        // Use innerHTML to preserve formatting, but escape HTML for safety
        const escapedText = reasoningText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
        reasoningContent.innerHTML = escapedText;
    }

    // Update the header title
    const headerTitle = reasoningDetails.querySelector('.mes_reasoning_header_title');
    if (headerTitle) {
        headerTitle.textContent = 'Thought for some time';
        headerTitle.removeAttribute('title');
    }

    // CRITICAL FIX: Force browser to repaint and make the element visible
    // This solves the "requires two refreshes" issue by triggering layout recalculation
    if (isNewBlock || reasoningDetails.offsetParent === null) {
        // Force reflow by reading offsetHeight
        void reasoningDetails.offsetHeight;

        // Remove and re-insert to force complete re-render
        const parent = reasoningDetails.parentNode;
        const nextSibling = reasoningDetails.nextSibling;
        parent.removeChild(reasoningDetails);

        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            if (nextSibling) {
                parent.insertBefore(reasoningDetails, nextSibling);
            } else {
                parent.appendChild(reasoningDetails);
            }

            // Force another reflow after re-insertion
            void reasoningDetails.offsetHeight;

            // Ensure visibility by temporarily toggling display
            const originalDisplay = reasoningDetails.style.display;
            reasoningDetails.style.display = 'none';
            void reasoningDetails.offsetHeight;
            reasoningDetails.style.display = originalDisplay || '';

            console.log('NemoNet: ✅ Reasoning box forced visible for message', messageId);
        });
    }

    console.log('NemoNet: Reasoning DOM updated for message', messageId, '- Content length:', reasoningText.length);
}

/**
 * Recover narrative content from reasoning that was incorrectly extracted
 * This happens when the AI puts everything inside <think> tags
 */
function recoverNarrativeFromReasoning(reasoningText) {
    console.log('NemoNet: 🔍 Analyzing reasoning to find narrative content...');
    console.log(`NemoNet: Total reasoning text length: ${reasoningText.length} chars`);
    console.log(`NemoNet: First 300 chars: "${reasoningText.substring(0, 300)}..."`);
    console.log(`NemoNet: Last 300 chars: "...${reasoningText.substring(reasoningText.length - 300)}"`);

    // PRIORITY STRATEGY 1: Look for the "no-space quirk" pattern FIRST
    // This is when reasoning ends with a period and narrative immediately starts with capital letter
    // Example: "...plan is set. Time to write.The rain-slicked streets..."
    console.log('NemoNet: Checking for no-space quirk pattern in full text...');

    const noSpacePattern = /\.\s*([A-Z][a-z]{2,}\s+.{50,})/;
    const noSpaceMatch = reasoningText.match(noSpacePattern);

    if (noSpaceMatch && noSpaceMatch.index !== undefined) {
        // Make sure this looks like narrative, not just another reasoning sentence
        const capturedText = noSpaceMatch[1];
        const hasNarrativeMarkers =
            capturedText.includes('<p>') ||
            capturedText.includes('<font') ||
            /\b(you|You|your|Your)\b/.test(capturedText) ||
            capturedText.split(/[.!?]/).length > 2; // Multiple sentences

        if (hasNarrativeMarkers) {
            // Find where the narrative actually starts (after the period and any whitespace)
            const periodPosition = noSpaceMatch.index; // Position of the period
            const narrativeStart = periodPosition + 1 + (noSpaceMatch[0].match(/^\.\s*/)[0].length - 1); // Skip period and whitespace

            console.log('NemoNet: ✅ Found no-space quirk at position', periodPosition);
            console.log('NemoNet: Captured text preview:', capturedText.substring(0, 100));

            // Reasoning EXCLUDES the period, content starts fresh
            const reasoning = reasoningText.substring(0, periodPosition).trim();
            const content = reasoningText.substring(narrativeStart).trim();

            console.log(`NemoNet: No-space split - Reasoning: ${reasoning.length} chars, Content: ${content.length} chars`);

            if (content.length > 100) {
                return { reasoning, content };
            }
        }
    }

    console.log('NemoNet: No-space pattern not found, trying structural detection...');

    // STRATEGY 2: Detect transition from reasoning to narrative based on STRUCTURE
    // Reasoning has: lists, meta-commentary, planning, bullet points, "Council of Vex", strong tags
    // Narrative has: past/present tense prose, sensory details, dialogue, longer paragraphs

    // Look for structural transition: where reasoning patterns end and prose patterns begin
    console.log('NemoNet: Looking for structural transition from reasoning to narrative...');

    // Split into paragraphs
    const paragraphs = reasoningText.split(/\n\n+/);
    let transitionIndex = -1;
    let narrativeStartPosition = 0;

    for (let i = 0; i < paragraphs.length; i++) {
        const para = paragraphs[i];

        // Skip empty paragraphs
        if (para.trim().length < 20) continue;

        // Check if this paragraph looks like REASONING
        const isReasoning =
            para.includes('Council of Vex') ||
            para.includes('**Decision') ||
            para.includes('**Plan') ||
            para.includes('**Execution') ||
            para.includes('- **') ||
            /^\d+\.\s+\*\*/.test(para) || // Numbered list with bold
            /^-\s+\*\*/.test(para) || // Bullet with bold
            para.includes('<li>') ||
            para.includes('</ol>') ||
            para.includes('</ul>') ||
            /^(Okay|Alright|So,|Let's|Now,)/.test(para.trim()) && para.length < 200; // Meta-commentary

        // Check if this paragraph looks like NARRATIVE
        const isNarrative =
            para.includes('<p>') && para.length > 100 || // Long paragraph tags
            /^[A-Z][a-z]+ .{50,}[.!?]/.test(para) && !para.includes('**') || // Prose without markdown
            para.includes('<font color') || // Dialogue
            para.includes('</font>') ||
            /\b(you|You|your|Your)\b.{30,}/.test(para) && !para.includes('**'); // Second-person prose

        if (!isReasoning && isNarrative && transitionIndex === -1) {
            console.log(`NemoNet: ✅ Found narrative transition at paragraph ${i}`);
            console.log(`NemoNet: Paragraph preview: "${para.substring(0, 100)}..."`);
            transitionIndex = i;
            // Calculate position in original text
            narrativeStartPosition = paragraphs.slice(0, i).join('\n\n').length + (i > 0 ? 2 : 0); // +2 for the \n\n
            break;
        }
    }

    if (transitionIndex !== -1) {
        const reasoning = reasoningText.substring(0, narrativeStartPosition).trim();
        const content = reasoningText.substring(narrativeStartPosition).trim();

        console.log(`NemoNet: Structural split - Reasoning: ${reasoning.length} chars, Content: ${content.length} chars`);

        // Validate the split makes sense
        if (content.length > 100) {
            return { reasoning, content };
        } else {
            console.warn('NemoNet: Structural split resulted in too-short content, trying other strategies...');
        }
    }

    console.log('NemoNet: No structural transition found, trying marker-based approach...');

    // FALLBACK STRATEGY: Look for the transition from reasoning to narrative
    // Find the last occurrence of clear reasoning markers
    const reasoningEndMarkers = [
        'This approach sets a clear',
        'The pacing will be',
        'Plan Execution:',
        '</ol>',
        '</ul>',
        'focusing on atmosphere',
        'focusing on the small details'
    ];

    let lastReasoningIndex = -1;
    let usedMarker = '';

    for (const marker of reasoningEndMarkers) {
        const index = reasoningText.lastIndexOf(marker);
        if (index > lastReasoningIndex) {
            lastReasoningIndex = index;
            usedMarker = marker;
        }
    }

    if (lastReasoningIndex === -1) {
        console.log('NemoNet: Could not find reasoning end marker, trying alternative approach...');
        // Alternative: Look for </ol> or </ul> which marks end of Plan Execution
        const listEndIndex = Math.max(
            reasoningText.lastIndexOf('</ol>'),
            reasoningText.lastIndexOf('</ul>')
        );
        if (listEndIndex > -1) {
            lastReasoningIndex = listEndIndex;
            usedMarker = reasoningText[listEndIndex + 1] === 'o' ? '</ol>' : '</ul>';
            console.log(`NemoNet: Found list end marker at index ${lastReasoningIndex}`);
        } else {
            console.log('NemoNet: No reasoning markers found at all');
            return null;
        }
    }

    // Find where the marker ends
    const markerEndIndex = lastReasoningIndex + usedMarker.length;

    // Look for the start of narrative after the marker
    // Narrative typically starts with <p> tags containing descriptive prose
    const afterMarker = reasoningText.substring(markerEndIndex);

    // Strategy 1: Look for common narrative starters WITH <p> tags
    const narrativeStartPattern = /<p>(?:The |A |An |That |It |He |She |They |You |In |At |On |From |With |Without |Through |Between |Among |During |After |Before |Inside |Outside |Above |Below |Beneath |Beyond |Around |Across |Against |Along |Amid |Amongst )/i;
    let narrativeMatch = afterMarker.match(narrativeStartPattern);

    // Strategy 2: Look for narrative WITHOUT <p> tags (no-space quirk in stored data)
    if (!narrativeMatch) {
        console.log('NemoNet: Standard narrative pattern not found, trying no-space pattern...');
        // The narrative might run directly into reasoning with no space or tag
        // Look for sentences starting with "The", "A", etc. that mark prose
        const noSpacePattern = /\.(?:The |A |An |That |He |She |They |It was |There )/i;
        narrativeMatch = afterMarker.match(noSpacePattern);

        if (narrativeMatch) {
            console.log('NemoNet: Found no-space narrative transition!');
            // Adjust index to include the period but skip to start of narrative
            narrativeMatch.index = narrativeMatch.index + 1; // Skip the period
        }
    }

    // Strategy 3: Look for ANY <p> tag after the reasoning marker
    if (!narrativeMatch) {
        console.log('NemoNet: No-space pattern not found, trying broader match...');
        // Look for first <p> tag that's NOT followed by <strong> or <em> (which are used in reasoning)
        const broadPattern = /<p>(?!<strong>|<em>|The user |Council of Vex|Plan Execution)/i;
        narrativeMatch = afterMarker.match(broadPattern);
    }

    // Strategy 4: Look for common narrative opening phrases
    if (!narrativeMatch) {
        console.log('NemoNet: Broad pattern not found, trying narrative opening phrases...');
        const openingPhrases = [
            /The first thing (?:you |that )?(?:perceive|notice|see|hear|feel|register)/i,
            /(?:A |The )?(?:low|soft|sharp|sudden|faint|gentle) .{10,50}(?:is|was) the first/i,
            /You(?:'re| are) (?:standing|lying|sitting|in a|at a)/i,
            /(?:Awareness|Consciousness|Sensation) (?:returns|comes|seeps|floods)/i
        ];

        for (const phrase of openingPhrases) {
            const match = afterMarker.match(phrase);
            if (match) {
                console.log('NemoNet: Found narrative opening phrase:', match[0]);
                narrativeMatch = match;
                break;
            }
        }
    }

    // Strategy 5: Last resort - find first <p> tag after all reasoning lists/plans
    if (!narrativeMatch) {
        console.log('NemoNet: No opening phrase found, trying to find first prose paragraph...');
        // Find the first <p> that contains at least 50 characters of continuous text
        const paragraphs = afterMarker.match(/<p>[^<]{50,}/gi);
        if (paragraphs && paragraphs.length > 0) {
            narrativeMatch = {
                index: afterMarker.indexOf(paragraphs[0]),
                0: paragraphs[0]
            };
        }
    }

    if (!narrativeMatch) {
        console.log('NemoNet: Could not find narrative start pattern with any strategy');
        console.log('NemoNet: After marker preview (first 500 chars):', afterMarker.substring(0, 500));
        return null;
    }

    const narrativeStartIndex = markerEndIndex + narrativeMatch.index;

    // Split the text
    const reasoning = reasoningText.substring(0, narrativeStartIndex).trim();
    const content = reasoningText.substring(narrativeStartIndex).trim();

    console.log(`NemoNet: Split at marker "${usedMarker}"`);
    console.log(`NemoNet: Reasoning ends at char ${narrativeStartIndex}`);
    console.log(`NemoNet: Found ${reasoning.length} chars of reasoning, ${content.length} chars of content`);
    console.log(`NemoNet: Content preview: "${content.substring(0, 200)}..."`);

    // Validate the split
    if (content.length < 200) {
        console.log('NemoNet: Content too short, split probably failed');
        return null;
    }

    return {
        reasoning: reasoning,
        content: content
    };
}

/**
 * Reprocess the latest message on page load
 * This catches cases where reasoning wasn't extracted properly
 */
function reprocessLatestMessage(parser) {
    console.log('NemoNet: 🔄 Reprocessing latest message on page load...');

    const chat = getContext().chat;
    if (!chat || chat.length === 0) {
        console.log('NemoNet: No messages to reprocess (empty chat)');
        return;
    }

    // Find the last assistant message
    let latestMessageId = -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user) {
            latestMessageId = i;
            break;
        }
    }

    if (latestMessageId === -1) {
        console.log('NemoNet: No assistant messages found to reprocess');
        return;
    }

    const message = chat[latestMessageId];
    console.log(`NemoNet: Found latest assistant message at index ${latestMessageId}`);
    console.log(`NemoNet: Message length: ${message.mes?.length || 0} chars`);
    console.log(`NemoNet: Has existing reasoning: ${!!message.extra?.reasoning}`);
    console.log(`NemoNet: Contains <think> tag: ${message.mes?.includes('<think>') || false}`);

    // Check if the message needs reprocessing
    const needsReprocessing = message.mes?.includes('<think>') &&
                              (!message.extra?.reasoning || message.extra.reasoning.length < 100);

    if (needsReprocessing) {
        console.log('NemoNet: ✅ Latest message needs reprocessing - extracting reasoning...');
        forceProcessMessage(latestMessageId, parser);
    } else if (message.extra?.reasoning) {
        console.log('NemoNet: Latest message already has reasoning extracted, checking validity...');

        // CRITICAL FIX: Check if message content is empty but reasoning contains narrative
        const messageEmpty = !message.mes || message.mes.trim().length < 100;
        const reasoningHasNarrative = message.extra.reasoning.includes('<p>') ||
                                     message.extra.reasoning.includes('<div') ||
                                     message.extra.reasoning.includes('</p>');

        if (messageEmpty && reasoningHasNarrative) {
            console.error('NemoNet: 🔧 RECOVERY MODE - Message content is empty but reasoning contains HTML/narrative!');
            console.log('NemoNet: Attempting to split reasoning and narrative...');

            // Try to separate reasoning from narrative
            const recovered = recoverNarrativeFromReasoning(message.extra.reasoning);

            if (recovered && recovered.content.length > 100) {
                console.log(`NemoNet: ✅ Recovery successful! Extracted ${recovered.reasoning.length} chars of reasoning and ${recovered.content.length} chars of narrative`);

                // Update message data
                message.mes = recovered.content;
                message.extra.reasoning = recovered.reasoning;

                // Update DOM
                updateMessageDOM(latestMessageId, message);

                // Update reasoning box
                if (typeof updateReasoningUI === 'function') {
                    updateReasoningUI(latestMessageId);
                }

                // Save the fix
                getContext().saveChat();

                console.log('NemoNet: ✅ Message recovered and saved!');
                return;
            } else {
                console.error('NemoNet: ❌ Recovery failed - could not separate reasoning from narrative');
            }
        }

        // Check if reasoning box exists in DOM
        const messageElement = document.querySelector(`[mesid="${latestMessageId}"]`);
        const reasoningBox = messageElement?.querySelector('.mes_reasoning_details');

        if (!reasoningBox) {
            console.log('NemoNet: Reasoning data exists but box not displayed - forcing display update...');
            // Call SillyTavern's function to update reasoning UI
            if (typeof updateReasoningUI === 'function') {
                updateReasoningUI(latestMessageId);
            }
        } else {
            console.log('NemoNet: ✅ Latest message already properly processed');
        }
    } else {
        console.log('NemoNet: Latest message does not contain reasoning');
    }
}

// Auto-apply
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(applyNemoNetReasoning, 1500);
        });
    } else {
        setTimeout(applyNemoNetReasoning, 1500);
    }
}
