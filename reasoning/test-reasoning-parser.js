/**
 * Test Suite for NemoNet Reasoning Parser
 *
 * Tests various edge cases and scenarios
 */

import { NemoNetReasoningParser } from './nemonet-reasoning-config.js';

// Test cases
const testCases = [
    {
        name: 'Perfect Match - Complete Tags',
        input: `<think>
NEMONET WORLD EXPLORATION
═══════════════════════════════════════════════════════════════
Exploration 1: [OOC Comments]
Exploration 2: [Genre/Stakes]

STORY SECTION 2: GATHERING THE THREADS
♢ Recent events: Character A met Character B

FINAL REVIEW:
1. All checks passed

END OF THINKING - CLOSING THINKING NOW
═══════════════════════════════════════════════════════════════
</think>

The sun cast long shadows across the cobblestone street.`,
        expectedStrategy: 'perfectMatch',
        shouldCapture: true
    },

    {
        name: 'Missing Closing Tag',
        input: `<think>
NEMONET WORLD EXPLORATION
═══════════════════════════════════════════════════════════════
Exploration 1: [OOC Comments]
Exploration 2: [Genre/Stakes]

STORY SECTION 2: GATHERING THE THREADS
♢ Recent events: Character A met Character B

FINAL REVIEW:
1. All checks passed

END OF THINKING - CLOSING THINKING NOW
═══════════════════════════════════════════════════════════════
{{newline}}

The sun cast long shadows across the cobblestone street.`,
        expectedStrategy: 'missingSuffix',
        shouldCapture: true
    },

    {
        name: 'Incomplete Closing Tag',
        input: `<think>
NEMONET WORLD EXPLORATION
Exploration 1: [OOC Comments]
STORY SECTION 2: GATHERING THE THREADS
END OF THINKING
</thin

The character walked forward.`,
        expectedStrategy: 'partialSuffix',
        shouldCapture: true
    },

    {
        name: 'No Tags - Content Markers Only',
        input: `NEMONET WORLD EXPLORATION
═══════════════════════════════════════════════════════════════
Exploration 1: [OOC Comments]
Exploration 2: [Genre/Stakes]
Exploration 3: [Language requirements]
Exploration 4: [Character traits]

STORY SECTION 2: GATHERING THE THREADS
STORY SECTION 3: SCENE CALIBRATION
STORY SECTION 4: COUNCIL CONVERSATION
STORY SECTION 5: RESOLUTION

END OF THINKING - CLOSING THINKING NOW
═══════════════════════════════════════════════════════════════

Narration: The hero stepped into the room.`,
        expectedStrategy: 'contentMarkers',
        shouldCapture: true
    },

    {
        name: 'Partial CoT - Mixed Content',
        input: `<think>
STORY SECTION 1: NEMO NET AWAKENING
Exploration 1: [OOC Comments]

STORY SECTION 2: GATHERING
♢ Recent events

STORY SECTION 3: SCENE CALIBRATION

The brave knight drew his sword and charged forward.`,
        expectedStrategy: 'missingSuffix',
        shouldCapture: true
    },

    {
        name: 'Heuristic Detection - Structural Pattern',
        input: `Internal Planning (Council Mode Active):

♢ Current situation: Character needs to decide
♢ Option 1: Fight
♢ Option 2: Flee
♢ Decision: Fight

──────────────────────

She gripped her weapon tightly. The enemy approached from the shadows.`,
        expectedStrategy: 'heuristic',
        shouldCapture: true
    },

    {
        name: 'No Reasoning - Pure Narrative',
        input: `The sun rose over the mountains. Birds sang in the trees. It was a beautiful morning that promised adventure.`,
        expectedStrategy: 'none',
        shouldCapture: false
    }
];

/**
 * Run tests
 */
export function runReasoningTests() {
    const parser = new NemoNetReasoningParser({ debug: true });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  NemoNet Reasoning Parser - Test Suite');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        console.log(`\nTest: ${testCase.name}`);
        console.log('─'.repeat(60));

        const result = parser.parse(testCase.input);

        const hasReasoning = result.reasoning && result.reasoning.length > 0;
        const strategyMatches = !testCase.expectedStrategy ||
                                result.strategy.includes(testCase.expectedStrategy) ||
                                testCase.expectedStrategy.includes(result.strategy);

        const success = (testCase.shouldCapture === hasReasoning) &&
                       (strategyMatches || !testCase.shouldCapture);

        if (success) {
            console.log(`✓ PASS`);
            passed++;
        } else {
            console.log(`✗ FAIL`);
            failed++;
        }

        console.log(`  Strategy: ${result.strategy}`);
        console.log(`  Confidence: ${result.confidence}`);
        console.log(`  Reasoning captured: ${hasReasoning} (expected: ${testCase.shouldCapture})`);

        if (hasReasoning) {
            console.log(`  Reasoning length: ${result.reasoning.length} chars`);
            console.log(`  Content length: ${result.content.length} chars`);

            // Show first 100 chars of reasoning
            const reasoningPreview = result.reasoning.substring(0, 100).replace(/\n/g, '\\n');
            console.log(`  Reasoning preview: "${reasoningPreview}..."`);

            // Show first 100 chars of content
            const contentPreview = result.content.substring(0, 100).replace(/\n/g, '\\n');
            console.log(`  Content preview: "${contentPreview}..."`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('═'.repeat(60) + '\n');

    return { passed, failed };
}

/**
 * Test with actual user's CoT
 */
export function testWithUserCoT() {
    const parser = new NemoNetReasoningParser({ debug: true });

    // Simulated model output with incomplete closing tag
    const modelOutput = `<think>
STORY SECTION 1: NEMO NET AWAKENING
═══════════════════════════════════════════════════════════════
NemoAdmin-107: Explore at least 6 concepts. Build the foundation.

Exploration 1: [{{user}} OOC Comments - highest priority] {{getvar::AntiEcho}}
Exploration 2: [Genre/Stakes/Mood]
Exploration 3: [Language requirements {getvar::Language}}]
Exploration 4: [Character traits, relationships, current needs]
Exploration 5: [Last 1-2 turns - what just happened]
Exploration 6: [Environment - time, weather, atmosphere]

Discoveries: [Brief relevant findings connected to NOW]

═══════════════════════════════════════════════════════════════

STORY SECTION 2: GATHERING THE THREADS
NemoAdmin-107: Connect the pieces.

◆ Human input gathered. OOC? Requests? Genre?

♢ Recent events: [Summary]. Current desires: Alice wants to find the treasure

STORY SECTION 3: SCENE CALIBRATION
NemoAdmin-107: Recognize scene type. Set the balance.

♢ SCENE TYPE AND RATIO:
Current Scene: [Exploration/Discovery], Energy: [Medium]

STORY SECTION 4: COUNCIL CONVERSATION

♢_Alice_Specialist: [Direction true to character]. Why: [Reasoning]. Weight: [85/100]

♢_Plot_Vex: [Direction - advance threads]. Why: [Reasoning]. Weight: [75/100]

STORY SECTION 5: RESOLUTION
NemoAdmin-107: Lead Vex: [Alice_Specialist]. Integrate best elements from others.

Core Plan: [Plot points, emotional beats, ending at {{user}} hook]

STORY SECTION 6: CRAFTING

STORY SECTION 7: FINAL REVIEW
1. Knowledge boundaries respected? Yes
2. Dialogue/description ratio matches scene type? Yes
3. {{user}} agency preserved completely? Yes

VITAL:
1. Output must proceed after </think> closes
2. Narration shaped from council planning
3. End at {{user}}'s moment to respond

═══════════════════════════════════════════════════════════════
END OF THINKING - CLOSING THINKING NOW - NARRATION FOLLOWS
═══════════════════════════════════════════════════════════════

Alice's eyes sparkled with determination as she studied the ancient map. The parchment was worn at the edges, but the X marking the location was still clearly visible. She turned to you with an excited grin.

"Look at this!" she exclaimed, tracing her finger along the dotted path. "If we follow the river north for about three miles, we should reach the old abandoned lighthouse. That's where the treasure is hidden!"

The morning sun filtered through the trees, casting dappled shadows across your campsite. In the distance, you could hear the gentle rush of the river she'd mentioned.

What do you do?`;

    console.log('\n' + '═'.repeat(60));
    console.log('  Testing with User\'s Actual CoT Format');
    console.log('═'.repeat(60) + '\n');

    const result = parser.parse(modelOutput);

    console.log(`Strategy Used: ${result.strategy}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`\nReasoning Captured (${result.reasoning.length} chars):`);
    console.log('─'.repeat(60));
    console.log(result.reasoning.substring(0, 500) + '...\n');

    console.log(`\nNarration Only (${result.content.length} chars):`);
    console.log('─'.repeat(60));
    console.log(result.content + '\n');

    console.log('═'.repeat(60) + '\n');

    return result;
}

// Auto-run tests if loaded directly
if (typeof window !== 'undefined' && window.location.search.includes('test=reasoning')) {
    document.addEventListener('DOMContentLoaded', () => {
        runReasoningTests();
        testWithUserCoT();
    });
}
