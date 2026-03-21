/**
 * Guided Generation Tools - Main Entry Point
 *
 * AI-driven guided generation via tool calls. Instead of manually toggling
 * auto-trigger guides, the AI model gets tool calls and autonomously decides
 * when to invoke scene analysis, response planning, and prose refinement.
 *
 * Architecture:
 *   index.js         - This file. Init, settings, event wiring.
 *   sidecar.js       - Shared sidecar LLM generation via STScript /gen.
 *   tool-registry.js - Registers/unregisters all tools with ToolManager.
 *   prompts.js       - Default prompt templates for all tools.
 *   tools/           - One file per tool (8 total).
 *   activity-feed.js - Floating widget showing real-time tool activity.
 */

import {
    eventSource,
    event_types,
    saveSettingsDebounced,
    setExtensionPrompt,
    extension_prompt_types,
    extension_prompt_roles,
} from '../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../extensions.js';
import {
    EXTENSION_NAME,
    ALL_TOOL_NAMES,
    getDefaultSettings,
    registerAllTools,
    unregisterAllTools,
} from './tool-registry.js';
import { initActivityFeed } from './activity-feed.js';
import { DEFAULT_SYSTEM_INSTRUCTION } from './prompts.js';
import { clearAllTrackers, ensureBookExists, buildTrackerStatusMessage } from './lorebook-manager.js';
import { autoGenerateRules } from './tools/rule-setup.js';
import { initDMNotes } from './tools/dm-notes.js';
import { buildWritingWarnings } from './writing-analyzer.js';
import { runPromptAdvisor, applyAllRecommendations, resetAdvisorState } from './prompt-advisor.js';
import { runFreshChatSetup } from './guides-setup.js';

const LOG_PREFIX = '[NemosGuides]';
const EXTENSION_FOLDER = 'third-party/NemoPresetExt/features/guides';
const PROMPT_KEY = 'ng_system_instruction';

/** Track the last chat ID to detect new chats. */
let lastChatId = null;

/**
 * Ensure extension settings exist with defaults.
 */
function loadSettings() {
    if (!extension_settings[EXTENSION_NAME]) {
        extension_settings[EXTENSION_NAME] = getDefaultSettings();
        saveSettingsDebounced();
    }

    // Ensure all tools have settings entries (handles upgrades when new tools are added)
    const defaults = getDefaultSettings();
    const settings = extension_settings[EXTENSION_NAME];
    if (!settings.tools) {
        settings.tools = defaults.tools;
    }
    for (const toolName of ALL_TOOL_NAMES) {
        if (!settings.tools[toolName]) {
            settings.tools[toolName] = defaults.tools[toolName];
        }
    }

    // Migration: fix stealth defaults from v0.1.0 where everything defaulted to stealth=true
    // Stealth=true prevents tool results from reaching the AI — only DM Notes should be stealth
    if (!settings._migratedStealthDefaults) {
        for (const toolName of ALL_TOOL_NAMES) {
            if (settings.tools[toolName]) {
                // Reset all to non-stealth except DM Notes
                settings.tools[toolName].stealth = (toolName === 'NG_dm_notes');
            }
        }
        settings._migratedStealthDefaults = true;
        saveSettingsDebounced();
        console.log(`${LOG_PREFIX} Migrated stealth defaults — tools will now return results to the AI.`);
    }

    // Ensure prompt advisor settings exist
    if (settings.autoAdvisor === undefined) {
        settings.autoAdvisor = false;
    }

    // Ensure writing analysis setting exists
    if (settings.writingAnalysis === undefined) {
        settings.writingAnalysis = true;
    }

    // Ensure auto-rules setting exists
    if (settings.autoGenerateRules === undefined) {
        settings.autoGenerateRules = true;
    }

    // Ensure lorebook settings exist
    if (settings.lorebookName === undefined) {
        settings.lorebookName = '';
    }

    // Ensure system instruction settings exist
    if (settings.systemInstruction === undefined) {
        settings.systemInstruction = '';
    }
    if (settings.injectSystemInstruction === undefined) {
        settings.injectSystemInstruction = true;
    }
    if (settings.instructionPosition === undefined) {
        settings.instructionPosition = 'in_chat';
    }
    if (settings.instructionDepth === undefined) {
        settings.instructionDepth = 1;
    }
    if (settings.instructionRole === undefined) {
        settings.instructionRole = 'system';
    }
}

/**
 * Update the settings UI to reflect current state.
 */
function updateSettingsUI() {
    const settings = extension_settings[EXTENSION_NAME];
    if (!settings) return;

    $('#ng_enabled').prop('checked', settings.enabled);
    $('#ng_lorebook_name').val(settings.lorebookName || '');
    $('#ng_auto_rules').prop('checked', settings.autoGenerateRules !== false);
    $('#ng_writing_analysis').prop('checked', settings.writingAnalysis !== false);
    $('#ng_auto_advisor').prop('checked', settings.autoAdvisor || false);
    $('#ng_inject_instruction').prop('checked', settings.injectSystemInstruction);
    $('#ng_instruction_position').val(settings.instructionPosition);
    $('#ng_instruction_depth').val(settings.instructionDepth);
    $('#ng_instruction_role').val(settings.instructionRole);
    $('#ng_system_instruction').val(settings.systemInstruction || '');

    for (const toolName of ALL_TOOL_NAMES) {
        const toolSettings = settings.tools[toolName];
        if (!toolSettings) continue;

        const section = $(`.ng-tool-section[data-tool="${toolName}"]`);
        if (!section.length) continue;

        section.find('.ng-tool-enabled').prop('checked', toolSettings.enabled);
        section.find('.ng-tool-stealth').prop('checked', toolSettings.stealth);
        section.find('.ng-tool-inject').prop('checked', toolSettings.injectResult || false);
        section.find('.ng-inject-options').toggle(!!toolSettings.injectResult);
        section.find('.ng-tool-inject-position').val(toolSettings.injectPosition || 'chat');
        section.find('.ng-tool-inject-depth').val(toolSettings.injectDepth ?? 1);
        section.find('.ng-tool-inject-ephemeral').prop('checked', toolSettings.injectEphemeral !== false);
        section.find('.ng-tool-preset').val(toolSettings.preset || '');
        section.find('.ng-tool-prompt').val(toolSettings.prompt || '');
    }
}

/**
 * Bind event handlers for settings UI elements.
 */
function bindSettingsEvents() {
    // Global enable toggle
    $('#ng_enabled').on('change', function () {
        const enabled = !!$(this).prop('checked');
        extension_settings[EXTENSION_NAME].enabled = enabled;
        saveSettingsDebounced();

        if (enabled) {
            // Activating: register tools, inject instruction, init activity feed
            registerAllTools();
            updateSystemInstruction();
            initActivityFeed();
            ensureBookExists().catch(err => console.error(`${LOG_PREFIX} Lorebook init failed:`, err));
        } else {
            // Deactivating: unregister tools, clear injected prompt
            unregisterAllTools();
            updateSystemInstruction(); // clears the prompt since enabled=false
        }
    });

    // Lorebook settings
    $('#ng_lorebook_name').on('input', function () {
        extension_settings[EXTENSION_NAME].lorebookName = $(this).val().trim();
        saveSettingsDebounced();
    });

    $('#ng_clear_trackers').on('click', async function () {
        await clearAllTrackers();
        toastr.info('All NG tracker entries cleared.', "Nemo's Guides");
    });

    // Rule Setup settings
    $('#ng_auto_rules').on('change', function () {
        extension_settings[EXTENSION_NAME].autoGenerateRules = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    // Prompt Advisor
    $('#ng_run_advisor').on('click', async function () {
        await runPromptAdvisor();
    });

    $('#ng_apply_recommendations').on('click', async function () {
        await applyAllRecommendations();
    });

    $('#ng_auto_advisor').on('change', function () {
        extension_settings[EXTENSION_NAME].autoAdvisor = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    // Writing analysis toggle
    $('#ng_writing_analysis').on('change', function () {
        extension_settings[EXTENSION_NAME].writingAnalysis = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#ng_generate_rules').on('click', async function () {
        toastr.info('Generating story rules...', "Nemo's Guides");
        try {
            await autoGenerateRules();
            toastr.success('Story rules generated and saved to lorebook.', "Nemo's Guides");
        } catch (error) {
            console.error(`${LOG_PREFIX} Rule generation failed:`, error);
            toastr.error('Failed to generate story rules. Check the console for details.', "Nemo's Guides");
        }
    });

    // System instruction settings
    $('#ng_inject_instruction').on('change', function () {
        extension_settings[EXTENSION_NAME].injectSystemInstruction = !!$(this).prop('checked');
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#ng_instruction_position').on('change', function () {
        extension_settings[EXTENSION_NAME].instructionPosition = $(this).val();
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#ng_instruction_depth').on('input', function () {
        extension_settings[EXTENSION_NAME].instructionDepth = parseInt($(this).val()) || 1;
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#ng_instruction_role').on('change', function () {
        extension_settings[EXTENSION_NAME].instructionRole = $(this).val();
        saveSettingsDebounced();
        updateSystemInstruction();
    });

    $('#ng_system_instruction').on('input', function () {
        extension_settings[EXTENSION_NAME].systemInstruction = $(this).val();
        saveSettingsDebounced();
    });

    $('#ng_reset_instruction').on('click', function () {
        extension_settings[EXTENSION_NAME].systemInstruction = '';
        $('#ng_system_instruction').val('');
        saveSettingsDebounced();
    });

    // Per-tool settings
    $('.ng-tool-section').each(function () {
        const section = $(this);
        const toolName = section.data('tool');
        if (!toolName) return;

        section.find('.ng-tool-enabled').on('change', function () {
            if (!extension_settings[EXTENSION_NAME]?.tools?.[toolName]) return;
            extension_settings[EXTENSION_NAME].tools[toolName].enabled = !!$(this).prop('checked');
            saveSettingsDebounced();
            registerAllTools();
        });

        section.find('.ng-tool-stealth').on('change', function () {
            if (!extension_settings[EXTENSION_NAME]?.tools?.[toolName]) return;
            extension_settings[EXTENSION_NAME].tools[toolName].stealth = !!$(this).prop('checked');
            saveSettingsDebounced();
            registerAllTools();
        });

        // Inject toggle + options visibility
        section.find('.ng-tool-inject').on('change', function () {
            if (!extension_settings[EXTENSION_NAME]?.tools?.[toolName]) return;
            const checked = !!$(this).prop('checked');
            extension_settings[EXTENSION_NAME].tools[toolName].injectResult = checked;
            section.find('.ng-inject-options').toggle(checked);
            saveSettingsDebounced();
        });

        section.find('.ng-tool-inject-position').on('change', function () {
            if (!extension_settings[EXTENSION_NAME]?.tools?.[toolName]) return;
            extension_settings[EXTENSION_NAME].tools[toolName].injectPosition = $(this).val();
            saveSettingsDebounced();
        });

        section.find('.ng-tool-inject-depth').on('input', function () {
            if (!extension_settings[EXTENSION_NAME]?.tools?.[toolName]) return;
            extension_settings[EXTENSION_NAME].tools[toolName].injectDepth = parseInt($(this).val()) || 1;
            saveSettingsDebounced();
        });

        section.find('.ng-tool-inject-ephemeral').on('change', function () {
            if (!extension_settings[EXTENSION_NAME]?.tools?.[toolName]) return;
            extension_settings[EXTENSION_NAME].tools[toolName].injectEphemeral = !!$(this).prop('checked');
            saveSettingsDebounced();
        });

        section.find('.ng-tool-preset').on('input', function () {
            if (!extension_settings[EXTENSION_NAME]?.tools?.[toolName]) return;
            extension_settings[EXTENSION_NAME].tools[toolName].preset = $(this).val().trim();
            saveSettingsDebounced();
        });

        section.find('.ng-tool-prompt').on('input', function () {
            if (!extension_settings[EXTENSION_NAME]?.tools?.[toolName]) return;
            extension_settings[EXTENSION_NAME].tools[toolName].prompt = $(this).val();
            saveSettingsDebounced();
        });

        section.find('.ng-reset-prompt').on('click', function () {
            if (!extension_settings[EXTENSION_NAME]?.tools?.[toolName]) return;
            extension_settings[EXTENSION_NAME].tools[toolName].prompt = '';
            section.find('.ng-tool-prompt').val('');
            saveSettingsDebounced();
        });
    });
}

/**
 * Map position setting string to extension_prompt_types enum.
 */
function mapPosition(val) {
    switch (val) {
        case 'in_prompt': return extension_prompt_types.IN_PROMPT;
        case 'before_prompt': return extension_prompt_types.BEFORE_PROMPT;
        case 'in_chat':
        default: return extension_prompt_types.IN_CHAT;
    }
}

/**
 * Map role setting string to extension_prompt_roles enum.
 */
function mapRole(val) {
    switch (val) {
        case 'user': return extension_prompt_roles.USER;
        case 'assistant': return extension_prompt_roles.ASSISTANT;
        case 'system':
        default: return extension_prompt_roles.SYSTEM;
    }
}

/**
 * Update the system instruction injection.
 * Called on settings change and generation start.
 */
function updateSystemInstruction() {
    const settings = extension_settings[EXTENSION_NAME];

    if (!settings?.enabled || !settings?.injectSystemInstruction) {
        setExtensionPrompt(PROMPT_KEY, '', extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
        return;
    }

    // Check if any tools are actually enabled
    const anyEnabled = ALL_TOOL_NAMES.some(name => settings.tools?.[name]?.enabled);
    if (!anyEnabled) {
        setExtensionPrompt(PROMPT_KEY, '', extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
        return;
    }

    const instruction = settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
    const position = mapPosition(settings.instructionPosition);
    const depth = settings.instructionDepth ?? 1;
    const role = mapRole(settings.instructionRole);

    setExtensionPrompt(PROMPT_KEY, instruction, position, depth, false, role);
}

/**
 * Handle generation start — inject system instruction with dynamic tracker status.
 */
async function onGenerationStarted(type, opts, dryRun) {
    if (dryRun) return;

    const settings = extension_settings[EXTENSION_NAME];
    if (!settings?.enabled || !settings?.injectSystemInstruction) {
        setExtensionPrompt(PROMPT_KEY, '', extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
        return;
    }

    const anyEnabled = ALL_TOOL_NAMES.some(name => settings.tools?.[name]?.enabled);
    if (!anyEnabled) {
        setExtensionPrompt(PROMPT_KEY, '', extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
        return;
    }

    // Build the instruction with dynamic tracker status and writing quality warnings
    const baseInstruction = settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
    const trackerStatus = await buildTrackerStatusMessage();
    const writingWarnings = buildWritingWarnings();
    const fullInstruction = baseInstruction + trackerStatus + writingWarnings;

    const position = mapPosition(settings.instructionPosition);
    const depth = settings.instructionDepth ?? 1;
    const role = mapRole(settings.instructionRole);

    setExtensionPrompt(PROMPT_KEY, fullInstruction, position, depth, false, role);
}

/**
 * Handle chat change — detect new chats and wipe trackers.
 */
async function onChatChanged() {
    const settings = extension_settings[EXTENSION_NAME];
    if (!settings?.enabled) return;

    const context = getContext();
    const currentChatId = context?.chatId || null;

    if (!currentChatId) return;

    // Detect new chat: chat ID changed AND chat has 0-1 messages (just greeting or empty)
    const isNewChat = currentChatId !== lastChatId;
    lastChatId = currentChatId;

    if (isNewChat) {
        // Reset advisor state so stale recommendations don't carry over
        resetAdvisorState();

        const chatLength = context.chat?.filter(m => !m.is_system)?.length || 0;
        if (chatLength <= 1) {
            console.log(`${LOG_PREFIX} New chat detected — wiping tracker entries.`);
            await clearAllTrackers();

            // Auto-run prompt advisor only on truly fresh chats
            const settings = extension_settings[EXTENSION_NAME];
            if (settings?.autoAdvisor) {
                setTimeout(() => {
                    runPromptAdvisor().catch(err => {
                        console.error(`${LOG_PREFIX} Auto prompt advisor failed:`, err);
                    });
                }, 2000);
            }
        }
    }
}

/**
 * Handle first user message — wipe trackers if this is the first real message.
 * This catches the case where the user sends the first message in a brand new chat.
 */
async function onFirstMessage() {
    const settings = extension_settings[EXTENSION_NAME];
    if (!settings?.enabled) return;

    const context = getContext();

    // Count non-system messages. If this is the first user message (greeting + 1 user msg = 2 total),
    // run parallel setup for a fresh start.
    const userMessages = context.chat?.filter(m => m.is_user && !m.is_system)?.length || 0;
    if (userMessages === 1) {
        console.log(`${LOG_PREFIX} First message in chat — running parallel fresh-chat setup.`);
        await clearAllTrackers();

        // Run Rule Setup + Scene Assessment + DM Notes in parallel via ConnectionPool
        // This populates all trackers BEFORE the main generation, so the AI sees them
        // in context and just writes its response normally (no tool calls needed).
        try {
            const success = await runFreshChatSetup();
            if (success) {
                console.log(`${LOG_PREFIX} Fresh-chat setup complete — trackers populated.`);
            } else {
                console.warn(`${LOG_PREFIX} Parallel setup unavailable — AI will use tool calls instead.`);
                // Fallback: initialize DM notes scratchpad at minimum
                initDMNotes().catch(err => {
                    console.error(`${LOG_PREFIX} DM notes initialization failed:`, err);
                });
            }
        } catch (error) {
            console.error(`${LOG_PREFIX} Fresh-chat setup failed:`, error);
        }
    }
}

/**
 * Initialize the extension.
 */
export async function initGuides() {
    console.log(`${LOG_PREFIX} Initializing...`);

    // Load settings
    loadSettings();

    // Render settings panel
    try {
        const response = await fetch('scripts/extensions/third-party/NemoPresetExt/features/guides/settings.html');
        const settingsHtml = $(await response.text());
        const container = document.getElementById('extensions_settings2');
        if (container) {
            container.appendChild(settingsHtml[0]);
        } else {
            console.error(`${LOG_PREFIX} Could not find extensions_settings2 container.`);
        }
    } catch (error) {
        console.error(`${LOG_PREFIX} Failed to render settings panel:`, error);
    }

    // Bind settings events and populate UI (always — so users can toggle the feature)
    bindSettingsEvents();
    updateSettingsUI();

    // Always wire event listeners — handlers check settings.enabled internally
    if (event_types.GENERATION_STARTED) {
        eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    }

    eventSource.on(event_types.CHAT_CHANGED, async () => {
        const s = extension_settings[EXTENSION_NAME];
        if (!s?.enabled) return;
        registerAllTools();
        updateSystemInstruction();
        await onChatChanged();
    });

    if (event_types.MESSAGE_SENT) {
        eventSource.on(event_types.MESSAGE_SENT, onFirstMessage);
    }

    // Check if guides are enabled — if not, stop here (settings panel is still visible)
    const settings = extension_settings[EXTENSION_NAME];
    if (!settings?.enabled) {
        console.log(`${LOG_PREFIX} Settings panel loaded (guides disabled — enable in settings to activate).`);
        return;
    }

    // Initialize activity feed widget
    initActivityFeed();

    // Register tools
    registerAllTools();

    // Set initial system instruction
    updateSystemInstruction();

    // Ensure the NG lorebook exists on startup
    await ensureBookExists();

    console.log(`${LOG_PREFIX} Extension loaded successfully.`);
}

