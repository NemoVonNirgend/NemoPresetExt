export const GEMINI_MODELS = Object.freeze([
    'gemini-4-argon',
    'gemini-3.8-flash',
]);

const PROVIDERS = Object.freeze([
    { selector: '#model_google_select', setting: 'google_model' },
    { selector: '#model_vertexai_select', setting: 'vertexai_model' },
]);

/** Add missing options without taking ownership of native or CustomModels entries. */
export function createGeminiModelsRuntime({ document, getSettings, notifyChange, Observer, events, types }) {
    const bindings = new Map();
    const ownedOptions = new Set();
    const ownedGroups = new Set();
    const listeners = [];
    let disposed = false;

    function refresh(settings = getSettings()) {
        if (disposed) return;
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
            const restore = GEMINI_MODELS.includes(savedModel);
            const value = restore ? savedModel : previousValue;
            if (select.value !== value) select.value = value;
            if (restore && previousValue !== value) notifyChange(select);

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

    // Native settings are applied before third-party extensions load. In particular,
    // Vertex can replace an unknown saved model with an empty selection at startup.
    // The final SETTINGS_LOADED payload still contains the original saved choice.
    listen('SETTINGS_LOADED', settings => refresh(settings?.oai_settings ?? settings ?? getSettings()));
    for (const key of ['APP_READY', 'OAI_PRESET_CHANGED_BEFORE', 'OAI_PRESET_CHANGED_AFTER', 'CHATCOMPLETION_SOURCE_CHANGED']) {
        listen(key, () => refresh());
    }
    refresh();

    return {
        dispose() {
            disposed = true;
            for (const { observer } of bindings.values()) observer?.disconnect();
            bindings.clear();
            for (const [type, handler] of listeners) events.removeListener(type, handler);
            listeners.length = 0;
            for (const option of ownedOptions) option.remove();
            ownedOptions.clear();
            for (const group of ownedGroups) if (group.children.length === 0) group.remove();
            ownedGroups.clear();
        },
    };
}
