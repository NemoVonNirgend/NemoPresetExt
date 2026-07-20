import { extensionNames, installExtension } from '../../../../../extensions.js';
import { includesExtension } from './installed-state.js';

export function isHubExtensionInstalled(id, names = extensionNames) {
    return includesExtension(names, id);
}

export async function installHubExtension(entry, { global = false } = {}) {
    if (!entry?.id || !entry?.repository) throw new TypeError('A catalog extension with an id and repository is required.');
    if (isHubExtensionInstalled(entry.id)) return { installed: true, alreadyInstalled: true, id: entry.id };
    await installExtension(entry.repository, Boolean(global));
    return { installed: isHubExtensionInstalled(entry.id), alreadyInstalled: false, id: entry.id };
}
