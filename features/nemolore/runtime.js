import {
    eventSource,
    event_types,
} from '../../../../../../script.js';
import {
    DEFAULT_SETTINGS,
    FEATURE_PATH,
    LOG_PREFIX,
    PREFERENCES_PROMPT_TAG,
    PREFERENCES_VARIABLE_NAME,
    PROMPT_TAG,
    RETRIEVAL_PROMPT_TAG,
    STYLE_ELEMENT_ID,
} from './constants.js';
import { getNemoLoreSettings as settings, ensureNemoLoreStyles as ensureFeatureStyles } from './settings.js';
import { getPreferences, setNemoLoreStorage } from './storage.js';
import {
    updateNemoLoreStatus,
    renderNemoLoreInspector,
    renderNemoLoreArchive,
    searchNemoLoreArchive,
    refreshNemoLoreProfilesDropdown,
    refreshNemoLoreWorldDropdown,
} from './ui.js';
import {
    renderNemoLoreInbox,
    renderNemoLorePreferences,
    renderNemoLorePreferenceReviewQueue,
    renderNemoLorePreferenceSignals,
    renderNemoLorePreferenceEvidence,
} from './renderers.js';
import { bindNemoLoreSettings } from './bindings.js';
import { clearPromptBlock } from './shared/prompt-service.js';
import {
    clearGlobalPromptVariable,
    normalizePromptVariableName,
    setGlobalPromptVariable,
} from './shared/variable-service.js';
import {
    getMemoryQueue,
    isMemoryProcessing,
    hasArchiveForMessages,
    getCurrentRetrievalQuery,
    enqueueCompletedTurns,
    processQueue,
    queryArchiveVectors,
    updateTimelinePrompt,
    updateRetrievedArchivePrompt,
    vectorizeArchiveItems,
} from './memory.js';
import {
    editNemoLoreCandidate,
    updateNemoLoreCandidateStatus,
    createNemoLoreWorldInfoEntry,
    appendNemoLoreCandidateToWorldInfoEntry,
    proposeNemoLoreWorldInfoUpdate,
    findNemoLoreWorldInfoMatches,
    formatNemoLoreWorldInfoEntryLabel,
} from './lorebook.js';
import {
    rememberPreferenceNoteCore,
    observeRejectedSwipeCore,
    observeContinuedSwipeChoiceCore,
    rememberVisibleAssistantStateCore,
    observeEditedMessageCore,
    reflectOnPreferenceEvidenceCore,
    createPreferenceFromSignalCore,
    discussPreferenceSignalCore,
    ignorePreferenceSignalCore,
    ignoreEvidenceSignalsCore,
    deletePreferenceEvidenceCore,
    clearPreferenceEvidenceCore,
    clearIgnoredPreferenceSignalsCore,
    discussPreferenceCandidateCore,
    applyPreferenceDiscussionCore,
    isPreferenceReviewCandidate,
    acceptPreferenceCandidateCore,
    rejectPreferenceCandidateCore,
    editPreferenceCore,
    togglePreferenceCore,
    deletePreferenceCore,
    recordRewriteNotePreferenceCore,
    initProblemLineSelectionMenuCore,
    removeProblemLineMenuCore,
} from './preferences.js';
import { cleanupNemoLoreGuideTools, initNemoLoreGuideTools } from './guides/runtime.js';
import { installNemoLoreDebug, uninstallNemoLoreDebug } from './debug.js';

let initialized = false;
const registeredEventHandlers = [];
let lastPreferenceVariableName = null;


function registerEventHandler(eventName, handler) {
    eventSource.on(eventName, handler);
    registeredEventHandlers.push([eventName, handler]);
}

function updateStatus() {
    updateNemoLoreStatus(getMemoryQueue(), isMemoryProcessing());
}

async function updatePreferencesPrompt() {
    const cfg = settings();
    const variableName = normalizePromptVariableName(cfg.preferenceVariableName, PREFERENCES_VARIABLE_NAME);
    cfg.preferenceVariableName = variableName;

    // Preferences are consumed by the Nemo Engine core pack via
    // {{getglobalvar::NemoLorePreferences}}, not inserted as a separate
    // extension prompt block. Clear the legacy block every refresh.
    clearPromptBlock(PREFERENCES_PROMPT_TAG, { position: 'in_prompt', depth: cfg.preferenceDepth });

    if (lastPreferenceVariableName && lastPreferenceVariableName !== variableName) {
        clearGlobalPromptVariable(lastPreferenceVariableName);
    }
    lastPreferenceVariableName = variableName;

    if (!cfg.enabled || !cfg.preferencesEnabled) {
        clearGlobalPromptVariable(variableName);
        return;
    }

    const preferences = await getPreferences();
    const active = preferences
        .filter(item => item.status === 'active')
        .sort((a, b) => b.priority - a.priority || b.updatedAt - a.updatedAt)
        .slice(0, cfg.preferenceLimit);
    const preferenceText = active.map(item => `- ${item.content}`).join('\n');
    const prompt = preferenceText ? cfg.preferenceTemplate.replace('{{preferences}}', preferenceText) : '';

    setGlobalPromptVariable(variableName, prompt);
}

async function renderInspector() {
    await renderNemoLoreInspector({ getTimeline: async (...args) => (await import('./storage.js')).getTimeline(...args), hasArchiveForMessages });
}

async function renderArchive(results = null) {
    await renderNemoLoreArchive({ getArchive: async (...args) => (await import('./storage.js')).getArchive(...args), results });
}

async function renderInbox() {
    const { getInbox } = await import('./storage.js');
    await renderNemoLoreInbox({
        getInbox,
        findWorldInfoMatches: findNemoLoreWorldInfoMatches,
        formatWorldInfoEntryLabel: formatNemoLoreWorldInfoEntryLabel,
        editCandidate,
        updateCandidateStatus,
        createCandidateWorldInfoEntry,
        appendCandidateToWorldInfoEntry,
        proposeCandidateWorldInfoUpdate,
    });
}

async function renderPreferences() {
    await renderNemoLorePreferenceReviewQueue({
        getPreferences,
        isPreferenceReviewCandidate,
        acceptPreferenceCandidate,
        editPreference,
        discussPreferenceCandidate,
        rejectPreferenceCandidate,
    });
    await renderNemoLorePreferences({
        getPreferences,
        editPreference,
        discussPreferenceCandidate,
        togglePreference,
        deletePreference,
    });
}

async function renderPreferenceSignals() {
    const { getPreferenceSignals, getPreferenceIgnoredSignals } = await import('./storage.js');
    const { getSignalSuppressionKeys } = await import('./preferences.js');
    await renderNemoLorePreferenceSignals({
        getPreferenceSignals,
        getPreferenceIgnoredSignals,
        getPreferences,
        getSignalSuppressionKeys,
        createPreferenceFromSignal,
        discussPreferenceSignal,
        ignorePreferenceSignal,
    });
}

async function renderPreferenceEvidence() {
    const { getPreferenceEvidenceLog } = await import('./storage.js');
    await renderNemoLorePreferenceEvidence({
        getPreferenceEvidenceLog,
        reflectOnPreferenceEvidence,
        ignoreEvidenceSignals,
        deletePreferenceEvidence,
    });
}

function getPreferenceHooks() {
    return {
        renderPreferences,
        renderPreferenceSignals,
        renderPreferenceEvidence,
        updatePreferencesPrompt,
    };
}

async function refreshProfilesDropdown() {
    const { ConnectionManagerRequestService } = await import('../../../../shared.js');
    await refreshNemoLoreProfilesDropdown({
        selectedProfileId: settings().memoryProfileId,
        getSupportedProfiles: () => ConnectionManagerRequestService.getSupportedProfiles(),
    });
}

async function refreshWorldDropdown() {
    const { updateWorldInfoList, world_names } = await import('../../../../../world-info.js');
    await refreshNemoLoreWorldDropdown({
        managedWorld: settings().managedWorld,
        updateWorldInfoList,
        getWorldNames: () => world_names || [],
    });
}

async function searchArchive() {
    const cfg = settings();
    const { getArchive } = await import('./storage.js');
    await searchNemoLoreArchive({
        getArchive,
        renderArchive,
        vectorEnabled: cfg.vectorEnabled,
        retrievalCount: cfg.retrievalCount,
        queryArchiveVectors,
    });
}

async function rememberPreferenceNote() { return rememberPreferenceNoteCore(getPreferenceHooks()); }
async function observeRejectedSwipe(messageId) { return observeRejectedSwipeCore(messageId, getPreferenceHooks()); }
async function observeContinuedSwipeChoice(userMessageId) { return observeContinuedSwipeChoiceCore(userMessageId, getPreferenceHooks()); }
async function observeEditedMessage(messageId) { return observeEditedMessageCore(messageId, getPreferenceHooks()); }
async function reflectOnPreferenceEvidence() { return reflectOnPreferenceEvidenceCore(getPreferenceHooks()); }
async function createPreferenceFromSignal(key) { return createPreferenceFromSignalCore(key, getPreferenceHooks()); }
async function discussPreferenceSignal(key) { return discussPreferenceSignalCore(key, getPreferenceHooks()); }
async function ignorePreferenceSignal(key) { return ignorePreferenceSignalCore(key, getPreferenceHooks()); }
async function ignoreEvidenceSignals(id) { return ignoreEvidenceSignalsCore(id, getPreferenceHooks()); }
async function deletePreferenceEvidence(id) { return deletePreferenceEvidenceCore(id, getPreferenceHooks()); }
async function clearPreferenceEvidence() { return clearPreferenceEvidenceCore(getPreferenceHooks()); }
async function clearIgnoredPreferenceSignals() { return clearIgnoredPreferenceSignalsCore(getPreferenceHooks()); }
async function discussPreferenceCandidate(id) { return discussPreferenceCandidateCore(id, getPreferenceHooks()); }
async function applyPreferenceDiscussion(id, clarification) { return applyPreferenceDiscussionCore(id, clarification, getPreferenceHooks()); }
async function acceptPreferenceCandidate(id) { return acceptPreferenceCandidateCore(id, getPreferenceHooks()); }
async function rejectPreferenceCandidate(id) { return rejectPreferenceCandidateCore(id, getPreferenceHooks()); }
async function editPreference(id) { return editPreferenceCore(id, getPreferenceHooks()); }
async function togglePreference(id) { return togglePreferenceCore(id, getPreferenceHooks()); }
async function deletePreference(id) { return deletePreferenceCore(id, getPreferenceHooks()); }
async function recordRewriteNotePreference(entry) { return recordRewriteNotePreferenceCore(entry, getPreferenceHooks()); }
function initProblemLineSelectionMenu() { return initProblemLineSelectionMenuCore(getPreferenceHooks()); }
function removeProblemLineMenu() { return removeProblemLineMenuCore(); }
function rememberVisibleAssistantState() { return rememberVisibleAssistantStateCore(); }
async function editCandidate(id) { return editNemoLoreCandidate(id, { renderInbox }); }
async function updateCandidateStatus(id, status) { return updateNemoLoreCandidateStatus(id, status, { renderInbox }); }
async function createCandidateWorldInfoEntry(id) { return createNemoLoreWorldInfoEntry(id, { renderInbox }); }
async function appendCandidateToWorldInfoEntry(id, uid) { return appendNemoLoreCandidateToWorldInfoEntry(id, uid, { renderInbox }); }
async function proposeCandidateWorldInfoUpdate(id, uid) { return proposeNemoLoreWorldInfoUpdate(id, uid, { renderInbox }); }

async function onAssistantRendered(messageId) {
    const cfg = settings();
    if (!cfg.enabled) return;
    await enqueueCompletedTurns(updateStatus);
    await updateTimelinePrompt();
    await updateRetrievedArchivePrompt();
    await updatePreferencesPrompt();
    if (cfg.backgroundEnabled) {
        await processQueue({
            onStatusChange: updateStatus,
            onInspectorRefresh: renderInspector,
            onInboxRefresh: renderInbox,
            onArchiveRefresh: renderArchive,
            onRenderArchive: renderArchive,
            onRenderInspector: renderInspector,
        });
    }
}

export async function initNemoLore() {
    if (initialized) return;
    initialized = true;
    try {
        settings();
        setNemoLoreStorage(SillyTavern.libs.localforage.createInstance({ name: 'SillyTavern_NemoLore' }));
        ensureFeatureStyles();
        if (!document.getElementById('nemo_lore_settings')) {
            const response = await fetch(`${FEATURE_PATH}/settings.html`, { cache: 'no-store' });
            if (!response.ok) throw new Error(`Failed to load NemoLore settings.html (${response.status})`);
            $('#extensions_settings2').append(await response.text());
        }
        await bindNemoLoreSettings({
            settings,
            defaults: DEFAULT_SETTINGS,
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
            processQueue: () => processQueue({
                onStatusChange: updateStatus,
                onInspectorRefresh: renderInspector,
                onInboxRefresh: renderInbox,
                onArchiveRefresh: renderArchive,
                onRenderArchive: renderArchive,
                onRenderInspector: renderInspector,
            }),
            enqueueCompletedTurns: () => enqueueCompletedTurns(updateStatus),
            searchArchive,
            rememberPreferenceNote,
            reflectOnPreferenceEvidence,
            clearPreferenceEvidence,
            clearIgnoredPreferenceSignals,
            removeProblemLineMenu,
        });
        await initNemoLoreGuideTools();
        installNemoLoreDebug();
        window.NemoLorePreferenceBridge = {
            recordRewriteNote: recordRewriteNotePreference,
        };
        await updateTimelinePrompt();
        await updatePreferencesPrompt();
        rememberVisibleAssistantState();
        initProblemLineSelectionMenu();
        registerEventHandler(event_types.CHARACTER_MESSAGE_RENDERED, onAssistantRendered);
        registerEventHandler(event_types.USER_MESSAGE_RENDERED, updateRetrievedArchivePrompt);
        registerEventHandler(event_types.USER_MESSAGE_RENDERED, observeContinuedSwipeChoice);
        registerEventHandler(event_types.MESSAGE_EDITED, observeEditedMessage);
        registerEventHandler(event_types.MESSAGE_DELETED, () => rememberVisibleAssistantState());
        for (const event of [event_types.MESSAGE_EDITED, event_types.MESSAGE_DELETED, event_types.MESSAGE_SWIPED]) {
            registerEventHandler(event, async () => {
                await updateTimelinePrompt();
                await updateRetrievedArchivePrompt();
            });
        }
        registerEventHandler(event_types.MESSAGE_SWIPED, observeRejectedSwipe);
        registerEventHandler(event_types.CONNECTION_PROFILE_CREATED, refreshProfilesDropdown);
        registerEventHandler(event_types.CONNECTION_PROFILE_UPDATED, refreshProfilesDropdown);
        registerEventHandler(event_types.CONNECTION_PROFILE_DELETED, refreshProfilesDropdown);
    } catch (error) {
        initialized = false;
        throw error;
    }
}

export function cleanupNemoLore() {
    const cfg = settings();
    while (registeredEventHandlers.length) {
        const [eventName, handler] = registeredEventHandlers.pop();
        eventSource.removeListener(eventName, handler);
    }
    cleanupNemoLoreGuideTools();
    uninstallNemoLoreDebug();
    if (window.NemoLorePreferenceBridge?.recordRewriteNote === recordRewriteNotePreference) {
        delete window.NemoLorePreferenceBridge;
    }
    removeProblemLineMenu();
    $('#nemo_lore_settings').remove();
    document.getElementById(STYLE_ELEMENT_ID)?.remove();
    clearPromptBlock(PROMPT_TAG, { position: 'in_prompt', depth: cfg.injectionDepth || DEFAULT_SETTINGS.injectionDepth });
    clearPromptBlock(RETRIEVAL_PROMPT_TAG, { position: 'in_prompt', depth: cfg.retrievalDepth || DEFAULT_SETTINGS.retrievalDepth });
    clearPromptBlock(PREFERENCES_PROMPT_TAG, { position: 'in_prompt', depth: cfg.preferenceDepth || DEFAULT_SETTINGS.preferenceDepth });
    clearGlobalPromptVariable(lastPreferenceVariableName || cfg.preferenceVariableName || PREFERENCES_VARIABLE_NAME);
    lastPreferenceVariableName = null;
    initialized = false;
}

