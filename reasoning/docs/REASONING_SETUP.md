# Quick Setup Guide - Robust Reasoning Parser

## Installation

The Robust Reasoning Parser is already integrated into NemoPresetExt! No additional installation needed.

## Activation

1. **Restart SillyTavern** or reload the page
2. The parser will automatically activate when NemoPresetExt loads
3. Look for this console message: `NemoNet Reasoning Parser: Active`

## Configuration

### Step 1: Enable Auto-Parse
1. Go to **Advanced Formatting** tab in SillyTavern
2. Scroll to the **Reasoning** section
3. Check ✅ **Auto-Parse**

### Step 2: Set Your Tags
The default NemoNet tags are already configured:
- **Prefix:** `<think>`
- **Suffix:** `</think>`

These work with your CoT format. No changes needed!

### Step 3: (Optional) Choose a Reasoning Template
1. In the **Reasoning Formatting** section
2. Select dropdown next to the preset icons
3. Options:
   - **DeepSeek** (default) - `<think>.....</think>` ✅ Recommended for NemoNet
   - **Gemini** - `<thought>.....</thought>`
   - **OpenAI Harmony** - Channel-based format

**For your NemoNet CoT, use DeepSeek template.**

## Testing

### Quick Test
1. Add `?test=reasoning` to your URL: `http://localhost:8000?test=reasoning`
2. Reload the page
3. Open browser console (F12)
4. You'll see test results showing all capture strategies

### Live Test
1. Use your NemoNet CoT prompt
2. Generate a response
3. The reasoning block should appear in a collapsible "Thought for some time" box
4. Open console and look for: `NemoNet Reasoning Parser: Captured reasoning using [strategy] (confidence: [score])`

## Verification

### How to Know It's Working

**Successful Capture:**
- Your CoT appears in a collapsible reasoning block
- The narration appears separate from the thinking
- Console shows: `NemoNet Reasoning Parser: Captured reasoning using...`

**Strategies You'll See:**
- `perfectMatch` or `perfectMatch-alternative` - Both tags found ✅
- `partialSuffix` - Closing tag incomplete ⚠️
- `missingSuffix-nemonet` - No closing tag, used NemoNet-specific detection ⚠️
- `contentMarkers-nemonet` - No tags, detected by content patterns ⚠️
- `heuristic` - Last resort pattern matching ⚠️

**If confidence < 50:** Reasoning won't be captured. Check your CoT format.

## Common Issues

### Issue 1: Reasoning Not Captured
**Symptoms:** Everything appears in the main message, no reasoning block

**Solutions:**
1. Check Auto-Parse is enabled ✅
2. Verify prefix is `<think>` and suffix is `</think>`
3. Look in console for error messages
4. Your CoT must include `<think>` at the start OR multiple STORY SECTION markers

### Issue 2: Reasoning Captures Too Much
**Symptoms:** Narration is included in the reasoning block

**Solutions:**
1. Ensure your CoT ends with: `END OF THINKING - CLOSING THINKING NOW`
2. Add the `{{newline}}` marker after `</think>`
3. Use `Narration:` prefix before your narrative

### Issue 3: Reasoning Captures Too Little
**Symptoms:** Part of CoT appears in the narration

**Solutions:**
1. Make sure `</think>` appears AFTER your entire CoT
2. Check for premature narration markers (`Narration:` in the middle of CoT)
3. Verify your CoT includes proper section markers

## Optimal CoT Format for Capture

### Perfect Format (100% capture rate):
```
<think>
STORY SECTION 1: NEMO NET AWAKENING
═══════════════════════════════════════════════════════════════
[... your explorations ...]

STORY SECTION 2: GATHERING THE THREADS
[... your analysis ...]

[... more sections ...]

STORY SECTION 7: FINAL REVIEW
[... final checks ...]

═══════════════════════════════════════════════════════════════
END OF THINKING - CLOSING THINKING NOW - NARRATION FOLLOWS
═══════════════════════════════════════════════════════════════
</think>{{newline}}

Narration: Your character stepped forward...
```

### Fault-Tolerant Format (still works if tag breaks):
```
<think>
NEMONET WORLD EXPLORATION
═══════════════════════════════════════════════════════════════
NemoAdmin-107: Explore at least 6 concepts.

Exploration 1: [Content]
Exploration 2: [Content]
[... more explorations ...]

STORY SECTION 2: GATHERING THE THREADS
STORY SECTION 3: SCENE CALIBRATION
STORY SECTION 4: COUNCIL CONVERSATION
STORY SECTION 5: RESOLUTION
STORY SECTION 6: CRAFTING
STORY SECTION 7: FINAL REVIEW

END OF THINKING - CLOSING THINKING NOW
═══════════════════════════════════════════════════════════════
{{newline}}

The hero walked forward...
```

**Why this works:**
- Has `<think>` prefix ✅
- Has multiple STORY SECTION markers ✅
- Has END OF THINKING marker ✅
- Has clear narrative transition ✅

Even if `</think>` is forgotten, the parser will detect the end correctly!

## Advanced Configuration

### Add Custom Markers

Edit `nemonet-reasoning-config.js` to add your own markers:

```javascript
reasoningMarkers: [
    // Add your custom markers here
    'MY_CUSTOM_SECTION:',
    'Special Process Step:',
    // ... existing markers
]
```

### Adjust Confidence Thresholds

In `nemonet-reasoning-config.js`:

```javascript
strategyWeights: {
    perfectMatch: 100,
    partialSuffix: 90,
    missingSuffix: 85,
    contentBased: 75,
    heuristic: 60
}
```

Lower the threshold in `content.js` if you want to accept lower confidence:

```javascript
if (result.confidence > 40) {  // Changed from 50 to 40
    return {
        reasoning: result.reasoning,
        content: result.content
    };
}
```

## Debug Mode

Enable detailed logging:

```javascript
// In browser console:
localStorage.setItem('nemonet-reasoning-debug', 'true');
location.reload();
```

You'll see:
- Which strategy was attempted
- Why strategies succeeded/failed
- Character counts for reasoning/content
- Confidence scores
- Content previews

## Support Checklist

Before reporting issues:

- [ ] Auto-Parse is enabled
- [ ] Prefix is `<think>`, Suffix is `</think>`
- [ ] CoT includes at least 3 STORY SECTION markers
- [ ] CoT has clear end marker (`END OF THINKING`)
- [ ] Checked console for error messages
- [ ] Tried test suite (`?test=reasoning`)
- [ ] Enabled debug mode

## What's Captured vs. What's Not

### ✅ Always Captured
- Complete `<think>...</think>` blocks
- Partial tags with recognizable patterns
- Content with 4+ STORY SECTION markers
- Content with NemoNet-specific structure

### ❌ Never Captured
- Pure narrative with no structure
- Content with 0-2 weak markers
- Random text with no CoT patterns

### ⚠️ Sometimes Captured (depends on context)
- Content with 3 markers (50/50)
- Heuristic patterns (needs clear structure→prose transition)
- Very short CoT (< 50 chars)

---

**TL;DR:**
1. Enable Auto-Parse ✅
2. Use DeepSeek template ✅
3. Keep `<think>` and `</think>` tags ✅
4. Include `END OF THINKING` marker ✅
5. Done! 🎉
