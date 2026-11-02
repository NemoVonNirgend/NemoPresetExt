function validTokens(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function preference(settings, tokens = settings?.openai_max_tokens) {
    if (!validTokens(tokens)) return null;
    return { preset: String(settings?.preset_settings_openai ?? ''), tokens };
}

function storedPreference(value) {
    return value && typeof value.preset === 'string' && validTokens(value.tokens)
        ? { preset: value.preset, tokens: value.tokens } : null;
}

const REPLY_TYPES = new Set(['normal', 'continue', 'swipe', 'regenerate', 'impersonate', 'append']);

function isReply(request) {
    return request && typeof request === 'object' && !Array.isArray(request) && REPLY_TYPES.has(request.type);
}

/** Restore the saved response budget once at startup, then follow intentional edits. */
export function createResponseTokensRuntime({
    events, types, getSettings, getStartupSettings, getMemory, saveMemory,
    writeTokens, subscribeInput, getDisplayedTokens = () => getSettings()?.openai_max_tokens,
    schedule = callback => setTimeout(callback, 0), cancel = clearTimeout,
}) {
    const listeners = [];
    const requestGuards = new WeakMap();
    let disposed = false;
    let ready = false;
    let restoring = false;
    let timer = null;
    let stored = storedPreference(getMemory());
    const startupSettings = getStartupSettings();
    const startup = preference(startupSettings);
    const startupPreset = String(startupSettings?.preset_settings_openai ?? '');
    let restore = stored?.preset === startupPreset ? stored : startup;

    function protectRequest(request) {
        if (disposed || !isReply(request)) return;
        const displayed = Number(getDisplayedTokens());
        const samePreset = stored?.preset === String(getSettings()?.preset_settings_openai ?? '');
        const tokens = validTokens(displayed) ? displayed : samePreset ? stored?.tokens : null;
        if (!validTokens(tokens)) return;

        const installed = requestGuards.get(request);
        if (installed && installed.serializer === request.toJSON) {
            installed.tokens = tokens;
            return;
        }
        const originalToJSON = request.toJSON;
        const guard = { tokens, serializer: null };
        const serializer = function (key) {
            // Preserve native integrity blockers and any earlier serializer.
            const value = typeof originalToJSON === 'function' ? originalToJSON.call(this, key) : this;
            if (disposed || !isReply(value)) return value;
            const fields = ['max_tokens', 'max_completion_tokens'].filter(field => Object.hasOwn(value, field));
            if (!fields.length) return value;
            const outgoing = { ...value };
            delete outgoing.toJSON;
            for (const field of fields) outgoing[field] = guard.tokens;
            return outgoing;
        };
        guard.serializer = serializer;
        // Request-local correction avoids changing a concurrent helper's shared
        // temporary budget. Quiet/raw helper requests retain their own limits.
        Object.defineProperty(request, 'toJSON', { value: serializer, configurable: true, writable: true, enumerable: false });
        requestGuards.set(request, guard);
    }

    function moveProtectorLast() {
        if (disposed || !types.CHAT_COMPLETION_SETTINGS_READY) return;
        const type = types.CHAT_COMPLETION_SETTINGS_READY;
        if (typeof events.makeLast === 'function') events.makeLast(type, protectRequest);
        else {
            events.removeListener(type, protectRequest);
            events.on(type, protectRequest);
        }
    }

    function remember(value) {
        if (!value || (stored?.preset === value.preset && stored?.tokens === value.tokens)) return;
        saveMemory(value);
        stored = value;
    }

    function cancelRestore() {
        restore = null;
        if (timer !== null) cancel(timer);
        timer = null;
    }

    const unsubscribe = subscribeInput((value, { source, user = false } = {}) => {
        if (disposed || restoring || source === 'preset' || source === 'nemo-response-tokens') return;
        // Ignore programmatic startup writes. Real edits remain authoritative,
        // including an edit made while the rest of the application is loading.
        if (!ready && !user) return;
        const next = preference(getSettings(), Number(value));
        if (!next) return;
        cancelRestore();
        if (!ready) restore = next;
        // Some controls dispatch only change, while native persistence listens
        // to input. Keep the actual request setting aligned with the field.
        if (getSettings()?.openai_max_tokens !== next.tokens) {
            restoring = true;
            try { writeTokens(next.tokens); } finally { restoring = false; }
        }
        remember(next);
    });

    function finishStartup() {
        if (disposed || ready) return;
        ready = true;
        moveProtectorLast();
        // Let synchronous APP_READY listeners finish before applying the budget.
        timer = schedule(() => {
            timer = null;
            if (disposed) return;
            const settings = getSettings();
            if (restore?.preset === String(settings?.preset_settings_openai ?? '')) {
                restoring = true;
                try {
                    // Refresh the control too if another startup component only
                    // changed its displayed value, leaving the setting intact.
                    writeTokens(restore.tokens);
                } finally {
                    restoring = false;
                }
            }
            restore = null;
            remember(preference(getSettings()));
        });
    }

    function listen(key, handler) {
        if (!types[key]) return;
        events.on(types[key], handler);
        listeners.push([types[key], handler]);
    }

    listen('APP_READY', finishStartup);
    listen('CHAT_COMPLETION_SETTINGS_READY', protectRequest);
    for (const key of ['GENERATION_STARTED', 'CHAT_COMPLETION_PROMPT_READY']) listen(key, moveProtectorLast);
    listen('OAI_PRESET_CHANGED_BEFORE', () => {
        if (ready) cancelRestore();
    });
    listen('OAI_PRESET_CHANGED_AFTER', () => {
        if (!ready || disposed) return;
        cancelRestore();
        remember(preference(getSettings()));
    });
    if (!types.APP_READY) finishStartup();

    return {
        dispose() {
            disposed = true;
            cancelRestore();
            unsubscribe?.();
            for (const [type, handler] of listeners) events.removeListener(type, handler);
            listeners.length = 0;
        },
    };
}
