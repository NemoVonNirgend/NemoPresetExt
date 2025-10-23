# Historical Cleanup & Code Detection System

## Overview

This document describes two integrated systems that enhance content processing in SillyTavern:

1. **Historical Cleanup System** - Removes HTML/CSS from older messages while preserving text content
2. **Ember Code Detection** - Intelligently distinguishes actual code from narrative text in code blocks

## Historical Cleanup System

### Purpose
The Historical Cleanup system processes older chat messages (2+ positions back from current) to remove HTML and CSS formatting while preserving the actual text content. This helps maintain clean chat history without losing important narrative information.

### Components

#### 1. Regex Rules (`regex_rules.json`)
Added 10 new static regex patterns (STATIC_052 through STATIC_061):

- **STATIC_052**: HTML tags with content preservation
- **STATIC_053**: Inline style attributes
- **STATIC_054**: CSS style blocks
- **STATIC_055**: Script tags and content
- **STATIC_056**: HTML comments
- **STATIC_057**: Class and ID attributes
- **STATIC_058**: Data attributes
- **STATIC_059**: Orphaned closing tags
- **STATIC_060**: Self-closing tags
- **STATIC_061**: HTML entities (preserves common ones)

#### 2. HistoricalCleanup Class (`historical-cleanup.js`)
Main processing engine that:
- Identifies messages old enough to process (configurable age threshold)
- Applies regex patterns to remove HTML/CSS
- Preserves text content and basic formatting
- Normalizes whitespace
- Provides testing utilities

#### 3. Integration (`prosepolisher-main.js`)
Automatically initialized with ProsePolisher and exposed globally for access.

### Usage

#### Basic Usage
```javascript
// Access the cleanup system
const cleanup = window.ProsePolisher.historicalCleanup;

// Process a single message
const cleaned = cleanup.cleanupMessage(messageText);

// Process an array of messages
const messages = [/* array of message objects */];
const processed = cleanup.processMessages(messages);
```

#### Configuration
```javascript
// Enable/disable the system
cleanup.setEnabled(true);

// Set minimum message age (default: 2)
cleanup.setMinMessageAge(3); // Only process messages 3+ positions back

// Enable debug mode for logging
cleanup.setDebugMode(true);
```

#### Testing
```javascript
// Run comprehensive test suite
testHistoricalCleanup();

// Test custom input
testCustomCleanup('<div style="color: red;">Hello</div>');

// Get detailed test results
const result = cleanup.testCleanup(content);
console.log(result);
// {
//   before: "original content",
//   after: "cleaned content",
//   patternsUsed: 10,
//   lengthBefore: 150,
//   lengthAfter: 80,
//   reduction: "46.67%"
// }
```

### Examples

#### Example 1: HTML with Inline Styles
```javascript
const input = `
<div class="message" style="color: red; padding: 10px;">
    Hello world! This is important text.
    <p style="margin: 5px;">More text here</p>
</div>
`;

const output = cleanup.cleanupMessage(input);
// Result: "Hello world! This is important text.\nMore text here"
```

#### Example 2: CSS Blocks
```javascript
const input = `
Some narrative text before
<style>
    .message { color: red; }
    #container { background: blue; }
</style>
The story continues here
`;

const output = cleanup.cleanupMessage(input);
// Result: "Some narrative text before\nThe story continues here"
```

#### Example 3: Mixed Content
```javascript
const input = `
<div style="padding: 10px;">
    She whispered, "I've been waiting for you."
    <style>.temp { display: none; }</style>
    He smiled in response.
</div>
`;

const output = cleanup.cleanupMessage(input);
// Result: "She whispered, \"I've been waiting for you.\"\nHe smiled in response."
```

## Ember Code Detection System

### Purpose
Prevents the Ember extension from processing narrative/roleplay text that happens to be formatted in code blocks (```), while still processing actual code (HTML, JavaScript, CSS).

### Implementation

#### Enhanced Code Detection Methods

Added to `UniversalRenderer.js`:

1. **`isActualCode(content, language)`** - Main detection method
2. **`isActualHtml(content)`** - Validates HTML code
3. **`isActualCss(content)`** - Validates CSS code
4. **`isActualJavaScript(content)`** - Validates JavaScript code

#### Detection Logic

**JavaScript Detection:**
- Checks for actual code patterns (functions, variables, operators)
- Identifies narrative patterns (dialogue, actions, emotions)
- Uses scoring system: code patterns vs narrative patterns
- Requires 2+ code patterns and < 3 narrative patterns

**HTML Detection:**
- Verifies presence of actual HTML tags
- Checks for HTML structure (DOCTYPE, html, head, body)
- Filters out narrative text with occasional HTML entities
- Requires legitimate HTML structure without heavy narrative content

**CSS Detection:**
- Looks for CSS rule blocks `{ }`
- Validates selectors (class, ID)
- Checks for property:value pairs
- Identifies CSS at-rules (@media, @import, etc.)

### Usage in Ember

The detection is automatically integrated into Ember's code block extraction:

```javascript
extractCodeBlocks(text) {
    const blocks = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(text)) !== null) {
        const language = match[1] || 'javascript';
        const code = match[2];
        
        // Only process if it's actual code
        if (this.isActualCode(code, language)) {
            blocks.push({ language, code });
        }
    }
    
    return blocks;
}
```

### Examples

#### Example 1: Narrative in Code Blocks (NOT processed)
```javascript
const text = `
\`\`\`
She said softly, "I've been thinking about what you told me."
He nodded, understanding the weight of her words.
They sat together in comfortable silence.
\`\`\`
`;

// isActualCode() returns false
// Ember will NOT process this as code
```

#### Example 2: Actual JavaScript (IS processed)
```javascript
const text = `
\`\`\`javascript
function processData(items) {
    const results = items.map(item => {
        return item.value * 2;
    });
    return results;
}
\`\`\`
`;

// isActualCode() returns true
// Ember WILL process this as code
```

#### Example 3: Actual HTML (IS processed)
```javascript
const text = `
\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <div id="container">Content here</div>
</body>
</html>
\`\`\`
`;

// isActualCode() returns true
// Ember WILL process this as HTML
```

## Testing

### Historical Cleanup Tests

Load the test file in browser console:
```javascript
// Auto-loaded if you add ?autotest=true to URL
// Or manually run:
testHistoricalCleanup();
```

Test output includes:
- ✅/❌ Pass/fail indicators
- Before/after comparisons
- Statistics (length reduction, patterns used)
- Summary of all test results

### Ember Code Detection Tests

```javascript
testEmberDetection();
```

Shows sample content and what would/wouldn't be processed as code.

## Configuration Options

### Historical Cleanup Settings

```javascript
const cleanup = window.ProsePolisher.historicalCleanup;

// Core settings
cleanup.setEnabled(true);              // Enable/disable system
cleanup.setMinMessageAge(2);           // Messages to skip (default: 2)
cleanup.setDebugMode(false);           // Enable debug logging

// Check if a message should be processed
const shouldProcess = cleanup.shouldProcessMessage(
    messageIndex,  // Current message index
    totalMessages  // Total messages in chat
);
```

### Regex Pattern Access

```javascript
const regexManager = window.ProsePolisher.regexManager;

// Get specific cleanup rule
const rule = regexManager.getRule('STATIC_052');

// Get all cleanup patterns
const cleanup = window.ProsePolisher.historicalCleanup;
const patterns = cleanup.getCleanupPatterns();
```

## Integration with Other Systems

### ProsePolisher Integration
- Automatically initialized when ProsePolisher loads
- Uses ProsePolisher's regex management system
- Shares regex rules and compilation engine
- Exposed via `window.ProsePolisher.historicalCleanup`

### Ember Integration
- Code detection is transparent to users
- Automatically filters out non-code content
- Preserves actual code for processing
- No configuration needed

## Troubleshooting

### Historical Cleanup Not Working

1. Check if ProsePolisher is loaded:
```javascript
console.log(window.ProsePolisher);
```

2. Check if Historical Cleanup is initialized:
```javascript
console.log(window.ProsePolisher.historicalCleanup);
```

3. Verify it's enabled:
```javascript
window.ProsePolisher.historicalCleanup.isEnabled;
```

4. Run diagnostic tests:
```javascript
testHistoricalCleanup();
```

### Code Blocks Not Being Processed

If actual code isn't being processed by Ember:

1. Check the language tag:
```markdown
\`\`\`javascript
// Should specify language
\`\`\`
```

2. Ensure code has sufficient code patterns:
```javascript
// Too simple (might be filtered):
\`\`\`
x = 5
\`\`\`

// Better (clear code structure):
\`\`\`javascript
const x = 5;
function process() { return x * 2; }
\`\`\`
```

3. Enable debug mode to see detection scores:
```javascript
// Add logging to isActualCode method if needed
```

### Narrative Being Processed as Code

If narrative is incorrectly identified as code:

1. Ensure narrative patterns are clear:
   - Use character names
   - Include dialogue tags (said, whispered, etc.)
   - Add action descriptions
   - Use proper formatting (quotes, asterisks)

2. Avoid code-like patterns in narrative:
   - Minimize use of `function`, `return`, etc. as regular words
   - Avoid excessive `=` or `()` in narrative

## Performance Considerations

- Historical cleanup only processes old messages (2+ back)
- Recent messages (last 1-2) are NOT processed for performance
- Regex compilation is cached by ProsePolisher
- Code detection runs only when extracting code blocks
- All operations are synchronous for predictable behavior

## Future Enhancements

Potential improvements:

1. **Configurable cleanup rules** - Allow users to select which HTML/CSS to remove
2. **Whitelist tags** - Preserve specific HTML tags (e.g., `<br>`, `<em>`)
3. **Smart entity handling** - Better preservation of important HTML entities
4. **Code detection tuning** - Adjustable thresholds for code vs narrative
5. **Batch processing** - Process multiple messages efficiently
6. **Custom pattern support** - User-defined cleanup patterns

## API Reference

### HistoricalCleanup Class

#### Methods

- `initialize()` - Async initialization
- `processMessages(messages)` - Process message array
- `cleanupMessage(content)` - Clean single message
- `getCleanupPatterns()` - Get regex patterns
- `normalizeWhitespace(text)` - Clean up whitespace
- `shouldProcessMessage(index, total)` - Check if should process
- `setEnabled(enabled)` - Enable/disable system
- `setMinMessageAge(age)` - Set minimum age threshold
- `setDebugMode(enabled)` - Toggle debug logging
- `testCleanup(content)` - Test cleanup on content

#### Properties

- `minMessageAge` - Minimum message positions to skip (default: 2)
- `isEnabled` - System enabled state
- `debugMode` - Debug logging state

### UniversalRenderer Methods

#### Code Detection Methods

- `isActualCode(content, language)` - Main detection
- `isActualJavaScript(content)` - JS validation
- `isActualHtml(content)` - HTML validation
- `isActualCss(content)` - CSS validation
- `looksLikeCode(text)` - Legacy compatibility method

## Support

For issues or questions:
1. Check console for error messages
2. Run test suite for diagnostics
3. Enable debug mode for detailed logging
4. Review regex patterns in `regex_rules.json`
5. Check integration in `prosepolisher-main.js`

---

**Version**: 1.0.0  
**Last Updated**: 2025-10-23  
**Dependencies**: ProsePolisher, Ember Extension