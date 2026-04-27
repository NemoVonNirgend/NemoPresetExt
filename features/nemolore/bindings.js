import { saveSettingsDebounced } from '../../../../../../script.js';

export async function bindNemoLoreSettings({
    settings,
    defaults,
    updateTimelinePrompt,
    updateRetrievedArchivePrompt,
    updatePreferencesPrompt,
    vectorizeArchiveItems,
    refreshProfilesDropdown,
    refreshWorldDropdown,
    renderInspector,
    renderInbox,
    renderArchive,
    renderPreferences,
    renderPreferenceSignals,
    renderPreferenceEvidence,
    updateStatus,
    processQueue,
    enqueueCompletedTurns,
    searchArchive,
    rememberPreferenceNote,
    reflectOnPreferenceEvidence,
    clearPreferenceEvidence,
    clearIgnoredPreferenceSignals,
    removeProblemLineMenu,
}) {
    const cfg = settings();
    $('#nemo_lore_enabled').prop('checked', cfg.enabled).on('input', async function () {
        cfg.enabled = !!$(this).prop('checked');
        saveSettingsDebounced();
        await updateTimelinePrompt();
        await updateRetrievedArchivePrompt();
        await updatePreferencesPrompt();
    });
    $('#nemo_lore_background_enabled').prop('checked', cfg.backgroundEnabled).on('input', function () {
        cfg.backgroundEnabled = !!$(this).prop('checked');
        saveSettingsDebounced();
    });
    $('#nemo_lore_live_window').val(cfg.liveWindowMessages).on('change', async function () {
        cfg.liveWindowMessages = Number($(this).val()) || defaults.liveWindowMessages;
        saveSettingsDebounced();
        await updateTimelinePrompt();
    });
    $('#nemo_lore_max_tokens').val(cfg.maxSummaryTokens).on('change', function () {
        cfg.maxSummaryTokens = Number($(this).val()) || defaults.maxSummaryTokens;
        saveSettingsDebounced();
    });
    $('#nemo_lore_injection_depth').val(cfg.injectionDepth).on('change', async function () {
        cfg.injectionDepth = Number($(this).val()) || defaults.injectionDepth;
        saveSettingsDebounced();
        await updateTimelinePrompt();
    });
    $('#nemo_lore_hide_after').val(cfg.hideAfterMessages).on('change', function () {
        cfg.hideAfterMessages = Number($(this).val()) || defaults.hideAfterMessages;
        saveSettingsDebounced();
    });
    $('#nemo_lore_auto_hide').prop('checked', cfg.autoHideSummarized).on('input', function () {
        cfg.autoHideSummarized = !!$(this).prop('checked');
        saveSettingsDebounced();
    });
    $('#nemo_lore_vector_enabled').prop('checked', cfg.vectorEnabled).on('input', async function () {
        cfg.vectorEnabled = !!$(this).prop('checked');
        saveSettingsDebounced();
        if (cfg.vectorEnabled) {
            await vectorizeArchiveItems();
        }
        await updateRetrievedArchivePrompt();
    });
    $('#nemo_lore_template').val(cfg.template).on('change', async function () {
        cfg.template = String($(this).val() || defaults.template);
        saveSettingsDebounced();
        await updateTimelinePrompt();
    });
    $('#nemo_lore_retrieval_count').val(cfg.retrievalCount).on('change', async function () {
        cfg.retrievalCount = Number($(this).val()) || defaults.retrievalCount;
        saveSettingsDebounced();
        await updateRetrievedArchivePrompt();
    });
    $('#nemo_lore_retrieval_depth').val(cfg.retrievalDepth).on('change', async function () {
        cfg.retrievalDepth = Number($(this).val()) || defaults.retrievalDepth;
        saveSettingsDebounced();
        await updateRetrievedArchivePrompt();
    });
    $('#nemo_lore_vector_threshold').val(cfg.vectorThreshold).on('change', async function () {
        cfg.vectorThreshold = Number($(this).val());
        saveSettingsDebounced();
        await updateRetrievedArchivePrompt();
    });
    $('#nemo_lore_retrieval_template').val(cfg.retrievalTemplate).on('change', async function () {
        cfg.retrievalTemplate = String($(this).val() || defaults.retrievalTemplate);
        saveSettingsDebounced();
        await updateRetrievedArchivePrompt();
    });
    $('#nemo_lore_preferences_enabled').prop('checked', cfg.preferencesEnabled).on('input', async function () {
        cfg.preferencesEnabled = !!$(this).prop('checked');
        saveSettingsDebounced();
        await updatePreferencesPrompt();
    });
    $('#nemo_lore_inference_enabled').prop('checked', cfg.inferenceEnabled).on('input', function () {
        cfg.inferenceEnabled = !!$(this).prop('checked');
        saveSettingsDebounced();
    });
    $('#nemo_lore_selection_problem_menu').prop('checked', cfg.selectionProblemMenu).on('input', function () {
        cfg.selectionProblemMenu = !!$(this).prop('checked');
        if (!cfg.selectionProblemMenu) {
            removeProblemLineMenu();
        }
        saveSettingsDebounced();
    });
    $('#nemo_lore_preference_variable').val(cfg.preferenceVariableName || defaults.preferenceVariableName).on('change', async function () {
        cfg.preferenceVariableName = String($(this).val() || defaults.preferenceVariableName).trim();
        saveSettingsDebounced();
        await updatePreferencesPrompt();
    });
    $('#nemo_lore_preference_limit').val(cfg.preferenceLimit).on('change', async function () {
        cfg.preferenceLimit = Number($(this).val()) || defaults.preferenceLimit;
        saveSettingsDebounced();
        await updatePreferencesPrompt();
    });
    $('#nemo_lore_inference_threshold').val(cfg.inferenceThreshold).on('change', function () {
        cfg.inferenceThreshold = Number($(this).val()) || defaults.inferenceThreshold;
        saveSettingsDebounced();
    });
    $('#nemo_lore_preference_template').val(cfg.preferenceTemplate).on('change', async function () {
        cfg.preferenceTemplate = String($(this).val() || defaults.preferenceTemplate);
        saveSettingsDebounced();
        await updatePreferencesPrompt();
    });
    $('#nemo_lore_profile').on('change', function () {
        cfg.memoryProfileId = String($(this).val() || '');
        saveSettingsDebounced();
    });
    $('#nemo_lore_disable_all').on('click', async () => {
        const current = settings();
        current.enabled = false;
        if (current.guides) {
            current.guides.enabled = false;
        }

        $('#nemo_lore_enabled').prop('checked', false);
        $('#nlg_enabled').prop('checked', false).trigger('change');
        saveSettingsDebounced();

        await updateTimelinePrompt();
        await updateRetrievedArchivePrompt();
        await updatePreferencesPrompt();
        updateStatus();

        toastr.info('NemoLore memory and Guides are disabled. Stored data was not deleted.', 'NemoLore');
    });
    $('#nemo_lore_world').on('change', function () {
        cfg.managedWorld = String($(this).val() || '');
        saveSettingsDebounced();
    });
    $('#nemo_lore_scan').on('click', async () => {
        await enqueueCompletedTurns();
        await processQueue();
    });
    $('#nemo_lore_process').on('click', processQueue);
    $('#nemo_lore_vectorize_archive').on('click', async () => {
        await vectorizeArchiveItems();
        toastr.success('Archive vectorization finished.', 'NemoLore');
    });
    $('#nemo_lore_refresh').on('click', async () => {
        await refreshProfilesDropdown();
        await refreshWorldDropdown();
        await renderInspector();
        await renderInbox();
        await renderArchive();
        await renderPreferences();
        await renderPreferenceSignals();
        await renderPreferenceEvidence();
        await updateTimelinePrompt();
        await updateRetrievedArchivePrompt();
        updateStatus();
    });
    $('#nemo_lore_archive_search_button').on('click', searchArchive);
    $('#nemo_lore_archive_search').on('keydown', async function (event) {
        if (event.key === 'Enter') {
            await searchArchive();
        }
    });
    $('#nemo_lore_teach_button').on('click', rememberPreferenceNote);
    $('#nemo_lore_reflect_preferences').on('click', reflectOnPreferenceEvidence);
    $('#nemo_lore_clear_evidence').on('click', clearPreferenceEvidence);
    $('#nemo_lore_clear_ignored_signals').on('click', clearIgnoredPreferenceSignals);
    $('#nemo_lore_teach_input').on('keydown', async function (event) {
        if (event.key === 'Enter') {
            await rememberPreferenceNote();
        }
    });

    await refreshProfilesDropdown();
    await refreshWorldDropdown();
    updateStatus();
    await renderInspector();
    await renderInbox();
    await renderArchive();
    await renderPreferences();
    await renderPreferenceSignals();
    await renderPreferenceEvidence();
    await updateRetrievedArchivePrompt();
    await updatePreferencesPrompt();
}

