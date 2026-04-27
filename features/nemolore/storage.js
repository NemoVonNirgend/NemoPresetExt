import { getCurrentChatId } from '../../../../../../script.js';
import {
    getArchiveKey,
    getInboxKey,
    getPreferencesKey,
    getPreferenceEvidenceLogKey,
    getPreferenceIgnoredSignalsKey,
    getPreferenceSignalsKey,
    getStoreKey,
} from './keys.js';

let storageAdapter = null;

export function setNemoLoreStorage(adapter) {
    storageAdapter = adapter;
}

export async function getTimeline(chatId = getCurrentChatId()) {
    if (!chatId || !storageAdapter) {
        return [];
    }

    return await storageAdapter.getItem(getStoreKey(chatId)) || [];
}

export async function setTimeline(chatId, timeline) {
    if (!chatId || !storageAdapter) {
        return;
    }

    await storageAdapter.setItem(getStoreKey(chatId), timeline);
}

export async function getInbox(chatId = getCurrentChatId()) {
    if (!chatId || !storageAdapter) {
        return [];
    }

    return await storageAdapter.getItem(getInboxKey(chatId)) || [];
}

export async function setInbox(chatId, inbox) {
    if (!chatId || !storageAdapter) {
        return;
    }

    await storageAdapter.setItem(getInboxKey(chatId), inbox);
}

export async function getArchive(chatId = getCurrentChatId()) {
    if (!chatId || !storageAdapter) {
        return [];
    }

    return await storageAdapter.getItem(getArchiveKey(chatId)) || [];
}

export async function setArchive(chatId, archive) {
    if (!chatId || !storageAdapter) {
        return;
    }

    await storageAdapter.setItem(getArchiveKey(chatId), archive);
}

export async function getPreferences() {
    if (!storageAdapter) {
        return [];
    }

    return await storageAdapter.getItem(getPreferencesKey()) || [];
}

export async function setPreferences(preferences) {
    if (!storageAdapter) {
        return;
    }

    await storageAdapter.setItem(getPreferencesKey(), preferences);
}

export async function getPreferenceSignals() {
    if (!storageAdapter) {
        return {};
    }

    return await storageAdapter.getItem(getPreferenceSignalsKey()) || {};
}

export async function setPreferenceSignals(signals) {
    if (!storageAdapter) {
        return;
    }

    await storageAdapter.setItem(getPreferenceSignalsKey(), signals);
}

export async function getPreferenceEvidenceLog() {
    if (!storageAdapter) {
        return [];
    }

    return await storageAdapter.getItem(getPreferenceEvidenceLogKey()) || [];
}

export async function setPreferenceEvidenceLog(log) {
    if (!storageAdapter) {
        return;
    }

    await storageAdapter.setItem(getPreferenceEvidenceLogKey(), log);
}

export async function getPreferenceIgnoredSignals() {
    if (!storageAdapter) {
        return {};
    }

    return await storageAdapter.getItem(getPreferenceIgnoredSignalsKey()) || {};
}

export async function setPreferenceIgnoredSignals(ignored) {
    if (!storageAdapter) {
        return;
    }

    await storageAdapter.setItem(getPreferenceIgnoredSignalsKey(), ignored);
}
