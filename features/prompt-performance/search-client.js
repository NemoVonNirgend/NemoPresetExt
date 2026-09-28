/** One lazily created worker, chunked uploads, latest-query-wins and idle eviction. */
export class PromptBodySearch {
    constructor({
        createWorker = () => new Worker(new URL('./search-worker.js', import.meta.url), { type: 'module' }),
        idleMs = 60000,
        timeoutMs = 15000,
        yieldTask = () => new Promise(resolve => setTimeout(resolve, 0)),
        readContent = async entry => {
            if (entry.nemoPromptBody && entry.content === entry.nemoPromptBody.shell) {
                if (!globalThis.NemoColdPrompts) throw new Error('Prompt storage is unavailable. Restore NemoPresetExt before searching stored text.');
                return globalThis.NemoColdPrompts.readBody(entry);
            }
            return typeof entry.content === 'string' ? entry.content : '';
        },
        revisionOf = entry => entry.nemoPromptBody && entry.content === entry.nemoPromptBody.shell ? entry.nemoPromptBody : entry.content,
    } = {}) {
        Object.assign(this, { createWorker, idleMs, timeoutMs, yieldTask, readContent, revisionOf });
        this.worker = null;
        this.pending = new Map();
        this.loaded = new Map();
        this.sequence = 0;
        this.requestId = 0;
        this.queue = Promise.resolve();
        this.idleTimer = null;
        this.stats = { workersCreated: 0, uploadedChars: 0, queries: 0 };
    }
    cancel() { this.sequence++; }
    dispose() {
        this.cancel();
        this.fail(new Error('Prompt-text search was closed.'));
    }
    fail(error) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
        this.worker?.terminate();
        this.worker = null;
        this.loaded.clear();
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timer);
            entry.reject(error);
        }
        this.pending.clear();
    }
    ensureWorker() {
        if (this.worker) return;
        const worker = this.createWorker();
        this.worker = worker;
        this.stats.workersCreated++;
        worker.onmessage = ({ data }) => {
            const entry = this.pending.get(data.request);
            if (!entry) return;
            this.pending.delete(data.request);
            clearTimeout(entry.timer);
            if (data.error) entry.reject(new Error(data.error));
            else entry.resolve(data.result);
        };
        worker.onerror = () => { if (this.worker === worker) this.fail(new Error('Search worker failed or was blocked by the browser.')); };
        worker.onmessageerror = () => { if (this.worker === worker) this.fail(new Error('Search worker could not decode a response.')); };
    }
    request(message) {
        this.ensureWorker();
        const request = ++this.requestId;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => this.fail(new Error('Search worker timed out.')), this.timeoutMs);
            this.pending.set(request, { resolve, reject, timer });
            try { this.worker.postMessage({ ...message, request }); }
            catch (error) {
                clearTimeout(timer);
                this.pending.delete(request);
                reject(error);
            }
        });
    }
    async sync(entries, sequence) {
        const ids = new Set(entries.map(entry => entry.identifier));
        for (const id of this.loaded.keys()) {
            if (sequence !== this.sequence) return false;
            if (!ids.has(id)) {
                await this.request({ type: 'remove', id });
                this.loaded.delete(id);
            }
        }
        for (const entry of entries) {
            if (sequence !== this.sequence) return false;
            const id = entry.identifier;
            const revision = this.revisionOf(entry);
            if (this.loaded.has(id) && this.loaded.get(id) === revision) continue;
            const content = await this.readContent(entry);
            if (sequence !== this.sequence) return false;
            if (revision !== this.revisionOf(entry)) throw new Error('Prompt changed while loading search text. Search again.');
            await this.request({ type: 'begin', id });
            for (let offset = 0; offset < content.length; offset += 65536) {
                if (sequence !== this.sequence) return false;
                const text = content.slice(offset, offset + 65536);
                await this.request({ type: 'chunk', id, text });
                this.stats.uploadedChars += text.length;
                // Bound main-thread cloning work and let typing/rendering proceed.
                await this.yieldTask();
            }
            if (sequence !== this.sequence) return false;
            await this.request({ type: 'commit', id });
            if (sequence !== this.sequence) return false;
            this.loaded.set(id, revision); // Cold entries retain a small reference, not their source body.
        }
        return sequence === this.sequence;
    }
    search(query, entries) {
        const sequence = ++this.sequence;
        clearTimeout(this.idleTimer);
        const work = this.queue.catch(() => {}).then(async () => {
            if (sequence !== this.sequence) return null;
            try {
                if (!await this.sync(entries, sequence)) return null;
                const matches = await this.request({ type: 'search', query });
                this.stats.queries++;
                return sequence === this.sequence ? new Set(matches) : null;
            } catch (error) {
                if (sequence !== this.sequence) return null;
                this.dispose();
                throw error;
            } finally {
                if (sequence === this.sequence) this.idleTimer = setTimeout(() => this.dispose(), this.idleMs);
            }
        });
        this.queue = work;
        return work;
    }
    diagnostics() { return { ...this.stats, workerActive: Boolean(this.worker), loadedEntries: this.loaded.size }; }
}
