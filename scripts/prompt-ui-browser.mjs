/** Chromium layout regressions: a pinned native host, actual extension CSS and extracted tray UI. */
const { nativeCSS, nemoCSS, rowHTML, trayBody, compactBody, controlBody } = globalThis.promptUiFixtures;
const results = [], measurements = [];
const assert = (value, message) => { if (!value) throw new Error(message || 'Assertion failed'); };
const styleOf = element => getComputedStyle(element);
const rect = element => element.getBoundingClientRect();
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function test(name, fn) {
    try { await fn(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: error.stack }); }
}
function addStyle(source) { const style = document.createElement('style'); style.textContent = source; document.head.append(style); return style; }
addStyle(nativeCSS);
addStyle(nemoCSS);
// Theme/host settings only. Do not override any prompt/tray layout properties here.
addStyle(`
    :root {
        --mainFontSize: 16px; --mainFontFamily: Arial, sans-serif;
        --SmartThemeBodyColor: #ededf5; --SmartThemeEmColor: #adb5c4;
        --SmartThemeQuoteColor: #60b1ff; --SmartThemeBlurTintColor: #20222c;
        --SmartThemeBotMesBlurTintColor: #2a2e3a; --SmartThemeUserMesBlurTintColor: #303544;
        --SmartThemeBorderColor: #555d70; --white50a: #aaaaaa; --white30a: #888888;
        --white20a: #555555; --animation-duration: 0s; --shadowWidth: 0;
    }
    #fixture-panel { margin: 24px; border: 1px solid #555d70; padding: 0; }
    /* Visible icon stand-ins: no font download. Native control dimensions still come from native CSS. */
    .fa-solid::before { content: '◆'; font-style: normal; }
    .fa-fw { display: inline-block; width: 1.25em; text-align: center; }
`);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const renderTray = new Function('section', 'sectionId', 'prompts', 'isCompact', 'getPresetsForSection', 'escapeHtml', trayBody + '\nreturn tray;');
const bindControls = new Function('tray', 'sectionId', 'setCompactViewState', 'updateCompactTrayUi', 'setAllKnownSectionsCompact', controlBody);
const createCompactRuntime = new Function('state', `
    const compactViewState = new Map();
    const COMPACT_VIEW_SETTING_KEY = 'compactTraySections';
    const sectionPromptIdsCache = new Map(state.knownIds.map(id => [id, []]));
    const ensureExtensionSettingsNamespace = () => state.settings;
    const saveSettingsDebounced = () => state.saves++;
    const getSectionId = section => section.dataset.fixtureSection;
    const logger = { info() {} };
    ${compactBody}
    return { setCompactViewState, updateCompactTrayUi, setAllKnownSectionsCompact, getCompactViewState };
`);
const modes = {
    modern: { skin: 'modern', features: 'full' },
    classicPlus: { skin: 'classic', features: 'full' },
    classic: { skin: 'classic', features: 'legacy' },
};
function mode(name) {
    if (!name) { for (const key of ['nemoPromptUi', 'nemoPromptSkin', 'nemoPromptFeatures']) delete document.body.dataset[key]; return; }
    Object.assign(document.body.dataset, { nemoPromptUi: name, nemoPromptSkin: modes[name].skin, nemoPromptFeatures: modes[name].features });
}
function fixture(modeName = 'modern', width = 320, fontSize = 16) {
    document.body.replaceChildren(); mode(modeName);
    document.documentElement.style.fontSize = `${fontSize}px`;
    document.documentElement.style.setProperty('--mainFontSize', `${fontSize}px`);
    const panel = document.createElement('div'); panel.id = 'fixture-panel'; panel.style.width = `${width}px`;
    // Native PromptManager is a flex item in .range-block, including after CCT moves it.
    // This catches inline-size containers collapsing when their own width is unspecified.
    const outerRange = document.createElement('div'); outerRange.className = 'range-block';
    const pm = document.createElement('div'); pm.id = 'completion_prompt_manager';
    const innerRange = document.createElement('div'); innerRange.className = 'range-block';
    const list = document.createElement('ul'); list.id = 'completion_prompt_manager_list';
    innerRange.append(list); pm.append(innerRange); outerRange.append(pm); panel.append(outerRange); document.body.append(panel);
    return { panel, pm, list };
}
function nativeRow(name = 'Character memory', extraClass = '') {
    const template = document.createElement('template'); template.innerHTML = rowHTML;
    const row = template.content.querySelector('li');
    row.classList.add(...extraClass.split(' ').filter(Boolean));
    row.querySelector('.completion_prompt_manager_prompt_name').dataset.pmName = name;
    row.querySelector('a').textContent = name; row.querySelector('a').title = name;
    return row;
}
function addSection(host, sectionId = 'Narrative Rhythm and Character Memory') {
    const section = document.createElement('details'); section.className = 'nemo-engine-section'; section.open = true;
    section.dataset.fixtureSection = sectionId;
    const summary = document.createElement('summary'), header = nativeRow(sectionId, 'nemo-header-item');
    header.querySelector('.drag-handle').classList.remove('ui-sortable-handle');
    const counter = document.createElement('span'); counter.className = 'nemo-enabled-count'; counter.textContent = '(8/20)';
    const progress = document.createElement('span'); progress.className = 'nemo-section-progress';
    header.querySelector('.completion_prompt_manager_prompt_name').append(counter, progress);
    summary.append(header);
    const content = document.createElement('div'); content.className = 'nemo-section-content';
    section.append(summary, content); host.list.append(section);
    return { section, header, summary, content };
}
const longName = 'Persistent Mental Modelling and Character Memory Associations — ' + 'ContinuousCharacterMemoryWithoutSpaces'.repeat(3);
const tooltip = 'Remember active motivations and preserve character continuity. ' + 'UnbrokenDirectiveTooltip'.repeat(8);
const prompts = [0, 1].map(index => ({
    identifier: `ui-card-${index}`, name: index ? 'Scene progression' : longName, tooltip,
    isEnabled: !index, requires: [], exclusiveWith: [], conflictsWith: [], highlight: false,
}));
function addTray(host, { saved = false, sectionId = 'Narrative Rhythm and Character Memory', state, promptRecords = prompts } = {}) {
    const sectionFixture = addSection(host, sectionId);
    const presets = saved ? [{ key: 'saved-one', name: longName, enabledPrompts: ['ui-card-0'] }] : [];
    const tray = renderTray(sectionFixture.section, sectionId, promptRecords, false, () => presets, escapeHtml);
    sectionFixture.section.append(tray);
    const compactState = state || { settings: {}, saves: 0, knownIds: [sectionId] };
    const compact = createCompactRuntime(compactState);
    bindControls(tray, sectionId, compact.setCompactViewState, compact.updateCompactTrayUi, compact.setAllKnownSectionsCompact);
    return { ...sectionFixture, tray, compact, compactState };
}
function noOverflow(element, label) {
    assert(element.scrollWidth <= element.clientWidth + 1,
        `${label} horizontal overflow: ${element.scrollWidth}px content > ${element.clientWidth}px box`);
}
function inside(child, parent, label) {
    const inner = rect(child), outer = rect(parent);
    assert(inner.left >= outer.left - 1 && inner.right <= outer.right + 1,
        `${label} escapes horizontal bounds: [${inner.left}, ${inner.right}] outside [${outer.left}, ${outer.right}]`);
}

await test('native fixture retains fixed grid/nowrap and native invisible rows before Nemo is enabled', async () => {
    const h = fixture(null), visible = nativeRow(), hidden = nativeRow('Hidden', 'completion_prompt_manager_prompt_invisible');
    h.list.append(visible, hidden); await settle();
    assert(styleOf(visible).display === 'grid', 'Native fixture must reproduce native grid precedence');
    assert(styleOf(visible.querySelector('.completion_prompt_manager_prompt_name')).whiteSpace === 'nowrap', 'Native fixture must reproduce nowrap');
    assert(styleOf(hidden).display === 'none', 'Native fixture must reproduce invisibility');
});

for (const modeName of Object.keys(modes)) for (const width of [260, 320, 400]) for (const fontSize of [16, 24]) {
    await test(`${modeName}: native rows/header/visibility at ${width}px panel and ${fontSize}px font on desktop`, async () => {
        const h = fixture(modeName, width, fontSize), group = addSection(h), row = nativeRow(longName);
        const hidden = nativeRow('Native hidden', 'completion_prompt_manager_prompt_invisible');
        const attributeHidden = nativeRow('Hidden attribute'); attributeHidden.hidden = true;
        const searchHidden = nativeRow('Filtered by search'); searchHidden.style.display = 'none';
        const trayHidden = nativeRow('Rendered as tray card', 'nemo-tray-hidden-prompt');
        const visibleClass = nativeRow('Native visible', 'completion_prompt_manager_prompt_visible');
        group.content.append(row, hidden, attributeHidden, searchHidden, trayHidden, visibleClass); await settle();
        assert(Math.abs(h.pm.clientWidth - h.panel.clientWidth) <= 1, 'Prompt manager collapsed inside the native flex wrapper');
        assert(styleOf(row).display === 'flex', `Native fixed-column grid won in ${modeName}`);
        assert(styleOf(visibleClass).display === 'flex', 'Native visible class must not restore fixed grid');
        const nameStyle = styleOf(row.querySelector('.completion_prompt_manager_prompt_name'));
        assert(nameStyle.whiteSpace === (modeName === 'modern' ? 'normal' : 'nowrap'), `Wrong name wrapping: ${nameStyle.whiteSpace}`);
        assert(styleOf(hidden).display === 'none', 'Native invisible prompt was exposed');
        assert(styleOf(attributeHidden).display === 'none', 'Hidden attribute was overridden by row layout');
        assert(styleOf(searchHidden).display === 'none', 'Inline search-hidden prompt was exposed');
        assert(styleOf(trayHidden).display === 'none', 'Tray-hidden native prompt was exposed');
        assert(styleOf(group.header).borderTopWidth === '0px', 'Section header inherited ordinary prompt border');
        noOverflow(row, 'Prompt row'); noOverflow(group.summary, 'Section header'); noOverflow(h.panel, 'Panel');
        inside(row.querySelector('.prompt_manager_prompt_controls'), row, 'Controls');
        inside(row.querySelector('.prompt_manager_prompt_tokens'), row, 'Token count');
        measurements.push({ mode: modeName, width, fontSize, rowHeight: rect(row).height, headerHeight: rect(group.summary).height });
    });
}

for (const modeName of ['modern', 'classicPlus']) for (const width of [260, 320, 400]) for (const fontSize of [16, 24]) {
    await test(`${modeName}: tray controls/dropdown/compact at ${width}px panel and ${fontSize}px font on desktop`, async () => {
        const h = fixture(modeName, width, fontSize), { tray } = addTray(h, { saved: true });
        await settle();
        const header = tray.querySelector('.nemo-tray-header'), menu = tray.querySelector('.nemo-presets-menu');
        const buttons = [...tray.querySelectorAll('button')], closeStyle = styleOf(tray.querySelector('.nemo-tray-close'));
        for (const button of buttons) {
            const actual = styleOf(button);
            assert(actual.backgroundColor === closeStyle.backgroundColor, `${button.className} has unthemed background ${actual.backgroundColor}`);
            assert(actual.color === closeStyle.color, `${button.className} has unthemed text ${actual.color}`);
        }
        assert(styleOf(menu).display === 'none', 'Presets dropdown is visible before opening');
        const headerHeight = rect(header).height;
        tray.querySelector('.nemo-tray-presets-btn').click(); await settle();
        assert(styleOf(menu).display !== 'none', 'Presets dropdown did not open');
        assert(['absolute', 'fixed'].includes(styleOf(menu).position), 'Presets menu participates in header flow');
        assert(Math.abs(rect(header).height - headerHeight) < 1, 'Opening presets grew the header');
        inside(menu, tray, 'Presets menu'); noOverflow(menu, 'Presets menu');
        tray.querySelector('.nemo-tray-presets-btn').click(); await settle();
        assert(styleOf(menu).display === 'none', 'Presets dropdown did not close');
        for (const [element, label] of [[header, 'Tray header'], [tray, 'Tray'], [tray.querySelector('.nemo-tray-grid'), 'Card grid'], [h.panel, 'Panel']]) noOverflow(element, label);
        const card = tray.querySelector('.nemo-prompt-card'), tip = card.querySelector('.nemo-prompt-card-tooltip-text');
        noOverflow(card, 'Card');
        assert(styleOf(tip).display !== 'none' && rect(tip).height > 0, 'Card tooltip disappeared in card mode');
        inside(tip, card, 'Tooltip');
        const expandedHeight = rect(card).height;
        tray.querySelector('.nemo-tray-compact-toggle').click(); await settle();
        const compactHeight = rect(card).height;
        assert(compactHeight < expandedHeight - 2, `Compact class does not reduce card height (${expandedHeight} -> ${compactHeight})`);
        assert(styleOf(tip).display === 'none' || rect(tip).height < fontSize * 1.6, 'Compact mode leaves full tooltip height');
        noOverflow(tray, 'Compact tray'); noOverflow(card, 'Compact card');
        tray.querySelector('.nemo-tray-compact-toggle').click(); await settle();
        assert(Math.abs(rect(card).height - expandedHeight) < 1, 'Restoring card view did not restore layout');
        measurements.push({ mode: modeName, width, fontSize, headerHeight, expandedHeight, compactHeight });
    });
}

await test('Classic legacy profile keeps category trays hidden', async () => {
    const h = fixture('classic'), { tray } = addTray(h); await settle();
    assert(styleOf(tray).display === 'none', 'Legacy profile unexpectedly exposes category tray');
});
await test('All Compact uses real handlers, persists closed sections and updates every open tray', async () => {
    const h = fixture('modern', 400), state = { settings: {}, saves: 0, knownIds: ['First', 'Second', 'Closed'] };
    const first = addTray(h, { sectionId: 'First', state }), second = addTray(h, { sectionId: 'Second', state });
    await settle();
    first.tray.querySelector('.nemo-tray-compact-all').click(); await settle();
    assert(first.tray.classList.contains('nemo-tray-compact') && second.tray.classList.contains('nemo-tray-compact'), 'All Compact missed an open tray');
    assert(state.saves === 1, 'All Compact should persist one batch');
    assert(['First', 'Second', 'Closed'].every(id => state.settings.compactTraySections[id] === true), 'All Compact missed a known closed section');
    assert(first.tray.querySelector('.nemo-tray-compact-toggle').title === 'Card View', 'Compact toggle label was not updated');
});

await test('tray CSS leaves archive card layout independent', async () => {
    fixture('modern', 400);
    const archive = document.createElement('div'); archive.className = 'nemo-archive-body';
    archive.innerHTML = '<div class="nemo-prompt-grid"><div class="nemo-prompt-card"><div class="nemo-prompt-card-content">Saved archive prompt</div></div></div>';
    document.body.append(archive); await settle();
    const archiveCard = archive.querySelector('.nemo-prompt-card');
    const current = { display: styleOf(archiveCard).display, padding: styleOf(archiveCard).padding, flexDirection: styleOf(archiveCard).flexDirection };
    assert(current.display !== 'none', 'Archive card hidden by tray CSS');
    assert(current.padding === '12px' && current.flexDirection === 'column', 'Category tray rules overrode the archive card layout');
    const h = { list: document.querySelector('#completion_prompt_manager_list') };
    const { tray } = addTray(h); tray.classList.add('nemo-tray-compact'); await settle();
    const after = { display: styleOf(archiveCard).display, padding: styleOf(archiveCard).padding, flexDirection: styleOf(archiveCard).flexDirection };
    assert(JSON.stringify(after) === JSON.stringify(current), 'Compacting a category tray changed archive card geometry');
});

// Leave ordinary names/tooltips in card and compact modes for optional visual inspection.
// The tests above use much longer stress strings, including unbroken text.
const preview = fixture('modern', 320, 16);
const previewPrompts = [
    { ...prompts[0], name: 'Persistent Mental Modelling', tooltip: 'Track needs, motivations, and relationship changes across scenes.' },
    { ...prompts[1], name: 'Scene Progression', tooltip: 'Advance the scene when a meaningful action or decision changes it.' },
];
addTray(preview, { sectionId: 'Character Memory', promptRecords: previewPrompts });
const compactPreview = addTray(preview, { sectionId: 'Compact View', promptRecords: previewPrompts });
compactPreview.tray.querySelector('.nemo-tray-compact-toggle').click(); await settle();
globalThis.promptUiReport = {
    tests: results.length, passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length, liveSillyTavern: false,
    viewportWidth: innerWidth, panelWidths: [260, 320, 400], fontSizes: [16, 24], results, measurements,
};
