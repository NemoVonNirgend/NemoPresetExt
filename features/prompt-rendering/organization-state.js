/** Track deferred UI work without retaining a list node or prompt content. */
export function createPromptOrganizationState() {
    let active = false, generation = 0, pending = false, forced = false;
    const toggles = new Set(), paints = new Set();
    const paused = () => toggles.size > 0 || paints.size > 0;

    function request(force = false) {
        if (!active) return;
        pending = true;
        forced ||= Boolean(force);
    }
    function begin(kind) {
        if (!active) return null;
        const token = Object.freeze({ generation, kind });
        (kind === 'paint' ? paints : toggles).add(token);
        return token;
    }
    function end(kind, token) {
        if (!active) return false;
        const tokens = kind === 'paint' ? paints : toggles;
        // Older tray callers have no token. Keep their paired API working.
        if (token === undefined) token = [...tokens].at(-1);
        if (!tokens.delete(token)) return false;
        return !paused();
    }

    return {
        activate() { if (!active) { active = true; generation++; } },
        dispose() {
            active = false; generation++; pending = false; forced = false;
            toggles.clear(); paints.clear();
        },
        request,
        defer(force = false) {
            if (!active) return true;
            if (!paused()) return false;
            request(force);
            return true;
        },
        take() {
            if (!active || paused() || !pending) return null;
            const result = { force: forced };
            pending = false; forced = false;
            return result;
        },
        beginToggle: () => begin('toggle'),
        endToggle: token => end('toggle', token),
        beginPaint: () => begin('paint'),
        endPaint: token => end('paint', token),
        get active() { return active; },
        get paused() { return paused(); },
        get generation() { return generation; },
    };
}
