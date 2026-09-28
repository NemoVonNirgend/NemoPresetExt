import { metadataMatches } from './search-engine.js';

const ROW = 'li.completion_prompt_manager_prompt';
const SECTION = 'details.nemo-engine-section';

export function applySearchMatches(container, matches) {
    for (const section of container.querySelectorAll(SECTION)) section.style.display = 'none';
    for (const row of container.querySelectorAll(ROW)) {
        const visible = matches.has(row.dataset.pmIdentifier);
        row.style.display = visible ? '' : 'none';
        if (!visible) continue;
        let section = row.closest(SECTION);
        while (section && container.contains(section)) {
            section.style.display = '';
            section.open = true;
            const summary = section.querySelector('summary > li');
            if (summary) summary.style.display = '';
            section = section.parentElement?.closest(SECTION);
        }
    }
}

/** Install before Nemo's input listener binds handlePresetSearch. No DOM observer. */
export function installSearchUI({ manager, root = document, getRows, getSources, bodySearch }) {
    const originalSearch = manager.handlePresetSearch;
    const originalCreate = manager.createSearchAndStatusUI;
    let active = true;
    let request = 0;
    const controls = new Set();

    function attachControls() {
        const input = root.getElementById('nemoPresetSearchInput');
        if (!input) return;
        input.placeholder = 'Search names, categories, tags and tooltips…';
        input.setAttribute('aria-label', 'Search prompt metadata');
        let label = root.getElementById('nemoSearchBodiesLabel');
        if (label) return;
        label = root.createElement('label');
        label.id = 'nemoSearchBodiesLabel';
        label.className = 'checkbox_label';
        const checkbox = root.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'nemoSearchBodies';
        checkbox.addEventListener('change', search);
        label.append(checkbox, root.createTextNode('Search prompt text'));
        const status = root.createElement('small');
        status.id = 'nemoSearchProgress';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        input.parentElement.insertAdjacentElement('afterend', label);
        label.insertAdjacentElement('afterend', status);
        controls.add(label);
        controls.add(status);
    }
    function status(text) {
        const node = root.getElementById('nemoSearchProgress');
        if (node) node.textContent = text;
    }
    function search() {
        if (!active) return originalSearch.call(manager);
        attachControls();
        const input = root.getElementById('nemoPresetSearchInput');
        const container = root.querySelector('#completion_prompt_manager_list');
        if (!input || !container) return;
        const current = ++request;
        const query = input.value.trim();
        bodySearch.cancel();
        if (!query) {
            bodySearch.dispose();
            status('');
            // Preserve the existing persisted section-open state on clear.
            return originalSearch.call(manager);
        }
        const matches = metadataMatches(getRows(), query);
        applySearchMatches(container, matches);
        if (!root.getElementById('nemoSearchBodies')?.checked) {
            bodySearch.dispose();
            status(`${matches.size} metadata matches`);
            return;
        }
        status('Searching prompt text… Metadata matches are shown first.');
        void bodySearch.search(query, getSources()).then(found => {
            if (!active || request !== current || !found || root.querySelector('#completion_prompt_manager_list') !== container) return;
            for (const id of found) matches.add(id);
            applySearchMatches(container, matches);
            status(`${matches.size} matches (metadata and prompt text)`);
        }).catch(error => {
            if (active && request === current) status(`Prompt-text search unavailable: ${error.message}. Only metadata matches are shown.`);
        });
    }
    function create(...args) {
        if (!active) return originalCreate.apply(this, args);
        request++;
        bodySearch.dispose();
        // Dispose references to controls in the replaced UI, not just their nodes.
        for (const node of controls) node.remove();
        controls.clear();
        const result = originalCreate.apply(this, args);
        attachControls();
        return result;
    }
    manager.handlePresetSearch = search;
    manager.createSearchAndStatusUI = create;
    attachControls();
    return {
        refresh() { request++; bodySearch.dispose(); if (active) search(); },
        cleanup() {
            active = false;
            request++;
            bodySearch.dispose();
            if (manager.handlePresetSearch === search) manager.handlePresetSearch = originalSearch;
            if (manager.createSearchAndStatusUI === create) manager.createSearchAndStatusUI = originalCreate;
            for (const node of controls) node.remove();
            controls.clear();
        },
    };
}
