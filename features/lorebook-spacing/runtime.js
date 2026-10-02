import { eventSource, event_types, substituteParams } from '../../../../../../script.js';
import { parseRegexFromString, world_info_case_sensitive } from '../../../../../world-info.js';
import { prepareLorebookScan } from './matching.js';

let handler = null;

export function initializeLorebookSpacing() {
    if (handler || !event_types.WORLDINFO_ENTRIES_LOADED) return;
    handler = payload => prepareLorebookScan(payload, {
        parseRegex: parseRegexFromString,
        substitute: substituteParams,
        caseSensitive: world_info_case_sensitive,
    });
    eventSource.on(event_types.WORLDINFO_ENTRIES_LOADED, handler);
}

export function cleanupLorebookSpacing() {
    if (!handler) return;
    eventSource.removeListener(event_types.WORLDINFO_ENTRIES_LOADED, handler);
    handler = null;
}
