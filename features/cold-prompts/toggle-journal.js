/** Atomic, browser-local toggle overrides. Each transaction merges only the IDs it changed. */
export class ToggleJournal {
    constructor(getDatabase = () => globalThis.indexedDB) {
        this.getDatabase = getDatabase;
    }
    async open() {
        if (!this.connection) {
            this.connection = new Promise((resolve, reject) => {
                const request = this.getDatabase().open('NemoPresetExt-prompt-state', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('profiles');
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    db.onversionchange = () => { db.close(); this.connection = null; };
                    resolve(db);
                };
            }).catch(error => { this.connection = null; throw error; });
        }
        return this.connection;
    }
    async access(key, changes) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('profiles', changes ? 'readwrite' : 'readonly');
            const store = tx.objectStore('profiles');
            const get = store.get(key);
            let entries;
            get.onsuccess = () => {
                entries = new Map(get.result || []);
                if (changes) {
                    for (const [id, enabled] of changes) entries.set(id, enabled);
                    store.put([...entries], key);
                }
            };
            tx.oncomplete = () => resolve(entries);
            tx.onabort = () => reject(tx.error || new Error('Prompt state transaction was aborted.'));
            tx.onerror = () => reject(tx.error || get.error);
        });
    }
}
