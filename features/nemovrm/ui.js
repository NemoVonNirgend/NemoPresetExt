import { saveSettingsDebounced, getRequestHeaders, callPopup } from '../../../../../../script.js';
import { getContext, extension_settings, renderExtensionTemplate } from '../../../../../extensions.js';

import {
    DEBUG_PREFIX,
    VRM_MODEL_FOLDER,
    CLASSIFY_EXPRESSIONS,
    HITBOXES,
    DEFAULT_LIGHT_COLOR,
    DEFAULT_LIGHT_INTENSITY,
    LOCAL_MODELS_PATH,
    LOCAL_ANIMATIONS_PATH,
    LOCAL_ENVIRONMENTS_PATH
} from './constants.js';

import {
    loadScene,
    setModel,
    unloadModel,
    getVRM,
    setExpression,
    setMotion,
    updateModel,
    clearModelCache,
    clearAnimationCache,
    loadAllModels,
    setLight
} from "./vrm.js";

import {
    currentChatMembers,
    delay,
    loadAnimationUi,
} from './utils.js';
import Fuse from './lib/fuse.js';

console.debug('<NemoVRM module>', 'ui.js file loaded');

export {
    onEnabledClick,
    onFollowCameraClick,
    onBlinkClick,
    onTtsLipsSyncClick,
    onHitboxesClick,
    onAutoSendHitboxMessageClick,
    onLockModelsClick,
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
    // LLM Settings
    onLLMEnabledClick,
    onLLMSettingsChange,
    // Environment Asset Settings
    onEnvironmentAssetChange,
    onAssetScaleChange,
    onAssetPositionXChange,
    onAssetPositionYChange,
    onAssetPositionZChange,
    onLoadAssetClick,
    models_files,
    animations_files
};

let characters_list = [];

let models_files = [];
let models_files_label = [];

let animations_files = [];
let animations_groups = [];


async function onEnabledClick() {
    extension_settings.vrm.enabled = $('#nemovrm_enabled_checkbox').is(':checked');
    $('#vrm_character_select').val("none");
    $('#vrm_model_select').val("none");
    saveSettingsDebounced();

    await loadScene();
    if(extension_settings.vrm.enabled)
        await loadAllModels(currentChatMembers());
}

async function onFollowCameraClick() {
    extension_settings.vrm.follow_camera = $('#vrm_follow_camera_checkbox').is(':checked');
    saveSettingsDebounced();
}

async function onBlinkClick() {
    extension_settings.vrm.blink = $('#vrm_blink_checkbox').is(':checked');
    saveSettingsDebounced();
    if(extension_settings.vrm.enabled)
        await loadAllModels(currentChatMembers());
}

async function onTtsLipsSyncClick() {
    extension_settings.vrm.tts_lips_sync = $('#vrm_tts_lips_sync_checkbox').is(':checked');
    saveSettingsDebounced();
}

async function onHitboxesClick() {
    extension_settings.vrm.hitboxes = $('#vrm_hitboxes_checkbox').is(':checked');
    saveSettingsDebounced();
    clearModelCache();
    if(extension_settings.vrm.enabled)
        await loadAllModels(currentChatMembers());
}

async function onAutoSendHitboxMessageClick() {
    extension_settings.vrm.auto_send_hitbox_message = $('#vrm_auto_send_hitbox_message_checkbox').is(':checked');
    saveSettingsDebounced();
}

async function onLockModelsClick() {
    extension_settings.vrm.lock_models = $('#vrm_lock_models_checkbox').is(':checked');
    saveSettingsDebounced();
}

async function onModelCacheClick() {
    extension_settings.vrm.models_cache = $('#vrm_models_cache_checkbox').is(':checked');
    saveSettingsDebounced();
    if (!extension_settings.vrm.models_cache)
        clearModelCache()
    else
        loadAllModels(currentChatMembers());
}

async function onAnimationCacheClick() {
    extension_settings.vrm.animations_cache = $('#vrm_animations_cache_checkbox').is(':checked');
    saveSettingsDebounced();
    if (!extension_settings.vrm.animations_cache)
        clearAnimationCache();
    else
        loadAllModels(currentChatMembers());
}

async function onLightChange() {
    extension_settings.vrm.light_color = $('#vrm_light_color').val();
    extension_settings.vrm.light_intensity = Number($('#vrm_light_intensity').val());
    $('#vrm_light_intensity_value').text(extension_settings.vrm.light_intensity);
    saveSettingsDebounced();

    setLight(extension_settings.vrm.light_color, extension_settings.vrm.light_intensity);
}

async function onLightColorResetClick() {
    $("#vrm_light_color").val(DEFAULT_LIGHT_COLOR);
    onLightChange();
}

async function onLightIntensityResetClick() {
    $("#vrm_light_intensity").val(DEFAULT_LIGHT_INTENSITY);
    onLightChange();
}

async function onShowGridClick() {
    extension_settings.vrm.show_grid = $('#vrm_show_grid_checkbox').is(':checked');
    saveSettingsDebounced();
    
    // Update environment grid visibility
    if (window.environmentSystem) {
        window.environmentSystem.toggleGridVisibility(extension_settings.vrm.show_grid);
    }
}

// Environment Asset Settings
async function onEnvironmentAssetChange() {
    const assetPath = $('#vrm_environment_asset').val();
    extension_settings.vrm.environment_asset = assetPath;
    console.debug(DEBUG_PREFIX, 'Environment asset path changed:', assetPath);
    saveSettingsDebounced();
}

async function onAssetScaleChange() {
    const scale = Number($('#vrm_asset_scale').val());
    extension_settings.vrm.asset_scale = scale;
    $('#vrm_asset_scale_value').text(scale);
    saveSettingsDebounced();
}

async function onAssetPositionXChange() {
    const x = Number($('#vrm_asset_position_x').val());
    extension_settings.vrm.asset_position_x = x;
    $('#vrm_asset_position_x_value').text(x);
    saveSettingsDebounced();
}

async function onAssetPositionYChange() {
    const y = Number($('#vrm_asset_position_y').val());
    extension_settings.vrm.asset_position_y = y;
    $('#vrm_asset_position_y_value').text(y);
    saveSettingsDebounced();
}

async function onAssetPositionZChange() {
    const z = Number($('#vrm_asset_position_z').val());
    extension_settings.vrm.asset_position_z = z;
    $('#vrm_asset_position_z_value').text(z);
    saveSettingsDebounced();
}

async function onLoadAssetClick() {
    let assetPath = $('#vrm_environment_asset').val();
    const scale = Number($('#vrm_asset_scale').val());
    const x = Number($('#vrm_asset_position_x').val());
    const y = Number($('#vrm_asset_position_y').val());
    const z = Number($('#vrm_asset_position_z').val());
    
    if (!assetPath) {
        toastr.warning('Please specify an asset path', DEBUG_PREFIX);
        return;
    }
    
    // Check if it's a local asset path
    if (!assetPath.startsWith('http') && !assetPath.startsWith('/')) {
        // Assume it's a local asset
        assetPath = `/scripts/extensions/third-party/NEMO-VRM/assets/environments/${assetPath}`;
    }
    
    try {
        // Load the asset
        const vrmModule = await import('./vrm.js');
        const assetRef = await vrmModule.loadEnvironmentAsset(
            assetPath, 
            { x, y, z }, 
            scale
        );
        
        if (assetRef) {
            toastr.success('Environment asset loaded successfully', DEBUG_PREFIX);
            console.debug(DEBUG_PREFIX, 'Loaded asset:', assetRef);
        } else {
            toastr.error('Failed to load environment asset', DEBUG_PREFIX);
        }
    } catch (error) {
        console.error(DEBUG_PREFIX, 'Error loading environment asset:', error);
        toastr.error('Error loading environment asset: ' + error.message, DEBUG_PREFIX);
    }
}

// LLM Settings
async function onLLMEnabledClick() {
    extension_settings.vrm.llm_enabled = $('#vrm_llm_enabled_checkbox').is(':checked');
    saveSettingsDebounced();
    
    // Update behavior trees with new LLM settings
    updateBehaviorTreesWithLLMSettings();
}

async function onLLMSettingsChange() {
    extension_settings.vrm.llm_api_key = $('#vrm_llm_api_key').val();
    saveSettingsDebounced();
    
    // Update behavior trees with new LLM settings
    updateBehaviorTreesWithLLMSettings();
}

function updateBehaviorTreesWithLLMSettings() {
    // Update all behavior trees with the new LLM settings
    if (window.VRM_BEHAVIOR_TREES) {
        for (const character in window.VRM_BEHAVIOR_TREES) {
            window.VRM_BEHAVIOR_TREES[character].configureLLM(
                extension_settings.vrm.llm_enabled,
                extension_settings.vrm.llm_api_key
            );
        }
    }
}

async function onCharacterChange() {
    const character = String($('#vrm_character_select').val());

    $('#vrm_model_div').hide();
    $('#vrm_model_settings').hide();

    if (character == 'none') {
        return;
    }

    $('#vrm_model_select')
        .find('option')
        .remove()
        .end()
        .append('<option value="none">None</option>')
        .val('none');

    for (const i of models_files_label) {
        //console.debug(DEBUG_PREFIX,"DEBUG",i)
        const model_folder = i[0];
        const model_settings_path = i[1];
        $('#vrm_model_select').append(new Option(model_folder, model_settings_path));
    }
    

    if (extension_settings.vrm.character_model_mapping[character] !== undefined) {
        $('#vrm_model_select').val(extension_settings.vrm.character_model_mapping[character]);
        $('#vrm_model_settings').show();
        loadModelUi();
    }

    $('#vrm_model_div').show();
}

async function onCharacterRefreshClick() {
    updateCharactersList();
    $('#vrm_character_select').val('none');
    $('#vrm_character_select').trigger('change');
}

async function onCharacterRemoveClick() {
    const character = String($('#vrm_character_select').val());

    if (character == 'none')
        return;

    $('#vrm_model_select').val('none');
    $('#vrm_model_settings').hide();
    delete extension_settings.vrm.character_model_mapping[character];
    saveSettingsDebounced();
    await unloadModel(character);
    console.debug(DEBUG_PREFIX, 'Deleted all settings for', character);
}

async function onModelRefreshClick() {
    console.debug(DEBUG_PREFIX, 'onModelRefreshClick called');
    updateCharactersModels(true);
    $('#vrm_model_select').val('none');
    $('#vrm_model_select').trigger('change');
}

async function onModelResetClick() {
    const model_path = String($('#vrm_model_select').val());

    if (model_path === "none")
        return;

    const template = `<div class="m-b-1">Are you sure you want to reset all settings of this VRM model?</div>`;
    const confirmation = await callPopup(template, 'confirm');

    if (confirmation) {
        delete extension_settings.vrm.model_settings[model_path];
        $('#vrm_model_select').trigger('change');   
    }
    else {
        console.debug(DEBUG_PREFIX, 'Confirmation refused by user');
    }
}

async function onModelChange() {
    if (!extension_settings.vrm.enabled)
        return;

    const character = String($('#vrm_character_select').val());
    const model_path = String($('#vrm_model_select').val());
    let use_default_settings = false;

    $('#vrm_model_settings').hide();

    if (model_path == 'none') {
        delete extension_settings.vrm.character_model_mapping[character];
        saveSettingsDebounced();
        await unloadModel(character);
        return;
    }

    $('#vrm_model_loading').show();

    extension_settings.vrm.character_model_mapping[character] = model_path;
    saveSettingsDebounced();

    // Initialize new model
    if (extension_settings.vrm.model_settings[model_path] === undefined) {
        use_default_settings = true;
        // Use proper default animation paths instead of 'none'
        const defaultMotion = '/scripts/extensions/third-party/NEMO-VRM/assets/animations/neutral.bvh';
        extension_settings.vrm.model_settings[model_path] = {
            'scale': 3.0,
            'x': 0.0,
            'y': 0.0,
            'z': 0.0,
            'rx': 0.0,
            'ry': 0.0,
            'rz':0.0,
            'animation_default': { 'expression': 'neutral', 'motion': defaultMotion },
            //'animation_click': { 'expression': 'none', 'motion': 'none', 'message': '' },
            'classify_mapping': {},
            'hitboxes_mapping': {}
        };

        for (const expression of CLASSIFY_EXPRESSIONS) {
            extension_settings.vrm.model_settings[model_path]['classify_mapping'][expression] = { 'expression': 'none', 'motion': 'none' };
        }

        for (const area in HITBOXES) {
            extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][area] = { 'expression': 'none', 'motion': 'none', 'message': '' };
        }

        saveSettingsDebounced();
    }

    //await loadScene();
    await setModel(character,model_path);
    await loadModelUi(use_default_settings);
    
    $('#vrm_model_settings').show();
    $('#vrm_model_loading').hide();
}

async function onModelScaleChange() {
    const character = String($('#vrm_character_select').val());
    const model_path = String($('#vrm_model_select').val());
    extension_settings.vrm.model_settings[model_path]['scale'] = Number($('#vrm_model_scale').val());
    $('#vrm_model_scale_value').text(extension_settings.vrm.model_settings[model_path]['scale']);
    saveSettingsDebounced();
    updateModel(character);
}

async function onModelPositionChange() {
    const character = String($('#vrm_character_select').val());
    const model_path = String($('#vrm_model_select').val());
    extension_settings.vrm.model_settings[model_path]['x'] = Number($('#vrm_model_position_x').val());
    extension_settings.vrm.model_settings[model_path]['y'] = Number($('#vrm_model_position_y').val());
    $('#vrm_model_position_x_value').text(extension_settings.vrm.model_settings[model_path]['x']);
    $('#vrm_model_position_y_value').text(extension_settings.vrm.model_settings[model_path]['y']);
    saveSettingsDebounced();
    updateModel(character,);
}

async function onModelRotationChange() {
    const character = String($('#vrm_character_select').val());
    const model_path = String($('#vrm_model_select').val());
    extension_settings.vrm.model_settings[model_path]['rx'] = Number($('#vrm_model_rotation_x').val());
    extension_settings.vrm.model_settings[model_path]['ry'] = Number($('#vrm_model_rotation_y').val());
    $('#vrm_model_rotation_x_value').text(extension_settings.vrm.model_settings[model_path]['rx']);
    $('#vrm_model_rotation_y_value').text(extension_settings.vrm.model_settings[model_path]['ry']);
    saveSettingsDebounced();
    updateModel(character);
}

async function onAnimationMappingChange(type) {
    const character = String($('#vrm_character_select').val());
    const model_path = String($('#vrm_model_select').val());
    let expression;
    let motion;

    switch (type) {
        case 'animation_default':
            expression = $('#vrm_default_expression_select').val();
            motion = $('#vrm_default_motion_select').val();

            extension_settings.vrm.model_settings[model_path]['animation_default']['expression'] = expression;
            extension_settings.vrm.model_settings[model_path]['animation_default']['motion'] = motion;
            console.debug(DEBUG_PREFIX,'Updated animation_default of',character,':',extension_settings.vrm.model_settings[model_path]['animation_default']);
            break;
        default:
            console.error(DEBUG_PREFIX,'Unexpected type:',type);
    }

    saveSettingsDebounced();

    await setExpression(character, expression);
    await setMotion(character, motion, true);
}

async function loadModelUi(use_default_settings) {
    const character = String($('#vrm_character_select').val());
    const model_path = String($('#vrm_model_select').val());
    const expression_ui = $('#vrm_expression_mapping');
    const hiboxes_ui = $('#vrm_hitboxes_mapping');

    expression_ui.empty();
    hiboxes_ui.empty();

    if (model_path === "none")
        return;

    let model = getVRM(character);

    while (model === undefined) { // TODO wait cleaner way
        model = getVRM(character);
        await delay(500);
    }

    console.debug(DEBUG_PREFIX, 'loading settings of model:', model_path);

    let model_expressions = [];
    let model_motions = animations_groups;

    for (const i of Object.keys(model.expressionManager.expressionMap) ?? []) {
        if (!model.expressionManager.blinkExpressionNames.includes(i) && !model.expressionManager.mouthExpressionNames.includes(i) && !model.expressionManager.lookAtExpressionNames.includes(i))
            model_expressions.push(i.toLowerCase());
    }

    model_expressions.sort();

    model_motions.sort();

    console.debug(DEBUG_PREFIX, 'expressions:', model_expressions);
    console.debug(DEBUG_PREFIX, 'motions:', model_motions);

    // Model settings
    $('#vrm_model_scale').val(extension_settings.vrm.model_settings[model_path]['scale']);
    $('#vrm_model_scale_value').text(extension_settings.vrm.model_settings[model_path]['scale']);

    $('#vrm_model_position_x').val(extension_settings.vrm.model_settings[model_path]['x']);
    $('#vrm_model_position_x_value').text(extension_settings.vrm.model_settings[model_path]['x']);
    $('#vrm_model_position_y').val(extension_settings.vrm.model_settings[model_path]['y']);
    $('#vrm_model_position_y_value').text(extension_settings.vrm.model_settings[model_path]['y']);

    $('#vrm_model_rotation_x').val(extension_settings.vrm.model_settings[model_path]['rx']);
    $('#vrm_model_rotation_x_value').text(extension_settings.vrm.model_settings[model_path]['rx']);
    $('#vrm_model_rotation_y').val(extension_settings.vrm.model_settings[model_path]['ry']);
    $('#vrm_model_rotation_y_value').text(extension_settings.vrm.model_settings[model_path]['ry']);

	// Hitboxes
    // Hit areas mapping
    for (const hitbox in HITBOXES) {
        hiboxes_ui.append(`
        <div class="vrm-parameter">
            <div class="vrm-parameter-title">
                <label for="vrm_hitbox_${hitbox}">
                ${hitbox}
                </label>
            </div>
            <div>
                <div class="vrm-select-div">
                    <select id="vrm_hitbox_expression_select_${hitbox}">
                    </select>
                    <div id="vrm_hitbox_expression_replay_${hitbox}" class="vrm_replay_button menu_button">
                        <i class="fa-solid fa-arrow-rotate-left"></i>
                    </div>
                </div>
                <div class="vrm-select-div">
                    <select id="vrm_hitbox_motion_select_${hitbox}">
                    </select>
                    <div id="vrm_hitbox_motion_replay_${hitbox}" class="vrm_replay_button menu_button">
                        <i class="fa-solid fa-arrow-rotate-left"></i>
                    </div>
                </div>
                <textarea id="vrm_hitbox_message_${hitbox}" type="text" class="text_pole textarea_compact" rows="2"
            placeholder="Write message te send when clicking the area."></textarea>
            </div>
        </div>
        `);

        loadAnimationUi(
            hitbox,
            use_default_settings,
            model_expressions,
            model_motions,
            `vrm_hitbox_expression_select_${hitbox}`,
            `vrm_hitbox_motion_select_${hitbox}`,
            extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]['expression'],
            extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]['motion']);

        $(`#vrm_hitbox_message_${hitbox}`).val(extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]['message']);

        $(`#vrm_hitbox_expression_select_${hitbox}`).on('change', function () { updateHitboxMapping(hitbox); });
        $(`#vrm_hitbox_motion_select_${hitbox}`).on('change', function () { updateHitboxMapping(hitbox); });
        $(`#vrm_hitbox_message_${hitbox}`).on('change', function () { updateHitboxMapping(hitbox); });
        $(`#vrm_hitbox_expression_replay_${hitbox}`).on('click', function () { updateHitboxMapping(hitbox); });
        $(`#vrm_hitbox_motion_replay_${hitbox}`).on('click', function () { updateHitboxMapping(hitbox); });

        
        // Default loaded
        if (extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]['expression'] != $(`#vrm_hitbox_expression_select_${hitbox}`).val()) {
            extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]['expression'] = $(`#vrm_hitbox_expression_select_${hitbox}`).val();
            saveSettingsDebounced();
        }
        
        if (extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]['motion'] != $(`#vrm_hitbox_motion_select_${hitbox}`).val()) {
            extension_settings.vrm.model_settings[model_path]['hitboxes_mapping'][hitbox]['motion'] = $(`#vrm_hitbox_motion_select_${hitbox}`).val();
            saveSettingsDebounced();
        }
    }


    // Default expression/motion
    loadAnimationUi(
        "default",
        use_default_settings,
        model_expressions,
        model_motions,
        'vrm_default_expression_select',
        'vrm_default_motion_select',
        extension_settings.vrm.model_settings[model_path]['animation_default']['expression'],
        extension_settings.vrm.model_settings[model_path]['animation_default']['motion']);

    // Default loaded
    if (extension_settings.vrm.model_settings[model_path]['animation_default']['expression'] != $(`#vrm_default_expression_select`).val()) {
        extension_settings.vrm.model_settings[model_path]['animation_default']['expression'] = $(`#vrm_default_expression_select`).val();
        saveSettingsDebounced();
    }
    
    if (extension_settings.vrm.model_settings[model_path]['animation_default']['motion'] != $(`#vrm_default_motion_select`).val()) {
        extension_settings.vrm.model_settings[model_path]['animation_default']['motion'] = $(`#vrm_default_motion_select`).val();
        saveSettingsDebounced();
    }

    // Classify expressions mapping
    for (const expression of CLASSIFY_EXPRESSIONS) {
        expression_ui.append(`
        <div class="vrm-parameter">
            <div class="vrm-parameter-title">
                <label for="vrm_expression_${expression}">
                ${expression}
                </label>
            </div>
            <div>
                <div class="vrm-select-div">
                    <select id="vrm_expression_select_${expression}">
                    </select>
                    <div id="vrm_expression_replay_${expression}" class="vrm_replay_button menu_button">
                        <i class="fa-solid fa-arrow-rotate-left"></i>
                    </div>
                </div>
                <div class="vrm-select-div">
                    <select id="vrm_motion_select_${expression}">
                    </select>
                    <div id="vrm_motion_replay_${expression}" class="vrm_replay_button menu_button">
                        <i class="fa-solid fa-arrow-rotate-left"></i>
                    </div>
                </div>
            </div>
        </div>
        `);

        loadAnimationUi(
            expression,
            use_default_settings,
            model_expressions,
            model_motions,
            `vrm_expression_select_${expression}`,
            `vrm_motion_select_${expression}`,
            extension_settings.vrm.model_settings[model_path]['classify_mapping'][expression]['expression'],
            extension_settings.vrm.model_settings[model_path]['classify_mapping'][expression]['motion']);

        $(`#vrm_expression_select_${expression}`).on('change', function () { updateExpressionMapping(expression); });
        $(`#vrm_motion_select_${expression}`).on('change', function () { updateExpressionMapping(expression); });
        $(`#vrm_expression_replay_${expression}`).on('click', function () { updateExpressionMapping(expression); });
        $(`#vrm_motion_replay_${expression}`).on('click', function () { updateExpressionMapping(expression); });

        // Default loaded
        if (extension_settings.vrm.model_settings[model_path]['classify_mapping'][expression]['expression'] != $(`#vrm_expression_select_${expression}`).val()) {
            extension_settings.vrm.model_settings[model_path]['classify_mapping'][expression]['expression'] = $(`#vrm_expression_select_${expression}`).val();
            saveSettingsDebounced();
        }
        
        if (extension_settings.vrm.model_settings[model_path]['classify_mapping'][expression]['motion'] != $(`#vrm_motion_select_${expression}`).val()) {
            extension_settings.vrm.model_settings[model_path]['classify_mapping'][expression]['motion'] = $(`#vrm_motion_select_${expression}`).val();
            saveSettingsDebounced();
        }
    }
}

async function updateHitboxMapping(hitbox) {
    const character = String($('#vrm_character_select').val());
    const model = String($('#vrm_model_select').val());
    const model_expression = $(`#vrm_hitbox_expression_select_${hitbox}`).val();
    const model_motion = $(`#vrm_hitbox_motion_select_${hitbox}`).val();
    const message = $(`#vrm_hitbox_message_${hitbox}`).val();

    extension_settings.vrm.model_settings[model]['hitboxes_mapping'][hitbox] = { 'expression': model_expression, 'motion': model_motion, 'message': message };
    saveSettingsDebounced();

    await setExpression(character, model_expression);
    await setMotion(character, model_motion, true, true, true);
    console.debug(DEBUG_PREFIX, 'Updated hitbox mapping:', hitbox, extension_settings.vrm.model_settings[model]['hitboxes_mapping'][hitbox]);
}

async function updateExpressionMapping(expression) {
    const character = String($('#vrm_character_select').val());
    const model = String($('#vrm_model_select').val());
    const model_expression = $(`#vrm_expression_select_${expression}`).val();
    const model_motion = $(`#vrm_motion_select_${expression}`).val();

    extension_settings.vrm.model_settings[model]['classify_mapping'][expression] = { 'expression': model_expression, 'motion': model_motion };
    saveSettingsDebounced();

    await setExpression(character, model_expression);

    await setMotion(character, model_motion, true, true, true);
    console.debug(DEBUG_PREFIX, 'Updated expression mapping:', expression, extension_settings.vrm.model_settings[model]['classify_mapping'][expression]);
}

function updateCharactersList() {
    console.debug(DEBUG_PREFIX, 'updateCharactersList called');
    let current_characters = new Set();
    const context = getContext();
    for (const i of context.characters) {
        current_characters.add(i.name);
    }

    current_characters = Array.from(current_characters);

    if (current_characters.length == 0)
        return;

    let chat_members = currentChatMembers();
    console.debug(DEBUG_PREFIX, 'Chat members', chat_members);

    // Sort group character on top
    for (const i of chat_members) {
        let index = current_characters.indexOf(i);
        if (index != -1) {
            console.debug(DEBUG_PREFIX, 'Moving to top', i);
            current_characters.splice(index, 1);
        }
    }

    current_characters = chat_members;

    if (JSON.stringify(characters_list) !== JSON.stringify(current_characters)) {
        characters_list = current_characters;

        $('#vrm_character_select')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select Character</option>')
            .val('none');

        for (const charName of characters_list) {
            $('#vrm_character_select').append(new Option(charName, charName));
        }

        console.debug(DEBUG_PREFIX, 'Updated character list to:', characters_list);
    }
}

async function updateCharactersModels(refreshButton = false) {
    console.debug(DEBUG_PREFIX, 'updateCharactersModels called with refreshButton:', refreshButton);
    console.debug(DEBUG_PREFIX, 'Current models_files length:', models_files.length);
    
    const context = getContext();
    const chat_members = currentChatMembers();

    console.debug(DEBUG_PREFIX, 'Updating models mapping');

    // Get local assets only
    console.debug(DEBUG_PREFIX, 'Calling getLocalAssets');
    const localAssets = await getLocalAssets(refreshButton);
    console.debug(DEBUG_PREFIX, 'Local assets loaded:', localAssets);

    console.debug(DEBUG_PREFIX, 'Models from local folder:',localAssets['models']);

    if (refreshButton || models_files.length == 0) {
        console.debug(DEBUG_PREFIX, 'Refreshing models list');
        models_files = [];
        models_files_label = [];
        
        // Add local models
        for (const entry of localAssets['models']) {
            let label = entry.replaceAll('\\', '/').replace(".vrm","");
            label = label.substring(label.lastIndexOf('/')+1);
            models_files.push(entry);
            models_files_label.push([label,entry]);
        }
        
        console.debug(DEBUG_PREFIX, 'Updated models list to:', models_files, models_files_label);
    }

    console.debug(DEBUG_PREFIX, 'Processing animations');
    animations_files = localAssets['animations']; // Keep full paths for animation loading
    animations_groups = [];
    console.debug(DEBUG_PREFIX, 'Animations files:', animations_files.length);
    for(const fullPath of animations_files) {
        // Extract just the filename for group processing
        const filename = fullPath.substring(fullPath.lastIndexOf('/') + 1);
        const animation_group_name = filename.replace(/\.[^/.]+$/, "").replace(/\d+$/, "");
        if (!animations_groups.includes(animation_group_name))
            animations_groups.push(animation_group_name);
    }

    console.debug(DEBUG_PREFIX, 'Updated animations to:', animations_files, animations_groups);
    console.debug(DEBUG_PREFIX, 'Triggering change event on vrm_character_select');
    $('#vrm_character_select').trigger('change');
}

// Get local assets from extension directory
// Cache for assets to avoid repeated fetches
let assetsCache = null;
let assetsCacheTime = 0;
const ASSETS_CACHE_DURATION = 60000; // 1 minute

async function getLocalAssets(forceRefresh = false) {
    const now = Date.now();
    
    // Return cached assets if they're still valid and not forcing refresh
    if (!forceRefresh && assetsCache && (now - assetsCacheTime) < ASSETS_CACHE_DURATION) {
        console.debug(DEBUG_PREFIX, 'Using cached assets');
        return assetsCache;
    }
    
    try {
        console.debug(DEBUG_PREFIX, 'Attempting to load assets.json file');
        const response = await fetch('/scripts/extensions/third-party/NEMO-VRM/assets/assets.json', {
            cache: 'no-store' // Prevent browser caching issues
        });
        console.debug(DEBUG_PREFIX, 'Response status:', response.status);
        
        if (response.ok) {
            const assets = await response.json();
            
            // Validate and sanitize assets
            const sanitizedAssets = {
                models: Array.isArray(assets.models) ? assets.models.filter(Boolean) : [],
                animations: Array.isArray(assets.animations) ? assets.animations.filter(Boolean) : [],
                environments: Array.isArray(assets.environments) ? assets.environments.filter(Boolean) : []
            };
            
            console.debug(DEBUG_PREFIX, 'Loaded and sanitized assets from JSON file:', sanitizedAssets);
            
            // Update cache
            assetsCache = sanitizedAssets;
            assetsCacheTime = now;
            
            return sanitizedAssets;
        } else {
            console.error(DEBUG_PREFIX, 'Failed to load assets.json file, status:', response.status);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error(DEBUG_PREFIX, 'Error loading assets.json file:', error);
        
        // Return empty structure if we don't have cached data
        const fallback = {
            models: [],
            animations: [],
            environments: []
        };
        
        if (!assetsCache) {
            assetsCache = fallback;
            assetsCacheTime = now;
        }
        
        return assetsCache;
    }
}

async function updateCharactersListOnce() {
    console.debug(DEBUG_PREFIX, 'updateCharactersListOnce called');
    console.debug(DEBUG_PREFIX, 'UDPATING char list', characters_list);
    while (characters_list.length == 0) {
        console.debug(DEBUG_PREFIX, 'UDPATING char list');
        updateCharactersList();
        await delay(1000);
    }
}

//#############################//
//  API Calls                  //
//#############################//

async function getAssetsVRMFiles() {
    console.debug(DEBUG_PREFIX, 'Getting assets from global assets folder - returning empty');
    // Return empty object since we're using local assets only
    return {
        'vrm': {
            'model': [],
            'animation': []
        }
    };
}