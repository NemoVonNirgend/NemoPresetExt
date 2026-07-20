export function normalizedExtensionName(value) {
    return String(value ?? '').replaceAll('\\', '/').replace(/^third-party\//, '').toLowerCase();
}

export function includesExtension(names, id) {
    const target = normalizedExtensionName(id);
    return names.some(name => normalizedExtensionName(name) === target);
}
