import { extensionNames, installExtension } from '../../../../../extensions.js';
import { includesExtension } from './installed-state.js';

export function isHubExtensionInstalled(id, names = extensionNames) {
    return includesExtension(names, id);
}

export async function installHubExtension(entry, { global = false, timeoutMs = 90_000 } = {}) {
    if (!entry?.id || !entry?.repository) throw new TypeError('A catalog extension with an id and repository is required.');
    if (isHubExtensionInstalled(entry.id)) return { installed: true, alreadyInstalled: true, id: entry.id };
    const timeout = Number(timeoutMs);
    if (!Number.isFinite(timeout) || timeout < 1_000) throw new RangeError('Hub install timeout must be at least one second.');
    const result = await Promise.race([
        installExtension(entry.repository, Boolean(global), entry.branch ?? ''),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`SillyTavern did not finish installing ${entry.name ?? entry.id} within ${timeout}ms.`)), timeout)),
    ]);
    if (result === false) throw new Error(`SillyTavern declined installation of ${entry.name ?? entry.id}.`);
    return { installed: isHubExtensionInstalled(entry.id), alreadyInstalled: false, id: entry.id };
}
