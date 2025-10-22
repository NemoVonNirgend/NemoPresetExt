import { state } from './state.js';
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';
import { EXTENSION_NAME, defaultSettings } from './constants.js';

export function initializeEventListeners() {
    const settings = extension_settings[EXTENSION_NAME];

    // Master Enable Toggle
    const enabledCheckbox = document.getElementById('prose_polisher_enabled');
    if (enabledCheckbox) {
        enabledCheckbox.addEventListener('change', (e) => {
            settings.enabled = e.target.checked;
            saveSettingsDebounced();
            window.toastr.info(`ProsePolisher ${settings.enabled ? 'enabled' : 'disabled'}.`);
        });
    }

    // Analysis Settings
    document.getElementById('prose_polisher_slop_threshold').addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value) && value >= 1) { settings.slopThreshold = value; saveSettingsDebounced(); }
    });
    document.getElementById('prose_polisher_leaderboard_update_cycle').addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 1) { settings.leaderboardUpdateCycle = value; saveSettingsDebounced(); }
    });
    document.getElementById('prose_polisher_pruning_cycle').addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 5) { settings.pruningCycle = value; saveSettingsDebounced(); }
    });
    document.getElementById('prose_polisher_ngram_max').addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 3 && value <= 20) { settings.ngramMax = value; saveSettingsDebounced(); }
    });
    document.getElementById('prose_polisher_pattern_min_common').addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 2 && value <= 10) { settings.patternMinCommon = value; saveSettingsDebounced(); }
    });

    // Revert to Defaults button
    document.getElementById('prose_polisher_revert_defaults_button').addEventListener('pointerup', () => {
        // Reset smart learning settings to defaults
        settings.slopThreshold = defaultSettings.slopThreshold;
        settings.leaderboardUpdateCycle = defaultSettings.leaderboardUpdateCycle;
        settings.pruningCycle = defaultSettings.pruningCycle;
        settings.ngramMax = defaultSettings.ngramMax;
        settings.patternMinCommon = defaultSettings.patternMinCommon;
        settings.dynamicTriggerCount = defaultSettings.dynamicTriggerCount;

        // Update UI elements to reflect the new values
        document.getElementById('prose_polisher_slop_threshold').value = settings.slopThreshold;
        document.getElementById('prose_polisher_leaderboard_update_cycle').value = settings.leaderboardUpdateCycle;
        document.getElementById('prose_polisher_pruning_cycle').value = settings.pruningCycle;
        document.getElementById('prose_polisher_ngram_max').value = settings.ngramMax;
        document.getElementById('prose_polisher_pattern_min_common').value = settings.patternMinCommon;
        document.getElementById('prose_polisher_dynamic_trigger').value = settings.dynamicTriggerCount;

        saveSettingsDebounced();
        window.toastr.success('Smart Learning settings reverted to optimized defaults.');
    });

    // Gremlin Settings
    document.getElementById('pp_gremlinPapaEnabled').addEventListener('change', (e) => { settings.gremlinPapaEnabled = e.target.checked; saveSettingsDebounced(); });
    document.getElementById('pp_gremlinTwinsEnabled').addEventListener('change', (e) => { settings.gremlinTwinsEnabled = e.target.checked; saveSettingsDebounced(); });
    document.getElementById('pp_gremlinMamaEnabled').addEventListener('change', (e) => { settings.gremlinMamaEnabled = e.target.checked; saveSettingsDebounced(); });
    document.getElementById('pp_gremlinAuditorEnabled').addEventListener('change', (e) => { settings.gremlinAuditorEnabled = e.target.checked; saveSettingsDebounced(); });
    document.getElementById('pp_gremlinTwinsIterations').addEventListener('change', (e) => {
        settings.gremlinTwinsIterations = parseInt(e.target.value, 10);
        saveSettingsDebounced();
    });

    // Chaos Mode
    document.getElementById('pp_gremlinWriterChaosModeEnabled').addEventListener('change', (e) => {
        settings.gremlinWriterChaosModeEnabled = e.target.checked;
        saveSettingsDebounced();
        window.toastr.info(`Writer Chaos Mode ${settings.gremlinWriterChaosModeEnabled ? 'enabled' : 'disabled'}.`);
    });
    document.getElementById('pp_configure_writer_chaos_btn').addEventListener('pointerup', () => state.uiManager.showWriterChaosConfigPopup());

    // Main Buttons
    const navigatorButton = document.getElementById('prose_polisher_open_navigator_button');
    console.log('[ProsePolisher] Navigator button element:', navigatorButton);
    if (!navigatorButton) {
        console.error('[ProsePolisher] prose_polisher_open_navigator_button element not found!');
        return;
    }

    // Add a simple click test
    navigatorButton.addEventListener('click', () => {
    });

    navigatorButton.addEventListener('pointerup', () => {
        try {
            if (!state.regexNavigator) {
                console.error('[ProsePolisher] regexNavigator is not initialized');
                window.toastr.error('Text Rules navigator not initialized');
                return;
            }
            console.log('[ProsePolisher] Opening text rules navigator');
            state.regexNavigator.open();
        } catch (error) {
            console.error('[ProsePolisher] Error opening text rules navigator:', error);
            window.toastr.error('Error opening text rules navigator');
        }
    });
    document.getElementById('prose_polisher_analyze_chat_button').addEventListener('pointerup', () => state.prosePolisherAnalyzer?.manualAnalyzeChatHistory());
    document.getElementById('prose_polisher_view_frequency_button').addEventListener('pointerup', () => state.uiManager.showFrequencyLeaderboard());
    document.getElementById('prose_polisher_generate_rules_button').addEventListener('pointerup', () => state.prosePolisherAnalyzer?.handleGenerateRulesFromAnalysisClick(state.dynamicRules, state.regexNavigator));
    document.getElementById('prose_polisher_manage_whitelist_button').addEventListener('pointerup', () => state.uiManager.showWhitelistManager());
    document.getElementById('prose_polisher_manage_blacklist_button').addEventListener('pointerup', () => state.uiManager.showBlacklistManager());
    document.getElementById('prose_polisher_clear_frequency_button').addEventListener('pointerup', () => state.prosePolisherAnalyzer?.clearFrequencyData());
    document.getElementById('prose_polisher_edit_regex_gen_prompt_button').addEventListener('pointerup', () => state.uiManager.showInstructionsEditorPopup('regexGen'));
}