# Robust Reasoning Parser for NemoNet CoT

## Overview

The Robust Reasoning Parser is a multi-strategy system designed to reliably capture Chain of Thought (CoT) reasoning blocks from LLM outputs, even when tags are incomplete, malformed, or missing entirely.

### The Problem

SillyTavern's default reasoning capture uses a simple regex pattern that requires:
1. **Both** prefix (`<think>`) and suffix (`</think>`) tags to be present
2. Tags to be properly formed
3. Reasoning to start at a specific position

This fails when:
- Models forget to close the `</think>` tag
- Tags are truncated during streaming (`</thin` instead of `</think>`)
- Reasoning content appears without proper tags
- Complex CoT formats like NemoNet's Council of Vex have multiple sections

### The Solution

A **cascading strategy system** that tries multiple detection methods in order of confidence:

## Detection Strategies

### Strategy 1: Perfect Match (Confidence: 100)
**When:** Both opening and closing tags are present and well-formed

Searches for the standard pattern: `<think>.....</think>`

Also checks alternative tags:
- `<thinking>.....</thinking>`
- `<thought>.....</thought>`

### Strategy 2: Partial Suffix (Confidence: 90)
**When:** Opening tag present, closing tag is incomplete

Detects partial closing tags like:
- `</thin` (missing `k>`)
- `</t` (heavily truncated)
- `</thi` (mid-truncation)

Generates all possible substrings of the closing tag and matches the longest one found.

### Strategy 3: Missing Suffix (Confidence: 85)
**When:** Opening tag present, no closing tag at all

Uses multiple methods to find where reasoning ends:

#### Method 1: Narration Markers
Looks for explicit markers that indicate narrative has started:
- `Narration:`
- `NARRATION FOLLOWS`
- `{{newline}}`

#### Method 2: End Markers
Searches for CoT conclusion markers:
- `END OF THINKING - CLOSING THINKING NOW`
- `END OF THINKING`
- `CLOSING THINKING NOW`

#### Method 3: Structural Transition
Detects when content shifts from structured CoT to prose:
```
STORY SECTION 7: FINAL REVIEW    <- Structured CoT
═══════════════════════════════    <- Border
                                   <- Empty line
The hero walked forward.           <- Prose (reasoning ends here)
```

#### Method 4: Fallback
If no clear end is found, uses the entire remaining text as reasoning (better to over-capture than miss content).

### Strategy 4: Content Markers (Confidence: 75)
**When:** No tags present, but content contains distinctive CoT markers

Analyzes text for NemoNet-specific patterns:
- Section headers (`STORY SECTION 1:`, `STORY SECTION 2:`, etc.)
- Process markers (`NEMONET WORLD EXPLORATION`, `Council of Vex`)
- Structural elements (`Exploration 1:`, `♢`, `◆`, borders)

Requires at least **3 markers** to be confident it's reasoning content.

Special boost: If **4+ story sections** are detected, confidence increases to 85 (indicates complete NemoNet CoT).

### Strategy 5: Heuristic (Confidence: 60)
**When:** All other strategies fail, last resort

Analyzes structural patterns:
- Presence of box drawing (`═══`, `───`)
- Bullet points (`♢`, `◆`, `-`)
- Section headers (`WORD:`, `PHRASE:`)
- Bracketed notes (`[content]`)

Looks for transition from structured content to narrative prose, then splits at that point.

## NemoNet-Specific Features

### Custom Markers
The parser is pre-configured with all NemoNet CoT markers:

**Core Structure:**
- `NEMONET WORLD EXPLORATION`
- `Council of Vex`
- `NemoAdmin-107`
- `Begin Council of Vex Thought Process`

**Story Sections:**
- `STORY SECTION 1:` through `STORY SECTION 7:`
- `NEMO NET AWAKENING`
- `GATHERING THE THREADS`
- `SCENE CALIBRATION`
- `COUNCIL CONVERSATION`
- `RESOLUTION`
- `CRAFTING`
- `Custom CoT`

**Council Personas:**
- `_Specialist:` (e.g., `Alice_Specialist:`)
- `Plot_Vex:`
- `Romantic_Vex:`
- `Action_Vex:`
- `Mystery_Vex:`
- `Comedy_Vex:`
- `Danger_Vex:`

**Special Sections:**
- `<knowledge_awareness>`
- `<voice_crafting>`
- `<repetition_ban>`
- `<custom_steps>`
- `FINAL REVIEW:`
- `VITAL:`

**End Markers:**
- `END OF THINKING`
- `CLOSING THINKING NOW`
- `END OF THINKING - CLOSING THINKING NOW - NARRATION FOLLOWS`

### Enhanced Missing Suffix Detection

Special NemoNet-aware logic:
1. Prioritizes `END OF THINKING` markers with border lines
2. Recognizes `{{newline}}` as reasoning terminator
3. Detects `Narration: [description]` pattern
4. Handles decorative borders (`═══════════...`)

## Usage

### Automatic Integration

The parser is automatically loaded when NemoPresetExt initializes. No configuration needed!

### Manual Usage

```javascript
import { NemoNetReasoningParser } from './nemonet-reasoning-config.js';

const parser = new NemoNetReasoningParser();

const result = parser.parse(modelOutput);

console.log('Strategy:', result.strategy);
console.log('Confidence:', result.confidence);
console.log('Reasoning:', result.reasoning);
console.log('Content:', result.content);
```

### Custom Configuration

```javascript
import { RobustReasoningParser } from './robust-reasoning-parser.js';

const parser = new RobustReasoningParser({
    prefix: '<my-tag>',
    suffix: '</my-tag>',
    alternativePrefixes: ['<alt-tag>'],
    alternativeSuffixes: ['</alt-tag>'],
    reasoningMarkers: [
        'MY_CUSTOM_MARKER',
        'SECTION:',
        // ... more markers
    ],
    narrationMarkers: [
        'Story:',
        'Output:',
    ],
    debug: true  // Enable logging
});

const result = parser.parse(text);
```

## Testing

### Run Test Suite

To run comprehensive tests with various edge cases:

1. Add `?test=reasoning` to your SillyTavern URL
2. Open browser console
3. Tests will run automatically and show results

### Test Cases Included

1. **Perfect Match** - Complete `<think>...</think>` tags
2. **Missing Closing Tag** - Only `<think>`, no `</think>`
3. **Incomplete Closing Tag** - `</thin` instead of `</think>`
4. **No Tags - Content Markers** - Pure CoT without tags
5. **Partial CoT** - Incomplete reasoning mid-stream
6. **Heuristic Detection** - Structural pattern recognition
7. **No Reasoning** - Pure narrative (negative test)

### Manual Testing

```javascript
import { testWithUserCoT } from './test-reasoning-parser.js';

// Test with your actual CoT format
const result = testWithUserCoT();
```

## How It Works

### Parsing Flow

```
Input Text
    ↓
Strategy 1: Perfect Match
    ├─ Found? → Return (confidence: 100)
    └─ Not found ↓
Strategy 2: Partial Suffix
    ├─ Found? → Return (confidence: 90)
    └─ Not found ↓
Strategy 3: Missing Suffix
    ├─ Found? → Return (confidence: 85)
    └─ Not found ↓
Strategy 4: Content Markers
    ├─ Found? → Return (confidence: 75)
    └─ Not found ↓
Strategy 5: Heuristic
    ├─ Found? → Return (confidence: 60)
    └─ Not found ↓
No Reasoning Found
    └─ Return (confidence: 0)
```

### Integration with SillyTavern

The parser hooks into SillyTavern's existing reasoning system:

1. SillyTavern calls `parseReasoningFromString(text)`
2. Original parser attempts extraction
3. If original fails, robust parser takes over
4. If confidence > 50, result is returned
5. Otherwise, no reasoning is captured

This ensures **backward compatibility** while adding robust fallbacks.

## Files

- **`robust-reasoning-parser.js`** - Base parser with strategy system
- **`nemonet-reasoning-config.js`** - NemoNet-specific configuration and specialized parser
- **`test-reasoning-parser.js`** - Comprehensive test suite
- **`REASONING_PARSER.md`** - This documentation

## Benefits

### ✅ Reliability
- **Never misses reasoning** due to formatting issues
- Multiple fallback strategies ensure capture
- Handles incomplete, malformed, or missing tags

### ✅ Flexibility
- Works with any CoT format
- Easily customizable for new patterns
- No hardcoded assumptions

### ✅ Intelligent
- Context-aware detection
- Understands structural patterns
- Recognizes content types (structured vs. prose)

### ✅ Performance
- Cascading strategies stop at first success
- Most common cases (perfect match) resolve fastest
- Minimal overhead for normal operation

## Debugging

Enable debug mode to see detailed parsing information:

```javascript
const parser = new NemoNetReasoningParser({ debug: true });
```

This will log:
- Which strategy succeeded
- Confidence score
- Reasoning and content lengths
- Preview of captured content

## Future Enhancements

Potential improvements:
- Machine learning-based detection
- Adaptive marker learning
- Multi-language support
- Performance optimizations
- Additional CoT format templates

## Support

For issues or questions:
1. Check test suite results (`?test=reasoning`)
2. Enable debug mode
3. Review console logs
4. Report issues with example text that failed to parse

---

**Version:** 1.0.0
**Author:** NemoPresetExt
**License:** Same as SillyTavern
