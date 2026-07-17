import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sharedNames = readFileSync(new URL('../core/shared-names.js', import.meta.url), 'utf8');
const activityFeed = readFileSync(new URL('../features/nemolore/guides/activity-feed.js', import.meta.url), 'utf8');

test('shared names remains loadable when ProsePolisher is absent', () => {
    assert.doesNotMatch(sharedNames, /^import\s+\{\s*defaultNames\s*\}/m);
    assert.match(sharedNames, /await import\(['"]\.\.\/features\/prosepolisher\/src\/default_names\.js['"]\)/);
    assert.match(sharedNames, /catch[\s\S]*loadFallbackNames\(\)/);
    assert.match(sharedNames, /import \{ getContext \} from '\.\.\/\.\.\/\.\.\/\.\.\/extensions\.js'/);
    assert.doesNotMatch(sharedNames, /window\.getContext/);
});

test('activity feed escapes dynamic labels and summaries before HTML rendering', () => {
    assert.doesNotMatch(activityFeed, />\$\{item\.displayName\}</);
    assert.doesNotMatch(activityFeed, />\$\{item\.summary\s*\|\|/);
    assert.match(activityFeed, /escapeHtml\(item\.displayName\)/);
    assert.match(activityFeed, /escapeHtml\(item\.summary/);
});
