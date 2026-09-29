import test from 'node:test';
import assert from 'node:assert/strict';
import { alternateUserFilePath, currentUserFilePath, matchedUserFilePath } from '../core/user-file-path.js';

const name = 'nemo-prompts-' + 'a'.repeat(64) + '.json';

test('current ST user-file path is canonical for new writes', () => {
    assert.equal(currentUserFilePath(name), '/user/files/' + name);
});
test('current and legacy user-file references normalize safely', () => {
    for (const value of ['/user/files/' + name, 'user/files/' + name, '/files/' + name, 'files/' + name]) {
        assert.ok(matchedUserFilePath(value, name));
    }
    assert.equal(matchedUserFilePath('user/files/' + name, name), '/user/files/' + name);
    assert.equal(matchedUserFilePath('files/' + name, name), '/files/' + name);
});
test('user-file path matcher rejects traversal, URLs, queries and wrong names', () => {
    for (const value of [
        '/user/files/../' + name,
        '/files/../' + name,
        'https://example.com/user/files/' + name,
        '/user/files/' + name + '?x=1',
        '/user/files/other.json',
        '//user/files/' + name,
    ]) assert.equal(matchedUserFilePath(value, name), null);
});
test('legacy/current fallback switches only between the two exact safe locations', () => {
    assert.equal(alternateUserFilePath('/user/files/' + name, name), '/files/' + name);
    assert.equal(alternateUserFilePath('/files/' + name, name), '/user/files/' + name);
    assert.equal(alternateUserFilePath('/api/settings/get', name), null);
});
test('generated user-file names must be flat', () => {
    for (const value of ['', '.', '..', 'x/y', 'x\\y', 'x\0y']) assert.throws(() => currentUserFilePath(value));
});
