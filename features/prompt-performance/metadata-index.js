/** Metadata-only views. Source objects remain owned by ST; no full-body string keys. */
export function directiveProjection(content) {
    if (typeof content !== 'string' || !content) return '';
    // Preserve legacy metadata anywhere in a prompt. A prefix limit would silently
    // lose dependencies and triggers declared after ordinary text or control macros.
    const blocks = [];
    const comments = /\{\{\/\/([\s\S]*?)\}\}/g;
    let match;
    while ((match = comments.exec(content))) {
        if (match[1].split(/\r?\n/).some(line => line.trim().startsWith('@'))) {
            blocks.push(match[0]);
        }
    }
    // Nonempty source must remain nonempty for reverse-conflict validation.
    return blocks.join('\n') || ' ';
}

export class PromptMetadataIndex {
    constructor(parse, { maxLooseChars = 262144, maxLooseEntryChars = 8192 } = {}) {
        this.parse = parse;
        this.maxLooseChars = maxLooseChars;
        this.maxLooseEntryChars = maxLooseEntryChars;
        this.clear();
    }
    clear() {
        this.records = new WeakMap();
        this.byId = new Map();
        this.byLength = new Map();
        this.loose = new Map();
        this.looseChars = 0;
        this.stats = { scans: 0, scannedChars: 0, hits: 0 };
    }
    bind(prompts = []) {
        // Refresh cheap references, not prompt text. Releases removed presets.
        this.byId.clear();
        this.byLength.clear();
        for (const prompt of prompts) {
            if (!prompt || typeof prompt !== 'object') continue;
            this.byId.set(prompt.identifier, prompt);
            const length = typeof prompt.content === 'string' ? prompt.content.length : 0;
            if (!this.byLength.has(length)) this.byLength.set(length, []);
            this.byLength.get(length).push(prompt);
        }
    }
    build(content) {
        const projection = directiveProjection(content);
        this.stats.scans++;
        this.stats.scannedChars += content.length;
        return { projection, directives: this.parse(projection) };
    }
    get(source) {
        if (source && typeof source === 'object') {
            const content = typeof source.content === 'string' ? source.content : '';
            const cached = this.records.get(source);
            if (cached && cached.content === content) {
                this.stats.hits++;
                return cached.result;
            }
            const result = this.build(content);
            this.records.set(source, { content, result });
            return result;
        }
        const content = typeof source === 'string' ? source : '';
        // Compatibility with existing parsePromptDirectives(prompt.content) calls.
        // Length buckets avoid hashing megabytes just to find the owning prompt.
        for (const prompt of this.byLength.get(content.length) || []) {
            if (prompt.content === content) return this.get(prompt);
        }
        // An edit may change length before the host's settings event arrives.
        for (const prompt of this.byId.values()) {
            if (prompt.content === content) {
                this.bind([...this.byId.values()]);
                return this.get(prompt);
            }
        }
        const cached = content.length <= this.maxLooseEntryChars ? this.loose.get(content) : null;
        if (cached) {
            this.loose.delete(content);
            this.loose.set(content, cached);
            this.stats.hits++;
            return cached;
        }
        const result = this.build(content);
        // Unowned editor strings have a byte-budgeted compatibility cache. Large
        // unknown texts are never retained as keys; registered prompts use WeakMap.
        if (content.length <= this.maxLooseEntryChars && content.length <= this.maxLooseChars) {
            while (this.loose.size && (this.looseChars + content.length > this.maxLooseChars || this.loose.size >= 256)) {
                const key = this.loose.keys().next().value;
                this.looseChars -= key.length;
                this.loose.delete(key);
            }
            this.loose.set(content, result);
            this.looseChars += content.length;
        }
        return result;
    }
    view(prompt, enabled = false) {
        const directives = this.get(prompt).directives;
        return {
            ...directives,
            identifier: prompt.identifier,
            name: prompt.name,
            role: prompt.role,
            isEnabled: Boolean(enabled),
        };
    }
    diagnostics() {
        return { ...this.stats, indexedPrompts: this.byId.size, looseEntries: this.loose.size, looseChars: this.looseChars };
    }
}

/** Preserve the original directive language/validation; only change data access. */
export function createDirectiveFacade(rules, getPrompts = () => []) {
    const index = new PromptMetadataIndex(text => rules.parsePromptDirectives(text));
    let boundArray;
    let boundLength = -1;
    function sync(force = false) {
        const prompts = getPrompts() || [];
        if (force || prompts !== boundArray || prompts.length !== boundLength) {
            index.bind(prompts);
            boundArray = prompts;
            boundLength = prompts.length;
        }
        return index;
    }
    function projection(prompt) {
        const metadata = sync();
        const canonical = metadata.byId.get(prompt.identifier);
        const source = canonical?.content === prompt.content ? canonical : prompt;
        return { ...prompt, content: metadata.get(source).projection };
    }
    return {
        index,
        sync,
        parsePromptDirectives(source) { return sync().get(source).directives; },
        clearDirectiveCache() {
            index.clear();
            boundArray = undefined;
            boundLength = -1;
            rules.clearDirectiveCache();
        },
        validatePromptActivation(id, prompts) {
            const projected = prompts.map(projection);
            const originals = new Map(projected.map((p, i) => [p, prompts[i]]));
            return rules.validatePromptActivation(id, projected).map(issue => {
                const result = { ...issue };
                for (const key of ['currentPrompt', 'conflictingPrompt', 'requiredPrompt']) {
                    if (originals.has(result[key])) result[key] = originals.get(result[key]);
                }
                if (Array.isArray(result.conflictingPrompts)) {
                    result.conflictingPrompts = result.conflictingPrompts.map(p => originals.get(p) || p);
                }
                return result;
            });
        },
        evaluateMessageTriggers(count, prompts) {
            return rules.evaluateMessageTriggers(count, prompts.map(projection));
        },
    };
}
