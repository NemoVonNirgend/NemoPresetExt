/*
DONE:
- Running example into ST: load model/animation
- Organize code into clean part
- basic ui enable/disable, show grid, follow cursor, reset scene
- Character/model select
- expression/animation select default/classify message
- model reset settings button
- blinking auto (basic)
- transparent background
- slash command expression/motion
- default setting using expression name
- Efficient resize handling
- basic bvh loader
- mouth movement
    - basic text based
- Basic model control move/rotate/scale
    - dragging keep offset with mouse cursor
    - should not work through ui
- Save model settings pos/rotate/scale
- Fix animation chaining / crossfading / default loop
- loop option for animations command
- Consider animation as group Idle.bvh/Idle1.bvh/Idle2.bvh appear as "Idle" group, play one randomly
- Command by default play requested animation not the group
- group support
- Better text talk function
- only full load at start and on reload button
- Error message for wrong animation files
- cache animation files
- tts lip sync
    - xtts compatible (not streaming mode)
    - RVC compatible
    - created and delete on tts_audio play/pause/end
- animation cache
    - optional
    - model specific
    - when loading a model all its animation group are cached
    - playing a non cached animation will cached it
- vrm cache
    - optional
    - keep vrm model previously loaded for instant switch between models
    - no duplicate model possible if on
- Control box follow animation
- Hit boxes
    - click detection
    - expression/motion/message mapping ui
    - default to no change if set to none
    - disabled by default, enable checkbox in ui
- Light control
- lock model menu option


TODO:
    v1.0:
        - Change default map from happy to relaxed
    v2.0:
        - custom color picker
        - blink smooth and adapt to current expression?
            - The expression define the blink blend can't do much for now
        - click interaction
        - other kind of camera
        - 3D room
        - make it work with live2d on top of it
        - Model Gallery

*/
import { eventSource, event_types, getCharacters, saveSettings, saveSettingsDebounced } from "../../../../../../script.js";
import { extension_settings, getContext, ModuleWorkerWrapper } from "../../../../../extensions.js";
import { registerSlashCommand } from '../../../../../slash-commands.js';
export { MODULE_NAME };
import {
    MODULE_NAME,
    DEBUG_PREFIX,
    VRM_CANVAS_ID,
    DEFAULT_LIGHT_COLOR,
    DEFAULT_LIGHT_INTENSITY
} from "./constants.js";
import {
    loadScene,
    loadAllModels,
    setExpression,
    setMotion,
    updateExpression,
    talk,
    setModel,
    setLight,
    setBackground,
    updateModel,
    playAnimationSequence,
    getVRM
} from "./vrm.js";
import { BehaviorTree } from "./behaviortree.js";
import { ProceduralAnimationSystem } from "./proceduralAnimation.js";
import Fuse from './lib/fuse.js';
import {
    onEnabledClick,
    onFollowCameraClick,
    onBlinkClick,
    onTtsLipsSyncClick,
    onAutoSendHitboxMessageClick,
    onLockModelsClick,
    onHitboxesClick,
    onModelCacheClick,
    onAnimationCacheClick,
    onLightChange,
    onLightColorResetClick,
    onLightIntensityResetClick,
    onShowGridClick,
    onCharacterChange,
    onCharacterRefreshClick,
    onCharacterRemoveClick,
    updateCharactersList,
    updateCharactersListOnce,
    updateCharactersModels,
    onModelRefreshClick,
    onModelChange,
    onModelResetClick,
    onModelScaleChange,
    onModelPositionChange,
    onModelRotationChange,
    onAnimationMappingChange,
    onLLMEnabledClick,
    onLLMSettingsChange,
    onEnvironmentAssetChange,
    onAssetScaleChange,
    onAssetPositionXChange,
    onAssetPositionYChange,
    onAssetPositionZChange,
    onLoadAssetClick,
    animations_files,
    models_files
} from "./ui.js";
import "./controls.js";

import { currentChatMembers } from "./utils.js";

const UPDATE_INTERVAL = 100;
const extensionFolderPath = `scripts/extensions/third-party/NemoPresetExt/features/nemovrm`;

//#############################//
//  Extension UI and Settings  //
//#############################//

// Behavior trees for each character
let behaviorTrees = {};

// Procedural animation systems for each character
let proceduralAnimationSystems = {};

const defaultSettings = {
    // Global settings
    enabled: false,
    follow_camera: false,
    tts_lips_sync: false,
    blink: false,
    auto_send_hitbox_message: false,
    lock_models: false,

    // Performances
    hitboxes: false,
    models_cache: false,
    animations_cache: false,

    // Scene
    light_color: DEFAULT_LIGHT_COLOR,
    light_intensity: DEFAULT_LIGHT_INTENSITY,

    // Environment Assets
    environment_asset: "",
    asset_scale: 1.0,
    asset_position_x: 0,
    asset_position_y: 0,
    asset_position_z: 0,

    // Gemini Behavior Settings
    llm_enabled: false,
    llm_api_key: "",

    // Debug
    show_grid: false,

    // Character model mapping
    character_model_mapping: {},
    model_settings: {},
}

//'assets/vrm/VRM1_Constraint_Twist_Sample.vrm'

function loadSettings() {
    console.debug(DEBUG_PREFIX, 'loadSettings called');
    if (extension_settings.vrm === undefined)
        extension_settings.vrm = {};

    // Ensure good format
    for (const key of Object.keys(extension_settings.vrm)) {
        // delete spurious keys
        if (!Object.keys(defaultSettings).includes(key))
            delete extension_settings.vrm[key];
    }
    for (const key of Object.keys(defaultSettings)) {
        // add missing keys
        if (!Object.keys(extension_settings.vrm).includes(key))
            extension_settings.vrm[key] = defaultSettings[key];
    }
    saveSettingsDebounced();

    $('#nemovrm_enabled_checkbox').prop('checked', extension_settings.vrm.enabled);
    $('#vrm_follow_camera_checkbox').prop('checked', extension_settings.vrm.follow_camera);
    $('#vrm_blink_checkbox').prop('checked', extension_settings.vrm.blink);
    $('#vrm_tts_lips_sync_checkbox').prop('checked', extension_settings.vrm.tts_lips_sync);
    $('#vrm_auto_send_hitbox_message_checkbox').prop('checked', extension_settings.vrm.auto_send_hitbox_message);
    $('#vrm_lock_models_checkbox').prop('checked', extension_settings.vrm.lock_models);
    $('#vrm_hitboxes_checkbox').prop('checked', extension_settings.vrm.hitboxes);
    $('#vrm_models_cache_checkbox').prop('checked', extension_settings.vrm.models_cache);
    $('#vrm_animations_cache_checkbox').prop('checked', extension_settings.vrm.animations_cache);
    $('#vrm_show_grid_checkbox').prop('checked', extension_settings.vrm.show_grid);
    
    // Gemini Settings
    $('#vrm_llm_enabled_checkbox').prop('checked', extension_settings.vrm.llm_enabled);
    $('#vrm_llm_api_key').val(extension_settings.vrm.llm_api_key);

    // Environment Asset Settings
    $('#vrm_environment_asset').val(extension_settings.vrm.environment_asset || '');
    $('#vrm_asset_scale').val(extension_settings.vrm.asset_scale || 1.0);
    $('#vrm_asset_position_x').val(extension_settings.vrm.asset_position_x || 0);
    $('#vrm_asset_position_y').val(extension_settings.vrm.asset_position_y || 0);
    $('#vrm_asset_position_z').val(extension_settings.vrm.asset_position_z || 0);
    $('#vrm_asset_scale_value').text(extension_settings.vrm.asset_scale || 1.0);
    $('#vrm_asset_position_x_value').text(extension_settings.vrm.asset_position_x || 0);
    $('#vrm_asset_position_y_value').text(extension_settings.vrm.asset_position_y || 0);
    $('#vrm_asset_position_z_value').text(extension_settings.vrm.asset_position_z || 0);

    $('#nemovrm_enabled_checkbox').on('click', onEnabledClick);
    $('#vrm_follow_camera_checkbox').on('click', onFollowCameraClick);
    $('#vrm_blink_checkbox').on('click', onBlinkClick);
    $('#vrm_tts_lips_sync_checkbox').on('click', onTtsLipsSyncClick);
    $('#vrm_auto_send_hitbox_message_checkbox').on('click', onAutoSendHitboxMessageClick);
    $('#vrm_lock_models_checkbox').on('click', onLockModelsClick);
    $('#vrm_hitboxes_checkbox').on('click', onHitboxesClick);
    $('#vrm_models_cache_checkbox').on('click', onModelCacheClick);
    $('#vrm_animations_cache_checkbox').on('click', onAnimationCacheClick);
    $('#vrm_show_grid_checkbox').on('click', onShowGridClick);
    $('#nemovrm_reload_button').on('click', async () => {
        console.log(DEBUG_PREFIX, 'Reloading NEMO-VRM extension');
        await loadScene();
        console.log(DEBUG_PREFIX, 'NEMO-VRM extension reloaded');
    });

    // Light settings
    $('#vrm_light_color').on('change', onLightChange);
    $('#vrm_light_intensity').on('input', onLightChange);
    $('#vrm_light_color_reset_button').on('click', onLightColorResetClick);
    $('#vrm_light_intensity_reset_button').on('click', onLightIntensityResetClick);
    
    // Gemini Settings
    $('#vrm_llm_enabled_checkbox').on('click', onLLMEnabledClick);
    $('#vrm_llm_api_key').on('change', onLLMSettingsChange);

    // Environment Asset Settings
    $('#vrm_environment_asset').on('change', onEnvironmentAssetChange);
    $('#vrm_asset_scale').on('input', onAssetScaleChange);
    $('#vrm_asset_position_x').on('input', onAssetPositionXChange);
    $('#vrm_asset_position_y').on('input', onAssetPositionYChange);
    $('#vrm_asset_position_z').on('input', onAssetPositionZChange);
    $('#vrm_load_asset_button').on('click', onLoadAssetClick);

    // Character selection
    $('#vrm_character_select').on('change', onCharacterChange);
    $('#vrm_character_refresh_button').on('click', onCharacterRefreshClick);
    $('#vrm_character_remove_button').on('click', onCharacterRemoveClick);

    $('#vrm_model_refresh_button').on('click', onModelRefreshClick);
    $('#vrm_model_select').on('change', onModelChange);
    $('#vrm_model_reset_button').on('click', onModelResetClick);

    $('#vrm_model_scale').on('input', onModelScaleChange);
    $('#vrm_model_position_x').on('input', onModelPositionChange);
    $('#vrm_model_position_y').on('input', onModelPositionChange);
    $('#vrm_model_rotation_x').on('input', onModelRotationChange);
    $('#vrm_model_rotation_y').on('input', onModelRotationChange);

    $('#vrm_default_expression_select').on('change', () => {onAnimationMappingChange('animation_default');});
    $('#vrm_default_motion_select').on('change', () => {onAnimationMappingChange('animation_default');});
    $('#vrm_default_expression_replay').on('click', () => {onAnimationMappingChange('animation_default');});
    $('#vrm_default_motion_replay').on('click', () => {onAnimationMappingChange('animation_default');});

    $('#nemovrm_reload_button').on('click', async () => {
        await loadScene();
        await loadAllModels(currentChatMembers());
        console.debug(DEBUG_PREFIX,'Reset clicked, reloading VRM');
    });

    eventSource.on(event_types.CHAT_CHANGED, async () => {
        console.debug(DEBUG_PREFIX, 'CHAT_CHANGED event triggered');
        updateCharactersList();
        updateCharactersModels();
        loadAllModels(currentChatMembers());
        initializeBehaviorTrees();
    });

    eventSource.on(event_types.GROUP_UPDATED, async () => {
        console.debug(DEBUG_PREFIX, 'GROUP_UPDATED event triggered');
        updateCharactersList();
        updateCharactersModels();
        loadAllModels(currentChatMembers());
        initializeBehaviorTrees();
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, async (chat_id) => {
        updateExpression(chat_id);
        talk(chat_id);
        
        // Update behavior tree when a message is received
        const message = getContext().chat[chat_id];
        if (!message.is_user && behaviorTrees[message.name]) {
            // Notify behavior tree of user message
            behaviorTrees[message.name].onUserMessage();
            // Immediate behavior update
            await behaviorTrees[message.name].update();
        }
    });

    eventSource.on(event_types.MESSAGE_EDITED, async (chat_id) => {
        updateExpression(chat_id);
        talk(chat_id);
        
        // Update behavior tree when a message is edited
        const message = getContext().chat[chat_id];
        if (!message.is_user && behaviorTrees[message.name]) {
            // Notify behavior tree of user message
            behaviorTrees[message.name].onUserMessage();
            // Immediate behavior update
            await behaviorTrees[message.name].update();
        }
    });

    console.debug(DEBUG_PREFIX, 'Calling updateCharactersListOnce and updateCharactersModels');
    updateCharactersListOnce();
    updateCharactersModels();

    loadScene();
}

//#############################//
//  Methods                    //
//#############################//

function initializeBehaviorTrees() {
    const characters = currentChatMembers();
    
    // Clear existing behavior trees
    behaviorTrees = {};
    
    // Clear existing procedural animation systems
    proceduralAnimationSystems = {};
    
    // Create a behavior tree and procedural animation system for each character
    for (const character of characters) {
        behaviorTrees[character] = new BehaviorTree(character);
        
        // Configure LLM settings
        behaviorTrees[character].configureLLM(
            extension_settings.vrm.llm_enabled,
            extension_settings.vrm.llm_api_key
        );
        
        // Initialize procedural animation system
        proceduralAnimationSystems[character] = new ProceduralAnimationSystem();
        proceduralAnimationSystems[character].initialize();
    }
    
    console.debug(DEBUG_PREFIX, "Initialized behavior trees and procedural animation systems for characters:", characters);
}

//#############################//
//  Module Worker              //
//#############################//

async function moduleWorker() {
    // Only run if extension is enabled
    if (!extension_settings.vrm?.enabled) {
        return;
    }
    
    // Update behavior trees periodically
    const behaviorPromises = [];
    for (const character in behaviorTrees) {
        if (behaviorTrees[character]) {
            behaviorPromises.push(
                behaviorTrees[character].update().catch(error => {
                    console.error(DEBUG_PREFIX, "Error updating behavior tree for", character, error);
                })
            );
        }
    }
    
    // Update procedural animations
    const time = Date.now();
    const deltaTime = UPDATE_INTERVAL;
    
    // DISABLED: Procedural animation updates causing conflicts with main animation system
    // for (const character in proceduralAnimationSystems) {
    //     try {
    //         const vrm = getVRM(character);
    //         if (vrm && proceduralAnimationSystems[character]) {
    //             proceduralAnimationSystems[character].update(vrm, time, deltaTime);
    //         }
    //     } catch (error) {
    //         console.error(DEBUG_PREFIX, "Error updating procedural animations for", character, error);
    //     }
    // }
    
    // Wait for all behavior tree updates
    if (behaviorPromises.length > 0) {
        await Promise.allSettled(behaviorPromises);
    }
}

//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));
    const getContainer = () => {
        // Try to find our specific settings container
        const container = $(document.getElementById('nemovrm_container'));
        if (container.length > 0) {
            return container;
        }
        // Fallback to the general extensions container
        return $(document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings'));
    };

    getContainer().append(windowHtml);
    loadSettings();

    // Make behavior trees and procedural animation systems globally accessible
    window.VRM_BEHAVIOR_TREES = behaviorTrees;
    window.getProceduralAnimationSystem = getProceduralAnimationSystem;

    // Module worker
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();
    registerSlashCommand('vrmlightcolor', setLightColorSlashCommand, [], '<span class="monospace">(expression)</span> – set vrm scene light color (example: "/vrmlightcolor white" or "/vrmlightcolor purple")', true, true);
    registerSlashCommand('vrmlightintensity', setLightIntensitySlashCommand, [], '<span class="monospace">(expression)</span> – set vrm scene light intensity in percent (example: "/vrmlightintensity 0" or "/vrmlightintensity 100")', true, true);
    registerSlashCommand('vrmmodel', setModelSlashCommand, [], '<span class="monospace">(expression)</span> – set vrm model (example: "/vrmmodel Seraphina.vrm" or "/vrmmodel character=Seraphina model=Seraphina.vrm")', true, true);
    registerSlashCommand('vrmexpression', setExpressionSlashCommand, [], '<span class="monospace">(expression)</span> – set vrm model expression (example: "/vrmexpression happy" or "/vrmexpression character=Seraphina expression=happy")', true, true);
    registerSlashCommand('vrmmotion', setMotionSlashCommand, [], '<span class="monospace">(motion)</span> – set vrm model motion (example: "/vrmmotion idle" or "/vrmmotion character=Seraphina motion=idle loop=true random=false")', true, true);
    registerSlashCommand('vrmmotionlist', MotionListSlashCommand, [], '<span class="monospace">(motion)</span> – list vrm model motions (example: "/vrmmotionlits")', true, true);
    registerSlashCommand('vrmbackground', setBackgroundSlashCommand, [], '<span class="monospace">(motion)</span> – Set the 3d background (example: "/vrmbackground /assets/vrm/scene/test.fbx or /vrmbackground path=/assets/vrm/scene/test.fbx scale=0.01 x=0 y=0 z=0 rx=0 ry=0 rz=0)', true, true);
    registerSlashCommand('vrmmodelsettings', setModelSettingsSlashCommand, [], '<span class="monospace">(motion)</span> – Set the 3d background (example: "/vrmmodelsettings character=Seraphina scale=1 x=0 y=0 z=0 rx=0 ry=0 rz=0)', true, true);
    registerSlashCommand('vrmnod', nodSlashCommand, [], '<span class="monospace">(motion)</span> – Make the character nod (example: "/vrmnod" or "/vrmnod character=Seraphina intensity=0.3 count=2")', true, true);
    registerSlashCommand('vrmshake', shakeSlashCommand, [], '<span class="monospace">(motion)</span> – Make the character shake their head (example: "/vrmshake" or "/vrmshake character=Seraphina intensity=0.3 count=2")', true, true);
    registerSlashCommand('vrmbreath', breathSlashCommand, [], '<span class="monospace">(motion)</span> – Toggle breathing animation (example: "/vrmbreath on" or "/vrmbreath off")', true, true);

});

async function setLightColorSlashCommand(_, color) {
    if (!color) {
        console.log('No color provided');
        return;
    }

    setLight(color,extension_settings.vrm.light_intensity);
}

async function setLightIntensitySlashCommand(_, intensity) {
    if (!intensity) {
        console.log('No intensity provided');
        return;
    }

    setLight(extension_settings.vrm.light_color,intensity);
}

// Example /vrmmotion anger
async function setModelSlashCommand(args, model) {
    let character = undefined;
    if (!model && !args["model"]) {
        console.log('No model provided');
        return;
    }

    if (args["character"])
        character = args["character"];

    if (args["model"])
        model = args["model"];

    if (character === undefined) {
        const characters = currentChatMembers();
        if(characters.length == 0) {
            console.log('No character provided and none detected in current chat');
            return;
        }
        character = characters[0];
    }

    model = model.trim();
    console.debug(DEBUG_PREFIX,'Command vrmmodel received for character=',character,"model=", model);

    const fuse = new Fuse(models_files);
    const results = fuse.search(model);
    const fileItem = results[0]?.item;

    if (fileItem)
    {
        $('#vrm_character_select').val(character)
        $('#vrm_model_select').val(fileItem)
        onModelChange();
    }
    else{
        console.debug(DEBUG_PREFIX,'Model not found in', models_files);
    }
}

async function setExpressionSlashCommand(args, expression) {
    let character = undefined;
    if (!expression) {
        console.log('No expression provided');
        return;
    }

    if (args["character"])
        character = args["character"];

    if (args["expression"])
        expression = args["expression"];

    if (character === undefined) {
        const characters = currentChatMembers();
        if(characters.length == 0) {
            console.log('No character provided and none detected in current chat');
            return;
        }
        character = characters[0];
    }

    expression = expression.trim();

    console.debug(DEBUG_PREFIX,'Command expression received for character=',character,"expression=",expression);

    await setExpression(character,expression);
}

// Example /vrmmotion anger
async function setMotionSlashCommand(args, motion) {
    let character = undefined;
    let loop = false;
    let random = false;
    if (!motion && !args["motion"]) {
        console.log('No motion provided');
        return;
    }

    if (args["character"])
        character = args["character"];

    if (args["motion"])
        motion = args["motion"];

    if (args["loop"])
        loop = args["loop"].toLowerCase() === "true";

    if (args["random"])
        random = args["random"].toLowerCase() === "true";

    if (character === undefined) {
        const characters = currentChatMembers();
        if(characters.length == 0) {
            console.log('No character provided and none detected in current chat');
            return;
        }
        character = characters[0];
    }

    motion = motion.trim();
    console.debug(DEBUG_PREFIX,'Command motion received for character=',character,"motion=", motion,"loop=",loop, "random=",random);

    const fuse = new Fuse(animations_files);
    const results = fuse.search(motion);
    const fileItem = results[0]?.item;

    if (fileItem)
    {
        setMotion(character, fileItem, loop, true, random);
    }
    else{
        console.debug(DEBUG_PREFIX,'Motion not found in', animations_files);
    }
}

// Example /vrmmotionlist
async function MotionListSlashCommand(args) {
    var animation_list = [];
    for(const fullPath of animations_files) {
        var filename = fullPath.replace(/^.*[\\\\/]/, '').replace(/\.[^/.]+$/, "")
        animation_list.push(filename)
    }
    return JSON.stringify(animation_list);
}

// Example /vrmbackground path=/assets/vrm/scene/test.fbx scale=0.01 x=0 y=0 z=0 rx=0 ry=2 rz=0
// /vrmbackground path=/assets/vrm/scene/sitting_room/scene.gltf scale=1 x=0 y=0 z=-0.5 rx=0 ry=2 rz=0
async function setBackgroundSlashCommand(args, path) {
    let scale = 1 // same as character is good
    let position = {"x":0,"y":0,"z":0} // z is -2 times scale
    let rotation = {"x":0,"y":0,"z":0}

    if (!path && !args["path"]) {
        console.log('No path provided');
        return;
    }

    if (args["path"])
        path = args["path"]

    //console.debug(DEBUG_PREFIX, "path:", path)

    if (args["scale"])
        scale = args["scale"]

    if (args["x"])
        position.x = args["x"];
    if (args["y"])
        position.y = args["y"];
    if (args["z"])
        position.z = args["z"];

    if (args["rx"])
        rotation.x = args["rx"];
    if (args["ry"])
        rotation.y = args["ry"];
    if (args["rz"])
        rotation.z = args["rz"];

    setBackground(path, scale, position, rotation);
}

async function setModelSettingsSlashCommand(args) {
    let character = undefined;
    let scale = 1;
    let position = {"x":0,"y":0,"z":0};
    let rotation = {"x":0,"y":0,"z":0};

    if(args["character"])
        character = args["character"];
    else
        character = currentChatMembers()[0];

    if (args["scale"])
        scale = args["scale"];

    if (args["x"])
        position.x = args["x"];
    if (args["y"])
        position.y = args["y"];
    if (args["z"])
        position.z = args["z"];

    if (args["rx"])
        rotation.x = args["rx"];
    if (args["ry"])
        rotation.y = args["ry"];
    if (args["rz"])
        rotation.z = args["rz"];


    const model_path = extension_settings.vrm.character_model_mapping[character];
    extension_settings.vrm.model_settings[model_path]['scale'] = scale;
    extension_settings.vrm.model_settings[model_path]['x'] = position.x;
    extension_settings.vrm.model_settings[model_path]['y'] = position.y;
    extension_settings.vrm.model_settings[model_path]['z'] = position.z;
    extension_settings.vrm.model_settings[model_path]['rx'] = rotation.x;
    extension_settings.vrm.model_settings[model_path]['ry'] = rotation.y;
    extension_settings.vrm.model_settings[model_path]['rz'] = rotation.z;

    updateModel(character);
}

// Get the procedural animation system for a character
function getProceduralAnimationSystem(character) {
    return proceduralAnimationSystems[character] || null;
}

// Procedural animation slash commands
async function nodSlashCommand(args) {
    let character = undefined;
    let intensity = 0.2;
    let count = 1;

    if (args["character"])
        character = args["character"];
    else
        character = currentChatMembers()[0];

    if (args["intensity"])
        intensity = parseFloat(args["intensity"]);

    if (args["count"])
        count = parseInt(args["count"]);

    if (!proceduralAnimationSystems[character]) {
        console.log('No procedural animation system for character:', character);
        return;
    }

    console.debug(DEBUG_PREFIX, 'Command nod received for character=', character, "intensity=", intensity, "count=", count);

    // Create and play nod animation
    proceduralAnimationSystems[character].nod(getVRM(character), intensity, 2.0, count, Date.now());
}

async function shakeSlashCommand(args) {
    let character = undefined;
    let intensity = 0.2;
    let count = 2;

    if (args["character"])
        character = args["character"];
    else
        character = currentChatMembers()[0];

    if (args["intensity"])
        intensity = parseFloat(args["intensity"]);

    if (args["count"])
        count = parseInt(args["count"]);

    if (!proceduralAnimationSystems[character]) {
        console.log('No procedural animation system for character:', character);
        return;
    }

    console.debug(DEBUG_PREFIX, 'Command shake received for character=', character, "intensity=", intensity, "count=", count);

    // Create and play shake animation
    proceduralAnimationSystems[character].shake(getVRM(character), intensity, 3.0, count, Date.now());
}

async function breathSlashCommand(args, value) {
    let character = undefined;
    let enabled = value === "on" || value === "true";

    if (args["character"])
        character = args["character"];
    else
        character = currentChatMembers()[0];

    if (args["enabled"])
        enabled = args["enabled"].toLowerCase() === "true" || args["enabled"].toLowerCase() === "on";

    if (!proceduralAnimationSystems[character]) {
        console.log('No procedural animation system for character:', character);
        return;
    }

    console.debug(DEBUG_PREFIX, 'Command breath received for character=', character, "enabled=", enabled);

    if (enabled) {
        // Start breathing animation
        proceduralAnimationSystems[character].startAnimation("Breath", Date.now());
    } else {
        // Stop breathing animation
        proceduralAnimationSystems[character].stopAnimation("Breath");
    }
}