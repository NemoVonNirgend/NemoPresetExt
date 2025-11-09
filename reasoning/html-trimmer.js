/**
 * HTML Trimmer for Old Messages
 * Converts complex HTML/CSS blocks in old messages into simple text dropdowns
 * to reduce context usage while preserving information
 */

import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';

let getContext;

/**
 * Initialize the HTML trimmer module
 */
export function initializeHTMLTrimmer() {
    console.log('NemoNet HTML Trimmer: Initializing...');

    // Import getContext from SillyTavern
    import('/scripts/extensions.js').then(module => {
        if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
            getContext = SillyTavern.getContext;
        } else {
            // Fallback: Try to find it in window scope
            getContext = () => window.SillyTavern?.getContext?.() || { chat: [] };
        }
        console.log('NemoNet HTML Trimmer: getContext imported');
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
    const totalWidth = columnWidths.reduce((sum, w) => sum + w + 3, 1);
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
 * Extract text content from HTML, removing all tags and styles (legacy fallback)
 */
function extractTextFromHTML(html) {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove script and style elements
    const scripts = temp.querySelectorAll('script, style');
    scripts.forEach(el => el.remove());

    // Get text content
    let text = temp.textContent || temp.innerText || '';

    // Clean up whitespace
    text = text
        .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
        .replace(/[ \t]+/g, ' ')    // Normalize spaces
        .trim();

    return text;
}

/**
 * Convert HTML block to simple text format (no dropdown wrapper)
 */
function convertHTMLToText(html) {
    const textContent = extractTextFromHTML(html);

    if (!textContent || textContent.length < 10) {
        // If no meaningful content, return empty
        return '';
    }

    // Return just the text content, no wrapper
    return textContent;
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

    console.log('NemoNet HTML Trimmer: 🔧 AUTO-REPAIR: Input has', temp.children.length, 'top-level children');

    // Find all font tags that wrap multiple children
    const fontTags = temp.querySelectorAll('font');
    console.log('NemoNet HTML Trimmer: 🔧 AUTO-REPAIR: Found', fontTags.length, 'font tags total');

    fontTags.forEach((fontTag, index) => {
        console.log(`NemoNet HTML Trimmer: 🔧 AUTO-REPAIR: Font tag #${index} has`, fontTag.children.length, 'children');

        // If a font tag has more than 2 children, it's likely a broken wrapper
        // Unwrap its children to the parent level
        if (fontTag.children.length > 2) {
            console.log('NemoNet HTML Trimmer: 🔧 AUTO-REPAIR: Unwrapping font tag with', fontTag.children.length, 'children');
            console.log('NemoNet HTML Trimmer: 🔧 AUTO-REPAIR: Children tags:', Array.from(fontTag.children).map(c => c.tagName).join(', '));

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

    console.log('NemoNet HTML Trimmer: 🔧 AUTO-REPAIR: After repair, has', temp.children.length, 'top-level children');
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

    console.log('NemoNet HTML Trimmer: 🔍 STARTING SEPARATION - Total top-level children:', temp.children.length);
    console.log('NemoNet HTML Trimmer: 🔍 Total child nodes (including text):', temp.childNodes.length);

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
                console.log('NemoNet HTML Trimmer: 📝 TEXT NODE (narrative) - Length:', text.length);
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

        // Count visual complexity indicators
        const hasGradient = styleAttr.includes('linear-gradient') || styleAttr.includes('radial-gradient');
        const hasBorder = styleAttr.includes('border:') || styleAttr.includes('border-radius:');
        const hasShadow = styleAttr.includes('box-shadow') || styleAttr.includes('text-shadow');
        const hasBackground = styleAttr.includes('background:') || styleAttr.includes('background-color:');
        const hasGrid = styleAttr.includes('grid-template') || styleAttr.includes('display: grid') || styleAttr.includes('display:grid');
        const hasFlex = styleAttr.includes('display: flex') || styleAttr.includes('display:flex');

        // Check for nested structure (UI panels usually have nested elements)
        const hasNestedDetails = child.querySelector('details') !== null;
        const hasNestedDivs = child.querySelectorAll('div').length > 2;
        const hasProgressBars = child.querySelectorAll('[style*="width:"][style*="height"]').length > 0;
        const hasEmbeddedStyles = child.querySelector('style') !== null; // Embedded <style> tags

        // Check for long inline styles (UI panels have extensive styling)
        const hasComplexStyling = styleAttr.length > 150;

        // Calculate complexity score
        let complexityScore = 0;
        if (hasGradient) complexityScore += 2;
        if (hasBorder) complexityScore += 1;
        if (hasShadow) complexityScore += 1;
        if (hasBackground) complexityScore += 1;
        if (hasGrid || hasFlex) complexityScore += 1;
        if (hasNestedDetails) complexityScore += 2;
        if (hasNestedDivs) complexityScore += 1;
        if (hasProgressBars) complexityScore += 2;
        if (hasComplexStyling) complexityScore += 2;
        if (hasEmbeddedStyles) complexityScore += 3; // Embedded <style> tags are a strong UI indicator

        // UI block = high complexity score (5+)
        // Archive ALL complex HTML blocks, including cutaways
        // Cutaways are preserved in the archive as ASCII, keeping them in context
        const isUIBlock = complexityScore >= 5;

        console.log(`NemoNet HTML Trimmer: 🔍 Evaluating ${tagName} - Score: ${complexityScore}, isUIBlock: ${isUIBlock}`);

        // NARRATIVE detection - prioritize keeping content
        const isNarrative =
            tagName === 'p' || // Paragraphs are always narrative
            tagName === 'blockquote' || // Quotes are always narrative
            tagName === 'font' || // Font tags (colored dialogue) are always narrative
            tagName === 'br'; // Line breaks

        if (isUIBlock) {
            console.log('NemoNet HTML Trimmer: ✅ UI BLOCK DETECTED - Complexity Score:', complexityScore);
            console.log('  - Tag:', tagName);
            console.log('  - Style length:', styleAttr.length);
            console.log('  - Text preview:', text.substring(0, 80));
            console.log('  - Gradient:', hasGradient, '| Border:', hasBorder, '| Shadow:', hasShadow);
            console.log('  - Nested divs:', hasNestedDivs, '| Nested details:', hasNestedDetails);
            uiBlocks.push(child.outerHTML);
        } else {
            // DEFAULT TO NARRATIVE - preserve all story content (paragraphs, dialogue, cutaways)
            console.log('NemoNet HTML Trimmer: 📝 NARRATIVE - Complexity Score:', complexityScore, '- Tag:', tagName);

            // SPECIAL CASE: If this is a <font> wrapper with children, recursively process them
            // This handles broken HTML where <font> wraps multiple <p> tags AND UI blocks
            if (tagName === 'font' && child.children.length > 0) {
                console.log('NemoNet HTML Trimmer: 🔧 Font wrapper detected with', child.children.length, 'children - processing recursively');
                console.log('NemoNet HTML Trimmer: 🔧 Font wrapper outerHTML preview:', child.outerHTML.substring(0, 200));

                // Recursively process children of the font tag
                Array.from(child.children).forEach((fontChild, childIndex) => {
                    console.log(`NemoNet HTML Trimmer: 🔧 Processing font child #${childIndex}:`, fontChild.tagName);
                    const childTag = fontChild.tagName.toLowerCase();
                    const childStyle = fontChild.getAttribute('style') || '';

                    // Re-check if this child is a UI block
                    const childGradient = childStyle.includes('linear-gradient') || childStyle.includes('radial-gradient');
                    const childBorder = childStyle.includes('border:') || childStyle.includes('border-radius:');
                    const childShadow = childStyle.includes('box-shadow');
                    const childBackground = childStyle.includes('background:');
                    const childGrid = childStyle.includes('grid-template') || childStyle.includes('display: grid') || childStyle.includes('display:grid');
                    const childFlex = childStyle.includes('display: flex') || childStyle.includes('display:flex');
                    const childNestedDetails = fontChild.querySelector('details') !== null;
                    const childNestedDivs = fontChild.querySelectorAll('div').length > 2;
                    const childComplexStyling = childStyle.length > 150;

                    let childComplexity = 0;
                    if (childGradient) childComplexity += 2;
                    if (childBorder) childComplexity += 1;
                    if (childShadow) childComplexity += 1;
                    if (childBackground) childComplexity += 1;
                    if (childGrid || childFlex) childComplexity += 1;
                    if (childNestedDetails) childComplexity += 2;
                    if (childNestedDivs) childComplexity += 1;
                    if (childComplexStyling) childComplexity += 2;

                    // Archive all complex blocks (including cutaways)
                    const isChildUIBlock = childComplexity >= 5;

                    if (isChildUIBlock) {
                        console.log('NemoNet HTML Trimmer: 🔧  -> Child is UI block (score:', childComplexity, '), archiving');
                        uiBlocks.push(fontChild.outerHTML);
                    } else {
                        console.log('NemoNet HTML Trimmer: 🔧  -> Child is narrative (score:', childComplexity, '), keeping');
                        narrative += fontChild.outerHTML;
                    }
                });
            } else {
                narrative += child.outerHTML;
            }
        }
    });

    console.log('NemoNet HTML Trimmer: 🔍 SEPARATION COMPLETE');
    console.log('NemoNet HTML Trimmer: 🔍 Narrative length:', narrative.length, 'chars');
    console.log('NemoNet HTML Trimmer: 🔍 UI blocks found:', uiBlocks.length);
    console.log('NemoNet HTML Trimmer: 🔍 Narrative preview:', narrative.substring(0, 300));

    return { narrative: narrative.trim(), uiBlocks };
}


/**
 * Trim HTML from a single message by archiving UI elements but keeping narrative
 */
function trimMessageHTML(messageContent) {
    try {
        if (!shouldTrimHTML(messageContent)) {
            console.log('NemoNet HTML Trimmer: Message does not meet trimming criteria (not enough HTML tags)');
            return messageContent; // No trimming needed
        }

        console.log('NemoNet HTML Trimmer: ===== STARTING TRIM PROCESS =====');
        console.log('NemoNet HTML Trimmer: Original message length:', messageContent.length);
        console.log('NemoNet HTML Trimmer: Original HTML preview:', messageContent.substring(0, 500));

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
            console.log('NemoNet HTML Trimmer: 🔍 Detected mes_text wrapper, processing innerHTML only');
            console.log('NemoNet HTML Trimmer: 🔍 Content to process preview:', contentToProcess.substring(0, 300));
        }

        // Separate narrative from UI blocks
        const { narrative, uiBlocks } = separateNarrativeFromUI(contentToProcess);

        console.log('NemoNet HTML Trimmer: Found', uiBlocks.length, 'UI blocks to archive');
        console.log('NemoNet HTML Trimmer: Narrative length:', narrative.length);

        if (uiBlocks.length === 0) {
            console.log('NemoNet HTML Trimmer: No UI blocks found to archive (complexity too low)');
            return messageContent;
        }

        // CRITICAL: If narrative is empty, don't trim! This would delete all story content.
        if (narrative.length === 0 || narrative.trim().length < 100) {
            console.error('NemoNet HTML Trimmer: ❌ ABORTED - Narrative is empty or too short! This would delete story content.');
            console.error('NemoNet HTML Trimmer: This message appears to have unusual HTML structure. Skipping trim.');
            return messageContent;
        }

        // Convert UI blocks to ASCII-formatted text that preserves visual structure
        console.log('NemoNet HTML Trimmer: Converting UI blocks to ASCII...');
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
            console.log('NemoNet HTML Trimmer: 🔍 Wrapped result back in mes_text div');
        }

        const savedChars = messageContent.length - result.length;
        if (savedChars > 0) {
            console.log(`NemoNet HTML Trimmer: Saved ${savedChars} characters (${Math.round(savedChars / messageContent.length * 100)}%)`);
        } else {
            console.log(`NemoNet HTML Trimmer: UI archived (${result.length} chars vs ${messageContent.length} original)`);
        }

        console.log('NemoNet HTML Trimmer: ===== TRIM COMPLETE =====');
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
        console.log('NemoNet HTML Trimmer: No messages to process');
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
        console.log('NemoNet HTML Trimmer: Reloading chat to apply formatting...');

        // Trigger a full chat reload to re-render messages with proper formatting
        // This ensures SillyTavern re-applies all its native rendering (wrapping text in <p> tags, etc.)
        setTimeout(() => {
            if (typeof context.reloadCurrentChat === 'function') {
                context.reloadCurrentChat();
                console.log('NemoNet HTML Trimmer: ✅ Chat reloaded successfully');
            } else {
                console.warn('NemoNet HTML Trimmer: reloadCurrentChat not available, formatting may appear broken until page refresh');
                console.log('NemoNet HTML Trimmer: 💡 Tip: Click the edit button on the message to see proper formatting');
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
    console.log('NemoNet HTML Trimmer: Setting up auto-trim hooks...');

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
                console.log('NemoNet HTML Trimmer: Auto-trimming triggered (keeping last', keepMessages, 'messages)');

                // Small delay to ensure message is saved
                setTimeout(() => {
                    trimOldMessagesHTML(keepMessages);
                }, 500);
            }
        });

        console.log('NemoNet HTML Trimmer: ✅ Auto-trim hooks registered');
    });
}
