/** Read-only structural discovery. Names/versions describe a preset; its fields identify selectors. */
const SPACE = /[\s\u2800]+/g;
const clean = value => String(value ?? '').replace(SPACE, ' ').trim();
const comments = text => text.replace(/\{\{\/\/[^{}]*\}\}/g, '');
const selectionFields = new Set(['NCGenreId', 'NCAuthorId', 'NCStyleId']);

export function selectorBody(text) {
    return comments(String(text ?? '')).replace(/\{\{trim\}\}/g, '').replace(/^[\s\u2800]+|[\s\u2800]+$/g, '');
}

export function vexSelectorKey(text) {
    return /^\{\{setvar::(NVCR\d+_(?:raw_[a-z0-9_]+|default_requested))::1\}\}/i.exec(selectorBody(text))?.[1] ?? null;
}

export function hasRecipeSelection(text) {
    const body = selectorBody(text);
    return body.startsWith('{{setvar::') && /\{\{setvar::(?:NCGenreId|NCAuthorId|NCStyleId)::/.test(body);
}

export function recipePartitionGenre(text) {
    return /^\{\{#if[\s\u2800]+\{\{\.NCGenreId[\s\u2800]*==[\s\u2800]*([a-z0-9_]+)\}\}\}\}/.exec(selectorBody(text))?.[1] ?? null;
}

/** Resolve the actual profile order, retaining unreferenced entries for inspection. */
function sequence(preset, profile, byId) {
    const seen = new Set(), result = [];
    for (const entry of Array.isArray(profile?.order) ? profile.order : []) {
        if (!entry) continue;
        if (seen.has(entry.identifier) || !byId.has(entry.identifier)) continue;
        seen.add(entry.identifier); result.push({ prompt: byId.get(entry.identifier), enabled: entry.enabled === true });
    }
    for (const prompt of byId.values()) if (!seen.has(prompt.identifier)) {
        seen.add(prompt.identifier); result.push({ prompt, enabled: profile ? false : prompt.enabled !== false });
    }
    return result;
}

export function buildPresetIndex(preset) {
    const byId = new Map(), issues = [], groups = [], records = [];
    for (const prompt of Array.isArray(preset?.prompts) ? preset.prompts : []) {
        if (!prompt?.identifier || byId.has(prompt.identifier)) { issues.push('Duplicate or missing prompt identifier.'); continue; }
        byId.set(prompt.identifier, prompt);
    }
    const profiles = (Array.isArray(preset?.prompt_order) ? preset.prompt_order : []).filter(p => p && typeof p === 'object');
    const profile = profiles.find(p => String(p.character_id) === '100001') ?? profiles[0];
    let category = null, subcategory = null, wiki = false;
    for (const { prompt, enabled } of sequence(preset, profile, byId)) {
        const name = clean(prompt.name || prompt.identifier), body = String(prompt.content ?? '');
        const heading = /^={3,}\s*(.+?)\s*={3,}$/.exec(name);
        const sub = /^<([^>]+)>$/.exec(name);
        if (heading) {
            wiki = true; category = prompt.identifier; subcategory = null;
            groups.push({ id: category, name: heading[1], parentId: null });
        } else if (sub && category) {
            wiki = true; subcategory = prompt.identifier;
            groups.push({ id: subcategory, name: sub[1], parentId: category });
        } else if (/[━─—–-]{2,}/.test(name) && !body.trim()) {
            category = prompt.identifier; subcategory = null;
            groups.push({ id: category, name: clean(name.replace(/[━─—–-]/g, '')), parentId: null });
        }
        const metadata = /\{\{\/\/\s*@category\s+([^{}]+?)\s*\}\}/.exec(body)?.[1];
        const assignments = [];
        if (hasRecipeSelection(body)) {
            const setter = /\{\{setvar::([A-Za-z][\w-]*)::([^{}]*?)\}\}/g;
            let match;
            while ((match = setter.exec(comments(body)))) if (selectionFields.has(match[1])) {
                assignments.push({ field: match[1], value: clean(match[2]) });
            }
        }
        const vex = vexSelectorKey(body);
        const genre = recipePartitionGenre(body);
        if (vex || assignments.length || genre) records.push({
            id: prompt.identifier, name, enabled, groupId: subcategory ?? category,
            category: metadata ? clean(metadata) : null,
            vex, selections: assignments, recipeGenre: genre,
        });
    }
    for (const saved of profiles) for (const entry of Array.isArray(saved.order) ? saved.order : []) if (entry && !byId.has(entry.identifier)) {
        issues.push(`Profile ${saved.character_id} references missing prompt ${entry.identifier}.`);
    }
    const selectors = field => records.flatMap(record => record.selections.filter(s => s.field === field)
        .map(selection => ({ id: record.id, name: record.name, value: selection.value, groupId: record.groupId })));
    return {
        dialect: wiki ? 'nemo-wiki' : groups.length ? 'legacy' : 'flat',
        promptCount: byId.size, profileCount: profiles.length, groups, records, issues,
        vexes: records.filter(record => record.vex).map(({ id, name, vex, groupId }) => ({ id, name, flag: vex, groupId })),
        genres: selectors('NCGenreId'), authors: selectors('NCAuthorId'), styles: selectors('NCStyleId'),
        recipeBanks: records.filter(record => record.recipeGenre).map(({ id, recipeGenre }) => ({ id, genre: recipeGenre })),
    };
}

export function indexSummary(preset) {
    const index = buildPresetIndex(preset);
    return { dialect: index.dialect, prompts: index.promptCount, vexes: index.vexes.length,
        genres: index.genres.length, authors: index.authors.length, styles: index.styles.length,
        recipeBanks: index.recipeBanks.length, issues: index.issues.length };
}
