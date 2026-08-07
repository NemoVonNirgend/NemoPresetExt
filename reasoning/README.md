# Improved Reasoning Capture

Improved Reasoning Capture is NemoPresetExt's optional reasoning post-processor for SillyTavern. For uncaptured assistant messages, it reads SillyTavern's current delimiter candidates, delegates structurally closed blocks to the native parser, and supplies conservative fallbacks for alternate tags and structured NemoNet/Council output.

The feature is enabled by default through `enableReasoningCapture`. It can be turned off in NemoPresetExt settings without changing SillyTavern's native reasoning controls.

## Supported input

- SillyTavern's configured reasoning prefix and suffix.
- Common blocks that begin the message: `<think>`, `<thinking>`, `<thought>`, `<thoughts>`, `<reason>`, `<reasoning>`, `<reflection>`, `<analysis>`, `<cot>`, `<|begin_of_thought|>`, `◁think▷`, and `[THINK]`.
- DeepSeek-style `<think>...</think><answer>...</answer>` output.
- `Thoughts:` or `Thinking:` sections followed by an explicit `Response:`, `Answer:`, `Output:`, or `Result:` section.
- NemoNet/Council section blocks with enough known structure to identify them and a clear narrative boundary.
- An incomplete `</think>` suffix, when enough of that exact delimiter remains to distinguish it from ordinary HTML.
- An unclosed opening tag only when the output contains a known explicit transition such as `NARRATION FOLLOWS`, `{{newline}}`, `Narration:`, or a NemoNet closing marker.

Provider-native reasoning already stored in `message.extra.reasoning` is authoritative and is never replaced.

## Safety rules

Capture intentionally fails closed:

- Tag-based reasoning must start the message, apart from leading whitespace. Tags shown later in prose or fenced examples remain visible.
- User messages, system messages, placeholders, and messages with existing reasoning are skipped.
- Both reasoning and visible content must be non-empty before a message can change. Short answers such as `Yes.` are valid.
- Native parsing is used only when the matching closing delimiter exists. Ordinary sentences and blank paragraphs are never treated as proof that an unclosed block ended.
- Rendered HTML is never used as message source data, and HTML inside a correctly delimited reasoning block is preserved.
- Parsing errors or low-confidence tagless guesses leave the original message byte-for-byte unchanged.
- Tagless Council output requires a Final Check plus a strong narrative start; markdown planning bullets remain private.
- Pristine one-message greetings are skipped because SillyTavern intentionally keeps their swipe text unresolved for macro replay.

These constraints favor preserving visible text over guessing. If a model omits both its closing delimiter and a structural narration marker, configure the model/preset to emit a proper suffix instead of relying on prose detection.

## Message lifecycle

The runtime listens only to SillyTavern's `MESSAGE_RECEIVED`, `MESSAGE_UPDATED`, `MESSAGE_SWIPED`, and `CHAT_CHANGED` events. A successful capture:

1. applies SillyTavern reasoning-placement regex rules and updates the canonical assistant message;
2. synchronizes the active swipe with `syncMesToSwipe(messageId)`;
3. schedules the normal chat save; and
4. asks SillyTavern to re-render the message if it is already on screen.

There is no chat-wide DOM observer, rendered-HTML parsing, polling, retry timer, or custom reasoning markup. Disabling the feature removes all four listeners synchronously.

## Code map

- `reasoning-capture-core.js` — pure candidate gating, validation, parsing policy, and atomic message mutation.
- `nemonet-reasoning-config.js` — thin SillyTavern event, swipe, save, and render adapter.
- `robust-reasoning-parser.js` — reusable delimiter and structured-format strategies.
- `tests/reasoning-capture.test.js` — executable regression coverage for accepted formats, false positives, metadata safety, and runtime constraints.

## Verification

From the extension directory:

```powershell
node --test tests\reasoning-capture.test.js
```

For best results, keep SillyTavern's reasoning settings aligned with the model's documented delimiter format. NemoPresetExt supplements those settings; it does not replace native streaming or provider-supplied reasoning support. If SillyTavern has already populated `message.extra.reasoning` before the extension event runs, that native result remains authoritative.
