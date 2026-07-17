import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    NemoNetReasoningParser,
    captureReasoningFromMessage,
    hasReasoningCandidate,
} from '../reasoning/reasoning-capture-core.js';

const runtimeSource = readFileSync(new URL('../reasoning/nemonet-reasoning-config.js', import.meta.url), 'utf8');
const contentSource = readFileSync(new URL('../content.js', import.meta.url), 'utf8');

function longReasoning(label = 'plan') {
    return `We need a careful ${label}. Check the constraints, compare the options, and verify the final response before answering.`;
}

test('native reasoning parsing is preferred and allows concise visible answers', () => {
    let calls = 0;
    const parser = new NemoNetReasoningParser({}, {
        getNativeParser: () => (text, options) => {
            calls++;
            assert.equal(options.strict, true);
            assert.match(text, /<think>/);
            return { reasoning: longReasoning(), content: 'Yes.' };
        },
    });

    const result = parser.parse(`<think>${longReasoning()}</think>Yes.`);

    assert.equal(calls, 1);
    assert.equal(result.strategy, 'native');
    assert.equal(result.content, 'Yes.');
    assert.match(result.reasoning, /careful plan/);
});

test('embedded and code-fenced tag examples are never captured', () => {
    let calls = 0;
    const parser = new NemoNetReasoningParser({}, {
        getNativeParser: () => () => {
            calls++;
            return { reasoning: longReasoning(), content: 'wrongly stripped' };
        },
    });
    const examples = [
        `Here is an example: <think>${longReasoning()}</think> Keep this example visible.`,
        `\`\`\`xml\n<think>${longReasoning()}</think>\n\`\`\``,
    ];

    for (const input of examples) {
        assert.deepEqual(parser.parse(input), {
            reasoning: '',
            content: input,
            strategy: 'none',
            confidence: 0,
        });
    }
    assert.equal(calls, 0);
});

test('configured native delimiters participate in candidate gating and capture', () => {
    let calls = 0;
    const parser = new NemoNetReasoningParser({ prefix: '[[private]]', suffix: '[[/private]]' }, {
        getNativeDelimiters: () => [{ prefix: '[[private]]', suffix: '[[/private]]' }],
        getNativeParser: () => (input, options) => {
            calls++;
            assert.equal(options.strict, true);
            return { reasoning: 'Configured private reasoning.', content: input.split('[[/private]]')[1] };
        },
    });
    const message = { mes: '[[private]]Configured private reasoning.[[/private]]Visible answer.' };

    const capture = captureReasoningFromMessage(message, parser);

    assert.equal(capture.changed, true);
    assert.equal(calls, 1);
    assert.equal(message.mes, 'Visible answer.');
});

test('all fork-native delimiter families pass the cheap gate and strict native parser', () => {
    const delimiterPairs = [
        ['<thoughts>', '</thoughts>'],
        ['<reason>', '</reason>'],
        ['<cot>', '</cot>'],
        ['<|begin_of_thought|>', '<|end_of_thought|>'],
        ['◁think▷', '◁/think▷'],
        ['[THINK]', '[/THINK]'],
    ];
    let calls = 0;
    const parser = new NemoNetReasoningParser({}, {
        getNativeParser: () => (input, options) => {
            calls++;
            assert.equal(options.strict, true);
            const [, suffix] = delimiterPairs.find(([prefix]) => input.startsWith(prefix));
            const start = input.indexOf(suffix);
            return { reasoning: longReasoning(), content: input.slice(start + suffix.length) };
        },
    });

    for (const [prefix, suffix] of delimiterPairs) {
        const input = `${prefix}${longReasoning()}${suffix}Visible answer.`;
        assert.equal(hasReasoningCandidate(input), true);
        assert.equal(parser.parse(input).content, 'Visible answer.');
    }
    assert.equal(calls, delimiterPairs.length);
});

test('fallback chooses the longest matching tag instead of leaking tag fragments', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const result = parser.parse(`<thinking>${longReasoning()}</thinking>The door opened onto a quiet, rain-lit street.`);

    assert.equal(result.strategy, 'varied-closing-tags');
    assert.ok(!result.reasoning.startsWith('ing>'));
    assert.ok(!result.content.startsWith('ing>'));
    assert.match(result.reasoning, /^We need a careful plan/);
    assert.equal(result.content, 'The door opened onto a quiet, rain-lit street.');
});

test('native parser failures fall back without losing the message', () => {
    const parser = new NemoNetReasoningParser({}, {
        getNativeParser: () => () => { throw new Error('native unavailable'); },
    });
    const result = parser.parse(`<think>${longReasoning()}</think>Fallback answer.`);

    assert.equal(result.strategy, 'varied-closing-tags');
    assert.equal(result.content, 'Fallback answer.');
});

test('DeepSeek answer wrappers are removed by the dedicated strategy', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const result = parser.parse(`<think>${longReasoning()}</think><answer>Yes.</answer>`);

    assert.equal(result.strategy, 'deepseek-r1');
    assert.equal(result.content, 'Yes.');
});

test('DeepSeek partial answer format accepts concise reasoning without leaking answer tags', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const result = parser.parse('<think>Plan.<answer>Yes.</answer> Trailing note.');

    assert.equal(result.strategy, 'deepseek-r1-partial');
    assert.equal(result.reasoning, 'Plan.');
    assert.equal(result.content, 'Yes. Trailing note.');
});

test('Gemini section format accepts concise reasoning and visible content', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const result = parser.parse('Thoughts:\nCheck once.\n\nResponse:\nYes.');

    assert.equal(result.strategy, 'gemini-thoughts');
    assert.equal(result.reasoning, 'Check once.');
    assert.equal(result.content, 'Yes.');
});

test('Gemini section formats keep every private reasoning line out of visible content', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });

    for (const [header, strategy] of [['Thoughts', 'gemini-thoughts'], ['Thinking', 'gemini-thinking']]) {
        for (const newline of ['\n', '\r\n']) {
            const input = `${header}:${newline}First private line.${newline}Second private line.${newline}${newline}Response:${newline}Visible answer.`;
            const result = parser.parse(input);

            assert.equal(result.strategy, strategy);
            assert.equal(result.reasoning.replaceAll('\r\n', '\n'), 'First private line.\nSecond private line.');
            assert.equal(result.content, 'Visible answer.');
        }
    }
});

test('fallback parsing is case-insensitive for explicit delimiters', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const result = parser.parse(`<THINKING>${longReasoning()}</THINKING>Uppercase answer.`);

    assert.equal(result.strategy, 'varied-closing-tags');
    assert.equal(result.content, 'Uppercase answer.');
    assert.match(result.reasoning, /^We need a careful plan/);
});

test('partial closing-tag repair accepts distinctive fragments without leaking a bracket', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });

    for (const closing of ['</thin>', '</thin']) {
        const result = parser.parse(`<think>${longReasoning()}${closing}Visible answer.`);
        assert.equal(result.strategy, 'partialSuffix');
        assert.equal(result.content, 'Visible answer.');
    }
});

test('explicit NemoNet boundaries safely repair an unclosed thinking tag', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const result = parser.parse(`<think>${longReasoning()} Narration: The visible narrative begins here.`);

    assert.equal(result.strategy, 'missingSuffix-nemonet');
    assert.equal(result.content, 'The visible narrative begins here.');
});

test('dense STORY SECTION output uses its explicit Narration boundary', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = [
        'story section 1:',
        'Establish the active constraints and character knowledge.',
        'Story Section 2:',
        'Compare the safest scene directions before writing.',
        'sToRy SeCtIoN 3:',
        'Verify voice, continuity, and the final response.',
        'Narration:',
        'Mara closed the ledger and crossed the quiet room.',
    ].join('\n');
    const result = parser.parse(input);

    assert.equal(result.strategy, 'contentMarkers-nemonet');
    assert.match(result.reasoning, /story section 3/i);
    assert.equal(result.content, 'Mara closed the ledger and crossed the quiet room.');
});

test('partial closing-tag repair does not split on ordinary HTML', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = `<think>${longReasoning()} <div>HTML is part of this private plan.</div> More private analysis.`;

    assert.deepEqual(parser.parse(input), {
        reasoning: '',
        content: input,
        strategy: 'none',
        confidence: 0,
    });
});

test('XML names that merely start with think are not treated as closing delimiters', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = `<think>${longReasoning()} Literal </thinkable> XML remains private.`;

    assert.deepEqual(parser.parse(input), {
        reasoning: '',
        content: input,
        strategy: 'none',
        confidence: 0,
    });
});

test('HTML inside a closed reasoning block is preserved exactly', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const reasoning = `${longReasoning()} <div data-check="kept">A structured note.</div>`;
    const result = parser.parse(`<think>${reasoning}</think>Visible answer.`);

    assert.equal(result.reasoning, reasoning);
    assert.equal(result.content, 'Visible answer.');
});

test('explicit closed tags retain short but valid visible content', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const result = parser.parse(`<think>${longReasoning()}</think>Yes.`);

    assert.equal(result.strategy, 'varied-closing-tags');
    assert.equal(result.content, 'Yes.');
});

test('an unclosed tag is not split at an arbitrary sentence boundary', () => {
    let nativeCalls = 0;
    const parser = new NemoNetReasoningParser({}, {
        getNativeParser: () => () => {
            nativeCalls++;
            return { reasoning: 'first private paragraph', content: 'second private paragraph' };
        },
    });
    const input = `<think>${longReasoning()}\n\nThis second private paragraph must not become visible content.`;
    const result = parser.parse(input);

    assert.equal(result.reasoning, '');
    assert.equal(result.content, input);
    assert.equal(nativeCalls, 0);
});

test('a structured tagless NemoNet block can be separated at a clear narrative boundary', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = [
        '**NemoNet Context Scan**',
        'Review the active scene and constraints.',
        '**Character Knowledge:**',
        'The guide knows the old route.',
        '**Scene Energy:**',
        'Quiet tension with forward movement.',
        '**Final Gut Check:**',
        'Keep the response grounded and specific.',
        '',
        'The rain eased as Mara opened the station door and waved the others inside.',
    ].join('\n');

    const result = parser.parse(input);

    assert.equal(result.strategy, 'nemonet-council');
    assert.match(result.reasoning, /NemoNet Context Scan/);
    assert.equal(result.content, 'The rain eased as Mara opened the station door and waved the others inside.');
});

test('NemoNet final checks keep private paragraphs hidden until a strong narrative start', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = [
        '**NemoNet Context Scan**',
        'Review the active scene and constraints.',
        '**Character Knowledge:**',
        'The guide knows the old route.',
        '**Scene Energy:**',
        'Quiet tension with forward movement.',
        '**Final Gut Check:**',
        'First private planning paragraph.',
        '',
        'Second private planning paragraph remains part of the analysis.',
        '',
        'Mara opened the station door and waved the others inside.',
    ].join('\n');

    const result = parser.parse(input);

    assert.equal(result.strategy, 'nemonet-council');
    assert.match(result.reasoning, /Second private planning paragraph/);
    assert.equal(result.content, 'Mara opened the station door and waved the others inside.');
});

test('Council parsing does not expose quoted or scene-shaped planning paragraphs', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = [
        '**NemoNet Context Scan**',
        'Review the active scene and constraints.',
        '**Character Knowledge:**',
        'The guide knows the old route.',
        '**Scene Energy:**',
        'Quiet tension with forward movement.',
        '**Final Gut Check:**',
        '\x22Keep the exchange brief,\x22 the plan notes.',
        '',
        'The room should feel cold before Mara acts; keep this instruction private.',
        '',
        'Mara opened the station door and waved the others inside.',
    ].join('\n');

    const result = parser.parse(input);

    assert.equal(result.strategy, 'nemonet-council');
    assert.match(result.reasoning, /\x22Keep the exchange brief,\x22 the plan notes/);
    assert.match(result.reasoning, /The room should feel cold/);
    assert.equal(result.content, 'Mara opened the station door and waved the others inside.');
});

test('ambiguous multi-paragraph NemoNet reasoning fails closed', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = [
        '**NemoNet Context Scan**',
        'Review the active scene and constraints.',
        '**Character Knowledge:**',
        'The guide knows the old route.',
        '**Scene Energy:**',
        'Quiet tension with forward movement.',
        '**Final Gut Check:**',
        'First private planning paragraph.',
        '',
        'Second private planning paragraph remains private.',
    ].join('\n');

    assert.deepEqual(parser.parse(input), {
        reasoning: '',
        content: input,
        strategy: 'none',
        confidence: 0,
    });
});

test('NemoNet markdown planning bullets are not mistaken for roleplay actions', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = [
        '**NemoNet Context Scan**',
        'Review the active scene and constraints.',
        '**Character Knowledge:**',
        'The guide knows the old route.',
        '**Scene Energy:**',
        'Quiet tension with forward movement.',
        '**Final Gut Check:**',
        'Review the remaining requirements.',
        '',
        '* Ensure continuity across the scene.',
        '* Keep the character voice consistent.',
    ].join('\n');

    assert.deepEqual(parser.parse(input), {
        reasoning: '',
        content: input,
        strategy: 'none',
        confidence: 0,
    });
});

test('structured NemoNet capture permits concise visible narrative', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = [
        '**NemoNet Context Scan**',
        'Review the scene and constraints carefully.',
        '**Character Knowledge:**',
        'Mara knows the correct route.',
        '**Scene Energy:**',
        'Keep the atmosphere restrained.',
        '**Final Gut Check:**',
        'Use one decisive action.',
        '',
        'Mara opened the door and waited.',
    ].join('\n');

    const result = parser.parse(input);

    assert.equal(result.strategy, 'nemonet-council');
    assert.equal(result.content, 'Mara opened the door and waited.');
});

test('ordinary prose with isolated reasoning words is left untouched', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const input = 'The Council of Vex was only a tavern rumor. Mara thought about it, then returned to the crowded market without explaining why.';

    assert.deepEqual(parser.parse(input), {
        reasoning: '',
        content: input,
        strategy: 'none',
        confidence: 0,
    });
});

test('candidate detection is cheap and covers alternate tags and structured formats', () => {
    assert.equal(hasReasoningCandidate('ordinary roleplay text'), false);
    assert.equal(hasReasoningCandidate('Example: <think>keep this visible</think>'), false);
    assert.equal(hasReasoningCandidate('Example format:\nThoughts:\nPlan\n\nResponse:\nAnswer'), false);
    assert.equal(hasReasoningCandidate(`<analysis>${longReasoning()}</analysis>Answer`), true);
    assert.equal(hasReasoningCandidate('**NemoNet Context Scan**\n**Scene Energy:**'), true);
    assert.equal(hasReasoningCandidate('Thoughts:\nPlan\n\nResponse:\nAnswer'), true);
});

test('message capture skips user, system, placeholder, and completed messages without new blocks', () => {
    let parseCalls = 0;
    const parser = { parse: () => { parseCalls++; return null; } };
    const messages = [
        { is_user: true, mes: `<think>${longReasoning()}</think>Answer` },
        { is_system: true, mes: `<think>${longReasoning()}</think>Answer` },
        { mes: '...' },
        { mes: 'Answer', extra: { reasoning: 'existing' } },
    ];

    for (const message of messages) {
        assert.equal(captureReasoningFromMessage(message, parser).changed, false);
    }
    assert.equal(parseCalls, 0);
});

test('every repeated enclosed reasoning block is captured in display order', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const repeated = 'Review the same constraint again.';
    const result = parser.parse([
        `<think>${repeated}</think>`,
        'First visible sentence.',
        `<plan>${repeated}</plan>`,
        'Second visible sentence.',
        `<cot>Check the final response.</cot>`,
    ].join(''));

    assert.equal(result.content, 'First visible sentence.Second visible sentence.');
    assert.equal(result.reasoning.match(/Review the same constraint again\./g)?.length, 2);
    assert.match(result.reasoning, /Check the final response\./);
});

test('later enclosed blocks append to existing reasoning instead of being ignored', () => {
    let parseCalls = 0;
    const parser = { parse: () => { parseCalls++; throw new Error('should not parse the visible remainder'); } };
    const message = {
        mes: 'First answer.<planning>Re-check continuity.</planning>Second answer.',
        extra: { reasoning: 'Initial private reasoning.', reasoning_type: 'parsed', token_count: 42 },
    };

    const capture = captureReasoningFromMessage(message, parser, reasoning => `[normalized]${reasoning}`);

    assert.equal(capture.changed, true);
    assert.equal(parseCalls, 0);
    assert.equal(message.mes, 'First answer.Second answer.');
    assert.equal(message.extra.reasoning, 'Initial private reasoning.\n\n[normalized]Re-check continuity.');
    assert.equal(message.extra.reasoning_type, 'parsed');
    assert.equal(message.extra.token_count, 42);
});

test('code-fenced enclosed tags remain visible after reasoning was already captured', () => {
    let parseCalls = 0;
    const parser = { parse: () => { parseCalls++; return null; } };
    const source = 'Example:\n```xml\n<think>Keep this example visible.</think>\n```';
    const message = { mes: source, extra: { reasoning: 'Existing reasoning.' } };

    assert.deepEqual(captureReasoningFromMessage(message, parser), {
        changed: false,
        reason: 'already-captured',
    });
    assert.equal(parseCalls, 0);
    assert.equal(message.mes, source);
});

test('marker-free messages never invoke the parser', () => {
    let parseCalls = 0;
    const message = { mes: 'A'.repeat(250_000) };
    const parser = { parse: () => { parseCalls++; throw new Error('should not run'); } };

    assert.deepEqual(captureReasoningFromMessage(message, parser), { changed: false, reason: 'no-candidate' });
    assert.equal(parseCalls, 0);
});

test('accepted capture mutates once, preserves metadata, and is idempotent', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const message = {
        mes: `<think>${longReasoning()}</think>The answer is ready.`,
        extra: { token_count: 42 },
    };

    const first = captureReasoningFromMessage(message, parser, reasoning => '[reasoning-regex]' + reasoning);
    assert.equal(first.changed, true);
    assert.equal(message.mes, 'The answer is ready.');
    assert.match(message.extra.reasoning, /^\[reasoning-regex\].*careful plan/);
    assert.equal(message.extra.reasoning_type, 'parsed');
    assert.equal(message.extra.token_count, 42);

    const snapshot = structuredClone(message);
    const second = captureReasoningFromMessage(message, parser);
    assert.deepEqual(second, { changed: false, reason: 'already-captured' });
    assert.deepEqual(message, snapshot);
});

test('rejected or ambiguous results never mutate the message', () => {
    const message = { mes: `<think>${longReasoning()} Still reasoning without a safe boundary.`, extra: { custom: true } };
    const snapshot = structuredClone(message);
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });

    assert.equal(captureReasoningFromMessage(message, parser).changed, false);
    assert.deepEqual(message, snapshot);
});

test('reasoning normalizer failures leave the message unchanged', () => {
    const parser = new NemoNetReasoningParser({}, { getNativeParser: () => null });
    const message = { mes: `<think>${longReasoning()}</think>Visible answer.`, extra: { custom: true } };
    const snapshot = structuredClone(message);

    const capture = captureReasoningFromMessage(message, parser, () => { throw new Error('regex failed'); });

    assert.deepEqual(capture, { changed: false, reason: 'normalizer-error' });
    assert.deepEqual(message, snapshot);
});

test('runtime uses bounded SillyTavern events and no DOM observer or hand-built HTML', () => {
    assert.match(runtimeSource, /event_types\.MESSAGE_RECEIVED/);
    assert.match(runtimeSource, /event_types\.MESSAGE_UPDATED/);
    assert.match(runtimeSource, /event_types\.MESSAGE_SWIPED/);
    assert.match(runtimeSource, /event_types\.CHARACTER_MESSAGE_RENDERED/);
    assert.match(runtimeSource, /event_types\.GENERATION_ENDED/);
    assert.match(runtimeSource, /event_types\.GENERATION_STOPPED/);
    assert.match(runtimeSource, /event_types\.CHAT_CHANGED/);
    assert.match(runtimeSource, /messageId === 0 && chat\.length === 1/);
    assert.match(runtimeSource, /syncMesToSwipe\(messageId\)/);
    assert.match(runtimeSource, /updateMessageBlock\(messageId, message\)/);
    assert.match(runtimeSource, /getRegexedString\(reasoning, regex_placement\.REASONING\)/);
    assert.doesNotMatch(runtimeSource, /MutationObserver/);
    assert.doesNotMatch(runtimeSource, /\.innerHTML\s*=/);
    assert.doesNotMatch(runtimeSource, /setInterval\(/);
    assert.doesNotMatch(runtimeSource, /setTimeout\(/);
    assert.doesNotMatch(runtimeSource, /requestAnimationFrame\(/);
    assert.match(runtimeSource, /eventSource\.removeListener\(eventType, handler\)/);
});

test('reasoning listeners register before asynchronous settings UI initialization', () => {
    const captureRegistration = contentSource.indexOf('applyNemoNetReasoning();');
    const settingsInitialization = contentSource.indexOf('await NemoSettingsUI.initialize();');

    assert.notEqual(captureRegistration, -1);
    assert.notEqual(settingsInitialization, -1);
    assert.ok(captureRegistration < settingsInitialization);
});
