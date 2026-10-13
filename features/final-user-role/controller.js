import { isFeatureEnabled } from '../../core/feature-settings.js';

/**
 * Change only the request copy; prompt definitions and chat history keep their roles.
 * Claude's separate prefill is appended by the server after messages, so move it
 * into messages before choosing the actual final entry.
 */
export function forceFinalUserRole(request) {
    if (!Array.isArray(request?.messages)) return false;

    const prefill = request.assistant_prefill;
    if (typeof prefill === 'string' && prefill.length > 0) {
        request.messages = [...request.messages, { role: 'user', content: prefill }];
        delete request.assistant_prefill;
        return true;
    }

    const last = request.messages.at(-1);
    if (!last || typeof last !== 'object' || Array.isArray(last) || last.role === 'user') return false;

    // A native tool response must remain paired with its assistant tool call.
    // Keep that protocol entry and repeat its content as the final user turn.
    if (last.role === 'tool' && last.tool_call_id) {
        request.messages = [...request.messages, { role: 'user', content: last.content }];
        return true;
    }

    const userMessage = { ...last, role: 'user' };
    // These fields describe an assistant/tool turn, not user content.
    for (const key of ['prefix', 'tool_calls', 'tool_call_id', 'function_call', 'reasoning', 'reasoning_content', 'signature']) {
        delete userMessage[key];
    }
    request.messages = [...request.messages.slice(0, -1), userMessage];
    return true;
}

export function createFinalUserRoleRuntime({ events, types, getSettings }) {
    const settingsReady = types.CHAT_COMPLETION_SETTINGS_READY;
    if (!settingsReady) return { dispose() {} };

    let disposed = false;
    const listeners = [];
    const guards = new WeakMap();
    const finalize = request => {
        if (disposed || !isFeatureEnabled(getSettings(), 'forceLastUserRole') || !Array.isArray(request?.messages)) return;
        if (guards.has(request) && guards.get(request) === request.toJSON) return;

        const originalToJSON = request.toJSON;
        const toJSON = function (key) {
            // Respect native serialization blockers and other extensions' serializers.
            const value = typeof originalToJSON === 'function' ? originalToJSON.call(this, key) : this;
            if (disposed || !isFeatureEnabled(getSettings(), 'forceLastUserRole') || !value || typeof value !== 'object' || Array.isArray(value)) return value;
            const outgoing = { ...value };
            delete outgoing.toJSON;
            forceFinalUserRole(outgoing);
            return outgoing;
        };
        // JSON.stringify happens after all settings listeners. Applying the override
        // there also catches content appended by a listener that runs after Nemo.
        Object.defineProperty(request, 'toJSON', { value: toJSON, configurable: true, writable: true, enumerable: false });
        guards.set(request, toJSON);
    };
    const moveFinalizerLast = () => {
        if (disposed) return;
        if (typeof events.makeLast === 'function') {
            events.makeLast(settingsReady, finalize);
        } else {
            events.removeListener(settingsReady, finalize);
            events.on(settingsReady, finalize);
        }
    };

    // Reorder after extension startup and before every assembled request, including
    // raw/quiet generations. This includes settings listeners installed after Nemo.
    for (const key of ['APP_READY', 'GENERATION_STARTED', 'CHAT_COMPLETION_PROMPT_READY']) {
        const type = types[key];
        if (!type) continue;
        events.on(type, moveFinalizerLast);
        listeners.push([type, moveFinalizerLast]);
    }
    moveFinalizerLast();

    return {
        dispose() {
            disposed = true;
            events.removeListener(settingsReady, finalize);
            for (const [type, listener] of listeners) events.removeListener(type, listener);
            listeners.length = 0;
        },
    };
}
