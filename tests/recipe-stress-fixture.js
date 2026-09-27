/** Synthetic production-shaped corpus for CI. No user prompt text is redistributed. */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { RESOLVER_ID, RESOLVER_SOURCE } from '../features/preset-runtime/recipe-codec.js';

export function stressFixture() {
    const genres = ['action_adventure', 'character_drama', 'comedy', 'crime', 'cyberpunk_noir',
        'erotica', 'fantasy', 'high_fantasy', 'historical_fiction', 'horror', 'mystery',
        'progression_fantasy', 'romance', 'science_fiction', 'slice_of_life', 'thriller', 'tragedy'];
    const code = n => String.fromCharCode(97 + Math.floor(n / 26), 97 + n % 26);
    const prompts = [];
    const add = (identifier, content, extra = {}) => prompts.push({
        identifier, name: identifier, content, role: 'system', system_prompt: false,
        marker: false, injection_position: 0, injection_depth: 4, injection_order: 100,
        injection_trigger: [], ...extra,
    });
    add('main', 'Synthetic Nemo runtime acceptance test.', { system_prompt: true });
    add('chatHistory', '', { marker: true, system_prompt: true });
    add('nc-selection-init', '{{setvar::NCGenreId::slice_of_life}}{{setvar::NCAuthorId::author_as}}{{setvar::NCStyleId::style_as}}{{trim}}');
    for (const genre of genres) add(`nc-genre-${genre}`, `{{setvar::NCGenreId::${genre}}}{{trim}}`);
    let index = genres.map((genre, n) => `{{setvar::NG_${genre}::${code(n)}}}`).join('');
    for (let n = 0; n < 27; n++) index += `{{setvar::NA_author_${code(n)}::${code(n)}}}`;
    for (let n = 0; n < 28; n++) index += `{{setvar::NS_style_${code(n)}::${code(n)}}}`;
    add('nemo-init-recipe-index', index + '{{trim}}');
    add('nemo-recipe-selection-sanitize', '{{trim}}');
    for (const [g, genre] of genres.entries()) {
        add(`nemo-init-heading-recipes-${genre}`, '{{// @category Variable-Init }}');
        let chunk = ''; let part = 1;
        const flush = () => {
            add(`nemo-init-recipes-${genre}-${String(part++).padStart(2, '0')}`,
                `{{#if {{.NCGenreId == ${genre}}}}}{{// literal recipe data }}${chunk}{{trim}}{{/if}}`);
            chunk = '';
        };
        for (let a = 0; a < 27; a++) for (let s = 0; s < 28; s++) {
            const key = `NP${code(g)}${code(a)}${code(s)}`;
            const value = `Recipe ${key}: ${genre}. ` + 'Keep the established facts and write the next meaningful beat. '.repeat(20);
            chunk += g === 14 && a === 18 && s === 18
                ? `{{#setvar::${key}}}${value}{{/setvar}}`
                : `{{setvar::${key}::${value}}}`;
            if (chunk.length > 240000) flush();
        }
        if (chunk) flush();
    }
    add(RESOLVER_ID, RESOLVER_SOURCE);
    add('ordinary', '{{// @tooltip Retained metadata }}Ordinary source remains unchanged.');
    return { preset_name: 'Nemo synthetic Full', prompts,
        prompt_order: [100000, 100001].map(character_id => ({ character_id, order: prompts.map(p => ({
            identifier: p.identifier, enabled: !p.identifier.startsWith('nc-genre-') || (character_id === 100001 && p.identifier === 'nc-genre-comedy'),
        })) })), extensions: { regex_scripts: [] } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (!process.argv[2]) throw new Error('Usage: node tests/recipe-stress-fixture.js output.json');
    writeFileSync(process.argv[2], JSON.stringify(stressFixture()));
}
