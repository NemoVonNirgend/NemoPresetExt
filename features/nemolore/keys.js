import { getStringHash } from '../../../../../utils.js';
import { STORE_PREFIX } from './constants.js';

export function getStoreKey(chatId) {
    return `${STORE_PREFIX}:timeline:${chatId}`;
}

export function getInboxKey(chatId) {
    return `${STORE_PREFIX}:inbox:${chatId}`;
}

export function getArchiveKey(chatId) {
    return `${STORE_PREFIX}:archive:${chatId}`;
}

export function getPreferencesKey() {
    return `${STORE_PREFIX}:preferences:global`;
}

export function getPreferenceSignalsKey() {
    return `${STORE_PREFIX}:preference-signals:global`;
}

export function getPreferenceEvidenceLogKey() {
    return `${STORE_PREFIX}:preference-evidence:global`;
}

export function getPreferenceIgnoredSignalsKey() {
    return `${STORE_PREFIX}:preference-ignored-signals:global`;
}

export function getArchiveCollectionId(chatId) {
    return `${STORE_PREFIX}_archive_${getStringHash(chatId)}`;
}
