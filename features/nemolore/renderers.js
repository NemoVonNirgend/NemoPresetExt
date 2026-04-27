export async function renderNemoLoreInbox({
    getInbox,
    findWorldInfoMatches,
    formatWorldInfoEntryLabel,
    editCandidate,
    updateCandidateStatus,
    createCandidateWorldInfoEntry,
    appendCandidateToWorldInfoEntry,
    proposeCandidateWorldInfoUpdate,
}) {
    const container = $('#nemo_lore_inbox');
    if (!container.length) {
        return;
    }

    const inbox = await getInbox();
    const visible = inbox.filter(item => item.status === 'pending').slice(-20).reverse();
    container.empty();

    if (!visible.length) {
        container.append($('<div class="nemo-lore-muted"></div>').text('No pending memory candidates.'));
        return;
    }

    for (const item of visible) {
        const card = $('<div class="nemo-lore-card"></div>');
        const matches = await findWorldInfoMatches(item);
        card.append($('<div class="nemo-lore-card-title"></div>')
            .append($('<span></span>').text(`${item.type}: ${item.subject || 'Untitled'}`))
            .append($('<span></span>').text(`Confidence ${Math.round(item.confidence * 100)}%`)));
        card.append($('<div class="nemo-lore-summary"></div>').text(item.content));
        card.append($('<div class="nemo-lore-muted"></div>').text(`Keywords: ${item.keywords.join(', ') || 'none'} | Scope: ${item.scope}`));

        if (matches.length) {
            const match = matches[0];
            card.append($('<div class="nemo-lore-match"></div>').text(`Likely match: ${formatWorldInfoEntryLabel(match.entry)} (${match.score})`));
        }

        const actions = $('<div class="nemo-lore-card-actions"></div>');
        actions.append($('<button class="menu_button">Edit</button>').on('click', () => editCandidate(item.id)));
        actions.append($('<button class="menu_button">Accept</button>').on('click', () => updateCandidateStatus(item.id, 'accepted')));
        actions.append($('<button class="menu_button">Reject</button>').on('click', () => updateCandidateStatus(item.id, 'rejected')));
        actions.append($('<button class="menu_button">Create Entry</button>').on('click', () => createCandidateWorldInfoEntry(item.id)));
        if (matches.length) {
            actions.append($('<button class="menu_button">Append to Match</button>').on('click', () => appendCandidateToWorldInfoEntry(item.id, matches[0].entry.uid)));
            actions.append($('<button class="menu_button">Propose Update</button>').on('click', () => proposeCandidateWorldInfoUpdate(item.id, matches[0].entry.uid)));
        }
        card.append(actions);
        container.append(card);
    }
}

export async function renderNemoLorePreferences({
    getPreferences,
    editPreference,
    discussPreferenceCandidate,
    togglePreference,
    deletePreference,
}) {
    const container = $('#nemo_lore_preferences');
    if (!container.length) {
        return;
    }

    const preferences = await getPreferences();
    container.empty();

    if (!preferences.length) {
        container.append($('<div class="nemo-lore-muted"></div>').text('No cross-chat preferences yet.'));
        return;
    }

    for (const item of preferences.slice().sort((a, b) => b.updatedAt - a.updatedAt)) {
        const card = $('<div class="nemo-lore-card"></div>');
        card.append($('<div class="nemo-lore-card-title"></div>')
            .append($('<span></span>').text(`${item.type} | Priority ${item.priority}`))
            .append($('<span></span>').text(item.status)));
        card.append($('<div class="nemo-lore-summary"></div>').text(item.content));
        card.append($('<div class="nemo-lore-muted"></div>').text(`Keywords: ${item.keywords.join(', ') || 'none'} | Source: ${item.source}`));
        if (item.evidence) {
            card.append($('<div class="nemo-lore-match"></div>').text(`Evidence: ${item.evidence}`));
        }
        if (item.evidenceDetails) {
            card.append($('<div class="nemo-lore-muted"></div>').text(item.evidenceDetails));
        }

        const actions = $('<div class="nemo-lore-card-actions"></div>');
        actions.append($('<button class="menu_button">Edit</button>').on('click', () => editPreference(item.id)));
        actions.append($('<button class="menu_button">Discuss</button>').on('click', () => discussPreferenceCandidate(item.id)));
        actions.append($('<button class="menu_button"></button>').text(item.status === 'active' ? 'Disable' : 'Enable').on('click', () => togglePreference(item.id)));
        actions.append($('<button class="menu_button">Delete</button>').on('click', () => deletePreference(item.id)));
        card.append(actions);
        container.append(card);
    }
}

export async function renderNemoLorePreferenceReviewQueue({
    getPreferences,
    isPreferenceReviewCandidate,
    acceptPreferenceCandidate,
    editPreference,
    discussPreferenceCandidate,
    rejectPreferenceCandidate,
}) {
    const container = $('#nemo_lore_preference_review_queue');
    if (!container.length) {
        return;
    }

    const preferences = await getPreferences();
    const candidates = preferences
        .filter(item => isPreferenceReviewCandidate(item))
        .sort((a, b) => {
            return Number(b.confidence || 0) - Number(a.confidence || 0)
                || Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
        });

    container.empty();

    if (!candidates.length) {
        container.append($('<div class="nemo-lore-muted"></div>').text('No preference candidates waiting for review.'));
        return;
    }

    for (const item of candidates) {
        const confidence = Math.round(Number(item.confidence || 0) * 100);
        const card = $('<div class="nemo-lore-card nemo-lore-review-card"></div>');
        card.append($('<div class="nemo-lore-card-title"></div>')
            .append($('<span></span>').text(`${item.type} | Priority ${item.priority}`))
            .append($('<span></span>').text(`Review | ${confidence}%`)));
        card.append($('<div class="nemo-lore-summary"></div>').text(item.content));
        card.append($('<div class="nemo-lore-muted"></div>').text(`Keywords: ${(item.keywords || []).join(', ') || 'none'} | Source: ${item.source}`));
        if (item.evidence) {
            card.append($('<div class="nemo-lore-match"></div>').text(`Evidence: ${item.evidence}`));
        }
        if (item.evidenceDetails) {
            card.append($('<div class="nemo-lore-muted"></div>').text(item.evidenceDetails));
        }

        const actions = $('<div class="nemo-lore-card-actions"></div>');
        actions.append($('<button class="menu_button">Accept</button>').on('click', () => acceptPreferenceCandidate(item.id)));
        actions.append($('<button class="menu_button">Edit</button>').on('click', () => editPreference(item.id)));
        actions.append($('<button class="menu_button">Discuss</button>').on('click', () => discussPreferenceCandidate(item.id)));
        actions.append($('<button class="menu_button">Reject</button>').on('click', () => rejectPreferenceCandidate(item.id)));
        card.append(actions);
        container.append(card);
    }
}

export async function renderNemoLorePreferenceSignals({
    getPreferenceSignals,
    getPreferenceIgnoredSignals,
    getPreferences,
    getSignalSuppressionKeys,
    createPreferenceFromSignal,
    discussPreferenceSignal,
    ignorePreferenceSignal,
}) {
    const container = $('#nemo_lore_preference_signals');
    if (!container.length) {
        return;
    }

    const signals = await getPreferenceSignals();
    const ignored = await getPreferenceIgnoredSignals();
    const preferences = await getPreferences();
    const proposedEvidence = new Set(preferences.map(item => item.evidence).filter(Boolean).map(value => value.toLowerCase()));
    const visible = Object.values(signals)
        .filter(signal => signal && !getSignalSuppressionKeys(signal.key || signal.phrase).some(key => ignored[key]))
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, 25);

    container.empty();
    if (!visible.length) {
        container.append($('<div class="nemo-lore-muted"></div>').text('No active preference signals yet.'));
        return;
    }

    for (const signal of visible) {
        const phrase = signal.phrase || signal.key;
        const key = signal.key || phrase;
        const sources = Object.entries(signal.sources || {}).map(([source, count]) => `${source}: ${count}`).join(', ') || 'unknown';
        const card = $('<div class="nemo-lore-card"></div>');
        card.append($('<div class="nemo-lore-card-title"></div>')
            .append($('<span></span>').text(phrase))
            .append($('<span></span>').text(`Score ${Number(signal.score || 0).toFixed(1)} | Count ${signal.count || 0}`)));
        card.append($('<div class="nemo-lore-muted"></div>').text(`Sources: ${sources} | ${proposedEvidence.has(String(phrase).toLowerCase()) ? 'Candidate exists' : 'No candidate yet'}`));
        if (Array.isArray(signal.examples) && signal.examples.length) {
            card.append($('<details></details>')
                .append($('<summary></summary>').text('Examples'))
                .append($('<div class="nemo-lore-raw"></div>').text(signal.examples.join('\n\n---\n\n'))));
        }

        const actions = $('<div class="nemo-lore-card-actions"></div>');
        actions.append($('<button class="menu_button">Create Candidate</button>').on('click', () => createPreferenceFromSignal(key)));
        actions.append($('<button class="menu_button">Discuss</button>').on('click', () => discussPreferenceSignal(key)));
        actions.append($('<button class="menu_button">Ignore</button>').on('click', () => ignorePreferenceSignal(key)));
        card.append(actions);
        container.append(card);
    }
}

export async function renderNemoLorePreferenceEvidence({
    getPreferenceEvidenceLog,
    reflectOnPreferenceEvidence,
    ignoreEvidenceSignals,
    deletePreferenceEvidence,
}) {
    const container = $('#nemo_lore_preference_evidence');
    if (!container.length) {
        return;
    }

    const evidence = await getPreferenceEvidenceLog();
    container.empty();
    if (!evidence.length) {
        container.append($('<div class="nemo-lore-muted"></div>').text('No preference evidence has been logged yet.'));
        return;
    }

    for (const item of evidence.slice(0, 25)) {
        const signalText = (item.signals || []).slice(0, 8).map(signal => signal.phrase).filter(Boolean).join(', ') || 'none';
        const card = $('<div class="nemo-lore-card"></div>');
        card.append($('<div class="nemo-lore-card-title"></div>')
            .append($('<span></span>').text(`${item.source} evidence`))
            .append($('<span></span>').text(new Date(item.createdAt || Date.now()).toLocaleString())));
        card.append($('<div class="nemo-lore-muted"></div>').text(`Signals: ${signalText}`));

        const grid = $('<div class="nemo-lore-evidence-grid"></div>');
        if (item.rejectedText) {
            grid.append($('<div></div>')
                .append($('<div class="nemo-lore-muted"></div>').text('Rejected / removed'))
                .append($('<div class="nemo-lore-raw"></div>').text(item.rejectedText)));
        }
        if (item.acceptedText) {
            grid.append($('<div></div>')
                .append($('<div class="nemo-lore-muted"></div>').text('Accepted / kept'))
                .append($('<div class="nemo-lore-raw"></div>').text(item.acceptedText)));
        }
        if (grid.children().length) {
            card.append(grid);
        }

        const actions = $('<div class="nemo-lore-card-actions"></div>');
        actions.append($('<button class="menu_button">Reflect</button>').on('click', reflectOnPreferenceEvidence));
        actions.append($('<button class="menu_button">Ignore Signals</button>').on('click', () => ignoreEvidenceSignals(item.id)));
        actions.append($('<button class="menu_button">Delete Evidence</button>').on('click', () => deletePreferenceEvidence(item.id)));
        card.append(actions);
        container.append(card);
    }
}
