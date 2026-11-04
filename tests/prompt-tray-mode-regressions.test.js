import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capturePromptLayout, promptLayoutSignature } from '../features/prompt-rendering/layout-preservation.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// Classic 3.4 never loads the category tray, but the saved dropdown style
// defaults to 'tray'. Reading the raw preference made the virtualizer unload
// every row of every open accordion section, so sections showed (0/7) and
// opened empty.
test('row rendering and virtualization follow the active layout, not the saved tray preference', () => {
    const runtime = read('../features/prompt-rendering/runtime.js');
    assert.doesNotMatch(runtime, /modeKey:\s*\(\)\s*=>\s*storage\.getDropdownStyle\(\)/);
    assert.equal(runtime.match(/modeKey:\s*\(\)\s*=>\s*getActiveDropdownStyle\(\)/g)?.length, 2);

    const manager = read('../features/prompts/prompt-manager.js');
    assert.doesNotMatch(manager, /storage\.getDropdownStyle\(\) === 'tray' \? 'tray' : 'accordion'/);

    const tray = read('../features/prompts/category-tray.js');
    assert.match(tray, /export function getActiveDropdownStyle\(\) \{\s*return categoryTrayInitialized && getDropdownStyle\(\) === 'tray' \? 'tray' : 'accordion';/);
});

test('loading or unloading the tray notifies the renderer and virtualizer of the layout change', () => {
    const tray = read('../features/prompts/category-tray.js');
    const body = name => {
        const start = tray.indexOf(`export function ${name}(`);
        assert(start >= 0, `missing ${name}`);
        return tray.slice(start, tray.indexOf('\n}\n', start));
    };
    assert.match(body('initCategoryTray'), /notifyActiveDropdownStyle\(\);\s*$/);
    assert.match(body('cleanupCategoryTray'), /categoryTrayInitialized = false;[\s\S]*notifyActiveDropdownStyle\(\);\s*$/);
});

// Toggling a prompt in a tray makes SillyTavern rebuild the whole prompt list.
// The open tray is detached and reattached, which resets its card grid's
// scrollTop to 0 ("jumps to the top of the menu").
test('native redraw records each open tray card-grid offset before the tray is detached', () => {
    const grid = { isConnected: true, scrollTop: 640 };
    const tray = { querySelector: selector => (selector === '.nemo-tray-grid' ? grid : null) };
    const header = { dataset: { pmIdentifier: 'heading' }, style: {}, parentElement: { tagName: 'SUMMARY' } };
    const section = { querySelector: () => header, _nemoCategoryTray: tray };
    const list = {
        ownerDocument: { getElementById: () => null },
        querySelectorAll(selector) {
            if (selector.startsWith('details')) return [section];
            if (selector === '.nemo-category-tray') return [tray];
            return [header];
        },
    };
    const signature = promptLayoutSignature({ owner: {}, context: 'c', topology: 't', frame: 'f' }, 'tray');
    assert(capturePromptLayout(list, signature));
    assert.equal(tray._nemoGridScrollTop, 640);

    // A tray that is already detached reads scrollTop 0 and must not overwrite.
    grid.isConnected = false; grid.scrollTop = 0;
    capturePromptLayout(list, signature);
    assert.equal(tray._nemoGridScrollTop, 640);
});

test('organization restores tray scroll after reattaching the same tray nodes', () => {
    const manager = read('../features/prompts/prompt-manager.js');
    const paint = manager.indexOf('promptsContainer.appendChild(fragment);');
    const restore = manager.indexOf('restoreTrayScrollPositions(promptsContainer);');
    assert(paint > 0 && restore > paint, 'restore must run after the organized fragment is attached');

    const tray = read('../features/prompts/category-tray.js');
    assert.match(tray, /trayGrid\?\.addEventListener\('scroll', \(\) => \{\s*if \(trayGrid\.isConnected\) tray\._nemoGridScrollTop = trayGrid\.scrollTop;/);
});
