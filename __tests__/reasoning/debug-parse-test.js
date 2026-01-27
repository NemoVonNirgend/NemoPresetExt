// Quick debug test
import { NemoNetReasoningParser } from './nemonet-reasoning-config.js';

const parser = new NemoNetReasoningParser({ debug: true });

const testInput = `<think>
STORY SECTION 1: NEMO NET AWAKENING
═══════════════════════════════════════════════════════════════
║ NEMONET WORLD EXPLORATION                                   ║
═══════════════════════════════════════════════════════════════
NemoAdmin-107: Explore at least 6 concepts. Build the foundation.

Exploration 1: [Noah OOC Comments - highest priority]

STORY SECTION 2: GATHERING THE THREADS
STORY SECTION 3: SCENE CALIBRATION
STORY SECTION 4: COUNCIL CONVERSATION
STORY SECTION 5: RESOLUTION
STORY SECTION 6: CRAFTING

VITAL:
1. Output must proceed after </think> closes.
2. Narration shaped from council planning.
3. End at Noah's moment to respond.

</think>
The echo of your footsteps dies as Serlan halts abruptly.`;

console.log('Testing parser...');
const result = parser.parse(testInput);

console.log('\n=== RESULT ===');
console.log('Strategy:', result.strategy);
console.log('Confidence:', result.confidence);
console.log('\nReasoning length:', result.reasoning.length);
console.log('Content length:', result.content.length);
console.log('\nReasoning preview:');
console.log(result.reasoning.substring(0, 200));
console.log('\nContent:');
console.log(result.content);
