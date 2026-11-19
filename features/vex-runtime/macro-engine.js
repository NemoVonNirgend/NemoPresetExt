const RECOVERY = 'Vex requires SillyTavern\'s Experimental Macro Engine. Enable "Experimental Macro Engine" in User Settings, then fully reload SillyTavern and retry. If the option is missing, update SillyTavern first.';

// Exercise nested and scoped conditionals without reading or writing chat
// variables. The legacy regex engine leaves this source unevaluated.
const PROBE = '{{#if 1}}{{#if 0}}unsupported{{else}}nemo-vex-native-ready{{/if}}{{/if}}';

export const MACRO_ENGINE_ERROR = 'NEMO_VEX_MACRO_ENGINE';
function incompatible() {
    return Object.assign(new Error(RECOVERY), { code: MACRO_ENGINE_ERROR });
}

export function nativeNemoMacrosWork(context) {
    if (typeof context?.substituteParams !== 'function') return false;
    try { return context.substituteParams(PROBE) === 'nemo-vex-native-ready'; }
    catch { return false; }
}

export function requireNativeVexMacros(context) {
    if (context?.powerUserSettings?.experimental_macro_engine === false) throw incompatible();
    if (typeof context?.substituteParams === 'function') {
        if (!nativeNemoMacrosWork(context)) throw incompatible();
    } else if (context?.powerUserSettings?.experimental_macro_engine !== true) {
        throw incompatible();
    }
}
