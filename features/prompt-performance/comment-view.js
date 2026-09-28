/** Conservative generation-only elision. Never mutate a stored prompt. */
export function safeCommentView(content, limit = 16384) {
    if (typeof content !== 'string' || content.length > limit || !content.includes('{{//')) return content;
    const pieces = [];
    let cursor = 0;
    let changed = false;
    while (cursor < content.length) {
        const start = content.indexOf('{{', cursor);
        if (start < 0) {
            const tail = content.slice(cursor);
            if (/[{}]/.test(tail)) return content;
            pieces.push(tail);
            break;
        }
        if (start > 0 && content[start - 1] === '\\') return content;
        const plain = content.slice(cursor, start);
        // Elision must not concatenate literal braces into a new macro.
        if (/[{}]/.test(plain)) return content;
        pieces.push(plain);
        const end = content.indexOf('}}', start + 2);
        if (end < 0) return content;
        const macro = content.slice(start, end + 2);
        if (macro.startsWith('{{//') && !macro.slice(4, -2).includes('{{')) {
            changed = true;
        } else if (macro === '{{trim}}') {
            pieces.push(macro);
        } else {
            // pick depends on original source/offsets; variables, custom macros,
            // nested comments and control flow require ST's own evaluator.
            return content;
        }
        cursor = end + 2;
    }
    return changed ? pieces.join('') : content;
}

export function installCommentView(manager) {
    if (typeof manager?.preparePrompt !== 'function') return () => {};
    const previous = manager.preparePrompt;
    let cache = new WeakMap();
    let active = true;
    function wrapped(prompt, ...args) {
        if (!active || !prompt || typeof prompt !== 'object') return previous.call(this, prompt, ...args);
        let entry = cache.get(prompt);
        if (!entry || entry.source !== prompt.content) {
            entry = { source: prompt.content, view: safeCommentView(prompt.content) };
            cache.set(prompt, entry);
        }
        const input = entry.view === prompt.content ? prompt : { ...prompt, content: entry.view };
        return previous.call(this, input, ...args);
    }
    manager.preparePrompt = wrapped;
    return () => { active = false; cache = new WeakMap(); if (manager.preparePrompt === wrapped) manager.preparePrompt = previous; };
}
