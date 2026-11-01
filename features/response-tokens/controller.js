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

/** Restore the saved response budget once at startup, then follow intentional edits. */
export function createResponseTokensRuntime({
    events, types, getSettings, getStartupSettings, getMemory, saveMemory,
    writeTokens, subscribeInput, schedule = callback => setTimeout(callback, 0), cancel = clearTimeout,
}) {
    const listeners = [];
    let disposed = false;
    let ready = false;
    let restoring = false;
    let timer = null;
    let stored = storedPreference(getMemory());
    const startupSettings = getStartupSettings();
    const startup = preference(startupSettings);
    const startupPreset = String(startupSettings?.preset_settings_openai ?? '');
    let restore = stored?.preset === startupPreset ? stored : startup;

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
