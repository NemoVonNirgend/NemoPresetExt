import { isNemoPreset } from './format.js';
import { PromptPreparationError } from './diagnostics.js';
import { nativeNemoMacrosWork } from '../vex-runtime/macro-engine.js';

const RELOAD = 'Nemo Engine enabled SillyTavern’s Experimental Macro Engine. Finish any preset import, then reload SillyTavern once before generating.';

export function createNemoMacroSetup({ getContext, getCheckbox, notify }) {
    let needsReload = false, lastNotice = null;

    function checkConfigured(context) {
        const settings = context?.powerUserSettings;
        if (settings?.experimental_macro_engine === false) {
            throw new PromptPreparationError('MACRO_ENGINE_SETTING', 'Experimental Macro Engine is off in SillyTavern User Settings.');
        }
        if (needsReload) throw new PromptPreparationError('MACRO_ENGINE_RELOAD', RELOAD);
        if (nativeNemoMacrosWork(context)) return;
        if (settings?.experimental_macro_engine === true) {
            throw new PromptPreparationError('MACRO_ENGINE_PROBE', 'Experimental Macro Engine is enabled, but SillyTavern could not evaluate a nested conditional. Reload SillyTavern and retry.');
        }
        throw new PromptPreparationError('MACRO_ENGINE_UNAVAILABLE', 'This SillyTavern build could not evaluate Nemo Engine macros. Update SillyTavern and reload.');
    }
    function getStatus() {
        try {
            checkConfigured(getContext());
            return { ready: true, message: 'SillyTavern evaluated a nested conditional successfully.' };
        } catch (error) {
            return { ready: false, message: error.message };
        }
    }

    function verify(preset) {
        if (!Array.isArray(preset?.prompts) || !isNemoPreset(preset)) return;
        const context = getContext();
        const settings = context?.powerUserSettings;
        if (settings?.experimental_macro_engine === false) {
            const checkbox = getCheckbox();
            // Follow ST's own onboarding path. Its input listener saves the setting and
            // offers a reload only after the server confirms the settings update.
            if (checkbox) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (settings.experimental_macro_engine === false) {
                // Some compatible hosts expose the setting and save API without the UI.
                if (typeof context.saveSettingsDebounced !== 'function') {
                    if (checkbox) checkbox.checked = false;
                    throw new PromptPreparationError('MACRO_ENGINE_SETTING', 'Enable Experimental Macro Engine in SillyTavern User Settings, then reload.');
                }
                settings.experimental_macro_engine = true;
                try { context.saveSettingsDebounced(); }
                catch {
                    settings.experimental_macro_engine = false;
                    if (checkbox) checkbox.checked = false;
                    throw new PromptPreparationError('MACRO_ENGINE_SETTING', 'SillyTavern could not save the Experimental Macro Engine setting. Enable it in User Settings and reload.');
                }
            }
            // ST initializes other extensions' macro registrations during startup.
            // A built-in conditional may already work before those macros are registered.
            needsReload = true;
        }
        checkConfigured(context);
    }

    // Setup must allow an import or preset selection to finish before the user reloads.
    function configure(preset) {
        try { verify(preset); }
        catch (error) {
            if (error.message !== lastNotice) {
                lastNotice = error.message;
                notify(error.message, 'warning');
            }
        }
    }
    return { configure, verify, getStatus };
}
