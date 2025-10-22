# NemoNet Reasoning Parser

Robust reasoning extraction system for SillyTavern that works independently of prefix/suffix settings.

## Files

### Core Files
- **`nemonet-reasoning-config.js`** - Main reasoning parser with NemoNet-specific configuration and SillyTavern integration
- **`robust-reasoning-parser.js`** - Base parser engine with multi-strategy reasoning extraction

### Test Files
- **`test-reasoning-parser.js`** - Comprehensive test suite for the parser
- **`debug-parse-test.js`** - Quick debug test for development

### Documentation
- **`docs/REASONING_INDEPENDENCE.md`** - How the independence mode works
- **`docs/REASONING_PARSER.md`** - Technical documentation
- **`docs/REASONING_SETUP.md`** - Setup guide

## How It Works

The reasoning parser uses a multi-layered approach:

1. **Pre-render Processing** - Catches messages as they're added to DOM
2. **Event Hooks** - Listens to `character_message_rendered` and `GENERATION_ENDED`
3. **Force Processing** - Checks displayed content and fixes any leaked reasoning

### Multi-Strategy Parser

The parser uses 5 cascading strategies:

1. **Perfect Match** (100% confidence) - Both `<think>` and `</think>` tags present
2. **Partial Suffix** (90%) - Detects incomplete closing tags like `</thin`
3. **Missing Suffix** (85%) - Only `<think>` tag, finds reasoning end via markers
4. **Content Markers** (75%) - Uses NemoNet structure (STORY SECTIONS, etc.)
5. **Heuristic** (60%) - Structure-based detection when tags are completely missing

### NemoNet Markers

The parser recognizes NemoNet-specific CoT markers:
- `STORY SECTION 1-7:`
- `NEMONET WORLD EXPLORATION`
- `Council of Vex`
- `NemoAdmin-107`
- `END OF THINKING`
- `NARRATION FOLLOWS`

## Integration

Called from `content.js`:
```javascript
import { applyNemoNetReasoning } from './reasoning/nemonet-reasoning-config.js';

// Initialize reasoning parser
applyNemoNetReasoning();
```

## Key Features

✅ Works without prefix/suffix configuration
✅ Handles malformed/incomplete tags
✅ Catches reasoning leaks after render
✅ Uses SillyTavern's native `updateReasoningUI()`
✅ Supports swipes (always reprocesses latest message)
✅ 95%+ capture rate
