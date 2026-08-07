import { saveSettings, saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { NEMO_EXTENSION_NAME, ensureSettingsNamespace, getExtensionPath } from '../core/utils.js';
import { applyPromptUiMode } from '../features/prompts/ui-mode.js';
import { validateDividerPatterns } from '../core/divider-patterns.js';
import logger from '../core/logger.js';
import { NemoExtensionHub } from '../features/hub/hub-ui.js';

export const NemoSettingsUI = {
    _settingsObserver: null,
    _fetchController: null,
    _mounting: false,
    _pageHiding: false,
    _pageHideHandler: null,

    _getNativeSettingsHost() {
        let host = document.getElementById('nemo-preset-ext-settings-host');
        if (host) return host;
        const container = document.getElementById('extensions_settings') ?? document.getElementById('extensions_settings2');
        if (!container) return null;
        host = document.createElement('div');
        host.id = 'nemo-preset-ext-settings-host';
        host.className = 'extension_container nemo-settings-host wide100p';
        host.dataset.extensionName = 'NemoPresetExt';
        container.appendChild(host);
        return host;
    },

    async _mount() {
        const host = this._getNativeSettingsHost();
        if (!host || this._mounting || document.getElementById('nemo-preset-ext-settings')) return false;
        this._mounting = true;
        ensureSettingsNamespace();
        try {
            this._fetchController?.abort();
            this._fetchController = new AbortController();
            const response = await fetch(`/${getExtensionPath('settings.html')}`, {
                cache: 'no-store',
                signal: this._fetchController.signal,
            });
            if (!response.ok) throw new Error(`Settings request failed (${response.status}).`);
            const html = await response.text();
            if (!html.trim()) throw new Error('Settings document was empty.');
            host.innerHTML = html;
            this._bindCoreSettings();
            NemoExtensionHub.mount();
            return true;
        } catch (error) {
            if (error.name !== 'AbortError' && !this._pageHiding) logger.error('Core settings failed to mount', error);
            return false;
        } finally {
            this._mounting = false;
        }
    },

    _persist() {
        saveSettingsDebounced();
        void saveSettings();
    },

    _bindCoreSettings() {
        const settings = extension_settings[NEMO_EXTENSION_NAME];
        const dividerInput = document.getElementById('nemoDividerRegexPattern');
        const dividerStatus = document.getElementById('nemoRegexStatus');
        if (dividerInput) dividerInput.value = settings.dividerRegexPattern ?? '';
        document.getElementById('nemoSaveRegexSettings')?.addEventListener('click', async () => {
            try {
                settings.dividerRegexPattern = dividerInput?.value.trim() ?? '';
                validateDividerPatterns();
                saveSettingsDebounced();
                await saveSettings();
                await window.NemoPromptManager?.organizePrompts?.();
                if (dividerStatus) {
                    dividerStatus.textContent = 'Saved.';
                    dividerStatus.dataset.state = 'success';
                }
            } catch (error) {
                if (dividerStatus) {
                    dividerStatus.textContent = `Invalid pattern: ${error.message}`;
                    dividerStatus.dataset.state = 'error';
                }
            }
        });

        for (const [id, key] of [
            ['nemoEnablePromptManager', 'enablePromptManager'],
            ['nemoEnablePresetNavigator', 'enablePresetNavigator'],
            ['nemoEnableCharacterNavigator', 'enableCharacterNavigator'],
            ['nemoEnableReasoningCapture', 'enableReasoningCapture'],
            ['nemoEnableReasoningSection', 'enableReasoningSection'],
            ['nemoEnableDirectives', 'enableDirectives'],
            ['nemoEnableDirectiveAutocomplete', 'enableDirectiveAutocomplete'],
            ['nemoEnableNemoEngineInstaller', 'enableNemoEngineInstaller'],
        ]) {
            const input = document.getElementById(id);
            if (!input) continue;
            input.checked = settings[key] === true;
            input.addEventListener('change', () => {
                settings[key] = input.checked;
                this._persist();
            });
        }

        const promptUiMode = document.getElementById('nemoPromptUiMode');
        if (promptUiMode) {
            promptUiMode.value = settings.promptUiMode;
            promptUiMode.addEventListener('change', () => {
                settings.promptUiMode = promptUiMode.value;
                applyPromptUiMode(settings);
                this._persist();
            });
        }

        const directivesToggle = document.getElementById('nemoEnableDirectives');
        const directiveAutocompleteToggle = document.getElementById('nemoEnableDirectiveAutocomplete');
        const promptManagerToggle = document.getElementById('nemoEnablePromptManager');
        const modeSelect = document.getElementById('nemoPromptUiMode');
        const syncDependencies = () => {
            if (directivesToggle && directiveAutocompleteToggle) {
                const enabled = directivesToggle.checked;
                directiveAutocompleteToggle.disabled = !enabled;
                directiveAutocompleteToggle.setAttribute('aria-disabled', String(!enabled));
            }
            if (promptManagerToggle && modeSelect) {
                const enabled = promptManagerToggle.checked;
                modeSelect.disabled = !enabled;
                modeSelect.setAttribute('aria-disabled', String(!enabled));
            }
        };
        directivesToggle?.addEventListener('change', syncDependencies);
        promptManagerToggle?.addEventListener('change', syncDependencies);
        syncDependencies();
    },

    async initialize() {
        this._pageHiding = false;
        this._pageHideHandler ||= () => {
            this._pageHiding = true;
            this._fetchController?.abort();
        };
        window.addEventListener('pagehide', this._pageHideHandler);
        await this._mount();
        if (!this._settingsObserver) {
            this._settingsObserver = new MutationObserver(() => {
                if (!document.getElementById('nemo-preset-ext-settings')) void this._mount();
            });
            this._settingsObserver.observe(document.body, { childList: true, subtree: true });
        }
    },

    destroy() {
        this._settingsObserver?.disconnect();
        this._settingsObserver = null;
        this._fetchController?.abort();
        this._fetchController = null;
        if (this._pageHideHandler) window.removeEventListener('pagehide', this._pageHideHandler);
        document.getElementById('nemo-preset-ext-settings-host')?.remove();
    },
};
