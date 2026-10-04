const ROW = 'li.completion_prompt_manager_prompt';
const SECTION = 'details.nemo-engine-section';
const completedLayouts = new WeakMap();

export function promptLayoutSignature(state, mode) {
    return state ? { owner: state.owner, context: state.context, topology: state.topology, frame: state.frame, mode } : null;
}

export function samePromptLayout(left, right) {
    return Boolean(left && right && left.owner === right.owner && left.context === right.context
        && left.topology === right.topology && left.frame === right.frame && left.mode === right.mode);
}

/** Record ownership at organization time, even before native wrappers attach. */
export function rememberPromptLayout(list, state, mode) {
    if (!list) return null;
    completedLayouts.delete(list);
    if (!state) return null;
    const rows = [...list.querySelectorAll(ROW)];
    if (rows.length !== state.rows.length || rows.some((row, index) => {
        const expected = state.rows[index];
        return row.dataset.pmIdentifier !== expected.id
            || row.querySelector('.completion_prompt_manager_prompt_name')?.dataset.pmName !== expected.name;
    })) return null;
    const signature = promptLayoutSignature(state, mode);
    completedLayouts.set(list, signature);
    return signature;
}

export function getRememberedPromptLayout(list) {
    return list ? completedLayouts.get(list) || null : null;
}

export function forgetPromptLayout(list) {
    if (list) completedLayouts.delete(list);
}

/** Save only section shells/open trays while native rendering replaces their list. */
export function capturePromptLayout(list, signature) {
    if (!list || !signature) return null;
    const sections = new Map();
    for (const section of list.querySelectorAll(SECTION)) {
        const id = section.querySelector('summary > li[data-pm-identifier]')?.dataset.pmIdentifier;
        if (id) sections.set(id, section);
    }
    if (!sections.size) return null;

    const displays = new Map();
    for (const row of list.querySelectorAll(ROW)) {
        if (row.style.display) displays.set(row.dataset.pmIdentifier, row.style.display);
        // Do not retain ordinary row subtrees through a save/network wait.
        // Canonical native rows will be regenerated; section headers stay live.
        if (row.parentElement?.tagName !== 'SUMMARY') row.remove();
    }
    const root = list.ownerDocument;
    const search = {
        query: root?.getElementById('nemoPresetSearchInput')?.value ?? '',
        bodies: Boolean(root?.getElementById('nemoSearchBodies')?.checked),
    };
    return { signature, sections, displays, search };
}

export function restorePromptLayoutSearch(snapshot, root) {
    if (!snapshot?.search) return;
    const input = root?.getElementById('nemoPresetSearchInput');
    const bodies = root?.getElementById('nemoSearchBodies');
    if (input) input.value = snapshot.search.query;
    if (bodies) bodies.checked = snapshot.search.bodies;
}

/** Release unused shells and any document listeners belonging to their trays. */
export function releasePromptLayout(snapshot) {
    if (!snapshot) return;
    for (const section of snapshot.sections.values()) {
        if (section.isConnected) continue;
        const tray = section._nemoCategoryTray;
        tray?._closeCleanup?.();
        tray?._keyCleanup?.();
        tray?.remove?.();
        delete section._nemoCategoryTray;
    }
    snapshot.sections.clear();
    snapshot.displays.clear();
    snapshot.signature = null;
    snapshot.search = null;
}
