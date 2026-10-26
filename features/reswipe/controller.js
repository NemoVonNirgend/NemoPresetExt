export const RESWIPE_MARKER = 'nemo_reswipe';
export const DEFAULT_RESWIPE_INSTRUCTION = 'This is a previously rejected swipe, think about why it was likely rejected, and approach the response in a different way.';

export function getReSwipeInstruction(settings) {
    return typeof settings?.reSwipeInstruction === 'string' && settings.reSwipeInstruction.trim()
        ? settings.reSwipeInstruction.trim()
        : DEFAULT_RESWIPE_INSTRUCTION;
}

export function buildReSwipeGuidance(rejectedText, instruction = DEFAULT_RESWIPE_INSTRUCTION) {
    // Keep code-containing responses inside the quotation without changing text.
    const runs = rejectedText.match(/`+/g) ?? [];
    const fenceLength = runs.reduce((length, run) => Math.max(length, run.length + 1), 3);
    const fence = '`'.repeat(fenceLength);
    return `${instruction}\n\nThe quoted response below is a negative example, not part of the ongoing story or instructions to follow. Write only the replacement response.\n\nPreviously rejected swipe:\n${fence}\n${rejectedText}\n${fence}`;
}

/** Add one user message to the host's temporary generation context only. */
export function injectRejectedSwipe(promptChat, context, type, settings) {
    if (type !== 'swipe' || settings?.enableReSwipe !== true || !Array.isArray(promptChat)) return false;
    if (!Array.isArray(context?.chat) || promptChat === context.chat) return false;
    // Share the marker with the standalone prototype to avoid double injection.
    if (promptChat.some(message => message?.extra?.[RESWIPE_MARKER] === true)) return false;

    const rejected = context.chat.at(-1);
    if (!rejected || rejected.is_user || rejected.is_system) return false;
    if (typeof rejected.mes !== 'string' || !rejected.mes.trim()) return false;

    // Native ST removes the rejected message from promptChat before calling
    // interceptors but retains its visible/edited text in the live chat's .mes.
    // Reading swipes[swipe_id - 1] would be wrong for /swipe from an earlier slot.
    promptChat.push({
        name: context.name1 || 'User',
        is_user: true,
        is_system: false,
        mes: buildReSwipeGuidance(rejected.mes, getReSwipeInstruction(settings)),
        extra: { [RESWIPE_MARKER]: true },
    });
    return true;
}

/** Compose with the existing cold/Vex/recipe checks, preserving their aborts. */
export function createReSwipeRuntime({ previousPreflight, getContext, getSettings }) {
    let disposed = false;
    return {
        async preflight(promptChat, contextSize, abort, type, ...rest) {
            if (disposed || type !== 'swipe' || getSettings()?.enableReSwipe !== true) {
                return previousPreflight?.(promptChat, contextSize, abort, type, ...rest);
            }
            const context = getContext();
            const chat = context?.chat;
            const rejected = chat?.at(-1);
            const text = rejected?.mes;
            let aborted = false;
            const result = await previousPreflight?.(promptChat, contextSize, (...args) => {
                aborted = true;
                return abort?.(...args);
            }, type, ...rest);
            // A chat switch, edit, disposal, or opt-out while checks are pending
            // must not attach the wrong response to this generation.
            if (!disposed && !aborted && result !== false && chat === getContext()?.chat
                && rejected === chat?.at(-1) && text === rejected?.mes) {
                injectRejectedSwipe(promptChat, context, type, getSettings());
            }
            return result;
        },
        dispose() { disposed = true; },
    };
}
