export const GEMINI_MODELS = Object.freeze([
    'gemini-4-carbon',
    'gemini-4-argon',
    'gemini-4-hydrogen',
    'gemini-3.8-flash',
]);

const PROVIDERS = Object.freeze([
    { selector: '#model_google_select', setting: 'google_model' },
    { selector: '#model_vertexai_select', setting: 'vertexai_model' },
]);

/** Add missing options without taking ownership of native or CustomModels entries. */
export function createGeminiModelsRuntime({
    document, getSettings, notifyChange, Observer, events, types,
    getStartupSettings = getSettings, getModelMemory = () => ({}), saveModelMemory = () => {},
}) {
    const bindings = new Map();
    const ownedOptions = new Set();
    const ownedGroups = new Set();
    const lastModels = new Map();
    const listeners = [];
    let disposed = false;
    let refreshing = false;

    const memory = getModelMemory();
    const startup = getStartupSettings();
    let persistedModels = {};
    for (const { selector, setting } of PROVIDERS) {
        if (GEMINI_MODELS.includes(memory?.[setting])) persistedModels[setting] = memory[setting];
        // The original settings snapshot predates native dropdown initialization.
        // A real non-empty saved choice takes precedence over an older backup.
        const model = startup?.[setting] || persistedModels[setting];
        if (typeof model === 'string' && model) lastModels.set(selector, model);
    }

    function persistModels() {
        const models = {};
        for (const { selector, setting } of PROVIDERS) {
            const model = lastModels.get(selector);
            if (GEMINI_MODELS.includes(model)) models[setting] = model;
        }
        if (PROVIDERS.some(({ setting }) => models[setting] !== persistedModels[setting])) {
            saveModelMemory(models);
            persistedModels = models;
        }
    }

    function refresh(settings = getSettings()) {
        if (disposed || refreshing) return;
        // Native change notifications emit model events synchronously. A repair
        // must finish both providers before those events can start another pass.
        refreshing = true;
        try {
            syncSelectors(settings);
            persistModels();
        } finally {
            refreshing = false;
        }
    }

    function syncSelectors(settings) {
        for (const { selector, setting } of PROVIDERS) {
            const select = document.querySelector(selector);
            const previousBinding = bindings.get(selector);
            if (previousBinding?.select !== select) {
                previousBinding?.observer?.disconnect();
                bindings.delete(selector);
            }
            if (!select) continue;

            const previousValue = select.value;
            let group = [...select.children].find(child => ownedGroups.has(child));
            for (const model of GEMINI_MODELS) {
                const matches = [...select.options].filter(option => option.value === model);
                const external = matches.some(option => !ownedOptions.has(option));
                // A later native update or CustomModels load supersedes our option.
                if (external) {
                    for (const option of matches.filter(option => ownedOptions.has(option))) {
                        option.remove();
                        ownedOptions.delete(option);
                    }
                } else if (matches.length === 0) {
                    if (!group) {
                        group = document.createElement('optgroup');
                        group.label = 'Nemo Models';
                        ownedGroups.add(group);
                        select.prepend(group);
                    }
                    const option = document.createElement('option');
                    option.value = model;
                    option.textContent = model;
                    ownedOptions.add(option);
                    group.append(option);
                }
            }
            if (group && group.children.length === 0) {
                group.remove();
                ownedGroups.delete(group);
            }

            const savedModel = settings?.[setting];
            // A list rebuild can .val(savedModel).trigger('change') before our
            // observer restores the options. Vertex then saves an empty model.
            // Recover only a blank choice; a newer non-empty setting always wins.
            const fallback = GEMINI_MODELS.includes(previousValue) ? previousValue : lastModels.get(selector);
            const restoreModel = GEMINI_MODELS.includes(savedModel) ? savedModel
                : !savedModel && GEMINI_MODELS.includes(fallback) ? fallback : null;
            const value = restoreModel ?? previousValue;
            if (select.value !== value) select.value = value;
            // Remember native choices too, so switching away releases the old
            // managed model instead of resurrecting it on a later blank field.
            if (savedModel || value) lastModels.set(selector, savedModel || value);
            if (restoreModel && (previousValue !== value || getSettings()?.[setting] !== value)) notifyChange(select);

            if (!bindings.has(selector)) {
                const observer = Observer ? new Observer(() => refresh()) : null;
                observer?.observe(select, { childList: true, subtree: true });
                bindings.set(selector, { select, observer });
            }
        }
    }

    function listen(key, handler) {
        const type = types[key];
        if (!type) return;
        events.on(type, handler);
        listeners.push([type, handler]);
    }

    // SETTINGS_LOADED has no payload. Initial recovery uses the captured startup
    // snapshot and persistent backup; later events use the live native settings.
    for (const key of ['SETTINGS_LOADED', 'APP_READY', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'CHATCOMPLETION_SOURCE_CHANGED', 'CHATCOMPLETION_MODEL_CHANGED', 'CONNECTION_PROFILE_LOADED']) {
        listen(key, () => refresh());
    }
    refresh();

    return {
        dispose() {
            disposed = true;
            for (const { observer } of bindings.values()) observer?.disconnect();
            bindings.clear();
            lastModels.clear();
            for (const [type, handler] of listeners) events.removeListener(type, handler);
            listeners.length = 0;
            for (const option of ownedOptions) option.remove();
            ownedOptions.clear();
            for (const group of ownedGroups) if (group.children.length === 0) group.remove();
            ownedGroups.clear();
        },
    };
}
