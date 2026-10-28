import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const source = readFileSync(new URL('../features/prompts/prompt-manager.js', import.meta.url), 'utf8');
// Minimal DOM for the production section builder; native prompt data is never exposed.
class Element {
    constructor(tag) {
        this.tag = tag; this.children = []; this.dataset = {}; this.textContent = '';
        const classes = new Set();
        this.classList = { add: value => classes.add(value), toggle: (value, on) => on ? classes.add(value) : classes.delete(value) };
    }
    appendChild(child) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = this; this.children.push(child); return child;
    }
    querySelector(selector) {
        if (this.tag === 'li' && selector.includes('completion_prompt_manager_prompt_name')) {
            return selector.includes(' a.') ? this.link : this.nameSpan;
        }
        if (this.tag === 'name' && selector === 'a') return this.link;
        return this.children.find(child => selector === 'summary' ? child.tag === 'summary' : child.className === selector.slice(1)) ?? null;
    }
    insertAdjacentHTML() { /* Counts and progress indicators do not affect membership. */ }
}
const context = {
    DIVIDER_PREFIX_REGEX: /^(=+|⭐─+|━+|~+)/,
    escapeRegex: text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    SELECTORS: { promptNameLink: 'span.completion_prompt_manager_prompt_name a.prompt-manager-inspect-action' },
    openSectionStates: {}, document: { createElement: tag => new Element(tag) },
};
function method(name, next) {
    const start = source.indexOf(`${name}: `), end = source.indexOf(next, start);
    assert(start >= 0 && end > start);
    return new Script(`(${source.slice(start + name.length + 2, end).trim().replace(/,$/, '')})`).runInNewContext(context);
}
const manager = {
    getDividerInfo: method('getDividerInfo', '\n\n    // Favorites Logic'),
    processSingleItem: method('processSingleItem', '\n\n    handlePresetSearch:'),
    updateSectionCount() {},
};
function rowElement(row) {
    const item = new Element('li'); item.dataset.pmIdentifier = row.identifier;
    item.link = { textContent: row.name };
    item.nameSpan = new Element('name'); item.nameSpan.link = item.link;
    return item;
}
for (const preset of ['sola-v3-flame', 'sola-kindling-v1']) {
    const fixture = JSON.parse(readFileSync(new URL(`./fixtures/${preset}.json`, import.meta.url), 'utf8'));
    for (const profile of fixture.profiles) test(`${preset} ${profile.character_id}: DOM builder preserves section membership and complete row order`, () => {
        const container = new Element('root'), organization = {};
        const items = profile.rows.map(rowElement);
        for (const item of items) manager.processSingleItem(item, container, new Map(), organization);
        items.forEach((item, i) => {
            const row = profile.rows[i];
            if (fixture.headerIds.includes(row.identifier)) {
                assert.equal(item.parent.tag, 'summary');
                assert.equal(item.parent.parent.parent, container);
                assert.equal(manager.getDividerInfo(item, true).originalText, row.name);
            } else if (row.expectedParent) {
                const summary = item.parent.parent.querySelector('summary');
                assert.equal(summary.children[0].dataset.pmIdentifier, row.expectedParent, row.name);
            } else assert.equal(item.parent, container, row.name);
        });
        const flatten = node => node.tag === 'li' ? [node.dataset.pmIdentifier] : node.children.flatMap(flatten);
        assert.deepEqual(flatten(container), profile.rows.map(row => row.identifier));
    });
}
