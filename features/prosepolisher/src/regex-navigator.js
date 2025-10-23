
import { callGenericPopup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../../scripts/extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';
import { state } from './state.js';
import { EXTENSION_NAME, PROSE_POLISHER_ID_PREFIX } from './constants.js';
import { updateGlobalRegexArray } from './global-regex-integration.js';

const LOG_PREFIX = `[ProsePolisher:RegexNavigator]`;

export class RegexNavigator {
    constructor() {}
    async open() {
        if (!state.isAppReady) { window.toastr.info("SillyTavern is still loading, please wait."); return; }
        state.dynamicRules.forEach(rule => delete rule.isNew);
        const container = document.createElement('div');
        container.className = 'prose-polisher-navigator-content';
        container.id = 'prose-polisher-navigator-content-id';
        container.innerHTML = `
            <div class="modal-header"><h2>Regex Rule Navigator</h2></div>
            <div class="navigator-body"><div class="navigator-main-panel"><div id="regex-navigator-list-view"></div></div></div>
            <div class="modal-footer"><button id="prose-polisher-new-rule-btn" class="menu_button"><i class="fa-solid fa-plus"></i> New Dynamic Rule</button></div>`;
        this.renderRuleList(container);
        container.querySelector('#prose-polisher-new-rule-btn').addEventListener('pointerup', () => this.openRuleEditor(null));
        callGenericPopup(container, POPUP_TYPE.DISPLAY, 'Regex Rule Navigator', { wide: true, large: true, addCloseButton: true });
    }
    renderRuleList(container = null) {
        if (!state.isAppReady) return;
        const modalContent = container || document.getElementById('prose-polisher-navigator-content-id');
        if (!modalContent) return;
        const listView = modalContent.querySelector('#regex-navigator-list-view');
        listView.innerHTML = '';
        const allRules = [...state.staticRules, ...state.dynamicRules.sort((a,b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || (a.scriptName.localeCompare(b.scriptName)))];
        if (allRules.length === 0) {
            listView.innerHTML = "<p style='text-align:center; padding:20px;'>No rules defined.</p>";
            return;
        }
        for (const rule of allRules) {
            const item = document.createElement('div');
            item.className = 'regex-navigator-item';
            item.classList.toggle('is-dynamic', !rule.isStatic);
            item.classList.toggle('is-disabled', rule.disabled);
            item.classList.toggle('is-newly-added', !!rule.isNew);
            const ruleId = rule.id || (rule.scriptName ? PROSE_POLISHER_ID_PREFIX + rule.scriptName.replace(/\s+/g, '_') : PROSE_POLISHER_ID_PREFIX + `rule_${Date.now()}`);
            item.dataset.id = ruleId;
            if (!rule.id) rule.id = ruleId; 
            const ruleTypeText = rule.isStatic ? 'Static' : 'Dynamic';
            const toggleTitle = rule.disabled ? 'Enable Rule' : 'Disable Rule';
            const statusIcon = rule.disabled ? 'fa-toggle-off' : 'fa-toggle-on';

            item.innerHTML = `
                <div class="rule-header">
                    <div class="rule-title">${rule.scriptName || '(No Name)'}</div>
                    <div class="rule-badges">
                        <span class="rule-badge ${rule.isStatic ? 'static' : 'dynamic'}">${ruleTypeText}</span>
                        ${rule.disabled ? '<span class="rule-badge disabled">Disabled</span>' : ''}
                    </div>
                </div>
                <div class="rule-content">
                    <div class="rule-regex">${rule.findRegex}</div>
                    ${rule.replaceString ? `<div class="rule-description">Replaces with: ${rule.replaceString.length > 100 ? rule.replaceString.substring(0, 100) + '...' : rule.replaceString}</div>` : ''}
                </div>
                <div class="rule-actions">
                    <button class="rule-action-btn status-toggle-icon" title="${toggleTitle}">
                        <i class="fa-solid ${statusIcon}"></i> ${rule.disabled ? 'Enable' : 'Disable'}
                    </button>
                    <button class="rule-action-btn edit-rule-btn" title="Edit Rule">
                        <i class="fa-solid fa-edit"></i> Edit
                    </button>
                </div>
            `;
            item.addEventListener('pointerup', (e) => {
                const currentRuleId = item.dataset.id;
                if (e.target.closest('.status-toggle-icon')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggleRuleStatus(currentRuleId);
                } else if (e.target.closest('.edit-rule-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openRuleEditor(currentRuleId);
                }
            });
            listView.appendChild(item);
        }
    }
    async toggleRuleStatus(ruleId) {
        if (!state.isAppReady) { console.warn(`${LOG_PREFIX} toggleRuleStatus called before app ready.`); return; }
        let rule = state.dynamicRules.find(r => r.id === ruleId);
        if (!rule) rule = state.staticRules.find(r => r.id === ruleId);
        if (rule) {
            rule.disabled = !rule.disabled;
            if (!rule.isStatic) {
                extension_settings[EXTENSION_NAME].dynamicRules = state.dynamicRules;
                saveSettingsDebounced();
            }
            this.renderRuleList();
            await updateGlobalRegexArray();
            window.toastr.success(`Rule "${rule.scriptName}" ${rule.disabled ? 'disabled' : 'enabled'}.`);
        } else {
            console.warn(`${LOG_PREFIX} Rule with ID ${ruleId} not found for toggling.`);
        }
    }
    async openRuleEditor(ruleId) {
        if (!state.isAppReady) { window.toastr.info("SillyTavern is still loading, please wait."); return; }
        const isNew = ruleId === null;
        let rule;
        if (isNew) {
            rule = {
                id: `DYN_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                scriptName: '',
                findRegex: '',
                replaceString: '',
                disabled: false,
                isStatic: false,
                isNew: true,
                // SillyTavern regex settings
                placement: [0, 2, 3, 5, 6], // Default: affects AI output, slash commands, world info, reasoning
                trimStrings: [],
                minDepth: null,
                maxDepth: null,
                substituteRegex: 0, // 0=none, 1=raw, 2=escaped
                runOnEdit: false,
                markdownOnly: false,
                promptOnly: false
            };
        } else {
            rule = state.dynamicRules.find(r => r.id === ruleId) || state.staticRules.find(r => r.id === ruleId);
        }
        if (!rule) { console.error(`${LOG_PREFIX} Rule not found for editing: ${ruleId}`); return; }

        // Ensure all settings exist with defaults
        if (!rule.placement) rule.placement = [0, 2, 3, 5, 6];
        if (!rule.trimStrings) rule.trimStrings = [];
        if (rule.minDepth === undefined) rule.minDepth = null;
        if (rule.maxDepth === undefined) rule.maxDepth = null;
        if (rule.substituteRegex === undefined) rule.substituteRegex = 0;
        if (rule.runOnEdit === undefined) rule.runOnEdit = false;
        if (rule.markdownOnly === undefined) rule.markdownOnly = false;
        if (rule.promptOnly === undefined) rule.promptOnly = false;

        const editorContent = document.createElement('div');
        editorContent.className = 'prose-polisher-rule-editor-popup';
        editorContent.dataset.ruleId = rule.id;
        editorContent.innerHTML = `
            <div class="flex-container flexFlowColumn">
                <div class="flex1">
                    <label for="pp_editor_name">Rule Name</label>
                    <input type="text" id="pp_editor_name" class="text_pole" value="${rule.scriptName?.replace(/"/g, '"') || ''}" ${rule.isStatic ? 'disabled' : ''}>
                </div>
                <div class="flex1">
                    <label for="pp_editor_find">Find Regex (JavaScript format)</label>
                    <textarea id="pp_editor_find" class="text_pole" rows="3" ${rule.isStatic ? 'disabled' : ''}>${rule.findRegex || ''}</textarea>
                </div>
                <div class="flex1">
                    <label for="pp_editor_replace">Replace String (use {{random:opt1,opt2}} for variants)</label>
                    <textarea id="pp_editor_replace" class="text_pole" rows="3" ${rule.isStatic ? 'disabled' : ''}>${rule.replaceString || ''}</textarea>
                </div>
                <div class="flex1">
                    <label for="pp_editor_trim">Trim Strings (one per line)</label>
                    <textarea id="pp_editor_trim" class="text_pole" rows="2" placeholder="Strings to remove from matches before replacement" ${rule.isStatic ? 'disabled' : ''}>${rule.trimStrings?.join('\n') || ''}</textarea>
                </div>
            </div>

            <div class="flex-container marginTop10">
                <div class="flex1">
                    <label class="title_restorable"><small>Affects</small></label>
                    <div class="flex-container flexFlowColumn">
                        <label class="checkbox"><input type="checkbox" id="pp_placement_1" value="1" ${rule.placement?.includes(1) ? 'checked' : ''} ${rule.isStatic ? 'disabled' : ''}><span>User Input</span></label>
                        <label class="checkbox"><input type="checkbox" id="pp_placement_2" value="2" ${rule.placement?.includes(2) ? 'checked' : ''} ${rule.isStatic ? 'disabled' : ''}><span>AI Output</span></label>
                        <label class="checkbox"><input type="checkbox" id="pp_placement_3" value="3" ${rule.placement?.includes(3) ? 'checked' : ''} ${rule.isStatic ? 'disabled' : ''}><span>Slash Commands</span></label>
                        <label class="checkbox"><input type="checkbox" id="pp_placement_5" value="5" ${rule.placement?.includes(5) ? 'checked' : ''} ${rule.isStatic ? 'disabled' : ''}><span>World Info</span></label>
                        <label class="checkbox"><input type="checkbox" id="pp_placement_6" value="6" ${rule.placement?.includes(6) ? 'checked' : ''} ${rule.isStatic ? 'disabled' : ''}><span>Reasoning</span></label>
                    </div>
                </div>
                <div class="flex1">
                    <label class="title_restorable"><small>Options</small></label>
                    <div class="flex-container flexFlowColumn">
                        <label class="checkbox"><input type="checkbox" id="pp_editor_disabled" ${rule.disabled ? 'checked' : ''}><span>Disabled</span></label>
                        <label class="checkbox"><input type="checkbox" id="pp_editor_runOnEdit" ${rule.runOnEdit ? 'checked' : ''} ${rule.isStatic ? 'disabled' : ''}><span>Run On Edit</span></label>
                        <label class="checkbox"><input type="checkbox" id="pp_editor_markdownOnly" ${rule.markdownOnly ? 'checked' : ''} ${rule.isStatic ? 'disabled' : ''}><span>Markdown Only</span></label>
                        <label class="checkbox"><input type="checkbox" id="pp_editor_promptOnly" ${rule.promptOnly ? 'checked' : ''} ${rule.isStatic ? 'disabled' : ''}><span>Prompt Only</span></label>
                    </div>
                </div>
            </div>

            <div class="flex-container marginTop10">
                <div class="flex1">
                    <label for="pp_editor_minDepth"><small>Min Depth</small></label>
                    <input type="number" id="pp_editor_minDepth" class="text_pole" min="-1" max="9999" placeholder="Unlimited" value="${rule.minDepth !== null ? rule.minDepth : ''}" ${rule.isStatic ? 'disabled' : ''}>
                </div>
                <div class="flex1">
                    <label for="pp_editor_maxDepth"><small>Max Depth</small></label>
                    <input type="number" id="pp_editor_maxDepth" class="text_pole" min="0" max="9999" placeholder="Unlimited" value="${rule.maxDepth !== null ? rule.maxDepth : ''}" ${rule.isStatic ? 'disabled' : ''}>
                </div>
                <div class="flex1">
                    <label for="pp_editor_substitute"><small>Macros in Find Regex</small></label>
                    <select id="pp_editor_substitute" class="text_pole" ${rule.isStatic ? 'disabled' : ''}>
                        <option value="0" ${rule.substituteRegex === 0 ? 'selected' : ''}>Don't substitute</option>
                        <option value="1" ${rule.substituteRegex === 1 ? 'selected' : ''}>Substitute (raw)</option>
                        <option value="2" ${rule.substituteRegex === 2 ? 'selected' : ''}>Substitute (escaped)</option>
                    </select>
                </div>
            </div>

            <div class="editor-actions marginTop10">
                ${!rule.isStatic ? '<button id="pp_editor_delete" class="menu_button is_dangerous">Delete Rule</button>' : ''}
            </div>`;
        const deleteBtn = editorContent.querySelector('#pp_editor_delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('pointerup', async (e) => {
                e.stopPropagation();
                const editorPopup = deleteBtn.closest('.popup_confirm');
                if (await callGenericPopup('Are you sure you want to to delete this rule?', POPUP_TYPE.CONFIRM)) {
                    await this.handleDelete(rule.id);
                    editorPopup?.querySelector('.popup-button-cancel')?.click();
                }
            });
        }
        if (await callGenericPopup(editorContent, POPUP_TYPE.CONFIRM, isNew ? 'Create New Rule' : 'Edit Rule', { wide: true, large: true })) {
            const nameInput = editorContent.querySelector('#pp_editor_name');
            const findInput = editorContent.querySelector('#pp_editor_find');
            const replaceInput = editorContent.querySelector('#pp_editor_replace');
            const trimInput = editorContent.querySelector('#pp_editor_trim');
            const disabledInput = editorContent.querySelector('#pp_editor_disabled');
            const runOnEditInput = editorContent.querySelector('#pp_editor_runOnEdit');
            const markdownOnlyInput = editorContent.querySelector('#pp_editor_markdownOnly');
            const promptOnlyInput = editorContent.querySelector('#pp_editor_promptOnly');
            const minDepthInput = editorContent.querySelector('#pp_editor_minDepth');
            const maxDepthInput = editorContent.querySelector('#pp_editor_maxDepth');
            const substituteInput = editorContent.querySelector('#pp_editor_substitute');

            // Get placement checkboxes
            const placementInputs = editorContent.querySelectorAll('[id^="pp_placement_"]:checked');
            const placement = Array.from(placementInputs).map(input => parseInt(input.value));

            rule.disabled = disabledInput.checked;

            if (!rule.isStatic) {
                if (!nameInput.value.trim() || !findInput.value.trim()) {
                    window.toastr.error("Rule Name and Find Regex cannot be empty.");
                    this.openRuleEditor(rule.id);
                    return;
                }

                if (placement.length === 0) {
                    window.toastr.error("At least one 'Affects' option must be selected.");
                    this.openRuleEditor(rule.id);
                    return;
                }

                try { new RegExp(findInput.value); } catch (e) {
                    window.toastr.error(`Invalid Regex: ${e.message}`);
                    this.openRuleEditor(rule.id);
                    return;
                }

                rule.scriptName = nameInput.value;
                rule.findRegex = findInput.value;
                rule.replaceString = replaceInput.value;
                rule.trimStrings = trimInput.value.split('\n').filter(s => s.trim()).map(s => s.trim());
                rule.placement = placement;
                rule.runOnEdit = runOnEditInput.checked;
                rule.markdownOnly = markdownOnlyInput.checked;
                rule.promptOnly = promptOnlyInput.checked;
                rule.minDepth = minDepthInput.value ? parseInt(minDepthInput.value) : null;
                rule.maxDepth = maxDepthInput.value ? parseInt(maxDepthInput.value) : null;
                rule.substituteRegex = parseInt(substituteInput.value);
            }
            if (isNew && !rule.isStatic) state.dynamicRules.push(rule);
            
            if (!rule.isStatic) {
                 extension_settings[EXTENSION_NAME].dynamicRules = state.dynamicRules;
                 saveSettingsDebounced();
            }
            this.renderRuleList();
            await updateGlobalRegexArray();
            window.toastr.success(isNew ? "New rule created." : "Rule updated.");
            state.uiManager.showReloadPrompt();
        }
    }
    async handleDelete(ruleId) {
        if (!state.isAppReady) { console.warn(`${LOG_PREFIX} handleDelete called before app ready.`); return; }
        const index = state.dynamicRules.findIndex(r => r.id === ruleId);
        if (index !== -1) {
            state.dynamicRules.splice(index, 1);
            extension_settings[EXTENSION_NAME].dynamicRules = state.dynamicRules;
            saveSettingsDebounced();
            this.renderRuleList();
            await updateGlobalRegexArray();
            window.toastr.success("Dynamic rule deleted.");
            state.uiManager.showReloadPrompt();
        } else {
            console.warn(`${LOG_PREFIX} Dynamic rule with ID ${ruleId} not found for deletion.`);
        }
    }
}
