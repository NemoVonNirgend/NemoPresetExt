/** Runtime catalog built on the verified, bounded Stage 4A storage transport. */
import { VexLibraryStore } from '../vex-library/store.js';
import { CONTROL_IDS, MAX_ENTRIES } from '../vex-library/format.js';
import { BANKS, HASHES, KEY, SCHEMA, loader, runtimeOf, requireThat, probeValue, parseBank } from './format.js';

export class VexStore {
    constructor(options = {}) {
        this.sources = new VexLibraryStore(options);
    }
    async extract(preset, plan) {
        const capture = { prompts: [...plan.banks, ...CONTROL_IDS.map(identifier => ({
            identifier, content: plan.contract.source[identifier],
        }))] };
        const source = await this.sources.capture(capture);
        const manifest = await this.sources.write({ schema: SCHEMA, source, probes: plan.probes, hashes: HASHES });
        return {
            ...preset,
            prompts: preset.prompts.map(p => BANKS.includes(p.identifier) ? { ...p, content: loader(p.identifier) } : p),
            extensions: { ...preset.extensions, [KEY]: { schema: SCHEMA, manifest, entries: plan.entries } },
        };
    }
    async manifest(preset) {
        const descriptor = runtimeOf(preset);
        requireThat(descriptor?.schema === SCHEMA && Number.isSafeInteger(descriptor.entries)
            && descriptor.entries > 0 && descriptor.entries <= MAX_ENTRIES, 'unsupported Vex runtime descriptor.');
        const m = await this.sources.read(descriptor.manifest);
        requireThat(m?.schema === SCHEMA && m.probes && typeof m.probes === 'object' && !Array.isArray(m.probes), 'invalid dependency catalog.');
        for (const [id, hash] of Object.entries(HASHES)) requireThat(m.hashes?.[id] === hash, 'unsupported Vex control contract.');
        const sourceIndex = await this.sources.manifest(m.source);
        requireThat(sourceIndex.entryCount === descriptor.entries && Object.keys(m.probes).length === descriptor.entries, 'catalog/source count mismatch.');
        for (const bank of sourceIndex.banks) for (const e of bank.entries) {
            requireThat(Object.hasOwn(m.probes, e.name) && typeof m.probes[e.name] === 'string'
                && m.probes[e.name].length < 1024, 'invalid dependency probe.');
        }
        return { ...m, sourceIndex };
    }
    async selected(manifest, reads) {
        const selected = await this.sources.selected(manifest.source, reads);
        const bodies = Object.fromEntries(BANKS.map(id => [id, '{{trim}}']));
        let characters = 0;
        for (const item of selected) {
            const text = item.statements.map(e => e.statement).join('');
            for (const e of parseBank({ identifier: item.identifier, content: text })) {
                requireThat(probeValue(e.name, e.value) === manifest.probes[e.name], 'selected source/probe mismatch.');
            }
            bodies[item.identifier] = text + '{{trim}}';
            characters += text.length;
        }
        return { bodies, characters };
    }
    async restore(preset, { partial = false } = {}) {
        const m = await this.manifest(preset);
        let result;
        if (!partial) {
            result = await this.sources.restore(preset, m.source, {
                expectedContents: new Map(BANKS.map(id => [id, loader(id)])),
            });
        } else {
            const originals = new Map();
            for (const ref of m.sourceIndex.banks) if (preset.prompts.some(p => p.identifier === ref.identifier)) {
                originals.set(ref.identifier, (await this.sources.bank(ref)).prompt.content);
            }
            const seen = new Set();
            result = { ...preset, prompts: preset.prompts.map(p => {
                if (!originals.has(p.identifier)) return p;
                requireThat(!seen.has(p.identifier) && (p.content === loader(p.identifier)
                    || p.content === originals.get(p.identifier)), 'unexpected library edit or duplicate export slot.');
                seen.add(p.identifier);
                return { ...p, content: originals.get(p.identifier) };
            }) };
        }
        const extensions = { ...result.extensions }; delete extensions[KEY];
        return { ...result, extensions };
    }
}
