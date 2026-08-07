import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const installer = readFileSync(new URL('../features/preset-installer/runtime.js', import.meta.url), 'utf8');
const settingsUi = readFileSync(new URL('../ui/settings-ui.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const utils = readFileSync(new URL('../core/utils.js', import.meta.url), 'utf8');

test('core source owns prompt dependencies without reabsorbing unrelated optional runtimes', () => {
    assert.match(content, /features\/prompt-tools\/runtime/);
    assert.match(utils, /NEMO_SNAPSHOT_KEY/);
    assert.match(installer, /#nemo-engine-installer-mount/);
    assert.doesNotMatch(settingsUi, /Pollinations|ModelSelector|AnimatedBackground|HTMLTrimming/);
    assert.doesNotMatch(utils, /POLLINATIONS_IMAGE_STYLE_PRESETS/);
});

test('root stylesheet loads isolated prompt layers', () => {
    for (const layer of [
        'prompt-structure.css',
        'prompt-tray.css',
        'prompt-dialogs.css',
        'prompt-navigator.css',
        'prompt-archive.css',
        'prompt-toasts.css',
        'prompt-classic.css',
        'prompt-modern.css',
        'prompt-classic-plus.css',
        'prompt-responsive.css',
    ]) {
        assert.match(styles, new RegExp(layer.replace('.', '\\.')));
        assert.equal(existsSync(new URL(`../styles/${layer}`, import.meta.url)), true);
    }
});

test('prompt source directories are present while broader UI sources remain absent', () => {
    for (const relative of ['../archive', '../reasoning', '../features/prompts', '../features/character-manager']) {
        assert.equal(existsSync(new URL(relative, import.meta.url)), true, `${relative} is missing`);
    }
    for (const relative of ['../themes', '../features/backgrounds', '../features/emoji-picker', '../features/connection', '../features/world-info']) {
        assert.equal(existsSync(new URL(relative, import.meta.url)), false, `${relative} should remain standalone`);
    }
});
