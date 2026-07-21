import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../content.js', import.meta.url), 'utf8');
const installer = readFileSync(new URL('../features/preset-installer/runtime.js', import.meta.url), 'utf8');
const settingsUi = readFileSync(new URL('../ui/settings-ui.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const utils = readFileSync(new URL('../core/utils.js', import.meta.url), 'utf8');

test('core source has no hidden optional runtime dependencies', () => {
    assert.doesNotMatch(content, /storage-migration/);
    assert.doesNotMatch(installer, /features\/onboarding|\.\.\/onboarding|\.\.\/nemolore/);
    assert.match(installer, /#nemo-preset-ext-settings/);
    assert.doesNotMatch(settingsUi, /Pollinations|Reasoning|ModelSelector|AnimatedBackground|HTMLTrimming/);
    assert.doesNotMatch(utils, /POLLINATIONS|NEMO_SNAPSHOT|PREDEFINED_COLORS|LocalStorageAsync/);
});

test('core stylesheet contains only owned surfaces', () => {
    assert.doesNotMatch(styles, /@import/);
    assert.doesNotMatch(styles, /nemo-autocomplete-dropdown/);
    for (const owned of ['nemo-preset-ext-settings', 'nemo-hub-card', 'nemo-directive-toast', 'nemo-directive-modal']) {
        assert.match(styles, new RegExp(owned));
    }
});

test('migrated optional source directories are absent', () => {
    for (const relative of ['../archive', '../reasoning', '../themes', '../features/backgrounds', '../features/prompts', '../features/emoji-picker', '../features/connection', '../features/world-info']) {
        assert.equal(existsSync(new URL(relative, import.meta.url)), false, `${relative} still exists`);
    }
});
