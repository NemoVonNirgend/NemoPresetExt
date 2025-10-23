import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';
import { state } from './state.js';
import { regexManager } from './regex-manager.js';
import { EXTENSION_NAME, LOG_PREFIX, PROSE_POLISHER_ID_PREFIX } from './constants.js';
import { ErrorHandler } from './error-handler.js';

/**
 * Gets compiled regexes for active rules
 */
function getCompiledRegexes() {
    const settings = extension_settings[EXTENSION_NAME];
    const rulesToCompile = state.getActiveRules(settings);
    return regexManager.getCompiledRegexes(rulesToCompile);
}

/**
 * Updates SillyTavern's global regex array with ProsePolisher rules
 * This allows ProsePolisher rules to be used system-wide in SillyTavern
 */
export async function updateGlobalRegexArray() {
    return await ErrorHandler.withErrorHandling('updateGlobalRegexArray', async () => {
        const settings = extension_settings[EXTENSION_NAME];
        if (!state.isAppReady) {
            ErrorHandler.logWarning('updateGlobalRegexArray', 'Called before app ready. Skipping.');
            return;
        }

        // Always filter first to ensure a clean slate
        if (!extension_settings.regex) extension_settings.regex = [];
        extension_settings.regex = extension_settings.regex.filter(rule => !rule.id?.startsWith(PROSE_POLISHER_ID_PREFIX));

        // Add rules back only if ProsePolisher is enabled and integration is enabled
        if (settings.enabled && settings.integrateWithGlobalRegex) {
            const rulesToAdd = [];
            if (settings.isStaticEnabled) {
                rulesToAdd.push(...state.staticRules);
            }
            if (settings.isDynamicEnabled) {
                rulesToAdd.push(...state.dynamicRules);
            }

            const activeRulesForGlobal = rulesToAdd.filter(rule => !rule.disabled);

            for (const rule of activeRulesForGlobal) {
                // Create global rule using complete SillyTavern regex settings
                const globalRule = {
                    id: `${PROSE_POLISHER_ID_PREFIX}${rule.id || rule.scriptName.replace(/\s+/g, '_')}`,
                    scriptName: `(PP) ${rule.scriptName}`,
                    findRegex: rule.findRegex,
                    replaceString: rule.replaceString,
                    disabled: rule.disabled,
                    // Use rule's specific settings or fallback to defaults
                    substituteRegex: rule.substituteRegex ?? 0,
                    minDepth: rule.minDepth ?? null,
                    maxDepth: rule.maxDepth ?? null,
                    trimStrings: rule.trimStrings ?? [],
                    placement: rule.placement ?? [0, 2, 3, 5, 6],
                    runOnEdit: rule.runOnEdit ?? false,
                    markdownOnly: rule.markdownOnly ?? false,
                    promptOnly: rule.promptOnly ?? false,
                };
                extension_settings.regex.push(globalRule);
            }
            console.log(`${LOG_PREFIX} Updated global regex array. ProsePolisher rules active in global list: ${activeRulesForGlobal.length}.`);
        } else {
            console.log(`${LOG_PREFIX} Global regex integration is OFF. ProsePolisher rules removed from global list.`);
        }

        saveSettingsDebounced();

        // Clear regex cache since rules have changed
        regexManager.clearCache();

        // Update the analyzer's internal regex list
        if (state.prosePolisherAnalyzer) {
            state.prosePolisherAnalyzer.compiledRegexes = getCompiledRegexes();
        }
    }, { showUser: false });
}
