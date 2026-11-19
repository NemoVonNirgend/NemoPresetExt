// Only pass lifecycle metadata here. Reports can be copied directly from a toast.
export function diagnosticLabel(value) {
    if (value == null || value === '') return null;
    return typeof value === 'string' && /^[a-z\d_.-]{1,96}$/i.test(value) ? value : '[redacted]';
}

export class PromptPreparationError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.code = code;
        this.details = details;
    }
}

export function createPreparationDiagnostics(debug, getVersion) {
    const recent = [];
    let lastFailure = null, sequence = 0;
    function trace(stage, details = {}) {
        const entry = Object.freeze({ seq: ++sequence, time: Date.now(), stage, ...details });
        recent.push(entry);
        if (recent.length > 32) recent.shift();
        debug(entry);
    }
    function capture(error, stage, state, previous) {
        const known = error instanceof PromptPreparationError;
        const code = known ? error.code : 'UNEXPECTED';
        const details = known ? error.details : {
            exception: error instanceof TypeError ? 'TypeError' : error instanceof RangeError ? 'RangeError' : 'Error',
        };
        trace(stage, { ...details, code });
        // A failed preload can lead to a secondary guard error in the same preset.
        const followsBlockedLoad = code === 'PLAN_MISSING' || code === 'SOURCE_UNPREPARED';
        let previousFault = null;
        if (previous && followsBlockedLoad) {
            previousFault = previous.previousFault ?? Object.freeze({
                code: previous.code, stage: previous.stage, seq: previous.trace.at(-1).seq,
                ...(previous.status === undefined ? {} : { status: previous.status }),
            });
        }
        lastFailure = Object.freeze({
            schema: 1, version: diagnosticLabel(getVersion()), code, stage,
            ...details, ...state, previousFault,
            trace: Object.freeze([...recent]),
        });
        return lastFailure;
    }
    return { trace, capture, getLastFailure: () => lastFailure };
}
