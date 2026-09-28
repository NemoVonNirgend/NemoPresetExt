/** Worker-side index. Full text is never lowercased by the UI thread. */
export class BodySearchIndex {
    constructor(maxChars = 32 * 1024 * 1024) {
        this.maxChars = maxChars;
        this.clear();
    }
    clear() { this.documents = new Map(); this.totalChars = 0; this.pending = null; }
    handle(message) {
        const { type, id } = message;
        switch (type) {
            case 'clear': this.clear(); return true;
            case 'remove': {
                this.totalChars -= this.documents.get(id)?.length || 0;
                this.documents.delete(id);
                return true;
            }
            case 'begin':
                this.pending = { id, parts: [], length: 0 };
                return true;
            case 'chunk': {
                if (!this.pending || this.pending.id !== id) throw new Error('Search upload was superseded.');
                const text = String(message.text ?? '');
                const projected = this.totalChars - (this.documents.get(id)?.length || 0) + this.pending.length + text.length;
                if (projected > this.maxChars) {
                    this.pending = null;
                    throw new Error('Prompt-text search exceeds the 32 Mi-character worker limit. Metadata search is still available.');
                }
                this.pending.parts.push(text);
                this.pending.length += text.length;
                return true;
            }
            case 'commit': {
                if (!this.pending || this.pending.id !== id) throw new Error('Search upload was superseded.');
                const folded = this.pending.parts.join('').toLowerCase();
                this.pending = null;
                const total = this.totalChars - (this.documents.get(id)?.length || 0) + folded.length;
                if (total > this.maxChars) throw new Error('Folded prompt text exceeds the worker memory limit.');
                this.documents.set(id, folded);
                this.totalChars = total;
                return true;
            }
            case 'search': {
                this.pending = null; // Discard an upload abandoned by an obsolete query.
                const query = String(message.query ?? '').toLowerCase();
                return [...this.documents].filter(([, text]) => text.includes(query)).map(([key]) => key);
            }
            case 'stats': return { entries: this.documents.size, chars: this.totalChars };
            default: throw new Error('Unknown search worker operation.');
        }
    }
}

export function metadataMatches(rows, query) {
    const needle = String(query).trim().toLowerCase();
    return new Set(rows.filter(row => [
        row.name, row.identifier, row.tooltip, row.group, row.badge,
        ...(row.categories || []), ...(row.tags || []),
    ].filter(Boolean).join('\n').toLowerCase().includes(needle)).map(row => row.identifier));
}
