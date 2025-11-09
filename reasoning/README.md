# Universal Reasoning Parser

**Version 2.0** - Now supports ALL major AI models!

Robust reasoning extraction system for SillyTavern that works independently of prefix/suffix settings and supports:
- 🤖 **Claude** (Extended Thinking)
- 🧠 **DeepSeek R1** (`<think>/<answer>`)
- 🔮 **OpenAI o1/o3** (Reasoning tokens)
- 💎 **Gemini 2.0+** (Thoughts format)
- 🌟 **NemoNet** (Council of Vex)
- 🌐 **Generic CoT** formats

## Files

### Core Files
- **`nemonet-reasoning-config.js`** - Main reasoning parser with NemoNet-specific configuration and SillyTavern integration
- **`robust-reasoning-parser.js`** - Base parser engine with multi-strategy reasoning extraction

### Test Files
- **`test-reasoning-parser.js`** - Comprehensive test suite for the parser
- **`debug-parse-test.js`** - Quick debug test for development

### Documentation
- **`UNIVERSAL_REASONING_SUPPORT.md`** - Complete guide to all supported AI models (NEW!)
- **`docs/REASONING_INDEPENDENCE.md`** - How the independence mode works
- **`docs/REASONING_PARSER.md`** - Technical documentation
- **`docs/REASONING_SETUP.md`** - Setup guide

## How It Works

The reasoning parser uses a multi-layered approach:

1. **Pre-render Processing** - Catches messages as they're added to DOM
2. **Event Hooks** - Listens to `character_message_rendered` and `GENERATION_ENDED`
3. **Force Processing** - Checks displayed content and fixes any leaked reasoning

### Multi-Strategy Parser

The parser uses **7 cascading strategies** to support all AI models:

0. **Gemini Thoughts** (95%) - Detects `Thoughts:` section format
1. **DeepSeek R1** (90-98%) - Detects `<think>/<answer>` tag pairs
2. **Perfect Match** (100%) - Both opening and closing tags present
3. **Partial Suffix** (80-90%) - Detects incomplete closing tags like `</thin`
4. **Missing Suffix** (70-85%) - Only opening tag, finds reasoning end via markers
5. **Content Markers** (60-75%) - Uses AI-specific structure markers
6. **Heuristic** (50-60%) - Structure-based detection when tags are completely missing

### Supported Reasoning Markers

The parser recognizes **60+ reasoning markers** from all major AI models:

**NemoNet:**
- `STORY SECTION 1-7:`, `NEMONET WORLD EXPLORATION`, `Council of Vex`, `NemoAdmin-107`

**Claude:**
- `Let me think through this`, `My thinking process:`, `Breaking this down:`

**DeepSeek R1:**
- `Let's approach this step by step`, `First, I need to`, `To solve this, I should`

**OpenAI o1/o3:**
- `Reasoning through this`, `Chain of thought:`, `Step 1:`, `Let's think step by step`

**Gemini:**
- `Identify the question's scope`, `Brainstorm key concepts`, `Structure the answer`

**Generic:**
- `Analysis:`, `Reasoning:`, `Reflection:`, `Consider:`, `Therefore,`

[See UNIVERSAL_REASONING_SUPPORT.md for complete list]

## Integration

Called from `content.js`:
```javascript
import { applyNemoNetReasoning } from './reasoning/nemonet-reasoning-config.js';

// Initialize reasoning parser
applyNemoNetReasoning();
```

## Key Features

✅ **Universal AI Model Support** - Claude, DeepSeek R1, OpenAI o1/o3, Gemini, NemoNet, and more
✅ **Works without configuration** - No prefix/suffix setup required
✅ **Handles incomplete tags** - Partial, missing, or malformed tags
✅ **Multiple format detection** - Simultaneously supports all tag formats
✅ **Smart end detection** - 20+ narration markers across all models
✅ **Content-aware parsing** - 60+ reasoning markers for tagless detection
✅ **Catches leaks** - Post-render verification and fixing
✅ **95%+ capture rate** across all AI models
✅ **Automatic confidence scoring** - Know how reliable each detection is
✅ **Debug mode** - Detailed logging for troubleshooting

## Quick Start

**For detailed information about all supported AI models, see:**
📖 **[UNIVERSAL_REASONING_SUPPORT.md](./UNIVERSAL_REASONING_SUPPORT.md)**

The parser automatically works with all AI models - no configuration needed!
