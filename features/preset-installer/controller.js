import { getNemoEnginePreset } from './presets.js';

/** One native import transaction. Host state changes only after processing and saving. */
export function createPresetInstaller({ loadPreset, processPreset, savePreset, registerPreset, selectPreset, getPresetNames, recordInstall }) {
    let active = null;

    function install({ presetId, presetName, selectAfterInstall = true, onProgress = () => {} } = {}) {
        const entry = getNemoEnginePreset(presetId);
        if (active) {
            if (active.entry === entry) return active.promise;
            return Promise.reject(new Error('Another Nemo Engine edition is being installed. Wait for it to finish.'));
        }

        const work = (async () => {
            onProgress(`Loading ${entry.name}…`);
            const { preset, stats } = await loadPreset(entry);
            // Always import a new copy; a previous import may contain user edits.
            const baseName = String(presetName || entry.name).trim();
            const existing = new Set(getPresetNames());
            let name = baseName;
            for (let copy = 2; existing.has(name); copy++) name = `${baseName} (${copy})`;

            onProgress('Processing prompts, regex scripts, and supported libraries…');
            await processPreset(preset, name);
            // ST catches event-listener exceptions. Runtime serialization barriers
            // must run BEFORE fetch, even if a handler's error was swallowed.
            const body = JSON.stringify({ apiId: 'openai', name, preset });
            onProgress('Saving Chat Completion preset…');
            const savedName = await savePreset(body);
            registerPreset(savedName, preset);
            if (selectAfterInstall) {
                onProgress('Selecting preset and preparing enabled prompts…');
                await selectPreset(savedName);
            }
            const result = { id: entry.id, name: savedName, version: entry.version, sha256: entry.sha256, stats, selected: selectAfterInstall };
            recordInstall(result);
            return result;
        })();
        const promise = work.finally(() => { active = null; });
        active = { entry, promise };
        return promise;
    }

    return Object.freeze({ install });
}
