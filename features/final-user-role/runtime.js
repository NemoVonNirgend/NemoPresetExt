import { eventSource, event_types } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { NEMO_EXTENSION_NAME } from '../../core/utils.js';
import { createFinalUserRoleRuntime } from './controller.js';

let runtime = null;

export function initializeFinalUserRole() {
    if (runtime) return;
    runtime = createFinalUserRoleRuntime({
        events: eventSource,
        types: event_types,
        getSettings: () => extension_settings[NEMO_EXTENSION_NAME],
    });
}

export function cleanupFinalUserRole() {
    runtime?.dispose();
    runtime = null;
}
