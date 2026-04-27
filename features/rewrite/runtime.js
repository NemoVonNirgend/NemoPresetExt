import { sendOpenAIRequest, oai_settings } from '../../../../../openai.js';
import { extractAllWords } from '../../../../../utils.js';
import { getTokenCount } from '../../../../../tokenizers.js';
import { getNovelGenerationData, generateNovelWithStreaming, nai_settings } from '../../../../../nai-settings.js';
import { generateHorde, MIN_LENGTH } from '../../../../../horde.js';
import { getTextGenGenerationData, generateTextGenWithStreaming } from '../../../../../textgen-settings.js';
import {
    main_api,
    novelai_settings,
    novelai_setting_names,
    eventSource,
    event_types,
    saveSettingsDebounced,
    messageFormatting,
    addCopyToCodeBlocks,
    generateRaw,
} from '../../../../../../script.js';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '../../../../../popup.js';
import { extension_settings, getContext } from '../../../../../extensions.js';
import { getRegexedString, regex_placement } from '../../../../regex/engine.js';
import logger from '../../core/logger.js';

const FEATURE_PATH = 'scripts/extensions/third-party/NemoPresetExt/features/rewrite';
const FEATURE_SETTINGS_KEY = 'rewrite';
const SETTINGS_ROOT_ID = 'nemo_rewrite_settings';
const STYLE_LINK_ID = 'nemo-rewrite-style-link';
const MENU_ID = 'nemo_rewrite_menu';
const UNDO_BUTTON_CLASS = 'mes_undo_nemo_rewrite';
const HISTORY_LIMIT = 15;

const ACTIONS = {
    rewrite: { label: 'Rewrite', setting: 'showRewrite', icon: 'fa-wand-magic-sparkles' },
    shorten: { label: 'Shorten', setting: 'showShorten', icon: 'fa-compress' },
    expand: { label: 'Expand', setting: 'showExpand', icon: 'fa-expand' },
    custom: { label: 'Custom', setting: 'showCustom', icon: 'fa-pen-to-square' },
    delete: { label: 'Delete', setting: 'showDelete', icon: 'fa-trash' },
};

const DEFAULT_SETTINGS = {
    enabled: true,
    disableWhenStandaloneDetected: true,
    askForNote: false,
    showNoteAction: false,
    storeEditNotes: true,
    sendNotesToNemoLore: true,
    noteHistoryLimit: 50,
    rewritePreset: '',
    shortenPreset: '',
    expandPreset: '',
    customPreset: '',
    highlightDuration: 3000,
    selectedModel: 'chat_completion',
    textRewritePrompt: `[INST]Rewrite this section of text: """{{rewrite}}""" while keeping the same content, general style and length. Do not list alternatives and only print the result without prefix or suffix.[/INST]

Sure, here is only the rewritten text without any comments: `,
    textShortenPrompt: `[INST]Rewrite this section of text: """{{rewrite}}""" while keeping the same content and general style. Do not list alternatives and only print the result without prefix or suffix. Shorten it by roughly 20%.[/INST]

Sure, here is only the rewritten text without any comments: `,
    textExpandPrompt: `[INST]Rewrite this section of text: """{{rewrite}}""" while keeping the same content and general style. Do not list alternatives and only print the result without prefix or suffix. Lengthen it by roughly 20%.[/INST]

Sure, here is only the rewritten text without any comments: `,
    textCustomPrompt: `[INST]Rewrite this section of text: """{{rewrite}}""" according to the following instructions: "{{custom_instructions}}". Keep the general style. Do not list alternatives and only print the result without prefix or suffix.[/INST]

Sure, here is only the rewritten text without any comments: `,
    noteInstructionTemplate: `Edit note from the user: "{{note}}"
Use this as private guidance for the edit. Do not mention the note unless the rewritten text itself needs that content.`,
    useStreaming: true,
    useDynamicTokens: true,
    dynamicTokenMode: 'multiplicative',
    rewriteTokens: 100,
    shortenTokens: 50,
    expandTokens: 150,
    customTokens: 100,
    rewriteTokensAdd: 0,
    shortenTokensAdd: -50,
    expandTokensAdd: 50,
    customTokensAdd: 0,
    rewriteTokensMult: 1.05,
    shortenTokensMult: 0.8,
    expandTokensMult: 1.5,
    customTokensMult: 1.0,
    removePrefix: '"',
    removeSuffix: '"',
    overrideMaxTokens: true,
    showRewrite: true,
    showShorten: true,
    showExpand: true,
    showCustom: true,
    showDelete: true,
    applyRegexOnRewrite: true,
    noteHistory: [],
};

let initialized = false;
let rewriteMenu = null;
let abortController = null;
let changeHistory = [];
let selectionTimer = null;
let registeredEventHandlers = [];

function getSettings() {
    extension_settings.NemoPresetExt = extension_settings.NemoPresetExt || {};
    const existing = extension_settings.NemoPresetExt[FEATURE_SETTINGS_KEY] || {};
    if (existing._noteActionHiddenByDefaultV1 !== true) {
        existing.showNoteAction = false;
        existing._noteActionHiddenByDefaultV1 = true;
    }
    const merged = {
        ...DEFAULT_SETTINGS,
        ...existing,
        noteHistory: Array.isArray(existing.noteHistory) ? existing.noteHistory : [],
    };
    extension_settings.NemoPresetExt[FEATURE_SETTINGS_KEY] = merged;
    return merged;
}

function saveSettings() {
    saveSettingsDebounced();
}

function ensureFeatureStyles() {
    if (document.getElementById(STYLE_LINK_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_LINK_ID;
    link.rel = 'stylesheet';
    link.href = `${FEATURE_PATH}/style.css`;
    document.head.appendChild(link);
}

async function waitForSettingsContainer() {
    const existing = document.getElementById('extensions_settings2');
    if (existing) return existing;
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
            const container = document.getElementById('extensions_settings2');
            if (container) {
                clearInterval(timer);
                resolve(container);
                return;
            }
            if (Date.now() - started > 10000) {
                clearInterval(timer);
                reject(new Error('Timed out waiting for #extensions_settings2'));
            }
        }, 250);
    });
}

async function ensureSettingsUi() {
    if (document.getElementById(SETTINGS_ROOT_ID)) return;
    const container = await waitForSettingsContainer();
    const response = await fetch(`${FEATURE_PATH}/settings.html`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load Nemo Rewrite settings (${response.status})`);
    container.insertAdjacentHTML('beforeend', await response.text());
}

async function populatePresetDropdowns() {
    let presets = [];
    try {
        const context = getContext();
        const result = await fetch('/api/settings/get', {
            method: 'POST',
            headers: context.getRequestHeaders?.() || {},
            body: JSON.stringify({}),
        });
        if (result.ok) {
            const data = await result.json();
            presets = Array.isArray(data.openai_setting_names) ? data.openai_setting_names : [];
        }
    } catch (error) {
        logger.warn('Nemo Rewrite could not load OpenAI presets', error);
    }

    for (const id of ['nemo_rewrite_preset', 'nemo_rewrite_shorten_preset', 'nemo_rewrite_expand_preset', 'nemo_rewrite_custom_preset']) {
        const select = document.getElementById(id);
        if (!(select instanceof HTMLSelectElement)) continue;
        select.innerHTML = '';
        for (const preset of presets) {
            const option = document.createElement('option');
            option.value = preset;
            option.textContent = preset;
            select.appendChild(option);
        }
    }

    const cfg = getSettings();
    for (const key of ['rewritePreset', 'shortenPreset', 'expandPreset', 'customPreset']) {
        if (!cfg[key] && presets.length) cfg[key] = presets[0];
    }
    saveSettings();
}

function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (!input) return;
    if (input instanceof HTMLInputElement && input.type === 'checkbox') {
        input.checked = Boolean(value);
    } else if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
        input.value = String(value ?? '');
    }
}

function getCheckboxValue(id) {
    const input = document.getElementById(id);
    return input instanceof HTMLInputElement ? input.checked : false;
}

function getTextValue(id) {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) return input.value;
    return '';
}

function getIntegerValue(id, fallback) {
    const value = parseInt(getTextValue(id), 10);
    return Number.isFinite(value) ? value : fallback;
}

function getFloatValue(id, fallback) {
    const value = parseFloat(getTextValue(id));
    return Number.isFinite(value) ? value : fallback;
}

function syncSettingsToUi() {
    const cfg = getSettings();
    setInputValue('nemo_rewrite_enabled', cfg.enabled);
    setInputValue('nemo_rewrite_disable_standalone', cfg.disableWhenStandaloneDetected);
    setInputValue('nemo_rewrite_ask_note', cfg.askForNote);
    setInputValue('nemo_rewrite_show_note_action', cfg.showNoteAction);
    setInputValue('nemo_rewrite_store_notes', cfg.storeEditNotes);
    setInputValue('nemo_rewrite_notes_to_nemolore', cfg.sendNotesToNemoLore);
    setInputValue('nemo_rewrite_model_select', cfg.selectedModel);
    setInputValue('nemo_rewrite_preset', cfg.rewritePreset);
    setInputValue('nemo_rewrite_shorten_preset', cfg.shortenPreset);
    setInputValue('nemo_rewrite_expand_preset', cfg.expandPreset);
    setInputValue('nemo_rewrite_custom_preset', cfg.customPreset);
    setInputValue('nemo_rewrite_text_prompt', cfg.textRewritePrompt);
    setInputValue('nemo_rewrite_shorten_prompt', cfg.textShortenPrompt);
    setInputValue('nemo_rewrite_expand_prompt', cfg.textExpandPrompt);
    setInputValue('nemo_rewrite_custom_prompt', cfg.textCustomPrompt);
    setInputValue('nemo_rewrite_note_template', cfg.noteInstructionTemplate);
    setInputValue('nemo_rewrite_use_streaming', cfg.useStreaming);
    setInputValue('nemo_rewrite_apply_regex', cfg.applyRegexOnRewrite);
    setInputValue('nemo_rewrite_dynamic_tokens', cfg.useDynamicTokens);
    setInputValue('nemo_rewrite_dynamic_mode', cfg.dynamicTokenMode);
    setInputValue('nemo_rewrite_tokens', cfg.rewriteTokens);
    setInputValue('nemo_rewrite_shorten_tokens', cfg.shortenTokens);
    setInputValue('nemo_rewrite_expand_tokens', cfg.expandTokens);
    setInputValue('nemo_rewrite_custom_tokens', cfg.customTokens);
    setInputValue('nemo_rewrite_tokens_add', cfg.rewriteTokensAdd);
    setInputValue('nemo_rewrite_shorten_tokens_add', cfg.shortenTokensAdd);
    setInputValue('nemo_rewrite_expand_tokens_add', cfg.expandTokensAdd);
    setInputValue('nemo_rewrite_custom_tokens_add', cfg.customTokensAdd);
    setInputValue('nemo_rewrite_tokens_mult', cfg.rewriteTokensMult);
    setInputValue('nemo_rewrite_shorten_tokens_mult', cfg.shortenTokensMult);
    setInputValue('nemo_rewrite_expand_tokens_mult', cfg.expandTokensMult);
    setInputValue('nemo_rewrite_custom_tokens_mult', cfg.customTokensMult);
    setInputValue('nemo_rewrite_remove_prefix', cfg.removePrefix);
    setInputValue('nemo_rewrite_remove_suffix', cfg.removeSuffix);
    setInputValue('nemo_rewrite_override_tokens', cfg.overrideMaxTokens);
    setInputValue('nemo_rewrite_highlight_duration', cfg.highlightDuration);
    setInputValue('nemo_rewrite_show_rewrite', cfg.showRewrite);
    setInputValue('nemo_rewrite_show_shorten', cfg.showShorten);
    setInputValue('nemo_rewrite_show_expand', cfg.showExpand);
    setInputValue('nemo_rewrite_show_custom', cfg.showCustom);
    setInputValue('nemo_rewrite_show_delete', cfg.showDelete);
    updateModelSettingsUi();
    updateTokenSettingsUi();
    updateStandaloneNotice();
}

function readSettingsFromUi() {
    const cfg = getSettings();
    Object.assign(cfg, {
        enabled: getCheckboxValue('nemo_rewrite_enabled'),
        disableWhenStandaloneDetected: getCheckboxValue('nemo_rewrite_disable_standalone'),
        askForNote: getCheckboxValue('nemo_rewrite_ask_note'),
        showNoteAction: getCheckboxValue('nemo_rewrite_show_note_action'),
        storeEditNotes: getCheckboxValue('nemo_rewrite_store_notes'),
        sendNotesToNemoLore: getCheckboxValue('nemo_rewrite_notes_to_nemolore'),
        selectedModel: getTextValue('nemo_rewrite_model_select') || DEFAULT_SETTINGS.selectedModel,
        rewritePreset: getTextValue('nemo_rewrite_preset'),
        shortenPreset: getTextValue('nemo_rewrite_shorten_preset'),
        expandPreset: getTextValue('nemo_rewrite_expand_preset'),
        customPreset: getTextValue('nemo_rewrite_custom_preset'),
        textRewritePrompt: getTextValue('nemo_rewrite_text_prompt'),
        textShortenPrompt: getTextValue('nemo_rewrite_shorten_prompt'),
        textExpandPrompt: getTextValue('nemo_rewrite_expand_prompt'),
        textCustomPrompt: getTextValue('nemo_rewrite_custom_prompt'),
        noteInstructionTemplate: getTextValue('nemo_rewrite_note_template'),
        useStreaming: getCheckboxValue('nemo_rewrite_use_streaming'),
        applyRegexOnRewrite: getCheckboxValue('nemo_rewrite_apply_regex'),
        useDynamicTokens: getCheckboxValue('nemo_rewrite_dynamic_tokens'),
        dynamicTokenMode: getTextValue('nemo_rewrite_dynamic_mode') || DEFAULT_SETTINGS.dynamicTokenMode,
        rewriteTokens: getIntegerValue('nemo_rewrite_tokens', DEFAULT_SETTINGS.rewriteTokens),
        shortenTokens: getIntegerValue('nemo_rewrite_shorten_tokens', DEFAULT_SETTINGS.shortenTokens),
        expandTokens: getIntegerValue('nemo_rewrite_expand_tokens', DEFAULT_SETTINGS.expandTokens),
        customTokens: getIntegerValue('nemo_rewrite_custom_tokens', DEFAULT_SETTINGS.customTokens),
        rewriteTokensAdd: getIntegerValue('nemo_rewrite_tokens_add', DEFAULT_SETTINGS.rewriteTokensAdd),
        shortenTokensAdd: getIntegerValue('nemo_rewrite_shorten_tokens_add', DEFAULT_SETTINGS.shortenTokensAdd),
        expandTokensAdd: getIntegerValue('nemo_rewrite_expand_tokens_add', DEFAULT_SETTINGS.expandTokensAdd),
        customTokensAdd: getIntegerValue('nemo_rewrite_custom_tokens_add', DEFAULT_SETTINGS.customTokensAdd),
        rewriteTokensMult: getFloatValue('nemo_rewrite_tokens_mult', DEFAULT_SETTINGS.rewriteTokensMult),
        shortenTokensMult: getFloatValue('nemo_rewrite_shorten_tokens_mult', DEFAULT_SETTINGS.shortenTokensMult),
        expandTokensMult: getFloatValue('nemo_rewrite_expand_tokens_mult', DEFAULT_SETTINGS.expandTokensMult),
        customTokensMult: getFloatValue('nemo_rewrite_custom_tokens_mult', DEFAULT_SETTINGS.customTokensMult),
        removePrefix: getTextValue('nemo_rewrite_remove_prefix'),
        removeSuffix: getTextValue('nemo_rewrite_remove_suffix'),
        overrideMaxTokens: getCheckboxValue('nemo_rewrite_override_tokens'),
        highlightDuration: getIntegerValue('nemo_rewrite_highlight_duration', DEFAULT_SETTINGS.highlightDuration),
        showRewrite: getCheckboxValue('nemo_rewrite_show_rewrite'),
        showShorten: getCheckboxValue('nemo_rewrite_show_shorten'),
        showExpand: getCheckboxValue('nemo_rewrite_show_expand'),
        showCustom: getCheckboxValue('nemo_rewrite_show_custom'),
        showDelete: getCheckboxValue('nemo_rewrite_show_delete'),
    });
    saveSettings();
    updateModelSettingsUi();
    updateTokenSettingsUi();
    updateStandaloneNotice();
}

function updateModelSettingsUi() {
    const chatSettings = document.getElementById('nemo_rewrite_chat_settings');
    const textSettings = document.getElementById('nemo_rewrite_text_settings');
    const modelMode = getTextValue('nemo_rewrite_model_select') || getSettings().selectedModel;
    if (chatSettings) chatSettings.style.display = modelMode === 'chat_completion' ? 'block' : 'none';
    if (textSettings) textSettings.style.display = modelMode === 'chat_completion' ? 'none' : 'block';
}

function updateTokenSettingsUi() {
    const useDynamic = getCheckboxValue('nemo_rewrite_dynamic_tokens');
    const mode = getTextValue('nemo_rewrite_dynamic_mode') || getSettings().dynamicTokenMode;
    document.getElementById('nemo_rewrite_static_tokens')?.classList.toggle('nemo-rewrite-hidden', useDynamic);
    document.getElementById('nemo_rewrite_dynamic_token_settings')?.classList.toggle('nemo-rewrite-hidden', !useDynamic);
    document.getElementById('nemo_rewrite_additive_tokens')?.classList.toggle('nemo-rewrite-hidden', mode !== 'additive');
    document.getElementById('nemo_rewrite_multiplicative_tokens')?.classList.toggle('nemo-rewrite-hidden', mode !== 'multiplicative');
}

function isStandaloneRewriteDetected() {
    return Boolean(document.querySelector('.rewrite-extension-settings'));
}

function isNativeMenuSuppressed() {
    const cfg = getSettings();
    return cfg.disableWhenStandaloneDetected && isStandaloneRewriteDetected();
}

function updateStandaloneNotice() {
    const notice = document.getElementById('nemo_rewrite_standalone_notice');
    if (!notice) return;
    if (isNativeMenuSuppressed()) {
        notice.textContent = 'Standalone rewrite-extension is active, so Nemo Rewrite is idle to avoid duplicate selection menus. Disable the standalone extension or turn off this guard to use the native menu now.';
        notice.style.display = 'block';
    } else {
        notice.textContent = '';
        notice.style.display = 'none';
    }
}

function bindSettingsUi() {
    const root = document.getElementById(SETTINGS_ROOT_ID);
    if (!root) return;
    root.querySelectorAll('input, select, textarea').forEach(element => {
        const eventName = element instanceof HTMLInputElement && ['number', 'text'].includes(element.type) ? 'input' : 'change';
        element.addEventListener(eventName, readSettingsFromUi);
    });
    document.getElementById('nemo_rewrite_refresh_presets')?.addEventListener('click', async () => {
        await populatePresetDropdowns();
        syncSettingsToUi();
    });
}

function registerEventHandler(eventName, handler) {
    eventSource.on(eventName, handler);
    registeredEventHandlers.push([eventName, handler]);
}

function addDomListener(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    registeredEventHandlers.push([target, eventName, handler, options]);
}

function removeAllHandlers() {
    while (registeredEventHandlers.length) {
        const entry = registeredEventHandlers.pop();
        if (typeof entry[0] === 'string') {
            eventSource.removeListener(entry[0], entry[1]);
        } else {
            entry[0].removeEventListener(entry[1], entry[2], entry[3]);
        }
    }
    $('#mes_stop').off('click.nemoRewrite');
}

function handleSelectionChange() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(processSelection, 60);
}

function processSelection() {
    if (!initialized || !getSettings().enabled || isNativeMenuSuppressed()) {
        removeRewriteMenu();
        updateStandaloneNotice();
        return;
    }
    const context = getContext();
    if (context.chatId === undefined) return;

    const selection = window.getSelection();
    removeRewriteMenu();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim().length === 0) return;

    const range = selection.getRangeAt(0);
    const startMesText = findClosestMesText(range.startContainer);
    const endMesText = findClosestMesText(range.endContainer);
    if (!startMesText || !endMesText || startMesText !== endMesText) return;
    if (!findMessageDiv(startMesText)) return;
    createRewriteMenu();
}

function hideMenuOnOutsideClick(event) {
    if (rewriteMenu && !rewriteMenu.contains(event.target)) removeRewriteMenu();
}

function createRewriteMenu() {
    removeRewriteMenu();
    const cfg = getSettings();
    rewriteMenu = document.createElement('ul');
    rewriteMenu.id = MENU_ID;
    rewriteMenu.className = 'list-group ctx-menu nemo-rewrite-menu';
    rewriteMenu.style.position = 'fixed';
    rewriteMenu.style.zIndex = '10000';

    for (const [key, action] of Object.entries(ACTIONS)) {
        if (!cfg[action.setting]) continue;
        rewriteMenu.appendChild(createMenuItem(key, action.label, action.icon, key === 'delete'));
    }

    if (cfg.showNoteAction) {
        rewriteMenu.appendChild(createMenuSeparator());
        rewriteMenu.appendChild(createMenuItem('note', 'Leave Note...', 'fa-note-sticky'));
    }

    if (!rewriteMenu.children.length) return;
    document.body.appendChild(rewriteMenu);
    positionMenu();
}

function createMenuItem(actionKey, label, icon, danger = false) {
    const item = document.createElement('li');
    item.className = `list-group-item ctx-item nemo-rewrite-menu-item${danger ? ' nemo-rewrite-danger' : ''}`;
    item.dataset.action = actionKey;
    item.innerHTML = `<i class="fa-solid ${icon}"></i><span>${label}</span>`;
    item.addEventListener('mousedown', handleMenuItemClick);
    item.addEventListener('touchstart', handleMenuItemClick);
    return item;
}

function createMenuSeparator() {
    const separator = document.createElement('li');
    separator.className = 'nemo-rewrite-menu-separator';
    return separator;
}

function positionMenu() {
    if (!rewriteMenu) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;
    const menuWidth = rewriteMenu.offsetWidth;
    const menuHeight = rewriteMenu.offsetHeight;
    if (left + menuWidth > window.innerWidth) left = Math.max(0, window.innerWidth - menuWidth - 8);
    if (top + menuHeight > window.innerHeight) top = Math.max(0, rect.top - menuHeight - 6);
    rewriteMenu.style.left = `${left}px`;
    rewriteMenu.style.top = `${top}px`;
}

function removeRewriteMenu() {
    rewriteMenu?.remove();
    rewriteMenu = null;
}

async function handleMenuItemClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const actionKey = event.currentTarget?.dataset?.action;
    const selectionInfo = getCurrentSelectionInfo();
    removeRewriteMenu();
    if (!actionKey || !selectionInfo) return;

    if (actionKey === 'note') {
        await handleNoteFlow(selectionInfo);
    } else {
        await runRewriteAction(actionKey, selectionInfo, { note: null });
    }
    window.getSelection()?.removeAllRanges();
}

function getCurrentSelectionInfo() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0).cloneRange();
    if (!range.toString().trim()) return null;
    const mesTextElement = findClosestMesText(range.commonAncestorContainer) || findClosestMesText(selection.anchorNode);
    const messageDiv = mesTextElement ? findMessageDiv(mesTextElement) : null;
    if (!mesTextElement || !messageDiv) return null;
    const mesId = messageDiv.getAttribute('mesid');
    const swipeId = messageDiv.getAttribute('swipeid') ?? undefined;
    if (mesId === null) return null;
    return getSelectedTextInfo(mesId, swipeId, mesTextElement, range);
}

async function handleNoteFlow(selectionInfo) {
    const note = await promptForEditNote('this edit', selectionInfo.selectedRawText);
    if (note === null) return;
    const actionKey = await promptForNotedAction();
    if (!actionKey) return;
    await runRewriteAction(actionKey, selectionInfo, { note });
}

async function promptForNotedAction() {
    const result = await callGenericPopup(
        '<h3>Use this note for which action?</h3><p>Nemo Rewrite will include the note as private edit guidance for AI actions. Delete stores the note with the undo history.</p>',
        POPUP_TYPE.TEXT,
        '',
        {
            okButton: false,
            cancelButton: 'Cancel',
            customButtons: [
                { text: 'Rewrite', icon: ACTIONS.rewrite.icon, result: POPUP_RESULT.CUSTOM1 },
                { text: 'Shorten', icon: ACTIONS.shorten.icon, result: POPUP_RESULT.CUSTOM2 },
                { text: 'Expand', icon: ACTIONS.expand.icon, result: POPUP_RESULT.CUSTOM3 },
                { text: 'Custom', icon: ACTIONS.custom.icon, result: POPUP_RESULT.CUSTOM4 },
                { text: 'Delete', icon: ACTIONS.delete.icon, result: POPUP_RESULT.CUSTOM5, classes: ['redWarningBG'] },
            ],
        },
    );
    const mapping = {
        [POPUP_RESULT.CUSTOM1]: 'rewrite',
        [POPUP_RESULT.CUSTOM2]: 'shorten',
        [POPUP_RESULT.CUSTOM3]: 'expand',
        [POPUP_RESULT.CUSTOM4]: 'custom',
        [POPUP_RESULT.CUSTOM5]: 'delete',
    };
    return mapping[result] || null;
}

async function promptForEditNote(actionLabel, selectedText) {
    const preview = selectedText.length > 240 ? `${selectedText.slice(0, 240)}...` : selectedText;
    const result = await callGenericPopup(
        `<h3>Leave a note for ${actionLabel}</h3><p class="nemo-rewrite-note-preview">${escapeHtml(preview)}</p>`,
        POPUP_TYPE.INPUT,
        '',
        {
            rows: 4,
            placeholder: 'Example: Remove this because it repeats the previous paragraph.',
            okButton: 'Use Note',
            cancelButton: 'Cancel',
            wide: true,
        },
    );
    if (result === null || result === false) return null;
    return String(result || '').trim();
}

async function promptForCustomInstructions() {
    const result = await callGenericPopup(
        '<h3>Custom rewrite instructions</h3>',
        POPUP_TYPE.INPUT,
        '',
        {
            rows: 4,
            placeholder: 'Describe exactly how the selected text should change.',
            okButton: 'Rewrite',
            cancelButton: 'Cancel',
            wide: true,
        },
    );
    if (result === null || result === false) return null;
    return String(result || '').trim();
}

async function runRewriteAction(actionKey, selectionInfo, options = {}) {
    const cfg = getSettings();
    let note = options.note;
    if (note === null && cfg.askForNote) {
        note = await promptForEditNote(ACTIONS[actionKey]?.label || actionKey, selectionInfo.selectedRawText);
        if (note === null) return;
    }

    if (actionKey === 'delete') {
        await handleDeleteSelection(selectionInfo, note || '');
        return;
    }

    let customInstructions = null;
    if (actionKey === 'custom') {
        customInstructions = await promptForCustomInstructions();
        if (!customInstructions) return;
    }

    await handleRewrite(selectionInfo, actionKey, customInstructions, note || '');
}

async function handleDeleteSelection(selectionInfo, note = '') {
    const { mesId, swipeId, fullMessage, rawStartOffset, rawEndOffset, selectedRawText } = selectionInfo;
    const newMessage = fullMessage.slice(0, rawStartOffset) + fullMessage.slice(rawEndOffset);
    saveLastChange(mesId, swipeId, fullMessage, newMessage, {
        action: 'Delete',
        note,
        selectedText: selectedRawText,
    });
    await updateMessageContent(mesId, swipeId, newMessage);
    await recordEditNote({ mesId, swipeId, action: 'Delete', note, selectedText: selectedRawText, resultText: '' });
}

async function handleRewrite(selectionInfo, actionKey, customInstructions, note) {
    if (main_api === 'openai') {
        const cfg = getSettings();
        if (cfg.selectedModel === 'chat_completion') {
            return handleChatCompletionRewrite(selectionInfo, actionKey, customInstructions, note);
        }
        return handleSimplifiedChatCompletionRewrite(selectionInfo, actionKey, customInstructions, note);
    }
    return handleTextBasedRewrite(selectionInfo, actionKey, customInstructions, note);
}

function getPresetForAction(actionKey) {
    const cfg = getSettings();
    switch (actionKey) {
        case 'rewrite': return cfg.rewritePreset;
        case 'shorten': return cfg.shortenPreset;
        case 'expand': return cfg.expandPreset;
        case 'custom': return cfg.customPreset;
        default: return '';
    }
}

function getPromptTemplateForAction(actionKey) {
    const cfg = getSettings();
    switch (actionKey) {
        case 'rewrite': return cfg.textRewritePrompt;
        case 'shorten': return cfg.textShortenPrompt;
        case 'expand': return cfg.textExpandPrompt;
        case 'custom': return cfg.textCustomPrompt;
        default: return '';
    }
}

async function handleChatCompletionRewrite(selectionInfo, actionKey, customInstructions, note) {
    const { mesId, swipeId, fullMessage, selectedRawText, rawStartOffset, rawEndOffset, range } = selectionInfo;
    const mesDiv = document.querySelector(`[mesid="${CSS.escape(mesId)}"] .mes_text`);
    if (!mesDiv) return;

    const selectedPreset = getPresetForAction(actionKey);
    if (!selectedPreset) {
        toastr.error('Select a Nemo Rewrite preset first.', 'Nemo Rewrite');
        return;
    }

    const result = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getContext().getRequestHeaders?.() || {},
        body: JSON.stringify({}),
    });
    if (!result.ok) {
        toastr.error('Failed to load OpenAI preset settings.', 'Nemo Rewrite');
        return;
    }

    const data = await result.json();
    const presetIndex = data.openai_setting_names.indexOf(selectedPreset);
    if (presetIndex === -1) {
        toastr.error(`Preset not found: ${selectedPreset}`, 'Nemo Rewrite');
        return;
    }

    const previousOaiSettings = { ...oai_settings };
    let selectedPresetSettings;
    try {
        selectedPresetSettings = JSON.parse(data.openai_settings[presetIndex]);
    } catch (error) {
        logger.error('Failed to parse Nemo Rewrite preset settings', error);
        toastr.error('Failed to parse selected preset settings.', 'Nemo Rewrite');
        return;
    }

    const cfg = getSettings();
    selectedPresetSettings.stream_openai = cfg.useStreaming;
    if (cfg.overrideMaxTokens) {
        selectedPresetSettings.openai_max_tokens = calculateTargetTokenCount(selectedRawText, actionKey);
    }

    Object.assign(oai_settings, selectedPresetSettings);
    const promptReadyPromise = new Promise(resolve => eventSource.once(event_types.CHAT_COMPLETION_PROMPT_READY, resolve));
    getContext().generate('normal', {}, true);
    const promptData = await promptReadyPromise;
    let chatToSend = Array.isArray(promptData?.chat) ? promptData.chat : [];

    const hasCustomMacro = chatContainsMacro(chatToSend, /{{custom_instructions}}/i);
    const hasNoteMacro = chatContainsMacro(chatToSend, /{{(?:note|edit_note|rewrite_note)}}/i);
    chatToSend = injectAdditionalInstructions(chatToSend, customInstructions, note, actionKey, { hasCustomMacro, hasNoteMacro });
    chatToSend = substituteChatMacros(chatToSend, selectionInfo, customInstructions, note);

    abortController = createAbortController(mesDiv, mesId, swipeId, previousOaiSettings);
    getContext().deactivateSendButtons();

    let response;
    let presetRequestFailed = false;
    let presetRequestError;
    try {
        response = await sendOpenAIRequest('normal', chatToSend, abortController.signal);
    } catch (error) {
        if (!abortController.signal.aborted) {
            presetRequestFailed = true;
            presetRequestError = error;
        }
    } finally {
        Object.assign(oai_settings, previousOaiSettings);
        getContext().activateSendButtons();
    }

    if (presetRequestFailed) {
        logger.warn(`Nemo Rewrite preset "${selectedPreset}" failed; falling back to active connection profile`, presetRequestError);
        toastr.warning(`Preset "${selectedPreset}" failed. Retrying with the active connection profile.`, 'Nemo Rewrite');
        return handleSimplifiedChatCompletionRewrite(selectionInfo, actionKey, customInstructions, note);
    }

    if (response === undefined) {
        removeHighlight(mesDiv, mesId, swipeId);
        return;
    }
    await processRewriteResponse(response, selectionInfo, range, fullMessage, rawStartOffset, rawEndOffset, actionKey, note, mesDiv);
}

async function handleSimplifiedChatCompletionRewrite(selectionInfo, actionKey, customInstructions, note) {
    const prompt = buildTextPrompt(selectionInfo, actionKey, customInstructions, note);
    if (!prompt) return;
    const mesDiv = document.querySelector(`[mesid="${CSS.escape(selectionInfo.mesId)}"] .mes_text`);
    if (!mesDiv) return;

    abortController = createAbortController(mesDiv, selectionInfo.mesId, selectionInfo.swipeId);
    getContext().deactivateSendButtons();
    let response;
    try {
        response = await sendOpenAIRequest('normal', [
            { role: 'system', content: 'You are a precise text rewriter. Output only the rewritten text - no preface, no commentary, no quotes.' },
            { role: 'user', content: prompt },
        ], abortController.signal);
    } catch (error) {
        if (!abortController.signal.aborted) {
            logger.error('Nemo Rewrite simplified OpenAI request failed', error);
            toastr.error('Rewrite failed. Check the console for details.', 'Nemo Rewrite');
        }
    } finally {
        getContext().activateSendButtons();
    }
    if (response === undefined) return;
    await processRewriteResponse(response, selectionInfo, selectionInfo.range, selectionInfo.fullMessage, selectionInfo.rawStartOffset, selectionInfo.rawEndOffset, actionKey, note, mesDiv);
}

async function handleTextBasedRewrite(selectionInfo, actionKey, customInstructions, note) {
    const prompt = buildTextPrompt(selectionInfo, actionKey, customInstructions, note);
    if (!prompt) return;
    const amountGen = calculateTargetTokenCount(selectionInfo.selectedRawText, actionKey);
    const mesDiv = document.querySelector(`[mesid="${CSS.escape(selectionInfo.mesId)}"] .mes_text`);
    if (!mesDiv) return;

    let generateData;
    switch (main_api) {
        case 'novel': {
            const novelSettings = novelai_settings[novelai_setting_names[nai_settings.preset_settings_novel]];
            generateData = getNovelGenerationData(prompt, novelSettings, amountGen, false, false, null, 'quiet');
            break;
        }
        case 'textgenerationwebui':
            generateData = getTextGenGenerationData(prompt, amountGen, false, false, null, 'quiet');
            break;
        case 'koboldhorde':
            generateData = { prompt, max_length: Math.max(amountGen, MIN_LENGTH), quiet: true };
            break;
        default:
            toastr.error(`Unsupported API for Nemo Rewrite: ${main_api}`, 'Nemo Rewrite');
            return;
    }

    abortController = createAbortController(mesDiv, selectionInfo.mesId, selectionInfo.swipeId);
    getContext().deactivateSendButtons();
    let response;
    try {
        if (getSettings().useStreaming) {
            switch (main_api) {
                case 'textgenerationwebui':
                    response = await generateTextGenWithStreaming(generateData, abortController.signal);
                    break;
                case 'novel':
                    response = await generateNovelWithStreaming(generateData, abortController.signal);
                    break;
                default:
                    toastr.warning('Streaming is not supported for the active backend. Disable streaming in Nemo Rewrite settings.', 'Nemo Rewrite');
                    return;
            }
        } else if (main_api === 'koboldhorde') {
            response = await generateHorde(prompt, generateData, abortController.signal, true);
        } else {
            const text = await generateRaw(prompt, null, false, false, null, generateData.max_length);
            response = { text };
        }
    } catch (error) {
        if (!abortController.signal.aborted) {
            logger.error('Nemo Rewrite text request failed', error);
            toastr.error('Rewrite failed. Check the console for details.', 'Nemo Rewrite');
        }
    } finally {
        getContext().activateSendButtons();
    }

    if (response === undefined) return;
    await processRewriteResponse(response, selectionInfo, selectionInfo.range, selectionInfo.fullMessage, selectionInfo.rawStartOffset, selectionInfo.rawEndOffset, actionKey, note, mesDiv);
}

function createAbortController(mesDiv, mesId, swipeId, previousOaiSettings = null) {
    const controller = new AbortController();
    controller.signal.mesDiv = mesDiv;
    controller.signal.mesId = mesId;
    controller.signal.swipeId = swipeId;
    controller.signal.highlightDuration = getSettings().highlightDuration;
    controller.signal.previousOaiSettings = previousOaiSettings;
    return controller;
}

function handleStopRewrite() {
    if (!abortController) return;
    const { mesDiv, mesId, swipeId, highlightDuration, previousOaiSettings } = abortController.signal;
    abortController.abort();
    if (previousOaiSettings) Object.assign(oai_settings, previousOaiSettings);
    getContext().activateSendButtons();
    setTimeout(() => removeHighlight(mesDiv, mesId, swipeId), highlightDuration || DEFAULT_SETTINGS.highlightDuration);
}

function chatContainsMacro(chatToSend, pattern) {
    return chatToSend.some(message => {
        if (Array.isArray(message?.content)) {
            return message.content.some(part => part?.type === 'text' && pattern.test(part.text || ''));
        }
        return typeof message?.content === 'string' && pattern.test(message.content);
    });
}

function injectAdditionalInstructions(chatToSend, customInstructions, note, actionKey, options = {}) {
    const instructionParts = [];
    if (customInstructions && !options.hasCustomMacro) instructionParts.push(`Custom rewrite instructions:\n${customInstructions}`);
    if (note && !options.hasNoteMacro) instructionParts.push(renderNoteInstruction(note));
    if (!instructionParts.length) return chatToSend;
    const instructionText = `\n\nAdditional Nemo Rewrite guidance for ${ACTIONS[actionKey]?.label || actionKey}:\n${instructionParts.join('\n\n')}`;
    const target = [...chatToSend].reverse().find(message => message?.role === 'user');
    if (!target) {
        chatToSend.push({ role: 'user', content: instructionText.trim() });
        return chatToSend;
    }
    appendTextToChatMessage(target, instructionText);
    return chatToSend;
}

function appendTextToChatMessage(message, text) {
    if (Array.isArray(message.content)) {
        const lastTextPart = [...message.content].reverse().find(part => part?.type === 'text');
        if (lastTextPart) {
            lastTextPart.text += text;
        } else {
            message.content.push({ type: 'text', text });
        }
    } else if (typeof message.content === 'string') {
        message.content += text;
    } else {
        message.content = text;
    }
}

function substituteChatMacros(chatToSend, selectionInfo, customInstructions, note) {
    return chatToSend.map(message => {
        if (Array.isArray(message.content)) {
            message.content = message.content.map(part => {
                if (part?.type === 'text') part.text = substitutePromptMacros(part.text, selectionInfo, customInstructions, note);
                return part;
            });
        } else if (typeof message.content === 'string') {
            message.content = substitutePromptMacros(message.content, selectionInfo, customInstructions, note);
        }
        return message;
    });
}

function buildTextPrompt(selectionInfo, actionKey, customInstructions, note) {
    let prompt = getPromptTemplateForAction(actionKey);
    if (!prompt) {
        toastr.error('No prompt template configured for this action.', 'Nemo Rewrite');
        return '';
    }
    prompt = getContext().substituteParams(prompt);
    const hasCustomMacro = /{{custom_instructions}}/i.test(prompt);
    const hasNoteMacro = /{{(?:note|edit_note|rewrite_note)}}/i.test(prompt);
    prompt = substitutePromptMacros(prompt, selectionInfo, customInstructions, note);
    if (customInstructions && !hasCustomMacro) {
        prompt += `\n\nCustom rewrite instructions:\n${customInstructions}`;
    }
    if (note && !hasNoteMacro) {
        prompt += `\n\n${renderNoteInstruction(note)}`;
    }
    return prompt;
}

function substitutePromptMacros(prompt, selectionInfo, customInstructions, note) {
    const wordCount = extractAllWords(selectionInfo.selectedRawText).length;
    return String(prompt || '')
        .replace(/{{rewrite}}/gi, selectionInfo.selectedRawText)
        .replace(/{{targetmessage}}/gi, selectionInfo.fullMessage)
        .replace(/{{rewritecount}}/gi, String(wordCount))
        .replace(/{{custom_instructions}}/gi, customInstructions || '')
        .replace(/{{(?:note|edit_note|rewrite_note)}}/gi, note || '');
}

function renderNoteInstruction(note) {
    const template = String(getSettings().noteInstructionTemplate || DEFAULT_SETTINGS.noteInstructionTemplate);
    const hasNoteMacro = /{{(?:note|edit_note|rewrite_note)}}/i.test(template);
    const rendered = template.replace(/{{(?:note|edit_note|rewrite_note)}}/gi, note || '');
    return hasNoteMacro ? rendered : `${rendered}\n${note || ''}`.trim();
}

async function processRewriteResponse(response, selectionInfo, range, fullMessage, startOffset, endOffset, actionKey, note, mesDiv) {
    window.getSelection()?.removeAllRanges();
    let newText = '';
    try {
        if (typeof response === 'function') {
            const streamingSpan = document.createElement('span');
            streamingSpan.className = 'nemo-rewrite-highlight';
            range.deleteContents();
            range.insertNode(streamingSpan);
            for await (const chunk of response()) {
                newText = chunk.text || '';
                streamingSpan.textContent = newText;
            }
        } else {
            newText = normalizeGenerationResponse(response);
            const highlightedNewText = document.createElement('span');
            highlightedNewText.className = 'nemo-rewrite-highlight';
            highlightedNewText.textContent = newText;
            range.deleteContents();
            range.insertNode(highlightedNewText);
        }

        setTimeout(() => removeHighlight(mesDiv, selectionInfo.mesId, selectionInfo.swipeId), getSettings().highlightDuration);
        await saveRewrittenText(selectionInfo, fullMessage, startOffset, endOffset, newText, actionKey, note);
    } catch (error) {
        logger.error('Nemo Rewrite failed to process response', error);
        toastr.error('Failed to process rewrite response.', 'Nemo Rewrite');
        removeHighlight(mesDiv, selectionInfo.mesId, selectionInfo.swipeId);
    }
}

function normalizeGenerationResponse(response) {
    if (main_api === 'novel' && response?.output) return response.output;
    return response?.choices?.[0]?.message?.content ?? response?.choices?.[0]?.text ?? response?.text ?? '';
}

async function saveRewrittenText(selectionInfo, fullMessage, startOffset, endOffset, newText, actionKey, note) {
    const cfg = getSettings();
    let processedText = String(newText || '');
    if (cfg.removePrefix && processedText.startsWith(cfg.removePrefix)) {
        processedText = processedText.slice(cfg.removePrefix.length);
    }
    if (cfg.removeSuffix && processedText.endsWith(cfg.removeSuffix)) {
        processedText = processedText.slice(0, -cfg.removeSuffix.length);
    }
    if (cfg.applyRegexOnRewrite) {
        processedText = getRegexedString(processedText, regex_placement.AI_OUTPUT);
    }

    const newMessage = fullMessage.substring(0, startOffset) + processedText + fullMessage.substring(endOffset);
    saveLastChange(selectionInfo.mesId, selectionInfo.swipeId, fullMessage, newMessage, {
        action: ACTIONS[actionKey]?.label || actionKey,
        note,
        selectedText: selectionInfo.selectedRawText,
        resultText: processedText,
    });
    await updateMessageContent(selectionInfo.mesId, selectionInfo.swipeId, newMessage);
    await recordEditNote({
        mesId: selectionInfo.mesId,
        swipeId: selectionInfo.swipeId,
        action: ACTIONS[actionKey]?.label || actionKey,
        note,
        selectedText: selectionInfo.selectedRawText,
        resultText: processedText,
    });
}

async function updateMessageContent(mesId, swipeId, newMessage) {
    const context = getContext();
    const message = context.chat[mesId];
    if (!message) return;
    message.mes = newMessage;
    if (swipeId !== undefined && message.swipes?.[swipeId] !== undefined) {
        message.swipes[swipeId] = newMessage;
    }
    const mesTextElement = document.querySelector(`[mesid="${CSS.escape(mesId)}"] .mes_text`);
    if (mesTextElement) {
        mesTextElement.innerHTML = messageFormatting(newMessage, context.name2, message.isSystem, message.isUser, mesId);
        addCopyToCodeBlocks(mesTextElement);
    }
    await context.saveChat();
}

async function recordEditNote(entry) {
    if (!entry.note) return;
    const cfg = getSettings();
    if (cfg.storeEditNotes) {
        cfg.noteHistory.unshift({
            ...entry,
            note: entry.note.trim(),
            timestamp: Date.now(),
        });
        cfg.noteHistory = cfg.noteHistory.slice(0, Math.max(1, cfg.noteHistoryLimit || DEFAULT_SETTINGS.noteHistoryLimit));
        saveSettings();
    }

    if (cfg.sendNotesToNemoLore && window.NemoLorePreferenceBridge?.recordRewriteNote) {
        try {
            await window.NemoLorePreferenceBridge.recordRewriteNote({
                messageId: entry.mesId,
                swipeId: entry.swipeId,
                action: entry.action,
                note: entry.note,
                selectedText: entry.selectedText,
                resultText: entry.resultText,
            });
        } catch (error) {
            logger.warn('Nemo Rewrite could not send edit note to NemoLore preference evidence', error);
        }
    }
}

function calculateTargetTokenCount(selectedText, actionKey) {
    const cfg = getSettings();
    const baseTokenCount = getTokenCount(selectedText);
    let result;
    if (cfg.useDynamicTokens) {
        if (cfg.dynamicTokenMode === 'additive') {
            const modifiers = {
                rewrite: cfg.rewriteTokensAdd,
                shorten: cfg.shortenTokensAdd,
                expand: cfg.expandTokensAdd,
                custom: cfg.customTokensAdd,
            };
            result = baseTokenCount + (modifiers[actionKey] ?? 0);
        } else {
            const multipliers = {
                rewrite: cfg.rewriteTokensMult,
                shorten: cfg.shortenTokensMult,
                expand: cfg.expandTokensMult,
                custom: cfg.customTokensMult,
            };
            result = baseTokenCount * (multipliers[actionKey] ?? 1);
        }
    } else {
        const staticTokens = {
            rewrite: cfg.rewriteTokens,
            shorten: cfg.shortenTokens,
            expand: cfg.expandTokens,
            custom: cfg.customTokens,
        };
        result = staticTokens[actionKey] ?? DEFAULT_SETTINGS.rewriteTokens;
    }
    return Math.max(1, Math.round(result));
}

function saveLastChange(mesId, swipeId, originalContent, newContent, metadata = {}) {
    changeHistory.push({
        mesId,
        swipeId,
        originalContent,
        newContent,
        metadata,
        timestamp: Date.now(),
    });
    if (changeHistory.length > HISTORY_LIMIT) changeHistory.shift();
    updateUndoButtons();
}

function updateUndoButtons() {
    document.querySelectorAll(`.${UNDO_BUTTON_CLASS}`).forEach(button => button.remove());
    const changedMessageIds = [...new Set(changeHistory.map(change => change.mesId))];
    changedMessageIds.forEach(addUndoButton);
}

function addUndoButton(mesId) {
    const messageDiv = document.querySelector(`[mesid="${CSS.escape(mesId)}"]`);
    const mesButtons = messageDiv?.querySelector('.mes_buttons');
    if (!mesButtons) return;
    const undoButton = document.createElement('div');
    undoButton.className = `mes_button ${UNDO_BUTTON_CLASS} fa-solid fa-undo interactable`;
    undoButton.title = 'Undo Nemo Rewrite';
    undoButton.dataset.mesId = mesId;
    undoButton.addEventListener('click', handleUndo);
    if (mesButtons.children.length >= 1) {
        mesButtons.insertBefore(undoButton, mesButtons.children[1]);
    } else {
        mesButtons.appendChild(undoButton);
    }
}

function removeUndoButton(editedMesId) {
    changeHistory = changeHistory.filter(change => change.mesId !== String(editedMesId));
    updateUndoButtons();
}

async function handleUndo(event) {
    const mesId = event.currentTarget?.dataset?.mesId;
    if (!mesId) return;
    const change = [...changeHistory].reverse().find(item => item.mesId === mesId);
    if (!change) return;
    await updateMessageContent(change.mesId, change.swipeId, change.originalContent);
    changeHistory = changeHistory.filter(item => item !== change);
    updateUndoButtons();
}

async function removeHighlight(mesDiv, mesId, swipeId) {
    const highlightSpan = mesDiv?.querySelector?.('.nemo-rewrite-highlight');
    if (highlightSpan) {
        highlightSpan.replaceWith(document.createTextNode(highlightSpan.textContent || ''));
    }
    const context = getContext();
    const message = context.chat?.[mesId];
    if (!message) return;
    const content = swipeId !== undefined && message.swipes?.[swipeId] !== undefined ? message.swipes[swipeId] : message.mes;
    const mesTextElement = mesDiv?.closest?.('.mes')?.querySelector?.('.mes_text') || document.querySelector(`[mesid="${CSS.escape(mesId)}"] .mes_text`);
    if (mesTextElement) {
        mesTextElement.innerHTML = messageFormatting(content, context.name2, message.isSystem, message.isUser, mesId);
        addCopyToCodeBlocks(mesTextElement);
    }
}

function getMessageContent(message, swipeId) {
    if (!message) return '';
    if (swipeId !== undefined && message.swipes?.[swipeId] !== undefined) return message.swipes[swipeId];
    return message.mes || '';
}

function getSelectedTextInfo(mesId, swipeId, mesTextElement, range) {
    const context = getContext();
    const message = context.chat[mesId];
    const fullMessage = getMessageContent(message, swipeId);
    const selectedVisibleText = range.toString();
    const renderedText = getRenderedRangeText(mesTextElement);
    const mapping = createTextMapping(fullMessage, renderedText);
    const startOffset = getRangeTextOffset(mesTextElement, range, 'start');
    const endOffset = getRangeTextOffset(mesTextElement, range, 'end');
    let rawStartOffset = mapping.formattedToRaw(startOffset);
    let rawEndOffset = mapping.formattedToRaw(endOffset);
    if (rawStartOffset > rawEndOffset) [rawStartOffset, rawEndOffset] = [rawEndOffset, rawStartOffset];
    rawStartOffset = Math.max(0, Math.min(fullMessage.length, rawStartOffset));
    rawEndOffset = Math.max(rawStartOffset, Math.min(fullMessage.length, rawEndOffset));

    const resolved = resolveRawSelectionOffsets({
        fullMessage,
        selectedVisibleText,
        predictedStart: rawStartOffset,
        predictedEnd: rawEndOffset,
        visibleBefore: renderedText.slice(Math.max(0, startOffset - 120), startOffset),
        visibleAfter: renderedText.slice(endOffset, Math.min(renderedText.length, endOffset + 120)),
    });

    if (!resolved) {
        toastr.warning('Nemo Rewrite could not safely match that selection to the raw message. Try selecting a smaller plain-text span.', 'Nemo Rewrite');
        return null;
    }

    return {
        mesId,
        swipeId,
        fullMessage,
        selectedRawText: fullMessage.substring(resolved.start, resolved.end),
        rawStartOffset: resolved.start,
        rawEndOffset: resolved.end,
        range,
        selectedVisibleText,
    };
}

function resolveRawSelectionOffsets({ fullMessage, selectedVisibleText, predictedStart, predictedEnd, visibleBefore, visibleAfter }) {
    const candidates = [];
    addRawSelectionCandidate(candidates, fullMessage, predictedStart, predictedEnd, 'mapping');

    for (const needle of getRawSearchNeedles(selectedVisibleText)) {
        for (const match of findAllOccurrences(fullMessage, needle)) {
            addRawSelectionCandidate(candidates, fullMessage, match, match + needle.length, 'exact');
        }
    }

    const unique = new Map();
    for (const candidate of candidates) {
        const expanded = expandMarkdownSelection(fullMessage, candidate.start, candidate.end);
        const key = `${expanded.start}:${expanded.end}`;
        if (!unique.has(key)) unique.set(key, { ...candidate, ...expanded });
    }

    const scored = [...unique.values()]
        .map(candidate => ({
            ...candidate,
            score: scoreSelectionCandidate(fullMessage, candidate, selectedVisibleText, visibleBefore, visibleAfter, predictedStart),
        }))
        .filter(candidate => candidate.end > candidate.start && candidate.score >= 60)
        .sort((a, b) => b.score - a.score || Math.abs(a.start - predictedStart) - Math.abs(b.start - predictedStart));

    return scored[0] || null;
}

function addRawSelectionCandidate(candidates, fullMessage, start, end, source) {
    const safeStart = Math.max(0, Math.min(fullMessage.length, Number(start) || 0));
    const safeEnd = Math.max(safeStart, Math.min(fullMessage.length, Number(end) || safeStart));
    if (safeEnd > safeStart) candidates.push({ start: safeStart, end: safeEnd, source });
}

function getRawSearchNeedles(selectedVisibleText) {
    const variants = new Set();
    const raw = String(selectedVisibleText || '');
    const trimmed = raw.trim();
    for (const value of [raw, trimmed, raw.replace(/\u2026/g, '...'), trimmed.replace(/\u2026/g, '...')]) {
        if (value) variants.add(value);
    }
    return [...variants].sort((a, b) => b.length - a.length);
}

function findAllOccurrences(haystack, needle) {
    const matches = [];
    if (!needle) return matches;
    let index = haystack.indexOf(needle);
    while (index !== -1) {
        matches.push(index);
        index = haystack.indexOf(needle, index + 1);
    }
    return matches;
}

function scoreSelectionCandidate(fullMessage, candidate, selectedVisibleText, visibleBefore, visibleAfter, predictedStart) {
    const rawSpan = fullMessage.slice(candidate.start, candidate.end);
    const selectedComparable = normalizeSelectionComparable(selectedVisibleText);
    const rawComparable = normalizeSelectionComparable(stripRawFormattingForComparison(rawSpan));
    if (!selectedComparable || !rawComparable) return 0;

    let score = 0;
    if (rawComparable === selectedComparable) score += 120;
    else if (rawComparable.includes(selectedComparable) || selectedComparable.includes(rawComparable)) score += 80;
    else return 0;

    const rawBefore = normalizeSelectionComparable(stripRawFormattingForComparison(fullMessage.slice(Math.max(0, candidate.start - 160), candidate.start)));
    const rawAfter = normalizeSelectionComparable(stripRawFormattingForComparison(fullMessage.slice(candidate.end, Math.min(fullMessage.length, candidate.end + 160))));
    const beforeComparable = normalizeSelectionComparable(visibleBefore);
    const afterComparable = normalizeSelectionComparable(visibleAfter);
    score += Math.min(80, commonSuffixLength(rawBefore, beforeComparable) * 4);
    score += Math.min(80, commonPrefixLength(rawAfter, afterComparable) * 4);
    if (candidate.source === 'exact') score += 20;
    score -= Math.min(50, Math.abs(candidate.start - predictedStart) * 0.05);
    return score;
}

function expandMarkdownSelection(fullMessage, start, end) {
    let rawStartOffset = start;
    let rawEndOffset = end;

    if (
        rawStartOffset > 1 &&
        rawEndOffset < fullMessage.length - 1 &&
        fullMessage.substring(rawStartOffset - 2, rawStartOffset) === '**' &&
        fullMessage.substring(rawEndOffset, rawEndOffset + 2) === '**'
    ) {
        const prevChar = rawStartOffset > 2 ? fullMessage[rawStartOffset - 3] : null;
        const nextChar = rawEndOffset + 2 < fullMessage.length ? fullMessage[rawEndOffset + 2] : null;
        if (prevChar !== '*' && nextChar !== '*') {
            rawStartOffset -= 2;
            rawEndOffset += 2;
        }
    } else if (rawStartOffset > 0 && rawEndOffset < fullMessage.length && fullMessage[rawStartOffset - 1] === '*' && fullMessage[rawEndOffset] === '*') {
        const prevChar = rawStartOffset > 1 ? fullMessage[rawStartOffset - 2] : null;
        const nextChar = rawEndOffset + 1 < fullMessage.length ? fullMessage[rawEndOffset + 1] : null;
        if (prevChar !== '*' && nextChar !== '*') {
            rawStartOffset--;
            rawEndOffset++;
        }
    }

    return { start: rawStartOffset, end: rawEndOffset };
}

function normalizeSelectionComparable(text) {
    return String(text || '')
        .replace(/\u2026/g, '...')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripRawFormattingForComparison(text) {
    return String(text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_~`]/g, '');
}

function commonPrefixLength(a, b) {
    const max = Math.min(a.length, b.length);
    let index = 0;
    while (index < max && a[index] === b[index]) index++;
    return index;
}

function commonSuffixLength(a, b) {
    const max = Math.min(a.length, b.length);
    let count = 0;
    while (count < max && a[a.length - 1 - count] === b[b.length - 1 - count]) count++;
    return count;
}

function createTextMapping(rawText, formattedText) {
    const mapping = [];
    let rawIndex = 0;
    let formattedIndex = 0;
    while (rawIndex < rawText.length && formattedIndex < formattedText.length) {
        if (rawText[rawIndex] === formattedText[formattedIndex]) {
            mapping.push([rawIndex, formattedIndex]);
            rawIndex++;
            formattedIndex++;
        } else if (rawText.substring(rawIndex, rawIndex + 3) === '...' && formattedText[formattedIndex] === '\u2026') {
            mapping.push([rawIndex, formattedIndex]);
            mapping.push([rawIndex + 1, formattedIndex]);
            mapping.push([rawIndex + 2, formattedIndex]);
            rawIndex += 3;
            formattedIndex++;
        } else if (/\s/.test(formattedText[formattedIndex])) {
            formattedIndex++;
        } else {
            rawIndex++;
        }
    }
    if (!mapping.length) mapping.push([0, 0]);
    return {
        formattedToRaw(formattedOffset) {
            let low = 0;
            let high = mapping.length - 1;
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                if (mapping[mid][1] === formattedOffset) return mapping[mid][0];
                if (mapping[mid][1] < formattedOffset) low = mid + 1;
                else high = mid - 1;
            }
            const index = Math.max(0, Math.min(mapping.length - 1, low - 1));
            return mapping[index][0] + Math.max(0, formattedOffset - mapping[index][1]);
        },
    };
}

function getRenderedRangeText(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.toString();
}

function getRangeTextOffset(parent, range, boundary) {
    const preRange = document.createRange();
    preRange.selectNodeContents(parent);
    if (boundary === 'end') {
        preRange.setEnd(range.endContainer, range.endOffset);
    } else {
        preRange.setEnd(range.startContainer, range.startOffset);
    }
    return preRange.toString().length;
}

function findClosestMesText(element) {
    let node = element;
    while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
    return node?.closest?.('.mes_text') || null;
}

function findMessageDiv(element) {
    return element?.closest?.('.mes[mesid]') || element?.closest?.('[mesid]');
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
}

export async function initNemoRewrite() {
    if (initialized) return;
    initialized = true;
    try {
        getSettings();
        ensureFeatureStyles();
        await ensureSettingsUi();
        await populatePresetDropdowns();
        bindSettingsUi();
        syncSettingsToUi();

        addDomListener(document, 'selectionchange', handleSelectionChange);
        addDomListener(document, 'mousedown', hideMenuOnOutsideClick);
        addDomListener(document, 'touchstart', hideMenuOnOutsideClick);
        const chat = document.getElementById('chat');
        if (chat) addDomListener(chat, 'scroll', positionMenu);
        $('#mes_stop').on('click.nemoRewrite', handleStopRewrite);
        registerEventHandler(event_types.CHAT_CHANGED, () => {
            changeHistory = [];
            updateUndoButtons();
        });
        registerEventHandler(event_types.MESSAGE_EDITED, removeUndoButton);

        window.NemoRewrite = {
            getSettings,
            isStandaloneRewriteDetected,
            isNativeMenuSuppressed,
            cleanup: cleanupNemoRewrite,
        };
        logger.info('Nemo Rewrite initialized');
    } catch (error) {
        initialized = false;
        removeAllHandlers();
        throw error;
    }
}

export function cleanupNemoRewrite() {
    clearTimeout(selectionTimer);
    removeAllHandlers();
    removeRewriteMenu();
    document.querySelectorAll(`.${UNDO_BUTTON_CLASS}`).forEach(button => button.remove());
    document.getElementById(SETTINGS_ROOT_ID)?.remove();
    document.getElementById(STYLE_LINK_ID)?.remove();
    if (window.NemoRewrite?.cleanup === cleanupNemoRewrite) delete window.NemoRewrite;
    initialized = false;
}
