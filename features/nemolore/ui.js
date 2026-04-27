export function updateNemoLoreStatus(queue, isProcessing) {
    const counts = queue.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
    }, {});

    const text = isProcessing
        ? `Processing: ${counts.queued || 0} queued, ${counts.complete || 0} complete, ${counts.failed || 0} failed`
        : `Idle: ${counts.queued || 0} queued, ${counts.complete || 0} complete, ${counts.failed || 0} failed`;

    $('#nemo_lore_status').text(text);
}

export async function renderNemoLoreInspector({ getTimeline, hasArchiveForMessages }) {
    const container = $('#nemo_lore_inspector');
    if (!container.length) {
        return;
    }

    const timeline = await getTimeline();
    container.empty();

    for (const item of timeline.slice(-12).reverse()) {
        const archived = await hasArchiveForMessages(item.chatId, item.sourceMessageIds);
        const card = $('<div class="nemo-lore-card"></div>');
        card.append($('<div class="nemo-lore-card-title"></div>')
            .append($('<span></span>').text(`Messages ${item.sourceMessageIds.join('-')}`))
            .append($('<span></span>').text(`${archived ? 'Archived' : 'Not archived'} | Importance ${item.importance}`)));
        card.append($('<div class="nemo-lore-summary"></div>').text(item.summary));
        container.append(card);
    }
}

export async function renderNemoLoreArchive({ getArchive, results = null }) {
    const container = $('#nemo_lore_archive');
    if (!container.length) {
        return;
    }

    const archive = results || (await getArchive()).slice(-10).reverse();
    container.empty();

    if (!archive.length) {
        container.append($('<div class="nemo-lore-muted"></div>').text('No archived turns yet.'));
        return;
    }

    for (const item of archive) {
        const card = $('<div class="nemo-lore-card"></div>');
        card.append($('<div class="nemo-lore-card-title"></div>')
            .append($('<span></span>').text(`Messages ${item.sourceMessageIds.join('-')}`))
            .append($('<span></span>').text(`${item.vectorized ? 'Vectorized' : 'Not vectorized'} | Importance ${item.importance}`)));
        card.append($('<div class="nemo-lore-summary"></div>').text(item.summary));
        card.append($('<details></details>')
            .append($('<summary></summary>').text('Raw source turn'))
            .append($('<div class="nemo-lore-raw"></div>').text(item.rawText)));
        container.append(card);
    }
}

export async function searchNemoLoreArchive({
    getArchive,
    renderArchive,
    vectorEnabled,
    retrievalCount,
    queryArchiveVectors,
}) {
    const query = String($('#nemo_lore_archive_search').val() || '').trim().toLowerCase();
    const archive = await getArchive();

    if (!query) {
        await renderArchive();
        return;
    }

    const terms = query.split(/\s+/).filter(Boolean);
    let results = [];

    if (vectorEnabled) {
        try {
            results = await queryArchiveVectors(query, retrievalCount);
        } catch (error) {
            console.warn('[NemoLore] Vector archive search failed; falling back to lexical search', error);
        }
    }

    if (!results.length) {
        results = archive
            .map(item => ({ item, score: scoreNemoLoreArchiveItem(item, terms) }))
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(result => result.item);
    }

    await renderArchive(results);
}

export function scoreNemoLoreArchiveItem(item, terms) {
    const raw = String(item.rawText || '').toLowerCase();
    const summary = String(item.summary || '').toLowerCase();
    const entities = Array.isArray(item.entities) ? item.entities.join('\n').toLowerCase() : '';
    let score = 0;

    for (const term of terms) {
        if (entities.includes(term)) {
            score += 4;
        }
        if (summary.includes(term)) {
            score += 3;
        }
        if (raw.includes(term)) {
            score += 1;
        }
    }

    return score;
}

export async function refreshNemoLoreProfilesDropdown({ selectedProfileId, getSupportedProfiles }) {
    const dropdown = $('#nemo_lore_profile');
    dropdown.empty();
    dropdown.append($('<option value="">Select a memory model profile</option>'));

    try {
        for (const profile of getSupportedProfiles()) {
            dropdown.append($('<option></option>').val(profile.id).text(profile.name));
        }
    } catch (error) {
        console.warn('[NemoLore] Could not load connection profiles', error);
    }

    dropdown.val(selectedProfileId);
}

export async function refreshNemoLoreWorldDropdown({ managedWorld, updateWorldInfoList, getWorldNames }) {
    const dropdown = $('#nemo_lore_world');
    dropdown.empty();
    dropdown.append($('<option value="">Select a lorebook</option>'));

    try {
        await updateWorldInfoList();
        for (const name of getWorldNames()) {
            dropdown.append($('<option></option>').val(name).text(name));
        }
    } catch (error) {
        console.warn('[NemoLore] Could not load world info list', error);
    }

    dropdown.val(managedWorld);
}

