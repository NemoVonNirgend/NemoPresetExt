/**
 * SillyTavern Compatibility Layer
 * 
 * This module centralizes all imports from SillyTavern's core scripts,
 * ensuring that all parts of the extension access the same, initialized instances
 * of ST functions and variables. This prevents race conditions and simplifies
 * dependency management.
 */
import {
    saveSettingsDebounced,
    chat,
    chat_metadata,
    this_chid,
    getCurrentChatId,
    saveMetadata,
    callPopup,
    eventSource,
    event_types,
    saveChatConditional,
    characters,
    extension_prompt_roles,
    active_character,
    generateQuietPrompt,
    substituteParamsExtended,
    generateRaw,
    getMaxContextSize,
    main_api
} from '../../../../../../../script.js';

import {
    world_info,
    world_names,
    createWorldInfoEntry,
    world_info_logic,
    world_info_position,
    createNewWorldInfo,
    saveWorldInfo
} from '../../../../../../world-info.js';

import {
    getContext
} from '../../../../../../extensions.js';

import { selected_group } from '../../../../../../group-chats.js';
import { MacrosParser } from '../../../../../../macros.js';


export {
    saveSettingsDebounced,
    chat,
    chat_metadata,
    this_chid,
    getCurrentChatId,
    saveMetadata,
    callPopup,
    eventSource,
    event_types,
    saveChatConditional,
    characters,
    extension_prompt_roles,
    active_character,
    generateQuietPrompt,
    substituteParamsExtended,
    generateRaw,
    getMaxContextSize,
    main_api,
    world_info,
    world_names,
    getContext,
    createWorldInfoEntry,
    world_info_logic,
    world_info_position,
    createNewWorldInfo,
    saveWorldInfo,
    selected_group,
    MacrosParser
};