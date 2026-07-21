import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const modelCards = read('../features/connection/model-cards.js');
const contentSource = read('../content.js');
const promptArchive = read('../features/prompts/prompt-archive.js');
const promptLibrary = read('../features/marketplace/prompt-library.js');
const marketplace = read('../features/marketplace/marketplace.js');
const htmlTrimmer = read('../reasoning/html-trimmer.js');
const reasoningRuntime = read('../reasoning/nemonet-reasoning-config.js');
const settingsHtml = read('../settings.html');
const settingsUi = read('../ui/settings-ui.js');

test('enhanced model cards cover every staging-only provider', () => {
    assert.match(modelCards, /'workers_ai':\s*'#model_workers_ai_select'/);
    assert.match(modelCards, /'minimax':\s*'#model_minimax_select'/);
    assert.match(modelCards, /'workers_ai':\s*'Cloudflare Workers AI'/);
    assert.match(modelCards, /'minimax':\s*'MiniMax'/);
});

test('bundled rewrite is disconnected in favor of the standalone extension', () => {
    assert.doesNotMatch(contentSource, /features\/rewrite\/runtime\.js/);
    assert.doesNotMatch(contentSource, /initNemoRewrite|cleanupNemoRewrite/);
});

test('legacy prompt archive awaits every asynchronous preset save', () => {
    const saveCalls = promptArchive.match(/syspromptManager\.savePreset\(/g) || [];
    const awaitedSaveCalls = promptArchive.match(/await syspromptManager\.savePreset\(/g) || [];
    assert.ok(saveCalls.length > 0);
    assert.equal(awaitedSaveCalls.length, saveCalls.length);
    assert.match(promptArchive, /restoreSystemPrompts:\s*async function/);
    assert.match(promptArchive, /addSystemPromptToCurrentPreset:\s*async function/);
});

test('marketplace content is not fetched from a mutable main branch', () => {
    assert.match(promptLibrary, /const GITHUB_REF = '[0-9a-f]{40}'/);
    assert.doesNotMatch(promptLibrary, /const GITHUB_REF = 'main'/);
    assert.match(marketplace, /new URL\('\.\/recommendations\.json', import\.meta\.url\)/);
    assert.doesNotMatch(marketplace, /raw\.githubusercontent\.com\/NemoVonNirgend\/NemoPresetExt\/main/);
});

test('HTML trimming is asynchronous and stores reversible per-message backups', () => {
    assert.match(htmlTrimmer, /const NEMO_HTML_TRIMMER_BACKUP_KEY/);
    assert.match(htmlTrimmer, /export async function trimOldMessagesHTML/);
    assert.match(htmlTrimmer, /export async function restoreTrimmedMessagesHTML/);
    assert.match(htmlTrimmer, /message\.extra\[NEMO_HTML_TRIMMER_BACKUP_KEY\]/);
    assert.match(htmlTrimmer, /await context\.saveChat\(\)/);
});

test.skip('HTML trimming escapes archived text and exposes a restore action', () => {
    assert.match(htmlTrimmer, /escapeHtml\(uiASCII\)/);
    assert.match(settingsHtml, /id="nemoRestoreHTMLTrim"/);
    assert.match(settingsUi, /await trimOldMessagesHTML\(keepCount\)/);
    assert.match(settingsUi, /restoreTrimmedMessagesHTML/);
});

test('HTML trimming synchronizes canonical changes into active swipe storage', () => {
    assert.match(htmlTrimmer, /import \{ eventSource, event_types, syncMesToSwipe \}/);
    assert.match(htmlTrimmer, /message\.mes = trimmedContent;[\s\S]{0,200}syncMesToSwipe\(i\)/);
    assert.match(htmlTrimmer, /message\.mes = originalContent;[\s\S]{0,200}syncMesToSwipe\(messageId\)/);
});

test('reasoning capture treats fork-only delimiter discovery as optional', () => {
    assert.match(reasoningRuntime, /import \* as reasoningModule from '\.\.\/\.\.\/\.\.\/\.\.\/reasoning\.js'/);
    assert.match(reasoningRuntime, /typeof reasoningModule\.getReasoningCandidates === 'function'/);
    assert.match(reasoningRuntime, /reasoningModule\.parseReasoningFromString/);
    assert.doesNotMatch(reasoningRuntime, /import\s*\{[^}]*getReasoningCandidates[^}]*\}\s*from/);
});

test('settings UI loads its static document without Handlebars interpretation', () => {
    assert.match(settingsHtml, /\{\{\/\/\s*\.\.\.\s*\}\}/);
    assert.match(settingsUi, /fetch\(getExtensionPath\('settings\.html'\)/);
    assert.match(settingsUi, /if \(!response\.ok\)/);
    assert.match(settingsUi, /await response\.text\(\)/);
    assert.doesNotMatch(settingsUi, /renderExtensionTemplateAsync/);
});
