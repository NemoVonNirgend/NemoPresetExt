/**
 * HTML Trimmer for Old Messages
 * Converts complex HTML/CSS blocks in old messages into simple text dropdowns
 * to reduce context usage while preserving information
 */

import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';

// Debug flag - set to true for verbose logging during development
const DEBUG_HTML_TRIMMER = false;

// Conditional logging helper
function debugLog(...args) {
    if (DEBUG_HTML_TRIMMER) {
        debugLog('', ...args);
    }
}

let getContext;

/**
 * Initialize the HTML trimmer module
 */
export function initializeHTMLTrimmer() {
    debugLog(' Initializing...');

    // Import getContext from SillyTavern
    import('/scripts/extensions.js').then(module => {
        if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
            getContext = SillyTavern.getContext;
        } else {
            // Fallback: Try to find it in window scope
            getContext = () => window.SillyTavern?.getContext?.() || { chat: [] };
        }
        debugLog(' getContext imported');
    }).catch(() => {
        // Final fallback
        getContext = () => ({ chat: [] });
        console.warn('NemoNet HTML Trimmer: Could not import getContext, using fallback');
    });
}

/**
 * Convert HTML to ASCII-formatted text that preserves visual structure
 * Converts boxes, borders, and styled elements to ASCII art equivalents
 */
function convertHTMLToASCII(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove script and style elements
    const scripts = temp.querySelectorAll('script, style');
    scripts.forEach(el => el.remove());

    let output = '';

    // Process each top-level element
    Array.from(temp.children).forEach(child => {
        output += processElementToASCII(child, 0) + '\n';
    });

    return output.trim();
}

/**
 * Recursively process an element and convert to ASCII representation
 */
function processElementToASCII(element, indentLevel = 0) {
    const indent = '  '.repeat(indentLevel);
    const tagName = element.tagName.toLowerCase();
    const text = element.textContent.trim();

    // Handle different element types
    if (tagName === 'details') {
        // Convert <details> to ASCII box
        const summary = element.querySelector('summary')?.textContent.trim() || 'Details';
        const width = Math.min(Math.max(summary.length + 4, 40), 80);
        const topBorder = indent + '┌' + '─'.repeat(width - 2) + '┐';
        const summaryLine = indent + '│ ▼ ' + summary.padEnd(width - 5) + '│';
        const bottomBorder = indent + '└' + '─'.repeat(width - 2) + '┘';

        let content = '';
        const contentDiv = element.querySelector('summary + *');
        if (contentDiv) {
            const contentText = contentDiv.textContent.trim();
            const lines = contentText.split('\n');
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    // Wrap long lines
                    const chunks = trimmedLine.match(new RegExp(`.{1,${width - 6}}`, 'g')) || [trimmedLine];
                    chunks.forEach(chunk => {
                        content += indent + '│   ' + chunk.padEnd(width - 6) + ' │\n';
                    });
                }
            });
        }

        return topBorder + '\n' + summaryLine + '\n' + (content || '') + bottomBorder;
    }

    if (tagName === 'div' && element.style.border) {
        // Convert bordered div to ASCII box
        const title = element.querySelector('b, strong, .title')?.textContent.trim() || '';
        const width = Math.min(Math.max(text.length, 40), 80);
        const topBorder = indent + '╔' + '═'.repeat(width - 2) + '╗';
        const bottomBorder = indent + '╚' + '═'.repeat(width - 2) + '╝';

        let content = '';
        if (title) {
            content += indent + '║ ' + title.padEnd(width - 4) + ' ║\n';
            content += indent + '║' + '─'.repeat(width - 2) + '║\n';
        }

        // Add content lines
        const contentText = text.replace(title, '').trim();
        const lines = contentText.split('\n');
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
                const chunks = trimmedLine.match(new RegExp(`.{1,${width - 6}}`, 'g')) || [trimmedLine];
                chunks.forEach(chunk => {
                    content += indent + '║ ' + chunk.padEnd(width - 4) + ' ║\n';
                });
            }
        });

        return topBorder + '\n' + content + bottomBorder;
    }

    if (tagName === 'table') {
        // Convert table to ASCII table
        return convertTableToASCII(element, indentLevel);
    }

    if (tagName === 'ul' || tagName === 'ol') {
        // Convert lists to bullet points or numbers
        let listOutput = '';
        const items = element.querySelectorAll('li');
        items.forEach((item, index) => {
            const bullet = tagName === 'ul' ? '•' : `${index + 1}.`;
            listOutput += indent + bullet + ' ' + item.textContent.trim() + '\n';
        });
        return listOutput.trim();
    }

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
        // Convert headings to ASCII underlined text
        const underline = tagName === 'h1' ? '═' : tagName === 'h2' ? '─' : '·';
        return indent + text + '\n' + indent + underline.repeat(text.length);
    }

    if (tagName === 'hr') {
        return indent + '─'.repeat(60);
    }

    if (tagName === 'blockquote') {
        // Convert blockquotes to indented text with bar
        const lines = text.split('\n');
        return lines.map(line => indent + '│ ' + line.trim()).join('\n');
    }

    // Default: return text with indentation
    if (text.length > 0) {
        return indent + text;
    }

    return '';
}

/**
 * Convert HTML table to ASCII table
 */
function convertTableToASCII(table, indentLevel = 0) {
    const indent = '  '.repeat(indentLevel);
    const rows = Array.from(table.querySelectorAll('tr'));

    if (rows.length === 0) return '';

    // Get column widths
    const columnWidths = [];
    rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        cells.forEach((cell, index) => {
            const text = cell.textContent.trim();
            columnWidths[index] = Math.max(columnWidths[index] || 0, text.length);
        });
    });

    // Build ASCII table
    let output = '';
    const topBorder = indent + '┌' + columnWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐';
    const bottomBorder = indent + '└' + columnWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘';
    const middleBorder = indent + '├' + columnWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┤';

    output += topBorder + '\n';

    rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        const cellTexts = cells.map((cell, index) => {
            return cell.textContent.trim().padEnd(columnWidths[index]);
        });

        output += indent + '│ ' + cellTexts.join(' │ ') + ' │\n';

        // Add separator after header row
        if (rowIndex === 0 && row.querySelector('th')) {
            output += middleBorder + '\n';
        }
    });

    output += bottomBorder;
    return output;
}

/**
 * Calculate UI complexity score for an element
 * Used to determine if an element is a UI block vs narrative content
 * @param {HTMLElement} element - The element to analyze
 * @returns {number} Complexity score (5+ indicates UI block)
 */
function calculateComplexityScore(element) {
    const styleAttr = element.getAttribute('style') || '';

    // Count visual complexity indicators
    const hasGradient = styleAttr.includes('linear-gradient') || styleAttr.includes('radial-gradient');
    const hasBorder = styleAttr.includes('border:') || styleAttr.includes('border-radius:');
    const hasShadow = styleAttr.includes('box-shadow') || styleAttr.includes('text-shadow');
    const hasBackground = styleAttr.includes('background:') || styleAttr.includes('background-color:');
    const hasGrid = styleAttr.includes('grid-template') || styleAttr.includes('display: grid') || styleAttr.includes('display:grid');
    const hasFlex = styleAttr.includes('display: flex') || styleAttr.includes('display:flex');

    // Check for nested structure (UI panels usually have nested elements)
    const hasNestedDetails = element.querySelector('details') !== null;
    const hasNestedDivs = element.querySelectorAll('div').length > 2;
    const hasProgressBars = element.querySelectorAll('[style*="width:"][style*="height"]').length > 0;
    const hasEmbeddedStyles = element.querySelector('style') !== null;

    // Check for long inline styles (UI panels have extensive styling)
    const hasComplexStyling = styleAttr.length > 150;

    // Calculate complexity score
    let score = 0;
    if (hasGradient) score += 2;
    if (hasBorder) score += 1;
    if (hasShadow) score += 1;
    if (hasBackground) score += 1;
    if (hasGrid || hasFlex) score += 1;
    if (hasNestedDetails) score += 2;
    if (hasNestedDivs) score += 1;
    if (hasProgressBars) score += 2;
    if (hasComplexStyling) score += 2;
    if (hasEmbeddedStyles) score += 3;

    return score;
}

/**
 * Detect if a message contains large HTML blocks that should be trimmed
 */
function shouldTrimHTML(messageContent) {
    // Check for complex HTML structures that add bloat
    const hasStyledDivs = messageContent.includes('<div') && messageContent.includes('style=');
    const hasDetailsBlocks = messageContent.includes('<details');
    const hasInlineStyles = messageContent.includes('<style>');
    const hasComplexStyling = messageContent.includes('linear-gradient') ||
                              messageContent.includes('box-shadow') ||
                              messageContent.includes('rgba(') ||
                              messageContent.includes('border-radius');

    // Count HTML tags to estimate bloat
    const htmlTagCount = (messageContent.match(/<[^>]+>/g) || []).length;

    // Only trim if message has significant HTML bloat (10+ tags)
    return (hasStyledDivs || hasDetailsBlocks || hasInlineStyles || hasComplexStyling) && htmlTagCount >= 10;
}

/**
 * Auto-repair broken HTML structure (especially unclosed font tags)
 * This unwraps content from font tags to make it easier to process
 */
function repairBrokenHTML(messageContent) {
    const temp = document.createElement('div');
    temp.innerHTML = messageContent;

    debugLog(' 🔧 AUTO-REPAIR: Input has', temp.children.length, 'top-level children');

    // Find all font tags that wrap multiple children
    const fontTags = temp.querySelectorAll('font');
    debugLog(' 🔧 AUTO-REPAIR: Found', fontTags.length, 'font tags total');

    fontTags.forEach((fontTag, index) => {
        console.log(`NemoNet HTML Trimmer: 🔧 AUTO-REPAIR: Font tag #${index} has`, fontTag.children.length, 'children');

        // If a font tag has more than 2 children, it's likely a broken wrapper
        // Unwrap its children to the parent level
        if (fontTag.children.length > 2) {
            debugLog(' 🔧 AUTO-REPAIR: Unwrapping font tag with', fontTag.children.length, 'children');
            debugLog(' 🔧 AUTO-REPAIR: Children tags:', Array.from(fontTag.children).map(c => c.tagName).join(', '));

            const parent = fontTag.parentElement;
            const childrenArray = Array.from(fontTag.children);

            // Insert all children before the font tag
            childrenArray.forEach(child => {
                parent.insertBefore(child, fontTag);
            });

            // Remove the now-empty font tag
            fontTag.remove();
        }
    });

    debugLog(' 🔧 AUTO-REPAIR: After repair, has', temp.children.length, 'top-level children');
    return temp.innerHTML;
}

/**
 * Separate narrative paragraphs from UI/system HTML blocks
 * This works on the RAW message content (before SillyTavern wraps it in <p> tags)
 */
function separateNarrativeFromUI(messageContent) {
    // First, auto-repair broken HTML structure
    const repairedContent = repairBrokenHTML(messageContent);

    const temp = document.createElement('div');
    temp.innerHTML = repairedContent;

    let narrative = '';
    let uiBlocks = [];

    debugLog(' 🔍 STARTING SEPARATION - Total top-level children:', temp.children.length);
    debugLog(' 🔍 Total child nodes (including text):', temp.childNodes.length);

    Array.from(temp.childNodes).forEach((node, index) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            console.log(`NemoNet HTML Trimmer: 🔍 Child node #${index}: ELEMENT <${node.tagName}> - Has ${node.children.length} children`);
        } else if (node.nodeType === Node.TEXT_NODE) {
            const textPreview = node.textContent.trim().substring(0, 50);
            if (textPreview.length > 0) {
                console.log(`NemoNet HTML Trimmer: 🔍 Child node #${index}: TEXT "${textPreview}..."`);
            }
        }
    });

    // Process ALL child nodes (including text nodes!)
    Array.from(temp.childNodes).forEach(node => {
        // Handle text nodes (plain paragraphs)
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text.trim().length > 0) {
                debugLog(' 📝 TEXT NODE (narrative) - Length:', text.length);
                narrative += text;
            }
            return;
        }

        // Handle element nodes
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const child = node;
        const tagName = child.tagName.toLowerCase();
        const text = child.textContent.trim();
        const styleAttr = child.getAttribute('style') || '';

        // Get class attribute
        const classAttr = child.getAttribute('class') || '';

        // CRITICAL: NEVER trim reasoning blocks or SillyTavern system elements
        const isSystemElement =
            classAttr.includes('mes_reasoning') || // Reasoning blocks
            classAttr.includes('mes_text') || // Message text container
            classAttr.includes('mes_block') || // Message block
            classAttr.includes('swipe') || // Swipe navigation
            classAttr.includes('avatar') || // Avatar images
            tagName === 'svg' || // Icons and graphics
            child.hasAttribute('data-type'); // SillyTavern data attributes

        // If it's a system element, ALWAYS keep it as narrative (visible)
        if (isSystemElement) {
            narrative += child.outerHTML;
            return; // Skip to next element
        }

        // UNIVERSAL UI BLOCK DETECTION - based on structural complexity, not keywords
        const complexityScore = calculateComplexityScore(child);
        const isUIBlock = complexityScore >= 5;

        console.log(`NemoNet HTML Trimmer: 🔍 Evaluating ${tagName} - Score: ${complexityScore}, isUIBlock: ${isUIBlock}`);

        // NARRATIVE detection - prioritize keeping content
        const isNarrative =
            tagName === 'p' || // Paragraphs are always narrative
            tagName === 'blockquote' || // Quotes are always narrative
            tagName === 'font' || // Font tags (colored dialogue) are always narrative
            tagName === 'br'; // Line breaks

        if (isUIBlock) {
            debugLog(' ✅ UI BLOCK DETECTED - Complexity Score:', complexityScore);
            console.log('  - Tag:', tagName);
            console.log('  - Style length:', styleAttr.length);
            console.log('  - Text preview:', text.substring(0, 80));
            uiBlocks.push(child.outerHTML);
        } else {
            // DEFAULT TO NARRATIVE - preserve all story content (paragraphs, dialogue, cutaways)
            debugLog(' 📝 NARRATIVE - Complexity Score:', complexityScore, '- Tag:', tagName);

            // SPECIAL CASE: If this is a <font> wrapper with children, recursively process them
            // This handles broken HTML where <font> wraps multiple <p> tags AND UI blocks
            if (tagName === 'font' && child.children.length > 0) {
                debugLog(' 🔧 Font wrapper detected with', child.children.length, 'children - processing recursively');
                debugLog(' 🔧 Font wrapper outerHTML preview:', child.outerHTML.substring(0, 200));

                // Recursively process children of the font tag
                Array.from(child.children).forEach((fontChild, childIndex) => {
                    console.log(`NemoNet HTML Trimmer: 🔧 Processing font child #${childIndex}:`, fontChild.tagName);

                    // Use helper function to calculate complexity
                    const childComplexity = calculateComplexityScore(fontChild);
                    const isChildUIBlock = childComplexity >= 5;

                    if (isChildUIBlock) {
                        debugLog(' 🔧  -> Child is UI block (score:', childComplexity, '), archiving');
                        uiBlocks.push(fontChild.outerHTML);
                    } else {
                        debugLog(' 🔧  -> Child is narrative (score:', childComplexity, '), keeping');
                        narrative += fontChild.outerHTML;
                    }
                });
            } else {
                narrative += child.outerHTML;
            }
        }
    });

    debugLog(' 🔍 SEPARATION COMPLETE');
    debugLog(' 🔍 Narrative length:', narrative.length, 'chars');
    debugLog(' 🔍 UI blocks found:', uiBlocks.length);
    debugLog(' 🔍 Narrative preview:', narrative.substring(0, 300));

    return { narrative: narrative.trim(), uiBlocks };
}


/**
 * Trim HTML from a single message by archiving UI elements but keeping narrative
 */
function trimMessageHTML(messageContent) {
    try {
        if (!shouldTrimHTML(messageContent)) {
            debugLog(' Message does not meet trimming criteria (not enough HTML tags)');
            return messageContent; // No trimming needed
        }

        debugLog(' ===== STARTING TRIM PROCESS =====');
        debugLog(' Original message length:', messageContent.length);
        debugLog(' Original HTML preview:', messageContent.substring(0, 500));

        // Check if the message content is wrapped in a mes_text div
        // If so, we need to extract the innerHTML, process it, then wrap it back
        let mesTextWrapper = null;
        let contentToProcess = messageContent;

        const temp = document.createElement('div');
        temp.innerHTML = messageContent;

        // If the first child is a mes_text div, extract it
        if (temp.children.length === 1 && temp.children[0].classList.contains('mes_text')) {
            mesTextWrapper = temp.children[0];
            contentToProcess = mesTextWrapper.innerHTML;
            debugLog(' 🔍 Detected mes_text wrapper, processing innerHTML only');
            debugLog(' 🔍 Content to process preview:', contentToProcess.substring(0, 300));
        }

        // Separate narrative from UI blocks
        const { narrative, uiBlocks } = separateNarrativeFromUI(contentToProcess);

        debugLog(' Found', uiBlocks.length, 'UI blocks to archive');
        debugLog(' Narrative length:', narrative.length);

        if (uiBlocks.length === 0) {
            debugLog(' No UI blocks found to archive (complexity too low)');
            return messageContent;
        }

        // CRITICAL: If narrative is empty, don't trim! This would delete all story content.
        if (narrative.length === 0 || narrative.trim().length < 100) {
            console.error('NemoNet HTML Trimmer: ❌ ABORTED - Narrative is empty or too short! This would delete story content.');
            console.error('NemoNet HTML Trimmer: This message appears to have unusual HTML structure. Skipping trim.');
            return messageContent;
        }

        // Convert UI blocks to ASCII-formatted text that preserves visual structure
        debugLog(' Converting UI blocks to ASCII...');
        const uiASCII = uiBlocks.map(html => convertHTMLToASCII(html)).join('\n\n');

    // Create archived UI dropdown with ASCII content
    const archivedUI = `<details class="nemo-archived-ui" style="border: 1px solid #555; border-radius: 6px; padding: 8px; margin: 8px 0; background: rgba(30,30,30,0.5);">
<summary style="cursor: pointer; font-weight: bold; font-size: 0.95em; color: #888; user-select: none;">
📦 Archived UI Elements (Click to expand)
</summary>
<div style="padding: 12px 8px; font-size: 0.85em; color: #aaa; line-height: 1.5; white-space: pre-wrap; max-height: 300px; overflow-y: auto; font-family: 'Courier New', monospace;">
${uiASCII}
</div>
</details>`;

    // Combine: narrative first, then archived UI
    let result = narrative + '\n' + archivedUI;

        // If we extracted from a mes_text wrapper, wrap the result back
        if (mesTextWrapper) {
            mesTextWrapper.innerHTML = result;
            result = mesTextWrapper.outerHTML;
            debugLog(' 🔍 Wrapped result back in mes_text div');
        }

        const savedChars = messageContent.length - result.length;
        if (savedChars > 0) {
            console.log(`NemoNet HTML Trimmer: Saved ${savedChars} characters (${Math.round(savedChars / messageContent.length * 100)}%)`);
        } else {
            console.log(`NemoNet HTML Trimmer: UI archived (${result.length} chars vs ${messageContent.length} original)`);
        }

        debugLog(' ===== TRIM COMPLETE =====');
        return result;
    } catch (error) {
        console.error('NemoNet HTML Trimmer: ERROR during trimming:', error);
        console.error('NemoNet HTML Trimmer: Stack trace:', error.stack);
        return messageContent; // Return original on error
    }
}

/**
 * Update message DOM to reflect trimmed content
 */
function updateMessageDOM(messageId, message) {
    const messageBlock = document.querySelector(`[mesid="${messageId}"]`);
    if (!messageBlock) {
        console.warn(`NemoNet HTML Trimmer: Could not find message block for ID ${messageId}`);
        return;
    }

    const mesTextDiv = messageBlock.querySelector('.mes_text');
    if (!mesTextDiv) {
        console.warn(`NemoNet HTML Trimmer: Could not find .mes_text in message ${messageId}`);
        return;
    }

    // Update the message content
    mesTextDiv.innerHTML = message.mes;

    // Force browser repaint
    void mesTextDiv.offsetHeight;

    console.log(`NemoNet HTML Trimmer: Updated DOM for message ${messageId}`);
}

/**
 * Process old messages and trim HTML
 * @param {number} messagesToKeep - How many recent messages to keep untouched (default: 4)
 */
export function trimOldMessagesHTML(messagesToKeep = 4) {
    console.log(`NemoNet HTML Trimmer: Starting trim of messages older than ${messagesToKeep} messages back...`);

    const context = getContext();
    const chat = context?.chat;

    if (!chat || chat.length === 0) {
        debugLog(' No messages to process');
        return { processed: 0, trimmed: 0, saved: 0 };
    }

    let processedCount = 0;
    let trimmedCount = 0;
    let totalSaved = 0;
    const updatedMessageIds = [];

    // Calculate how many messages from the end to start processing
    const startIndex = Math.max(0, chat.length - messagesToKeep);

    // Process messages from oldest to the threshold
    for (let i = 0; i < startIndex; i++) {
        const message = chat[i];

        if (!message || !message.mes) {
            continue;
        }

        processedCount++;
        const originalLength = message.mes.length;

        // Trim HTML from message
        const trimmedContent = trimMessageHTML(message.mes);

        if (trimmedContent !== message.mes) {
            message.mes = trimmedContent;
            trimmedCount++;
            totalSaved += (originalLength - trimmedContent.length);

            // Track which messages need DOM updates
            updatedMessageIds.push(i);
        }
    }

    if (trimmedCount > 0) {
        // Save the chat
        context.saveChat();

        console.log(`NemoNet HTML Trimmer: ✅ Complete! Processed ${processedCount} messages, trimmed ${trimmedCount}, saved ${totalSaved} characters`);
        debugLog(' Reloading chat to apply formatting...');

        // Trigger a full chat reload to re-render messages with proper formatting
        // This ensures SillyTavern re-applies all its native rendering (wrapping text in <p> tags, etc.)
        setTimeout(() => {
            if (typeof context.reloadCurrentChat === 'function') {
                context.reloadCurrentChat();
                debugLog(' ✅ Chat reloaded successfully');
            } else {
                console.warn('NemoNet HTML Trimmer: reloadCurrentChat not available, formatting may appear broken until page refresh');
                debugLog(' 💡 Tip: Click the edit button on the message to see proper formatting');
            }
        }, 100);
    } else {
        console.log(`NemoNet HTML Trimmer: No messages needed trimming`);
    }

    return {
        processed: processedCount,
        trimmed: trimmedCount,
        saved: totalSaved
    };
}

/**
 * Auto-trim on message send (if enabled)
 */
export function setupAutoTrim() {
    debugLog(' Setting up auto-trim hooks...');

    // Import eventSource
    import('/script.js').then(scriptModule => {
        const eventSource = scriptModule.eventSource;

        if (!eventSource) {
            console.error('NemoNet HTML Trimmer: Failed to import eventSource');
            return;
        }

        // Trim old messages when new message is sent
        eventSource.on('MESSAGE_SENT', () => {
            const settings = extension_settings.NemoPresetExt;

            if (settings?.enableHTMLTrimming) {
                const keepMessages = settings.htmlTrimmingKeepCount || 4;
                debugLog(' Auto-trimming triggered (keeping last', keepMessages, 'messages)');

                // Small delay to ensure message is saved
                setTimeout(() => {
                    trimOldMessagesHTML(keepMessages);
                }, 500);
            }
        });

        debugLog(' ✅ Auto-trim hooks registered');
    });
}
