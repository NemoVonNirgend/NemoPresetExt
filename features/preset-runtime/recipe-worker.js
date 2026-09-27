import { getManifest, planOffload, finishOffload, restorePortable, SCHEMA } from './recipe-codec.js';
import { RecipeStore } from './recipe-store.js';

// Every job gets its own worker. Termination cancels computation without exposing a half-built preset.
self.onmessage = async ({ data }) => {
    try {
        const store = new RecipeStore({ headers: () => data.headers ?? {} });
        if (data.operation === 'import') {
            if (data.file.size > 64 * 1024 * 1024) throw new Error('Preset exceeds the 64 MiB import limit.');
            const text = await data.file.text();
            const preset = JSON.parse(text);
            const existing = getManifest(preset);
            if (existing) {
                if (existing.schema !== SCHEMA) throw new Error('Unsupported optimized Nemo runtime version.');
                // Portable export is also a recovery path for importing a shell on its original ST server.
                for (const [genre, ref] of Object.entries(existing.libraries)) await store.load(ref, genre, { cache: false });
                self.postMessage({ type: 'result', text, alreadyOptimized: true });
                return;
            }
            const plan = planOffload(preset);
            if (!plan) { self.postMessage({ type: 'passthrough' }); return; }
            const references = Object.create(null);
            let completed = 0;
            for (const [genre, library] of plan.libraries) {
                self.postMessage({ type: 'progress', message: `Saving recipe library ${++completed}/${plan.libraries.size}: ${genre}` });
                references[genre] = await store.persist(library);
            }
            const result = finishOffload(plan, references);
            const output = JSON.stringify(result);
            self.postMessage({ type: 'result', text: output, stats: {
                recipeCount: plan.recipeCount, libraries: plan.libraries.size,
                removedPrompts: plan.removed.size, sourceCharacters: plan.sourceCharacters,
                originalBytes: new TextEncoder().encode(text).length,
                runtimeBytes: new TextEncoder().encode(output).length,
            } });
        } else if (data.operation === 'export') {
            const preset = data.preset;
            const manifest = getManifest(preset);
            if (manifest?.schema !== SCHEMA) throw new Error('This is not an optimized Nemo preset.');
            const libraries = new Map();
            for (const [genre, ref] of Object.entries(manifest.libraries)) {
                libraries.set(genre, await store.load(ref, genre, { cache: false }));
            }
            const output = restorePortable(preset, libraries);
            self.postMessage({ type: 'result', text: JSON.stringify(output, null, 2) });
        } else throw new Error('Unknown recipe worker operation.');
    } catch (error) {
        self.postMessage({ type: 'error', message: error?.message ?? String(error) });
    }
};
