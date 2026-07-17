import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../features/prompts/prompt-manager.js', import.meta.url), 'utf8');

test('prompt manager does not advertise the unimplemented library insertion path', () => {
    assert.doesNotMatch(source, /data-action="load-prompt"|Load Prompt\.\.\./);
    assert.doesNotMatch(source, /showLoadPromptDialog|insertPromptBelow/);
    assert.doesNotMatch(source, /Prompt insertion feature coming soon|TODO: Implement actual prompt insertion/);
});
