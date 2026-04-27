import { cleanupGuides, initGuides } from './index.js';

let guidesInitialized = false;

export async function initNemoLoreGuideTools() {
    if (guidesInitialized) {
        return;
    }

    await initGuides();
    guidesInitialized = true;
}

export function cleanupNemoLoreGuideTools() {
    if (!guidesInitialized) {
        return;
    }

    cleanupGuides();
    guidesInitialized = false;
}
