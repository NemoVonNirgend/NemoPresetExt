const CURRENT_PREFIX = '/user/files/';
const LEGACY_PREFIX = '/files/';

function validName(name) {
    return typeof name === 'string' && name.length > 0
        && !name.includes('/') && !name.includes('\\') && !name.includes('\0')
        && name !== '.' && name !== '..';
}

function slash(path) {
    if (typeof path !== 'string' || !path) return null;
    return path.startsWith('/') ? path : '/' + path;
}

export function currentUserFilePath(name) {
    if (!validName(name)) throw new Error('Invalid Nemo user-file name.');
    return CURRENT_PREFIX + name;
}

export function matchedUserFilePath(path, name) {
    if (!validName(name)) return null;
    const normalized = slash(path);
    if (normalized === CURRENT_PREFIX + name || normalized === LEGACY_PREFIX + name) return normalized;
    return null;
}

export function alternateUserFilePath(path, name) {
    const matched = matchedUserFilePath(path, name);
    if (!matched) return null;
    return matched.startsWith(CURRENT_PREFIX) ? LEGACY_PREFIX + name : CURRENT_PREFIX + name;
}
