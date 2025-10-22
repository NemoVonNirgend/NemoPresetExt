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

    // If we found reasoning with decent confidence, extract it (lowered to 65%)
    if (result.confidence >= 65 && result.reasoning.length > 50) {
        console.log(`NemoNet Reasoning Parser: ✅ Captured reasoning using ${result.strategy} (confidence: ${result.confidence})`);
        console.log(`NemoNet: Reasoning length: ${result.reasoning.length}, Content length: ${result.content.length}`);

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

        // Third update after 300ms (final)
        setTimeout(() => {
            console.log('NemoNet: DOM update attempt 3 (300ms - final)');
            updateMessageDOM(messageId, message);
            updateReasoningDOM(messageId, result.reasoning);
            console.log('NemoNet: ✅ All DOM updates complete');
        }, 300);
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

    if (!reasoningDetails) {
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

    console.log('NemoNet: Reasoning DOM updated for message', messageId, '- Content length:', reasoningText.length);
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
